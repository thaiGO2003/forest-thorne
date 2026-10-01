---
name: phaser-matter
description: This skill should be used when the user asks to "Matter physics", "realistic physics", "polygon collision", "joints", "constraints", "complex physics shapes", "Matter.js", "ragdoll", "hinge joint", "compound body", "physics sensor", etc.
version: 0.7.0
---

> Companion reference (do not duplicate here): See P:/DevGOVietnam/homeserver-forest-throne/.omp/skills/physics-matter/SKILL.md for the full Matter API reference (world config, bodies, body config, forces, constraints, sensors, collision categories, events, queries, debug) already installed alongside this skill.

# Phaser 4 Matter Physics — Workflow & Patterns

## Arcade vs Matter — When to Use Which

**Arcade Physics** (default choice):
- AABB collision only: rectangles and circles
- Simple hitboxes, excellent performance
- `body.blocked.down` for ground detection
- Covers 95% of 2D games

**Matter Physics** (when you need it):
- Convex polygon shapes and complex concave bodies
- Compound bodies (multiple shapes welded together)
- Realistic constraints: hinges, springs, distance rods
- Ragdoll physics and destructible objects
- Sensor zones with physics-accurate collision events

**Rule:** Default to Arcade. Switch to Matter only when you need non-rectangular collision shapes or real joints.

## Critical Gotchas

- **Player bodies must be non-rotating.** Always call `setFixedRotation()` on player bodies. Without it, the capsule-shaped body rolls and tips over on contact with surfaces.
- **Velocity units are per physics step, not per second** (unlike Arcade). A `setVelocity(0, -10)` jump is tuned per-step; do not port Arcade velocity numbers blindly.
- **Concave polygons:** Matter decomposes them into convex parts automatically via `poly-decomp`. Ensure your vertices are wound consistently (clockwise or counter-clockwise).
- **Compound bodies and collision events:** each part is a separate Matter body. `bodyA.gameObject` will be `null` for sub-parts; only the compound root body has the `gameObject` reference.
- **Gravity is normalized:** `1` = earth-like downward pull (Arcade uses pixels/s²).

## Platform Games with Matter

Matter platformers need extra care because `body.blocked.down` does not exist in Matter — use a foot sensor on a compound body plus collision events instead.

```typescript
class Player extends Phaser.Physics.Matter.Sprite {
  private onGround = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene.matter.world, x, y, 'player');
    scene.add.existing(this);
    this.setFixedRotation();        // prevent capsule rolling
    this.setFrictionAir(0.05);
    this.setCollisionCategory(0x0001);

    // Track ground contact via sensor at feet
    const sensor = (scene.matter as any).bodies.rectangle(0, 20, 20, 4, { isSensor: true });
    const compound = (scene.matter as any).body.create({
      parts: [this.body, sensor],
    });
    this.setExistingBody(compound, true);

    scene.matter.world.on('collisionstart', (ev: any) => {
      ev.pairs.forEach((p: any) => {
        if (p.bodyA === sensor || p.bodyB === sensor) this.onGround = true;
      });
    });
    scene.matter.world.on('collisionend', (ev: any) => {
      ev.pairs.forEach((p: any) => {
        if (p.bodyA === sensor || p.bodyB === sensor) this.onGround = false;
      });
    });
  }

  jump(): void {
    if (this.onGround) this.setVelocityY(-10);
  }
}
```

## One-Shot Constraint Pattern

Remove a constraint right after it does its job (rope grab, grapple release) so the world does not accumulate dead constraints:

```typescript
// Inside the collisionstart handler that creates the rope:
const rope = this.matter.add.constraint(playerBody, targetBody, 100, 0.9);
this.time.delayedCall(1000, () => this.matter.world.removeConstraint(rope));
```

## Additional Resources

- Full Matter API (factory methods, mixin, body statics, config interfaces, collision event structure, raycasting): see the companion `physics-matter` skill listed at the top.
