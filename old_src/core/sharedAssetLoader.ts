// ═══════════════════════════════════════════════════════════════
// sharedAssetLoader.ts - Quản lý tải audio + assets dùng chung
// Ưu tiên OGG thực tế trong repo + lazy loading theo scene
// ═══════════════════════════════════════════════════════════════
import { FOREST_BACKGROUND_ASSETS } from "../data/forestBackgrounds.js";
import { TRIBUTE_CREDITS } from "../data/tributeCredits.js";
import { audioTrackIndex } from "../generated/audioTrackIndex.temp.js";
import type { AudioFx } from "./audioFx.js";
import { queueEmojiAssets } from "./emojiAtlas.js";

const MENU_STARTUP_TRACK_SOURCE = "assets/audio/main-screen/Dũng CT cười lofi cực ấm, nhẹ nhàng và dễ ngủ.ogg";
const PLANNING_STARTUP_TRACK_SOURCE = "assets/audio/plan-screen/vprodmusic_asia_bgm-tet-nguyen-an-viet-nam-edm-184076.mp3";
const COMBAT_FALLBACK_TRACK_SOURCE = "assets/audio/battle-screen/Khúc Trống Núi.mp3";

// ─── Audio cần thiết khi khởi động (SFX nhẹ) ───
const ESSENTIAL_AUDIO: Array<[string, string]> = [
  ["sfx_key", "assets/audio/key.ogg"],
  ["sfx_explosion", "assets/audio/explosion.ogg"],
  ["sfx_blaster", "assets/audio/blaster.ogg"],
  ["sfx_sword", "assets/audio/sword.ogg"],
  ["sfx_ping", "assets/audio/p-ping.ogg"],
  ["sfx_shot", "assets/audio/shot1.ogg"]
];

// ─── Types ───
interface AudioSource {
  key: string;
  stem: string;
  folder: string;
  sources: string[];
}

type SceneFolderName = "menu" | "planning" | "combat";

interface DeferredOptions {
  onSettled?: () => void;
}

interface PhaserSceneLike {
  cache?: {
    audio?: { exists?: (key: string) => boolean };
    video?: { exists?: (key: string) => boolean };
  };
  textures: { exists: (key: string) => boolean };
  load: {
    audio: (key: string, source: string | string[]) => void;
    image: (key: string, path: string) => void;
    svg: (key: string, path: string, size?: { width: number; height: number }) => void;
    video?: (key: string, path: string, loop: boolean) => void;
    on: (event: string, callback: (...args: unknown[]) => void) => void;
    once: (event: string, callback: () => void) => void;
    start: () => void;
  };
}
// Type for the audio track index
type AudioTracksByFolder = Record<string, AudioSource[]>;
type AudioSceneFolderMap = Record<string, string>;

interface AudioTrackIndexType {
  folders: AudioTracksByFolder;
  sceneFolderMap: AudioSceneFolderMap;
}

function getFolders(): AudioTracksByFolder {
  return (audioTrackIndex as AudioTrackIndexType).folders ?? {};
}

function getSceneFolderMap(): AudioSceneFolderMap {
  return (audioTrackIndex as AudioTrackIndexType).sceneFolderMap ?? {};
}

// ─── BGM lazy load theo scene ───
const SCENE_AUDIO: Record<SceneFolderName, Array<[string, string]>> = {
  menu: [["bgm_menu", MENU_STARTUP_TRACK_SOURCE]],
  planning: [["bgm_planning", PLANNING_STARTUP_TRACK_SOURCE]],
  combat: [["bgm_combat", COMBAT_FALLBACK_TRACK_SOURCE]]
};

function normalizeAudioSource(path: string): string {
  return typeof path === "string" && path.startsWith("/") ? path.slice(1) : path;
}

function getTrackSources(track: AudioSource | null | undefined): string | string[] | null {
  if (!track?.sources || track.sources.length === 0) return null;
  const sources = track.sources.map(normalizeAudioSource).filter(Boolean);
  if (sources.length === 0) return null;
  return sources.length === 1 ? sources[0] : sources;
}

function getFolderTracks(folderName: string | null | undefined): AudioSource[] {
  if (!folderName) return [];
  const folders = getFolders();
  return folders[folderName] ?? [];
}

function getSceneFolderName(sceneName: SceneFolderName): string | null {
  const sceneFolderMap = getSceneFolderMap();
  return sceneFolderMap[sceneName] ?? null;
}

function getSceneFolderTracks(sceneName: SceneFolderName): AudioSource[] {
  const folderName = getSceneFolderName(sceneName);
  return folderName ? getFolderTracks(folderName) : [];
}

function trackHasSource(track: AudioSource, expectedSource: string): boolean {
  const normalizedExpected = normalizeAudioSource(expectedSource);
  if (!normalizedExpected || !track.sources) return false;
  return track.sources.some((source) => normalizeAudioSource(source) === normalizedExpected);
}

function findTrackBySource(tracks: AudioSource[], expectedSource: string): AudioSource | null {
  return tracks.find((track) => trackHasSource(track, expectedSource)) ?? null;
}

function getStartupIndexedTracks(): AudioSource[] {
  const tracks: AudioSource[] = [];
  const menuTrack = findTrackBySource(getFolderTracks("menu"), MENU_STARTUP_TRACK_SOURCE);
  const planningTrack = findTrackBySource(getFolderTracks("planning"), PLANNING_STARTUP_TRACK_SOURCE);
  if (menuTrack) tracks.push(menuTrack);
  if (planningTrack) tracks.push(planningTrack);
  return tracks;
}

function getStartupIndexedTrackKeySet(): Set<string> {
  const tracks = getStartupIndexedTracks();
  return new Set(tracks.map((t) => t.key).filter((k): k is string => k !== undefined));
}

function queueIndexedTracks(scene: PhaserSceneLike, tracks: AudioSource[]): boolean {
  let queued = false;

  tracks.forEach((track) => {
    const key = track?.key;
    const sources = getTrackSources(track);
    if (!key || !sources) return;
    if (scene.cache?.audio?.exists?.(key)) return;
    scene.load.audio(key, sources);
    queued = true;
  });

  return queued;
}

function getCachedIndexedTrackKeys(scene: PhaserSceneLike, sceneName: SceneFolderName): string[] {
  const tracks = getSceneFolderTracks(sceneName);
  return tracks
    .map((t) => t?.key)
    .filter((key): key is string => typeof key === "string" && scene.cache?.audio?.exists?.(key) === true);
}

function getDeferredIndexedTracks(sceneName: SceneFolderName): AudioSource[] {
  const tracks = getSceneFolderTracks(sceneName);
  if (tracks.length === 0) return [];
  const startupTrackKeys = getStartupIndexedTrackKeySet();
  return tracks.filter((track) => !startupTrackKeys.has(track.key));
}

function getSceneMusicPlaylistOptions(sceneName: SceneFolderName): { loopCurrentTrack: boolean } {
  return {
    loopCurrentTrack: sceneName === "combat"
  };
}

/**
 * Load audio + backgrounds + emoji cần thiết khi khởi động.
 * Chỉ queue track nhẹ nhất cho menu/planning để vào menu nhanh hơn.
 */
export function queueSharedAssets(scene: PhaserSceneLike): boolean {
  let queued = false;

  ESSENTIAL_AUDIO.forEach(([key, path]) => {
    if (scene.cache?.audio?.exists?.(key)) return;
    scene.load.audio(key, path);
    queued = true;
  });

  // Queue startup tracks
  const menuTracks = getFolderTracks("menu");
  if (menuTracks.length > 0) {
    queued = queueIndexedTracks(scene, menuTracks) || queued;
  }

  FOREST_BACKGROUND_ASSETS.forEach((asset) => {
    if (scene.textures.exists((asset as { key: string }).key)) return;
    scene.load.image((asset as { key: string }).key, (asset as { path: string }).path);
    queued = true;
  });

  TRIBUTE_CREDITS.forEach((entry) => {
    const credit = entry as { assetKey: string; assetPath: string };
    if (!credit.assetKey || !credit.assetPath) return;
    if (scene.textures.exists(credit.assetKey)) return;
    scene.load.image(credit.assetKey, credit.assetPath);
    queued = true;
  });

  // ── Menu background ──
  if (!scene.textures.exists("menu_bg")) {
    scene.load.image("menu_bg", "assets/backgrounds/menu-bg.png");
    queued = true;
  }
  if (typeof scene.load.video === "function" && !scene.cache?.video?.exists?.("menu_bg_video")) {
    scene.load.video?.("menu_bg_video", "assets/backgrounds/menu-bg.mp4", true);
    queued = true;
  }
  if (!scene.textures.exists("mtp_comment")) {
    scene.load.image("mtp_comment", "assets/backgrounds/mtp-comment.webp");
    queued = true;
  }

  queued = queueEmojiAssets(scene) > 0 || queued;
  return queued;
}

/**
 * Lazy load BGM cho scene cụ thế.
 * Gọi trong preload() hoặc create() của scene.
 */
export function queueSceneAudio(scene: PhaserSceneLike, sceneName: SceneFolderName): boolean {
  const indexedTracks = getSceneFolderTracks(sceneName);
  if (indexedTracks.length > 0) {
    return queueIndexedTracks(scene, indexedTracks);
  }

  const assets = SCENE_AUDIO[sceneName];
  if (!assets) return false;

  let queued = false;
  assets.forEach(([key, path]) => {
    if (scene.cache?.audio?.exists?.(key)) return;
    scene.load.audio(key, path);
    queued = true;
  });

  return queued;
}

export function prefetchDeferredSceneAudio(
  scene: PhaserSceneLike,
  sceneNames: SceneFolderName[] = [],
  options: DeferredOptions = {}
): boolean {
  const uniqueSceneNames = [...new Set(sceneNames.filter(Boolean))];
  if (uniqueSceneNames.length === 0) {
    options?.onSettled?.();
    return false;
  }

  let queued = false;
  for (const sceneName of uniqueSceneNames) {
    const deferredTracks = getDeferredIndexedTracks(sceneName);
    if (deferredTracks.length > 0) {
      queued = queueIndexedTracks(scene, deferredTracks) || queued;
      continue;
    }

    const fallbackAssets = SCENE_AUDIO[sceneName];
    if (!fallbackAssets) continue;
    fallbackAssets.forEach(([key, path]) => {
      if (scene.cache?.audio?.exists?.(key)) return;
      scene.load.audio(key, path);
      queued = true;
    });
  }

  if (!queued) {
    options?.onSettled?.();
    return false;
  }

  if (typeof options?.onSettled === "function") {
    scene.load.once("complete", () => {
      options.onSettled?.();
    });
  }
  scene.load.start();
  return true;
}

/**
 * Bắt đầu phát nhạc cho scene từ playlist folder nếu có.
 * Fallback về BGM đơn như cũ khi folder chưa được index.
 */
export function startSceneMusic(
  scene: PhaserSceneLike,
  sceneName: SceneFolderName,
  audioFx: AudioFx,
  bgmKey: string,
  volume = 0.2
): void {
  const playlistKeys = getCachedIndexedTrackKeys(scene, sceneName);
  if (playlistKeys.length > 0) {
    audioFx.startNamedPlaylist(`scene:${sceneName}`, playlistKeys, volume, true, getSceneMusicPlaylistOptions(sceneName));
    return;
  }

  if (scene.cache?.audio?.exists?.(bgmKey)) {
    audioFx.startBgm(bgmKey, volume);
  }
}

/**
 * Lazy load và bắt đầu phát BGM cho scene.
 * Tự động load nếu chưa có trong cache, sau đó phát.
 */
export function lazyLoadAndPlayBgm(
  scene: PhaserSceneLike,
  sceneName: SceneFolderName,
  audioFx: AudioFx,
  bgmKey: string,
  volume = 0.2,
  options: DeferredOptions = {}
): void {
  const settle = () => {
    try {
      options?.onSettled?.();
    } catch {
      console.warn("Audio settle callback failed:");
    }
  };

  const cachedKeys = getCachedIndexedTrackKeys(scene, sceneName);
  const hasImmediatePlaylist = cachedKeys.length > 0;
  const hasImmediateFallback = scene.cache?.audio?.exists?.(bgmKey);
  const canStartImmediately = hasImmediatePlaylist || hasImmediateFallback;

  if (canStartImmediately) {
    startSceneMusic(scene, sceneName, audioFx, bgmKey, volume);
  }

  const needsLoad = queueSceneAudio(scene, sceneName);
  if (needsLoad) {
    scene.load.once("complete", () => {
      startSceneMusic(scene, sceneName, audioFx, bgmKey, volume);
      settle();
    });
    scene.load.start();
    return;
  }

  if (!canStartImmediately) {
    startSceneMusic(scene, sceneName, audioFx, bgmKey, volume);
  }
  settle();
}