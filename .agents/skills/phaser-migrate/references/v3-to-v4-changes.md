# Phaser 3 → Phaser 4: Breaking Changes — See Companion Skill

The full v3 → v4 breaking-change reference (removed APIs, method mappings, behavioral
differences, renderer internals, TypeScript config changes) is documented in the
companion skill already installed alongside this one:

`P:/DevGOVietnam/homeserver-forest-throne/.omp/skills/v3-to-v4-migration/SKILL.md`

This file keeps only what the companion does not cover: the list of v3 APIs that are
**preserved** in v4.

## Not Changed (Preserved API)

The following core systems work identically to Phaser 3:
- Scene lifecycle (`init`, `preload`, `create`, `update`)
- `this.add.*` game object factory
- `this.physics.add.*` arcade physics factory
- `this.load.*` asset loader
- `this.input.*` input manager
- `this.cameras.main.*` camera
- `this.tweens.*` tween manager
- `this.time.*` timer events
- `this.sound.*` audio manager
- `this.anims.*` animation manager
- `this.registry.*` cross-scene data store
- `this.scene.*` scene manager
- Scale manager (`Phaser.Scale.*`)
- Tilemaps (`this.make.tilemap`, etc.)
- Events (`this.events.*`, `this.game.events.*`)
- Groups and object pooling
- Arcade Physics bodies, colliders, overlaps
