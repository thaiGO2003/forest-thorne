# Three.js 3D Low-Poly Architecture & Best Practices

## 1. Low-Poly Modeling Standards (Pure Procedural & GLTF)
- Flat Shading enabled on `MeshStandardMaterial` (`flatShading: true`).
- Keep polygon counts low (under 500 tris per unit model).
- Combine geometries where possible with `BufferGeometryUtils.mergeGeometries`.

## 2. Dynamic Lighting & Shadows
- Use an `AmbientLight` (intensity 0.6) with sky/ground color gradients.
- Single `DirectionalLight` (intensity 1.2) configured for soft PCF shadow maps (`shadow.mapSize.width = 2048`, `shadow.mapSize.height = 2048`, `shadow.camera.near = 0.5`, `shadow.camera.far = 50`).

## 3. Orbit & Free-Camera Controls
- Utilize standard `three/addons/controls/OrbitControls.js`.
- Enable damping for fluid mobile touch & mouse interaction.
- Set bounds: `minPolarAngle: Math.PI / 6`, `maxPolarAngle: Math.PI / 2.2`.
