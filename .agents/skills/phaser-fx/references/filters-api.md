# Filters — notes beyond the companion reference

The full Phaser 4 filter reference — every built-in filter with its signature, the
`FilterList` and Controller APIs, and the internal/external decision — lives in the
`filters-and-postfx` skill installed alongside this one. This file keeps only what that
reference does not cover.

## Notable details

- `addBlur` `x` and `y` are per-axis blur amounts, so `addBlur(0, 4, 0, 1)` gives a
  horizontal-only motion blur.
- `knockout: true` on a glow keeps only the glow and discards the object — useful for
  silhouette effects.
- A mask source can be any drawing object, so animated and filtered masks work — a mask
  made from a particle emitter or from another filter's output is legal.
- Fade to grayscale on death by animating the matrix value instead of adding and
  removing the filter every frame:

  ```typescript
  const cm = this.cameras.main.filters.external.addColorMatrix();
  cm.colorMatrix.grayscale(0);
  this.tweens.addCounter({ from: 0, to: 1, duration: 800,
    onUpdate: t => cm.colorMatrix.grayscale(t.getValue()) });
  ```

- `clear()` is the one to reach for after a transition effect finishes. Leaving a
  finished filter attached keeps its framebuffer pass running forever, which reads as a
  mysterious constant frame cost rather than as a leak.

## Custom shaders

```typescript
addCustom(...)
```

See `renderer-and-shaders.md`. A custom shader must implement alpha strategy handling
itself; alternatively route it through compositing with `filtersForceComposite` so a
Phaser shader handles it.

## Common recipes

**Pause-menu backdrop:**

```typescript
const blur = this.cameras.main.filters.external.addBlur(1, 4, 4, 1);
// on resume:
this.cameras.main.filters.external.remove(blur);
```

**Underwater level:**

```typescript
const cam = this.cameras.main.filters.external;
cam.addDisplacement('caustics', 0.01, 0.01);
const cm = cam.addColorMatrix();
cm.colorMatrix.night(0.2);
```

**Heat haze** over a lava level — needs a noise texture loaded as `'noise'`:

```typescript
this.cameras.main.filters.external.addDisplacement('noise', 0.02, 0.02);
```

**CRT-ish lens curve:**

```typescript
this.cameras.main.filters.external.addBarrel(1.08);
```

**Screen-wide hit feedback**, cheaper than a filter — flash a full-screen rectangle:

```typescript
const flash = this.add.rectangle(0, 0, w, h, 0xff0000, 0.4)
  .setOrigin(0).setScrollFactor(0).setDepth(9999);
this.tweens.add({ targets: flash, alpha: 0, duration: 150,
                  onComplete: () => flash.destroy() });
```

Reach for a filter when you need to transform what is *already drawn*. When you only need
to draw something on top, drawing something on top is faster.

## Verifying an effect actually renders

A filter that silently fails still type-checks. Prove it with pixels:

```javascript
// playtest/fx-check.mjs
export default [
  { name: 'glow is attached', action: 'expect',
    expect: { expression: `scene('GameScene').player.filters.internal.getActive().length`, atLeast: 1 } },
  { name: 'effects do not cost the frame budget', action: 'sample',
    expression: `game.loop.actualFps`, duration: 3000, interval: 100,
    expect: { stat: 'min', atLeast: 50 } },
  { name: 'with-effects', action: 'screenshot' },
];
```

The frame-rate sample is the important half. Filters are the most common cause of a
frame-rate cliff in an otherwise healthy Phaser 4 game, and the cliff appears only under
load — which a single reading misses and a `sample` catches.
