---
name: threejs-scene-renderer
description: Build or refactor Three.js scene ownership, WebGLRenderer setup, render loops, scene transitions, clocks, and renderer state. Use for ThreeApp/ThreeSceneManager work, canvas setup, frame scheduling, renderer configuration, or scene lifecycle boundaries.
---

# Scene and Renderer

## Workflow

1. Find the current owner of renderer, scene, camera, RAF, and transition state before editing.
2. Keep one production frame loop. Do not start nested `requestAnimationFrame` loops from feature objects.
3. Update simulation/controls before rendering; pass seconds as delta time.
4. Keep scene transitions explicit: detach old scene behavior, remove listeners, stop transient timers, dispose owned GPU resources, then install the next scene.

## Renderer defaults

- Use `THREE.WebGLRenderer` and treat WebGL2 as the baseline for current Three.js.
- Cap DPR rather than blindly using full `devicePixelRatio`.
- Set size from the actual container, not assumed `window.innerWidth/innerHeight` when embedded in panels/modals.
- Enable shadows only when the scene needs them; shadow maps are a separate performance budget.
- Avoid `preserveDrawingBuffer` unless a concrete capture workflow requires it.

## Frame loop pattern

```ts
const dt = Math.min(clock.getDelta(), 0.05);
controls.update(dt);
activeScene.update(dt);
renderer.render(scene, camera);
```

Clamp unusually large deltas after tab suspension. Do not encode gameplay timing as `frames * constant`.

## Forest Throne constraints

- Extend `ThreeApp` / existing scene-manager ownership instead of creating another top-level renderer.
- Preserve the verified invariant that teardown stops the frame loop before renderer disposal.
- Keep production code Phaser-free.

## Failure checks

- Multiple canvases or RAF loops after scene transitions.
- Render calls continuing after dispose.
- renderer state leaking between portrait previews and the main board.
- camera aspect not updated with canvas dimensions.
- repeated creation of clocks, render targets, or temporary scenes per frame.
