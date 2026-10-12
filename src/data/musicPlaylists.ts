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
  menu_forest_01: {
    key: "menu_forest_01", title: "Forest Menu I", source: "local",
    sources: ["/assets/audio/menu/menu_forest_01.ogg", "/assets/audio/menu/menu_forest_01.mp3"],
  },
  menu_forest_02: {
    key: "menu_forest_02", title: "Forest Menu II", source: "local",
    sources: ["/assets/audio/menu/menu_forest_02.ogg", "/assets/audio/menu/menu_forest_02.mp3"], longPlay: true,
  },
  planning_forest_01: {
    key: "planning_forest_01", title: "Forest Planning", source: "local",
    sources: ["/assets/audio/planning/planning_forest_01.ogg", "/assets/audio/planning/planning_forest_01.mp3"],
  },
  combat_forest_01: {
    key: "combat_forest_01", title: "Forest Combat", source: "local",
    sources: ["/assets/audio/combat/combat_forest_01.ogg", "/assets/audio/combat/combat_forest_01.mp3"],
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

export const MUSIC_PLAYLISTS: Readonly<Record<MusicContext, MusicPlaylist>> = {
  menu: { id: "menu", tracks: ["menu_forest_01", "menu_forest_02", "online_penumbra", "online_there_is_a_place"], shuffle: true },
  planning: { id: "planning", tracks: ["planning_forest_01", "online_there_is_a_place", "online_penumbra"], shuffle: false },
  combat: { id: "combat", tracks: ["combat_forest_01", "online_penumbra", "online_there_is_a_place"], shuffle: false },
  victory: { id: "victory", tracks: ["online_there_is_a_place"], shuffle: false },
  defeat: { id: "defeat", tracks: ["online_penumbra"], shuffle: false },
  ambient: { id: "ambient", tracks: ["online_there_is_a_place", "online_penumbra"], shuffle: true },
};
