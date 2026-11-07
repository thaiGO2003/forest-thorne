#!/usr/bin/env node
// Merge-request helper for forest-thorne.
//
// Design (2026-11-02):
// - Default path is fast: lint only (ESLint when the repo has a config, otherwise
//   `tsc --noEmit`). Integration tests are deliberately NOT run here.
// - Build runs only for a finished branch: `pnpm mr --full` or CI when the PR is out of draft.
// - Browser evidence: the dev server is started on a free port, headless Chromium captures
//   desktop + mobile screenshots, and the PNGs are uploaded to the dedicated evidence branch
//   (`MR_EVIDENCE_BRANCH`, default `mr-evidence`) via the GitHub contents API; gist cannot
//   accept binary files. Raw URLs are embedded in the MR description.
//
// Usage:
//   pnpm mr                     # lint + evidence + push + create/update PR (draft stays draft)
//   pnpm mr --full              # same, plus `pnpm build` (use when the work is done)
//   pnpm mr --dry-run           # run lint/evidence, print the PR body, create nothing
//   pnpm mr --lint-only         # fast gate used by .git/hooks/pre-push
//   pnpm mr --no-evidence       # skip screenshots
//   pnpm mr --draft             # create the PR as draft
//   pnpm mr --title "..." --base main --url http://localhost:5199/
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

// `shell: true` is required to spawn pnpm's .cmd shim on Windows. gh and git are real
// executables, so they run without a shell and keep argument quoting intact.
process.noDeprecation = true;
const NEEDS_SHELL = new Set(["pnpm", "npm", "npx"]);
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name, fallback = undefined) => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[index + 1] : fallback;
};

const options = {
  lintOnly: flag("lint-only"),
  dryRun: flag("dry-run"),
  full: flag("full") || process.env.MR_FULL === "1",
  noEvidence: flag("no-evidence") || process.env.MR_NO_EVIDENCE === "1",
  draft: flag("draft"),
  base: value("base", process.env.MR_BASE ?? "main"),
  url: value("url", process.env.MR_URL),
  title: value("title"),
};

/** @param {string} command @param {string[]} args */
function run(command, args, { cwd = root, allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32" && NEEDS_SHELL.has(command),
    env: process.env,
  });
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`${command} ${args.join(" ")} exited with ${result.status ?? result.signal}`);
  }
  return result.status ?? 1;
}

/** @param {string} command @param {string[]} args */
function capture(command, args, { cwd = root } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    shell: process.platform === "win32" && NEEDS_SHELL.has(command),
    env: process.env,
  });
  return { status: result.status ?? 1, stdout: (result.stdout ?? "").trim(), stderr: (result.stderr ?? "").trim() };
}

function git(...args) {
  return capture("git", args);
}

function hasEslint() {
  const configs = [
    "eslint.config.js", "eslint.config.mjs", "eslint.config.cjs", "eslint.config.ts",
    ".eslintrc", ".eslintrc.js", ".eslintrc.cjs", ".eslintrc.json", ".eslintrc.yml", ".eslintrc.yaml",
  ];
  if (configs.some((name) => existsSync(join(root, name)))) return true;
  try {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    return Boolean(pkg.devDependencies?.eslint || pkg.dependencies?.eslint);
  } catch {
    return false;
  }
}

function lint() {
  if (hasEslint()) {
    console.log("==> lint: ESLint");
    run("pnpm", ["exec", "eslint", "."]);
    return "ESLint";
  }
  console.log("==> lint: no ESLint config in this repo, using `tsc --noEmit` (TypeScript typecheck)");
  run("pnpm", ["typecheck"]);
  return "tsc --noEmit (no ESLint config in repo)";
}

function build() {
  console.log("==> build: `pnpm build` (tsc --noEmit && vite build)");
  run("pnpm", ["build"]);
}

function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolvePort(port));
    });
  });
}

function killTree(child) {
  if (!child || child.killed) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    try { child.kill("SIGTERM"); } catch { /* already gone */ }
  }
}

async function evidence() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = join(root, "artifacts", "mr", stamp);
  mkdirSync(outDir, { recursive: true });
  const port = await freePort();
  const url = options.url ?? `http://127.0.0.1:${port}/`;
  console.log(`==> evidence: starting dev server on ${url}`);
  const child = spawn("pnpm", ["dev", "--port", String(port), "--strictPort", "--host", "127.0.0.1"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
    detached: process.platform !== "win32",
    env: process.env,
  });
  let logTail = "";
  const collect = (chunk) => {
    logTail = (logTail + chunk.toString()).slice(-2000);
  };
  child.stdout?.on("data", collect);
  child.stderr?.on("data", collect);
  try {
    await waitForServer(url, 60_000, () => logTail);
    const { chromium } = await import("playwright-core");
    const browser = await chromium.launch({
      headless: true,
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
    });
    const shots = [];
    try {
      const viewports = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
      for (const [name, viewport] of Object.entries(viewports)) {
        const page = await browser.newPage({ viewport });
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
        await page.waitForSelector("#app[data-boot=ready]", { timeout: 45_000 });
        await page.waitForTimeout(1500);
        const path = join(outDir, `${name}.png`);
        await page.screenshot({ path });
        shots.push(path);
        console.log(`    shot ${path}`);
        await page.close();
      }
    } finally {
      await browser.close();
    }
    return shots;
  } finally {
    killTree(child);
  }
}

async function waitForServer(url, timeoutMs, logTail) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.ok) {
        console.log("    dev server is up");
        return;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  throw new Error(`dev server did not answer within ${timeoutMs}ms (${lastError})\n${logTail()}`);
}

function repoSlug() {
  const remote = git("remote", "get-url", "origin").stdout;
  const match = remote.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
  return match ? match[1].replace(/\.git$/, "") : "";
}

const EVIDENCE_BRANCH = process.env.MR_EVIDENCE_BRANCH ?? "mr-evidence";

// github.com gists refuse binary files, so evidence images go to a dedicated branch of the
// repository through the contents API. The repository is public, so raw links render inline
// in the merge-request description without touching the MR diff.
async function uploadEvidence(files) {
  if (files.length === 0) return [];
  const repo = repoSlug();
  if (!repo) {
    console.warn("    no GitHub origin; evidence stays local");
    return [];
  }
  const existing = capture("gh", ["api", `repos/${repo}/git/ref/heads/${EVIDENCE_BRANCH}`]);
  if (existing.status !== 0) {
    const baseSha = capture("gh", ["api", `repos/${repo}/git/ref/heads/${options.base}`, "--jq", ".object.sha"]).stdout;
    if (!baseSha) {
      console.warn(`    could not resolve ${options.base}; evidence stays local`);
      return [];
    }
    const created = capture(
      "gh",
      ["api", "-X", "POST", `repos/${repo}/git/refs`, "-f", `ref=refs/heads/${EVIDENCE_BRANCH}`, "-f", `sha=${baseSha}`],
    );
    if (created.status !== 0) {
      console.warn(`    could not create branch ${EVIDENCE_BRANCH}; evidence stays local`);
      return [];
    }
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const urls = [];
  for (const file of files) {
    const name = file.split(/[\\/]/).pop();
    const path = `evidence/${stamp}/${name}`;
    const payloadFile = join(tmpdir(), `mr-upload-${Date.now()}-${name}.json`);
    writeFileSync(payloadFile, JSON.stringify({
      message: `evidence ${stamp} ${name}`,
      content: readFileSync(file).toString("base64"),
      branch: EVIDENCE_BRANCH,
    }));
    const uploaded = capture(
      "gh",
      ["api", "-X", "PUT", `repos/${repo}/contents/${path}`, "--input", payloadFile],
    );
    if (uploaded.status === 0) {
      urls.push(`https://raw.githubusercontent.com/${repo}/${EVIDENCE_BRANCH}/${path}`);
      console.log(`    uploaded ${path}`);
    } else {
      console.warn(`    upload failed for ${name}`);
    }
  }
  return urls;
}

function changedFiles() {
  const status = git("status", "--porcelain");
  const lines = status.stdout.split(/\r?\n/).filter(Boolean);
  const tracked = lines.filter((line) => !line.startsWith("?? "));
  const untracked = lines.filter((line) => line.startsWith("?? "));
  const rows = tracked.slice(0, 20).map((line) => `- \`${line.slice(3)}\``);
  if (tracked.length > 20) rows.push(`- … ${tracked.length - 20} more changed path(s)`);
  if (untracked.length > 0) rows.push(`- ${untracked.length} untracked path(s) (not listed)`);
  return rows.length ? rows.join("\n") : "- (no working-tree changes)";
}

function branchInfo() {
  const branch = git("rev-parse", "--abbrev-ref", "HEAD").stdout;
  const upstream = git("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}");
  return { branch, hasUpstream: upstream.status === 0 };
}

function prBody({ branch, lintLabel, buildLabel, evidenceUrls, evidenceFiles }) {
  const lines = [];
  lines.push("## Summary");
  lines.push("");
  lines.push(`Branch \`${branch}\` based on \`${options.base}\`.`);
  lines.push("");
  lines.push("## Files touched");
  lines.push("");
  lines.push(changedFiles());
  lines.push("");
  lines.push("## Checks");
  lines.push("");
  lines.push(`- Lint: **${lintLabel}** — passed`);
  lines.push(buildLabel ? `- Build: **${buildLabel}** — passed` : "- Build: deferred (not run yet; finished branches run `pnpm mr --full` or CI build on ready-for-review)");
  lines.push("- Integration tests: **not run by MR policy** (kept out of the fast path on purpose)");
  lines.push("");
  if (evidenceUrls.length > 0) {
    lines.push("## Evidence (headless browser)");
    lines.push("");
    evidenceUrls.forEach((url, index) => {
      lines.push(`![evidence ${index + 1}](${url})`);
      lines.push("");
    });
  } else if (evidenceFiles.length > 0) {
    lines.push("## Evidence (headless browser)");
    lines.push("");
    lines.push("Screenshots captured locally, upload failed (see paths):");
    evidenceFiles.forEach((file) => lines.push(`- \`${file}\``));
    lines.push("");
  }
  lines.push("---");
  lines.push("");
  lines.push("_Created by `scripts/mr.mjs` (lint-first MR policy: ESLint/typecheck now, build when the work is finished, no integration tests in the fast path)._");
  return lines.join("\n");
}

function ensurePushed({ branch, hasUpstream }) {
  if (options.dryRun) {
    console.log(`==> [dry-run] would push ${branch} to origin`);
    return;
  }
  if (!hasUpstream) {
    run("git", ["push", "-u", "origin", branch]);
    return;
  }
  const ahead = git("rev-list", "--count", "@{u}..HEAD").stdout;
  if (Number(ahead) > 0) run("git", ["push", "origin", branch]);
}

function createOrUpdatePr(body) {
  const { branch } = branchInfo();
  const title = options.title ?? `MR: ${branch}`;
  const bodyFile = join(tmpdir(), `forest-thorne-mr-${Date.now()}.md`);
  writeFileSync(bodyFile, body);
  console.log(`\n==> PR body written to ${bodyFile}\n`);
  if (options.dryRun) {
    console.log(body);
    return;
  }
  const existing = capture("gh", ["pr", "list", "--head", branch, "--json", "number", "--jq", ".[0].number"]);
  const number = existing.status === 0 ? existing.stdout.trim() : "";
  if (number) {
    console.log(`==> updating PR #${number}`);
    run("gh", ["pr", "edit", number, "--body-file", bodyFile, "--title", title]);
    return;
  }
  console.log("==> creating pull request");
  const args = ["pr", "create", "--base", options.base, "--head", branch, "--title", title, "--body-file", bodyFile];
  if (options.draft) args.push("--draft");
  run("gh", args);
}

async function main() {
  const { branch } = branchInfo();
  if (branch === options.base || branch === "main") {
    throw new Error(`refusing to open a merge request from \`${branch}\`; create a feature branch first`);
  }
  if (git("rev-parse", "--is-inside-work-tree").status !== 0) {
    throw new Error("not inside a git repository");
  }

  const lintLabel = lint();
  if (options.lintOnly) {
    console.log("lint ok (pre-push gate)");
    return;
  }

  let buildLabel = "";
  if (options.full) {
    build();
    buildLabel = "pnpm build";
  }

  let files = [];
  if (!options.noEvidence) {
    try {
      files = await evidence();
    } catch (error) {
      console.warn(`    evidence capture failed (continuing without images): ${error instanceof Error ? error.message : error}`);
    }
  }
  const urls = options.dryRun ? [] : await uploadEvidence(files);

  const body = prBody({ branch, lintLabel, buildLabel, evidenceUrls: urls, evidenceFiles: files });
  if (!options.full) {
    console.log("\nNOTE: build not run. Use `pnpm mr --full` when the work is finished.");
  }
  ensurePushed({ branch, hasUpstream: branchInfo().hasUpstream });
  createOrUpdatePr(body);
}

main().catch((error) => {
  console.error(`\nMR FAILED: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
