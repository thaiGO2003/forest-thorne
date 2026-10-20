# Phaser 4 Timeline API Reference

`this.tweens.timeline(config)` sequences multiple tweens with per-tween `offset` control. The tween API itself (TweenManager, TweenBuilderConfig, TweenPropConfig, tween instance methods) is documented in the `tweens` skill; only the timeline-specific surface is kept here.

## TimelineBuilderConfig

`Phaser.Types.Tweens.TimelineBuilderConfig`

```typescript
interface TimelineBuilderConfig {
  tweens:     TweenBuilderConfig[];   // REQUIRED — ordered list of tween configs
  targets?:   any;                    // default targets for all tweens (overridden per-tween)
  totalDuration?: number;             // scale all tweens to fit this total duration
  ease?:      string;                 // default ease for all tweens
  easeParams?: number[];
  delay?:     number;
  loop?:      number;
  loopDelay?: number;
  yoyo?:      boolean;
  flipX?:     boolean;
  flipY?:     boolean;
  completeDelay?: number;
  paused?:    boolean;
  persist?:   boolean;
  callbackScope?: any;
  onStart?:   TweenOnStartCallback;
  onUpdate?:  TweenOnUpdateCallback;
  onLoop?:    TweenOnLoopCallback;
  onYoyo?:    TweenOnYoyoCallback;
  onComplete?: TweenOnCompleteCallback;
}
```

### Tween `offset` in Timelines

| Value | Behavior |
|-------|----------|
| `undefined` / `null` | Start after previous tween ends |
| `'-=200'` | Start 200ms before previous ends (overlap) |
| `'+=200'` | Start 200ms after previous ends (gap) |
| `500` (absolute number) | Start at 500ms from timeline start |
| `0` | Start at the very beginning of the timeline |

### Timeline Instance Methods

| Method | Description |
|--------|-------------|
| `play()` | Start the timeline if created with `paused: true`. |
| `pause()` | Pause all tweens in the timeline. |
| `resume()` | Resume all tweens. |
| `stop()` | Stop the timeline. |
| `destroy()` | Destroy the timeline and all its tweens. |
| `getTotalDuration()` | Get total calculated duration in ms. |
