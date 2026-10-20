---
name: threejs-gamedev
description: Master router for pure Three.js game work in Forest Throne. Use for Three.js architecture, scene/rendering, cameras, models, animation, materials, lighting, input, drag-drop, performance, post-processing, audio, procedural geometry, lifecycle, responsive/mobile, debugging, or WebGL testing; load the relevant child skill before editing.
---

# Three.js Game Development

Treat Three.js as the production runtime. Do not introduce Phaser into new production paths and do not add React Three Fiber or another scene abstraction unless explicitly requested.

## Repository anchors

- Boot: `src/main.ts -> ThreeApp`.
- Scene/runtime ownership: `src/three/`.
- Camera ownership: `src/three/ThreeCameraManager.ts`.
- Board picking: `src/three/ThreeBoardViewport.ts`.
- Unit model authority: `src/three/ThreeUnitModelFactory.ts` and `UNIT_MODEL_MAP`.
- `old_src/` is reference-only unless the user explicitly requests otherwise.
- Check `package.json` before API-sensitive work; the repo currently uses `three@0.186.0`.

## Load the narrow child skill

| Need | Skill |
|---|---|
| renderer / scene loop / scene ownership | `threejs-scene-renderer` |
| camera / OrbitControls / framing | `threejs-camera-controls` |
| glTF / GLB / Draco / KTX2 / model loading | `threejs-models-gltf` |
| clips / mixers / action blending / procedural motion | `threejs-animation` |
| materials / textures / color spaces / transparency | `threejs-materials-textures` |
| lights / shadows / shadow budgets | `threejs-lighting-shadows` |
| pointer input / picking / Raycaster | `threejs-raycasting-input` |
| unit dragging / board placement / pointer capture | `threejs-drag-drop` |
| InstancedMesh / BatchedMesh / draw-call and allocation optimization | `threejs-instancing-performance` |
| EffectComposer / render passes | `threejs-postprocessing` |
| listener / Audio / PositionalAudio | `threejs-audio` |
| low-poly / voxel / generated geometry | `threejs-procedural-geometry` |
| dispose / teardown / listener and RAF cleanup | `threejs-memory-lifecycle` |
| resize / DPR / mobile touch / adaptive quality | `threejs-responsive-mobile` |
| visual defects / transforms / z-fighting / GPU diagnosis | `threejs-debugging` |
| Vitest / WebGL probe / static and runtime regression gates | `threejs-testing-webgl` |

## Universal rules

1. Extend existing owners before creating parallel managers.
2. Keep render-state mutations explicit; avoid hidden globals and per-frame object churn.
3. Prefer delta-time animation over frame-count animation.
4. Reuse immutable geometry/material assets only when ownership and disposal are unambiguous.
5. Keep DOM UI in DOM presentation layers unless the UI must live in world space.
6. Preserve mobile controls and portrait layouts when changing camera/input/render sizing.
7. Add or update regression coverage near the behavior changed.
8. On teardown, stop the loop before disposing renderer-owned resources.

## Verification order

Run the narrowest relevant test first, then `pnpm typecheck`, relevant Vitest suites, `pnpm build`, and `pnpm test:browser:webgl` when renderer/browser behavior changed. Never claim runtime verification from static inspection alone.
