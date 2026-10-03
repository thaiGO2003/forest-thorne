# Non-visual logic handoff

Updated: 2026-10-03. Branch: `feature/logic/full-handoff`.
Reference: `opus-5.5-forest-throne-rebuild-mega-prompt.md`.

## Working agreement

Continue core, network, input, audio, platform and persistence work. Commit coherent tranches after validation. Do not implement UI/layout/CSS, renderer presentation, Three.js rigs/geometry, VFX, art or visual acceptance items; those belong to Opus 5.5. Changes to app modules must stay within state ownership and event/routing logic.

The work below was continued in the primary checkout at `P:\DevGOVietnam\workspace\forest-thorne`. The managed checkout at `C:\Users\thaiGO\.codex\worktrees\25ad\forest-thorne` remains at the earlier merge. Inspect branch/HEAD before choosing a checkout. Existing changes under `art/drafts` and untracked `tmp/` are outside this continuation and have not been staged. No push was performed in this continuation.

## Latest completed tranches

| Commit | Change |
| --- | --- |
| `110741e` | Gate New Game/Continue through canonical menu routing, preserve saved audio and per-mode AI settings. |
| `35cd726` | Align research eligibility and mutation with `techNodeState`, including Creative gold and malformed levels. |
| `8b29957` | Restore co-op local ownership into a fresh session; persist through the session's active save slot. |
| `95a60d1` | Preserve 2P/4P encounter capacity and all co-op preview rows through generation/save/restore. |
| `4242ee7` | Canonical melee/ranged/Assassin targeting, seeded RIGHT-side target randomness and skill/disarm priority. |
| `fa17124` | Guest preview always follows current host data; normalize tutorial completion using the shared round. |
| `7711c04` | Hydrate canonical keybind action ids, preserve legacy ids in mixed documents, handle the space key, reject inherited action names and make settings subscription cleanup idempotent. |
| `a15127e` | Ignore combat completion after New Game/Continue/clear replaces its run owner; reject empty/non-Planning combat starts before preview mutation. |

Validation at `a15127e`: `pnpm typecheck`, `pnpm test` (40 files / 286 tests), `pnpm build`, and staged `git diff --check` passed. No changes were made to `src/ui`, `src/world`, `src/units`, CSS or assets in these tranches.

## Next-step sequence

1. Audit live non-visual callers before adding more helpers. Start with A85/A88/A110: identify which planning actions still bypass canonical selection/input/keybinding helpers. Keep tests around state ownership and modal consumption. The current planning handler in `src/app/screens.ts` lacks sell/new-run shortcuts and combat-context shortcuts. The modal host consumes Escape before that handler; a later handler must respect `event.defaultPrevented` to avoid reopening a just-closed modal. Manual stepping requires a presentation interface change: `CombatPlayer` currently exposes `setSpeed`, `done` and `dispose`, but no step API. Leave that interface/presentation work to Opus.
2. Complete app-facing non-visual craft/equipment/augment transactions where consumers exist, using the core mutations and one persistence/history/notification boundary. `Bridge` currently exposes shop/move/sell/research/combat, but does not expose craft/equipment/augment intents. Add consumers only within the authorized non-visual scope; do not build panels.
3. Audit the co-op battle orchestration against session ownership. `coopPersistence.ts` provides restore/save services, but production `Bridge` still uses the solo persistence path. Use the room's AI mode, capacity and host authority for encounter generation; guest clients consume shared preview without local generation. Verify co-op virtual synergy aggregation is used by the future room combat caller. Do not remove the production availability gates or invent lobby/map screens.
4. Reconcile authored content before extending recommendations or exact AI spending. Equipment currently contains two ids with empty bonus payloads; recipes contain the tutorial blue-buff recipe. Exact item bonuses, the full recipe table and AI tier spending costs need an authoritative source. Do not fabricate the advertised recipe count or balance values.
5. After each implemented tranche, run targeted regression tests, typecheck, the full suite and `git diff --check`; commit only that tranche's files. Run production build after runtime integration changes. Record which paths have live callers and which remain helpers. Push only on an explicit request for that batch.

## Priority scope and completion criteria

“Core implemented” below describes the existing logic boundary, not completion of visual acceptance or every production screen.

| Spec | Non-visual scope / current boundary | Completion criteria for remaining work |
| --- | --- | --- |
| A57 / A113 | Core persistence: migration, inspection, import/export and separate clear scopes. | Import/export/Continue use the same normalization; malformed input preserves current state; run-only clear preserves settings/profiles/co-op slots. Wire any remaining callers without rebuilding their panels. |
| A62 | Fresh-run and loss semantics live in mode/run/outcome logic. | Restart clears prior run progression; each mode applies its authored loss rule; replay completion cannot mutate a replacement run. |
| A63 | Ownership, deploy/bench/inventory capacity and planning move invariants are implemented. | Every app intent uses those mutations; full-capacity failures are atomic; valid saved upgrades and Creative reservations survive hydration. |
| A64 / A115 | Boot generation gate, disposal, retries and minimum loading visibility are wired for current app routes. | Future lazy routes invalidate stale completions and dispose on replacement; retry resumes one owner. New scene presentation remains with Opus. |
| A66 | Resolution normalization, Adaptive sources, cycling and transactional apply/rollback helpers exist. | The actual apply caller saves only after platform success, restores the prior mode on failure and reports recovery without changing layout here. |
| A69 | Canonical shop roster and recipe/equipment recommendation helpers exist. | Suggestions use authored metadata, stable ordering, actual inventory and legal tiers; missing item/recipe data remains explicitly incomplete. |
| A70 | Reusable skill-effect primitives and authored skill dispatch exist. | Audit each newly supplied skill against those primitives; verify deterministic effect order and aftermath with behavioral regressions. No effect presentation changes. |
| A77 | Materialization is canonical and wired in the solo bridge. | All battle callers apply unit/star/equipment/variant/team/environment/AI modifiers once; roster matches the same materialized formation used by simulation. |
| A78 | Role passives are handled in combat logic. | Audit remaining authored passives for trigger/order/target rules; tests cover actual outcomes, including silence/stun interactions where relevant. |
| A79 | Turn gates, status ticks and aftermath are handled in combat logic. | Status expiry cannot retroactively remove a captured turn gate; delayed death, cleanse, redirect and reflect remain deterministic. Opus owns dedicated event visuals. |
| A80 | Equipment identity/legality, equip/unequip and hydration normalization exist. | App transactions use canonical checks and persistence; invalid tier, duplicate item, insufficient gold and insufficient bag capacity reject atomically. Real bonus data remains required. |
| A81 | Deterministic merge ordering and compact bench placement are implemented. | All purchase/recruit callers use canonical merging; promoted identity/traits/equipment and board/bench placement remain stable across chain merges. |
| A82 | Unique synergy counting, opening bonuses and co-op virtual aggregation exist. | The room battle caller pools only eligible players and applies bonuses once to the correct formation; per-player ownership remains distinct. |
| A85 | Selection resolution, inspection and context-action helpers exist. | Live semantic actions resolve uid against current ownership, clear stale selections and reject unavailable recall/sell without mutation. Presentation of selection/menus remains with Opus. |
| A86 | Staging counts, recipe matching, suggestions and craft mutation exist. | App bridge transactions enforce table footprint, inventory copies/output room and atomically update history/save; fill only supplied recipes. |
| A87 | Result normalization and idempotent application are wired to solo combat. | All battle finish paths commit once to the owning run; reward/income/loot/round advancement match preview semantics; stale callbacks have no side effects. |
| A88 | Pure keyboard/pointer/wheel/modal ownership helpers exist. | Live non-visual handlers respect modal ownership, consumed events, focused inputs and repeated keys; overlay transitions discard stale pending actions. Board/camera hit areas and manual playback presentation remain with Opus. |
| A94 / A108 | Tutorial state machine, action gates, round preparation and completion handoff exist. | All semantic app intents reach the gates and record successful actions; Continue uses shared/current round consistently; skip and round-8 exit hand off once. Highlight/overlay presentation remains with Opus. |
| A102 | AI matrix, encounter generation/capacity and combat target randomness are implemented. | Room callers pass authoritative AI settings; seeded runs reproduce outcomes. Exact spend accounting requires authored unit/item costs; current generator documents its approximation. |
| A103 / A104 | Run schema, profile side stores and separate graphics preference keys exist. | All reads/writes use canonical keys/migrations; identities hydrate from the live catalog; run clears preserve side stores. Temporary combat/connection objects never become saved authority. |
| A110 | Canonical keybinding service, aliases, persisted remaps and help-map derivation exist. | Actual context handlers and capture consumers use this owner; help reflects the current binding; Escape/invalid capture/cancel behavior is consistent. Manual combat step waits for Opus's playback interface. |
| A111 | Research state, affordability/parents/levels and transaction eligibility are aligned. | Any remaining consumer uses `techNodeState` rather than duplicating logic; all parent requirements and capped/infinite nodes match research mutation. Graph layout/focus rendering remains with Opus. |
| A114 | Co-op schema, shared authority, session restore mirror and active-slot persistence services exist. | Future room integration calls these services, restores the local owner and resets connection/ready/replay state; PvP synchronizes session state without solo writes. Geometry rebuild remains with Opus. |
| A116 | Pure menu routes and current Classic start/continue gates are wired. | Future Fortress/co-op route callers honor map/pending-node/lobby ownership and required capacity; locked modes remain blocked until their separate implementation is ready. |

## Acceptance boundaries

Core tests and a successful build do not establish end-to-end co-op transport, screen input acceptance or visual correctness. Production availability currently enables Classic only. Preserve that gate. The fallback for `cleanse`, `redirect` and `reflect` in `combatPlayer.ts` was inherited compatibility work; dedicated presentation is still outstanding.
