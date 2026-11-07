'use strict';

// This module executes only from the repository's trusted default branch.
// The PR body is untrusted data; never evaluate it or check out its head.
const { createHash } = require('node:crypto');
const { parseAttestationHeader } = require('./attestation-contract.cjs');
const VERIFIED_LABEL = 'issue-verified-complete';

// Strict declaration extractor: returns [] unless the whole attestation header
// is valid under the shared contract. Kept as a named export for diagnostics and
// legacy tests; the closure gate uses parseAttestationHeader() directly.
function linkedIssueNumbers(body) {
  const parsed = parseAttestationHeader(body);
  return parsed.ok ? parsed.issues : [];
}

function verificationReceipt(body) {
  const parsed = parseAttestationHeader(body);
  if (!parsed.ok || !parsed.head || !parsed.verification) return null;
  return { head: parsed.head, evidence: parsed.verification };
}

async function closeVerifiedIssues({ github, context, core }) {
  const { owner, repo } = context.repo;
  const payload = context.payload;
  if (payload.action !== 'labeled' || payload.label?.name !== VERIFIED_LABEL) {
    return { closed: [], skipped: 'not a verified-label event' };
  }

  const number = payload.pull_request?.number;
  if (!Number.isSafeInteger(number) || number < 1) {
    return { closed: [], skipped: 'not a pull request' };
  }


  // The label identifies an explicit human attestation; authorization is
  // evaluated using the actor's effective role at execution/mutation time.
  // GitHub's Issue Events API does not expose the actor's historical role.
  const labeler = payload.sender?.login;
  if (!labeler) return { closed: [], skipped: 'missing label actor' };
  if (payload.sender.type !== 'User') {
    return { closed: [], skipped: 'non-human label actor' };
  }
  const authorizedLabeler = async () => {
    const { data: access } = await github.rest.repos.getCollaboratorPermissionLevel({
      owner, repo, username: labeler,
    });
    // Maintain maps to legacy permission "write"; use the effective role.
    return ['admin', 'maintain'].includes(access.role_name);
  };
  if (!(await authorizedLabeler())) {
    core.info('Skipped: label actor lacks maintainer permission.');
    return { closed: [], skipped: 'untrusted label actor' };
  }
  // Re-read the current PR. Never trust the event snapshot alone.
  const { data: pr } = await github.rest.pulls.get({ owner, repo, pull_number: number });
  const repository = `${owner}/${repo}`;
  const eligible = (candidate) => (
    candidate.state === 'open' &&
    !candidate.draft &&
    candidate.base.ref === 'dev' &&
    candidate.base.repo?.full_name === repository &&
    candidate.head.repo?.full_name === repository &&
    candidate.labels?.some((label) => label.name === VERIFIED_LABEL)
  );
  if (!eligible(pr)) {
    core.info('Skipped: PR is draft, closed, external, not targeting dev, or no longer verified.');
    return { closed: [], skipped: 'ineligible pull request' };
  }
  // The labeler may also be the PR author in a single-maintainer repository.
  // Completion still requires a separate maintainer action (the label event).
  // Certify exactly the HEAD and declaration set that the maintainer labeled;
  // current API data alone cannot prove that later edits were reviewed.
  if (payload.pull_request.head?.sha !== pr.head.sha ||
      payload.pull_request.body !== pr.body) {
    core.info('Skipped: PR head or body changed after the verification label event.');
    return { closed: [], skipped: 'post-signoff PR changes' };
  }

  const attestation = parseAttestationHeader(pr.body);
  if (!attestation.ok) {
    core.info('Skipped: PR body does not contain a valid strict attestation header.');
    return { closed: [], skipped: 'invalid attestation header' };
  }
  const receipt = { head: attestation.head, evidence: attestation.verification };
  if (receipt.head !== pr.head.sha.toLowerCase()) {
    core.info('Skipped: Verification and Verified-Head must certify the current PR HEAD.');
    return { closed: [], skipped: 'missing or stale verification receipt' };
  }

  const issueNumbers = attestation.issues;
  if (!issueNumbers.length) {
    core.info('Skipped: no standalone Closes #N / Fixes #N / Resolves #N declarations.');
    return { closed: [], skipped: 'no explicit issue linkage' };
  }
  const snapshots = attestation.snapshots;
  // Audit receipts must not be reused across distinct verified declarations.
  // Changing PR body after labeling invalidates the original attestation.
  const bodyFingerprint = createHash('sha256').update(pr.body).digest('hex');
  // A label may be removed or the PR edited while this run processes Issues.
  // Recheck immediately before each remote mutation; GitHub has no atomic
  // conditional Issue close tied to a PR's HEAD or label state.
  // GitHub's labeled webhook has no issue-event ID to tie it to a unique
  // timeline event. Fail closed unless this PR has exactly one lifetime
  // application of this label, by the same verified account, and no removal.
  // This deliberately requires separate handling after revocation/relabeling.
  const approvalHistoryCurrent = async () => {
    const events = await github.paginate(github.rest.issues.listEvents, {
      owner, repo, issue_number: number, per_page: 100,
    });
    const changes = events.filter((event) =>
      (event.event === 'labeled' || event.event === 'unlabeled') &&
      event.label?.name === VERIFIED_LABEL);
    if (changes.length !== 1) return false;
    const event = changes[0];
    return event.event === 'labeled' &&
      Number.isSafeInteger(event.id) && event.id > 0 &&
      Number.isFinite(Date.parse(event.created_at)) &&
      event.actor?.type === 'User' &&
      Number.isSafeInteger(payload.sender.id) && payload.sender.id > 0 &&
      event.actor.id === payload.sender.id &&
      event.actor.login?.toLowerCase() === labeler.toLowerCase() &&
      event.performed_via_github_app == null;
  };
  if (!(await approvalHistoryCurrent())) {
    core.info('Skipped: verification label history cannot establish uninterrupted maintainer approval.');
    return { closed: [], skipped: 'unverifiable label approval' };
  }
  const approvalStillCurrent = async () => {
    const { data: live } = await github.rest.pulls.get({ owner, repo, pull_number: number });
    return eligible(live) && live.head.sha === pr.head.sha && live.body === pr.body &&
      await authorizedLabeler() && await approvalHistoryCurrent();
  };

  const closed = [];
  const issueSnapshotHash = (issue) => createHash('sha256')
    .update(JSON.stringify([String(issue.title ?? ''), String(issue.body ?? '')]))
    .digest('hex');
  // Read the Issue again at every mutation boundary. Comments or an
  // independent edit must not silently change what was attested.
  const issueStillCurrent = async (issue_number) => {
    const { data: live } = await github.rest.issues.get({ owner, repo, issue_number });
    return !live.pull_request && live.state === 'open' &&
      issueSnapshotHash(live) === snapshots.get(issue_number);
  };
  for (const issue_number of issueNumbers) {
    let issue;
    try {
      ({ data: issue } = await github.rest.issues.get({ owner, repo, issue_number }));
    } catch (error) {
      if (error.status === 404) {
        core.info(`Skipped nonexistent issue #${issue_number}.`);
        continue;
      }
      throw error;
    }

    if (issue.pull_request || issue.state !== 'open') {
      core.info(`Skipped issue #${issue_number}: not an open issue.`);
      continue;
    }
    if (issueSnapshotHash(issue) !== snapshots.get(issue_number)) {
      core.info(`Stopped: acceptance criteria changed for Issue #${issue_number}.`);
      return { closed, skipped: 'issue acceptance snapshot changed' };
    }

    // Record evidence before the state change. If closing fails, rerunning
    // the same unchanged attestation can reuse the existing bot receipt.
    const marker = `<!-- verified-issue-closure:pr-${number}:issue-${issue_number}:sha-${receipt.head}:body-${bodyFingerprint}:issue-snapshot-${snapshots.get(issue_number)} -->`;
    const comments = await github.paginate(github.rest.issues.listComments, {
      owner, repo, issue_number, per_page: 100,
    });
    const recorded = comments.some((comment) =>
      comment.user?.login === 'github-actions[bot]' &&
      comment.user?.id === 41898282 &&
      comment.user?.type === 'Bot' &&
      comment.body?.includes(marker));
    if (!(await approvalStillCurrent()) || !(await issueStillCurrent(issue_number))) {
      core.info('Stopped: maintainer approval or Issue acceptance snapshot changed before audit.');
      return { closed, skipped: 'approval or issue snapshot changed during closure' };
    }
    if (!recorded) {
      await github.rest.issues.createComment({
        owner,
        repo,
        issue_number,
        body: `Verified completion attestation for published PR: ${pr.html_url}\n\n` +
          `Verified commit: \`${receipt.head}\`\n\nVerification: ${receipt.evidence}\n\n` +
          `Reviewed Issue title/body SHA-256: \`${snapshots.get(issue_number)}\`\n\n` +
          'Issue closure is attempted after this receipt; the PR still requires independent review and merge approval.\n\n' + marker,
      });
    }
    if (!(await approvalStillCurrent()) || !(await issueStillCurrent(issue_number))) {
      core.info('Stopped: maintainer approval or Issue acceptance snapshot changed before closing.');
      return { closed, skipped: 'approval or issue snapshot changed during closure' };
    }
    await github.rest.issues.update({
      owner, repo, issue_number, state: 'closed', state_reason: 'completed',
    });
    closed.push(issue_number);
  }
  core.info(`Closed verified issues: ${closed.join(', ') || 'none'}.`);
  return { closed };
}

module.exports = {
  VERIFIED_LABEL,
  linkedIssueNumbers,
  verificationReceipt,
  parseAttestation: parseAttestationHeader,
  closeVerifiedIssues,
};
