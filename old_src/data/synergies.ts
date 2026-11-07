import synergiesCsv from "../../data/synergies.csv?raw";

export type SynergyBonus = Record<string, unknown>;
export interface SynergyDefinition {
  thresholds: number[];
  bonuses: SynergyBonus[];
}
export type SynergyCatalog = Record<string, SynergyDefinition>;
export type ElementCounter = Record<string, string | null>;
export type ClassCounter = Record<string, string[]>;

function parseBonusValue(bonusStrRaw: unknown): SynergyBonus {
  const raw = String(bonusStrRaw ?? "").trim();
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as SynergyBonus : {};
  } catch {
    // Support legacy CSV object syntax like: {poisonOnHit:22}
    const normalized = raw
      .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
      .replace(/'/g, '"')
      .replace(/,\s*}/g, "}");
    try {
      const parsed: unknown = JSON.parse(normalized);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as SynergyBonus : {};
    } catch {
      console.warn("Failed to parse bonus JSON", bonusStrRaw);
      return {};
    }
  }
}

function parseSynergiesCsv(csvText: string): {
  CLASS_SYNERGY: SynergyCatalog;
  ELEMENT_SYNERGY: SynergyCatalog;
  FACTION_SYNERGY: SynergyCatalog;
} {
  const lines = csvText.trim().split(/\r?\n/);
  // header: group,id,name,threshold,bonus
  const classSynergy: SynergyCatalog = {};
  const elementSynergy: SynergyCatalog = {};
  const factionSynergy: SynergyCatalog = {};

  for (let i = 1; i < lines.length; i++) {
    // Simple split by comma, respecting quotes for JSON bonus
    const matches = lines[i].match(/(?:\"([^\"]*(?:\"\"[^\"]*)*)\")|([^,]+)|(,)/g);
    void matches;
    // Re-use simple parser logic or regex
    const values: string[] = [];
    let current = "";
    let inQuote = false;
    for (const char of lines[i]) {
      if (char === '"') {
        inQuote = !inQuote;
      } else if (char === ',' && !inQuote) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    if (values.length < 5) continue;

    const group = values[0];
    const id = values[1];
    // name is values[2] (ignored or used for UI?)
    const threshold = Number(values[3]);
    let bonusStr = values[4];

    // Remove quotes around JSON
    if (bonusStr.startsWith('"') && bonusStr.endsWith('"')) {
      bonusStr = bonusStr.slice(1, -1).replace(/""/g, '"');
    }

    const bonus = parseBonusValue(bonusStr);

    if (group !== "CLASS" && group !== "TRIBE" && group !== "ELEMENT" && group !== "FACTION") continue;
    const targetObj = group === "CLASS" ? classSynergy
      : (group === "ELEMENT" || group === "TRIBE") ? elementSynergy
      : factionSynergy;

    if (!targetObj[id]) {
      targetObj[id] = { thresholds: [], bonuses: [] };
    }

    targetObj[id].thresholds.push(threshold);
    targetObj[id].bonuses.push(bonus);
  }

  return { CLASS_SYNERGY: classSynergy, ELEMENT_SYNERGY: elementSynergy, FACTION_SYNERGY: factionSynergy };
}

const parsedSynergies = parseSynergiesCsv(synergiesCsv);
export const CLASS_SYNERGY: SynergyCatalog = parsedSynergies.CLASS_SYNERGY;
export const ELEMENT_SYNERGY: SynergyCatalog = parsedSynergies.ELEMENT_SYNERGY;
export const FACTION_SYNERGY: SynergyCatalog = parsedSynergies.FACTION_SYNERGY;
/** @deprecated Use ELEMENT_SYNERGY instead */
export const TRIBE_SYNERGY: SynergyCatalog = ELEMENT_SYNERGY;

/** Khắc chế nguyên tố: key khắc value (+50% sát thương tấn công HOẶC -50% sát thương nhận được) */
export const ELEMENT_COUNTER: ElementCounter = {
  FIRE: "SPIRIT",
  SPIRIT: "TIDE",
  TIDE: "FIRE",
  STONE: "WIND",
  WIND: "NIGHT",
  NIGHT: "STONE",
  SWARM: null,
  WOOD: "TIDE"
};
/** @deprecated Use ELEMENT_COUNTER instead */
export const TRIBE_COUNTER: ElementCounter = ELEMENT_COUNTER;

export const ELEMENT_COUNTER_LABEL: Record<string, string> = {
  FIRE: "Hỏa khắc Linh",
  SPIRIT: "Linh khắc Thủy",
  TIDE: "Thủy khắc Hỏa",
  STONE: "Nham khắc Phong",
  WIND: "Phong khắc Dạ",
  NIGHT: "Dạ khắc Nham",
  WOOD: "Mộc khắc Thủy"
};
/** @deprecated Use ELEMENT_COUNTER_LABEL instead */
export const TRIBE_COUNTER_LABEL: Record<string, string> = ELEMENT_COUNTER_LABEL;

/** Khắc chế vai trò: key trị các value */
export const CLASS_COUNTER: ClassCounter = {
  ASSASSIN: ["MAGE", "ARCHER"],
  ARCHER: ["MAGE"],
  FIGHTER: ["ASSASSIN"],
  TANKER: [],
  MAGE: [],
  SUPPORT: []
};

export const COUNTER_BONUS = 0.50;
