// Account achievement browser: renders the canonical 100 threshold rows and claims catalog-backed skins.
import { getUnit } from "../content/catalog";
import {
  ACHIEVEMENT_COMPLETION_CLAIM_ID,
  ACHIEVEMENT_COMPLETION_SKIN_ID,
  ACHIEVEMENT_REWARDS,
  CATALOG_SKIN_DEFINITIONS,
  rankAchievementRows,
  unlockedAchievementCount,
  type AchievementCategory,
  type AchievementProfile,
  type CollectionProfile,
} from "../core/achievements";
import { t, type MsgKey } from "../core/i18n";
import { h, kitButton, panelEl } from "./kit";
import type { ModalHandle } from "./modal";

const CATEGORY_KEY: Record<AchievementCategory, MsgKey> = {
  best_round: "achievements.category.bestRound",
  rounds_won: "achievements.category.roundsWon",
  runs_started: "achievements.category.runsStarted",
  shop_refreshes: "achievements.category.shopRefreshes",
  xp_purchases: "achievements.category.xpPurchases",
  units_bought: "achievements.category.unitsBought",
  merges: "achievements.category.merges",
  augments_chosen: "achievements.category.augmentsChosen",
  crafted_items: "achievements.category.craftedItems",
  highest_level: "achievements.category.highestLevel",
};

export interface AchievementAccountAccess {
  achievementProfile(): AchievementProfile;
  collectionProfile(): CollectionProfile;
  claimAchievement(achievementId: string): boolean;
}

export interface AchievementsView { dispose(): void }

export function mountAchievements(modal: ModalHandle, account: AchievementAccountAccess): AchievementsView {
  const root = h("div", "stack");
  modal.body.append(root);

  const rewardByAchievement = new Map(ACHIEVEMENT_REWARDS.map((mapping) => [mapping.achievementId, mapping]));
  const completionDefinition = CATALOG_SKIN_DEFINITIONS.find((skin) => skin.id === ACHIEVEMENT_COMPLETION_SKIN_ID);
  const completionUnit = completionDefinition ? getUnit(completionDefinition.unitId) : undefined;
  const completionSkin = completionUnit?.skin?.id === ACHIEVEMENT_COMPLETION_SKIN_ID ? completionUnit.skin : undefined;
  const completionReward = completionSkin
    ? `${completionUnit!.nameVi} · ${completionSkin.stagesVi.join(" / ")} · ${completionSkin.id}`
    : ACHIEVEMENT_COMPLETION_SKIN_ID;


  const render = () => {
    const achievements = account.achievementProfile();
    const collection = account.collectionProfile();
    const rows = rankAchievementRows(achievements, collection, ACHIEVEMENT_REWARDS);
    const unlocked = unlockedAchievementCount(achievements);
    const claimed = collection.claimedAchievementIds.filter((id) => rewardByAchievement.has(id)).length;

    root.replaceChildren();
    root.append(h("p", "dialog-copy", t("achievements.summary", {
      unlocked,
      total: rows.length,
      claimed,
      rewards: ACHIEVEMENT_REWARDS.length,
    })));

    const completionClaimed = collection.claimedAchievementIds.includes(ACHIEVEMENT_COMPLETION_CLAIM_ID);
    const completionUnlocked = unlocked === rows.length;
    const completion = panelEl("panel_tooltip", "lib-sec");
    completion.dataset.achievementId = ACHIEVEMENT_COMPLETION_CLAIM_ID;
    completion.append(h("h3", "lib-h", t("achievements.completion")));
    completion.append(h("p", "lib-p", t("achievements.progress", { current: unlocked, threshold: rows.length })));
    completion.append(h("p", "lib-p", t("achievements.reward", { reward: completionReward })));
    completion.append(h("p", "lib-p", t(
      completionClaimed ? "achievements.claimed" : completionUnlocked ? "achievements.claimable" : "achievements.locked",
    )));
    if (completionUnlocked && !completionClaimed) {
      const actions = h("div", "row button-row");
      const claim = kitButton({
        skin: "green",
        label: t("achievements.claim"),
        onClick: () => {
          if (account.claimAchievement(ACHIEVEMENT_COMPLETION_CLAIM_ID)) render();
        },
      });
      actions.append(claim.el);
      completion.append(actions);
    }
    root.append(completion);

    for (const row of rows) {
      const panel = panelEl("panel_tooltip", "lib-sec");
      panel.dataset.achievementId = row.id;
      panel.append(h("h3", "lib-h", `${t(CATEGORY_KEY[row.category])} · ${row.threshold}`));
      panel.append(h("p", "lib-p", t("achievements.progress", { current: row.current, threshold: row.threshold })));

      const mapping = rewardByAchievement.get(row.id);
      if (mapping) {
        const unit = getUnit(mapping.unitId);
        const skin = unit.skin?.id === mapping.skinId ? unit.skin : undefined;
        const reward = skin ? `${unit.nameVi} · ${skin.stagesVi.join(" / ")} · ${skin.id}` : mapping.skinId;
        panel.append(h("p", "lib-p", t("achievements.reward", { reward })));
      }

      const stateKey: MsgKey = row.claimed
        ? "achievements.claimed"
        : row.claimable
          ? "achievements.claimable"
          : row.unlocked
            ? "achievements.unlocked"
            : "achievements.locked";
      panel.append(h("p", "lib-p", t(stateKey)));

      if (row.claimable) {
        const actions = h("div", "row button-row");
        const claim = kitButton({
          skin: "green",
          label: t("achievements.claim"),
          onClick: () => {
            if (account.claimAchievement(row.id)) render();
          },
        });
        actions.append(claim.el);
        panel.append(actions);
      }
      root.append(panel);
    }
  };

  render();
  return { dispose() { root.remove(); } };
}
