# Evidence — Issue #151 Pull Verifier policy reconciliation

- **Issue:** #151 — https://github.com/thaiGO2003/forest-thorne/issues/151
- **Branch:** `chore/agents/pull-verifier-autonomy`
- **Code HEAD tested:** `2c98088ad450fd52032918847345513e2a50d823`
- **Evidence commit:** this commit adds this file and the screenshots.
- **Worktree:** `/home/thaigo/forest-thorne-pull-verifier-autonomy`

## Conflict resolution

- `origin/dev` already merged at `58df3160a974ee432c3d7005b47ef1a6cdec30d3`.
- `origin/main` merged in `95d3388827bf2285ef5b94c70e841ac2bd31b45e`.
- Only conflict: `.agents/rules/merge-workflow.md` (add/add). Resolved semantically:
  - **Part A** = main lint-first fast path for draft/pre-push (`pnpm mr`, CI lint, build when ready, evidence external/gitignored).
  - **Part B** = dev full merge gate (sync dev/main, targeted tests, build, head-pinned evidence, dossier APPROVED, hooks, PR merge dev).
  - §4b placed after the §4 reviewer checklist.
- Main fast-path files preserved unchanged: `scripts/mr.mjs`, `scripts/install-git-hooks.mjs`, `package.json`, `.gitignore`, `src/core/i18n.ts`.
- `.agents/AGENTS.md` reconciled: BrowserPanel section + Issue delivery + Merge review + fast-path/merge-gate distinction.
- `.agents/rules/issue-delivery-workflow.md` and `github-issue-orchestrator/SKILL.md` updated to the 2026-11-07 authorization quote.
- `merge-guard.ts` approval hint now points to §4b; hook logic unchanged.

## Verification

- **Ancestry:** 0 behind `origin/dev`; 0 behind `origin/main`.
- `git diff --check` → PASS.
- Cached diff-check → PASS.
- Conflict-marker scan scope policy files → no markers.
- Secret scan scope docs → no obvious secrets.
- `node --check scripts/mr.mjs scripts/install-git-hooks.mjs` → PASS.
- `pnpm typecheck` → PASS (`tsc --noEmit`).
- `pnpm build` → PASS (`vite build`; existing large-chunk warning).
- Docs-only change: no gameplay/runtime surface changed by this policy edit.

## Documentation render evidence

Rendered from the actual `.agents/rules/merge-workflow.md` §4b via GitHub API
(`gh api markdown -F text=@section.md -f mode=gfm`), then captured with headless Chromium
(Playwright, SwiftShader). Header on the screenshot records source path and code HEAD.

- `merge-workflow-4b-desktop.png` — 1280 × 900, readable at 100%.
- `merge-workflow-4b-mobile.png` — 390 × 1675, quote wraps and remains readable.
- Screenshots show the exact `Reviewer: agent:pull-verifier` and
  `Authorized-by: thaiGO2003 — 2026-11-07 — "tui ko muon human in the loop dau"` pair,
  failure-report requirements, and no-bypass guards.

## Scope / safety

- No PR/approve/merge performed.
- No edits to primary worktree, `#128`, `#131`, `#138`.
- No force/no-verify/ours/theirs.
- Rollback: revert this docs/policy commit; no runtime/save impact.
