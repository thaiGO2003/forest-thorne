// Result-owned victory presentation. Combat FX is already disposed before this starts.
import * as THREE from "three";

export interface VictoryFireworkOrigin {
  x: number;
  y: number;
  z: number;
}

export interface VictoryFireworks {
  dispose(): void;
}

const PARTICLES = 18;
const ROCKET_SECONDS = 0.5;
const BURST_SECONDS = 1.05;
const STAGGER_SECONDS = 0.12;
const GRAVITY = 3.8;
const GOLDEN_RATIO_CONJUGATE = 0.61803398875;

interface FireworkState {
  origin: THREE.Vector3;
  apex: THREE.Vector3;
  rocket: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  burst: THREE.InstancedMesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  velocities: THREE.Vector3[];
  elapsed: number;
}

/** One distinct-hue firework per supplied reserve/bench origin. Presentation-only and self-disposing. */
export function createVictoryFireworks(
  scene: THREE.Scene,
  onFrame: (fn: (dt: number) => void) => () => void,
  origins: readonly VictoryFireworkOrigin[],
): VictoryFireworks {
  const group = new THREE.Group();
  group.name = "victory-fireworks";
  scene.add(group);

  const rocketGeometry = new THREE.BoxGeometry(0.07, 0.18, 0.07);
  const particleGeometry = new THREE.BoxGeometry(0.08, 0.08, 0.08);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const rotation = new THREE.Quaternion();

  const fireworks: FireworkState[] = origins.map((source, index) => {
    const color = new THREE.Color().setHSL((index * GOLDEN_RATIO_CONJUGATE) % 1, 0.82, 0.62);
    const material = new THREE.MeshBasicMaterial({ color, toneMapped: false });
    const rocket = new THREE.Mesh(rocketGeometry, material);
    rocket.name = `victory-firework-rocket-${index}`;
    rocket.visible = false;
    rocket.raycast = () => {};
    group.add(rocket);

    const burst = new THREE.InstancedMesh(particleGeometry, material, PARTICLES);
    burst.name = `victory-firework-burst-${index}`;
    burst.visible = false;
    burst.frustumCulled = false;
    burst.raycast = () => {};
    group.add(burst);

    const origin = new THREE.Vector3(source.x, Math.max(0.18, source.y + 0.15), source.z);
    const apex = origin.clone().add(new THREE.Vector3(0, 2.6 + (index % 3) * 0.35, 0));
    const velocities = Array.from({ length: PARTICLES }, (_, particleIndex) => {
      const phi = Math.acos(1 - 2 * ((particleIndex + 0.5) / PARTICLES));
      const theta = particleIndex * Math.PI * (3 - Math.sqrt(5));
      const speed = 1.35 + ((particleIndex * 17 + index * 11) % 7) * 0.08;
      return new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.cos(phi) * speed + 0.45,
        Math.sin(phi) * Math.sin(theta) * speed,
      );
    });

    return { origin, apex, rocket, burst, velocities, elapsed: -index * STAGGER_SECONDS };
  });

  let disposed = false;
  let unsubscribe: (() => void) | null = null;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    unsubscribe?.();
    unsubscribe = null;
    for (const firework of fireworks) {
      firework.rocket.material.dispose();
      firework.rocket.removeFromParent();
      firework.burst.removeFromParent();
    }
    rocketGeometry.dispose();
    particleGeometry.dispose();
    group.removeFromParent();
  };

  if (!fireworks.length) {
    dispose();
    return { dispose };
  }

  unsubscribe = onFrame((rawDt) => {
    const dt = Math.max(0, Math.min(rawDt, 0.1));
    let active = false;

    for (const firework of fireworks) {
      firework.elapsed += dt;
      const t = firework.elapsed;
      if (t < 0) {
        active = true;
        continue;
      }

      if (t < ROCKET_SECONDS) {
        active = true;
        firework.rocket.visible = true;
        firework.rocket.position.lerpVectors(firework.origin, firework.apex, t / ROCKET_SECONDS);
        continue;
      }

      firework.rocket.visible = false;
      const burstTime = t - ROCKET_SECONDS;
      if (burstTime >= BURST_SECONDS) {
        firework.burst.visible = false;
        continue;
      }

      active = true;
      firework.burst.visible = true;
      const fade = Math.max(0.08, 1 - burstTime / BURST_SECONDS);
      firework.velocities.forEach((velocity, particleIndex) => {
        position.copy(velocity).multiplyScalar(burstTime).add(firework.apex);
        position.y -= GRAVITY * burstTime * burstTime * 0.5;
        scale.setScalar(fade);
        firework.burst.setMatrixAt(particleIndex, matrix.compose(position, rotation.identity(), scale));
      });
      firework.burst.instanceMatrix.needsUpdate = true;
    }

    if (!active) dispose();
  });

  return { dispose };
}
