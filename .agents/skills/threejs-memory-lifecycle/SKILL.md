---
name: threejs-memory-lifecycle
description: Prevent Three.js memory, GPU, listener, timer, and render-loop leaks. Use for scene teardown, modal/model viewer disposal, renderer/composer/loaders cleanup, shared-resource ownership, or regressions that continue rendering after navigation.
---

# Memory and Lifecycle

Ownership must be explicit before disposal. Distinguish app-shared assets from scene-owned and instance-owned resources.

## Teardown order

1. Stop RAF/render/update loops.
2. Cancel timers, tweens, async callbacks, and pending interaction state.
3. Remove DOM/pointer/resize listeners and disconnect controls.
4. Detach scene objects.
5. Stop mixers/audio.
6. Dispose instance-owned geometries/materials/textures/render targets/composers/loaders.
7. Dispose renderer only when the application viewport itself is destroyed.

## Disposal helper rules

When traversing objects, handle material arrays and texture properties deliberately. Do not dispose textures referenced by a shared cache. `scene.remove()` does not free GPU resources.

## Async loading

Guard late loader results with a disposed/generation token so an old scene cannot attach assets after transition.

## Forest Throne

Preserve the regression that `ThreeSceneManager.dispose()` stops rendering before renderer teardown. For library full-screen viewers, ensure opening/closing repeatedly leaves no canvases, controls, listeners, render targets, or RAF callbacks behind.

## Evidence

Add lifecycle tests that fail if callbacks/render calls continue after disposal; static `dispose()` calls alone are not proof.
