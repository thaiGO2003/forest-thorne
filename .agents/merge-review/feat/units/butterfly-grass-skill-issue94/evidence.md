# Issue #94 — Bướm Cỏ evidence

- In-app 1DevTool BrowserPanel was attempted first via `browser_list_tabs`, but returned `project_required`: `projectId is required because this MCP call is not attributable to a live 1DevTool terminal`. No project id was supplied by that session.
- Fallback: `node evidence.mjs "Bướm Cỏ" .agents/merge-review/feat/units/butterfly-grass-skill-issue94 5224` with the Vite server on localhost.
- Captured `library-buom-co.png` (1280×800): search field `Bướm Cỏ` and one matching library card.
- Detail screenshot unavailable: fallback Chromium/CDP attempts timed out or closed while capturing the detail surface, including `cdpSession.send: Target page, context or browser has been closed`. The library entry itself was observed.
- Focused tests: 4 files / 65 tests passed; `pnpm typecheck` and `pnpm build` passed. No verified visual proof for sequential combat VFX.
