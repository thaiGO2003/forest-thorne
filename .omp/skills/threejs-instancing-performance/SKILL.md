---
name: threejs-instancing-performance
description: Optimize Three.js rendering and CPU/GPU allocations with InstancedMesh, BatchedMesh, geometry/material reuse, culling, draw-call reduction, object pools, and frame-budget measurement. Use for mobile FPS, large boards, repeated props/voxels, or rendering bottlenecks.
---

# Instancing and Performance

Optimize after identifying the bottleneck. Track renderer info, draw calls, triangles, texture memory, allocations, and frame time.

## Choose batching

- Same geometry + same material + many transforms: `InstancedMesh`.
- Different geometries + same material and compatible batching needs: `BatchedMesh`.
- Small count or highly unique animated meshes: regular meshes may be clearer and fast enough.

## Hot-loop rules

- Reuse `Vector2/3`, `Quaternion`, `Matrix4`, `Color`, raycasters, and temporary arrays in per-frame code.
- Avoid traversing the full scene every frame to rediscover known nodes.
- Do not rebuild BufferGeometry or materials during animation.
- Mark instance matrices/colors dirty only when they changed.

## Mobile budget

Cap DPR, minimize transparent overdraw, shadow casters, post-processing passes, and oversized textures. Treat draw-call targets as measured budgets, not arbitrary absolutes.

## Forest Throne

Repeated board blocks, foliage, fence pieces, micro-voxels, or shared decorative primitives are candidates for batching only when it does not break per-unit articulation, skins, raycasting IDs, or disposal ownership.

When optimizing, preserve the current visible behavior first; include before/after evidence in tests or profiling notes where practical.
