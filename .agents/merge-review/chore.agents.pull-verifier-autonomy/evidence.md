# Evidence — Issue #151 Pull Verifier policy reconciliation

- **Issue:** #151 — https://github.com/thaiGO2003/forest-thorne/issues/151
- **Branch:** `chore/agents/pull-verifier-autonomy`
- **Code HEAD tested:** `a2af91f59deadf75e1e956147bde15040030e5e6`
- **Evidence commit:** this commit refreshes this file and the screenshots.
- **Worktree:** `/home/thaigo/forest-thorne-pull-verifier-autonomy`

## Conflict resolution

- `origin/dev` already merged at `58df3160a974ee432c3d7005b47ef1a6cdec30d3`.
- `origin/main` merged in `95d3388827bf2285ef5b94c70e841ac2bd31b45e`.
- Only conflict: `.agents/rules/merge-workflow.md` (add/add). Resolved semantically:
  - **Part A** = main lint-first fast path for draft/pre-push (`pnpm mr`, CI lint, build when ready).
  - **Part B** = dev full merge gate (sync dev/main, targeted tests, build, head-pinned evidence, dossier APPROVED, hooks, PR merge dev).
  - §4b placed after the §4 reviewer checklist.
- Main fast-path files preserved: `scripts/mr.mjs`, `scripts/install-git-hooks.mjs`, `package.json`, `.gitignore`, `src/core/i18n.ts`.
- `.agents/AGENTS.md` reconciled: BrowserPanel + Issue delivery + Merge review + fast-path/merge-gate distinction.
- Issue-delivery workflow + skill use the 2026-11-07 authorization quote.
- `merge-guard.ts` approval hint points to §4b; hook logic unchanged.

## Verifier findings fixed

- `.gitignore` graft-cache line restored to em dash (`—`), no mojibake.
- `merge-workflow.md` states `pr-checks.yml` is **not yet deployed**; repo currently has only
  `agents-migration-guard.yml` and `close-verified-pr-issues.yml`.
- Part A evidence wording matches `scripts/mr.mjs`: images upload to the dedicated
  `mr-evidence` branch via GitHub contents API; gist is not used because it rejects binary.
  Script header comment aligned; runtime logic unchanged.

## Verification

- **Ancestry:** 0 behind `origin/dev`; 0 behind `origin/main`.
- `git diff --check` → PASS.
- Conflict-marker scan scope policy files → no markers.
- Secret scan scope docs → no obvious secrets.
- `node --check scripts/mr.mjs scripts/install-git-hooks.mjs` → PASS.
- `pnpm typecheck` → PASS (`tsc --noEmit`).
- `pnpm build` → PASS (`vite build`; existing large-chunk warning).
- Docs/comment-only: no gameplay/runtime surface changed.

## Documentation render evidence

Rendered from the actual `.agents/rules/merge-workflow.md` §4b via GitHub API
(`gh api markdown -F text=@section.md -f mode=gfm`), then captured with headless Chromium
(Playwright, SwiftShader). Header records source path and code HEAD `a2af91f`.

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
