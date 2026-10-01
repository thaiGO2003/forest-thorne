---
name: threejs-procedural-geometry
description: Build low-poly, voxel, cubic, articulated, or generated Three.js geometry. Use for bespoke animals, board blocks, props, fences, locks, environment pieces, micro-voxel skins, face culling, normals, pivots, or generated mesh integrity.
---

# Procedural Geometry

Build geometry as reusable semantic parts, not one giant anonymous mesh when animation or skins need articulation.

## Geometry rules

- Put pivots at joints that actually rotate.
- Share immutable BufferGeometry where safe; keep instance transforms/material mutations separate.
- Recompute normals/bounds after vertex edits.
- Render only faces that can be visible when building block/voxel surfaces at scale.
- Avoid fixing inside-out/missing surfaces by setting every material to `DoubleSide`.

## Low-poly style

Use intentional silhouette, proportion, layered cubes/primitive clusters, and flat shading. Add micro-detail where it improves recognition; do not increase cube count uniformly with no visual benefit.

## Articulation

Name groups/parts by semantic role (`head`, `wingLeft`, `weapon`, etc.). Store a stable neutral pose for procedural animation.

## Forest Throne

- Preserve `UNIT_MODEL_MAP` coverage for the whole live roster.
- Unit skins must remain visually identifiable and use the same action contract as their base unit.
- Validate solid surfaces from multiple camera directions so no-xray regressions are caught.
- Keep board block face-culling/visibility logic separate from decorative top pieces such as grass/mushrooms/fences.
