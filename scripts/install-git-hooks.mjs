// Installs the forest-thorne Git hooks that are tracked in this repository.
// Run after cloning: `pnpm hooks:install`.
import { execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const HOOK_MARKER = "forest-thorne: fast pre-push gate";
export const CHAIN_SUFFIX = ".forest-thorne-existing";

function git(cwd, args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

/** Resolve the real hook directory, including linked worktrees and core.hooksPath. */
export function resolveHooksDir(cwd = process.cwd()) {
  const root = git(cwd, ["rev-parse", "--show-toplevel"]);
  let configured = "";
  try {
    configured = git(root, ["config", "--get", "core.hooksPath"]);
  } catch {
    configured = "";
  }
  if (configured) return isAbsolute(configured) ? configured : resolve(root, configured);
  const relative = git(root, ["rev-parse", "--git-path", "hooks"]);
  if (!relative) throw new Error("git rev-parse --git-path hooks returned an empty path");
  return resolve(root, relative);
}

function hookScript() {
  return `#!/bin/sh
# ${HOOK_MARKER}.
# Fast path: lint only. Full merge gates still apply in Part B.
# Do not bypass this guard with --no-verify.

existing="$(dirname "$0")/pre-push${CHAIN_SUFFIX}"
if [ -f "$existing" ]; then
  if [ ! -x "$existing" ]; then
    chmod +x "$existing" 2>/dev/null || exit 1
  fi
  "$existing" "$@" || exit $?
fi

root=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "pre-push: not inside a git worktree; failing closed." >&2
  exit 1
}
cd "$root" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "pre-push: node not found; failing closed." >&2
  exit 1
fi
if [ ! -f scripts/mr.mjs ]; then
  echo "pre-push: scripts/mr.mjs is missing; failing closed." >&2
  exit 1
fi

node scripts/mr.mjs --lint-only || {
  echo "pre-push: lint failed. Fix lint; do not bypass with --no-verify." >&2
  exit 1
}
exit 0
`;
}

/**
 * Install the tracked pre-push guard without dropping an existing hook.
 * Returns the resolved paths and whether a previous hook was chained.
 */
export function installHooks({ cwd = process.cwd(), log = console.log, warn = console.warn } = {}) {
  const root = git(cwd, ["rev-parse", "--show-toplevel"]);
  const hooksDir = resolveHooksDir(root);
  mkdirSync(hooksDir, { recursive: true });

  const target = join(hooksDir, "pre-push");
  const sidecar = `${target}${CHAIN_SUFFIX}`;
  let chained = false;

  if (existsSync(target)) {
    const current = readFileSync(target, "utf8");
    if (!current.includes(HOOK_MARKER)) {
      if (!existsSync(sidecar)) {
        copyFileSync(target, sidecar);
        try {
          chmodSync(sidecar, statSync(target).mode & 0o777);
        } catch {
          // Windows ignores POSIX modes; Git still invokes the hook through sh.
        }
        chained = true;
        log(`existing pre-push chained as ${sidecar}`);
      } else {
        throw new Error(
          `pre-push and ${sidecar} both exist; refusing to overwrite or disable an existing guard. ` +
          "Resolve the two hooks manually, then rerun `pnpm hooks:install`.",
        );
      }
    }
  }

  writeFileSync(target, hookScript());
  try {
    chmodSync(target, 0o755);
  } catch {
    // Windows ignores POSIX modes; Git still invokes the hook through sh.
  }
  log(`installed ${target}`);

  // One-command MR flow: `git pushmr` runs lint, captures evidence, pushes and opens/updates the PR.
  try {
    execFileSync("git", ["config", "alias.pushmr", "!node scripts/mr.mjs"], { cwd: root, stdio: "ignore" });
    log("git alias installed: git pushmr  (= node scripts/mr.mjs)");
  } catch {
    warn("could not install the git alias; run `pnpm mr` instead");
  }

  return { root, hooksDir, target, sidecar, chained };
}

const invokedDirectly = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedDirectly) {
  try {
    installHooks();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
