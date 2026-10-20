---
name: phaser-audio
description: This skill should be used when the user asks to "add sound", "play music", "audio not working", "add background music", "sound effects", "mute button", "audio sprite", "game audio", "play sound effect", or "music won't play".
version: 0.7.0
---

# Phaser 4 Audio

> Companion reference (do not duplicate here): See P:/DevGOVietnam/homeserver-forest-throne/.omp/skills/audio-and-sound/SKILL.md for the API reference already installed alongside this skill.

This skill holds the audio workflow patterns and gotchas that go beyond the API reference: rapid-SFX pooling, mute-button UI wiring, tap-to-start overlays, AudioContext suspension recovery, scene music crossfading, and shutdown cleanup decisions.

## Sound Pooling for Rapid SFX

If a sound fires many times per second (gunshots, footsteps, rapid UI feedback), a single instance causes audible cutoff — each new `play()` call restarts the same sound from the beginning.

Pre-create a pool of instances and round-robin through them:

```typescript
create(): void {
  // Create a pool of 5 gunshot sounds
  this.gunshotPool = [];
  for (let i = 0; i < 5; i++) {
    this.gunshotPool.push(this.sound.add('sfx-gunshot', { volume: 0.8 }));
  }
  this.poolIndex = 0;
}

private fireGunshot(): void {
  const snd = this.gunshotPool[this.poolIndex];
  // Stop any currently playing instance at this slot, then play fresh
  if (snd.isPlaying) snd.stop();
  snd.play();
  this.poolIndex = (this.poolIndex + 1) % this.gunshotPool.length;
}
```

Pool size guideline: match the maximum overlapping instances you expect. For footsteps, 3–4 is usually sufficient.

## Mute Button Pattern

```typescript
create(): void {
  const muteBtn = this.add.image(750, 30, 'btn-mute').setInteractive();
  muteBtn.on('pointerdown', () => {
    this.sound.mute = !this.sound.mute;
    muteBtn.setTexture(this.sound.mute ? 'btn-unmute' : 'btn-mute');
  });
}
```

Tie the button texture to the global `this.sound.mute` flag (not to a click counter) so the icon always reflects the actual mute state even if muting happens elsewhere.

## Tap-to-Start Overlay for Audio-Critical Games

Phaser unlocks audio automatically on the first user interaction, but for games where audio is critical, gate the start behind a full-screen "Tap to Start" overlay so no audio can fire before the unlock. When the player taps it, dismiss it — Phaser's internal unlock fires at the same time, so audio starts on the next `play()` call.

```typescript
create(): void {
  this.bgMusic = this.sound.add('music-main', { loop: true, volume: 0.6 });

  if (this.sound.locked) {
    const overlay = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.7)
      .setInteractive();
    const label = this.add.text(400, 300, 'TAP TO START', {
      fontSize: '32px', color: '#ffffff',
    }).setOrigin(0.5);

    this.sound.once(Phaser.Sound.Events.UNLOCKED, () => {
      overlay.destroy();
      label.destroy();
      this.bgMusic.play();
    });
  } else {
    this.bgMusic.play();
  }
}
```

## AudioContext Suspension Recovery

Mobile browsers (especially iOS Safari) and some desktop browsers suspend the `AudioContext` when the tab loses focus, the device sleeps, or the PWA is backgrounded. Unlike the initial autoplay lock, resumption is NOT automatic — Phaser does not restore a suspended context on tab re-focus.

**Symptoms:** Music stops abruptly when the user switches tabs and returns. No error in console. `this.sound.locked` is `false` (context was unlocked previously) but audio is still silent.

**Fix — resume the context on visibility change:**

```typescript
// In PreloaderScene.create() or main.ts, after game is initialized:
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    const mgr = this.sound as Phaser.Sound.WebAudioSoundManager;
    if (mgr.context?.state === 'suspended') {
      mgr.context.resume();
    }
  }
});
```

**Alternative — use Phaser's built-in focus event:**

```typescript
this.game.events.on(Phaser.Core.Events.FOCUS, () => {
  const mgr = this.sound as Phaser.Sound.WebAudioSoundManager;
  if (mgr.context?.state === 'suspended') {
    mgr.context.resume();
  }
});
```

Check `mgr.context?.state` before calling `resume()` — calling it when already `'running'` is a no-op, but calling it when `'closed'` throws.

**AudioContext states:**
| State | Meaning |
|---|---|
| `'running'` | Audio playing normally |
| `'suspended'` | Paused (tab hidden, device sleep) — call `resume()` |
| `'closed'` | Permanently closed — create a new game instance |

## Crossfading Music Between Scenes

Abrupt music cuts sound amateurish. Fade out the old track in the outgoing scene, fade in the new track in the incoming scene.

```typescript
// --- In OutgoingScene.shutdown() ---
shutdown(): void {
  if (this.bgMusic?.isPlaying) {
    this.tweens.add({
      targets: this.bgMusic,
      volume:  0,
      duration: 500,
      onComplete: () => this.bgMusic.stop(),
    });
  }
}

// --- In IncomingScene.create() ---
create(): void {
  this.bgMusic = this.sound.add('music-new', { loop: true, volume: 0 });
  this.bgMusic.play();
  this.tweens.add({
    targets:  this.bgMusic,
    volume:   0.6,
    duration: 800,
    ease:     'Linear',
  });
}
```

Note: `this.tweens` can tween any numeric property on any object, including `sound.volume`. No special audio tween API is needed.

## Stopping Sounds on Scene Shutdown

The SoundManager is global and sounds are not cleaned up on scene shutdown. Prefer stopping only the sounds the current scene owns on scene transitions; reserve `stopAll()` for top-level game exit or between completely unrelated game states.

```typescript
shutdown(): void {
  // If music belongs to this scene only
  this.bgMusic?.stop();
  // If this is a top-level scene and you want to silence everything:
  // this.sound.stopAll();
}
```
