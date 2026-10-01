---
name: threejs-animation
description: Implement Three.js AnimationMixer/AnimationAction workflows and procedural unit motion. Use for idle, move, attack, skill, hit-impact, take-hit, clip blending, action preview, animation timing, or articulated low-poly rigs.
---

# Animation

Choose the mechanism by source:

- Imported clip: use `AnimationMixer` + `AnimationAction`.
- Procedural articulated rig: animate named pivots/parts from a deterministic controller.
- Short VFX motion: use a small time-based state machine or existing tween utility; do not create unmanaged RAF loops.

## Mixer workflow

1. Keep one mixer per independently animated root.
2. Advance mixers with delta seconds from the main loop.
3. Resolve actions once and cache them; do not call setup logic every frame.
4. Cross-fade intentionally; reset/play only when entering a new action.
5. On teardown, stop actions and uncache roots/clips when they are instance-owned.

## Procedural action contract

- Capture a neutral/base pose.
- Derive every frame from base pose + action time so repeated previews do not accumulate transform drift.
- Keep action names semantically distinct: idle, move, attack, skill, hit-impact, take-hit.
- Loop preview actions only where UX requests looping; combat actions should retain gameplay timing.
- Use normalized action progress when syncing projectiles, impact VFX, and sound.

## Forest Throne

- Library action preview must exercise the same production animation behavior as combat where possible.
- Preserve per-unit recognizable idle signatures.
- Flying/water-native environmental motion belongs in visual behavior, not core combat state.
- Do not merge `hit-impact` and `take-hit`; attacker impact and victim reaction are different events.

## Test for

pose reset, repeat-loop stability, missing named rig parts, action interruption, scene transition cleanup, and identical animation speed across refresh rates.
