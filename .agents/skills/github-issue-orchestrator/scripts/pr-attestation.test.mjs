import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  buildEvidenceMarkdown,
  buildHeader,
  collectImages,
  issueSnapshotHash,
  parseHeader,
  rawUrl,
} from "./pr-attestation.mjs";

const HEAD = "a".repeat(40);

test("issueSnapshotHash hashes canonical title/body pair", () => {
  const issue = { title: "Fix tooltip", body: "Show 3 stars\n" };
  assert.equal(
    issueSnapshotHash(issue),
    "6c26bce68e4f47aaa5a7114918fa773d81cea5d9653a2609f505bad03047f6ca",
  );
  assert.equal(issueSnapshotHash({ title: null, body: null }), issueSnapshotHash({ title: "", body: "" }));
});

test("buildHeader emits exact declaration order", () => {
  const header = buildHeader({
    issues: [{ number: 126, title: "Fix tooltip", body: "Body" }],
    head: HEAD,
    verification: "targeted tests PASS; typecheck PASS",
  });
  const lines = header.split("\n");
  assert.equal(lines[0], "Closes #126");
  assert.match(lines[1], /^Issue-Snapshot: #126 sha256:[a-f0-9]{64}$/);
  assert.equal(lines[2], "Verification: targeted tests PASS; typecheck PASS");
  assert.equal(lines[3], `Verified-Head: ${HEAD}`);
  assert.equal(lines.length, 4);
});

test("buildHeader rejects missing head or verification", () => {
  assert.throws(() => buildHeader({ issues: [{ number: 1 }], head: "abc", verification: "x" }));
  assert.throws(() => buildHeader({ issues: [{ number: 1 }], head: HEAD, verification: " " }));
  assert.throws(() => buildHeader({ issues: [], head: HEAD, verification: "x" }));
});

test("parseHeader accepts a valid header and ignores prose after ---", () => {
  const body = [
    "Closes #126",
    "Issue-Snapshot: #126 sha256:" + "b".repeat(64),
    "Verification: targeted tests PASS",
    `Verified-Head: ${HEAD}`,
    "---",
    "## Notes",
    "Anything goes here.",
  ].join("\n");
  const parsed = parseHeader(body);
  assert.equal(parsed.ok, true, parsed.errors.join("; "));
  assert.deepEqual(parsed.issues, [126]);
  assert.equal(parsed.head, HEAD);
});

test("parseHeader rejects prose before the delimiter", () => {
  const body = [
    "## Summary",
    "Closes #126",
    "Issue-Snapshot: #126 sha256:" + "b".repeat(64),
    "Verification: targeted tests PASS",
    `Verified-Head: ${HEAD}`,
    "---",
  ].join("\n");
  const parsed = parseHeader(body);
  assert.equal(parsed.ok, false);
  assert.ok(parsed.errors.some((error) => error.includes("invalid header line")));
});

test("parseHeader rejects missing or duplicate snapshots", () => {
  const missing = parseHeader([
    "Closes #126",
    "Verification: x",
    `Verified-Head: ${HEAD}`,
    "---",
  ].join("\n"));
  assert.equal(missing.ok, false);
  assert.ok(missing.errors.some((error) => error.includes("missing Issue-Snapshot")));

  const duplicate = parseHeader([
    "Closes #126",
    "Issue-Snapshot: #126 sha256:" + "b".repeat(64),
    "Issue-Snapshot: #126 sha256:" + "c".repeat(64),
    "Verification: x",
    `Verified-Head: ${HEAD}`,
    "---",
  ].join("\n"));
  assert.equal(duplicate.ok, false);
  assert.ok(duplicate.errors.some((error) => error.includes("duplicate Issue-Snapshot")));
});

test("parseHeader requires an exact --- delimiter", () => {
  const noDelimiter = parseHeader([
    "Closes #126",
    "Issue-Snapshot: #126 sha256:" + "b".repeat(64),
    "Verification: targeted tests PASS",
    `Verified-Head: ${HEAD}`,
  ].join("\n"));
  assert.equal(noDelimiter.ok, false);
  assert.ok(noDelimiter.errors.some((error) => error.includes("delimiter")));

  const fourDashes = parseHeader([
    "Closes #126",
    "Issue-Snapshot: #126 sha256:" + "b".repeat(64),
    "Verification: targeted tests PASS",
    `Verified-Head: ${HEAD}`,
    "----",
  ].join("\n"));
  assert.equal(fourDashes.ok, false);
  assert.ok(fourDashes.errors.some((error) => error.includes("delimiter")));
});

test("parseHeader rejects a header starting with Verification before Closes", () => {
  const parsed = parseHeader([
    "Verification: targeted tests PASS",
    "Closes #126",
    "Issue-Snapshot: #126 sha256:" + "b".repeat(64),
    `Verified-Head: ${HEAD}`,
    "---",
  ].join("\n"));
  assert.equal(parsed.ok, false);
  assert.ok(parsed.errors.some((error) =>
    error.includes("first line") || error.includes("expected Issue-Snapshot")));
});

test("parseHeader rejects a leading blank line", () => {
  const parsed = parseHeader([
    "",
    "Closes #126",
    "Issue-Snapshot: #126 sha256:" + "b".repeat(64),
    "Verification: targeted tests PASS",
    `Verified-Head: ${HEAD}`,
    "---",
  ].join("\n"));
  assert.equal(parsed.ok, false);
  assert.ok(parsed.errors.some((error) => error.toLowerCase().includes("blank")));
});

test("parseHeader rejects missing Verification or Verified-Head", () => {
  const noVerification = parseHeader([
    "Closes #126",
    "Issue-Snapshot: #126 sha256:" + "b".repeat(64),
    `Verified-Head: ${HEAD}`,
    "---",
  ].join("\n"));
  assert.equal(noVerification.ok, false);
  assert.ok(noVerification.errors.some((error) => error.includes("Verification")));

  const noHead = parseHeader([
    "Closes #126",
    "Issue-Snapshot: #126 sha256:" + "b".repeat(64),
    "Verification: x",
    "---",
  ].join("\n"));
  assert.equal(noHead.ok, false);
  assert.ok(noHead.errors.some((error) => error.includes("Verified-Head")));
});

test("parseHeader rejects duplicate Verification or Verified-Head", () => {
  const duplicateVerification = parseHeader([
    "Closes #126",
    "Issue-Snapshot: #126 sha256:" + "b".repeat(64),
    "Verification: first",
    "Verification: second",
    `Verified-Head: ${HEAD}`,
    "---",
  ].join("\n"));
  assert.equal(duplicateVerification.ok, false);

  const duplicateHead = parseHeader([
    "Closes #126",
    "Issue-Snapshot: #126 sha256:" + "b".repeat(64),
    "Verification: x",
    `Verified-Head: ${HEAD}`,
    `Verified-Head: ${HEAD}`,
    "---",
  ].join("\n"));
  assert.equal(duplicateHead.ok, false);
});

test("parseHeader rejects snapshots for undeclared issues", () => {
  const parsed = parseHeader([
    "Closes #126",
    "Issue-Snapshot: #126 sha256:" + "b".repeat(64),
    "Issue-Snapshot: #127 sha256:" + "c".repeat(64),
    "Verification: x",
    `Verified-Head: ${HEAD}`,
    "---",
  ].join("\n"));
  assert.equal(parsed.ok, false);
  assert.ok(parsed.errors.some((error) => error.includes("without declaration")));
});

test("parseHeader accepts multiple issues in canonical order", () => {
  const header = buildHeader({
    issues: [
      { number: 126, title: "Fix tooltip", body: "Body" },
      { number: 127, title: "Creative mode", body: "Body" },
    ],
    head: HEAD,
    verification: "targeted tests PASS",
  });
  const parsed = parseHeader(`${header}\n---\n## Notes\nAnything after the delimiter.`);
  assert.equal(parsed.ok, true, parsed.errors.join("; "));
  assert.deepEqual(parsed.issues, [126, 127]);
});

test("rawUrl pins the full head and encodes path segments", () => {
  const url = rawUrl("thaiGO2003/forest-thorne", HEAD, "art/ảnh 1.png");
  assert.equal(
    url,
    `https://raw.githubusercontent.com/thaiGO2003/forest-thorne/${HEAD}/art/%E1%BA%A3nh%201.png`,
  );
});

test("evidence table lists images and evidence.md index", () => {
  const root = mkdtempSync(join(tmpdir(), "pr-attestation-"));
  const dir = join(root, ".agents", "merge-review", "fix.ui.tooltip-issue126");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "after-390x844.png"), "png");
  writeFileSync(join(dir, "notes.txt"), "ignored");
  writeFileSync(join(dir, "evidence.md"), "# Evidence");

  try {
    assert.deepEqual(collectImages(dir, root), [
      ".agents/merge-review/fix.ui.tooltip-issue126/after-390x844.png",
    ]);
    const markdown = buildEvidenceMarkdown({
      dir,
      head: HEAD,
      repo: "thaiGO2003/forest-thorne",
      root,
    });
    assert.match(markdown, /after-390x844\.png/);
    assert.match(markdown, new RegExp(`raw.githubusercontent.com/thaiGO2003/forest-thorne/${HEAD}`));
    assert.match(markdown, /evidence\.md/);
    assert.doesNotMatch(markdown, /notes\.txt/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("evidence table fails closed without images", () => {
  const root = mkdtempSync(join(tmpdir(), "pr-attestation-empty-"));
  const dir = join(root, ".agents", "merge-review", "empty");
  mkdirSync(dir, { recursive: true });
  try {
    assert.throws(() => buildEvidenceMarkdown({
      dir,
      head: HEAD,
      repo: "thaiGO2003/forest-thorne",
      root,
    }), /no image evidence/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
