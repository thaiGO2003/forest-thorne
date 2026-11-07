'use strict';

// This module executes only from the repository's trusted default branch.
// The PR body is untrusted data; never evaluate it or check out its head.
const { createHash } = require('node:crypto');
const VERIFIED_LABEL = 'issue-verified-complete';

// Only an exact, plain-text header at the very beginning of the PR body is
// attested. An optional `---` separates it from free-form Markdown prose.
// Fail closed on ANY other header syntax: nested HTML, quoted Markdown,
// code fences, lists, indents, and hidden content cannot add declarations.
function declarationLines(body) {
  const lines = [];
  for (const line of String(body ?? '').split(/\r?\n/)) {
    if (line === '---') break;
    if (!line) continue;
    if (!/^(?:Closes|Fixes|Resolves) #[1-9]\d*$/i.test(line) &&
        !/^Verified-Head: [a-f0-9]{40}$/i.test(line) &&
        !/^Verification: \S.{0,1499}$/i.test(line) &&
        !/^Issue-Snapshot: #[1-9]\d* sha256:[a-f0-9]{64}$/i.test(line)) {
      return [];
    }
    const closure = /^(?:Closes|Fixes|Resolves) #([1-9]\d*)$/i.exec(line);
    if (closure && !Number.isSafeInteger(Number(closure[1]))) return [];
    lines.push(line);
  }
  return lines;
}

// A contributor-provided digest is data, not authorization. The separate
// maintainer label event certifies the exact PR body containing these digests.
function issueSnapshots(body, issueNumbers) {
  const snapshots = new Map();
  for (const line of declarationLines(body)) {
    if (!/^Issue-Snapshot:/i.test(line)) continue;
    const match = /^Issue-Snapshot: #([1-9]\d*) sha256:([a-f0-9]{64})$/i.exec(line);
    const number = Number(match?.[1]);
    if (!Number.isSafeInteger(number) || snapshots.has(number)) return null;
    snapshots.set(number, match[2].toLowerCase());
  }
  return snapshots.size === issueNumbers.length &&
    issueNumbers.every((number) => snapshots.has(number)) ? snapshots : null;
}

function linkedIssueNumbers(body) {
  const numbers = new Set();
  for (const line of declarationLines(body)) {
    const match = line.match(/^(?:Closes|Fixes|Resolves)\s+#([1-9]\d*)$/i);
    if (!match) continue;
    const number = Number(match[1]);
    if (Number.isSafeInteger(number)) numbers.add(number);
  }
  return [...numbers];
}

function verificationReceipt(body) {
  const lines = declarationLines(body);
  const heads = lines.filter((line) => /^Verified-Head:/i.test(line));
  const evidenceLines = lines.filter((line) => /^Verification:/i.test(line));
  if (heads.length !== 1 || evidenceLines.length !== 1) return null;
  const head = heads[0].match(/^Verified-Head:\s*([a-f0-9]{40})\s*$/i)?.[1];
  const evidence = evidenceLines[0].match(/^Verification:\s*(\S.*)$/i)?.[1]?.trim();
  return head && evidence ? { head: head.toLowerCase(), evidence: evidence.slice(0, 1500) } : null;
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

  const receipt = verificationReceipt(pr.body);
  if (!receipt || receipt.head !== pr.head.sha.toLowerCase()) {
    core.info('Skipped: Verification and Verified-Head must certify the current PR HEAD.');
    return { closed: [], skipped: 'missing or stale verification receipt' };
  }

  const issueNumbers = linkedIssueNumbers(pr.body);
  if (!issueNumbers.length) {
    core.info('Skipped: no standalone Closes #N / Fixes #N / Resolves #N declarations.');
    return { closed: [], skipped: 'no explicit issue linkage' };
  }
  const snapshots = issueSnapshots(pr.body, issueNumbers);
  if (!snapshots) {
    core.info('Skipped: every linked Issue must have exactly one reviewed Issue-Snapshot.');
    return { closed: [], skipped: 'missing or ambiguous issue snapshots' };
  }
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

module.exports = { VERIFIED_LABEL, linkedIssueNumbers, verificationReceipt, closeVerifiedIssues };
