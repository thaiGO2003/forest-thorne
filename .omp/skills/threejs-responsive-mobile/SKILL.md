---
name: threejs-responsive-mobile
description: Make Three.js canvases, cameras, controls, and 3D viewers responsive across desktop, mobile portrait/landscape, DPR changes, resizing, touch gestures, and performance tiers. Use for responsive renderer bugs, blurry/oversized canvases, modal viewers, pinch/rotate input, or mobile FPS.
---

# Responsive and Mobile

Treat CSS display size and drawing-buffer size as separate concerns.

## Resize

- Measure the actual canvas/container client size.
- Resize renderer only when dimensions changed.
- Update camera aspect/projection at the same time.
- If using EffectComposer, resize it too.
- Cap effective pixel ratio for mobile GPU cost.

## Touch

Use pointer events and configure `touch-action` intentionally on interactive canvases. Prevent page scrolling only inside gestures that own the interaction. Test one-finger orbit, two-finger zoom/pan, pointercancel, and modal close.

## Adaptive quality

Degrade expensive features in this order when needed: excessive DPR -> post-processing -> shadow resolution/casters -> decorative geometry/particles. Avoid reducing core gameplay readability.

## Forest Throne

Mobile portrait is a first-class layout. Full-screen library viewers must size from their modal/container and remain transparent when the design calls for no background. Board camera constraints and portrait viewer constraints are separate.
