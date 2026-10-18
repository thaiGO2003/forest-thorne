export type MusicContext = "menu" | "planning" | "combat" | "victory" | "defeat" | "ambient";

export interface MusicTrack {
  key: string;
  sources: readonly string[];
  longPlay?: boolean;
}

export interface MusicPlaylist {
  id: string;
  tracks: readonly string[];
  shuffle: boolean;
}

export const MUSIC_TRACKS: Readonly<Record<string, MusicTrack>> = {
  menu_forest_01: {
    key: "menu_forest_01",
    sources: ["/assets/audio/menu/menu_forest_01.ogg", "/assets/audio/menu/menu_forest_01.mp3"],
  },
  menu_forest_02: {
    key: "menu_forest_02",
    sources: ["/assets/audio/menu/menu_forest_02.ogg", "/assets/audio/menu/menu_forest_02.mp3"],
    longPlay: true,
  },
  menu_leaf_01: {
    key: "menu_leaf_01",
    sources: ["/assets/audio/menu/menu_leaf_01.mp3"],
  },
  menu_magic_world_01: {
    key: "menu_magic_world_01",
    sources: ["/assets/audio/menu/menu_magic_world_01.mp3"],
    longPlay: true,
  },
  planning_forest_01: {
    key: "planning_forest_01",
    sources: ["/assets/audio/planning/planning_forest_01.ogg", "/assets/audio/planning/planning_forest_01.mp3"],
  },
  combat_forest_01: {
    key: "combat_forest_01",
    sources: ["/assets/audio/combat/combat_forest_01.ogg", "/assets/audio/combat/combat_forest_01.mp3"],
  },
  combat_dynasty_01: {
    key: "combat_dynasty_01",
    sources: ["/assets/audio/combat/combat_dynasty_01.mp3"],
  },
  combat_low_ally_01: {
    key: "combat_low_ally_01",
    sources: ["/assets/audio/combat/combat_low_ally_01.mp3"],
  },
  combat_low_enemy_01: {
    key: "combat_low_enemy_01",
    sources: ["/assets/audio/combat/combat_low_enemy_01.mp3"],
  },
};

export const MUSIC_PLAYLISTS: Readonly<Record<MusicContext, MusicPlaylist>> = {
  menu: { id: "menu", tracks: ["menu_forest_01", "menu_forest_02", "menu_leaf_01", "menu_magic_world_01"], shuffle: true },
  planning: { id: "planning", tracks: ["planning_forest_01"], shuffle: false },
  combat: { id: "combat", tracks: ["combat_forest_01", "combat_dynasty_01"], shuffle: true },
  victory: { id: "victory", tracks: [], shuffle: false },
  defeat: { id: "defeat", tracks: [], shuffle: false },
  ambient: { id: "ambient", tracks: [], shuffle: false },
};
