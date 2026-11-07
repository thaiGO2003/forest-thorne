import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_BASE,
  MR_BLOCK_END,
  MR_BLOCK_START,
  assertEvidenceReady,
  changedFilesFromStatus,
  mergePrBody,
  titleForUpdate,
  wrapPrBody,
} from "./mr.mjs";

const HEAD = "a".repeat(40);
const SHA = "b".repeat(64);

test("default base is dev", () => {
  assert.equal(DEFAULT_BASE, "dev");
});

test("update preserves existing attestation/body/evidence and replaces only the generated block", () => {
  const existing = [
    "Closes #151",
    `Issue-Snapshot: #151 sha256:${SHA}`,
    "Verification: old evidence",
    `Verified-Head: ${HEAD}`,
    "---",
    "Existing reviewer note",
    "![old](https://example.test/old.png)",
  ].join("\n");

  const first = mergePrBody(existing, wrapPrBody("## Summary\nfirst"));
  assert.match(first, /^Closes #151/);
  assert.match(first, /Issue-Snapshot: #151/);
  assert.match(first, /Verified-Head: a+/);
  assert.match(first, /Existing reviewer note/);
  assert.match(first, /old\.png/);
  assert.equal(first.split(MR_BLOCK_START).length - 1, 1);
  assert.equal(first.split(MR_BLOCK_END).length - 1, 1);

  const second = mergePrBody(first, wrapPrBody("## Summary\nsecond"));
  assert.equal(second.split(MR_BLOCK_START).length - 1, 1);
  assert.equal(second.split(MR_BLOCK_END).length - 1, 1);
  assert.match(second, /## Summary\nsecond/);
  assert.doesNotMatch(second, /## Summary\nfirst/);
  assert.match(second, /Existing reviewer note/);
});

test("empty existing body uses the generated body", () => {
  const generated = wrapPrBody("## Summary\nnew");
  assert.equal(mergePrBody("", generated), generated);
  assert.equal(mergePrBody(null, generated), generated);
});

test("title is preserved unless an explicit title is requested", () => {
  assert.equal(titleForUpdate("Existing title", undefined), "Existing title");
  assert.equal(titleForUpdate("Existing title", "Requested"), "Requested");
  assert.equal(titleForUpdate("", undefined), "MR");
});

test("real PR create/update requires evidence; dry-run may skip", () => {
  assert.doesNotThrow(() => assertEvidenceReady({ dryRun: true, noEvidence: false, files: [], urls: [] }));
  assert.throws(
    () => assertEvidenceReady({ dryRun: false, noEvidence: true, files: [], urls: [] }),
    /evidence is mandatory/,
  );
  assert.throws(
    () => assertEvidenceReady({ dryRun: false, noEvidence: false, files: [], urls: [] }),
    /no evidence screenshots/,
  );
  assert.throws(
    () => assertEvidenceReady({ dryRun: false, noEvidence: false, files: ["a.png"], urls: [] }),
    /evidence upload failed/,
  );
  assert.doesNotThrow(
    () => assertEvidenceReady({ dryRun: false, noEvidence: false, files: ["a.png"], urls: ["https://example.test/a.png"] }),
  );
});

test("status parsing keeps the first tracked path intact", () => {
  const rendered = changedFilesFromStatus(" M scripts/install-git-hooks.mjs\n M scripts/mr.mjs\n?? docs/new.md\n");
  assert.match(rendered, /scripts\/install-git-hooks\.mjs/);
  assert.doesNotMatch(rendered, /(^|\n)- `cripts\//);
  assert.match(rendered, /1 untracked path/);
});
