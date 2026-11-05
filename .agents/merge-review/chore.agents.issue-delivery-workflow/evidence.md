# Evidence — chore/agents/issue-delivery-workflow

## Latest: strict PR attestation header fix

- **Code commit tested:** `3d1257f6439e18d2909aadc2135c6d196736aea8`
- **Captured (UTC):** 2026-11-05T23:54:36Z
- **Screenshot:** `verification-strict-header-2026-11-06.png`
- **Dimensions:** 1304 × 884 px, PNG RGB, non-interlaced.
- **Legibility:** branch/HEAD, commands, `tests 16 / pass 16 / fail 0`,
  `pnpm typecheck`, `pnpm build`, and
  `RESULT: node-test=PASS typecheck=PASS build=PASS` are readable at 100%.

### Commands and results

```bash
cd /home/thaigo/forest-thorne-issue-delivery
node --test .agents/skills/github-issue-orchestrator/scripts/pr-attestation.test.mjs
# 16 tests, 16 pass, 0 fail, exit 0

node --check .agents/skills/github-issue-orchestrator/scripts/pr-attestation.mjs
# exit 0

pnpm typecheck
# tsc --noEmit, exit 0

pnpm build
# vite build, exit 0; only the existing large-chunk warning

git diff --check
# exit 0
```

### Regression baseline (failing before, passing after)

The new regression tests were run against the previous parser before changing it:

```text
tests 16
pass 13
fail 3
```

The three failures were exactly the reported bugs:

1. missing exact `---` delimiter returned `ok: true`.
2. `Verification` before `Closes` returned `ok: true`.
3. leading blank line returned `ok: true`.

After the fix: **16/16 PASS**. No full Vitest suite was run (targeted Node tests
only, per task scope).

### Capture conditions and privacy

- **Tool:** `xterm` + `scrot -w 0x04200014` on X11 (`DISPLAY=:0`). `agent-desktop`
  1.1.0 is installed and `status` is OK, but xterm is not exposed via AT-SPI
  (`list-windows` only listed `lite-terminal`), so the window was captured directly.
- **Window:** xterm 130×40, DejaVu Sans Mono 13.
- **Privacy:** terminal output only; no tokens, credentials, or private desktop
  content beyond the worktree path and git SHAs.
- **No linked issue:** this branch has no GitHub issue; no `Closes` line,
  issue snapshot, or attestation was invented for this evidence.

## Earlier evidence (initial workflow commit)

- `verification-2026-11-06.png` (1304 × 884): HEAD `1c01c70ee42b5f3d06597884c10cc8ee725a031b`,
  `node --test` 9/9 PASS and `pnpm typecheck` PASS.
- This proves the initial workflow/skill helper tests passed before the strict
  header regression fix.
