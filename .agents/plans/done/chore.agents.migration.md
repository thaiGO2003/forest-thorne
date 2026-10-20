# Migrate agent configuration to `.agents`

## Goal
Rename the repository-local `.omp` directory to `.agents`, preserve tracked and untracked files, and update active instructions/hooks to the new paths.

## Scope
- Rename the existing directory without overwriting unrelated changes.
- Update root and nested `AGENTS.md`, plan convention references, README links, and hook path consumers.
- Add a concise safety-check handling skill that reports blocked operations and allows only independent authorized tasks through available 1DevTool orchestration; never re-dispatch the rejected operation to bypass controls.
- Treat existing historical plan/changelog references as historical text, not live configuration.

## Verification
- Re-read root and nested instructions and hook source after migration.
- Validate on-disk skill frontmatter and folder preservation.
- Perform targeted path/smoke tests and inspect repository status.

## Caveat
1DevTool orchestrator feature availability is controlled by the provider; do not represent a proposed routing rule as live without confirmed activation.

## Outcome (2026-10-18)
- Directory copied byte-for-byte, then original removed. Tracked and untracked files preserved.
- Root/nested instructions, hooks, rules, and README now point to `.agents`.
- Smoke runs passed for plan sync, `/plan-done`, Phaser skill detection, and skill frontmatter.
- 1DevTool orchestration probe returned HTTP 403: `Feature 'orchestrator' is not enabled`. No live OpenCode routing was installed or activated.
- Current OMP session hook/skill automatic discovery from `.agents` was not verified; the root `AGENTS.md` gives an explicit instruction path.
