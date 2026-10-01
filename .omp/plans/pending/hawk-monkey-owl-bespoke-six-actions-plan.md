# Hawk / Monkey / Owl Bespoke Five-State Preview + Internal Impact Plan

Status: PENDING IMPLEMENTATION  
Branch: `dev`  
WBS links: `POLY-3D-SKIN-01`, `ANIM-BESPOKE-02`  
Created: 2026-09-22 21:02 +07:00

## 0. Execution order

1. `hawk_hunter` — cubic/micro-voxel pass first, then 6 actions, then `ridgeHunter` skin.
2. `monkey_spear` — cubic/micro-voxel pass first, then 6 actions, then `spikeBanana` skin.
3. `owl_nightshot` — cubic/micro-voxel pass first, then 6 actions, then `nightGlint` skin.

No unit may start the six-action pass until its cubic prerequisite is SOURCE DONE.

## 1. Shared non-negotiable rules

### 1.1 Cubic density / visible detail

- Target approximately **4× authored cubic density** versus the current bespoke geometry.
- Follow the corrected Sleepy Hen Girl v7 lesson: subdivision alone is not accepted.
- New cubic count must come from **visible authored geometry**:
  - raised feather/fur/cloth/weapon edges;
  - layered silhouettes;
  - small visible trim, seams, crest, talon, eye, face and prop details;
  - skin-specific ornaments which physically alter the external read.
- Do not inflate the overall model scale just to make details easier to see.
- Preserve board footprint, owner-facing convention, combat anchor and library camera compatibility.
- Each base/skin variant needs:
  - explicit `sourceAsset`;
  - explicit `visualRevision`;
  - detail-count/provenance metadata;
  - regression assertions for visible authored detail.

### 1.2 Animation ownership

Unit-specific implementation belongs under:

```
src/three/animals/hawk-hunter/
src/three/animals/monkey-spear/
src/three/animals/owl-nightshot/
```

Expected minimum files per unit:

```
Three<Unit>Rig.ts
Three<Unit>Animation.ts
Three<Unit>Skin.ts       // when skin geometry differs from base
```

Shared systems may only attach/dispatch through `ThreeUnitAnimationController`.
`ThreeUnitFactory`, combat runtime and Library portrait must not contain Hawk/Monkey/Owl pose math.

### 1.3 Five visible preview states + internal impact FX

Each unit must expose five visually distinct Library states:

1. Rảnh rỗi (internal key: `idle`)
2. Đánh (`attack`)
3. Kỹ năng (`skill`)
4. Chịu đòn (`take-hit`)
5. Di chuyển (`move`)

`hit-impact` remains an internal contact-FX hook for combat/regression only and is not a Library action button. `combat-idle` is retired.

Attack vs Skill must differ in pose, timing and FX ownership, not merely amplitude.

---

# 2. Diều Hâu Săn — `hawk_hunter`

Authored skill authority: **Tầm Nhiệt / Heat Seek**.  
Gameplay identity: ranged hunter, lowest-HP execution, later-star backline/carry preference.

Skin in current catalog:
- `hawk_hunter.ridgeHunter`
- VI: Săn Núi → Diều Săn → Thiên Điêu Săn Vương
- Theme: mountain hunter, green strap, gold/cream ornaments.

## 2.1 Cubic prerequisite

### Base Hawk
Increase visible geometry around:
- layered primary/secondary wing feathers;
- chest feather rows;
- segmented tail fan;
- separate upper/lower beak blocks;
- brow ridge + eye socket;
- talon/toe geometry;
- neck feather transition;
- shoulder/wing root articulation.

Required articulated nodes:
- body;
- head;
- left wing;
- right wing;
- tail;
- left/right talon;
- optional heat-lock FX pivot.

### Ridge Hunter skin
Do not make it only a recolor. Add:
- raised hunter strap across chest;
- real cubic buckle;
- ridge headband/visor at 2★;
- 3★ banner/charm;
- slightly more angular wing-tip feather silhouette;
- gold/cream projectile accent.

Suggested provenance:
- base: `ForestThrone/custom/hawk-hunter-microvoxel-v3`
- skin: `ForestThrone/skins/hawk_hunter/ridge-hunter-microvoxel-v3`

## 2.2 Six actions

### HAWK-A1 — Idle: Predator scan
- Hover/perch read with asymmetric wing breathing.
- Head turns left → center → right independently from torso.
- Small tail counter-sway.
- Periodic downward scan pose.
- 3★ may flash eye/crest once per long idle cycle.

Acceptance:
- head rotation visibly independent;
- wings are not synchronous mirror-bobs;
- no whole-root generic sine bob as the only motion.

### HAWK-A2 — Attack: Feather dart
- Pull shooting-side wing backward.
- Opposite wing stabilizes.
- Torso twists slightly.
- Release a short feather/bolt visual.
- Shooting wing snaps forward and settles.

Acceptance:
- attack is readable with projectile hidden;
- wing articulation visibly owns recoil.

### HAWK-A3 — Skill: Heat Seek
- Both wings spread wide.
- Torso rises.
- Head locks toward target.
- 3D target-lock / heat ring contracts.
- Eyes brighten.
- Launch a longer, brighter execute feather.
- 2★/3★ may add second lock-ring phase without changing gameplay timing.

Acceptance:
- completely different anticipation silhouette from Attack;
- heat-lock FX is unit-owned and deterministic.

### HAWK-A4 — Hit / Impact: Execute strike
- Feather impact creates compact voxel feather burst.
- Small shock ring.
- Skill impact may add a fast X-shaped slash/heat-flash.
- Effect must be short enough not to hide HP/status UI.

### HAWK-A5 — Take Hit: Wing guard
- One wing folds over head/chest.
- Torso banks away from source direction.
- Brief altitude loss.
- Recovery flap returns to neutral.

Acceptance:
- must not be only root shake/scale squash.

### HAWK-A6 — Move: Flap → glide → bank
- Two strong wing beats.
- Glide segment with wings extended.
- Tail steers.
- Head turns into direction before body finishes banking.

Acceptance:
- clear travel gait distinct from Idle hover.

---

# 3. Khỉ Lao Cành — `monkey_spear`

Authored skill authority: **Ném Đá / rock_throw_stun**.  
Gameplay identity: agile thrower/disruptor with stun/rage/offense disruption and splash growth.

Skin in current catalog:
- `monkey_spear.spikeBanana`
- VI: Chuối Gươm → Khỉ Giáo → 🍌 Vương Giáo
- Theme: brown/gold banana-warrior treatment.

## 3.1 Cubic prerequisite

### Base Monkey
Increase visible geometry around:
- segmented muzzle/cheeks;
- separate brow/ears;
- fingers/gripping hand blocks;
- forearm/upper-arm articulation;
- thigh/shin/foot segmentation;
- segmented curled tail;
- spear shaft wrapping/grip;
- spearhead facets;
- belt/mantle/charm details;
- throwable rock prop with visible facets.

Required articulated nodes:
- torso;
- head;
- left/right arm;
- left/right leg;
- tail chain or 3–5 tail segments;
- spear pivot;
- rock/projectile pivot.

### Spike Banana skin
Must visibly alter:
- spearhead into banana/spike weapon silhouette;
- brown/gold armor plate;
- 2★ ribbon/charm;
- 3★ crown/banner;
- projectile rock may gain gold/banana rune accents.

Suggested provenance:
- base: `ForestThrone/custom/monkey-spear-microvoxel-v3`
- skin: `ForestThrone/skins/monkey_spear/spike-banana-microvoxel-v3`

## 3.2 Six actions

### MONKEY-A1 — Idle: Trickster balance
- Low crouch.
- One hand rests on spear.
- Free hand tosses/catches a small pebble occasionally.
- Tail continuously counter-balances.
- Small head scratch/look-around variation may be deterministic by idle cycle.

Acceptance:
- tail and free hand have independent motion tracks.

### MONKEY-A2 — Attack: Pole-vault pebble shot
- Spear plants into ground.
- Monkey pivots around spear.
- Free hand throws a small rock in an arc.
- Feet tuck slightly during pivot.
- Lands into crouch.

Acceptance:
- spear is a movement/pose prop, not the attack projectile.

### MONKEY-A3 — Skill: Heavy boulder throw
- Spear gets planted aside.
- Both hands lift a much larger boulder.
- Body compresses under weight.
- One backward step.
- Hip/shoulder rotation.
- Overhead throw with high arc.
- 3★ can shed small fragments behind projectile.

Acceptance:
- silhouette and timing materially differ from normal Attack.

### MONKEY-A4 — Hit / Impact: Rock burst
- Large boulder impact produces voxel debris and dust ring.
- If visualizing stun preview: square/cartoon star voxels rotate briefly over impact.
- Splash preview throws smaller chunks sideways.

### MONKEY-A5 — Take Hit: Spear brace
- Spear shaft rotates across body to block.
- Rear foot slides.
- Torso compresses.
- Tail snaps upward.
- Hand shake/recovery before neutral.

Acceptance:
- damage reaction visibly uses spear and tail.

### MONKEY-A6 — Move: Spear-vault run
- Two short running steps.
- Spear plants.
- Small forward vault.
- Feet land before tail finishes swing.
- Repeat loop seamlessly.

Acceptance:
- locomotion is not ordinary humanoid bob.

---

# 4. Cú Bắn Đêm — `owl_nightshot`

Existing visual authority already communicates purple moon projectile + sleep `Zz`.  
Gameplay identity: silent ranged sleep/night sniper.

Skin in current catalog:
- `owl_nightshot.nightGlint`
- VI: Lóe Đêm → Cú Vịng Đêm → Huyền Dạ Vương
- Theme: dark blue cape, silver/blue gem, moon glow.

## 4.1 Cubic prerequisite

### Base Owl
Increase visible geometry around:
- layered left/right wing feather fans;
- separate facial disc blocks;
- brow/ear tufts;
- beak facets;
- chest/belly feather rows;
- tail fan;
- talons;
- moon badge/crest;
- eye emissive socket geometry.

Required articulated nodes:
- body;
- head;
- left/right wing;
- tail;
- left/right talon;
- moon crest;
- projectile pivot.

### Night Glint skin
Must visibly add:
- cubic cape split left/right;
- real clasp/gem;
- 2★ head band/moon band;
- 3★ crown/moon core;
- cold blue/silver projectile accents;
- additional constellation micro-voxels kept sparse.

Suggested provenance:
- base: `ForestThrone/custom/owl-nightshot-microvoxel-v3`
- skin: `ForestThrone/skins/owl_nightshot/night-glint-microvoxel-v3`

## 4.2 Six actions

### OWL-A1 — Idle: Silent sentinel
- Near-static hover.
- Very small asymmetric wing corrections.
- Head rotates far left/right independently.
- Eyes blink at staggered moments.
- Moon crest pulses slowly.

Acceptance:
- body remains calm while head does most personality work.

### OWL-A2 — Attack: Moon-feather shot
- One wing shields/compresses body.
- Opposite wing opens like drawing a bow.
- Projectile forms between wings.
- Release with minimal recoil.
- Head tracks target through release.

Acceptance:
- attack reads as precise/sniper-like, not generic wing flap.

### OWL-A3 — Skill: Sleep crescent
- Both wings close in front.
- Body/eyes dim briefly.
- Wings open sharply.
- Large crescent appears behind/above body.
- Sleep bolt launches from crescent.
- Owl closes eyes for one beat after cast.

Acceptance:
- clear closed-wing anticipation + crescent reveal.

### OWL-A4 — Hit / Impact: Lunar sleep bloom
- Purple lunar ring expands.
- Small crescent/constellation voxels burst.
- 3D `Zz` rises and fades.
- Multi-target preview offsets each impact slightly in time.

### OWL-A5 — Take Hit: Drop and recover
- Wings droop.
- Head tilts sharply.
- Owl drops vertically a short distance.
- One forceful flap restores altitude.
- Eye glow temporarily dims then returns.

### OWL-A6 — Move: Silent glide
- Strong flap only on start.
- Long glide with nearly fixed wings.
- Head turns toward destination first.
- Body banks afterward.
- One braking flap on arrival.

Acceptance:
- glide clearly differs from Idle hover.

---

# 5. Skin/debug requirements

Current QA rule remains:
- `DEBUG_UNLOCK_ALL_SKINS = true` while this visual pass is active.
- Base and achievement skins must all be directly selectable in Library.
- Selecting a skin must immediately update:
  - model geometry;
  - provenance;
  - star ornament;
  - animation controller where skin-specific behavior differs;
  - projectile/impact FX where authored.

Do not remove progression metadata; only bypass the unlock check through the centralized debug switch.

# 6. Test plan

Per unit:
- rig has all expected articulated named parts;
- 1★/2★/3★ geometry/provenance revisions resolve correctly;
- base and named skin are visually different at geometry/spec level;
- cubic/detail metadata confirms the new authored-detail pass;
- each required action returns handled=true;
- each action changes its intended named nodes;
- Attack and Skill produce different pose signatures;
- Take Hit does not use generic fallback;
- Move loop changes limbs/wing/tail according to species;
- shared runtime source-guard contains no unit-specific pose imports.

Library:
- all three achievement skins selectable under debug unlock;
- action tab loops all six actions;
- fullscreen 360/pinch viewer continues to work for new articulated rigs.

Combat:
- root owner-facing behavior remains correct;
- action reset restores exact neutral pose;
- no stale projectile/impact mesh remains after action completion/reset.

# 7. Completion checklist

## Hawk
- [x] HAWK-CUBIC base micro-voxel pass
- [x] HAWK-SKIN-CUBIC Ridge Hunter pass
- [x] HAWK-A1 Idle
- [x] HAWK-A2 Attack
- [x] HAWK-A3 Skill
- [x] HAWK-A4 Hit / Impact
- [x] HAWK-A5 Take Hit
- [x] HAWK-A6 Move
- [x] HAWK-TEST static regression
- [ ] HAWK-RUNTIME browser/device smoke

## Monkey
- [x] MONKEY-CUBIC base micro-voxel pass
- [x] MONKEY-SKIN-CUBIC Spike Banana pass
- [x] MONKEY-A1 Idle
- [x] MONKEY-A2 Attack
- [x] MONKEY-A3 Skill
- [x] MONKEY-A4 Hit / Impact
- [x] MONKEY-A5 Take Hit
- [x] MONKEY-A6 Move
- [x] MONKEY-TEST static regression
- [ ] MONKEY-RUNTIME browser/device smoke

## Owl
- [x] OWL-CUBIC base micro-voxel pass
- [x] OWL-SKIN-CUBIC Night Glint pass
- [x] OWL-A1 Idle
- [x] OWL-A2 Attack
- [x] OWL-A3 Skill
- [x] OWL-A4 Hit / Impact
- [x] OWL-A5 Take Hit
- [x] OWL-A6 Move
- [x] OWL-TEST static regression
- [ ] OWL-RUNTIME browser/device smoke

## Exit
- [x] All 3 base models meet visible cubic/micro-detail prerequisite.
- [x] All 3 named skins visibly alter geometry, not only palette.
- [x] 15/15 visible-state implementations SOURCE DONE; internal impact FX also authored.
- [x] Animation ownership source guard clean.
- [x] Library skin/action/fullscreen preview static regression complete.
- [ ] Runtime/browser/device evidence recorded before moving WBS rows to completed.


## Source implementation update — 2026-09-22

- Hawk / Monkey / Owl articulated micro-voxel v3 rigs are now wired into `ThreeUnitModelFactory`.
- Base + named skin provenance:
  - Hawk: `ForestThrone/custom/hawk-hunter-microvoxel-v3` / `ForestThrone/skins/hawk_hunter/ridge-hunter-microvoxel-v3`
  - Monkey: `ForestThrone/custom/monkey-spear-microvoxel-v3` / `ForestThrone/skins/monkey_spear/spike-banana-microvoxel-v3`
  - Owl: `ForestThrone/custom/owl-nightshot-microvoxel-v3` / `ForestThrone/skins/owl_nightshot/night-glint-microvoxel-v3`
- Library preview now follows the owner-updated five-state convention: Rảnh rỗi / Đánh / Kỹ năng / Chịu đòn / Di chuyển. `combat-idle` is retired and `hit-impact` remains internal combat/contact FX only.
- Static/source regression added in `tests/three/threeNextBespokeTrio.test.ts`.
- Runtime/browser/device checkboxes intentionally remain open.

### Source exit verification — 2026-09-22 21:36 +07:00

- GitHub readback confirms Hawk / Monkey / Owl factory branches use articulated micro-voxel rigs and `cubicDensityMultiplier === 4`.
- Named skins resolve different `sourceAsset` + `visualAnimationControllerId` values and skin-specific flags.
- `tests/three/threeNextBespokeTrio.test.ts` authors coverage for all five timed actions plus idle ownership, Attack-vs-Skill signature difference and temporary effect visibility.
- `tests/three/threeLibraryCollection.test.ts` covers the five visible preview buttons, Vietnamese `Rảnh rỗi` / `Đánh` labels, infinite action looping, and fullscreen wheel/pinch viewer behavior.
- This is source/static readback only. Vitest/browser/device execution was not available in this connector session, so all three `*-RUNTIME` rows and final runtime evidence remain open.
