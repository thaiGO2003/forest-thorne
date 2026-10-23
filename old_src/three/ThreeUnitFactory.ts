import * as THREE from "three";
import type { Unit3DConfig } from "./types.js";

/**
 * ============================================================================
 * 1. INTERFACES & TYPES
 * ============================================================================
 */

/**
 * Animated unit handle with idle bob + attack lunge drivers
 */
export interface Unit3DHandle {
  group: THREE.Group;
  body: THREE.Mesh;
  head: THREE.Mesh;
  hpBar: THREE.Sprite;
  manaBar: THREE.Sprite;
  starSprites: THREE.Sprite[];
  update: (delta: number, elapsed: number) => void;
  setHp: (current: number, max: number) => void;
  setMana: (current: number, max: number) => void;
  playAttack: () => void;
  playSkill: () => void;
  playHit: () => void;
  moveTo: (targetX: number, targetZ: number, duration?: number) => void;
  dispose: () => void;
}

/**
 * ============================================================================
 * 2. CONSTANTS & VARIABLES
 * ============================================================================
 */

const BODY_RADIUS = 0.55;
const BODY_HEIGHT = 1.1;
const HEAD_RADIUS = 0.34;
const BAR_WIDTH = 1.4;
const BAR_HEIGHT = 0.16;
const BAR_Y = 2.1;
const MANA_Y = 1.92;
const MANA_HEIGHT = 0.1;
const STAR_Y = 2.45;
const STAR_SIZE = 0.28;
const ATTACK_LUNGE = 0.45;
const ATTACK_DURATION = 0.35;
const SKILL_DURATION = 0.55;
const HIT_DURATION = 0.25;
// Shared geometries — allocate once for all units
let sharedBodyGeometry: THREE.CylinderGeometry | null = null;
let sharedHeadGeometry: THREE.IcosahedronGeometry | null = null;
let sharedEyeGeometry: THREE.SphereGeometry | null = null;
let sharedStarGeometry: THREE.PlaneGeometry | null = null;

/**
 * ============================================================================
 * 3. PUBLIC FUNCTIONS
 * ============================================================================
 */

/**
 * Build a low-poly unit: cylinder body, icosahedron head, HP bar sprite, star pips.
 *
 * @param config - Unit visual + stat config
 * @returns Animated and disposable unit handle
 */
export function createUnit3D(config: Unit3DConfig): Unit3DHandle {
  ensureSharedGeometries();

  const group = new THREE.Group();
  group.name = `unit-${config.id}`;
  group.userData = { unitId: config.id, baseId: config.baseId };

  const primary = config.primaryColor ?? (config.side === "player" ? 0x4a90d9 : 0xd94a4a);
  const secondary = config.secondaryColor ?? 0xf5e6c8;

  const bodyMaterial = new THREE.MeshStandardMaterial({ color: primary, flatShading: true, roughness: 0.8 });
  const body = new THREE.Mesh(sharedBodyGeometry as THREE.BufferGeometry, bodyMaterial);
  body.position.y = BODY_HEIGHT / 2;
  body.castShadow = true;
  group.add(body);

  const headMaterial = new THREE.MeshStandardMaterial({ color: secondary, flatShading: true, roughness: 0.7 });
  const head = new THREE.Mesh(sharedHeadGeometry as THREE.BufferGeometry, headMaterial);
  head.position.y = BODY_HEIGHT + HEAD_RADIUS * 0.8;
  head.castShadow = true;
  group.add(head);

  const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4 });
  const eyeOffset = HEAD_RADIUS * 0.45;
  const eyeY = head.position.y + 0.05;
  const eyeZ = HEAD_RADIUS * 0.75;
  const leftEye = new THREE.Mesh(sharedEyeGeometry as THREE.BufferGeometry, eyeMaterial);
  leftEye.position.set(-eyeOffset, eyeY, eyeZ);
  leftEye.scale.setScalar(0.55);
  group.add(leftEye);
  const rightEye = leftEye.clone();
  rightEye.position.x = eyeOffset;
  group.add(rightEye);

  // Star-tier ring under body
  const ringMaterial = new THREE.MeshBasicMaterial({ color: starColor(config.star), side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.85, 6), ringMaterial);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  group.add(ring);

  // HP bar billboard
  const hpBar = makeBarSprite(config.hp / Math.max(1, config.maxHp));
  hpBar.position.y = BAR_Y;
  group.add(hpBar);

  // Mana bar billboard
  const initialManaRatio = (config.maxMana ?? 0) > 0 ? (config.mana ?? 0) / config.maxMana : 0;
  const manaBar = makeManaBarSprite(initialManaRatio);
  manaBar.position.y = MANA_Y;
  group.add(manaBar);

  // Star pips
  const starSprites: THREE.Sprite[] = [];
  for (let i = 0; i < config.star; i += 1) {
    const star = makeStarSprite();
    star.position.set((i - (config.star - 1) / 2) * (STAR_SIZE + 0.06), STAR_Y, 0);
    group.add(star);
    starSprites.push(star);
  }

  // Animation state
  const baseY = 0;
  let attackTimer = -1;
  let skillTimer = -1;
  let hitTimer = -1;
  let moveTimer = -1;
  let moveDuration = 0.3;
  const moveStart = new THREE.Vector3();
  const moveEnd = new THREE.Vector3();
  let seed = hashSeed(config.id);

  const update = (delta: number, elapsed: number): void => {
    seed += delta;

    // Position interpolation (movement)
    if (moveTimer >= 0) {
      moveTimer += delta;
      const t = Math.min(1, moveTimer / Math.max(0.001, moveDuration));
      // Ease out cubic
      const ease = 1 - Math.pow(1 - t, 3);
      group.position.x = THREE.MathUtils.lerp(moveStart.x, moveEnd.x, ease);
      group.position.z = THREE.MathUtils.lerp(moveStart.z, moveEnd.z, ease);
      if (t >= 1) {
        moveTimer = -1;
      }
    }

    // Idle bob (only when not casting skill)
    if (skillTimer < 0) {
      group.position.y = baseY + Math.sin(elapsed * 2.2 + seed) * 0.06;
      head.rotation.y = Math.sin(elapsed * 1.1 + seed) * 0.25;
    }

    // Attack lunge decay
    if (attackTimer >= 0) {
      attackTimer += delta;
      const t = attackTimer / ATTACK_DURATION;
      if (t >= 1) {
        attackTimer = -1;
        body.position.z = 0;
      } else {
        body.position.z = Math.sin(t * Math.PI) * ATTACK_LUNGE;
      }
    }

    // Skill cast: jump + spin 360
    if (skillTimer >= 0) {
      skillTimer += delta;
      const t = skillTimer / SKILL_DURATION;
      if (t >= 1) {
        skillTimer = -1;
        group.position.y = baseY;
        group.rotation.y = 0;
        bodyMaterial.emissive.setHex(0x000000);
      } else {
        // Jump up arc
        group.position.y = baseY + Math.sin(t * Math.PI) * 0.85;
        // Full 360 spin
        group.rotation.y = t * Math.PI * 2;
        // Glow pulse
        const glow = Math.sin(t * Math.PI) * 0.5;
        bodyMaterial.emissive.setRGB(glow, glow * 0.8, 0);
      }
    }

    // Hit reaction: shake & flash
    if (hitTimer >= 0) {
      hitTimer += delta;
      const t = hitTimer / HIT_DURATION;
      if (t >= 1) {
        hitTimer = -1;
        body.position.x = 0;
        bodyMaterial.emissive.setHex(0x000000);
      } else {
        body.position.x = (Math.random() - 0.5) * 0.15;
        const flash = (1 - t) * 0.6;
        bodyMaterial.emissive.setRGB(flash, 0, 0);
      }
    }
  };

  const setHp = (current: number, max: number): void => {
    const ratio = Math.max(0, Math.min(1, current / Math.max(1, max)));
    const canvas = hpBar.userData.canvas as HTMLCanvasElement;
    drawBar(canvas, ratio);
    const map = (hpBar.material as THREE.SpriteMaterial).map;
    if (map) map.needsUpdate = true;
  };

  const setMana = (current: number, max: number): void => {
    const ratio = Math.max(0, Math.min(1, current / Math.max(1, max)));
    const canvas = manaBar.userData.canvas as HTMLCanvasElement;
    drawManaBar(canvas, ratio);
    const map = (manaBar.material as THREE.SpriteMaterial).map;
    if (map) map.needsUpdate = true;
  };

  const playAttack = (): void => {
    attackTimer = 0;
  };

  const playSkill = (): void => {
    skillTimer = 0;
  };

  const playHit = (): void => {
    hitTimer = 0;
  };

  const moveTo = (targetX: number, targetZ: number, duration: number = 0.3): void => {
    moveStart.set(group.position.x, 0, group.position.z);
    moveEnd.set(targetX, 0, targetZ);
    moveDuration = Math.max(0.05, duration);
    moveTimer = 0;
  };

  const dispose = (): void => {
    bodyMaterial.dispose();
    headMaterial.dispose();
    eyeMaterial.dispose();
    ringMaterial.dispose();
    ring.geometry.dispose();
    (hpBar.material as THREE.SpriteMaterial).map?.dispose();
    (hpBar.material as THREE.SpriteMaterial).dispose();
    (manaBar.material as THREE.SpriteMaterial).map?.dispose();
    (manaBar.material as THREE.SpriteMaterial).dispose();
    starSprites.forEach((sprite) => {
      (sprite.material as THREE.SpriteMaterial).dispose();
    });
  };
  return {
    group,
    body,
    head,
    hpBar,
    manaBar,
    starSprites,
    update,
    setHp,
    setMana,
    playAttack,
    playSkill,
    playHit,
    moveTo,
    dispose
  };
}

/**
 * ============================================================================
 * 4. PRIVATE FUNCTIONS
 * ============================================================================
 */

/**
 * Lazily allocate shared geometries once.
 */
function ensureSharedGeometries(): void {
  if (!sharedBodyGeometry) sharedBodyGeometry = new THREE.CylinderGeometry(BODY_RADIUS * 0.75, BODY_RADIUS, BODY_HEIGHT, 6);
  if (!sharedHeadGeometry) sharedHeadGeometry = new THREE.IcosahedronGeometry(HEAD_RADIUS, 0);
  if (!sharedEyeGeometry) sharedEyeGeometry = new THREE.SphereGeometry(0.09, 6, 6);
  if (!sharedStarGeometry) sharedStarGeometry = new THREE.PlaneGeometry(STAR_SIZE, STAR_SIZE);
}

/**
 * Gold for 3★, silver 2★, bronze 1★.
 */
function starColor(star: number): number {
  if (star >= 3) return 0xffd700;
  if (star === 2) return 0xc0c0c0;
  return 0xcd7f32;
}

/**
 * Deterministic float seed from unit id for phase-offset idle motion.
 */
function hashSeed(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) % 1000;
  return hash / 100;
}

/**
 * Canvas-backed HP bar sprite (redrawn on setHp, no per-frame alloc).
 */
function makeBarSprite(ratio: number): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 16;
  drawBar(canvas, ratio);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(BAR_WIDTH, BAR_HEIGHT, 1);
  sprite.userData.canvas = canvas;
  return sprite;
}

/**
 * Paint HP bar: dark bg + green→red fill.
 */
function drawBar(canvas: HTMLCanvasElement, ratio: number): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const fill = ratio > 0.5 ? "#4ade80" : ratio > 0.25 ? "#facc15" : "#ef4444";
  ctx.fillStyle = fill;
  ctx.fillRect(2, 2, (canvas.width - 4) * ratio, canvas.height - 4);
}
/**
 * Canvas-backed Mana bar sprite (redrawn on setMana, no per-frame alloc).
 */
function makeManaBarSprite(ratio: number): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 12;
  drawManaBar(canvas, ratio);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(BAR_WIDTH, MANA_HEIGHT, 1);
  sprite.userData.canvas = canvas;
  return sprite;
}

/**
 * Paint Mana bar: dark bg + vibrant blue fill.
 */
function drawManaBar(canvas: HTMLCanvasElement, ratio: number): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#38bdf8";
  ctx.fillRect(2, 2, Math.max(0, (canvas.width - 4) * ratio), canvas.height - 4);
}

/**
 * Gold star pip sprite from shared canvas texture.
 */
let sharedStarTexture: THREE.CanvasTexture | null = null;
function makeStarSprite(): THREE.Sprite {
  let texture = sharedStarTexture;
  if (!texture) {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffd700";
      ctx.font = "26px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (typeof ctx.fillText === "function") {
        ctx.fillText("★", 16, 18);
      }
    }
    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    sharedStarTexture = texture;
  }
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(STAR_SIZE, STAR_SIZE, 1);
  return sprite;
}

/**
 * ============================================================================
 * 5. EXPORTS
 * ============================================================================
 */

export default { createUnit3D };
