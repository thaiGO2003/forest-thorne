# Phaser 4 Arcade Physics — Advanced Patterns

> Body/StaticBody properties, world methods, and utility functions are documented in the companion `physics-arcade` skill. This file keeps only advanced integration patterns.

## Moving Platforms

```typescript
// Moving platform that carries the player
export class MovingPlatform extends Phaser.Physics.Arcade.Image {
  private direction: number = 1;
  private speed: number = 100;
  private minX: number;
  private maxX: number;

  constructor(scene: Phaser.Scene, x: number, y: number, minX: number, maxX: number) {
    super(scene, x, y, 'platform');
    this.minX = minX;
    this.maxX = maxX;
    scene.physics.add.existing(this, false); // false = dynamic
    (this.body as Phaser.Physics.Arcade.Body).setImmovable(true).setAllowGravity(false);
    this.setVelocityX(this.speed);
  }

  update(): void {
    if (this.x >= this.maxX) { this.direction = -1; this.setVelocityX(-this.speed); }
    if (this.x <= this.minX) { this.direction = 1;  this.setVelocityX(this.speed); }
  }
}

// In GameScene: set player friction to transfer platform velocity
this.physics.add.collider(player, movingPlatforms, () => {
  if ((player.body as Phaser.Physics.Arcade.Body).blocked.down) {
    player.setVelocityX(player.body.velocity.x + movingPlatform.body.velocity.x);
  }
});
```

## Knockback

```typescript
private applyKnockback(
  target: Phaser.Physics.Arcade.Sprite,
  source: Phaser.Physics.Arcade.Sprite,
  force: number = 300
): void {
  const angle = Phaser.Math.Angle.Between(source.x, source.y, target.x, target.y);
  const body = target.body as Phaser.Physics.Arcade.Body;
  body.setVelocity(
    Math.cos(angle) * force,
    Math.sin(angle) * force - 100  // slight upward bias
  );
}
```

## Tilemap Collision with Arcade Physics

```typescript
// In create():
const map = this.make.tilemap({ key: 'level1' });
const tileset = map.addTilesetImage('tiles', 'tiles-image');
const groundLayer = map.createLayer('Ground', tileset!, 0, 0)!;
const hazardLayer = map.createLayer('Hazards', tileset!, 0, 0)!;

// Set collision by Tiled property
groundLayer.setCollisionByProperty({ collides: true });

// Or by tile index range
groundLayer.setCollisionBetween(1, 50);

// Or by specific indices
groundLayer.setCollision([1, 2, 5, 7]);

// Add collider with player
this.physics.add.collider(this.player, groundLayer);

// Add overlap with hazards
this.physics.add.overlap(this.player, hazardLayer, (player) => {
  this.playerDeath();
});

// Set world bounds to tilemap size
const { widthInPixels, heightInPixels } = map;
this.physics.world.setBounds(0, 0, widthInPixels, heightInPixels);
this.cameras.main.setBounds(0, 0, widthInPixels, heightInPixels);
```

## Group-to-Group Collisions

```typescript
// Bullets vs Enemies
this.physics.add.overlap(
  this.bullets,
  this.enemies,
  (bulletObj, enemyObj) => {
    const bullet = bulletObj as Bullet;
    const enemy = enemyObj as Enemy;
    bullet.setActive(false).setVisible(false);
    enemy.takeDamage(bullet.damage);
  },
  undefined,
  this
);

// Player vs Enemy group (all enemies collide with each other too)
this.physics.add.collider(this.enemies, this.enemies);  // enemies don't overlap each other
this.physics.add.collider(this.player, this.enemies, this.playerHit, undefined, this);
```

## Physics World Events

```typescript
// When a body hits world bounds
this.player.setCollideWorldBounds(true);
this.player.body.onWorldBounds = true;
this.physics.world.on(
  Phaser.Physics.Arcade.Events.WORLD_BOUNDS,
  (body: Phaser.Physics.Arcade.Body, up: boolean, down: boolean, left: boolean, right: boolean) => {
    if (body.gameObject === this.player) {
      if (down) this.playerFell();
    }
  }
);

// Fall into death zone (y exceeds level height)
// In update():
if (this.player.y > this.physics.world.bounds.height + 100) {
  this.playerDeath();
}
```
