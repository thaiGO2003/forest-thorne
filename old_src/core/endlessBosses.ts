import { RIGHT_COL_START } from "./boardConstants.js";

const ENDLESS_BOSS_ROTATION = Object.freeze([
  { round: 10, baseId: "boss_ember_dragon", name: "Cự Long Hỏa Ngục" },
  { round: 20, baseId: "boss_storm_phoenix", name: "Lôi Phượng Cuồng Phong" },
  { round: 30, baseId: "boss_venom_hydra", name: "Hydra Độc Vực" },
  { round: 40, baseId: "boss_earth_colossus", name: "Địa Thần Cự Tượng" },
  { round: 50, baseId: "boss_tempest_jelly", name: "Sứa Bão Giông" }
]);

export function isEndlessBossRound(round: number): boolean {
  return Number.isInteger(round) && round >= 10 && round % 10 === 0;
}

export function getEndlessBossRotation() {
  return ENDLESS_BOSS_ROTATION.map((boss) => ({ ...boss }));
}

export function getEndlessBossEncounter(round: number) {
  if (!isEndlessBossRound(round)) return null;
  const bossIndex = Math.max(0, Math.floor(round / 10) - 1) % ENDLESS_BOSS_ROTATION.length;
  const boss = ENDLESS_BOSS_ROTATION[bossIndex];
  return {
    ...boss,
    star: 3,
    units: [
      {
        baseId: boss.baseId,
        star: 3,
        row: 2,
        col: RIGHT_COL_START + 2,
        equips: []
      }
    ]
  };
}
