'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { test } = require('node:test');

const consumer = require('../scripts/github/close-verified-pr-issues.cjs');

const SHA = 'a'.repeat(40);
const hashIssue = (title, body) => createHash('sha256')
  .update(JSON.stringify([String(title ?? ''), String(body ?? '')]))
  .digest('hex');
const EMPTY_ISSUE_HASH = hashIssue('', '');
const snapshot = (number) => `Issue-Snapshot: #${number} sha256:${EMPTY_ISSUE_HASH}`;
const verification = 'Verification: targeted tests and typecheck passed';
const verifiedHead = `Verified-Head: ${SHA}`;

let helperPromise;
function helper() {
  helperPromise ??= import(pathToFileURL(resolve(
    __dirname,
    '..',
    '.agents/skills/github-issue-orchestrator/scripts/pr-attestation.mjs',
  )).href);
  return helperPromise;
}

function canonical({ declarations = ['Closes #12'], body = '## Notes\n\nFree-form body after the delimiter.' } = {}) {
  const numbers = declarations.map((line) => Number(/#([1-9]\d*)$/.exec(line)?.[1]));
  return [
    ...declarations,
    ...numbers.map(snapshot),
    verification,
    verifiedHead,
    '---',
    body,
  ].join('\n');
}

async function assertConsumersAgree(body, expectedOk, label) {
  const helperModule = await helper();
  const fromHelper = helperModule.parseHeader(body);
  const fromConsumer = consumer.parseAttestation(body);
  assert.equal(fromHelper.ok, expectedOk, `${label}: helper ${fromHelper.errors.join('; ')}`);
  assert.equal(fromConsumer.ok, expectedOk, `${label}: consumer ${fromConsumer.errors.join('; ')}`);
  assert.deepEqual(fromConsumer.issues, fromHelper.issues, `${label}: issues`);
  assert.deepEqual(
    [...fromConsumer.snapshots.entries()].sort(),
    [...fromHelper.snapshots.entries()].sort(),
    `${label}: snapshots`,
  );
  assert.equal(fromConsumer.head, fromHelper.head, `${label}: head`);
  assert.equal(fromConsumer.verification, fromHelper.verification, `${label}: verification`);
  return { fromHelper, fromConsumer };
}

test('valid canonical single-issue header is accepted by both consumers', async () => {
  const body = canonical();
  const result = await assertConsumersAgree(body, true, 'single');
  assert.deepEqual(result.fromHelper.issues, [12]);
  assert.equal(result.fromHelper.head, SHA);
  assert.equal(result.fromHelper.verification, verification.slice('Verification: '.length));
  assert.deepEqual(consumer.verificationReceipt(body), {
    head: SHA,
    evidence: verification.slice('Verification: '.length),
  });
  assert.deepEqual(consumer.linkedIssueNumbers(body), [12]);
});

test('valid canonical multi-issue header and free-form body are accepted by both consumers', async () => {
  const body = canonical({
    declarations: ['Closes #12', 'Fixes #14', 'Resolves #15'],
    body: '## Notes\n\nCloses #99\nIssue-Snapshot: #99 sha256:' + EMPTY_ISSUE_HASH,
  });
  const result = await assertConsumersAgree(body, true, 'multi');
  assert.deepEqual(result.fromHelper.issues, [12, 14, 15]);
  assert.deepEqual([...result.fromHelper.snapshots.keys()].sort((a, b) => a - b), [12, 14, 15]);
});

test('both consumers reject the five observed divergences and related malformed headers', async () => {
  const cases = {
    'missing exact delimiter': [
      'Closes #12', snapshot(12), verification, verifiedHead,
    ].join('\n'),
    'Verification before Closes': [
      verification, 'Closes #12', snapshot(12), verifiedHead, '---',
    ].join('\n'),
    'leading blank line': ['', 'Closes #12', snapshot(12), verification, verifiedHead, '---'].join('\n'),
    'interior blank line': ['Closes #12', '', snapshot(12), verification, verifiedHead, '---'].join('\n'),
    'interior whitespace-only line': ['Closes #12', '   ', snapshot(12), verification, verifiedHead, '---'].join('\n'),
    'duplicate Closes': ['Closes #12', 'Closes #12', snapshot(12), verification, verifiedHead, '---'].join('\n'),
    'duplicate Issue-Snapshot': ['Closes #12', snapshot(12), snapshot(12), verification, verifiedHead, '---'].join('\n'),
    'missing Issue-Snapshot': ['Closes #12', verification, verifiedHead, '---'].join('\n'),
    'missing Verification': ['Closes #12', snapshot(12), verifiedHead, '---'].join('\n'),
    'missing Verified-Head': ['Closes #12', snapshot(12), verification, '---'].join('\n'),
    'invalid extra field': ['Closes #12', snapshot(12), verification, verifiedHead, 'Extra: nope', '---'].join('\n'),
    'snapshot for undeclared issue': ['Closes #12', snapshot(12), snapshot(14), verification, verifiedHead, '---'].join('\n'),
    'duplicate Verification': ['Closes #12', snapshot(12), verification, 'Verification: second', verifiedHead, '---'].join('\n'),
    'duplicate Verified-Head': ['Closes #12', snapshot(12), verification, verifiedHead, verifiedHead, '---'].join('\n'),
    'four-dash delimiter': canonical().replace('\n---\n', '\n----\n'),
    'delimiter with trailing space': canonical().replace('\n---\n', '\n--- \n'),
    'empty body': '',
  };

  for (const [label, body] of Object.entries(cases)) {
    const result = await assertConsumersAgree(body, false, label);
    assert.ok(result.fromHelper.errors.length > 0, `${label}: helper should explain rejection`);
    assert.ok(result.fromConsumer.errors.length > 0, `${label}: consumer should explain rejection`);
    assert.equal(consumer.verificationReceipt(body), null, `${label}: receipt`);
  }
});

test('prose and declarations after the delimiter cannot change the attested issues', async () => {
  const body = canonical({
    body: [
      '## Implementation notes',
      '',
      'Closes #77',
      `Issue-Snapshot: #77 sha256:${EMPTY_ISSUE_HASH}`,
      'Verification: fake evidence',
      `Verified-Head: ${'b'.repeat(40)}`,
      '---',
    ].join('\n'),
  });
  const result = await assertConsumersAgree(body, true, 'prose-after-delimiter');
  assert.deepEqual(result.fromHelper.issues, [12]);
  assert.deepEqual([...result.fromHelper.snapshots.keys()], [12]);
});
