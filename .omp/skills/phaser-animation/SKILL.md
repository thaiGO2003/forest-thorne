---
name: phaser-animation
description: This skill should be used when the user asks to "create animation", "animate sprite", "add tweens", "sprite animation not playing", "character animations", "easing", "tween timeline", "idle animation", "walk animation", "fade in", "fade out", or "scale animation".
version: 0.7.0
---

> Companion reference (do not duplicate here): See P:/DevGOVietnam/homeserver-forest-throne/.omp/skills/animations/SKILL.md and P:/DevGOVietnam/homeserver-forest-throne/.omp/skills/tweens/SKILL.md for the API reference already installed alongside this skill.

# Phaser 4 Animations and Tweens

Phaser 4 has two distinct animation systems: **frame-based sprite animations** (flip through frames in a texture atlas or spritesheet) and **tweens** (interpolate numeric properties over time). Use both together for polished game feel.

## Where to Define Animations

**Define animations in `PreloaderScene.create()` — not in each individual scene.** Animations registered on the global `AnimationManager` are available in every scene without re-registering; defining them once in the preloader also avoids the duplicate-key warning the AnimationManager logs when a key is registered twice.

If an animation only makes sense in a single scene (a cutscene animation, for example), define it in that scene's `create()`.

## Playing Animations

Playback control — `sprite.play(key, ignoreIfPlaying)`, `playReverse()`, `chain()`, `stop()`, pause/resume, and state checks such as `sprite.anims.isPlaying` — is documented in the `animations` skill. One method not covered there: start from a specific frame with `sprite.playFromFrame('player-walk', 3)`.

## Animation Events

Listen for animation lifecycle events on the **sprite** — the full event list (`animationstart`, `animationcomplete`, `animationcomplete-{key}`, `animationupdate`, `animationstop`, `animationrepeat`, `animationrestart`) is in the `animations` skill. Always remove listeners when the sprite is destroyed to prevent memory leaks:

```typescript
sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, this.onAnimComplete, this);
// In shutdown():
sprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE, this.onAnimComplete, this);
```

## Character State Machine Pattern

For characters with idle/walk/jump/attack states, use an explicit state machine in `update()`. This prevents impossible state transitions and makes animation logic readable.

```typescript
type CharState = 'idle' | 'walk' | 'jump' | 'attack' | 'hurt';

export class Player extends Phaser.Physics.Arcade.Sprite {
  private state: CharState = 'idle';

  setState(newState: CharState): void {
    if (this.state === newState) return;
    this.state = newState;
    switch (newState) {
      case 'idle':   this.play('player-idle',   true); break;
      case 'walk':   this.play('player-walk',   true); break;
      case 'jump':   this.play('player-jump',   true); break;
      case 'attack': this.play('player-attack', true); break;
      case 'hurt':
        this.play('player-hurt', true);
        this.once(
          Phaser.Animations.Events.ANIMATION_COMPLETE_KEY + 'player-hurt',
          () => this.setState('idle')
        );
        break;
    }
  }

  update(cursors: Phaser.Types.Input.Keyboard.CursorKeys): void {
    const body = this.body as Phaser.Physics.Arcade.Body;

    if (this.state === 'attack' || this.state === 'hurt') return;  // locked states

    if (!body.blocked.down) {
      this.setState('jump');
    } else if (cursors.left.isDown || cursors.right.isDown) {
      this.setState('walk');
    } else {
      this.setState('idle');
    }

    if (Phaser.Input.Keyboard.JustDown(cursors.space)) {
      this.setState('attack');
      this.once(
        Phaser.Animations.Events.ANIMATION_COMPLETE_KEY + 'player-attack',
        () => this.setState('idle')
      );
    }
  }
}
```

### Forced Animations: Cinematic Mode

When a one-shot animation (boss intro, death sequence, dungeon entry) plays for **one frame then reverts** to idle, the cause is always the entity's `update()` running its state-machine logic one tick after your forced `play()` call and overwriting it.

**Fix — add a `cinematicMode` flag as the very first guard in `update()`:**

```typescript
export class Player extends Phaser.Physics.Arcade.Sprite {
  private state: CharState = 'idle';
  private cinematicMode = false;

  setCinematicMode(active: boolean, forcedAnimKey?: string): void {
    this.cinematicMode = active;
    if (active && forcedAnimKey) {
      this.anims.stop();          // always stop before play on a state switch
      this.play(forcedAnimKey, true);
      this.once(
        Phaser.Animations.Events.ANIMATION_COMPLETE_KEY + forcedAnimKey,
        () => { this.cinematicMode = false; }
      );
    }
  }

  update(cursors: Phaser.Types.Input.Keyboard.CursorKeys): void {
    if (this.cinematicMode) return;  // MUST be first line — blocks state logic
    // ... rest of state machine
  }
}
```

Clear `cinematicMode` in the `ANIMATION_COMPLETE_KEY` handler, not synchronously after `play()` — the completion event fires after the last frame renders, and `update()` may run before your handler. Clear it synchronously and your forced animation exits one frame early.

See `references/state-machine-patterns.md` for the full canonical implementation, worked dungeon-entry example, and the `ANIMATION_COMPLETE` timing fix.

### State Transition Completeness

Adding a new animation state without auditing **all** other states' transition lists is a silent bug — no error is thrown; the state machine simply fails to reach the new state or gets stuck in the wrong one.

When adding any new state (e.g. `'dodge'`, `'interact'`):
1. Add it to the `CharState` union type.
2. Add a `case` for it in `setState()`.
3. Update every other state's "what can interrupt me" logic to include or exclude the new state as appropriate.

The transition table in `references/state-machine-patterns.md` makes missing transitions obvious on read.

## Common Tween Patterns

### Fade In

```typescript
sprite.setAlpha(0);
this.tweens.add({ targets: sprite, alpha: 1, duration: 400, ease: 'Linear' });
```

### Fade Out and Destroy

```typescript
this.tweens.add({
  targets:    sprite,
  alpha:      0,
  duration:   300,
  ease:       'Linear',
  onComplete: () => sprite.destroy(),
});
```

### Scale Pulse (hit feedback, collectible)

```typescript
this.tweens.add({
  targets:  sprite,
  scaleX:   1.3,
  scaleY:   1.3,
  duration: 80,
  ease:     'Quad.Out',
  yoyo:     true,
});
```

### Slide In From Edge

```typescript
// Slide in from left
sprite.setX(-100);
this.tweens.add({
  targets:  sprite,
  x:        400,
  duration: 500,
  ease:     'Back.Out',
});
```

### Bounce Landing

```typescript
sprite.setY(targetY - 100);
this.tweens.add({
  targets:  sprite,
  y:        targetY,
  duration: 600,
  ease:     'Bounce.Out',
});
```

## Tween Easing Functions

See `references/easing-reference.md` for the complete guide with all easing functions and use cases.

Quick reference:
- `'Linear'` — constant speed; mechanical, UI bars
- `'Quad.Out'` — fast start, decelerates; most natural movement
- `'Quad.In'` — accelerates; falling objects, winding up
- `'Quad.InOut'` — symmetric ease; camera moves
- `'Back.Out'` — overshoots target then settles; UI popups, dialog slides
- `'Bounce.Out'` — bounces at destination; objects hitting ground
- `'Elastic.Out'` — spring oscillation; comic, bouncy UI

## Tween Timelines

Sequence multiple tweens without nesting `onComplete` callbacks:

```typescript
this.tweens.timeline({
  tweens: [
    {
      targets:  panel,
      alpha:    1,
      duration: 200,
    },
    {
      targets:  panel,
      y:        300,
      duration: 400,
      ease:     'Back.Out',
    },
    {
      targets:  title,
      alpha:    1,
      duration: 300,
      offset:   '-=100',   // start 100ms before previous tween ends (overlap)
    },
    {
      targets:  button,
      alpha:    1,
      duration: 200,
      // no offset = starts after previous completes
    },
  ],
});
```

`offset` controls timing relative to the previous tween:
- `'-=200'` — overlap by 200ms
- `'+=200'` — add 200ms gap
- absolute number — start at that ms from timeline start

## Particle Animations (Brief)

For burst effects (explosions, pickups, impacts), use the built-in particle system:

```typescript
// One-shot burst
this.add.particles(x, y, 'spark', {
  speed:     { min: 50, max: 200 },
  angle:     { min: 0, max: 360 },
  scale:     { start: 1, end: 0 },
  lifespan:  600,
  quantity:  12,
  emitting:  false,         // don't start automatically
}).explode(12);             // emit 12 particles immediately then stop

// Persistent emitter (fire, rain)
const emitter = this.add.particles(x, y, 'flame', {
  speed:    30,
  lifespan: 1200,
  scale:    { start: 0.8, end: 0 },
  alpha:    { start: 1, end: 0 },
  frequency: 80,            // ms between emissions
});
// Stop later:
emitter.stop();
```

## Additional Resources

### Reference Files
- **`references/animation-api.md`** — Timeline API reference: `TimelineBuilderConfig`, tween `offset` semantics, and Timeline instance methods. (The rest of the animation/tween API is covered by the `animations` and `tweens` skills.)
- **`references/easing-reference.md`** — All built-in easing functions with descriptions, use cases, and code examples
- **`references/state-machine-patterns.md`** — State-machine discipline for characters: `cinematicMode` flag, canonical state list, transition table, the `stop()`/`play()` ordering rule, and `ANIMATION_COMPLETE` timing. Read when building any character with more than idle+walk, or when forced animations play for one frame and revert.
