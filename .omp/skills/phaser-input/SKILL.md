---
name: phaser-input
description: This skill should be used when the user asks to "handle input", "keyboard controls", "mouse click", "touch controls", "gamepad support", "drag and drop", "virtual joystick", "WASD movement", "detect click", "pointer events", "keyboard shortcut", or "input manager".
version: 0.7.0
---

> See P:/DevGOVietnam/homeserver-forest-throne/.omp/skills/input-keyboard-mouse-touch/SKILL.md for the API reference already installed alongside this skill.

# Phaser 4 Input

Phaser 4's Input system supports keyboard, mouse/pointer, touch, and gamepad. All input is accessed through `this.input` inside a Scene. The companion skill above documents the standard input API (keys, pointer events, drag and drop, gamepad). This skill covers input handling Phaser does not provide out of the box: swipe detection, browser-gesture prevention, and a production-ready virtual joystick.

## Touch Input

Touch events share the same pointer API — `pointerdown`, `pointermove`, `pointerup` fire on touch devices automatically.

### Swipe Detection

Phaser has no built-in swipe API. Track the start position manually:

```typescript
private swipeStart = { x: 0, y: 0 };
private readonly SWIPE_THRESHOLD = 50; // pixels

create(): void {
  this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
    this.swipeStart = { x: ptr.x, y: ptr.y };
  });

  this.input.on('pointerup', (ptr: Phaser.Input.Pointer) => {
    const dx = ptr.x - this.swipeStart.x;
    const dy = ptr.y - this.swipeStart.y;

    if (Math.abs(dx) > this.SWIPE_THRESHOLD || Math.abs(dy) > this.SWIPE_THRESHOLD) {
      if (Math.abs(dx) > Math.abs(dy)) {
        console.log(dx > 0 ? 'Swipe Right' : 'Swipe Left');
      } else {
        console.log(dy > 0 ? 'Swipe Down' : 'Swipe Up');
      }
    }
  });
}
```

### Preventing Browser Gestures

Prevent pinch-zoom, browser swipe navigation, and pull-to-refresh from fighting touch controls:

```typescript
// In your HTML, add to the canvas element:
// style="touch-action: none;"
// Or in the Phaser config: input: { activePointers: 3 }
```

---

## Virtual Joystick (Mobile)

Phaser 4 has no built-in virtual joystick. For mobile games, implement a pointer-based joystick or use the reference implementation.

See `references/virtual-joystick.md` for a complete, production-ready TypeScript class that renders a base circle and thumb and exposes normalized `direction.x` / `direction.y` values.

Two common bugs are documented in that reference file: (1) **First-Contact Lock** — the base must stay locked during a drag; if the base "jumps" as the user drags, someone is updating `baseX/baseY` in `onPointerMove`. (2) **Cross-scene listener loss** — if the joystick works in one scene but not another, instantiate it ONCE in a persistent `InputScene` launched via `scene.launch()`, not per-gameplay-scene.

Usage pattern:

```typescript
private joystick!: VirtualJoystick;

create(): void {
  this.joystick = new VirtualJoystick(this, 120, this.scale.height - 120);
}

update(): void {
  if (this.joystick.isActive) {
    this.player.setVelocity(
      this.joystick.direction.x * 200,
      this.joystick.direction.y * 200
    );
  } else {
    this.player.setVelocity(0, 0);
  }
}
```

---

## Additional Resources

### Reference Files
- **`references/virtual-joystick.md`** — Full TypeScript virtual joystick implementation for mobile games
