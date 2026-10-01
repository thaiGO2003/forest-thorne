---
name: threejs-testing-webgl
description: Create and run regression coverage for Three.js code using Vitest, structural geometry tests, real camera/control logic with minimal renderer fakes, and browser WebGL probes. Use when verifying renderer, camera, scene lifecycle, raycasting, generated models, animation contracts, or Three.js migration gates.
---

# Testing Three.js

Choose the lowest test layer that proves the behavior, then add browser coverage only where WebGL/browser behavior matters.

## Layers

- Pure/unit: coordinate math, model-map coverage, action/state transitions.
- Structural Three.js: real Object3D/geometry/raycast/camera logic without a real GPU.
- Lifecycle: real scene/camera/control ownership with only the GL renderer faked when possible.
- Browser/WebGL: renderer creation, real canvas/context, visual interaction/smoke behavior.

## Rules

- Do not mock the exact class whose behavior is under test.
- Prefer deterministic geometry/raycast assertions over screenshots for structural correctness.
- For camera framing, project actual board/object bounds through the real camera.
- For generated solid models, raycast from multiple directions and assert expected intersections.
- For disposal, assert no render/update callbacks occur after teardown.

## Forest Throne commands

Start with the relevant targeted Vitest file, then use:

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm test:browser:webgl
```

Use the repo's Three migration inventory/census/gate scripts when edits affect migration closure. Do not label a browser/device gate PASS unless it actually ran.
