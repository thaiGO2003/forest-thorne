export const audioTracksByFolder = {
  ".": [
    {
      "key": "blaster",
      "stem": "blaster",
      "folder": ".",
      "sources": [
        "/assets/audio/blaster.ogg"
      ]
    },
    {
      "key": "explosion",
      "stem": "explosion",
      "folder": ".",
      "sources": [
        "/assets/audio/explosion.ogg"
      ]
    },
    {
      "key": "key",
      "stem": "key",
      "folder": ".",
      "sources": [
        "/assets/audio/key.ogg"
      ]
    },
    {
      "key": "p-ping",
      "stem": "p-ping",
      "folder": ".",
      "sources": [
        "/assets/audio/p-ping.ogg"
      ]
    },
    {
      "key": "shot1",
      "stem": "shot1",
      "folder": ".",
      "sources": [
        "/assets/audio/shot1.ogg"
      ]
    },
    {
      "key": "sword",
      "stem": "sword",
      "folder": ".",
      "sources": [
        "/assets/audio/sword.ogg"
      ]
    }
  ],
  "battle-screen": [
    {
      "key": "battle-screen__khuc-trong-nui",
      "stem": "Khúc Trống Núi",
      "folder": "battle-screen",
      "sources": [
        "/assets/audio/battle-screen/Khúc Trống Núi.mp3"
      ]
    }
  ],
  "main-screen": [
    {
      "key": "main-screen__official-que-tune-tongminh-youtube",
      "stem": "(Official) Quê Tune - TongMinh - YouTube",
      "folder": "main-screen",
      "sources": [
        "/assets/audio/main-screen/(Official) Quê Tune - TongMinh - YouTube.ogg"
      ]
    },
    {
      "key": "main-screen__chung-ta-la-o-mixi-official-visualizer-video-youtube",
      "stem": "CHÚNG TA LÀ ĐỘ MIXI - OFFICIAL VISUALIZER VIDEO - YouTube",
      "folder": "main-screen",
      "sources": [
        "/assets/audio/main-screen/CHÚNG TA LÀ ĐỘ MIXI - OFFICIAL VISUALIZER VIDEO - YouTube.ogg"
      ]
    },
    {
      "key": "main-screen__dung-ct-cuoi-lofi-cuc-am-nhe-nhang-va-de-ngu",
      "stem": "Dũng CT cười lofi cực ấm, nhẹ nhàng và dễ ngủ",
      "folder": "main-screen",
      "sources": [
        "/assets/audio/main-screen/Dũng CT cười lofi cực ấm, nhẹ nhàng và dễ ngủ.ogg"
      ]
    },
    {
      "key": "main-screen__giao-huong-thank-o-wolfgang-killntea-nhac-co-ien-hay-nhat-ma-ban-nen-nghe-mot-lan-trong-oi",
      "stem": "GIAO HƯỞNG THANK ĐỘ - WOLFGANG KILLNTEA - NHẠC CỔ ĐIỂN HAY NHẤT MÀ BẠN NÊN NGHE MỘT LẦN TRONG ĐỜI",
      "folder": "main-screen",
      "sources": [
        "/assets/audio/main-screen/GIAO HƯỞNG THANK ĐỘ - WOLFGANG KILLNTEA - NHẠC CỔ ĐIỂN HAY NHẤT MÀ BẠN NÊN NGHE MỘT LẦN TRONG ĐỜI.ogg"
      ]
    },
    {
      "key": "main-screen__tong-hop-cac-ca-khuc-dung-ct-a-the-hien-hk-cung-dung-ct-youtube",
      "stem": "Tổng hợp các ca khúc Dũng CT đã thể hiện (HK cùng Dũng CT) - YouTube",
      "folder": "main-screen",
      "sources": [
        "/assets/audio/main-screen/Tổng hợp các ca khúc Dũng CT đã thể hiện (HK cùng Dũng CT) - YouTube.ogg"
      ]
    }
  ],
  "plan-screen": [
    {
      "key": "plan-screen__vprodmusic-asia-bgm-tet-nguyen-an-viet-nam-edm-184076",
      "stem": "vprodmusic_asia_bgm-tet-nguyen-an-viet-nam-edm-184076",
      "folder": "plan-screen",
      "sources": [
        "/assets/audio/plan-screen/vprodmusic_asia_bgm-tet-nguyen-an-viet-nam-edm-184076.mp3"
      ]
    }
  ]
};

export const audioSceneFolderMap = {
  "menu": "main-screen",
  "planning": "plan-screen",
  "combat": "battle-screen"
};

export const audioTrackIndex = {
  folders: audioTracksByFolder,
  sceneFolderMap: audioSceneFolderMap,
};

export default audioTrackIndex;
