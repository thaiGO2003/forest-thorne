export type MusicContext = "menu" | "planning" | "combat" | "victory" | "defeat" | "ambient";
export type MusicSource = "local" | "online";

export interface MusicTrack {
  key: string;
  title: string;
  source: MusicSource;
  sources: readonly string[];
  longPlay?: boolean;
}

export interface MusicPlaylist {
  id: string;
  tracks: readonly string[];
  shuffle: boolean;
}

export const MUSIC_TRACKS: Readonly<Record<string, MusicTrack>> = {
  menu_leaf_01: {
    key: "menu_leaf_01", title: "Falling Leaf", source: "local",
    sources: ["/assets/audio/menu/menu_leaf_01.mp3"],
  },
  menu_magic_world_01: {
    key: "menu_magic_world_01", title: "Về Thế Giới Phép", source: "local",
    sources: ["/assets/audio/menu/menu_magic_world_01.mp3"], longPlay: true,
  },
  combat_dynasty_01: {
    key: "combat_dynasty_01", title: "Dynasty Combat", source: "local",
    sources: ["/assets/audio/combat/combat_dynasty_01.mp3"],
  },
  combat_low_ally_01: {
    key: "combat_low_ally_01", title: "Companion Faltered", source: "local",
    sources: ["/assets/audio/combat/combat_low_ally_01.mp3"],
  },
  combat_low_enemy_01: {
    key: "combat_low_enemy_01", title: "Foe Faltered", source: "local",
    sources: ["/assets/audio/combat/combat_low_enemy_01.mp3"],
  },
  online_penumbra: {
    key: "online_penumbra", title: "Scott Buckley — Penumbra", source: "online",
    sources: ["https://www.scottbuckley.com.au/library/wp-content/uploads/2025/07/Penumbra.mp3"], longPlay: true,
  },
  online_there_is_a_place: {
    key: "online_there_is_a_place", title: "Scott Buckley — There Is A Place", source: "online",
    sources: ["https://www.scottbuckley.com.au/library/wp-content/uploads/2019/04/sb_thereisaplace.mp3"], longPlay: true,
  },
};

// A45: victory/defeat/ambient contexts stay silent. The musicSource setting filters each
// playlist between local and online takes (both catalogues are listed here).
export const MUSIC_PLAYLISTS: Readonly<Record<MusicContext, MusicPlaylist>> = {
  // A46: only tracks whose audio actually ships are listed. The previous catalog referenced
  // menu_forest_01/02, planning_forest_01 and combat_forest_01, which never existed in the repo.
  menu: { id: "menu", tracks: ["menu_leaf_01", "menu_magic_world_01", "online_penumbra", "online_there_is_a_place"], shuffle: true },
  planning: { id: "planning", tracks: ["online_there_is_a_place", "online_penumbra"], shuffle: false },
  combat: { id: "combat", tracks: ["combat_dynasty_01", "online_penumbra", "online_there_is_a_place"], shuffle: true },
  victory: { id: "victory", tracks: [], shuffle: false },
  defeat: { id: "defeat", tracks: [], shuffle: false },
  ambient: { id: "ambient", tracks: [], shuffle: false },
};
