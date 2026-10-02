import { describe, expect, it } from "vitest";
import {
  MUSIC_GLOBAL_SCALE,
  pickWeightedTrack,
  restorePlaylistOrder,
  normalizeMusicContinuity,
} from "../src/audio/MusicDirector";
import {
  normalizeSfxEvent,
  normalizedMasterVolume,
} from "../src/audio/SoundEffects";
import {
  CombatSpeechAnnouncer,
  combatSpeechKey,
  combatSpeechText,
  type CombatSpeechEvent,
} from "../src/core/combatSpeech";

describe("music continuity and selection", () => {
  it("repairs saved playlist order against authored changes and follows current track identity", () => {
    const playlist = { id: "menu", tracks: ["a", "b", "c"], shuffle: true };
    const restored = restorePlaylistOrder(playlist, {
      signature: "old",
      order: ["gone", "b", "b", "a"],
      currentIndex: 0,
      currentTrack: "a",
      seek: 12,
    }, () => 0.5);
    expect(restored).toEqual({ order: ["b", "a", "c"], index: 1 });
  });

  it("normalizes corrupt continuity and invalid seek values safely", () => {
    expect(normalizeMusicContinuity({
      seeks: { good: 12.5, zero: 0, negative: -2, bad: "x" },
      playlists: {
        menu: {
          signature: 2,
          order: ["a", "", 3, "a"],
          currentIndex: -5,
          currentTrack: " a ",
          seek: Number.POSITIVE_INFINITY,
        },
      },
    })).toEqual({
      version: 1,
      seeks: { good: 12.5 },
      playlists: {
        menu: {
          signature: "",
          order: ["a", "a"],
          currentIndex: 0,
          currentTrack: "a",
          seek: 0,
        },
      },
    });
  });

  it("keeps weighted selection proportional and ignores unavailable/non-positive keys", () => {
    const weights = { a: 1, b: 3, missing: 100, zero: 0 };
    expect(pickWeightedTrack(weights, ["a", "b"], () => 0)).toBe("a");
    expect(pickWeightedTrack(weights, ["a", "b"], () => 0.5)).toBe("b");
    expect(pickWeightedTrack({ missing: 1 }, ["a"], () => 0)).toBeNull();
  });
});

describe("semantic SFX", () => {
  it("normalizes compatibility aliases before dispatch", () => {
    expect(normalizeSfxEvent("attack")).toBe("hit");
    expect(normalizeSfxEvent("shop_buy")).toBe("buy");
    expect(normalizeSfxEvent("BUY_UNIT")).toBe("buy");
    expect(normalizeSfxEvent("loss")).toBe("defeat");
    expect(normalizeSfxEvent("unknown")).toBeNull();
  });

  it("uses the canonical settings-owned master scale", () => {
    expect(normalizedMasterVolume({ audioEnabled: true, audioMuted: false, volumeLevel: 5 })).toBe(0.5);
    expect(normalizedMasterVolume({ audioEnabled: false, audioMuted: false, volumeLevel: 10 })).toBe(0);
    expect(normalizedMasterVolume({ audioEnabled: true, audioMuted: true, volumeLevel: 10 })).toBe(0);
    expect(MUSIC_GLOBAL_SCALE * normalizedMasterVolume({
      audioEnabled: true,
      audioMuted: false,
      volumeLevel: 10,
    })).toBe(0.45);
  });
});

describe("combat speech announcements", () => {
  const attack: CombatSpeechEvent = {
    kind: "basic_attack",
    unitId: "u1",
    unitName: "Sói *Đỏ*",
    side: "LEFT",
  };

  it("builds stable keys and sanitized Vietnamese announcements", () => {
    expect(combatSpeechKey(attack)).toBe("attack:u1");
    expect(combatSpeechText(attack)).toBe("Sói Đỏ phe ta đánh thường");
    expect(combatSpeechText({
      kind: "death",
      unitId: "e1",
      unitName: "Nhện",
      side: "RIGHT",
    })).toBe("Nhện phe địch bị tiêu diệt");
  });

  it("applies gap, same-key and higher-priority interrupt rules", () => {
    let now = 1_000;
    const spoken: { text: string; cancelCurrent?: boolean }[] = [];
    const announcer = new CombatSpeechAnnouncer((text, options) => {
      spoken.push({ text, cancelCurrent: options.cancelCurrent });
      return true;
    }, () => now);

    expect(announcer.announce(attack)).toBe(true);
    now += 150;
    expect(announcer.announce({
      kind: "death",
      unitId: "e1",
      unitName: "Nhện",
      side: "RIGHT",
    })).toBe(true);
    expect(spoken.at(-1)?.cancelCurrent).toBe(true);

    now += 200;
    expect(announcer.announce(attack)).toBe(false);
    now = 2_700;
    expect(announcer.announce(attack)).toBe(true);
    now += 1_000;
    expect(announcer.announce(attack)).toBe(false);
    now += 700;
    expect(announcer.announce(attack)).toBe(true);
  });

  it("suppresses the same key across intervening announcements", () => {
    let now = 10_000;
    const announcer = new CombatSpeechAnnouncer(() => true, () => now);
    expect(announcer.announce(attack)).toBe(true);
    now += 200;
    expect(announcer.announce({
      kind: "death",
      unitId: "e2",
      unitName: "Ong",
      side: "RIGHT",
    })).toBe(true);
    now += 1_200;
    expect(announcer.announce(attack)).toBe(false);
    now += 201;
    expect(announcer.announce(attack)).toBe(true);
  });

  it("advances rate-limit state only when speech successfully queues", () => {
    let now = 5_000;
    let attempts = 0;
    const announcer = new CombatSpeechAnnouncer(() => {
      attempts++;
      return attempts > 1;
    }, () => now);
    expect(announcer.announce(attack)).toBe(false);
    now += 1;
    expect(announcer.announce(attack)).toBe(true);
  });
});
