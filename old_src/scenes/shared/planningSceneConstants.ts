import { APP_LAST_UPDATED, APP_VERSION_TAG } from "../../core/appMeta.js";
import { t } from "../../i18n/index.js";

interface PlanningVersionInfo {
  version: string;
  updatedAt: string;
  notes: string[];
}

export const PLANNING_VERSION_INFO: PlanningVersionInfo = {
  version: APP_VERSION_TAG,
  updatedAt: APP_LAST_UPDATED,
  get notes(): string[] {
    return [
      t("planning.version.note1"),
      t("planning.version.note2"),
      t("planning.version.note3"),
      t("planning.version.note4"),
      t("planning.version.note5"),
      t("planning.version.note6"),
      t("planning.version.note7"),
      t("planning.version.note8"),
      t("planning.version.note9"),
      t("planning.version.note10"),
      t("planning.version.note11"),
      t("planning.version.note12")
    ];
  }
};

export const CORTISOL_DANCE_DURATION_MS = 2 * 60 * 1000;