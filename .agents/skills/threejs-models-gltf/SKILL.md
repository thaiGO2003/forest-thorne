---
name: threejs-models-gltf
description: Load and integrate Three.js glTF/GLB assets, GLTFLoader, DRACOLoader, KTX2Loader, Meshopt-compressed assets, model normalization, cloning, caching, and asset error handling. Use for imported 3D models, compressed assets, external model pipelines, or model cache ownership.
---

# Models and glTF

Prefer glTF/GLB for authored models. Use `GLTFLoader` from `three/addons/loaders/GLTFLoader.js`.

## Loading workflow

1. Create one loader pipeline per application/resource manager, not per model instance.
2. Use `loadAsync()` when the surrounding code is async.
3. Attach Draco/KTX2/Meshopt support only when assets actually use it.
4. Cache source assets by URL/key; clone scene instances when independent transforms or skeletal state are required.
5. Normalize scale/orientation at an asset-adapter boundary instead of scattering corrections through gameplay code.

## Compression

- Reuse a single `DRACOLoader`; decoder setup is not free.
- Call `KTX2Loader.detectSupport(renderer)` before loading KTX2 textures.
- Prefer compressed textures for large/mobile-heavy art where the content pipeline supports them.

## Ownership

Document whether cached geometry/textures are shared or instance-owned. Do not dispose shared cached GPU resources when one avatar is removed.

## Forest Throne

- Keep `UNIT_MODEL_MAP` as the live unit-model resolution authority.
- Do not bypass `ThreeUnitModelFactory` with one-off model loading from UI or combat code.
- Preserve bespoke procedural units where they are intentional; glTF is not automatically superior to generated geometry.

## Pitfalls

- ImageBitmap-backed textures from glTF require deliberate disposal; garbage collection alone is insufficient.
- Blind deep clones do not automatically solve skinned-mesh animation ownership.
- Avoid creating duplicate decoder workers/loaders for every asset.
