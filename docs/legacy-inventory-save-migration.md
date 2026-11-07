# Legacy inventory migration policy (Issue #39)

## Root cause and version contract

Before save schema v5, `sanitizePlayer()` filtered `RunState.itemBag` against the current `BASE_MATERIALS` and equipment registry. Valid identifiers from an older catalog could therefore disappear permanently during Continue/import, even when the saved inventory was otherwise valid.

`ENVELOPE_VERSION = 5` marks the migration contract. For v1–v4 saves, `migrate()` retains every string identifier in `itemBag` without reordering, deduplication, catalog lookup, or guessed ID remapping. The same rule applies when normalizing v5 and future-version envelopes; a future version number is not downgraded. Non-string values are malformed inventory entries and are discarded. Existing other save validation remains unchanged.

## In-place inert quarantine

An unresolved item ID stays in its original `itemBag` position rather than being moved to a second collection. This **in-place inert quarantine** preserves its multiplicity, player ownership, index order, and occupied inventory capacity. The original string remains available for later recovery when an authored catalog entry or evidence-backed migration mapping is restored.

Unknown entries do **not** become valid gameplay items merely because they survive loading:

- `sellItem()` refuses an unresolved ID without changing gold or removing it.
- `equipItem()` requires an authored equipment definition.
- `stageRunCraftItem()` and the crafting picker accept only ingredients referenced by an authored recipe. A failed craft does not consume inventory.
- Combat loot still passes through `validBagItem()`, so this migration does not introduce new unknown drops.

There is intentionally no synthetic replacement ID, inferred item bonus, invented recipe, or second canonical inventory. Legacy `old_src/data/items.ts` can inform future catalog recovery, but neither its name nor its mere presence proves that an old item has equivalent current gameplay semantics. Mappings must be individually evidenced before implementation.

## Read/write and co-op behavior

`inspectSave()`, `importProgress()`, and export/import use the canonical migration. Continue writes once when normalization changes an envelope and does not rewrite it on repeat inspection. Exported IDs round-trip verbatim. All available players in a co-op payload are sanitized independently, so unknown IDs and duplicates remain with their original owner; co-op shared phase/round normalization is unchanged.

## Acceptance and known dependency

Regression fixtures cover legacy/current/future schema envelopes, unknown strings, duplicates, ordering, multiple known/unknown item tiers, malformed entries, import/export, solo/co-op ownership, and transaction rejection. A direct TypeScript runtime smoke additionally exercised a v4→v5→export/import roundtrip and authored `tear` crafting. This is not a browser UI acceptance claim.

**Dependency:** Full gameplay restoration of unresolved legacy equipment and recipes needs separately verified, authored catalog definitions and item-registry recovery (related Issues #28, #29, #30 and #33). Until then the in-place quarantine deliberately keeps player data recoverable but unusable in transactions.
