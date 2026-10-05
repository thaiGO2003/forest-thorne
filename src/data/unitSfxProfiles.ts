export interface UnitSfxProfile {
  waveform: OscillatorType;
  pitch: number;
}

export const DEFAULT_UNIT_SFX_PROFILE: UnitSfxProfile = {
  waveform: "sine",
  pitch: 1,
};

export const UNIT_SFX_PROFILES: Readonly<Record<string, UnitSfxProfile>> = {
  crane_blessing: { waveform: "triangle", pitch: 1.08 },
  deer_song: { waveform: "sine", pitch: 1.12 },
  wolf: { waveform: "sawtooth", pitch: 0.9 },
  jaguar: { waveform: "square", pitch: 0.95 },
  spider: { waveform: "triangle", pitch: 1.18 },
};

export function resolveUnitSfxProfile(unitId: string | null | undefined): UnitSfxProfile {
  if (!unitId) return DEFAULT_UNIT_SFX_PROFILE;
  return UNIT_SFX_PROFILES[unitId] ?? DEFAULT_UNIT_SFX_PROFILE;
}
