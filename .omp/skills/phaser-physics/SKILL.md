---
name: phaser-physics
description: This skill should be used when the user asks to "add physics", "set up collisions", "implement gravity", "create a platformer", "add physics to sprite", "detect overlaps", "create collision groups", "make objects bounce", "top-down movement", "set velocity", "apply forces", "enable arcade physics", or needs any Arcade Physics configuration in Phaser 4.
version: 0.7.0
---

> Companion reference (do not duplicate here): See P:/DevGOVietnam/homeserver-forest-throne/.omp/skills/physics-arcade/SKILL.md for the API reference already installed alongside this skill.

# Phaser 4 Arcade Physics

Phaser 4 uses Arcade Physics — fast AABB (axis-aligned bounding box) simulation. No real curves or rotation-based collisions, but excellent for most 2D games.

## Enable Physics

Enable Arcade Physics in GameConfig — the full `physics.arcade` config (gravity, debug, world bounds, fps) is in the companion reference.

**Gravity values by genre:**
- Platformer: `{ x: 0, y: 500 }` to `{ x: 0, y: 800 }`
- Top-down: `{ x: 0, y: 0 }` (no gravity)
- Space shooter: `{ x: 0, y: 0 }` (no gravity)
- Pinball: `{ x: 0, y: 600 }` with high bounce

## One-Way Platform Collisions

One-way platforms (jump up through, land on top) use a conditional collider — the process callback returns `true` only while the player is falling, so the platform is solid on the way down but passable on the way up:

```typescript
// Conditional collider (process callback — return true to proceed)
this.physics.add.collider(
  player,
  onewayPlatforms,
  undefined,                // no callback
  (playerObj, platformObj) => {
    // Only collide if player is falling down through platform
    const body = (playerObj as Phaser.Physics.Arcade.Sprite)
      .body as Phaser.Physics.Arcade.Body;
    return body.velocity.y > 0;
  },
  this
);
```

## Genre Physics Recipes

### Platformer

```typescript
// GameConfig
physics: { default: 'arcade', arcade: { gravity: { y: 500 }, debug: true } }

// Player setup
this.player = this.physics.add.sprite(100, 400, 'player');
this.player.setBounce(0.1);
this.player.setCollideWorldBounds(true);
(this.player.body as Phaser.Physics.Arcade.Body)
  .setSize(24, 40).setOffset(4, 8);

// In update():
const body = this.player.body as Phaser.Physics.Arcade.Body;
if (this.cursors.left.isDown) {
  this.player.setVelocityX(-200);
  this.player.flipX = true;
} else if (this.cursors.right.isDown) {
  this.player.setVelocityX(200);
  this.player.flipX = false;
} else {
  // Decelerate
  this.player.setVelocityX(this.player.body.velocity.x * 0.85);
}

// Jump — only when on the ground
if (this.cursors.up.isDown && body.blocked.down) {
  this.player.setVelocityY(-550);
}
// Variable jump height — release early for lower jump
if (!this.cursors.up.isDown && body.velocity.y < -200) {
  this.player.setVelocityY(this.player.body.velocity.y * 0.85);
}

// Coyote time (jump grace period after walking off ledge)
// Track lastGroundedTime and allow jump within 100ms window
```

### Top-Down (RPG/Shooter)

```typescript
// GameConfig — no gravity
physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: true } }

// Player setup
this.player = this.physics.add.sprite(400, 300, 'player');
this.player.setCollideWorldBounds(true);
(this.player.body as Phaser.Physics.Arcade.Body).setDrag(1000, 1000);

// In update():
const speed = 200;
let vx = 0;
let vy = 0;
if (this.cursors.left.isDown)  vx = -speed;
if (this.cursors.right.isDown) vx = speed;
if (this.cursors.up.isDown)    vy = -speed;
if (this.cursors.down.isDown)  vy = speed;

// Normalize diagonal movement
if (vx !== 0 && vy !== 0) {
  vx *= 0.707;
  vy *= 0.707;
}
this.player.setVelocity(vx, vy);
```

### Space Shooter / Bullet Hell

```typescript
// GameConfig — no gravity
physics: { default: 'arcade', arcade: { gravity: { y: 0 } } }

// Velocity-based movement (ship feels floaty)
this.ship = this.physics.add.sprite(400, 500, 'ship');
this.ship.setMaxVelocity(300, 300);
(this.ship.body as Phaser.Physics.Arcade.Body).setDrag(300, 300);

// 8-directional movement with velocity
if (this.cursors.up.isDown)    this.ship.body.velocity.y -= 400 * delta / 1000;
if (this.cursors.down.isDown)  this.ship.body.velocity.y += 400 * delta / 1000;

// Angle-based bullet firing
private fireBullet(): void {
  const bullet = this.bullets.get() as Phaser.Physics.Arcade.Sprite;
  if (!bullet) return;
  bullet.setActive(true).setVisible(true).setPosition(this.ship.x, this.ship.y - 20);
  this.physics.velocityFromAngle(this.ship.angle - 90, 500, bullet.body.velocity);
}
```

## Object Pooling for Bullets/Projectiles

```typescript
// Define bullet class
export class Bullet extends Phaser.Physics.Arcade.Sprite {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'bullet');
  }

  fire(x: number, y: number, velocityY: number = -500): void {
    this.setActive(true).setVisible(true).setPosition(x, y);
    this.setVelocityY(velocityY);
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    // Recycle off-screen
    if (this.y < -50 || this.y > this.scene.scale.height + 50) {
      this.setActive(false).setVisible(false);
    }
  }
}

// In GameScene.create():
this.bullets = this.physics.add.group({
  classType: Bullet,
  maxSize: 30,
  runChildUpdate: true,
});
this.physics.add.overlap(this.bullets, this.enemies, this.bulletHitEnemy, undefined, this);

// To shoot:
const b = this.bullets.get(this.player.x, this.player.y) as Bullet;
if (b) b.fire(this.player.x, this.player.y);
```

## Timer Tracking and Cleanup

Timers created with `this.time.addEvent()` for recurring AI patterns, ability cooldowns, or boss phase transitions accumulate and never self-clean across scene restarts. Store every timer reference and remove them in `shutdown()` (or the equivalent entity cleanup).

```typescript
// In your entity class:
private activeTimers: Phaser.Time.TimerEvent[] = [];

startBossPhase(): void {
  const t = this.scene.time.addEvent({
    delay: 3000,
    loop: true,
    callback: this.fireVolley,
    callbackScope: this,
  });
  this.activeTimers.push(t);
}

destroy(fromScene?: boolean): void {
  for (const t of this.activeTimers) t.remove(false);
  this.activeTimers = [];
  super.destroy(fromScene);
}
```

**Rule:** Every `time.addEvent` call in an entity must have a corresponding `t.remove()` in `destroy()` or `shutdown()`. Anonymous fire-and-forget timers on looping entities are the fastest path to a timer leak.

## Physics Group Lifecycle

Physics groups created for weapon evolutions, temporary spawn waves, or ability effects must be explicitly destroyed when the context ends. Stopping the parent scene does NOT automatically destroy child groups that were created dynamically.

```typescript
// When creating a group for a weapon or phase effect:
const projectileGroup = this.physics.add.group({ classType: MyProjectile, maxSize: 20 });

// When that weapon is replaced or the phase ends:
projectileGroup.clear(true, true);  // destroyChild=true, removeFromScene=true
projectileGroup.destroy();
```

Call `clear(true, true)` before `destroy()`. Without it, the children remain in the scene's display list as orphaned objects.

## Additional Resources

### Reference Files
- **`references/arcade-physics-api.md`** — Advanced physics patterns: moving platforms, knockback, tilemap collision, group-to-group collisions, world-bounds/death-zone handling
- **`references/multiplayer-patterns.md`** — Multiplayer architecture (authoritative server, P2P), WebSocket integration, client-side prediction, dead reckoning, Colyseus/Nakama/Photon, PeerJS
