# Evidence — chore/agents/issue-delivery-workflow

## Latest: shared attestation and issue-closure contract verification

- **Code commit tested:** `676fb94ad1486b8a8f10bb31c206c5954a958a03`
- **Captured (UTC):** 2026-11-06T00:50:55Z
- **Screenshot:** `verification-cross-consumer-2026-11-06.png` (1304 × 884 px; 166,873 bytes; RGB PNG).
- **Image SHA-256:** `71167a8292b56e4c4115ccad620bceb6797ee34b2869b5283a6c993f6281ec4b`.
- **Real terminal evidence:** xterm on X11 `DISPLAY=:0`, captured with `scrot -w`. The visible terminal shows Node tests `58 / 58 PASS`, `pnpm typecheck` PASS, `pnpm build` PASS, syntax PASS, and diff-check PASS. The build emits only the existing large-chunk warning (137 modules).
- **Independently executed:** `node --test .agents/skills/github-issue-orchestrator/scripts/pr-attestation.test.mjs tests/github-issue-closure.test.cjs tests/pr-attestation-cross-consumer.test.cjs`; `node --check` for all three JS entry points; `pnpm typecheck`; `pnpm build`; `git diff --check origin/dev...HEAD`. No full Vitest suite.
- **Runtime contract:** single/multi-issue valid headers accepted by helper and closure consumer; malformed order, missing delimiter, blanks, duplicate declarations/snapshots/receipts rejected by both. Closure tests cover permission, maintainer label, head/body changes, snapshot changes, and pre-mutation revalidation.
- **Provenance:** screenshot records the tested implementation commit above; a subsequent evidence-only commit carries this PNG and index. Verification is rerun at that final commit before updating PR #132's `Verified-Head`.
- **Privacy:** no credentials or tokens visible; scoped source scan detected no leaked credentials. The branch has no linked GitHub issue, so no `Closes` or `Issue-Snapshot` attestation applies to PR #132.

## Previous: strict PR attestation header fix

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
