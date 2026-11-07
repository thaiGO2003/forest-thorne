# PR #53 corrective test evidence

This note is committed with the `tests/recovered-bridge.test.ts` correction. It records only test/static verification for this corrective-only change; no browser session or screenshot was captured for it.

## Root cause and test correction

At the prior reviewed HEAD, `tests/recovered-bridge.test.ts` staged `tear` while `run.itemBag` contained only `bark` and `claw`. The current `stageRunCraftItem()` contract in `src/core/run.ts` rejects ingredients not present in the bag. Substituting `bark` (as initially suggested) was also unsuitable: the authored level-one recipe `bramble_vest` maps one `bark` to `eq_bramble_vest`, so the subsequent craft would succeed.

The test now seeds `eq_bramble_vest` in the bag and stages that valid ingredient at the active level-one cell. The authored catalog uses it only as a multi-cell recipe component, so the single-cell grid remains uncraftable. The original assertions remain: failed craft preserves bag, history, staging and saved progress; crafted achievement count stays zero; resumed run retains bag/history and has empty transient staging.

Changed source/test file: `tests/recovered-bridge.test.ts`. No production code changed. Existing screenshot files in this directory were left unchanged; they are not new evidence for this corrective test change.

## Verification

- Focused regression: `NODE_OPTIONS=--localstorage-file=.vitest-ls.json pnpm exec vitest --run tests/recovered-bridge.test.ts -t "preserves an uncraftable staged ingredient on failure"` — **1 passed**.
- Independent Verifier's exact nine-file command, prefixed with `NODE_OPTIONS=--localstorage-file=.vitest-ls.json` — **9 files passed, 95/95 tests passed**.
- Quarantine policy: `NODE_OPTIONS=--localstorage-file=.vitest-ls.json pnpm exec vitest --run tests/run.test.ts` — **1 file passed, 22/22 tests passed**.
- `pnpm typecheck` — **PASS**.
- `pnpm build` — **PASS**, Vite transformed 137 modules. Existing chunk-size warning (>1200 kB minified JS) remains.
- `git diff --check` and `git diff --cached --check` — **PASS** before commit.

The exact source HEAD is reported by `git rev-parse HEAD` after the commit; the verifier must refresh PR screenshot/Verified-Head evidence and independently reverify that new HEAD. No PR comment, approval, merge, issue closure, or unrelated branch change was made by this corrective task.
