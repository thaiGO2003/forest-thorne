# Remaining Menu Utilities Plan

## Scope
Finish the remaining non-creature-visual requirements from the mega prompt without restoring or modifying rejected creature rigs.

## Decisions
- Settings: localize displayed canonical values only; persisted IDs stay unchanged.
- Mods: extend the existing ModRegistry owner with strict local import parsing; failed imports are atomic and Workshop remains a placeholder.
- Donate: compact only with scoped layout classes; no CSS-painted chrome or color.
- Achievements: render canonical 100 rows, rank with rankAchievementRows, persist claim/equip through the existing collection profile owner.
- Reward coverage: the authored prompt/catalog contains only 99 achievement skins and no runsStarted_50 reward. Do not invent a Falcon skin; make validation surface the missing mapping explicitly.
- Equipped skins: keep state player-owned only. No enemy/right-side consumer will read equippedSkinByUnitId.

## Files
- src/core/i18n.ts
- src/ui/settings.ts
- src/mods/ModRegistry.ts
- src/app/screens.ts
- src/ui/ui.css
- src/core/achievements.ts
- tests/settings*.test.ts or focused UI/value-label coverage
- tests/mod-registry.test.ts
- tests/achievements-history.test.ts
- tests/donate.test.ts
- .omp/plans/pending/changelog.md

## Verification
- Focused Vitest only.
- corepack pnpm typecheck
- corepack pnpm build
- git diff --check
- Browser smoke for Settings, local mod import, Donate, Achievements.
- Confirm rejected creature visual modules remain untouched.
