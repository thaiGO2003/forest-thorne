---
name: threejs-raycasting-input
description: Implement Three.js pointer/mouse/touch input and Raycaster picking. Use for board tile selection, unit hit testing, hover/press interactions, modal 3D viewers, pointer normalization, or click-vs-drag discrimination.
---

# Raycasting and Input

Use pointer events as the common mouse/touch path.

## Pointer to NDC

Compute normalized device coordinates from the renderer canvas bounding rect, not the full window:

```ts
const rect = canvas.getBoundingClientRect();
ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
raycaster.setFromCamera(ndc, camera);
```

## Picking rules

- Intersect the smallest meaningful pick set instead of the entire scene.
- Use object metadata/userData only as a lookup key; keep gameplay ownership in domain state.
- For board coordinates, route through existing helpers such as `raycastBoardTile` rather than re-deriving tile math.
- Separate pointer-down target from pointer-up target and apply a movement threshold to distinguish click from drag.
- Clean up every listener on scene/modal teardown.

## Layering

When world input competes with DOM UI, let DOM controls consume their events and do not cast through modal overlays. Use pointer capture for gestures that must continue outside the starting element.

## Test

Cover canvas offsets, high DPR, portrait layout, recursive vs non-recursive intersections, locked/hidden objects, and pointer cancellation.
