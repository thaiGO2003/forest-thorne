---
name: threejs-audio
description: Integrate Three.js AudioListener, Audio, PositionalAudio, sound positioning, and audio lifecycle. Use for world-space SFX, listener/camera attachment, 3D attenuation, or debugging Three.js audio nodes; coordinate with the project's existing audio system rather than replacing it blindly.
---

# Three.js Audio

First inspect the existing Forest Throne audio service. Use Three.js audio only when spatial/world coupling is needed.

## Spatial workflow

- Attach one `AudioListener` to the active camera.
- Use `PositionalAudio` for world sources that need attenuation/panning.
- Tune reference distance, max distance, rolloff, and directional cones at the game's world scale.
- Reuse decoded buffers where possible.

## Browser constraints

AudioContext playback usually requires a user gesture. Do not treat autoplay rejection as a Three.js rendering failure.

## Lifecycle

Stop/disconnect transient sounds on scene teardown. Remove listener/source nodes and avoid creating duplicate listeners across camera changes.

## Forest Throne

Keep music and ordinary combat/UI SFX in the existing production audio ownership unless there is a clear spatial-audio requirement. Do not reintroduce removed narration/voice behavior while adding combat sounds.
