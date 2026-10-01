# Unit Solid-Surface Integrity / No-Xray Plan

Date: 2026-09-20  
Branch: `feature/threejs-migration`  
Status: **SOURCE IMPLEMENTED — runtime/browser verification still pending**  
Scope: Three.js production unit geometry only. Never modify `old_src/`.

## Why this plan exists

The current runtime screenshot still shows animal bodies that appear hollow / see-through even though `ThreeUnitModelFactory.ts` creates the production body material as opaque, depth-tested, depth-writing and `THREE.FrontSide`.

The current live source audit found three separate integrity gaps:

1. `ThreeGeneratedUnitRoster.ts::pushCuboid` and `ThreeChickenRapperGeometry.ts::pushCuboid` already reverse their local face order to outward winding.
2. `VoxelSpiderGeometry.ts::addBox` still uses the older face order with `indices.push(a,b,c,a,c,d)`; for the shared cube corner layout this is the inward order and is not covered by the existing generated-cuboid test.
3. The remaining packed bespoke models (`HawkHunter`, `MonkeySpear`, `OwlNightshot`, `WaspSting`, `FoxFlame`, `ScorpionShadow`, `WeaselQuick`, `JaguarHunt`) are decoded directly in `ThreeUnitModelFactory.ts` with no post-decode winding/topology audit. Existing tests check vertex/index counts and opacity, not triangle orientation.
4. Generated animals are compositions of many cuboids. Even with correct outer winding, every intersecting/hidden cuboid face is still emitted. Gaps and partially exposed internal faces can visually read as "x-ray" when the camera sees into the assembly.

The repair therefore must normalize **geometry construction + packed geometry integrity + hidden/internal faces + runtime material invariants**, not just toggle `DoubleSide`.

---

## XRAY-1 — One canonical outward cuboid builder

- **Source symbol:** `src/three/ThreeGeneratedUnitRoster.ts::pushCuboid`, `src/three/animals/ThreeChickenRapperGeometry.ts::pushCuboid`, `src/three/animals/VoxelSpiderGeometry.ts::addBox`; new `src/three/ThreeVoxelCuboidBuilder.ts`.
- **Migration method:** create one project-owned cuboid utility containing the canonical corner table, face definitions, transform logic and outward triangle winding. Migrate Generated roster, Chicken v2 and Spider to this utility and delete their duplicated face/index implementations.
- **Allowed:** shared typed `appendCuboidFaces()` / `buildCuboidGeometry()`, per-cuboid rotation, vertex-color output, optional part metadata.
- **Forbidden:** `THREE.DoubleSide` on unit bodies, maintaining three independent `FACE_CORNERS` copies, special-casing a single camera angle, reversing normals without reversing indices.
- **Targeted Vitest:** new `tests/three/threeVoxelCuboidBuilder.test.ts` checks all 6 faces for axis-aligned and rotated cuboids; each triangle normal must point away from the cuboid center and indices must be finite/non-degenerate.
- **Runtime evidence:** Chicken, Spider and one generated quadruped remain solid when camera views front/back/left/right/top at Planning zoom.
- **Done criterion:** unit source tree has exactly one canonical cuboid face-order implementation; Chicken/Spider/generated builders import it.

## XRAY-2 — Fix Spider's unresolved inward winding

- **Source symbol:** `src/three/animals/VoxelSpiderGeometry.ts::addBox`.
- **Migration method:** migrate all Spider boxes/legs/face blocks to the shared outward builder from XRAY-1. Preserve current silhouette, colors, `Math.PI` model-space facing correction and 8-leg layout.
- **Allowed:** geometry rebuild with identical dimensions/placements, updated vertex/index counts only if the shared builder requires it.
- **Forbidden:** changing Spider to `DoubleSide`, deleting legs, hiding the issue by making material emissive/transparent.
- **Targeted Vitest:** `threeUnitModelFactory.test.ts` / builder test audits every Spider cuboid face, not only overall material state; require `geometry.userData.faceWinding="outward"`.
- **Runtime evidence:** Spider abdomen/head/legs do not disappear or expose reverse surfaces when camera circles behind it.
- **Done criterion:** no old `indices.push(start+a,start+b,start+c,...)` inward implementation remains in `VoxelSpiderGeometry.ts`.

## XRAY-3 — Audit and normalize all 8 packed bespoke models

- **Source symbol:** `src/three/ThreeUnitModelFactory.ts::getUnitModelGeometry` packed decode branch; `src/three/animals/VoxelPrototypeAnimalsData.ts`; new `src/three/ThreeUnitGeometryIntegrity.ts`.
- **Migration method:** add a deterministic geometry audit immediately after packed decode. Record finite positions/indices, degenerate triangle count, signed-volume/winding evidence and surface-integrity result. If a packed payload is consistently inverted, repair/repack it to canonical outward winding. If a payload has mixed winding or malformed topology, regenerate that packed payload from its project-owned source instead of applying a blind runtime flip.
- **Allowed:** offline/source-level repack, explicit integrity metadata, signed-volume/component diagnostics, corrected triangle index order.
- **Forbidden:** blindly flipping every packed model without first classifying it; mutating cached shared geometry every render; `DoubleSide` fallback; changing gameplay dimensions just to pass audit.
- **Targeted Vitest:** enumerate all 8 packed model keys and assert `orientation="outward"`, zero invalid/degenerate triangles, finite bounds, and front/back ray hits under `THREE.FrontSide`.
- **Runtime evidence:** Hawk/Monkey/Owl/Wasp/Fox/Scorpion/Weasel/Jaguar all render solid from the same camera sweep used for generated units.
- **Done criterion:** every packed geometry has explicit integrity metadata and no packed unit reaches runtime with `orientation="unknown"` or `inward`.

## XRAY-4 — Remove hidden/interior cuboid faces from generated assemblies

- **Source symbol:** `src/three/ThreeGeneratedUnitRoster.ts::buildGeometry`, family builders that emit `CuboidSpec[]`; shared cuboid builder from XRAY-1.
- **Migration method:** before emitting each cuboid face, classify whether that face is externally visible. Skip a face when its center/sample points are fully contained by another solid cuboid/OBB or exactly coplanar and covered. Keep partially visible faces. Store `emittedFaceCount` / `culledInteriorFaceCount` in geometry metadata.
- **Allowed:** OBB/local-space point containment, small epsilon for touching faces, source-level face culling, conservative "keep face" on ambiguous cases.
- **Forbidden:** deleting whole cuboids, alpha tricks, depth hacks, culling based only on camera position, removing faces merely because two bounding boxes overlap.
- **Targeted Vitest:** synthetic two-box overlaps/touching boxes plus representative live models; fully hidden shared/interior faces are removed while exterior faces remain. Assert generated models still have non-zero surface and valid bounds.
- **Runtime evidence:** torso/head/neck/limb seams no longer expose internal planes through gaps at the reported 3/4 camera angle.
- **Done criterion:** generated geometry reports interior-face culling metadata and no known screenshot reproduction shows exposed hidden faces.

## XRAY-5 — Enforce body material invariants through avatar cloning

- **Source symbol:** `src/three/ThreeUnitModelFactory.ts::createUnitModel`; `src/three/ThreeUnitAvatarRenderer.ts::setModelVisibility`.
- **Migration method:** keep the canonical unit body material `transparent=false`, `opacity=1`, `depthWrite=true`, `depthTest=true`, `side=THREE.FrontSide`. When avatar visibility clones a material for a unit model, explicitly preserve/reset `side=THREE.FrontSide` in the force-opaque branch. Water puddles/VFX may remain transparent/DoubleSide because they are not unit body meshes.
- **Allowed:** explicit body-material invariant helper; transparent overlay/VFX exceptions by mesh role/name.
- **Forbidden:** applying body rules to puddles/rings/status sprites; setting unit body `DoubleSide`; `depthWrite=false` for animal body meshes.
- **Targeted Vitest:** create a model, pass through avatar visibility cloning, then traverse body meshes and assert all five invariants. Verify `unit-water-puddle*` remains an allowed transparent exception.
- **Runtime evidence:** changing visibility/star/collection state never turns a solid animal translucent.
- **Done criterion:** body material invariants survive both direct factory creation and avatar clone path.

## XRAY-6 — Full-roster integrity gate, not a one-cuboid sample

- **Source symbol:** `tests/three/threeGeneratedUnitRender.test.ts`, `tests/three/threeUnitModelFactory.test.ts`; new integrity helper from XRAY-3.
- **Migration method:** replace the current "first generated cuboid only" confidence signal with a roster-wide static gate:
  - 124/124 live IDs resolve;
  - generated + bespoke geometry positions/indices are finite;
  - no degenerate triangles;
  - geometry orientation is outward or source-audited;
  - unit body material is opaque/depth-writing/FrontSide;
  - representative ray sweeps from front/back/left/right/top hit an exterior surface;
  - hidden-face culling metadata exists for generated assemblies.
- **Allowed:** family-stratified samples for expensive ray tests, while lightweight geometry integrity runs over all 124.
- **Forbidden:** declaring PASS because only `tiger_fang`'s first cuboid passes; browser screenshot alone without source assertions.
- **Targeted Vitest:** `threeUnitModelFactory.test.ts`, `threeGeneratedUnitRender.test.ts`, new cuboid/integrity tests.
- **Runtime evidence:** smoke matrix includes at least one generated model per species family plus all 10 bespoke models, camera rotated through multiple sides.
- **Done criterion:** no live unit has unknown/inward winding, malformed triangles, translucent body material, or screenshot-reproducible x-ray holes.

---

## Implementation order

1. XRAY-1 shared outward builder.
2. XRAY-2 Spider migration immediately, because live source currently still shows the old inward order.
3. XRAY-3 packed bespoke audit/repair.
4. XRAY-4 generated interior-face culling.
5. XRAY-5 avatar material invariant.
6. XRAY-6 roster-wide tests + browser smoke evidence.

## Static gates

- `old_src/` touched files = 0.
- New direct `phaser` imports under `src/three/**` = 0.
- New explicit `any`, `@ts-ignore`, `@ts-expect-error`, `eslint-disable` under touched Three files = 0.
- Keep `THREE.FrontSide` for unit body meshes.
- `THREE.DoubleSide` is allowed only for planar effects such as water puddles, rings, VFX, hit areas and sprites—not animal bodies.
- Do not claim Vitest/build/browser PASS unless those commands are actually executed.

## Current evidence / reopening note

The previous no-xray cleanup pass (retained in Git history) marked source winding as implemented after generated-roster repair. The newer runtime screenshot is evidence that the defect class is not closed across all model sources. This plan is now the sole active no-xray authority until XRAY-1..6 are complete.


## Implementation status — SOURCE IMPLEMENTED

- **XRAY-1:** complete. `ThreeVoxelCuboidBuilder.ts` is now the single canonical cuboid face-order authority used by Generated roster, Chicken v2 and Spider.
- **XRAY-2:** complete. `VoxelSpiderGeometry.ts` no longer owns the legacy inward `indices.push(...)` implementation and now emits canonical outward faces.
- **XRAY-3:** complete at source/runtime-load level. `ThreeUnitGeometryIntegrity.ts::normalizePackedCuboidSoupWinding` audits each 24-vertex/36-index packed cuboid chunk and flips only triangles whose normal points toward that cuboid's center; the packed decode branch stores integrity metadata after normalization.
- **XRAY-4:** complete. Generated/Chicken/Spider cuboid assemblies use conservative fully-covered-face culling and expose `emittedFaceCount` / `culledInteriorFaceCount` metadata.
- **XRAY-5:** complete. Unit body meshes carry `unitBodyMesh=true`; both direct creation and avatar visibility cloning enforce opaque, depth-tested, depth-writing `THREE.FrontSide`. Puddles/planar effects keep their explicit transparent/DoubleSide exception.
- **XRAY-6:** complete at source-test level. Tests now cover the canonical builder, overlap culling, packed winding repair, all 124 live geometry/material audits, all 10 bespoke models, and a multi-direction FrontSide ray sweep across all 10 bespoke plus representative generated families. The final ray-sweep regression was added in commit `82c5dd01`.

### Static readback

- Canonical builder wired into Generated + Chicken + Spider: ✅
- Legacy Spider inward index implementation present: **no**
- Packed post-decode winding normalization: ✅
- Generated interior-face culling: ✅
- Body material invariant through avatar clone path: ✅
- Full-roster 124 geometry/material audit test: ✅
- Multi-direction FrontSide ray sweep test: ✅
- New direct Phaser import under touched `src/three/**`: **0**
- New explicit `any` / suppression under touched Three files: **0**
- `old_src/` touched: **0**

**Verification limit:** Vitest/build/browser/device execution was not run in this connector session, so runtime PASS is not claimed. The original screenshot defect should be re-smoked in-browser before closing the visual issue.

## Audit 2026-09-22 20:58 +07:00

- Current HEAD readback: XRAY-1..6 source implementation remains present; no plan checkbox is open.
- Canonical cuboid winding/culling/material ownership remains source-side complete.
- **Still pending before archival:** browser/runtime x-ray inspection on the post-cleanup commit across bespoke and generated families; source tests from older commits are historical until rerun.
