---
name: threejs-camera-controls
description: Implement or debug Three.js PerspectiveCamera, OrbitControls, RTS/isometric framing, zoom, pan, 360 portrait viewers, camera presets, and responsive camera bounds. Use for camera movement, framing, modal model viewers, dolly limits, or touch orbit behavior.
---

# Camera and Controls

Use `src/three/ThreeCameraManager.ts` as the primary owner for board-camera behavior.

## Rules

- Reuse one `OrbitControls` instance per active camera/canvas unless isolation is required.
- Enable damping only if the main update loop calls `controls.update()` continuously.
- Separate board constraints from free portrait/model viewers; do not reuse RTS polar/distance clamps for full 360 inspection.
- Update `camera.aspect` and call `camera.updateProjectionMatrix()` after viewport changes.
- Compute framing from object/board bounds instead of magic distances when layouts vary.
- When changing `controls.target`, camera position, min/max distance, or polar limits, update them as one coherent preset.

## Fit an object

Use `Box3.setFromObject()` -> bounding sphere/size -> FOV math -> padded distance. Account for portrait orientation and canvas aspect. Recenter controls on the object's visual center, not necessarily world origin.

## 360 viewer

- Permit azimuth rotation through the full range.
- Permit vertical orbit only to the limits requested by UX.
- Disable board pan/placement gestures while the viewer owns the pointer.
- For pinch zoom, let OrbitControls own touch dolly unless custom gestures have a concrete reason to override it.

## Forest Throne regression guards

- Preserve profile-aware camera framing and the existing dolly-ceiling logic.
- Re-run camera containment tests when changing board extents, FOV, distance clamps, or target.
- Do not let selecting a tech-tree or UI node unexpectedly reset board zoom unless explicitly intended.
