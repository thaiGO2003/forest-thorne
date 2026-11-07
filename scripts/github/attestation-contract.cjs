'use strict';

// Single fail-closed attestation contract used by both the reviewer helper
// (.agents/skills/github-issue-orchestrator/scripts/pr-attestation.mjs) and the
// issue-closure consumer (scripts/github/close-verified-pr-issues.cjs).
//
// A header is accepted only when it appears at the very start of the PR body
// in this exact order:
//   Closes|Fixes|Resolves #N        (one or more, no duplicates)
//   Issue-Snapshot: #N sha256:<64>  (exactly one per declared issue)
//   Verification: <text>            (exactly one, max 1500 chars)
//   Verified-Head: <40 hex>         (exactly one)
//   ---                              (exact delimiter)
// then free-form Markdown is allowed. Blank/whitespace-only lines are rejected
// anywhere before the delimiter. Missing, reordered, duplicated, extra, or
// malformed fields invalidate the whole header.

const MAX_VERIFICATION = 1500;

function parseAttestationHeader(body) {
  const lines = String(body ?? '').split(/\r?\n/);
  const errors = [];
  const declared = [];
  const snapshots = new Map();
  let head = null;
  let verification = null;

  const delimiterIndex = lines.indexOf('---');
  if (delimiterIndex === -1) errors.push('missing exact --- delimiter');
  const headerLines = delimiterIndex === -1 ? lines : lines.slice(0, delimiterIndex);

  if (!headerLines.length) errors.push('empty attestation header');
  for (let index = 0; index < headerLines.length; index += 1) {
    if (headerLines[index].trim() === '') {
      errors.push(`blank line at header line ${index + 1} is not allowed`);
    }
  }

  let index = 0;
  while (index < headerLines.length) {
    const match = /^(?:Closes|Fixes|Resolves) #([1-9]\d*)$/i.exec(headerLines[index]);
    if (!match) break;
    const number = Number(match[1]);
    if (!Number.isSafeInteger(number) || number < 1) {
      errors.push(`invalid issue number at header line ${index + 1}`);
    } else {
      declared.push(number);
    }
    index += 1;
  }
  if (!declared.length) {
    errors.push('first line must be a Closes/Fixes/Resolves #N declaration');
  }
  if (new Set(declared).size !== declared.length) {
    errors.push('duplicate issue declaration');
  }

  const snapshotStart = index;
  while (index < headerLines.length) {
    const match = /^Issue-Snapshot: #([1-9]\d*) sha256:([a-f0-9]{64})$/i.exec(headerLines[index]);
    if (!match) break;
    const number = Number(match[1]);
    if (!Number.isSafeInteger(number) || number < 1) {
      errors.push(`invalid Issue-Snapshot issue number at header line ${index + 1}`);
    } else {
      if (snapshots.has(number)) errors.push(`duplicate Issue-Snapshot for #${number}`);
      snapshots.set(number, match[2].toLowerCase());
    }
    index += 1;
  }
  if (index === snapshotStart) {
    errors.push('missing Issue-Snapshot after issue declarations');
  }

  if (index >= headerLines.length) {
    errors.push('missing Verification');
  } else {
    const match = /^Verification: (\S.*)$/i.exec(headerLines[index]);
    if (!match) {
      errors.push(`expected Verification at header line ${index + 1}: ${headerLines[index].slice(0, 80)}`);
    } else {
      if (match[1].length > MAX_VERIFICATION) {
        errors.push(`Verification exceeds ${MAX_VERIFICATION} characters`);
      }
      verification = match[1];
      index += 1;
    }
  }

  if (index >= headerLines.length) {
    errors.push('missing Verified-Head');
  } else {
    const match = /^Verified-Head: ([a-f0-9]{40})$/i.exec(headerLines[index]);
    if (!match) {
      errors.push(`expected Verified-Head at header line ${index + 1}: ${headerLines[index].slice(0, 80)}`);
    } else {
      head = match[1].toLowerCase();
      index += 1;
    }
  }

  while (index < headerLines.length) {
    errors.push(`invalid header line: ${headerLines[index].slice(0, 80)}`);
    index += 1;
  }

  const issues = [...new Set(declared)];
  if (snapshots.size !== issues.length) {
    errors.push('Issue-Snapshot count must equal declared issue count');
  }
  for (const number of issues) {
    if (!snapshots.has(number)) errors.push(`missing Issue-Snapshot for #${number}`);
  }
  for (const number of snapshots.keys()) {
    if (!issues.includes(number)) errors.push(`Issue-Snapshot without declaration for #${number}`);
  }

  return { ok: errors.length === 0, errors, issues, snapshots, head, verification };
}

module.exports = { MAX_VERIFICATION, parseAttestationHeader };
