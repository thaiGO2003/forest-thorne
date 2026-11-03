'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { test } = require('node:test');
const { linkedIssueNumbers, verificationReceipt, closeVerifiedIssues } = require('../scripts/github/close-verified-pr-issues.cjs');

const SHA = 'a'.repeat(40);
const hashIssue = (title, body) => createHash('sha256')
  .update(JSON.stringify([String(title ?? ''), String(body ?? '')]))
  .digest('hex');
const EMPTY_ISSUE_HASH = hashIssue('', '');
const GOOD_BODY = `Closes #12
Fixes #14
Closes #12
Issue-Snapshot: #12 sha256:${EMPTY_ISSUE_HASH}
Issue-Snapshot: #14 sha256:${EMPTY_ISSUE_HASH}
Verification: pnpm typecheck, targeted regression tests and runtime smoke passed
Verified-Head: ${SHA}
---
Implementation and examples below this line are not declarations.`;

function harness({
  body = GOOD_BODY, prChanges = {}, eventPrChanges = {}, issues = {}, action = 'labeled',
  eventLabel = 'issue-verified-complete', actor = 'reviewer', actorId = 901,
  actorType = 'User', permission = 'maintain',
  roleName = permission, roleNameByRead = {}, failUpdate = false, failList = false, failComment = false,
  failEvents = false, labelEventsByRead = {},
  labelEvents = [{ id: 10, event: 'labeled', created_at: '2026-11-02T04:00:00Z',
    label: { name: 'issue-verified-complete' },
    actor: { login: 'reviewer', id: 901, type: 'User' } }],
  storedComments = new Map(), prChangesByRead = {}, issueBodiesByRead = {}, issueTitlesByRead = {},
} = {}) {
  const updates = [];
  const comments = [];
  const lookups = [];
  const info = [];
  const issueReads = [];
  const effects = [];
  const prReads = [];
  const labelHistoryReads = [];
  const permissionReads = [];
  const pr = {
    number: 88, state: 'open', draft: false, body, html_url: 'https://github.com/owner/game/pull/88',
    user: { login: 'contributor' },
    head: { sha: SHA, repo: { full_name: 'owner/game' } },
    base: { ref: 'dev', repo: { full_name: 'owner/game' } },
    labels: [{ name: 'issue-verified-complete' }],
    ...prChanges,
  };
  const github = {
    rest: {
      repos: {
        getCollaboratorPermissionLevel: async ({ username }) => {
          assert.equal(username, actor);
          permissionReads.push(username);
          return { data: { permission: permission === 'maintain' ? 'write' : permission,
            role_name: roleNameByRead[permissionReads.length] ?? roleName } };
        },
      },
      pulls: { get: async ({ pull_number }) => {
        assert.equal(pull_number, 88);
        prReads.push(pull_number);
        return { data: { ...pr, ...prChangesByRead[prReads.length] } };
      } },
      issues: {
        get: async ({ issue_number }) => {
          lookups.push(issue_number);
          issueReads.push(issue_number);
          if (issues[issue_number] === '404') throw Object.assign(new Error('not found'), { status: 404 });
          const nth = issueReads.filter((number) => number === issue_number).length;
          const issue = issues[issue_number] ?? { state: 'open' };
          return { data: {
            ...issue,
            title: issueTitlesByRead[issue_number]?.[nth] ?? issue.title ?? '',
            body: issueBodiesByRead[issue_number]?.[nth] ?? issue.body ?? '',
          } };
        },
        listComments: async () => { throw new Error('paginate must invoke this mock'); },
        listEvents: async () => { throw new Error('paginate must invoke this mock'); },
        update: async (opts) => {
          effects.push('update');
          if (failUpdate) throw new Error('permission denied');
          updates.push(opts);
        },
        createComment: async (opts) => {
          effects.push('comment');
          if (failComment) throw new Error('comment failed');
          comments.push(opts);
          const history = storedComments.get(opts.issue_number) ?? [];
          history.push({
            user: { login: 'github-actions[bot]', id: 41898282, type: 'Bot' },
            body: opts.body,
          });
          storedComments.set(opts.issue_number, history);
        },
      },
    },
    paginate: async (endpoint, { issue_number }) => {
      if (endpoint === github.rest.issues.listEvents) {
        assert.equal(issue_number, 88);
        labelHistoryReads.push(issue_number);
        if (failEvents) throw new Error('event history unavailable');
        return labelEventsByRead[labelHistoryReads.length] ?? labelEvents;
      }
      assert.equal(endpoint, github.rest.issues.listComments);
      effects.push('list');
      if (failList) throw new Error('list failed');
      return storedComments.get(issue_number) ?? [];
    },
  };
  const context = {
    repo: { owner: 'owner', repo: 'game' },
    payload: {
      action,
      label: { name: eventLabel },
      pull_request: {
        number: 88, head: { sha: pr.head.sha }, body: pr.body, ...eventPrChanges,
      },
      ...(actor ? { sender: { login: actor, id: actorId, ...(actorType === null ? {} : { type: actorType }) } } : {}),
    },
  };
  return { github, context, core: { info: (message) => info.push(message) },
    updates, comments, lookups, issueReads, info, effects, storedComments, prReads, labelHistoryReads, permissionReads };
}

test('only exact plain-text header directives are eligible', () => {
  assert.deepEqual(linkedIssueNumbers('Closes #12\nResolves #13\n---\nFixes #99'), [12, 13]);
  assert.deepEqual(linkedIssueNumbers('Related to #5\nCloses #12'), []);
  assert.deepEqual(linkedIssueNumbers('Closes #12\n- Fixes #10'), []);
});

test('verified, non-draft PR closes each open linked issue exactly once with a receipt', async () => {
  const fixture = harness();
  assert.deepEqual((await closeVerifiedIssues(fixture)).closed, [12, 14]);
  assert.deepEqual(fixture.updates.map((update) => [update.issue_number, update.state, update.state_reason]), [
    [12, 'closed', 'completed'], [14, 'closed', 'completed'],
  ]);
  assert.equal(fixture.comments.length, 2);
  for (const comment of fixture.comments) {
    assert.match(comment.body, /pull\/88/);
    assert.match(comment.body, /Verified commit: /);
    assert.match(comment.body, /review and merge approval/);
  }
});

test('missing, edited, or stale receipts cannot close issues', async () => {
  for (const body of [
    'Closes #12\nVerified-Head: ' + SHA,
    'Closes #12\nVerification: tested',
    GOOD_BODY.replace(SHA, 'b'.repeat(40)),
    GOOD_BODY.replace('Verification: pnpm', 'Note: pnpm'),
  ]) {
    const fixture = harness({ body });
    await closeVerifiedIssues(fixture);
    assert.equal(fixture.updates.length, 0);
    assert.equal(fixture.lookups.length, 0);
  }
});

test('PR eligibility checks reject drafts, foreign forks, wrong targets and removed labels', async () => {
  for (const prChanges of [
    { draft: true },
    { state: 'closed' },
    { base: { ref: 'main', repo: { full_name: 'owner/game' } } },
    { base: { ref: 'dev', repo: { full_name: 'other/game' } } },
    { head: { sha: SHA, repo: { full_name: 'fork/game' } } },
    { head: { sha: 'b'.repeat(40), repo: { full_name: 'owner/game' } } },
    { labels: [] },
  ]) {
    const fixture = harness({ prChanges });
    await closeVerifiedIssues(fixture);
    assert.equal(fixture.updates.length, 0);
  }
});

test('only matching explicit label events close issues', async () => {
  for (const changes of [
    { action: 'synchronize' },
    { action: 'labeled', eventLabel: 'bug' },
  ]) {
    const fixture = harness(changes);
    await closeVerifiedIssues(fixture);
    assert.equal(fixture.updates.length, 0);
  }
});

test('already-closed items, pull request numbers and missing issues are not mutated', async () => {
  const fixture = harness({ issues: {
    12: { state: 'closed' },
    14: { state: 'open', pull_request: { url: 'https://example.test/pr' } },
  }, body: GOOD_BODY.replace('---', `Closes #16\nIssue-Snapshot: #16 sha256:${EMPTY_ISSUE_HASH}\nCloses #17\nIssue-Snapshot: #17 sha256:${EMPTY_ISSUE_HASH}\n---`), });
  fixture.github.rest.issues.get = async ({ issue_number }) => {
    fixture.lookups.push(issue_number);
    if (issue_number === 16) throw Object.assign(new Error('not found'), { status: 404 });
    if (issue_number === 17) return { data: { state: 'open' } };
    return { data: issue_number === 12 ? { state: 'closed' } : { state: 'open', pull_request: {} } };
  };
  assert.deepEqual((await closeVerifiedIssues(fixture)).closed, [17]);
  assert.deepEqual(fixture.updates.map((item) => item.issue_number), [17]);
});

test('issue closure failure leaves an audit receipt but does not claim closure', async () => {
  const fixture = harness({ failUpdate: true });
  await assert.rejects(() => closeVerifiedIssues(fixture), /permission denied/);
  assert.equal(fixture.comments.length, 1);
  assert.deepEqual(fixture.effects, ['list', 'comment', 'update']);
  assert.equal(fixture.updates.length, 0);
});

test('hidden Markdown, HTML and quoted declarations invalidate the entire header', () => {
  const forms = [
    ['Closes #12', '```md', 'Fixes #15', '```'],
    ['Closes #12', '~~~', 'Resolves #16', '~~~'],
    ['Closes #12', '<!--', 'Closes #17', '-->'],
    ['Closes #12', '<details>', '<summary>Hidden</summary>', 'Fixes #18', '</details>'],
    ['Closes #12', '<details><details>', 'Fixes #19', '</details></details>'],
    ['Closes #12', '> Fixes #20'],
  ];
  for (const lines of forms) assert.deepEqual(linkedIssueNumbers(lines.join('\n')), []);
});

test('only maintainers may certify the completion label', async () => {
  for (const props of [
    { actor: null },
    { permission: 'read' },
    { permission: 'triage' },
    { permission: 'write' },
  ]) {
    const fixture = harness(props);
    const result = await closeVerifiedIssues(fixture);
    assert.deepEqual(result.closed, []);
    assert.equal(fixture.updates.length, 0);
    assert.equal(fixture.comments.length, 0);
  }
});

test('repository maintainer can certify own PR with a separate label event', async () => {
  const fixture = harness({ prChanges: { user: { login: 'reviewer' } } });
  assert.deepEqual((await closeVerifiedIssues(fixture)).closed, [12, 14]);
});

test('GitHub maps maintainer base permission to write but retains maintain role_name', async () => {
  const maintainer = harness({ permission: 'maintain' });
  assert.deepEqual((await closeVerifiedIssues(maintainer)).closed, [12, 14]);
  const writer = harness({ permission: 'write', roleName: 'write' });
  assert.deepEqual((await closeVerifiedIssues(writer)).closed, []);
  assert.equal(writer.comments.length, 0);
  const administrator = harness({ permission: 'admin', roleName: 'admin' });
  assert.deepEqual((await closeVerifiedIssues(administrator)).closed, [12, 14]);
  const misleadingBaseRole = harness({ permission: 'admin', roleName: 'write' });
  assert.deepEqual((await closeVerifiedIssues(misleadingBaseRole)).closed, []);
  assert.equal(misleadingBaseRole.comments.length, 0);
});

test('execution-time role is authoritative, not inferred historical label-time role', async () => {
  // GitHub label events do not carry a historical collaborator-role snapshot.
  // A role granted after labeling is indistinguishable from an earlier grant.
  const elevatedAtExecution = harness({ roleNameByRead: { 1: 'maintain' }, roleName: 'maintain' });
  assert.deepEqual((await closeVerifiedIssues(elevatedAtExecution)).closed, [12, 14]);
  const lackingRoleAtExecution = harness({ roleName: 'write' });
  assert.deepEqual((await closeVerifiedIssues(lackingRoleAtExecution)).closed, []);
  assert.equal(lackingRoleAtExecution.comments.length, 0);
  assert.equal(lackingRoleAtExecution.updates.length, 0);
});


test('bot and app actors cannot attest Issue completion even with maintainer role', async () => {
  for (const actorType of ['Bot', 'Organization', null]) {
    const fixture = harness({ actorType });
    assert.deepEqual((await closeVerifiedIssues(fixture)).closed, []);
    assert.equal(fixture.comments.length, 0);
    assert.equal(fixture.updates.length, 0);
  }
});

test('already recorded bot receipt is reused after a failed close', async () => {
  const storedComments = new Map();
  const first = harness({ failUpdate: true, storedComments });
  await assert.rejects(() => closeVerifiedIssues(first), /permission denied/);
  const retry = harness({ storedComments });
  assert.deepEqual((await closeVerifiedIssues(retry)).closed, [12, 14]);
  assert.equal(retry.comments.length, 1);
  assert.deepEqual(retry.effects.slice(0, 2), ['list', 'update']);
});

test('incorrect bot identity cannot authorize reuse of an audit receipt', async () => {
  for (const forgedUser of [
    { login: 'github-actions[bot]', id: 12345, type: 'Bot' },
    { login: 'github-actions[bot]', id: 41898282, type: 'User' },
  ]) {
    const storedComments = new Map();
    await assert.rejects(
      () => closeVerifiedIssues(harness({ failUpdate: true, storedComments })),
      /permission denied/,
    );
    storedComments.get(12)[0].user = forgedUser;

    const retry = harness({ storedComments });
    assert.deepEqual((await closeVerifiedIssues(retry)).closed, [12, 14]);
    assert.equal(retry.comments.length, 2);
    assert.deepEqual(retry.effects.slice(0, 3), ['list', 'comment', 'update']);
    assert.equal(storedComments.get(12)[1].user.id, 41898282);
    assert.equal(storedComments.get(12)[1].user.type, 'Bot');
  }
});

test('body edits after attestation cannot reuse a prior receipt even at the same HEAD', async () => {
  const storedComments = new Map();
  const first = harness({ failUpdate: true, storedComments });
  await assert.rejects(() => closeVerifiedIssues(first), /permission denied/);
  const revisedBody = GOOD_BODY.replace('runtime smoke passed', 'runtime smoke and new acceptance checks passed');
  const retry = harness({ body: revisedBody, eventPrChanges: { body: GOOD_BODY }, storedComments });
  assert.equal((await closeVerifiedIssues(retry)).skipped, 'post-signoff PR changes');
  assert.equal(retry.comments.length, 0);
  assert.equal(retry.updates.length, 0);
  assert.equal(storedComments.get(12).length, 1);
});

test('audit lookup and recording failures never update an issue', async () => {
  for (const flag of ['failList', 'failComment']) {
    const fixture = harness({ [flag]: true });
    await assert.rejects(() => closeVerifiedIssues(fixture), /failed/);
    assert.equal(fixture.updates.length, 0);
  }
});

test('changes to the PR after maintainer labeling invalidate the approval', async () => {
  for (const eventPrChanges of [
    { head: { sha: 'b'.repeat(40) } },
    { body: GOOD_BODY.replace('Closes #12', 'Closes #900') },
    { body: GOOD_BODY.replace('Verification:', 'Unverified:') },
  ]) {
    const fixture = harness({ eventPrChanges });
    const result = await closeVerifiedIssues(fixture);
    assert.equal(result.skipped, 'post-signoff PR changes');
    assert.deepEqual(fixture.updates, []);
    assert.deepEqual(fixture.comments, []);
  }
});

test('approval removal or changed HEAD blocks audit before the first mutation', async () => {
  for (const change of [
    { labels: [] },
    { head: { sha: 'b'.repeat(40), repo: { full_name: 'owner/game' } } },
  ]) {
    const fixture = harness({ prChangesByRead: { 2: change } });
    const result = await closeVerifiedIssues(fixture);
    assert.equal(result.skipped, 'approval or issue snapshot changed during closure');
    assert.deepEqual(result.closed, []);
    assert.equal(fixture.comments.length, 0);
    assert.equal(fixture.updates.length, 0);
    assert.equal(fixture.prReads.length, 2);
  }
});

test('approval revoked after audit cannot close its Issue', async () => {
  for (const change of [
    { labels: [] },
    { body: GOOD_BODY.replace('Closes #12', 'Closes #900') },
    { head: { sha: 'b'.repeat(40), repo: { full_name: 'owner/game' } } },
  ]) {
    const fixture = harness({ prChangesByRead: { 3: change } });
    const result = await closeVerifiedIssues(fixture);
    assert.equal(result.skipped, 'approval or issue snapshot changed during closure');
    assert.equal(fixture.comments.length, 1);
    assert.equal(fixture.updates.length, 0);
    assert.deepEqual(result.closed, []);
    assert.match(fixture.comments[0].body, /closure is attempted after this receipt/);
  }
});

test('labeler losing maintainer access mid-run prevents Issue mutation', async () => {
  for (const [read, expectedComments] of [[2, 0], [3, 1]]) {
    const fixture = harness({ roleNameByRead: { [read]: 'write' } });
    const result = await closeVerifiedIssues(fixture);
    assert.equal(result.skipped, 'approval or issue snapshot changed during closure');
    assert.deepEqual(result.closed, []);
    assert.equal(fixture.comments.length, expectedComments);
    assert.equal(fixture.updates.length, 0);
    assert.equal(fixture.permissionReads.length, read);
  }
});

test('mid-batch approval revocation stops later issues without rolling back verified closure', async () => {
  const fixture = harness({ prChangesByRead: {
    4: { labels: [] },
  } });
  const result = await closeVerifiedIssues(fixture);
  assert.deepEqual(result.closed, [12]);
  assert.equal(result.skipped, 'approval or issue snapshot changed during closure');
  assert.deepEqual(fixture.updates.map((entry) => entry.issue_number), [12]);
  assert.deepEqual(fixture.comments.map((entry) => entry.issue_number), [12]);
  assert.equal(fixture.prReads.length, 4);
});

test('code samples, HTML comments, and indented declarations cannot certify an issue', async () => {
  const examples = [
    ['```md', GOOD_BODY, '```'].join('\n'),
    ['~~~~', GOOD_BODY, '~~~~'].join('\n'),
    ['<!--', GOOD_BODY, '-->'].join('\n'),
    GOOD_BODY.split('\n').map((line) => '    ' + line).join('\n'),
    GOOD_BODY.split('\n').map((line) => '\t' + line).join('\n'),
  ];
  for (const body of examples) {
    assert.equal(verificationReceipt(body), null);
    const fixture = harness({ body });
    assert.deepEqual((await closeVerifiedIssues(fixture)).closed, []);
    assert.equal(fixture.updates.length, 0);
  }
});

test('verification receipt rejects duplicate and malformed visible fields', () => {
  const headerEnd = GOOD_BODY.indexOf('\n---');
  const beforeDelimiter = GOOD_BODY.slice(0, headerEnd);
  for (const extra of [
    'Verified-Head: ' + SHA,
    'Verification: other result',
    'Verified-Head: invalid',
    'Verification: ',
  ]) {
    assert.equal(verificationReceipt(beforeDelimiter + '\n' + extra + '\n---'), null);
  }
  assert.deepEqual(verificationReceipt(GOOD_BODY + '\nVerified-Head: invalid\nVerification: other result'), {
    head: SHA,
    evidence: 'pnpm typecheck, targeted regression tests and runtime smoke passed',
  });
  assert.deepEqual(verificationReceipt(GOOD_BODY), {
    head: SHA,
    evidence: 'pnpm typecheck, targeted regression tests and runtime smoke passed',
  });
});

test('invalid Markdown cannot turn a subsequent directive into a header', () => {
  const body = [
    '````', 'Closes #81', '```', 'Closes #82', '````',
    '~~~', 'Closes #83', '~~~',
    'Closes #84 <!-- hidden -->',
    '<!-- first --> Closes #85 <!-- second -->',
    '<!-- unclosed', 'Closes #86',
  ].join('\n');
  assert.deepEqual(linkedIssueNumbers(body), []);
  assert.deepEqual(linkedIssueNumbers('    Closes #87\n\tFixes #88\nCloses #89'), []);
});

test('revoked maintainer label cannot be restored by an ordinary writer to revive a queued run', async () => {
  const fixture = harness({ labelEvents: [
    { id: 10, event: 'labeled', created_at: '2026-11-02T04:00:00Z',
      label: { name: 'issue-verified-complete' }, actor: { login: 'reviewer', id: 901, type: 'User' } },
    { id: 11, event: 'unlabeled', created_at: '2026-11-02T04:01:00Z',
      label: { name: 'issue-verified-complete' }, actor: { login: 'reviewer', id: 901, type: 'User' } },
    { id: 12, event: 'labeled', created_at: '2026-11-02T04:02:00Z',
      label: { name: 'issue-verified-complete' }, actor: { login: 'writer', id: 902, type: 'User' } },
  ] });
  const result = await closeVerifiedIssues(fixture);
  assert.deepEqual(result.closed, []);
  assert.equal(fixture.comments.length, 0);
  assert.equal(fixture.updates.length, 0);
});

test('removing approval mid-run or losing the label history prevents any further mutation', async () => {
  const revoked = [
    { id: 10, event: 'labeled', created_at: '2026-11-02T04:00:00Z',
      label: { name: 'issue-verified-complete' }, actor: { login: 'reviewer', id: 901, type: 'User' } },
    { id: 11, event: 'unlabeled', created_at: '2026-11-02T04:01:00Z',
      label: { name: 'issue-verified-complete' }, actor: { login: 'reviewer', id: 901, type: 'User' } },
  ];
  const beforeComment = harness({ labelEventsByRead: { 2: revoked } });
  assert.deepEqual((await closeVerifiedIssues(beforeComment)).closed, []);
  assert.equal(beforeComment.comments.length, 0);
  assert.equal(beforeComment.updates.length, 0);
  const beforeClosure = harness({ labelEventsByRead: { 3: revoked } });
  assert.deepEqual((await closeVerifiedIssues(beforeClosure)).closed, []);
  assert.equal(beforeClosure.comments.length, 1);
  assert.equal(beforeClosure.updates.length, 0);
  for (const options of [{ labelEvents: [] }, { failEvents: true }]) {
    const fixture = harness(options);
    if (options.failEvents) {
      await assert.rejects(() => closeVerifiedIssues(fixture), /history unavailable/);
    } else {
      assert.deepEqual((await closeVerifiedIssues(fixture)).closed, []);
    }
    assert.equal(fixture.comments.length, 0);
    assert.equal(fixture.updates.length, 0);
  }
});

test('unclosed code and HTML containers cannot expose hidden declarations', () => {
  const examples = [
    ['```md', '    ```', 'Closes #77', 'Verified-Head: ' + SHA,
      'Verification: fake evidence', '```', GOOD_BODY].join('\n'),
    ['<pre class="example">', 'Closes #71', 'Verified-Head: ' + SHA,
      'Verification: fake evidence', '</pre>', '', GOOD_BODY].join('\n'),
    ['> Sample quoted declaration', 'Closes #72', 'Verified-Head: ' + SHA,
      'Verification: fake evidence', '', GOOD_BODY].join('\n'),
  ];
  for (const body of examples) {
    assert.deepEqual(linkedIssueNumbers(body), []);
    assert.equal(verificationReceipt(body), null);
  }
  assert.deepEqual(linkedIssueNumbers(GOOD_BODY + '\n<details>\nCloses #99\n</details>'), [12, 14]);
});

test('ambiguous or untrusted label provenance never closes an Issue', async () => {
  const valid = { id: 10, event: 'labeled', created_at: '2026-11-02T04:00:00Z',
    label: { name: 'issue-verified-complete' },
    actor: { login: 'reviewer', id: 901, type: 'User' } };
  const variants = [
    [{ ...valid }, { ...valid, id: 11, created_at: '2026-11-02T04:01:00Z' }],
    [valid, { ...valid, id: 11, event: 'unlabeled' }],
    [{ ...valid, actor: { ...valid.actor, id: 902 } }],
    [{ ...valid, actor: { ...valid.actor, type: 'Bot' } }],
    [{ ...valid, performed_via_github_app: { id: 55 } }],
    [{ ...valid, id: null }],
    [{ ...valid, created_at: 'invalid' }],
  ];
  for (const labelEvents of variants) {
    const fixture = harness({ labelEvents });
    const result = await closeVerifiedIssues(fixture);
    assert.equal(result.skipped, 'unverifiable label approval');
    assert.deepEqual(result.closed, []);
    assert.equal(fixture.comments.length, 0);
    assert.equal(fixture.updates.length, 0);
  }
});

test('one reviewed Issue closes with exact title/body digest and CRLF attestation header', async () => {
  const issueTitle = 'Acceptance completed';
  const issueBody = 'Acceptance A complete\r\nAcceptance B complete\r\n';
  const digest = hashIssue(issueTitle, issueBody);
  const header = [
    'Closes #12',
    'Issue-Snapshot: #12 sha256:' + digest,
    'Verification: real gameplay and targeted regression passed',
    'Verified-Head: ' + SHA,
    '---',
    'Free-form Markdown, including Closes #999, is not an attested directive.',
  ].join('\r\n');
  const fixture = harness({ body: header, issues: { 12: { state: 'open', title: issueTitle, body: issueBody } } });
  assert.deepEqual((await closeVerifiedIssues(fixture)).closed, [12]);
  assert.deepEqual(fixture.updates.map((item) => item.issue_number), [12]);
  assert.deepEqual(fixture.issueReads, [12, 12, 12]);
  assert.match(fixture.comments[0].body, new RegExp('issue-snapshot-' + digest));
  assert.match(fixture.comments[0].body, new RegExp('Reviewed Issue title/body SHA-256: \\x60' + digest));
});

test('missing, duplicate, extra, invalid and ambiguous snapshots never authorize closure', async () => {
  const declaration = 'Issue-Snapshot: #12 sha256:' + EMPTY_ISSUE_HASH;
  const variants = [
    GOOD_BODY.replace(declaration + '\n', ''),
    GOOD_BODY.replace(declaration, declaration + '\n' + declaration),
    GOOD_BODY.replace('Verified-Head:', 'Issue-Snapshot: #99 sha256:' + EMPTY_ISSUE_HASH + '\nVerified-Head:'),
    GOOD_BODY.replace(declaration, 'Issue-Snapshot: #99 sha256:' + EMPTY_ISSUE_HASH),
    GOOD_BODY.replace(declaration, 'Issue-Snapshot: #12 sha256:bad'),
    GOOD_BODY.replace(declaration, 'Issue-Snapshot: #9007199254740999 sha256:' + EMPTY_ISSUE_HASH),
    GOOD_BODY.replace(declaration, 'Issue-Snapshot: #12 SHA-256:' + EMPTY_ISSUE_HASH),
    GOOD_BODY.replace('Closes #12', 'Closes #9007199254740999'),
  ];
  for (const body of variants) {
    const fixture = harness({ body });
    assert.deepEqual((await closeVerifiedIssues(fixture)).closed, [], body);
    assert.deepEqual(fixture.comments, [], body);
    assert.deepEqual(fixture.updates, [], body);
  }
});

test('Issue digest binds exact bytes, including trailing newlines, CRLF and null body', async () => {
  const single = 'Closes #12\nIssue-Snapshot: #12 sha256:' + EMPTY_ISSUE_HASH +
    '\nVerification: complete\nVerified-Head: ' + SHA;
  for (const body of [null, '', '\n', '\r\n', 'content\n', 'content\r\n']) {
    const fixture = harness({ body: single, issues: { 12: { state: 'open', body } } });
    const result = await closeVerifiedIssues(fixture);
    assert.deepEqual(result.closed, body == null || body === '' ? [12] : []);
    assert.equal(fixture.updates.length, body == null || body === '' ? 1 : 0);
  }
  assert.notEqual(hashIssue('', 'content\n'), hashIssue('', 'content\r\n'));
  assert.notEqual(hashIssue('', 'content'), hashIssue('', 'content\n'));
});

test('Issue acceptance mutations before and after audit stop closure', async () => {
  for (const [read, expectedComments] of [[1, 0], [2, 0], [3, 1]]) {
    const fixture = harness({ issueBodiesByRead: { 12: { [read]: 'unreviewed acceptance change' } } });
    const result = await closeVerifiedIssues(fixture);
    assert.deepEqual(result.closed, []);
    assert.equal(fixture.comments.length, expectedComments);
    assert.equal(fixture.updates.length, 0);
    assert.match(result.skipped, /snapshot/);
  }
});

test('Issue title mutations at every review boundary stop closure', async () => {
  for (const [read, expectedComments] of [[1, 0], [2, 0], [3, 1]]) {
    const fixture = harness({
      issueTitlesByRead: { 12: { [read]: 'Unreviewed additional acceptance requirement' } },
    });
    const result = await closeVerifiedIssues(fixture);
    assert.deepEqual(result.closed, []);
    assert.equal(fixture.comments.length, expectedComments);
    assert.equal(fixture.updates.length, 0);
    assert.match(result.skipped, /snapshot/);
  }
});


test('changes to later Issues retain prior verified closures and stop the batch', async () => {
  const fixture = harness({ issueBodiesByRead: { 14: { 1: 'new acceptance requirement' } } });
  const result = await closeVerifiedIssues(fixture);
  assert.deepEqual(result.closed, [12]);
  assert.deepEqual(fixture.updates.map((entry) => entry.issue_number), [12]);
  assert.deepEqual(fixture.comments.map((entry) => entry.issue_number), [12]);
});

test('Issue state changes and API read failures at mutation boundaries fail closed', async () => {
  for (const stage of [2, 3]) {
    for (const failure of ['closed', 'api']) {
      const fixture = harness();
      const get = fixture.github.rest.issues.get;
      let reads = 0;
      fixture.github.rest.issues.get = async (args) => {
        if (args.issue_number === 12 && ++reads === stage) {
          if (failure === 'api') throw new Error('Issue read unavailable');
          return { data: { state: 'closed', body: '' } };
        }
        return get(args);
      };
      if (failure === 'api') {
        await assert.rejects(() => closeVerifiedIssues(fixture), /Issue read unavailable/);
      } else {
        assert.deepEqual((await closeVerifiedIssues(fixture)).closed, []);
      }
      assert.equal(fixture.updates.length, 0);
      assert.equal(fixture.comments.length, stage === 3 ? 1 : 0);
    }
  }
});

test('changed reviewed snapshot cannot reuse a stale audit receipt', async () => {
  const storedComments = new Map();
  const first = harness({ failUpdate: true, storedComments });
  await assert.rejects(() => closeVerifiedIssues(first), /permission denied/);
  const revisedIssueBody = 'Additional criterion completed\n';
  const digest = hashIssue('', revisedIssueBody);
  const revisedBody = GOOD_BODY.replace(
    'Issue-Snapshot: #12 sha256:' + EMPTY_ISSUE_HASH,
    'Issue-Snapshot: #12 sha256:' + digest
  );
  const retry = harness({
    body: revisedBody,
    issues: { 12: { state: 'open', body: revisedIssueBody } },
    storedComments,
  });
  assert.deepEqual((await closeVerifiedIssues(retry)).closed, [12, 14]);
  assert.equal(retry.comments.length, 2);
  assert.equal(storedComments.get(12).length, 2);
  assert.match(storedComments.get(12)[1].body, new RegExp('issue-snapshot-' + digest));
});
