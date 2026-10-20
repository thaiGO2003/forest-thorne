---
name: threejs-postprocessing
description: Add or maintain Three.js EffectComposer post-processing. Use for bloom, outline, color grading, screen-space effects, render passes, composer resizing, or post-processing performance/debugging.
---

# Post-processing

Use `EffectComposer` only when the effect materially improves the scene. It is WebGLRenderer-specific and adds render targets/passes.

## Pipeline

1. Create one composer for the relevant viewport.
2. Add `RenderPass(scene, camera)` first unless a custom pipeline requires otherwise.
3. Add only necessary effect passes.
4. Finish with output/color-space handling appropriate to the current Three.js pipeline.
5. Render with `composer.render(delta)` instead of double-rendering with both composer and renderer.

## Resize/lifecycle

- Mirror viewport size and pixel ratio into the composer.
- Dispose composer and owned passes/render targets on teardown.
- Disable expensive passes for low-power/mobile modes when necessary.

## Forest Throne

Prefer geometry/tile highlights for gameplay readability over full-screen effects. Do not use post-processing to compensate for broken materials, lighting, or selection ownership. Keep library portrait viewers isolated so they do not mutate the main board composer.
