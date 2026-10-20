---
name: threejs-lighting-shadows
description: Configure and optimize Three.js lighting and shadows. Use for Ambient/Hemisphere/Directional lights, shadow acne/peter-panning, shadow camera bounds, PCF shadows, scene mood, or mobile shadow performance.
---

# Lighting and Shadows

Use a small intentional light rig. More lights are not automatically better.

## Workflow

1. Establish ambient/hemisphere fill.
2. Add one primary directional/key light for form and shadows.
3. Fit the directional shadow camera to the actually visible play area.
4. Enable `castShadow`/`receiveShadow` only for meshes that need it.
5. Measure before increasing shadow map resolution.

## Shadow debugging

- Acne: inspect `bias`/`normalBias`, normals, and near/far precision.
- Detached shadows: reduce excessive bias and verify world scale.
- Missing shadows: check renderer shadowMap, light castShadow, mesh flags, and shadow-camera bounds.
- Blocky shadows: map resolution may be too low, but first shrink the covered world area.

## Performance

Shadow-casting lights render additional scene passes. Avoid multiple dynamic shadow lights on mobile. Static decorative props should not all cast shadows by default.

## Forest Throne

Preserve readable board/unit silhouettes over physically perfect lighting. When changing board scale or camera profiles, re-evaluate directional-light shadow extents so COOP/large boards are not clipped.
