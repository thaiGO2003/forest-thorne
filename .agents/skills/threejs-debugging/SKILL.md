---
name: threejs-debugging
description: Diagnose Three.js rendering, transform, camera, depth, material, shadow, interaction, and performance defects. Use when objects disappear, look x-rayed, clip, flicker, render black, have wrong scale/origin, leave ghosts, show z-fighting, or behave differently across scenes/devices.
---

# Debugging Three.js

Debug from ownership and transforms outward; avoid random visual tweaks.

## Triage order

1. Reproduce on the smallest scene/state.
2. Inspect object visibility, parent chain, layers, position/scale/quaternion, matrix updates.
3. Inspect camera frustum/near/far and object bounds.
4. Inspect geometry winding/normals/material side.
5. Inspect depthTest/depthWrite/transparency/renderOrder for overlap bugs.
6. Inspect lighting/tone/color space if geometry exists but looks wrong.
7. Inspect renderer/composer state if the defect spans the whole viewport.
8. Inspect lifecycle if ghosts/duplicate updates appear after transitions.

## Useful helpers

Use `Box3`, `Box3Helper`, `AxesHelper`, light/camera helpers, `renderer.info`, temporary wireframe/basic materials, and targeted raycasts. Remove debug helpers before production unless they are behind an explicit debug flag.

## Forest Throne patterns

- X-ray/see-through unit: verify actual closed geometry before using DoubleSide.
- Red/blue circle residue: search production overlay/highlight ownership, not just materials.
- Planning ghost after combat: inspect scene transition teardown and stale scene groups.
- Model head/feet outside preview: inspect model bounds/centering and camera fit, not arbitrary CSS clipping.

Turn every confirmed defect into a regression test when practical.
