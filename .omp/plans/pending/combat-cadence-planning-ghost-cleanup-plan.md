# Combat Cadence + Planning Ghost Cleanup Plan

Date: 2026-09-20  
Branch: `feature/threejs-migration`  
Status: SOURCE IMPLEMENTED — runtime/browser verification pending  
Scope: Three.js production runtime only. Do not modify `old_src/`.

## SPEED-1 — Slow occupied combat actions

- **Source symbol:** `src/three/ThreeRoundScene.ts::ThreeCombatController.update`, `src/three/ThreeUnitFactory.ts::{ATTACK_DURATION,SKILL_DURATION}`; new `src/three/ThreeCombatPacing.ts`.
- **Migration method:** move the Three occupied-action base interval into a typed helper and increase it from 420ms to 600ms before applying the canonical `getCombatDurationMultiplier()`. At speed level 0 this changes automatic occupied actions from 1260ms to 1800ms. Increase the basic-attack lunge presentation from 350ms to 500ms so attack motion reads clearly instead of snapping.
- **Allowed:** Three-only pacing adapter, existing shared speed-level multiplier, targeted tests and comments.
- **Forbidden:** changing damage/stat formulas, changing `src/core/gameSpeed.ts` economy/speed tiers, slowing empty-cell scan delay, adding duplicate combat rules, touching Phaser runtime.
- **Targeted Vitest:** `tests/three/threeCombatScene.test.ts` asserts no automatic action before 1.8s at speed level 0 and one action at/after the threshold; `tests/three/threeUnitFactory.test.js` keeps attack pose active before 500ms and reset after it.
- **Runtime evidence:** normal-speed fights have visible breathing room between occupied unit actions while purchased speed levels still accelerate through the shared multiplier.
- **Done criterion:** occupied combat cadence resolves through one helper; base interval is 600ms; attack animation lasts 500ms; empty-cell cadence is unchanged.

## GHOST-1 — Clear Planning transient visuals across phase boundaries

- **Source symbol:** `src/three/ThreeRoundScene.ts::ThreePlanningController.unmount`, `startCombat`, `clearAttackPreview`, Planning mount lifecycle.
- **Migration method:** add one teardown-safe `clearPlanningTransientVisuals()` path that resets selection before preview clearing, cancels all Planning UI timers, removes preview badges/tracers/animations, clears tooltip/context transient state, and calls `clearAllHighlights()` on the shared board. Invoke it before `onStartCombat`, during unmount, and once on Planning mount to sanitize leftovers from a previous round.
- **Allowed:** transient presentation cleanup only; shared board/player/bench gameplay state must remain intact.
- **Forbidden:** recreating the board just to clear visuals, deleting units from gameplay state, clearing shop/bench/player data, relying on scene replacement timing alone.
- **Targeted Vitest:** `tests/three/threePlanningScene.test.ts` seeds a selected tile highlight + preview badge, transitions/unmounts, and asserts selection is null, badge removed, and board/bench highlights are cleared; remount starts visually clean.
- **Runtime evidence:** after combat result → next Planning, and Planning → Combat → retry/new round, no old selected tile, attack preview tracer/badge, hover/selection highlight, or stale Planning DOM remains.
- **Done criterion:** shared board has zero highlighted Planning tiles after teardown; preview DOM count is zero; Planning mount begins from a clean transient-visual state.

## Static gates

- `old_src/` touched files = 0.
- New direct `phaser` imports under `src/three/**` = 0.
- New explicit `any`, `@ts-ignore`, `@ts-expect-error`, `eslint-disable` in touched Three files = 0.
- Do not claim Vitest/build/browser PASS unless actually executed.


## Implementation status — SOURCE IMPLEMENTED

- **SPEED-1:** implemented. `ThreeCombatPacing.ts` owns a 600ms occupied-action base interval and multiplies it by the canonical shared combat-duration multiplier. At speed level 0 the automatic occupied-action interval is now 1800ms instead of 1260ms. `ThreeUnitFactory.ts` basic attack lunge duration is 500ms.
- **GHOST-1:** implemented. `ThreePlanningController.clearPlanningTransientVisuals()` clears Planning timers, selection state, tooltip state, attack-preview cells/badges/animations and all shared-board highlights. It runs on Planning mount, immediately before `onStartCombat`, and during unmount. Planning board/bench avatar groups are now explicitly removed from the Three scene before disposal.
- **Targeted source regressions:** `threeCombatScene.test.ts` pins the 1800ms threshold; `threeUnitFactory.test.js` pins the 500ms attack presentation; `threePlanningScene.test.ts` pins selection/highlight/badge/avatar teardown.
- **Static readback:** no old 420ms expression remains; cleanup call sites = mount/startCombat/unmount; `old_src/` touched = 0; new direct Phaser imports = 0; new explicit any/suppressions = 0.
- **Verification limit:** Vitest/build/browser were not executed in this connector session, so runtime PASS is not claimed.

## Audit 2026-09-22 20:58 +07:00

- Current HEAD readback: source implementation remains present; no plan checkbox is open.
- Production Three entrypoint is now Three-only; this plan no longer depends on runtime Phaser rollback.
- Closure work on 2026-09-22 removed additional Three-reachable legacy/type-only Phaser edges in shared combat runtimes.
- **Still pending before archival:** browser replay confirming cadence/ghost cleanup and the plan's visual interaction expectations on the current post-cleanup commit.
