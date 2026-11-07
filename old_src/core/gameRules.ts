import { t } from "../i18n/index.js";

export const LOSE_CONDITION = {
  NO_HEARTS: "NO_HEARTS",
  NO_UNITS: "NO_UNITS"
} as const;

export type LoseConditionType = typeof LOSE_CONDITION[keyof typeof LOSE_CONDITION];

export const DEFAULT_LOSE_CONDITION: LoseConditionType = LOSE_CONDITION.NO_UNITS;

export function normalizeLoseCondition(value: unknown): LoseConditionType {
  return value === LOSE_CONDITION.NO_HEARTS
    ? LOSE_CONDITION.NO_HEARTS
    : LOSE_CONDITION.NO_UNITS;
}

export function getLoseConditionLabel(value: unknown): string {
  return value === LOSE_CONDITION.NO_HEARTS
    ? t("lose.noHearts")
    : t("lose.noUnits");
}
