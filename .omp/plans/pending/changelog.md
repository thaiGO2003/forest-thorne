# Pending plans changelog

## 2026-09-22 08:28:37 +07:00

- Audit lại toàn bộ plan active trên `dev`.
- Xác nhận phần lớn plan con đã SOURCE IMPLEMENTED nhưng còn runtime/Vitest/browser gates.
- `threejs-pure-3d-master-plan.md` còn 30 checkbox mở tại thời điểm audit.
- `repository-restructure-wbs.md` còn Phase D–K chưa đóng hoàn toàn.

## 2026-09-22 15:56 +07:00

- Master plan: 30 checkbox mở → 11 checkbox mở; 10 remediation cases được reconcile thành `[~]` dựa trên source/test evidence, không claim runtime PASS.
- Thêm `tests/core/offenseDebuff.test.ts` và `tests/three/threeTutorialCanonicalParity.test.ts`.
- I18N live round logs chuyển sang symmetric VI/EN `three.*` keys.
- Docs move: `docs/migration/{phaser-to-three,final-replay,legacy-feature-animation-census}.md`, `docs/reviews/phase-2-review-matrix.md`; thêm `docs/README.md`.
- Branch `refactor/merge-thin-wrappers` và `fix/tech-fit-button-alignment` đã verify là ancestor của `dev`; connector không có delete-ref action nên remote cleanup còn blocked.


## 2026-09-22T16:25:00+07:00 — Unit-owned chicken animation refactor

- Removed direct Rapper/Sleepy-Hen animation knowledge from shared combat/library runtimes; they now dispatch through `ThreeUnitAnimationController`.
- Gà Trống Rapper keeps its complete unit-owned Idle / Combat Idle / Attack / Skill / Take Hit / Move animation, with the skill jump moved into `ThreeChickenRapperAnimation.ts`.
- Cô Gà Ngủ Nướng upgraded to v3 articulated rig: looping 3D Zzz snore, detachable pillow throw attack, jump + yawn skill, unit-owned Take Hit / Move.
- Added/updated regression coverage in `threeChickenRapperRig.test.ts`, `threeSleepyHenGirlSkin.test.ts`, and `threeUnitAnimationOwnership.test.ts`.
- Verification: GitHub source readback/static smoke only; no Vitest/build/browser/device execution in this connector session.


## 2026-09-22T16:59:23+07:00 — Sleepy Hen floor-bedding animation revision

- Idle now lies on a floor mattress under a blanket; legs remain covered and 3D `Zzz` continues looping above the sleeper.
- Attack now raises only the upper body while the blanket stays over the legs; the hug pillow follows a curved spinning boomerang path and returns before she lies back down.
- Skill deliberately does **not** throw the pillow and does **not** jump. It reuses the half-body sit-up, keeps the pillow hugged, opens an oversized yawn mouth, and amplifies the sleepy `Zzz` effect.
- Take Hit and Move preserve the mattress/blanket silhouette instead of standing/walking.
- Updated Three.js regression coverage and Library provenance for `sleepy-hen-girl-v4-bed`.
- Verification: GitHub source readback/static smoke only; no browser/device execution in this connector session.

## 2026-09-22 17:00 +07:00

- Master plan source tasks reconciled against current HEAD; Phase 8/9 cases are `[~] RE-RUN REQUIRED` rather than falsely remaining `[x]` on stale evidence.
- Open master-plan items are now runtime/release/parity/browser gates plus post-cleanup rerun/archive decisions.
- Removed stale runtime rollback and deleted-wrapper references from active plan text.


## 2026-09-22T18:00:00+07:00 — Sleepy Hen detailed voxel concept implementation

- Upgraded `crane_blessing.gaMaiNguNuong` to `sleepy-hen-girl-v5-voxel-detail` using the approved cubic concept direction.
- Added layered cubic pink braids, a readable hen-face nightcap with beak/comb/stars, detailed chicken pillow wings/feet/comb, quilted mattress grid, blanket chick patch, checker accents and tassels.
- Preserved mattress/blanket action language: upper-body-only attack sit-up, boomerang pillow throw, pillow-held yawn skill, bedding-slide move.
- Added a unit-owned 3D speech bubble: `Em thêm 5 phút nữa thôi...` appears every 30 seconds of idle for about 4.8 seconds and hides during actions.
- Added regression coverage for v5 concept parts and the 30s/60s speech-bubble timing.
- Verification: GitHub source readback/static smoke only; no Vitest/build/browser/device execution in this connector session.


## 2026-09-22T18:06:00+07:00 — Sleepy Hen mattress proportion + straight sleep pose

- Widened and lengthened the floor mattress to roughly 2.16 × 3.18 world units so the bedding reads as a real sleeping surface instead of a narrow pad.
- Extended the blanket footprint to cover the straightened lower body and moved its foot tassels to the new foot end.
- Changed the default sleep posture from a partially curled/reclined angle to a near-flat supine pose (`rotation.x ≈ -1.48`) aligned along the mattress length.
- Shifted the upper-body pivot toward the head end of the larger mattress so idle reads as lying straight; attack/skill still sit only the upper body up from that straight base pose.
- Added regression checks for mattress dimensions and the straight lying angle.
- Verification: GitHub source readback/static smoke only; no browser/device execution in this connector session.


## 2026-09-22T18:12:00+07:00 — Sleepy Hen cubic density ×4

- Upgraded `crane_blessing.gaMaiNguNuong` provenance to `sleepy-hen-girl-v6-cubic-x4`.
- Every authored cuboid is now subdivided into a local 2×2 grid, producing exactly 4 child cuboids per source cuboid while preserving the same overall size.
- Rotation-aware subdivision rotates child offsets around each original cuboid center, so rotated hair, ribbons, ornaments, pillow parts, etc. keep their authored silhouette.
- The same ×4 subdivision is applied to the main body, mattress, blanket, chicken pillow, yawn mouth, and Zzz glyph geometry.
- Added metadata `cubicDensityMultiplier = 4`, `sourceCuboidCount`, and `denseCuboidCount`, plus regression coverage locking the 4× ratio.
- Verification: GitHub static/source readback only; no browser/device runtime execution in this connector session.


## 2026-09-22T18:18:00+07:00 — Sleepy Hen visible sharpness + proportion correction

- Identified why the previous ×4 subdivision looked almost identical: same-color child cuboids share the same outer surface and interior faces are culled, so density alone does not create visible detail.
- Kept the ×4 cubic-density path but added authored **raised micro-voxels** that survive culling: hair highlight/strand pixels, pajama seam/buttons, mattress corner trim, blanket stitch diamonds/leg folds, and sharper chicken-pillow feather/cheek accents.
- Shortened the blanket/leg silhouette from ~2.05 to ~1.58 world units and moved tassels inward so the legs no longer read too long.
- Re-centered the near-flat upper-body pivot from the old head-biased position to `z = 0.52`, keeping the head/body inside the mattress footprint.
- Updated animation base pose to the same corrected pivot and blanket center.
- Added world-space bounding-box regression checks for body-inside-mattress and shortened blanket length.
- Provenance is now `sleepy-hen-girl-v7-microvoxel-detail`.
- Verification: GitHub static/source readback only; no browser/device runtime execution in this connector session.


## 2026-09-22T18:32:00+07:00 — Library avatar 360° pitch + fullscreen pinch zoom

- Library 3D unit portrait now supports both horizontal yaw and vertical pitch drag without angle clamping.
- Added wheel zoom and two-pointer pinch zoom, shared by normal and fullscreen portraits.
- Added `⛶ Phóng to` / `⛶ Full screen` button to unit detail; fullscreen viewer uses a full-viewport overlay and `−` close control.
- Fullscreen viewer preserves the current action preview and supports Escape to close.
- Added regression coverage for free pitch rotation, zoom clamp, fullscreen open/close and mobile pinch affordance.
- Verification: GitHub static/source readback only; no browser/device runtime execution in this connector session.


## 2026-09-22T18:41:00+07:00 — Library portrait transparent / unclipped viewer

- Removed the dark portrait background, rounded square frame, and `overflow:hidden` clipping from the Library detail avatar.
- Library portrait host now uses a transparent background, full available width, a larger viewport, and `overflow:visible`.
- Added a fill-container rendering mode so the WebGL renderer follows the actual container width/height and updates camera aspect ratio instead of forcing a square canvas.
- Fullscreen viewer overlay is now fully transparent with no backdrop blur; its model host uses the full available viewport and does not clip overflow.
- Fullscreen renderer now follows the viewport/container dimensions instead of being constrained to a square preview size.
- Existing free yaw/pitch rotation and wheel/pinch zoom remain unchanged.
- Verification: GitHub static/source readback only; no browser/mobile runtime execution in this connector session.


## 2026-09-22T18:47:00+07:00 — Library fullscreen wooden chrome

- Kept the normal Library avatar transparent/unclipped.
- Restyled only the fullscreen unit viewer with the shared medieval wood panel helper backed by `/assets/ui/medieval/panel.png`.
- Replaced the ad-hoc dark close control with the shared medieval plank button backed by `/assets/ui/medieval/button-plank.png`, while preserving the modal dismiss `-` label.
- Existing fullscreen free rotation and wheel/pinch zoom behavior is unchanged.
- Verification: GitHub static/source readback only; no browser/mobile runtime execution in this connector session.


## 2026-09-22T18:58:00+07:00 — Spider + Web Orbit Three pass / unlock-all skin debug

- Added articulated `spider_venom` v2 with eight independently animated leg pivots.
- Added spider-owned Idle, Attack, Skill, Take Hit and Move controller. Skill expands/spins a 3D web trap; Move uses alternating eight-leg scuttle.
- Added Three-specific `spider_venom.webOrbit` rendering with brown/gold/cream palette, star-tier ornaments, dedicated source asset and stronger web effect.
- Wired both spider variants through `ThreeUnitModelFactory` without adding unit-specific logic to shared combat/library pose runtimes.
- Enabled temporary `DEBUG_UNLOCK_ALL_SKINS = true` in `src/data/unitSkins.ts` so every valid authored skin is selectable/equippable during QA.
- Added regression coverage for eight legs, controller ownership, Web Orbit web skill/provenance and global debug skin unlock.
- Verification: GitHub static/source readback only; no Vitest/build/browser/device execution in this connector session.


## 2026-09-22T21:02:00+07:00 — WBS + 3-unit cubic/six-action plan

- Added WBS row `POLY-3D-SKIN-01`: Hawk / Monkey / Owl must first receive the corrected Sleepy-Hen-style cubic pass — approximately 4× authored cubic density with visible raised micro-voxel geometry, not same-color subdivision hidden by interior-face culling.
- Added WBS row `ANIM-BESPOKE-02`: `hawk_hunter`, `monkey_spear`, `owl_nightshot` each require six distinct actions (Idle / Attack / Skill / Hit-Impact / Take Hit / Move), implemented unit-owned under `src/three/animals/<unit>/`.
- Added canonical detailed execution plan: `.omp/plans/pending/hawk-monkey-owl-bespoke-six-actions-plan.md`.
- Plan includes current catalog skins `ridgeHunter`, `spikeBanana`, `nightGlint`, skin-specific micro-voxel requirements, provenance targets, 18 action specs, tests and completion checklists.
- `public/wbs.html` remains a redirect by design and was not duplicated with canonical WBS contents.
- Verification: GitHub source readback/static documentation update only.

## 2026-09-22 20:58 +07:00

- Audited all remaining source-complete plans against current `dev`; none were archived because each still has fresh runtime/browser evidence outstanding.
- Master plan now treats Phase 8/9 as RE-RUN REQUIRED after the 2026-09-22 cleanup.
- Release/build gate tests were migrated from “retain Phaser rollback chunk” to “emit zero Phaser chunks”.
- Exact Three dependency pin landed; frozen install cannot run in current environment.


## 2026-09-22T21:12:00+07:00 — Remaining 119-unit bespoke master plan

- Added `.omp/plans/pending/remaining-roster-bespoke-six-actions-master-plan.md`.
- Scope covers all 119 live units remaining after excluding `crane_blessing`, `spider_venom`, and the already-planned Hawk/Monkey/Owl trio.
- The roster is split into 10 implementation batches.
- Every unit receives a row with: locomotion, visible cubic/micro-voxel focus, Idle, Attack, Skill, Hit/Impact, Take Hit and Move.
- Skill concepts use the current `data/shop_units.csv` authority where available; this is visual planning only and does not change combat logic.
- Every base + authored skin inherits the corrected Sleepy-Hen-style prerequisite: approximately 4× authored cubic density through visible raised/layered micro-voxel detail, not same-color invisible subdivision.
- Added WBS row `ANIM-BESPOKE-ROSTER` linking the master plan and defining the production exit gate: no remaining live unit should end on generic `default:<baseId>` visual animation ownership.
- Verification: GitHub documentation/source readback only; no runtime work was implemented in this planning pass.

## 2026-09-22 21:17 +07:00

- Master plan I18N-1 and 10.6 notes updated with current source evidence.
- Phase 8/9 historical evidence remains invalidated for current HEAD; no stale PASS claims restored.
- Repository restructure WBS records donation-surface dedupe and core QR ownership.
- Remaining blockers are runner-generated closure/manifest, typecheck/Vitest/build and browser/runtime gates.


## 2026-09-22T21:32:00+07:00 — Hawk / Monkey / Owl micro-voxel + six-action source pass

- Added shared raised/layered micro-voxel helper under `src/three/animals/bespoke/ThreeBespokeMicroVoxel.ts`.
- Replaced production packed Hawk/Monkey/Owl rendering path with articulated rigs:
  - `hawk_hunter` + `ridgeHunter`
  - `monkey_spear` + `spikeBanana`
  - `owl_nightshot` + `nightGlint`
- Each rig carries `cubicDensityMultiplier = 4`, visible micro-detail metadata, named articulated parts and base/skin provenance.
- Added bespoke Idle / Attack / Skill / Hit-Impact / Take Hit / Move behavior for all three.
- Extended `UnitVisualAction` and Library action preview with `hit-impact`; added EN/VI action label.
- Hawk skill owns Heat Seek lock + execute feather; Monkey owns pebble/boulder throw + rock impact; Owl owns crescent sleep shot + Zzz impact.
- Added static regression `tests/three/threeNextBespokeTrio.test.ts` and updated Library action regression.
- WBS advanced `ANIM-BESPOKE-02` to SOURCE DONE / runtime pending.
- Verification: GitHub static/source readback only; Vitest/build/browser/device execution remains pending.


## 2026-09-22T21:45:00+07:00 — Remaining roster master plan v2 / per-unit production specs

- Reworked `.omp/plans/pending/remaining-roster-bespoke-six-actions-master-plan.md` from a family-oriented coverage matrix into a full per-unit production specification for all 119 remaining units.
- Every unit now has its own row with:
  - visible micro-voxel/silhouette focus;
  - named Idle;
  - named Attack;
  - exact current Skill authority/target read from `data/shop_units.csv`;
  - Hit-Impact concept;
  - Take Hit concept;
  - Move concept;
  - skin-specific obligations;
  - deterministic acceptance criteria.
- Preserved the corrected Sleepy-Hen rule: ~4× authored cubic density must be visible raised/layered geometry, never invisible same-color subdivision.
- Added explicit metadata, file ownership, reset-safety and test contracts.
- WBS `ANIM-BESPOKE-ROSTER` now describes the plan as a per-unit production spec rather than a family template.
- This was a planning-only pass; no additional unit implementation was performed here.


## 2026-09-22T21:58:00+07:00 — Remaining roster master plan v3 / concrete anatomy + boss authority

- Upgraded `.omp/plans/pending/remaining-roster-bespoke-six-actions-master-plan.md` again to production-spec v3.
- Resolved concrete species/anatomy for every remaining unit row; generic `signature limb/prop` fallbacks were removed from unit specifications.
- Added current skill authority for all five boss units that are outside `data/shop_units.csv`:
  - `boss_earth_colossus` → `Địa Chấn Khóa Thành`
  - `boss_ember_dragon` → `Hỏa Vực Diệt Thành`
  - `boss_storm_phoenix` → `Cuồng Vũ Lôi Phượng`
  - `boss_tempest_jelly` → `Lốc Điện Hỗn Mang`
  - `boss_venom_hydra` → `Tái Sinh Cửu Đầu`
- Hit-Impact planning now keys off the primary skill effect/name before secondary riders, preventing mismatches such as fire skills receiving poison-first impact language.
- Every row now explicitly names the unit, the anatomy/prop that must animate, six action specifications, skin obligation and acceptance checks.
- Resulting plan is ~192k characters and still covers all 119 remaining units.
- Planning-only update; no additional runtime implementation in this pass.


## 2026-09-22T22:08:00+07:00 — Remaining roster production spec v4 audit

- Regenerated the full 119-unit master plan with species/anatomy mapping keyed primarily by unit ID, eliminating false-positive substring matches from Vietnamese display names.
- Corrected affected rows including `triceratops_charge`, `deer_song`, `whale_song`, `roc_legend`, `boss_ember_dragon`, and `boss_storm_phoenix`.
- Verified all 119 production rows exist.
- Verified no unit row uses generic `Kỹ năng riêng`.
- Verified no unit row uses generic anatomy fallback.
- Verified no non-wasp row incorrectly receives wasp stinger/mandible anatomy.
- WBS now points to production-spec v4 and documents boss authority + ID-based species mapping.
- Planning-only pass; no new runtime implementation in this audit.

## 2026-09-22 21:36 +07:00

- Hawk/Monkey/Owl source exit reconciled: 5 source/static exit rows closed; runtime/device rows remain open.
- Remaining-roster Batch 1 started: `wasp_sting`, `fox_flame`, `scorpion_shadow` now have bespoke micro-voxel rigs + unit-owned six-action controllers.
- Added `tests/three/threeBespokeBatch1.test.ts`; authored regression only, not executed in connector session.
- Overall remaining-roster status: **3/119 SOURCE DONE**, runtime verification pending.


## 2026-09-22T21:53:00+07:00 — Wasp Sting bespoke micro-voxel v4 SOURCE DONE

- Completed roster unit #1: `wasp_sting` / Ong Bắp Cày.
- Upgraded the Wasp from packed/static geometry to an articulated micro-voxel v4 rig with visible raised/layered detail and `cubicDensityMultiplier = 4`.
- Added four independently animated wings, six articulated legs, two antennae, mandible/head detail, articulated stinger, basic dart, four skill darts, and poison-spore Hit-Impact geometry.
- Added skin-owned `wasp_sting.sunpin` geometry/provenance/controller. Sun Pin adds sash/belt detail, pendant progression, crown/sun ornament evolution, gold projectile/impact treatment and stronger skill dart scale.
- Implemented six actions: Idle / Attack / Châm Liên Hoàn / Hit-Impact / Take Hit / Move.
- Added `tests/three/threeWaspStingVisual.test.ts` and expanded animation-ownership regression.
- Master roster plan now marks Wasp SOURCE DONE and Fox Flame as next.
- WBS `ANIM-BESPOKE-ROSTER` advanced to `1/119 SOURCE DONE`.
- Verification: GitHub static/source readback only; Vitest/build/browser/device execution remains pending.


## 2026-09-22T21:53:30+07:00 — Fox Flame bespoke micro-voxel v4 SOURCE DONE

- Completed roster unit #2: `fox_flame` / Cáo Hỏa.
- Upgraded the existing Fox prototype rig to production micro-voxel v4 with visible raised/layered detail and `cubicDensityMultiplier = 4`.
- Split head, ears, four legs and a three-segment flame tail into named articulated nodes; added paw/claw, muzzle/eye and flame-tip micro detail.
- Reworked Attack into a short claw-fang feint and `Lửa Cáo` into a distinct backline-assassin cast with crouch/launch pose, three orbiting foxfire wisps and a stronger finishing slash.
- Hit-Impact now owns an ember burst plus a secondary kill-splash visual to represent the 3★ adjacent burn fantasy.
- `fox_flame.emberTrick` now owns v4 geometry/provenance/controller with sash/belt, pendant and 2★/3★ ornament evolution instead of a palette-only treatment.
- Added `tests/three/threeFoxFlameVisual.test.ts` and expanded animation-ownership regression.
- WBS `ANIM-BESPOKE-ROSTER` advanced to `2/119 SOURCE DONE · Wasp + Fox complete · Scorpion next`.
- Verification: GitHub static/source readback only; Vitest/build/browser/device execution remains pending.

## 2026-09-22 22:16 +07:00 — Canonical equipment owner cleanup

- Moved equip / unequip-all / single-unequip mutation rules into `src/scenes/shared/sceneEquipmentRuntime.ts`.
- Repointed live Three round wiring and affected tests to the canonical shared runtime, then deleted `src/three/ThreeSceneEquipmentRuntime.ts` instead of leaving a re-export wrapper.
- Added atomic rejection regression for pre-existing duplicate equips that require normalization.
- Updated migration docs, repository restructure WBS, master plan and canonical WBS HTML.
- Master plan 4.3–4.5 are now `[~]` because fresh targeted runner/browser evidence is still required.
- Verification: GitHub source readback/static assertions only; Vitest/typecheck/build/browser/device execution remains pending.

## 2026-09-22 22:21 +07:00 — Planning transitive closure static audit

- Refetched the planning attack-preview, unit-info and tooltip shared runtimes plus three dependency layers on `dev`.
- Audited listed planning helpers, tooltip/synergy helpers, tutorial runtime, `AISystem`, `BoardSystem`, `UpgradeSystem`, `SynergySystem`, merge/targeting helpers and tutorial target resolver.
- No direct `phaser` import/dynamic import or executable `Phaser.*` API was found in the audited closure.
- This is static source evidence only; master case 10.2 remains `[~]` until generated AST closure + runner evidence is refreshed.


## 2026-09-22T22:30:00+07:00 — Scorpion Shadow bespoke micro-voxel v4 SOURCE DONE

- Completed roster unit #3: `scorpion_shadow` / Bọ Cạp Bóng.
- Upgraded the existing Scorpion prototype from micro-voxel v1 to production v4 with visible raised/layered detail and `cubicDensityMultiplier = 4`.
- Added twin multi-joint pincers, eight articulated legs, five articulated tail segments and a detailed stinger.
- Reworked `Đuôi Chích` into a dedicated tail wind-up + shadow-needle release rather than a scaled basic pincer pose.
- Hit-Impact now owns shadow burst + three stun-star voxels; 3★ additionally exposes a rage-drain shard to represent the skill's rage removal.
- `scorpion_shadow.midnightSting` now owns v4 geometry/provenance/controller with dark cape plates, clasp/gem and 2★/3★ midnight ornaments.
- Fixed reset safety so stinger rotation cannot leak into the next action.
- Take Hit now stays inside the visual rig without moving gameplay-root or visual-rig X/Z.
- Added `tests/three/threeScorpionShadowVisual.test.ts`, updated animation ownership, and reconciled `tests/three/threeBespokeBatch1.test.ts` with the Wasp/Fox/Scorpion v4 node names.
- Master plan reconciled the concurrent Batch 1 entry from stale v1 provenance to current v4 provenance.
- WBS `ANIM-BESPOKE-ROSTER` advanced to `3/119 SOURCE DONE · Wasp + Fox + Scorpion complete · Weasel next`.
- Verification: GitHub static/source readback only; Vitest/build/browser/device execution remains pending.


## 2026-09-23T07:14:00+07:00 — Five-state preview + Weasel Quick SOURCE DONE

- Library action preview now exposes only: Rảnh rỗi / Đánh / Kỹ năng / Chịu đòn / Di chuyển.
- Retired the separate combat-idle preview/runtime flag.
- Removed hit-impact from Library buttons; hit-impact remains internal contact FX only.
- VI idle label changed to Rảnh rỗi; Đánh remains the attack label.
- Rapper Chicken now uses one unified idle singing loop with its note flourish.
- Completed roster unit #4: weasel_quick / Chồn Nhanh.
- Weasel v4 owns articulated spine/head/jaw/shoulders/four paws, three tail segments, assassin blade, basic slash, three rapid skill slashes, dash ring and rage-return cue.
- weasel_quick.blurDash owns separate v4 provenance/controller.
- Added/updated targeted Weasel, Batch 1, ownership and Library preview regressions.
- WBS advanced to 4/119 SOURCE DONE; Jaguar is next.
- Verification remains GitHub static/source readback only.


## 2026-09-23T10:35:00+07:00 — Library animation pacing standardized to 5 seconds

- Slowed every timed Library action preview loop from sub-second values to exactly 5000 ms.
- Applies uniformly to Đánh / Kỹ năng / Chịu đòn / Di chuyển for every unit and skin using the shared Library portrait runtime.
- Rảnh rỗi remains a continuous idle loop rather than hard-resetting every 5 seconds.
- Internal hit-impact remains hidden from the Library action list and is not part of this preview timing contract.
- Added shared `LIBRARY_ACTION_LOOP_DURATION_MS = 5000` and regression assertions at 2.5s / 5s / 7.5s for every timed visible action.
- Updated master plan and WBS with the 5-second preview timing requirement.
- Verification: GitHub static/source readback only; runtime/browser/Vitest execution remains pending.


## 2026-09-23T10:35:30+07:00 — Jaguar Hunt SOURCE DONE under 5-second preview convention

- Completed roster unit #5: `jaguar_hunt` / Báo Đốm Săn.
- Jaguar base provenance is now `ForestThrone/custom/jaguar-hunt-microvoxel-v4`; `jaguar_hunt.forestProwl` uses `ForestThrone/skins/jaguar_hunt/forest-prowl-microvoxel-v4`.
- Kept the articulated spine/head/jaw/shoulder/four-paw/three-tail-segment rig and expanded the Blood Hunt fantasy.
- Visible Đánh remains a single basic claw/slash.
- `Săn Máu` now shows self-HP-cost, hunt mark, star-scaled 1/2/3 blood-slash sequence, heal-return feedback and the 3★ anti-heal mark.
- `hit-impact` remains internal combat FX and is not reintroduced into Library buttons.
- Added `tests/three/threeJaguarHuntVisual.test.ts`.
- All timed Library states continue to inherit the shared exact 5-second loop.
- WBS advanced to `5/119 SOURCE DONE · Jaguar complete · Komodo next`.
- Verification: GitHub static/source readback only; Vitest/build/browser/device execution remains pending.


## 2026-09-23T10:48:00+07:00 — Quadruped Move gait rear-limb fix

- Audited bespoke quadruped Move animation after owner noticed front-limb-only-looking motion.
- Strengthened visible rear/hind participation for `fox_flame`, `weasel_quick`, and `jaguar_hunt`.
- Fox rear legs now receive both stronger rotation and visible Y lift; reset now restores all four leg positions before subsequent actions.
- Weasel/Jaguar use stronger diagonal gait with rear-right paired to front-left and rear-left paired to front-right.
- Updated `ThreeConfiguredBespoke` so current/future ground and heavy configured units also give rear limbs stronger rotation + lift.
- Added `tests/three/threeQuadrupedMoveGait.test.ts` covering Fox, Weasel, Jaguar, Komodo and Tiger; regression requires visible front and rear movement and reset safety.
- Added a canonical rear/hind gait acceptance gate to animals README, master plan and WBS.
- Verification: GitHub static/source readback only; Vitest/browser execution remains pending.


## 2026-09-23T11:02:00+07:00 — Komodo Bite SOURCE DONE + README rule placement correction

- Per owner request, the rear/hind gait authoring rule is **not stored in `src/three/animals/README.md`**. The canonical rule remains in the master plan and WBS only.
- Completed roster unit #6: `komodo_bite` / Kỳ Đà Khổng Lồ.
- Upgraded provenance to `ForestThrone/custom/komodo-bite-microvoxel-v4`; `komodo_bite.venomSpine` now uses `ForestThrone/skins/komodo_bite/venom-spine-microvoxel-v4`.
- Added explicit `forked-tongue` anatomy alongside venom jaw, back spines and tail prop.
- Replaced the unit's generic configured animation with a Komodo-owned controller.
- Visible Đánh is a short bite; `Nọc Độc Kỳ Đà` owns a deeper jaw opening, tongue extension, poison projectile/aura and stronger star-scaled toxin/disease feedback.
- Move uses diagonal front/rear limb gait with visible hind-leg lift.
- Added `tests/runtime/komodoBiteVisual.test.ts` and updated configured-batch regression to require rear-limb participation.
- Timed Library actions continue to inherit the shared exact 5-second loop.
- WBS advanced to `6/119 SOURCE DONE · Komodo complete · Tiger next`.
- Verification: GitHub static/source readback only; Vitest/build/browser/device execution remains pending.


## 2026-09-23T13:10:00+07:00 — Fixed detached heads on configured/default roster units

- Root cause: `ThreeConfiguredBespoke` parents each generated/configured head under `<slug>-spine`, but the head was assigned root/world-like rest coordinates (`y=0.94/1.00, z=0.61`). The spine offset (`y=0.84, z=0.14`) was therefore added a second time, placing the head around world `y=1.78/1.84` and visibly separating it from the body.
- Scope: the configured registry currently contains 114 unit IDs, which explains why the defect appeared broadly on units that had not yet received individually authored rigs.
- Fixed the shared head rest pivot to spine-local coordinates: aquatic `(0, 0.10, 0.47)`, other configured units `(0, 0.16, 0.47)`. These resolve back to the intended world positions `y=0.94/1.00, z=0.61`.
- Updated reset logic to restore the corrected local pivot.
- Updated the dedicated Komodo controller from the old world-like head offsets to the corrected local offsets.
- Added `tests/runtime/configuredBespokeHeadAttachment.test.ts` across ground, aquatic, bird, serpent and dragon representatives, including reset safety.
- No gait/authoring rule was added to `src/three/animals/README.md`.
- Verification: GitHub static/source readback only; Vitest/browser execution remains pending.


## 2026-09-23T13:22:00+07:00 — Full-body factory architecture corrected

- Confirmed owner concern: many per-unit `Three*Rig.ts` files were only wrappers around the shared whole-animal `createConfiguredBespokeRig(...)`; audit found **100 such wrapper files**.
- This violated the intended ownership model because changing a spec still reused the same body/head/four-limb/tail composition and could make unrelated species resemble one another.
- Production `ThreeUnitModelFactory` is now dispatcher-only: it does not call `createConfiguredBespokeRig` or `createGeneratedUnitGeometry`.
- Unfinished units now resolve to `ThreeUnfinishedUnitVisual`, a neutral non-animal migration marker, so a pending wasp can no longer appear as a dog/quadruped.
- `ThreeConfiguredBespoke.ts` is explicitly quarantined as **LEGACY MIGRATION ONLY** and may not be used by production rendering.
- Shared `ThreeSharedAnimalParts.ts` is part-only: reusable limb/tail/eye/voxel helpers are allowed; whole-creature assembly is not.
- `komodo_bite` was refactored from the old whole-animal composer into a true unit-owned v5 rig that composes its own body, head, jaw, forked tongue, four limbs, tail, spines and skill FX.
- `ThreeUnitOwnedRigRegistry` currently admits Komodo as the first migrated entry on this path; legacy wrappers such as `tiger_fang`, `wasp_assassin`, `eagle_marksman`, `jellyfish_shock` remain non-production until individually rewritten.
- Added/retained `tests/runtime/unitCompositionOwnership.test.ts` as the architecture regression for dispatcher-only factory, part-only shared helpers, neutral unfinished visuals, and the “wasp must not look like dog” case.
- Removed the obsolete configured-head attachment regression because legacy configured rigs are no longer production-mounted.
- The earlier detached-head diagnosis remains useful for legacy source archaeology, but it is no longer the production fix: the production fix is to stop mounting those shared whole-animal wrappers at all.
- No architecture rule was added to `src/three/animals/README.md`.
- Verification: GitHub static/source readback only; Vitest/browser execution remains pending.


## 2026-09-23T15:53:00+07:00 — Tiger Fang unit-owned SOURCE DONE

- Completed roster unit #7: `tiger_fang` / Hổ Nanh under the corrected unit-owned composition architecture.
- Replaced the legacy `createConfiguredBespokeRig` wrapper with a complete composition owned by `src/three/animals/tiger-fang/ThreeTigerFangRig.ts`.
- Shared code is used only for reusable parts: `addSharedGroundLimb`, `addSharedSegmentedTail`, and `addSharedEyePair`. Tiger body/head/jaw/ears/shoulders/hips/fangs/stripes/ornaments are authored in the Tiger module.
- Base provenance: `ForestThrone/custom/tiger-fang-microvoxel-v5-unit-owned`.
- Sunstripe provenance: `ForestThrone/skins/tiger_fang/sunstripe-microvoxel-v5-unit-owned`.
- Added a Tiger-owned controller: Rảnh rỗi stalking watch, one-hit Đánh slash, column-shaped `Vuốt Hổ Xé Thịt`, internal bleed impact, Chịu đòn, and diagonal Move with visible rear-paw lift.
- Skill visuals preserve gameplay authority: the skill remains one vertical column; star progression strengthens bleed feedback rather than changing the target shape.
- Sunstripe now owns palette/silhouette ornaments/FX plus 2★ medallion and 3★ crown evolution.
- Added `tests/runtime/tigerFangVisual.test.ts`; updated ownership and migration-gate regressions so Tiger is production-admitted while unfinished wrappers remain neutral placeholders.
- Legacy whole-animal wrapper backlog decreases from the initial 100 to **99 remaining**.
- WBS advanced to `7/119 SOURCE DONE · Tiger complete · Triceratops next`.
- No architecture/gait rule was added to `src/three/animals/README.md`.
- Verification: GitHub static/source readback only; Vitest/build/browser/device execution remains pending.


## 2026-09-23T16:08:00+07:00 — Triceratops Charge unit-owned SOURCE DONE

- Completed roster unit #8: `triceratops_charge` / Bò Rừng Xung Phong.
- Replaced its legacy `createConfiguredBespokeRig` wrapper with a complete unit-owned composition in `ThreeTriceratopsChargeRig.ts`.
- Shared helpers are part-only: eye pair, four ground limbs and segmented tail. Broad body, neck, frill, three horns, shoulders/hips, hoof accents, skin ornaments and FX are authored by the Triceratops module.
- Base provenance: `ForestThrone/custom/triceratops-charge-microvoxel-v5-unit-owned`.
- Thorn Parade provenance: `ForestThrone/skins/triceratops_charge/thorn-parade-microvoxel-v5-unit-owned`.
- Added dedicated animation controller: relaxed heavy Rảnh rỗi, short Đánh ram, full `Sừng Ba Mũi` charge, internal pierce/armor-break impact, Chịu đòn and heavy diagonal Move with rear-hoof lift.
- Skill visuals follow live authority: one primary frontline target + up to one enemy directly behind; 2★ exposes armor break, 3★ strengthens its feedback.
- Thorn Parade owns parade sash/ribbon/banner progression instead of being a palette-only skin.
- Added `tests/runtime/triceratopsChargeVisual.test.ts`; updated ownership and configured-migration gates to admit Triceratops into production.
- Canonical migration status is now registry/source-gate based rather than relying on an approximate raw legacy-wrapper count.
- WBS advanced to `8/119 SOURCE DONE · Triceratops complete · Jellyfish next`.
- No architecture/gait rule was added to `src/three/animals/README.md`.
- Verification: GitHub static/source readback only; Vitest/build/browser/device execution remains pending.


## 2026-09-23T16:24:00+07:00 — Jellyfish Shock unit-owned SOURCE DONE

- Completed roster unit #9: `jellyfish_shock` / Sứa Điện.
- Replaced the legacy whole-animal wrapper with a complete unit-owned composition in `ThreeJellyfishShockRig.ts`.
- Sứa Điện now owns its actual aquatic anatomy: layered bell, electric core, two oral arms and five tentacles with three articulated segments each. Shared code is limited to the reusable eye-pair part helper.
- Base provenance: `ForestThrone/custom/jellyfish-shock-microvoxel-v5-unit-owned`.
- Reef Circuit provenance: `ForestThrone/skins/jellyfish_shock/reef-circuit-microvoxel-v5-unit-owned`.
- Added dedicated aquatic controller: buoyant Rảnh rỗi with bell pulse + tentacle lag, one-bolt Đánh, chain-lightning `Dòng Điện Tê Liệt`, internal electric impact, asymmetric Chịu đòn, and propulsion-driven Move.
- Skill visuals follow live authority:
  - 1★ chains 2 unique targets;
  - 2★ chains 3 targets and shows rage drain on the first 2;
  - 3★ drains all 3, marks silence on the last target and rebounds current back toward the first.
- Reef Circuit changes bell/cape/electric language and adds 2★ orbit plus 3★ crown/reactor geometry.
- Added `tests/runtime/jellyfishShockVisual.test.ts`; updated ownership/migration gates so Jellyfish is production-admitted rather than a neutral placeholder.
- Timed Library actions remain on the shared exact 5-second loop; internal hit-impact stays hidden from Library buttons.
- WBS advanced to `9/119 SOURCE DONE · Jellyfish complete · Newt next`.
- No architecture/gait rule was added to `src/three/animals/README.md`.
- Verification: GitHub static/source readback only; Vitest/build/browser/device execution remains pending.
## 2026-09-24T09:10:24.780Z

- forest-throne-v5-enhancement-master-plan.md created by plans-sync.

## 2026-09-24T16:27:08.089Z

- forest-throne-v5-enhancement-master-plan.md updated by plans-sync.

## 2026-09-24T16:36:33.462Z

- forest-throne-v5-enhancement-master-plan.md updated by plans-sync.

## 2026-09-25T07:20:00+07:00 — PHASE 2 COMPLETED: loại bỏ tiền tố `Three*`

- Rename 110 file `src/three/Three*.ts` → tên canonical (`ThreeApp.ts` → `App.ts`, `ThreeRoundScene.ts` → `RoundScene.ts`, `ThreeSoundEffects.ts` → `SoundEffects.ts`, animals `Three<X>Rig/Animation.ts` → `<X>Rig/Animation.ts`, …); cập nhật 210 file import/type (src + tests) và 4 file test khác.
- `vitest.config.ts`: resolver `fix-relative-src-imports` không còn trả fs path cho id đã resolve / có `?raw`/`?url` (trước đây làm hỏng id của Vite và bỏ mất query).
- Done Criteria §2.3 đạt: `tsc --noEmit` = 0, `pnpm build` = 0, targeted suite 33/33 passed, manifest inventory/census tái sinh không đổi.
- Wave 2.1 (tách `src/three/` thành engine/scenes/board/units/ui/audio) hoãn vô thời hạn: ngoài phạm vi Done Criteria, blast radius entry/vite/tsconfig/test globs.

## 2026-10-04T16:39:00+07:00 — WBS-027 non-visual staging contract

- Added renderer-neutral A56 game-speed scaling and A119 basic melee staging metadata without changing synchronous combat simulation.
- `MELEE_FRONT` and `ASSASSIN_BACK` use the canonical 140/35/45/140 ms phases; damage-bearing basic events are marked at semantic impact only.
- Assassin staging is metadata-only and does not mutate canonical fighter or placement coordinates.
- Visual movement, VFX, animation playback, and rendering consumers remain intentionally out of scope.
- Verification: `corepack pnpm typecheck`; `corepack pnpm exec vitest --run tests/combat-staging.test.ts tests/combat.test.ts` (12/12); Vite SSR smoke for impact/total timing and 6x display multiplier.
