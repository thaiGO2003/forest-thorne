// Canonical non-visual Fortress entry + persistence owner (A117).
import type { PharmacyServiceResult } from "./fortress";
import {
  completeRunFortressNode,
  createModeRun,
  recruitFortressBeast,
  resolveFortressBlacksmith,
  resolveFortressPharmacy,
  selectRunFortressNode,
  type RunState,
} from "./run";
import {
  ENVELOPE_VERSION,
  clearRunProgress,
  inspectSave,
  migrate,
  saveRun,
  type Envelope,
} from "./save";
import type { KV } from "./settings";

const FORTRESS_MODE = "EndlessPvEFortress" as const;

export type FortressRuntimeRoute = "map" | "planning";

export interface FortressEntryOptions {
  seed: number;
  restoredState?: unknown;
  forceNewRun?: boolean;
}

export interface FortressEntry {
  run: RunState;
  route: FortressRuntimeRoute;
  envelope: Envelope;
}

function hydrateSuppliedRun(value: unknown): RunState | null {
  const migrated = migrate({
    version: ENVELOPE_VERSION,
    payload: { player: value },
  });
  return migrated?.envelope.payload.player ?? null;
}

function loadStoredRun(store: KV): RunState | null {
  const inspected = inspectSave(store);
  return inspected.status === "valid" ? inspected.envelope.payload.player ?? null : null;
}

function isFortressRun(s: RunState): boolean {
  return s.mode === FORTRESS_MODE;
}

export function fortressRuntimeRoute(s: RunState): FortressRuntimeRoute {
  return s.fortress.pendingNode ? "planning" : "map";
}

/**
 * A117.1 entry boundary. Supplied restore state wins over the normal solo save.
 * Invalid/wrong-mode/forced entry clears the old solo run and creates canonical
 * Fortress state from mode configuration. Entry always persists before routing.
 */
export function enterFortressRun(store: KV, options: FortressEntryOptions): FortressEntry {
  const hasSuppliedState = Object.prototype.hasOwnProperty.call(options, "restoredState");
  let run = hasSuppliedState
    ? hydrateSuppliedRun(options.restoredState)
    : loadStoredRun(store);

  if (options.forceNewRun || !run || !isFortressRun(run)) {
    clearRunProgress(store);
    run = createModeRun(options.seed, FORTRESS_MODE);
  }

  if (run.fortress.pendingNode) run.phase = "PLANNING";

  const envelope = saveRun(store, { player: run });
  return { run, route: fortressRuntimeRoute(run), envelope };
}

export function selectAndPersistFortressNode(store: KV, s: RunState, nodeId: string): boolean {
  if (!isFortressRun(s) || !selectRunFortressNode(s, nodeId)) return false;
  saveRun(store, { player: s });
  return true;
}

export function resolveAndPersistFortressPharmacy(
  store: KV,
  s: RunState,
  optionId: "restore" | "stimulant" | "supplies" | "skip",
): PharmacyServiceResult | null {
  if (!isFortressRun(s)) return null;
  const result = resolveFortressPharmacy(s, optionId);
  if (!result) return null;
  saveRun(store, { player: s });
  return result;
}

export function recruitAndPersistFortressBeast(store: KV, s: RunState, baseId: string): boolean {
  if (!isFortressRun(s) || !recruitFortressBeast(s, baseId)) return false;
  saveRun(store, { player: s });
  return true;
}

export function resolveAndPersistFortressBlacksmith(
  store: KV,
  s: RunState,
  serviceId?: string,
): boolean {
  if (!isFortressRun(s) || !resolveFortressBlacksmith(s, serviceId)) return false;
  saveRun(store, { player: s });
  return true;
}

function pendingServiceResolved(s: RunState): boolean {
  const pending = s.fortress.pendingNode;
  if (!pending) return false;
  if (pending.type !== "pharmacy" && pending.type !== "beast_den" && pending.type !== "blacksmith") return true;
  return pending.serviceResult !== undefined;
}

/**
 * Canonical route-completion boundary. Service nodes cannot advance until their
 * one-shot service result has been persisted on the pending node.
 */
export function completeAndPersistFortressNode(store: KV, s: RunState): boolean {
  if (!isFortressRun(s) || !pendingServiceResolved(s) || !completeRunFortressNode(s)) return false;
  saveRun(store, { player: s });
  return true;
}
