import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";

import { CHAIN_SUFFIX, HOOK_MARKER, installHooks, resolveHooksDir } from "./install-git-hooks.mjs";

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function makeRepo({ hooksPath } = {}) {
  const repo = mkdtempSync(join(tmpdir(), "ft-hooks-"));
  git(repo, ["init", "-q"]);
  git(repo, ["config", "user.email", "test@example.com"]);
  git(repo, ["config", "user.name", "Test"]);
  if (hooksPath) git(repo, ["config", "core.hooksPath", hooksPath]);
  return repo;
}

function runHook(cwd, target) {
  return spawnSync("sh", [target], { cwd, encoding: "utf8", env: process.env });
}

test("installs to the actual hook path and is idempotent", () => {
  const repo = makeRepo();
  try {
    const first = installHooks({ cwd: repo, log: () => {}, warn: () => {} });
    assert.equal(first.target, join(resolveHooksDir(repo), "pre-push"));
    assert.ok(existsSync(first.target));
    const content = readFileSync(first.target, "utf8");
    assert.match(content, new RegExp(HOOK_MARKER));
    assert.doesNotMatch(content, /use --no-verify/i);

    const second = installHooks({ cwd: repo, log: () => {}, warn: () => {} });
    assert.equal(second.target, first.target);
    assert.equal(readFileSync(second.target, "utf8"), content);
    assert.equal(readdirSync(resolveHooksDir(repo)).filter((name) => name.endsWith(CHAIN_SUFFIX)).length, 0);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("respects core.hooksPath", () => {
  const repo = makeRepo({ hooksPath: "custom-hooks" });
  try {
    const result = installHooks({ cwd: repo, log: () => {}, warn: () => {} });
    assert.equal(result.target, join(repo, "custom-hooks", "pre-push"));
    assert.ok(existsSync(result.target));
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("supports a linked worktree and writes to the shared hook path", () => {
  const repo = makeRepo();
  const worktree = `${repo}-linked`;
  try {
    git(repo, ["commit", "--allow-empty", "-qm", "init"]);
    git(repo, ["worktree", "add", "-q", worktree, "-b", "linked-test"]);
    const result = installHooks({ cwd: worktree, log: () => {}, warn: () => {} });
    assert.equal(result.target, resolve(resolveHooksDir(worktree), "pre-push"));
    assert.ok(existsSync(result.target));
    assert.ok(result.target.startsWith(repo));
  } finally {
    rmSync(worktree, { recursive: true, force: true });
    rmSync(repo, { recursive: true, force: true });
  }
});

test("chains an existing pre-push hook and propagates its failure", () => {
  const repo = makeRepo();
  try {
    const hooksDir = resolveHooksDir(repo);
    const target = join(hooksDir, "pre-push");
    writeFileSync(target, "#!/bin/sh\nexit 7\n");
    chmodSync(target, 0o755);

    const result = installHooks({ cwd: repo, log: () => {}, warn: () => {} });
    assert.equal(result.chained, true);
    assert.ok(existsSync(`${target}${CHAIN_SUFFIX}`));
    const chained = readFileSync(target, "utf8");
    assert.match(chained, /pre-push\.forest-thorne-existing/);

    const run = runHook(repo, target);
    assert.equal(run.status, 7, run.stderr);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("fails closed when both current hook and sidecar exist, preserving both guards", () => {
  const repo = makeRepo();
  try {
    const hooksDir = resolveHooksDir(repo);
    const target = join(hooksDir, "pre-push");
    const sidecar = `${target}${CHAIN_SUFFIX}`;
    writeFileSync(target, "#!/bin/sh\nexit 3\n");
    writeFileSync(sidecar, "#!/bin/sh\nexit 4\n");
    chmodSync(target, 0o755);
    chmodSync(sidecar, 0o755);

    assert.throws(
      () => installHooks({ cwd: repo, log: () => {}, warn: () => {} }),
      /both exist; refusing to overwrite/,
    );

    assert.equal(readFileSync(target, "utf8"), "#!/bin/sh\nexit 3\n");
    assert.equal(readFileSync(sidecar, "utf8"), "#!/bin/sh\nexit 4\n");
    assert.equal(runHook(repo, target).status, 3);
    assert.equal(runHook(repo, sidecar).status, 4);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test("fails closed when scripts/mr.mjs is missing", () => {
  const repo = makeRepo();
  try {
    const result = installHooks({ cwd: repo, log: () => {}, warn: () => {} });
    const run = runHook(repo, result.target);
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /scripts\/mr\.mjs is missing/i);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
