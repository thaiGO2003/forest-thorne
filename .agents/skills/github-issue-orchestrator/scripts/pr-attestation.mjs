#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { MAX_VERIFICATION, parseAttestationHeader } = require(
  "../../../../scripts/github/attestation-contract.cjs",
);

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const HEAD_RE = /^[a-f0-9]{40}$/i;
const REPO_RE = /^[^/\s]+\/[^/\s]+$/;

const USAGE = `Usage:
  pr-attestation.mjs header   --issue <N> [--issue <N> ...] --head <sha> --verification "<text>" [--repo owner/name]
  pr-attestation.mjs evidence --dir <evidence-dir> --head <sha> [--repo owner/name] [--title <text>]
  pr-attestation.mjs check    --pr <N> [--head <sha>] [--repo owner/name]

Commands:
  header    Print the exact PR attestation header with GitHub issue snapshots.
  evidence  Print a Markdown table of evidence images pinned to the given head SHA.
  check     Validate a PR body/head/base and its issue snapshots. Exit 1 on failure.

Environment:
  Requires an authenticated gh CLI. Never writes git state.`;

export function issueSnapshotHash(issue) {
  return createHash("sha256")
    .update(JSON.stringify([String(issue?.title ?? ""), String(issue?.body ?? "")]))
    .digest("hex");
}

export function parseHeader(body) {
  return parseAttestationHeader(body);
}

export function buildHeader({ issues, head, verification }) {
  const normalized = (issues ?? []).map((issue) => Number(issue.number ?? issue));
  const unique = [...new Set(normalized)];
  if (!unique.length) throw new Error("at least one issue is required");
  if (unique.some((number) => !Number.isSafeInteger(number) || number < 1)) {
    throw new Error("issue numbers must be positive integers");
  }
  if (!HEAD_RE.test(String(head ?? ""))) {
    throw new Error("head must be a full 40-character commit SHA");
  }
  const evidence = String(verification ?? "").trim();
  if (!evidence) throw new Error("verification is required");
  if (evidence.length > MAX_VERIFICATION) {
    throw new Error(`verification must be at most ${MAX_VERIFICATION} characters`);
  }

  const byNumber = new Map(
    (issues ?? []).filter((issue) => typeof issue === "object").map((issue) => [Number(issue.number), issue]),
  );
  const lines = unique.map((number) => `Closes #${number}`);
  for (const number of unique) {
    const issue = byNumber.get(number) ?? {};
    lines.push(`Issue-Snapshot: #${number} sha256:${issueSnapshotHash(issue)}`);
  }
  lines.push(`Verification: ${evidence}`);
  lines.push(`Verified-Head: ${String(head).toLowerCase()}`);
  return lines.join("\n");
}

export function rawUrl(repo, head, repoPath) {
  if (!REPO_RE.test(String(repo ?? ""))) throw new Error("repo must be owner/name");
  if (!HEAD_RE.test(String(head ?? ""))) throw new Error("head must be a full 40-character commit SHA");
  const encoded = String(repoPath)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `https://raw.githubusercontent.com/${repo}/${String(head).toLowerCase()}/${encoded}`;
}

function listImages(directory) {
  const images = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) images.push(...listImages(full));
    else if (entry.isFile() && IMAGE_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      images.push(full);
    }
  }
  return images.sort();
}

function repoPath(root, target) {
  const absolute = resolve(root, target);
  const local = relative(root, absolute);
  if (!local || local.startsWith("..") || isAbsolute(local)) {
    throw new Error(`path must be inside the repository root: ${target}`);
  }
  return local.split(sep).join("/");
}

export function collectImages(dir, root = process.cwd()) {
  const absolute = resolve(root, dir);
  if (!existsSync(absolute) || !statSync(absolute).isDirectory()) {
    throw new Error(`evidence directory not found: ${dir}`);
  }
  return listImages(absolute).map((file) => repoPath(root, file));
}

export function buildEvidenceMarkdown({ dir, head, repo, title = "Evidence", root = process.cwd() }) {
  if (!HEAD_RE.test(String(head ?? ""))) throw new Error("head must be a full 40-character commit SHA");
  if (!REPO_RE.test(String(repo ?? ""))) throw new Error("repo must be owner/name");
  const images = collectImages(dir, root);
  if (!images.length) throw new Error(`no image evidence found in ${dir}`);

  const rows = images.map((file, index) => {
    const name = basename(file);
    const alt = name.replace(/[[\]()]/g, "_");
    return `| ${index + 1} | \`${name}\` | ![${alt}](${rawUrl(repo, head, file)}) |`;
  });
  const indexFile = `${String(dir).replace(/\/+$/, "")}/evidence.md`;
  const indexLine = existsSync(resolve(root, indexFile))
    ? `\n- Index: [evidence.md](${rawUrl(repo, head, repoPath(root, indexFile))})\n`
    : "";

  return [
    `# ${title}`,
    "",
    `- Repo: \`${repo}\``,
    `- Head: \`${String(head).toLowerCase()}\``,
    `- Directory: \`${String(dir).replace(/\/+$/, "")}\``,
    indexLine,
    "| # | Artifact | Preview |",
    "| --- | --- | --- |",
    ...rows,
  ].join("\n");
}

function gh(args) {
  const output = execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return output.trim();
}

function ghJson(args) {
  const output = gh(args);
  return output ? JSON.parse(output) : null;
}

function resolveRepo(explicit) {
  const repo = explicit ?? ghJson(["repo", "view", "--json", "nameWithOwner"]).nameWithOwner;
  if (!REPO_RE.test(String(repo ?? ""))) throw new Error("repo must be owner/name");
  return repo;
}

function fetchIssue(repo, number) {
  const issue = ghJson(["api", `repos/${repo}/issues/${number}`]);
  if (issue?.pull_request) throw new Error(`#${number} is a pull request, not an issue`);
  return issue;
}

function checkPr(repo, prNumber, expectedHead) {
  const pr = ghJson([
    "pr", "view", String(prNumber),
    "--json", "number,headRefOid,body,isDraft,baseRefName,state,url",
  ]);
  const errors = [];
  if (pr.baseRefName !== "dev") errors.push(`base branch must be dev, got ${pr.baseRefName}`);
  if (pr.isDraft) errors.push("PR must not be a draft");
  if (pr.state !== "OPEN") errors.push(`PR must be open, got ${pr.state}`);

  const parsed = parseHeader(pr.body);
  errors.push(...parsed.errors);
  const head = String(pr.headRefOid ?? "").toLowerCase();
  if (parsed.head && parsed.head !== head) {
    errors.push(`Verified-Head ${parsed.head} does not match PR head ${head}`);
  }
  if (expectedHead && head !== String(expectedHead).toLowerCase()) {
    errors.push(`PR head ${head} does not match expected ${String(expectedHead).toLowerCase()}`);
  }

  const issues = parsed.issues.map((number) => {
    try {
      const issue = fetchIssue(repo, number);
      const actual = issueSnapshotHash(issue);
      const expected = parsed.snapshots.get(number);
      const ok = actual === expected;
      if (!ok) errors.push(`Issue-Snapshot for #${number} is stale`);
      return { number, ok, snapshot: actual };
    } catch (error) {
      errors.push(`cannot read issue #${number}: ${error.message}`);
      return { number, ok: false };
    }
  });

  return {
    ok: errors.length === 0,
    pr: pr.number,
    url: pr.url,
    base: pr.baseRefName,
    head,
    issues,
    errors,
  };
}

function parseArgs(argv) {
  const args = { _: [], issue: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      args._.push(token);
      continue;
    }
    const key = token.slice(2);
    if (key === "help") {
      args.help = true;
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`missing value for --${key}`);
    }
    index += 1;
    if (key === "issue") args.issue.push(value);
    else args[key] = value;
  }
  return args;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === "-h" || command === "--help") {
    console.log(USAGE);
    return;
  }
  const args = parseArgs(rest);
  if (args.help) {
    console.log(USAGE);
    return;
  }

  const repo = resolveRepo(args.repo);

  if (command === "header") {
    if (!args.issue.length) throw new Error("--issue is required");
    if (!args.head) throw new Error("--head is required");
    if (!args.verification) throw new Error("--verification is required");
    const issues = args.issue.map((value) => {
      const number = Number(value);
      const issue = fetchIssue(repo, number);
      return { number, title: issue.title, body: issue.body };
    });
    process.stdout.write(`${buildHeader({ issues, head: args.head, verification: args.verification })}\n---\n`);
    return;
  }

  if (command === "evidence") {
    if (!args.dir) throw new Error("--dir is required");
    if (!args.head) throw new Error("--head is required");
    const markdown = buildEvidenceMarkdown({
      dir: args.dir,
      head: args.head,
      repo,
      title: args.title ?? "Evidence",
    });
    process.stdout.write(`${markdown}\n`);
    return;
  }

  if (command === "check") {
    if (!args.pr) throw new Error("--pr is required");
    const result = checkPr(repo, args.pr, args.head);
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
    return;
  }

  throw new Error(`unknown command: ${command}`);
}

const invokedDirectly = process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedDirectly) {
  main().catch((error) => {
    console.error(`error: ${error.message}`);
    process.exitCode = 1;
  });
}
