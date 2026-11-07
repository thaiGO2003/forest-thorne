import * as THREE from "three";
import { COLOR_PALETTE } from "./types.js";

/**
 * ============================================================================
 * 1. INTERFACES & TYPES
 * ============================================================================
 */

/**
 * Scatter layout bounds around arena
 */
export interface ScatterOptions {
  count?: number;
  minRadius?: number;
  maxRadius?: number;
  seed?: number;
}

/**
 * ============================================================================
 * 2. CONSTANTS & VARIABLES
 * ============================================================================
 */

const TREE_TRUNK_COLOR = 0x6b4423;
const TREE_LEAF_COLORS = [0x2d6a1e, 0x3d8b26, 0x4a7c29];
const ROCK_COLORS = [0x6b7280, 0x9ca3af, 0x4b5563];
const CRYSTAL_COLOR = 0x7dd3fc;

/**
 * ============================================================================
 * 3. PUBLIC FUNCTIONS
 * ============================================================================
 */

/**
 * Build one low-poly pine tree (cylinder trunk + 2 stacked cones).
 *
 * @param height - Total tree height
 * @param leafColor - Foliage color override
 * @returns Tree group with shadows
 */
export function createTree(height: number = 3, leafColor?: number): THREE.Group {
  const tree = new THREE.Group();
  const leaf = leafColor ?? TREE_LEAF_COLORS[Math.floor(Math.random() * TREE_LEAF_COLORS.length)];

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.26, height * 0.35, 5),
    new THREE.MeshStandardMaterial({ color: TREE_TRUNK_COLOR, flatShading: true, roughness: 1 })
  );
  trunk.position.y = height * 0.175;
  trunk.castShadow = true;
  tree.add(trunk);

  const lowerCone = new THREE.Mesh(
    new THREE.ConeGeometry(height * 0.32, height * 0.5, 6),
    new THREE.MeshStandardMaterial({ color: leaf, flatShading: true, roughness: 0.9 })
  );
  lowerCone.position.y = height * 0.55;
  lowerCone.castShadow = true;
  tree.add(lowerCone);

  const upperCone = new THREE.Mesh(
    new THREE.ConeGeometry(height * 0.22, height * 0.38, 6),
    new THREE.MeshStandardMaterial({ color: leaf, flatShading: true, roughness: 0.9 })
  );
  upperCone.position.y = height * 0.82;
  upperCone.castShadow = true;
  tree.add(upperCone);

  return tree;
}

/**
 * Build one low-poly rock (dodecahedron, random squash).
 *
 * @param size - Rock radius
 * @returns Rock mesh with shadows
 */
export function createRock(size: number = 0.6): THREE.Mesh {
  const color = ROCK_COLORS[Math.floor(Math.random() * ROCK_COLORS.length)];
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(size, 0),
    new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 1 })
  );
  rock.scale.y = 0.7;
  rock.rotation.set(Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.4);
  rock.castShadow = true;
  rock.receiveShadow = true;
  return rock;
}

/**
 * Build one glowing mana crystal (octahedron, emissive).
 *
 * @param size - Crystal radius
 * @returns Crystal mesh (no shadow casting, emissive glow)
 */
export function createCrystal(size: number = 0.5): THREE.Mesh {
  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(size, 0),
    new THREE.MeshStandardMaterial({
      color: CRYSTAL_COLOR,
      flatShading: true,
      roughness: 0.2,
      emissive: CRYSTAL_COLOR,
      emissiveIntensity: 0.35
    })
  );
  crystal.position.y = size;
  return crystal;
}

/**
 * Scatter trees/rocks/crystals in a ring outside the board.
 *
 * @param options - Count, radii, deterministic seed
 * @returns Group containing all props
 */
export function scatterForestProps(options: ScatterOptions = {}): THREE.Group {
  const { count = 26, minRadius = 12, maxRadius = 24, seed = 42 } = options;
  const group = new THREE.Group();
  group.name = "forest-props";
  let rng = seed;

  const random = (): number => {
    rng = (rng * 1103515245 + 12345) % 2147483648;
    return rng / 2147483648;
  };

  for (let i = 0; i < count; i += 1) {
    const angle = random() * Math.PI * 2;
    const radius = minRadius + random() * (maxRadius - minRadius);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const roll = random();

    if (roll < 0.55) {
      const tree = createTree(2.2 + random() * 2.2);
      tree.position.set(x, 0, z);
      tree.rotation.y = random() * Math.PI * 2;
      group.add(tree);
    } else if (roll < 0.85) {
      const rock = createRock(0.35 + random() * 0.55);
      rock.position.set(x, 0.15, z);
      group.add(rock);
    } else {
      const crystal = createCrystal(0.3 + random() * 0.3);
      crystal.position.set(x, 0, z);
      group.add(crystal);
    }
  }

  // Corner torches: wood post + emissive flame marker
  const torchPositions: Array<[number, number]> = [[-9, -7], [9, -7], [-9, 7], [9, 7]];
  torchPositions.forEach(([x, z]) => {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 1.6, 5),
      new THREE.MeshStandardMaterial({ color: COLOR_PALETTE.woodBorder, flatShading: true })
    );
    post.position.set(x, 0.8, z);
    post.castShadow = true;
    group.add(post);
    const flame = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.22, 0),
      new THREE.MeshStandardMaterial({ color: 0xffa500, emissive: 0xff6a00, emissiveIntensity: 1.2 })
    );
    flame.position.set(x, 1.75, z);
    group.add(flame);
  });

  return group;
}

/**
 * Dispose all geometries and materials attached to forest props.
 */
export function disposeProps(group: THREE.Group): void {
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry?.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[];
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    }
  });
}

export default { createTree, createRock, createCrystal, scatterForestProps, disposeProps };
