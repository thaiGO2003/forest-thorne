import { AUGMENT_LIBRARY } from "../data/augments.js";

export interface AugmentEffect {
  type: string;
  value: unknown;
  [key: string]: unknown;
}

export interface AugmentDefinition {
  id: string;
  effect: AugmentEffect;
  [key: string]: unknown;
}

export interface AugmentPlayerState {
  augmentBonuses: Record<string, number>;
  augments: string[];
  gold: number;
  xp: number;
  interestCapBonus?: number;
  rollCostDelta?: number;
  xpCostDelta?: number;
  interestRateBonus?: number;
  winGoldBonus?: number;
  teamAtkPct?: number;
  teamDefPct?: number;
  teamHpPct?: number;
  teamMatkPct?: number;
  teamMdefPct?: number;
  startingRage?: number;
  startingShield?: number;
  lifestealPct?: number;
  hpLossReduce?: number;
  rageGainPct?: number;
  deployCapBonus?: number;
  benchBonus?: number;
  inventoryBonus?: number;
  extraClassCount?: number;
  extraTribeCount?: number;
  [key: string]: unknown;
}

export interface AugmentCallbacks {
  onGainXp?: (value: number) => void;
}

export type AugmentHandler = (effect: AugmentEffect) => void;

const AUGMENTS = AUGMENT_LIBRARY as unknown as AugmentDefinition[];

function numericValue(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export class AugmentSystem {
  private playerState: AugmentPlayerState;
  private callbacks: AugmentCallbacks;
  private appliedAugments: string[];
  private effectHandlers: Map<string, AugmentHandler>;

  constructor(playerState: AugmentPlayerState, callbacks: AugmentCallbacks = {}) {
    this.playerState = playerState;
    this.callbacks = callbacks;
    if (!this.playerState.augmentBonuses) this.playerState.augmentBonuses = {};
    if (!this.playerState.augments) this.playerState.augments = [];
    this.appliedAugments = [...this.playerState.augments];
    this.effectHandlers = new Map();
    this.registerHandlers();
  }

  registerHandlers(): void {
    this.effectHandlers.set("gold_flat", (eff) => this.applyGoldFlat(eff));
    this.effectHandlers.set("interest_cap", (eff) => this.applyInterestCap(eff));
    this.effectHandlers.set("roll_cost_delta", (eff) => this.applyRollCostDelta(eff));
    this.effectHandlers.set("xp_flat", (eff) => this.applyXpFlat(eff));
    this.effectHandlers.set("xp_cost_delta", (eff) => this.applyXpCostDelta(eff));
    this.effectHandlers.set("interest_rate_bonus", (eff) => this.applyInterestRateBonus(eff));
    this.effectHandlers.set("win_gold_bonus", (eff) => this.applyWinGoldBonus(eff));
    this.effectHandlers.set("gold_xp_combo", (eff) => this.applyGoldXpCombo(eff));
    this.effectHandlers.set("team_atk_pct", (eff) => this.applyTeamStatBonus("teamAtkPct", eff));
    this.effectHandlers.set("team_def_pct", (eff) => this.applyTeamStatBonus("teamDefPct", eff));
    this.effectHandlers.set("team_hp_pct", (eff) => this.applyTeamStatBonus("teamHpPct", eff));
    this.effectHandlers.set("team_matk_pct", (eff) => this.applyTeamStatBonus("teamMatkPct", eff));
    this.effectHandlers.set("team_mdef_pct", (eff) => this.applyTeamStatBonus("teamMdefPct", eff));
    this.effectHandlers.set("starting_rage", (eff) => this.applyStartingRage(eff));
    this.effectHandlers.set("starting_shield", (eff) => this.applyStartingShield(eff));
    this.effectHandlers.set("lifesteal_pct", (eff) => this.applyLifesteal(eff));
    this.effectHandlers.set("hp_loss_reduce", (eff) => this.applyHpLossReduce(eff));
    this.effectHandlers.set("rage_gain_pct", (eff) => this.applyRageGainPct(eff));
    this.effectHandlers.set("deploy_cap_bonus", (eff) => this.applyDeployCapBonus(eff));
    this.effectHandlers.set("bench_bonus", (eff) => this.applyBenchBonus(eff));
    this.effectHandlers.set("inventory_bonus", (eff) => this.applyInventoryBonus(eff));
    this.effectHandlers.set("extra_class_count", (eff) => this.applyExtraSynergyCount("extraClassCount", eff));
    this.effectHandlers.set("extra_tribe_count", (eff) => this.applyExtraSynergyCount("extraTribeCount", eff));
  }

  validateAugment(augment: unknown): augment is AugmentDefinition {
    if (!augment || typeof augment !== "object") return false;
    const candidate = augment as Record<string, unknown>;
    const effect = candidate.effect;
    return typeof candidate.id === "string" && !!effect && typeof effect === "object"
      && typeof (effect as Record<string, unknown>).type === "string";
  }

  canApplyAugment(augmentId: string): boolean { return !this.appliedAugments.includes(augmentId); }

  getAppliedAugments(): string[] { return [...this.appliedAugments]; }

  getTotalBonus(effectType: string): number { return this.playerState.augmentBonuses[effectType] ?? 0; }

  applyAugment(augment: AugmentDefinition | string): void {
    if (typeof augment === "string") {
      const found = AUGMENTS.find((a) => a.id === augment);
      if (!found) throw new Error(`Không tìm thấy augment ID: ${augment}`);
      augment = found;
    }
    if (!this.validateAugment(augment)) throw new Error("Invalid augment structure");
    if (!this.canApplyAugment(augment.id)) {
      console.warn(`Augment ${augment.id} đã được áp dụng trước đó.`);
      return;
    }
    const eff = augment.effect;
    const value = numericValue(eff.value);
    this.playerState.augmentBonuses[eff.type] = (this.playerState.augmentBonuses[eff.type] ?? 0) + value;
    const handler = this.effectHandlers.get(eff.type);
    if (handler) handler(eff); else console.warn(`Unknown effect type: ${eff.type}`);
    this.appliedAugments.push(augment.id);
    if (!this.playerState.augments.includes(augment.id)) this.playerState.augments.push(augment.id);
  }

  private addNumeric(field: keyof AugmentPlayerState, value: unknown): void {
    const current = numericValue(this.playerState[field]);
    this.playerState[field] = current + numericValue(value);
  }

  private applyGoldFlat(eff: AugmentEffect): void { this.playerState.gold += numericValue(eff.value); }
  private applyInterestCap(eff: AugmentEffect): void { this.addNumeric("interestCapBonus", eff.value); }
  private applyRollCostDelta(eff: AugmentEffect): void { this.addNumeric("rollCostDelta", eff.value); }
  private applyXpFlat(eff: AugmentEffect): void {
    const value = numericValue(eff.value);
    if (this.callbacks.onGainXp) this.callbacks.onGainXp(value); else this.playerState.xp += value;
  }
  private applyXpCostDelta(eff: AugmentEffect): void { this.addNumeric("xpCostDelta", eff.value); }
  private applyInterestRateBonus(eff: AugmentEffect): void { this.addNumeric("interestRateBonus", eff.value); }
  private applyWinGoldBonus(eff: AugmentEffect): void { this.addNumeric("winGoldBonus", eff.value); }
  private applyGoldXpCombo(eff: AugmentEffect): void {
    if (!eff.value || typeof eff.value !== "object") return;
    const combo = eff.value as Record<string, unknown>;
    const gold = numericValue(combo.gold);
    const xp = numericValue(combo.xp);
    this.playerState.gold += gold;
    if (this.callbacks.onGainXp) this.callbacks.onGainXp(xp); else this.playerState.xp += xp;
    this.playerState.augmentBonuses.gold_flat = (this.playerState.augmentBonuses.gold_flat ?? 0) + gold;
    this.playerState.augmentBonuses.xp_flat = (this.playerState.augmentBonuses.xp_flat ?? 0) + xp;
  }
  private applyTeamStatBonus(stateField: keyof AugmentPlayerState, eff: AugmentEffect): void { this.addNumeric(stateField, eff.value); }
  private applyStartingRage(eff: AugmentEffect): void { this.addNumeric("startingRage", eff.value); }
  private applyStartingShield(eff: AugmentEffect): void { this.addNumeric("startingShield", eff.value); }
  private applyLifesteal(eff: AugmentEffect): void { this.addNumeric("lifestealPct", eff.value); }
  private applyHpLossReduce(eff: AugmentEffect): void { this.addNumeric("hpLossReduce", eff.value); }
  private applyRageGainPct(eff: AugmentEffect): void { this.addNumeric("rageGainPct", eff.value); }
  private applyDeployCapBonus(eff: AugmentEffect): void { this.addNumeric("deployCapBonus", eff.value); }
  private applyBenchBonus(eff: AugmentEffect): void { this.addNumeric("benchBonus", eff.value); }
  private applyInventoryBonus(eff: AugmentEffect): void { this.addNumeric("inventoryBonus", eff.value); }
  private applyExtraSynergyCount(stateField: keyof AugmentPlayerState, eff: AugmentEffect): void { this.addNumeric(stateField, eff.value); }
}
