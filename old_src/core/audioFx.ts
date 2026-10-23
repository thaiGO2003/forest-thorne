const NOTE: Record<string, number> = {
  click: 440,
  buy: 620,
  hit: 280,
  skill: 760,
  heal: 520,
  ko: 180
};

const SFX_KEY: Record<string, string> = {
  click: "sfx_key",
  buy: "sfx_blaster",
  hit: "sfx_sword",
  skill: "sfx_shot",
  heal: "sfx_ping",
  ko: "sfx_explosion"
};

const AUDIO_RESUME_STORAGE_KEY = "forest_throne_audio_resume_v1";
const AUDIO_RESUME_STORE_VERSION = 1;

type AnySound = {
  setMute?: (v: boolean) => void;
  setVolume?: (v: number) => void;
  setLoop?: (v: boolean) => void;
  loop?: boolean;
  volume?: number;
  isPlaying?: boolean;
  play?: (config?: unknown) => void;
  stop?: () => void;
  destroy?: () => void;
  once?: (event: string, cb: () => void) => void;
  seek?: number;
};

interface PlayConfig {
  seek: number;
}

interface PlaylistState {
  order: string[];
  index: number;
  playConfig: PlayConfig | null;
}

interface PlaylistOptions {
  loopCurrentTrack: boolean;
}

interface BgmEntry {
  key: string;
  sound: AnySound | null;
  baseVolume: number;
  resumeKey?: string | null;
  pendingPlayConfig?: PlayConfig | null;
  playlistId?: string;
  playlistKeys?: string[];
  playlistSignature?: string;
  playlistOrder?: string[];
  currentIndex?: number;
  currentTrackKey?: string | null;
  shuffle?: boolean;
  loopCurrentTrack?: boolean;
  playlistState?: PlaylistState;
  __forestReplayQueued?: boolean;
  weightsMap?: Record<string, number>;
}

interface AudioResumeStore {
  version: number;
  entries: Record<string, unknown>;
}

interface AudioResumeState {
  playlistOrder?: unknown;
  currentIndex?: unknown;
  trackKey?: unknown;
  seek?: unknown;
}

interface AudioGameLike {
  __forestVolumeLevel?: number;
  __forestBgm?: BgmEntry | null;
  sound?: {
    context?: {
      currentTime: number;
      createOscillator?: () => unknown;
      createGain?: () => unknown;
      destination?: unknown;
    };
    locked?: boolean;
    add?: (key: string, config?: unknown) => AnySound;
    play?: (key: string, config?: unknown) => void;
    once?: (event: string, cb: () => void) => void;
  };
  input?: {
    once?: (event: string, cb: () => void) => void;
    keyboard?: { once?: (event: string, cb: () => void) => void };
  };
  cache?: { audio?: { exists?: (key: string) => boolean } };
}

interface AudioSceneLike {
  game?: AudioGameLike;
  sound?: {
    context?: {
      currentTime: number;
      createOscillator?: () => unknown;
      createGain?: () => unknown;
      destination?: unknown;
    };
    locked?: boolean;
    add?: (key: string, config?: unknown) => AnySound;
    play?: (key: string, config?: unknown) => void;
    once?: (event: string, cb: () => void) => void;
  };
  input?: {
    once?: (event: string, cb: () => void) => void;
    keyboard?: { once?: (event: string, cb: () => void) => void };
  };
  cache?: { audio?: { exists?: (key: string) => boolean } };
}

const shuffleList = (items: string[]): string[] => {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
};

const getPlaylistSignature = (playlistId: string, keys: string[]): string => `${playlistId}::${[...keys].sort().join("|")}`;
const getSingleBgmResumeKey = (key: unknown): string | null => (typeof key === "string" && key ? `track:${key}` : null);
const getPlaylistResumeKey = (playlistId: unknown, signature: unknown): string | null => (
  typeof playlistId === "string" && playlistId && typeof signature === "string" && signature
    ? `playlist:${playlistId}::${signature}`
    : null
);

function getStorage(storage: Storage | null = globalThis?.localStorage): Storage | null {
  return storage && typeof storage.getItem === "function" && typeof storage.setItem === "function"
    ? storage
    : null;
}

function createEmptyAudioResumeStore(): AudioResumeStore {
  return {
    version: AUDIO_RESUME_STORE_VERSION,
    entries: {}
  };
}

function readAudioResumeStore(storage: Storage | null = globalThis?.localStorage): AudioResumeStore {
  const target = getStorage(storage);
  if (!target) return createEmptyAudioResumeStore();
  try {
    const raw = target.getItem(AUDIO_RESUME_STORAGE_KEY);
    if (!raw) return createEmptyAudioResumeStore();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return createEmptyAudioResumeStore();
    const obj = parsed as Record<string, unknown>;
    return {
      version: AUDIO_RESUME_STORE_VERSION,
      entries: obj.entries && typeof obj.entries === "object" ? obj.entries as Record<string, unknown> : {}
    };
  } catch {
    return createEmptyAudioResumeStore();
  }
}

function writeAudioResumeStore(store: AudioResumeStore, storage: Storage | null = globalThis?.localStorage): boolean {
  const target = getStorage(storage);
  if (!target) return false;
  try {
    target.setItem(AUDIO_RESUME_STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

function readStoredAudioResumeState(resumeKey: string, storage: Storage | null = globalThis?.localStorage): unknown {
  if (typeof resumeKey !== "string" || !resumeKey) return null;
  const store = readAudioResumeStore(storage);
  const entry = store.entries?.[resumeKey];
  return entry && typeof entry === "object" ? entry : null;
}

function writeStoredAudioResumeState(resumeKey: string, state: unknown, storage: Storage | null = globalThis?.localStorage): boolean {
  if (typeof resumeKey !== "string" || !resumeKey) return false;
  const store = readAudioResumeStore(storage);
  if (state && typeof state === "object") {
    store.entries[resumeKey] = state as Record<string, unknown>;
  } else {
    delete store.entries[resumeKey];
  }
  return writeAudioResumeStore(store, storage);
}

function clampSeekSeconds(value: unknown): number {
  const safe = Number(value);
  return Number.isFinite(safe) && safe > 0 ? safe : 0;
}

function buildResumePlayConfig(state: unknown): PlayConfig | null {
  if (!state || typeof state !== "object") return null;
  const seek = clampSeekSeconds((state as { seek?: unknown }).seek);
  return seek > 0 ? { seek } : null;
}

function normalizePlayConfig(playConfig: unknown): PlayConfig | null {
  if (!playConfig || typeof playConfig !== "object") return null;
  const seek = clampSeekSeconds((playConfig as { seek?: unknown }).seek);
  return seek > 0 ? { seek } : null;
}

function getSoundSeekSeconds(sound: AnySound | null | undefined): number {
  const seek = Number(sound?.seek);
  return Number.isFinite(seek) && seek >= 0 ? seek : 0;
}

function normalizePlaylistOrderForResume(order: unknown, validKeys: string[]): string[] {
  const safeKeys = [...new Set((validKeys || []).filter((key) => typeof key === "string" && key))];
  if (safeKeys.length === 0) return [];

  const safeSet = new Set(safeKeys);
  const storedOrder = Array.isArray(order)
    ? (order as unknown[]).filter((key): key is string => typeof key === "string" && safeSet.has(key))
    : [];
  const dedupedOrder = [...new Set(storedOrder)];
  const remaining = safeKeys.filter((key) => !dedupedOrder.includes(key));
  return [...dedupedOrder, ...remaining];
}

function resolvePlaylistResumeState(storedState: unknown, validKeys: string[], shuffle: boolean): PlaylistState {
  const order = normalizePlaylistOrderForResume((storedState as { playlistOrder?: unknown })?.playlistOrder, validKeys);
  const resolvedOrder = order.length > 0 ? order : (shuffle ? shuffleList([...validKeys]) : [...validKeys]);
  if (resolvedOrder.length === 0) {
    return {
      order: [],
      index: 0,
      playConfig: null
    };
  }

  const storedTrackKey = typeof (storedState as { trackKey?: unknown })?.trackKey === "string"
    ? (storedState as { trackKey?: unknown }).trackKey as string
    : null;
  let index: number = Number.isFinite((storedState as { currentIndex?: unknown })?.currentIndex)
    ? Math.floor((storedState as { currentIndex?: unknown }).currentIndex as number)
    : 0;
  index = Math.min(resolvedOrder.length - 1, Math.max(0, index));
  if (storedTrackKey && resolvedOrder.includes(storedTrackKey)) {
    index = resolvedOrder.indexOf(storedTrackKey);
  }

  return {
    order: resolvedOrder,
    index,
    playConfig: buildResumePlayConfig(storedState)
  };
}

function normalizePlaylistOptions(options: { loopCurrentTrack?: boolean } | null | undefined): PlaylistOptions {
  return {
    loopCurrentTrack: options?.loopCurrentTrack === true
  };
}

export class AudioFx {
  scene: AudioSceneLike;
  enabled: boolean;
  volumeLevel: number;

  constructor(scene: AudioSceneLike) {
    this.scene = scene;
    this.enabled = true;
    const game = this.scene?.game;
    const seedLevel = game?.__forestVolumeLevel !== undefined
      ? Math.floor(game.__forestVolumeLevel)
      : 10;
    this.volumeLevel = Math.min(10, Math.max(1, seedLevel));
  }

  setEnabled(value: boolean) {
    try {
      this.enabled = value !== false;
      const globalBgm = this.scene?.game?.__forestBgm;
      if (globalBgm?.sound) globalBgm.sound.setMute?.(!this.enabled);
    } catch {
      console.warn("Audio mute failed:");
    }
  }

  setVolumeLevel(level: number) {
    try {
      const safe = Math.min(10, Math.max(1, Math.floor(Number(level) || 10)));
      this.volumeLevel = safe;
      if (this.scene?.game) this.scene.game.__forestVolumeLevel = safe;
      const globalBgm = this.scene?.game?.__forestBgm;
      if (globalBgm?.sound) {
        const baseVolume = Number.isFinite(globalBgm.baseVolume) ? globalBgm.baseVolume : 0.2;
        globalBgm.sound.setVolume?.(baseVolume * this.getMasterVolume());
      }
    } catch {
      console.warn("Audio volume update failed:");
    }
  }

  getVolumeLevel(): number {
    return this.volumeLevel;
  }

  getMasterVolume(): number {
    return this.volumeLevel / 10;
  }

  queueActiveBgmReplay(entry: BgmEntry) {
    try {
      if (!entry?.sound) return;

      const game = this.scene?.game;
      if (!game?.__forestBgm || game.__forestBgm !== entry || entry.sound.isPlaying) return;

      const soundManager = this.scene?.sound;
      if (!soundManager?.locked) {
        if (this.tryPlayEntry(entry)) {
          entry.__forestReplayQueued = false;
          return;
        }
      }

      if (entry.__forestReplayQueued) return;
      entry.__forestReplayQueued = true;

      const replay = () => {
        entry.__forestReplayQueued = false;
        this.queueActiveBgmReplay(entry);
      };

      if (typeof soundManager?.once === "function") soundManager.once("unlocked", replay);
      if (typeof this.scene?.input?.once === "function") this.scene.input.once("pointerdown", replay);
      if (typeof this.scene?.input?.keyboard?.once === "function") this.scene.input.keyboard.once("keydown", replay);
    } catch {
      console.warn("Audio replay queue failed:");
    }
  }

  tryPlayEntry(entry: BgmEntry, playConfig: PlayConfig | null = null): boolean {
    if (!entry?.sound) return false;

    const normalizedPlayConfig = normalizePlayConfig(playConfig);
    if (normalizedPlayConfig) {
      entry.pendingPlayConfig = normalizedPlayConfig;
    } else if (!entry.pendingPlayConfig || typeof entry.pendingPlayConfig !== "object") {
      entry.pendingPlayConfig = null;
    }

    const nextPlayConfig = normalizePlayConfig(entry.pendingPlayConfig);
    if (nextPlayConfig) {
      entry.sound.play?.(nextPlayConfig);
    } else {
      entry.sound.play?.();
    }

    if (entry.sound.isPlaying) {
      entry.pendingPlayConfig = null;
      return true;
    }

    return false;
  }

  getResumeKeyForEntry(entry: BgmEntry | null): string | null {
    if (!entry || typeof entry !== "object") return null;
    if (typeof entry.resumeKey === "string" && entry.resumeKey) return entry.resumeKey;
    if (entry.playlistId && entry.playlistSignature) {
      return getPlaylistResumeKey(entry.playlistId, entry.playlistSignature);
    }
    if (typeof entry.key === "string" && entry.key && entry.key !== "playlist" && entry.key !== "weighted_playlist") {
      return getSingleBgmResumeKey(entry.key);
    }
    return null;
  }

  persistEntryResumeState(entry: BgmEntry): boolean {
    const resumeKey = this.getResumeKeyForEntry(entry);
    if (!resumeKey || !entry?.sound) return false;

    const updatedAt = Date.now();
    const seek = getSoundSeekSeconds(entry.sound);
    if (entry.playlistId && entry.playlistSignature) {
      const playlistOrder = normalizePlaylistOrderForResume(entry.playlistOrder, entry.playlistKeys ?? []);
      const currentTrackKey = typeof entry.currentTrackKey === "string"
        ? entry.currentTrackKey
        : playlistOrder[Math.max(0, Math.min(playlistOrder.length - 1, Math.floor(entry.currentIndex ?? 0)))];
      const currentIndex = currentTrackKey && playlistOrder.includes(currentTrackKey)
        ? playlistOrder.indexOf(currentTrackKey)
        : Math.max(0, Math.min(playlistOrder.length - 1, Math.floor(entry.currentIndex ?? 0)));
      return writeStoredAudioResumeState(resumeKey, {
        type: "playlist",
        playlistId: entry.playlistId,
        playlistSignature: entry.playlistSignature,
        playlistOrder,
        currentIndex,
        trackKey: currentTrackKey ?? null,
        seek,
        updatedAt
      });
    }

    return writeStoredAudioResumeState(resumeKey, {
      type: "single",
      key: entry.key,
      seek,
      updatedAt
    });
  }

  startBgm(key: string, volume = 0.2) {
    try {
      const game = this.scene?.game;
      if (!game) return;
      const resumeKey = getSingleBgmResumeKey(key);
      const current = game.__forestBgm;
      if (current?.key === key && current?.sound) {
        current.sound.setMute?.(!this.enabled);
        current.baseVolume = volume;
        current.resumeKey = resumeKey;
        current.sound.setVolume?.(volume * this.getMasterVolume());
        if (!current.sound.isPlaying) this.queueActiveBgmReplay(current);
        return;
      }
      this.stopBgm();
      if (!this.scene.cache?.audio?.exists?.(key)) return;
      const playConfig = buildResumePlayConfig(resumeKey ? readStoredAudioResumeState(resumeKey) : null);
      const sound = this.scene.sound?.add?.(key, { loop: true, volume: volume * this.getMasterVolume(), mute: !this.enabled });
      if (!sound) return;
      const entry: BgmEntry = {
        key,
        sound,
        baseVolume: volume,
        resumeKey,
        pendingPlayConfig: playConfig
      };
      game.__forestBgm = entry;
      this.tryPlayEntry(entry, playConfig);
      if (!sound.isPlaying) this.queueActiveBgmReplay(entry);
    } catch {
      console.warn("Audio playback failed:");
    }
  }

  startNamedPlaylist(playlistId: string, keys: string[], volume = 0.2, shuffle = true, options: { loopCurrentTrack?: boolean } = {}) {
    try {
      const game = this.scene?.game;
      if (!game || !playlistId || !keys?.length) return;

      const validKeys = keys.filter((key) => this.scene.cache?.audio?.exists?.(key) ?? false);
      if (validKeys.length === 0) return;
      const playlistOptions = normalizePlaylistOptions(options);

      const signature = getPlaylistSignature(playlistId, validKeys);
      const resumeKey = getPlaylistResumeKey(playlistId, signature);
      const updatePlaylistEntryState = (entry: BgmEntry, state: PlaylistState) => {
        if (!entry || !state) return;
        entry.playlistState = state;
        entry.playlistOrder = [...state.order];
        entry.currentIndex = state.index;
        entry.currentTrackKey = state.order[state.index] ?? entry.currentTrackKey ?? null;
      };

      const current = game.__forestBgm;
      if (current?.sound && current.playlistId === playlistId) {
        const currentTrackKey = typeof current.currentTrackKey === "string" ? current.currentTrackKey : null;
        const nextState = resolvePlaylistResumeState({
          playlistOrder: current.playlistState?.order ?? current.playlistOrder,
          currentIndex: current.currentIndex,
          trackKey: currentTrackKey
        }, validKeys, shuffle);

        if (currentTrackKey && nextState.order.includes(currentTrackKey)) {
          nextState.index = nextState.order.indexOf(currentTrackKey);
        }

        if (current.playlistSignature === signature || (currentTrackKey && validKeys.includes(currentTrackKey))) {
          current.sound.setMute?.(!this.enabled);
          current.baseVolume = volume;
          current.shuffle = shuffle;
          current.playlistId = playlistId;
          current.playlistKeys = [...validKeys];
          current.playlistSignature = signature;
          current.resumeKey = resumeKey;
          current.loopCurrentTrack = playlistOptions.loopCurrentTrack;
          if (typeof current.sound.setLoop === "function") current.sound.setLoop(playlistOptions.loopCurrentTrack);
          else current.sound.loop = playlistOptions.loopCurrentTrack === true;
          updatePlaylistEntryState(current, nextState);
          current.sound.setVolume?.(volume * this.getMasterVolume());
          if (!current.sound.isPlaying) this.queueActiveBgmReplay(current);
          return;
        }
      }

      this.stopBgm();

      const savedResumeKey = resumeKey ?? "";
      const storedState = readStoredAudioResumeState(savedResumeKey);
      const initialState = resolvePlaylistResumeState(storedState, validKeys, shuffle);

      const playTrack = (entry: BgmEntry) => {
        try {
          if (!this.scene?.game) return;
          const state = entry.playlistState ?? resolvePlaylistResumeState(null, entry.playlistKeys ?? [], entry.shuffle ?? false);
          if (state.index >= state.order.length) {
            state.order = entry.shuffle ? shuffleList([...entry.playlistKeys ?? []]) : [...entry.playlistKeys ?? []];
            state.index = 0;
          }

          const trackKey = state.order[state.index] ?? null;
          if (!trackKey) return;
          const sound = this.scene.sound?.add?.(trackKey, {
            loop: entry.loopCurrentTrack,
            volume: entry.baseVolume * this.getMasterVolume(),
            mute: !this.enabled
          }) ?? null;
          if (!sound) return;
          entry.sound = sound;
          entry.pendingPlayConfig = state.playConfig;
          updatePlaylistEntryState(entry, state);
          this.scene.game.__forestBgm = entry;

          this.tryPlayEntry(entry, state.playConfig);
          if (!sound.isPlaying) this.queueActiveBgmReplay(entry);
          if (!entry.loopCurrentTrack) {
            sound.once?.("complete", () => {
              const nextState = entry.playlistState ?? state;
              nextState.playConfig = null;
              nextState.index += 1;
              playTrack(entry);
            });
          }
        } catch {
          console.warn("Audio playlist item playback failed:");
        }
      };

      const entry: BgmEntry = {
        key: "playlist",
        sound: null,
        baseVolume: volume,
        playlistId,
        playlistKeys: [...validKeys],
        playlistSignature: signature,
        playlistOrder: [...initialState.order],
        currentIndex: initialState.index,
        currentTrackKey: initialState.order[initialState.index] ?? null,
        shuffle,
        loopCurrentTrack: playlistOptions.loopCurrentTrack,
        resumeKey,
        pendingPlayConfig: initialState.playConfig,
        playlistState: {
          order: [...initialState.order],
          index: initialState.index,
          playConfig: initialState.playConfig
        }
      };

      playTrack(entry);
    } catch {
      console.warn("Audio playlist playback failed:");
    }
  }

  stopBgm() {
    try {
      const game = this.scene?.game;
      const current = game?.__forestBgm;
      if (!current?.sound) return;
      this.persistEntryResumeState(current);
      current.sound.stop?.();
      current.sound.destroy?.();
      if (game) game.__forestBgm = null;
    } catch {
      console.warn("Audio stop failed:");
    }
  }

  playPlaylist(keys: string[] | null, volume = 0.2, shuffle = true) {
    try {
      this.startNamedPlaylist(`__playlist__:${[...(keys || [])].sort().join("|")}`, keys ?? [], volume, shuffle);
    } catch {
      console.warn("Audio playlist playback failed:");
    }
  }

  playWeightedPlaylist(weightsMap: Record<string, number>, volume = 0.2) {
    try {
      if (!weightsMap || Object.keys(weightsMap).length === 0) return;
      const game = this.scene?.game;
      this.stopBgm();

      const playNext = () => {
        try {
          if (!this.scene?.game) return;
          const keys = Object.keys(weightsMap).filter((k) => this.scene?.cache?.audio?.exists?.(k) ?? false);
          if (keys.length === 0) return;

          const totalWeight = keys.reduce((sum, k) => sum + weightsMap[k], 0);
          let random = Math.random() * totalWeight;
          let selectedKey = keys[0];

          for (const key of keys) {
            if (random < weightsMap[key]) {
              selectedKey = key;
              break;
            }
            random -= weightsMap[key];
          }

          const sound = this.scene.sound?.add?.(selectedKey, { volume: volume * this.getMasterVolume(), mute: !this.enabled });
          if (!sound) return;
          sound.play?.();
          sound.once?.("complete", () => playNext());

          if (game) game.__forestBgm = { key: "weighted_playlist", sound, baseVolume: volume, weightsMap };
        } catch {
          console.warn("Audio weighted playlist item playback failed:");
        }
      };

      playNext();
    } catch {
      console.warn("Audio weighted playlist playback failed:");
    }
  }

  play(type: string, duration = 0.08) {
    if (!this.enabled) return;
    try {
      const master = this.getMasterVolume();
      const key = (SFX_KEY as Record<string, string>)[type];
      if (key && this.scene?.cache?.audio?.exists?.(key)) {
        this.scene.sound?.play?.(key, { volume: (type === "ko" ? 0.26 : 0.18) * master });
        return;
      }

      const game = this.scene?.game;
      const context = game?.sound?.context;
      if (!context) return;

      const now = context.currentTime;
      const oscillator = context.createOscillator?.();
      const gainNode = context.createGain?.();
      const oscFreqValue = (oscillator as { frequency?: { value: number } })?.frequency;
      const gainValue = (gainNode as { gain?: { setValueAtTime?: (v: number, t: number) => void; exponentialRampToValueAtTime?: (v: number, t: number) => void } })?.gain;
      if (oscFreqValue) oscFreqValue.value = NOTE[type] ?? 420;
      if (gainValue) {
        gainValue.setValueAtTime?.(0.001, now);
        gainValue.exponentialRampToValueAtTime?.(0.06 * master, now + 0.01);
        gainValue.exponentialRampToValueAtTime?.(0.0001, now + duration);
      }
      (oscillator as { connect?: (n: unknown) => void })?.connect?.(gainNode);
      (gainNode as { connect?: (n: unknown) => void })?.connect?.(context.destination);
      (oscillator as { start?: (t: number) => void })?.start?.(now);
      (oscillator as { stop?: (t: number) => void })?.stop?.(now + duration + 0.01);
    } catch {
      console.warn("Audio playback failed:");
    }
  }
}
