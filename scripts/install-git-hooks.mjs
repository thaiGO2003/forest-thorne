// Installs the forest-thorne Git hooks that are tracked in this repository.
// Run after cloning: `pnpm hooks:install`.
import { execSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const hooksDir = join(root, ".git", "hooks");
if (!existsSync(hooksDir)) {
  console.error("not a git repository: .git/hooks not found");
  process.exit(1);
}

const prePush = `#!/bin/sh
# forest-thorne: fast pre-push gate.
# Only lint runs here (ESLint when the repo has a config, otherwise \`tsc --noEmit\`).
# Integration tests are intentionally excluded, and the production build is deferred:
# run \`pnpm mr --full\` when the work is finished.
root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$root" || exit 0
if ! command -v node >/dev/null 2>&1; then
  echo "pre-push: node not found, skipping lint gate" >&2
  exit 0
fi
if [ ! -f scripts/mr.mjs ]; then
  echo "pre-push: scripts/mr.mjs is missing, skipping lint gate" >&2
  exit 0
fi
node scripts/mr.mjs --lint-only
status=$?
if [ "$status" -ne 0 ]; then
  echo "pre-push: lint failed. Fix it, or use --no-verify only for an emergency." >&2
fi
exit $status
`;

const target = join(hooksDir, "pre-push");
if (existsSync(target)) {
  const current = readFileSync(target, "utf8");
  if (!current.includes("forest-thorne: fast pre-push gate")) {
    const backup = `${target}.bak-${Date.now()}`;
    copyFileSync(target, backup);
    console.log(`existing pre-push backed up to ${backup}`);
  }
}
mkdirSync(hooksDir, { recursive: true });
writeFileSync(target, prePush);
try {
  chmodSync(target, 0o755);
} catch {
  // Windows ignores POSIX modes; Git still runs the hook through sh.
}
console.log(`installed ${target}`);

// One-command MR flow: `git pushmr` runs lint, captures evidence, pushes and opens/updates the PR.
try {
  execSync('git config alias.pushmr "!node scripts/mr.mjs"', { cwd: root, stdio: "ignore" });
  console.log("git alias installed: git pushmr  (= node scripts/mr.mjs)");
} catch {
  console.log("could not install the git alias; run `pnpm mr` instead");
}
