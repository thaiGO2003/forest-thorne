---
name: threejs-materials-textures
description: Design or debug Three.js materials, textures, color spaces, alpha/transparency, depth behavior, low-poly shading, texture filtering, and shared material ownership. Use for visual styling, skins, invisible backgrounds, texture assets, or material-related rendering bugs.
---

# Materials and Textures

## Defaults

- Prefer `MeshStandardMaterial` for lit production geometry; use unlit/basic materials only for deliberate UI/VFX cases.
- Use `flatShading` for the project's low-poly/cubic look where appropriate.
- Set color textures to `THREE.SRGBColorSpace`; keep normal/roughness/metalness/data maps in their correct non-color space.
- Configure texture wrapping/filtering deliberately; do not rely on defaults for pixel/atlas assets.

## Transparency

Do not use `transparent: true` just to hide an unwanted background. Remove the background mesh or use a truly transparent renderer/canvas when UX requires it. Transparent objects add sorting/depth complexity.

When alpha is required, decide explicitly among `transparent`, `opacity`, `alphaTest`, `depthWrite`, and render order. Prefer alpha test for hard cutouts.

## Sharing

- Reuse immutable materials only when all instances share uniforms/properties.
- Clone material before per-unit tint/skin mutation.
- Never dispose a shared texture/material from a single unit teardown.

## Debug sequence

Check normals -> material side -> depth test/write -> alpha -> color space -> tone mapping/exposure -> light availability.

## Forest Throne

Keep skin differences in visual adapters/factories. Avoid leaking presentation colors into combat/data schemas. Preserve solid-surface/no-xray expectations: do not fix missing faces with global `DoubleSide` unless the geometry is intentionally two-sided.
