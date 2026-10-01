# MEGA PROMPT V3 — FOREST THRONE COMPLETE REBUILD SPEC FOR OPUS 5.5

Use this entire document as the product and engineering contract.

Your task is to rebuild the visual/presentation experience of **Bá Chủ Khu Rừng / Forest Throne** from the ground up while preserving every gameplay, progression, content, UI, input, audio, networking, persistence, and platform capability described below.

The visual implementation may be radically redesigned. The functional contract may not be silently reduced.

The intended result is a production-quality browser auto-battler with a cohesive 3D voxel forest-fantasy identity, strong tactical readability, expressive animal characters, asset-driven medieval UI, responsive desktop/mobile composition, and clean technical ownership.

---

# 1. PRODUCT IDENTITY

Forest Throne is a tactical auto-battler about collecting, upgrading, positioning, equipping, combining, and commanding a roster of forest creatures across repeated Planning and Combat rounds.

Product-facing identity requirements:

- Vietnamese title: **“Bá chủ khu rừng”**.
- English/product name: **Forest Throne**.
- Author/credit string: **“Thái Gõ”**.
- Current displayed version baseline: **0.1**.
- Main-menu labels use one unified font system; primary menu treatment is uppercase where the design calls for it and uses a clean authored treatment without fake ornamental outlines.

The player should feel three things at all times:

1. **Tactical clarity** — board state, targets, statuses, range, synergies, resources, and outcomes are immediately understandable.
2. **Character personality** — every creature has a recognizable silhouette, motion language, attack, skill, hit reaction, locomotion, and cosmetic identity.
3. **Tactile fantasy presentation** — the board, terrain, cards, panels, buttons, status frames, VFX, and sound all feel like one coherent forest-fantasy game.

The game must remain lightweight enough for browser play and safe on low-memory development hardware.

---

# 2. REBUILD INTERPRETATION RULES

This document describes **what Forest Throne must do and feel like**. Rebuild it freely as long as every gameplay rule, flow, content surface and player-visible behavior below survives.

Treat the explicit rules in this document as the canonical product contract. Where compatibility data or recovered features are mentioned, translate them into that one canonical behavior; do not create parallel “old” and “new” versions of the same mechanic.

The 3D presentation layer must follow canonical game state. Visual code may animate and stage events, but it must never invent a second copy of combat, economy, shop, board, progression, save or networking rules.

The visual direction is a cohesive **medieval forest-fantasy + stylized voxel/low-poly 3D** game. UI should look authored from a real medieval game art kit: carved wood, parchment, stone/metal ornament, readable icons, framed cards and panels, clean hierarchy, strong contrast and consistent typography. Avoid raw debug-looking surfaces or generic web-app styling.

Every creature must feel individually authored. Shared building blocks are fine, but each animal needs its own recognizable silhouette, proportions, face, accessories, movement language, attack, skill, hit reaction, idle and star/skin treatment. A generic whole-animal template is not an acceptable finished result.

Responsive composition must preserve the same interaction meaning on desktop and mobile: no critical control may become unreachable, modal ownership must remain clear, and the board must stay readable without relying on arbitrary per-screen hacks.

## 2.1 Canonical state and language rules

Implement the rebuilt production code in strict TypeScript. Do not introduce explicit `any` as an escape hatch for unresolved contracts. Generated compatibility artifacts may keep their existing generated format when a build step owns them, but gameplay, presentation, input, persistence and content-authoring code must expose real types for their public boundaries.

Canonical gameplay state owns rules and mutations. Rendering, animation, audio, UI, camera and VFX read or stage that state; they do not create parallel economy, combat, shop, board, progression, persistence or networking authorities. A compatibility adapter may translate old data into the canonical model, but after translation there is one live rule path.

## 2.2 Layout math is derived from container geometry

For every new or changed layout, inspect and derive the direct parent panel's `x`, `y`, `width`, `height` and the transforms/docks of every relevant ancestor before positioning the child. Use the parent/container geometry as the source of truth. Do not tune a child by screenshot-only offsets that happen to align at one viewport.

When a component crosses multiple panel, dock or container layers, compute its final usable rectangle through the whole parent-child chain. Responsive variants must derive from the same ownership model so desktop, tablet and portrait/mobile layouts cannot drift into unrelated coordinate systems. Internal scroll areas scroll their own content; modal or screen chrome stays anchored to its owning container.

## 2.3 Production UI is asset-first

Static game UI art comes from approved raster/vector assets rendered through image/canvas/texture helpers. CSS is reserved for geometry and interaction layout: positioning, inset, flex/grid, dimensions, gap, margin/padding, alignment transforms, overflow, z-order, visibility and hit-area behavior.

Do not use new CSS paint as the art source for production game UI. Do not author production chrome with `color`, `background-color`, decorative border/outline color, gradients, `box-shadow`, `text-shadow`, pseudo-element ornaments, filters/tints or hue shifts to imitate wood, parchment, stone, metal, bevels, cards, plaques, frames, badges or buttons. Dynamic gameplay meaning such as HP/rage fills, tile targeting highlights or hit flashes may be drawn by runtime Canvas/WebGL when driven by live data; their static frame/chrome remains asset-driven.

When a PNG frame is resized, use 9-slice or 3-slice geometry or a crop that preserves the authored border proportions. Do not stretch a framed texture until its pixel-art edges distort. Newly cropped assets keep enough provenance to identify the source pack/file. Legacy CSS `background-image` or `border-image` may remain only where compatibility requires it; new UI flows use explicit asset renderers.

Semantic icons go through the shared icon/emoji authority. Prefer the canonical semantic mapping and `emoji-api.com` path when configured by `VITE_EMOJI_API_KEY`; never commit the API key and never scatter hard-coded emoji behavior across unrelated components when the shared pipeline already expresses that meaning.

## 2.4 Unit visuals are unit-owned compositions

Each canonical unit/boss owns the composition of its complete body and signature silhouette. Shared code may construct reusable local parts such as voxel primitives, eyes, paws/hooves/claws, horn pieces, feather/wing cells, tail/tentacle segments and small weapon parts. A shared factory may not accept a species/family/config object and construct the complete animal on behalf of every unit.

The same named unit resolves to the same authored visual identity in Planning, Combat, Library, shop/detail previews and multiplayer playback. Camera, LOD and effect density may differ by surface; species/body identity and action ownership may not.

---

# 3. REQUIRED APPLICATION FLOW

The application must support this complete high-level flow:

`Boot → Loading → Main Menu → New/Continue → Mode setup → Planning → Combat → Result → Next Planning round`

Additional flows must include:

- Fortress map/service flow;
- cooperative lobby/session flow;
- achievements/collection flow;
- unit library/detail/preview flow;
- settings/language flow;
- mod management flow;
- social/donate/tribute flow;
- debug/developer surfaces;
- save/continue flow.

Scene/application routing must support lazy loading and safe disposal of previous scene resources.

---

# 4. BOOT, LOADING, ROUTING, AND APP SHELL

The app shell must provide:

- deterministic app bootstrap;
- central scene/application manager;
- lazy scene routing;
- loading progress;
- loading error handling;
- asset readiness tracking;
- safe scene teardown;
- responsive viewport updates;
- render configuration;
- debug diagnostics;
- performance profiler hooks;
- browser service worker behavior where enabled;
- platform-specific initialization;
- audio startup respecting browser autoplay constraints.

## 4.1 Loading scene

Loading must include:

- visible load/progress state;
- asset loading feedback;
- a small bubble-style loading minigame/interaction;
- graceful handling of assets that are deferred;
- clean transition to the main menu;
- no duplicated scene/audio initialization after repeat entry.

---

# 5. MAIN MENU — COMPLETE FEATURE CONTRACT

The main menu is the player's central hub and must expose the following capabilities.

## 5.1 Primary actions

- Continue an existing valid run.
- Show a concise summary of the saved run near Continue.
- Disable/hide Continue correctly when no valid save exists.
- Start a new game.
- Select the desired game mode.
- Select relevant AI/difficulty configuration.
- Pass selected mode/options into the new run route.

## 5.2 Utility actions

Provide access to:

- Settings;
- Language;
- Achievements / collection progression;
- Mod manager;
- Tribute / credits gallery;
- Social / community links;
- Donation support surface;
- version information and release notes;
- debug/logging extras where enabled.

Only one modal/panel should own focus at a time.

Opening one major overlay must not leave unrelated menu controls clickable behind it.

## 5.3 Social and donation surface

Support:

- external social/community links;
- donation amount choices;
- QR donation presentation;
- platform-aware behavior when running inside Discord activity context;
- safe handling of external links.

## 5.4 Tribute gallery

Support a generated gallery of contributors/credits with:

- avatar/portrait when available;
- name;
- readable grid/list layout;
- lazy image loading;
- responsive presentation.

---

# 6. SETTINGS — COMPLETE FEATURE CONTRACT

Settings must be a real product surface, not a placeholder.

Organize settings into these functional groups:

1. **Audio**
2. **Display**
3. **Gameplay**
4. **Shortcuts**
5. **Device**
6. **Data**

## 6.1 Audio settings

Must include:

- audio enable/disable;
- master volume level;
- persistent storage;
- immediate feedback when changed;
- synchronization with music/SFX systems.

Volume must support the existing discrete user-facing level behavior.

## 6.2 Display settings

Must include:

- graphics quality selection;
- render scale selection;
- supported render-scale presets including `0.5`, `0.67`, `0.75`, and `1.0`;
- battery-saver mode;
- persistence across sessions;
- immediate application where safe.

## 6.3 Gameplay settings

Keep user-facing gameplay presentation preferences centralized and persistent.

Do not mix gameplay rule authority into the settings UI.

## 6.4 Shortcut settings

Expose keyboard bindings in a readable way and preserve canonical keybinding ownership.

Support binding display for planning/combat/navigation actions represented by the game.

## 6.5 Device settings

Provide device/input related controls and information needed by the game, including gamepad/haptics behavior where supported.

## 6.6 Data settings

Provide safe run-data management surfaces required by the app.

Any destructive data action must require deliberate user intent and must not be triggered by accidental clicks.

---

# 7. LANGUAGE AND LOCALIZATION

The game must support Vietnamese and English throughout player-facing UI.

Requirements:

- one compact language button opens the language modal;
- language choices live inside that modal;
- selected language is visibly marked;
- switching locale refreshes visible UI correctly;
- unit names, descriptions, skills, tooltips, modes, settings, tutorial text, environments, recipes, achievements, and menu copy must localize;
- localization must handle dynamic parameters;
- avoid hardcoded one-language strings in reusable feature logic.

---

# 8. GAME MODES

Keep a configurable game-mode system with validation, registration, starting resources, enabled subsystems, difficulty, progression/scaling, scene flow, and win/loss rules.

Required mode families:

## 8.1 Endless PvE Classic

- repeated Planning/Combat rounds;
- scalable enemy strength;
- scalable rewards/resources;
- endless progression;
- endless bosses;
- endless achievements;
- persistent run state.

## 8.2 Endless PvE Fortress

- endless PvE progression plus fortress-specific metadata and services;
- fortress map/service access;
- fortress mode state must survive save/load.

## 8.3 PvP 4 Fortress

- four-fortress/team configuration supported by the canonical mode/network contracts;
- deterministic state boundaries appropriate for multiplayer;
- mode-specific routing and result handling.

## 8.4 Generic PvP capability gate

The game-mode model may represent generic PvP for compatibility or future configuration, but this is not a production player mode. Do not expose matchmaking, a start action or a direct route for generic PvP. The supported competitive ruleset is PvP Fortress, and it is also subject to the current main-menu availability gate below.

---

# 9. NEW GAME AND RUN STATE

Starting a run must create a complete canonical player/run state including the appropriate fields for:

- HP/lives;
- gold;
- round;
- board;
- bench;
- shop state;
- shop lock;
- shop slot count;
- augments;
- augment rounds;
- augment bonuses;
- bench upgrades;
- inventory upgrades;
- inventory bonus;
- craft-table level;
- game-speed progression;
- tech levels;
- item bag;
- crafted items;
- unit equipment;
- collection-related data where applicable;
- creative sandbox units;
- fortress metadata;
- tutorial state;
- tutorial skip state;
- mode metadata;
- multiplayer metadata when applicable.

Run state must be serializable and must not store presentation-only objects.

---

# 10. PERSISTENCE AND CONTINUE

Persistence must support:

- saving canonical run state;
- loading canonical run state;
- validation of stored data;
- safe normalization of missing/older fields;
- Continue availability detection;
- mode-specific state;
- tech levels;
- augments;
- board and bench units;
- unit star/traits/equipment;
- inventory and crafted items;
- shop lock/state;
- tutorial state;
- fortress state;
- cooperative save slots/state where applicable;
- UI settings and keybindings through their own persistent owners.

Only serializable gameplay and progression state belongs in save data. Transient rendering, audio, timer, input and animation state is recreated when needed and is never save state.

---

# 11. BOARD AND ARENA — AUTHORITATIVE GEOMETRY CONTRACT

The arena must use one shared logical coordinate model for Planning, Combat, hover previews, drag/drop, AI, save state, and multiplayer serialization. Never infer gameplay coordinates from rendered meshes.

## 11.1 Logical battlefield

For the solo profile the logical combat board contains exactly **50 unit cells** arranged as 5 rows × 10 logical columns.

- Allied logical columns: `0..4` (5 columns).
- Enemy logical columns: `5..9` (5 columns).
- Rows: `0..4` (5 rows).
- The allied local board is therefore exactly **5×5 = 25 deployable cells**.
- The enemy local board is exactly **5×5 = 25 logical cells**.
- The frontline boundary is between allied logical column 4 and enemy logical column 5.

Do **not** implement an 11×5 logical board. The apparent extra column is a visual divider.

## 11.2 Visual river/gap column

Rendering inserts exactly one visual gap/river column between the two 5-column logical halves. Therefore:

- logical columns = 10;
- river/gap columns = 1;
- visual battlefield columns = 11;
- visual battlefield footprint = **11×5**;
- only 10 of those columns map to logical unit columns.

The river lane is presentation geometry and must never shift logical indices, targeting, occupancy, save data, or network coordinates. Mapping logic must explicitly account for the gap.

## 11.3 Cooperative row profiles

Keep each player ownership span vertically isolated while reusing the same 10-logical-column + 1-river-column model:

- solo: 5 total rows;
- 2-player cooperative profile: 10 total rows, 5 rows owned by each player;
- 4-player cooperative profile: 20 total rows, 5 rows owned by each player.

A player may manipulate only rows owned by that player unless a mode explicitly grants otherwise.

## 11.4 Nested arena geometry

Treat the world as four nested layers, in this exact order:

1. logical battle cells;
2. the inserted visual river/gap lane;
3. one contiguous brown/wood walkable ring immediately outside the visual battlefield footprint;
4. a separate bench/waiting perimeter one block farther outside that brown ring.

For the solo 11×5 visual footprint:

- battlefield visual coordinates occupy `x=0..10`, `z=0..4`;
- the immediate brown ring occupies the one-block perimeter at `x=-1..11`, `z=-1..5`, excluding interior cells, for exactly **40 ring cells**;
- the bench perimeter sits one block farther out with `minX=-2`, `maxX=12`, `minZ=-2`, `maxZ=6`, for exactly **44 perimeter cells**.

The brown ring and bench perimeter are different gameplay/presentation concepts. Never collapse them into one border.

## 11.5 Brown ring behavior

The brown ring is a contiguous walkable presentation surface. It exists so combat presentation may temporarily place melee/assassin actors outside the main tile footprint where required. It must have no decorative fence blocking this path. Fence-connected edge count is effectively zero.

## 11.6 Bench perimeter

Bench slots are laid out along the separate 44-cell outer perimeter. Visible bench slot count is capped by current bench capacity. Bench ordering must be stable and deterministic so a unit does not jump to a different perimeter position after unrelated UI updates.

## 11.7 Terrain cells and voxel presentation

Battle cells remain thin/readable interaction surfaces. Voxel cube bodies, foundations, soil, grass, water and raised terrain are presentation. Use exact cube dimensions consistently and cull hidden/internal voxel faces where practical. An occupied battlefield tile must switch to the no-grass terrain presentation so grass tufts do not visibly intersect a deployed unit.

Units may visually occupy water or brown soil/ring positions when the active combat movement rule permits it. Visual terrain must never silently invalidate a canonical logical target.

## 11.8 Board operations

Every board operation must validate:

- row/column bounds;
- player ownership span;
- occupancy;
- duplicate-species/base restrictions enforced by the active planning rule;
- deployment cap;
- legal origin/destination type;
- current phase;
- mode-specific restrictions.

Board-to-board movement may swap with another allied unit when allowed. Bench-to-board and board-to-bench behavior follows the detailed bench mutation contract in Appendix A.

---

# 12. BATTLEFIELD ENVIRONMENTS

Rounds must support environment identity and environment-driven combat modifiers.

Environment data must support:

- Vietnamese and English names/titles/descriptions;
- short display labels;
- round-based environment cycle;
- per-unit modifier calculation;
- modifiers that can affect defense, magic defense, attack, magic attack, rage gain, and other supported stats;
- application to combat units without mutating the authored base catalog.

Also retain a rotating forest backdrop pool with at least these environment concepts:

1. deep mist forest;
2. ancient dark forest;
3. still forest lake;
4. spiritwood valley;
5. autumn red-leaf forest;
6. misty morning trail;
7. primordial forest waterfall;
8. ancient canopy;
9. wild path;
10. forest dawn;
11. mysterious forest passage;
12. silent night forest.

These themes may be rebuilt in 3D instead of using flat backdrops, but the variety and round identity must survive.

---

# 13. CAMERA, VIEWPORT, AND INPUT MAPPING

The camera system must provide:

- tactical framing of the board;
- responsive framing on desktop/mobile;
- correct board picking after camera movement;
- stable world/screen coordinate conversion;
- zoom constraints;
- pan/orbit behavior appropriate to the game;
- camera joystick support where enabled;
- mode/profile-specific framing;
- a way to frame relevant board regions without breaking input.

All input systems must agree on the same board coordinate model.

---

# 14. PLANNING PHASE — COMPLETE FEATURE CONTRACT

Planning is the main strategy workspace and must support all systems below without turning into a stack of unrelated overlays.

## 14.1 Planning HUD

Show the relevant live values for:

- round;
- player HP/lives;
- gold;
- deployment count/cap;
- shop state;
- synergy state;
- relevant progression state;
- environment/mode context where useful.

## 14.2 Formation and unit movement

The local deployment board is a 5×5 ownership area. Planning movement is atomic: validate source, destination, duplicate restriction, deploy cap, bench cap and swap legality before changing either container. A failed drag/click move changes nothing. The same base/species identity cannot occupy two deployed cells at once; a unit being moved on the board ignores its own source cell for that duplicate check.

The interaction surface must cover:

- select unit;
- drag unit;
- click-to-move where enabled;
- bench → board;
- board → bench;
- board → board;
- bench → bench;
- legal/illegal destination feedback;
- deploy cap checks;
- duplicate-on-board restrictions where rules require them;
- movement logging/tutorial events;
- item drag interactions without confusing them with unit drag.

Board↔bench and bench↔bench swaps preserve ownership rather than cloning/removing units. Moving onto an empty board cell consumes one deploy slot; swapping with an occupied board cell does not increase deploy count. Moving to an empty bench position fails if the unlocked bench is full. Bench ordering remains compact after removals/reorders. See A75 for the exact mutation order and rollback behavior.

## 14.3 Board highlights

Use tile-based highlights for:

- selectable unit;
- valid drop;
- invalid drop;
- attack preview;
- skill preview;
- direct target;
- indirect/AOE target;
- tutorial target;
- special scan/selection effects where applicable.

Do not rely on generic red/blue circles or play-button markers as the main tactical language.

## 14.4 Bench management

The player must be able to:

- inspect occupied bench cells;
- drag units from bench;
- manage locked slots;
- understand current bench capacity;
- unlock extra capacity through the supported progression system.

Normal bench capacity is `clamp(8 + benchUpgradeLevel × 6 + benchBonus, 1, 44)`. The bench is a compact ordered list mapped onto the visual perimeter; unlocking capacity exposes more perimeter positions in the canonical unlock order rather than creating an unrelated second storage system. Existing over-cap state from older saves must remain visible/retrievable until the player resolves it; hydration may clamp the legal upgrade counters but may not silently delete owned units.

## 14.5 Shop

The shop must support:

- roster-driven unit offers;
- tier-aware availability;
- multiple visible shop slots;
- purchase;
- insufficient-gold state;
- refresh/roll;
- shop lock/unlock;
- shop-level/slot progression where supported;
- additional pages/navigation when the offered capacity exceeds one view;
- unit detail access directly from a shop card;
- correct localized price/name/role/tribe/element presentation;
- tutorial targeting of the first available offer;
- clean drag/drop boundaries so units cannot be accidentally dropped into invalid shop space.

The default shop exposes 5 offers and progression may raise the total offer capacity to 20. A screen may show only 2×4 cards at once; when more than eight offers exist, deterministic paging/arrows expose the remaining slots without rerolling them. Lock freezes the current offer array and a locked shop cannot refresh. Refresh cost is level-based—2 gold at levels 1–10, 3 at 11–15, 4 at 16–20, 5 at 21+—then applies reroll-cost modifiers with a floor of 1. Insufficient gold leaves both gold and offers unchanged.

A purchase requires a real offer, enough gold and free bench capacity. Price equals the unit's catalog tier. The bought unit starts at 1★, occupies the compact bench, the paid offer becomes empty, and auto-merge runs immediately. A failed purchase is a no-op. Shop tier probabilities follow the exact level profiles in A3; the redesigned art must not replace that economy with hand-picked or flat-random offers.

## 14.6 Unit card requirements

Unit cards used in Planning and Library must share a coherent visual language while allowing context-specific information.

Cards must be able to show:

- portrait/avatar;
- unit name;
- star level;
- role/class;
- tribe/faction;
- element;
- cost where relevant;
- rage requirement where relevant;
- combat stats appropriate to the context;
- semantic status/icons;
- hover/detail affordance.

Planning cards may intentionally omit selected stats such as HP/damage when the active design calls for a cleaner tactical card, but the data remains available in details/tooltips.

## 14.7 Sell/remove

Support selling/removing a unit according to current economy rules with:

- explicit action;
- correct refund/value handling;
- board/bench cleanup;
- tooltip/feedback;
- tutorial event integration where applicable.

Unit sell value is `catalogTier × starSellMultiplier`, with multipliers 1★=`1`, 2★=`3`, 3★=`5`. Selling must remove exactly one owned unit reference from its real container and credit the computed amount once. Material sale is 1 gold each. Equipment sale uses its own tier schedule (T1=1, T2=4, T3+=12) and must never reuse unit sell multipliers.

## 14.8 Upgrade and merge

Support:

- star progression;
- automatic merge rules where enabled;
- deterministic merge eligibility;
- stat recalculation after upgrade;
- visual star change;
- model/skin evolution where defined;
- preservation of relevant equipment/traits according to canonical rules.

Merge is exactly 3 copies of the same species identity and same star into 1 copy at the next star, capped at 3★. Copies may be split across board and bench. Selection/removal must be deterministic, preserve variant ancestry, combine equipment subject to slot/duplicate rules, return overflow equipment to the item bag, choose the highest-tier represented catalog identity for the merged result, place the upgraded unit in a deterministic surviving location, and repeat until no further chain merge exists. Stat scaling (1/1.6/2.5) and skill scaling (1/1.2/1.4) are separate contracts and must not be conflated.

## 14.9 Inventory and storage

Support:

- item bag;
- crafted items;
- inventory capacity;
- inventory capacity upgrades;
- item selection;
- item drag;
- equipping onto a unit;
- unequipping;
- item tooltips/details;
- storage UI;
- clear capacity feedback.

Base planning inventory capacity is the number of currently owned board units plus bench units, then supported inventory bonuses expand that limit. The visible storage surface must render at least `max(resolvedCapacity, currentItemCount)` so old/over-cap items never disappear. Over-cap state blocks new normal insertions where the owning action enforces capacity; it does not erase existing items.

## 14.10 Equipment

Equipment must be represented both in Planning and Combat.

Support equipment effects such as the stat/effect families represented in item data, including percentage stat bonuses, starting rage, healing-related effects, burn/on-hit effects, and other item-specific modifiers.

Equip is all-or-nothing: the target unit must exist, the item must be equipment, its tier may not exceed unit star, duplicate-name/type restrictions must pass, a slot must be free, and the exact item must exist in the bag. Only then is one bag entry removed and appended to the unit. Unequip-all computes every item cost first (`max(0, baseUnequipCost - unequipDiscount)`), checks total affordability, spends once, returns all equipment to the bag and clears the unit's equipped list. Default unequip costs are T1=2, T2=7, T3+=15 when item data does not override them.

Equipment slot capacity is star-aware and data-derived rather than a universal “3 slots”. Resolve the unit's star-specific skill first; slot cap is the resolved skill cost when finite, otherwise the unit/catalog `rageMax`, otherwise 3, rounded and clamped to at least 0. Equipment normalization removes duplicate equipment by canonical name/type key and truncates only beyond this resolved cap. Because merge changes star and may change skill cost, merge must recalculate the destination cap and return equipment beyond that cap to the item bag rather than deleting it.

## 14.11 Crafting

Support:

- craft table state/level;
- crafting slots/grid;
- ingredient placement;
- pattern validation;
- crafted output;
- material consumption;
- output inventory handling;
- recipe lookup;
- tutorial integration;
- localized recipe names/descriptions/bonuses.

The craft surface is always a canonical 3×3 index space. Craft-table level 0 activates no cells; level 1 activates center cell `[4]`; level 2 activates `[0,1,3,4]`; level 3 activates all nine cells. Ingredient staging is non-destructive: placing/removing staged materials never mutates the bag. Recipe matching slides the authored 1×1/2×2/3×3 pattern within the active square and rejects candidates if any staged material exists outside the candidate footprint. A successful craft copies the bag, consumes exact required ingredients from the copy, appends the output, commits the copied bag once, records craft history, clears staging and persists. Any failure leaves the original bag unchanged.

## 14.12 Recipe Library

Provide a browsable recipe library with:

- offense category;
- defense category;
- magic category;
- tier grouping;
- support for recipe tiers 1–4 where data provides them;
- recipe cards;
- selected recipe state;
- detail panel;
- stats/bonus list;
- description;
- ingredient grid/pattern;
- required material list and counts;
- output preview;
- category labels;
- scrolling;
- responsive layout.

The detail view must be useful even before the player crafts the recipe.

## 14.13 Tech tree

The technology system must support:

- multiple tech branches;
- nodes;
- levels;
- prerequisites;
- max-buy constraints;
- research cost;
- affordability check;
- locked/unlocked/researchable/maxed state;
- connections between nodes;
- selected-node info;
- localized node name/description;
- player tech-level persistence;
- effects feeding canonical progression values such as bench capacity, inventory capacity, speed, and other supported bonuses.

Research requires the node to exist, all prerequisites to have at least one purchased level, current level below max and enough gold. Multi-parent nodes require every parent. Cost comes from the current-level entry or the authored infinite-node formula. Research spends gold and increments node level exactly once, then applies that node's effects to the canonical progression fields. Any failure changes neither gold nor tech levels. Root is informational/unpurchasable. The complete branch/node costs and effects are fixed in A8.

The visual tree may be redesigned completely, but panning/zooming, node state readability, and information density must remain strong.

## 14.14 Synergies

Support:

- calculating active synergies from deployed units;
- threshold/count logic;
- tribe/faction and other synergy families represented by data;
- current/next threshold feedback;
- localized tooltip/detail;
- Planning HUD/modal access;
- tutorial explanation.

Synergy counts are derived from deployed qualifying units plus explicit virtual-count bonuses from augments/tech. Bench-only units do not silently count as deployed. Each family exposes current count, highest active threshold and next threshold. The principal authored thresholds are 2/4/6, with exact class/element/faction effects and counter relationships defined in A9.

## 14.15 Augments

Support:

- augment choice rounds;
- modal selection;
- selected augment persistence;
- augment bonuses;
- round tracking to prevent invalid repeat handling;
- combat/planning application of augment effects;
- localized descriptions;
- disabled/selected state.

Normal augment-selection rounds are exactly 3, 5 and 7. A player cannot select the same augment id twice. Selection persists immediately; immediate rewards execute once; persistent numeric modifiers accumulate by effect type and are thereafter consumed by their owning economy/formation/combat systems. Reopening UI or hydrating a save must not replay an augment's immediate reward.

Augment presentation must also preserve power classification/scoring used by the product. The evaluator must understand economy, formation, combat, and synergy groups plus effect families such as flat gold, interest, roll-cost change, deploy-cap bonus, bench/inventory bonus, starting rage, team ATK/HP/MATK/DEF/MDEF, starting shield, extra class/tribe count, lifesteal, XP, win-gold bonus, interest-rate bonus, XP-cost change, and rage-gain bonus.

Where the UI exposes augment strength, preserve the tactical/strong/rare tier semantics from the canonical scorer instead of inventing an unrelated visual rating.

## 14.16 Unit information panel

Provide a reusable unit-info surface showing:

- identity;
- current star;
- role/class;
- tribe;
- element;
- stats;
- basic attack information;
- skill summary;
- full skill detail;
- target/shape/selection/affected-count/duration clarity;
- current equipment;
- recommended usage/position where supported;
- star milestone comparison;
- skin/evolution information where applicable.

The panel is a live inspection surface, not a static encyclopedia card. Its selected subject may come from the currently selected bench unit, a board unit, or a shop offer. It must keep identity by stable unit uid when an owned unit moves, and must re-resolve star-aware stats/skill/resources instead of caching stale display numbers. If there is no explicit selection, fallback order is: currently selected bench slot → first non-empty bench slot → first occupied player-board cell in row-major order → first non-empty shop offer → empty state.

For an owned unit, current HP/max HP and current rage/shield are real owned-unit state, but Planning must preview opening resources consistently with Combat: resolve the current-star skill first; rage maximum uses explicit owned `rageMax` when present, otherwise current-star skill cost, otherwise base rage maximum. Displayed rage is `min(rageMax, max(currentRage, playerStartingRage + unitStartingRage))`. Unit-local starting rage is the rounded non-negative sum of equipment + variant starting-rage bonuses capped to **+4** at this stage. Displayed shield is `max(currentShield, playerStartingShield + unitStartingShield)`. In co-op, a deployed LEFT unit uses the owning row-slot player's starting-resource state rather than blindly reading the local viewer's player state.

The panel resolves 1★/2★/3★ stats and skill through the same star materialization used by tooltip/combat. Shop offers are previews, not fake owned units: they have zero current rage/shield unless the preview contract explicitly applies a starting-resource preview. The panel should expose both tier-3 and tier-4 equipment recommendation groups, up to three recipes per group, and scroll only the recommendation/content viewport when its content exceeds the panel.

## 14.17 Context menu

Support context-sensitive unit actions without duplicating rule logic. Opening a new unit context menu destroys the previous one so only one may exist.

Every unit menu contains **Details**, which opens the same canonical unit detail/Library inspection for that base unit. A **BENCH** unit additionally exposes **Sell**. A **BOARD** unit additionally exposes **Recall** and **Sell**. Recall searches the bench for the first null/empty slot; if none exists and current bench length is still below the resolved bench cap, the append position becomes the destination. If neither is available, Recall performs no mutation and emits the bench/queue-full feedback. A successful Recall calls the normal board→bench movement transaction, then plays the normal click feedback; it may not bypass deploy/bench ownership, merge, persistence or tutorial rules by manually splicing arrays.

Clicking an option executes exactly once, destroys the menu and clears menu ownership. A click outside closes the menu without firing an option. Context actions obey the same phase/modal/tutorial/ownership restrictions as their primary Planning controls; the context menu is only another entry point into canonical mutations.

## 14.18 History / combat log

Provide a Planning-accessible history surface with:

- round number;
- category;
- icon;
- title/message;
- detailed lines;
- category filters;
- active-filter state;
- empty state;
- scrollable list;
- localized labels.

History should make recent combat/economy/system events understandable after returning to Planning.

## 14.19 Planning log

Short live planning feedback should record important actions/errors such as:

- buy;
- sell;
- move;
- deploy limit;
- invalid placement;
- shop action;
- craft action;
- tech action;
- tutorial gating;
- mode-specific events.

## 14.20 Creative sandbox

Preserve a creative/testing gameplay surface capable of representing sandbox units and sandbox-board interactions without corrupting the normal run board.

Sandbox state must remain separate and serializable where intended.

## 14.21 Special player-pressure state

The **Hạ Cortisol / Lower your Cortisol** control is a presentation-only Planning easter-egg/comfort interaction, not a player pressure stat and not a combat modifier.

- Activation duration is exactly **2 minutes**.
- While active, currently visible allied creatures perform a light bob/dance by temporarily offsetting their presentation Y position and yaw.
- Newly rendered allied creatures during the active interval join the dance.
- The button shows a live remaining-time label.
- When the timer ends, every affected creature returns to its recorded base Y/yaw and all temporary presentation metadata is removed.
- It writes a localized Planning log entry.
- It does **not** modify HP, ATK, MATK, DEF, MDEF, rage, economy, AI, combat state, save progression, or any other canonical gameplay field.
- Tutorial gating may temporarily allow/block pressing the control like any other Planning utility action.

---

# 15. TUTORIAL — EXACT EIGHT-ROUND GUIDED FLOW

The tutorial is a state machine, not a slideshow. Each step must define a stable id, localized copy, live target resolver, allowed actions, allowed target(s), completion event, optional delay, visual pointer, and persisted progress. Target resolution must use current responsive layout bounds rather than stale screen coordinates. `TUTORIAL_END_ROUND = 8`.

Actions not explicitly permitted by the current restrictive tutorial step must be blocked or ignored without corrupting state. Skipping the tutorial must leave the run in a valid normal-play state.

## Round 1 — buy, deploy, synergy, start

Execute this sequence in order:

1. Welcome/introduction.
2. Resolve the first currently available purchasable shop unit.
3. Require buying that unit.
4. Resolve a recommended role-aware deployment cell.
5. Require moving the purchased reserve unit from bench to that board cell.
6. Open/explain the synergy panel and current synergy count.
7. Require buying a second available unit.
8. Require deploying the second unit.
9. Unlock/point to the Start control and require starting combat.

The role-aware placement recommendation is teaching guidance only; it must not become an autoplay system after the tutorial.

## Round 2 — economy, reroll, expand formation

1. Explain current gold, player XP/level and deploy cap.
2. Require exactly one shop refresh/reroll.
3. Require buying a third unit and deploying it.
4. Require buying a fourth unit and deploying it when legal.
5. Require Start.

## Round 3 — reposition, sell, history, settings

1. Require repositioning an already deployed board unit.
2. Provide/identify the intended reserve unit and require selling it through the Sell action.
3. Require opening History.
4. Require closing History.
5. Require opening Settings.
6. Require closing Settings.
7. Require Start.

## Round 4 — own-unit hover and targeting preview

1. Require hovering/focusing one of the player's deployed units.
2. Show the shared unit tooltip.
3. Show that unit's basic-attack target preview and skill target/shape preview.
4. Explain direct versus indirect target tile language.
5. Require Start.

## Round 5 — equipment round-trip

1. Ensure `eq_warmog_armor` is available in inventory for the tutorial path.
2. Require equipping it onto a board unit.
3. Require dragging/using the equipped unit with the Unequip action so the item returns to the bag according to canonical unequip rules.
4. Require equipping the same item again.
5. Require Start.

## Round 6 — canonical crafting

1. Ensure material `tear` is available.
2. Require placing `tear` into craft-grid center index `4`.
3. Require crafting the expected output `eq_blue_buff` (Bùa Xanh).
4. Require equipping that crafted item onto a board unit.
5. Require Start.

Craft staging during this tutorial must still obey normal non-destructive staging and atomic commit rules.

## Round 7 — augment selection

1. Present exactly three fixed tutorial augment options.
2. Require choosing one.
3. Persist the chosen augment through the normal augment state.
4. Show a summary that contains the chosen augment name.
5. Require Start.

## Round 8 — final/free-play handoff

1. Show the final tutorial summary.
2. Enable normal planning actions.
3. Let the player freely buy, sell, move, equip, inspect, craft, research, and manage available systems.
4. Require Start only when the player decides they are ready.
5. Mark the tutorial complete after this handoff according to persisted tutorial state.

---

# 16. COMBAT — COMPLETE FEATURE CONTRACT

Combat presentation must be rebuilt around canonical deterministic resolution.

The visual layer observes and stages combat state; it does not invent different outcomes.

## 16.1 Combat lifecycle

Support:

1. create combat units from owned units;
2. apply environment/mode modifiers;
3. build initial queue/order;
4. select actor;
5. determine legal action/target;
6. move when required;
7. play attack/skill presentation;
8. apply damage/heal/effects at the intended impact moment;
9. update statuses/resources;
10. resolve deaths/removals;
11. continue turns;
12. determine combat outcome;
13. resolve loot/reward/result;
14. transition to the next flow.

## 16.2 Basic attacks

Support attack definitions, scaling, target selection, attack previews, range behavior, damage type and presentation.

In active combat, MAGE and SUPPORT basic attacks use effective MATK and magic damage by default; TANKER, FIGHTER, ASSASSIN and ARCHER use effective ATK and physical damage unless a unit explicitly authors a different attack. A normal physical basic attack performs the canonical hit roll; a miss deals zero damage, consumes no shield, can trigger dodge rewards, still grants the defender's normal hit-response rage unless suppressed, and may trigger a full-rage TANKER response. A successful basic hit receives attacker rage only after positive HP damage is actually dealt. The canonical rage model is each unit's own small resource scale from A74; never normalize combat to a generic 0–100 bar.

Melee units must be able to stage contact movement where their behavior requires it.

Ranged/magic attacks must have readable projectile/cast/impact timing.

## 16.3 Skills

Support the full skill families represented by the game:

- melee offensive skills;
- ranged offensive skills;
- mage offensive skills;
- generic offensive effects;
- support skills;
- defensive effects;
- common combat effects;
- utility effects;
- multi-rider skills;
- self-effects;
- target-side effects;
- area/shape effects;
- status application;
- stat modification;
- healing;
- shields;
- rage manipulation;
- movement/position effects where supported.

Skill resolution is star-aware. Resolve the unit's effective skill definition for its current star before checking cost, targets, displayed numbers or effects. Raw skill value follows A13; selection/shape/count/duration follow A76; unit-specific effect handlers remain authoritative for riders beyond the generic effect families. One generic-looking label must never replace an authored multi-step skill such as “damage all, then stun only N selected enemies”, “revive first otherwise heal”, delayed echo, double hit, spread, chain, cleanse or conditional control.

## 16.4 Skill targeting model

Targeting must support data-driven concepts including:

- ally/enemy/self side;
- selector;
- shape;
- count;
- range;
- lowest-HP targeting;
- lowest-rage ally targeting;
- multi-target;
- AOE/special patterns;
- current-board legal cells;
- target preview cells;
- descriptive selection rule text.

Selector, shape and affected count are three separate concepts. For example, “highest-rage enemy” chooses a center/target, while a 3×3 or cross-5 shape expands from that center, and affected-count rules decide whether every legal cell or only a capped subset receives a rider. The exact selector meanings and fallback families are fixed in A76; previews and combat must call the same resolved rules.

## 16.5 Skill clarity contract

Every skill must be able to expose localized clarity fields for:

- short gameplay pitch;
- full detail text;
- target text;
- shape text;
- selection rule;
- affected count;
- duration rule;
- star-specific values;
- star milestone changes.

Do not derive critical skill meaning from vague prose when structured fields exist.

## 16.6 Rage/resource

Combat must support per-unit rage/resource values including:

- current rage;
- required/max rage;
- rage gain;
- starting rage modifiers;
- rage gain modifiers;
- rage drain/return effects;
- UI representation;
- skill cost integration.

Do not normalize every unit to a 100-point rage bar. `rageMax` is unit/skill data and may be a small integer. Skill readiness is `currentRage >= rageMax`; a normal turn-cast resets/consumes rage according to the skill path before execution. Defender hit-response rage, basic-attack attacker rage, dodge rewards, Mage refund, Assassin/Berserk kill refund and skill-authored rage manipulation are distinct sources and each clamps to the receiving unit's rage maximum.

## 16.7 Role passives

Preserve role/class passive behavior and apply it through the canonical combat rules.

Presentation may explain passives but must not reimplement them independently.

## 16.8 Status effects

Support:

- status application;
- status duration/turn ticking;
- buffs;
- debuffs;
- poison/burn/stun/sleep/anti-heal and other defined statuses;
- source/owner where required;
- status cleanup;
- status tooltip;
- status visual icon;
- left/right positive/negative grouping where appropriate.

Application and expiry are not “set a flag and draw an icon”. Reapplication rules, stronger/longer-value preservation, DoT tick cleanup, shield lock, heal block/reduction, evasion rewards, reflect, physical reflect, counter, protecting, guardian redirect/charges, damage reductions, Berserk, Soul Link, Blood Hunt, Pangolin Shield and Resilient Shield follow A73. The combat loop must remove payload values when their owning timed status expires so an invisible expired status cannot continue modifying combat.

The header/status row must show real statuses only.

Do not fabricate a `Shield` badge merely because a numeric shield value exists unless the status model explicitly defines such a badge.

## 16.9 Offense debuff

Preserve the canonical offense-debuff model:

- value;
- turns;
- mode;
- automatic stat selection by role where configured;
- mage/support can target MATK while other roles can target ATK under the automatic mode.

## 16.10 Damage

Damage resolution must support:

- physical/magic or supported damage categories;
- attacker/defender stats;
- modifiers;
- mitigation;
- shields/defense interactions;
- environment modifiers;
- crit/special modifiers where defined;
- deterministic random input where required;
- aftermath hooks;
- death checks.

For an ordinary resolved hit, use one canonical order: determine hit/miss when the attack type permits it → compute raw/element/crit/DEF-or-MDEF/true-damage result → apply tier stun rider when eligible → resolve guardian redirect → apply active generic/magic/fortify damage reductions → absorb remaining damage with shield → subtract only the remainder from HP → record passive hit bookkeeping → run A74 aftermath (rage, on-hit DoT, reflect/counter, lifesteal, revive/death/low-HP, kill riders). A presentation animation may delay the semantic impact point, but it may not reorder these state transitions.

## 16.11 Healing and heal block

Support:

- direct healing;
- healing percentage modifiers;
- heal-block/anti-heal behavior;
- visual heal feedback;
- correct cap at current max HP where applicable.

Healing must target living legal recipients unless the skill is explicitly a revive branch. Final healing cannot push current HP above max HP. Heal-block produces zero legal healing while active; heal-reduction modifies the heal through its canonical percentage; healing bonuses from unit/equipment/trait/environment/skill state are resolved by the shared heal path rather than being reimplemented in individual visual effects. Revive is separate from healing and follows its own one-use/fallen-unit rules.

## 16.12 Equipment in combat

Equipment effects must feed canonical unit construction/combat calculation and must remain visible/explainable through unit detail/tooltips.

## 16.13 Movement and impact timing

Presentation timing is part of correctness.

- Move the actor to the intended presentation position when required.
- Apply damage only when the attack/skill reaches its semantic impact point.
- Show hit impact on the actual target location.
- Return/recover actor pose according to the animation contract.
- Keep damage/heal/status floating text attached to the unit's current position.
- Remove dead units from rendering and board occupancy at the correct lifecycle point.

## 16.14 Combat queue and turn state

Support:

- combat queue/order;
- deterministic turn advancement;
- status-turn processing;
- action completion;
- safe interruption when a unit dies;
- end-condition checks;
- round result creation.

Queue construction and action choice are deterministic as defined in A11. At actor start, tick/process statuses at the canonical turn point; a dead/removed/disabled actor can be skipped without shifting ownership or paying rewards. A legal full-rage non-silenced actor prefers skill; otherwise disarm blocks its normal basic; otherwise it performs a basic attack. After each fully resolved actor action, increment anti-stall action count and check combat end before advancing to another actor.

## 16.15 Combat random behavior

Where deterministic/seeded behavior exists, preserve it.

Do not call uncontrolled `Math.random()` inside logic that is expected to synchronize or reproduce combat outcomes.

## 16.16 Combat HUD

Combat HUD must expose relevant:

- unit names;
- HP;
- rage/resource;
- statuses;
- target/hover details;
- phase/round context;
- result transition;
- action preview/tooltip when applicable.

## 16.17 Result flow

Combat result handling must support:

- win/loss/draw where applicable;
- HP/life consequences;
- rewards;
- loot drops;
- progression updates;
- achievement/collection updates;
- mode-specific outcome state;
- next-round transition;
- game-over/endless continuation behavior.

The result is paid once. On a player win, base gold equals enemy-team unit count, star bonus is the sum of `max(0, enemyStar-1)`, Assassin bounty is added, authored victory-gold bonus is added, and normal passive XP reward is +2 unless Creative suppresses it. Win streak increments and lose streak resets. On a loss, win streak resets, lose streak increments and Assassin bounty already earned during battle is still payable; `NO_HEARTS` subtracts canonical incoming round damage and ends only when HP reaches 0, while `NO_UNITS`/other immediate-defeat conditions end the run immediately. Draw resets both streaks and deals no normal round damage. Creative does not mutate normal gold/HP defeat consequences where its sandbox flags suppress them. Loot insertion respects actual inventory capacity and must not be rolled/applied again when result UI reopens or a network/result callback repeats.

## 16.18 Sudden-death / anti-stall escalation

Combat must preserve the anti-stall deathmatch rule.

- Track resolved actor action count.
- After action 100, every fifth resolved action escalates global damage.
- Each escalation increases the global damage multiplier by `+0.2`.
- The escalation state must be deterministic and part of canonical combat progression.
- Presentation should clearly communicate escalation without owning the multiplier logic.

## 16.19 Team status and combat power

Preserve the aggregate team-status model for both combat sides.

Each side must be able to report:

- unit count;
- current combined HP;
- combined max HP;
- HP ratio;
- current combat power;
- maximum/reference combat power;
- power ratio.

Combat power must remain a shared canonical metric derived from the supported stat families (HP, shield, ATK, MATK, DEF, MDEF, star, tier) rather than a UI-only guess.

This model can drive team bars, battle comparison, preview, or other presentation surfaces while remaining independent from rendering.

---

# 17. LOOT AND REWARD FEEDBACK

Loot systems must provide:

- deterministic or rule-based loot generation;
- item/reward ownership updates;
- localized drop text;
- visible reward feedback;
- correct result-flow integration;
- no duplicate reward application after repeated transition callbacks.

---

# 18. AI

AI must support:

- AI mode selection;
- normalization/validation of AI mode;
- difficulty settings;
- enemy team generation;
- strength scaling;
- target selection;
- legal action selection;
- role-aware behavior where defined;
- tutorial-friendly AI mode where represented;
- compatibility with deterministic combat.

Enemy preview should let the player understand the upcoming encounter without making presentation state part of gameplay authority.

---

# 19. ENEMIES, ENCOUNTERS, AND ENDLESS BOSSES

Preserve:

- encounter definitions;
- enemy preview data;
- enemy team generation hooks;
- endless boss catalog;
- boss-specific visual identity;
- boss-specific skills/behavior represented by data;
- increasing endless challenge;
- boss reward/result integration.

All endless bosses must have deliberate authored presentation rather than generic enlarged normal-unit treatment.

---

# 20. UNIT CATALOG AND CONTENT MODEL

The complete unit catalog is mandatory content.

Do not reduce the roster to a demo subset during the rebuild.

Unit data must continue to support:

- stable unit id;
- localized name;
- role/class;
- tribe/faction;
- element;
- tier/cost;
- base stats;
- star-scaled stats;
- rage max/cost;
- basic attack definition;
- skill id/definition;
- skill star modifiers;
- gameplay description;
- detailed skill description;
- skin data;
- visual/model identity;
- SFX profile;
- evolution/star naming;
- variant traits/seeds;
- equipment;
- tooltip metrics.

The full playable roster and all boss entries must resolve successfully through the catalog.

---

# 21. ROLES, TRIBES, ELEMENTS, AND VISUAL IDENTITY

Preserve class/role identity such as the defender/tank, assassin, ranged/marksman, mage, support, and fighter families represented by the unit catalog.

Preserve elemental/tribal identity including the supported theme families such as:

- Stone;
- Wind;
- Fire;
- Tide/Water;
- Night;
- Spirit;
- Swarm;
- Wood;
- other catalog-defined values.

These identities must affect UI readability and may affect gameplay through synergies/environment rules.

Do not encode the identity only through color; use iconography, shape, ornament, effects, labels, and character design cues.

---

# 22. UNIT VISUAL SYSTEM

## 22.1 Shared visual contract

Every visible combat unit must support:

- model creation;
- material ownership;
- transform root;
- orientation/facing;
- locomotion profile;
- idle animation;
- attack animation;
- skill animation;
- take-hit animation;
- move animation;
- internal impact hooks;
- star visuals;
- skin visuals;
- status billboard;
- portrait rendering;
- cleanup/disposal.

## 22.2 Five player-facing animation states

The Library/action preview must expose exactly the intended player-facing states:

1. Idle / Rảnh rỗi
2. Attack / Đánh
3. Skill / Kỹ năng
4. Take Hit / Chịu đòn
5. Move / Di chuyển

Hit-impact is an internal combat/contact effect, not a sixth Library button.

## 22.3 Motion profiles

Motion profiles must support differentiated locomotion including:

- grounded walk/run;
- hover/flying rest height;
- water-native movement;
- species-specific idle waveforms;
- per-unit deterministic motion signature.

Do not use one universal vertical bob for every creature.

## 22.4 Geometry quality

Requirements:

- connected anatomy;
- no detached neck/head;
- no floating limbs/accessories;
- no obvious internal see-through holes;
- correct front/back orientation;
- enough silhouette detail to read at board distance;
- small details may use micro-voxels;
- hidden faces should be culled for dense voxel rigs;
- transparent material use must be intentional;
- opaque creature bodies should remain visually solid.

## 22.5 Bespoke character behaviors

Retain and improve special authored behavior wherever a unit has it.

Examples of required character-specific presentation include:

### Chicken Rapper

- microphone-driven singing idle;
- music-note effects;
- microphone throw/boomerang attack;
- jump-and-sing skill;
- rapper accessories/skins;
- expressive combat personality.

### Sleepy Hen Girl

- lies in bed with blanket;
- sleepy idle personality;
- occasional sleep-text/bubble gag;
- sit-up/pillow attack behavior;
- yawn-like skill behavior;
- dense micro-voxel detail for hair/pajamas/bed/blanket/pillow;
- star/skin variants remain readable.

### Spider

- eight individually articulated legs;
- correct facing;
- listening/alert idle;
- pounce/front-leg attack;
- web-trap skill;
- take-hit recoil;
- eight-leg scuttle movement;
- web-themed cosmetic variant with its own presentation.

### Hawk Hunter

- wing/talon/tail articulation;
- lock-on behavior;
- projectile/impact identity;
- five-state authored controller.

### Monkey Spear

- articulated limbs/tail;
- spear/crown personality;
- projectile behavior;
- strong skill impact staging.

### Owl Nightshot

- wing/head/tail articulation;
- crescent/sleep projectile identity;
- readable sleep/Zzz impact language.

### Wasp Sting

- four independently animated wings;
- six legs;
- antennae;
- mandibles;
- articulated stinger;
- dart attacks;
- multi-dart skill;
- poison impact;
- dense raised micro-detail.

### Fox Flame

- connected fox anatomy;
- articulated four paws;
- segmented flame tail;
- claw flash;
- foxfire wisps;
- ember impact;
- backline assassin skill staging.

### Scorpion Shadow

- twin multi-joint pincers;
- eight articulated legs;
- segmented tail/stinger;
- needle/stun/rage-drain presentation;
- hit reaction without moving the gameplay root incorrectly.

### Weasel Quick

- articulated spine/head/jaw/shoulders/paws;
- segmented pale-tip tail;
- visible assassin weapon;
- rapid slash skill;
- dash/rage-return feedback;
- hit reaction that preserves canonical board position.

### Jaguar Hunt

- connected body → neck → head silhouette;
- broad feline head and muzzle;
- visible spotted coat detail;
- articulated paws;
- long segmented tail;
- triple-claw attack effects;
- blood-cost skill staging;
- star-scaled blood slashes;
- heal-return and anti-heal presentation where defined.

These examples establish the quality bar: units with authored personality must not be flattened into generic archetype animation.

---

# 23. STAR EVOLUTION AND SKINS

Support visual progression across star levels and cosmetic variants.

The system must support:

- star visual identity;
- star-dependent stats;
- star-specific skill changes;
- star milestone description;
- model detail/effect upgrades where authored;
- skin selection/data;
- skin-specific geometry/accessories where authored;
- skin-specific animation/controller hooks where authored;
- skin-specific palette/effects;
- collection unlocks/rewards.

Also preserve the ability to describe class/tribe-themed cosmetic variants using metadata such as:

- weapon type;
- head accessory;
- species accent;
- side accent;
- aura shape;
- palette;
- skin tone where relevant;
- semantic icon/accent;
- localized cosmetic name.

This cosmetic metadata must never replace the creature's primary species silhouette unless a specific skin intentionally does so.

---

# 24. UNIT STATUS BILLBOARD

Above-board unit status must support:

- name;
- HP;
- rage/resource;
- status icons;
- positive and negative status grouping;
- readable enemy hover state;
- frame assets for status bars;
- correct world-to-screen anchoring;
- no stale position after movement;
- cleanup on death.

Static frame/chrome should use authored assets; only dynamic fill amounts should be drawn procedurally.

---

# 25. LIBRARY / COLLECTION BROWSER

The unit Library must be a full inspection tool, not a static roster grid.

## 25.1 Browse/filter

Support:

- all units;
- class filter;
- tribe filter;
- tier/star filter where appropriate;
- text search;
- reset filters;
- pagination or equivalent scalable navigation;
- responsive grid;
- empty-results state.

## 25.2 Unit card

Library cards must show enough identity to distinguish units immediately and include class/tribe/element/star information appropriate to the design.

## 25.3 Detail view

Show:

- large animated portrait;
- localized unit description;
- current star stats;
- role/tribe/element;
- basic attack details;
- full skill detail;
- target/shape/count/duration clarity;
- star milestone comparison;
- skins/evolution;
- recommendations;
- battle preview when supported.

## 25.4 3D portrait interaction

Support:

- transparent or clean presentation background;
- idle animation by default;
- drag/hold rotation;
- sensible zoom;
- full-screen/detail expansion where supported;
- action preview controls;
- avatar remains the real unit model, not a disconnected thumbnail approximation.

---

# 26. TOOLTIP SYSTEM

All game tooltips must use one shared presentation language.

Support tooltip types for:

- units;
- planning actions;
- combat state;
- statuses;
- synergies;
- items;
- tech;
- skills;
- descriptions with inline markup.

Tooltip requirements:

- consistent frame/assets;
- consistent typography;
- localized content;
- viewport clamping;
- does not cover the source target unnecessarily;
- avoids covering critical shop/action controls;
- correct z-order;
- pointer-safe behavior;
- semantic status formatting;
- one consistent interaction/visual language instead of screen-specific variants.

---

# 27. ACHIEVEMENTS AND COLLECTION PROFILE

Support a persistent collection/achievement profile with:

- rounds won/stat tracking;
- endless achievement progress;
- achievement title/description;
- locked/unlocked state;
- reward display;
- cosmetic/skin reward unlocks where defined;
- collection summary;
- persistent storage;
- responsive achievements modal.

Achievement progress must update from canonical result/progression events, not from visual heuristics.

---

# 28. FORTRESS SYSTEM

Support fortress gameplay surfaces and state including:

- fortress mode metadata;
- fortress map scene;
- fortress service modal;
- Planning actions tied to Fortress progression;
- mode-specific actions/services;
- persistence;
- result/round integration;
- multiplayer/PvP fortress contracts where required.

The fortress map should look like part of the same game, not a separate prototype UI.

---

# 29. COOPERATIVE MULTIPLAYER

Support cooperative multiplayer including:

- coop configuration;
- lobby scene;
- session lifecycle;
- peer client;
- P2P transport;
- board-state synchronization;
- combat synchronization;
- cooperative save slots;
- planning synchronization;
- AI mode/difficulty configuration for cooperative play where supported;
- disconnect/error handling;
- deterministic shared state boundaries.

Network synchronization exchanges canonical serializable state/events, never transient presentation objects.

---

# 30. PVP / FORTRESS NETWORK CONTRACTS

Preserve network contracts for fortress PvP, including the state needed to represent participating fortresses/teams, round/combat synchronization, and result flow.

Production UI must honor feature gating and should not expose modes that are intentionally unavailable.

---

# 31. DISCORD ACTIVITY INTEGRATION

Preserve Discord embedded-app integration where supported, including:

- activity presence/context;
- platform-aware UI behavior;
- social/donation behavior that differs inside embedded context;
- graceful fallback when the SDK/context is unavailable.

---

# 32. AUDIO SYSTEM

Audio must feel synchronized with gameplay and presentation.

Support:

- music director;
- scene playlists;
- background music;
- SFX playback;
- unit-specific SFX profiles;
- named playlists;
- lazy/deferred scene audio loading;
- prefetching where appropriate;
- persistent enable/volume settings;
- combat impact timing;
- UI feedback sounds;
- safe browser autoplay handling;
- cleanup when scenes change.

Avoid loading all audio up front if it harms startup memory/time.

---

# 33. HAPTICS

Where device/browser support exists, provide haptic feedback hooks for high-value interactions such as:

- confirmed purchase;
- successful placement;
- impactful combat hit;
- important modal/selection confirmation.

Haptics must fail silently and safely when unsupported.

---

# 34. KEYBOARD, GAMEPAD, POINTER, TOUCH

The game must support the relevant input paths represented by the product:

- mouse pointer;
- touch;
- drag/drop;
- keyboard bindings;
- camera/navigation keyboard controls;
- gamepad controller;
- camera joystick;
- modal keyboard handling;
- shortcut display in settings.

Input focus must respect active modals and overlays.

One input mode must not leave stuck drag/selection state when another input mode takes over.

---

# 35. MOD SYSTEM

Preserve a full mod-management system and player-facing UI surface.

Requirements:

- central mod registry;
- mod manager modal;
- enable/disable or management affordance according to available mod metadata;
- validation and safe loading boundaries;
- core gameplay catalogs should remain extensible rather than hard-coded into every UI;
- future package types can be integrated without redesigning the whole app shell.

The mod manager should feel analogous to a real game's mod list rather than a developer-only debug panel.

---

# 36. EMOJI / ICON PIPELINE

Semantic icons should use the centralized icon pipeline.

Requirements:

- remote emoji asset support when configured;
- cached/fallback behavior;
- atlas support for rendering contexts that need it;
- consistent Unicode fallback when richer icon art is unavailable;
- the same semantic concept uses the same icon/fallback behavior across screens.

---

# 37. ASSET LOADING AND VISUAL RELIABILITY

Asset-heavy screens must load predictably and fail gracefully. The player must see meaningful loading progress when a route requires large assets; duplicate requests must reuse already available data; optional/deferred assets may appear later without blocking core interaction; leaving a screen cancels or abandons stale visual work; and a failed decorative asset must not corrupt gameplay state or leave the app permanently blank.

Graphics quality, resolution and render-scale changes must apply safely and consistently. Long sessions must remain stable without unbounded growth of hidden visual objects or repeated asset instances.

---

# 38. VFX SYSTEM

VFX must support reusable pooled effects plus unit-specific effects.

Required effect families include:

- target highlights;
- attack trails;
- projectile trails;
- impact bursts;
- slash arcs;
- healing;
- shield/defense feedback;
- poison/burn/status feedback;
- stun/sleep cues;
- low-HP feedback;
- damage flashes;
- death feedback;
- star/evolution effects;
- environment effects;
- loot/result feedback.

VFX must never alter canonical gameplay position or state accidentally.

---

# 39. VISUAL POLISH BEHAVIOR

Visual feedback must use one coherent timing and meaning language across the game. A hit, low-HP warning, selection, star evolution, environment change or board interaction should look related to the same product rather than like independent effects authored in isolation.

The visual layer must distinguish anticipation, impact and recovery clearly; repeated effects must remain bounded during long fights; and visual polish must never create extra logical hits, extra units, false status state or misleading targets.

---

# 40. RESULT OVERLAYS AND MODAL COORDINATION

Result and modal surfaces must use a coordinated overlay system.

Requirements:

- deterministic z-order;
- exactly one major modal owns input at a time;
- background interaction blocked correctly;
- modal close behavior consistent;
- keyboard/pointer dismissal rules consistent;
- result overlay cannot conflict with settings/library/shop/etc.;
- opening one modal can close or suspend mutually exclusive surfaces safely.

---

# 41. VERSION INFORMATION

Provide a version-info surface capable of showing:

- version;
- last-updated date;
- release/change notes;
- localized or clearly readable presentation;
- consistent modal close behavior.

---

# 42. DEBUG AND PERFORMANCE TOOLS

Keep developer-facing support for:

- debug logging;
- debug UI/entry points where enabled;
- live diagnostics;
- performance profiling;
- render/performance inspection;
- safe feature flags;
- failure reporting useful for browser smoke tests.

Developer tools must not visually pollute normal production play when disabled.

---

# 43. BROWSER SPEECH / ACCESSIBILITY HOOKS

Preserve browser-speech/accessibility integration points represented by the app.

They should be optional and capability-detected, with no hard failure on unsupported browsers.

---

# 44. SERVICE WORKER / BROWSER DELIVERY

Preserve browser-delivery behavior represented by the app, including service-worker registration/operation where enabled.

The application must still boot correctly when the service worker is unavailable or during local development.

---

# 45. GAME SPEED

Preserve canonical game-speed state/progression.

Animation speed, combat pacing, and game-rule speed must not become three unrelated concepts.

When progression/settings modify speed, the presentation layer must consume the canonical value rather than independently accelerating timers.

---

# 46. DATA-DRIVEN SKILL AUTHORING

Skill authoring must preserve the structured model needed for precise UI and combat.

For every authored skill, retain appropriate fields for:

- Vietnamese/English short description;
- Vietnamese/English full detail;
- target text;
- shape text;
- selection rule text;
- affected count text;
- duration rule text;
- star-specific detail;
- metrics/tokens;
- cast cost;
- primary effect;
- riders;
- executable skill behavior;
- star patches.

The short unit description is a gameplay pitch, not a substitute for full skill documentation.

Star milestone UI should derive from the actual star-specific skill detail, not from stale duplicate prose.

---

# 47. VARIANT TRAITS

Owned units must support deterministic variant traits/seeds where defined.

Variant data must survive save/load and must not cause two visual instances of the same owned unit to disagree across Planning, Combat, Library, or multiplayer serialization.

---

# 48. UNIT STAT FORMATTING AND RANGE TEXT

Use one canonical formatting model for:

- unit stats;
- range/target wording;
- localized descriptions;
- skill metrics;
- inline tooltip markup.

Do not let each card/modal invent its own numeric formatting rules.

---

# 49. PERFORMANCE BEHAVIOR

Performance scaling must preserve gameplay and visual meaning. Adaptive quality may reduce resolution, shadows, particles, decorative scenery density or other presentation cost, but it must never change canonical combat timing, RNG results, targeting, economy, board occupancy or network state.

The game should remain responsive on modest hardware and stable during long sessions. Reopening screens, repeating combats or previewing many units must not accumulate duplicate audio, animation loops, hidden overlays or transient effects. When the app is hidden or battery-saver mode is active, presentation may reduce to **30 FPS** while canonical state remains correct.

---
# 50. REQUIRED VISUAL REDESIGN DIRECTION

Do not preserve weak visual decisions merely because they already exist.

Rebuild visual hierarchy from first principles.

## 50.1 Main menu

Aim for:

- readable title hierarchy;
- compact primary actions;
- strong forest-fantasy backdrop;
- clear save/continue state;
- consistent icon actions;
- minimal clutter;
- no UI element that looks like raw debug HTML.

## 50.2 Planning

Planning should feel like one integrated command table:

- board is the visual focus;
- top information bar remains readable;
- shop/inventory/crafting are organized into stable dock regions;
- side actions share one consistent icon system;
- overlays do not fight for the same screen space;
- unit cards are visually consistent;
- joystick/control affordances do not cover tactical content;
- all major actions remain reachable on mobile.

## 50.3 Combat

Combat should emphasize:

- board readability;
- unit silhouette;
- clear attack anticipation;
- readable projectile/cast path;
- clear impact moment;
- concise floating feedback;
- visible statuses;
- restrained but satisfying VFX;
- camera stability;
- clean result transition.

## 50.4 Library

Library should feel like a creature collection book with:

- strong portrait focus;
- readable filters;
- elegant cards;
- rich detail panel;
- skill clarity;
- live 3D preview;
- star comparison;
- skin/evolution inspection.

## 50.5 Tech tree

Tech tree should feel like a magical forest research map:

- readable branch identity;
- obvious prerequisite paths;
- clear affordable/locked/maxed state;
- strong selected-node detail;
- predictable pan/zoom;
- default framing around relevant progress.

---

# 51. INTERACTION QUALITY BAR

Every interactive control must have meaningful states:

- normal;
- hover/focus;
- pressed;
- disabled;
- selected/active where applicable.

Feedback must look like authored game UI and use the same visual language as the rest of the product.

Drag interactions must show what is being dragged.

Invalid actions should explain themselves through concise feedback, tooltip, log, or disabled state instead of silently failing.

---

# 52. MODAL AND Z-ORDER QUALITY BAR

The following surfaces may exist, but they must be coordinated:

- settings;
- language;
- achievements;
- mod manager;
- social/donate;
- tribute;
- version info;
- unit library;
- unit info;
- tech tree;
- recipe library;
- synergy detail;
- augment choice;
- fortress service;
- history;
- result overlay;
- tutorial overlay.

Rules:

- one major modal owns input;
- tutorial can deliberately target controls when active;
- modal shade/close behavior is consistent;
- no click-through;
- no hidden active buttons;
- no accidental modal-on-modal stacking unless explicitly designed;
- opening the Library must not leave Shop controls drawing above it;
- close controls must remain accessible at all supported viewport sizes.

---

# 53. RESPONSIVE DESIGN

Support desktop and mobile without creating two unrelated applications.

Requirements:

- viewport-height correctness;
- no dark/empty bottom gap caused by fixed-height assumptions;
- safe-area awareness where needed;
- scalable typography;
- stable board aspect/readability;
- touch-sized hit areas;
- internal scrolling for content-heavy modal/card regions;
- avoid whole-page scroll for game HUD;
- portrait and landscape constraints handled deliberately;
- joystick/control placement remains reachable;
- modals never extend critical controls outside the viewport.

---

# 54. PLAYER-FLOW ACCEPTANCE GATE

Do not call the rebuild finished because individual screens render. Verify the complete player loops described in this document as connected behavior.

A complete acceptance pass must prove: boot → loading → menu → new/continue → Planning → purchase/deploy/craft/tech/augment → Combat → damage/death/loot/result → next round/save; Library inspection and 3D preview; settings/language/tooltips; desktop and mobile interaction; Creative placement; Fortress route/service flow; co-op lobby/ownership/sync; and every enabled modal without click-through or stale state.

For combat, verify at least one melee contact attack, one ranged projectile, one magic/support skill, status tick, healing and heal-block behavior, equipment effect, semantic impact timing, unit death removal and next-round transition. For persistence, reload after meaningful mutations and confirm the restored canonical state is the same state the player saw before leaving.

A visual pass is required for every playable unit and boss: connected silhouette, facing, idle, movement, attack, skill, hit reaction, death, portrait framing, star/skin identity and readable status anchors. A generic placeholder does not count as coverage.

---
# 55. REBUILD ORDER FOR OPUS 5.5

Build in playable vertical slices so each stage proves real game behavior instead of producing disconnected mockups.

1. **Foundation:** canonical run state, save/load, mode routing, settings, loading and menu.
2. **Collection:** full unit/content data, Library, cards, detail views, 3D previews, skins/star states and recipe browsing.
3. **Planning:** world/board, camera/input, shop, bench, drag/drop, merge, inventory/equipment, crafting, tech, synergies, augments, tutorial and history.
4. **Combat:** deterministic encounter materialization, queue/targeting, all damage/heal/status/equipment/role effects, movement/projectiles/VFX/audio, death, loot and result flow.
5. **Modes:** Creative, Fortress, co-op, PvP Fortress, achievements/collection progression, mods and platform/offline integrations.
6. **Unit-by-unit polish:** replace every placeholder with an individually authored creature and verify all action states and star/skin variants.
7. **Acceptance:** run every player-flow gate and reconcile any behavior discovered in the older game that is still missing from this specification.

Keep each vertical slice playable while rebuilding. At every milestone, each piece of gameplay state has one canonical owner and no required feature may exist only as an unconnected visual mock.

---
# 56. DEFINITION OF DONE

The rebuild is complete only when all of the following are true:

- [ ] The rebuilt 3D presentation follows canonical gameplay state and preserves the required voxel/low-poly forest-fantasy identity.
- [ ] Canonical gameplay/data ownership is preserved.
- [ ] Boot/loading/menu flow works.
- [ ] Continue/save flow works.
- [ ] Settings works across all required categories.
- [ ] Vietnamese and English work across player-facing surfaces.
- [ ] Every mode enabled by the active availability policy is playable; gated modes remain clearly unavailable and cannot be launched through stale state.
- [ ] Planning preserves every required system.
- [ ] Combat preserves every required system.
- [ ] AI works with supported modes/difficulties.
- [ ] Environment modifiers work.
- [ ] Full unit catalog remains available.
- [ ] Every playable unit and boss has a deliberate visual identity.
- [ ] Unit Library is fully functional.
- [ ] Recipe Library is fully functional.
- [ ] Tech tree is fully functional.
- [ ] Inventory/equipment/crafting are fully functional.
- [ ] Shop/bench/merge/upgrade are fully functional.
- [ ] Synergies and augments are fully functional.
- [ ] Tutorial multi-round guidance is functional.
- [ ] History/log surfaces work.
- [ ] Achievements/collection progression works.
- [ ] Fortress features work.
- [ ] Cooperative networking surfaces/contracts work.
- [ ] Developer-only source-documentation and roster-visual QA workflows remain usable without leaking into normal player UI.
- [ ] Dormant legacy compatibility data/helpers in A125 remain reproducible/queryable without being mistaken for default production UI or automatically granted cosmetics.
- [ ] PvP/fortress network contracts and product gating are respected.
- [ ] Discord integration fails gracefully outside Discord.
- [ ] Music/SFX and settings are synchronized.
- [ ] Keyboard/gamepad/pointer/touch interactions are coherent.
- [ ] Mod manager/registry remain viable.
- [ ] Asset loading/caching/pooling are stable.
- [ ] VFX are synchronized with canonical impact timing.
- [ ] Dead units are removed correctly.
- [ ] Floating combat feedback follows moved units.
- [ ] Tooltips use one shared system.
- [ ] Modal z-order/input capture is deterministic.
- [ ] Desktop layout is verified.
- [ ] Mobile layout is verified.
- [ ] Browser console/page errors/request failures are checked.
- [ ] Required behavioral verification for changed/core systems passes.

- [ ] No major surface looks like an unrelated prototype or raw debug panel.
- [ ] No player-facing feature in this document has been silently removed.

---

# APPENDIX A — AUTHORITATIVE OPERATIONAL CONTRACTS

This appendix is normative. Whenever an earlier product section is intentionally high-level, the concrete rules here define the behavior. Do not replace a numeric rule with a vague approximation, silently simplify a transaction, or move canonical state into presentation code.

## A1. Canonical run state and phase transitions

The run is driven by canonical serializable state. Rendering, audio, timers, input ownership and animation work are transient and are recreated after load rather than serialized. At minimum the run state preserves round, phase, active mode, player level/XP, gold, HP/lives, board units, bench units, item bag, crafted-recipe history, tech levels, bench upgrade level/bonuses, inventory bonuses, speed level, augment selections/effects, streaks, mode-specific state, tutorial state, environment state, and multiplayer/session state when applicable.

The major phase enum is `PLANNING`, `AUGMENT`, `COMBAT`, `GAME_OVER`. Phase is gameplay state, not merely a screen label. A transition is atomic: finish the current canonical mutation, commit/persist the resulting state, then let presentation react. Closing a modal, finishing an animation, reopening a result panel or receiving the same network result again must never create a second progression mutation.

### A1.1 PLANNING

`PLANNING` is the only normal phase in which formation, bench, shop, XP, equipment, crafting, technology and other Planning mutations may be initiated, subject to mode, tutorial, modal and ownership gates. Entering Planning after a combat result means the result has already been applied exactly once: streaks/rewards/HP/loot/round progression are canonical before the user can interact again.

At round intro, check whether an augment choice is owed. Normal augment-enabled runs offer choices only on rounds **3, 5 and 7** and only if that round is not already recorded as taken. Tutorial has its authored round-7 augment choice. If no choice is due or no legal unowned choices remain, stay in `PLANNING` and do not create a blocking augment state.

Starting combat is accepted only while phase is `PLANNING` and no blocking rule owns the action. Tutorial gates may reject it. Ordinary local play requires at least one deployed allied unit. In co-op, the host cannot launch until every required player slot has a legal deployment. PvP readiness is latched so repeated Start presses cannot create duplicate combat requests. Every rejected Start leaves phase, board, economy and round unchanged and gives the relevant user-facing reason.

### A1.2 AUGMENT

When a valid augment choice is due, phase becomes `AUGMENT` and the choice surface owns input. Normal formation/economy actions cannot bypass it. Offer up to **3 unique remaining augments**, excluding ids already selected. Tutorial round 7 prefers its authored three choices when they remain legal.

Selecting a legal augment is one transaction: validate that it is one of the active legal choices and is not already owned; apply its immediate reward and persistent modifiers once; record its id; record the current round in `augmentRoundsTaken`; refresh any affected capacity/layout/readouts; emit tutorial/history events; persist; clear the choice state; then return to `PLANNING`. Invalid/duplicate selection changes nothing. Reopening or rehydrating the same round must not award the augment again.

### A1.3 COMBAT

`COMBAT` owns the battle simulation. Planning mutations are locked while combat is active. Formation is materialized from canonical run state at battle start; temporary combat HP, shield, rage, statuses, target selection, queue position and presentation movement belong to that battle instance unless a mechanic explicitly says otherwise.

Each action resolves intent first, stages its movement/projectile/cast, commits semantic damage/heal/status at the authored impact point, completes aftermath, then advances the queue. Combat produces one normalized round result. Multiplayer may receive that result from an authoritative peer instead of simulating it locally, but applying the result is still idempotent.

### A1.4 Result routing and next round

A non-terminal result is applied exactly once. Draw resets both streaks, applies zero ordinary round damage, may still pay earned Assassin bounty/loot, then advances the round. Win increments win streak, clears loss streak, applies canonical gold/XP/loot and advances. Loss increments loss streak, clears win streak, still preserves already-earned bounty, then applies the mode's defeat rule: HP-based modes reduce HP and continue only while HP remains above zero; immediate-defeat modes end the run. Creative may suppress normal wallet/HP/passive-XP consequences while still creating an inspectable result.

Round increments exactly once after a non-terminal result. Ordinary local play returns to Planning, with round-intro/augment checks occurring after the result presentation. Endless Fortress clears the consumed pending route node and returns to the Fortress map for the next route choice. PvP/co-op result routing first resolves its authoritative room/match state before any local Planning continuation.

### A1.5 GAME_OVER

`GAME_OVER` is terminal for the active run. No shop, formation, crafting, tech or combat mutation is accepted after entering it. Final victory/defeat presentation may still read the frozen result state. After the outcome is committed, clear only that mode's active run save: ordinary solo run progress for solo play, the active co-op save slot for co-op when that mode ends the run, or the ended match/session state for PvP. Never clear achievements, collection, settings, mods or other save slots as a side effect of ordinary Game Over. Then clean up tutorial/input/network ownership as appropriate and route back to Main Menu. Repeated close/navigation callbacks must not repeat rewards, defeats, save deletion or network shutdown.

A saved owned unit has stable identity separate from its catalog id. Preserve at least uid, base/species identity, star, variant/trait seed where applicable, equipment ids, board/bench location, and persistent progression fields. Combat-only HP, temporary status timers, transient target, animation state and temporary movement offsets are reconstructed for combat and are not written back unless a specific mechanic explicitly persists them.

## A2. Board, player ownership and bench mutation semantics

The local allied logical board is 5×5. Base deploy cap is `clamp(level + 2, 3, 25)`, then supported deploy-cap bonuses are added through the canonical progression layer without ever allowing more occupied allied board cells than physically exist. Level 1 therefore starts with 3 deploy slots and the physical ceiling is 25.

Normal bench capacity is `clamp(8 + benchUpgradeLevel × 6 + benchBonus, 1, 44)`. Constants are:

- base bench = 8;
- each `benchUpgradeLevel` = +6;
- hard perimeter capacity = 44;
- Creative reserves one visible perimeter position for its dummy selector, so its ordinary unit capacity is one less than the resolved normal capacity.

Bench arrays are compact ordered collections, not sparse 44-element arrays. Empty visual perimeter positions are derived from current capacity and collection length. Mutation rules:

1. **Bench → empty board cell**: validate source index, owned row, destination bounds, duplicate restriction and deploy cap; remove the bench element with compact removal and place it on the board.
2. **Bench → occupied board cell**: when swapping is allowed, validate both resulting states, then move the board unit into the bench source position and the bench unit onto the board atomically.
3. **Board → empty bench target**: if current bench size is below capacity, remove from board and insert/reorder into the requested compact bench position. If bench is full, fail without mutating either container.
4. **Board → occupied bench target**: swap atomically when legal.
5. **Bench → occupied bench**: swap the two entries.
6. **Bench → empty visual bench location**: reorder/insert in compact order; do not create holes.
7. Any failed operation leaves board, bench, gold, deploy count and tutorial progress unchanged.

The outer 44-cell perimeter is spatial presentation for this compact list. A locked visual slot must communicate why it is unavailable, and unlocking capacity must reveal deterministic next perimeter positions.

## A3. Player XP, level progression and shop

Buying XP defaults to 4 gold for 4 XP. Effective purchase cost is `max(1, 4 + xpCostDelta)`. After adding XP, repeatedly level while current XP is at least the current threshold and carry overflow into the next level. The exact threshold table is:

| Current level | XP to next level |
|---:|---:|
| 1 | 2 |
| 2 | 4 |
| 3 | 6 |
| 4 | 10 |
| 5 | 16 |
| 6 | 24 |
| 7 | 36 |
| 8 | 52 |
| 9 | 68 |
| 10 | 88 |
| 11 | 112 |
| 12 | 140 |
| 13 | 172 |
| 14 | 208 |
| 15 | 248 |
| 16 | 292 |
| 17 | 340 |
| 18 | 392 |
| 19 | 448 |
| 20 | 508 |
| 21 | 572 |
| 22 | 640 |
| 23 | 712 |
| 24 | 788 |
| 25 | 868 |

Beyond the authored threshold table the next-level threshold is infinite unless future content extends it.

Shop defaults to 5 offers and supports progression up to 20 offer slots. A view may display only 2×4 cards at once; use deterministic paging/arrows for additional slots. Shop lock freezes current offers. A locked shop cannot refresh.

Refresh base cost by player level is:

- levels 1–10: 2 gold;
- levels 11–15: 3 gold;
- levels 16–20: 4 gold;
- level 21+: 5 gold.

Effective refresh cost is `max(1, baseRefreshCost + rollCostDelta)`. If gold is insufficient, fail without changing offers.

Purchase price equals catalog unit tier. Purchase requires a non-null offer, enough gold, and room on the bench according to canonical capacity. A purchased copy starts at 1★, occupies/appends to the compact bench, the paid slot becomes null, and canonical auto-merge is attempted immediately. If a merge produces equipment overflow, overflow returns to the item bag. A failed purchase changes nothing.

Shop tier generation uses five triangular/linear level profiles normalized together:

- T1: peak 1, left span 0, right span 12;
- T2: peak 8, left span 7, right span 10;
- T3: peak 15, left span 10, right span 10;
- T4: peak 20, left span 8, right span 10;
- T5: peak 25, left span 10, right span 0.

At a profile's peak its raw weight is 1. Before the peak, raw weight grows linearly from zero at `peak-leftSpan`; after the peak it falls linearly to zero at `peak+rightSpan`. Level 1 is forced to `[1,0,0,0,0]`. Normalize all five raw weights to sum 1, round each probability to four decimals, and correct rounding drift on the largest bucket. Clamp level lookup to 1..25.

Selling a unit returns `catalogTier × starSellMultiplier`, where star sell multipliers are 1★=`1`, 2★=`3`, 3★=`5`. This is a sell-value multiplier only and must never be reused as stat scaling.

## A4. Star merge transaction

Maximum star is 3. Canonical merge is 3-to-1: three matching units of the same species identity and same star combine into one unit at `star + 1`. Matching may span board and bench. Do not require all three copies to have identical instance uid. Species identity is the merge key; if multiple catalog variants of the species participate, the resulting base/catalog identity favors the highest catalog tier represented by the group.

Merge algorithm requirements:

1. Scan board and bench together for groups of three merge-compatible units at the same star below 3.
2. Select the three deterministically.
3. Preserve/merge supported variant traits and deterministic seeds.
4. Combine equipment from all three sources.
5. Respect the resulting unit's equipment slot limit.
6. Never retain duplicate equipment name/type keys when the equipment rules forbid duplicates.
7. Return any overflow equipment to inventory through the same transaction.
8. Remove all three source instances and insert the upgraded instance in a deterministic surviving location.
9. Recalculate stats and visuals from the new star.
10. Repeat until no further 3-to-1 chain merge is available.

Stat star scaling is 1★=`1.0`, 2★=`1.6`, 3★=`2.5`. Skill raw-damage star scaling is a separate scale: 1★=`1.0`, 2★=`1.2`, 3★=`1.4`. Individual status/effect families may have their own authored star rules; never substitute one star table for another.

## A5. Economy, interest, streaks and round income

Creative mode ignores passive round income. For normal modes, planning-round income is:

- `base = mode.goldScaling(round)` with fallback 5;
- `interestCap = 5 + interestCapBonus`;
- `interestRate = 0.10 + interestRateBonus`;
- `interest = min(interestCap, floor(max(0, gold) × max(0, interestRate)))`;
- win-streak bonus when `winStreak >= 2`: `min(3, floor(winStreak / 2))`;
- loss-streak bonus when `loseStreak >= 2`: `min(3, floor(loseStreak / 2))`;
- use the larger of win/loss streak bonus;
- `fixedIncome = max(0, fixedIncome)`;
- total gain = `base + interest + streakBonus + fixedIncome`.

Outcome mutation is equally explicit. On win: increment win streak, reset loss streak, apply result gold plus `winGoldBonus`, grant 2 passive XP unless Creative suppresses passive XP, then advance round. On loss: increment loss streak, reset win streak, still pay assassin bounty; for HP-based modes subtract canonical mode damage and end the run only when HP reaches zero. On draw: reset both streaks, pay assassin bounty, apply zero damage, then advance if the mode allows. Creative ignores defeat and normal gold mutation.

## A6. Inventory capacity, materials and equipment

Planning inventory's canonical base capacity is exactly `boardUnitCount + benchUnitCount`; supported inventory bonuses may expand that limit. The inventory view must show at least `max(resolvedCapacity, itemBag.length)` slots so pre-existing over-cap items never disappear visually.

Base materials include:

| id | Vietnamese label |
|---|---|
| `claw` | Răng Thú |
| `bark` | Gỗ Cứng |
| `crystal` | Pha Lê |
| `feather` | Lông Vũ |
| `tear` | Giọt Sương |
| `belt` | Da Thú |

Selling a base material yields 1 gold. Equipment sale value is T1=1, T2=4, T3 and above=12.

Equipping validates **all** conditions before mutation: target unit exists; item is equipment; item tier is not above unit star; same equipment name/type is not already equipped where uniqueness applies; slot limit is not exceeded; and the exact item exists in the bag. Only after every check passes may one bag item be removed and appended to the unit's equipment list. Failure produces localized feedback and changes nothing.

Equipment normalization deduplicates by canonical equipment name key and clamps to the unit slot cap.

Unequip-all is one transaction. If the unit has no equipment, fail. Per-item base unequip costs are defined by item data, with known tier defaults T1=2, T2=7, T3+=15. Canonical mutation cost for each item is `max(0, baseCost - unequipDiscount)` and the total is the sum across equipped items. Check affordability before mutation; then spend gold once, push all removed equipment to the bag, and clear the equipment array. Creative uses Creative affordability/spend semantics. Any UI preview of unequip cost must match this mutation formula exactly.

## A7. Crafting — non-destructive staging and atomic commit

The craft board is always represented as 9 canonical indices arranged 3×3. `craftTableLevel` is the only input that determines active indices:

- level 0: no active cells;
- level 1: `[4]` only, the center 1×1;
- level 2: `[0,1,3,4]`, a top-left 2×2 active square;
- level 3: all indices `0..8`.

Do not derive grid shape from a tech id inside crafting; tech purchase raises `craftTableLevel` upstream.

Recipes have authored 1×1, 2×2 or 3×3 footprints. Matching slides a recipe pattern across the currently active square where geometry allows. Every active/staged cell outside the candidate recipe footprint must be empty; extra staged ingredients make the candidate invalid.

Staging is strictly non-destructive. Dragging a material into or out of the craft grid does not splice, decrement or reorder the item bag. Cancel, modal close, invalid recipe, insufficient ingredients or any failed craft leaves the item bag byte-for-byte equivalent to its pre-stage value.

Successful commit is atomic:

1. validate `canCraft`;
2. resolve the exact recipe;
3. copy the bag;
4. consume each required ingredient from the copy;
5. append crafted output id `eq_<recipeId>`;
6. assign the copied bag back exactly once;
7. append recipe id to crafted-history when that collection exists;
8. clear staged craft cells;
9. emit success log/animation and canonical callbacks;
10. persist/notify state change.

The content surface includes six base materials and hundreds of recipes; current recipe data identifies 506 recipes. Recipe Library must browse these without executing crafting and must render exact ingredient pattern, output, tier/category, localized description and bonuses.

## A8. Technology tree — exact core progression

Research requires the node to exist, every prerequisite to have at least one purchased level (root counts as satisfied), current level below max, and enough gold. All prerequisites in a multi-parent requirement are mandatory. Cost arrays use the entry at current level; infinite nodes use `base + perLevel × currentLevel`. A failed research changes nothing.

Branches are ROOT `Đại Ngàn`, VET `Thú Y`, EXPLORE `Khám Phá`, ECON `Kinh Tế`, MIL `Quân Sự`, CRAFT `Thủ Công`. Root is not purchasable.

### Core VET chain

| Node | Requires | Costs | Max | Effect per purchase |
|---|---|---|---:|---|
| `vet` | root | 4 | 1 | +5% team HP |
| `breed` | vet | 8 | 1 | +1 deploy cap |
| `fitness` | breed | 4,6,8,10,12 | 5 | +3% team HP |
| `survive` | fitness | 10 + 3×level | ∞ | +15 starting shield |

### Core EXPLORE chain

| Node | Requires | Costs | Max | Effect per purchase |
|---|---|---|---:|---|
| `explore` | root | 4 | 1 | +2 bench |
| `bench_up` | explore | 10,14,18,22 | 4 | +1 benchUpgradeLevel = +6 bench |
| `barracks` | bench_up | 5,8,12,16,20 | 5 | +2 bench |
| `territory` | barracks | 8 + 2×level | ∞ | +1 bench |

### Core ECON chain

| Node | Requires | Costs | Max | Effect per purchase |
|---|---|---|---:|---|
| `econ` | root | 3 | 1 | +1 interest cap |
| `trade` | econ | 5 | 1 | XP purchase cost -1 |
| `invest` | trade | 4,6,8,10 | 4 | +1 interest cap |
| `tycoon` | invest | 8 + 3×level | ∞ | +1 fixed income |

### Core MIL chain

| Node | Requires | Costs | Max | Effect per purchase |
|---|---|---|---:|---|
| `mil` | root | 4 | 1 | +8% team ATK |
| `train` | mil | 7 | 1 | +1 starting rage |
| `beast` | train | 4,6,8,10,12 | 5 | +2% ATK and +1% crit |
| `warlord` | beast | 10 + 3×level | ∞ | +3% team ATK |

### Core CRAFT chain

| Node | Requires | Costs | Max | Effect |
|---|---|---|---:|---|
| `craft_t` | root | 5,10,15 | 3 | craft table 0→1×1→2×2→3×3 |
| `speed` | root | 3 each | 10 | +1 speed level |
| `metal` | craft_t | 4,7,10 | 3 | -1 unequip cost per level |
| `arcane` | metal | 6,10 | 2 | level 1 +8% MATK; level 2 additionally +8% MDEF |

### Four-stage expansion tracks

Each stage is a separate one-purchase node chained from the preceding stage. Preserve these exact costs and per-stage values:

- VET `herb_lore` costs 6/8/10/12, HP +1/+1.5/+2/+2.5%; `bark_guard` 7/9/11/13, starting shield +6/+10/+14/+18; `soothing_mist` 8/10/12/14, MDEF +1/+1.5/+2/+2.5%; `wild_fang` 8/10/12/14, lifesteal +2/+3/+4/+5%; `stone_hide` 8/10/12/14, DEF +1/+1.5/+2/+2.5%; `moon_ward` 8/10/12/14, MDEF +1/+1.5/+2/+2.5%.
- EXPLORE `trail_pack` 5/7/9/11, bench +1/+1/+2/+2; `field_cache` 6/8/10/12, bench +1/+1/+1/+2; `ranger_banner` 8/10/12/14, deploy cap +1 each stage; `scout_bounty` 7/9/11/13, win gold +1/+1/+1/+2; `map_rewrite` 8/10/12/14, reroll cost -1 each stage; `supply_line` 8/10/12/14, bench +1/+1/+1/+2.
- ECON `bank_roots` 6/8/10/12, interest cap +1 each; `coin_flow` 7/9/11/13, fixed income +1 each; `compound_seed` 8/10/12/14, interest rate +1/+1/+2/+2%; `guild_trade` 8/10/12/14, win gold +1/+1/+1/+2; `scholar_fund` 7/9/11/13, XP cost -1 each; `ledger_root` 8/10/12/14, fixed income +1 each.
- MIL `war_drum` 6/8/10/12, ATK +1/+1.5/+2/+2.5%; `iron_wall` 7/9/11/13, DEF +1/+1.5/+2/+2.5%; `eagle_eye` 7/9/11/13, crit +1/+1.5/+2/+2.5%; `blood_oath` 8/10/12/14, starting rage +1 each; `battle_tempo` 8/10/12/14, rage gain +5/+8/+10/+12%; `blood_banner` 8/10/12/14, rage gain +4/+6/+8/+10%.
- CRAFT `arc_weld` 6/8/10/12, MATK +1/+1.5/+2/+2.5%; `ward_forge` 7/9/11/13, MDEF +1/+1.5/+2/+2.5%; `steel_lattice` 7/9/11/13, DEF +1/+1.5/+2/+2.5%; `quick_hands` 6/8/10/12, unequip discount +1 each; `alchemy_pulse` 8/10/12/14, lifesteal +1/+1.5/+2/+2.5%; `runic_forge` 8/10/12/14, MATK +1/+1.5/+2/+2.5%.

### Dual-prerequisite capstones

- `alpha_doctrine`: requires `survive` + `beast`, cost 18, +5% HP and +3% lifesteal.
- `frontier_exchange`: requires `territory` + `tycoon`, cost 18, +1 fixed income.
- `war_tax`: requires `invest` + `train`, cost 16, +2 win gold and +1 interest cap.
- `siege_ritual`: requires `warlord` + `arcane`, cost 20, +5% ATK and +5% MATK.
- `beast_foundry`: requires `survive` + `metal`, cost 18, +20 starting shield and +5% DEF.

## A9. Synergy thresholds and counters

Synergy counting is based on deployed qualifying units plus supported virtual-count bonuses from augments/tech. The UI must show current count, active threshold and next threshold. Thresholds are 2/4/6.

### Class thresholds

| Class | 2 | 4 | 6 |
|---|---|---|---|
| TANKER | +8 DEF, +6 MDEF | +16 DEF, +12 MDEF | +28 DEF, +20 MDEF |
| ASSASSIN | +8% ATK | +18% ATK | +32% ATK |
| ARCHER | +10% ATK | +22% ATK | +36% ATK |
| MAGE | +10% MATK | +22% MATK | +36% MATK |
| SUPPORT | +12% healing | +25% healing | +40% healing |
| FIGHTER | +8% HP, +6% ATK | +16% HP, +14% ATK | +30% HP, +24% ATK |

### Element thresholds

| Element | 2 | 4 | 6 |
|---|---|---|---|
| STONE | +18 starting shield | +40 | +72 |
| WIND | +6% ATK/MATK | +14% | +24% |
| FIRE | burn-on-hit 6 | 12 | 20 |
| TIDE | +6 MDEF, +6% heal | +14 MDEF, +14% | +24 MDEF, +24% |
| NIGHT | +8% crit | +18% | +30% |
| SPIRIT | +1 starting rage | +1 rage, +12% heal | +2 rage, +24% heal |
| SWARM | poison-on-hit 8 | 14 | 22 |
| WOOD | +5% evade | +10% evade, +8% HP | +16% evade, +16% HP, +12% heal |

### Faction thresholds

| Faction | 2 | 4 | 6 |
|---|---|---|---|
| BEAST | +8% HP | +16% HP, +8 DEF | +26% HP, +16 DEF |
| AVIAN | +6% ATK, +4% evade | +14% ATK, +8% evade | +24% ATK, +14% evade |
| INSECT | poison 5, +4% lifesteal | poison 10, +8% lifesteal | poison 16, +14% lifesteal |
| REPTILE | +6 DEF, +4 MDEF | +14 DEF, +10 MDEF | +24 DEF, +16 MDEF |
| AQUATIC | +6% heal, +4 MDEF | +14% heal, +10 MDEF | +24% heal, +18 MDEF |
| MYTHICAL | +1 rage, +6% MATK | +1 rage, +14% MATK | +2 rage, +24% MATK |

Element counters are FIRE→SPIRIT, SPIRIT→TIDE, TIDE→FIRE, STONE→WIND, WIND→NIGHT, NIGHT→STONE, WOOD→TIDE, SWARM→none. Counter bonus constant is 0.50. Class counters are ASSASSIN→MAGE and ARCHER, ARCHER→MAGE, FIGHTER→ASSASSIN; other roles have no authored class-counter edge.

Do not confuse faction and element. Cards and detail surfaces must expose both relevant identity dimensions with clear icons.

## A10. Augments

Augment choice rounds are exactly 3, 5 and 7 in normal augment-enabled progression. A selection must be persisted once and the same augment id cannot be selected twice for the same player. Numeric effects accumulate by effect type. Selection applies any immediate effects exactly once, then persistent modifiers are read by canonical economy/formation/combat systems.

Generated families use five authored values each:

| Family | Effect type | Values 1→5 |
|---|---|---|
| gold cache | `gold_flat` | 4, 6, 8, 10, 12 |
| reroll bargain | `roll_cost_delta` | -1,-1,-1,-1,-2 |
| XP sprout | `xp_flat` | 6,8,10,12,14 |
| XP discount | `xp_cost_delta` | -1,-1,-1,-1,-2 |
| victory gold | `win_gold_bonus` | 1,1,2,2,3 |
| interest flow | `interest_rate_bonus` | .01,.01,.02,.02,.03 |
| team ATK/DEF/HP/MATK/MDEF | respective team stat | .05,.07,.09,.11,.13 |
| opening rage | `starting_rage` | 1,1,1,2,2 |
| starting shield | `starting_shield` | 18,24,30,36,42 |
| lifesteal | `lifesteal_pct` | .04,.05,.06,.08,.10 |
| interest cap | `interest_cap` | 1,1,1,2,2 |
| deploy cap | `deploy_cap_bonus` | 1,1,1,1,1 |
| bench | `bench_bonus` | 1,1,2,2,3 |
| inventory | `inventory_bonus` | 1,1,2,2,3 |
| class echo | `extra_class_count` | 1,1,1,1,1 |
| tribe echo | `extra_tribe_count` | 1,1,1,1,1 |

Base definitions also require support for flat gold, interest cap, reroll discount, deploy cap, bench capacity, starting rage, team ATK/HP/MATK/DEF/MDEF, starting shield, extra class/tribe counts, physical lifesteal, flat XP, win gold, interest-rate bonus, XP-cost delta, inventory bonus, HP-loss reduction, rage-gain percentage and a combined gold+XP immediate reward. Effects of the same numeric type add together. An augment id is applied at most once per player; attempting to apply the same id again must not repeat either its immediate reward or persistent modifier.

Immediate augment effects are part of the transaction. Flat gold adds gold immediately. Flat XP goes through the same XP/level-up path as normal XP when that path is available. A combined gold+XP augment grants both once and also records those two component bonuses consistently. Persistent modifiers such as team stats, reroll/XP cost deltas, starting rage/shield, lifesteal, HP-loss reduction, rage gain, capacity and virtual synergy counts modify their owning systems; they are not paid again every time the augment screen opens or a save is hydrated.

The augment choice card exposes an informational strength score from 0..100. This score never changes gameplay values; it only classifies/presents the offered augment. Group bonuses are ECONOMY `+2`, FORMATION `+5`, COMBAT `+4`, SYNERGY `+8`. Unknown effect types start from score 50 plus group bonus. Known effect scores use `clamp(round(baseScore + min(maxBonus, scaledValue × valueWeight) + groupBonus), 0, 100)` where `scaledValue = value/valueUnit`; discount effects use `abs(value)`. Strength bands are **Tactical** `<62`, **Strong** `62..81`, **Rare** `>=82`.

Use these exact score parameters so the number/ribbon does not drift during redesign:

| Effect | base | valueUnit | weight | max bonus | abs? |
|---|---:|---:|---:|---:|---|
| gold flat | 43 | 1 | 2.3 | 18 | no |
| interest cap | 66 | 1 | 12 | 18 | no |
| reroll-cost delta | 60 | 1 | 10 | 14 | yes |
| deploy-cap bonus | 74 | 1 | 11 | 14 | no |
| bench bonus | 56 | 1 | 6 | 12 | no |
| inventory bonus | 44 | 1 | 7 | 10 | no |
| starting rage | 63 | 1 | 10 | 14 | no |
| team ATK % | 52 | 0.01 | 1.2 | 16 | no |
| team HP % | 52 | 0.01 | 1.15 | 16 | no |
| team MATK % | 54 | 0.01 | 1.2 | 18 | no |
| team DEF % | 51 | 0.01 | 1.1 | 15 | no |
| team MDEF % | 51 | 0.01 | 1.1 | 15 | no |
| starting shield | 54 | 5 | 1.5 | 16 | no |
| extra class count | 79 | 1 | 7 | 10 | no |
| extra tribe count | 79 | 1 | 7 | 10 | no |
| lifesteal % | 58 | 0.01 | 1.15 | 14 | no |
| flat XP | 47 | 1 | 1.25 | 16 | no |
| victory-gold bonus | 56 | 1 | 7 | 16 | no |
| interest-rate bonus | 72 | 0.01 | 6 | 12 | no |
| XP-cost delta | 72 | 1 | 10 | 12 | yes |
| rage-gain % | 56 | 0.01 | 1.15 | 16 | no |

## A11. Combat queue, targeting and action choice

Combat queue has a hard cycle cap of 20. LEFT scan order is logical columns 4→0 and within each column rows 0→last. RIGHT scan order is columns 5→9 and rows 0→last. Empty cells participate in timing/order construction: build each side into chunks containing zero or more empty-cell timing entries followed by the next alive unit; trailing empties form a final chunk; then interleave LEFT chunk 0, RIGHT chunk 0, LEFT chunk 1, RIGHT chunk 1, and so on. This ordering must be deterministic and reproduce from the same state.

Default generic action choice:

1. if actor is dead/unavailable, skip safely;
2. process status-turn effects in the canonical point of the turn;
3. if rage is at least rageMax and actor is not silenced, choose skill;
4. otherwise, if disarmed, actor cannot perform a normal basic attack;
5. otherwise choose basic attack.

Do not use a generic `20 × rageGainRate` / 0–100 resource model for active combat. Rage gain is resolved by A74 on each unit's own rage scale: normally +1 base for the player side, the authored AI-difficulty value for the enemy side, then rage-gain modifiers. Never normalize every unit to `rageMax=100`.

Basic attack damage stat defaults: MAGE and SUPPORT scale from MATK/magic damage; other roles scale from ATK/physical damage. Presentation delivery is explicit if authored; otherwise range ≥2 implies projectile and close range implies melee/contact.

Targeting must be deterministic. Same-row preference and top-first row sweep use same row, one row above, one below, two above, two below. Melee prioritizes a valid close/front target according to canonical selectors. Ranged respects range. Assassin behavior may select/backstage a farther same-row target and its presentation can land behind the target where authored, but canonical target identity must be resolved before presentation movement.

## A12. Hit, evasion, crit and star rules

Base hit chance is 95%. Effective hit chance is `clamp(0.95 + attackerAccuracyMods - defenderEvasion, 0.10, 1.00)`. Effective evasion includes class base, unit/environment modifiers and active evade buff/debuff, clamped to 0..0.75.

| Role | Base evasion | Base crit |
|---|---:|---:|
| TANKER | 5% | 5% |
| FIGHTER | 8% | 5% |
| ASSASSIN | 15% | 25% |
| ARCHER | 10% | 20% |
| MAGE | 5% | 10% |
| SUPPORT | 7% | 5% |

Scaled base-stat evasion gets +5 percentage points at 2★ and +10 at 3★, capped at 60% at that stage before later combat modifiers. Star effect-chance multiplier is 1★=1, 2★=1.4, 3★=2.0. Star target bonus is 0/1/2. Star area bonus is `max(0, star-1)`. Generic star DoT scaling is 1★=1.0, 2★=1.3, 3★=1.6; generic status turns gain +1 turn only at 3★.

## A13. Damage pipeline

Skill raw damage is `round((skill.base + sourceStat × skill.scale) × starSkillMultiplier × goldMultiplier)`, with star skill multipliers 1/1.2/1.4. The canonical gold-reserve multiplier is `1.0` for invalid/negative gold and for valid gold `<=10`; above 10 gold it is `min(2.0, 1 + ((gold - 10) / 2) / 100)`. Therefore each 2 gold above 10 adds +1% multiplicatively to raw skill damage, and the bonus caps at 2.0× at 210 gold. Do not discretize this with `floor`, and do not move the threshold to 100 gold.

Resolve outgoing damage in this conceptual order unless the skill explicitly overrides a stage:

1. Resolve raw damage and clamp raw to at least 1.
2. Resolve elemental counter modifier. If attacker element counters defender and defender is TANKER, multiply by 0.5 and classify as tanker resistance. Otherwise, when the counter applies and attacker is not a TANKER, multiply by 1.5 for advantage.
3. Determine crit eligibility. Physical and magic damage can crit by default; true/effect damage do not unless explicitly allowed. Default crit multiplier is 1.5 plus supported crit-damage bonuses.
4. Default critical physical damage ignores DEF mitigation; default critical magic damage ignores MDEF mitigation.
5. Apply FIRE vulnerability using the stronger supported status/environment multiplier when both are present.
6. Physical non-ignored mitigation: subtract armor-break contribution from effective DEF, apply armor penetration, then `damage × 100 / (100 + effectiveDef × (1 - armorPen))`.
7. Magic non-ignored mitigation: `damage × 100 / (100 + effectiveMdef)`.
8. True damage skips DEF/MDEF.
9. Apply global damage multiplier including deterministic anti-stall escalation.
10. Final resolved damage is at least 1 after rounding when the action actually deals damage.

Shields absorb resolved incoming damage before HP. Death sets alive=false, shield=0, clears/finishes occupancy lifecycle, triggers death presentation, and the dead unit must disappear from target selection and rendering at the canonical removal point.

Aftermath may include defender rage gain, attacker rage gain, lifesteal, burn/poison application, on-kill rage/berserk hooks, assassin bounty and immediate role-specific casts. Lifesteal heals `round(damageToHP × lifestealPct)` under the owning rule and never exceeds max HP.

## A14. Effective stats and role passives

Base HP/ATK/DEF/MATK/MDEF scale from star 1/1.6/2.5 before later additive/multiplicative combat modifiers. Effective ATK is at least 1 and includes supported buffs/debuffs plus Fighter missing-HP scaling. Effective DEF/MDEF are at least 0. Effective MATK is at least 1 after buffs/debuffs.

Role behaviors to preserve:

- **TANKER**: if rage becomes full when attacked, immediately auto-cast its skill through canonical action flow.
- **MAGE**: after skill resolution, this role can refund +1 rage for each distinct enemy hit, capped at rageMax.
- **ASSASSIN**: each last hit contributes end-of-combat bounty by star: +1/+2/+3 gold.
- **FIGHTER**: every 1% missing HP contributes +1% ATK in the authored passive calculation.
- **ARCHER**: for each Manhattan tile of distance to its target, add +5% miss chance, +5% crit chance and +5% crit damage; final hit chance remains clamped to 10–100%.
- **SUPPORT**: if a basic attack fills rage, immediately auto-cast its skill.

## A15. Status, healing and control

Statuses are canonical timed gameplay state, not visual badges. A status application first validates that the target is legal for that effect and that the effect is not blocked by immunity or another explicit rule. Only then may it create/refresh duration and payload values. A rejected application changes neither status state nor combat resources.

Every timed status has a semantic identity, remaining duration and any numeric/source payload required by its mechanic. Reapplication must follow that status family's stacking rule rather than blindly replacing the old value. Control effects such as freeze, stun, sleep and silence never become shorter because the same control is reapplied with a smaller duration. Burn, poison, bleed and disease retain their own damage values and durations; stronger/longer preservation rules from A73 apply independently per family. Canonical offense debuff stores `offenseDebuffValue`, `offenseDebuffTurns`, `offenseDebuffMode`; `autoByRole` reduces MATK for MAGE/SUPPORT and ATK for other roles.

Start-of-turn status processing is deterministic. Resolve the authored periodic effects at the canonical turn point, then decrement/expire the status that owns them. DoT damage is true damage where defined, does not grant normal rage or recursive reflect, and can kill the actor before it acts. HoT heals only living legal units. Disease may spread only according to its adjacency/side rule. After ticking, freeze/stun/sleep can skip the actor's action; silence blocks skills while allowing a legal basic attack; disarm blocks the normal basic attack. If the actor dies during status processing, its turn ends immediately.

Expiry is a real state mutation. When a duration reaches zero, remove every payload that belongs exclusively to that status: damage values, stat modifiers, source ids, dodge rewards, reflect riders, link metadata, shield-survival riders, etc. A disappeared icon may never leave an invisible modifier active. Conversely, presentation may not hide a status while its canonical effect is still active.

Healing is resolved from a requested raw amount into one canonical applied amount. The recipient must be alive unless the effect is explicitly a revive branch. Apply healing bonuses, received-heal modifiers, heal reduction and heal block through the shared healing rules; clamp the final HP to max HP; emit heal text/VFX only after the applied amount is known. A blocked heal applies **0**. Revive is separate from healing: only an authored revive can return a fallen unit, and one-use revive state is consumed by its own rule.

Shield is numeric protection, not automatically a timed status. A legal shield grant respects shield-lock, adds the normalized shield amount and leaves HP unchanged. Incoming resolved damage consumes shield before HP. Merely having shield points does not fabricate a `Shield` status badge; only actual canonical status state appears in the status row.

Control/status source metadata may be retained for tooltip/history explanations, but it is explanatory data only. It cannot become a second status store or alter resolution order. Detailed stacking, reflect/counter/protect/guardian, compound-status and expiry rules are fixed in A73/A79/A120.

## A16. Combat presentation timing is correctness

Never subtract HP at animation start merely because the outcome is already known. Resolve canonical intent first, stage movement/projectile/cast, then commit/display the canonical damage at semantic impact time.

- Melee moves one tile/contact distance toward the target where appropriate.
- Assassin contact skills may stage behind the target.
- Basic delivery maps melee→contact, projectile→projectile, instant→beam unless an authored presentation overrides it.
- Assassin skill styles include `contact`, `anchored_extension`, `short_spray`; `scorpion_shadow` uses anchored extension and `cobra_venom` uses short spray.
- Floating damage/heal/status text follows the unit's **current** world position after movement.
- Dead units must be removed from both visual board and future target queries.
- Tactical targeting uses tile highlights; avoid red/blue unit circles or play-icon markers. Use slow pulse for indirect/area intent, red direct-target tile language, and a faster purple scan where that effect is called for.
- Units may visually stand on water or the brown ring while staging a legal presentation move.

## A17. Anti-stall and speed

Combat action cycle cap remains 20. Separately, anti-stall escalation tracks resolved actor actions: after action 100, every fifth resolved action increases global damage multiplier by +0.2. This state is deterministic and belongs to canonical combat.

Game speed is purchased progression, not a free combat toggle. `speedLevel` is 0..10. Display multiplier is `1 + 0.5 × speedLevel`, giving 1× at level 0 and 6× at level 10. Speed tech costs 3 gold per level. Base combat presentation multiplier is 3; duration multiplier is `3 / displayMultiplier`. Empty queue delay is `max(1ms, 50ms / displayMultiplier)`. All animation, VFX and scheduling paths derive from the same speed source so visual impact and canonical turn completion stay aligned.

## A18. Combat result, rewards and HP damage

Canonical result contains left/right survivor counts and total counts, loot details, combat damage, star reward component and assassin bounty. Base combat gold on victory is tied to opposing team unit count, plus star bonus `sum(max(0, enemyStar-1))`, plus assassin bounty, plus persistent `winGoldBonus`. Assassin bounty is still paid on non-win outcomes. Win passive XP is 2 unless Creative suppresses it.

Mode damage rules:

- one-per-loss: `survivors > 0 ? 1 : 0`;
- survivor-count: damage equals surviving enemy unit count;
- default/clamped rule: clamp survivor count to 1..4 when a loss occurs.

Loot acceptance must respect inventory capacity when normal board/bench containers are present. Excess generated drops are not silently inserted beyond capacity.

## A19. Game modes

| Mode | Start | Systems | Enemy scaling | Damage | Route / special |
|---|---|---|---|---|---|
| PvE Vô Tận: Sinh Tồn | 10 gold, 3 HP | shop/craft/augment on; PvP off | 1 through round 10, then +0.04 per round | one heart per lost round | standard planning/combat |
| PvE Vô Tận: Công Thành | 10 gold, 100 HP | default shop/craft/augment off; services come from route nodes | 1 through round 10, then +0.05 per round | surviving enemy count | fortress map; no rendered enemy strongholds; no special boss-round scheduler |
| PvP 4 Người: Công Thành | 10 gold, 100 HP each | shop/craft/augment/PvP on | fixed mode multiplier 1 | surviving enemy count | four-player lobby/session, random 1v1 pairings; odd player may face ghost |

All three authored modes use 10 base gold income per round through their current mode scaling. AI difficulty is MEDIUM by default. Main menu/new-game UI derives available mode descriptions and enabled systems from mode config instead of scattering hardcoded checks.

## A20. Fortress route system

Fortress uses a seven-layer directed map. Each node connects to every node in the next layer. Seeded generation shuffles non-final node types while preserving layer composition:

1. battle / shop / beast_den
2. battle / pharmacy / blacksmith
3. battle / battle / shop
4. elite / pharmacy / blacksmith
5. battle / beast_den / shop
6. elite / battle / blacksmith
7. boss

When an act graph is exhausted, increment act index and generate the next graph. Selecting a node increments step index, marks visited/current state, and stores pending node type/payload exactly once.

Enemy budget multipliers: battle/shop/pharmacy/beast_den=1.0, blacksmith=1.05, elite=1.25, boss=1.6.

Beast den offers 3 unique recruit choices drawn from units at tier ≤ `min(5, max(1, 1 + floor((round-1)/4) + floor((actIndex-1)/2)))`.

Pharmacy computes `base = 10 + floor((round-1)/2)×3 + (actIndex-1)×4` and offers:

- restore: heal `base + 16`;
- stimulant: heal `base + 8`, XP `max(2, 2 + floor((round-1)/4) + floor((act-1)/2))`;
- supplies: heal `base + 4`, gold `max(2, 2 + floor((round-1)/5) + floor((act-1)/2))`.

Blacksmith forge tier is `min(5, 1 + floor((round-1)/4) + floor((act-1)/2))` and supports craft/upgrade/temper services.

## A21. Multiplayer and synchronized combat

Co-op/PvP session state distinguishes host/guest role, room/session identity, legal player slots up to four, local/host slot, ready state per slot, canonical player states, selected mode/difficulty, active save/resume choice, PvP pairing state, disconnect state and authoritative combat synchronization state. A reconnect/reopen may reconstruct presentation from this session state; it must not synthesize a second run or silently change slot ownership.

Room/lobby mutations are host-authoritative where specified. Joining validates the signalling/session metadata before accepting a peer into a slot. Ready changes belong to the slot that sent them. Starting a multiplayer run requires the expected legal slots and readiness/deployment conditions for that mode; repeated ready/start messages are idempotent. A failed/malformed/wrong-session message is ignored or surfaced as an error without partially mutating room state.

Peer transport uses offer/answer establishment and a peer data channel. Application messages are typed/versioned and validated before mutation. Gameplay payloads contain canonical serializable state/events only. A disconnect identifies the affected slot, releases its transport ownership once and follows the mode's explicit recovery/retreat/termination rule; one physical failure must not emit several logical disconnects.

Each synchronized fight has one authoritative simulation owner. Non-authoritative peers stage visuals from authoritative snapshots/deltas/events rather than independently applying combat math. Every combat update carries enough round/revision/action/event identity to reject stale or duplicate data. Accepted revisions move forward monotonically; an older snapshot cannot roll state backward over newer accepted deltas. A later full snapshot can recover a client that missed one or more deltas.

Combat results are idempotent. The same result/report/resolution received twice cannot pay gold, XP, loot, HP damage, streak changes, round advance or elimination twice. Before applying a result, validate session/match/round identity and whether that result has already been committed. Persist the authoritative post-result state before allowing the next Planning/match flow to mutate it.

PvP Fortress pairs legal players into the authored 1v1 matchups, supports a ghost opponent when required, carries ready/round/result state, and applies fortress HP damage from surviving enemy count. Co-op combat keeps remote player/HUD state understandable and exposes the coordinated retreat/error path. Detailed signalling, revision, pairing and snapshot contracts are fixed in A47/A48/A118.

## A22. Planning UI spatial contract

Planning top battle controls are centered with Start in the middle. On constrained portrait layouts the top battle panel may be hidden/reflowed to avoid covering the board. The right side presents seven primary action icons in one vertical stack with localized shared tooltips. Camera/joystick control belongs on the left and must not collide with the top panel.

Store design target is 2 rows × 4 cards visible. Every card owns its `MUA` and `Xem chi tiết` actions; do not force a second generic summary modal before purchase. When shop capacity exceeds eight visible cards, arrows/pages expose the rest while preserving underlying slot indices.

Library and Planning use one unit-card visual system. The Library can show richer stats; Planning may hide HP/damage for clarity. Both must show tribe/faction and element explicitly, keep avatar large/high/centered, place compact stats consistently near corners, show rage requirement, avoid a duplicate coin badge in the top-right, and use icon semantics rather than unstable text where practical.

Only one major modal is active at a time. Opening a major modal closes or suspends conflicting major surfaces, establishes deterministic z-order and prevents click-through. Store/action controls/Start must not remain interactable underneath a blocking modal. Modal close affordance uses a minus `-` motif, never an X. One language button opens the language list modal. Settings tabs are `Âm thanh`, `Hiển thị`, `Lối chơi`, `Phím tắt`.

All production UI should look like one authored medieval game kit: coherent panels, buttons, cards, icons, frames, readable white button text and one unified font system.

Every layout edit must derive child coordinates from the direct parent panel and all ancestor transforms/docks. Source-of-truth panel geometry owns layout; avoid local offset patches that merely line up in one screenshot.

## A23. Tooltip, status billboard and hover behavior

Use one shared tooltip utility for action icons, units, equipment, statuses, synergy and tech where the content model permits it. Tooltips choose viewport-safe placement and never cover the pointer target unnecessarily.

World unit billboards show name, HP and rage/resource in Planning/Combat where relevant. Enemy hover exposes the same core identity/resource information. Positive status icons group consistently to one side and negative statuses to the other. The status header renders actual statuses only; numeric shield by itself does not synthesize a shield badge.

Semantic emoji-capable icons use one shared meaning map and the configured emoji service when available. Every screen uses the same fallback for the same semantic icon.

## A24. Unit visual identity and composition

Every unit has its own authored silhouette and body composition. Reusable **parts** such as paws, claws, hooves, eye pairs, horns, tail segments, wing cells, feathers, tentacle segments and voxel primitives may be shared, but a finished animal cannot be a generic species/family template with only parameters changed.

A unit that has not yet received a bespoke art pass still needs a species-appropriate authored silhouette. Never substitute a generic dog/head/body placeholder. Ensure head, neck and torso geometry physically read as connected; prevent see-through seams and floating parts; fix render order instead of hiding defects with camera angles. Front and rear limbs both participate in motion where anatomy calls for it.

Player-facing preview states are exactly the usable action set: `Rảnh rỗi / Idle`, `Đánh / Attack`, `Kỹ năng / Skill`, `Chịu đòn / Take Hit`, `Di chuyển / Move`. Preview animations should be readable around a five-second inspection cadence while live combat pacing derives from game speed. Library preview faces a useful front/slight-right angle, supports hold/drag rotation and zoom, and renders against transparent/background-controlled presentation.

### Bespoke character requirements

- **Chicken Rapper**: idle performs/sings with music-note VFX; basic attack throws a microphone as a boomerang and visibly catches/recovers it; skill uses a jump-and-sing performance beat; rapper vest remains readable; high-star/skin treatment can add a crown without replacing the chicken silhouette.
- **Sleepy Hen Girl**: idle lies in a bed under blanket; periodically surfaces a `Zzzz / ngủ thêm 5p nữa thôi` sleep bubble; basic attack wakes/sits and throws a pillow; skill is a yawn/sleep-themed action; star skins evolve the chibi treatment; use denser micro-voxel construction roughly four times the coarse placeholder density.
- **Spider**: unmistakable arachnid silhouette, correct facing, eight-leg motion readable in idle/move/attack, no detached canine-style head.
- **Hawk Hunter**: raptor body with wings/talons; hunt motion leads with head/shoulders and wing stabilization; ranged/dive identity must remain readable.
- **Monkey Spear**: primate proportions plus clearly held spear; attacks originate from the spear hand and body weight transfers into throws/thrusts.
- **Owl Nightshot**: broad owl head/eyes, compact raptor torso, wing-assisted ranged cast; nocturnal/night-shot VFX stays attached to the authored action.
- **Wasp Sting**: narrow insect waist, wings and stinger; rapid stinging motion; star-dependent multi-target presentation follows canonical target count rather than spraying arbitrary enemies.
- **Fox Flame**: connected fox head/torso, tail language and fire identity; cast flame originates from believable body/head/tail anchor.
- **Scorpion Shadow**: claws, segmented tail and stinger are unmistakable; skill uses anchored-extension presentation so the extension stays tied to the rig.
- **Weasel Quick**: elongated mustelid body, low agile gait and fast strike; animation must not collapse into a generic quadruped hop.
- **Jaguar Hunt**: muscular feline silhouette with spots; neck and head visibly join the torso in every action; hunt/attack reads as a low predatory launch and recovery, with no floating-head gap.

Star evolution may change scale/details/accessories/material accents and authored skin layers, but it must never make identity less readable.

## A25. World art direction

Use bright morning daylight as the baseline battlefield mood. Surrounding terrain includes raised hills/mountains, trees, props, grass, soil and water while leaving tactical cells easy to parse. Sun and rainbow are 2D pixel/cartoon art assets where used and remain spatially stable rather than behaving like full-screen decorative paint.

Grass/soil tile patterns are contiguous with no accidental gaps. Bench perimeter stays flush/contiguous with world block scale. Hidden faces are culled. Water, wood and terrain voxel blocks use consistent cube dimensions. Occupied battlefield tiles use a no-grass surface so tufts do not intersect deployed units.

## A26. Input, responsive and accessibility behavior

Desktop supports pointer plus keyboard navigation such as WASD/camera controls where configured. Touch uses large hit targets, drag thresholds, camera joystick and scroll containers that do not steal drags intended for units/items. Gamepad mappings, haptics and browser speech hooks remain optional capability surfaces but fail gracefully when APIs are unavailable.

Responsive layout derives child position from parent panel geometry. On mobile, the canvas/app occupies the full intended viewport with no unexplained dark lower gap. Internal card grids scroll inside their own content panels instead of moving the whole game layer. Safe areas, portrait reflow, modal size and tooltip placement are tested explicitly.

## A27. Persistence, continue and data safety

Continue restores the most recent valid active run and routes directly to the correct product flow. New Game initializes a fresh run without inheriting prior board, bench, shop, tutorial or session arrays. Save parsing validates version/schema and normalizes missing optional fields to safe defaults. Corrupt save data yields a recoverable user flow rather than crashing boot.

Persistent settings—audio, display, gameplay, shortcuts, language, device and data preferences—are independent from a particular run. Resetting run data does not silently erase unrelated preferences unless the UI explicitly says so.

## A28. Mod support

Reserve a public mod surface for unit/content/logic packs such as `.ftunit`, `.ftlogic` and `.ftmodpack`. The loader needs explicit manifest/version validation, deterministic registration order, error isolation, conflict reporting and a future path to workshop-style distribution. A bad mod must be rejectable without corrupting the base catalog/run state.

The management UI exposes enabled/disabled state, source, version, dependencies/conflicts and reload requirements. Content registration from mods goes through the same validation contracts as built-in content and cannot directly mutate active run internals during load.

## A29. Audio, VFX and haptics

Audio categories include music, ambient, UI and combat SFX with independent settings/mute behavior. Ambient forest sound belongs to world presentation. Unit attacks/skills may own bespoke SFX but trigger from semantic action/impact events so speed changes do not desynchronize sound from visuals.

VFX anchors are semantic rig/world anchors, never magic screen coordinates. Projectile, beam, impact, scan, status, death and loot effects clean themselves up deterministically. Reduced-effects/accessibility settings may lower particle density or shake without changing canonical timing/outcome. Haptics trigger only on supported user devices and never gate gameplay.

## A30. Debug, diagnostics and performance tools

Provide a debug-log surface reachable from the menu and structured diagnostics for current phase, mode, round, board profile, selected unit, queue/action state, network state and presentation health. Debug tools may inspect state but must not mutate normal progression unless an explicit cheat/debug action is invoked.

Performance instrumentation exposes frame/render timing, unit/mesh counts, expensive effect counts and cleanup/leak signals. Three-dimensional rendering reuses geometry/materials where appropriate, culls hidden voxel faces and cleans transient objects promptly. Low-memory operation matters: avoid multiplying invisible previews, browser contexts or duplicate asset copies.

## A31. Acceptance tests for the core systems

A rebuild is not accepted until all of these scenario-level checks pass:

1. **Board geometry**: solo reports 10 logical columns, 11 visual columns, 5 rows, 50 logical unit cells, one 5-cell river divider, 40-cell immediate brown ring and 44-cell separate bench perimeter.
2. **Ownership**: a P1 unit cannot be placed in another player's 5-row span in cooperative profiles.
3. **Bench cap**: base state gives 8; four `bench_up` levels add 24; bonuses can grow to but never above 44; Creative reserves one visual slot.
4. **Compact bench move**: moving bench index 2 to empty board removes it without leaving a null hole; reorder to an empty bench visual target changes compact order predictably.
5. **Deploy cap**: level 1 starts at 3; the physical ceiling is 25; no normal placement exceeds 25 allied cells.
6. **XP overflow**: buying 4 XP can cross multiple low-level thresholds when enough carried XP exists, and overflow is preserved.
7. **Shop lock**: lock freezes offers and refresh is rejected without gold mutation.
8. **Shop purchase**: insufficient gold or full bench makes purchase a no-op; successful purchase deducts tier cost, nulls offer, adds 1★ unit and immediately attempts chained merge.
9. **Chained merge**: a purchase completing three 1★ plus enough existing 2★ copies can chain to 3★ deterministically; equipment overflow returns to bag.
10. **Craft staging**: place/remove/cancel material and assert item bag is byte-identical.
11. **Craft commit**: valid recipe consumes exact ingredients once, appends exact output once, clears staging once and records recipe once; invalid recipe mutates nothing.
12. **Equip rejection**: too-high item tier, duplicate equipment, full slots or missing bag item each fail without mutation.
13. **Unequip transaction**: preview cost equals canonical mutation cost after discounts; affordability is checked before moving any item.
14. **Tech prerequisites**: multi-parent capstone stays locked until every parent has a purchased level; infinite-node price grows by its linear formula.
15. **Synergy**: exact 2/4/6 thresholds activate authored bonuses and next-threshold UI is correct.
16. **Augment**: rounds 3/5/7 offer/select once; duplicate id cannot stack through repeat selection; numeric effects accumulate from different ids.
17. **Tutorial**: scripted run completes every required action from rounds 1 through 8 including equipment, crafting and augment selection, then hands off to free planning.
18. **Queue**: known board state produces identical LEFT/RIGHT chunk order across repeated runs, including empty timing cells.
19. **Damage**: fixture validates physical DEF, magic MDEF, true damage, crit-ignore behavior, tanker counter resistance, elemental advantage and global multiplier.
20. **Role passives**: fixture covers Tanker immediate cast, Mage distinct-target refund, Assassin bounty, Fighter missing-HP ATK, Archer range modifiers and Support immediate cast.
21. **Impact timing**: HP change/floating number occurs at contact/projectile impact after actor movement, not at animation start.
22. **Death cleanup**: killed unit is no longer selectable/targetable and disappears from board rendering/occupancy.
23. **Economy**: base + interest + larger streak bonus + fixed income matches formula; Creative does not receive passive round income.
24. **Result**: one-per-loss and survivor-count rules produce different expected HP changes from the same survivor fixture.
25. **Speed**: level 0, 1 and 10 yield 1×, 1.5× and 6× display speed and consistent animation/empty-delay scaling.
26. **Fortress**: seven-layer graph composition, all-to-next-layer edges, service formulas and act regeneration match contract.
27. **Multiplayer idempotency**: duplicated authoritative result/delta does not apply damage/reward twice; missed delta can recover from snapshot.
28. **Modal coordination**: opening Store then Library/Settings leaves exactly one blocking modal and no click-through controls.
29. **Responsive**: desktop and portrait mobile show full intended viewport; store/card internal scrolling works; tooltip stays on-screen.
30. **Unit visuals**: every catalog unit has a species-appropriate silhouette; bespoke list satisfies its individual action requirements; Jaguar neck/head is connected.

## A32. Battlefield environments — exact cycle and modifiers

Environment is a canonical round rule, not decorative flavor. Resolve the active environment with:

`environment = ROUND_ENVIRONMENT_CYCLE[(max(1,floor(round)) - 1) mod 8]`

The exact cycle is:

1. FIRE
2. TIDE
3. WIND
4. STONE
5. NIGHT
6. SWARM
7. SPIRIT
8. WOOD

For each combat unit, determine its identity from `unit.element`, then compatible fallback identity fields if necessary. If the unit matches the active environment id, apply the environment's match buff; otherwise apply its non-match debuff. Build a fresh environment-mod object for every combat unit; never mutate the authored catalog definition.

Exact rules:

| Environment | Matching unit | Non-matching unit |
|---|---|---|
| FIRE | basic/on-hit burn +6 | receives FIRE vulnerability multiplier ×1.25 |
| TIDE | +6% healing, +6 MDEF | -10% evade |
| WIND | +6% ATK, +6% MATK | -10% accuracy |
| STONE | +18 starting shield | -6 DEF, -4 MDEF |
| NIGHT | +8% crit | -25% healing received |
| SWARM | poison-on-hit +8 | suffers 4 poison-aura true damage per status tick/turn |
| SPIRIT | +1 starting rage | -20% rage gain |
| WOOD | +5% lifesteal, +5% evade | -5% lifesteal, -10% healing caused |

Flat DEF/MDEF environment changes are applied to the combat copy. ATK/MATK percentage modifiers multiply the combat copy and round to an integer with a minimum of 1. Starting shield/rage feed the normal `mods` pipeline. Ongoing effects such as poison aura, healing received, accuracy, evade, crit, rage gain, lifesteal and burn/poison-on-hit stay in `environmentMods` so the owning combat calculation reads them at the correct event.

The environment HUD must show localized name, icon/short label and a concise explanation of both matching and non-matching effects. A round change updates the preview before combat so the player can plan around it.

## A33. AI mode registry, encounter budget and formation generation

Valid AI modes are exactly:

`TUTORIAL, EASY, MEDIUM, HARD, CREATIVE, COOP_EASY, COOP_MEDIUM, COOP_HARD, COOP4_EASY, COOP4_MEDIUM, COOP4_HARD`.

Unknown values normalize to the owning flow's documented fallback, normally TUTORIAL for settings and MEDIUM for combat generation. Two-player co-op modes map to a 10-row board, four-player co-op modes to a 20-row board. In-run difficulty changes are locked: choose difficulty during setup and persist it for the run.

### AI difficulty parameters

| Mode | HP | ATK | MATK | random-target | budget | max star | guaranteed 2★ | guaranteed 3★ | equipment starts | max equip tier |
|---|---:|---:|---:|---:|---:|---:|---|---|---:|---:|
| TUTORIAL | .65 | .60 | .60 | .75 | .70 | 1 | never | never | 99 | 0 |
| EASY | .84 | .82 | .82 | .58 | .90 | 1 | never | never | 8 | 1 |
| MEDIUM | .95 | .93 | .93 | .30 | 1.00 | 2 | round 5 | never | 6 | 2 |
| HARD | 1.05 | 1.04 | 1.04 | .12 | 1.05 | 3 | round 4 | round 14 | 5 | 3 |
| CREATIVE | .75 | .72 | .72 | .80 | .80 | 1 | never | never | 99 | 0 |
| COOP_EASY / COOP4_EASY | .98 | .96 | .96 | .42 | 1.02 | 2 | round 6 | never | 7 | 2 |
| COOP_MEDIUM / COOP4_MEDIUM | 1.08 | 1.06 | 1.06 | .22 | 1.08 | 2 | round 5 | never | 6 | 2 |
| COOP_HARD / COOP4_HARD | 1.18 | 1.15 | 1.15 | .10 | 1.15 | 3 | round 4 | round 12 | 5 | 3 |

Only co-op hard families use rage-gain multiplier 1.05; normal easy/medium/hard use 1.0, Creative uses .9 and Tutorial .8.

Encounter generation receives round, game mode, AI mode, board profile, sandbox flag, optional node/budget multiplier, and injectable RNG. If the game mode uses scheduled boss rounds and the round is a boss round, return that boss encounter instead of procedural generation.

For a normal encounter, canonical displayed encounter budget is:

`round((8 + round × (sandbox ? 2.1 : 2.6)) × ai.budgetMult × externalBudgetMultiplier)`.

Team generation itself derives the working budget from the same 8 + round growth model, AI budget multiplier, and board-row scale. Unit pool max tier is:

`clamp(1 + floor(round/3) + maxTierBonus, 1, 5)`.

Estimated AI level for team-size purposes is:

`clamp(1 + floor(round/2) + levelBonus, 1, 15)`.

Base team size starts from the normal deploy cap for that estimated level, then adds difficulty flat bonus and periodic growth, subtracts one in sandbox, applies the early-HARD cap, scales by co-op player count, and finally clamps to available enemy board area. Solo never exceeds 15 generated units even though the physical half-board has 25 cells.

Role composition is deliberate:

- EASY family targets at least ~55% frontline and heavily weights TANKER/FIGHTER.
- MEDIUM family targets ~42% frontline and introduces more ARCHER/SUPPORT/MAGE/ASSASSIN.
- HARD family targets ~34% mandatory frontline with the strongest non-front bias and the highest assassin/mage/support shares.
- TANKER/FIGHTER are placed in enemy frontline slots first.
- SUPPORT/MAGE/ARCHER prefer backline slots.
- ASSASSIN prefers dedicated far/backline assassin slots.
- Placement consumes unique cells deterministically from role-specific priority lists.

Random star rolls use:

- 2★ chance = `clamp((round-6)×0.045 + star2Bonus, 0, 0.38)`;
- 3★ chance = `clamp((round-11)×0.018 + star3Bonus, 0, 0.08)` when maxStar permits.

After random rolls, guaranteed-star rules upgrade enough generated picks to satisfy the difficulty's minimum round guarantees. Guaranteed 2★ count grows every four rounds up to half the team. Guaranteed 3★ count grows every six rounds up to one quarter of the team and upgrades higher-tier picks first.

AI equipment eligibility begins at the difficulty's `equipStartRound`. Eligible items cannot exceed `equipMaxTier` or the unit's equipment slot cap. Equipment chance grows by the configured base + per-round growth and respects the difficulty cap; duplicate equipment ids are not inserted on the same generated unit.

All procedural randomness must accept an injected RNG for deterministic tests/network reproduction.

## A34. Endless boss schedule

Scheduled bosses belong to modes that explicitly enable boss rounds. A boss round is every positive multiple of 10. Rotate through five bosses by `floor(round/10)-1` modulo five:

| First round | Boss id | Display name |
|---:|---|---|
| 10 | `boss_ember_dragon` | Cự Long Hỏa Ngục |
| 20 | `boss_storm_phoenix` | Lôi Phượng Cuồng Phong |
| 30 | `boss_venom_hydra` | Hydra Độc Vực |
| 40 | `boss_earth_colossus` | Địa Thần Cự Tượng |
| 50 | `boss_tempest_jelly` | Sứa Bão Giông |

Round 60 returns to the first boss and continues cyclically. Scheduled boss encounter contains one 3★ boss at enemy row 2 and enemy logical column 7 (two columns behind the enemy frontline start), with no generated equipment unless the boss definition explicitly changes that rule.

Boss rigs/animations are individually authored. Do not implement bosses as a scale multiplier on a normal unit. Their combat identity, skill cues, hit reaction, death and VFX must remain distinguishable at tactical zoom.

## A35. Settings — exact persistent model

UI settings are a separate persisted object from run state. The normalized settings surface contains:

- `audioEnabled` — default true;
- `audioMuted` — default false;
- `volumeLevel` — integer 1..10, default 5;
- `aiMode` — default TUTORIAL;
- `aiModeByGameMode` — validated per-mode selection;
- `loseCondition` — normalized game-rule value;
- `resolutionKey` — default `1600x900`;
- `guiScale` — compatibility value fixed to 2; actual UI zoom is fixed to 1;
- `language` — `vi` or `en`, default `vi`;
- `tooltipMode` — one of `off, compact, summary, expanded`, default `summary`;
- `expandedTooltip` — derived compatibility boolean for expanded mode;
- `subtitleEnabled` — default true;
- normalized keyboard bindings.

Resolution choices include:

`1280×720, 1600×900, adaptive/current viewport, 1920×1080, 2436×1125, 2532×1170, 2560×1080, 2560×1440, 3200×1800, 3440×1440, 3840×2160, 2796×1290`.

Three-dimensional presentation also has a separate graphics-quality/render-performance surface:

- quality presets: `low | medium | high`;
- GPU render-scale presets: **0.50, 0.67, 0.75, 1.00**;
- arbitrary restored render scale is clamped to 0.50..1.00;
- battery saver is a persistent boolean;
- quality, render scale and battery saver apply immediately to presentation and persist independently;
- the UI may show the effective pixel ratio/DPR as diagnostics, but DPR display is not itself a gameplay setting.

Adaptive resolution reads the current visual viewport/inner viewport/screen dimensions and falls back safely. Unknown resolution values normalize to 1600×900.

Saving settings performs normalization first, applies locale, writes one persistent payload, then notifies listeners. Debounced settings changes notify listeners immediately for responsive preview and write after 200 ms. Load failure/corrupt JSON returns defaults rather than blocking boot.

Per-mode AI defaults are TUTORIAL for both solo Endless modes and COOP4_MEDIUM for four-player Fortress PvP; a chosen AI mode must also be allowed by that game mode.

## A36. Achievements, collection profile and skin rewards

Endless achievements are account/profile progression separate from a single run. Track them only for solo `EndlessPvEClassic`; Creative and co-op runs do not contribute.

There are exactly **100 achievements**: 10 categories × 10 thresholds.

| Category | Exact thresholds |
|---|---|
| best round | 2,3,5,8,12,16,20,25,30,40 |
| rounds won | 1,3,5,10,20,30,50,75,100,150 |
| runs started | 1,2,3,5,8,12,16,20,30,50 |
| shop refreshes | 1,5,10,20,30,50,75,100,150,250 |
| XP purchases | 1,3,5,10,20,30,40,50,75,100 |
| units bought | 1,5,10,20,30,50,75,100,150,200 |
| merges | 1,3,5,10,20,30,50,75,100,150 |
| augments chosen | 1,3,5,10,15,20,25,30,40,50 |
| crafted items | 1,3,5,10,15,20,30,40,50,75 |
| highest level | 2,3,4,5,6,7,8,10,12,15 |

The profile also records rounds lost, items looted, highest gold and best win streak even though these are not currently among the 100 threshold categories. Snapshot updates take maxima for best round/highest level/highest gold/best streak and additive event counters for actions.

Achievement profile storage is versioned and corruption-tolerant. Progress ratio is `min(1, current/threshold)`. The UI exposes unlocked/total count, claimable count, category labels, per-achievement current/threshold progress and localized title/description.

The Main Menu achievement panel also preserves its prioritization and summary behavior. Its four headline summaries are **unlocked/total**, **best round**, **rounds won**, and **highest level**. Achievement rows that currently unlock an unclaimed skin reward sort first; still-locked/in-progress rows sort next by higher progress ratio; already-settled rows follow, with original authored order as the stable tie-break. A reward row resolves the skin's localized 1★ preview/name when available, visibly distinguishes locked/unlocked/claimed state, and exposes Claim only when the achievement is unlocked and the corresponding reward has not already been claimed. Scrolling/reopening this panel never mutates achievement counters or reclaims a reward.

Collection profile separately stores:

- unique unlocked skin ids;
- unique claimed achievement ids;
- one equipped skin id per unit id.

Claiming a skin reward is idempotent: add achievement id only if absent and skin id only if absent. Equipping a skin writes the per-unit mapping; clearing selection removes that mapping.

Achievement-to-skin mapping is one-to-one. Validation must fail for missing reward mappings, duplicate skin rewards, invalid skin/unit ids or skins pointing to an unknown unit. A skin definition must declare supported unlock type and provide an appearance resolver for star 1..3.

Player/Library appearance may use the equipped skin. Enemy/right-side units do not inherit the player's equipped collection skin.

The current development build may expose a centralized unlock-all-skins debug switch for skin QA. Treat it as a single debug gate; production progression still needs the real achievement/free/locked checks and must be restorable by disabling that one switch.

## A37. Save/load normalization invariants

Normalization must preserve every legal progression value. The serializer and hydrator are not allowed to clamp a value below a range that the actual progression systems can produce.

In particular, `bench_up` supports four purchases, so persisted `benchUpgradeLevel` must preserve the full legal range **0..4**. A parser that truncates this value to 1 is inconsistent with the tech contract and must be corrected in the rebuild rather than copied.

Other required ranges include player level 1..25, craft table level 0..3, speed level 0..10, star 1..3, and shop slot count at least the saved offer-array length while respecting the product maximum. Unknown/missing optional fields use normalized defaults; invalid nested units/offers are rejected individually without making an otherwise recoverable save unloadable.

Tutorial normalization preserves `completed`, `currentRound`, `shopVariant`, positive prepared-round ids, round event counts and marker data. Fortress metadata and co-op shared state are normalized through their own mode contracts.

## A38. Planning/combat history and short log retention

Planning maintains two distinct feedback depths:

- a short on-screen recent-log preview capped at **6** messages;
- a longer Planning history capped at **300** entries.

Planning history entries carry at least message, category and timestamp. Supported user-facing filters are:

`ALL, COMBAT, SHOP, CRAFT, EVENT`.

Opening History is a coordinated major modal: it cannot coexist interactively with Settings, Library, Achievements, Craft, Tech or another blocking Planning overlay. Closing it releases modal ownership and tutorial steps may observe explicit open/close actions.

Combat maintains its own rolling combat-log history capped at **240** strings/events for the current combat presentation. Its History overlay reads that live history, shows an empty state when appropriate, and closes competing combat overlays.

Log retention is presentation/history state; replaying or reopening a history panel must never reapply the underlying shop/combat/craft/economy mutation.

## A39. Cortisol presentation interaction

`CORTISOL_DANCE_DURATION_MS = 2 × 60 × 1000`.

Activation stores each affected allied avatar's base Y position and base yaw, then applies a deterministic-looking rhythmic bob/rotation presentation while the wall-clock timer remains active. End/teardown restores those recorded base transforms and deletes temporary metadata. Scene teardown must also stop the effect cleanly.

This feature is explicitly **presentation-only**. Do not serialize the temporary avatar offsets as unit state and do not invent a cortisol meter, buff, debuff, morale system or combat consequence around the label.

## A40. Loot generation — exact material and equipment rules

Loot is generated from defeated enemy identity through a pure canonical function with injectable RNG. Presentation only animates the already-resolved drops.

Every enemy source context records at least source unit name/base id/species/tribe/class, source tier clamped 1..5, and source star at least 1.

### Base-material candidate mapping

Candidate materials are deduplicated and must exist as base items.

- avian/bird-like species such as eagle/crow/owl/parrot/peacock/swan/phoenix/wasp/butterfly/dragonfly may yield `feather`;
- reptile/shell/armored species such as turtle/pangolin/rhino/crocodile/snake/dinosaur/chameleon/scorpion/toad/snail may yield `bark`;
- mammal/large-beast species such as bear/buffalo/elephant/tiger/wolf/deer/boar/lion/hippo/primate/sheep/goat/horse/rabbit/dog/weasel/jaguar/lynx/fox may yield `belt`;
- insect/arthropod species such as wasp/ant/beetle/scorpion/mantis/spider/mosquito/worm/dragonfly/butterfly/cockroach/termite/centipede may yield `claw`;
- aquatic species such as fish/dolphin/octopus/starfish/seal/squid/snail may yield `tear`; TIDE identity is the fallback water rule;
- mystical species such as phoenix/qilin/dragon/butterfly/dragonfly may yield `crystal`; SPIRIT/NIGHT identity or MAGE class may also provide crystal fallback.

If no species/identity rule produces a candidate, fallback material by identity is:

`STONE→bark, WIND→feather, FIRE→claw, TIDE→tear, NIGHT→claw, SPIRIT→crystal, SWARM→claw`, otherwise `claw`.

The first valid material candidate always drops. Additional material candidates are rolled independently by **enemy tier**:

| Enemy tier | chance for candidate #2 | chance for candidate #3 |
|---:|---:|---:|
| 1 | 18% | 4% |
| 2 | 28% | 8% |
| 3 | 40% | 14% |
| 4 | 52% | 20% |
| 5 | 66% | 28% |

If the enemy has fewer candidate materials than the rolled slot, nothing extra is fabricated.

### Equipment drop

Each defeated enemy also performs one independent equipment-drop roll:

- chance = **5%**;
- equipment tier = `clamp(enemyStar, 1, 3)`;
- choose uniformly from equipment ids authored at that exact tier;
- if the tier pool is empty, no equipment drops;
- equipment source metadata records that it came from enemy star rather than species.

The total drop list for a unit is `base material drops + optional equipment drop`.

Result/application code accepts drops only up to actual inventory capacity. A generated but unaccepted overflow item is not secretly inserted. Reward application must be idempotent: reopening result UI, replaying animation callbacks, reconnecting a peer or re-rendering a tray must never roll or grant the same combat loot a second time.

Loot feedback should show source unit plus useful source rule: species/tribe/class/fallback for material, or enemy star → equipment tier for equipment.

## A41. Unit data and skill-authoring contract

The unit catalog is data-driven and must resolve every active normal unit plus every boss. A rebuild may reorganize files, but the catalog output contract stays stable enough for Planning, Combat, Library, Shop, AI generation, skins, synergies and tooltips to consume the same unit definition.

Every normal unit definition requires stable:

- id and species identity;
- localized display name;
- role/class;
- faction/tribe and element as distinct identity dimensions where authored;
- tier/cost;
- base HP/ATK/DEF/MATK/MDEF, range and rage max;
- basic attack definition/delivery;
- skill definition;
- 1★/2★/3★ skill resolution;
- gameplay pitch;
- full skill detail;
- target/shape/selection/count/duration clarity;
- visual identity/rig binding;
- skins/star appearance;
- SFX/VFX profile where authored;
- variant trait/seed support;
- tooltip metrics.

Star resolution may change the effective skill identity as well as numbers. For ASSASSIN units at 2★ or 3★, first look for an authored upgraded skill with the base skill id plus `_v2`; use it when it exists. If that upgraded definition is absent, fall back to the base skill. Other classes keep their base skill id unless their own explicit skill data says otherwise. This lookup happens before presenting Library/tooltip/combat skill details so the player never reads the 1★ skill while combat executes the upgraded one.

The short unit `descriptionVi/En` is a playstyle pitch. It is not a substitute for skill mechanics.

For every authored skill and every star version, the canonical detail surface must expose:

- `detailTextVi/En` — complete skill behavior for that exact star;
- `targetTextVi/En`;
- `shapeTextVi/En`;
- `selectionRuleTextVi/En`;
- `affectedCountTextVi/En`;
- `durationRuleTextVi/En` when duration is meaningful.

`detailText` is the canonical content for the Skill block and the three star-milestone descriptions. Compatibility summary/upgrade/star-description fields may be derived for older UI surfaces, but the rebuild must not author critical mechanics only into those summaries.

Fallback text derivation is a last-resort compatibility path. Content validation must fail when a live unit relies on fallback to make a required target/shape/selection/count/duration field understandable. The player should never have to infer whether a skill targets one enemy, a row, an area, self, lowest-HP ally, highest-ATK enemy, etc.

Offense-reduction riders use the canonical fields `offenseDebuffValue`, `offenseDebuffTurns`, `offenseDebuffMode`; `autoByRole` means reduce MATK for MAGE/SUPPORT and ATK for other roles.

Star presentation and star mechanics are separate concerns. A skin may provide its own star appearance, but it must not silently alter stats/skill numbers unless the gameplay definition explicitly does so.

## A42. Mandatory roster coverage

The active normal-unit content set currently contains **120 unit ids**. Treat this list as a rebuild coverage gate: every id must resolve through catalog → Planning card → Shop/AI eligibility where applicable → Library detail → combat-unit construction → rig/animation presentation.

`albatross_wind, angel_guardian, ant_guard, armadillo_roll, badger_stone, bat_blood, bear_ancient, beetle_drill, beetle_mystic, bison_stampede, buffalo_mist, bug_plague, butterfly_mirror, cat_goldbow, chameleon_stealth, chimera_flame, cobra_venom, condor_sky, crab_shell, crane_blessing, crocodile_bite, crow_storm, deer_song, dove_peace, dragon_breath, dragon_earth, dryad_tree, eagle_marksman, elephant_guard, fairy_forest, falcon_dive, ferret_shadow, firefly_heal, firefly_light, flamingo_shot, fox_flame, garuda_divine, golem_stone, gorilla_smash, hawk_hunter, heron_pierce, hippo_maul, horse_charge, hydra_swamp, hyena_pack, ice_mage, jaguar_hunt, jellyfish_shock, kangaroo_kick, kirin_thunder, komodo_bite, kraken_deep, kraken_void, lich_undead, lion_general, lizard_elder, lynx_echo, mammoth_ancient, mantis_blade, mink_silent, monkey_spear, mosquito_toxic, moth_dust, newt_fire, nymph_water, octopus_mind, oracle_wisdom, otter_river, owl_nightshot, ox_mountain, pangolin_plate, panther_void, peacock_dazzle, pelican_bomb, phoenix_arrow, phoenix_rebirth, qilin_breeze, ram_charge, raven_death, reaper_void, rhino_quake, roc_legend, salamander_flame, scorpion_king, scorpion_shadow, seraphim_light, shark_frenzy, snail_fortress, spider_venom, spore_mage, sprite_wind, squid_ink, stork_sniper, storm_mage, swan_grace, thunderbird_storm, tiger_fang, titan_earth, toad_poison, toucan_snipe, trex_bite, triceratops_charge, turtle_mire, unicorn_light, viper_strike, vulture_scavunge, walrus_ice, wasp_arcane, wasp_assassin, wasp_sting, weasel_quick, whale_song, wisp_light, wolf_alpha, wolverine_rage, woodpecker_drill, worm_ice, worm_queen, wraith_shadow, yak_highland`.

The five scheduled boss ids are:

`boss_ember_dragon, boss_storm_phoenix, boss_venom_hydra, boss_earth_colossus, boss_tempest_jelly`.

Coverage validation must fail if any mandatory id:

1. is absent from the catalog;
2. cannot build a combat unit;
3. has no playable/basic skill data;
4. lacks required localized clarity fields;
5. cannot construct a species-appropriate visual rig;
6. crashes Library preview or action preview;
7. cannot resolve star 1/2/3 stats/skill state;
8. references an invalid skin/equipment/skill id.

The rebuild may intentionally gate a unit from Shop or AI pools for balance, but that is different from the unit being absent or broken.

## A43. Variant traits, deterministic seeds and merge ancestry

Every newly owned unit may carry class-specific variant traits. Trait ids are stable persisted identifiers; names are presentation. The maximum persisted trait count is **9**.

There are five normalized traits per combat class, all weight 1 unless content explicitly overrides weight:

| Class | Trait ids and bonuses |
|---|---|
| TANKER | `tanker_thick_armor` +6 DEF/+4% HP; `tanker_rebound` +18 starting shield; `tanker_bulwark` +6 MDEF/+3% HP; `tanker_iron_will` +4 DEF/+4 MDEF; `tanker_guard_core` +12 shield/+2% HP |
| ASSASSIN | `assassin_killing_intent` +9% ATK; `assassin_death_mark` +10% crit; `assassin_shadow_dash` +1 starting rage; `assassin_venom_edge` +5% ATK/+4% crit; `assassin_phantom_step` +5% evade |
| ARCHER | `archer_heart_pierce` +7% ATK; `archer_rapid_volley` +1 rage; `archer_hawk_eye` +8% crit; `archer_sharp_feather` +4% ATK/+4% crit; `archer_far_sight` +5% ATK |
| MAGE | `mage_focus_spell` +10% MATK; `mage_charge_up` +1 rage; `mage_diffusion` +6% MATK/+5 MDEF; `mage_frost_core` +8 MDEF; `mage_mana_tide` +5% MATK/+1 rage |
| SUPPORT | `support_divine_guard` +16 shield; `support_healing_touch` +8% healing; `support_inspire` +1 rage; `support_sanctuary` +10 shield/+5 MDEF; `support_harmony` +5% healing/+3% HP |
| FIGHTER | `fighter_berserk` +8% ATK; `fighter_endurance` +5% HP; `fighter_battle_spirit` +6% crit/+4% ATK; `fighter_crushing_guard` +5% ATK/+4 DEF; `fighter_relentless` +1 rage |

Trait selection is seed-driven:

1. generate/store an unsigned 32-bit seed;
2. choose from the class pool by deterministic weighted selection using that seed;
3. persist both trait id and corresponding seed;
4. when reloading, sanitize trait ids against the unit's class pool and normalize missing/invalid seeds deterministically;
5. do not reroll a valid saved trait merely because balance values changed.

If a unit has no explicit trait and trait rolling is enabled, roll exactly one trait. If trait rolling is disabled—such as creating a deterministic clone or normalizing merge sources—do not introduce a new random trait.

Merge ancestry concatenates the normalized trait/seed payloads from all merge-source units in deterministic source order and truncates only after 9 entries. It does not randomly replace parent traits. Aggregate bonuses sum numeric fields across all retained traits.

This ancestry is part of owned-unit state and therefore must survive save/load, board↔bench movement, star merge, Library/unit-detail inspection and network serialization.

## A44. Keyboard binding contract

Keyboard settings have three contexts: `planning`, `combat`, `menu`. Supported key values normalize to a single letter/digit or the named keys `SPACE, DELETE, BACKSPACE, ENTER, TAB, ESCAPE`; invalid values fall back to the action default.

Default bindings:

| Context | Action | Default |
|---|---|---|
| Planning | Start combat | SPACE |
| Planning | Reroll shop | D |
| Planning | Buy XP | F |
| Planning | Sell unit | E |
| Planning | New run | R |
| Planning | Settings | ESCAPE |
| Planning | Toggle audio | M |
| Combat | Step combat/debug-step where exposed | SPACE |
| Combat | Settings | ESCAPE |
| Combat | Toggle audio | M |
| Menu | Close/back | ESCAPE |

`ESCAPE` is a reserved binding key. Settings can reset one context or all contexts to defaults. Binding changes persist through canonical UI settings and active controls update immediately so a changed key works without restarting the game.

Installing bindings must first uninstall the prior handlers for that scene/context. Scene disposal must release every keyboard subscription; repeated scene entry cannot accumulate duplicate key callbacks.

Shortcut-help text is generated from the live normalized binding map and localization labels, so displayed hints cannot drift from the actual active keys.

## A45. Audio lifecycle and semantic SFX

Audio obeys canonical UI settings. Music and SFX read the same enable/mute/volume state; neither owns a separate user-volume truth.

### Music

Music contexts are:

`menu, planning, combat, victory, defeat, ambient`.

A context may intentionally have an empty playlist; that means silence. Never borrow an unrelated track as an implicit fallback.

Music scheduling requirements:

- global music scale = **0.45** × normalized master volume;
- scene/context change calls `play(context)`;
- re-requesting the already-playing context is a no-op;
- shuffled playlists avoid the most recently played track when more than one eligible track exists;
- a one-track playlist loops;
- multi-track playlists advance when a track ends;
- long-play tracks are avoided for a cold random pick unless already warmed/cached;
- transition crossfade duration = **900 ms**;
- at most **two** HTML audio elements may be alive at once, and only during crossfade;
- outgoing elements are paused, source-detached and released after the fade;
- browser autoplay rejection registers a one-time user-gesture resume path;
- when that gesture arrives, resume the context desired **now**, not a stale blocked context;
- headless/test environments with no Audio element are valid no-op operation;
- disposing the director stops playback, releases fade/gesture handlers and unsubscribes settings.

Authored playlists include multiple menu tracks, one Planning track and one Combat track. Victory, defeat and ambient contexts are supported music contexts and may remain silent until content is authored.

Legacy compatibility also supports a **weighted playlist** surface. Starting one stops the currently owned BGM, filters the weight map to audio keys that are actually available, chooses the next track by positive relative weight, applies normal master-volume scaling, and chooses again when that track completes. An empty map or a map with no loadable keys is a safe no-op. The rebuild may fold this into the newer music director, but imported/legacy content that depends on weighted selection must not silently become uniform random playback.

### SFX

Semantic SFX events are:

`hit, skill, buy, reroll, victory, defeat, draw, heal, ko, click`.

Aliases such as `attack→hit`, `shop_buy/buy_unit→buy`, `shop_reroll→reroll`, `win→victory`, `lose/loss→defeat` normalize before dispatch.

Legacy SFX playback is **sample-first**: when the semantic event maps to a loaded authored audio key, play that cached sample with canonical master-volume scaling (`ko` may use a stronger base level than ordinary events). If no mapped sample is available, fall back to a short Web Audio oscillator tone using the semantic event's fallback frequency. When neither sampled playback nor Web Audio is available, SFX is a safe no-op. A suspended AudioContext may resume on use. Unit-specific SFX profiles can modify waveform and pitch by species while still dispatching the same semantic event; this keeps timing bound to gameplay meaning rather than individual UI code.

Combat/purchase/result code fires SFX at semantic action or impact time. Changing game speed must not make sound happen before the corresponding visible impact.

## A46. Creative sandbox — exact economy, cloning, placement and enemy-override semantics

Creative mode is a first-class ruleset identified by the canonical Creative AI mode. It is not implemented by filling the normal wallet with an arbitrarily huge number. The UI displays the infinity label `∞`, while the underlying normal `player.gold` field may remain an ordinary finite value.

The economy contract is:

- affordability checks always succeed while Creative is active;
- spending a positive finite cost returns **0 spent** and must not mutate the normal wallet;
- gaining gold also returns **0 gained** and must not mutate the normal wallet unless the caller explicitly opts into `allowCreativeMutation=true`;
- outside Creative, spend subtracts the requested positive finite cost but clamps wallet gold to at least zero;
- outside Creative, gain adds the supplied finite amount but also clamps wallet gold to at least zero;
- invalid/non-finite/zero-value mutations are no-ops;
- tech research, purchases, sell flows and other gold-consuming systems must all route through this contract instead of inventing their own Creative exceptions.

Creative sandbox units live in a separate persisted `creativeSandboxUnits` collection. They are not silently inserted into the normal bench or board model. Each sandbox entry carries the normal owned-unit identity and progression payload plus:

`sandbox=true, sourceUid, side, row, col`.

Valid side normalization is only `LEFT` or `RIGHT`; anything other than explicit `RIGHT` becomes `LEFT`. A clone created from a source unit must preserve at minimum:

- `baseId`;
- current star;
- equipment ids;
- variant traits;
- variant seeds.

The clone must use `rollTrait=false`; dragging or duplicating a unit in Creative cannot reroll its genetic/variant identity. `sourceUid` points back to the source unit when available.

The Planning drag contract is explicit:

1. Dragging from the Creative dummy source to the battlefield is legal only when the destination is a board cell with integer `row` and `col`.
2. Destination side is derived from the battlefield column: columns at or beyond `RIGHT_COL_START` are `RIGHT`; earlier legal board columns are `LEFT`.
3. A destination must lie inside `0 <= row < BOARD_ROWS` and `0 <= col < BATTLEFIELD_COLS`.
4. On the LEFT side, a sandbox clone cannot occupy a normal allied-board cell that already contains a normal board unit.
5. On either side, two sandbox units cannot occupy the same `row,col`. Moving an existing sandbox unit may ignore its own uid during the occupancy check.
6. A successful dummy drop creates a persisted clone, appends it to `creativeSandboxUnits`, attempts sandbox auto-merge, refreshes world/HUD state and persists the run.
7. A sandbox unit already on the battlefield can be moved to another board coordinate and can cross between LEFT and RIGHT; moving it changes `row`, `col` and `side`, then reruns auto-merge.
8. Removing a sandbox unit by uid mutates only `creativeSandboxUnits`.

Sandbox auto-merge follows the same three-copy star progression principle as normal owned units:

- group by exact `baseId + star` within the same side;
- star-3 units never enter another merge;
- while a group contains at least three entries, consume three, call the canonical combine transaction, remove those three sandbox entries, and insert the resulting higher-star sandbox unit;
- the merged sandbox unit stays on the first consumed unit's position and side;
- merged `sourceUid` inherits from the first source chain;
- continue while the group still has at least three compatible entries, so nine 1-star clones can cascade through the same canonical combine behavior.

Selling a Creative sandbox unit removes it and may calculate/display its canonical sale value, but normal Creative wallet mutation remains suppressed. Canonical displayed sale value is:

`unitTier * starMultiplier + sum(equipmentSellPrice)`

where star multiplier is **1 for 1★, 3 for 2★, 5 for 3★**, and final value is at least 1.

The most important combat rule is the RIGHT-side manual enemy override. If at least one `creativeSandboxUnits` entry has `side=RIGHT`, combat enemy-source resolution uses those RIGHT sandbox units as the enemy formation and does **not** generate or substitute another encounter. Every resolved unit is stamped as sandbox data. If no manual RIGHT sandbox unit exists, combat continues through the normal explicit/handed-off enemy-preview path.

Creative saves must round-trip sandbox entries, including side, coordinate, equipment, variant data and source identity. Hydration must normalize malformed side/coordinate payloads instead of crashing the run.

Acceptance checks:

- Creative UI shows `∞` while an ordinary finite wallet remains unchanged after buy/reroll/research/sell actions;
- cloning the same source twice produces independent uids but preserves star/equipment/variant data;
- dropping three matching sandbox clones produces the same next-star unit semantics as the canonical merge;
- a manually authored RIGHT formation is exactly the formation combat consumes;
- moving a sandbox enemy from RIGHT to LEFT removes it from the manual enemy override on the next combat-source resolution;
- saving/reloading does not reroll variants or lose sandbox positions.


## A47. Co-op signalling, room state, P2P transport and combat synchronization

The co-op implementation is a browser WebRTC host-relay topology. Its canonical session type is:

`p2p_host_relay`.

The recognized application message types are exactly:

`room_state, player_ready, planning_intent, planning_ready_ping, authoritative_snapshot, combat_delta, combat_heartbeat, combat_start, combat_result, combat_retreat, player_disconnected`.

Signalling envelope kinds are exactly `coop_offer` and `coop_answer`. Signal envelope version is **1**.

### A47.1 Room capacity, slot identity and connection labels

Co-op capacity is normalized to **2..4** players. Player slots are named `P1` through `P4`. Slot-key parsing accepts case-insensitive `P1..P4`; an invalid key falls back to the caller's fallback slot. Index conversion is zero-based.

The host occupies slot index **0 / P1** unless another explicit supported host slot is authored by a higher-level flow. A host must never generate an invite for its own slot.

Connection labels/room codes are normalized by:

1. convert input to string;
2. uppercase;
3. remove every character outside `A-Z0-9`;
4. truncate to **6** characters by default;
5. if non-empty but shorter than six, right-pad with `X`;
6. an empty normalized input remains an empty string.

Signal metadata has canonical fields:

`sessionId, requiredCapacity, targetSlot, targetSlotIndex, selectedMode, aiMode, saveSlotId, saveMode, resumeSummary, hostSlotIndex, roomCode, playerId, role, connectionLabel`.

Defaults when metadata is absent are:

- `requiredCapacity=2`;
- `selectedMode="EndlessPvEClassic"`;
- `aiMode="COOP_MEDIUM"`;
- `saveSlotId="AUTO"`;
- `saveMode="new"`;
- `hostSlotIndex=0`;
- empty ids/labels where no real value exists.

`resumeSummary` is copied as data, not retained by reference.

### A47.2 ICE and signalling

Default signal/ICE-gathering timeout is **12,000 ms**. The default STUN configuration contains:

- `stun:stun.l.google.com:19302`;
- `stun:stun1.l.google.com:19302`;
- `stun:stun.cloudflare.com:3478`.

Offer/answer transport is a URL-safe base64 encoding of JSON. Decoding must reject unsupported signal kinds and malformed/missing RTC descriptions. A valid description requires string `type` and string `sdp`.

ICE gathering completes when browser state becomes `complete`, or the timeout expires. Timeout is a completion fallback for signalling generation; it is not itself a fatal exception. The minimum effective wait timeout is **250 ms**.

### A47.3 Host flow

Creating a room resets prior transport role state, then:

- sets role `host`;
- uses supplied non-empty `sessionId` or creates a peer id;
- derives six-character room code from supplied room code/session id;
- normalizes required capacity;
- creates/uses a local peer id;
- assigns local slot P1;
- stores normalized session metadata;
- marks the transport open as a room coordinator even before every invited peer data channel is open.

Creating an offer for a guest slot:

- requires host role;
- rejects host's own slot;
- rejects an already connected slot;
- closes/replaces any older pending offer for the same slot;
- creates a dedicated WebRTC peer object for that guest slot;
- creates the `coop` data channel;
- generates local SDP;
- waits for ICE gathering completion/timeout;
- serializes a `coop_offer` envelope containing session/slot metadata.

Applying a guest answer:

- requires host role and an existing pending offer for that slot;
- requires envelope kind `coop_answer`;
- requires answer `sessionId` to equal the current room session;
- requires answer `targetSlot` to equal the slot whose offer is being completed;
- applies remote description and then waits for the data channel's own open event.

When a pending host peer opens, it moves from the pending map to the connected map. A remote connected-peer close emits `player_disconnected` with source slot, slot index, peer id and close reason. Intentional local transport shutdown must not masquerade as a remote disconnect.

Host `send(message)` is best-effort fan-out to every currently connected guest peer. Failure sending to one guest must not prevent attempts to the others.

### A47.4 Guest flow

Accepting an offer resets prior role state, then:

- sets role `guest`;
- parses and validates the offer;
- adopts remote session id, room code, capacity, host slot and offered target slot;
- creates its own local peer id;
- creates a fresh WebRTC peer;
- sets remote offer SDP;
- creates/sets local answer SDP;
- waits for ICE gathering completion/timeout;
- returns serialized `coop_answer` plus normalized session metadata.

Guest `send` requires an open data channel. Calling it without one is an error; do not silently drop authoritative gameplay messages.

### A47.5 Data-channel lifecycle

The WebRTC client must:

- treat `failed`, `disconnected` and `closed` connection-state or ICE-state transitions as peer failure unless close was intentional;
- expose `open`, `close`, `error`, generic `message`, and recognized typed-message events;
- JSON-serialize outgoing application payloads;
- on malformed incoming JSON, emit an error and ignore the malformed packet;
- on incoming `type="error"`, surface its payload through the error channel;
- emit typed events only for recognized co-op message types;
- guard close notification so one physical failure does not produce duplicate disconnect notifications;
- close both data channel and peer connection on cleanup.

### A47.6 In-memory session authority

The co-op session singleton stores at minimum:

`client, roomCode, playerId, playerCapacity, localSlot, hostSlot, aiMode, selectedMode, readyBySlot, players, currentCombatPayload, roomPlayers, sessionType, pvpState, activeSaveSlotId, saveMode, resumeSummary, resumeState, coopCombatSnapshot, coopCombatDelta, coopCombatHeartbeat, combatSnapshotsBySlot`.

Creating a session constructs a ready flag and player state for every legal slot at the current capacity. Missing player objects become canonical default co-op player state.

Updating a session:

- creates one if none exists;
- recomputes capacity from explicit capacity/game mode/AI mode;
- re-normalizes local/host slots against that capacity;
- merges ready/player maps and then rebuilds them to the legal slot set;
- copies room-player objects;
- shallow-merges `pvpState`;
- lets explicit `null` clear resume/snapshot/delta/heartbeat fields where supported;
- merges `combatSnapshotsBySlot`;
- notifies subscribers after the state mutation.

Remote-slot lookup returns every legal slot except the normalized local slot. The single-remote convenience accessor returns the first remote slot and is therefore only semantically complete for two-player flows.

### A47.7 Co-op Survival combat stream

Combat synchronization uses three payload kinds:

- full snapshot `coop_survival_combat_snapshot`, target interval **500 ms**;
- delta `coop_survival_combat_delta`;
- heartbeat `coop_survival_combat_heartbeat`, target interval **20 ms**.

Full unit snapshot state contains:

`uid, side, row, col, homeRow, homeCol, hp, maxHp, shield, rage, alive, statuses`.

Coordinates/counts are normalized to non-negative integers. HP/shield/rage meters are non-negative rounded integers. Missing side defaults LEFT. Missing `alive` means alive.

A snapshot contains:

`round, revision, lastDeltaRevision, phase, turnCycleIndex/combatRound, actionCount, turnIndex, isActing, timestamp, units`.

Only serialized units with a non-empty string uid survive into the payload.

A delta contains:

`round, turnCycleIndex/combatRound, turnIndex, deltaRevision, lastSnapshotRevision, timestamp, events`.

Each event contains:

`eventId, reason, damageType, outcome, amount, absorbed, isCrit, attackerUid, defenderUid, attackerState, defenderState`.

Damage type normalizes to `physical|magic|true`, default physical. Outcome normalizes to `hit|miss`, default hit. Delta events with no event id, attacker uid or defender uid are dropped.

Heartbeat contains:

`round, turnCycleIndex/combatRound, turnIndex, lastDeltaRevision, lastSnapshotRevision, timestamp`.

Revision semantics are mandatory. A receiver uses snapshot `lastDeltaRevision`, delta `deltaRevision`, and heartbeat last-seen revisions to determine coverage/staleness. Do not apply an already-covered delta twice. Do not let an older snapshot roll state backward over newer accepted deltas.

Acceptance checks:

- malformed offer/answer, wrong session id, and wrong target slot are rejected before peer state is accepted;
- 4-player room maintains P1..P4 ready/player maps;
- host disconnect of one guest identifies the correct source slot;
- invalid JSON packet raises local transport error but does not crash session;
- snapshot/delta/heartbeat revisions are monotonic from the authoritative sender and a receiver never double-applies one delta;
- a full snapshot can resynchronize a client after missed deltas.


## A48. PvP Fortress — pairing, ghost opponent, snapshots and round resolution

PvP Fortress has canonical session type `pvp_fortress`. Message payload kinds are:

- start: `pvp_fortress_start`;
- report: `pvp_fortress_report`;
- resolution: `pvp_fortress_resolution`;
- remote combat snapshot: `pvp_fortress_combat_snapshot`.

Remote combat snapshots target **5,000 ms** intervals and become stale when older than **10,000 ms**. A PvP Fortress combat win awards **3 gold**.

### A48.1 Match state

Initial state for a supplied slot set is:

- phase `planning`;
- round **1**;
- every slot ready=false;
- every castle HP = supplied starting HP, default **100**;
- all slots alive;
- no eliminated slots;
- no current matchups;
- no expected pair ids;
- no submitted pair reports;
- last opponent per slot = null;
- champion is the only slot immediately if the session starts with exactly one slot;
- revision **1**.

State normalization clamps castle HP to a non-negative integer. A slot whose normalized castle HP is zero is removed from alive and moved to eliminated. Revision is at least 1.

### A48.2 Enemy preview conversion

A PvP combat opponent is reconstructed from the other player's board snapshot. Every occupied board cell contributes:

`baseId, star>=1, equips[], row, col`.

Enemy preview columns are offset by `RIGHT_COL_START` so opponent units arrive on the enemy half. The PvP combat run state is a deep-cloned player state with:

- `enemyPreview` set to that converted board;
- `enemyPreviewRound` equal to the player's current round, default 1;
- `enemyBudget` equal to preview unit count;
- supplied PvP combat AI difficulty, default `MEDIUM`;
- supplied audio-enabled flag.

### A48.3 Pairing algorithm

Alive slots are Fisher-Yates shuffled using an injectable random function. Pairing then minimizes immediate rematches:

- if A's last opponent was B, penalty +2;
- if B's last opponent was A, another +2;
- for each base slot, choose randomly among remaining candidates with the **lowest** penalty.

Real pair ids are stable and independent of side ordering:

`round:<round>:pair:<lexically-sorted-slotA>:<slotB>`.

When alive player count is odd and greater than one, exactly one shuffled slot becomes the **ghost fighter**. The remaining even slots form real matches. The ghost fighter battles a snapshot of another alive player's board:

- candidate owners come from players participating in real pairings when available;
- prefer an owner who was not the ghost fighter's last opponent;
- if all candidates repeat, fall back to the full candidate pool;
- choose from the pool with the injectable random function.

Ghost pair id is:

`round:<round>:ghost:<fighterSlot>:<ghostOwnerSlot>`.

Only the ghost fighter runs that combat and reports it. The ghost owner's live castle is not the combat target; their board is used as an opponent snapshot.

### A48.4 Starting combat

At combat start, the host:

1. normalizes current state against the current player-slot map;
2. filters to alive slots that still have player state;
3. generates current matchups;
4. builds an individualized combat payload for each participating fighter;
5. clears ready flags for alive slots;
6. changes phase to `combat`;
7. stores `currentMatchups`;
8. stores all generated `expectedPairIds`;
9. clears previous `reportByPairId`;
10. increments state revision by one.

For a real pair A/B, A receives B's board as its enemy preview and B receives A's board. Each room-combat metadata object records pair id, round, local slot, opponent slot and the designated reporter slot.

For a ghost pair, only the fighter gets a payload. Metadata marks type `ghost`, includes `ghostOwnerSlot`, and sets `ghost=true`.

### A48.5 Reports

Combat report payload stores:

`slot, pairId, round, matchupType, opponentSlot, ghostOwnerSlot, result`.

Result normalizes:

`winnerSide, round, leftAlive, leftTotal, rightAlive, rightTotal`.

Missing winner defaults DRAW. Alive/total counts clamp to non-negative integers.

The host must resolve a round only from expected pair reports. Unknown, duplicate or stale pair ids must never be allowed to mutate a castle twice.

### A48.6 Castle damage and win gold

Castle damage equals the integer survivor count on the **winning combat side**. Draw deals zero castle damage.

For a real match:

- local LEFT victory damages the opponent castle by `leftAlive`;
- local RIGHT victory damages the local castle by `rightAlive`;
- the logical winner receives **3 gold**;
- the opponent receives a mirrored result so LEFT/RIGHT counts and winner orientation are correct from that player's perspective;
- castle HP cannot fall below zero.

For a ghost match:

- if ghost/right side wins, fighter castle takes `rightAlive` damage;
- otherwise the fighter takes no castle damage;
- if fighter/left side wins, fighter receives **3 gold**;
- the ghost owner does not lose castle HP from this ghost simulation.

After each resolved matchup, `lastOpponents` records the opponent used for future rematch penalty, including the ghost owner for the ghost fighter.

After the round:

- `aliveSlots` are those with castle HP > 0;
- every zero-HP slot is in `eliminatedSlots`;
- if exactly one alive slot remains, it becomes `championSlot`;
- each player's result receives `fortressHpAfter`;
- if champion exists, results mark match ended and name the winner slot;
- all ready flags reset false;
- current matchups, expected pair ids and report map are cleared;
- phase becomes `finished` when champion exists, otherwise `planning`;
- round increments by one only when the match continues;
- state revision increments by one.

### A48.7 Remote-match HUD snapshots

Combat snapshots contain pair/slot metadata plus:

`phase, turnCycleIndex/combatRound, actionCount, turnIndex, queueRemaining, leftAlive, rightAlive, leftHpTotal, rightHpTotal, playerHp, timestamp`.

When there is more than one simultaneous matchup, the HUD may display a remote match. For a real remote pair it accepts the freshest available snapshot from either fighter and maps local LEFT / opponent RIGHT fields back to canonical player labels. For a ghost pair it labels the opponent as `Bóng Ma (<ownerSlot>)`.

HUD side comparison is display-only:

1. higher alive count leads;
2. if alive ties, higher total HP leads;
3. otherwise neither side is marked leading.

This visual lead must never resolve a battle or mutate fortress HP.

Acceptance checks:

- with four players, two real pairs are produced and immediate rematches are avoided whenever a lower-penalty pairing exists;
- with three alive players, one real match plus one ghost match is produced;
- losing to a ghost damages only the fighter's castle;
- real winner gold is exactly 3 and draw gold bonus is 0;
- survivor count determines castle damage exactly;
- stale remote snapshots are labeled stale after 10 seconds but do not terminate/resolve combat;
- champion appears only when exactly one castle remains above zero.


## A49. Haptics, gamepad/touch and browser speech

### A49.1 Haptics

Haptics preference is stored at `forest-throne.haptics-enabled`. Missing/unreadable storage defaults to **enabled**. Unsupported vibration API is a safe false/no-op result.

Canonical vibration presets are:

| semantic event | vibration pattern |
|---|---:|
| buy | 15 ms |
| tap | 10 ms |
| starUpgrade | 30, 20 pause, 50 ms |
| victory | 50, 30 pause, 80 ms |
| defeat | 80, 50 pause, 80 ms |

The trigger function also accepts a direct number or number-array pattern. Any exception from browser vibration returns false; tactile feedback is never allowed to break gameplay.

### A49.2 Gamepad/touch

Planning and Combat each own a disposable gamepad controller. Re-entering a scene destroys the old controller before installing another. Connection/disconnection listeners are removed on scene teardown.

Input is polled from the first connected browser gamepad or the scene adapter's gamepad list. Button presses use latch/edge behavior for menu/combat presentation actions so holding a button does not repeatedly activate a modal action every frame.

Gamepad navigation must respect modal ownership. Settings, history, version info, library and other active modal surfaces block underlying board/menu actions. Touch and gamepad confirm/cancel share the same semantic callbacks used by pointer/keyboard UI rather than duplicating business logic.

The rebuilt input layer must preserve:

- connect/disconnect user feedback;
- controller state reset on disconnect;
- no duplicate global listeners after repeated scene entry;
- modal gating;
- no gameplay mutation from a held button unless that action is intentionally repeatable;
- pointer/touch hit targets large enough for the existing mobile layout.

### A49.3 Browser speech

Speech synthesis is optional capability. When `speechSynthesis`, `speechSynthesis.speak` or `SpeechSynthesisUtterance` is unavailable, speech calls return false and gameplay continues.

Language normalization is:

- empty/unknown simple language -> `vi-VN`;
- prefix `vi` -> `vi-VN`;
- prefix `en` -> `en-US`;
- another already hyphenated tag is preserved.

Vietnamese voice preference order is:

1. exact `vi-VN` local-service voice;
2. any exact `vi-VN`;
3. any voice whose language starts `vi`;
4. recognizable Vietnamese voice-name fallback.

English uses the analogous exact-local `en-US`, exact `en-US`, then `en*` order.

`speakWithBrowserVoice` defaults to:

`lang=vi-VN, rate=1, pitch=1, volume=1, cancelCurrent=true`.

Blank text returns false. Non-finite rate/pitch/volume fall back to 1. By default, currently speaking content is cancelled before the new utterance. Browsers that populate voices asynchronously get a one-time `voiceschanged` retry path, while an immediate utterance is still attempted. App bootstrap warms the voice list without speaking.

### A49.4 Combat event speech announcements

The older Combat presentation included an optional speech layer for high-value combat events. Preserve this as an accessibility/presentation capability built on A49.3; it never owns combat state and a failed/unsupported utterance is a no-op.

Combat speech uses `rate=0.94` and `pitch=1.04`, with language resolved from the active locale. Event kinds, priority and anti-spam timing are:

| Kind | Priority | Minimum gap | Same-key gap | Higher-priority interrupt floor | Cancel current utterance |
| --- | ---: | ---: | ---: | ---: | --- |
| basic attack | 1 | 1250 ms | 1600 ms | 180 ms | no |
| ordinary skill | 2 | 450 ms | 1100 ms | 180 ms | yes |
| support auto-cast | 3 | 650 ms | 1400 ms | 160 ms | yes |
| tanker auto-cast | 3 | 650 ms | 1400 ms | 160 ms | yes |
| death | 4 | 300 ms | 900 ms | 100 ms | yes |

The speech key is stable enough to suppress repeated announcements of the same event: basic attacks key by attacker identity, ordinary skills by caster + localized skill label, auto-casts by caster + target + effect label, and death by the defeated unit identity. If the same key repeats before its same-key gap, suppress it. A higher-priority event may interrupt a lower-priority event only after its interrupt floor; an equal/lower-priority event waits for its normal gap.

Player-facing Vietnamese speech text is sanitized before speaking. Basic attack announces `<unit + side> đánh thường`; death announces `<unit + side> bị tiêu diệt`; an ordinary skill speaks its localized skill name; support auto-cast announces the caster supporting the target with the resolved effect; tanker auto-cast announces the caster self-activating the resolved effect on the target. Side labels distinguish allied `phe ta` and enemy `phe địch` when available.

Only a successfully queued utterance advances the last-spoken timestamp/key/priority. Visual animation, action timing, damage, rage, death cleanup and queue order proceed identically whether speech is available, disabled or rate-limited.


## A50. Mod registry and manager — package surface, manifest normalization and load-order profile

The supported package-extension surface is exactly:

`.ftunit, .ftlogic, .ftmodpack`.

The browser cannot enumerate `public/mods`; bundled/dev discovery therefore comes from `mods/index.json`. The canonical index schema version is **1**.

Every normalized manifest has:

`id, name, version, description, author, source, packageType, entry?, workshopId?, requires[], conflicts[], tags[]`.

Rules:

- a record without non-empty `id` and `name` is dropped;
- version defaults `0.0.0`;
- author defaults `Unknown`;
- source is one of `bundled|local|workshop`, default bundled;
- unsupported packageType normalizes to `.ftmodpack`;
- list fields retain only trimmed non-empty strings;
- optional empty `entry` / `workshopId` normalize away.

Index loading uses `fetch(..., {cache:"no-store"})`. Missing fetch, HTTP failure, malformed data or exception yields an empty normalized index, not a boot failure.

Steam Workshop metadata is currently an explicit capability placeholder:

`{status:"placeholder"|"available", appId:string|null}`.

The bundled index currently advertises placeholder status with no app id. The rebuild must preserve the Workshop integration seam in the manager, but must not falsely claim that a live Workshop downloader exists until implemented.

The enabled-mod profile is local user state stored at:

`forest-throne.mods.profile.v1`.

Profile schema:

`{schemaVersion:1, enabledIds:string[], loadOrder:string[]}`.

Normalization:

- deduplicate both arrays while preserving first occurrence order;
- every enabled id missing from loadOrder is appended to the end;
- corrupt/unreadable storage returns the empty default profile.

Enabling a mod removes prior duplicates, appends the id to `enabledIds`, removes any old occurrence from load order, then appends it to the end of load order. Disabling removes it from both enabled ids and load order. Moving a mod changes its load-order position by exactly -1 or +1 and is a no-op at array boundaries or for an unknown id.

The current production feature is therefore **registry + validation + enable profile + load-order manager + package-type/workshop surface**. If the rebuild adds actual package execution, it must do so as a new explicit loader phase with dependency/conflict validation and clear failure isolation; it must not silently reinterpret these three extension names or erase the manager/profile contract.

Acceptance checks:

- missing `mods/index.json` still opens an empty usable manager;
- duplicate ids in stored profile normalize deterministically;
- enable/disable/reorder persists and survives reload;
- invalid packageType falls back to `.ftmodpack`;
- Workshop placeholder remains visibly distinguishable from a real connected Workshop backend.


## A51. Platform bootstrap, Discord activity, version metadata and offline cache recovery

### A51.1 App version authority

Application version comes from `package.json.version`. Empty version falls back to `0.0.0`. Display formatting removes only a trailing patch zero from an exact `major.minor.0` version, so `0.1.0 -> 0.1`, while other semver strings remain unchanged. The display tag prefixes `v`. Last-updated metadata comes from `package.json.lastUpdated`, fallback `N/A`.

### A51.2 Discord Embedded Activity

Discord Activity integration activates only when all three conditions hold:

1. a browser window exists;
2. `VITE_DISCORD_CLIENT_ID` is non-empty;
3. URL query has non-empty `frame_id`, `instance_id` and `platform`.

When active, app bootstrap awaits Discord SDK `ready()` before creating the game app.

External links are accepted only when they parse as HTTP or HTTPS URLs. In Discord, first try `sdk.commands.openExternalLink`. If that throws, fall back to `window.open(url, "_blank", "noopener,noreferrer")`. Invalid/non-http(s) input returns false.

### A51.3 Boot and fatal recovery

Browser boot is idempotent per page through `window.__threeApp`. Initialization applies saved:

- graphics quality, default high;
- render scale, default 1;
- resolution preset from UI settings;
- battery saver, default false.

The initial scene is Loading, whose completion routes to Main Menu.

Fatal boot/load failures must produce a visible recovery UI rather than leaving a blank screen. Recovery actions include reload and a separately confirmed clear-run-progress + reload operation.

A **10,000 ms** boot watchdog is enabled outside test mode. It reports a fatal timeout only if neither boot-complete nor app instance exists at the deadline.

### A51.4 Service worker

Service worker registration runs only in production and only when browser service-worker support exists. Registration waits for the document load event unless the document is already complete.

Worker version is `0.1.0`; cache namespace is `forest-throne-`; current cache name is namespace + worker version. Core precache contains:

`./, ./index.html, ./manifest.json, ./favicon.ico`.

Fetch strategy:

- browser-extension schemes -> bypass;
- URLs containing `/assets/` or ending in `.woff2, .ogg, .mp3, .png, .jpg, .svg` -> cache-first;
- all other GET requests -> network-first;
- non-GET is untouched.

Cache-first behavior: return cache hit, otherwise fetch and cache status-200 response.

Network-first behavior: fetch and cache status-200 response; on network error, use cache hit; if a navigation still misses, fall back to cached `./index.html`; otherwise return HTTP **503** body `Network offline`.

Install precaches and calls `skipWaiting`. Activation deletes older caches in the Forest Throne namespace and claims clients.

Version recovery protocol:

- client sends `CLIENT_VERSION` with current app version;
- worker responds `SW_VERSION` with worker version/cache name and equality flag;
- mismatch triggers registration update + request to activate a waiting worker;
- waiting worker accepts `SKIP_WAITING`;
- when controller changes on a page that already had a controller at boot, reload once;
- session-storage guard keyed by current app version prevents reload loops;
- once worker/client versions match, clear the reload guard.


## A52. Performance profiler and adaptive VFX budget

The performance profiler tracks:

`fps, frameTimeMs, drawCalls, triangles, geometries, textures, quality, isThrottled, sampleCount`.

Default profiler configuration:

- sample window **60** frames;
- target **60 FPS**;
- low-FPS threshold **45 FPS**;
- draw-call throttle threshold **50**;
- adaptive quality enabled.

Frame delta is clamped to at least **0.1 ms**. Rolling FPS is `round(1000 / averageFrameTimeMs)`, capped at **120**. Performance diagnostics may also report draw calls, triangles, geometry count and texture count when available.

A frame is considered under load if either FPS < 45 or draw calls > 50. Under load:

- increment consecutive slow frames;
- clear fast-frame counter;
- set `isThrottled=true`;
- after **30** consecutive slow frames, reset that slow counter and lower quality one step: high -> medium -> low;
- invoke the degrade callback only when the quality tier actually changes.

When under-load condition clears:

- increment fast-frame counter;
- clear slow counter;
- after **60** consecutive fast frames, clear `isThrottled`;
- after **180** consecutive fast frames, reset fast counter and recover one quality step: low -> medium -> high;
- invoke recover callback only on a tier change.

Explicitly setting quality resets both consecutive counters.

VFX budget multiplier is:

- high = 1.0;
- medium = 0.75;
- low = 0.5;
- multiply current base by **0.7** while throttled;
- clamp final multiplier to at least **0.25**.

This multiplier controls expendable visual density only. It must never alter hit timing, damage numbers, target selection, status application, combat queue order or other simulation state.

Combat VFX distinguishes battle-text semantics `damage, crit, heal, dodge, shield, status`. Text/particles/ground flashes may vary by damage type and quality, but every effect is downstream presentation attached to an already-decided combat event. Disposal must cancel animation frames/timers and detach temporary scene objects so repeated combats do not leak effects.

Acceptance checks:

- deterministic timestamp injection reproduces quality degrade after 30 sustained slow samples and recovery only after sustained fast samples;
- low+throttled VFX budget is 0.35;
- profiler disposal stops callbacks;
- reducing VFX budget does not change a deterministic combat-result hash.


## A53. Expanded acceptance gate for A46–A52

The rebuild is not accepted merely because menus render or a single combat finishes. Add targeted deterministic tests/harness checks for these contracts:

1. **Creative:** infinite-affordability without wallet mutation; clone preserves equipment/variants; sandbox 3-copy merge; RIGHT manual formation overrides normal enemy preview; save/load round-trip.
2. **Co-op signalling:** six-character room normalization; 2/4-player slot normalization; wrong-session/wrong-target answer rejection; signal encode/decode; missing WebRTC capability surfaces a clear controlled error.
3. **Co-op transport:** host pending->connected slot transition; remote disconnect event carries correct slot; malformed message isolation; close notification idempotence; guest send requires open data channel.
4. **Co-op combat sync:** snapshot/delta/heartbeat schema and revision coverage; missed-delta resync by snapshot; duplicate delta not applied twice.
5. **PvP Fortress:** no-repeat penalty affects pairing; odd player gets one ghost fight; winner survivor count equals castle damage; winner gold=3; ghost owner castle unaffected; elimination/champion transition exact.
6. **Haptics/speech:** unsupported browser APIs are safe no-op; persisted haptics off blocks vibration; speech locale/voice priority deterministic with fake voices.
7. **Mods:** corrupt/missing index/profile normalization; enable-disable-load-order persistence; unsupported package type fallback.
8. **Platform:** Discord activation requires client id + all three query keys; unsafe external schemes rejected; fatal boot fallback is visible; watchdog does not fire after successful init.
9. **Offline:** cache strategy classification; version mismatch handshake; old namespace cache cleanup; network-first navigation fallback; reload guard prevents controller-change loop.
10. **Performance/VFX:** exact 30/60/180 sustained-frame thresholds; budget multipliers; quality callback lifecycle; simulation output unchanged by VFX quality.

For network tests, use injected peer/random/time adapters. Do not make correctness depend on live public STUN availability. For browser-only APIs, use small capability fakes so headless verification can prove state-machine behavior deterministically.

## A54. Conflict precedence — preserve one canonical product rule

When two descriptions of the same feature disagree, resolve the conflict into one explicit product rule rather than carrying two competing behaviors into the rebuild.

Use these rules whenever the two generations overlap:

1. **The canonical gameplay rule in this specification wins** whenever it defines the behavior explicitly.
2. **A recovered capability remains part of the product** when this specification explicitly describes its player-facing behavior, even if a newer presentation no longer exposes it clearly.
3. **Preserve behavior, not obsolete implementation structure.** Recreate the player-visible capability inside one coherent rebuild.
4. **Renaming or redesigning a subsystem does not remove its product contract.** Preserve what the player can do, what state changes, what feedback appears and what failure cases are handled.
5. **Duplicate or prototype behavior never creates a second authority.** Only the explicit canonical rule in this document owns the final behavior.
6. **When a compatibility behavior is explicitly superseded, keep only the replacement rule.** Example: generic turn-order slow is inactive; the evasion/status model owns that gameplay space.

Capability families that must remain represented include loading interaction, social/donation/tribute surfaces, controller navigation, resolution switching, rich shared tooltips, skin/theme metadata, gated PvP concepts, stable VFX under quality scaling, robust imported-content parsing where used, audio-resume behavior, combat/skill previews and the full Planning/Combat interaction set.

Treat every capability in this document as a behavior contract. Architecture and presentation may be rebuilt freely as long as those contracts remain true.
## A55. Additional product capabilities — loading interaction, social support and visual polish

This section makes smaller but still real product behaviors explicit so they are not lost during a visual rebuild.

### A55.1 Loading bubble minigame

Loading includes a presentation-only bubble shooter. It must never gate, accelerate, slow, cancel or mutate actual asset loading or saved gameplay.

The current interaction contract is:

- play field is pointer/touch interactive;
- firing uses the repeating semantic emoji sequence `🐾, 🍄, 🌰, ⭐, 🔥, 🍃`;
- first spawn cooldown starts at **180 ms**, then recurring bubble spawn cooldown is **280 ms**;
- pointer/touch shot starts from horizontal center near the bottom of the field;
- projectile speed is **620 px/s**;
- projectile collision uses circular overlap: distance <= projectile radius + bubble radius;
- projectile radius is **16 px**;
- bubble radius is random in **[18, 30)** px;
- bubble horizontal drift is random in **[-24, 24)** px/s;
- bubble vertical velocity is random in **[-92, -54)** px/s;
- wobble amplitude is random in **[8, 16)**;
- each hit removes both the projectile and bubble and increments score by exactly **1**;
- score callback receives the new integer score;
- off-field bubbles/projectiles are removed;
- update delta is capped at **100 ms** to avoid a giant catch-up step after a stalled/tabbed frame;
- dispose removes pointer listeners, all transient objects and the minigame root.

Redesign this minigame in the same authored medieval forest-fantasy visual language as the rest of the game.

### A55.2 Social links and voluntary donation

The main menu preserves a social/community surface plus a voluntary donation flow.

The menu exposes distinct outbound-link categories for community chat, social profile, project/community portal and the project's external shop/support storefront. Preserve the configured destinations and open them through the same safe external-link behavior used by platform integrations.

Donation amount choices are:

`5k, 10k, 15k, 20k, 30k, 50k, 100k, 200k, 500k, Tùy tâm`.

`Tùy tâm` uses amount **0**, meaning the generated QR URL omits a fixed amount. Positive values are rounded to integer currency units before being placed in the URL.

The legacy default selected amount is **20k**. Opening the donation surface generates/refreshes the QR for the current selection. The modal blocks interaction behind it, closes from its explicit close control or `ESC`, and invalidates/rejects stale asynchronous QR image completion rather than letting an older selection overwrite the current one.

QR transfer-note behavior:

- choose from the authored voluntary-support message pool using injectable randomness where deterministic testing matters;
- trim the note;
- hard-limit note text to **50 characters**;
- if caller supplies an empty note, choose another authored fallback message;
- regenerate the QR when amount/note changes;
- prevent a late response from an older QR request replacing a newer selection by using a monotonically increasing request/load key;
- in a restricted Discord Activity context where the external QR image cannot load because of origin/platform constraints, show an explicit “open QR externally” path instead of a broken image;
- external opening must use platform-safe external-link behavior.

The donation destination remains configured content. Do **not** duplicate private/payment identifiers into unrelated product text or surfaces.

### A55.3 Tribute gallery

The tribute/credits gallery has this baseline layout behavior:

- **4 columns** at its base layout;
- tile size **68**;
- gap **8**;
- label-height budget **18**;
- static label threshold **10 characters**, after which scrolling/marquee behavior may be used.

The rebuild may responsively change the number of columns and pixel measurements when required by the new layout, but it must preserve the behavior: contributor identity, portrait when available, readable name, bounded labels, image-loading failure tolerance, scrolling/pagination as needed and safe modal ownership.

Contributor data is content input. Updating the contributor list must not require rewriting the gallery interaction logic.

### A55.4 Image/icon loading behavior

Icons, fonts, audio, world art and other image assets may load at different times, but loading state must remain understandable. Overall progress and individual failures can be surfaced when useful. Repeated requests for the same asset must behave consistently, corrupt/undecodable assets must produce a controlled fallback, and a late asset completion must not revive a screen the player already left.

The main-menu background is one authored cover/crop composition. Preserve cover math rather than stretching the source: sanitize non-positive/non-finite frame dimensions to 1, fall back invalid source dimensions to the target frame dimensions, compute `scale = max(frameWidth/sourceWidth, frameHeight/sourceHeight)`, display at `sourceWidth × scale` by `sourceHeight × scale`, and center the result on the target frame. This guarantees full frame coverage while cropping only the excess axis and preserving source aspect ratio. Missing texture/source metadata leaves the current image safely unchanged instead of throwing.

Legacy Main Menu media uses a **progressive video-over-image fallback**. The still `menu_bg` may render immediately. When `menu_bg_video` exists and the runtime supports video, create it muted and hidden, apply the same cover math, and reveal it only after valid video/texture dimensions are known; at that moment hide the still image. A video error restores/keeps the still image instead of leaving an empty background. Looping background playback is presentation-only and owns no gameplay/audio-setting state.

The legacy shared preload also carries the authored footer/comment image `mtp_comment`. When that asset exists, the Main Menu exposes it as a bottom-center decorative/footer element sized responsively; missing/failed loading simply omits the decoration. Treat the source image as content provenance, not as a reason to recreate it with CSS or procedural text.

Shared asset loading is staged. Essential lightweight SFX and immediate Menu content may be queued for boot; scene music for Planning/Combat can be prefetched after Menu music has started. Deferred prefetch deduplicates requested scene names and invokes its completion callback even when nothing needed loading. If indexed scene tracks are unavailable, the authored single-track scene fallback remains legal. Loading/prefetch must never start duplicate playback or revive a disposed scene.

Emoji/icon art is treated as individual semantic icons; visual scaling must preserve its intended proportions rather than assuming a spritesheet layout.

### A55.5 Effect-density and quality behavior

Transient VFX must remain bounded so dense combat cannot create unlimited overlapping highlights, damage text or particles. Low graphics quality may reduce effect density substantially; medium/high may use the full authored presentation. Quality changes affect appearance only and never remove gameplay events.

Do **not** reintroduce the old red/blue unit circles. Selection, targeting and ownership use the tile/highlight language defined elsewhere.

### A55.6 Shared visual feedback semantics

The presentation must preserve clear hit accents/jolts, low-HP feedback where authored, segmented rage readability, star-aware visual growth, correct side-facing, avatar/status synchronization to the unit’s current position, a stable death pose, skill-cast theming, star-evolution decoration and skin/evolution appearance.

These effects follow canonical state and action events. Decorative layers must never create extra logical units, extra hits or altered stats. Every canonical unit must have an intentional visual identity; missing unit art is a completeness failure rather than a reason to substitute a generic whole-animal or emoji body.

## A56. Game speed — exact progression and presentation timing

Game speed has one canonical progression field: `player.speedLevel`.

Core constants:

- legal speed level: **0..10**;
- display base multiplier: **1.0×**;
- each level adds **0.5×**;
- therefore level 0 = **1.0×**, level 1 = **1.5×**, ..., level 10 = **6.0×**;
- speed tech purchase cost is **3 gold per level**;
- at max level, generic upgrade-cost query returns `Infinity`;
- canonical display label is one decimal place, for example `x1.0`, `x1.5`, `x6.0`.

The active progression source is the Tech Tree node:

- id `speed`;
- branch `CRAFT`;
- requires `root`;
- max purchases **10**;
- each purchase applies `speed_upgrade +1`;
- authored cost array begins at **3** and the repeated-node semantics must still resolve each legal purchase to the canonical speed progression;
- research application clamps `speedLevel` to max 10.

Any compatibility action labeled “upgrade speed” still resolves through `player.speedLevel`. Manual speed overrides may not create an independent speed value that drifts from purchased progression.

Combat timing deliberately separates **unit animation pose speed** from **turn-scan cadence**:

- authored unit animation speed factor = **1/3**;
- presentation-duration factor = **3×**;
- turn scan speed factor = **2×**;
- turn-scan pulse base rate = **0.035 per ms**, then multiplied by scan-speed factor;
- contact-hold base = **320 ms**, therefore presentation-scaled contact hold = **960 ms**;
- occupied-cell base action interval = **0.6 s** before speed and scan scaling.

Player speed changes timing via:

`displayMultiplier = 1 + 0.5 * clamp(speedLevel, 0, 10)`

`combatDurationMultiplier = 3 / displayMultiplier`

`occupiedActionIntervalSeconds = 0.6 * combatDurationMultiplier / 2`

Thus:

- level 0 occupied interval = `0.6 * 3 / 2 = 0.9 s`;
- level 10 occupied interval = `0.6 * 0.5 / 2 = 0.15 s`.

Empty-cell/empty-step delay begins at **50 ms** and is divided by display multiplier, rounded, with minimum **1 ms**.

Authored unit motion durations use a baseline ×3 presentation scaling to keep animal animation readable. Turn scan delay divides by 2 independently. Do not collapse those two knobs into one multiplier: speeding the purple initiative scan must not shorten an authored attack pose, and slowing an animal pose must not make board scanning sluggish.

Damage/status application timing remains tied to the semantic impact point from the combat contract. A higher speed level shortens waiting/cadence but must not cause damage to apply before the attacker reaches the impact point.

Acceptance checks:

- clamp values below 0 to 0 and above 10 to 10;
- exact labels `x1.0` at level 0 and `x6.0` at level 10;
- ten legal speed upgrades cannot produce level 11;
- combat controller ignores arbitrary manual `setSpeed(999)` and reuses persisted progression;
- deterministic combat outcome is identical at level 0 and level 10; only presentation/cadence time changes;
- unit animation slowdown and scan-speed multiplier remain independently testable.


## A57. Persistence — exact envelope, migration, import/export, clear scopes and Co-op save slots

### A57.1 Canonical solo/shared progress envelope

Primary run progress is stored under:

`forest_throne_progress_v1`.

The current envelope version is **4**. The outer envelope contains:

`version, savedAt, payload, achievementsProfile, collectionProfile`.

`payload` is the canonical serialized run state. Achievement and collection profiles are normalized independently and included in exported progress so an import can restore the progression context together with the run when persistence is explicitly requested.

Creating an envelope:

- defaults `version` to 4;
- defaults `savedAt` to `Date.now()`;
- preserves the supplied canonical payload;
- normalizes achievement profile;
- normalizes collection profile.

Never serialize transient rendering, audio, timers, listeners, screen instances or in-progress animation state.

### A57.2 Validation and migration

Save parsing is fail-closed and recoverable:

- non-object outer value -> invalid;
- missing/non-object payload -> invalid;
- payload with neither valid `player` nor valid `players` shape -> invalid;
- missing numeric version is interpreted as version 1;
- migration exception -> invalid rather than boot crash.

Version migrations are ordered:

1. **v1 -> v2:** normalize player level into **1..25**; old values above 9 are allowed to migrate but are clamped to 25.
2. **v2 -> v3:** do not apply the older archived-roster cleanup rule.
3. **v3 -> v4:** former archived roster ids are preserved when they are present in the live catalog.
4. After version-specific steps, sanitize every player's board, bench and shop and apply player numeric clamps/normalization.

The resulting envelope version becomes 4 when migrating from an older version.

Unit sanitization must preserve valid catalog ids. Unknown/removed ids may use the explicit replacement map if one is authored; do not guess replacements by display name or species similarity.

Loading a save logs migration/sanitization messages. If migration changed/sanitized the envelope, persist the normalized envelope once so the same stale content is not migrated and re-logged on every Continue check.

### A57.3 Continue inspection

Main-menu save inspection returns one of four explicit states:

- `empty`: no stored run;
- `valid`: envelope migrated/validated and has payload;
- `malformed_json`: storage exists but JSON cannot parse;
- `invalid_envelope`: JSON parses but does not produce a valid migrated payload.

Continue is only actionable for a valid hydrated run. A corrupt save must not make boot fail or silently start a new run in place of the user's data.

Corrupt-save recovery is an explicit destructive action:

- show a recovery control only when corruption was detected;
- ask for confirmation when a browser confirmation surface is available;
- on confirm, clear **run progress only**;
- refresh Continue availability and status afterward.

### A57.4 Export and import

Default progress export filename is:

`forest-throne-progress.json`.

Export serializes the same canonical envelope schema used by persistence.

Import from text/file:

- requires JSON text that parses to an object;
- routes through the same migration/validation path as local Continue;
- returns the migrated canonical payload or null on failure;
- supports `persist=false` for validation/preview/host-controlled restore;
- when `persist=true`, stores the migrated envelope and restores supplied achievement/collection profiles if present.

Restoring an imported/saved run uses the same canonical hydration and routing process as Continue. Any limited in-place restore fallback must validate the complete player shape first and cannot bypass canonical normalization.

### A57.5 Clear scopes are intentionally different

There are three different destructive operations:

1. `clearRunProgress`: removes only `forest_throne_progress_v1`.
2. `clearProgress`: removes run progress **and** clears Endless achievement profile plus collection profile.
3. `clearAllLocalStorage`: clears all origin-local storage.

Do not collapse these into one “reset” button. UI wording and confirmation must match the actual scope.

The Settings data tab exposes callbacks for:

- Export JSON;
- Import JSON;
- Clear Run;
- Exit to Main Menu.

A Settings surface that is not given one of those callbacks does not invent the operation itself.

### A57.6 Co-op save store

Co-op slots are independently stored under:

`forest_throne_coop_save_slots_v1`

with store schema version **1**.

Selectable ids are:

- `NEW` — start a new session;
- `AUTO`;
- `SAVE_1`;
- `SAVE_2`;
- `SAVE_3`.

The four real persisted slots are `AUTO/SAVE_1/SAVE_2/SAVE_3`. `NEW` is a selection command, not a storage slot.

Each valid saved entry contains:

`slotId, savedAt, envelope`

and resolves this summary:

`slotId, savedAt, round, hearts, aiMode, selectedMode, playerCapacity, localSlot`.

Summary rules:

- round is at least 1;
- hearts are a non-negative integer from resolved local player's HP;
- selected mode falls back to `EndlessPvEClassic`;
- capacity derives from normalized co-op AI mode;
- malformed slot entries normalize to null instead of poisoning the whole store.

Saving a co-op slot first hydrates the supplied run, requires a multiplayer `players` state, serializes canonical run state, wraps it with the normal progress envelope and writes the slot store.

Selection behavior:

- selecting `NEW` -> active save slot `AUTO`, mode `new`, no resume state/summary;
- selecting a real slot with a valid entry -> mode `resume` and expose payload/summary;
- selecting a real but empty/invalid slot -> mode `new` while keeping that real slot as the active save destination.

Host remapping of resumed co-op state:

- normalize AI mode, legal slot set and capacity;
- desired local/host slot must exist in the mode's slot set or fall back safely;
- in a two-player save, when local host identity moves to the other slot, swap/remap player payload ownership so the saved local player's state follows the new desired local slot;
- update `localSlot`, `hostSlot`, optional room code and player capacity;
- serialize again after remap.

Acceptance checks:

- malformed JSON never throws through boot;
- version-1 run migrates through all ordered steps to v4;
- importing with `persist=false` does not write storage;
- Clear Run leaves achievements/collection/settings intact;
- full progress clear removes achievement/collection profiles as specified;
- selecting an empty `SAVE_2` starts new play targeting `SAVE_2`, not AUTO;
- a two-player resumed host-slot swap preserves player-owned board/bench state under the new local slot.


## A58. Responsive layout and render-device contract

Responsive behavior is computed from real viewport/device evidence and is shared across render hosts. Never detect mobile solely from one user-agent string.

### A58.1 Viewport resolution order

Viewport dimensions resolve in this order:

1. real canvas `getBoundingClientRect()`, when positive;
2. `window.visualViewport`, when positive;
3. scene scale width/height;
4. fallback **1600×900**.

Returned width/height are rounded integers and at least 1.

Touch/device evidence combines:

- `navigator.maxTouchPoints`;
- `(pointer: coarse)` / `(any-pointer: coarse)`;
- `(hover: none)` / `(any-hover: none)`;
- touch-event availability;
- UA hints/mobile/tablet detection.

### A58.2 Handheld/tablet/profile rules

Derived device rules:

- handheld-by-viewport when touch device, short side <= **540**, long side <= **1280**;
- portrait touch handheld when portrait and width <= **820**;
- tablet-by-viewport when touch/coarse/tablet evidence, not handheld, short side <= **900**, long side <= **1400**.

Viewport profile:

- `mobile` if width <= **600**;
- `mobile` for handheld portrait;
- `mobile` for touch portrait width <= **820**;
- `narrow` if width <= **960** or height <= **500**;
- `narrow` for handheld/tablet;
- `narrow` for touch width <= **1180**;
- otherwise `desktop`.

### A58.3 Canonical scale tokens

Desktop:

- text 1.00;
- control 1.00;
- spacing 1.00;
- tooltip padding 1.00;
- minimum touch target **40 px**.

Narrow:

- text **1.20** with touch boost, otherwise **1.15**;
- control **1.14** with touch boost, otherwise **1.10**;
- spacing **1.12** with touch boost, otherwise **1.10**;
- tooltip padding **1.14** with touch boost, otherwise **1.10**;
- minimum touch target **46 px** with touch boost, otherwise **44 px**.

Mobile:

- text **1.34** handheld, otherwise **1.28**;
- control **1.22** handheld, otherwise **1.18**;
- spacing **1.20** handheld, otherwise **1.18**;
- tooltip padding **1.22** handheld, otherwise **1.18**;
- minimum touch target **50 px** handheld, otherwise **48 px**.

Font growth is dampened for already-large typography:

- <=14 px: apply full text-scale factor;
- 15..20 px: apply 72% of the extra scale above 1;
- >20 px: apply 45% of the extra scale above 1.

Minimum font sizes by profile:

| role | desktop | narrow | mobile |
|---|---:|---:|---:|
| title | 18 | 20 | 22 |
| body | 12 | 13 | 14 |
| label | 11 | 12 | 13 |
| button | 14 | 15 | 16 |
| caption | 10 | 11 | 12 |
| tooltip title | 14 | 16 | 18 |
| tooltip body | 12 | 13 | 15 |

Pinned tooltip behavior is used for every non-desktop profile.

### A58.4 Safe areas

Critical HUD regions must respect the device safe area on every side. Safe-area padding belongs to the owning HUD/container so orientation changes cannot double-apply inset compensation or push child controls independently.

### A58.5 Render resolution

Logical base game size is **1600×900** with EXPAND scaling and centered presentation.

Presentation quality baseline:

- keep 3D edges readable with anti-aliasing where the device can afford it;
- preserve smooth sub-pixel movement instead of forcing all world motion to integer pixels;
- the world is stylized voxel/low-poly 3D rather than a pixel-art framebuffer;
- prefer high-performance rendering while respecting user quality/battery settings;
- shadows are enabled by default unless quality/battery settings reduce them;
- tab visibility changes may reduce presentation work but never suspend or corrupt canonical simulation state.

Device-pixel-ratio normalization:

- invalid/non-positive DPR -> 1;
- mobile-like viewport if shortest edge <= **900** or mobile UA;
- mobile-like max DPR **2**;
- desktop max DPR **5**;
- effective DPR never below 1 before user render-scale multiplication.

Settings render scale is a separate multiplier from device DPR. Do not bake render scale into responsive layout pixels or make UI coordinates depend on framebuffer resolution.

Acceptance checks:

- a 390×844 touch viewport resolves mobile with >=50 px target when recognized handheld;
- 800×450 desktop-like viewport resolves narrow;
- 1600×900 desktop resolves desktop;
- DPR 3 on mobile-like viewport resolves to 2; DPR 3 on desktop remains 3; DPR 8 desktop clamps to 5;
- HUD safe-area padding survives orientation changes without double application;
- the game fills the intended mobile viewport without a lower dark gap.


## A59. Shared stat/range formatting — one display truth for cards, tooltip and Library

Unit stat text must be generated by shared formatters so Planning, hover tooltip and Library do not present contradictory values.

Range classification:

- normalize finite numeric input;
- invalid input defaults to 1;
- range >= **2** is localized “ranged”;
- range <2 is localized “melee”.

The standard stat-detail block presents, where applicable:

- tier;
- tribe/element label;
- role/class;
- HP;
- ATK;
- DEF;
- MATK;
- MDEF;
- basic-attack total damage;
- attack range;
- accuracy;
- evasion;
- crit rate;
- crit damage;
- max rage/cast cost;
- variant-trait summary.

For star-dependent numeric fields, always show the three milestones **1★ / 2★ / 3★** and mark the currently inspected star through the shared inline-highlight markup. Do not recompute current-star-only text in one surface while another surface uses the full milestone model.

Base displayed stats come from canonical star scaling. Basic attack damage prefers authored attack stat rows (`damage`, then `firstHitDamage`); if those are absent, MAGE/SUPPORT use scaled MATK and other classes use scaled ATK as the display fallback.

Attack range prefers authored attack range stat rows; absent that, use catalog base range for all star milestones.

Rage display resolves each star's skill cost first, then current supplied skill cost, then catalog rageMax/explicit override. Only show the rage line when at least one milestone cost is positive.

Evasion display:

- always show base class evasion;
- when an owned unit has materially different effective evasion (>0.001 difference), display `base -> effective`;
- do not hide variant/synergy-derived effective change by printing catalog base only.

Shared display baselines are explicit so Planning, Combat tooltip and Library cannot drift. Base class evasion is TANKER 5%, FIGHTER 8%, ASSASSIN 15%, ARCHER 10%, MAGE 5%, SUPPORT 7%, with 5% fallback. Base crit fallback is TANKER 5%, FIGHTER 5%, ASSASSIN 25%, ARCHER 20%, MAGE 10%, SUPPORT 5%, with 5% fallback. If a unit authors its own crit rate, that authored value wins over the class fallback.

The detail/readout accuracy value is also deterministic: TANKER 90, FIGHTER 105, ASSASSIN 115, ARCHER 105, MAGE 100, SUPPORT 95, fallback 95, then add `2 × (tier - 1)`. This is a shared presentation readout used to keep detail surfaces consistent. It must never silently overwrite a unit's canonical authored/actual combat accuracy when the combat model already carries one.

Variant display:

- show trait count;
- aggregate total bonuses;
- optionally show each trait's localized name plus formatted bonus;
- percentage bonus fields render as rounded percentage;
- flat DEF/MDEF/shield/rage remain flat values.

Synergy bonus summary supports at least:

`defFlat, mdefFlat, atkPct, matkPct, hpPct, healPct, shieldStart, burnOnHit, critPct, startingRage, poisonOnHit, evadePct`.


## A60. Menu availability, modal ownership, debug logging and destructive-action clarity

### A60.1 Current menu availability gate

The game defines several complete mode contracts, but the normal production New Game flow currently enables only `EndlessPvEClassic`. Fortress, co-op and PvP Fortress rules remain part of the product contract and their dedicated routes must remain valid when a higher-level availability configuration explicitly enables them. Generic PvP remains unavailable as defined in A8.4.

The mode picker lists registered modes, but under the current production gate only `EndlessPvEClassic` is enabled; every other listed mode is visibly disabled and identified as in development/temporarily unavailable. The player can still inspect the mode name, but cannot select it or launch a run from it. A stale, missing or invalid selected id normalizes to `EndlessPvEClassic` before run creation. Directly invoking New Game with a locked id must follow the same gate and must never bypass it. The menu communicates that Endless Classic is currently the only playable mode.

Mode availability is separate from mode implementation: keep each documented mode's state, data, result rules and conditional route behavior so enabling it later does not require inventing a second contract. Do not describe a gated mode as currently playable just because its flow is specified.

### A60.2 New-game route

The route vocabulary includes:

- `solo`;
- `coop_lobby`;
- `fortress_map`.

Co-op AI modes route through the co-op lobby. The selected game mode determines whether the next route is Planning, Fortress Map or another documented mode entry.

### A60.3 Modal coordinator

Modal coordination is scene scoped and **exclusive by default**.

Activating a modal:

- requires non-empty id;
- closes every active sibling unless explicitly preserved by `keep` or `keepOthers`;
- removes sibling registration before invoking its close callback to prevent recursive self-close behavior;
- catches/logs one sibling close failure and continues closing the remaining siblings;
- registers the newly active modal and emits a new snapshot.

`close(id)` removes registry state, emits snapshot, then calls the modal's real close callback.

`closeAll` supports an explicit keep set.

`reset()` is final-teardown registry cleanup and does **not** invoke close callbacks; use it only after views are already disposed.

This contract is why opening Settings/Library/Tech/etc. must hide or disable unrelated underlying interactions.

### A60.4 Debug behavior

Debug preference key:

`forest-throne.debug-enabled`.

Persisted values are exactly:

- `"1"` = enabled;
- `"0"` = disabled.

Missing/unreadable storage defaults disabled. Storage exceptions never break boot.

When debug is disabled:

- suppress `debug`, `verbose`, `info`, ordinary `log`;
- retain `notice`, `warn`, `error`.

When enabled, all levels pass.

`notice` maps to info/log sink but remains semantically always visible. Toggling writes preference; reload rereads storage.

Developer logs must not become player UI unless intentionally surfaced by a debug/log modal.

### A60.5 Destructive action wording

Do not use one ambiguous “Delete data” action for all scopes. Run-only clear, progression-profile clear and full local-storage clear are distinct A57 operations.

A corrupt save recovery clears only the broken run after confirmation. It must not erase settings, achievements, unlocked skins, mod profile or unrelated origin storage.


## A61. Emoji/icon authority and fallback behavior

The icon system is semantic and presentation-neutral. It does not require a bundled PNG/SVG emoji atlas.

Primary rules:

- semantic icon names map to canonical Unicode characters and optional emoji-api slugs;
- Unicode glyph aliases normalize to the same semantic icon name;
- blank input normalizes to `empty`;
- an unknown short/extended-pictographic value may be rendered directly;
- an unknown non-emoji text token falls back to `❔`;
- API credential comes only from `VITE_EMOJI_API_KEY`; never commit it.

emoji-api.com is metadata/character authority:

- base URL `https://emoji-api.com`;
- if remote emoji art is unavailable or unconfigured, Unicode fallback remains usable;
- successful/failed lookups are cached by normalized semantic icon name;
- lookup failure logs a warning and stores a null cache result so repeated rendering does not hammer the API;
- API response may update the displayed canonical character in-place, but UI correctness cannot depend on the network request.

Icon presentation:

- preserves the semantic icon identity separately from its displayed glyph;
- when paired with a real text label, the icon is decorative for accessibility rather than duplicate spoken content;
- shows the Unicode fallback immediately;
- may asynchronously improve metadata/appearance only while the owning control is still active;
- refreshing a label replaces stale icon/text content as one unit.

Canvas draw uses the shared resolved character and color-emoji font stack. It does not fetch an image synchronously.

When 3D/world-space emoji textures are needed:

- canonical canvas backing size **96×96**;
- rendered emoji font size **72 px**;
- texture key is `emoji_<codepoints>` with variation selectors removed;
- use SRGB color space and linear min/mag filters;
- cache textures by semantic resolved codepoint key;
- headless/no-document path creates a safe empty texture rather than crashing;
- `queueEmojiAssets` creates/adds missing textures for the unique game emoji set and marks preload ready;
- creating a sprite owns its material but reuses the shared cached texture;
- replacing/updating emoji swaps to cached texture without creating a logical gameplay object;
- disposing the atlas disposes all cached textures, clears the cache and resets readiness.

If SVG emoji art is used, each icon is treated as an individual **72×72** logical frame. For a requested display size, sanitize non-finite/non-positive values back to **72**, then use `displayScale = safeDisplaySize / 72`; do not reinterpret these independent SVG files as cells in a spritesheet grid. The product does not require a bundled emoji atlas; Unicode/semantic fallback remains valid when remote or optional art is unavailable.

Acceptance checks:

- app renders semantic icons with no API key/network;
- API failure does not change layout or break input;
- same emoji reuses one cached Three texture;
- variation-selector aliases resolve to the same texture key;
- disposing/recreating the atlas yields a clean new cache.


## A62. Fresh-run defaults and exact loss semantics

A brand-new normal solo run begins from a deterministic empty state. The important defaults are:

- AI mode starts at `TUTORIAL` unless the selected mode supplies another supported mode;
- audio starts enabled;
- player HP/lives = **3**;
- gold = **10**;
- XP = **0**;
- level = **1**;
- round = **1**;
- game mode defaults to Endless PvE Classic before route-specific mode assignment;
- win streak = **0** and loss streak = **0**;
- shop starts unlocked with **5** offer slots;
- augments, items, crafted history, enemy preview, Creative sandbox units and tech levels start empty;
- all additive economy/combat/progression bonuses begin at zero;
- speed level = **0**;
- craft table level = **0**;
- the local allied board is an empty **5×5** grid;
- bench and shop contents start empty;
- tutorial state starts incomplete with no prepared rounds/events/markers;
- Fortress metadata begins at act 1, step 0 with no selected/pending node.

There are two canonical defeat policies:

1. `NO_HEARTS`: losing a combat applies the mode's resolved damage to HP. The run ends only when HP reaches 0. If HP stays above 0, the round advances normally.
2. `NO_UNITS`: losing a combat is immediate game over regardless of remaining HP and the round does not advance.

A draw resets both streaks and does not itself trigger either defeat rule. Creative mode may explicitly ignore defeat.

Unknown or malformed saved loss-condition values normalize to the safe default `NO_UNITS`, but authored game modes override the player setting with their own configured loss condition when a run is created/resumed. Current published Endless Classic, Endless Fortress and PvP Fortress use the HP-based rule.

Hydration must never manufacture impossible progression. Player level is normalized to **1..25**; craft table to **0..3**; speed to **0..10**; star to **1..3**; shop slot count to **5..20** while preserving legal saved offers. All four legal bench-upgrade purchases must survive save/load. Any imported value that incorrectly truncates this progression to one level is normalized to the canonical four-stage contract.

## A63. Board ownership, co-op composition and capacity rules

The battlefield uses one coordinate truth:

- each player owns a local **5-row × 5-column** allied board;
- enemies use another 5 logical columns;
- one presentation-only river/gap column sits between the two logical halves;
- solo therefore renders an **11×5** visual battlefield while only 10 columns are logical unit coordinates.

Co-op expands vertically instead of changing each player's local board shape:

- 2-player profile = **10** rows: P1 rows 0..4, P2 rows 5..9;
- 4-player profile = **20** rows: P1 0..4, P2 5..9, P3 10..14, P4 15..19;
- each player's saved board remains a local 5×5 board;
- composing the shared allied battlefield maps each local row into that player's five-row span;
- converting a shared visual row back to local coordinates returns null when the row is outside that player's ownership span.

Planning ownership is strict. A local player may inspect remote allied rows, but mutation functions must reject attempts to move, replace, sell or otherwise mutate a remote player's unit unless a mode explicitly grants shared control. PvP is not mistaken for co-op merely because multiple players exist.

The active local slot is taken from the current session when available and otherwise defaults safely to P1. An invalid local slot falls back to a slot actually allowed by the selected 2P/4P mode.

Bench capacity is a compact-list capacity, not a sparse-array size:

`benchCap = clamp(8 + benchUpgradeLevel × 6 + benchBonus, 1, 44)`

Creative reserves one outer-ring position for its selector, so its ordinary unit bench capacity is one less than the resolved cap. The dedicated bench-expansion action resolves the next incomplete unlocked stage in this order: exploration unlock → bench upgrade chain → barracks expansion. If the next stage's prerequisite is locked, the purchase fails without spending gold.

Inventory base capacity during Planning equals the current number of owned units on **board + bench**. This means buying/deploying/selling units can change available inventory capacity. Existing over-cap items must remain visible and retrievable; capacity rules may prevent new insertion but must never visually delete already-owned items.

## A64. Route, loading and screen-lifecycle behavior

Starting a new run is a state transition, not merely a screen change:

1. resolve the selected game mode and effective AI mode;
2. resolve route type: solo Planning, co-op lobby or Fortress map;
3. create the correct canonical solo/co-op run state;
4. clear the previous run-progress slot for a true New Game;
5. persist the new canonical state immediately;
6. enter the resolved route.

Continue first hydrates and validates the saved run. Invalid state returns to the menu/recovery flow instead of starting a partially corrupted game. Co-op resumes through its lobby/session route so slot identity and room/session ownership can be re-established before Planning.

Only one active major scene/screen may own the game lifecycle at a time. Leaving a screen must invalidate its pending asynchronous work so a late asset load, timer, network callback or lazy import cannot suddenly replace the newer screen.

The main loading screen has these user-visible timing rules:

- show real preload progress and current asset/detail feedback;
- keep the loading presentation visible for at least **1400 ms** so it does not flash for a few frames on fast machines;
- after readiness, wait at least **120 ms** before the final transition;
- asset failure keeps the loading surface alive, shows the failure and exposes Retry;
- Retry starts a fresh preload request and an old request finishing later must be ignored;
- leaving/destroying the loading screen cancels its pending transition and minigame.

Lazy-loaded heavy screens use the same stale-request protection. One load attempt is active at a time. Success must instantiate a valid playable screen before switching. Failure must keep the current loader visible and offer both **Retry** and **Back to Main Menu**. Retrying does not duplicate the previous pending request, and a result from an abandoned request is ignored.

## A65. Gamepad/controller behavior

Controller support is a real navigation mode, not a decorative icon. Use the standard gamepad layout below as the behavioral baseline:

- D-pad buttons 12/13/14/15 or left stick axes navigate;
- left-stick dead-zone threshold is **0.55**;
- A / button 0 = confirm;
- B / button 1 = cancel;
- X / button 2 = jump focus to Shop;
- Y / button 3 = jump focus to Board;
- LB / button 4 = jump focus to Bench;
- RB / button 5 = jump focus to Shop;
- View/Back / button 8 = toggle Settings when that callback is available;
- Start / button 9 = start combat when legal.

Directional movement begins immediately after direction changes, then repeats after **170 ms** initial debounce and **120 ms** hold repeat. Initial focus is Board at the last allied row, first column; shop and bench cursors begin at index 0.

Focus regions behave spatially:

- Shop cursor moves horizontally through the visible five baseline purchase slots; down moves to Bench and up moves to Board;
- Bench cursor uses the actual current bench capacity and layout column count; moving above its first row returns to Shop;
- Board cursor clamps to the local player's five columns and owned row count; moving down from the bottom row enters Bench.

Confirm invokes the same canonical action as pointer input: buy selected shop slot, select/move bench unit, or interact with the selected board cell. Cancel first cancels an active bench/unit selection; otherwise it returns focus to Board.

When a major modal is open, board/shop/bench navigation is suspended. A or B closes the modal through the normal modal action rather than activating something behind it. Disconnecting the last controller clears the controller cursor and returns logical focus to Board. Reconnection restores controller navigation without restarting the scene.

## A66. Resolution presets and safe display changes

The display settings preserve a selectable logical-resolution concept in addition to render scale. Supported presets are:

`1280×720`, `1600×900`, `Adaptive/current viewport`, `1920×1080`, `2436×1125`, `2532×1170`, `2560×1080`, `2560×1440`, `3200×1800`, `3440×1440`, `3840×2160`, `2796×1290`.

Default resolution is **1600×900**. Adaptive resolves from the live browser visual viewport first, then normal viewport/screen information, with 1600×900 as the final fallback.

Do not hide large presets merely because the physical device screen is smaller; the browser can render a logical resolution and scale it. Cycling resolution wraps in both directions. If a saved/current key is no longer recognized, fall back to Adaptive when available, otherwise the first supported preset.

Applying a resolution change is transactional: remember the previous setting, attempt the new resolution, update settings only after success, and if application fails restore both the previous resolution and the previous setting. The player receives an explicit recovery message instead of being left with a half-applied display mode.

Default UI preferences also include Vietnamese language, GUI scale **2**, tooltip mode `summary`, subtitles enabled and volume level **5**. Tooltip modes cycle through `off → compact → summary → expanded → off`; older saves carrying only the compatibility expanded-tooltip boolean map `true` to `expanded`.

## A67. Additional presentation capabilities

Several older features are product capabilities even though their old rendering code should not be copied literally.

### A67.1 Rich shared tooltip

The game uses one tooltip behavior across units, synergies, Planning and Combat. It supports four user modes: off, compact, summary and expanded. It can show title, avatar/portrait, tier/star, role/class, faction/element, stat rows, HP/rage-style meters, real status chips, skill/description sections and highlighted current-star text. Mobile/narrow layouts may pin the tooltip instead of following hover.

A tooltip must stay inside the usable viewport, prefer the requested side when space allows, flip/reposition when it would overflow, avoid covering the source control when practical and never make the underlying control accidentally clickable through a pinned tooltip. Hover-out, source destruction, modal close and scene teardown must remove the tooltip cleanly. Optional speech uses the shared browser-speech contract and must fail silently when speech synthesis is unavailable.

### A67.2 Deterministic cosmetic theme capability

The older game carried a second cosmetic-theme concept for units in addition to creature skins. Each supported unit could resolve two deterministic themed variants generated from role/class + element/tribe identity. Themes could change accessory family, weapon archetype, aura shape, accent icon and palette while keeping the same gameplay identity.

The rebuild does not need to recreate the old humanized look literally, but it must preserve the **capability** for deterministic non-gameplay cosmetic themes per unit and per star. Cosmetic selection must never alter combat stats unless a future explicit mechanic says so.

### A67.3 Hidden generic PvP concept

The older generic PvP mode was explicitly internal/hidden and production-disabled. Preserve that fact: it is evidence of a PvP concept, not permission to expose an unfinished generic PvP button. The separately specified PvP Fortress mode follows its own current product gate and network contract.

### A67.4 Optional CSV/content ingestion

When CSV/mod/imported content is supported, parsing must handle quoted fields, commas inside quotes, doubled-quote escaping and empty fields before keyed lookup data is built. Authored text containing commas or quotes must not corrupt content import.

## A68. Enemy preview and combat-strength readout

The enemy preview shown during Planning is canonical encounter data for the current round. It is not a decorative approximation generated separately from Combat.

Preview lifecycle:

1. Resolve the current round as an integer >=1.
2. If Creative has manually placed RIGHT-side sandbox enemies, those units replace procedural preview for that round. Stored procedural preview is cleared and enemy budget becomes 0.
3. Otherwise, if a saved preview exists for the same round and regeneration is not explicitly forced, reuse it exactly. Refreshing unrelated UI must not reroll the enemy formation.
4. In co-op, the host owns encounter generation. Guests consume the host's shared preview; a guest with no shared preview must not secretly generate a different local encounter.
5. Fortress node payload may multiply encounter budget; normal nodes use 1.0, blacksmith 1.05, elite 1.25 and boss 1.6 as defined by the Fortress contract.
6. After generating a preview, persist its units, round number and budget so Planning and Combat resolve the same encounter.

Every preview unit is normalized before use:

- invalid/missing base identity -> discard the entry;
- side is always RIGHT;
- star is clamped to **1..3**;
- row is clamped to the active board-profile row range;
- column is clamped to enemy logical columns **5..9**;
- equipment keeps only string ids;
- preserve a valid explicit uid, otherwise create a stable uid from base identity + row + column + entry index.

The preview may show enemy name/identity, star, placement, role/tribe/element information and equipment when known, but must not expose transient Combat-only state such as current target, animation frame or temporary status timers.

Combat-strength readouts use one exact shared formula. For a living unit:

`power = round(HP×0.45 + Shield×0.20 + ATK×6 + MATK×6 + DEF×4 + MDEF×4 + Star×90 + Tier×40)`

Every input is treated as >=0 except Star/Tier, which default to at least 1. A dead unit contributes **0 current power**.

For relative single-unit bars, reference power is the highest compared living-unit power with minimum denominator 1; displayed ratio is `clamp(power/reference, 0, 1)`.

For team status, compute separately for LEFT and RIGHT:

- number of units belonging to that side;
- current combined HP, where dead units contribute 0;
- combined max HP;
- HP ratio = current/max, or 0 when max is 0;
- summed current combat power;
- summed maximum/reference combat power using max HP and no transient shield contribution in the default max-power calculation;
- power ratio = current/max, or 0 when max is 0.

This metric is informational. It must never secretly alter targeting, damage, matchmaking or encounter outcome.

## A69. Shop roster, recipe classification and equipment recommendations

The normal shop roster is the complete current playable unit catalog unless a mode explicitly supplies a narrower pool. Its deterministic canonical ordering is:

1. lower tier first;
2. within a tier, role order `ARCHER → ASSASSIN → FIGHTER → MAGE → SUPPORT → TANKER`;
3. ties by stable unit id/name key.

Tier-filtered shop pools preserve that ordering. Unknown/non-roster objects are rejected rather than silently becoming shop units.

Recipe Library classifies crafted equipment into `offense`, `defense` or `magic` using the item's actual bonuses. Compute three scores:

- offense = `2` when ATK% exists + `1.5` when crit% exists + `0.5` when lifesteal% exists;
- defense = `1.5` when HP% exists + `1` each for flat DEF, flat MDEF and starting shield;
- magic = `2` when MATK% exists + `0.5` when starting rage exists + `1` when heal% exists + `0.5` when burn-on-hit exists.

If magic is strictly greater than both other scores, category is magic. Otherwise if defense is strictly greater than offense, category is defense. All remaining ties/defaults are offense. Category is a browsing/filtering aid; it does not change item effects.

Unit-detail equipment recommendations rank recipes for the inspected unit rather than showing arbitrary “best items.” The default recommendation surface considers **tier-3 recipes** and returns the top **3**, with score descending and recipe name as deterministic tie-breaker.

The score must respect unit role and skill damage type:

- physical roles (Archer, Assassin, Fighter or physical-damage skill) strongly value ATK, crit, attack speed, lifesteal and armor penetration;
- Mage and Support strongly value MATK; Support additionally gives highest priority to healing, shields and rage support;
- Tanker strongly values HP, DEF, MDEF, damage reduction and block;
- keywords describing crit/lifesteal/on-hit/execute/bleed reinforce physical recommendations;
- magic/mana/rage/shield/heal and burn/poison/freeze/stun reinforce Mage/Support recommendations;
- Tanker gets extra preference for HP/shield/reflect/thorns/taunt/block/damage reduction and a penalty for excessively offensive recipes;
- mismatched ATK-heavy items are penalized for Mage/Support and MATK-heavy items are penalized for physical roles.

The exact scoring basis is part of the product contract. Treat missing/non-numeric bonus fields as zero. Let:

- `atkLike = atkPct + atkFlat + critPct + attackSpeedPct + lifestealPct + armorPenPct`;
- `matkLike = matkPct + matkFlat + spellCritPct + magicPenPct`;
- `tankLike = hpPct + hpFlat + defPct + defFlat + mdefPct + mdefFlat + damageReductionPct + blockPct`;
- `supportLike = healPct + shieldPct + healPowerPct + manaRegen + rageGainPct`.

Role classification uses both class and current resolved skill damage type. Tanker is `TANKER`; Support is `SUPPORT`; Mage is class `MAGE` **or** current skill damage type `magic`; Archer/Assassin/Fighter are their matching classes; Physical is Archer/Assassin/Fighter **or** current skill damage type `physical`.

Start the score at zero, then add these family bases:

- Physical: `atkLike × 100`;
- Mage or Support: `matkLike × 100`;
- Tanker: `tankLike × 110`;
- Support: `supportLike × 120`.

Then inspect a lower-cased text corpus built from recipe name + description + serialized bonus + serialized logic. Apply keyword adjustments exactly once per matching group:

- Archer/Assassin/Fighter: if any of `crit, lifesteal, attackspeed, onhit, execute, bleed` appears, `+18`; if any of `atk, sat thuong, damage` appears, `+10`;
- Mage/Support: if any of `matk, magic, mana, rage, shield, heal` appears, `+18`; if any of `burn, poison, freeze, stun` appears, `+8`;
- Tanker: if any of `hp, shield, reflect, thorn, taunt, block, damage reduction` appears, `+22`; if any of `lifesteal, crit, matk` appears, `-8`;
- Support: if any of `heal, cleanse, shield, team, ally, rage` appears, `+20`;
- Mage: if any of `matk, magic, burn, poison, mana, rage` appears, `+16`.

For parity with the existing recommendation behavior, apply these numeric preference multipliers after the role-family base score:

- rageGain ×10;
- rageGainPct ×100;
- heal-on-damage ×45 for physical units, ×20 otherwise;
- shield-on-cast ×50 for Tanker/Support, ×10 otherwise;
- critPct ×120 for Assassin/Archer, ×40 otherwise;
- attackSpeedPct ×120 Archer, ×90 Assassin, ×35 otherwise;
- lifestealPct ×120 Fighter/Assassin, ×20 otherwise;
- hpPct ×100 Tanker/Support, ×25 otherwise;
- defPct ×120 Tanker, ×20 otherwise;
- mdefPct ×110 Tanker/Support, ×15 otherwise;
- matkPct ×130 Mage/Support, ×10 otherwise;
- atkPct ×130 physical units, ×10 otherwise.

Finally apply mismatch adjustments: Support+Physical gets `+6`; Tanker gets `-12` when `atkLike > tankLike × 1.5`; Mage/Support gets `-10` when `atkLike > matkLike × 1.5`; Physical gets `-10` when `matkLike > atkLike × 1.5`. Non-finite scores are discarded. Filter to the requested exact recipe tier **before** scoring, sort by score descending then localized/stable recipe name ascending, and return at most `max(1, limit)`. The Planning unit-info surface requests both tier 3 and tier 4 recommendations, up to 3 recipes for each tier.

Recommendations are advisory UI. Crafting/equipping legality still follows the canonical crafting and equipment rules; a recommended item never bypasses tier, slot, uniqueness, ingredient or affordability validation.

## A70. Standard reusable skill-effect behavior

The rebuild must retain the semantic effect families that authored skills can invoke. They are resolved through canonical damage/heal/status rules so unit-specific skills do not each reinvent core math.

- **Single damage:** resolve one canonical damage event against the selected target.
- **Global damage:** resolve the same authored raw-skill damage independently against every enemy; each target gets its own mitigation/status/death handling.
- **Single heal:** among living allies below max HP, choose the ally with the lowest `currentHP/maxHP` ratio, then heal `floor(rawSkill)` through canonical healing rules. If no ally is injured, there is no fake heal target.
- **Global heal:** heal every living ally by `floor(rawSkill)` through canonical healing rules.
- **Single stun attack:** deal the normal damage first; only if the target survives, roll stun chance. Effective chance is `min(1, authoredStunChance × starChanceMultiplier)`. Successful stun keeps the larger of existing stun duration and the new authored duration; default authored chance/duration are 100% and 1 turn when omitted.
- **Team DEF buff:** every living ally receives/refreshes a defense buff. Default duration is 3 turns and default value is +15; stacking uses the stronger existing/new value and longer existing/new duration rather than accidentally weakening an active buff.

Generic `slow` is intentionally inert. Do not add a hidden speed/turn-order slow merely because compatibility content still contains that effect name; the evasion/status model is canonical.

## A71. Music continuity across scene changes and reloads

Music remains context-aware as defined in A45 and also remembers listening position/order where supported. This continuity is audio preference/session state only; it is never run progression.

For a single background track, remember its last non-negative seek position when playback is intentionally stopped or the owning context is disposed. When the same track is started again, resume from that seek when the browser/audio implementation supports seeking. Invalid, missing or non-positive seek values mean start from 0.

For a named playlist, persist enough data to continue without unexpectedly reshuffling the player's current listening session:

- playlist identity/signature;
- normalized playlist order;
- current index;
- current track identity;
- current seek position.

When restoring a playlist after its authored track list has changed:

1. remove saved entries that are no longer valid;
2. deduplicate the remaining saved order;
3. append newly valid tracks that were absent from the saved order;
4. if the stored current track still exists, make its actual restored position authoritative over a stale numeric index;
5. clamp the index to the restored order;
6. if no valid order remains, create a fresh order according to the current playlist's shuffle policy.

The continuity layer must coexist with the newer music director rules: scene/context choice still decides **what should be playing now**, shuffle still avoids immediate repetition where possible, crossfade still owns transitions, and autoplay recovery still resumes the currently desired context rather than reviving an old stored context. Corrupt/unavailable storage is a silent fallback to fresh playback and must never block boot or scene routing.

## A72. Player-facing Vietnamese clarity rules

Vietnamese gameplay text should read like a finished Vietnamese game, not like untranslated developer jargon. Authored copy is canonical; normalization is only a safety net for compatibility/generated text.

Player-facing Vietnamese must avoid raw English jargon when a clear in-game Vietnamese phrase exists. Use these meanings consistently:

- `frontline` → **tuyến trước**;
- `backline` → **tuyến sau**;
- `carry` → **mục tiêu chủ lực**;
- `debuff` → **hiệu ứng bất lợi**;
- `support` → **hỗ trợ**;
- `tanker` → **đỡ đòn**;
- `ranged` → **đánh xa**;
- `caster` → **pháp sư**;
- `execute` → **kết liễu**;
- `fallback` → **phương án dự phòng**;
- `punish` → **trừng phạt**;
- `heal` → **hồi máu**;
- `bruiser` → **đấu sĩ**.

Generic `buff` wording should become a concrete phrase such as **tăng sức mạnh**, **tăng ATK**, **tăng DEF**, **tăng MDEF**, **hồi máu**, **tạo khiên**, etc. whenever the actual effect is known. Do not hide a mechanic behind the word “buff.”

Older copy that says things like “hồi cũ”, “trước đây” or “giống bản cũ” must be rewritten as present-tense product behavior; the player should never see migration/history commentary inside a skill description.

Targeting prose should be explicit. Examples: “carry tuyến sau” becomes “mục tiêu ở cột cuối cùng phía địch có sức tấn công cao nhất”; “frontliner nhiều máu nhất” becomes “mục tiêu ở cột đầu tiên phía địch có máu cao nhất”; “backliner kháng phép thấp nhất” becomes “mục tiêu ở cột cuối cùng phía địch có kháng phép thấp nhất.”

Any current-star highlight marker used internally by tooltip text must be removed from plain-copy/export/speech output and rendered only as visual emphasis. Markup tokens themselves must never be visible to the player.

## A73. Status effects — exact lifecycle, stacking and expiry behavior

Statuses are gameplay state, not decorative labels. Applying, ticking, consuming and expiring them must produce the same result regardless of which screen is showing combat. A status badge may disappear only when its canonical duration/effect has actually ended.

The control family includes freeze, stun, sleep and silence. Applying one of these stores at least the requested duration; reapplying it cannot shorten an existing longer duration. Each canonical status tick removes one turn. Silence blocks skill casting while it remains active. Disarm blocks normal basic attacks while active. Immunity is a timed state and is consumed only by the canonical status-resolution rules, never by presentation code.

Damage-over-time families are distinct:

- **Burn** stores remaining turns and per-tick damage. Reapplication keeps the longer duration and the stronger burn value. If fire vulnerability is active, each burn tick multiplies its stored damage by the active fire-vulnerability multiplier before rounding. When burn expires, stored burn damage is cleared.
- **Poison, bleed and disease** each keep their own turns and per-tick damage. Their tick applies the stored damage, removes one turn and clears the stored damage value when the final turn expires.
- **Fire vulnerability** has its own duration and multiplier; expiry restores the multiplier to neutral `1`.

Healing/shield denial also has explicit duration state. **Heal block** prevents healing under the owning heal resolver and may remember the unit that created it. If a heal block has no source id, it remains active until its duration ends. If it has a source id, it remains active only while that source unit is still alive; when the source can no longer be found alive, clear both the remaining heal-block turns and source id before resolving the attempted heal. **Heal reduction** stores a percentage reduction and clears it at expiry. **Shield lock** prevents new shield grants while active and clears its source on expiry. A blocked shield attempt gives no shield. A legal shield grant adds to the existing shield and resolves to at least 1 shield point after normalization. Incoming resolved damage consumes shield before HP by `absorbed = min(currentShield, incomingDamage)`; only the remainder reaches HP.

Stat statuses preserve their own durations and values. Armor break, ATK/MATK buffs, the canonical offense debuff, DEF/MDEF buffs, evasion buff and evasion debuff must clear their associated numeric value when their duration ends. The canonical offense debuff must never be silently collapsed into an ATK-only debuff: automatic mode targets MATK on MAGE/SUPPORT and ATK on other roles. Reapplying a canonical offense debuff keeps the longer duration and stronger value. Older ATK-only state may be read for compatibility, but all new behavior must resolve through the same canonical rule.

Evasion buffs may carry three independent rewards for a successful dodge: flat healing, flat shield and rage. These rewards exist only while the evasion buff is active and are cleared when that buff expires. Accuracy/evasion outcome is resolved first; only a real dodge can trigger the reward package.

Defensive/reaction statuses have concrete combat meaning:

- **Reflect** returns `round(damageThatPassedResolution × reflectPct)` as true damage, minimum 1, and the reflected hit cannot recursively reflect again.
- **Physical reflect** triggers only against physical damage. If no authored percentage is present, its reflection percentage defaults to 100%. It also cannot recursively reflect. Its expiry clears any offense-debuff-on-reflect payload attached to it.
- **Counter** permits a counterattack only against an attacker with effective range `<= 1`, while both units are still alive.
- **Protecting** marks a living allied protector. For splash-protection selection, a protector qualifies when it is within one row and one column of the defended unit; the defender itself cannot be selected as its own protector. When a splash hit is protected, the original defender does not also receive that splash hit: the protector receives a forced-hit follow-up equal to 75% of the original raw splash damage, and protection cannot recursively trigger another protection redirect for that same redirected hit.
- **Guardian redirect** may move part of an incoming hit to a linked guardian. Redirect percentage is clamped to `0..95%`; redirected damage is rounded and the defended unit receives the remainder. A redirect charge is consumed when the redirect is used. When the final charge is consumed, guardian duration, link id, absorb amount and attached counter-debuff payload are cleared together.
- **Generic damage reduction**, **magic-only reduction** and **fortify reduction** are separate timed multipliers. Each active reduction clamps its percentage to at most 95%, applies sequentially in canonical order and keeps a damage-dealing hit at a minimum of 1 after that reduction stage. Magic-only reduction applies only to magic damage.

Several named compound statuses must remain functional because unit skills depend on their expiry/kill behavior:

- **Berserk** may carry lifesteal, a first-basic multiplier, rage gained on kill, turns extended on kill and a chained-basic count. On a basic-attack kill, the authored rage bonus is capped by rage maximum, the authored duration extension also keeps the related ATK-buff duration alive, and a chained basic chooses the nearest living enemy by Manhattan distance. Expiry clears all berserk-specific payload values.
- **Blood Hunt** stores duration, stack count and optional anti-heal state; all payloads clear at expiry.
- **Soul Link** stores link source, duration, heal multiplier, shield percentage, cleanse count and rage gain; all link payloads clear together when the duration ends. When a unit is about to receive healing and one or more living linked recipients point to that unit as their link source, first calculate how much healing the source unit could actually receive after caster heal bonus, heal-received bonus and heal reduction. The linked branch then distributes that *actual possible heal amount* to the linked recipients using each recipient's authored link-heal multiplier instead of healing the source normally. Order linked recipients by `(rageGain + cleanseCount)` descending, then by heal multiplier descending. If the source was above 50% HP before the heal, every linked recipient with a positive shield percentage also gains `round(recipientMaxHP × shieldPct)` shield, minimum 1; additionally only the first/highest-priority linked recipient may consume its authored cleanse count and rage gain. Cleanse walks the canonical debuff list in stable order and stops after the authored count. The linked heal must set a recursion guard so recipients do not recursively redistribute the same heal again.
- **Pangolin Shield** has an expiry check. If its shield is still above zero when the status expires, it may heal by a percentage of max HP, grant authored damage reduction for authored turns and cleanse the authored number of debuffs. If the shield has already been broken, those shield-survival rewards do not trigger.
- **Resilient Shield** likewise checks whether shield remains when the status expires. A surviving shield can trigger a max-HP percentage heal. Its authored follow-up heal-over-time is installed at expiry using the stronger/longer values rather than shortening an existing heal-over-time effect.

Status expiry must clean up stale payload values. A zero-turn status must not leave an invisible modifier active after its icon is gone.

## A74. Damage aftermath — rage, on-hit effects, revive, low-HP and auto-cast order

After resolved damage is known, the aftermath phase executes deterministic secondary behavior. This phase must not be replaced with ad-hoc visual callbacks.

Unless the action explicitly suppresses rage, the defender gains 1 rage through the standard hit aftermath path, capped by its rage maximum. A missed normal physical attack also gives the defender this +1 rage unless rage gain was explicitly suppressed; dodge-specific rage reward is added separately on top. The attacker gains its resolved rage amount only when positive HP damage actually got through and the owning rule allows attacker rage; skill damage does not receive the normal attacker basic-hit rage gain. For the local/player side the basic gain starts from 1; for AI it starts from that difficulty's authored rage-gain value. Apply attacker's normal plus environment rage-gain percentages, then round once. All rage changes clamp to the unit's own rage maximum; do not assume every unit uses the same maximum.

Normal physical basic attacks may miss. Skills and forced-hit effects bypass that ordinary miss roll under the canonical rules. On a real miss, damage and shield absorption are both zero, the defender may receive active evade heal/shield/rage rewards, the normal defender +1 rage still applies unless suppressed, TANKER full-rage auto-cast may still be scheduled, and the combat event is recorded as a miss rather than a zero-damage hit.

On-hit burn and poison supplied by the attacker or battlefield environment are additive at the source level. A successful application gives the target at least 2 turns and preserves the stronger already-present per-tick value if it is higher. Lifesteal percentage combines the attacker's normal modifier, environment modifier and active berserk lifesteal. The resulting heal is based on resolved damage that actually remains after protection, rounded once, then passed through the canonical heal resolver.

Reaction order must preserve the following semantics:

1. resolve normal aftermath rage/auto-cast eligibility;
2. attach authored burn/poison on-hit state to a surviving target;
3. resolve reflect/physical-reflect without recursive reflection;
4. apply any reflect-triggered offense debuff to the living attacker;
5. resolve legal close-range counterattack hooks;
6. resolve lifesteal from the finalized damage amount;
7. resolve revive/death/low-HP state;
8. resolve berserk on-kill extension/rage/chained basic;
9. synchronize the resulting state before the next actor proceeds.

Phoenix-style revive is once per unit. If lethal damage reaches a unit with an unused revive, it returns alive at `round(maxHP × revivePct)`, minimum 1 HP. Default revive percentage is 30% when no authored value is provided and the accepted authored range is clamped to 1%..100%. Revive consumes the revive flag, marks it used and resets shield to zero. Only a later lethal event may perform normal death.

The low-HP presentation threshold is `HP <= 30% of max HP` for a still-living unit. Crossing that threshold may start low-HP presentation, but presentation cannot alter HP or alive state.

TANKER and SUPPORT immediate casts are real action rules. An auto-cast is legal only when the unit is alive, belongs to the matching role, is not silenced, has finite current/max rage, current rage is at least max rage, has a valid skill and is not already inside the same auto-cast. The condition must be checked again when the deferred cast actually begins because the unit may have died, been silenced or lost rage in the meantime. On a legal auto-cast, rage is set to zero before skill execution. TANKER prefers the attacker/current valid target when available; SUPPORT may fall back to itself when its normal target selector finds no target.

Tier-based incidental stun remains available to combat effects that use it: tier 4 has a 20% stun chance, tier 5+ has a 30% stun chance, and lower tiers contribute no tier-based stun chance.

## A75. Planning board and bench mutations — exact legal moves and rollback behavior

Planning movement is transactional. A drag/drop attempt validates the complete move before mutating ownership. Any invalid move leaves the board and bench exactly as they were before the attempt.

The player's deploy board is the local 5×5 ownership area. Deploy count is the number of non-empty cells in that area. Two deployed units with the same base/species identity are not allowed simultaneously on the player's board. When checking whether a moving board unit duplicates another unit, its own source cell is ignored.

Moving a bench unit onto the board follows this order: validate bench source index, validate destination board cell, require a real source unit, reject a duplicate species already deployed, then check deploy cap when the destination is empty. If the destination is occupied and swapping is allowed, the board target moves back into that exact bench position while the dragged bench unit takes the board cell; because unit count on the board does not increase, this swap does not consume an additional deploy slot. If swapping is disabled, an occupied destination fails with no mutation. Moving onto an empty legal cell removes that unit from the compact bench.

Moving a board unit to the bench validates the source board cell and destination bench index against current bench capacity. If the destination contains a unit and swapping is allowed, the bench unit moves onto the source board cell and the board unit takes that bench position. If the destination is empty, the operation fails when the compact bench is already at capacity; otherwise the source board cell becomes empty and the unit is inserted at the requested compact-bench position. A destination beyond the current compact length but still inside unlocked capacity appends to the bench.

Reordering the bench also preserves compact ordering. Moving onto an occupied slot swaps when swapping is allowed. Moving onto an empty slot removes the source entry first, clamps the requested insertion index to the new compact length, then inserts there. Moving an entry onto itself is a no-op failure, not a reorder.

Bulk removal of owned units must handle both board and bench references without index-shift corruption. Board cells are cleared directly. Bench units should be removed by stable unit identity when available; index-based fallback removals are processed from highest index downward. This rule matters for merge/sell operations that remove several owned units in one transaction.

These mutation rules are the gameplay contract behind drag/drop. The redesigned UI may change gestures and animation, but it may not invent duplicate deployments, exceed deploy/bench limits, duplicate units during swaps, or partially apply a failed move.


## A76. Skill target selection, shape and star materialization

Every skill shown to the player must first be materialized for the unit's current star, then the same materialized definition must drive tooltip text, preview cells and combat. Star materialization clamps star to 1..3, merges that star's authored overrides, applies any star-specific cost, applies any star-specific power scale to the numeric effect fields it owns, canonicalizes offense debuffs, and only then derives clarity text. A preview must never describe the pre-star/base definition while combat executes the post-star definition.

Selectors are gameplay rules, not flavor text. Preserve these meanings:

| Selector | Exact meaning |
|---|---|
| `lowest_hp_pct` | living enemy with the lowest current-HP/max-HP ratio |
| `lowest_hp_pct_ally` | living ally with the lowest current-HP/max-HP ratio |
| `highest_rage` | living enemy with the highest current rage |
| `lowest_rage_ally` | living ally with the lowest current rage |
| `highest_matk` | living enemy with the highest MATK |
| `highest_atk` | living enemy with the highest ATK |
| `highest_max_hp_front` | among enemies in the first/frontmost enemy column, choose the one with the highest max HP |
| `lowest_def_front` | among enemies in the first/frontmost enemy column, choose the one with the lowest DEF |
| `lowest_mdef_backline` | among enemies in the last/backmost enemy column, choose the one with the lowest MDEF |
| `highest_atk_backline` | among enemies in the last/backmost enemy column, choose the one with the highest ATK |
| `isolated_backline` | prefer an enemy in the last/backmost enemy column that is isolated from teammates according to the authored selector |
| `backline_caster` | prefer a MAGE or SUPPORT in the last/backmost enemy column |
| `most_clustered_row` | choose the enemy row containing the most qualifying enemies |
| `most_clustered_col` | choose the enemy column containing the most qualifying enemies |
| `highest_total_atk_row` | choose the enemy row whose qualifying units have the largest summed ATK |
| `highest_total_atk_col` | choose the enemy column whose qualifying units have the largest summed ATK |
| `random` | random qualifying target; repetition is allowed only if that effect's hit model permits it |
| `random_unique` | random qualifying targets without selecting the same target twice in that selection pass |
| `same_row` | qualifying targets in the selected/acting row |
| `same_row_carry` | allies in the caster's row, prioritizing highest offensive strength/ATK as authored |
| `same_column` | qualifying targets in the selected column |
| `front_cone` | qualifying enemy cells in the authored forward cone |
| `self` | caster only |
| `frontline_default` | normal nearest/frontline enemy target |
| `backline_jump` | locked backline target used by assassin-style dive behavior |
| `primary_target` | the already resolved primary target |

When a selector needs a deterministic tie-break rather than authored randomness, use the canonical row ordering: same row first, then one row above, one row below, two above, two below; preserve stable board/scan order for remaining ties. Random selectors must use synchronized/seeded combat randomness whenever the combat needs to reproduce or synchronize.

Effect families derive their default selector only when the skill does not author a more specific one:

- `revive_or_heal`: first a fallen ally; if none exists, use the lowest-HP%-ally healing branch;
- `self_regen_team_heal`: caster first, then lowest-HP%-allies;
- `team_shield`: all allies;
- `team_rage`: lowest-rage allies;
- `row_carry_rage_buff`: same-row carry allies;
- `row_random_rage_buff`: random qualifying allies in the same row;
- `heal_over_time`, `team_evade_buff`, `mass_cleanse`, `team_rage_self_heal`, `mimic_rage_buff`: lowest-HP%-ally by default;
- `row_charge`: same row;
- `frost_storm` and `ink_blast_debuff`: same column;
- `cone_shot`, `fire_breath_cone`, `cone_smash`: forward cone;
- `global_stun`, `global_debuff_atk`, `global_fire`, `global_poison_team`, `flash_blind`: entire enemy board for the global component; an authored secondary selector may choose which victims receive the stun/debuff rider;
- `random_multi`, `arrow_rain`, `feather_bleed`: authored selector when present, otherwise random or random-unique according to the skill;
- `chain_shock`: authored target/bounce selector, otherwise highest-rage enemy;
- `single_sleep`: authored selector, otherwise highest-rage enemy;
- action pattern `SELF`: self; `ASSASSIN_BACK`: backline jump; `RANGED_STATIC`: primary locked target; otherwise frontline default.

Shape is independent from selector. The selector answers **which center/targets qualify**; shape answers **which cells/units are affected after that choice**. Preserve these shape contracts:

- row charge = the full chosen enemy row;
- frost storm / ink blast = the full chosen enemy column;
- cross-5 effects = center plus the four orthogonally adjacent cells, clipped to legal board cells;
- circular-stun and dust-sleep family = legal cells of a 3×3 square centered on the chosen cell;
- cone shot / fire breath / cone smash = the authored forward cone, described as 3–5 cells where that family uses it;
- global offensive effects = all living qualifying enemies;
- team shield = all living qualifying allies;
- random multi-hit families = selected cells/units distributed across the enemy board;
- chain shock = the selected bounce sequence, without repeating a target when uniqueness is required;
- single-target melee/ranged/assassin skills retain one canonical target even if presentation temporarily moves the caster.

Affected-count semantics must remain exact. `single_delayed_echo` is one target plus a delayed echo. `double_hit` is one target hit twice, not two independently selected targets. `plague_spread` starts from one target then spreads to adjacent targets up to its authored cap. A multi-hit skill with a bonus-target selector whose bonus does not consume a normal hit gets its normal `maxHits` plus one bonus target. `global_stun` may damage all enemies but stun only its authored maximum subset; `global_debuff_atk` and `flash_blind` likewise may apply the global base effect while their debuff rider targets only an authored subset.

Duration/rider text must match actual mechanics. `revive_or_heal` is instant and takes the revive branch only if a valid fallen ally exists. `self_regen_team_heal` resolves self and ally healing in its authored order. `team_rage` and `team_shield` are instant unless explicitly authored otherwise. `assassin_execute_rage_refund` refunds rage only when the skill actually kills. `single_delayed_echo` has an immediate hit plus a delayed echo. `double_hit` resolves two immediate hits. Heal-over-time uses the authored duration, defaulting to 3 only when no more specific value exists. Stun/sleep/freeze/disarm/burn/poison/bleed/disease/armor-break durations and chances shown in detail text must come from the star-materialized values, including conditional freeze requirements such as “only if this row/column contains at least N ranged units” and anti-shield bonus duration where authored.

If authored target/shape/count/duration text is missing or merely generic (“1 target”, “special skill pattern”), derive a concrete description from these rules as a compatibility fallback. Live content is not considered fully authored until its Vietnamese and English detail surfaces tell the player the real selector, shape, count and duration without exposing internal selector keys.

## A77. Battle-start unit materialization — exact construction and modifier order

Combat begins from fresh combat records built from persistent owned-unit state. Planning owns the unit's persistent identity, star, equipment, variant ancestry and board/bench placement. Combat owns temporary HP, shield, rage, statuses, target references, movement offsets, action trackers and one-battle reaction state. Temporary combat mutations are discarded when the battle ends unless a mechanic explicitly writes a persistent reward back to the run.

Materialize every battle unit exactly once per combat formation in this order:

1. Resolve the owned unit against the catalog and clamp star to at least 1. Resolve star-scaled base stats, the star-materialized skill/cost and the authored basic-attack profile before any battle modifier is applied. The unit's rage maximum is the resolved current-star skill cost when finite, otherwise the authored base rage maximum, otherwise the compatibility default of 3.
2. For RIGHT/enemy units, apply the selected AI difficulty HP/ATK/MATK multipliers first. Then apply the active mode's round-scaling function when it returns a valid positive factor. A Creative/manual sandbox enemy skips procedural round scaling. If no mode scaler is available, Endless Classic after round 30 and EASY after round 30 use `1 + (round - 30) × 0.05`. Tutorial enemies in rounds 1..8 then halve their already-resolved HP, rounded, with minimum 1 HP.
3. For LEFT/player units, apply persistent team augment/technology HP, ATK and MATK percentages and, where enabled, DEF/MDEF percentages. Initial persistent starting rage and starting shield are copied into the fresh combat record, then clamped/normalized by the owning resource rules rather than written back to Planning.
4. Initialize the complete empty modifier/status payload and canonical role/element/faction/species identity. HP begins at the resolved max HP. Alive begins true. Home position begins at the materialized battle position.
5. Apply legal equipped-item bonuses. Normalize equipment by legal current-star tier, canonical duplicate-name key and current slot cap before bonuses are read. Equipment may modify direct stats and combat modifiers. Equipment-provided `startingRage` is paid exactly once at this equipment stage, capped to **+4 for this stage** and capped again by the unit's own rage maximum; after paying it, clear that pending equipment starting-rage payload so it cannot be paid again later. Equipment shield-start remains pending for the shared opening-shield stage.
6. Apply owned variant traits in deterministic stored ancestry order. Every retained trait contributes its numeric bonus; the first retained trait may supply the display skill-variant name. Trait bonuses may affect HP, DEF/MDEF and combat modifiers such as ATK/MATK/heal/crit/evade/lifesteal, opening shield and opening rage.
7. After all units have been created, resolve the round environment once and apply that same environment identity to every combat unit. Environment modifiers augment battle state without mutating catalog or owned-unit data.
8. Build the final LEFT and RIGHT formations and then calculate class, element and faction synergies from those final deployed combat units. In cooperative play, sum every player's virtual extra-class and extra-tribe counts before calculating the allied synergy result. Apply synergy bonuses only after the final formation exists.
9. After synergy bonuses have been accumulated, pay the remaining pending opening rage once, capped to **+4 for this opening-synergy stage** and by that unit's own rage maximum, and add pending opening shield once. The temporary `mana/maxMana` compatibility aliases, where still exposed, are synchronized from canonical `rage/rageMax` only after environment and synergy opening effects are complete.
10. The resulting combat record is authoritative for the battle. Tooltip refreshes, visual refreshes, animation replay, camera changes, reconnect snapshots and status-billboard refreshes must never rerun equipment, trait, environment or synergy initialization on an already-materialized unit.

The order above matters. Moving synergy before equipment, paying opening rage twice, scaling a Creative sandbox enemy, or reapplying modifiers during presentation refresh changes combat and is a gameplay bug.

## A78. Role passives — exact execution semantics

Role passives are canonical combat rules and must be driven by the same hit/action events as ordinary damage, not by animation callbacks.

- **TANKER:** the full-rage response described in A74 is checked after the unit is attacked. A legal response consumes rage before the skill executes and uses the current attacker as the preferred target when valid.
- **SUPPORT:** only a basic attack that fills the Support's rage can trigger the immediate full-rage cast. A skill, status tick or arbitrary UI-side rage change must not impersonate that specific basic-attack trigger.
- **MAGE:** when a skill cast begins, create one cast-local set of distinct enemy identities and normally consume the caster's rage immediately. Count an enemy as hit when that skill causes either positive HP damage **or positive shield absorption** on that enemy. Multiple hits on the same enemy during one skill count once. At skill finalization, refund exactly 1 rage per distinct enemy in that set, capped by the caster's own rage maximum. This refund happens after the skill resolves; it does not make the current cast free.
- **ASSASSIN:** award bounty only when the living Assassin is the actual killer of an opposing unit. Each credited kill adds both one bounty-kill count and gold equal to star: 1★→1, 2★→2, 3★→3. The stored bounty is paid by the battle-result economy even if the round itself is not a win, while ordinary win gold still follows its own win condition.
- **FIGHTER:** missing-HP attack scaling is continuous. `missingPct = clamp((maxHP - HP) / maxHP, 0, 1)`. Effective ATK is calculated from the canonical base/buff/debuff value, then multiplied by `1 + missingPct` and rounded. At 50% missing HP the passive contributes +50% ATK; at effectively 100% missing HP it can contribute up to +100% before death resolution removes the unit from acting.
- **ARCHER:** distance is Manhattan distance `abs(attackerRow-targetRow) + abs(attackerCol-targetCol)`. For every tile, add 5 percentage points of miss chance, 5 points of crit chance and +0.05 crit-damage multiplier. Subtract the distance miss bonus from the ordinary hit chance, then clamp final hit chance to `0.10..1.00`. Add the distance crit bonus to the attacker's resolved crit chance and add the same numeric distance bonus to the crit multiplier; the normal fallback crit multiplier is 1.5 before this Archer bonus.

Role-passive preview text, combat logs and tooltips must describe these actual triggers and formulas. A passive must not appear to trigger from damage/status events that its canonical event source does not authorize.

## A79. Start-of-turn status processing, control priority and disease spread

At the start of a living unit's canonical turn, inspect control state **before decrementing it**. Control priority is `freeze → stun → sleep`; the first active control in that order becomes the turn-skip reason. Silence is timed and may block skills, but silence by itself is not a full turn skip. Non-control timed effects tick first, then the selected control timer is decremented. Therefore a unit that began the turn with one remaining freeze/stun/sleep turn still loses that turn even though the counter becomes zero during this tick.

Process timed damage/healing before the actor is allowed to choose an action. Burn, poison, bleed and disease create triggered damage events using their stored per-tick value; burn first applies active fire vulnerability. Heal-over-time creates a triggered heal and routes it through the canonical heal resolver. Timed stat/control/reaction payloads decrement once and clear their attached numeric/source fields on expiry as defined in A73. Compound defensive statuses such as Guardian, damage-reduction families, Pangolin Shield and Resilient Shield must also receive their one canonical duration tick; no timed status may become permanent merely because it was authored after the first generic tick list.

Apply each triggered DoT as **true damage with no rage gain and no reflection**. If a DoT kills the actor, finish the tick/cleanup and skip its action. If the actor survives all ordinary status triggers, apply any positive environment poison-aura amount as another true-damage event with no rage and no reflection. A death caused by the environment aura likewise prevents the action.

Disease additionally spreads when its own positive damage tick resolves. Check exactly the four orthogonal same-side neighbors `(row-1,col)`, `(row+1,col)`, `(row,col-1)`, `(row,col+1)`. Ignore missing, dead or already-diseased neighbors. Every newly infected neighbor receives disease for **2 turns** with per-tick damage equal to the spreading tick's damage. Spread does not use diagonal cells and does not jump across empty distance.

The action phase begins only after status/environment processing completes and only if the actor is alive and was not marked by the pre-tick control check. UI/VFX may animate these ticks, but their timing cannot postpone or duplicate the canonical state transition.

## A80. Equipment mutations and battle bonus application

Equipment ownership is persistent Planning state. The bag stores item ids; a unit stores an ordered equipment-id list. Before display or combat use, normalize that list by discarding non-equipment/invalid entries, rejecting items whose tier is illegal for the unit's current star, deduplicating by canonical equipment name key while preserving first occurrence, and truncating only beyond the star-aware slot cap.

Equipping one item is atomic. Validate target, equipment identity, item tier ≤ unit star, duplicate-name rule, free slot and exact bag ownership before moving anything. On success remove exactly one matching bag entry and append the item id to the normalized equipped order. Failure does not spend gold, remove an item or reorder existing equipment.

Single-item unequip is also atomic. Validate the requested equipped index, calculate `actualCost = max(0, itemUnequipCost - playerUnequipDiscount)`, check affordability using the active mode's Creative/non-Creative spending semantics, then spend once, remove only that slot and append its item id to the bag. Unequip-all uses the same formula per equipped item, sums the total first, checks affordability before mutation, then spends once, returns every item in original equipped order and clears the list. The UI's quoted cost must come from exactly these same calculations.

At battle materialization, legal equipment bonuses are applied in equipped order. Direct HP/ATK/MATK/DEF/MDEF bonuses change the fresh combat stat line; combat modifiers such as heal, lifesteal, evade, crit, burn/poison on-hit, opening shield and opening rage are accumulated on that fresh record. Equipment cannot mutate the owned catalog/base stats. Compatibility data that contains one older single-equipment record may be read once and normalized into the same deduplicated list, but it does not create an extra slot outside the current cap.

## A81. Automatic star merge — deterministic source selection, equipment ancestry and placement

Automatic merge scans all owned copies in a deterministic order: compact bench order first, then board rows from top to bottom and columns from left to right. Group copies by normalized species identity plus current star. A group below three copies is ignored; 3★ groups are never merged. For the first eligible group, consume the first three references in that stable order, perform exactly one 3→1 merge, then restart the full scan so chain merges observe the new state.

If the three consumed sources represent multiple catalog variants of the same species, choose the result's base/catalog id from the highest catalog tier among those three. Preserve variant ancestry by concatenating normalized parent trait/seed payloads in the same deterministic source order and applying the global ancestry cap. Equipment is collected in source order and in each source unit's equipment order. Ignore non-equipment ids. Deduplicate by canonical equipment-name key: the first occurrence is eligible to stay and later duplicates go to overflow. Resolve the **destination star's** slot cap; keep the first unique items up to that cap and return every duplicate/cap overflow item to the player's item bag.

The merged result prefers a board location when any consumed source occupied the board: use the first consumed board reference in stable source order. If all consumed sources came from the bench, place the result in the first available legal bench slot; if the compact representation has no explicit empty entry, append it. Removal and placement form one logical transaction: a failed result creation/placement must not silently destroy the three source copies or their equipment.

The upgraded unit gets a new instance uid but remains the same persistent species ancestry, advances exactly one star, and is immediately eligible for the next scan. This is why a purchase may cause a 1★ merge followed immediately by a 2★→3★ chain in the same transaction.

## A82. Synergy counting and opening-bonus application

Synergies are calculated from the final deployed combat formation only. For each unit, count one class, one element and one faction when that identity is valid. Bench units do not contribute. Class, element and faction bonuses may all apply to the same unit and stack through their own authored threshold tables in A9.

Virtual extra counts apply only to the allied side. For each supported family, add the entire virtual count to the **currently most numerous identity in that family**; if counts tie, preserve the stable first-encountered identity from formation order. Do not add the virtual count to every class/element. In cooperative combat, sum all players' extra-class counts together and all players' extra-tribe/element counts together before this most-numerous-identity rule is applied to the shared allied formation.

For an identity with count `N`, select the highest authored threshold whose requirement is `<= N`; lower-threshold bonuses are replaced by that identity's selected tier rather than separately summing every tier row. Apply direct flat DEF/MDEF first where present. Percentage HP raises both max HP and current HP by the same rounded added amount. Percentage ATK/MATK multiplies the already-materialized current stat and rounds. Modifier families such as heal, lifesteal, evade, crit, burn-on-hit, poison-on-hit, opening shield and opening rage add to the unit's accumulated combat modifiers.

After all class + element + faction bonuses for a unit are accumulated, pay opening rage/shield once as defined in A77. The opening-rage payout is capped to +4 for that stage and by the unit's own rage maximum; shield adds to existing opening shield. Reopening a synergy panel, refreshing HUD, inspecting a tooltip or refreshing visuals never reapplies these bonuses.

## A83. Canonical unit-by-unit gameplay manifest

This roster manifest is part of the rebuild contract, not optional flavor. Every entry below must round-trip through ownership, Planning, Shop/AI eligibility where allowed, Library, tooltip, star upgrade, Combat and visual preview. Base stats are the authored 1★ values; star stat scaling continues to use the global star formula already specified. The 1★/2★/3★ lines below are the authored skill behaviors for that exact unit and take precedence over generic role shorthand.

When a skill line contains explicit target/shape/selection/duration prose, that prose is gameplay. When an older unit has no bespoke basic-attack definition, its listed role-derived basic attack is the canonical fallback described in the Combat contract. Cosmetic names/unlocks are progression/presentation data only and never alter combat stats.

### albatross_wind — Hải Âu Gió
- **Identity:** Tier 4; Xạ thủ (ARCHER); faction Chim (AVIAN); hệ Phong (WIND); species `hai-au`.
- **Base stats 1★:** HP 327, ATK 81, DEF 16, MATK 17, MDEF 16, range 4, rageMax 4, crit 0.2, critDmg 1.5, evade 0.1, accuracy 0.95.
- **Vai trò chơi:** Rải lông vũ chảy máu lên nhiều mục tiêu, rồi khóa kẻ địch nhiều nộ nhất.
- **Đánh thường:** tầm xa/projectile, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Lông Vũ Cắt:** effect family `feather_bleed`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: 3 kẻ địch ngẫu nhiên; hình: 3 mục tiêu rời không trùng nhau; chọn: Chọn ngẫu nhiên 3 kẻ địch không trùng mục tiêu.; số lượng: 3 mục tiêu; thời lượng: chảy máu 2 lượt.
- **1★:** Phóng 3 lông vũ vào 3 kẻ địch ngẫu nhiên không trùng mục tiêu, mỗi lông vũ gây (30 + 1.1 x ATK) sát thương vật lý. Mục tiêu trúng lông vũ bị chảy máu 10 mỗi lượt trong 2 lượt.
- **2★:** Phóng 3 lông vũ vào 3 kẻ địch không trùng mục tiêu, ưu tiên mục tiêu ở cột cuối cùng phía địch có ATK cao nhất. Mỗi lông vũ gây (31 + 1.14 x ATK) sát thương vật lý. Mục tiêu trúng lông vũ bị chảy máu 12 mỗi lượt trong 2 lượt.
- **3★:** Phóng 3 lông vũ vào 3 kẻ địch không trùng mục tiêu, ưu tiên mục tiêu ở cột cuối cùng phía địch có ATK cao nhất. Mỗi lông vũ gây (32 + 1.19 x ATK) sát thương vật lý. Mục tiêu trúng lông vũ bị chảy máu 14 mỗi lượt trong 2 lượt. Sau loạt bắn, 1 lông vũ cuối cùng tự tìm kẻ địch có nộ cao nhất.
- **Skin/cosmetic đang authored:** windCantata (achievement bestRound_2): Khúc Gió → Gió Vút Cao → Bão Ca Tụng

### angel_guardian — Thiên Thần Hộ Vệ
- **Identity:** Tier 5; Hỗ trợ (SUPPORT); faction Huyền thoại (MYTHICAL); hệ Linh (SPIRIT); species `thien-than`.
- **Base stats 1★:** HP 430, ATK 36, DEF 22, MATK 94, MDEF 44, range 3, rageMax 5, crit 0.05, critDmg 1.5, evade 0.07, accuracy 0.95.
- **Vai trò chơi:** Hồi sinh đồng minh ngã xuống hoặc cứu nhóm thấp máu nhất.
- **Đánh thường:** tầm xa/projectile, magic từ MATK, 1×MATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Thiên Sứ Tái Sinh:** effect family `revive_or_heal`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: ưu tiên 1 đồng minh đã ngã xuống; nếu không có thì 3 đồng minh có % máu thấp nhất; hình: ưu tiên nhánh hồi sinh, nếu không có thì hồi máu nhóm thấp máu; chọn: Ưu tiên đồng minh đã ngã xuống. Nếu không có mục tiêu hồi sinh hợp lệ, chọn các đồng minh có % máu thấp nhất.; số lượng: hồi sinh 1 mục tiêu hoặc hồi máu 3 mục tiêu; thời lượng: tức thì; chỉ hồi sinh nếu có đồng minh đã ngã xuống.
- **1★:** Hồi sinh 1 đồng minh đã ngã xuống với 40% HP tối đa. Nếu không có đồng minh đã ngã xuống, hồi (30 + 0.4 x MATK) HP cho 3 đồng minh có % máu thấp nhất.
- **2★:** Hồi sinh 1 đồng minh đã ngã xuống với 40% HP tối đa. Nếu không có đồng minh đã ngã xuống, hồi (30 + 0.4 x MATK) HP cho 4 đồng minh có % máu thấp nhất.
- **3★:** Hồi sinh tối đa 2 đồng minh đã ngã xuống với 40% HP tối đa. Nếu không có đồng minh đã ngã xuống, hồi (30 + 0.4 x MATK) HP cho 4 đồng minh có % máu thấp nhất.
- **Skin/cosmetic đang authored:** haloVow (achievement bestRound_3): Thề Hào Quang → Phúc Lành → Thiên Sẻ Hộ

### ant_guard — Kiến Hộ Vệ
- **Identity:** Tier 1; Đỡ đòn (TANKER); faction Côn trùng (INSECT); hệ Trùng (SWARM); species `kien`.
- **Base stats 1★:** HP 413, ATK 43, DEF 45, MATK 10, MDEF 30, range 1, rageMax 4, crit 0.05, critDmg 1.5, evade 0.05, accuracy 0.95.
- **Vai trò chơi:** Giữ cùng hàng bằng giáp, khiên và che đòn cho đồng minh yếu máu.
- **Đánh thường:** melee, physical, 1×ATK, 1 kẻ địch gần nhất, single ×1.
- **Kỹ năng — Kiến Trận Đồ:** effect family `ally_row_def_buff`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: bản thân và 1 đồng minh cùng hàng có % máu thấp nhất; hình: bản thân + 1 đồng minh cùng hàng; chọn: Tự nhận buff trước, rồi chọn 1 đồng minh cùng hàng có % máu thấp nhất.; số lượng: 2 mục tiêu; thời lượng: 2 lượt.
- **1★:** Bảo kê bản thân và 1 đồng minh cùng hàng có % máu thấp nhất, tăng 22 DEF và 14 MDEF trong 2 lượt. Hai mục tiêu nhận 10 khiên ngay khi tung kỹ năng.
- **2★:** Bảo kê bản thân và 1 đồng minh cùng hàng có % máu thấp nhất, tăng 30 DEF và 20 MDEF trong 2 lượt. Hai mục tiêu nhận 16 khiên ngay khi tung kỹ năng. Lần đầu đồng minh được bảo kê chịu sát thương trong thời gian hiệu lực, Kiến Hộ Vệ đỡ thay 35% đòn đó.
- **3★:** Bảo kê bản thân và 1 đồng minh cùng hàng có % máu thấp nhất, tăng 38 DEF và 26 MDEF trong 3 lượt. Hai mục tiêu nhận 22 khiên ngay khi tung kỹ năng. Lần đầu đồng minh được bảo kê chịu sát thương trong thời gian hiệu lực, Kiến Hộ Vệ đỡ thay 35% đòn đó. Kẻ địch gây đòn bị giảm 20 ATK hoặc MATK theo vai trò trong 2 lượt.
- **Skin/cosmetic đang authored:** antParade (achievement bestRound_5): Diễu Hành → Quân Kiến → Tướng Kiến

### armadillo_roll — Tatu Cuộn
- **Identity:** Tier 2; Đỡ đòn (TANKER); faction Bò sát (REPTILE); hệ Nham (STONE); species `tatu`.
- **Base stats 1★:** HP 427, ATK 45, DEF 35, MATK 10, MDEF 26, range 1, rageMax 4, crit 0.05, critDmg 1.5, evade 0.05, accuracy 0.95.
- **Vai trò chơi:** Cuộn tròn để tự thủ cứng và che bớt đòn cho đồng minh phía sau.
- **Đánh thường:** melee, physical, 1×ATK, 1 kẻ địch gần nhất, single ×1.
- **Kỹ năng — Cuộn Tròn:** effect family `self_def_fortify`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: bản thân; hình: tự thân; chọn: Chỉ tự cuộn lên bản thân.; số lượng: 1 mục tiêu; thời lượng: buff 2 lượt; giảm đòn kế tiếp.
- **1★:** Cuộn tròn, tăng 20 DEF và 20 MDEF trong 2 lượt. Đòn sát thương kế tiếp lên bản thân bị giảm 30%.
- **2★:** Cuộn tròn, tăng 30 DEF và 30 MDEF trong 2 lượt. Đòn sát thương kế tiếp lên bản thân bị giảm 40%. Đồng minh gần nhất đứng sau nhận giảm 20% sát thương cho đòn kế tiếp.
- **3★:** Cuộn tròn, tăng 40 DEF và 40 MDEF trong 3 lượt. Đòn sát thương kế tiếp lên bản thân bị giảm 50%. Đồng minh gần nhất đứng sau nhận giảm 20% sát thương cho đòn kế tiếp. Sau khi cuộn, thu hút đòn đánh trong 1 lượt.
- **Skin/cosmetic đang authored:** ironCurl (achievement bestRound_8): Sắt Cuộn → Giáp Sắt → Thiết Giáp Vương

### badger_stone — Lửng Đá
- **Identity:** Tier 1; Đỡ đòn (TANKER); faction Thú (BEAST); hệ Nham (STONE); species `lung`.
- **Base stats 1★:** HP 367, ATK 41, DEF 32, MATK 10, MDEF 25, range 1, rageMax 4, crit 0.05, critDmg 1.5, evade 0.05, accuracy 0.95.
- **Vai trò chơi:** Tự phủ giáp gai để câu đòn và bào mòn tay đánh mạnh nhất.
- **Đánh thường:** melee, physical, 1×ATK, 1 kẻ địch gần nhất, single ×1.
- **Kỹ năng — Gai Đá:** effect family `self_armor_reflect`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: bản thân; hình: tự thân; chọn: Tự kích hoạt lên bản thân.; số lượng: 1 mục tiêu; thời lượng: 2 lượt.
- **1★:** Tự tăng 20 DEF và phản 25% sát thương vật lý nhận vào trong 2 lượt.
- **2★:** Tự tăng 30 DEF và phản 35% sát thương vật lý nhận vào trong 3 lượt. Khi tung kỹ năng, khiêu khích kẻ địch có ATK cao nhất trong 1 lượt.
- **3★:** Tự tăng 35 DEF và phản 35% sát thương vật lý nhận vào trong 3 lượt. Khi tung kỹ năng, khiêu khích kẻ địch có ATK cao nhất trong 1 lượt. Kẻ địch đánh trúng Lửng Đá bị giảm 20 ATK hoặc MATK theo vai trò trong 2 lượt.
- **Skin/cosmetic đang authored:** stoneWatch (achievement bestRound_12): Canh Đá → Lừng Trấn → Đá Vệ Sĩ

### bat_blood — Dơi Huyết
- **Identity:** Tier 3; Sát thủ (ASSASSIN); faction Thú (BEAST); hệ Dạ (NIGHT); species `doi`.
- **Base stats 1★:** HP 272, ATK 84, DEF 16, MATK 20, MDEF 15, range 1, rageMax 4, crit 0.25, critDmg 1.5, evade 0.15, accuracy 0.95.
- **Vai trò chơi:** Sát thủ tự hồi cắn mục tiêu tuyến sau máu thấp và snowball khi kết liễu.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Cắn Mạch Hút Máu:** effect family `single_burst_lifesteal`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: kẻ địch % máu thấp nhất; hình: 1 ô điểm; chọn: địch % máu thấp nhất; số lượng: 1; thời lượng: tức thì.
- **1★:** Lao vào kẻ địch tuyến sau có % máu thấp nhất, gây (30 + 115% ATK) sát thương vật lý và hút 40% sát thương thành máu.
- **2★:** Lao vào kẻ địch tuyến sau có % máu thấp nhất, gây (30 + 115% ATK) sát thương vật lý và hút 40% sát thương thành máu. Nếu mục tiêu đang chịu hiệu ứng bất lợi, hút máu tăng lên 60%.
- **3★:** Lao vào kẻ địch tuyến sau có % máu thấp nhất, gây (30 + 115% ATK) sát thương vật lý và hút 40% sát thương thành máu. Nếu mục tiêu đang chịu hiệu ứng bất lợi, hút máu tăng lên 60%. Kết liễu mục tiêu hồi 1 nộ.
- **Skin/cosmetic đang authored:** nightPulse (achievement bestRound_16): Mạch Đêm → Huyết Mạch → Huyết Tộc Vương

### bear_ancient — Gấu Cổ Thụ
- **Identity:** Tier 2; Đỡ đòn (TANKER); faction Thú (BEAST); hệ Nham (STONE); species `gau`.
- **Base stats 1★:** HP 362, ATK 46, DEF 31, MATK 10, MDEF 25, range 1, rageMax 4, crit 0.05, critDmg 1.5, evade 0.05, accuracy 0.95.
- **Vai trò chơi:** Gầm áp chế các kẻ địch gần nhất rồi tự hồi máu.
- **Đánh thường:** melee, physical, 1×ATK, 1 kẻ địch gần nhất, single ×1.
- **Kỹ năng — Gầm Gừ Uy Hiếp:** effect family `roar_debuff_heal`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: 1 kẻ địch gần nhất; hình: 1 kẻ địch gần nhất; chọn: Ưu tiên các kẻ địch gần Gấu Cổ Thụ nhất.; số lượng: 1 kẻ địch; thời lượng: giảm sức công 3 lượt; tự hồi tức thì.
- **1★:** Gầm vang, làm 1 kẻ địch gần nhất giảm 15 ATK hoặc MATK theo vai trò trong 3 lượt. Gấu Cổ Thụ hồi 10% HP tối đa.
- **2★:** Gầm vang, làm 2 kẻ địch gần nhất giảm 20 ATK hoặc MATK theo vai trò trong 3 lượt. Gấu Cổ Thụ hồi 15% HP tối đa. Mục tiêu bị giảm sức công mạnh nhất mất 1 nộ.
- **3★:** Gầm vang, làm 3 kẻ địch gần nhất giảm 25 ATK hoặc MATK theo vai trò trong 4 lượt. Gấu Cổ Thụ hồi 20% HP tối đa. Sau khi gầm, Gấu Cổ Thụ nhận 20 khiên và khiêu khích 1 lượt.
- **Skin/cosmetic đang authored:** totemSage (achievement bestRound_20): Gấu Tổ Lão → Trưởng Lão Rừng → Tổ Linh Gấu Vương

### beetle_drill — Bọ Khoan Giáp
- **Identity:** Tier 4; Đấu sĩ (FIGHTER); faction Thú (BEAST); hệ Trùng (SWARM); species `bo`.
- **Base stats 1★:** HP 423, ATK 90, DEF 28, MATK 21, MDEF 22, range 1, rageMax 4, crit 0.05, critDmg 1.5, evade 0.08, accuracy 0.95.
- **Vai trò chơi:** Khoan thẳng vào tanker để xuyên giáp bằng sát thương chuẩn.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Mũi Khoan Xuyên:** effect family `true_single`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: 1 kẻ địch ở cột đầu tiên có HP tối đa cao nhất; hình: 1 ô điểm; chọn: Ưu tiên hàng trước; trong nhóm đó chọn mục tiêu có HP tối đa cao nhất.; số lượng: 1 mục tiêu; thời lượng: tức thì.
- **1★:** Khoan vào kẻ địch ở cột đầu tiên có HP tối đa cao nhất, gây (35 + 120% ATK) sát thương chuẩn.
- **2★:** Khoan vào kẻ địch ở cột đầu tiên có HP tối đa cao nhất, gây (35 + 120% ATK) sát thương chuẩn. Nếu mục tiêu đang có khiên, sát thương tăng 20%.
- **3★:** Khoan vào kẻ địch ở cột đầu tiên có HP tối đa cao nhất, gây (35 + 120% ATK) sát thương chuẩn. Nếu mục tiêu đang có khiên, sát thương tăng 35% và phá thêm 40% khiên còn lại.
- **Skin/cosmetic đang authored:** gearBurrow (achievement bestRound_25): Khoan Răng → Máy Khoan → Cơ Giới Khoan Vương

### beetle_mystic — Bọ Huyền
- **Identity:** Tier 4; Pháp sư (MAGE); faction Côn trùng (INSECT); hệ Linh (SPIRIT); species `bo-huyen`.
- **Base stats 1★:** HP 352, ATK 25, DEF 13, MATK 105, MDEF 25, range 4, rageMax 5, crit 0.1, critDmg 1.5, evade 0.05, accuracy 0.95.
- **Vai trò chơi:** Giáng cột băng lên cột địch đông nhất rồi khóa cứng mục tiêu trong cột.
- **Đánh thường:** tầm xa/projectile, magic từ MATK, 1×MATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Cầu Vồng Bọ Huyền:** effect family `column_freeze`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: cột địch đông nhất; hình: quét toàn bộ một cột địch; chọn: Ưu tiên cột địch có nhiều mục tiêu nhất.; số lượng: 1 cột; đóng băng tối đa 1 mục tiêu; thời lượng: đóng băng 1 lượt.
- **1★:** Giáng cột băng xuống cột địch đông nhất, gây (35 + 110% MATK) sát thương phép lên cả cột. Tối đa 1 mục tiêu trong cột bị đóng băng 1 lượt.
- **2★:** Giáng cột băng xuống cột địch đông nhất, gây (36 + 114% MATK) sát thương phép lên cả cột. Tối đa 1 mục tiêu trong cột bị đóng băng 1 lượt.
- **3★:** Giáng cột băng xuống cột địch đông nhất, gây (38 + 119% MATK) sát thương phép lên cả cột. Tối đa 1 mục tiêu trong cột bị đóng băng 1 lượt. Nếu cột có ít nhất 2 tướng đánh xa, đóng băng thêm 1 mục tiêu đánh xa trong cột.
- **Skin/cosmetic đang authored:** gemOracle (achievement bestRound_30): Ngọc Sư → Linh Ngọc → Ngọc Triệu Vương

### bison_stampede — Bò Rừng Dẫm
- **Identity:** Tier 3; Đấu sĩ (FIGHTER); faction Thú (BEAST); hệ Nham (STONE); species `bo-rung`.
- **Base stats 1★:** HP 368, ATK 76, DEF 25, MATK 18, MDEF 20, range 1, rageMax 5, crit 0.05, critDmg 1.5, evade 0.08, accuracy 0.95.
- **Vai trò chơi:** Húc nát tuyến đầu rồi dội lực sang mục tiêu phía sau.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Húc Choáng:** effect family `damage_stun`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: kẻ địch đứng gần tuyến trước nhất và có HP tối đa cao nhất; hình: 1 ô mục tiêu; chọn: Ưu tiên mục tiêu đứng gần tuyến trước nhất, rồi chọn kẻ có HP tối đa cao nhất trong nhóm đó.; số lượng: 1 mục tiêu; thời lượng: choáng 1 lượt (45%).
- **1★:** Húc vào 1 kẻ địch tuyến đầu có HP tối đa cao nhất, gây (28 + 105% ATK) sát thương vật lý và có 45% gây choáng 1 lượt.
- **2★:** Húc vào 1 kẻ địch tuyến đầu có HP tối đa cao nhất, gây (30 + 110% ATK) sát thương vật lý, có 55% gây choáng 1 lượt và giảm 16 DEF trong 2 lượt.
- **3★:** Húc vào 1 kẻ địch tuyến đầu có HP tối đa cao nhất, gây (33 + 115% ATK) sát thương vật lý, có 65% gây choáng 1 lượt và giảm 18 DEF trong 2 lượt. Sóng dư chấn dội thêm lên 1 kẻ địch phía sau gần nhất với 55% sát thương.
- **Skin/cosmetic đang authored:** dustBanner (achievement bestRound_40): Cờ Bụi → Quân Cờ → Bò Rừng Chiến Vương

### buffalo_mist — Trâu Sương Mù
- **Identity:** Tier 4; Đỡ đòn (TANKER); faction Thú (BEAST); hệ Phong (WIND); species `trau`.
- **Base stats 1★:** HP 535, ATK 61, DEF 38, MATK 17, MDEF 31, range 1, rageMax 5, crit 0.05, critDmg 1.5, evade 0.05, accuracy 0.95.
- **Vai trò chơi:** Phủ sương lên đồng minh thấp máu để né đòn, chèn khiên cứu nguy và bồi nhịp cho người sống sót.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Sương Mù Che Chắn:** effect family `team_evade_buff`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: 3 đồng minh thấp máu nhất; hình: nhóm đồng minh thấp máu nhất; chọn: Chọn 3 đồng minh có % máu thấp nhất.; số lượng: 3 đồng minh; thời lượng: 2 lượt.
- **1★:** 3 đồng minh thấp máu nhất nhận 14% né tránh trong 2 lượt.
- **2★:** 4 đồng minh thấp máu nhất nhận 16% né tránh trong 2 lượt. Đồng minh dưới 50% máu còn nhận thêm 24 khiên và thanh tẩy 1 hiệu ứng bất lợi.
- **3★:** 5 đồng minh thấp máu nhất nhận 20% né tránh trong 2 lượt. Đồng minh dưới 60% máu còn nhận thêm 30 khiên. Đồng minh thấp máu nhất được hồi 1 nộ; nếu bất kỳ mục tiêu nào trong nhóm né thành công, mục tiêu đó hồi 35 HP và nhận thêm 1 lớp khiên.
- **Skin/cosmetic đang authored:** mistHarbor (achievement roundsWon_1): Cảng Sương → Trâu Sương Mù → Hải Cảng Huyền Bí

### bug_plague — Bọ Dịch Hạch
- **Identity:** Tier 4; Pháp sư (MAGE); faction Thú (BEAST); hệ Trùng (SWARM); species `bo`.
- **Base stats 1★:** HP 348, ATK 23, DEF 13, MATK 95, MDEF 24, range 4, rageMax 5, crit 0.1, critDmg 1.5, evade 0.05, accuracy 0.95.
- **Vai trò chơi:** Phun dịch bệnh vào cụm địch đông nhất để lây lan trong bán kính gần.
- **Đánh thường:** tầm xa/projectile, magic từ MATK, 1×MATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Dịch Bệnh Lan:** effect family `plague_spread`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: tâm cụm địch đông nhất; hình: vùng vuông 3x3 quanh mục tiêu chính; chọn: Chọn tâm cụm địch đông nhất, rồi lan sang các kẻ địch kề bên trong phạm vi 1 ô.; số lượng: tối đa 3 mục tiêu; thời lượng: dịch bệnh 3 lượt.
- **1★:** Phun dịch vào tâm cụm địch đông nhất, gây (28 + 0.85 x MATK) sát thương phép. Mục tiêu trúng đòn và tối đa 2 kẻ địch kề bên mắc dịch bệnh 12 mỗi lượt trong 3 lượt.
- **2★:** Phun dịch vào tâm cụm địch đông nhất, gây (29 + 0.88 x MATK) sát thương phép. Mục tiêu trúng đòn và tối đa 3 kẻ địch kề bên mắc dịch bệnh 13 mỗi lượt trong 3 lượt. Nếu cụm có ít nhất 4 mục tiêu, mục tiêu chính bị giảm 15% ATK/MATK trong 2 lượt và mất 1 nộ.
- **3★:** Phun dịch vào tâm cụm địch đông nhất, gây (31 + 0.92 x MATK) sát thương phép. Mục tiêu trúng đòn và tối đa 3 kẻ địch kề bên mắc dịch bệnh 16 mỗi lượt trong 3 lượt. Nếu cụm có ít nhất 4 mục tiêu, mục tiêu chính bị giảm 15% ATK/MATK trong 2 lượt và mất 1 nộ. Dịch còn bùng ra thêm 2 kẻ địch ngoài vùng 3x3 với 70% sát thương và mắc dịch bệnh 10 mỗi lượt trong 2 lượt.
- **Skin/cosmetic đang authored:** plagueBloom (achievement roundsWon_3): Nấm Độc → Bào Tử Dịch → Dịch Họa Vương

### butterfly_mirror — Bướm Kính
- **Identity:** Tier 2; Hỗ trợ (SUPPORT); faction Côn trùng (INSECT); hệ Linh (SPIRIT); species `buom`.
- **Base stats 1★:** HP 299, ATK 23, DEF 15, MATK 67, MDEF 26, range 3, rageMax 4, crit 0.05, critDmg 1.5, evade 0.07, accuracy 0.95.
- **Vai trò chơi:** Dựng khiên phản phép rồi san sẻ lá chắn cho đồng minh.
- **Đánh thường:** projectile, magic, 1×MATK, 1 kẻ địch gần nhất, single ×1.
- **Kỹ năng — Vảy Gương:** effect family `mirror_reflect`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: bản thân + 1 đồng minh gần nhất; hình: tự thân rồi lan khiên sang đồng minh; chọn: Tự nhận khiên trước, rồi chọn 1 đồng minh gần nhất.; số lượng: 1 bản thân + 1 đồng minh; thời lượng: phản phép 2 lượt.
- **1★:** Tự tạo khiên bằng (40 + 20% MATK), phản 25% sát thương phép nhận vào trong 2 lượt, rồi chia 30% lượng khiên đó cho 1 đồng minh gần nhất.
- **2★:** Tự tạo khiên bằng (60 + 30% MATK), phản 35% sát thương phép nhận vào trong 2 lượt, rồi chia 35% lượng khiên đó cho 1 đồng minh có % máu thấp nhất.
- **3★:** Tự tạo khiên bằng (80 + 40% MATK), phản 45% sát thương phép nhận vào trong 3 lượt, rồi chia 40% lượng khiên đó cho tối đa 2 đồng minh cùng hàng.
- **Skin/cosmetic đang authored:** mirrorWing (achievement roundsWon_5): Cánh Gương → Phản Chiếu → Lăng Kính Vương

### cat_goldbow — Ong Lửa
- **Identity:** Tier 4; Xạ thủ (ARCHER); faction Côn trùng (INSECT); hệ Hỏa (FIRE); species `ong`.
- **Base stats 1★:** HP 323, ATK 79, DEF 14, MATK 15, MDEF 14, range 4, rageMax 4, crit 0.2, critDmg 1.5, evade 0.1, accuracy 0.95.
- **Vai trò chơi:** Bắn phá giáp tuyến đầu rồi mở áp lực sang mục tiêu kề bên.
- **Đánh thường:** tầm xa/projectile, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Phá Giáp Tiễn:** effect family `single_armor_break`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: kẻ địch đứng gần tuyến trước nhất và có HP tối đa cao nhất; hình: 1 ô mục tiêu; chọn: Ưu tiên mục tiêu đứng gần tuyến trước nhất, rồi chọn kẻ có HP tối đa cao nhất trong nhóm đó.; số lượng: 1 mục tiêu; thời lượng: 2 lượt.
- **1★:** Bắn vào 1 kẻ địch tuyến đầu có HP tối đa cao nhất, gây (32 + 1.25 x ATK) sát thương vật lý và giảm 24 DEF trong 2 lượt.
- **2★:** Bắn vào 1 kẻ địch tuyến đầu có HP tối đa cao nhất, gây (32 + 1.25 x ATK) sát thương vật lý và giảm 24 DEF trong 2 lượt. Kẻ địch kề bên gần nhất cũng bị giảm 18 DEF trong 2 lượt.
- **3★:** Bắn vào 1 kẻ địch tuyến đầu có HP tối đa cao nhất, gây (32 + 1.25 x ATK) sát thương vật lý và giảm 24 DEF trong 2 lượt. Kẻ địch kề bên gần nhất cũng bị giảm 18 DEF trong 2 lượt và bị thiêu đốt 10 mỗi lượt trong 2 lượt.
- **Skin/cosmetic đang authored:** goldLyric (achievement roundsWon_10): Khúc Vàng → Cung Thủ Vàng → Hoàng Kim Cung Vương

### chameleon_stealth — Tắc Kè Ẩn
- **Identity:** Tier 3; Sát thủ (ASSASSIN); faction Bò sát (REPTILE); hệ Mộc (WOOD); species `tac-ke`.
- **Base stats 1★:** HP 282, ATK 88, DEF 18, MATK 22, MDEF 16, range 1, rageMax 4, crit 0.25, critDmg 1.5, evade 0.15, accuracy 0.95.
- **Vai trò chơi:** Lẻn vào hậu tuyến cô lập, bẻ giáp và rút nộ rồi lướt sang mục tiêu kế tiếp khi hạ gục.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Ẩn Đánh:** effect family `stealth_strike`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: 1 kẻ địch ở cột cuối cùng phía địch đứng tách đội hình; hình: 1 ô khóa mục tiêu; chọn: Ưu tiên kẻ địch ở cột cuối cùng phía địch và đứng tách khỏi đồng đội.; số lượng: 1 mục tiêu; thời lượng: né tránh 2 lượt.
- **1★:** Ưu tiên mục tiêu ở cột cuối cùng phía địch đứng tách đội hình, gây (24 + 0.9 x ATK) x Hệ số sao (1) = (24 + 0.9 x 88) x 1 = 103 (ATK) và tự tăng 25% né tránh trong 2 lượt.
- **2★:** Ưu tiên mục tiêu ở cột cuối cùng phía địch đứng tách đội hình, gây (24 + 0.9 x ATK) x Hệ số sao (1.2) = (24 + 0.9 x 141) x 1.2 = 181 (ATK) và tự tăng 32% né tránh trong 2 lượt. Nếu mục tiêu đứng tách đội hình, đòn đánh bỏ qua 25% DEF và mục tiêu mất 1 nộ.
- **3★:** Ưu tiên mục tiêu ở cột cuối cùng phía địch đứng tách đội hình, gây (24 + 0.9 x ATK) x Hệ số sao (1.4) = (24 + 0.9 x 220) x 1.4 = 311 (ATK) và tự tăng 38% né tránh trong 2 lượt. Nếu mục tiêu đứng tách đội hình, đòn đánh bỏ qua 25% DEF và mục tiêu mất 1 nộ. Nếu hạ gục mục tiêu, tắc kè lướt sang 1 kẻ địch khác ở cột cuối cùng phía địch gần nhất, gây [(24 + 0.9 x ATK) x Hệ số sao (1.4)] x Hệ số Truy Sát (0.5) = [(24 + 0.9 x 220) x 1.4] x 0.5 = 156 (ATK).
- **Skin/cosmetic đang authored:** chromaVeil (achievement roundsWon_20): Màn Sắc → Ẩn Sắc → Huyền Sắc Vương

### chimera_flame — Chimera Lửa
- **Identity:** Tier 5; Đấu sĩ (FIGHTER); faction Huyền thoại (MYTHICAL); hệ Hỏa (FIRE); species `chimera`.
- **Base stats 1★:** HP 497, ATK 99, DEF 42, MATK 23, MDEF 36, range 1, rageMax 5, crit 0.05, critDmg 1.5, evade 0.08, accuracy 0.95.
- **Vai trò chơi:** Thiêu toàn bộ kẻ địch và bào mòn bằng thiêu đốt.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Hỏa Ngục Hổ:** effect family `global_fire`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: toàn bộ kẻ địch đang còn sống; hình: toàn bộ bàn địch; chọn: Chọn toàn bộ kẻ địch đang còn sống trên sân.; số lượng: toàn bộ kẻ địch; thời lượng: thiêu đốt 3 lượt.
- **1★:** Thiêu toàn bộ kẻ địch, gây (42 + 100% MATK) sát thương phép và thiêu đốt 18 mỗi lượt trong 3 lượt.
- **2★:** Thiêu toàn bộ kẻ địch, gây (42 + 100% MATK) sát thương phép và thiêu đốt 22 mỗi lượt trong 3 lượt. Đỡ đòn và đấu sĩ trúng đòn chịu thêm 15% sát thương.
- **3★:** Thiêu toàn bộ kẻ địch, gây (42 + 100% MATK) sát thương phép và thiêu đốt 24 mỗi lượt trong 3 lượt. Đỡ đòn và đấu sĩ trúng đòn chịu thêm 15% sát thương. Mục tiêu cháy còn mắc bệnh 12 mỗi lượt trong 2 lượt.
- **Skin/cosmetic đang authored:** emberKing (achievement roundsWon_30): Lửa Vương → Hỏa Diệm → Bạo Viêm Vương

### cobra_venom — Rắn Hổ Mang
- **Identity:** Tier 4; Sát thủ (ASSASSIN); faction Bò sát (REPTILE); hệ Trùng (SWARM); species `ran`.
- **Base stats 1★:** HP 297, ATK 96, DEF 16, MATK 26, MDEF 18, range 1, rageMax 4, crit 0.25, critDmg 1.5, evade 0.15, accuracy 0.95.
- **Vai trò chơi:** Sát thủ độc phép săn backliner MDEF thấp và trừng phạt mục tiêu có khiên.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Nọc Tử Thần:** effect family `single_strong_poison`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: 1 kẻ địch ở cột cuối cùng phía địch có MDEF thấp nhất; hình: 1 ô khóa mục tiêu; chọn: Ưu tiên mục tiêu ở cột cuối cùng phía địch có MDEF thấp nhất.; số lượng: 1; thời lượng: nhiễm độc 3 lượt + bệnh 2 lượt.
- **1★:** Phun nọc vào 1 kẻ địch ở cột cuối cùng phía địch có MDEF thấp nhất, gây (53 + 1.95 x MATK) sát thương phép. Mục tiêu bị nhiễm độc 25 mỗi lượt trong 3 lượt và mắc bệnh 12 mỗi lượt trong 2 lượt.
- **2★:** Phun nọc vào 1 kẻ địch ở cột cuối cùng phía địch có MDEF thấp nhất, gây (53 + 1.95 x MATK) sát thương phép. Mục tiêu bị nhiễm độc 25 mỗi lượt trong 3 lượt và mắc bệnh 16 mỗi lượt trong 3 lượt.
- **3★:** Phun nọc vào 1 kẻ địch ở cột cuối cùng phía địch có MDEF thấp nhất, gây (53 + 1.95 x MATK) sát thương phép. Mục tiêu bị nhiễm độc 25 mỗi lượt trong 3 lượt và mắc bệnh 18 mỗi lượt trong 3 lượt. Nếu mục tiêu đang có khiên hoặc là đỡ đòn, độc kéo dài thêm 1 lượt.
- **Skin/cosmetic đang authored:** venomCrown (achievement roundsWon_50): Độc Vương → Rắn Độc Miện → Mãng Xà Vương

### condor_sky — Chim Trời Mây
- **Identity:** Tier 4; Xạ thủ (ARCHER); faction Chim (AVIAN); hệ Phong (WIND); species `dieu-khong-lo`.
- **Base stats 1★:** HP 285, ATK 84, DEF 15, MATK 17, MDEF 15, range 4, rageMax 3, crit 0.2, critDmg 1.5, evade 0.1, accuracy 0.95.
- **Vai trò chơi:** Bổ dọc cả cột để mở giáp cho đồng đội dồn sát thương.
- **Đánh thường:** tầm xa/projectile, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Bổ Nhào:** effect family `dive_bomb`; cost nộ 1★/2★/3★ = **1/2/3**. mục tiêu: mục tiêu bị nhắm và toàn bộ kẻ địch cùng cột của nó; hình: 1 cột dọc; chọn: Khóa 1 kẻ địch trong tầm, rồi đánh trúng toàn bộ cột của mục tiêu đó.; số lượng: 1 cột; thời lượng: giảm DEF 2 lượt.
- **1★:** Bổ xuống cột của mục tiêu bị nhắm, gây (35 + 1.3 x ATK) sát thương vật lý lên toàn bộ kẻ địch trong cột đó và giảm 15 DEF trong 2 lượt.
- **2★:** Bổ xuống cột của mục tiêu bị nhắm, gây (39 + 1.38 x ATK) sát thương vật lý lên toàn bộ kẻ địch trong cột đó và giảm 22 DEF trong 2 lượt.
- **3★:** Bổ xuống cột của mục tiêu bị nhắm, gây (44 + 1.48 x ATK) sát thương vật lý lên toàn bộ kẻ địch trong cột đó và giảm 30 DEF trong 3 lượt.
- **Skin/cosmetic đang authored:** skyRider (achievement roundsWon_75): Kỵ Sĩ Trời → Phi Hành → Điêu Vương Bầu Trời

### crab_shell — Cua Giáp
- **Identity:** Tier 2; Đỡ đòn (TANKER); faction Thủy sinh (AQUATIC); hệ Thủy (TIDE); species `cua`.
- **Base stats 1★:** HP 433, ATK 47, DEF 34, MATK 12, MDEF 27, range 1, rageMax 5, crit 0.05, critDmg 1.5, evade 0.05, accuracy 0.95.
- **Vai trò chơi:** Gánh sát thương thay cho đồng minh có % máu thấp nhất.
- **Đánh thường:** melee, physical, 1×ATK, 1 kẻ địch gần nhất, single ×1.
- **Kỹ năng — Kẹp Bảo Vệ:** effect family `guardian_pact`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: 1 đồng minh có % máu thấp nhất; hình: chọn 1 đồng minh; chọn: Ưu tiên đồng minh có % máu thấp nhất, không chọn bản thân.; số lượng: 1 mục tiêu; thời lượng: 2 lượt.
- **1★:** Bảo kê 1 đồng minh có % máu thấp nhất, gánh 30% sát thương cho mục tiêu đó trong 2 lượt. Cua Giáp tự tăng 15 DEF trong 2 lượt.
- **2★:** Bảo kê 1 đồng minh có % máu thấp nhất, gánh 46% sát thương cho mục tiêu đó trong 2 lượt và thanh tẩy 1 hiệu ứng bất lợi. Cua Giáp tự tăng 20 DEF trong 2 lượt.
- **3★:** Bảo kê 2 đồng minh có % máu thấp nhất, gánh 68% sát thương cho các mục tiêu đó trong 3 lượt và thanh tẩy 1 hiệu ứng bất lợi cho mỗi mục tiêu. Cua Giáp tự tăng 25 DEF trong 3 lượt.
- **Skin/cosmetic đang authored:** reefArmor (achievement roundsWon_100): Giáp San Hô → Giáp Rạn → Thần Giáp Biển

### crane_blessing — Gà Trống Rapper
- **Identity:** Tier 1; Hỗ trợ (SUPPORT); faction Chim (AVIAN); hệ Linh (SPIRIT); species `ga-trong`.
- **Base stats 1★:** HP 282, ATK 23, DEF 14, MATK 64, MDEF 25, range 3, rageMax 4, crit 0.05, critDmg 1.5, evade 0.07, accuracy 0.95.
- **Vai trò chơi:** Hát nhịp hồi nộ cho số lượng nhỏ đồng minh cùng hàng.
- **Đánh thường:** projectile, magic, 1×MATK, 1 kẻ địch gần nhất, single ×1.
- **Kỹ năng — Nhịp Kích Nộ:** effect family `row_random_rage_buff`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: 2 đồng minh ngẫu nhiên phía trước cùng hàng; hình: cụm đồng minh cùng hàng; chọn: Chọn ngẫu nhiên các đồng minh đứng phía trước cùng hàng của bản thân.; số lượng: 2 mục tiêu; thời lượng: tức thì; tăng công 1 lượt.
- **1★:** Bơm 1 nộ cho 2 đồng minh ngẫu nhiên phía trước cùng hàng và tăng 10% ATK trong 1 lượt.
- **2★:** Bơm 1 nộ cho 3 đồng minh ngẫu nhiên cùng hàng và tăng 15% ATK trong 1 lượt.
- **3★:** Bơm 1 nộ cho 3 đồng minh ngẫu nhiên cùng hàng và tăng 15% ATK trong 1 lượt. 30% để 1 mục tiêu trong nhóm đó nhận thêm 1 nộ và thay buff thành 20% ATK trong 2 lượt.
- **Skin/cosmetic đang authored:** gaMaiNguNuong (free): Cô Gà Ngủ Nướng → Cô Gà Ôm Gối → Nữ Hoàng Giấc Ngủ

### crocodile_bite — Cá Sấu Đầm
- **Identity:** Tier 4; Đấu sĩ (FIGHTER); faction Bò sát (REPTILE); hệ Thủy (TIDE); species `ca-sau`.
- **Base stats 1★:** HP 417, ATK 83, DEF 28, MATK 19, MDEF 20, range 1, rageMax 4, crit 0.05, critDmg 1.5, evade 0.08, accuracy 0.95.
- **Vai trò chơi:** Cắn tuyến trước nhiều máu để khóa khiên, bào bleed và làm máu văng sang hàng gần nhất.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Cá Sấu Tử Cuộn:** effect family `single_bleed`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: mục tiêu ở cột đầu tiên phía địch có HP tối đa cao nhất; hình: đơn mục tiêu; chọn: Ưu tiên mục tiêu có HP tối đa cao nhất ở cột đầu tiên phía địch.; số lượng: 1 mục tiêu; thời lượng: chảy máu 3 lượt.
- **1★:** Cắn mục tiêu ở cột đầu tiên phía địch có HP tối đa cao nhất, gây (38 + 1.4 x ATK) sát thương vật lý và chảy máu 15 mỗi lượt trong 3 lượt.
- **2★:** Cắn mục tiêu ở cột đầu tiên phía địch có HP tối đa cao nhất, gây (38 + 1.4 x ATK) sát thương vật lý và chảy máu 20 mỗi lượt trong 3 lượt. Nếu mục tiêu là tanker hoặc đang có khiên, chảy máu tăng 35% và mục tiêu không thể nhận khiên mới trong 2 lượt.
- **3★:** Cắn mục tiêu ở cột đầu tiên phía địch có HP tối đa cao nhất, gây (38 + 1.4 x ATK) sát thương vật lý và chảy máu 22 mỗi lượt trong 4 lượt. Mục tiêu đang chảy máu bị giảm 20 giáp trong 2 lượt. Nếu mục tiêu còn sống, máu văng sang tối đa 2 kẻ địch cùng hàng gần nhất, mỗi mục tiêu chịu 0.7 x sát thương của cú cắn và chảy máu 15 mỗi lượt trong 2 lượt.
- **Skin/cosmetic đang authored:** riverCrown (achievement roundsWon_150): Vương Sông → Bá Chủ Đầm → Hà Vương

### crow_storm — Quạ Phi Tiêu
- **Identity:** Tier 1; Xạ thủ (ARCHER); faction Chim (AVIAN); hệ Phong (WIND); species `qua`.
- **Base stats 1★:** HP 240, ATK 52, DEF 12, MATK 10, MDEF 14, range 4, rageMax 4, crit 0.1, critDmg 1.5, evade 0.08, accuracy 0.95.
- **Vai trò chơi:** Ném phi tiêu sắc màu liên tiếp vào một mục tiêu, càng ném càng dễ mở thêm đòn.
- **Đánh thường:** tầm xa/projectile, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Tam Sắc Phi Tiêu:** effect family `chromatic_dart_chain`; cost nộ 1★/2★/3★ = **4/4/4**. mục tiêu: một kẻ địch có % máu thấp nhất; hình: chuỗi phi tiêu cùng một mục tiêu; chọn: Ưu tiên kẻ địch có % máu thấp nhất. Đỏ chỉ kiểm tra sau Xanh; Vàng chỉ kiểm tra sau Đỏ.; số lượng: 1 mục tiêu, tối đa 3 phi tiêu; thời lượng: bonus tỷ lệ giữ đến hết combat.
- **1★:** Ném Phi Tiêu Xanh vào một kẻ địch có % máu thấp nhất, gây (18 + 80% ATK) sát thương vật lý và hồi máu bằng 50% sát thương thực tế. Mỗi phi tiêu đã ném tăng 5% tỷ lệ Đỏ và 1% tỷ lệ Vàng cho lần dùng sau trong combat.
- **2★:** Ném Phi Tiêu Xanh vào một kẻ địch có % máu thấp nhất, gây (20 + 85% ATK) sát thương vật lý và hồi 50% sát thương thực tế. Sau đó có 50% cộng bonus tích lũy để ném Phi Tiêu Đỏ vào cùng mục tiêu; các ô kề theo hình chữ thập nhận 50% sát thương thực tế của phi tiêu Đỏ. Mỗi phi tiêu đã ném tăng 5% tỷ lệ Đỏ và 1% tỷ lệ Vàng cho lần dùng sau trong combat.
- **3★:** Ném Phi Tiêu Xanh vào một kẻ địch có % máu thấp nhất, gây (22 + 90% ATK) sát thương vật lý và hồi 50% sát thương thực tế. Sau Xanh, có 50% cộng bonus để ném Đỏ; sau Đỏ, có 25% cộng bonus để ném Vàng vào cùng mục tiêu. Đỏ nổ 50% sát thương thực tế lên hình thập quanh mục tiêu; Vàng choáng 2 lượt. Mỗi phi tiêu đã ném tăng 5% tỷ lệ Đỏ và 1% tỷ lệ Vàng cho lần dùng sau trong combat.
- **Skin/cosmetic đang authored:** stormRook (achievement runsStarted_1): Quạ Bão → Sét Đen → Bão Quạ Vương

### deer_song — Nai Thần Ca
- **Identity:** Tier 2; Hỗ trợ (SUPPORT); faction Thú (BEAST); hệ Linh (SPIRIT); species `nai`.
- **Base stats 1★:** HP 286, ATK 22, DEF 15, MATK 68, MDEF 27, range 3, rageMax 3, crit 0.05, critDmg 1.5, evade 0.07, accuracy 0.95.
- **Vai trò chơi:** Hồi dần nhóm đồng minh thấp máu nhất rồi mở nhịp cứu nguy ở sao cao.
- **Đánh thường:** projectile, magic, 1×MATK, 1 kẻ địch gần nhất, single ×1.
- **Kỹ năng — Khúc Ca Sức Sống:** effect family `heal_over_time`; cost nộ 1★/2★/3★ = **1/2/3**. mục tiêu: 2 đồng minh có % máu thấp nhất; hình: nhiều mục tiêu đồng minh rời nhau; chọn: Ưu tiên các đồng minh có % máu thấp nhất.; số lượng: 2 mục tiêu; thời lượng: hồi dần 2 lượt.
- **1★:** Hồi dần 15% HP tối đa trong 2 lượt cho 2 đồng minh có % máu thấp nhất.
- **2★:** Hồi dần 21% HP tối đa trong 2 lượt cho 3 đồng minh có % máu thấp nhất. Đồng minh có % máu thấp nhất trong nhóm, nếu còn dưới 55% máu, nhận thêm 1 nộ.
- **3★:** Hồi dần 24% HP tối đa trong 3 lượt cho 4 đồng minh có % máu thấp nhất. Đồng minh có % máu thấp nhất trong nhóm, nếu còn dưới 55% máu, nhận thêm 2 nộ và giải 1 hiệu ứng xấu.
- **Skin/cosmetic đang authored:** moonChorus (achievement runsStarted_2): Khúc Trăng → Bài Ca Trăng → Nguyệt Ca Vương

### dove_peace — Bồ Câu Hòa Bình
- **Identity:** Tier 1; Hỗ trợ (SUPPORT); faction Chim (AVIAN); hệ Linh (SPIRIT); species `bo-cau`.
- **Base stats 1★:** HP 250, ATK 23, DEF 15, MATK 64, MDEF 26, range 3, rageMax 4, crit 0.05, critDmg 1.5, evade 0.07, accuracy 0.95.
- **Vai trò chơi:** Hồi máu và chống dồn sát thương cho đồng minh thấp máu, sao cao còn có thanh tẩy.
- **Đánh thường:** projectile, magic, 1×MATK, 1 kẻ địch gần nhất, single ×1.
- **Kỹ năng — Cành Ô Liu:** effect family `heal_over_time`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: 1 đồng minh có % máu thấp nhất; hình: 1 mục tiêu đồng minh; chọn: Ưu tiên các đồng minh có % máu thấp nhất.; số lượng: 1 mục tiêu; thời lượng: giảm sát thương 1 lượt.
- **1★:** Hồi cho 1 đồng minh có % máu thấp nhất lượng máu bằng (20 + 0.6 x MATK) x Hệ số sao (1) = (20 + 0.6 x 64) x 1 = 58 (MATK), rồi giảm 20% sát thương nhận vào trong 1 lượt.
- **2★:** Hồi cho 1 đồng minh có % máu thấp nhất lượng máu bằng (30 + 0.8 x MATK) x Hệ số sao (1.2) = (30 + 0.8 x 102) x 1.2 = 134 (MATK), rồi giảm 25% sát thương nhận vào trong 2 lượt. Thanh tẩy 1 hiệu ứng xấu cho mục tiêu đó.
- **3★:** Hồi cho 2 đồng minh có % máu thấp nhất lượng máu bằng (40 + 1 x MATK) x Hệ số sao (1.4) = (40 + 1 x 160) x 1.4 = 280 (MATK), rồi giảm 30% sát thương nhận vào trong 2 lượt. Thanh tẩy 2 hiệu ứng xấu và tạo 20 khiên cho mỗi mục tiêu.
- **Skin/cosmetic đang authored:** oliveHarbor (achievement runsStarted_3): Cảng Ô Liu → Bình An → Thiên Sứ Hoà Bình

### dragon_breath — Rồng Lửa
- **Identity:** Tier 5; Pháp sư (MAGE); faction Huyền thoại (MYTHICAL); hệ Hỏa (FIRE); species `long`.
- **Base stats 1★:** HP 395, ATK 33, DEF 25, MATK 114, MDEF 40, range 4, rageMax 5, crit 0.1, critDmg 1.5, evade 0.05, accuracy 0.95.
- **Vai trò chơi:** Thiêu toàn bộ chiến trường và bào mòn bằng thiêu đốt.
- **Đánh thường:** tầm xa/projectile, magic từ MATK, 1×MATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Hỏa Ngục Rồng:** effect family `global_fire`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: toàn bộ kẻ địch đang còn sống; hình: toàn bộ bàn địch; chọn: Ưu tiên toàn bàn địch đang còn sống.; số lượng: toàn bộ kẻ địch; thời lượng: thiêu đốt 3 lượt.
- **1★:** Thiêu toàn bộ kẻ địch, gây (42 + 1.1 x MATK) sát thương phép và thiêu đốt 20 mỗi lượt trong 3 lượt.
- **2★:** Thiêu toàn bộ kẻ địch, gây (42 + 1.1 x MATK) sát thương phép và thiêu đốt 24 mỗi lượt trong 3 lượt.
- **3★:** Thiêu toàn bộ kẻ địch, gây (42 + 1.1 x MATK) sát thương phép và thiêu đốt 26 mỗi lượt trong 3 lượt. Mục tiêu trúng đòn còn mắc bệnh 14 mỗi lượt trong 2 lượt.
- **Skin/cosmetic đang authored:** emberThrone (achievement runsStarted_5): Ngọn Đại Hỏa → Hỏa Diệm Long → Bạo Viêm Long Vương

### dragon_earth — Rồng Đất
- **Identity:** Tier 4; Đỡ đòn (TANKER); faction Bò sát (REPTILE); hệ Nham (STONE); species `rong-dat`.
- **Base stats 1★:** HP 560, ATK 60, DEF 42, MATK 14, MDEF 32, range 1, rageMax 5, crit 0.05, critDmg 1.5, evade 0.05, accuracy 0.95.
- **Vai trò chơi:** Dựng tường đất để che chắn cả đội, bản thân nhận lớp khiên dày nhất.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Tường Đất Rồng:** effect family `team_shield`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: toàn bộ đồng minh; hình: toàn bộ đồng minh, bản thân nhận gấp đôi; chọn: Áp dụng cho toàn bộ đồng minh còn sống, rồi nhân đôi lượng khiên trên bản thân.; số lượng: toàn bộ đồng minh; thời lượng: tức thì; lớp khiên tồn tại cho đến khi bị phá.
- **1★:** Rồng Đất dựng tường đất, tạo khiên bằng (52 + 0.24 x DEF) cho toàn bộ đồng minh; bản thân nhận gấp đôi lượng khiên đó.
- **2★:** Rồng Đất dựng tường đất, tạo khiên bằng (58 + 0.26 x DEF) cho toàn bộ đồng minh; bản thân nhận gấp đôi lượng khiên đó.
- **3★:** Rồng Đất dựng tường đất, tạo khiên bằng (64 + 0.28 x DEF) cho toàn bộ đồng minh; bản thân nhận gấp đôi lượng khiên đó.
- **Skin/cosmetic đang authored:** stoneThrone (achievement runsStarted_8): Đất Long → Nham Thạch Long → Địa Long Vương

### dryad_tree — Yêu Tinh Cây
- **Identity:** Tier 2; Hỗ trợ (SUPPORT); faction Huyền thoại (MYTHICAL); hệ Mộc (WOOD); species `yeu-tinh`.
- **Base stats 1★:** HP 301, ATK 27, DEF 15, MATK 69, MDEF 26, range 3, rageMax 4, crit 0.05, critDmg 1.5, evade 0.07, accuracy 0.95.
- **Vai trò chơi:** Trói pháp sư tuyến sau rồi hồi máu cho phe mình.
- **Đánh thường:** projectile, magic, 1×MATK, 1 kẻ địch gần nhất, single ×1.
- **Kỹ năng — Rễ Cây Ràng Buộc:** effect family `root_snare_debuff`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: 1-2 pháp sư hoặc hỗ trợ có MATK cao nhất (theo sao); hình: 1-2 mục tiêu gần điểm va chạm; chọn: địch có MATK cao nhất; số lượng: 1; thời lượng: 1 lượt.
- **1★:** Trói 1 pháp sư hoặc hỗ trợ có MATK cao nhất, gây (18 + 60% MATK) sát thương phép và làm câm lặng 1 lượt. Đồng thời hồi 10% HP tối đa cho bản thân.
- **2★:** Trói 1 pháp sư hoặc hỗ trợ có MATK cao nhất, gây (22 + 72% MATK) sát thương phép và làm câm lặng 2 lượt. Đồng thời hồi 15% HP tối đa cho bản thân và 15% HP tối đa cho 1 đồng minh có % máu thấp nhất.
- **3★:** Trói 2 pháp sư hoặc hỗ trợ có MATK cao nhất, mỗi mục tiêu chịu (25 + 84% MATK) sát thương phép và câm lặng 2 lượt. Đồng thời hồi 20% HP tối đa cho bản thân và 15% HP tối đa cho 1 đồng minh có % máu thấp nhất.
- **Skin/cosmetic đang authored:** bloomDryad (achievement runsStarted_12): Hoa Tinh Linh → Nữ Thần Hoa → Hoa Vương Rừng

### eagle_marksman — Đại Bàng Xạ Thủ
- **Identity:** Tier 3; Xạ thủ (ARCHER); faction Chim (AVIAN); hệ Phong (WIND); species `dai-bang`.
- **Base stats 1★:** HP 280, ATK 72, DEF 14, MATK 14, MDEF 14, range 4, rageMax 4, crit 0.2, critDmg 1.5, evade 0.1, accuracy 0.95.
- **Vai trò chơi:** Rải mưa tên lên hậu tuyến rồi ghim chặt các carry nhiều nộ bằng loạt tên bồi.
- **Đánh thường:** tầm xa/projectile, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Mưa Tên:** effect family `arrow_rain`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: 4 kẻ địch không trùng mục tiêu; hình: 4 ô mục tiêu rải trên bàn địch; chọn: Ưu tiên hậu tuyến; trong đó ưu tiên pháp sư và hỗ trợ.; số lượng: 4 mục tiêu; thời lượng: tức thì.
- **1★:** Bắn 4 mũi tên vào 4 kẻ địch không trùng mục tiêu, mỗi mũi gây (12 + 0.5 x ATK) x Hệ số sao (1) = (12 + 0.5 x 72) x 1 = 48 (ATK). Ưu tiên hậu tuyến; trong đó ưu tiên pháp sư và hỗ trợ.
- **2★:** Bắn 4 mũi tên vào 4 kẻ địch không trùng mục tiêu, mỗi mũi gây (14 + 0.6 x ATK) x Hệ số sao (1.2) = (14 + 0.6 x 115) x 1.2 = 100 (ATK). Ưu tiên kẻ địch đánh xa trước; nếu không còn thì mới chọn tiền tuyến. Mục tiêu trúng tên bị Ghim Cánh, giảm 15% né tránh trong 2 lượt. Kẻ địch nhiều nộ nhất trong số các mục tiêu trúng tên mất 1 nộ.
- **3★:** Bắn 4 mũi tên vào 4 kẻ địch không trùng mục tiêu, mỗi mũi gây (15 + 0.65 x ATK) x Hệ số sao (1.4) = (15 + 0.65 x 180) x 1.4 = 185 (ATK). Ưu tiên kẻ địch đánh xa trước; nếu không còn thì mới chọn tiền tuyến. Mục tiêu trúng tên bị Ghim Cánh, giảm 20% né tránh trong 2 lượt. Kẻ địch nhiều nộ nhất trong số các mục tiêu trúng tên mất 1 nộ. Sau loạt bắn, bắn thêm 2 mũi vào tối đa 2 kẻ địch có nộ cao nhất, mỗi mũi gây [(15 + 0.65 x ATK) x Hệ số sao (1.4)] x Hệ số Mũi Phụ (1.3) = [(15 + 0.65 x 180) x 1.4] x 1.3 = 241 (ATK) và đốt 1 nộ. Nếu mục tiêu đã trúng mưa tên trước đó, mũi phụ lên mục tiêu đó gây [(15 + 0.65 x ATK) x Hệ số sao (1.4)] x Hệ số Khóa Mục Tiêu (1.6) = [(15 + 0.65 x 180) x 1.4] x 1.6 = 296 (ATK).
- **Skin/cosmetic đang authored:** skyMarksman (achievement runsStarted_16): Bắn Tỉa Trời → Điêu Xạ → Thiên Điêu Xạ Vương

### elephant_guard — Voi Thiết Giáp
- **Identity:** Tier 4; Đỡ đòn (TANKER); faction Thú (BEAST); hệ Nham (STONE); species `voi`.
- **Base stats 1★:** HP 560, ATK 55, DEF 45, MATK 14, MDEF 35, range 1, rageMax 5, crit 0.05, critDmg 1.5, evade 0.05, accuracy 0.95.
- **Vai trò chơi:** Giẫm tạo chấn động 3x3 để giữ tuyến trước và khóa cứng nhiều mục tiêu.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Voi Giẫm Đạp:** effect family `aoe_circle_stun`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: 1 kẻ địch trong hàng địch đông nhất làm tâm chấn; hình: vùng vuông 3x3 quanh tâm; chọn: Ưu tiên hàng địch có nhiều mục tiêu nhất.; số lượng: vùng 3x3; thời lượng: choáng 1 lượt (35%).
- **1★:** Giẫm mạnh vào 1 kẻ địch trong hàng địch đông nhất, gây (35 + 100% ATK) sát thương vật lý trong vùng vuông 3x3 quanh mục tiêu làm tâm chấn. Tối đa 1 kẻ địch trong vùng bị choáng 1 lượt với 35% tỉ lệ.
- **2★:** Giẫm mạnh vào 1 kẻ địch trong hàng địch đông nhất, gây (42 + 120% ATK) sát thương vật lý trong vùng vuông 3x3 quanh mục tiêu làm tâm chấn. Tối đa 2 kẻ địch trong vùng bị choáng 1 lượt với 35% tỉ lệ.
- **3★:** Giẫm mạnh vào 1 kẻ địch trong hàng địch đông nhất, gây (51 + 145% ATK) sát thương vật lý trong vùng vuông 3x3 quanh mục tiêu làm tâm chấn. Tối đa 3 kẻ địch trong vùng bị choáng 1 lượt với 35% tỉ lệ.
- **Skin/cosmetic đang authored:** ivoryBulwark (achievement runsStarted_20): Ngà Vệ Sĩ → Thành Ngà → Ngà Vương Thần

### fairy_forest — Tiên Rừng
- **Identity:** Tier 2; Hỗ trợ (SUPPORT); faction Huyền thoại (MYTHICAL); hệ Mộc (WOOD); species `tien`.
- **Base stats 1★:** HP 268, ATK 26, DEF 17, MATK 71, MDEF 28, range 3, rageMax 4, crit 0.05, critDmg 1.5, evade 0.07, accuracy 0.95.
- **Vai trò chơi:** Triệu hồi suối nguồn để hồi máu toàn đội và thanh tẩy giao tranh.
- **Đánh thường:** projectile, magic, 1×MATK, 1 kẻ địch gần nhất, single ×1.
- **Kỹ năng — Suối Nguồn:** effect family `spring_aoe_heal`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: toàn bộ đồng minh; hình: toàn vùng đội hình đồng minh; chọn: Ảnh hưởng toàn bộ đồng minh đang sống.; số lượng: toàn bộ đồng minh; thời lượng: tức thì.
- **1★:** Hồi cho toàn bộ đồng minh lượng máu bằng (25 + 50% MATK).
- **2★:** Hồi cho toàn bộ đồng minh lượng máu bằng (35 + 70% MATK) và thanh tẩy 1 hiệu ứng bất lợi trên mỗi mục tiêu.
- **3★:** Hồi cho toàn bộ đồng minh lượng máu bằng (45 + 90% MATK), thanh tẩy 1 hiệu ứng bất lợi và thêm 20 khiên cho mỗi mục tiêu.
- **Skin/cosmetic đang authored:** mossWaltz (achievement runsStarted_30): Vũ Điệu Rêu → Tiên Rừng → Nữ Hoàng Rêu

### falcon_dive — Chim Non Lao
- **Identity:** Tier 3; Xạ thủ (ARCHER); faction Chim (AVIAN); hệ Hỏa (FIRE); species `cat-lao`.
- **Base stats 1★:** HP 242, ATK 61, DEF 12, MATK 13, MDEF 12, range 4, rageMax 4, crit 0.2, critDmg 1.5, evade 0.1, accuracy 0.95.
- **Vai trò chơi:** Phóng lao xuyên một hàng địch và trừng phạt cụm đứng dày.
- **Đánh thường:** projectile, physical, 1×ATK, 1 kẻ địch gần nhất.
- **Kỹ năng — Lao Xuyên:** effect family `piercing_shot`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: toàn bộ địch cùng hàng với mục tiêu; hình: đường thẳng xuyên hàng; chọn: hàng địch đông nhất; số lượng: 1; thời lượng: 2 lượt + thiêu đốt 2 lượt.
- **1★:** Phóng lao vào hàng địch đông nhất, gây (18 + 70% ATK) sát thương vật lý lên tối đa 2 kẻ địch trong hàng đó; mục tiêu đứng sau chịu 82% sát thương của mục tiêu trước.
- **2★:** Phóng lao vào hàng địch đông nhất, gây (22 + 84% ATK) sát thương vật lý lên tối đa 3 kẻ địch trong hàng đó; mục tiêu đứng sau chịu 82% sát thương của mục tiêu trước. Mục tiêu trúng đòn bị thiêu đốt 14 mỗi lượt trong 2 lượt và giảm 10 ATK trong 1 lượt.
- **3★:** Phóng lao vào hàng địch đông nhất, gây (25 + 98% ATK) sát thương vật lý lên toàn bộ kẻ địch trong hàng đó; mục tiêu đứng sau chịu 82% sát thương của mục tiêu trước. Mục tiêu trúng đòn bị thiêu đốt 16 mỗi lượt trong 3 lượt và giảm 15 ATK trong 2 lượt. Nếu xuyên trúng từ 3 mục tiêu trở lên, các mục tiêu trúng đòn nhận gấp đôi sát thương lửa trong 2 lượt.
- **Skin/cosmetic đang authored:** Chỉ dùng ngoại hình mặc định hiện tại.

### ferret_shadow — Chồn Hương Bóng
- **Identity:** Tier 3; Sát thủ (ASSASSIN); faction Thú (BEAST); hệ Dạ (NIGHT); species `chon-huong`.
- **Base stats 1★:** HP 278, ATK 86, DEF 18, MATK 22, MDEF 16, range 1, rageMax 4, crit 0.25, critDmg 1.5, evade 0.15, accuracy 0.95.
- **Vai trò chơi:** Sát thủ backstab dồn sát thương vào carry tuyến sau có ATK cao.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Cắn Gáy:** effect family `backstab_crit`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: kẻ địch ở tuyến sau và có ATK cao nhất; hình: 1 ô khóa mục tiêu; chọn: mục tiêu ở cột cuối cùng phía địch có ATK cao nhất; số lượng: 1; thời lượng: tức thì.
- **1★:** Ưu tiên kẻ địch tuyến sau có ATK cao nhất, gây (30 + 120% ATK) sát thương vật lý. Nếu tấn công từ phía sau, sát thương tăng lên 150%.
- **2★:** Ưu tiên kẻ địch tuyến sau có ATK cao nhất, gây (30 + 120% ATK) sát thương vật lý. Nếu tấn công từ phía sau, sát thương tăng lên 150%. Sau cú cắn gáy, gây thêm 1 đòn trễ bằng 55% sát thương cú đầu.
- **3★:** Ưu tiên kẻ địch tuyến sau có ATK cao nhất, gây (30 + 120% ATK) sát thương vật lý. Nếu tấn công từ phía sau, sát thương tăng lên 150%. Sau cú cắn gáy, gây thêm 1 đòn trễ bằng 70% sát thương cú đầu và đòn trễ xuyên 35% giáp.
- **Skin/cosmetic đang authored:** shadowBurrow (achievement shopRefreshes_1): Hang Bóng → Chồn Bóng Tối → Huyền Ẩn Sát Vương

### firefly_heal — Đom Đóm Chữa
- **Identity:** Tier 1; Hỗ trợ (SUPPORT); faction Côn trùng (INSECT); hệ Linh (SPIRIT); species `dom-chua`.
- **Base stats 1★:** HP 252, ATK 22, DEF 16, MATK 63, MDEF 27, range 3, rageMax 4, crit 0.05, critDmg 1.5, evade 0.07, accuracy 0.95.
- **Vai trò chơi:** Thanh tẩy và hồi máu cho đồng minh có % máu thấp nhất.
- **Đánh thường:** projectile, magic, 1×MATK, 1 kẻ địch gần nhất, single ×1.
- **Kỹ năng — Ánh Sáng Chữa Lành:** effect family `light_purify`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: 2 đồng minh có % máu thấp nhất; hình: chọn nhiều đồng minh theo độ thấp máu; chọn: Ưu tiên đồng minh có % máu thấp nhất theo thứ tự.; số lượng: 2 đồng minh; thời lượng: tức thì.
- **1★:** Thanh tẩy 1 debuff cho 2 đồng minh có % máu thấp nhất và hồi 20 HP mỗi mục tiêu.
- **2★:** Thanh tẩy 2 debuff cho 3 đồng minh có % máu thấp nhất và hồi 30 HP mỗi mục tiêu.
- **3★:** Thanh tẩy 2 debuff cho 4 đồng minh có % máu thấp nhất, hồi 40 HP và tạo 20 khiên cho mỗi mục tiêu.
- **Skin/cosmetic đang authored:** lanternMender (achievement shopRefreshes_5): Lồng Đèn → Đèn Trị Liệu → Thiên Đăng Vương

### firefly_light — Đom Đóm Sáng
- **Identity:** Tier 3; Pháp sư (MAGE); faction Côn trùng (INSECT); hệ Hỏa (FIRE); species `dom-dom`.
- **Base stats 1★:** HP 311, ATK 21, DEF 12, MATK 91, MDEF 23, range 4, rageMax 5, crit 0.1, critDmg 1.5, evade 0.05, accuracy 0.95.
- **Vai trò chơi:** Phát chớp sáng toàn bàn để làm mù các mục tiêu nguy hiểm nhất.
- **Đánh thường:** tầm xa/projectile, magic từ MATK, 1×MATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Lóe Sáng:** effect family `flash_blind`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: toàn bộ kẻ địch; làm mù 3 kẻ địch có ATK cao nhất; hình: toàn bàn địch; chọn: Gây sát thương toàn bàn trước, rồi chọn các kẻ địch có ATK cao nhất để làm mù.; số lượng: toàn bộ kẻ địch / làm mù 3; thời lượng: giảm 10 ATK hoặc MATK trong 2 lượt.
- **1★:** Phát chớp sáng lên toàn bộ kẻ địch, gây (18 + 55% MATK) sát thương phép. Làm mù 3 kẻ địch có ATK cao nhất, khiến chúng giảm 10 ATK hoặc MATK trong 2 lượt.
- **2★:** Phát chớp sáng lên toàn bộ kẻ địch, gây (19 + 57.2% MATK) sát thương phép. Làm mù 4 kẻ địch có ATK cao nhất, khiến chúng giảm 10 ATK hoặc MATK trong 2 lượt.
- **3★:** Phát chớp sáng lên toàn bộ kẻ địch, gây (19 + 59.4% MATK) sát thương phép. Làm mù 4 kẻ địch có ATK cao nhất, ưu tiên các mục tiêu đánh xa ở tuyến sau, khiến chúng giảm 11 ATK hoặc MATK trong 2 lượt.
- **Skin/cosmetic đang authored:** prismBeacon (achievement shopRefreshes_10): Lăng Kính → Ngọn Hải Đăng → Lăng Kính Vương

### flamingo_shot — Hồng Hạc Bắn
- **Identity:** Tier 3; Xạ thủ (ARCHER); faction Chim (AVIAN); hệ Hỏa (FIRE); species `hong-hac`.
- **Base stats 1★:** HP 291, ATK 75, DEF 14, MATK 14, MDEF 14, range 4, rageMax 4, crit 0.2, critDmg 1.5, evade 0.1, accuracy 0.95.
- **Vai trò chơi:** Bắn tên lửa cháy vào tuyến sau và lan lửa khi kết liễu.
- **Đánh thường:** tầm xa/projectile, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Tên Lửa Hồng:** effect family `fire_arrow_burn`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: kẻ địch có % máu thấp nhất; hình: đơn mục tiêu, lan 1 kẻ địch khác cùng hàng; chọn: Ưu tiên kẻ địch có % máu thấp nhất; từ 2 sao ưu tiên xạ thủ, pháp sư hoặc hỗ trợ.; số lượng: 1 mục tiêu chính + 1 kẻ địch khác cùng hàng; thời lượng: thiêu đốt 3 lượt.
- **1★:** Bắn 1 kẻ địch có % máu thấp nhất, gây (28 + 100% ATK) sát thương vật lý và thiêu đốt 12 mỗi lượt trong 3 lượt. Lửa lan sang 1 kẻ địch khác cùng hàng với 75% sát thương đòn chính.
- **2★:** Bắn 1 xạ thủ, pháp sư hoặc hỗ trợ có % máu thấp nhất, gây (28 + 100% ATK) sát thương vật lý và thiêu đốt 18 mỗi lượt trong 3 lượt. Lửa lan sang 1 kẻ địch khác cùng hàng với 75% sát thương đòn chính.
- **3★:** Bắn 1 xạ thủ, pháp sư hoặc hỗ trợ có % máu thấp nhất, gây (28 + 100% ATK) sát thương vật lý và thiêu đốt 25 mỗi lượt trong 3 lượt. Lửa lan sang 1 kẻ địch khác cùng hàng với 75% sát thương đòn chính. Nếu kết liễu, lửa bùng sang 1 kẻ địch kề bên, thiêu đốt 14 mỗi lượt trong 2 lượt.
- **Skin/cosmetic đang authored:** roseVolley (achievement shopRefreshes_20): Hồng Liệt → Cánh Hồng → Hồng Vương Xạ Thủ

### fox_flame — Cáo Hỏa
- **Identity:** Tier 1; Sát thủ (ASSASSIN); faction Thú (BEAST); hệ Hỏa (FIRE); species `cao`.
- **Base stats 1★:** HP 235, ATK 73, DEF 15, MATK 18, MDEF 13, range 1, rageMax 4, crit 0.25, critDmg 1.5, evade 0.15, accuracy 0.95.
- **Vai trò chơi:** Sát thủ lửa lao vào cột cuối để đốt mục tiêu máu mỏng.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Lửa Cáo:** effect family `flame_combo`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: 1 kẻ địch ở cột cuối cùng phía địch có % máu thấp nhất; hình: 1 ô khóa mục tiêu; chọn: Ưu tiên cột cuối cùng phía địch, rồi chọn kẻ địch có % máu thấp nhất trong cột đó.; số lượng: 1 mục tiêu; thời lượng: thiêu đốt 2 lượt.
- **1★:** Lao vào 1 kẻ địch ở cột cuối cùng phía địch có % máu thấp nhất, gây (18 + 75% ATK) sát thương vật lý và thiêu đốt 15 mỗi lượt trong 2 lượt.
- **2★:** Lao vào 1 pháp sư hoặc hỗ trợ ở cột cuối cùng phía địch; nếu không có thì nhắm kẻ địch ở đó có % máu thấp nhất, gây (18 + 75% ATK) sát thương vật lý và thiêu đốt 18 mỗi lượt trong 2 lượt.
- **3★:** Lao vào 1 pháp sư hoặc hỗ trợ ở cột cuối cùng phía địch; nếu không có thì nhắm kẻ địch ở đó có % máu thấp nhất, gây (18 + 75% ATK) sát thương vật lý và thiêu đốt 18 mỗi lượt trong 2 lượt. Nếu kết liễu mục tiêu, thiêu đốt thêm 1 kẻ địch kề bên 18 mỗi lượt trong 2 lượt.
- **Skin/cosmetic đang authored:** emberTrick (achievement shopRefreshes_30): Lửa Mẹo → Hỏa Hồ → Hồ Ly Hỏa Vương

### garuda_divine — Garuda Thần
- **Identity:** Tier 5; Xạ thủ (ARCHER); faction Huyền thoại (MYTHICAL); hệ Linh (SPIRIT); species `garuda`.
- **Base stats 1★:** HP 357, ATK 93, DEF 19, MATK 19, MDEF 21, range 4, rageMax 4, crit 0.2, critDmg 1.5, evade 0.1, accuracy 0.95.
- **Vai trò chơi:** Rải kim thần lên nhiều mục tiêu rồi khóa kẻ nhiều nộ nhất.
- **Đánh thường:** tầm xa/projectile, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Bão Kim Thần:** effect family `random_multi`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: 4 kẻ địch khác nhau; hình: rải ngẫu nhiên trên bàn địch; chọn: Chọn 4 mục tiêu khác nhau, không trùng đích.; số lượng: 4 mục tiêu; thời lượng: tức thì.
- **1★:** Phóng 4 kim thần vào 4 kẻ địch khác nhau, mỗi kim gây (42 + 150% ATK) sát thương vật lý.
- **2★:** Phóng 5 kim thần vào 5 kẻ địch khác nhau, mỗi kim gây (44 + 156% ATK) sát thương vật lý. Ưu tiên mục tiêu có % máu thấp nhất.
- **3★:** Phóng 5 kim thần vào 5 kẻ địch khác nhau, mỗi kim gây (46 + 162% ATK) sát thương vật lý. Ưu tiên mục tiêu có % máu thấp nhất; kim cuối khóa kẻ địch có nộ cao nhất nếu chưa trúng.
- **Skin/cosmetic đang authored:** celestialHerald (achievement shopRefreshes_50): Sứ Giả Trời → Thiên Sứ → Thiên Vương Garuda

### golem_stone — Golem Đá
- **Identity:** Tier 3; Đỡ đòn (TANKER); faction Huyền thoại (MYTHICAL); hệ Nham (STONE); species `golem`.
- **Base stats 1★:** HP 495, ATK 56, DEF 42, MATK 14, MDEF 33, range 1, rageMax 5, crit 0.05, critDmg 1.5, evade 0.05, accuracy 0.95.
- **Vai trò chơi:** đập mạnh xuống đất cắm mỏ neo khiêu khích toàn địch tập trung vào mình và tạo khiên bảo vệ
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Mỏ Neo Đá:** effect family `damage_shield_taunt`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: kẻ địch tuyến trước bị khóa; hình: 1 ô điểm tiền tuyến; chọn: địch gần tuyến trước nhất; số lượng: 1; thời lượng: tức thì.
- **1★:** Đập 1 kẻ địch tuyến trước bị khóa, gây (15 + 40% DEF) sát thương vật lý. Bản thân nhận khiên bằng (40 + 25% DEF) và khiêu khích toàn bộ kẻ địch trong 2 lượt.
- **2★:** Đập 1 kẻ địch tuyến trước bị khóa, gây (15 + 40% DEF) sát thương vật lý. Bản thân nhận khiên bằng (48 + 25% DEF) và khiêu khích toàn bộ kẻ địch trong 2 lượt.
- **3★:** Đập 1 kẻ địch tuyến trước bị khóa, gây (15 + 40% DEF) sát thương vật lý. Bản thân nhận khiên bằng (56 + 25% DEF), khiêu khích toàn bộ kẻ địch trong 2 lượt, và đồng minh gần nhất nhận thêm 35% lượng khiên này.
- **Skin/cosmetic đang authored:** basaltCore (achievement shopRefreshes_75): Lõi Huyền Vũ → Nham Thạch Cốt → Huyền Vũ Vương

### gorilla_smash — Đười Ươi Phẫn Nộ
- **Identity:** Tier 4; Đấu sĩ (FIGHTER); faction Thú (BEAST); hệ Nham (STONE); species `vuon`.
- **Base stats 1★:** HP 370, ATK 90, DEF 28, MATK 19, MDEF 22, range 1, rageMax 3, crit 0.05, critDmg 1.5, evade 0.08, accuracy 0.95.
- **Vai trò chơi:** Đấm lan vùng vuông quanh mục tiêu tiền tuyến và phá giáp.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Cú Đấm Ngàn Cân:** effect family `cleave_armor_break`; cost nộ 1★/2★/3★ = **1/2/3**. mục tiêu: ô kẻ địch gần tuyến trước nhất; hình: vùng vuông 3x3 quanh mục tiêu; chọn: Ưu tiên kẻ địch gần tuyến trước nhất làm tâm vùng nện.; số lượng: vùng vuông 3x3; thời lượng: 2 lượt.
- **1★:** Đấm xuống ô kẻ địch gần tuyến trước nhất, gây (35 + 120% ATK) sát thương vật lý trong vùng vuông 3x3 và phá 15 giáp trong 2 lượt.
- **2★:** Đấm xuống ô kẻ địch gần tuyến trước nhất, gây (35 + 120% ATK) sát thương vật lý trong vùng vuông 3x3 và phá 20 giáp trong 2 lượt.
- **3★:** Đấm xuống ô kẻ địch gần tuyến trước nhất, gây (35 + 120% ATK) sát thương vật lý trong vùng vuông 5x5 và phá 25 giáp trong 3 lượt.
- **Skin/cosmetic đang authored:** ironRumble (achievement shopRefreshes_100): Sắt Đấm → Vượn Sắt → Thiết Quyền Vương

### hawk_hunter — Diều Hâu Săn
- **Identity:** Tier 2; Xạ thủ (ARCHER); faction Chim (AVIAN); hệ Phong (WIND); species `dieu-hau`.
- **Base stats 1★:** HP 256, ATK 64, DEF 14, MATK 12, MDEF 14, range 4, rageMax 3, crit 0.2, critDmg 1.5, evade 0.1, accuracy 0.95.
- **Vai trò chơi:** Kết liễu mục tiêu máu yếu và ưu tiên carry tuyến sau.
- **Đánh thường:** tầm xa/projectile, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Tầm Nhiệt:** effect family `heat_seek`; cost nộ 1★/2★/3★ = **1/2/3**. mục tiêu: 1 kẻ địch có % máu thấp nhất; hình: 1 ô khóa mục tiêu; chọn: Ưu tiên kẻ địch có % máu thấp nhất trên bàn địch.; số lượng: 1 mục tiêu; thời lượng: tức thì.
- **1★:** Bắn vào 1 kẻ địch có % máu thấp nhất, gây (20 + 0.75 x ATK) x Hệ số sao (1) = (20 + 0.75 x 59) x 1 = 64 (ATK). Nếu mục tiêu còn dưới 45% máu, sát thương tăng theo Hệ số Kết Liễu (1.8).
- **2★:** Ưu tiên 1 kẻ địch đánh xa ở cột cuối cùng phía địch có % máu thấp nhất, gây (20 + 0.75 x ATK) x Hệ số sao (1.2) = (20 + 0.75 x 94) x 1.2 = 109 (ATK). Nếu không có thì vẫn nhắm 1 kẻ địch có % máu thấp nhất. Nếu mục tiêu còn dưới 50% máu, sát thương tăng theo Hệ số Kết Liễu (2).
- **3★:** Ưu tiên 1 pháp sư hoặc hỗ trợ ở cột cuối cùng phía địch có % máu thấp nhất, gây (20 + 0.75 x ATK) x Hệ số sao (1.4) = (20 + 0.75 x 148) x 1.4 = 183 (ATK). Nếu không có thì nhắm 1 kẻ địch nhiều nộ nhất. Nếu mục tiêu còn dưới 60% máu, sát thương tăng theo Hệ số Kết Liễu (2). Nếu kết liễu mục tiêu, hồi 1 nộ.
- **Skin/cosmetic đang authored:** ridgeHunter (achievement shopRefreshes_150): Săn Núi → Diều Săn → Thiên Điêu Săn Vương

### heron_pierce — Diệc Xuyên
- **Identity:** Tier 2; Xạ thủ (ARCHER); faction Chim (AVIAN); hệ Thủy (TIDE); species `diec`.
- **Base stats 1★:** HP 274, ATK 70, DEF 14, MATK 15, MDEF 14, range 4, rageMax 4, crit 0.2, critDmg 1.5, evade 0.1, accuracy 0.95.
- **Vai trò chơi:** Bắn mỏ kẹp vào carry vật lý để tước khí và ghim nhịp đánh.
- **Đánh thường:** tầm xa/projectile, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Mỏ Kẹp:** effect family `beak_disarm`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: 1 kẻ địch có ATK cao nhất; hình: 1 ô khóa mục tiêu; chọn: Ưu tiên kẻ địch có ATK cao nhất.; số lượng: 1; thời lượng: tước khí 1 lượt.
- **1★:** Bắn mỏ kẹp vào 1 kẻ địch có ATK cao nhất, gây (20 + 0.8 x ATK) x Hệ số sao (1) = (20 + 0.8 x 70) x 1 = 76 (ATK). Mục tiêu bị tước khí 1 lượt.
- **2★:** Bắn mỏ kẹp vào 1 kẻ địch có ATK cao nhất, gây (20 + 0.8 x ATK) x Hệ số sao (1.2) = (20 + 0.8 x 112) x 1.2 = 131 (ATK). Mục tiêu bị tước khí 2 lượt.
- **3★:** Bắn mỏ kẹp vào 1 kẻ địch có ATK cao nhất, gây (20 + 0.8 x ATK) x Hệ số sao (1.4) = (20 + 0.8 x 175) x 1.4 = 224 (ATK). Mục tiêu bị tước khí 2 lượt. Mũi phụ lan sang 1 kẻ địch gần nhất, gây [(20 + 0.8 x ATK) x Hệ số sao (1.4)] x Hệ số Mũi Phụ (0.7) = [(20 + 0.8 x 175) x 1.4] x 0.7 = 157 (ATK).
- **Skin/cosmetic đang authored:** windLance (achievement shopRefreshes_250): Mũi Gió → Phong Thương → Phong Thương Vương

### hippo_maul — Hà Mã Nện
- **Identity:** Tier 3; Đấu sĩ (FIGHTER); faction Thú (BEAST); hệ Thủy (TIDE); species `ha-ma`.
- **Base stats 1★:** HP 362, ATK 78, DEF 23, MATK 18, MDEF 18, range 1, rageMax 5, crit 0.05, critDmg 1.5, evade 0.08, accuracy 0.95.
- **Vai trò chơi:** Nện vùng nón phía trước và rút nộ của cụm địch.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Nện Bùn:** effect family `cone_smash`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: cụm địch gần tuyến trước nhất; hình: vùng nón phía trước, tối đa 5 ô; chọn: Ưu tiên cụm địch gần tuyến trước nhất làm tâm vùng nón.; số lượng: vùng nón tối đa 5 ô; thời lượng: tức thì.
- **1★:** Nện vùng nón phía trước, gây (28 + 110% ATK) sát thương vật lý lên tối đa 5 kẻ địch trong cụm gần tuyến trước nhất.
- **2★:** Nện vùng nón phía trước, gây (28 + 110% ATK) sát thương vật lý lên tối đa 5 kẻ địch trong cụm gần tuyến trước nhất. Mỗi mục tiêu trúng đòn mất 1 nộ.
- **3★:** Nện vùng nón phía trước, gây (28 + 110% ATK) sát thương vật lý lên tối đa 5 kẻ địch trong cụm gần tuyến trước nhất. Mỗi mục tiêu trúng đòn mất 1 nộ; đỡ đòn và đấu sĩ nhận thêm 20% sát thương.
- **Skin/cosmetic đang authored:** mudCrown (achievement xpPurchases_1): Vương Bùn → Hà Mã Bùn → Bùn Vương

### horse_charge — Ngựa Chiến
- **Identity:** Tier 2; Đấu sĩ (FIGHTER); faction Thú (BEAST); hệ Nham (STONE); species `ngua`.
- **Base stats 1★:** HP 331, ATK 69, DEF 22, MATK 15, MDEF 17, range 1, rageMax 5, crit 0.05, critDmg 1.5, evade 0.08, accuracy 0.95.
- **Vai trò chơi:** lao thẳng húc toàn bộ kẻ địch cùng hàng ngang
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Phi Nước Đại:** effect family `row_charge`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: hàng địch đông nhất; hình: quét toàn bộ một hàng địch; chọn: hàng địch đông nhất; số lượng: 1 hàng; thời lượng: giảm giáp 2 lượt.
- **1★:** Lao vào hàng địch đông nhất, gây (20 + 85% ATK) sát thương vật lý lên toàn bộ kẻ địch trong hàng đó.
- **2★:** Lao vào hàng địch đông nhất, gây (20 + 85% ATK) sát thương vật lý lên toàn bộ kẻ địch trong hàng đó. Cả hàng bị giảm 12 giáp trong 2 lượt.
- **3★:** Lao vào hàng địch đông nhất, gây (20 + 85% ATK) sát thương vật lý lên toàn bộ kẻ địch trong hàng đó. Cả hàng bị giảm 18 giáp trong 2 lượt; mục tiêu đứng đầu hàng chịu 120% sát thương.
- **Skin/cosmetic đang authored:** goldSaddle (achievement xpPurchases_3): Yên Vàng → Chiến Mã → Hoàng Kim Chiến Mã

### hydra_swamp — Cá Nóc Đầm Lầy
- **Identity:** Tier 4; Đỡ đòn (TANKER); faction Huyền thoại (MYTHICAL); hệ Thủy (TIDE); species `hydra`.
- **Base stats 1★:** HP 590, ATK 58, DEF 48, MATK 16, MDEF 38, range 1, rageMax 5, crit 0.05, critDmg 1.5, evade 0.05, accuracy 0.95.
- **Vai trò chơi:** Tự tái sinh rồi lan nhịp hồi máu sang nhóm đồng minh thấp máu nhất.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Tái Sinh Đa Đầu:** effect family `self_regen_team_heal`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: bản thân và 2 đồng minh có % máu thấp nhất; hình: bản thân trước, rồi nhóm đồng minh thấp máu; chọn: Tự hồi trước, rồi chọn các đồng minh có % máu thấp nhất còn sống.; số lượng: bản thân + 2 đồng minh; thời lượng: tức thì; tự hồi trước rồi hồi đồng minh.
- **1★:** Tự hồi 8% HP tối đa, rồi hồi 5% HP tối đa cho 2 đồng minh có % máu thấp nhất.
- **2★:** Tự hồi 10% HP tối đa, rồi hồi 6% HP tối đa cho 3 đồng minh có % máu thấp nhất.
- **3★:** Tự hồi 12% HP tối đa, rồi hồi 7% HP tối đa cho 3 đồng minh có % máu thấp nhất. Nếu sau khi tự hồi vẫn còn từ 60% HP trở lên, mở rộng hồi cho 4 đồng minh.
- **Skin/cosmetic đang authored:** marshCrown (achievement xpPurchases_5): Vương Đầm → Thủy Xà → Thủy Xà Vương

### hyena_pack — Linh Cẩu Bầy
- **Identity:** Tier 3; Hỗ trợ (SUPPORT); faction Thú (BEAST); hệ Dạ (NIGHT); species `linh-cau`.
- **Base stats 1★:** HP 339, ATK 29, DEF 17, MATK 74, MDEF 27, range 3, rageMax 3, crit 0.05, critDmg 1.5, evade 0.07, accuracy 0.95.
- **Vai trò chơi:** Hồi nộ cho nhóm đồng minh đang hụt nộ nhất.
- **Đánh thường:** tầm xa/projectile, magic từ MATK, 1×MATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Gọi Bầy:** effect family `pack_howl_rage`; cost nộ 1★/2★/3★ = **1/2/3**. mục tiêu: 2 đồng minh nộ thấp nhất; hình: nhóm đồng minh được chọn; chọn: đồng minh ít nộ nhất; số lượng: 2; thời lượng: tức thì.
- **1★:** Tru gọi bầy, hồi 1 nộ cho 2 đồng minh có nộ thấp nhất.
- **2★:** Tru gọi bầy, hồi 1 nộ cho 3 đồng minh có nộ thấp nhất.
- **3★:** Tru gọi bầy, hồi 2 nộ cho 3 đồng minh có nộ thấp nhất.
- **Skin/cosmetic đang authored:** packAlpha (achievement xpPurchases_10): Alpha Bầy → Thủ Lĩnh → Alpha Đại Vương

### ice_mage — Chuồn Chuồn Băng
- **Identity:** Tier 2; Pháp sư (MAGE); faction Côn trùng (INSECT); hệ Thủy (TIDE); species `chuon-chuon`.
- **Base stats 1★:** HP 268, ATK 17, DEF 10, MATK 78, MDEF 20, range 4, rageMax 5, crit 0.1, critDmg 1.5, evade 0.05, accuracy 0.95.
- **Vai trò chơi:** Gọi bão tuyết quét cột địch nguy hiểm nhất để hạ nhịp xả sát thương.
- **Đánh thường:** tầm xa/projectile, magic từ MATK, 1×MATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Bão Tuyết:** effect family `frost_storm`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: cột địch có tổng ATK cao nhất; hình: quét toàn bộ một cột địch; chọn: Ưu tiên cột địch có tổng ATK cao nhất.; số lượng: 1 cột; thời lượng: giảm 15 ATK/MATK theo vai trò trong 2 lượt.
- **1★:** Gọi bão tuyết quét 1 cột địch có tổng ATK cao nhất, gây (22 + 80% MATK) sát thương phép. Mục tiêu trong cột bị giảm 15 ATK hoặc MATK theo vai trò trong 2 lượt.
- **2★:** Gọi bão tuyết quét 1 cột địch có tổng ATK cao nhất, gây (22 + 80% MATK) sát thương phép. Mục tiêu trong cột bị giảm 18 ATK hoặc MATK theo vai trò trong 2 lượt.
- **3★:** Gọi bão tuyết quét 1 cột địch có tổng ATK cao nhất, gây (22 + 80% MATK) sát thương phép. Mục tiêu trong cột bị giảm 18 ATK hoặc MATK theo vai trò trong 2 lượt. Nếu cột có ít nhất 2 tướng đánh xa, 1 mục tiêu trong cột bị đóng băng 1 lượt.
- **Skin/cosmetic đang authored:** frostCharm (achievement xpPurchases_20): Bùa Băng → Pháp Sư Băng → Băng Vương Pháp Sư

### jaguar_hunt — Báo Đốm Săn
- **Identity:** Tier 1; Đấu sĩ (FIGHTER); faction Thú (BEAST); hệ Dạ (NIGHT); species `bao-dom`.
- **Base stats 1★:** HP 318, ATK 64, DEF 19, MATK 14, MDEF 16, range 1, rageMax 4, crit 0.05, critDmg 1.5, evade 0.08, accuracy 0.95.
- **Vai trò chơi:** Đổi máu lấy trạng thái săn máu rồi lao tới xé mồi bằng chuỗi đòn đánh thường
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Săn Máu:** effect family `self_blood_hunt`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: bản thân rồi 1 kẻ địch đang bị nhắm; hình: bản thân rồi 1 ô mục tiêu; chọn: bản thân tự kích hoạt trước, sau đó tung đòn đánh thường vào mục tiêu đang bị khóa; số lượng: bản thân và tối đa 1 kẻ địch trên mỗi đòn đánh thường; thời lượng: tức thì; trạng thái săn máu duy trì 2 lượt.
- **1★:** Tiêu hao 10% máu tối đa để nhận trạng thái săn máu trong 2 lượt. Mỗi cộng dồn khiến đòn đánh thường gây thêm chảy máu bằng 10% sát thương đòn đánh và hồi cho bản thân đúng phần đó. Cộng dồn tối đa 2 lần, rồi tung 1 đòn đánh thường.
- **2★:** Tiêu hao 30% máu tối đa để nhận trạng thái săn máu trong 2 lượt. Mỗi cộng dồn khiến đòn đánh thường gây thêm chảy máu bằng 10% sát thương đòn đánh và hồi cho bản thân đúng phần đó. Cộng dồn tối đa 3 lần. Sau đòn đánh đầu có 20% đánh thêm 1 lần nữa, tối đa 2 đòn đánh thường.
- **3★:** Tiêu hao 40% máu tối đa để nhận trạng thái săn máu trong 3 lượt. Mỗi cộng dồn khiến đòn đánh thường gây thêm chảy máu bằng 10% sát thương đòn đánh và hồi cho bản thân đúng phần đó. Cộng dồn tối đa 4 lần. Sau đòn đánh đầu có 50% đánh thêm 1 lần nữa, tối đa 3 đòn đánh thường. Chảy máu do chính Báo Đốm Săn gây ra sẽ cấm hồi máu khi Báo Đốm Săn còn trên sân.
- **Skin/cosmetic đang authored:** forestProwl (achievement xpPurchases_30): Rừng Săn → Báo Đêm → Báo Vương Rừng

### jellyfish_shock — Sứa Điện
- **Identity:** Tier 2; Pháp sư (MAGE); faction Thủy sinh (AQUATIC); hệ Thủy (TIDE); species `sua`.
- **Base stats 1★:** HP 266, ATK 18, DEF 11, MATK 77, MDEF 22, range 4, rageMax 5, crit 0.1, critDmg 1.5, evade 0.05, accuracy 0.95.
- **Vai trò chơi:** Chuỗi điện nhảy theo nộ để bẻ nhịp các carry chuẩn bị xả kỹ năng.
- **Đánh thường:** tầm xa/projectile, magic từ MATK, 1×MATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Dòng Điện Tê Liệt:** effect family `chain_shock`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: 2 kẻ địch có nộ cao nhất; hình: chuỗi chớp nảy không trùng mục tiêu; chọn: Ưu tiên lần lượt các kẻ địch có nộ cao nhất.; số lượng: 2 lần nảy không trùng mục tiêu; thời lượng: tức thì; lần nảy sau còn Hệ số Nảy (0.8) lần trước.
- **1★:** Phóng chuỗi điện qua 2 kẻ địch có nộ cao nhất. Mục tiêu đầu chịu (18 + 0.65 x MATK) x Hệ số sao (1) = (18 + 0.65 x 77) x 1 = 68 (MATK); mục tiêu sau nhận 68 x Hệ số Nảy (0.8) = 54 (MATK).
- **2★:** Phóng chuỗi điện qua 3 kẻ địch có nộ cao nhất. Mục tiêu đầu chịu (18 + 0.65 x MATK) x Hệ số sao (1.2) = (18 + 0.65 x 123) x 1.2 = 118 (MATK); lần nảy thứ hai gây 118 x Hệ số Nảy (0.8) = 94 (MATK); lần nảy thứ ba gây 118 x Hệ số Nảy (0.8) x Hệ số Nảy (0.8) = 76 (MATK). Hai mục tiêu đầu của chuỗi mỗi mục tiêu mất 1 nộ.
- **3★:** Phóng chuỗi điện qua 3 kẻ địch có nộ cao nhất. Mục tiêu đầu chịu (18 + 0.65 x MATK) x Hệ số sao (1.4) = (18 + 0.65 x 193) x 1.4 = 201 (MATK); lần nảy thứ hai gây 201 x Hệ số Nảy (0.8) = 161 (MATK); lần nảy thứ ba gây 201 x Hệ số Nảy (0.8) x Hệ số Nảy (0.8) = 129 (MATK). Mọi mục tiêu bị chuỗi chạm tới đều mất 1 nộ. Nếu chuỗi chạm đủ 3 mục tiêu, mục tiêu cuối bị câm lặng 1 lượt và tia điện dội ngược về mục tiêu đầu, gây 129 x Hệ số Dội Ngược (0.6) = 77 (MATK).
- **Skin/cosmetic đang authored:** reefCircuit (achievement xpPurchases_40): Mạch San Hô → Sứa Điện → Mạng Điện Vương

### kangaroo_kick — Kangaroo Đấm
- **Identity:** Tier 2; Đấu sĩ (FIGHTER); faction Thú (BEAST); hệ Phong (WIND); species `kangaroo`.
- **Base stats 1★:** HP 319, ATK 71, DEF 21, MATK 17, MDEF 17, range 1, rageMax 4, crit 0.05, critDmg 1.5, evade 0.08, accuracy 0.95.
- **Vai trò chơi:** Tung 2 cú đá liên tiếp vào tiền tuyến thấp giáp rồi chặn nhịp nộ.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Cú Đấm Bay:** effect family `double_hit`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: 1 kẻ địch đứng gần tuyến trước nhất và có DEF thấp nhất; hình: 1 ô điểm (2 nhát); chọn: Ưu tiên kẻ địch ở cột đầu tiên phía địch có DEF thấp nhất.; số lượng: 1 mục tiêu (ra đòn 2 lần); thời lượng: tức thì, ra đòn 2 lần.
- **1★:** Đá 2 lần vào kẻ địch ở cột đầu tiên phía địch có DEF thấp nhất, mỗi cú gây (22 + 90% ATK) sát thương vật lý.
- **2★:** Đá vào kẻ địch ở cột đầu tiên phía địch có DEF thấp nhất, rồi cú đá thứ hai ưu tiên kẻ địch nhiều nộ nhất, mỗi cú gây (22 + 90% ATK) sát thương vật lý.
- **3★:** Đá vào kẻ địch ở cột đầu tiên phía địch có DEF thấp nhất, rồi cú đá thứ hai ưu tiên kẻ địch nhiều nộ nhất, mỗi cú gây (22 + 90% ATK) sát thương vật lý. Nếu cú đầu hạ mục tiêu xuống dưới 55% máu, cú đá sau làm chậm 1 lượt.
- **Skin/cosmetic đang authored:** ringMaster (achievement xpPurchases_50): Võ Đài → Võ Sĩ → Quyền Vương Kangaroo

### kirin_thunder — Kỳ Lân Lôi
- **Identity:** Tier 5; Pháp sư (MAGE); faction Huyền thoại (MYTHICAL); hệ Phong (WIND); species `ky-lan`.
- **Base stats 1★:** HP 405, ATK 27, DEF 22, MATK 106, MDEF 38, range 4, rageMax 5, crit 0.1, critDmg 1.5, evade 0.05, accuracy 0.95.
- **Vai trò chơi:** Triệu hồi sét trời toàn bàn để khống chế địch nhiều nộ.
- **Đánh thường:** tầm xa/projectile, magic từ MATK, 1×MATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Phán Quyết Kỳ Lân:** effect family `global_stun`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: toàn bộ kẻ địch; choáng tối đa 2 kẻ địch nhiều nộ nhất; hình: toàn bộ bàn địch; chọn: Gây sát thương toàn bàn trước, rồi chọn các kẻ địch nhiều nộ nhất để choáng.; số lượng: toàn bộ kẻ địch / choáng tối đa 2; thời lượng: choáng 1 lượt (40%).
- **1★:** Triệu hồi sét trời lên toàn bộ kẻ địch, gây (45 + 110% MATK) sát thương phép. Có 40% làm choáng tối đa 2 kẻ địch nhiều nộ nhất trong 1 lượt.
- **2★:** Triệu hồi sét trời lên toàn bộ kẻ địch, gây (54 + 132% MATK) sát thương phép. Có 40% làm choáng tối đa 3 kẻ địch nhiều nộ nhất trong 1 lượt.
- **3★:** Triệu hồi sét trời lên toàn bộ kẻ địch, gây (65 + 159.5% MATK) sát thương phép. Có 95% làm choáng tối đa 3 kẻ địch nhiều nộ nhất trong 1 lượt.
- **Skin/cosmetic đang authored:** thunderHalo (achievement xpPurchases_75): Hào Quang Sét → Kỳ Lân Lôi → Lôi Vương Kỳ Lân

### komodo_bite — Kỳ Đà Khổng Lồ
- **Identity:** Tier 1; Đấu sĩ (FIGHTER); faction Bò sát (REPTILE); hệ Trùng (SWARM); species `ky-da`.
- **Base stats 1★:** HP 282, ATK 64, DEF 22, MATK 16, MDEF 18, range 1, rageMax 4, crit 0.05, critDmg 1.5, evade 0.08, accuracy 0.95.
- **Vai trò chơi:** Cắn tanker tiền tuyến để rải độc và bệnh kéo dài.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Nọc Độc Kỳ Đà:** effect family `single_strong_poison`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: mục tiêu ở cột đầu tiên phía địch có HP tối đa cao nhất; hình: 1 ô khóa mục tiêu; chọn: Ưu tiên mục tiêu ở cột đầu tiên phía địch có HP tối đa cao nhất.; số lượng: 1 mục tiêu; thời lượng: nhiễm độc 2 lượt.
- **1★:** Cắn mục tiêu ở cột đầu tiên phía địch có HP tối đa cao nhất, gây (18 + 80% ATK) sát thương vật lý và nhiễm độc 15 mỗi lượt trong 2 lượt.
- **2★:** Cắn mục tiêu ở cột đầu tiên phía địch có HP tối đa cao nhất, gây (18 + 80% ATK) sát thương vật lý và nhiễm độc 15 mỗi lượt trong 2 lượt. Mục tiêu còn mắc bệnh 8 mỗi lượt trong 2 lượt.
- **3★:** Cắn mục tiêu ở cột đầu tiên phía địch có HP tối đa cao nhất, gây (18 + 80% ATK) sát thương vật lý và nhiễm độc 15 mỗi lượt trong 2 lượt. Mục tiêu còn mắc bệnh 8 mỗi lượt trong 2 lượt. Nếu mục tiêu đang có khiên hoặc là đỡ đòn, độc kéo dài thêm 1 lượt.
- **Skin/cosmetic đang authored:** venomSpine (achievement xpPurchases_100): Gai Độc → Kỳ Đà Độc → Rồng Độc Vương

### kraken_deep — Xoáy Nước Khổng Lồ
- **Identity:** Tier 5; Đỡ đòn (TANKER); faction Thủy sinh (AQUATIC); hệ Thủy (TIDE); species `muc`.
- **Base stats 1★:** HP 680, ATK 58, DEF 58, MATK 20, MDEF 48, range 1, rageMax 5, crit 0.05, critDmg 1.5, evade 0.05, accuracy 0.95.
- **Vai trò chơi:** Khóa câm lặng tuyến trước để bẻ nhịp giao tranh.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Xúc Tu Kìm Kẹp:** effect family `single_silence_lock`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: 1 kẻ địch tuyến trước gần nhất; hình: 1 đòn đơn mục tiêu tuyến trước; chọn: Ưu tiên kẻ địch còn sống gần tuyến trước nhất.; số lượng: 1 mục tiêu; thời lượng: 2 lượt.
- **1★:** Quật 1 kẻ địch tuyến trước gần nhất, gây (40 + 80% DEF) sát thương vật lý và câm lặng 2 lượt.
- **2★:** Quật 2 kẻ địch tuyến trước gần nhất, mỗi mục tiêu chịu (48 + 96% DEF) sát thương vật lý và câm lặng 2 lượt.
- **3★:** Quật 2 kẻ địch tuyến trước gần nhất, mỗi mục tiêu chịu (56 + 112% DEF) sát thương vật lý, câm lặng 3 lượt và giảm 25% ATK hoặc MATK trong 3 lượt.
- **Skin/cosmetic đang authored:** abyssCrown (achievement unitsBought_1): Vương Vực Sâu → Thần Biển → Đại Dương Vương

### kraken_void — Kraken Hư Không
- **Identity:** Tier 5; Pháp sư (MAGE); faction Thủy sinh (AQUATIC); hệ Thủy (TIDE); species `bach-tuoc`.
- **Base stats 1★:** HP 480, ATK 30, DEF 25, MATK 105, MDEF 35, range 4, rageMax 5, crit 0.1, critDmg 1.5, evade 0.05, accuracy 0.95.
- **Vai trò chơi:** Rải xúc tu hư không ngẫu nhiên để bào né tránh cả đội hình địch.
- **Đánh thường:** tầm xa/projectile, magic từ MATK, 1×MATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Xúc Tu Hư Không:** effect family `random_multi`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: 4 kẻ địch ngẫu nhiên khác nhau; hình: 4 đòn đơn mục tiêu tách rời; chọn: Mỗi xúc tu chọn 1 kẻ địch còn sống chưa bị trúng trước đó theo thứ tự ngẫu nhiên.; số lượng: 4 mục tiêu; thời lượng: giảm né 2 lượt.
- **1★:** Gọi 4 xúc tu hư không, mỗi xúc tu bắn 1 kẻ địch ngẫu nhiên khác nhau, gây (40 + 120% MATK) sát thương phép và giảm 15% né tránh trong 2 lượt.
- **2★:** Gọi 5 xúc tu hư không, mỗi xúc tu bắn 1 kẻ địch ngẫu nhiên khác nhau, gây (48 + 144% MATK) sát thương phép và giảm 25% né tránh trong 2 lượt.
- **3★:** Gọi 6 xúc tu hư không, mỗi xúc tu bắn 1 kẻ địch ngẫu nhiên khác nhau, gây (56 + 168% MATK) sát thương phép và giảm 35% né tránh trong 2 lượt.
- **Skin/cosmetic đang authored:** voidHalo (achievement unitsBought_5): Hào Quang Hư Vô → Kraken Hư Không → Hư Không Vương

### lich_undead — Lich Bất Tử
- **Identity:** Tier 5; Pháp sư (MAGE); faction Huyền thoại (MYTHICAL); hệ Dạ (NIGHT); species `lich`.
- **Base stats 1★:** HP 490, ATK 38, DEF 28, MATK 108, MDEF 42, range 4, rageMax 5, crit 0.1, critDmg 1.5, evade 0.05, accuracy 0.95.
- **Vai trò chơi:** Giáng cột băng xuống một cột để khống chế các mục tiêu nguy hiểm.
- **Đánh thường:** tầm xa/projectile, magic từ MATK, 1×MATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Lời Nguyền Bất Tử:** effect family `column_freeze`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: toàn bộ địch trong cột của mục tiêu bị khóa; hình: 1 cột dọc; chọn: Khóa 1 mục tiêu, rồi áp hiệu ứng lên toàn bộ cột đó.; số lượng: 1 cột + 1 mục tiêu đóng băng; thời lượng: đóng băng 1 lượt (50%).
- **1★:** Triệu hồi cột băng lên cột của mục tiêu bị khóa, gây (48 + 130% MATK) sát thương phép cho toàn bộ địch trong cột. Mục tiêu có ATK cao nhất trong cột có 50% bị đóng băng 1 lượt.
- **2★:** Triệu hồi cột băng lên cột của mục tiêu bị khóa, gây (48 + 130% MATK) sát thương phép cho toàn bộ địch trong cột. 2 mục tiêu có ATK cao nhất trong cột có 60% bị đóng băng 1 lượt.
- **3★:** Triệu hồi cột băng lên cột của mục tiêu bị khóa, gây (48 + 130% MATK) sát thương phép cho toàn bộ địch trong cột. 3 mục tiêu có ATK cao nhất trong cột có 75% bị đóng băng 1 lượt.
- **Skin/cosmetic đang authored:** boneChoir (achievement unitsBought_10): Dàn Xương → Chỉ Huy Ma → Tử Linh Vương

### lion_general — Sư Tử Chiến Tướng
- **Identity:** Tier 5; Đấu sĩ (FIGHTER); faction Thú (BEAST); hệ Hỏa (FIRE); species `su-tu`.
- **Base stats 1★:** HP 503, ATK 97, DEF 40, MATK 21, MDEF 35, range 1, rageMax 5, crit 0.05, critDmg 1.5, evade 0.08, accuracy 0.95.
- **Vai trò chơi:** Gầm vang toàn bàn, choáng địch nhiều nộ và buff ATK cùng hàng.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Sư Tử Hống:** effect family `global_stun`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: toàn bộ kẻ địch; choáng tối đa 2 kẻ địch nhiều nộ nhất; hình: toàn bộ bàn địch; chọn: Gây sát thương toàn bàn trước, rồi chọn các mục tiêu nhiều nộ nhất để choáng.; số lượng: toàn bộ kẻ địch / choáng tối đa 2; thời lượng: choáng 1 lượt (40%); buff ATK hàng 2 lượt.
- **1★:** Gầm vang lên toàn bộ kẻ địch, gây (40 + 100% ATK) sát thương phép. Có 40% làm choáng tối đa 2 kẻ địch nhiều nộ nhất trong 1 lượt. Đồng minh cùng hàng nhận 18 ATK trong 2 lượt.
- **2★:** Gầm vang lên toàn bộ kẻ địch, gây (48 + 120% ATK) sát thương phép. Có 40% làm choáng tối đa 2 kẻ địch nhiều nộ nhất trong 1 lượt. Đồng minh cùng hàng nhận 22 ATK trong 2 lượt.
- **3★:** Gầm vang lên toàn bộ kẻ địch, gây (58 + 145% ATK) sát thương phép. Có 40% làm choáng tối đa 3 kẻ địch nhiều nộ nhất trong 1 lượt. Đồng minh cùng hàng nhận 26 ATK trong 2 lượt.
- **Skin/cosmetic đang authored:** lionBanner (achievement unitsBought_20): Cờ Sư Tử → Tướng Quân Sư → Sư Vương Đại Tướng

### lizard_elder — Rồng Đất Cổ
- **Identity:** Tier 5; Hỗ trợ (SUPPORT); faction Bò sát (REPTILE); hệ Nham (STONE); species `tac-ke`.
- **Base stats 1★:** HP 472, ATK 40, DEF 45, MATK 92, MDEF 40, range 3, rageMax 5, crit 0.05, critDmg 1.5, evade 0.07, accuracy 0.95.
- **Vai trò chơi:** Dựng giáp toàn đội rồi hồi máu cho đồng minh thấp máu nhất.
- **Đánh thường:** tầm xa/projectile, magic từ MATK, 1×MATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Phúc Lành Cổ Thụ:** effect family `team_def_buff`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: đồng minh thấp máu nhất (% máu thấp nhất); hình: toàn bộ bàn đồng minh; chọn: Bản thân, ưu tiên đồng minh thấp máu nhất.; số lượng: toàn đội + 1 mục tiêu thấp máu nhất; thời lượng: 3 lượt.
- **1★:** Rồng Đất Cổ dựng giáp toàn đội, hồi máu theo % HP tối đa cho đồng minh thấp máu nhất, rồi ở mốc cao còn bọc thêm khiên và làm dày tuyến sống sót.
- **2★:** Rồng Đất Cổ dựng giáp toàn đội, hồi máu theo % HP tối đa cho đồng minh thấp máu nhất, rồi đồng minh thấp máu nhất còn nhận thêm 32 khiên sau khi được hồi.
- **3★:** Rồng Đất Cổ dựng giáp toàn đội, hồi máu theo % HP tối đa cho đồng minh thấp máu nhất, rồi đồng minh thấp máu nhất nhận 36 khiên và giảm 18% sát thương trong 1 lượt.
- **Skin/cosmetic đang authored:** jadeScale (achievement unitsBought_30): Ngọc Bích → Trưởng Lão Ngọc → Ngọc Long Vương

### lynx_echo — Châu Chấu Gió
- **Identity:** Tier 4; Sát thủ (ASSASSIN); faction Côn trùng (INSECT); hệ Phong (WIND); species `bo-ngua`.
- **Base stats 1★:** HP 313, ATK 90, DEF 18, MATK 22, MDEF 16, range 1, rageMax 4, crit 0.25, critDmg 1.5, evade 0.15, accuracy 0.95.
- **Vai trò chơi:** Sát thủ hai nhịp lao sau chém rồi để lại đòn vọng kết liễu.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Ảnh Trảm:** effect family `single_delayed_echo`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: 1 kẻ địch ở tuyến sau và có ATK cao nhất; hình: 1 ô điểm + dội lại cùng ô; chọn: mục tiêu ở cột cuối cùng phía địch có ATK cao nhất; số lượng: 1 mục tiêu + vọng âm; thời lượng: tức thì + vọng âm trễ.
- **1★:** Ưu tiên kẻ địch tuyến sau có ATK cao nhất, gây (35 + 1.35 x ATK) sát thương vật lý. Sau đó tạo đòn vọng gây thêm (15 + 0.8 x ATK) sát thương vật lý lên cùng mục tiêu.
- **2★:** Ưu tiên kẻ địch tuyến sau có ATK cao nhất, gây (35 + 1.35 x ATK) sát thương vật lý. Sau đó tạo đòn vọng gây thêm (15 + 0.8 x ATK) sát thương vật lý lên cùng mục tiêu; đòn vọng gây thêm 25% sát thương nếu mục tiêu đang chịu hiệu ứng bất lợi.
- **3★:** Ưu tiên kẻ địch tuyến sau có ATK cao nhất, gây (35 + 1.35 x ATK) sát thương vật lý. Sau đó tạo đòn vọng gây thêm (15 + 0.8 x ATK) sát thương vật lý; nếu mục tiêu đang chịu hiệu ứng bất lợi thì đòn vọng tăng 25% sát thương, còn nếu mục tiêu chính chết thì đòn vọng nhảy sang pháp sư hoặc hỗ trợ tuyến sau gần nhất.
- **Skin/cosmetic đang authored:** echoRibbon (achievement unitsBought_50): Dải Vịng → Linh Miêu Gió → Dải Âm Vương

### mammoth_ancient — Voi Ma Mút
- **Identity:** Tier 5; Đỡ đòn (TANKER); faction Thú (BEAST); hệ Nham (STONE); species `voi-long`.
- **Base stats 1★:** HP 620, ATK 60, DEF 52, MATK 18, MDEF 42, range 1, rageMax 4, crit 0.05, critDmg 1.5, evade 0.05, accuracy 0.95.
- **Vai trò chơi:** Hét gọi bầy đàn để tăng nộ cho đội rồi giữ nhịp bằng tự hồi và hồi lan.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Tiếng Gọi Bầy Đàn:** effect family `team_rage_self_heal`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: các đồng minh khác + bản thân; hình: toàn đội; chọn: Cộng nộ cho toàn bộ đồng minh khác trước, rồi tự hồi máu.; số lượng: toàn đội; thời lượng: cộng nộ và hồi máu tức thì.
- **1★:** Phát tiếng gọi bầy đàn, cho các đồng minh khác 2 nộ và hồi 12% HP tối đa cho bản thân.
- **2★:** Phát tiếng gọi bầy đàn, cho các đồng minh khác 3 nộ và hồi 18% HP tối đa cho bản thân.
- **3★:** Phát tiếng gọi bầy đàn, cho các đồng minh khác 4 nộ, hồi 25% HP tối đa cho bản thân, đồng thời hồi 8% HP tối đa cho toàn bộ đồng minh khác.
- **Skin/cosmetic đang authored:** runeTusk (achievement unitsBought_75): Ngà Phù Văn → Vòi Rún → Ma Mút Vương

### mantis_blade — Bọ Ngựa Kiếm
- **Identity:** Tier 3; Sát thủ (ASSASSIN); faction Côn trùng (INSECT); hệ Trùng (SWARM); species `bo-ngua`.
- **Base stats 1★:** HP 310, ATK 88, DEF 20, MATK 15, MDEF 18, range 1, rageMax 3, crit 0.25, critDmg 1.5, evade 0.15, accuracy 0.95.
- **Vai trò chơi:** Lao chém hậu tuyến, bồi sát thương theo số Trùng sống rồi mở nhịp truy sát khi lên sao cao.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Kiếm Chém X:** effect family `x_slash_bleed`; cost nộ 1★/2★/3★ = **1/2/3**. mục tiêu: 1 kẻ địch hậu tuyến bị nhắm; hình: 1 đòn lao đơn mục tiêu vào hậu tuyến; chọn: Ưu tiên kẻ địch hậu tuyến bị nhắm.; số lượng: 1 mục tiêu; thời lượng: chảy máu 3 lượt.
- **1★:** Lao vào 1 kẻ địch hậu tuyến bị nhắm, gây (28 + 1.1 x ATK) x Hệ số sao (1) = (28 + 1.1 x 88) x 1 = 125 (ATK) sát thương vật lý. Mỗi đồng minh Trùng đang sống tăng thêm 5% sát thương cú chém. Mục tiêu chảy máu 12 mỗi lượt trong 3 lượt.
- **2★:** Lao vào 1 kẻ địch hậu tuyến bị nhắm, gây (28 + 1.1 x ATK) x Hệ số sao (1.2) = (28 + 1.1 x 88) x 1.2 = 150 (ATK) sát thương vật lý. Mỗi đồng minh Trùng đang sống tăng thêm 8% sát thương cú chém. Nếu có ít nhất 2 Trùng sống, mục tiêu bị giảm 15 DEF trong 2 lượt và mất 1 nộ. Mục tiêu chảy máu 16 mỗi lượt trong 3 lượt.
- **3★:** Lao vào 1 kẻ địch hậu tuyến bị nhắm, gây (28 + 1.1 x ATK) x Hệ số sao (1.4) = (28 + 1.1 x 88) x 1.4 = 175 (ATK) sát thương vật lý. Mỗi đồng minh Trùng đang sống tăng thêm 10% sát thương cú chém. Nếu có ít nhất 2 Trùng sống, mục tiêu bị giảm 15 DEF trong 2 lượt và mất 1 nộ. Mục tiêu chảy máu 20 mỗi lượt trong 4 lượt. Nếu có ít nhất 3 Trùng sống hoặc mục tiêu ngã vì cú chém, chém truy sang 1 kẻ địch hậu tuyến gần nhất, gây 80% sát thương của cú đầu và chảy máu 16 mỗi lượt trong 2 lượt.
- **Skin/cosmetic đang authored:** bladeAegis (achievement unitsBought_100): Lưỡi Khiên → Bọ Ngựa Lưỡi → Khiên Lưỡi Vương

### mink_silent — Chồn Mink Im
- **Identity:** Tier 3; Sát thủ (ASSASSIN); faction Thú (BEAST); hệ Phong (WIND); species `mink`.
- **Base stats 1★:** HP 275, ATK 81, DEF 17, MATK 22, MDEF 15, range 1, rageMax 3, crit 0.25, critDmg 1.5, evade 0.15, accuracy 0.95.
- **Vai trò chơi:** Ám sát hậu tuyến, khoan giáp mục tiêu bị suy yếu rồi truy bám khi kết liễu.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Ám Sát Thầm Lặng:** effect family `silent_kill_stealth`; cost nộ 1★/2★/3★ = **1/2/3**. mục tiêu: 1 kẻ địch hậu tuyến bị nhắm; hình: 1 đòn lao đơn mục tiêu vào hậu tuyến; chọn: Ưu tiên kẻ địch hậu tuyến đang chịu hiệu ứng bất lợi.; số lượng: 1 mục tiêu; thời lượng: giảm chính xác 2 lượt; tàng hình 2 lượt.
- **1★:** Lao vào 1 kẻ địch hậu tuyến bị nhắm, gây (32 + 1.2 x ATK) x Hệ số sao (1) = (32 + 1.2 x 81) x 1 = 129 (ATK) sát thương vật lý. Nếu mục tiêu đang chịu hiệu ứng bất lợi, cú cắn xuyên thêm 15% DEF. Mục tiêu giảm 15% chính xác trong 2 lượt. Nếu kết liễu mục tiêu, bản thân nhận 30% né tránh trong 2 lượt.
- **2★:** Lao vào 1 kẻ địch hậu tuyến bị nhắm, gây (32 + 1.2 x ATK) x Hệ số sao (1.2) = (32 + 1.2 x 81) x 1.2 = 155 (ATK) sát thương vật lý. Nếu mục tiêu đang chịu hiệu ứng bất lợi, cú cắn xuyên thêm 25% DEF và câm lặng mục tiêu 1 lượt. Mục tiêu giảm 25% chính xác trong 2 lượt. Nếu kết liễu mục tiêu, bản thân nhận 30% né tránh trong 2 lượt và hồi 1 nộ.
- **3★:** Lao vào 1 kẻ địch hậu tuyến bị nhắm, gây (32 + 1.2 x ATK) x Hệ số sao (1.4) = (32 + 1.2 x 81) x 1.4 = 181 (ATK) sát thương vật lý. Nếu mục tiêu đang chịu hiệu ứng bất lợi, cú cắn xuyên thêm 35% DEF và câm lặng mục tiêu 1 lượt. Mục tiêu giảm 35% chính xác trong 2 lượt. Nếu kết liễu mục tiêu, bản thân nhận 30% né tránh trong 2 lượt và hồi 1 nộ. Nếu kết liễu mục tiêu hoặc đẩy mục tiêu xuống dưới 40% máu, lao sang 1 kẻ địch hậu tuyến gần nhất, gây 70% sát thương và rút 1 nộ.
- **Skin/cosmetic đang authored:** mistStep (achievement unitsBought_150): Bước Sương → Chồn Âm → Sương Ẩn Vương

### monkey_spear — Khỉ Lao Cành
- **Identity:** Tier 2; Xạ thủ (ARCHER); faction Thú (BEAST); hệ Phong (WIND); species `khi`.
- **Base stats 1★:** HP 262, ATK 68, DEF 13, MATK 12, MDEF 13, range 4, rageMax 3, crit 0.2, critDmg 1.5, evade 0.1, accuracy 0.95.
- **Vai trò chơi:** Ném đá khóa tuyến trước bằng cú choáng đơn mục tiêu.
- **Đánh thường:** projectile, physical, 1×ATK, 1 kẻ địch gần nhất.
- **Kỹ năng — Ném Đá:** effect family `rock_throw_stun`; cost nộ 1★/2★/3★ = **1/2/3**. mục tiêu: 1 kẻ địch tiền tuyến gần nhất; hình: 1 ô mục tiêu; chọn: Ưu tiên kẻ địch tiền tuyến gần nhất.; số lượng: 1 mục tiêu; thời lượng: choáng 1 lượt (35%).
- **1★:** Ném một tảng đá vào 1 kẻ địch tiền tuyến gần nhất, gây (18 + 0.7 x ATK) x Hệ số sao (1) = (18 + 0.7 x 68) x 1 = 66 (ATK) và có 35% làm choáng 1 lượt.
- **2★:** Ném một tảng đá vào 1 kẻ địch tiền tuyến gần nhất, gây (18 + 0.7 x ATK) x Hệ số sao (1.2) = (18 + 0.7 x 109) x 1.2 = 113 (ATK) và có 45% làm choáng 1 lượt. Mục tiêu mất 1 nộ và bị giảm 20% ATK hoặc MATK theo vai trò trong 2 lượt.
- **3★:** Ném một tảng đá vào 1 kẻ địch tiền tuyến gần nhất, gây (18 + 0.7 x ATK) x Hệ số sao (1.4) = (18 + 0.7 x 170) x 1.4 = 192 (ATK) và có 60% làm choáng 2 lượt. Mục tiêu mất 1 nộ và bị giảm 20% ATK hoặc MATK theo vai trò trong 2 lượt. Nếu mục tiêu còn sống sau cú ném, mảnh đá văng sang 1 kẻ địch gần nhất cùng hàng, gây [(18 + 0.7 x ATK) x Hệ số sao (1.4)] x Hệ số Mảnh Đá (0.6) = [(18 + 0.7 x 170) x 1.4] x 0.6 = 115 (ATK) và có 35% làm choáng 1 lượt.
- **Skin/cosmetic đang authored:** spikeBanana (achievement unitsBought_200): Chuối Gươm → Khỉ Giáo → 🍌 Vương Giáo

### mosquito_toxic — Muỗi Độc
- **Identity:** Tier 3; Sát thủ (ASSASSIN); faction Côn trùng (INSECT); hệ Trùng (SWARM); species `muoi`.
- **Base stats 1★:** HP 284, ATK 88, DEF 17, MATK 22, MDEF 16, range 1, rageMax 4, crit 0.25, critDmg 1.5, evade 0.15, accuracy 0.95.
- **Vai trò chơi:** Lao vào pháp sư hoặc hỗ trợ hậu tuyến để hút máu, giảm hồi máu và gieo bệnh nối nhịp nộ.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Vòi Hút Máu:** effect family `lifesteal_disease`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: 1 pháp sư hoặc hỗ trợ ở cột cuối cùng phía địch; hình: 1 ô khóa mục tiêu; chọn: Ưu tiên pháp sư hoặc hỗ trợ ở cột cuối cùng phía địch.; số lượng: 1 mục tiêu; thời lượng: bệnh 2 lượt.
- **1★:** Lao vào 1 pháp sư hoặc hỗ trợ ở cột cuối cùng phía địch, gây (25 + 0.95 x ATK) x Hệ số sao (1) = (25 + 0.95 x 88) x 1 = 109 (ATK). Hồi lại 50% sát thương gây ra thành máu. Mục tiêu mắc bệnh 10 mỗi lượt trong 2 lượt.
- **2★:** Lao vào 1 pháp sư hoặc hỗ trợ ở cột cuối cùng phía địch, gây (25 + 0.95 x ATK) x Hệ số sao (1.2) = (25 + 0.95 x 141) x 1.2 = 191 (ATK). Hồi lại 50% sát thương gây ra thành máu. Mục tiêu mắc bệnh 14 mỗi lượt trong 3 lượt. Nếu mục tiêu là pháp sư hoặc hỗ trợ, nó mất 1 nộ và bị giảm 25% hồi máu trong 2 lượt.
- **3★:** Lao vào 1 pháp sư hoặc hỗ trợ ở cột cuối cùng phía địch, gây (25 + 0.95 x ATK) x Hệ số sao (1.4) = (25 + 0.95 x 220) x 1.4 = 328 (ATK). Hồi lại 50% sát thương gây ra thành máu. Mục tiêu mắc bệnh 16 mỗi lượt trong 3 lượt. Nếu mục tiêu là pháp sư hoặc hỗ trợ, nó mất 1 nộ và bị giảm 35% hồi máu trong 2 lượt. Nếu mục tiêu chết hoặc còn dưới 40% máu sau cú lao, bệnh lan sang tối đa 2 pháp sư hoặc hỗ trợ gần nhất ở cột cuối cùng phía địch với Hệ số Lan Bệnh (0.7) = 16 x 0.7 = 11 mỗi lượt trong 2 lượt và Muỗi Độc hồi 1 nộ.
- **Skin/cosmetic đang authored:** venomPulse (achievement merges_1): Mạch Độc → Muỗi Độc → Độc Vương

### moth_dust — Ruồi Đêm Bụi
- **Identity:** Tier 3; Pháp sư (MAGE); faction Côn trùng (INSECT); hệ Dạ (NIGHT); species `buom-dem`.
- **Base stats 1★:** HP 309, ATK 23, DEF 11, MATK 89, MDEF 24, range 4, rageMax 5, crit 0.1, critDmg 1.5, evade 0.05, accuracy 0.95.
- **Vai trò chơi:** Rải bụi mê vào cụm địch đông nhất để ru ngủ diện rộng.
- **Đánh thường:** tầm xa/projectile, magic từ MATK, 1×MATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Bụi Mê:** effect family `dust_sleep`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: tâm cụm địch đông nhất; hình: vùng vuông 3x3 quanh tâm; chọn: Ưu tiên tâm cụm địch đông nhất.; số lượng: vùng 3x3; thời lượng: ngủ 1 lượt (35%).
- **1★:** Rải bụi mê vào vùng vuông 3x3 quanh tâm cụm địch đông nhất, gây (22 + 70% MATK) sát thương phép và có 35% ru ngủ 1 lượt.
- **2★:** Rải bụi mê vào vùng vuông 3x3 quanh tâm cụm địch đông nhất, gây (23 + 72.8% MATK) sát thương phép và có 45% ru ngủ 1 lượt.
- **3★:** Rải bụi mê vào vùng vuông 3x3 quanh tâm cụm địch đông nhất, gây (24 + 75.6% MATK) sát thương phép và có 45% ru ngủ 1 lượt. Nếu mục tiêu đã chịu hiệu ứng bất lợi trước đó, ngủ thêm 1 lượt.
- **Skin/cosmetic đang authored:** dustHalo (achievement merges_3): Hào Bụi → Bướm Đêm → Huyền Bụi Vương

### newt_fire — Kỳ Nhông Lửa
- **Identity:** Tier 1; Pháp sư (MAGE); faction Bò sát (REPTILE); hệ Hỏa (FIRE); species `ky-nhong`.
- **Base stats 1★:** HP 262, ATK 19, DEF 10, MATK 75, MDEF 20, range 4, rageMax 5, crit 0.1, critDmg 1.5, evade 0.05, accuracy 0.95.
- **Vai trò chơi:** Dồn cầu lửa vào cụm địch đông nhất theo hình thập 5 ô.
- **Đánh thường:** tầm xa/projectile, magic từ MATK, 1×MATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Quả Cầu Lửa:** effect family `fireball_burn`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: tâm cụm địch đông nhất; hình: hình thập 5 ô quanh tâm; chọn: Chọn tâm cụm địch có nhiều mục tiêu nhất.; số lượng: 5 ô hình thập; thời lượng: thiêu đốt 3 lượt.
- **1★:** Ném cầu lửa vào tâm cụm địch đông nhất, gây (20 + 75% MATK) sát thương phép theo hình thập 5 ô quanh điểm rơi. Mục tiêu trúng đòn bị thiêu đốt 15 mỗi lượt trong 3 lượt.
- **2★:** Ném cầu lửa vào tâm cụm địch đông nhất, gây (21 + 78% MATK) sát thương phép theo hình thập 5 ô quanh điểm rơi. Mục tiêu trúng đòn bị thiêu đốt 18 mỗi lượt trong 3 lượt.
- **3★:** Ném cầu lửa vào tâm cụm địch đông nhất, gây (22 + 81% MATK) sát thương phép theo hình thập 5 ô quanh điểm rơi. Mục tiêu trúng đòn bị thiêu đốt 18 mỗi lượt trong 3 lượt. Pháp sư và hỗ trợ trúng đòn bị giảm 10 MATK trong 2 lượt.
- **Skin/cosmetic đang authored:** emberBloom (achievement merges_5): Hoa Lửa → Sa Giông Lửa → Hoa Viêm Vương

### nymph_water — Tiên Nước
- **Identity:** Tier 3; Hỗ trợ (SUPPORT); faction Huyền thoại (MYTHICAL); hệ Thủy (TIDE); species `tien-nuoc`.
- **Base stats 1★:** HP 331, ATK 29, DEF 18, MATK 78, MDEF 29, range 3, rageMax 3, crit 0.05, critDmg 1.5, evade 0.07, accuracy 0.95.
- **Vai trò chơi:** Thanh tẩy và hồi máu để kéo đồng minh trở lại giao tranh.
- **Đánh thường:** projectile, magic, 1×MATK, 1 kẻ địch gần nhất.
- **Kỹ năng — Dòng Nước Thanh Tẩy:** effect family `mass_cleanse`; cost nộ 1★/2★/3★ = **1/2/3**. mục tiêu: 1 đồng minh có % máu thấp nhất; hình: tự thân rồi chọn đồng minh; chọn: Bỏ qua bản thân, ưu tiên đồng minh có % máu thấp nhất.; số lượng: 1 mục tiêu; thời lượng: tức thì.
- **1★:** Thanh tẩy 1 hiệu ứng bất lợi và hồi 15% HP tối đa cho đồng minh có % máu thấp nhất.
- **2★:** Thanh tẩy tối đa 2 hiệu ứng bất lợi và hồi 18% HP tối đa cho 2 đồng minh có % máu thấp nhất.
- **3★:** Thanh tẩy tối đa 3 hiệu ứng bất lợi và hồi 21% HP tối đa cho 2 đồng minh có % máu thấp nhất. Đồng minh đầu tiên nhận thêm giảm 20% sát thương trong 1 lượt.
- **Skin/cosmetic đang authored:** tideBloom (achievement merges_10): Hoa Triều → Nữ Thần Sóng → Thủy Hoa Vương

### octopus_mind — Bạch Tuộc Tâm
- **Identity:** Tier 2; Pháp sư (MAGE); faction Thủy sinh (AQUATIC); hệ Thủy (TIDE); species `bach-tuoc-tam`.
- **Base stats 1★:** HP 292, ATK 21, DEF 10, MATK 86, MDEF 23, range 4, rageMax 5, crit 0.1, critDmg 1.5, evade 0.05, accuracy 0.95.
- **Vai trò chơi:** Dội mực lên cả cột địch để phá giáp và bẻ nộ.
- **Đánh thường:** tầm xa/projectile, magic từ MATK, 1×MATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Mực Phun Giảm Giáp:** effect family `ink_blast_debuff`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: cột địch đông nhất; hình: quét toàn bộ một cột địch; chọn: Ưu tiên cột địch đông nhất rồi khóa một mục tiêu trong cột đó làm tâm bắn.; số lượng: 1 cột; thời lượng: phá giáp 2 lượt.
- **1★:** Phun mực vào cột của mục tiêu bị nhắm, gây (22 + 75% MATK) sát thương phép lên toàn bộ kẻ địch trong cột đó. Mỗi mục tiêu trúng đòn bị giảm 18 DEF trong 2 lượt.
- **2★:** Phun mực vào cột của mục tiêu bị nhắm, gây (24 + 78% MATK) sát thương phép lên toàn bộ kẻ địch trong cột đó. Mục tiêu chính bị giảm 26 DEF trong 2 lượt; các mục tiêu còn lại bị giảm 18 DEF trong 2 lượt.
- **3★:** Phun mực vào cột của mục tiêu bị nhắm, gây (26 + 81% MATK) sát thương phép lên toàn bộ kẻ địch trong cột đó. Mục tiêu chính bị giảm 26 DEF trong 2 lượt; các mục tiêu còn lại bị giảm 18 DEF trong 2 lượt. Toàn bộ mục tiêu trúng cột mất 1 nộ.
- **Skin/cosmetic đang authored:** mindCurrent (achievement merges_20): Dòng Tâm → Bạch Tuộc Trí → Tâm Linh Vương

### oracle_wisdom — Tiên Tri Trí Tuệ
- **Identity:** Tier 4; Hỗ trợ (SUPPORT); faction Huyền thoại (MYTHICAL); hệ Linh (SPIRIT); species `tien-tri`.
- **Base stats 1★:** HP 372, ATK 30, DEF 19, MATK 86, MDEF 32, range 3, rageMax 5, crit 0.05, critDmg 1.5, evade 0.07, accuracy 0.95.
- **Vai trò chơi:** Dồn nộ cho nhóm đồng minh đang thiếu nộ nhất.
- **Đánh thường:** tầm xa/projectile, magic từ MATK, 1×MATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Kích Nộ Toàn Đội:** effect family `team_rage`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: 3 đồng minh ít nộ nhất trong đội; hình: 3 đồng minh ít nộ nhất; chọn: Ưu tiên đồng minh ít nộ nhất; nếu bằng nhau thì ưu tiên % máu thấp hơn.; số lượng: 3 đồng minh; thời lượng: tức thì.
- **1★:** Hô gọi linh lực, hồi 2 nộ cho 3 đồng minh ít nộ nhất.
- **2★:** Hô gọi linh lực, hồi 2 nộ cho 4 đồng minh ít nộ nhất.
- **3★:** Hô gọi linh lực, hồi 2 nộ cho 5 đồng minh ít nộ nhất, không vượt quá đầy nộ.
- **Skin/cosmetic đang authored:** mirrorVision (achievement merges_30): Gương Tri → Tiên Tri → Minh Triết Vương

### otter_river — Rái Cá Sông
- **Identity:** Tier 2; Đấu sĩ (FIGHTER); faction Thú (BEAST); hệ Thủy (TIDE); species `rai-ca`.
- **Base stats 1★:** HP 255, ATK 70, DEF 22, MATK 17, MDEF 18, range 1, rageMax 3, crit 0.05, critDmg 1.5, evade 0.08, accuracy 0.95.
- **Vai trò chơi:** Combo hai nhịp tuyến trước rồi vọng thêm một cú bồi.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Combo Rái Cá:** effect family `single_delayed_echo`; cost nộ 1★/2★/3★ = **1/2/3**. mục tiêu: 1 kẻ địch tuyến trước gần nhất; hình: 1 đòn đơn mục tiêu rồi vọng lại cùng mục tiêu; chọn: Ưu tiên kẻ địch còn sống gần tuyến trước nhất.; số lượng: 1 mục tiêu + 1 đòn vọng; thời lượng: giảm né 2 lượt; đòn vọng tung sau 1 nhịp ngắn.
- **1★:** Chém 1 kẻ địch tuyến trước gần nhất, gây (20 + 85% ATK) sát thương vật lý. Sau 1 nhịp ngắn, đòn vọng gây thêm (12 + 60% ATK) sát thương vật lý. Mục tiêu bị giảm 15% né tránh trong 2 lượt.
- **2★:** Chém 1 kẻ địch tuyến trước gần nhất, gây (24 + 96% ATK) sát thương vật lý. Sau 1 nhịp ngắn, đòn vọng gây thêm (14 + 72% ATK) sát thương vật lý. Mục tiêu bị giảm 25% né tránh trong 2 lượt.
- **3★:** Chém 1 kẻ địch tuyến trước gần nhất, gây (28 + 110% ATK) sát thương vật lý. Sau 1 nhịp ngắn, đòn vọng gây thêm (16 + 84% ATK) sát thương vật lý. Mục tiêu bị giảm 25% né tránh trong 2 lượt; đòn vọng còn gây chảy máu 12 mỗi lượt trong 2 lượt.
- **Skin/cosmetic đang authored:** riverSlide (achievement merges_50): Trượt Sông → Rái Cá Vui → Rái Vương Sông

### owl_nightshot — Cú Đêm
- **Identity:** Tier 2; Xạ thủ (ARCHER); faction Chim (AVIAN); hệ Dạ (NIGHT); species `cu`.
- **Base stats 1★:** HP 262, ATK 68, DEF 13, MATK 13, MDEF 13, range 4, rageMax 4, crit 0.2, critDmg 1.5, evade 0.1, accuracy 0.95.
- **Vai trò chơi:** Ru ngủ carry nhiều nộ ở cột cuối để bẻ nhịp xả kỹ năng.
- **Đánh thường:** tầm xa/projectile, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Mũi Tên Ngủ:** effect family `single_sleep`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: 1 kẻ địch nhiều nộ nhất ở cột cuối cùng phía địch; hình: 1 ô điểm; chọn: Ưu tiên kẻ địch nhiều nộ nhất ở cột cuối cùng phía địch.; số lượng: 1 mục tiêu; thời lượng: ngủ 1 lượt (80%).
- **1★:** Bắn vào kẻ địch nhiều nộ nhất ở cột cuối cùng phía địch, gây (28 + 1.05 x ATK) x Hệ số sao (1) = (28 + 1.05 x 71) x 1 = 103 (ATK) và có 80% gây ngủ trong 1 lượt.
- **2★:** Bắn vào tối đa 2 kẻ địch nhiều nộ nhất ở cột cuối cùng phía địch, mỗi mục tiêu chịu (28 + 1.05 x ATK) x Hệ số sao (1.2) = (28 + 1.05 x 114) x 1.2 = 177 (ATK) và chắc chắn ngủ trong 1 lượt.
- **3★:** Bắn vào tối đa 2 kẻ địch nhiều nộ nhất ở cột cuối cùng phía địch, mỗi mục tiêu chịu (28 + 1.05 x ATK) x Hệ số sao (1.4) = (28 + 1.05 x 178) x 1.4 = 301 (ATK) và chắc chắn ngủ trong 1 lượt. Pháp sư hoặc hỗ trợ chịu thêm 25% sát thương của cú bắn.
- **Skin/cosmetic đang authored:** nightGlint (achievement merges_75): Lóe Đêm → Cú Vịng Đêm → Huyền Dạ Vương

### ox_mountain — Bò Núi
- **Identity:** Tier 2; Đỡ đòn (TANKER); faction Thú (BEAST); hệ Nham (STONE); species `bo`.
- **Base stats 1★:** HP 385, ATK 47, DEF 33, MATK 12, MDEF 27, range 1, rageMax 4, crit 0.05, critDmg 1.5, evade 0.05, accuracy 0.95.
- **Vai trò chơi:** Tự dưỡng núi để tăng máu tối đa vĩnh viễn cho chính mình.
- **Đánh thường:** melee, physical, 1×ATK, 1 kẻ địch gần nhất, single ×1.
- **Kỹ năng — Chịu Đựng:** effect family `self_maxhp_boost`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: bản thân; hình: tự thân; chọn: Chỉ tác động lên bản thân.; số lượng: 1 mục tiêu; thời lượng: tức thì.
- **1★:** Tăng vĩnh viễn 12% HP tối đa cho bản thân và hồi ngay lượng HP vừa tăng thêm.
- **2★:** Tăng vĩnh viễn 18% HP tối đa cho bản thân và hồi ngay lượng HP vừa tăng thêm.
- **3★:** Tăng vĩnh viễn 25% HP tối đa cho bản thân, hồi ngay lượng HP vừa tăng thêm, rồi tăng vĩnh viễn 5 DEF.
- **Skin/cosmetic đang authored:** stoneHorn (achievement merges_100): Sừng Đá → Trâu Núi → Đá Sơn Ngưu Vương

### pangolin_plate — Tê Tê Thiết Giáp
- **Identity:** Tier 3; Đỡ đòn (TANKER); faction Bò sát (REPTILE); hệ Nham (STONE); species `te-te`.
- **Base stats 1★:** HP 465, ATK 48, DEF 40, MATK 12, MDEF 32, range 1, rageMax 4, crit 0.05, critDmg 1.5, evade 0.05, accuracy 0.95.
- **Vai trò chơi:** Dựng giáp vảy để phản đòn và che thêm cho đồng minh kế bên.
- **Đánh thường:** melee, physical, 1×ATK, 1 kẻ địch gần nhất, single ×1.
- **Kỹ năng — Vảy Tê Tê:** effect family `pangolin_reflect`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: bản thân; hình: tự thân; chọn: Tự kích hoạt lên bản thân.; số lượng: 1 bản thân; thời lượng: 3 lượt.
- **1★:** Dựng giáp vảy lên bản thân, phản 80% sát thương vật lý trong 3 lượt.
- **2★:** Dựng giáp vảy lên bản thân, phản 115% sát thương vật lý trong 3 lượt. Đồng minh gần nhất nhận 25% lượng khiên này. Nếu khiên còn tồn tại khi hết hạn, cả hai hồi 20% HP tối đa.
- **3★:** Dựng giáp vảy lên bản thân, phản 135% sát thương vật lý và 60% sát thương phép trong 4 lượt. Đồng minh gần nhất nhận 40% lượng khiên này. Nếu khiên còn tồn tại khi hết hạn, cả hai hồi 25% HP tối đa và nhận 15% giảm sát thương trong 1 lượt.
- **Skin/cosmetic đang authored:** plateBeacon (achievement merges_150): Hải Đăng Vảy → Tê Tê Giáp → Vảy Vương

### panther_void — Báo Hư Không
- **Identity:** Tier 5; Sát thủ (ASSASSIN); faction Thú (BEAST); hệ Dạ (NIGHT); species `bao`.
- **Base stats 1★:** HP 343, ATK 106, DEF 14, MATK 22, MDEF 12, range 1, rageMax 4, crit 0.25, critDmg 1.5, evade 0.15, accuracy 0.95.
- **Vai trò chơi:** Sát thủ execute lao tuyến sau để kết liễu và hoàn nộ.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Tất Sát Hoàn Nộ:** effect family `assassin_execute_rage_refund`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: kẻ địch % máu thấp nhất; hình: 1 ô khóa mục tiêu; chọn: địch % máu thấp nhất; số lượng: 1; thời lượng: tức thì; chỉ hồi nộ khi kết liễu.
- **1★:** Ưu tiên kẻ địch tuyến sau có % máu thấp nhất, gây (55 + 220% ATK) sát thương vật lý. Nếu kết liễu mục tiêu, hoàn 50% nộ.
- **2★:** Ưu tiên kẻ địch tuyến sau có % máu thấp nhất, gây (55 + 220% ATK) sát thương vật lý. Nếu kết liễu mục tiêu, hoàn 50% nộ; nếu chưa có mục tiêu kết liễu phù hợp thì chuyển sang kẻ địch tuyến sau có ATK cao nhất.
- **3★:** Ưu tiên kẻ địch tuyến sau có % máu thấp nhất, gây (55 + 220% ATK) sát thương vật lý. Nếu kết liễu mục tiêu, hoàn 50% nộ; nếu chưa có mục tiêu kết liễu phù hợp thì chuyển sang kẻ địch tuyến sau có ATK cao nhất. Kết liễu mục tiêu xong nhận thêm 25% né tránh.
- **Skin/cosmetic đang authored:** voidProwl (achievement augmentsChosen_1): Bóng Ma → Báo Hư Vô → Hư Không Báo Vương

### peacock_dazzle — Khổng Tước Vũ
- **Identity:** Tier 4; Hỗ trợ (SUPPORT); faction Chim (AVIAN); hệ Phong (WIND); species `cong`.
- **Base stats 1★:** HP 372, ATK 32, DEF 19, MATK 88, MDEF 31, range 3, rageMax 5, crit 0.05, critDmg 1.5, evade 0.07, accuracy 0.95.
- **Vai trò chơi:** múa vũ điệu mê hoặc làm yếu đượng toàn bộ kẻ địch
- **Đánh thường:** tầm xa/projectile, magic từ MATK, 1×MATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Điệu Múa Mê Hoặc:** effect family `global_debuff_atk`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: toàn bộ kẻ địch, giảm ATK cho 3 mục tiêu ATK cao nhất; hình: toàn bàn địch; chọn: toàn bàn -> địch có ATK cao nhất; số lượng: gây sát thương toàn bàn / giảm công 3; thời lượng: 2 lượt.
- **1★:** Gây (22 + 65% MATK) sát thương phép lên toàn bộ kẻ địch. Sau đó làm giảm 15% chính xác của 3 kẻ địch có ATK cao nhất trong 2 lượt.
- **2★:** Gây (22 + 65% MATK) sát thương phép lên toàn bộ kẻ địch. Sau đó làm giảm 35% ATK hoặc MATK của 4 kẻ địch có ATK cao nhất trong 3 lượt; mỗi mục tiêu có 35% bị câm lặng trong 1 lượt.
- **3★:** Gây (22 + 65% MATK) sát thương phép lên toàn bộ kẻ địch. Sau đó ưu tiên pháp sư hoặc hỗ trợ tuyến sau trong nhóm 4 mục tiêu bị làm suy yếu, giảm 40% ATK hoặc MATK trong 3 lượt; mỗi mục tiêu có 50% bị câm lặng trong 1 lượt.
- **Skin/cosmetic đang authored:** prismFeather (achievement augmentsChosen_3): Lông Lăng Kính → Công Hoa Lệ → Lăng Kính Công Vương

### pelican_bomb — Bồ Nông Bom
- **Identity:** Tier 4; Xạ thủ (ARCHER); faction Chim (AVIAN); hệ Thủy (TIDE); species `bo-nong`.
- **Base stats 1★:** HP 302, ATK 82, DEF 15, MATK 16, MDEF 15, range 4, rageMax 4, crit 0.2, critDmg 1.5, evade 0.1, accuracy 0.95.
- **Vai trò chơi:** Ném bom cá vào ô khóa để làm choáng tâm nổ và bóp né tránh cả vùng.
- **Đánh thường:** tầm xa/projectile, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Bom Cá:** effect family `fish_bomb_aoe`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: 1 ô khóa mục tiêu; hình: vùng vuông 3x3 quanh điểm nổ; chọn: Khóa 1 ô mục tiêu rồi phủ nổ toàn bộ vùng 3x3 quanh ô đó.; số lượng: tối đa 9 mục tiêu; thời lượng: giảm né tránh 2 lượt; choáng 1 lượt (30%).
- **1★:** Ném bom cá vào 1 ô khóa mục tiêu, gây (25 + 0.9 x ATK) sát thương vật lý trong vùng vuông 3x3 quanh điểm nổ. Kẻ địch trúng vùng bị giảm 15% né tránh; có 30% làm choáng 1 lượt.
- **2★:** Ném bom cá vào 1 ô khóa mục tiêu, gây (25 + 0.9 x ATK) sát thương vật lý trong vùng vuông 3x3 quanh điểm nổ. Kẻ địch trúng vùng bị giảm 25% né tránh; có 30% làm choáng 1 lượt. Nếu bom trúng từ 3 mục tiêu trở lên, mục tiêu ở tâm bị choáng 1 lượt chắc chắn và các mục tiêu còn lại mất 1 nộ.
- **3★:** Ném bom cá vào 1 ô khóa mục tiêu, gây (25 + 0.9 x ATK) sát thương vật lý trong vùng vuông 3x3 quanh điểm nổ. Kẻ địch trúng vùng bị giảm 35% né tránh; có 30% làm choáng 1 lượt. Nếu bom trúng từ 3 mục tiêu trở lên, mục tiêu ở tâm bị choáng 1 lượt chắc chắn; các mục tiêu còn lại mất 1 nộ và bị giảm 10 ATK hoặc MATK trong 2 lượt.
- **Skin/cosmetic đang authored:** skyBomb (achievement augmentsChosen_5): Bom Trời → Bồ Nông Bom → Bom Vương Trời

### phoenix_arrow — Phượng Hoàng Tên
- **Identity:** Tier 5; Xạ thủ (ARCHER); faction Huyền thoại (MYTHICAL); hệ Hỏa (FIRE); species `phuong-ten`.
- **Base stats 1★:** HP 363, ATK 91, DEF 20, MATK 17, MDEF 20, range 4, rageMax 4, crit 0.2, critDmg 1.5, evade 0.1, accuracy 0.95.
- **Vai trò chơi:** Quét lông vũ lửa hình nón để đốt lõi cụm địch rồi bung lửa ở mép nón.
- **Đánh thường:** tầm xa/projectile, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Lông Vũ Bão Táp:** effect family `cone_shot`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: kẻ địch trong hình nón phía trước; hình: hình nón phía trước, tối đa 5 ô; chọn: Lấy kẻ địch đang bị nhắm làm tâm rồi quét ra phía trước theo hình nón.; số lượng: hình nón tối đa 5 ô; thời lượng: thiêu đốt 3 lượt.
- **1★:** Quét lông vũ lửa theo hình nón phía trước, gây [(45 + 1.60 x ATK) x Hệ số sao (1)] = [(45 + 1.60 x 91) x 1] = 191 (ATK) sát thương vật lý và thiêu đốt 18 mỗi lượt trong 3 lượt.
- **2★:** Quét lông vũ lửa theo hình nón phía trước, gây [(52 + 1.75 x ATK) x Hệ số sao (1.2)] = [(52 + 1.75 x 91) x 1.2] = 247 (ATK) sát thương vật lý và thiêu đốt 22 mỗi lượt trong 4 lượt. Tâm nón nhận thêm 80% sát thương lõi và giảm 20% hồi máu trong 2 lượt.
- **3★:** Quét lông vũ lửa theo hình nón phía trước, gây [(58 + 1.90 x ATK) x Hệ số sao (1.4)] = [(58 + 1.90 x 91) x 1.4] = 306 (ATK) sát thương vật lý và thiêu đốt 24 mỗi lượt trong 4 lượt. Nếu chạm 3+ mục tiêu, mép nón tách thêm 2 kẻ địch gần nhất, mỗi nhánh gây 100% sát thương 1 phát; mục tiêu tâm mất 1 nộ.
- **Skin/cosmetic đang authored:** sunFeather (achievement augmentsChosen_10): Lông Mặt Trời → Phượng Hoàng Lửa → Thiên Hỏa Vương

### phoenix_rebirth — Phượng Hoàng Lửa
- **Identity:** Tier 5; Hỗ trợ (SUPPORT); faction Huyền thoại (MYTHICAL); hệ Hỏa (FIRE); species `phuong`.
- **Base stats 1★:** HP 431, ATK 35, DEF 20, MATK 90, MDEF 45, range 3, rageMax 5, crit 0.05, critDmg 1.5, evade 0.07, accuracy 0.95.
- **Vai trò chơi:** Đặt tái sinh cho bản thân rồi hồi máu đồng minh.
- **Đánh thường:** tầm xa/projectile, magic từ MATK, 1×MATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Lửa Bất Diệt:** effect family `phoenix_rebirth`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: bản thân và 1 đồng minh có % máu thấp nhất; hình: tự thân + 1 đồng minh; chọn: Tự nhận tái sinh trước, rồi hồi cho đồng minh khác có % máu thấp nhất.; số lượng: bản thân + 1 mục tiêu hồi máu; thời lượng: tức thì.
- **1★:** Đặt trạng thái tái sinh 1 lần với 30% HP cho bản thân. Hồi 40% HP tối đa cho 1 đồng minh có % máu thấp nhất.
- **2★:** Đặt trạng thái tái sinh 1 lần với 40% HP cho bản thân. Hồi 45% HP tối đa cho 2 đồng minh có % máu thấp nhất.
- **3★:** Đặt trạng thái tái sinh 1 lần với 50% HP cho bản thân. Hồi 30% HP tối đa cho toàn bộ đồng minh khác.
- **Skin/cosmetic đang authored:** emberCrown (achievement augmentsChosen_15): Miện Lửa → Phượng Hoàng Tái Sinh → Hỏa Miện Vương

### qilin_breeze — Kỳ Lân Gió
- **Identity:** Tier 4; Hỗ trợ (SUPPORT); faction Huyền thoại (MYTHICAL); hệ Linh (SPIRIT); species `ky-lan`.
- **Base stats 1★:** HP 340, ATK 29, DEF 19, MATK 88, MDEF 31, range 3, rageMax 5, crit 0.05, critDmg 1.5, evade 0.07, accuracy 0.95.
- **Vai trò chơi:** Ban phước ATK và né tránh cho cả cột đồng minh.
- **Đánh thường:** tầm xa/projectile, magic từ MATK, 1×MATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Lối Gió Ban Phước:** effect family `column_bless`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: toàn bộ đồng minh cùng cột; hình: cột dọc đồng minh; chọn: Lấy cột của bản thân làm cột trung tâm để ban phước.; số lượng: 1 cột; thời lượng: 2 lượt.
- **1★:** Ban phước cho toàn bộ đồng minh cùng cột, tăng 12 ATK và 12% né tránh trong 2 lượt.
- **2★:** Ban phước cho toàn bộ đồng minh cùng cột, tăng 16 ATK và 16% né tránh trong 3 lượt.
- **3★:** Ban phước cho toàn bộ đồng minh cùng cột, tăng 20 ATK và 20% né tránh trong 3 lượt. Đồng minh ở 2 cột kề bên nhận 10 ATK và 10% né tránh trong 3 lượt.
- **Skin/cosmetic đang authored:** jadeBreeze (achievement augmentsChosen_20): Ngọc Phong → Kỳ Lân Ngọc → Ngọc Phong Vương

### ram_charge — Cừu Núi Húc
- **Identity:** Tier 1; Đỡ đòn (TANKER); faction Thú (BEAST); hệ Nham (STONE); species `cuu`.
- **Base stats 1★:** HP 310, ATK 60, DEF 21, MATK 15, MDEF 17, range 1, rageMax 3, crit 0.05, critDmg 1.5, evade 0.05, accuracy 0.95.
- **Vai trò chơi:** Húc đẩy lùi mục tiêu rồi nện bonus nếu ép văng được.
- **Đánh thường:** melee, physical, 1×ATK, 1 kẻ địch gần nhất, single ×1.
- **Kỹ năng — Sừng Húc:** effect family `knockback_charge`; cost nộ 1★/2★/3★ = **1/2/3**. mục tiêu: 1 kẻ địch tuyến trước gần nhất; hình: 1 mục tiêu trước mặt; chọn: Ưu tiên kẻ địch còn sống gần tuyến trước nhất.; số lượng: 1 mục tiêu; thời lượng: đẩy lùi tức thì.
- **1★:** Húc 1 kẻ địch tuyến trước gần nhất, gây (18 + 80% ATK) sát thương vật lý. Nếu đẩy lùi được 1 ô, gây thêm 60% sát thương của đòn húc.
- **2★:** Húc 1 kẻ địch tuyến trước gần nhất, gây (22 + 92% ATK) sát thương vật lý. Nếu đẩy lùi được 1 ô, gây thêm 80% sát thương của đòn húc và có 30% choáng 1 lượt.
- **3★:** Húc 1 kẻ địch tuyến trước gần nhất, gây (25 + 102% ATK) sát thương vật lý. Nếu đẩy lùi được 1 ô, gây thêm 100% sát thương của đòn húc và có 50% choáng 1 lượt.
- **Skin/cosmetic đang authored:** thunderRam (achievement augmentsChosen_25): Sừng Sét → Cừu Lôi → Lôi Sừng Vương

### raven_death — Linh Hồn Mộ
- **Identity:** Tier 5; Sát thủ (ASSASSIN); faction Chim (AVIAN); hệ Dạ (NIGHT); species `qua-tu`.
- **Base stats 1★:** HP 337, ATK 102, DEF 20, MATK 30, MDEF 18, range 1, rageMax 4, crit 0.25, critDmg 1.5, evade 0.15, accuracy 0.95.
- **Vai trò chơi:** Sát thủ lời nguyền đánh dấu tanker hoặc mục tiêu nhiều khiên rồi kết liễu theo máu đã mất.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Tử Thần Gõ Cửa:** effect family `death_mark`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: kẻ địch đứng gần tuyến trước nhất và có HP tối đa cao nhất; hình: 1 ô khóa mục tiêu; chọn: mục tiêu ở cột đầu tiên phía địch có HP tối đa cao nhất; số lượng: 1; thời lượng: 2 lượt.
- **1★:** Ưu tiên tanker hoặc mục tiêu đang có khiên lớn ở cột đầu tiên phía địch, gây (40 + 150% ATK) sát thương vật lý và đặt lời nguyền trong 2 lượt. Mỗi lượt, lời nguyền gây thêm sát thương bằng 25% máu đã mất của mục tiêu.
- **2★:** Ưu tiên tanker hoặc mục tiêu đang có khiên lớn ở cột đầu tiên phía địch, gây (40 + 150% ATK) sát thương vật lý và đặt lời nguyền trong 2 lượt. Mỗi lượt, lời nguyền gây thêm sát thương bằng 30% máu đã mất của mục tiêu.
- **3★:** Ưu tiên tanker hoặc mục tiêu đang có khiên lớn ở cột đầu tiên phía địch, gây (40 + 150% ATK) sát thương vật lý và đặt lời nguyền trong 2 lượt. Mỗi lượt, lời nguyền gây thêm sát thương bằng 30% máu đã mất của mục tiêu. Nếu mục tiêu chết sớm, lời nguyền lan sang 1 kẻ địch gần nhất đang chịu hiệu ứng bất lợi.
- **Skin/cosmetic đang authored:** graveWing (achievement augmentsChosen_30): Cánh Mộ → Quạ Tử → Tử Vương Quạ

### reaper_void — Tử Thần Hư Không
- **Identity:** Tier 5; Sát thủ (ASSASSIN); faction Huyền thoại (MYTHICAL); hệ Linh (SPIRIT); species `tu-than`.
- **Base stats 1★:** HP 305, ATK 96, DEF 19, MATK 25, MDEF 19, range 1, rageMax 3, crit 0.25, critDmg 1.5, evade 0.15, accuracy 0.95.
- **Vai trò chơi:** Lao kết liễu hậu tuyến, mạnh hơn khi mục tiêu đã thấp máu.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Tất Sát Hư Không:** effect family `single_burst`; cost nộ 1★/2★/3★ = **1/2/3**. mục tiêu: 1 kẻ địch hậu tuyến bị khóa; hình: 1 ô điểm; chọn: Ưu tiên lao vào tuyến sau.; số lượng: 1 mục tiêu; thời lượng: tức thì.
- **1★:** Lao vào 1 kẻ địch hậu tuyến bị khóa, gây (60 + 250% ATK) sát thương vật lý. Nếu mục tiêu còn dưới 30% máu, sát thương tăng 50%.
- **2★:** Lao vào 1 kẻ địch hậu tuyến bị khóa, gây (60 + 250% ATK) sát thương vật lý. Nếu mục tiêu còn dưới 35% máu, sát thương tăng 60%.
- **3★:** Lao vào 1 kẻ địch hậu tuyến bị khóa, gây (60 + 250% ATK) sát thương vật lý. Nếu mục tiêu còn dưới 40% máu, sát thương tăng 70%.
- **Skin/cosmetic đang authored:** voidReaper (achievement augmentsChosen_40): Tử Thần → Hư Không Liềm → Hư Không Tử Vương

### rhino_quake — Tê Giác Địa Chấn
- **Identity:** Tier 2; Đấu sĩ (FIGHTER); faction Thú (BEAST); hệ Nham (STONE); species `te-giac`.
- **Base stats 1★:** HP 380, ATK 64, DEF 33, MATK 15, MDEF 24, range 1, rageMax 4, crit 0.05, critDmg 1.5, evade 0.08, accuracy 0.95.
- **Vai trò chơi:** Vào thế phản đòn để húc trả đòn đánh cận chiến.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Phản Đòn Địa Chấn:** effect family `rhino_counter`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: bản thân; hình: tự thân; chọn: Tự kích hoạt lên bản thân trước khi bị đánh.; số lượng: 1 mục tiêu; thời lượng: 3 lượt.
- **1★:** Vào thế phản đòn trong 3 lượt. Khi bị đòn đánh cận chiến trúng, lập tức đánh thường trả đòn.
- **2★:** Vào thế phản đòn trong 4 lượt. Khi bị đòn đánh cận chiến trúng, lập tức đánh thường trả đòn.
- **3★:** Vào thế phản đòn trong 5 lượt. Khi bị đòn đánh cận chiến trúng, lập tức đánh thường trả đòn.
- **Skin/cosmetic đang authored:** stoneAnthem (achievement augmentsChosen_50): Bài Ca Đá → Tê Giác Địa → Tê Giác Vương

### roc_legend — Tổ Chim Huyền Thoại
- **Identity:** Tier 5; Xạ thủ (ARCHER); faction Chim (AVIAN); hệ Linh (SPIRIT); species `dai-bang-huyen`.
- **Base stats 1★:** HP 345, ATK 101, DEF 20, MATK 21, MDEF 20, range 4, rageMax 3, crit 0.2, critDmg 1.5, evade 0.1, accuracy 0.95.
- **Vai trò chơi:** Ném cá nổ theo hình thập để chọc thủng cụm địch rồi làm vỡ đội hình.
- **Đánh thường:** tầm xa/projectile, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Tên Thập Tự Huyền Thoại:** effect family `cross_5`; cost nộ 1★/2★/3★ = **1/2/3**. mục tiêu: ô tâm của 1 kẻ địch đang bị nhắm; hình: hình thập 5 ô quanh mục tiêu; chọn: Lấy kẻ địch đang bị nhắm làm ô tâm của vùng nổ hình thập.; số lượng: tối đa 5 ô; thời lượng: tức thì.
- **1★:** Bắn quả cá nổ vào 1 kẻ địch đang bị nhắm, gây [(50 + 1.80 x ATK) x Hệ số sao (1)] = [(50 + 1.80 x 101) x 1] = 232 (ATK) sát thương vật lý theo hình thập 5 ô quanh mục tiêu. Kẻ địch trúng đòn có 30% bị choáng 1 lượt.
- **2★:** Bắn quả cá nổ vào 1 kẻ địch đang bị nhắm, gây [(60 + 2.16 x ATK) x Hệ số sao (1.2)] = [(60 + 2.16 x 101) x 1.2] = 334 (ATK) sát thương vật lý theo hình thập 5 ô quanh mục tiêu. Kẻ địch trúng đòn có 30% bị choáng 1 lượt; nếu trúng 3+ mục tiêu thì tâm bị choáng chắc chắn và 2 kẻ gần tâm mất 1 nộ.
- **3★:** Bắn quả cá nổ vào 1 kẻ địch đang bị nhắm, gây [(70 + 2.52 x ATK) x Hệ số sao (1.4)] = [(70 + 2.52 x 101) x 1.4] = 489 (ATK) sát thương vật lý theo hình thập 5 ô quanh mục tiêu. Kẻ địch trúng đòn có 50% bị choáng 1 lượt; nếu trúng 3+ mục tiêu thì tâm bị choáng chắc chắn và 2 kẻ gần tâm mất 1 nộ. Nếu mục tiêu tâm chết hoặc bom chạm đủ 4 ô, bom văng thêm 2 mũi cá to vào tối đa 2 kẻ địch gần nhất, mỗi mũi gây 100% sát thương 1 phát và có 60% bị choáng 1 lượt.
- **Skin/cosmetic đang authored:** cloudChorus (achievement craftedItems_1): Khúc Mây → Phượng Vũ → Thiên Phượng Vương

### salamander_flame — Thạch Hỏa
- **Identity:** Tier 1; Pháp sư (MAGE); faction Bò sát (REPTILE); hệ Hỏa (FIRE); species `ky-giong`.
- **Base stats 1★:** HP 218, ATK 19, DEF 11, MATK 73, MDEF 22, range 4, rageMax 5, crit 0.1, critDmg 1.5, evade 0.05, accuracy 0.95.
- **Vai trò chơi:** Phun lửa hình nón phía trước và thiêu đốt mục tiêu.
- **Đánh thường:** tầm xa/projectile, magic từ MATK, 1×MATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Phun Lửa Núi:** effect family `fire_breath_cone`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: kẻ địch trong vùng nón hẹp phía trước; hình: vùng nón hẹp phía trước; chọn: Ưu tiên mục tiêu khóa chính rồi quét vùng nón phía trước.; số lượng: vùng nón hẹp; thời lượng: thiêu đốt 2 lượt.
- **1★:** Phun lửa theo vùng nón hẹp phía trước, gây (18 + 70% MATK) sát thương phép và thiêu đốt 10 mỗi lượt trong 2 lượt.
- **2★:** Phun lửa theo vùng nón rộng phía trước, gây (18 + 70% MATK) sát thương phép và thiêu đốt 15 mỗi lượt trong 2 lượt.
- **3★:** Phun lửa theo vùng nón rộng phía trước, gây (18 + 70% MATK) sát thương phép và thiêu đốt 20 mỗi lượt trong 3 lượt.
- **Skin/cosmetic đang authored:** emberRite (achievement craftedItems_3): Lễ Lửa → Sa Giông Viêm → Hỏa Tế Vương

### scorpion_king — Vua Bọ Cạp
- **Identity:** Tier 4; Đấu sĩ (FIGHTER); faction Côn trùng (INSECT); hệ Trùng (SWARM); species `bo-cap`.
- **Base stats 1★:** HP 315, ATK 80, DEF 32, MATK 20, MDEF 25, range 1, rageMax 3, crit 0.05, critDmg 1.5, evade 0.08, accuracy 0.95.
- **Vai trò chơi:** Chích độc đơn mục tiêu để bào máu tuyến trước, rút nộ khi gặp mục tiêu cứng và bùng độc khi mục tiêu gục sớm.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Đuôi Độc Vua:** effect family `single_poison_slow`; cost nộ 1★/2★/3★ = **1/2/3**. mục tiêu: 1 kẻ địch tuyến trước gần nhất; hình: 1 đòn cận chiến đơn mục tiêu; chọn: Ưu tiên kẻ địch còn sống gần tuyến trước nhất.; số lượng: 1 mục tiêu; thời lượng: nhiễm độc 2 lượt.
- **1★:** Chích 1 kẻ địch tuyến trước gần nhất, gây (32 + 1.15 x ATK) sát thương vật lý và nhiễm độc 18 mỗi lượt trong 2 lượt.
- **2★:** Chích 1 kẻ địch tuyến trước gần nhất, gây (32 + 1.15 x ATK) sát thương vật lý và nhiễm độc 25 mỗi lượt trong 3 lượt. Nếu mục tiêu là tanker hoặc đang có khiên, mục tiêu bị giảm 20% ATK trong 2 lượt và mất 1 nộ.
- **3★:** Chích 1 kẻ địch tuyến trước gần nhất, gây (32 + 1.15 x ATK) sát thương vật lý và nhiễm độc 35 mỗi lượt trong 3 lượt. Nếu mục tiêu là tanker hoặc đang có khiên, mục tiêu bị giảm 20% ATK trong 2 lượt và mất 1 nộ. Nếu mục tiêu còn dưới 40% máu sau cú chích hoặc là tanker/đang có khiên, độc văng sang tối đa 2 kẻ địch kề bên gần nhất với 0.7 x sát thương và nhiễm độc 15 mỗi lượt trong 2 lượt.
- **Skin/cosmetic đang authored:** duneCrown (achievement craftedItems_5): Vương Cát → Bị Cạp Sa Mạc → Sa Vương Bị Cạp

### scorpion_shadow — Bọ Cạp Bóng
- **Identity:** Tier 1; Sát thủ (ASSASSIN); faction Côn trùng (INSECT); hệ Dạ (NIGHT); species `bo-cap-bong`.
- **Base stats 1★:** HP 235, ATK 71, DEF 16, MATK 18, MDEF 14, range 1, rageMax 4, crit 0.25, critDmg 1.5, evade 0.15, accuracy 0.95.
- **Vai trò chơi:** Sát thủ khống chế nhắm carry nhiều nộ ở tuyến sau rồi chích gây choáng.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Đuôi Chích:** effect family `sting_paralyze`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: kẻ địch nhiều nộ nhất; ưu tiên mục tiêu ở cột cuối cùng phía địch; hình: 1 ô khóa mục tiêu; chọn: Ưu tiên kẻ địch nhiều nộ nhất ở cột cuối cùng phía địch.; số lượng: 1 mục tiêu; thời lượng: choáng 1 lượt (38%).
- **1★:** Chích vào kẻ địch nhiều nộ nhất ở cột cuối cùng phía địch, gây (20 + 80% ATK) sát thương vật lý và có 38% gây choáng trong 1 lượt.
- **2★:** Chích vào kẻ địch nhiều nộ nhất ở cột cuối cùng phía địch, gây (20 + 80% ATK) sát thương vật lý và có 38% gây choáng trong 1 lượt. Nếu mục tiêu có từ 2 nộ trở lên, tỉ lệ choáng tăng thêm 20%.
- **3★:** Chích vào kẻ địch nhiều nộ nhất ở cột cuối cùng phía địch, gây (20 + 80% ATK) sát thương vật lý và có 44% gây choáng trong 1 lượt. Nếu mục tiêu có từ 2 nộ trở lên, tỉ lệ choáng tăng thêm 20%. Chích trúng còn rút 1 nộ.
- **Skin/cosmetic đang authored:** midnightSting (achievement craftedItems_10): Chích Nửa Đêm → Độc Ẩn Tím → Hắc Ẩnh Độc Vương

### seraphim_light — Seraphim Ánh Sáng
- **Identity:** Tier 5; Hỗ trợ (SUPPORT); faction Huyền thoại (MYTHICAL); hệ Linh (SPIRIT); species `seraphim`.
- **Base stats 1★:** HP 450, ATK 38, DEF 22, MATK 95, MDEF 48, range 3, rageMax 5, crit 0.05, critDmg 1.5, evade 0.07, accuracy 0.95.
- **Vai trò chơi:** Hồi máu cho nhóm đồng minh có % máu thấp nhất.
- **Đánh thường:** tầm xa/projectile, magic từ MATK, 1×MATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Thánh Ca Tái Sinh:** effect family `dual_heal`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: 3 đồng minh có % máu thấp nhất; hình: chọn đồng minh theo độ thấp máu; chọn: Ưu tiên 3 đồng minh có % máu thấp nhất.; số lượng: 3 mục tiêu; thời lượng: tức thì.
- **1★:** Hồi (45 + 130% MATK) HP cho 3 đồng minh có % máu thấp nhất.
- **2★:** Hồi (60 + 160% MATK) HP cho 4 đồng minh có % máu thấp nhất.
- **3★:** Hồi (75 + 200% MATK) HP cho toàn bộ đồng minh và thanh tẩy 1 hiệu ứng bất lợi trên mỗi mục tiêu.
- **Skin/cosmetic đang authored:** dawnPsalm (achievement craftedItems_15): Thánh Ca Bình Minh → Thiên Thần Sáng → Thiên Thần Vương

### shark_frenzy — Cá Mập Điên
- **Identity:** Tier 3; Đấu sĩ (FIGHTER); faction Thủy sinh (AQUATIC); hệ Thủy (TIDE); species `ca-map`.
- **Base stats 1★:** HP 260, ATK 70, DEF 23, MATK 20, MDEF 18, range 1, rageMax 3, crit 0.05, critDmg 1.5, evade 0.08, accuracy 0.95.
- **Vai trò chơi:** Cắn tuyến trước để hút máu mạnh hơn khi con mồi đã sứt mẻ.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Cắn Xé Điên Cuồng:** effect family `single_burst_lifesteal`; cost nộ 1★/2★/3★ = **1/2/3**. mục tiêu: kẻ địch tuyến trước bị khóa; hình: 1 ô điểm; chọn: Ưu tiên kẻ địch gần tuyến trước nhất.; số lượng: 1 mục tiêu; thời lượng: giảm né tránh 2 lượt.
- **1★:** Cắn 1 kẻ địch tuyến trước bị khóa, gây (30 + 1.1 x ATK) x Hệ số sao (1) = (30 + 1.1 x 70) x 1 = 107 (ATK). Hồi cho bản thân 25% sát thương thực nhận. Mục tiêu bị giảm 15% né tránh trong 2 lượt.
- **2★:** Cắn 1 kẻ địch tuyến trước bị khóa, gây (30 + 1.1 x ATK) x Hệ số sao (1.2) = (30 + 1.1 x 112) x 1.2 = 184 (ATK). Hồi cho bản thân 35% sát thương thực nhận. Nếu mục tiêu đang bị hiệu ứng bất lợi hoặc còn dưới 50% máu, cú cắn gây [(30 + 1.1 x ATK) x Hệ số sao (1.2)] x Hệ số Cắn Sâu (1.15) = [(30 + 1.1 x 112) x 1.2] x 1.15 = 212 (ATK) và mục tiêu mất 1 nộ. Mục tiêu bị giảm 25% né tránh trong 2 lượt.
- **3★:** Cắn 1 kẻ địch tuyến trước bị khóa, gây (30 + 1.1 x ATK) x Hệ số sao (1.4) = (30 + 1.1 x 175) x 1.4 = 313 (ATK). Hồi cho bản thân 50% sát thương thực nhận. Nếu mục tiêu đang bị hiệu ứng bất lợi hoặc còn dưới 50% máu, cú cắn gây [(30 + 1.1 x ATK) x Hệ số sao (1.4)] x Hệ số Cắn Sâu (1.3) = [(30 + 1.1 x 175) x 1.4] x 1.3 = 407 (ATK) và mục tiêu mất 1 nộ. Mục tiêu bị giảm 35% né tránh trong 2 lượt. Nếu kết liễu hoặc đẩy mục tiêu xuống dưới 35% máu, cá mập truy kích 1 kẻ địch tuyến trước gần nhất, gây [(30 + 1.1 x ATK) x Hệ số sao (1.4)] x Hệ số Truy Huyết (0.7) = [(30 + 1.1 x 175) x 1.4] x 0.7 = 219 (ATK).
- **Skin/cosmetic đang authored:** tideRush (achievement craftedItems_20): Sóng Dữ → Cá Mập Điên → Trào Sóng Vương

### snail_fortress — Ốc Sên Pháo Đài
- **Identity:** Tier 3; Đỡ đòn (TANKER); faction Thủy sinh (AQUATIC); hệ Thủy (TIDE); species `oc`.
- **Base stats 1★:** HP 420, ATK 48, DEF 40, MATK 14, MDEF 30, range 1, rageMax 5, crit 0.05, critDmg 1.5, evade 0.05, accuracy 0.95.
- **Vai trò chơi:** Rút vào vỏ để dựng khiên, miễn khống chế và che chắn cả hàng.
- **Đánh thường:** melee, physical, 1×ATK, 1 kẻ địch gần nhất, single ×1.
- **Kỹ năng — Pháo Đài Di Động:** effect family `self_shield_immune`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: bản thân; hình: tự thân; chọn: Tự kích hoạt lên bản thân.; số lượng: 1 mục tiêu; thời lượng: khiên tức thì; miễn khống chế 2 lượt.
- **1★:** Tự tạo khiên bằng (40 + 0.3 x DEF) và miễn nhiễm khống chế trong 2 lượt.
- **2★:** Tự tạo khiên bằng (60 + 0.4 x DEF) và miễn nhiễm khống chế trong 2 lượt.
- **3★:** Tự tạo khiên bằng (80 + 0.5 x DEF), miễn nhiễm khống chế trong 3 lượt, và chia 25% giá trị khiên cho đồng minh cùng hàng.
- **Skin/cosmetic đang authored:** shellKeep (achievement craftedItems_30): Pháo Đài Vỏ → Ốc Thành → Pháo Đài Ốc Vương

### spider_venom — Nhện Độc
- **Identity:** Tier 1; Sát thủ (ASSASSIN); faction Côn trùng (INSECT); hệ Trùng (SWARM); species `nhen-doc`.
- **Base stats 1★:** HP 250, ATK 73, DEF 15, MATK 16, MDEF 13, range 1, rageMax 3, crit 0.25, critDmg 1.5, evade 0.15, accuracy 0.95.
- **Vai trò chơi:** Lao vào hậu tuyến, trói tơ và tăng sát thương theo số Trùng.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Mạng Tơ Bẫy:** effect family `web_trap_slow`; cost nộ 1★/2★/3★ = **1/2/3**. mục tiêu: 1 kẻ địch hậu tuyến bị nhắm; hình: lao vào 1 ô hậu tuyến; chọn: Ưu tiên kẻ địch hậu tuyến đang bị nhắm.; số lượng: 1 mục tiêu; thời lượng: giảm ATK 2 lượt.
- **1★:** Lao vào 1 kẻ địch hậu tuyến bị nhắm, gây (18 + 70% ATK) sát thương vật lý. Mỗi đồng minh Trùng đang sống tăng thêm 5% sát thương cú lao. Mục tiêu bị giảm 20% ATK trong 2 lượt.
- **2★:** Lao vào 1 kẻ địch hậu tuyến bị nhắm, gây (18 + 70% ATK) sát thương vật lý. Mỗi đồng minh Trùng đang sống tăng thêm 8% sát thương cú lao. Mục tiêu bị giảm 20% ATK trong 2 lượt.
- **3★:** Lao vào 1 kẻ địch hậu tuyến bị nhắm, gây (18 + 70% ATK) sát thương vật lý. Mỗi đồng minh Trùng đang sống tăng thêm 10% sát thương cú lao. Mục tiêu bị giảm 20% ATK trong 2 lượt.
- **Skin/cosmetic đang authored:** webOrbit (achievement craftedItems_40): Quỹ Đạo → Nhện Độc → Vương Nhện Độc

### spore_mage — Nhện Bào Tử
- **Identity:** Tier 4; Pháp sư (MAGE); faction Côn trùng (INSECT); hệ Trùng (SWARM); species `nhen`.
- **Base stats 1★:** HP 310, ATK 22, DEF 12, MATK 105, MDEF 25, range 4, rageMax 5, crit 0.1, critDmg 1.5, evade 0.05, accuracy 0.95.
- **Vai trò chơi:** Rải bào tử độc lên vùng vuông quanh mục tiêu.
- **Đánh thường:** tầm xa/projectile, magic từ MATK, 1×MATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Mưa Bào Tử:** effect family `aoe_poison`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: tâm vùng vuông 3x3 phía địch; hình: vùng vuông 3x3; chọn: Ưu tiên mục tiêu khóa chính rồi lan theo vùng vuông quanh đó.; số lượng: vùng vuông 3x3; thời lượng: nhiễm độc 2 lượt.
- **1★:** Rải bào tử độc vào vùng vuông 3x3, gây (32 + 100% MATK) sát thương phép và nhiễm độc 15 mỗi lượt trong 2 lượt.
- **2★:** Rải bào tử độc vào vùng vuông 3x3, gây (32 + 100% MATK) sát thương phép và nhiễm độc 22 mỗi lượt trong 2 lượt.
- **3★:** Rải bào tử độc vào vùng vuông 5x5, gây (32 + 100% MATK) sát thương phép và nhiễm độc 24 mỗi lượt trong 3 lượt.
- **Skin/cosmetic đang authored:** myceliumHalo (achievement craftedItems_50): Hào Nấm → Nấm Pháp Sư → Nấm Vương

### sprite_wind — Yêu Tinh Gió
- **Identity:** Tier 3; Hỗ trợ (SUPPORT); faction Huyền thoại (MYTHICAL); hệ Phong (WIND); species `yeu-tinh-gio`.
- **Base stats 1★:** HP 287, ATK 26, DEF 16, MATK 73, MDEF 27, range 3, rageMax 4, crit 0.05, critDmg 1.5, evade 0.07, accuracy 0.95.
- **Vai trò chơi:** Tạo khiên cho đồng minh có % máu thấp nhất.
- **Đánh thường:** tầm xa/projectile, magic từ MATK, 1×MATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Gió Hộ Mệnh:** effect family `wind_shield_ally`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: 2 đồng minh có % máu thấp nhất; hình: chọn đồng minh theo độ thấp máu; chọn: Ưu tiên 2 đồng minh khác có % máu thấp nhất.; số lượng: 2 mục tiêu; thời lượng: tức thì.
- **1★:** Tạo khiên bằng (35 + 30% MATK) cho 2 đồng minh có % máu thấp nhất.
- **2★:** Tạo khiên bằng (50 + 40% MATK) cho 2 đồng minh có % máu thấp nhất.
- **3★:** Tạo khiên bằng (65 + 50% MATK) cho 3 đồng minh có % máu thấp nhất. Các mục tiêu được khiên tăng 10% né tránh trong 2 lượt.
- **Skin/cosmetic đang authored:** breezeRibbon (achievement craftedItems_75): Dải Gió → Yêu Tinh Gió → Gió Vương Yêu Tinh

### squid_ink — Tôm Phun
- **Identity:** Tier 2; Pháp sư (MAGE); faction Thủy sinh (AQUATIC); hệ Thủy (TIDE); species `muc-muc`.
- **Base stats 1★:** HP 241, ATK 19, DEF 11, MATK 82, MDEF 22, range 4, rageMax 5, crit 0.1, critDmg 1.5, evade 0.05, accuracy 0.95.
- **Vai trò chơi:** Ném bom mực làm mù cụm địch quanh điểm rơi.
- **Đánh thường:** tầm xa/projectile, magic từ MATK, 1×MATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Bom Mực:** effect family `ink_bomb_blind`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: 1 kẻ địch đang bị nhắm; hình: vùng vuông 1x1 quanh điểm rơi; chọn: Lấy kẻ địch đang bị nhắm làm tâm vụ nổ.; số lượng: 1 ô; thời lượng: tức thì.
- **1★:** Ném bom mực vào 1 kẻ địch đang bị nhắm, gây (20 + 70% MATK) sát thương phép.
- **2★:** Ném bom mực vào 1 kẻ địch đang bị nhắm, gây (24 + 84% MATK) sát thương phép trong vùng vuông 3x3 quanh điểm rơi. Kẻ địch trúng đòn bị giảm 25% chính xác đến hết trận.
- **3★:** Ném bom mực vào 1 kẻ địch đang bị nhắm, gây (28 + 98% MATK) sát thương phép trong vùng vuông 5x5 quanh điểm rơi. Kẻ địch trúng đòn bị giảm 35% chính xác đến hết trận.
- **Skin/cosmetic đang authored:** abyssCalligraphy (achievement highestLevel_2): Thư Pháp Sâu → Mực Nho → Huyền Mực Vương

### stork_sniper — Chim Cánh Cụt Bắn
- **Identity:** Tier 3; Xạ thủ (ARCHER); faction Chim (AVIAN); hệ Thủy (TIDE); species `co`.
- **Base stats 1★:** HP 270, ATK 75, DEF 15, MATK 16, MDEF 15, range 4, rageMax 3, crit 0.2, critDmg 1.5, evade 0.1, accuracy 0.95.
- **Vai trò chơi:** Bắn xuyên giáp một mục tiêu để hạ nhanh địch chủ lực.
- **Đánh thường:** tầm xa/projectile, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Phát Bắn Tỉa:** effect family `sniper_crit`; cost nộ 1★/2★/3★ = **1/2/3**. mục tiêu: 1 kẻ địch đang bị nhắm; hình: đơn mục tiêu xuyên giáp; chọn: Bắn thẳng vào kẻ địch đang bị nhắm bởi phát bắn tỉa.; số lượng: 1; thời lượng: giảm né 2 lượt.
- **1★:** Bắn 1 kẻ địch đang bị nhắm, gây (32 + 115% ATK) sát thương vật lý, bỏ qua 50% DEF và giảm né tránh 15% trong 2 lượt.
- **2★:** Bắn 1 kẻ địch đang bị nhắm, gây (38 + 138% ATK) sát thương vật lý, bỏ qua 50% DEF, giảm né tránh 15% trong 2 lượt và giảm 10% ATK trong 1 lượt.
- **3★:** Bắn 1 kẻ địch đang bị nhắm, gây (45 + 161% ATK) sát thương vật lý, bỏ qua 65% DEF, giảm né tránh 15% trong 2 lượt và giảm 15% ATK trong 2 lượt.
- **Skin/cosmetic đang authored:** marshDeadeye (achievement highestLevel_3): Mắt Đầm → Cò Bắn Tỉa → Tổng Đầm Vương

### storm_mage — Rắn Lôi
- **Identity:** Tier 4; Pháp sư (MAGE); faction Bò sát (REPTILE); hệ Phong (WIND); species `ran`.
- **Base stats 1★:** HP 296, ATK 22, DEF 12, MATK 99, MDEF 24, range 4, rageMax 5, crit 0.1, critDmg 1.5, evade 0.05, accuracy 0.95.
- **Vai trò chơi:** Dội sét vào một cột rồi xích điện ra ngoài cột để bẻ thế cả cụm.
- **Đánh thường:** tầm xa/projectile, magic từ MATK, 1×MATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Lôi Trụ Tách Nhánh:** effect family `column_plus_splash`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: toàn bộ địch trong cột của mục tiêu bị khóa; hình: 1 cột dọc rồi lan sang địch ngoài cột; chọn: Khóa 1 mục tiêu, rồi ưu tiên địch ngoài cột gần cột đó nhất cho các tia lan.; số lượng: 1 cột + 2 địch ngoài cột; thời lượng: tức thì.
- **1★:** Dội sét xuống cột của mục tiêu bị khóa, gây (30 + 1 x MATK) sát thương phép cho toàn bộ địch trong cột. Sét lan thêm sang 2 kẻ địch ngoài cột gần nhất, mỗi mục tiêu chịu Hệ số Lan (0.5) của cú sét chính.
- **2★:** Dội sét xuống cột của mục tiêu bị khóa, gây (30 + 1 x MATK) sát thương phép cho toàn bộ địch trong cột. Sét lan thêm sang 3 kẻ địch ngoài cột gần nhất, mỗi mục tiêu chịu Hệ số Lan (0.5) của cú sét chính.
- **3★:** Dội sét xuống cột của mục tiêu bị khóa, gây (30 + 1 x MATK) sát thương phép cho toàn bộ địch trong cột. Sét lan sang toàn bộ địch còn lại ngoài cột, mỗi mục tiêu chịu Hệ số Lan (0.5) của cú sét chính.
- **Skin/cosmetic đang authored:** voltChant (achievement highestLevel_4): Bài Sét → Pháp Sư Bão → Lôi Pháp Vương

### swan_grace — Thiên Nga Trắng
- **Identity:** Tier 4; Hỗ trợ (SUPPORT); faction Chim (AVIAN); hệ Thủy (TIDE); species `thien-nga`.
- **Base stats 1★:** HP 340, ATK 29, DEF 19, MATK 88, MDEF 31, range 3, rageMax 4, crit 0.05, critDmg 1.5, evade 0.07, accuracy 0.95.
- **Vai trò chơi:** Ban khiên nước và thanh tẩy để vực dậy đồng minh đang nguy nan.
- **Đánh thường:** tầm xa/projectile, magic từ MATK, 1×MATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Khiên Tinh Khiết:** effect family `shield_cleanse`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: 1 đồng minh có % máu thấp nhất; hình: 1 ô đồng minh; chọn: Chọn đồng minh có % máu thấp nhất.; số lượng: 1 mục tiêu; thời lượng: khiên tức thì; thanh tẩy tức thì.
- **1★:** Tạo khiên (70 + 90% MATK) cho 1 đồng minh có % máu thấp nhất và thanh tẩy tối đa 1 hiệu ứng bất lợi.
- **2★:** Tạo khiên (95 + 110% MATK) cho 1 đồng minh có % máu thấp nhất và thanh tẩy tối đa 2 hiệu ứng bất lợi.
- **3★:** Tạo khiên (120 + 130% MATK) cho 2 đồng minh có % máu thấp nhất và thanh tẩy tối đa 2 hiệu ứng bất lợi.
- **Skin/cosmetic đang authored:** lakeSatin (achievement highestLevel_5): Lụa Hồ → Thiên Nga Hồ → Lụa Vương Thiên Nga

### thunderbird_storm — Chim Sấm Sét
- **Identity:** Tier 5; Xạ thủ (ARCHER); faction Chim (AVIAN); hệ Phong (WIND); species `chim-sam`.
- **Base stats 1★:** HP 330, ATK 98, DEF 21, MATK 23, MDEF 19, range 4, rageMax 3, crit 0.2, critDmg 1.5, evade 0.1, accuracy 0.95.
- **Vai trò chơi:** Xuyên hàng bằng sét, khóa mục tiêu cuối hàng rồi nảy sang hàng kế khi đủ chuỗi.
- **Đánh thường:** tầm xa/projectile, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Xuyên Hàng Sấm:** effect family `row_multi`; cost nộ 1★/2★/3★ = **1/2/3**. mục tiêu: tối đa 4 kẻ địch cùng hàng của mục tiêu bị nhắm; hình: 1 hàng ngang; chọn: Khóa 1 kẻ địch trong tầm, rồi quét các kẻ địch cùng hàng theo thứ tự gần chim nhất.; số lượng: tối đa 4 mục tiêu; thời lượng: choáng 1 lượt (25%).
- **1★:** Bắn một luồng điện xuyên qua hàng của mục tiêu bị nhắm, gây [(48 + 1.70 x ATK) x Hệ số sao (1)] = [(48 + 1.70 x 98) x 1] = 214 (ATK) sát thương vật lý lên tối đa 4 kẻ địch cùng hàng và có 25% gây choáng 1 lượt.
- **2★:** Bắn một luồng điện xuyên qua hàng của mục tiêu bị nhắm, gây [(52 + 1.80 x ATK) x Hệ số sao (1.2)] = [(52 + 1.80 x 98) x 1.2] = 278 (ATK) sát thương vật lý lên tối đa 4 kẻ địch cùng hàng và có 40% gây choáng 1 lượt. Mục tiêu cuối hàng bị giảm 20% né tránh trong 2 lượt và mất 1 nộ.
- **3★:** Bắn một luồng điện xuyên qua hàng của mục tiêu bị nhắm, gây [(56 + 1.90 x ATK) x Hệ số sao (1.4)] = [(56 + 1.90 x 98) x 1.4] = 350 (ATK) sát thương vật lý lên tối đa 5 kẻ địch cùng hàng và có 55% gây choáng 1 lượt. Khi chạm đủ 5 mục tiêu, sét tách sang 2 hàng kế cận, mỗi nhánh gây 80% sát thương 1 phát và có 55% gây choáng 1 lượt; mục tiêu cuối hàng mất 1 nộ.
- **Skin/cosmetic đang authored:** skyDrum (achievement highestLevel_6): Trống Trời → Sấm Điểu → Lôi Điểu Vương

### tiger_fang — Hổ Nanh
- **Identity:** Tier 1; Đấu sĩ (FIGHTER); faction Thú (BEAST); hệ Hỏa (FIRE); species `ho`.
- **Base stats 1★:** HP 240, ATK 66, DEF 20, MATK 14, MDEF 16, range 1, rageMax 3, crit 0.05, critDmg 1.5, evade 0.08, accuracy 0.95.
- **Vai trò chơi:** Cào xé cả cột để gây chảy máu kéo dài.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Vuốt Hổ Xé Thịt:** effect family `column_bleed`; cost nộ 1★/2★/3★ = **1/2/3**. mục tiêu: toàn bộ kẻ địch trong cột của mục tiêu bị nhắm; hình: cột dọc; chọn: Ưu tiên kẻ địch còn sống gần tuyến trước nhất để khóa cột.; số lượng: 1 cột; thời lượng: chảy máu 2 lượt.
- **1★:** Cào dọc 1 cột qua kẻ địch tuyến trước bị nhắm, gây (18 + 85% ATK) sát thương vật lý cho mọi kẻ địch trong cột. Mục tiêu trúng đòn chảy máu 10 mỗi lượt trong 2 lượt.
- **2★:** Cào dọc 1 cột qua kẻ địch tuyến trước bị nhắm, gây (18 + 85% ATK) sát thương vật lý cho mọi kẻ địch trong cột. Mục tiêu trúng đòn chảy máu 15 mỗi lượt trong 3 lượt.
- **3★:** Cào dọc 1 cột qua kẻ địch tuyến trước bị nhắm, gây (18 + 85% ATK) sát thương vật lý cho mọi kẻ địch trong cột. Mục tiêu trúng đòn chảy máu 20 mỗi lượt trong 4 lượt.
- **Skin/cosmetic đang authored:** sunstripe (achievement highestLevel_7): Vết Nắng → Hổ Vàng → Mãnh Hổ Vàng Vương

### titan_earth — Titan Đất
- **Identity:** Tier 4; Đỡ đòn (TANKER); faction Huyền thoại (MYTHICAL); hệ Nham (STONE); species `titan`.
- **Base stats 1★:** HP 610, ATK 58, DEF 50, MATK 18, MDEF 38, range 1, rageMax 5, crit 0.05, critDmg 1.5, evade 0.05, accuracy 0.95.
- **Vai trò chơi:** Gia cố DEF và MDEF toàn đội rồi kéo lại nhịp cho đồng minh thấp máu.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Phúc Lành Đại Địa:** effect family `team_def_buff`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: toàn bộ đồng minh, rồi 1 đồng minh có % máu thấp nhất; hình: toàn bộ bàn đồng minh; chọn: Buff toàn đội trước, rồi hồi cho đồng minh còn sống có % máu thấp nhất.; số lượng: toàn đội + 1 mục tiêu hồi máu; thời lượng: buff 3 lượt; hồi máu tức thì.
- **1★:** Tăng 25 DEF và 25 MDEF trong 3 lượt cho toàn bộ đồng minh, rồi hồi 60 HP cho 1 đồng minh có % máu thấp nhất.
- **2★:** Tăng 35 DEF và 35 MDEF trong 3 lượt cho toàn bộ đồng minh, rồi hồi 90 HP cho 1 đồng minh có % máu thấp nhất.
- **3★:** Tăng 45 DEF và 45 MDEF trong 4 lượt cho toàn bộ đồng minh, rồi hồi 120 HP cho 2 đồng minh có % máu thấp nhất.
- **Skin/cosmetic đang authored:** faultMonolith (achievement highestLevel_8): Cột Đất → Titan Nham → Khối Địa Vương

### toad_poison — Cóc Độc
- **Identity:** Tier 1; Pháp sư (MAGE); faction Bò sát (REPTILE); hệ Trùng (SWARM); species `coc-doc`.
- **Base stats 1★:** HP 220, ATK 17, DEF 11, MATK 72, MDEF 21, range 4, rageMax 5, crit 0.1, critDmg 1.5, evade 0.05, accuracy 0.95.
- **Vai trò chơi:** Dồn độc cộng tầng lên một mục tiêu để càng lúc càng đau.
- **Đánh thường:** tầm xa/projectile, magic từ MATK, 1×MATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Nhổ Độc:** effect family `toad_poison_spit`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: 1 kẻ địch bị nhắm; hình: 1 ô khóa mục tiêu; chọn: Khóa 1 kẻ địch trong tầm rồi dồn độc lặp lại lên đúng mục tiêu đó.; số lượng: 1 mục tiêu; thời lượng: độc cộng dồn 2 lượt, tối đa 5 lớp.
- **1★:** Nhổ bọt độc vào 1 kẻ địch bị nhắm, gây (15 + 0.60 x MATK) sát thương phép. Mỗi lần trúng cộng thêm 12 độc mỗi lượt trong 2 lượt lên mục tiêu, tối đa 5 lớp.
- **2★:** Nhổ bọt độc vào 1 kẻ địch bị nhắm, gây (16 + 0.63 x MATK) sát thương phép. Nếu mục tiêu đã có từ 3 lớp độc, đòn này gây thêm 30% sát thương và kéo dài độc thêm 1 lượt. Mỗi lần trúng cộng thêm 15 độc mỗi lượt trong 2 lượt lên mục tiêu, tối đa 5 lớp.
- **3★:** Nhổ bọt độc vào 1 kẻ địch bị nhắm, gây (17 + 0.66 x MATK) sát thương phép. Nếu mục tiêu có 5 lớp độc, độc bùng nổ gây thêm 50% sát thương phép và lan 1 lớp độc sang kẻ địch gần nhất. Mỗi lần trúng cộng thêm 18 độc mỗi lượt trong 3 lượt lên mục tiêu, tối đa 5 lớp.
- **Skin/cosmetic đang authored:** bogHex (achievement highestLevel_10): Bùa Đầm → Độc Đầm → Độc Vương Đầm

### toucan_snipe — Chim Mỏ To
- **Identity:** Tier 2; Xạ thủ (ARCHER); faction Chim (AVIAN); hệ Phong (WIND); species `chim-mo-to`.
- **Base stats 1★:** HP 255, ATK 70, DEF 13, MATK 13, MDEF 13, range 4, rageMax 3, crit 0.2, critDmg 1.5, evade 0.1, accuracy 0.95.
- **Vai trò chơi:** Ngắm kết liễu mục tiêu thấp máu bằng phát bắn xuyên giáp.
- **Đánh thường:** tầm xa/projectile, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Mỏ Xuyên Kết Liễu:** effect family `snipe_execute`; cost nộ 1★/2★/3★ = **1/2/3**. mục tiêu: 1 kẻ địch có % máu thấp nhất; hình: đơn mục tiêu kết liễu; chọn: Ưu tiên kẻ địch có % máu thấp nhất để kết liễu.; số lượng: 1; thời lượng: tức thì.
- **1★:** Bắn 1 kẻ địch có % máu thấp nhất, gây (22 + 0.85 x ATK) x Hệ số sao (1) = (22 + 0.85 x 70) x 1 = 82 (ATK). Nếu mục tiêu còn dưới 30% máu, đòn bắn gây gấp đôi sát thương.
- **2★:** Bắn 1 kẻ địch có % máu thấp nhất, gây (22 + 0.85 x ATK) x Hệ số sao (1.2) = (22 + 0.85 x 112) x 1.2 = 141 (ATK). Nếu mục tiêu còn dưới 35% máu, đòn bắn gây gấp đôi sát thương.
- **3★:** Bắn 1 kẻ địch có % máu thấp nhất, gây (22 + 0.85 x ATK) x Hệ số sao (1.4) = (22 + 0.85 x 175) x 1.4 = 240 (ATK). Nếu mục tiêu còn dưới 40% máu, đòn bắn gây gấp đôi sát thương và bỏ qua 25% DEF.
- **Skin/cosmetic đang authored:** jungleSpotter (achievement highestLevel_12): Triệu Vọng Rừng → Xạ Thủ Rừng → Rừng Xạ Vương

### trex_bite — Bạo Chúa T-Rex
- **Identity:** Tier 5; Đấu sĩ (FIGHTER); faction Bò sát (REPTILE); hệ Nham (STONE); species `khung-long`.
- **Base stats 1★:** HP 460, ATK 105, DEF 50, MATK 20, MDEF 35, range 1, rageMax 4, crit 0.05, critDmg 1.5, evade 0.08, accuracy 0.95.
- **Vai trò chơi:** Cắn nát tuyến trước, bẻ giáp và bẻ luôn nhịp lao của tanker.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Hàm Bạo Chúa:** effect family `single_armor_break`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: 1 kẻ địch tuyến trước bị nhắm; hình: 1 đòn cận chiến đơn mục tiêu; chọn: Ưu tiên kẻ địch còn sống gần tuyến trước nhất.; số lượng: 1 mục tiêu; thời lượng: 2 lượt.
- **1★:** Cắn 1 kẻ địch tuyến trước bị nhắm, gây [(55 + 2.20 x ATK) x Hệ số sao (1)] = [(55 + 2.20 x 105) x 1] = 286 (ATK) sát thương vật lý và giảm 20 giáp trong 2 lượt.
- **2★:** Cắn 1 kẻ địch tuyến trước bị nhắm, gây [(60 + 2.30 x ATK) x Hệ số sao (1.2)] = [(60 + 2.30 x 105) x 1.2] = 420 (ATK) sát thương vật lý và giảm 30 giáp trong 2 lượt. Nếu mục tiêu là tanker hoặc đang có khiên, cú cắn bỏ qua 25% DEF và mục tiêu mất 1 nộ.
- **3★:** Cắn 1 kẻ địch tuyến trước bị nhắm, gây [(65 + 2.40 x ATK) x Hệ số sao (1.4)] = [(65 + 2.40 x 105) x 1.4] = 504 (ATK) sát thương vật lý và giảm 40 giáp trong 2 lượt. Nếu mục tiêu là tanker hoặc đang có khiên, cú cắn bỏ qua 25% DEF và mục tiêu mất 1 nộ. Nếu mục tiêu còn sống, mảnh giáp văng sang tối đa 2 kẻ địch cùng hàng gần nhất, mỗi mảnh gây 100% sát thương 1 phát và giảm 20 giáp trong 2 lượt.
- **Skin/cosmetic đang authored:** emberRoar (achievement highestLevel_15): Gầm Lửa → Khủng Long Lửa → Hỏa Long Vương

### triceratops_charge — Bò Rừng Xung Phong
- **Identity:** Tier 1; Đấu sĩ (FIGHTER); faction Thú (BEAST); hệ Nham (STONE); species `bison`.
- **Base stats 1★:** HP 250, ATK 60, DEF 31, MATK 10, MDEF 24, range 1, rageMax 4, crit 0.05, critDmg 1.5, evade 0.08, accuracy 0.95.
- **Vai trò chơi:** Húc xuyên hàng trước để đâm luôn kẻ đứng phía sau.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Sừng Ba Mũi:** effect family `ram_charge_pierce`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: 1 kẻ địch tuyến trước bị nhắm + tối đa 1 kẻ phía sau cùng hàng; hình: 1 đòn húc đơn mục tiêu xuyên hàng; chọn: Ưu tiên kẻ địch còn sống gần tuyến trước nhất.; số lượng: 1 mục tiêu chính + tối đa 1 mục tiêu phía sau; thời lượng: tức thì.
- **1★:** Húc 1 kẻ địch tuyến trước bị nhắm, gây (20 + 80% ATK) sát thương vật lý. Nếu có kẻ địch đứng ngay phía sau cùng hàng, mục tiêu đó chịu thêm 60% sát thương của cú húc.
- **2★:** Húc 1 kẻ địch tuyến trước bị nhắm, gây (20 + 80% ATK) sát thương vật lý. Nếu có kẻ địch đứng ngay phía sau cùng hàng, mục tiêu đó chịu thêm 60% sát thương của cú húc. Mục tiêu chính bị giảm 30 giáp trong 1 lượt.
- **3★:** Húc 1 kẻ địch tuyến trước bị nhắm, gây (20 + 80% ATK) sát thương vật lý. Nếu có kẻ địch đứng ngay phía sau cùng hàng, mục tiêu đó chịu thêm 60% sát thương của cú húc. Mục tiêu chính bị giảm 40 giáp trong 2 lượt.
- **Skin/cosmetic đang authored:** thornParade (locked): Diễu Hành Gai → Tam Giác Long → Gai Vương Long

### turtle_mire — Rùa Đầm Lầy
- **Identity:** Tier 3; Đỡ đòn (TANKER); faction Bò sát (REPTILE); hệ Thủy (TIDE); species `rua`.
- **Base stats 1★:** HP 410, ATK 50, DEF 36, MATK 16, MDEF 30, range 1, rageMax 5, crit 0.05, critDmg 1.5, evade 0.05, accuracy 0.95.
- **Vai trò chơi:** Cắm mai giữ tuyến trước rồi chia bớt sức chịu cho đồng minh kế bên.
- **Đánh thường:** melee, physical, 1×ATK, 1 kẻ địch gần nhất, single ×1.
- **Kỹ năng — Mai Rùa Bất Tử:** effect family `resilient_shield`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: 1 kẻ địch tuyến trước gần nhất và bản thân; hình: 1 ô áp sát + tự thân; chọn: Khóa kẻ địch tuyến trước gần nhất rồi dựng khiên lên bản thân.; số lượng: 1 kẻ địch + bản thân; thời lượng: khiêu khích 2 lượt; khiên tức thì.
- **1★:** Đập 1 kẻ địch tuyến trước gần nhất, gây (15 + 40% DEF) sát thương vật lý. Bản thân nhận khiên bằng (40 + 25% DEF) và khiêu khích toàn bộ kẻ địch trong 2 lượt.
- **2★:** Đập 1 kẻ địch tuyến trước gần nhất, gây (15 + 40% DEF) sát thương vật lý. Bản thân nhận khiên bằng (48 + 25% DEF) và khiêu khích toàn bộ kẻ địch trong 2 lượt. Đồng minh gần nhất nhận 35% lượng khiên này và hồi 1 nộ.
- **3★:** Đập 1 kẻ địch tuyến trước gần nhất, gây (15 + 40% DEF) sát thương vật lý. Bản thân nhận khiên bằng (56 + 25% DEF) và khiêu khích toàn bộ kẻ địch trong 2 lượt. Đồng minh gần nhất nhận 50% lượng khiên này; nếu khiên chia còn tồn tại khi hết hạn, đồng minh đó được thanh tẩy 1 hiệu ứng bất lợi và nhận 20% giảm sát thương trong 1 lượt.
- **Skin/cosmetic đang authored:** bogCitadel (locked): Thành Đầm → Rùa Thành → Pháo Đài Rùa Vương

### unicorn_light — Kỳ Lân Sáng
- **Identity:** Tier 2; Hỗ trợ (SUPPORT); faction Huyền thoại (MYTHICAL); hệ Linh (SPIRIT); species `ky-lan-sang`.
- **Base stats 1★:** HP 265, ATK 25, DEF 16, MATK 70, MDEF 27, range 3, rageMax 4, crit 0.05, critDmg 1.5, evade 0.07, accuracy 0.95.
- **Vai trò chơi:** Buff ATK cho đồng minh có ATK cao nhất.
- **Đánh thường:** projectile, magic, 1×MATK, 1 kẻ địch gần nhất, single ×1.
- **Kỹ năng — Sừng Kỳ Lân:** effect family `unicorn_atk_buff`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: 1 đồng minh khác có ATK cao nhất; hình: chọn theo ATK cao nhất; chọn: Ưu tiên đồng minh khác có ATK hiện tại cao nhất, không chọn bản thân.; số lượng: 1 mục tiêu; thời lượng: 3 lượt.
- **1★:** Tăng 25% ATK trong 3 lượt cho 1 đồng minh khác có ATK cao nhất.
- **2★:** Tăng 35% ATK trong 3 lượt cho 1 đồng minh khác có ATK cao nhất.
- **3★:** Tăng 45% ATK trong 4 lượt cho 2 đồng minh khác có ATK cao nhất.
- **Skin/cosmetic đang authored:** auroraSpire (locked): Cực Quang → Kỳ Lân Sáng → Cực Quang Kỳ Lân Vương

### viper_strike — Giun Tấn Công
- **Identity:** Tier 2; Sát thủ (ASSASSIN); faction Bò sát (REPTILE); hệ Trùng (SWARM); species `ran-luc`.
- **Base stats 1★:** HP 258, ATK 76, DEF 16, MATK 20, MDEF 14, range 1, rageMax 3, crit 0.25, critDmg 1.5, evade 0.15, accuracy 0.95.
- **Vai trò chơi:** Lao vào hậu tuyến, cắn kép dồn nọc rồi bẻ nhịp con mồi bằng nọc độc nối chuỗi.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Cắn Độc Kép:** effect family `viper_chain_venom`; cost nộ 1★/2★/3★ = **1/2/3**. mục tiêu: 1 kẻ địch hậu tuyến bị nhắm; hình: 1 ô hậu tuyến, 2 cú cắn + truy sát/lan độc ở sao cao; chọn: Ưu tiên kẻ địch hậu tuyến bị nhắm.; số lượng: 1 mục tiêu, 2 đòn; thời lượng: nhiễm độc 2 lượt.
- **1★:** Lao vào 1 kẻ địch hậu tuyến bị nhắm rồi cắn 2 lần. Mỗi đòn gây (12 + 50% ATK) sát thương vật lý. Sau 2 đòn, mục tiêu bị nhiễm độc 8 mỗi lượt trong 2 lượt.
- **2★:** Lao vào 1 kẻ địch hậu tuyến bị nhắm rồi cắn 2 lần. Mỗi đòn gây (14 + 60% ATK) sát thương vật lý. Nếu mục tiêu còn sống sau cú cắn đầu, cú cắn thứ hai gây thêm 40% sát thương và mục tiêu mất 1 nộ. Sau 2 đòn, mục tiêu bị nhiễm độc 10 mỗi lượt trong 2 lượt.
- **3★:** Lao vào 1 kẻ địch hậu tuyến bị nhắm rồi cắn 2 lần. Mỗi đòn gây (17 + 70% ATK) sát thương vật lý. Nếu mục tiêu còn sống sau cú cắn đầu, cú cắn thứ hai gây thêm 40% sát thương và mục tiêu mất 1 nộ. Sau 2 đòn, mục tiêu bị nhiễm độc 13 mỗi lượt trong 3 lượt. Nếu mục tiêu còn sống sau cả chuỗi, nọc độc lan sang 1 kẻ địch hậu tuyến gần nhất với 60% lượng độc mỗi lượt trong 2 lượt. Nếu mục tiêu chết vì chuỗi cắn, lập tức cắn bồi 1 kẻ địch hậu tuyến gần nhất, gây thêm 50% sát thương của 1 cú cắn.
- **Skin/cosmetic đang authored:** jadeFang (locked): Ngọc Nanh → Rắn Ngọc → Ngọc Xà Vương

### vulture_scavunge — Kền Kền Ăn Xác
- **Identity:** Tier 4; Sát thủ (ASSASSIN); faction Chim (AVIAN); hệ Phong (WIND); species `dai-bang`.
- **Base stats 1★:** HP 260, ATK 88, DEF 15, MATK 15, MDEF 16, range 1, rageMax 3, crit 0.25, critDmg 1.5, evade 0.15, accuracy 0.95.
- **Vai trò chơi:** Sục vào mục tiêu máu thấp nhất ở tuyến sau để hút máu rồi truy sang hậu tuyến còn sống.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Xé Xác:** effect family `scavenge_heal`; cost nộ 1★/2★/3★ = **1/2/3**. mục tiêu: 1 kẻ địch hậu tuyến có % máu thấp nhất; hình: 1 cú mổ đơn mục tiêu; chọn: Ưu tiên kẻ địch hậu tuyến có % máu thấp nhất.; số lượng: 1 mục tiêu; thời lượng: đánh dấu 2 lượt.
- **1★:** Mổ 1 kẻ địch hậu tuyến có % máu thấp nhất, gây (30 + 1.1 x ATK) sát thương vật lý. Nếu mục tiêu chết, hồi máu bằng 20% sát thương gây ra.
- **2★:** Mổ 1 kẻ địch hậu tuyến có % máu thấp nhất, gây (30 + 1.1 x ATK) sát thương vật lý. Nếu mục tiêu còn sống dưới 50% máu, nó bị đánh dấu; lần mổ kế tiếp vào mục tiêu đó gây thêm 30% sát thương và mục tiêu mất 1 nộ.
- **3★:** Mổ 1 kẻ địch hậu tuyến có % máu thấp nhất, gây (30 + 1.1 x ATK) sát thương vật lý. Nếu mục tiêu chết, mổ vọt sang tối đa 2 kẻ địch hậu tuyến gần nhất, mỗi mục tiêu chịu 80% sát thương. Nếu mục tiêu còn sống dưới 50% máu, nó bị đánh dấu và giảm 20% né tránh trong 2 lượt.
- **Skin/cosmetic đang authored:** carrionCrest (locked): Mào Xác → Kền Khăn → Kền Vương

### walrus_ice — Hải Mã Băng
- **Identity:** Tier 3; Đỡ đòn (TANKER); faction Thủy sinh (AQUATIC); hệ Thủy (TIDE); species `hai-ma`.
- **Base stats 1★:** HP 405, ATK 48, DEF 38, MATK 15, MDEF 31, range 1, rageMax 5, crit 0.05, critDmg 1.5, evade 0.05, accuracy 0.95.
- **Vai trò chơi:** Bơm khiên băng cho đồng minh thấp máu và làm dày lớp phòng thủ của họ.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Hào Quang Băng:** effect family `wind_shield_ally`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: 2 đồng minh có % máu thấp nhất; hình: 2 ô đồng minh; chọn: Chọn 2 đồng minh có % máu thấp nhất.; số lượng: 2 mục tiêu; thời lượng: khiên tức thì.
- **1★:** Tạo khiên bằng (35 + 30% MATK) cho 2 đồng minh có % máu thấp nhất.
- **2★:** Tạo khiên bằng (50 + 40% MATK) cho 2 đồng minh có % máu thấp nhất. Mỗi mục tiêu được khiên xóa 1 hiệu ứng bất lợi; mục tiêu còn dưới 50% máu nhận thêm 1 nộ.
- **3★:** Tạo khiên bằng (65 + 50% MATK) cho 3 đồng minh có % máu thấp nhất. Mỗi mục tiêu được khiên xóa 1 hiệu ứng bất lợi và nhận 15% né tránh trong 2 lượt. Đồng minh có % máu thấp nhất được hồi thêm 60 HP.
- **Skin/cosmetic đang authored:** iceHarbor (locked): Cảng Băng → Hải Mã Băng → Băng Cảng Vương

### wasp_arcane — Ong Phép
- **Identity:** Tier 4; Pháp sư (MAGE); faction Côn trùng (INSECT); hệ Linh (SPIRIT); species `ong-phep`.
- **Base stats 1★:** HP 310, ATK 23, DEF 12, MATK 105, MDEF 25, range 4, rageMax 5, crit 0.1, critDmg 1.5, evade 0.05, accuracy 0.95.
- **Vai trò chơi:** Rải phấn mê lên toàn bàn để cấu rỉa và khóa kỹ năng.
- **Đánh thường:** tầm xa/projectile, magic từ MATK, 1×MATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Phấn Hoa Mê:** effect family `pollen_confuse`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: toàn bộ kẻ địch; hình: toàn bộ bàn địch; chọn: Không cần khóa mục tiêu; phủ toàn bộ bàn địch.; số lượng: toàn bộ kẻ địch; thời lượng: câm lặng 1 lượt (40%).
- **1★:** Rải phấn mê lên toàn bộ kẻ địch, gây (20 + 60% MATK) sát thương phép. Mỗi mục tiêu có 40% bị câm lặng trong 1 lượt.
- **2★:** Rải phấn mê lên toàn bộ kẻ địch, gây (24 + 72% MATK) sát thương phép. Mỗi mục tiêu có 50% bị câm lặng trong 1 lượt.
- **3★:** Rải phấn mê lên toàn bộ kẻ địch, gây (28 + 84% MATK) sát thương phép. Mỗi mục tiêu có 65% bị câm lặng trong 2 lượt.
- **Skin/cosmetic đang authored:** glyphSwarm (locked): Bầy Phù Văn → Ong Phép → Phù Văn Vương

### wasp_assassin — Dao Ong Sát Thủ
- **Identity:** Tier 4; Sát thủ (ASSASSIN); faction Côn trùng (INSECT); hệ Trùng (SWARM); species `ong-sat`.
- **Base stats 1★:** HP 290, ATK 86, DEF 19, MATK 23, MDEF 17, range 1, rageMax 3, crit 0.25, critDmg 1.5, evade 0.15, accuracy 0.95.
- **Vai trò chơi:** Đâm hậu tuyến đã nhiễm độc để xuyên giáp, rút nộ và truy sát mục tiêu mỏng.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Lưỡi Kiếm Xuyên:** effect family `single_burst_armor_pen`; cost nộ 1★/2★/3★ = **1/2/3**. mục tiêu: 1 kẻ địch hậu tuyến; hình: 1 đòn đâm hậu tuyến; chọn: Ưu tiên kẻ địch ở cột cuối cùng phía địch.; số lượng: 1; thời lượng: tức thì.
- **1★:** Đâm 1 kẻ địch hậu tuyến, gây (40 + 1.5 x ATK) sát thương vật lý, bỏ qua 40% giáp, và mỗi đồng minh Trùng đang sống tăng thêm 5% sát thương cú đâm.
- **2★:** Đâm 1 kẻ địch hậu tuyến, gây (40 + 1.5 x ATK) sát thương vật lý, bỏ qua 40% giáp, và mỗi đồng minh Trùng đang sống tăng thêm 8% sát thương cú đâm; nếu mục tiêu đã nhiễm độc, bỏ qua thêm 15% giáp và mục tiêu mất 1 nộ.
- **3★:** Đâm 1 kẻ địch hậu tuyến, gây (40 + 1.5 x ATK) sát thương vật lý, bỏ qua 40% giáp, và mỗi đồng minh Trùng đang sống tăng thêm 10% sát thương cú đâm; nếu mục tiêu đã nhiễm độc, bỏ qua thêm 15% giáp và mục tiêu mất 1 nộ. Nếu mục tiêu chết hoặc còn dưới 40% máu sau cú đâm, mũi đâm phụ chuyển sang tối đa 2 kẻ địch hậu tuyến gần nhất với 70% sát thương.
- **Skin/cosmetic đang authored:** nightDart (locked): Phi Tiêu Đêm → Ong Sát → Huyền Đêm Vương

### wasp_sting — Ong Bắp Cày
- **Identity:** Tier 2; Xạ thủ (ARCHER); faction Côn trùng (INSECT); hệ Trùng (SWARM); species `ong`.
- **Base stats 1★:** HP 258, ATK 67, DEF 15, MATK 12, MDEF 15, range 4, rageMax 3, crit 0.2, critDmg 1.5, evade 0.1, accuracy 0.95.
- **Vai trò chơi:** Phóng kim độc rải mục tiêu, kim trúng kẻ đã nhiễm độc sẽ đau hơn.
- **Đánh thường:** tầm xa/projectile, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Châm Liên Hoàn:** effect family `multi_sting_poison`; cost nộ 1★/2★/3★ = **1/2/3**. mục tiêu: 2 kẻ địch ngẫu nhiên không trùng mục tiêu; hình: các mục tiêu rời trên bàn địch; chọn: Ưu tiên ngẫu nhiên không trùng mục tiêu.; số lượng: 2 mục tiêu; thời lượng: nhiễm độc 2 lượt.
- **1★:** Phóng 2 kim độc vào 2 kẻ địch ngẫu nhiên không trùng mục tiêu, mỗi kim gây (15 + 0.65 x ATK) x Hệ số sao (1) = (15 + 0.65 x 65) x 1 = 57 (ATK) và nhiễm độc 10 mỗi lượt trong 2 lượt.
- **2★:** Phóng 3 kim độc vào 3 kẻ địch ngẫu nhiên không trùng mục tiêu, mỗi kim gây (15 + 0.65 x ATK) x Hệ số sao (1.2) = (15 + 0.65 x 104) x 1.2 = 99 (ATK) và nhiễm độc 15 mỗi lượt trong 2 lượt. Kim trúng mục tiêu đã nhiễm độc gây [(15 + 0.65 x ATK) x Hệ số sao (1.2)] x Hệ số Cắn Bồi (1.3) = [(15 + 0.65 x 104) x 1.2] x 1.3 = 129 (ATK), đồng thời kéo dài độc 1 lượt và mục tiêu mất 1 nộ.
- **3★:** Phóng 4 kim độc vào 4 kẻ địch ngẫu nhiên không trùng mục tiêu, mỗi kim gây (15 + 0.65 x ATK) x Hệ số sao (1.4) = (15 + 0.65 x 163) x 1.4 = 169 (ATK) và nhiễm độc 20 mỗi lượt trong 3 lượt. Kim trúng mục tiêu đã nhiễm độc gây [(15 + 0.65 x ATK) x Hệ số sao (1.4)] x Hệ số Cắn Bồi (1.3) = [(15 + 0.65 x 163) x 1.4] x 1.3 = 220 (ATK), đồng thời kéo dài độc 1 lượt và mục tiêu mất 1 nộ. Sau cú trúng đó, nọc độc văng sang 1 kẻ địch gần nhất, gây [(15 + 0.65 x ATK) x Hệ số sao (1.4)] x Hệ số Lan Độc (0.6) = [(15 + 0.65 x 163) x 1.4] x 0.6 = 101 (ATK) và nhiễm độc 12 mỗi lượt trong 2 lượt. Nếu mục tiêu đang nhiễm độc mà ngã trong cú chích này, 1 kim chưa dùng tự chuyển sang kẻ địch bị độc gần nhất.
- **Skin/cosmetic đang authored:** sunpin (locked): Ghim Nắng → Ong Vàng → Vàng Phong Vương

### weasel_quick — Chồn Nhanh
- **Identity:** Tier 2; Sát thủ (ASSASSIN); faction Thú (BEAST); hệ Phong (WIND); species `chon`.
- **Base stats 1★:** HP 254, ATK 73, DEF 17, MATK 17, MDEF 15, range 1, rageMax 3, crit 0.25, critDmg 1.5, evade 0.15, accuracy 0.95.
- **Vai trò chơi:** Đâm chớp nhoáng từ cột cuối cùng phía địch để rút nộ và bẻ độ chính xác carry.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Đâm Nhanh:** effect family `quick_strike_rage`; cost nộ 1★/2★/3★ = **1/2/3**. mục tiêu: 1 kẻ địch ở cột cuối cùng phía địch bị nhắm; hình: 1 ô ở cột cuối cùng phía địch bị khóa; chọn: Ưu tiên kẻ địch đứng ở cột cuối cùng phía địch.; số lượng: 1 mục tiêu; thời lượng: giảm chính xác 2 lượt; cộng nộ tức thì.
- **1★:** Lao vào 1 kẻ địch ở cột cuối cùng phía địch bị nhắm, gây (15 + 0.6 x ATK) x Hệ số sao (1) = (15 + 0.6 x 73) x 1 = 59 (ATK), hồi 5 nộ cho bản thân, và giảm 15% chính xác của mục tiêu trong 2 lượt.
- **2★:** Lao vào 1 kẻ địch ở cột cuối cùng phía địch bị nhắm, gây (15 + 0.6 x ATK) x Hệ số sao (1.2) = (15 + 0.6 x 117) x 1.2 = 102 (ATK), hồi 5 nộ cho bản thân, và giảm 25% chính xác của mục tiêu trong 2 lượt. Nếu mục tiêu còn dưới 60% máu, Chồn Nhanh rút thêm 1 nộ từ mục tiêu.
- **3★:** Lao vào 1 kẻ địch ở cột cuối cùng phía địch bị nhắm, gây (15 + 0.6 x ATK) x Hệ số sao (1.4) = (15 + 0.6 x 183) x 1.4 = 175 (ATK), hồi 5 nộ cho bản thân, và giảm 35% chính xác của mục tiêu trong 2 lượt. Nếu mục tiêu còn dưới 60% máu, Chồn Nhanh rút thêm 1 nộ từ mục tiêu. Nếu mục tiêu chết vì cú lao, lập tức lao sang 1 kẻ địch khác ở cột cuối cùng phía địch gần nhất và gây [(15 + 0.6 x ATK) x Hệ số sao (1.4)] x Hệ số Truy Kích (0.5) = [(15 + 0.6 x 183) x 1.4] x 0.5 = 88 (ATK).
- **Skin/cosmetic đang authored:** blurDash (locked): Lướt Nhanh → Chồn Bay → Tốc Độ Vương

### whale_song — Cá Voi Cổ Đại
- **Identity:** Tier 5; Đấu sĩ (FIGHTER); faction Thủy sinh (AQUATIC); hệ Thủy (TIDE); species `ca-voi`.
- **Base stats 1★:** HP 450, ATK 90, DEF 60, MATK 30, MDEF 50, range 1, rageMax 5, crit 0.05, critDmg 1.5, evade 0.08, accuracy 0.95.
- **Vai trò chơi:** Gọi sóng thần quét toàn phe địch rồi đẩy lùi hàng trước.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Sóng Cổ Đại:** effect family `global_knockback`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: toàn bộ kẻ địch; hình: quét toàn bộ bàn địch; chọn: Quét toàn bộ phe địch; hiệu ứng đẩy chỉ áp vào các mục tiêu đang đứng ở hàng tiền tuyến.; số lượng: toàn bộ kẻ địch; hàng tiền tuyến bị đẩy lùi; thời lượng: đẩy lùi tức thì.
- **1★:** Gọi sóng thần đánh trúng toàn bộ kẻ địch, gây (45 + 110% MATK) sát thương phép. Tuyến trước phía địch bị đẩy lùi 1 ô.
- **2★:** Gọi sóng thần đánh trúng toàn bộ kẻ địch, gây (54 + 132% MATK) sát thương phép. Tuyến trước phía địch bị đẩy lùi 1 ô; mỗi mục tiêu bị đẩy có 30% bị choáng 1 lượt.
- **3★:** Gọi sóng thần đánh trúng toàn bộ kẻ địch, gây (63 + 154% MATK) sát thương phép. Tuyến trước phía địch bị đẩy lùi tối đa 2 ô; mỗi mục tiêu bị đẩy có 50% bị choáng 1 lượt.
- **Skin/cosmetic đang authored:** deepCanticle (locked): Khúc Sâu → Cá Voi Ca → Thâm Hải Vương

### wisp_light — Hồn Ma Sáng
- **Identity:** Tier 3; Hỗ trợ (SUPPORT); faction Huyền thoại (MYTHICAL); hệ Linh (SPIRIT); species `hon-ma`.
- **Base stats 1★:** HP 285, ATK 27, DEF 17, MATK 74, MDEF 28, range 3, rageMax 4, crit 0.05, critDmg 1.5, evade 0.07, accuracy 0.95.
- **Vai trò chơi:** Dồn hồi phục của bản thân thành cứu nguy cho đồng minh thấp máu.
- **Đánh thường:** tầm xa/projectile, magic từ MATK, 1×MATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Hồn Hộ Mệnh:** effect family `soul_link_heal`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: 1 đồng minh có % máu thấp nhất; hình: tự thân; chọn: Tự kích hoạt lên bản thân.; số lượng: 1 đồng minh; thời lượng: 2 lượt.
- **1★:** Liên kết linh hồn với 1 đồng minh có % máu thấp nhất trong 2 lượt. Mọi hồi phục mà Hồn Ma nhận được sẽ chuyển thành hồi máu cho mục tiêu.
- **2★:** Liên kết linh hồn với 1 đồng minh có % máu thấp nhất trong 2 lượt. Mọi hồi phục mà Hồn Ma nhận được sẽ chuyển thành hồi máu cho mục tiêu với 120% hiệu lực. Nếu Hồn Ma được hồi máu từ trên 50% HP, mục tiêu nhận thêm 1 lớp khiên nhỏ và thanh tẩy 1 hiệu ứng xấu.
- **3★:** Liên kết linh hồn với 2 đồng minh có % máu thấp nhất trong 3 lượt. Đồng minh chính nhận 150% hồi phục mà Hồn Ma nhận được, đồng minh phụ nhận 90%. Nếu Hồn Ma được hồi máu từ trên 50% HP, cả hai mục tiêu nhận thêm 1 lớp khiên nhỏ; đồng minh chính còn được thanh tẩy 1 hiệu ứng xấu và hồi 1 nộ.
- **Skin/cosmetic đang authored:** dawnSpark (locked): Tia Bình Minh → Lân Tinh Sáng → Bình Minh Vương

### wolf_alpha — Sói Thủ Lĩnh
- **Identity:** Tier 3; Đấu sĩ (FIGHTER); faction Thú (BEAST); hệ Nham (STONE); species `soi`.
- **Base stats 1★:** HP 370, ATK 77, DEF 25, MATK 18, MDEF 21, range 1, rageMax 5, crit 0.08, critDmg 1.5, evade 0.09, accuracy 0.95.
- **Vai trò chơi:** Gọi đồng minh cùng hàng lao theo để dồn mồi đang bị khóa rồi nối chuỗi săn.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Tiếng Tru Đầu Đàn:** effect family `wolf_pack_hunt`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: 1 kẻ địch đang bị nhắm và các đồng minh cùng hàng của bản thân; hình: 1 ô mục tiêu và cùng hàng của bản thân; chọn: Đồng minh hỗ trợ cùng hàng luôn tham gia; các đồng minh còn lại có 30% đánh bồi.; số lượng: 1 mục tiêu chính và tối đa toàn bộ đồng minh cùng hàng có thể đánh bồi; thời lượng: tức thì; bản thân tăng ATK 2 lượt.
- **1★:** Tự tăng 10% ATK trong 2 lượt rồi tung 1 đòn đánh thường vào 1 kẻ địch đang bị nhắm. Từng đồng minh cùng hàng có 30% đánh bồi bằng đòn đánh thường. Đồng minh hỗ trợ cùng hàng luôn tham gia đánh bồi.
- **2★:** Tự tăng 15% ATK trong 2 lượt rồi tung 1 đòn đánh thường vào 1 kẻ địch đang bị nhắm. Từng đồng minh cùng hàng có 40% đánh bồi bằng đòn đánh thường. Đồng minh hỗ trợ cùng hàng luôn tham gia; nếu mục tiêu còn dưới 60% máu và đồng minh đó đã đầy nộ, nó dùng kỹ năng thay cho đòn đánh thường. Nếu có từ 2 đồng minh cùng hàng tham gia chuỗi săn, mục tiêu mất 1 nộ và bị giảm 15 DEF trong 2 lượt.
- **3★:** Tự tăng 20% ATK trong 2 lượt rồi tung 1 đòn đánh thường vào 1 kẻ địch đang bị nhắm. Từng đồng minh cùng hàng có 40% đánh bồi bằng đòn đánh thường. Đồng minh hỗ trợ cùng hàng luôn tham gia; nếu mục tiêu còn dưới 60% máu và đồng minh đó đã đầy nộ, nó dùng kỹ năng thay cho đòn đánh thường. Nếu cùng hàng có xạ thủ, xạ thủ đó luôn đánh bồi; nếu đã đầy nộ thì dùng kỹ năng thay cho đòn đánh thường. Nếu có từ 2 đồng minh cùng hàng tham gia chuỗi săn, mục tiêu mất 1 nộ và bị giảm 20 DEF trong 2 lượt. Nếu mục tiêu chết trong chuỗi, các đòn đánh bồi còn lại tự chuyển sang kẻ địch gần nhất; sau chuỗi, Sói Thủ Lĩnh vồ bồi thêm 1 cú với Hệ số Vồ Chốt (0.7) theo sát thương đòn đánh thường của bản thân.
- **Skin/cosmetic đang authored:** moonPack (locked): Bầy Trăng → Lãnh Bầy → Nguyệt Vương

### wolverine_rage — Hải Ly Cuồng Nộ
- **Identity:** Tier 3; Đấu sĩ (FIGHTER); faction Thú (BEAST); hệ Hỏa (FIRE); species `chon-soi`.
- **Base stats 1★:** HP 334, ATK 79, DEF 24, MATK 18, MDEF 18, range 1, rageMax 3, crit 0.05, critDmg 1.5, evade 0.08, accuracy 0.95.
- **Vai trò chơi:** Tự cuồng nộ để vừa đánh đau hơn vừa tự nuôi nhịp giao tranh.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Cuồng Nộ Hải Ly:** effect family `self_bersek`; cost nộ 1★/2★/3★ = **1/2/3**. mục tiêu: bản thân; hình: tự thân; chọn: Tự kích hoạt lên bản thân.; số lượng: 1 mục tiêu; thời lượng: cuồng nộ 3 lượt.
- **1★:** Tự cuồng nộ, tăng 50% ATK trong 3 lượt.
- **2★:** Tự cuồng nộ, tăng 60% ATK trong 3 lượt và hút 15% sát thương gây ra thành máu. Đòn đánh thường đầu tiên trong trạng thái cuồng nộ gây thêm 40% sát thương.
- **3★:** Tự cuồng nộ, tăng 70% ATK trong 3 lượt và hút 15% sát thương gây ra thành máu. Đòn đánh thường đầu tiên trong trạng thái cuồng nộ gây thêm 50% sát thương. Nếu hạ gục mục tiêu trong lúc cuồng nộ, hồi 1 nộ, kéo dài cuồng nộ thêm 1 lượt và lập tức tung 1 đòn đánh thường vào kẻ địch gần nhất.
- **Skin/cosmetic đang authored:** ironFury (locked): Sắt Cuồng → Chon Nộ → Sắt Nộ Vương

### woodpecker_drill — Gõ Kiến Khoan
- **Identity:** Tier 3; Xạ thủ (ARCHER); faction Chim (AVIAN); hệ Mộc (WOOD); species `go-kien`.
- **Base stats 1★:** HP 286, ATK 74, DEF 14, MATK 14, MDEF 14, range 4, rageMax 3, crit 0.2, critDmg 1.5, evade 0.1, accuracy 0.95.
- **Vai trò chơi:** Khoan thủng tanker tuyến trước rồi tán áp lực sang cụm địch gần đó.
- **Đánh thường:** tầm xa/projectile, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Khoan Liên Tục:** effect family `rapid_fire`; cost nộ 1★/2★/3★ = **1/2/3**. mục tiêu: 1 tanker địch ở cột đầu tiên phía địch; nếu không có thì 1 kẻ địch ở cột đó có HP tối đa cao nhất; hình: 3 phát liên tiếp vào cùng 1 mục tiêu; chọn: Ưu tiên tanker ở cột đầu tiên phía địch; nếu không có thì khóa kẻ địch ở cột đó có HP tối đa cao nhất.; số lượng: 1 mục tiêu chính, 3 phát; thời lượng: giảm 18 DEF trong 2 lượt.
- **1★:** Bắn liên tiếp 3 phát vào 1 tanker địch ở cột đầu tiên phía địch; nếu không có thì khóa 1 kẻ địch ở cột đó có HP tối đa cao nhất. Mỗi phát gây (10 + 0.45 x ATK) x Hệ số sao (1) = (10 + 0.45 x 74) x 1 = 43 (ATK). Phát 2 làm mục tiêu giảm 18 DEF trong 2 lượt. Phát 3 gây [(10 + 0.45 x ATK) x Hệ số sao (1)] x Hệ số Khoan Sâu (1.4) = [(10 + 0.45 x 74) x 1] x 1.4 = 60 (ATK). Nếu mục tiêu đang bị giảm DEF bởi chuỗi này, phát 3 bỏ qua 25% DEF còn lại.
- **2★:** Bắn liên tiếp 4 phát vào 1 tanker địch ở cột đầu tiên phía địch; nếu không có thì khóa 1 kẻ địch ở cột đó có HP tối đa cao nhất. Mỗi phát gây (10 + 0.45 x ATK) x Hệ số sao (1.2) = (10 + 0.45 x 118) x 1.2 = 76 (ATK). Nếu mục tiêu ngã trước khi hết chuỗi, các phát còn lại tự chuyển sang kẻ địch gần nhất và vẫn giữ mốc phát hiện tại. Phát 2 làm mục tiêu giảm 18 DEF trong 2 lượt. Phát 3 gây [(10 + 0.45 x ATK) x Hệ số sao (1.2)] x Hệ số Khoan Sâu (1.4) = [(10 + 0.45 x 118) x 1.2] x 1.4 = 106 (ATK). Nếu mục tiêu đang bị giảm DEF bởi chuỗi này, phát 3 bỏ qua 25% DEF còn lại. Phát 4 làm văng mảnh giáp sang 2 kẻ địch gần nhất, mỗi mục tiêu chịu [(10 + 0.45 x ATK) x Hệ số sao (1.2)] x Hệ số Văng (0.5) = [(10 + 0.45 x 118) x 1.2] x 0.5 = 38 (ATK) và giảm 10 DEF trong 2 lượt.
- **3★:** Bắn liên tiếp 5 phát vào 1 tanker địch ở cột đầu tiên phía địch; nếu không có thì khóa 1 kẻ địch ở cột đó có HP tối đa cao nhất. Mỗi phát gây (10 + 0.45 x ATK) x Hệ số sao (1.4) = (10 + 0.45 x 185) x 1.4 = 131 (ATK). Nếu mục tiêu ngã trước khi hết chuỗi, các phát còn lại tự chuyển sang kẻ địch gần nhất và vẫn giữ mốc phát hiện tại. Phát 2 làm mục tiêu giảm 18 DEF trong 2 lượt. Phát 3 gây [(10 + 0.45 x ATK) x Hệ số sao (1.4)] x Hệ số Khoan Sâu (1.4) = [(10 + 0.45 x 185) x 1.4] x 1.4 = 183 (ATK). Nếu mục tiêu đang bị giảm DEF bởi chuỗi này, phát 3 bỏ qua 25% DEF còn lại. Phát 4 làm văng mảnh giáp sang 2 kẻ địch gần nhất, mỗi mục tiêu chịu [(10 + 0.45 x ATK) x Hệ số sao (1.4)] x Hệ số Văng (0.5) = [(10 + 0.45 x 185) x 1.4] x 0.5 = 66 (ATK) và giảm 10 DEF trong 2 lượt. Phát 5 bắn tách 3 mũi khoan vào tối đa 3 kẻ địch gần nhất quanh mục tiêu hiện tại, mỗi mũi gây [(10 + 0.45 x ATK) x Hệ số sao (1.4)] x Hệ số Tán (1) = [(10 + 0.45 x 185) x 1.4] x 1 = 131 (ATK), ưu tiên mục tiêu chưa bị chuỗi này chạm tới.
- **Skin/cosmetic đang authored:** hollowBeat (locked): Nhịp Rỗng → Gõ Kiến → Gõ Kiến Vương

### worm_ice — Cóc Băng
- **Identity:** Tier 2; Pháp sư (MAGE); faction Bò sát (REPTILE); hệ Thủy (TIDE); species `coc`.
- **Base stats 1★:** HP 240, ATK 18, DEF 10, MATK 80, MDEF 21, range 4, rageMax 5, crit 0.1, critDmg 1.5, evade 0.05, accuracy 0.95.
- **Vai trò chơi:** Phun băng để khóa mục tiêu và bẻ gãy né tránh.
- **Đánh thường:** tầm xa/projectile, magic từ MATK, 1×MATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Phun Băng:** effect family `ice_blast_freeze`; cost nộ 1★/2★/3★ = **3/4/5**. mục tiêu: 1 kẻ địch bị nhắm; hình: 1 ô đơn mục tiêu; chọn: Ưu tiên mục tiêu đang bị nhắm.; số lượng: 1 mục tiêu; thời lượng: đóng băng 1 lượt (40%); giảm né tránh 2 lượt.
- **1★:** Phun băng vào 1 kẻ địch bị nhắm, gây (25 + 85% MATK) sát thương phép. Mục tiêu có 40% bị đóng băng 1 lượt và giảm 15% né tránh trong 2 lượt.
- **2★:** Phun băng vào 1 kẻ địch bị nhắm, gây (30 + 102% MATK) sát thương phép. Mục tiêu có 50% bị đóng băng 1 lượt và giảm 25% né tránh trong 2 lượt.
- **3★:** Phun băng vào 1 kẻ địch bị nhắm, gây (35 + 119% MATK) sát thương phép. Mục tiêu có 60% bị đóng băng 1 lượt và giảm 35% né tránh trong 2 lượt.
- **Skin/cosmetic đang authored:** frostBurrow (locked): Hang Băng → Giùn Băng → Băng Giùn Vương

### worm_queen — Sâu Xanh
- **Identity:** Tier 4; Pháp sư (MAGE); faction Côn trùng (INSECT); hệ Mộc (WOOD); species `sau`.
- **Base stats 1★:** HP 304, ATK 22, DEF 13, MATK 97, MDEF 24, range 4, rageMax 4, crit 0.1, critDmg 1.5, evade 0.05, accuracy 0.95.
- **Vai trò chơi:** Hóa kén để lột xác thành pháp sư né tránh cho cả đội.
- **Đánh thường:** tầm xa/projectile, magic từ MATK, 1×MATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Hóa Kén Bướm Gió:** effect family `metamorphosis`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: bản thân; hình: tự thân; chọn: Chỉ tự kích hoạt lên bản thân.; số lượng: 1 mục tiêu; thời lượng: đến hết giao tranh.
- **1★:** Hóa kén thành Bướm Gió, tăng 50% MATK cho bản thân đến hết giao tranh. Đòn đánh thường của bản thân đổi sang sát thương phép theo MATK.
- **2★:** Hóa kén thành Bướm Gió, tăng 50% MATK cho bản thân đến hết giao tranh. Đòn đánh thường của bản thân đổi sang sát thương phép theo MATK. Toàn bộ đồng minh nhận 12% né tránh đến hết giao tranh.
- **3★:** Hóa kén thành Bướm Gió, tăng 70% MATK cho bản thân đến hết giao tranh. Đòn đánh thường của bản thân đổi sang sát thương phép theo MATK. Toàn bộ đồng minh nhận 20% né tránh đến hết giao tranh.
- **Skin/cosmetic đang authored:** crownTunnel (locked): Đường Hầm → Nữ Hoàng Giùn → Nữ Hoàng Địa Vương

### wraith_shadow — Ma Bóng Tối
- **Identity:** Tier 5; Sát thủ (ASSASSIN); faction Huyền thoại (MYTHICAL); hệ Dạ (NIGHT); species `ma`.
- **Base stats 1★:** HP 310, ATK 94, DEF 18, MATK 26, MDEF 17, range 1, rageMax 3, crit 0.25, critDmg 1.5, evade 0.15, accuracy 0.95.
- **Vai trò chơi:** Chém xuyên hậu tuyến rồi đổi đòn dư sang mục tiêu kế nếu hạ gục.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Hỏa Ấn Liên Kích:** effect family `double_hit`; cost nộ 1★/2★/3★ = **1/2/3**. mục tiêu: 1 kẻ địch hậu tuyến bị nhắm; hình: 1 ô hậu tuyến, 2 nhát chém; chọn: Ưu tiên lao vào tuyến sau, rồi chọn mục tiêu nộ cao nhất nếu nhát đầu hạ gục.; số lượng: 1 mục tiêu, 2 đòn; thời lượng: tức thì.
- **1★:** Lao vào 1 kẻ địch hậu tuyến bị nhắm rồi chém 2 lần. Đòn 1 gây [(50 + 1.80 x ATK) x Hệ số sao (1)] = [(50 + 1.80 x 94) x 1] = 219 (ATK). Đòn 2 gây [(35 + 1.30 x ATK) x Hệ số sao (1)] = [(35 + 1.30 x 94) x 1] = 157 (ATK); nếu nhát 1 hạ gục thì nhát 2 nhảy sang kẻ địch hậu tuyến nộ cao nhất. Khi chuỗi hạ gục mục tiêu, bóng chém dội sang 1 kẻ địch hậu tuyến kề bên với 80% sát thương. Lưỡi bóng tối để lại vết cắt làm giảm 25% ATK hoặc MATK trong 2 lượt.
- **2★:** Lao vào 1 kẻ địch hậu tuyến bị nhắm rồi chém 2 lần. Đòn 1 gây [(60 + 2.16 x ATK) x Hệ số sao (1.2)] = [(60 + 2.16 x 94) x 1.2] = 325 (ATK). Đòn 2 gây [(42 + 1.56 x ATK) x Hệ số sao (1.2)] = [(42 + 1.56 x 94) x 1.2] = 267 (ATK); nếu nhát 1 hạ gục thì nhát 2 nhảy sang kẻ địch hậu tuyến nộ cao nhất. Mục tiêu nhảy sang bị cắt máu và giảm 25% ATK hoặc MATK trong 2 lượt.
- **3★:** Lao vào 1 kẻ địch hậu tuyến bị nhắm rồi chém 2 lần. Đòn 1 gây [(70 + 2.52 x ATK) x Hệ số sao (1.4)] = [(70 + 2.52 x 94) x 1.4] = 439 (ATK). Đòn 2 gây [(49 + 1.82 x ATK) x Hệ số sao (1.4)] = [(49 + 1.82 x 94) x 1.4] = 347 (ATK); nếu nhát 1 hạ gục thì nhát 2 nhảy sang kẻ địch hậu tuyến nộ cao nhất. Khi chuỗi hạ gục mục tiêu, bóng chém dội sang 1 kẻ địch hậu tuyến kề bên với 80% sát thương. Tự thân nhận 25% né tránh trong 2 lượt.
- **Skin/cosmetic đang authored:** veilOmen (locked): Điềm Báo → Ma Vương → Huyền Linh Vương

### yak_highland — Bò Tây Tạng
- **Identity:** Tier 4; Đỡ đòn (TANKER); faction Thú (BEAST); hệ Phong (WIND); species `yak`.
- **Base stats 1★:** HP 480, ATK 55, DEF 44, MATK 17, MDEF 32, range 1, rageMax 4, crit 0.05, critDmg 1.5, evade 0.05, accuracy 0.95.
- **Vai trò chơi:** Gào thét tăng sức đánh cho cả đội rồi dựng giáp cho bản thân.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Kỹ năng — Tiếng Thét Chiến:** effect family `warcry_atk_def`; cost nộ 1★/2★/3★ = **2/3/4**. mục tiêu: toàn bộ đồng minh + bản thân; hình: toàn đội; chọn: Lan buff ATK cho toàn đội, đồng thời tự nhận DEF.; số lượng: toàn đội; thời lượng: ATK 2 lượt; DEF 3 lượt.
- **1★:** Gào thét, tăng 15% ATK cho toàn bộ đồng minh trong 2 lượt và tăng 20 DEF cho bản thân trong 3 lượt.
- **2★:** Gào thét, tăng 20% ATK cho toàn bộ đồng minh trong 3 lượt và tăng 30 DEF cho bản thân trong 3 lượt.
- **3★:** Gào thét, tăng 25% ATK cho toàn bộ đồng minh trong 3 lượt, tăng 40 DEF cho bản thân trong 3 lượt, đồng thời cho toàn bộ đồng minh 5 nộ.
- **Skin/cosmetic đang authored:** snowPledge (locked): Lời Tuyết → Bò Tây Tạng → Tuyết Sơn Vương

## A84. Scheduled boss gameplay manifest

Bosses are encounter-only catalog entries. They use the same combat-unit, damage, rage, status and presentation contracts as normal units but are not purchasable normal roster offers.

### boss_earth_colossus — Địa Thần Cự Tượng
- **Boss-only identity:** Tier 6; Đỡ đòn (TANKER); faction Huyền thoại (MYTHICAL); hệ Nham (STONE); species `golem`.
- **Base boss stats:** HP 1460, ATK 102, DEF 112, MATK 28, MDEF 82, range 1, rageMax 4.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Boss skill — Địa Chấn Khóa Thành:** effect family `damage_shield_taunt`; rage cost profile 3/4/5. Địa Thần Cự Tượng đập xuống tạo địa chấn, dựng khiên khổng lồ và khiêu khích cả chiến trường.
- **Boss authored notes:** 1★ Boss vòng 40, tạo khiên khổng lồ và khóa mục tiêu toàn bản đồ.; 2★ Boss sự kiện.; 3★ Boss sự kiện..

### boss_ember_dragon — Cự Long Hỏa Ngục
- **Boss-only identity:** Tier 6; Pháp sư (MAGE); faction Huyền thoại (MYTHICAL); hệ Hỏa (FIRE); species `long`.
- **Base boss stats:** HP 1040, ATK 68, DEF 44, MATK 156, MDEF 66, range 4, rageMax 4.
- **Đánh thường:** tầm xa/projectile, magic từ MATK, 1×MATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Boss skill — Hỏa Vực Diệt Thành:** effect family `global_fire`; rage cost profile 3/4/5. Cự Long Hỏa Ngục thiêu cháy toàn bộ chiến trường bằng biển lửa đen kéo dài.
- **Boss authored notes:** 1★ Boss vòng 10, phun hỏa ngục lên toàn bộ quân địch.; 2★ Boss sự kiện.; 3★ Boss sự kiện..

### boss_storm_phoenix — Lôi Phượng Cuồng Phong
- **Boss-only identity:** Tier 6; Xạ thủ (ARCHER); faction Huyền thoại (MYTHICAL); hệ Hỏa (FIRE); species `phuong-ten`.
- **Base boss stats:** HP 980, ATK 138, DEF 36, MATK 44, MDEF 42, range 4, rageMax 4.
- **Đánh thường:** tầm xa/projectile, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Boss skill — Cuồng Vũ Lôi Phượng:** effect family `cone_shot`; rage cost profile 2/3/4. Lôi Phượng xoáy cánh tạo một cơn mưa lông vũ bão tố quét sạch tuyến trước.
- **Boss authored notes:** 1★ Boss vòng 20, quét hình nón cực rộng bằng lông vũ bão tố.; 2★ Boss sự kiện.; 3★ Boss sự kiện..

### boss_tempest_jelly — Sứa Bão Giông
- **Boss-only identity:** Tier 6; Pháp sư (MAGE); faction Thủy sinh (AQUATIC); hệ Thủy (TIDE); species `sua`.
- **Base boss stats:** HP 1110, ATK 54, DEF 52, MATK 148, MDEF 68, range 4, rageMax 4.
- **Đánh thường:** tầm xa/projectile, magic từ MATK, 1×MATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Boss skill — Lốc Điện Hỗn Mang:** effect family `chain_shock`; rage cost profile 3/4/5. Sứa Bão Giông phóng lốc điện giật chuỗi lên nhiều mục tiêu hơn và nổ mạnh hơn.
- **Boss authored notes:** 1★ Boss vòng 50, xả chuỗi điện nhiều mục tiêu và rút nộ cực nhanh.; 2★ Boss sự kiện.; 3★ Boss sự kiện..

### boss_venom_hydra — Hydra Độc Vực
- **Boss-only identity:** Tier 6; Đỡ đòn (TANKER); faction Huyền thoại (MYTHICAL); hệ Thủy (TIDE); species `hydra`.
- **Base boss stats:** HP 1280, ATK 94, DEF 86, MATK 36, MDEF 74, range 1, rageMax 4.
- **Đánh thường:** cận chiến/contact, physical từ ATK, 1×ATK, ưu tiên mục tiêu hợp lệ gần nhất.
- **Boss skill — Tái Sinh Cửu Đầu:** effect family `self_regen_team_heal`; rage cost profile 3/4/5. Venom Hydra tự hồi sinh cực mạnh và lan truyền độc hồi phục cho đồng minh dị thể của nó.
- **Boss authored notes:** 1★ Boss vòng 30, vừa cứng vừa tự hồi liên tục như thủy triều độc.; 2★ Boss sự kiện.; 3★ Boss sự kiện..

## A85. Planning inspection, selection ownership and context actions

Planning inspection is stateful. Keep one logical unit-info selection with enough identity to survive UI refreshes: source kind, stable uid when the subject is owned, base id, current star, and source coordinates/index when relevant.

Selection behavior is deterministic:

1. Explicitly selecting an owned bench or board unit stores its uid plus source location.
2. Selecting a shop card stores shop index, base id and offer star.
3. Resolving an owned selection first searches the currently owned bench and allied board by uid.
4. If uid no longer resolves, validate the remembered bench index or board row/column only when the unit still has the expected base id.
5. For a shop selection, re-read the current offer at the remembered slot. If a reroll changed that offer, refresh the selected base id/star from the new offer rather than presenting stale content.
6. With no explicit selection, choose the currently selected bench slot, then first non-empty bench unit, then first occupied allied board cell in row-major order, then first non-empty shop offer, otherwise show the empty state.

Inspection materializes the current star through the canonical star resolver, then derives scaled stats, current-star skill, current visual identity and resource preview from that resolved unit. Owned HP/max HP come from the owned instance when present; otherwise use star-scaled base HP. Shop offers are previews and must not be converted into fake persistent owned units.

For a deployed cooperative allied unit, determine which co-op player owns the unit's row profile and use that player's starting-rage and starting-shield state. Unit-local preview bonuses are the sum of equipment and variant preview bonuses. Round them non-negative and cap the unit-local starting-rage contribution at +4. Resource preview is:

- rageMax = explicit finite owned rageMax, otherwise current-star skill cost, otherwise base rageMax;
- displayRage = min(rageMax, max(currentRage, ownerStartingRage + unitStartingRage));
- displayShield = max(currentShield, ownerStartingShield + unitStartingShield).

The inspection surface exposes tier, star, class, tribe/faction/element where available, buy-price identity, HP/rage meters, star-aware skill data and recommendation groups. Tier-3 and tier-4 recommendation groups each request the best three recipes. A long recommendation body scrolls inside its own viewport; one wheel step moves 28 logical UI units and clamps to computed overflow.

Context actions are location-sensitive wrappers over canonical mutations:

- every unit has Details;
- BENCH has Details and Sell;
- BOARD has Details, Recall and Sell.

Recall chooses the first null bench slot. If there is no null slot and compact bench length is below the resolved cap, use the append index. If neither is possible, emit queue/bench-full feedback and mutate nothing. A successful Recall goes through the normal board-to-bench movement transaction, then normal refresh/persist behavior. Opening a new context menu closes the previous one; choosing an action executes once and closes; clicking elsewhere closes without action.

## A86. Planning storage, craft-grid interaction and recipe suggestions

The inventory/storage panel displays available bag counts rather than double-counting items staged in crafting. Build raw counts from the item bag, subtract per-item staged/reserved counts, omit zero-or-negative available entries, sort visible stacks by count descending, then page across the available display-cell count. Staging remains non-destructive to the bag as defined in A7; subtracting reserved counts is presentation only.

Storage interaction rules:

- empty inventory cells do nothing;
- interaction is allowed only in Planning while blocking overlays such as Settings, Library, History and version information are closed;
- primary press begins item drag only after tutorial gating succeeds;
- right-click immediately stages one matching item in the craft grid and cancels any pending item-drag press;
- equipment tooltip includes its recipe/effect when known plus drag-to-equip, drag-to-craft and right-click-to-craft guidance;
- material tooltip includes amount plus craft guidance.

The canonical craft surface always owns nine visual slots. Locked slots cannot accept staging and explain that they are locked. Clicking either primary or secondary button on an active staged slot removes that staged ingredient after tutorial gating. Clicking the output slot invokes the canonical craft transaction only when tutorial gating permits it. The output tooltip reports no matching recipe when unresolved and otherwise shows output identity plus description.

Recipe suggestions are derived from the full current bag, independent of current staging. For every recipe with at least one requirement:

1. Count required copies per ingredient id.
2. haveCount = sum(min(bagCount[id], requiredCount[id])).
3. ratio = haveCount / totalRequiredCopies.
4. Omit recipes with ratio <= 0.

Sort suggestions in this exact priority: fully craftable recipes (ratio >= 1) before partial; then higher recipe tier; then higher ratio; then higher haveCount; then recipe name ascending as deterministic tie-breaker.

Suggestions are paged by the number of visible suggestion slots and each displays haveCount/totalRequiredCopies. Primary click pre-populates the craft grid from that recipe through canonical staging rules; right-click opens the recipe detail/Library surface. A suggestion never crafts directly and never bypasses active-slot/table-size restrictions.

The Planning right dock is a clipped, scrollable surface. Compute content overflow from visible child bounds relative to the dock viewport; hidden items do not increase overflow. Clamp scroll offset to 0..maxScroll. Each wheel direction moves 36 logical UI units. Child positions are always baseY minus scrollOffset so relayout/recompute cannot accumulate drift.

## A87. Combat result normalization, modal content and next-round preview

Normalize a resolved round result before any Planning UI consumes it. Canonical victory gold is represented by separate enemy-unit base gold, enemy-star gold and Assassin bounty where available. On a LEFT win, normalized goldDelta is their sum. Older persisted results that contain only goldDelta may retain that legacy value only when canonical parts are absent. On RIGHT loss or DRAW, Assassin bounty remains payable. DRAW always normalizes damage to zero. Creative marks passive win XP as suppressed and marks defeat as ignored rather than fabricating a normal HP-loss path.

Applying the normalized outcome has both a pure preview mode and a mutation mode. Both produce the same computed outcome, gameOver flag, shouldAdvanceRound flag, gold earned, XP earned, damage taken, HP after, next round, win streak after and lose streak after. Mutation mode alone writes player state. Result rendering, network replay and modal reopening must use the preview/result state without paying rewards again.

Outcome order is exact:

- LEFT: increment win streak, clear loss streak, earn normalized result gold plus persistent winGoldBonus, earn 2 XP unless Creative suppresses it, then advance the round;
- RIGHT: increment loss streak, clear win streak and pay Assassin bounty; when defeat is not ignored and lose condition is NO_HEARTS, subtract canonical damage or consume supplied fortressHpAfter, ending the run only at HP 0; any other lose condition ends immediately; do not advance the round when game over;
- DRAW: clear both streaks, pay Assassin bounty, take zero normal round damage, accept supplied fortressHpAfter when present, and advance when allowed.

Creative prevents normal wallet mutation through this result path while still allowing the UI to describe the conceptual reward/result. XP follows the explicit Creative passive-XP suppression flag.

The result modal separates round state from rewards. Round state includes round/result, current streak, damage taken when relevant, remaining HP/hearts, player level and remaining gold. Rewards include immediate gold with base/star/bounty/win-bonus decomposition, total wallet, XP on a win, loot and the next-round income preview.

Loot presentation groups accepted drops by item id and shows quantity. When per-drop source metadata exists, group source labels by frequency, sort frequency descending, show the first two source categories, then summarize any remaining source-category count instead of printing one line per drop.

Next-round income preview is informational and cannot mutate state. For non-Creative it evaluates player.round + 1 using the A5 formula against current post-result gold/streak state: mode base-income fallback 5, interest cap/rate, the larger streak bonus and fixed income. Creative instead states that passive income is ignored and passive XP is zero.

Only one result-modal scroll controller may exist. Opening a new result clears the previous controller and resets board-drag state so stale dragging cannot leak through the modal. Wheel input scrolls only while the pointer is inside the result content viewport, using offset += dy × 0.55 and clamping to overflow. The dimmer consumes background interaction. Continue destroys modal/controller state first and then invokes its close/advance callback exactly once.

Loot insertion itself remains capacity-safe and idempotent: filter invalid/non-string ids, resolve capacity from current board+bench when those containers exist, accept only the prefix that fits available slots, append accepted drops once, and return the accepted list for presentation/logging.

## A88. Combat input ownership and modal interception

Keyboard/controller actions respect modal ownership rather than leaking through to the tactical board:

- step-combat runs only while Settings is closed and phase is COMBAT;
- the Settings/back action closes the shortcuts subview first when open, otherwise closes Library, otherwise closes History, otherwise toggles Settings;
- audio toggle is ignored while Settings, History or Library is open.

Wheel routing priority during Combat is History, then Library, then Settings capture, then normal board/camera behavior. Pointer-down is consumed while Settings, History or Library is visible. With no blocking overlay, pointer-down outside the board panel is consumed by UI and cannot begin board pan. Pointer-move is likewise intercepted while those overlays own input. Board-pan start is legal only when the pointer begins inside the board panel.

Use the same ownership principle throughout Planning. A visible major modal or blocking overlay owns pointer and wheel input until it closes. Closing such a modal clears any pending drag/press state owned by the obscured surface so a later pointer release cannot execute a stale buy, move, sell, equip or craft action.

## A89. Skill visual target plan and status provenance

Skill preview and VFX use a resolved visual-target plan derived from the same star-aware semantic target rules as Combat. Presentation may stylize trajectories, particles and camera staging, but it cannot invent a different affected-unit set because visuals must never lie about gameplay.

Resolve the current-star primary target before building visuals. Star target bonus applies to target-count families; star area bonus applies to radius families. Visual target collections ignore dead units and inactive visual instances, then deduplicate the final list by stable uid.

Preserve these effect-specific visual semantics whenever the corresponding authored effect family exists:

- heat-seek: visualize the lowest-HP-ratio enemy chosen by semantic targeting;
- peace/heal-reduction: lowest-HP-ratio allied targets up to maxTargets;
- heal-over-time: lowest-HP-ratio allies up to (maxTargets default 3) + starTargetBonus;
- light-purify: lowest-HP-ratio allies up to (maxTargets default 2) + starTargetBonus;
- ally-row defense buff: every living ally in the caster's row;
- multi-sting poison: sample without replacement up to maxHits, otherwise maxTargets, otherwise 2;
- chain shock: primary target plus additional living enemies without replacement, with total target count bounded by 3 + starTargetBonus and alive enemy count;
- fireball/burn: living enemies inside a square radius around the resolved target, using authored aoeRadius when finite, otherwise 1 + starAreaBonus;
- guardian pact: lowest-HP-ratio allies excluding the caster, up to maxTargets with default 1;
- self-shield+immunity and mirror-reflect: caster;
- spring AoE heal and blessing-rain MDEF: all living allies;
- unicorn ATK buff: highest-effective-ATK allies excluding caster; use explicit maxTargets when present, otherwise one target at 1★/2★ and two at 3★;
- frost storm and ink-column: living enemies in the resolved target column;
- ink bomb: square visual radius 0/1/2 at 1★/2★/3★;
- column bleed: living enemies in the action target's column;
- otherwise map canonical skill-preview cells back to active living units; when no preview-cell set exists, use the target-row fallback only for presentation and never as a second combat-targeting rule.

The visual plan returns an action target, the resolved semantic skill target and the deduplicated visual-unit set. Animation/VFX consume this plan and must not independently reroll or reselect targets.

Status tooltips preserve where a status came from when known. Before a skill mutates statuses, snapshot every supported status' active flag, remaining turns and numeric value for each unique unit uid. After skill resolution, for each status that became active or changed turns/value, record source skill id, source unit uid/base id/star and resulting turns/value. Unchanged statuses retain their previous source attribution.

When rendering an active status, prefer source-skill name plus the first meaningful current-star skill-summary line and the status' current turns/value. If provenance cannot be resolved, use the canonical generic status description. Compact badge text uses remaining turns as nL plus its value; fractional non-integer absolute values at or below 1 display as percentages, otherwise as rounded flat values. Status chips represent real timed status state only; a numeric shield by itself still does not synthesize a shield-status chip.

## A90. Canonical visual roster completion — 125/125 units and bosses must be bespoke

The rebuild is not visually complete merely because every catalog id can instantiate something. The canonical roster contains **125 gameplay identities: 120 normal units plus 5 scheduled bosses**. Every one of those 125 ids must resolve to a deliberate, unit-owned full-body composition and a deliberate action controller. A generic packed animal, generated full-creature geometry, unknown cube, grey placeholder, default dog-like head/body, family-shaped stand-in or generic default animation controller is a failed acceptance result for a canonical id.

The ownership boundary is strict:

1. A unit owns the composition of its complete silhouette: torso, head/neck, limbs, major appendages, equipment and signature anatomy.
2. Reusable construction may create shared **parts** only: voxel primitives, eye pairs, paws/hooves/claws, horn primitives, wing cells, feather pieces, tail/tentacle segments, small weapon primitives and similarly local components.
3. Generic interpolation/timing/controller mechanics may be reused, but the actual authored pose and performance for a named canonical unit belongs to that unit.
4. Passing a species/family/config object into one shared factory that decides the whole creature is forbidden even when the result looks approximately correct.
5. The same canonical visual identity must be used in Planning, Combat, Library/collection inspection, shop/details preview and multiplayer replay. Surfaces may change camera, LOD, particle density or preview pose, but they may not silently substitute a different species model.

### A90.1 Required action identity for every canonical unit

Each canonical unit must have a readable authored action set appropriate to its anatomy:

- **Rảnh rỗi / Idle:** personality-bearing inspection idle rather than only breathing scale.
- **Combat idle:** alert battle stance distinct from relaxed inspection idle when the creature has a meaningful stance change.
- **Move/locomotion:** all anatomically relevant front/rear limbs, wings, tentacles or body segments participate; no two-front-limb-only placeholder motion.
- **Basic attack:** uses the correct physical source of the attack — bite, claw, horn, weapon hand, beak, projectile anchor, spell focus, tail/stinger, wave source, etc.
- **Skill/cast:** visually communicates the semantic target family from A76/A89 and does not select a different target set for spectacle.
- **Chịu đòn / Take Hit:** readable hit reaction that does not detach body pieces or corrupt locomotion state.
- **Death:** completes once, relinquishes its board visual, billboard and transient VFX, and cannot leave a ghost model behind.

Action completion and gameplay resolution remain linked by A16: movement finishes at the semantic destination before a contact hit commits; an Assassin may stage the strike from behind the chosen victim; projectile/skill damage commits at its semantic impact point rather than at animation start. Floating damage text and status anchors follow the unit's current world position after movement.

### A90.2 Anatomy and geometry acceptance

Every bespoke rig must pass a visual-integrity review at the normal battlefield camera and in close Library preview:

- head, neck and torso read as physically connected;
- front and rear limbs attach to plausible body anchors;
- tails, wings, antennae, horns, tusks, claws, tentacles and held equipment remain attached through the full motion range;
- no unintentional see-through gaps, inverted faces, depth-order artifacts or isolated floating chunks;
- silhouette remains recognizable from tactical zoom, not only in close-up;
- facing is consistent with the battlefield convention; the Spider explicitly keeps the corrected facing;
- land, hover, flight and aquatic locomotion each feel intentional rather than sharing one hop cycle;
- water/brown-soil placement is visually supported without forcing a fake circular base under the creature.

Do not hide geometry defects with one favorable camera angle. Rotate the Library preview and inspect the model from several sides.

### A90.3 Star multiplicity is part of the visual language

One logical merged unit may intentionally render multiple visible creature instances. Preserve this presentation contract:

| Star | HP condition | Visible creature instances |
| --- | --- | ---: |
| 1★ | alive, HP > 0 | 1 |
| 2★ | HP > 2/3 max HP | 2 |
| 2★ | 0 < HP <= 2/3 max HP | 1 |
| 3★ | HP > 2/3 max HP | 3 |
| 3★ | 1/3 max HP < HP <= 2/3 max HP | 2 |
| 3★ | 0 < HP <= 1/3 max HP | 1 |
| any | dead or HP <= 0 | 0 |

The canonical local formations are:

- 1★: one primary instance at x=0, z=0, scale=1.00.
- 2★: primary x=-0.32, z=+0.04, scale=0.84; secondary x=+0.32, z=-0.04, scale=0.84.
- 3★: primary x=0, z=+0.18, scale=0.78; second x=-0.40, z=-0.14, scale=0.68; third x=+0.40, z=-0.14, scale=0.68.

These extra bodies are presentation of one logical unit, never additional combat actors. They share uid, targetability, HP/resource/status state and semantic action result. Secondary instances may offset their local performance slightly for readability but may not create extra attacks, hits, projectiles, status applications or RNG calls. When HP crosses a threshold, change multiplicity cleanly without duplicating controllers or leaving orphaned sprites/meshes.

Star evolution also needs authored visual progression. A generic class/tribe aura or recolor is insufficient as the only distinction for a canonical unit. Preserve the species silhouette while adding deliberate star-specific detail such as stronger anatomy accents, equipment, crest/crown/armor, feather/tail complexity, material treatment or signature VFX. A skin is likewise a deliberate variant, not merely a tint. Gameplay identity remains unchanged unless the data contract explicitly says otherwise.

### A90.4 Mandatory visual brief for all 120 normal units

Every normal canonical identity in A83 requires an explicit bespoke visual brief. Existing implementation coverage does not exempt a unit from this review: the final rebuild must inspect/re-author every one of the **120 normal units**, then apply the shared anatomy/action/star requirements above. The table below is deliberately one-to-one with A83 and stays in the same canonical order so coverage can be audited mechanically.

These rows define silhouette, attack source and skill-readable staging. They do not override A83 gameplay math or A76/A89 targeting; animation and VFX must visualize the targets/effects already resolved by canonical gameplay.

| Canonical id | Required visual identity and skill-readable staging |
| --- | --- |
| albatross_wind | Long-winged albatross marksman with wind-cut feather blades; the three bleeding feathers visibly travel to three distinct targets, and the 3★ final feather visibly retargets the enemy with the highest rage. |
| angel_guardian | Angelic guardian/support silhouette with connected humanoid/wing anatomy; resurrection reads as a deliberate descent/halo/revival beat and low-HP healing as a separate support cadence. |
| ant_guard | Small but heavily plated ant guardian with clear mandibles, thorax and six grounded legs; Kiến Trận Đồ raises carapace-like guard plates on self and the selected same-row ally, with a readable interception link when it absorbs part of that ally’s hit. |
| armadillo_roll | Segmented armadillo/tatu armor with a body that can physically curl into a compact ball; Cuộn Tròn visibly closes the shell, reinforces the caster, then sends the separate one-hit protection cue to the nearest ally behind. |
| badger_stone | Stocky stone badger with attached rock-spine armor and digging claws; Gai Đá raises the spines for reflect, marks the taunted high-ATK enemy, and returns reflected impact from the badger rather than from a detached effect. |
| bat_blood | Broad-winged vampiric bat with fangs and a compact airborne silhouette; it dives behind the line, bites the lowest-HP victim, draws a visible lifesteal stream back to itself, and only shows the rage-recovery flourish after a valid kill. |
| bear_ancient | Massive ancient bear with bark/stone totem accents and heavy four-limb gait; its roar expands from the mouth toward the nearest affected enemies, while self-heal, shield and taunt cues remain centered on the bear. |
| beetle_drill | Armored beetle fighter whose horn/forehead reads as a powered drill rather than a generic insect head; the drill commits into the high-max-HP frontline target, with true-damage and shield-break sparks attached to that one contact point. |
| beetle_mystic | Iridescent mystic beetle with crystalline wing-cases and a clear spell focus; its prism/ice cast drops onto the selected enemy column and highlights only the actual frozen target or targets inside that column. |
| bison_stampede | Heavy bison with shoulder mass, horns and hoof-driven acceleration; Húc Choáng crosses into the chosen frontline target with a readable stun impact, then sends the separate residual shock into the nearest valid enemy behind at 3★. |
| buffalo_mist | Heavy buffalo body, horns and grounded tank gait; mist visibly originates around the herd/guarding body and wraps the actual low-HP allied targets selected by gameplay. |
| bug_plague | Plague-bearing beetle/insect with diseased sacs and sickly spore vents integrated into its shell; the cast marks the chosen dense-cluster center, fills the real 3×3 infection area, and makes later orthogonal disease spread readable without inventing extra targets. |
| butterfly_mirror | Glass/mirror butterfly with symmetrical reflective wings and a delicate connected body; Vảy Gương forms the primary reflective barrier on the caster first, then visibly shares the separate shield to the chosen nearby ally. |
| cat_goldbow | Despite the legacy id, the canonical player-facing identity is the authored fire wasp/bee marksman, not a cat; use insect waist, wings and a golden fire-bow/stinger language, with the armor-breaking shot visibly landing on the selected frontline target before any adjacent pressure cue. |
| chameleon_stealth | Low chameleon assassin with articulated tail, gripping feet and skin-color camouflage; it fades against the terrain, reappears behind the isolated backliner for the armor/rage disruption, then visibly chains only after a confirmed kill. |
| chimera_flame | Multi-featured Chimera silhouette that remains one coherent body; global-fire cast must read as a mythic whole-board ignition, not a generic red particle burst. |
| cobra_venom | Hooded cobra assassin with raised neck, fangs and grounded coils; Nọc Tử Thần launches from the bite/fangs toward the lowest-MDEF rear target, with venom and shield-punish feedback attached to the same victim. |
| condor_sky | Large condor with wide wings, hooked beak and a high circling idle; Bổ Nhào traces a full vertical dive through the resolved enemy column, leaving armor-break cues on the units actually hit in that column. |
| crab_shell | Broad armored crab with oversized protective claw and side-stepping locomotion; Kẹp Bảo Vệ physically interposes the claw/guard line toward the lowest-HP ally and keeps transferred-damage feedback connected to that pact. |
| crane_blessing | Canonical Chicken Rapper: chibi rooster with microphone, vest and star-evolving crown/accessories; relaxed idle sings with music notes, attack throws/boomerangs the mic, and Nhịp Kích Nộ performs a beat toward only the selected same-row allies. |
| crocodile_bite | Low crocodilian body, jaw and tail; attack weight comes from the bite/roll, with bleed and shield-lock cues attached to the chosen frontline victim. |
| crow_storm | Black crow dart-thrower carrying three clearly differentiated chromatic darts; Tam Sắc Phi Tiêu fires its colors as distinct sequential beats into the same resolved victim so conditional follow-up darts can be read in order. |
| deer_song | Graceful deer support with antlers shaped like a natural harp/totem; Khúc Ca Sức Sống radiates soft musical pulses to the actual lowest-HP allies, with repeated HoT ticks and the higher-star rescue beat visually distinct. |
| dove_peace | White dove carrying an olive branch, with gentle wing and branch gestures; Cành Ô Liu delivers healing/protection to the selected low-HP ally and uses a separate clean purification shimmer only when cleanse is actually applied. |
| dragon_breath | Full dragon silhouette with connected neck, jaw, wings/body/tail; global fire clearly originates from the dragon's breath/cast anatomy. |
| dragon_earth | Stone/earth dragon tank identity; team-shield skill reads as a grounded protective earth wall while the caster receives the visibly stronger self shield. |
| dryad_tree | Tree-fairy/dryad with rooted feet, branch crown and connected wooden limbs; roots travel across the ground to the selected high-MATK mage/support target, while the allied healing pulse returns through the dryad rather than appearing as unrelated green particles. |
| eagle_marksman | Large eagle marksman with disciplined wing/quiver or talon-launched arrow language; Mưa Tên visibly assigns separate falling projectiles to the four resolved backline targets and keeps any high-rage follow-up arrows on those actual recipients. |
| elephant_guard | Elephant/tusk/trunk anatomy and heavy four-leg locomotion; 3x3 stomp communicates the real impact center and stun area. |
| fairy_forest | Forest fairy with leaf wings and a spring/flower focus; Suối Nguồn grows a small fountain at the caster and sends one readable cleansing-heal wave through every living ally without creating phantom combat actors. |
| falcon_dive | Compact young falcon/javelin marksman with a lightweight spear carried under wing or talon; Lao Xuyên releases one strong line projectile through the chosen enemy row, leaving its armor/burn consequences on the units the row attack actually hit. |
| ferret_shadow | Long low shadow-ferret with connected neck, spine and tail; Cắn Gáy slips behind the highest-ATK rear carry, delivers the backstab from the jaw/claws, then returns/repositions without leaving a duplicate shadow body. |
| firefly_heal | Warm medic firefly with glowing abdomen and small lantern-like light packets; Ánh Sáng Chữa Lành sends distinct pulses to the selected lowest-HP allies and shows cleanse as a brief separate purification ring. |
| firefly_light | Bright offensive firefly whose abdomen charges into a battlefield flash; Lóe Sáng washes the enemy side once, then visibly marks only the highest-ATK enemies that actually receive blind. |
| flamingo_shot | Tall pink flamingo marksman with long legs/neck and a wing-mounted fantasy launcher; Tên Lửa Hồng arcs a burning shot into the chosen low-HP/backline victim and only propagates the secondary flame cue after the authored condition is met. |
| fox_flame | Low agile fox with multiple expressive flame-tail accents but one coherent body; Lửa Cáo dashes to the rear low-HP target, bites/slashes at contact and leaves the burn attached to that victim before the fox recovers its stance. |
| garuda_divine | Mythic Garuda/avian marksman silhouette; divine needles/feathers launch as separate readable projectiles toward the distinct targets selected by the multi-target rule. |
| golem_stone | Chunky stone golem built from connected blocks with an anchor-like fist/weapon integrated into its arms; Mỏ Neo Đá slams the ground, raises the self shield and visibly draws enemy attention toward the golem through the taunt cue. |
| gorilla_smash | Gorilla mass, long forelimbs and knuckle-weighted locomotion; smash lands at the chosen frontline center and makes the 3x3 armor-break area obvious. |
| hawk_hunter | Lean hunting hawk with sharp forward silhouette and focused eye/targeting pose; Tầm Nhiệt locks the lowest-HP prey, dives or fires once at that exact target, and reserves any execute/kill flourish for a confirmed elimination. |
| heron_pierce | Tall slender heron with long legs and spear-like beak; Mỏ Kẹp snaps/clamps onto the highest-ATK enemy with a precise thrust and shows disarm/rage interruption at that victim rather than as a global effect. |
| hippo_maul | Broad heavy hippo with mud-caked armor and a low center of gravity; Nện Bùn plants the forebody/jaw into the ground and projects the real frontal cone, with rage-loss feedback only on enemies inside it. |
| horse_charge | Armored warhorse with strong mane, chest and four-leg gallop; Phi Nước Đại accelerates down the selected enemy row and stages sequential row impacts along the same line instead of teleporting between targets. |
| hydra_swamp | Multi-head Hydra identity with heads attached to one body; self-regeneration happens first, followed by visible healing transfer to the selected low-HP allies. |
| hyena_pack | Pack-leader hyena with alert ears, scarred muzzle and howl posture; Gọi Bầy emits a rally howl toward the allies with the lowest rage, using subtle pack silhouettes only as decoration and never as extra combat units. |
| ice_mage | Crystalline ice dragonfly with a slim insect body, six legs and four translucent wings; Bão Tuyết channels down the selected high-ATK enemy column and keeps slow/offense-reduction frost on the units actually affected. |
| jaguar_hunt | Jaguar/panther fighter with a physically connected head, neck and torso, four grounded limbs and spotted coat; Săn Máu visibly pays the self-health cost first, changes into a predatory hunt stance, then lunges into the authored basic-attack chain without neck separation or floating parts. |
| jellyfish_shock | Electric jellyfish with one coherent bell and attached tentacle bundle, hovering above water/ground without a fake base; Dòng Điện Tê Liệt chains in visible order through the highest-rage targets and never jumps to an unselected unit. |
| kangaroo_kick | Athletic kangaroo boxer with strong tail balance, large hind legs and guarded forepaws; Cú Đấm Bay performs two clearly separated kick/strike impacts into the same low-DEF frontline target and shows rage disruption only after the relevant hit. |
| kirin_thunder | Kirin/Qilin quadruped with horn/crest and celestial lightning identity; whole-board lightning and the smaller set of stun targets must be visually distinguishable. |
| komodo_bite | Heavy Komodo dragon with low reptilian body, thick tail and jaw-first locomotion; Nọc Độc Kỳ Đà bites the high-max-HP frontline tank and leaves poison/disease cues attached to that one victim for later ticks. |
| kraken_deep | Deep-sea Kraken/tentacled tank; tentacle restraint visibly locks the selected frontline enemy for the silence effect without spawning detached random limbs. |
| kraken_void | Void Kraken/octopus caster; four authored tentacle/projectile beats map one-to-one to the deduplicated random targets and carry the evasion-reduction cue. |
| lich_undead | Undead Lich caster with staff/focus or equivalent clear casting anatomy; column-freeze curse stages on the resolved target column and highlights the actual frozen victim. |
| lion_general | Commanding lion/general silhouette with mane and battle authority; roar reaches the whole enemy side while the allied-row ATK rally remains a separate friendly cue. |
| lizard_elder | Elder reptile/support silhouette distinct from a young lizard fighter; team defense ritual precedes the low-HP ally heal and remains readable at tactical zoom. |
| lynx_echo | Canonical identity is a wind mantis/grasshopper-like Assassin despite the id wording; use insect anatomy and a two-beat delayed echo slash rather than a feline fallback. |
| mammoth_ancient | Mammoth body with tusks, trunk and heavy fur silhouette; herd call visibly grants rage outward first, then self-heal, with 3★ healing propagation to allies. |
| mantis_blade | Mantis assassin with blade forearms, narrow insect waist and folded wing-cases; Kiếm Chém X crosses both scythe arms through the selected rear target, intensifies with living Swarm allies through presentation only, and visibly pursues only when the authored follow-up triggers. |
| mink_silent | Slim mink assassin with quiet low-footed movement and a dark cloth/leaf stealth accent; Ám Sát Thầm Lặng enters the rear line without a teleport pop, pierces the weakened target’s armor, and performs pursuit only after a valid kill. |
| monkey_spear | Agile monkey with a branch spear carried as signature equipment even though the skill itself throws a rock; Ném Đá visibly picks up/throws the stone into the nearest frontline target and communicates the single-target stun on impact. |
| mosquito_toxic | Needle-bodied mosquito with long proboscis, attached wings and visible blood/venom reservoir; Vòi Hút Máu dives onto the rear mage/support, connects the siphon to the proboscis, and layers heal-reduction/disease cues on that same victim. |
| moth_dust | Nocturnal moth with broad powdery wings and soft antennae; Bụi Mê beats the wings over the selected dense cluster and lays the real 3×3 sleep-dust footprint on the board. |
| newt_fire | Fire newt/salamander mage with glowing throat/back markings and a low four-legged body; Quả Cầu Lửa visibly charges at the mouth/focus and detonates on the selected cluster center with the exact cross-five footprint. |
| nymph_water | Water nymph with flowing hair/fins and a clear hand/relic casting focus; Dòng Nước Thanh Tẩy wraps the selected lowest-HP ally in one water ribbon that heals and cleanses without implying whole-team coverage. |
| octopus_mind | Octopus caster with a central head/mantle and every tentacle physically attached; Mực Phun Giảm Giáp floods the selected enemy column with one coherent ink wave and keeps armor/rage debuff cues on units in that column. |
| oracle_wisdom | Mythic oracle/support character with a strong focus/relic silhouette; rage transfer visibly links to the lowest-rage allies and never suggests direct damage. |
| otter_river | Playful but sturdy river otter fighter with paddle tail and two-paw combat; Combo Rái Cá lands two readable frontline beats and then a delayed echo impact on the same valid target rather than spawning a duplicate otter. |
| owl_nightshot | Night owl marksman with wide facial disk, asymmetrical alert head turns and a quill/bow projectile source; Mũi Tên Ngủ locks the highest-rage rear enemy and leaves the sleep cue only on that target. |
| ox_mountain | Massive mountain ox with broad shoulders, horns and layered stone/cloth load; Chịu Đựng is a self-only endurance ritual where the body visibly gains permanent mass/armor accents for the current combat as max HP increases. |
| pangolin_plate | Pangolin with overlapping articulated scales and a tail that curls with the torso; Vảy Tê Tê closes the plates for reflect and sends the separate protection cue to the adjacent ally without turning into a generic spherical rock. |
| panther_void | Panther/feline Assassin with connected neck and low predatory gait; execute leaps to the selected backliner/low-HP victim and kill-confirmed rage refund/evasion has a distinct recovery cue. |
| peacock_dazzle | Peacock body and readable tail fan; dance expands the authored feather display across the enemy side, while weakened/silenced targets receive targeted secondary cues. |
| pelican_bomb | Pelican marksman with a large beak pouch visibly carrying the fish bomb; Bom Cá lifts/drops the payload onto the chosen tile, shows the true 3×3 blast area before impact, and reserves the central stun cue for the actual center victim. |
| phoenix_arrow | Archer-like phoenix with flame-feather projectile language; cone volley clearly shows the real cone footprint and burn victims. |
| phoenix_rebirth | Support phoenix distinct from the projectile phoenix; rebirth mark belongs to the caster, followed by a separate heal beat on the selected low-HP ally. |
| qilin_breeze | Qilin/Kirin support silhouette; breeze blessing travels through the caster's allied column and at 3★ softly reaches the adjacent columns according to gameplay. |
| ram_charge | Compact mountain ram with oversized curled horns and hoof-scrape windup; Sừng Húc drives the nearest frontline enemy backward along the real path and shows the bonus impact only when the knockback condition succeeds. |
| raven_death | Dark raven/carrion Assassin silhouette; death-mark strike emphasizes the selected frontline/tank or shielded victim and keeps the recurring curse attached to that unit. |
| reaper_void | Reaper-like Assassin with coherent body/weapon silhouette; backline execute has approach, impact and recovery, with low-HP amplification readable without arbitrary target switching. |
| rhino_quake | Broad rhinoceros with a heavy horn and planted counter stance; Phản Đòn Địa Chấn visibly arms the stance first, then performs the retaliatory horn/body slam only when the corresponding melee trigger occurs. |
| roc_legend | Giant Roc/legendary bird archer; the signature fish-bomb/projectile lands on the chosen center and the cross-five footprint is visible before impact. |
| salamander_flame | Volcanic salamander with ember cracks and a glowing throat; Phun Lửa Núi breathes from the mouth into the real forward cone and leaves burn on units actually inside that cone. |
| scorpion_king | Regal scorpion with large claws, crown/crest and a thick articulated tail; Đuôi Độc Vua punctures the chosen frontline victim, shows poison/rage pressure there, and triggers any death burst only if that victim actually falls. |
| scorpion_shadow | Lean dark scorpion assassin with low claws and a fast raised stinger; it shadows into the rear high-rage target, lands Đuôi Chích from the connected tail and keeps stun/paralysis feedback on that victim. |
| seraphim_light | Seraphim support identity with authored wing/body proportions; triage healing visibly resolves the real lowest-HP allies rather than spraying every ally. |
| shark_frenzy | Shark fighter presented with a convincing water-hover/swim solution, powerful jaw and tail propulsion; Cắn Xé Điên Cuồng commits into the frontline victim and visibly increases the lifesteal/frenzy read when the prey is already wounded. |
| snail_fortress | Large snail with an architectural fortress shell and visible soft body that retracts into it; Pháo Đài Di Động closes the shell for self shield/CC immunity and then projects the separate row-cover protection outward. |
| spider_venom | Eight-legged venom spider with corrected battlefield facing, grounded leg contacts and connected abdomen; Mạng Tơ Bẫy leaps to the selected rear target and anchors the web between spider/ground/target so the slow/control never looks detached. |
| spore_mage | Fungal spider with mushroom caps integrated into the abdomen and legs; Mưa Bào Tử vents spores over the selected 3×3 area and leaves poison growth only on enemies actually inside the footprint. |
| sprite_wind | Tiny wind sprite with leaf/air wings and a bright core; Gió Hộ Mệnh sends two distinct curved gust-shields to the lowest-HP allies and keeps the sprite itself visually lightweight rather than turning it into a generic fairy clone. |
| squid_ink | Aquatic squid/cuttlefish caster with mantle, fins and attached tentacles; Bom Mực launches from the mantle onto the locked target tile and visibly expands to the star-resolved square radius while blind stays on affected units. |
| stork_sniper | Despite the legacy id/species mismatch, follow the canonical player-facing penguin sniper identity: compact penguin body, flippers and a fantasy long-range bow/crossbow; Phát Bắn Tỉa has a deliberate aim-hold-release and one piercing impact on the locked target. |
| storm_mage | Lightning serpent with long coherent coils, raised casting head and electric crest; Lôi Trụ Tách Nhánh drops the primary bolt through the locked column, then visibly branches to the authored enemies outside that column. |
| swan_grace | Elegant swan/aquatic-avian support anatomy; water shield and cleanse are readable as protection/purification on the one selected low-HP ally. |
| thunderbird_storm | Large storm bird/archer; lightning traverses the chosen target row in semantic order and any stun cues stay on affected enemies. |
| tiger_fang | Muscular tiger fighter with striped body, connected shoulders and large claws; Vuốt Hổ Xé Thịt rakes down the resolved enemy column and leaves distinct bleed trails on the units actually struck. |
| titan_earth | Massive earth Titan/tank silhouette distinct from the Earth Dragon/Golem; team DEF/MDEF fortification precedes the single low-HP heal. |
| toad_poison | Squat poison toad with inflating throat sac and toxic skin glands; Nhổ Độc repeatedly spits at the same locked victim so stacking poison is visually cumulative instead of appearing as unrelated clouds. |
| toucan_snipe | Colorful toucan marksman with oversized beak used as the precision launch/aim silhouette; Mỏ Xuyên Kết Liễu holds aim on the lowest-HP enemy and releases one armor-piercing execute shot with no target swap during the windup. |
| trex_bite | Full T-Rex anatomy with powerful hind legs, balanced tail and jaw; frontline bite owns the impact and armor-break cue, avoiding tiny generic quadruped proportions. |
| triceratops_charge | Despite the legacy id, follow the authored player-facing charging-bison identity from the catalog; use a broad horned bison body and a straight rush that hits the frontline victim first, then the one valid enemy directly behind in the same row. |
| turtle_mire | Swamp turtle with mud-coated shell, thick legs and low planted stance; Mai Rùa Bất Tử braces against the nearest frontline enemy, hardens the shell and visibly shares part of the protection with the adjacent ally. |
| unicorn_light | Luminous unicorn with coherent horse anatomy and a prominent radiant horn; Sừng Kỳ Lân channels a focused horn beam/ribbon to the allied unit with the highest ATK and never suggests that the caster is the buff target when excluded. |
| viper_strike | Slender venom serpent with flexible full-body coils and paired fang strikes; Cắn Độc Kép reaches the rear victim, lands two readable bites, then shows pursuit/venom spread only when the higher-star authored condition activates. |
| vulture_scavunge | Vulture scavenger Assassin with hunched avian posture, wings and beak; dives onto the lowest-HP backliner, and kill-heal/scavenge recovery is visible only after a valid kill. |
| walrus_ice | Heavy walrus with tusks, whiskers and ice-plated shoulders; Hào Quang Băng sends two chunky ice shields to the lowest-HP allies while keeping the caster’s own body grounded and distinct from seal/hippo silhouettes. |
| wasp_arcane | Arcane wasp caster with insect waist, wings and stinger/focus distinct from Wasp Sting; pollen cloud covers the semantic enemy set and silence cues only successful targets. |
| wasp_assassin | Assassin wasp silhouette with weapon/stinger emphasis; backline pierce communicates armor penetration and may intensify with living Swarm allies without creating phantom attackers. |
| wasp_sting | Yellow-black wasp marksman with insect waist, wings and a clear stinger/needle launch source; Châm Liên Hoàn fires separate venom needles into distinct random targets and intensifies the hit only when that target was already poisoned. |
| weasel_quick | Lean wind-weasel assassin with long flexible body and rapid low dash; Đâm Nhanh slips into the enemy rear column, lands the rage-draining strike, leaves the accuracy-disruption cue on the same carry, then returns cleanly. |
| whale_song | Ancient whale/aquatic fighter presentation that works on the battlefield scale; tsunami sweeps the real enemy side and only frontline victims receive knockback staging. |
| wisp_light | Luminous spirit/wisp support with a readable core and trailing spectral limbs rather than an anonymous orb; Hồn Hộ Mệnh forms one soul-link tether to the lowest-HP ally and makes healing transfer through that link easy to follow. |
| wolf_alpha | Large alpha wolf with mane/crest and commanding howl stance; Tiếng Tru Đầu Đàn marks the locked prey, then visually cues the actual same-row allied participants to join the hunt without inventing spectral attackers that deal extra hits. |
| wolverine_rage | Stocky wolverine/chồn-sói fighter with broad claws and a compact aggressive posture; Cuồng Nộ Hải Ly ignites a self-only berserk state that progressively exaggerates claw swipes and rage feedback while the buff is active. |
| woodpecker_drill | Woodpecker marksman with reinforced drill-like beak and tail-braced firing posture; Khoan Liên Tục pecks/fires three sequential hits into the same frontline tank before any authored nearby pressure cue appears. |
| worm_ice | Despite the legacy id, follow the authored player-facing ice-toad identity; use a squat amphibian body, frosted throat sac and a focused frost spit that freezes/reduces evasion on the single locked target. |
| worm_queen | Caterpillar queen with segmented body, crown/leaf accents and a complete cocoon transition; Hóa Kén Bướm Gió visibly encloses the same unit, then reveals a winged evolved mage form whose team-evasion gust persists for the rest of combat. |
| wraith_shadow | Cohesive spectral Assassin with weapon/arms anchored to the body; two-hit backline sequence preserves hit ordering, kill retargeting and adjacent spill semantics. |
| yak_highland | Highland yak tank with horns, coat mass and grounded stance; warcry sends the allied ATK buff outward while self DEF reinforcement remains centered on the yak. |

### A90.5 Mandatory visual brief for all 5 scheduled bosses

Bosses use the same visual-integrity rules as normal units but must read as encounter-scale threats with their own authored silhouettes, casting sources and impact language. Scaling up a normal unit rig is insufficient.

| Canonical boss id | Required boss visual identity and skill-readable staging |
| --- | --- |
| boss_earth_colossus | Monumental earth colossus assembled as one coherent stone body with tectonic plates, massive planted feet and oversized slam arms. Địa Chấn Khóa Thành must visibly originate from the boss hitting the terrain, spread as a battlefield quake, build the giant self shield around the colossus and communicate whole-field taunt without spawning unrelated stone actors. |
| boss_ember_dragon | Huge infernal dragon with connected jaw/neck/torso/wings/tail, furnace-like chest and authored black-flame breath source. Hỏa Vực Diệt Thành sweeps the entire enemy battlefield from the mouth/cast anatomy and leaves a persistent hellfire field whose duration is visually distinct from the initial impact. |
| boss_storm_phoenix | Giant storm phoenix with a broad feather fan, powerful wingbeats and lightning-charged plumage, clearly distinct from both normal phoenix identities. Cuồng Vũ Lôi Phượng winds up through the wings and releases a very wide cone of storm feathers so the real cone edge and frontline coverage remain readable at tactical zoom. |
| boss_tempest_jelly | Encounter-scale jellyfish with a luminous storm core, one coherent bell and many physically attached tentacles. Lốc Điện Hỗn Mang charges inside the bell, then chains through the actual resolved targets in visible order; rage-drain feedback remains attached to those victims rather than appearing as a global HUD-only effect. |
| boss_venom_hydra | Massive venom hydra with multiple individually animated heads attached through plausible necks to one heavy body; no floating duplicate heads. Tái Sinh Cửu Đầu visibly restores the hydra first through head/body regeneration, then propagates the separate healing/toxic-support pulse to the authored allied recipients. |

### A90.6 Visual roster acceptance audit

Before declaring the rebuild complete, enumerate all 125 canonical A83/A84 ids and resolve each through the production visual resolver. The audit fails if any id reports unknown, generated-full-roster fallback, unfinished placeholder, generic full-animal fallback, missing controller, missing required action state, detached anatomy or a mismatched preview/battle identity.

The audit also verifies:

- all five bosses are individually authored and do not merely scale a normal rig;
- every normal unit has a deliberate 1★/2★/3★ progression;
- all authored skins resolve without changing the base gameplay id;
- every action can return safely to idle/combat-idle and can be interrupted/cleaned up on death or scene disposal;
- action VFX consumes A89's resolved semantic visual-target plan;
- no unit-local visual path independently rerolls combat RNG;
- no production path needs the unknown-unit cube or generated whole-creature placeholder for a canonical id.

## A91. Camera, world-space presentation and environment contract

The battlefield camera and world are gameplay-readability systems. Their numeric behavior may be reimplemented, but the player must retain the same usable framing, movement bounds and world-space cues.

### A91.1 Tactical camera

Use a perspective camera with the current baseline field of view **45°**, near plane **0.1** and far plane **1000**. Orbit interaction has damping factor **0.05**, minimum dolly distance **6**, polar range **0 through PI/2.05**, one-finger rotate and two-finger dolly/pan. Preset transitions default to about **0.75 s**; board-profile reframing defaults to **0.5 s** and uses smoothstep interpolation p²(3-2p), with negative frame delta treated as zero.

Board framing is profile-aware rather than hard-coded to the solo board. Compute the full visible footprint including logical board, the one-column river gap and the outer bench perimeter. Convert horizontal span to vertical-frustum equivalent using aspect clamped to at least **0.55**, use a framing margin of **1.18**, then derive required camera distance from the field of view. The user must always be able to dolly at least to that framing distance plus **5 world units**, with a base maximum distance of at least **50**. Reframing co-op boards therefore cannot crop their outermost rows because an old solo max-distance constant remained active.

Camera pan is shared across Planning/Combat rather than torn down with one screen:

- keyboard pan accepts WASD and arrow keys;
- diagonal keyboard input is normalized;
- editable input/select/textarea/contenteditable targets do not trigger camera movement;
- joystick radius baseline is **44 px**;
- pan speed baseline is **9 world units/s**;
- target x/z are clamped to **[-24, +24]**;
- per-update pan delta is capped to **0.05 s**;
- input magnitude below **0.02** is treated as idle;
- panning moves camera position and orbit target by the same world displacement.

The on-screen joystick stays in the intended left-side tactical control area and must not cover the top status/header or unit cards on mobile.

### A91.2 River, outer ring and placement meaning

The river occupies one visual-column width equal to one arena block and is centered in the 11-column visual battlefield. It is presentation plus a placement-exclusion corridor: direct raycast selection on the river is rejected and world x strictly inside (-riverWidth/2, +riverWidth/2) does not resolve to a legal tactical cell. The river mesh itself is not a click target.

Presentation keeps water alive without becoming noisy: baseline flow speed is **0.62**, with seven lightweight flow markers and three lily-pad accents. Animate only the small authored moving set; leaving/rebuilding the world must not duplicate river animations or accents.

The brown/wood perimeter remains an unobstructed walkable presentation/landing lane. Do not restore the old blocking/decorative fence. Melee and Assassin presentation may use that lane as specified by movement staging, but logical combat occupancy remains governed by canonical board cells.

### A91.3 Terrain and face visibility

Voxel world blocks use one consistent arena block size. Battlefield foundation, tactical top cells, perimeter and bench ring form one contiguous occupancy model so hidden internal faces can be culled. Grass/soil variation must not open visual cracks between cubes. An occupied tactical tile switches to its no-grass presentation so grass tufts do not intersect a deployed unit.

Hidden internal voxel faces may be omitted for performance, but any face that becomes visible after a legitimate terrain/board change must still appear correctly. Repeated terrain blocks should remain visually consistent and stable during long sessions.

### A91.4 Morning sky is world-space art

Sun, rainbow and clouds are pixel/cartoon 2D artwork placed in **3D world space**. They billboard toward the camera but their positions do not inherit camera position/quaternion. Camera pan/orbit therefore creates perspective/parallax instead of the sky behaving like a HUD overlay. Sky sprites test depth, do not write depth, do not receive pointer/raycast interaction and use nearest-filtered pixel textures.

Current morning composition uses one sun, one rainbow and six cloud sprites. Cloud drift is ambient-only; baseline drift speed is **0.42**, horizontal wrap span **54 world units** and bob frequency **0.35**, with no per-frame allocation requirement. Disposal releases sky textures/materials and transient drift references.

### A91.5 Lighting and graphics quality

Keep one owned lighting rig and retune it by phase instead of creating/removing duplicate lights every transition. Planning, Combat and Menu may have different hemi/ambient/sun/rim/fog values so Combat reads with stronger separation while Planning stays bright morning.

Quality changes may alter shadow-map resolution, softness and whether the sun casts shadows. Low quality may disable the sun shadow entirely; it may not disable semantic target highlights, health/resource readability or gameplay VFX required to understand an action. Shadow/resource changes dispose obsolete GPU maps before replacement. Leaving the world disposes owned lights, shadow maps and environment resources.

## A92. Unit status billboard — exact state, capacity and lifetime

The above-unit status billboard is a single coherent status panel, not three unrelated floating planks. Its state is derived from the live unit and must move with the unit after board movement, melee approach, Assassin staging, knockback or other visual relocation.

Canonical displayed state contains:

- localized display name and star;
- current HP and max HP;
- current rage and rageMax;
- at most **3 positive status icons** and at most **3 negative status icons**;
- side/ownership for semantic presentation.

Normalize HP/rage to non-negative rounded numbers, max HP to at least 1, star to 1..3 and rageMax to non-negative. Status keys are canonicalized and deduplicated before display. A status/modifier appears only when it is active/non-zero; duplicate aliases do not consume two slots. A plain numeric shield still does not fabricate a timed shield-status badge unless canonical status state exists.

The current high-resolution sprite surface is **512×176 logical pixels**. Render resolution multiplies by device pixel ratio rounded and clamped to **1..2**. If the status-panel presentation cannot be created, gameplay must continue without crashing; presentation may recover/rebuild when resources become available. When the authored font or frame images finish loading after the billboard already exists, redraw active billboard canvases so they upgrade in place.

Static chrome is asset-first:

- HP and outer rage frames use horizontal 3-slice with source slice **24**;
- individual rage-cell frames use horizontal 3-slice with source slice **10**;
- unified shell and square value/status panels use 9-slice with source slice **7**;
- dynamic HP/rage fills and text reflect the unit's live values inside those frames.

Rage is segmented for tactical readability. Segment count is clamp(rageMax or 1, 1, 10). When rageMax <= 10, filled segment count is min(segmentCount, current rage). When rageMax > 10, map current rage proportionally into the 10 visible segments using round(segmentCount × clamp(rage/rageMax,0,1)). Always show the numeric current/max value as the precise source of truth so the capped visual segmentation cannot mislead.

Positive status tiles group from the left and negative tiles from the right with clear separation. Status icon resolution uses the shared semantic icon/emoji pipeline. Tooltip/provenance text follows A89; the compact billboard is a glanceable summary, not the place to duplicate full skill descriptions.

Billboard lifetime is strict:

1. Unit spawn creates one billboard handle.
2. State updates redraw that same handle; do not continuously allocate new textures/sprites per frame.
3. Movement updates the owning world anchor so the billboard and damage text follow the current unit.
4. Death/removal hides and disposes the billboard with the unit.
5. Scene/world disposal releases CanvasTexture/material resources and unregisters the canvas from any redraw set.

## A93. Semantic completeness gate

Every meaningful player-visible or canonical behavior represented by this specification must have an explicit outcome in the rebuild: **implemented as written, intentionally folded into an equivalent replacement, or explicitly unavailable in a mode for a documented rule**. Silent omission is not acceptable.

Perform the coverage review by capability. For every meaningful product area, ask:

1. What can the player do or observe?
2. What serializable state changes?
3. What exact precondition allows the action?
4. What order do mutations, RNG, animation and persistence occur in?
5. What happens when the action cannot complete?
6. What owns cleanup when the scene/modal/unit disappears?
7. Is this behavior already represented by a newer canonical section? If so, record it as covered instead of reintroducing an obsolete subsystem.

The review must include application boot/loading/routing, menu and New Game/Continue, persistence/migration, Planning, board/bench/shop, inventory/equipment/crafting, tech, synergy, augments, tutorial, Library/recipes, tooltips/history/settings, Creative, Fortress services/map, co-op/P2P, gated PvP, Combat queue/targeting/status/damage/heal/result/loot, audio/haptics/speech, camera/input, world/lighting/VFX, unit visuals/animations/skins/star evolution, debug/profiling, mod loading and generated content inputs.

Do not create duplicate behavior just because several implementations once existed. The rebuild has one authority per capability. Any player-facing capability described in this document remains a coverage requirement until it is implemented or explicitly superseded by an equivalent documented contract.

Final sign-off therefore requires both:

- **semantic coverage:** no meaningful gameplay/product/presentation capability is unexplained; and
- **visual coverage:** all 125 A83/A84 identities pass A90 without canonical full-creature fallback.

## A94. Tutorial deterministic script — fixed shop, exact action gates and persisted progress

The eight-round tutorial is deterministic authored gameplay. Do not substitute ordinary random shop rolls, approximate the taught actions, or advance because a visually similar control was clicked. The campaign data and action gates in this section are canonical.

Tutorial is active only while AI mode is `TUTORIAL`, `tutorialSkipped !== true` and round is in **1..8**. `TUTORIAL_END_ROUND = 8`. If tutorial state is already completed, or the run advances beyond round 8, mark it completed and convert in-run AI mode to `EASY`.

Persist at least `completed`, `currentRound`, `shopVariant`, `preparedRounds`, `roundEventCounts`, `markers` and the run-level `tutorialSkipped` flag. When the tutorial round changes, set `currentRound` to that round, clear `roundEventCounts` and reset `shopVariant` to 0. `preparedRounds` makes per-round setup idempotent.

### A94.1 Fixed tutorial shop and augment table

| Round | Variant | Slots 1..5 |
| --- | ---: | --- |
| 1 | 0 | `ant_guard`, `deer_song`, `falcon_dive`, `cat_goldbow`, `ram_charge` |
| 2 | 0 | `ram_charge`, `fox_flame`, `cat_goldbow`, `deer_song`, `ant_guard` |
| 2 | 1 after required reroll | `eagle_marksman`, `owl_nightshot`, `deer_song`, `ant_guard`, `ram_charge` |
| 3 | 0 | `deer_song`, `ant_guard`, `cat_goldbow`, `fox_flame`, `ram_charge` |
| 4 | 0 | `owl_nightshot`, `deer_song`, `ant_guard`, `ram_charge`, `fox_flame` |
| 5 | 0 | `ant_guard`, `deer_song`, `eagle_marksman`, `fox_flame`, `ram_charge` |
| 6 | 0 | `deer_song`, `owl_nightshot`, `ant_guard`, `fox_flame`, `ram_charge` |
| 7 | 0 | `eagle_marksman`, `deer_song`, `ant_guard`, `fox_flame`, `ram_charge` |
| 8 | 0 | `owl_nightshot`, `deer_song`, `ant_guard`, `fox_flame`, `ram_charge` |

Forced tutorial reroll increments `shopVariant`; if no authored variant exists, resolve to that round's variant 0 instead of rolling an unrelated random tutorial shop.

The fixed round-7 augment pool is exactly `gold_cache`, `wild_command`, `opening_fury`.

Round preparation is also deterministic:

- round 3: if the bench is empty, grant one 1-star `falcon_dive` and log the tutorial reward;
- round 5: if absent, grant exactly one `eq_warmog_armor` and log the reward;
- round 6: force `craftTableLevel >= 1`, ensure `tear` exists if absent, and clear an already-staged 3x3 craft grid so the taught recipe starts from known state;
- round 7: remove 7 from `augmentRoundsTaken` during tutorial preparation so the fixed choice can be presented.

Those setup operations are covered by `preparedRounds`. Refresh, resize, modal open/close or scene re-render must not grant them again.

### A94.2 Step schema and action gate

Every step owns stable `id`, localized/display text, live target descriptor, trigger, delay, panel placement, layout-focus strategy, indicator, `allowedActions`, `allowedTargets`, completion rule, settings/skip permissions and a blocked-action hint.

Normal defaults are trigger `dismiss`, delay about **180 ms**, panel placement `auto`, layout focus `target`, automatic arrow indicator, `allowSettings = true` and `allowSkip = true`. A center-dismiss information step uses screen center and no arrow. A restricted step must validate the tutorial gate **before** the canonical mutation.

Role-aware tutorial deployment guidance is: `TANKER` frontline, `FIGHTER` frontline, `ARCHER` backline, `MAGE` backline, `SUPPORT` backline and `ASSASSIN` backline during the tutorial. This is teaching guidance only.

### A94.3 Exact round step manifest

**Round 1**

1. `welcome` — center-dismiss introduction.
2. `buy_unit` — target `shopFirstAvailable`; allow `buy_unit`; complete at total owned units >= 1.
3. `deploy_first_unit` — source `benchFirstOccupied` to `boardRecommendedDeploy`; allow `select_bench`, `start_unit_drag`, `move_unit`; complete at board units >= 1.
4. `explain_synergy` — target `synergyPanel`; dismiss.
5. `buy_more` — first available shop offer; complete at total owned units >= 2.
6. `deploy_second_unit` — bench to recommended board target; complete at board units >= 2.
7. `start_combat` — target Start; allow `begin_combat`.

**Round 2**

1. `round2_intro` — center-dismiss.
2. `explain_gold` — target gold stat chip; dismiss.
3. `explain_xp` — target XP stat chip; dismiss.
4. `explain_deploy_cap` — target deploy-cap stat chip; dismiss.
5. `explain_roll` — target reroll; allow `roll_shop`; complete at `roll_shop` event count >= 1 and expose round-2 shop variant 1.
6. `round2_buy_unit` — complete at total owned units >= 3.
7. `round2_deploy_unit` — complete at board units >= 3.
8. `round2_buy_unit_second` — complete at total owned units >= 4.
9. `round2_deploy_unit_second` — complete at board units >= 4.
10. `round2_start_combat` — canonical Start handoff.

**Round 3**

1. `round3_intro` — center-dismiss.
2. `round3_move_unit` — any occupied board cell to any legal empty cell; allow `start_unit_drag` and `move_unit`; complete at `move_board_unit` >= 1.
3. `round3_sell_unit` — reserve unit to Sell; allow `start_unit_drag`, `sell_unit`, `sell_selected_unit`; complete at `sell_unit` >= 1.
4. `round3_open_history` — target History; allow `toggle_history`; complete at `open_history` >= 1.
5. `round3_close_history` — target actual History close control; allow `toggle_history`; complete at `close_history` >= 1.
6. `round3_open_settings` — allow `open_settings` / `toggle_settings`; complete at `open_settings` >= 1.
7. `round3_close_settings` — target Settings close; allow `close_settings` / `toggle_settings`; complete at `close_settings` >= 1.
8. `round3_start_combat` — canonical Start handoff.

**Round 4**

1. `round4_intro` — center-dismiss.
2. `round4_hover_preview` — target first occupied allied unit; allow `show_attack_preview` on any occupied board unit; complete at that event count >= 1.
3. `round4_start_combat` — canonical Start handoff.

**Round 5**

1. `round5_intro` — explain the guaranteed completed equipment.
2. `round5_equip_item` — drag `eq_warmog_armor` from inventory onto an occupied board unit; allow `start_item_drag` and `equip_item`; complete when a unit has that equipment.
3. `round5_unequip_item` — equipped board unit to Unequip; allow `start_unit_drag` / `unequip_item`; complete at `unequip_item` >= 1.
4. `round5_re_equip_item` — equip returned `eq_warmog_armor` again; complete when `equip_item` count reaches 2.
5. `round5_start_combat` — canonical Start handoff.

**Round 6**

1. `round6_intro` — center-dismiss crafting explanation.
2. `round6_place_craft_item` — drag `tear` into craft-grid index **4**; allow `start_item_drag` / `add_craft_item`; complete only when slot 4 contains `tear`.
3. `round6_craft_item` — activate canonical craft output; allow `craft_item`; complete when `eq_blue_buff` exists in the bag.
4. `round6_equip_crafted_item` — drag `eq_blue_buff` onto an occupied board unit; complete when a unit has it equipped.
5. `round6_start_combat` — canonical Start handoff.

**Round 7**

1. `round7_choose_augment` — centered, no arrow, about **140 ms** delay; allow `choose_augment`; complete at that event count >= 1.
2. `round7_augment_summary` — center-dismiss; resolve `lastAugmentName` from markers so summary reflects the actual choice.
3. `round7_start_combat` — canonical Start handoff.

**Round 8**

1. `round8_intro` — center-dismiss recap.
2. `round8_free_play` — target Start but allow `*` against `any`; free normal Planning manipulation until the player starts the final tutorial combat.

### A94.4 Event persistence, blocked actions and skip

Tutorial event counts are monotonic within a round. Persist when an event is first observed and when it satisfies the current `eventAtLeast` rule, so reload does not regress a restrictive step.

Allowed targets are role-aware: source/destination/item roles must match actual interaction context. A blocked action is a no-op and displays the step's blocked hint.

Settings remain usable unless explicitly disabled. While Settings is open, its internal `settings_*` actions remain operable so tutorial cannot trap the player behind the modal.

Skipping sets `tutorialSkipped = true`, records `skip_tutorial`, persists immediately and destroys/releases tutorial overlay ownership. It does not synthesize completion events or duplicate round gifts.

## A95. Combat HUD semantic contract — team status, density and Fortress remote match

Combat HUD observes canonical combat; rendering cards, opening History, changing responsive density or refreshing remote-match data must never advance a turn or apply damage/rewards.

The complete information stack contains current phase/rule state, synergy summary, enemy/queue preview, combat-log preview with History access, optional Fortress remote-match state, top-right utility controls for bubble presentation/Library/Settings, and a LEFT-vs-RIGHT team-status comparison.

Responsive density preserves these limits:

- normal queue preview: **8** entries;
- compact queue preview: **3** entries;
- normal log preview: **4** lines/events;
- compact log preview: **3** lines/events.

A compact layout may activate around a narrow side-panel width such as **320 px**. The rebuild may choose a more appropriate breakpoint, but must reduce information density intentionally rather than clip desktop content.

### A95.1 Team status aggregate

For each side expose `unitCount`, `hpCurrent`, `hpMax`, `hpRatio`, `power`, `powerMax` and `powerRatio`.

`hpCurrent` sums non-negative HP from alive units only. `hpMax` sums non-negative max HP for every member of that side. `unitCount` is side membership, not survivor count.

Default live power for an alive unit is:

`round(HP×0.45 + Shield×0.20 + ATK×6 + MATK×6 + DEF×4 + MDEF×4 + Star×90 + Tier×40)`.

A dead unit contributes zero live power. Default baseline/max power uses max HP and excludes transient shield:

`round(MaxHP×0.45 + ATK×6 + MATK×6 + DEF×4 + MDEF×4 + Star×90 + Tier×40)`.

Team values are non-negative rounded sums. Ratios clamp to 0..1 and resolve to 0 with zero denominator. If a mode supplies an explicit power resolver, the HUD consumes it instead of creating another formula.

### A95.2 Fortress remote-match card

The remote-match card appears only where the active mode exposes the `PVP4Fortress` parallel-match concept. It communicates pair/opponent identity, both remote sides, remote progress/result state and freshness/staleness of the last update. Missing or stale data is an information state; do not invent a result.

### A95.3 Modal/input ownership

Settings, Library/wiki, History and any blocking combat overlay intercept pointer/keyboard/gamepad actions before combat-step input. The press that closes a modal may not leak through and step combat. Teardown removes remote HUD nodes, subscriptions, modal instances and transient controls.

## A96. Shared tooltip content model and pointer/touch contract

All production hints use one shared semantic tooltip surface. Supported modes are `off`, `compact`, `summary` and `expanded`; legacy `expandedTooltip=true` only normalizes into the setting.

### A96.1 Unit metadata and economy truth

Unit metadata may expose buy price, tier, star, sell value, class/role, tribe and optional side/team. Buy price follows catalog tier. Sell value uses the same canonical Planning sale resolver; compatibility fallback is tier × star multiplier 1/3/5 plus canonical sell value of actually equipped equipment.

Side aliases normalize to canonical LEFT/RIGHT: allied aliases include `LEFT`, `ALLY`, `PLAYER`, `FRIEND`; enemy aliases include `RIGHT`, `ENEMY`, `FOE`, `OPPONENT`.

### A96.2 Summary and expanded structure

Summary mode preserves four blocks: short creature description/pitch, variant traits, active statuses, and current star-resolved skill.

Expanded mode preserves four semantic columns/groups:

1. basic identity/information;
2. current stats + equipment + active statuses;
3. passive + basic attack;
4. skill.

Narrow screens reflow these groups instead of dropping them. Header content can include avatar, metadata badges, deduplicated status icons, resource meters and optional browser-speech label/language.

Description resolution prefers localized short `descriptionVi/En`. If a legacy description is really a long numeric/turn-based skill dump, use the authored unit pitch or star-resolved skill summary for the summary description rather than duplicating skill details.

### A96.3 Shared tooltip interaction

All interactive surfaces use the same semantic tooltip content model. Avoid duplicate tooltip systems that can show conflicting text for the same target.

- mouse/pointer hover shows and follows the owning target;
- pointer-out hides after actually leaving that owner;
- keyboard focus shows the same hint and focus-out hides it;
- touch/pen long-press delay is exactly **420 ms**;
- pointer release/cancel clears the timer and hides the hint;
- a disconnected owner cannot spawn a delayed tooltip;
- teardown removes all delegated listeners, timers and tooltip nodes.

Placement must be viewport-safe and may flip/reflow around the target. Tooltips may not intercept the action target.

## A97. Loading minigame embedding and lifecycle

A55.1 remains authoritative for shooting physics and score behavior. Loading presentation also preserves these capabilities:

- full-screen presentation or embedding in an explicit bounded rectangle;
- optional loader progress bar/text driven **one-way from the real loader**;
- editable title, progress, detail and instruction copy without rebuilding the minigame;
- input scope limited to scene, bounded panel, playfield or an equivalent predicate;
- injectable presentation RNG for deterministic tests/screenshots;
- reset and score-change callbacks;
- normalized progress 0..1.

These are presentation adapters. Bubble score/randomness never changes asset progress, priority, gameplay RNG, save state, rewards or routing. Real loader completion controls scene transition.

Destroying/replacing the interaction unregisters pointer input and disposes every bubble, projectile, chrome/progress object and callback reference. Re-installation first destroys the previous owned instance.

## A98. Main-menu overlay stack, save recovery and navigation

Preserve this current product hierarchy even if the art/layout is redesigned:

1. **Continue** full-width primary row when a valid supported save exists;
2. **New Game** full-width primary row;
3. compact utility surfaces for Settings, Library, Mods, Achievements and configured debug/language/social/tribute extras.

Continue is disabled when no valid save exists or when the saved run's mode is currently gated off. Its summary exposes enough state to distinguish the run: at least mode and round; solo also surfaces level and HP/lives context; multiplayer/co-op may expose player capacity and room identity. A valid save for a gated mode remains intact; the menu marks it unavailable and does not try to launch it until that mode is enabled again.

If persisted run data exists but fails validation, expose an explicit corrupt-save recovery action. Clearing that broken run refreshes Continue and does not erase unrelated UI preferences or collection profile.

The current menu-availability policy enables `EndlessPvEClassic` and shows other registered modes as disabled/in-development. Locked selection normalizes back to `EndlessPvEClassic`. Continue is likewise disabled for a valid save whose mode is gated; this availability check does not delete or rewrite that save.

New Game opens a dedicated mode/difficulty setup state. Available AI modes come from the selected mode config. Creating the run uses canonical fresh-run initialization rather than mutating a prior save.

Escape/back closes the topmost owned menu overlay before navigating away. Modal/overlay ownership covers Library, extras/social surfaces, Language, Achievements, Settings, Mod Manager and the New Game setup surface. Closing restores menu focus and consumes that input.

Gamepad navigation uses edge/latch semantics so a held button does not fire every frame. Pointer, keyboard and gamepad all invoke the same menu actions.

One language control opens the language list. Selecting `vi` or `en` updates locale and persisted settings and refreshes menu copy immediately. Language changes made inside Settings refresh the menu when Settings closes.

Menu teardown disposes all owned modals and clears input/gamepad ownership; returning from another scene cannot resurrect a hidden old overlay.

## A99. Product completeness gate — define behavior, not implementation archaeology

A subsystem is not complete merely because its name appears in this document. For every player-facing or simulation-facing system, the rebuild must make the following behavior explicit enough that implementation does not require guessing:

- the state the system reads before an action;
- the player, AI, network or timer event that triggers the action;
- every legality check performed before mutation;
- the exact state changes on success, including resources spent/gained and ownership changes;
- the state that must remain unchanged on rejection, failure, cancellation or no-op;
- the immediate player-visible feedback for success and failure;
- what persists when the screen changes, a round ends, the app reloads or Continue is used;
- any deliberate differences between normal solo, Creative, Fortress, co-op and PvP Fortress;
- cleanup of temporary UI ownership, timers, pending input and network/in-flight state so reopening or retrying cannot duplicate an action.

Whenever a rule has a numeric threshold, cap, duration, ordering rule, tie-break, default, retry condition or boundary case, state it directly. A label such as “shop”, “history”, “tutorial”, “status”, “multiplayer” or “settings” is never sufficient coverage by itself.

## A100. Additional product capabilities that remain part of Forest Throne

These behaviors existed in earlier or current versions and remain part of the intended product even though the rebuild may present them differently.

### A100.1 Twelve-round forest mood cycle

Round presentation cycles through twelve authored forest moods using:

`index = (max(1, floor(round)) - 1) mod 12`.

The sequence is:

1. **Sương mù rừng sâu**;
2. **Rừng tối cổ thụ**;
3. **Hồ rừng tĩnh lặng**;
4. **Thung lũng linh mộc**;
5. **Lá đỏ mùa thu**;
6. **Đường mòn sương sớm**;
7. **Thác rừng nguyên sinh**;
8. **Tán cây cổ thụ**;
9. **Con đường hoang dã**;
10. **Bình minh trong rừng**;
11. **Lối đi bí ẩn**;
12. **Rừng đêm tịch mịch**.

This cycle is visual mood only. It may alter sky, fog, scenery, lighting and terrain accents, but it must never silently add combat modifiers. Battlefield/environment modifiers defined elsewhere remain the only gameplay authority.

### A100.2 Deterministic cosmetic theme variants

Supported units may expose two deterministic non-gameplay cosmetic themes derived from stable unit identity. A theme may vary accessory family, weapon archetype, accent, aura shape, iconography or palette. The same unit identity must produce the same theme unless the cosmetic system explicitly stores a selected/equipped override.

Cosmetics never change combat stats, targeting, collision, skill behavior or star progression. They also must not silently replace the canonical creature silhouette with a different species or humanoid body. The animal/creature identity remains recognizable unless the player explicitly selects a cosmetic designed to reinterpret it.

### A100.3 Competitive mode availability

Generic PvP remains unavailable as a production mode. **PvP Fortress** is the supported competitive ruleset, with the pairing and resolution behavior specified in A48, but it is currently locked by the normal menu availability gate in A60. Do not expose either mode through New Game unless its explicit availability policy allows it.

### A100.4 Standard skill-effect behavior

When a skill uses one of the standard effect families, apply these semantics unless the skill explicitly overrides them:

- **single damage:** emit exactly one canonical damage event against the resolved target;
- **global damage:** resolve one independent canonical damage event for every living enemy so miss/crit/defense/status reactions remain per-target;
- **single heal:** floor the raw heal amount and choose the living injured ally with the lowest current-HP ratio; a full-health ally is not preferred over an injured ally;
- **global heal:** floor the raw heal amount and apply it to every living ally, clamped by each ally's maximum HP;
- **single stun:** resolve damage first; if the target dies, do not add stun; otherwise multiply authored stun chance by the star chance multiplier, cap at 100%, roll once, and on success refresh/extend stun without shortening a longer remaining stun;
- **team DEF buff:** affect all living allies; refresh each ally to at least the authored duration (default **3 turns**) and at least the authored defense bonus (default **+15 DEF**); reapplication must never weaken an already stronger or longer active buff;
- **legacy global slow:** remains inactive. Do not restore obsolete turn-order slowing as a hidden effect. Current evasion/status mechanics own the replacement behavior.

### A100.5 Shared utility behavior visible to the player

The rebuild must preserve these utility-level behaviors even if their internal implementation changes:

- audio recovers gracefully from browser autoplay restrictions and resumes the intended playlist/order rather than starting unrelated music;
- semantic icons are resolved consistently and reused rather than changing meaning between screens;
- transient combat/UI effects are bounded and reusable so long sessions do not grow unbounded visual objects;
- gamepad one-shot actions use edge/latch behavior so holding a button does not buy, sell, confirm or navigate every frame;
- a display/resolution change either applies successfully or rolls back to the previous usable setting;
- loading exposes real progress, failure and retry state and abandons stale work when the user leaves the route;
- all screens use one semantic tooltip information model so the same stat/status means the same thing everywhere;
- VFX are triggered by semantic events such as hit, heal, shield, status, death and evolution rather than creating a second gameplay state machine.

### A100.6 UI capabilities worth preserving

The following are product behavior, not implementation trivia:

- long result lists support pagination, virtualized scrolling or another equivalent way to reach every result;
- Library supports search, filters, unit inspection, star preview, skin preview and deep details;
- recipe details show the complete authored ingredient arrangement and result, not a lossy sample;
- Tech Tree shows node state, prerequisites, costs, effects and research outcome;
- Settings exposes real values, shortcuts and safe device/display changes;
- History can filter, scroll, close and reopen without replaying any gameplay mutation;
- tutorial steps resolve their target regions, block illegal input when required, and complete only from the intended world-state event;
- attack and skill previews use the real targeting footprint/rules rather than an invented approximation;
- while a blocking modal is open, that modal owns relevant input and hidden gameplay controls cannot activate through it.

## A101. Canonical conflict rules

When earlier behavior and the current product contract disagree, use the rules below. Do not average formulas or preserve both as hidden alternatives.

### A101.1 Gold-reserve skill scaling

The canonical multiplier is:

- **1.0×** while gold <= 10;
- above 10 gold: `min(2.0, 1 + ((gold - 10) / 2) / 100)`.

Every 2 gold above 10 therefore adds +1%, and the multiplier reaches the **2.0×** cap at **210 gold**. Do not use the obsolete 100-gold threshold / 10-gold step formula. Do not add hidden ±5 basic-attack RNG unless a canonical unit/basic-attack rule explicitly requires it.

### A101.2 Inventory capacity

Normal Planning inventory capacity equals:

`number of owned board units + number of owned bench units`.

It is not a fixed 16-slot bag. If migrated/imported data contains more items than the current computed capacity, retain and display those items so the player can recover/manage them; never truncate or silently delete excess items.

### A101.3 Bench upgrade chain

The authored progression supports **four bench-upgrade purchases** before later bonuses/expansion logic. An old clamp that limited the level to 0..1 is a migration bug, not intended design.

### A101.4 Legacy status migration

When loading old persisted status fields:

- old **slow** becomes an evasion debuff with its carried duration and **+15% evasion penalty** against the affected unit;
- old **haste** becomes an evasion buff with its carried duration and **+10% evasion bonus** for the affected unit.

Normalize into the current canonical status model. Do not keep the obsolete/mistaken field names alive as a second status system.

### A101.5 Compatibility rule

Compatibility import/migration may translate older persisted data into canonical state, but it may never override an explicit economy, board, combat, progression, persistence or mode rule in this document.

## A102. AI difficulty matrix — every authored numeric knob

A33 describes the player-facing behavior. This section freezes **all authored AI difficulty knobs** so a rebuild does not retain only HP/ATK and accidentally lose team growth, tier/star pressure or equipment cadence.

### A102.1 Stats, targeting, team growth and budget

| Mode | HP | ATK | MATK | Rage | Random target | Team + | Growth every | Growth cap | Budget | Level + | Max-tier + |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| EASY | .84 | .82 | .82 | 1.00 | .58 | 0 | 5 | 1 | .90 | 0 | 0 |
| COOP_EASY / COOP4_EASY | .98 | .96 | .96 | 1.00 | .42 | +1 | 4 | 2 | 1.02 | 0 | 0 |
| MEDIUM | .95 | .93 | .93 | 1.00 | .30 | 0 | 5 | 1 | 1.00 | 0 | 0 |
| COOP_MEDIUM / COOP4_MEDIUM | 1.08 | 1.06 | 1.06 | 1.00 | .22 | +1 | 4 | 3 | 1.08 | +1 | +1 |
| HARD | 1.05 | 1.04 | 1.04 | 1.00 | .12 | +1 | 4 | 2 | 1.05 | +1 | +1 |
| COOP_HARD / COOP4_HARD | 1.18 | 1.15 | 1.15 | 1.05 | .10 | +2 | 3 | 4 | 1.15 | +1 | +1 |
| CREATIVE | .75 | .72 | .72 | .90 | .80 | -1 | 8 | 0 | .80 | 0 | -1 |
| TUTORIAL | .65 | .60 | .60 | .80 | .75 | -1 | 8 | 0 | .70 | 0 | -1 |

An unknown combat difficulty normalizes to **MEDIUM** unless a specific setup flow explicitly defines another fallback as described in A33. That normalization must be deterministic.

### A102.2 Star and equipment pressure

| Mode | Max star | Guaranteed 2★ from | Guaranteed 3★ from | 2★ chance bonus | 3★ chance bonus | Equip from | Equip base | Equip growth/round | Equip cap | Max equip tier |
|---|---:|---|---|---:|---:|---:|---:|---:|---:|---:|
| EASY | 1 | never | never | -1.00 | -1.00 | 8 | .10 | .02 | .35 | 1 |
| COOP_EASY / COOP4_EASY | 2 | 6 | never | +.02 | -1.00 | 7 | .14 | .03 | .45 | 2 |
| MEDIUM | 2 | 5 | never | -.02 | -1.00 | 6 | .12 | .03 | .55 | 2 |
| COOP_MEDIUM / COOP4_MEDIUM | 2 | 5 | never | +.03 | -1.00 | 6 | .16 | .04 | .62 | 2 |
| HARD | 3 | 4 | 14 | .00 | .00 | 5 | .15 | .04 | .70 | 3 |
| COOP_HARD / COOP4_HARD | 3 | 4 | 12 | +.05 | +.02 | 5 | .18 | .05 | .78 | 3 |
| CREATIVE | 1 | never | never | -1.00 | -1.00 | 99 | 0 | 0 | 0 | 0 |
| TUTORIAL | 1 | never | never | -1.00 | -1.00 | 99 | 0 | 0 | 0 | 0 |

AI action selection itself is ordered: stunned -> `SKIP`; resolve target; no target -> `SKIP`; full rage + not silenced + skill id -> `SKILL`; disarmed -> `SKIP`; otherwise `ATTACK`. A taunt target wins before ordinary target scoring when that target is still alive.

For AI units on the RIGHT side, random target chance is considered only for non-Assassin ranged/non-frontline selection and is disabled by deterministic targeting mode. Ordinary melee prefers nearest column, then same row, then the top-first row sweep. Ranged prefers same row, top-first row sweep, then nearest column. Assassin targeting prioritizes the far/back column first, then same row, row sweep and class priority `MAGE -> ARCHER -> SUPPORT -> FIGHTER -> TANKER`; current directionality is side-aware. These rules must remain deterministic when an injected RNG/deterministic option is used.

## A103. Run-state schema — exact defaults, serialization and hydration invariants

### A103.1 Default solo player

A fresh player starts with:

- HP 3, gold 10, XP 0, level 1, round 1, mode `EndlessPvEClassic`;
- win streak 0, lose streak 0, shop unlocked, 5 shop slots;
- empty augments, augment rounds/bonuses, item bag, crafted list, enemy preview, board, bench and shop;
- all additive economy/combat progression bonuses at zero (`deployCapBonus`, `benchBonus`, interest, roll/XP deltas, starting rage/shield, team ATK/MATK/DEF/MDEF/HP, lifesteal, HP-loss reduction, rage gain, extra class/tribe count, inventory bonus, crit, fixed income, unequip discount, win-gold bonus);
- `benchUpgradeLevel=0`, `inventoryUpgradeLevel=0`, `craftTableLevel=0`, `speedLevel=0`, empty `techLevels`;
- no creative sandbox units, enemy preview round 0, enemy budget 0;
- default Fortress metadata created through the Fortress normalizer;
- tutorial not skipped and a fresh tutorial state;
- default loss condition `NO_UNITS` until a game-mode contract overrides it.

The default outer solo run uses `aiMode=TUTORIAL` and `audioEnabled=true`.

### A103.2 Owned-unit persistence is identity/state only

An owned unit serializes `uid, baseId, star, equips, variantTraits, variantSeeds`. Do not persist the full `base` catalog object. Hydration resolves `baseId` against the live catalog and rebuilds the owned unit with `rollTrait=false`, preserving authored variant traits/seeds rather than rerolling them on Continue.

Invalid catalog ids hydrate to null and are handled by the save-sanitization rules. Equipment ids remain an array of strings. Creative sandbox serialization adds `side,row,col,sandbox=true,sourceUid`; hydration preserves those fields and still does not reroll traits.

### A103.3 Board, bench and shop hydration

Canonical player board hydration always reconstructs exactly a 5×5 owned-unit grid from persisted rows/cells. Bench is a compact array of successfully hydrated owned units. Shop hydration preserves array positions but accepts only offers whose `baseId` exists in the live catalog; invalid offers become null. Shop slot count is normalized into 5..20 and must be at least the intended current shop surface described in the shop contract.

Tutorial state restores `completed,currentRound,shopVariant,preparedRounds,roundEventCounts,markers`; only positive integer prepared-round ids survive. Craft table clamps to 0..3. Player level clamps to 1..25. Fortress metadata is normalized against current round.

### A103.4 Co-op run shape

A fresh co-op run defaults to normalized `COOP_MEDIUM`, `audioEnabled=true`, empty room code, `localSlot=P1`, `hostSlot=P1`, capacity derived from AI mode, shared round 1 and one default player state for every legal co-op player slot.

Serialization/hydration derives the legal player-slot set from normalized co-op difficulty. Illegal local/host slot values fall back to a legal slot; capacity is recomputed rather than trusted from stale persisted data. The shared state keeps round and future shared fields without collapsing player-owned board/bench/economy into one global player object.

## A104. Persistence side stores — collection, achievements, settings and device preferences

These stores are independent scopes and must not be accidentally erased together.

### A104.1 Collection profile

Storage key: `forest_throne_collection_profile_v1`. Normalized profile version: **2**.

Shape:

`version, unlockedSkinIds[], claimedAchievementIds[], equippedSkinByUnitId{}`.

String lists are filtered to non-empty strings and deduplicated. Legacy skin ids containing `.lofi_` are renamed to `.loli_` both in unlocked lists and equipped mappings. Loading malformed JSON/storage failure returns a fresh empty profile. Saving always normalizes first; clearing removes only the collection-profile key.

`claimAchievementSkin(profile, achievementId, skinId)` is idempotent and may add the claim id and unlocked skin independently when each non-empty value is absent. `equipUnitSkin` writes one unit->skin mapping for a valid non-empty skin string; an empty/invalid skin request removes that unit mapping.

### A104.2 Endless achievement profile

Storage key: `forest_throne_endless_achievements_v1`. Only the A36/A34 eligible Endless solo flow mutates it. Claim state is cross-checked against `collectionProfile.claimedAchievementIds` so reopening the reward UI cannot grant the same skin twice.

### A104.3 Shared UI settings

Storage key: `forest_throne_ui_settings_v1`. Shared UI/gameplay preferences are normalized defensively; corrupt/missing storage returns defaults. Graphics-only preferences intentionally remain separate keys:

- `forest-throne.graphics-quality` -> `low|medium|high`;
- `forest-throne.render-scale` -> clamp 0.5..1;
- `forest-throne.battery-saver` -> boolean encoded as `1/0` (loader also accepts `true/false`).

Haptics use `forest-throne.haptics-enabled`, default enabled when absent. Supported vibration patterns are `buy=15ms`, `tap=10ms`, `starUpgrade=[30,20,50]`, `victory=[50,30,80]`, `defeat=[80,50,80]`. Lack of `navigator.vibrate`, disabled preference or browser/storage error must degrade silently without blocking input.

## A105. Device input, loading and render-performance constants

### A105.1 Gamepad navigation

Default direction debounce is **170 ms** and held-direction repeat is **120 ms**. Analog directional threshold is absolute **0.55**; D-pad buttons are 14 left, 15 right, 12 up, 13 down. Button actions are edge-triggered with a latch so holding a button does not repeat confirmations.

Current button map:

- index 0 confirm;
- index 1 cancel/back;
- index 2 jump focus to SHOP;
- index 3 jump focus to BOARD;
- index 4 jump focus to BENCH;
- index 5 jump focus to SHOP;
- index 8 settings toggle;
- index 9 start combat.

Blocking modal state consumes confirm/cancel as modal-close rather than gameplay confirmation. Gamepad navigation owns BOARD/SHOP/BENCH regions and must respect actual dynamic bench capacity. Shop controller coordinates five visible card positions at a time; larger shop capacity is reached through the shop pagination/slot contract rather than by inventing off-screen cursor coordinates.

### A105.2 Touch gestures

Default swipe threshold is **32 px** and a configured threshold may never be below **16 px**. Each threshold-sized movement advances one grid step along the dominant axis. Touch-end is a confirm tap only when total gesture distance is <= **18 px**; a swipe must not also fire a duplicate tap. Minimum target size is `max(48px, responsiveMinTouchTarget)`.

### A105.3 Shared tooltip pointer behavior

Mouse hover/focus may show immediately according to tooltip mode. Non-mouse pointer down starts a **420 ms** long-press timer. Pointer up/cancel clears the timer and hides the tooltip. Pointer-out hides unless the related target remains inside the same tooltip owner. Teardown removes every installed pointer/focus listener and any pending timer.

### A105.4 Loading cadence

The real loading screen records its start time and remains visible for at least **1400 ms**. Completion transition delay is:

`max(120ms, 1400ms - elapsedSinceLoadingScreenStart)`.

The bubble minigame is presentation/input entertainment during this wait and cannot fake asset progress or gate correctness independently from the loader.

### A105.5 Renderer performance bounds

Effective display pixel ratio is capped at **2** under normal presentation and at **1** on LOW quality. Render scale is clamped **0.5..1.0**, with presets `.50,.67,.75,1.0`. These settings change visual resolution only; they do not alter logical 1600×900 layout coordinates or combat semantics. Battery saver/visibility behavior may reduce presentation work but never change deterministic simulation.

## A106. Recipe diagram — complete information and interaction contract

The Recipe Library's diagram is not merely three columns of clickable recipe names. Its complete contract is:

- categories: **Offense / Defense / Magic** using the same recipe-classification predicates as Library;
- category columns show all matching recipes and may show category counts;
- each recipe node identifies icon, localized name, tier/id metadata and output;
- each node must expose the **full authored ingredient pattern**, respecting recipe grid size/order rather than showing only an arbitrary first-six icon sample;
- ingredient entries expose localized item identity/type; pointer/focus/touch inspection uses the shared tooltip system rather than a one-off native title when richer content exists;
- node shows or makes immediately inspectable the full localized stat-benefit list; `combat.noDescription`/equivalent is the fallback only when there is truly no benefit text;
- equipment ingredients with `eq_<recipeId>` semantics create dependency edges from the recipe that produces that equipment to the consuming recipe;
- selecting a node highlights it, highlights direct dependency/dependent edges and keeps connected nodes visually emphasized;
- selecting a node invokes the owning Library callback so the same recipe can open canonical recipe details;
- pointer drag pans; wheel/buttons zoom; canonical zoom range is **0.6..1.8**; Fit computes a bounded overview and resets pan near the viewport origin;
- closing/unmounting releases owned pointer/wheel input and transient graph visuals; reopening must not duplicate handlers or edges;
- the graph is browsing/inspection only: clicking a graph node never spends materials or crafts directly.

The rebuilt diagram may use a new visual composition, but must preserve the graph semantics above and match the game’s cohesive medieval forest-fantasy UI style.

## A107. Core UI behavior contracts

The following rules define the core UI behavior that the rebuilt product must preserve.

### A107.1 History/log system — recover the structured log model

Planning/Combat history uses four semantic categories plus the all-filter surface:

- categories: `COMBAT`, `SHOP`, `CRAFT`, `EVENT`;
- History filter order: `ALL`, `COMBAT`, `SHOP`, `CRAFT`, `EVENT`;
- every structured history entry can carry `id, round, phase, category, title, summary, details[], icon, tone, meta, message, previewText`;
- category inference folds Vietnamese diacritics/case and recognizes combat/shop/craft vocabulary when a caller does not provide a category;
- default history retention is **300** entries; the compact live-log preview retains **6** entries;
- compact formatting may show only the newest N preview lines, while full History keeps the structured record;
- newest History entries render first;
- unknown/malformed categories normalize to `EVENT`;
- detail payload accepts scalar/nested-array input, flattens it, trims it and drops empty lines.

Structured history entries preserve these concrete information families:

- combat action log: distinguishes basic vs skill, actor, main target, damage type, range, pattern, effect label and estimated target coverage;
- damage log: distinguishes miss, actual HP damage and shield-only absorption; can record crit, hit chance, post-hit HP/max HP and remaining shield;
- round result log: WIN/DRAW/LOSE with base gold, enemy-star bonus, extra gold, Assassin bounty, XP, hearts/damage and post-round gold;
- round income log: base income, interest, streak, fixed-income source and gold-after;
- loot log: loot label plus source-detail lines.

Full History displays `[Vòng <round>] [<category>] <icon> <title/message>`, tone-aware headers and bullet detail rows. List scroll is clamped to `0..maxScroll`; filters rebuild from the canonical History categories; empty state is localized; backdrop and close control both close the modal.

Do not collapse History into only `message/category/timestamp`. Preserve the structured information model so combat, shop, craft and event entries can expose rich details without maintaining a second log store.

### A107.2 Library — exact browse/filter/detail capability

Library remains one product surface with three top-level tabs:

1. **Units**;
2. **Recipes**;
3. **Odds**.

The unit browse state carries `searchQuery, filterClass, filterTribe, filterTier, detailUnitId, detailPreviewStar, detailPreviewSkinId, scrollY/maxScroll`. Library behavior is:

- Class filter cycles `ALL -> every CLASS_SYNERGY key -> ALL`;
- Tribe filter cycles `ALL -> every TRIBE_SYNERGY key -> ALL`;
- Tier filter cycles `ALL,1,2,3,4,5`;
- search is case-insensitive and matches localized visual name, raw unit id, localized class label or localized tribe label;
- Reset clears Class, Tribe, Tier and search together;
- filters are shown on the Units list, not while a unit detail page is open;
- filtered unit results sort by **tier ascending, then class name**;
- the unit list uses two columns when the content viewport is wider than **860 px** and one column otherwise; responsive list/detail behavior must remain readable without clipping;
- changing top-level tab resets scroll and leaves unit detail mode when switching away from Units;
- open/refresh reloads Collection Profile and Endless Achievement Profile, so skin/claim state cannot go stale while Library remains mounted;
- detail preview state can select star and skin independently from the equipped live skin;
- equipping/unequipping a Library skin mutates the Collection Profile through the canonical profile API, then refreshes the preview/profile state;
- recipe view owns the full Recipe Library panel/diagram contract from A86/A106;
- Odds is a real inspection tab, not a placeholder;
- wheel/internal scrolling clamps to the computed content extent;
- hiding/destroying Library tears down recipe diagram/panel, attack preview, skill preview and deferred first-show work so reopening cannot duplicate listeners/timers.

Use a proper in-product search field/control while preserving the search semantics above.

### A107.3 Attack preview — explainer vs canonical preview authority

The compact instructional attack-loop preview is explanatory rather than combat authority. Its 3×4 example places the attacker at row 1/column 0 and sample enemies at (0,2), (1,3), (2,2). Its simplified explanatory rule is:

- range <= 1 + Assassin -> same-row far target (1,3), label “Cột xa nhất”;
- range <= 1 + non-Assassin -> nearest sample column, top-first sample (0,2), label “Cột gần nhất”;
- ranged -> same-row target (1,3), label “Cùng hàng”.

Baseline explainer animation:

- target pulse: 800 ms, yoyo, infinite, scale 1 -> 1.2;
- melee/Assassin dash to target in 250 ms, hit, 300 ms hold, return in 250 ms, 800 ms between cycles;
- Assassin offsets to the far side of the target while ordinary melee stops on the near side;
- ranged wind-up squashes/stretches for 150 ms, projectile travels 250 ms, then waits 1000 ms;
- hit marker rises/fades over 400 ms;
- destroy stops the highlight tween and destroys the whole preview container.

Use those timings/composition only as presentation reference. **Canonical target selection and skill footprint come from the same rules used by live combat and the canonical Library preview**, so this toy 3×4 explainer must never become a second targeting algorithm.

### A107.4 Pagination contract

Pagination behavior is intentionally simple but semantically precise:

- default previous/next button size 30×26 with 8 px gap (geometry may be redesigned);
- both buttons stay visible once the pager exists;
- Previous is enabled iff `page > 0`;
- Next is enabled iff `page < maxPage`;
- callbacks are supplied by the owning surface;
- teardown destroys both controls.

Any rebuilt shop/bench/library pager must preserve the boundary semantics and must derive `maxPage` from the owning dynamic capacity instead of hardcoding a second capacity.

### A107.5 Version information surface

Version information is a real user-facing release-notes capability:

- data shape: `version, updatedAt, notes[]`;
- version comes from `APP_VERSION_TAG`;
- updated date comes from `APP_LAST_UPDATED`;
- current Planning version data exposes **12 localized note slots** `planning.version.note1..note12`;
- the modal shows version + update date and an ordered numbered note list;
- backdrop click and explicit close both dismiss it;
- opening it participates in the single-modal/blocking-input rules.

Old rectangle/button chrome is superseded. Do not delete the capability merely because the current main menu also prints a compact version/footer.

### A107.6 Recipe-library detail panel beyond the dependency diagram

In addition to A106, Recipe Library detail behavior includes:

- selected recipe detail shows icon, name, tier, category, full formatted bonus list, optional description and the crafting pattern;
- detail content is independently clipped/scrolled and resets scroll to zero when selecting another recipe;
- grid size defaults to 2 only when recipe data omits it; authored 3×3 patterns remain 3×3;
- ingredient slots preserve exact row-major pattern position, including empty cells;
- unique ingredient legend reports each material/equipment identity and multiplicity;
- an equipment ingredient whose id maps to another recipe is clickable/navigable to that prerequisite recipe and switches active category as needed;
- recipe category fallback scoring uses offense/defense/magic bonus signals when explicit category metadata is absent;
- the output item is rendered separately from ingredient slots;
- browsing never mutates inventory or spends materials.

Use canonical item icons, localized names/tooltips and the same cohesive medieval forest-fantasy visual language as the rest of the product.

## A108. Tutorial completion, target resolution and guidance behavior

Tutorial is a state machine plus a spatial gate system. Rebuilding only the eight-round script text from A94 is insufficient.

### A108.1 Completion-rule engine

The reusable completion-rule kinds are:

- `boardUnitsAtLeast(count)`;
- `benchUnitsAtLeast(count)`;
- `totalOwnedUnitsAtLeast(count)`;
- `eventAtLeast(key,count=1)`;
- `itemInBag(itemId,count=1)`;
- `unitHasEquip(itemId)` across board or bench;
- `craftSlotMatches(slotIndex,itemId)`;
- `settingsVisible(value=true)`;
- `historyVisible(value=true)`;
- `tutorialCompleted`;
- `markerEquals(key,value)`;
- `markerTruthy(key)`;
- custom predicate callback.

Dismiss steps persist marker `dismissed:<stepId>`. Before showing a step, the overlay repeatedly skips any step already satisfied. Compatibility fallbacks also consider these ids complete from world state: `buy_unit`, `deploy_first_unit`, `buy_more`, `deploy_second_unit`, `round2_buy_unit`, `round2_deploy_unit`, `round2_buy_unit_second`, `round2_deploy_unit_second`.

Progress inspection derives board count, bench count, total owned count, item bag, craft-grid items, augment count, current round, tutorial markers/event counts and settings/history visibility. Never advance solely because the user clicked the highlighted area if the step’s completion rule says the world state has not reached the required condition.

### A108.2 Target vocabulary and deterministic placement

Tutorial target resolution supports, at minimum:

- arbitrary named screen anchors;
- exact shop card and first available shop card;
- exact bench slot, first occupied bench slot, any occupied bench slot;
- synergy panel;
- buttons, settings controls and stat chips by key;
- exact board cell;
- first/any occupied board cell, any equipped unit, any empty board cell;
- recommended deploy cell;
- suggested reposition cell;
- first occupied inventory cell or a specific inventory item;
- craft slot / craft output;
- sell / unequip actions;
- History close;
- generic `any`.

Default target radius is **24 px** and screen padding is **16 px**.

Deploy recommendation ordering is semantic tutorial guidance:

- frontline preference: (2,4), (1,4), (3,4), (2,3), (0,4), (4,4), (1,3), (3,3), (2,2);
- backline preference: (2,1), (1,1), (3,1), (2,0), (0,1), (4,1), (1,0), (3,0), (2,2).

Target matching uses role-specific context when a tutorial action carries multiple references. `allowedTargets[]` are resolved separately from the primary target; when `layoutFocus === "allowedTargets"`, their merged bounding box becomes the text-layout focus.

Automatic text-box placement evaluates above/below/left/right space, biases away from screen edges and clamps the final box inside the viewport. Legacy arrow mapping remains: down -> box above, up -> below, left -> right, right -> left, none -> center.

### A108.3 Overlay rendering and interaction

Shared constants:

- text-box padding **16 px**;
- max text-box width **380 px**;
- arrow bounce amplitude **12 px**;
- guidance-arrow bounce period is approximately **600 ms**;
- blocked-action hint lifetime **1300 ms**;
- step text may use browser speech when that capability is available.

**All allowed anchors must be visibly indicated in addition to the primary target.** For multi-target tutorial steps, show every legal interaction region while keeping the primary spotlight/arrow distinguishable.

Dismiss steps alone make the full-screen overlay click target consume dismissal input. Action steps keep the overlay visual-only and allow the actual target control to receive pointer/touch input. Skip calls the canonical tutorial-skip flow when available, persists state through that flow, and otherwise only ends the overlay. Teardown must cancel step delay, blocked-hint timer and animation frame/tween and remove overlay/listeners exactly once.

## A109. Library deep-detail — skins, achievements, star review and battle preview

Library is a full inspection surface rather than only a tab/filter shell. Its product contract includes the following detailed behavior.

### A109.1 Star-preview state is independent from owned/live state

- Library can inspect **1★, 2★ and 3★** even when the player does not currently own that star level.
- Preview star is clamped to `1..3`.
- Stat preview uses the canonical star scale: **1.0 / 1.6 / 2.5**.
- Skill resolution must be performed for the selected preview star, including authored per-star detail text and target/shape/duration clarity fields.
- Skin appearance is also resolved at the selected preview star. A skin is therefore not a single icon; it may expose different appearance/name/visual data at 1★/2★/3★.
- Changing preview star or preview skin is inspection state only until the user invokes the explicit equip action.

### A109.2 Skin list and reward-priority semantics

Achievement-linked skin entries are ranked as:

1. **claimable** reward;
2. locked but **near completion**;
3. already **unlocked**;
4. other locked skins.

Tie-breakers are progress ratio descending, authored `sortOrder` ascending, then source order.

A skin is:

- free/unlocked when its unlock type is `free` or its `skinId` exists in Collection Profile `unlockedSkinIds`;
- claimable when it references an `achievementId`, that achievement is currently unlocked, and the Collection Profile has not yet recorded that achievement in `claimedAchievementIds`;
- near-complete when it has an achievement entry with progress but is neither claimable nor unlocked.

Each skin row displays one of: claimable, equipped, unlocked, numeric progress percent, or locked. Preserve this richer reward-state visibility so a user can understand why a skin is locked and which reward is ready or near completion. Reward claiming remains one canonical collection/achievement transaction; Library must not create a second unlock store.

The default skin is a first-class row. Selecting default previews it. If a non-default skin is equipped, the default row offers the explicit “restore default” action. Selecting a locked skin may preview its authored appearance for inspection, but must never silently grant/equip it.

### A109.3 Three-star skin review panel

The selected skin includes a **three-card star review**:

- exactly one card for each star 1/2/3;
- each resolves `skin.getAppearance(star, locale)` when available, then falls back to the unit visual for that star;
- active card corresponds to the current preview star;
- selecting a card changes preview star only;
- card shows star, resolved display name/icon/model and selected-state hint;
- the central preview simultaneously shows skin state + selected star + resolved skill label.

This behavior must remain, while its visual composition may be redesigned to match the same unit model/portrait language used by cards and battle preview.

### A109.4 Browser-speech accessibility

Unit detail exposes a skill-voice control when browser speech synthesis is available. It:

- sanitized visual/markup text before speaking;
- resolved language from the active locale;
- did not render an unusable voice button if speech synthesis was unavailable.

Preserve browser-speech accessibility in the rebuilt Library detail view when the browser supports it.

### A109.5 Library battle preview authority and lifecycle

The canonical Library battle preview behaves as follows:

- field is **5 rows × 10 logical combat columns**;
- plan comes from `resolveLibraryPreviewPlan`;
- it renders allied/enemy actors using real unit model snapshots and current skin state;
- Attack and Skill are separate preview modes, with a third **Actions** panel for authored unit action/animation preview;
- the battle preview resolves visual mode from the canonical basic-attack/skill definition: beam, projectile or dash;
- current loop cycle is **1900 ms**; attacker anticipates for **280 ms**, launch begins after **240 ms**;
- projectile travel is **360 ms** with an arc, beam is **260 ms**, dash is **620 ms**;
- impact presentation is **420 ms + 20 ms per indexed affected cell**;
- attack impact uses only the canonical primary target; skill impact uses canonical skill cells/preview cells;
- mount/dispose must clear interval + every transient timeout and remove all temporary nodes, so reopening Library cannot leak animation loops.

The visual treatment of field cells, beams and projectiles may be redesigned, but it must preserve the same semantic states and remain visually consistent with the game world.

### A109.6 Data-first SkillPreview fallback policy

Skill-preview data is resolved from the skill’s authored functional preview when available, otherwise from its authored star-specific/static preview cells. If neither exists, show a missing-preview state/warning instead of inventing a footprint.

Use the **canonical 5×10 combat preview plan** for live Library visualization. Never add a generic guessed AoE shape when the skill data cannot resolve one.

### A109.7 Odds tab

Odds is a complete table for player levels **1 through 25**:

- columns: Level, T1, T2, T3, T4, T5;
- every value comes directly from canonical `ShopSystem.getTierOdds(level)`;
- probabilities display as percentages;
- current player level is visibly identified;
- no duplicated odds table may be hardcoded into the UI.

## A110. Settings and shortcut behavior

Settings is one canonical modal surface with the interaction contract below.

### A110.1 Canonical settings groups

The rebuilt Settings modal keeps the current tab model:

- **Âm thanh / Audio**
- **Hiển thị / Display**
- **Lối chơi / Gameplay**
- **Phím tắt / Shortcuts**
- **Thiết bị / Device**
- **Dữ liệu / Data**

The older four-group product wording remains the minimum user-facing mental model; current Device/Data groups are intentional extensions.

### A110.2 Audio, display and gameplay controls

Preserve one canonical persisted `UiSettings` object for portable settings:

- audio enabled/muted state;
- volume integer **1..10**;
- language from the available locale list;
- resolution preset;
- tooltip mode, including compatibility migration from legacy `expandedTooltip`;
- subtitle and other canonical gameplay preferences;
- keyboard binding maps.

Three/render-only settings stay in their dedicated storage keys from A104/A105:

- graphics quality;
- render scale **0.5..1.0**;
- battery saver;
- haptics enabled.

Changing a setting updates the visible label/control immediately and updates the canonical setting owner. Do not create a second temporary settings truth that can drift from persisted `UiSettings`.

### A110.3 Shortcut contexts and capture flow

Shortcut behavior must include:

- context-sensitive action sets for at least Menu, Planning and Combat;
- each row shows localized action label plus formatted current binding;
- clicking a binding enters a visible **listening** state for that specific action;
- keyboard input is normalized into the canonical binding representation;
- reserved keys are rejected with visible feedback and do not overwrite the previous binding;
- successful capture persists via `setKeyboardBinding` and refreshes every affected help/row label;
- **Reset shortcuts** resets only the active binding context through the canonical reset API;
- Back/close cancels any listening state and removes temporary listeners;
- shortcut help text is generated from the same current binding map; never hardcode `[WASD]`, `[E]`, etc. separately from the binding service.

The canonical default keymap is:

- Planning: `startCombat=SPACE`, `rerollShop=D`, `buyXp=F`, `sellUnit=E`, `newRun=R`, `settings=ESCAPE`, `toggleAudio=M`;
- Combat: `stepCombat=SPACE`, `settings=ESCAPE`, `toggleAudio=M`;
- Menu: `close=ESCAPE`.

Do not restore the obsolete Planning mapping where Sell used `S` and reroll/buy-XP had no bindings.

Normalized user-bindable keys are one alphanumeric character or the named set `SPACE`, `DELETE`, `BACKSPACE`, `ENTER`, `TAB`, `ESCAPE`. `ESCAPE` is reserved and cannot be rebound through normal capture.

The shortcut list must have enough scroll/viewport space for every binding and preserve exclusive modal input ownership while open.

### A110.4 Stepper semantics

A three-part **decrement / current value / increment** control may use baseline minimum widths of **56 px** for side actions and **180 px** for the value region. The semantic rule is:

- decrement and increment are distinct accessible targets;
- center value is read-only unless the current modern control intentionally uses a select/range input;
- controls clamp/cycle through the canonical allowed values;
- disabled/end-state feedback comes from actual bounds.

A select/range control may replace the three-part stepper where it improves accessibility, provided the same value bounds/cycling semantics remain.

### A110.5 Clear/reset data confirmation

Any destructive run-data clear/reset action requires deliberate confirmation and must not fire from the first accidental click/tap. A second-step confirmation or stronger dedicated confirmation modal is acceptable; one-click deletion is not.

If confirmation is implemented as a temporary second-click state, it automatically reverts after **3000 ms**. A dedicated confirmation modal may replace this timeout as long as accidental single-action deletion remains impossible.

### A110.6 Visual consistency

Settings must use the same medieval forest-fantasy visual language, typography hierarchy, control states and responsive spacing as the rest of the product. Functional settings behavior above is independent from the chosen implementation technique.

## A111. Tech Tree — canonical graph, camera focus, research and info-panel contract

The Tech Tree uses one canonical graph/research model and preserves the interaction behavior below.

### A111.1 Source of truth

Use a single canonical tech definition for topology, prerequisites, nodes, costs, maximum purchase levels and effects. Use one deterministic graph-layout model for positions, sectors, collision relaxation and content bounds. Every research purchase goes through one canonical validation/mutation transaction. UI controls must never invent their own prerequisite or cost logic.

### A111.2 Radial graph layout

The shared layout:

- centers `root`;
- assigns each `TECH_BRANCH_ORDER` branch a radial sector;
- weights child angular space by leaf count;
- radius is derived from graph depth;
- records **all parent requirement ids**, even when one parent is chosen as the visual layout parent;
- relaxes overlaps while constraining a node to its branch sector;
- enforces minimum parent/child spacing;
- computes content bounds from final node positions;
- draws an edge for every requirement relation, not merely the chosen layout-parent edge.

Production node placement comes from the deterministic layout model; do not maintain a second set of arbitrary hand-positioned nodes.

### A111.3 Opening focus vs Fit

Tech Tree selection must not zoom the whole tree out on every click. Use these focus rules:

- storage key: `forest-throne:planning:last-tech-focus`;
- on open, prefer stored focus if it is still focusable;
- otherwise prefer the most recently researched valid id, then latest unlocked node, then root;
- default selected-node focus zoom is **1.08**;
- selected-node focus clamps zoom to **0.7..1.35**;
- selecting a node preserves current pan/zoom and writes focus only if the node is focusable;
- **Fit** is an explicit user action and fits the whole graph at 94% viewport scale, clamped **0.35..1.25**;
- wheel zoom is pointer-centered and clamps **0.35..1.8**;
- pointer drag pans without changing selection;
- resize preserves current transform after the tree has been initially focused/fitted;
- Escape closes; the current keyboard Fit shortcut must continue to call the same Fit function.

### A111.4 Node state

Every node distinguishes:

- root;
- purchased/current level;
- maxed;
- unlocked and affordable;
- unlocked but unaffordable;
- locked by prerequisite.

Level display is `level/maxBuy` with infinity support; root has its own label. Edge state reflects parent/child progression. Locked nodes may be inspected but never researched.

Do **not** restore the old extra decorative lock spam. Lock state is communicated through node/edge/info state and the asset-first lock treatment where useful.

### A111.5 Info panel and research

Selecting a node shows:

- icon/name;
- branch;
- localized description;
- current/max level;
- every prerequisite and whether each prerequisite is met;
- next purchase cost;
- formatted canonical effect(s);
- research button state.

Research is enabled only when the canonical prerequisite, affordability and maximum-level checks all permit it. After a successful purchase:

- gold/techLevels mutate once through the canonical research service;
- Planning state/UI/log refresh;
- node remains selected/focused;
- maxed state replaces purchase affordance.

The old info-panel fixed dimensions/colors are presentation evidence only.

## A112. Visual feedback and animation semantics

The following visual-feedback rules are part of the product contract. Their implementation may be rebuilt freely as long as timing, triggers and gameplay meaning stay clear.

### A112.1 Damage hit jolt

A hit jolt occurs only on **actual HP damage > 0**. Its baseline behavior is:

- direction is away from attacker `fromX`;
- displacement: **5 px**;
- one leg duration: **65 ms**, yoyo;
- previous in-flight jolt is removed and original X is restored before starting the next;
- combat speed scaling applies to duration.

Do **not** invent a mandatory permanent low-HP glow. Low-HP presentation may exist only where explicitly defined; the hit jolt itself is tied to real HP damage.

### A112.2 Star-strength visual communication

A previous visual language represented higher stars with visible follower bodies using these semantics:

- 1★: one visible body;
- 2★: two bodies while HP ratio > 2/3, otherwise one;
- 3★: three bodies while HP > 2/3, two while HP > 1/3, otherwise one;
- dead/non-alive: zero;
- outside combat, visible body count follows star count.

Follower transforms mirror the primary visual’s position/scale/alpha/facing and are re-laid out as visible count changes.

The rebuild does not have to clone literal duplicate bodies. Each bespoke creature may express star evolution through authored geometry, accessories or effects, but higher stars must read as more imposing and the chosen HP/star communication must remain intentional and consistent rather than disappearing accidentally.

### A112.3 Facing and death-pose safety

Animations preserve left/right facing so scale/tween changes cannot accidentally flip combat side. Death pose stabilization runs after a speed-scaled delay with **360 ms** as the baseline and freezes surviving visual layers into a deterministic end pose.

The rebuilt 3D presentation must preserve these invariants:

- side/facing remains stable across idle/attack/hit tweens;
- death animation owns final pose/removal timing;
- follower/accessory layers cannot lag at the corpse’s previous position;
- actual dead-unit board cleanup still follows canonical combat state, not a visual timeout.

### A112.4 Shared skill-cast presentation

Shared skill-cast presentation derives its theme from skill plus attacker/tribe semantics, then may compose cast cue, target pulse, camera shake and particles. Baseline timing is roughly **130 ms cast-in**, **240 ms cast-out**, delayed fade after **430 ms**, and cleanup around **1200 ms**, all passed through combat-duration scaling.

Preserve the notion of a readable cast cue and target-impact cue, but translate particles/rings/shake into the current Three VFX pool/quality system. Unit-owned bespoke skill presentation may override shared accents.

### A112.5 Shared star-decoration ownership

Star-evolution presentation follows this ownership rule:

- clamp star to 1..3;
- resolve appearance/skin + unit star visual identity;
- if a bespoke unit/skin appearance already handles star evolution, shared generic star decoration is **skipped**;
- shared decoration is removed before replacement, so refresh cannot stack duplicate layers;
- a handle is stored and destroyed deterministically.

Carry that rule forward: a bespoke unit rig or skin that owns its star evolution must not also receive a generic duplicate crown/aura stack.

### A112.6 Visual completeness and appearance resolution

Appearance resolution follows one deterministic order: canonical unit identity -> owned/equipped skin -> star-specific appearance -> optional shared star decoration only when the bespoke appearance does not already own that evolution.

For the production rebuild:

- preserve this **appearance/skin resolution ordering**;
- keep visual lifetime/refresh deterministic so repeated previews do not stack duplicate layers;
- **remove emoji as a whole-unit production fallback**;
- give every one of the **125 canonical identities** its own deliberate bespoke 3D creature presentation;
- if an identity has no finished visual, fail the visual completeness gate instead of silently substituting a generic animal or emoji.

## A113. Save envelope, import/export, migration and clear-data contract

Persistence is a versioned product boundary. Save/load/import/export behavior must remain explicit, defensive and compatible with the run/progression state defined below.

### A113.1 Canonical save envelope

Canonical save storage uses key `forest_throne_progress_v1` and envelope version **4**. The envelope contains:

- `version`;
- `savedAt`;
- serialized run `payload`;
- normalized Endless achievement profile;
- normalized collection profile.

Run serialization contains gameplay/progression data only. Never persist live rendering objects, screen instances, audio handles, timers or in-progress animation objects.

`saveProgress(payload)` must fail softly and return a boolean. `loadProgress()` must parse, migrate, validate and return the payload or `null`; malformed JSON and invalid payloads must not crash boot.

### A113.2 Import/export

Portable JSON save behavior includes:

- export to a JSON string;
- browser download with default filename `forest-throne-progress.json`;
- import from a string;
- import from a File/Blob;
- optional persistence of a successfully imported run;
- imported achievement and collection profiles are restored only when present in the imported envelope.

Planning import hydrates the imported payload before applying it. Invalid imports produce an explicit failed-import path and must leave the active run intact. Applying a valid imported run must refresh:

- run/player state;
- audio enabled state;
- active AI mode;
- lose condition;
- persisted UI settings;
- settings panel;
- layout/board geometry;
- bench hit areas;
- current Planning UI.

### A113.3 Migration and invalid-unit cleanup

Migration is ordered by save version and remains explicit:

- version 1 -> 2: preserve level while clamping to current 1..25 range;
- version 2 -> 3: stop applying the former archived-roster cleanup policy;
- version 3 -> 4: preserve former archived roster ids when they are again present in the live catalog;
- sanitize board, bench and shop unit references after version migration;
- unknown board units become `null`;
- unknown bench units are removed;
- unknown shop offers become `null`;
- a replacement map may redirect retired ids when a valid replacement exists;
- level >= 1, round >= 1, HP >= 0, gold >= 0;
- absurd `deployCapBonus` values outside 0..100 reset to 0 with migration evidence.

Legacy speed statuses are migration-only compatibility data:

- `slowTurns` becomes an evasion-debuff duration with **15%** penalty;
- `hasteTurns` becomes an evasion-buff duration with **10%** bonus;
- old keys are deleted after migration.

When importing the old slow field, normalize it into the canonical evasion-**debuff** value. Do not preserve a compatibility typo that would place slow into a positive evasion-buff field.

### A113.4 Clear operations are intentionally different

Do not collapse these actions:

- **clear run** removes only the active run save;
- **clear progress** removes run + Endless achievement profile + collection profile;
- **clear all local storage** clears every local key and is reserved for the explicit destructive reset flow.

The corrupt-save recovery action from A98 uses run-only clearing unless the user explicitly chose a broader reset.


## A114. Run-state schema and Planning hydration contract

The rebuilt game treats run state as an explicit schema with defensive hydration. The fields below survive screen changes and save/resume.

### A114.1 Owned units

Persist an owned unit by identity/state:

- `uid`;
- `baseId`;
- star, clamped to 1..3;
- equipment ids;
- skill variant where supported;
- variant-trait ids/seeds.

Resolve `base` from the live catalog during hydration. Do not serialize the catalog object itself as authority. Invalid catalog ids are rejected by normalization.

Equipment normalization must still enforce the canonical item, star-slot and tier rules. Hydration must never become a path that bypasses equip legality.

### A114.2 Solo player state

Hydration must preserve/normalize at least:

- board and bench;
- Creative sandbox units;
- shop and shop-lock state;
- level, XP, round, HP, gold;
- win/lose streaks;
- deploy, bench and inventory bonuses;
- interest cap/rate and win-gold modifiers;
- XP/roll cost deltas;
- starting rage/shield;
- team ATK/MATK/DEF/MDEF/HP/crit bonuses;
- lifesteal, HP-loss reduction and rage-gain modifiers;
- extra class/tribe counts;
- augment bonuses/state;
- craft table level;
- tech levels;
- unequip discount and fixed income;
- item bag and crafted items;
- enemy preview, preview round and enemy budget;
- tutorial state/skipped flag;
- game mode and lose condition;
- Fortress metadata.

Level remains 1..25. Craft-table level remains 0..3. Enemy-preview entries must be catalog-valid before use.

Bench-upgrade hydration follows the canonical rule from A101/A7: base 8, +6 per upgrade level, four authored purchases, normal hard cap 44, plus explicit bonus, with Creative reserved-slot handling. Never clamp valid progression to only 0..1.

### A114.3 Co-op state

Co-op serialization additionally carries:

- room code;
- local slot;
- host slot;
- co-op difficulty;
- shared round/phase state;
- shared enemy preview;
- per-slot player states.

When restoring a co-op run, resolve the local player from the current local slot and update the live co-op session mirror. A restored run must rebuild layout, bench zones, board origin and board geometry so stale hit areas cannot survive Continue/import.

### A114.4 Persistence routing by mode

`persistPlanningProgress()` has three distinct paths:

- PvP room: synchronize authoritative PvP session state; do not write an independent solo save;
- co-op: synchronize session state and write the active co-op save slot;
- solo: write the normal run save only when persistence is enabled.

This routing is part of the state-authority contract.


## A115. Loading and lazy-scene routing contract

Loading/routing must preserve the user-visible reliability semantics below.

### A115.1 Boot loading

The loader UI is installed before boot assets are queued so the user sees an active loading surface before network/disk work begins. Loader events drive:

- normalized progress 0..1;
- percent copy;
- current file type/key detail;
- explicit load-error detail;
- complete state.

Loading has a baseline minimum presentation of **1400 ms** and at least **120 ms** between completion scheduling and menu transition. The rebuild may tune presentation later, but it must avoid a one-frame flash and the minigame must never fake real loading progress.

If all shared assets are already ready, the loader still enters the completed state and transitions normally.

Shutdown/destroy removes the loading minigame and its owned input/timers.

### A115.2 Lazy route ownership

Lazy-load route families include:

- Planning;
- Combat;
- Fortress Map;
- Co-op Lobby.

Lazy route behavior:

- starts an already-registered scene directly;
- otherwise routes through one loader scene;
- caches one import Promise per scene key;
- deletes a failed Promise from cache so a later retry is possible;
- supports prewarm that resolves to `null` instead of throwing;
- preserves target scene data across lazy loading;
- rejects unsupported lazy keys.

On lazy-load failure, show a visible failure state and provide a path back to Main Menu. Do not strand the app on a blank view.

These concurrency, retry, cancellation and error semantics are part of the product behavior.


## A116. Main-menu start/continue routing contract

A98 defines the product surface. This section fixes the exact New Game and Continue route semantics so menu routing is not left to interpretation.

### A116.1 New run

Before starting:

- normalize selected mode against the temporary availability policy;
- resolve AI/difficulty through the selected mode's allowed AI modes;
- persist per-mode difficulty selection;
- derive route through the canonical new-game router.

After the availability gate accepts the mode, route by the mode contract:

- enabled solo mode -> clear only the prior run and enter Planning with `forceNewRun`;
- enabled Fortress mode -> clear only the prior run and enter Fortress Map with `forceNewRun`;
- enabled co-op/PvP Fortress mode -> enter Co-op Lobby with selected mode, AI mode and required player capacity.

Under the current production menu policy, only Endless Classic passes this gate, so its New Game route is solo Planning. The other routes remain conditional contracts for a build/session that explicitly enables those modes. A locked mode cannot create a run even if stale UI or saved selection still contains its id.

### A116.2 Continue

Continue is actionable only when the saved run is valid and its mode passes the current availability gate. A valid save for a gated mode remains untouched while Continue is disabled and marked temporarily unavailable. When the mode is enabled, Continue hydrates the stored run again if no cached valid run exists. Missing/invalid state leaves the user on menu and refreshes Continue availability; corruption follows A57.3 recovery and is not treated as a fresh run.

The restored run owns its game mode and AI selection. Stored audio-enabled state immediately controls both the visible setting and actual audio playback.

Fortress Continue has a split route:

- pending Fortress node/service/battle -> Planning;
- no pending node -> Fortress Map.

When co-op is explicitly enabled, Continue restores through the co-op lobby/session route first so room identity, local slot, host ownership and the live session mirror can be re-established before the run returns to Planning. Other supported solo runs return to Planning. PvP session state is restored through its authoritative room/session flow rather than as an independent solo save.

### A116.3 Modal/lazy ownership

Library and Settings are lazily loaded and each load has a cached in-flight Promise. Rebuilding/resizing the menu must not duplicate input listeners or modal instances. Language selection refreshes all visible localized menu copy in place.


## A117. Fortress map and service-node contract

Fortress is a persistent run graph, not a decorative mode-selection screen.

### A117.1 Run entry

On Fortress entry:

- hydrate the supplied restored state or normal run save;
- if `forceNewRun`, no valid state exists, or the restored run belongs to another mode, clear the old run and create a fresh Fortress run;
- fresh state derives starting HP/gold/lose condition/AI from mode configuration;
- ensure a deterministic Fortress graph exists for the current round;
- persist before presenting the map.

If a pending Fortress node already exists, skip map selection and resume Planning immediately so the pending node cannot be selected twice.

### A117.2 Node selection

`selectFortressNode` is the authority that mutates graph progress. After selection, persist before opening the service/battle flow.

Node types include:

- battle;
- elite;
- boss;
- shop;
- pharmacy;
- beast den;
- blacksmith.

Battle/shop/elite/boss continue into Planning with the pending-node payload. Service nodes may resolve a choice first, persist the result into `pendingNodePayload.serviceResult`, then continue to Planning.

### A117.3 Pharmacy

Pharmacy choices may grant HP, XP and/or gold:

Let:

`base = 10 + max(0, floor((round-1)/2)) * 3 + max(0, actIndex-1) * 4`.

The authored choices are exactly:

- `restore / heal`: `hpDelta = base + 16`;
- `stimulant / heal_xp`: `hpDelta = base + 8`, `xpDelta = max(2, 2 + floor((round-1)/4) + floor((actIndex-1)/2))`;
- `supplies / heal_gold`: `hpDelta = base + 4`, `goldDelta = max(2, 2 + floor((round-1)/5) + floor((actIndex-1)/2))`.

Their ids/kinds remain stable data semantics even if the rebuilt UI renames/recomposes the cards. Do not replace these with arbitrary percentages or a new random reward table.

- HP is floored to a non-negative integer and capped by configured starting/max HP;
- gold gain is non-negative;
- XP flows through the normal level-up curve and can gain multiple levels, stopping at level 25;
- result metadata records option id plus HP/gold/XP/levels gained.

Skip continues without applying a reward.

### A117.4 Beast den

Beast Den offer generation is round/act aware. Compute:

`maxTier = min(5, max(1, 1 + floor((round-1)/4) + floor((actIndex-1)/2)))`.

The candidate pool is every catalog unit whose tier is `<= maxTier`; sample up to **3 unique unit ids** using the Fortress run's deterministic/injectable RNG. Recruit options are those catalog unit ids. Selecting one:

- validates the unit against the catalog;
- requires bench capacity;
- creates a normal 1-star owned unit;
- appends it to bench;
- records result metadata;
- persists and continues to Planning.

Fortress services use the same canonical bench-cap rule as Planning: base **8**, +6 per authored upgrade level, explicit bonuses, normal hard cap **44**, with Creative reserved-slot handling where applicable. Do not use an obsolete 8/14-only capacity model.

### A117.5 Blacksmith

Blacksmith exposes authored forge tier and records the selected service result before entering Planning. The actual forge/shop/crafting semantics must use canonical inventory/equipment services rather than mutate a duplicate Fortress-only item model.


## A118. Co-op lobby handshake, save selection and launch contract

The legacy lobby contains significant networking/product behavior that must not be reduced to a room-code textbox.

### A118.1 Session reset and supported capacity

Entering the lobby clears any stale active co-op session. The requested capacity is normalized to 2..4; production flows presently use supported 2-player or 4-player capacities according to selected game mode/AI mode.

Lobby state tracks:

- host/guest role;
- local player id and slot;
- host slot;
- selected invite slot;
- room/signal state;
- connected players;
- per-player ready state;
- selected mode and AI mode;
- pending lobby action to suppress duplicate create/join/ready requests;
- whether Planning launch has already been requested.

### A118.2 Save selection

Co-op has a distinct save-slot system:

- New run;
- Auto;
- Save 1;
- Save 2;
- Save 3.

Selecting an occupied save resolves resume state + summary + active slot id + save mode. Host-side resume state is remapped so the current host/local slot owns P1 authority when required.

Room state propagates save slot id, `new`/ `resume` mode and resume summary. Guests do not invent a conflicting local run after joining.

### A118.3 Direct peer offer/answer flow

The P2P flow uses an offer/answer signal:

- host creates room if needed, then creates an offer for the selected P2/P3/P4 slot;
- guest pastes/accepts an offer and produces an answer;
- host applies the answer for that invite slot;
- active offer/answer text can be copied;
- clipboard failure falls back to a manual-copy prompt;
- a local signal relay may auto-apply offer/answer data across local app surfaces.

The rebuilt UX may replace manual copy/paste when a better transport exists, but it must preserve the state machine: offer target slot, answer ownership, connection establishment, duplicate-action guards and explicit error state.

### A118.4 Authoritative room state and readiness

Host room state is authoritative for:

- players/slots;
- capacity;
- selected mode/AI;
- ready flags;
- save/resume metadata.

Disconnect removes the player and clears stale signal state for that slot. Guests losing the host return to disconnected lobby state.

Planning launch is allowed exactly once when:

- connected player count reaches required capacity;
- every active player is ready.

At launch create the co-op session mirror with local slot, host slot, ready-by-slot, room players, session type and save metadata. Resume launches Planning with restored state; New launches Planning with `forceNewRun`.

### A118.5 Teardown

Leaving the lobby:

- cancels the launch latch;
- closes peer client/relay;
- clears co-op session;
- returns to Main Menu with start panel context.

Shutdown unregisters keyboard and transport subscriptions and closes remaining network objects.


## A119. Combat action movement, visual synchronization and skill dispatch

Canonical combat math/state remains authoritative. Preserve the action ordering and effect-routing behavior below in the rebuilt presentation.

### A119.1 Action pattern

Resolve basic action pattern from the canonical basic-attack profile:

- non-melee delivery -> `RANGED_STATIC`;
- melee Assassin -> `ASSASSIN_BACK`;
- other melee -> `MELEE_FRONT`;
- skills may explicitly use `SELF` or another authored action pattern.

For melee:

- normal melee moves to the cell immediately in front of the target;
- Assassin moves to the cell immediately behind the target;
- clamp destination into board columns;
- if the target is on the front line, use the river/front seam midpoint so melee does not overlap invalid board space;
- impact/effect happens at destination;
- then the actor returns to its home cell.

Baseline melee staging is **140 ms out**, **35 ms pre-impact**, **45 ms post-impact**, **140 ms return**. Durations are speed-scaled presentation values; **state damage still occurs only after the attack reaches its impact point**.

### A119.2 Basic attack ordering

For a basic attack:

1. resolve the basic attack profile and expected visual mode;
2. calculate raw damage from canonical ATK/MATK + canonical basic roll;
3. consume active berserk-next-basic multiplier only after positive applied damage;
4. prefer unit-owned attack animation when its declared visual mode is compatible;
5. otherwise use the semantic contact/projectile/beam fallback;
6. await visual impact;
7. resolve canonical damage;
8. apply post-hit statuses/lifesteal hooks;
9. return movement actor to home position.

Fallback visuals are compatibility presentation only. Production rebuild units should use unit-owned rigs/animations under A84/A112.

### A119.3 Skill targeting and dispatch

A skill cast:

- resolves the skill for the current star/variant;
- resolves primary target through canonical skill-targeting rules;
- resolves all visual target units separately from the primary gameplay target;
- computes a visual plan before animation;
- chooses unit-owned skill animation only when compatible with that unit's attack style;
- uses explicit skill action pattern when authored, otherwise inferred basic pattern;
- executes canonical skill effect at the movement impact point;
- supports effects whose animation must wait for effect-produced data, e.g. chromatic dart chain;
- records status changes for tooltip/history surfaces after effect application.

Effect dispatch order is:

1. shared common effects;
2. shared offensive effects;
3. shared support effects;
4. explicitly allowed custom skill logic;
5. caller-provided unhandled-effect adapter;
6. final canonical direct-damage fallback.

This ordering prevents two handlers from applying the same skill twice.


## A120. Combat damage aftermath, status-turn and auto-cast contract

### A120.1 Rage and reactive effects

After positive damage:

- attacker gains rage when the action allows rage;
- defender gains rage when the action allows rage;
- rage is capped at that unit's rage max;
- Tanker/Support auto-cast checks occur after damage state is known;
- Support auto-cast is triggered from qualifying basic-hit aftermath; Tanker reacts as the damaged unit.

### A120.2 On-hit modifiers

Combine unit mods and environment mods for:

- burn on hit;
- poison on hit;
- lifesteal.

Burn/poison refresh to at least two turns and preserve the stronger active damage value. Berserk lifesteal contributes while berserk is active.

### A120.3 Reflect, counter and debuff-on-reflect

General reflect:

- reflects a percentage of actual remaining damage;
- uses true damage;
- forces hit;
- disables recursive reflect.

Physical reflect applies only to physical incoming damage and uses its own active-turn/value fields.

If a defender's reflect state also carries an on-hit offense debuff, apply that debuff to the surviving attacker after positive damage using canonical `offenseDebuffValue/Turns/Mode` semantics.

Counterattack occurs only when both units survive, the attacker is melee-range and defender has active counter turns.

### A120.4 Death, low HP and Phoenix revive

When HP reaches zero:

- Phoenix revive, if armed and unused, resolves before death;
- revive HP is clamped to 1..100% of max with default **30%**;
- shield resets to zero;
- revive flag is consumed and one-use flag is set.

Otherwise death owns:

- alive=false;
- HP=0;
- shield=0;
- death palette/animation;
- low-HP accent cleanup;
- star/body-count visual synchronization;
- stable final death pose;
- later board-state cleanup/removal through canonical combat state.

Low-HP presentation threshold is **<=30%**. A112 still forbids inventing a permanent generic glow: a bespoke unit may respond through its own authored low-HP animation.

### A120.5 Berserk kill chain

For qualifying berserk basic attacks that kill:

- optional rage-on-kill;
- optional berserk-turn extension;
- ATK-buff duration is extended to at least the new berserk duration;
- optional chained basic attack selects the nearest living enemy by Manhattan distance;
- the chained action reuses the normal basic-attack pipeline.

### A120.6 Start-of-turn statuses

Start-of-turn processing:

- delegates status ticking to canonical `CombatSystem`;
- DOT uses true damage and cannot grant rage or reflect;
- HOT heals only living units;
- disease can spread to orthogonally adjacent living allies/enemies on the same side depending on infected unit side, but does not overwrite an already infected neighbor;
- disease spread duration is **2 turns** with the propagated damage value;
- environment poison aura applies as true DOT after normal status ticks;
- death from DOT skips the turn;
- freeze, stun and sleep skip the turn;
- UI/log updates occur after the tick.

### A120.7 Tanker and Support rage auto-cast

Auto-cast requires:

- unit alive;
- correct class;
- not silenced;
- finite rage/rageMax and rage >= rageMax;
- no same-class auto-cast already in flight;
- a valid skill;
- a valid target when target is required.

The cast is scheduled after the current resolution stack. Revalidate alive/silence/rage before consuming rage. Set rage to zero, invoke the normal cast pipeline with `consumeRage:false` and trigger metadata, clear the in-flight latch in `finally`.


## A121. Combat result handoff and reward-shape contract

Combat produces one normalized Planning handoff with this exact semantic shape:

Build one round result containing:

- winner side: LEFT/RIGHT/DRAW;
- round;
- surviving-unit counts;
- mode-computed fortress/life damage;
- gold delta;
- base win gold;
- star-based win bonus;
- Assassin bounty gold;
- loot ids;
- detailed loot entries including source metadata.

Normal win reward uses one base gold per enemy unit present plus the canonical star-based bonus, then adds Assassin bounty and other authored win bonuses. Passive win XP is **2** unless the mode suppresses it. Preserve these reward categories and the handoff fields defined here.

Draw forces zero mode damage. Creative mode:

- marks defeat as ignored;
- suppresses passive XP;
- still produces a result object/log so the user can inspect the simulated round.

Before routing back, PvP and co-op resolution hooks get first ownership. Only ordinary local combat directly starts Planning with `restoredState + combatResult`.


## A122. Rich tooltip pin/hover reconciliation and lifecycle

A96 defines the shared tooltip content model. The rebuilt tooltip must also preserve the richer **pin** interaction below so touch inspection remains reliable.

### A122.1 Trigger mode

Tooltip trigger mode is resolved from the configured mode/device policy:

- desktop/pointer surfaces may use hover;
- touch-oriented surfaces may use pin/long-press;
- an explicit `hover` or `pin` setting wins over automatic device choice.

Attaching a tooltip associates:

- target object/element;
- lazy content getter;
- optional stable `pinKey`;
- show/hide callbacks;
- optional custom rich-content presentation.

Content is resolved at display time so HP/status/equipment/skill text cannot go stale merely because the target was attached earlier.

### A122.2 Pin semantics

In pin mode:

- activating an unpinned target shows the tooltip and stores pinned ownership;
- activating the same target or another target with the same `pinKey` toggles it off;
- pointer movement does not reposition a pinned tooltip unless a forced refresh/re-anchor is requested;
- clicking/tapping inside the tooltip does not dismiss it;
- clicking/tapping the owning target does not trigger outside-dismiss;
- clicking/tapping outside both owner and tooltip dismisses it;
- if the pinned content getter later returns no content, the pin closes;
- a pinned tooltip can refresh in place from its current owner.

This behavior is especially useful for touch and dense unit cards. A different touch interaction is acceptable only if it preserves equally reliable inspectability and outside-dismiss behavior.

### A122.3 Rich content

The shared semantic model supports more than title/body text:

- avatar/model snapshot;
- title and subtitle;
- metadata/badge rows;
- status-icon rows;
- stat rows;
- meter rows;
- multiple titled section blocks/columns;
- active-text highlight markup;
- optional speech control/language.

Rich columns must collapse/reflow on narrow screens instead of silently dropping later columns. Status rows are deduplicated from canonical status state and may include source metadata explaining which skill/effect created them.

### A122.4 Status provenance

`tooltipStatusRuntime` snapshots status state before a skill, compares state after resolution and records source metadata for newly applied/changed statuses. When available, a status tooltip should identify its source skill and star-resolved summary. This metadata is explanatory only and must never become a second combat-status store.

### A122.5 Cleanup

Tooltip ownership must be disposable:

- unregister scene/document pointer listeners;
- cancel delayed/long-press work;
- clear pinned state;
- dispose avatar/model preview;
- destroy/remove pooled rich-line nodes and transient presentation nodes;
- run exactly once on scene/app teardown.


## A123. History lazy-load, filtering and modal-state contract

A38 defines history retention and categories. History opening/reopening also follows these lifecycle semantics:

- build History only once per live scene/controller instance;
- cache one in-flight load/build request so rapid repeated opens cannot construct duplicate panels;
- after load, retain references to modal parts, filter buttons, list container/viewport, title and close controls;
- keep one refresh entry point for the active History surface;
- always clear the **in-flight load marker** after success or failure so a later open may retry;
- if an active History surface already exists, reuse it rather than building another copy.

History content refresh is presentation-only. Filter changes, scroll and reopen must never replay combat/shop/craft mutations.

Wheel/keyboard/gamepad routing gives the visible History viewport first chance to consume navigation. Closing History releases modal ownership before board zoom/pan or combat-step input may resume.


## A124. Developer documentation and visual-QA capabilities

These are development workflows, not player-facing game screens. Preserve their useful outcomes in the rebuilt project or fold them into an equivalent documented tool; they must not appear in the normal player menu.

### A124.1 Source documentation assistant

The developer tool scans supported source files while honoring exclusions and optional priority folders. It parses code structure and reports file headers, imports/exports, functions, classes/methods, parameters/defaults, return/throw behavior, existing comments, and complexity/nesting for control-flow blocks. Parse failures are isolated to the affected file and included in the report; one malformed file must not abort the directory scan.

It can propose localized Vietnamese file headers and JSDoc for undocumented functions/methods, and explanatory comments for complex loops, branches, switches and exception handling. An explicit translation option handles English comments while preserving JSDoc tags, URLs, inline code and technical terms. Existing valid documentation is retained; the tool must not duplicate a header, JSDoc or nearby explanatory comment.

Support a dry-run preview that shows proposed changes and per-file status without writing. A write pass validates generated JSDoc, applies insertions without invalidating later source locations, and reports totals for scanned, changed, skipped and failed files, documented/undocumented functions, comment types, duration and actionable errors. Each file update is recoverable: preserve the original before writing, roll back that file if the write fails, and continue processing other files. Never report a failed file as successfully updated.

### A124.2 Unit visual-QA preview

Provide a developer-only preview flow that can resolve any canonical unit or boss directly, inspect its 1★/2★/3★ identity and available skins, and trigger idle, locomotion, basic attack, skill, hit reaction and death states without starting or mutating a gameplay run. It uses the same production visual resolver and action controller as Library/battle so a preview cannot conceal a missing roster entry or show a different identity from combat. It must expose unknown ids, missing action states, broken anatomy and fallback usage as visible QA failures, not silently substitute a generic creature. Closing or changing the preview disposes its temporary scene, model, audio/VFX hooks and input ownership.

## A125. Legacy-only compatibility behavior that must not disappear

Some files in `old_src` preserve useful behavior or data even though the current `src` tree no longer imports them directly. These capabilities are not automatically active product surfaces, but the rebuild must either retain them as compatibility/data tooling or deliberately fold them into an equivalent documented subsystem. Do not mistake "currently unreferenced" for "safe to forget."

### A125.1 Deterministic humanized cosmetic-theme roster

`old_src/data/unitHumanSkinRoster.ts` is a dormant compatibility dataset, separate from the canonical equipped-skin system in A109. For every unit represented by its embedded core metadata it deterministically derives **two** frozen humanized theme variants from stable unit identity + class + tribe information. Each generated theme carries localized names, a stable `skinKey`, separate icon choices for 1★/2★/3★, palette values, skin tone, head/species/side accents, aura shape, weapon type, accent emoji, `mature: true`, and its `variantIndex`.

Generation is deterministic: class selects the base archetype pool, tribe supplies elemental/style identity, and stable hashing chooses/varies the composition. Unknown unit ids return an empty theme list instead of manufacturing a random theme.

This legacy roster is **compatibility/data-only by default**. Preserve it as a queryable dataset, converter/export, or equivalent deterministic compatibility layer. Do not auto-unlock, auto-equip, or inject these themes into the current player-facing skin list unless an explicit product rule enables them. The current authored skin ownership/unlock rules in A109 remain authoritative.

### A125.2 Three.js localization compatibility dictionary

The legacy Three-specific locale pack keeps a strict VI/EN key-parity contract for camera presets/hints, graphics quality, board states, unit stats/badges, combat phases/actions, shop/bench/Planning messages, tooltip/modal copy, and Main Menu/HUD labels. The compatibility merge overlays these Three-specific keys onto the base locale dictionary while preserving placeholder tokens such as `{star}`, `{current}`, `{max}`, `{val}`, `{round}`, `{cycle}`, `{speed}`, `{cost}`, `{gold}`, `{count}` and `{limit}`.

If this dedicated pack is folded into the current i18n system, preserve the same semantic coverage and key parity. Locale `en` resolves the English compatibility text; non-English compatibility fallback resolves Vietnamese. No Three.js-only surface may regress to hardcoded player-facing strings merely because the old dedicated file is removed.

### A125.3 Legacy UI infrastructure and safe lifecycle helpers

Several legacy-only UI helpers encode behavior rather than art direction. Preserve these semantics while rebuilding their visuals under the asset-first rules:

- **cover sizing:** invalid/missing source dimensions fall back to the target frame dimensions; cover scale is `max(frameWidth/sourceWidth, frameHeight/sourceHeight)` and the result is centered on the target frame, so no letterbox gap appears;
- **display-object guards:** mutations such as visibility/text/color/tint/fill/stroke/alpha/Y updates are safe no-ops after an object is destroyed, detached or no longer renderable; disposal paths must not crash on stale references;
- **lazy UI modules:** Library, Tech Tree, Planning Settings, History, Version Info and Combat Settings modules are loaded on demand and share a memoized in-flight/completed import instead of spawning duplicate module loads for repeated opens;
- **pagination:** previous/next controls stay visible but are enabled only when `page > 0` and `page < maxPage`; destroying the pagination owner destroys both controls;
- **button interaction:** disabled buttons reject activation, press feedback returns to the resting state safely, and button destruction owns all of its visual children;
- **scrollable radio/options UI:** long option sets remain clipped to their viewport, support scrolling, keep disabled options non-selectable, update selection labels dynamically, and compute hit/mask coordinates through the actual parent-container chain rather than assuming local coordinates are world coordinates.

Legacy rectangle colors, CSS-like decoration and Phaser primitive styling are **not** visual requirements. Replace them with the approved PNG/9-slice/asset pipeline while retaining the interaction/lifecycle behavior above.

### A125.4 Generated asset-index compatibility

The legacy generated audio and tribute indices are derived artifacts, not hand-authored product truth. Preserve their functional role:

- audio assets are indexed by folder with stable keys/stems/source lists and mapped to menu, Planning and Combat contexts before the lazy/deferred playback rules in A45/A71 apply;
- the tribute gallery index enumerates available tribute media for the Main Menu gallery;
- generated indices must be reproducible from the underlying asset set or replaced by an equivalent deterministic discovery/build step; do not silently shrink the gallery/playlist because a generated `.temp.js` file is no longer copied verbatim.

### A125.5 Legacy fallback effect registry

The old default effect-handler registry is retained semantically through A70. Its compatibility names are: `single_damage`, `global_damage`, `single_heal`, `global_heal`, `single_stun`, `team_buff_def`, and `global_slow`. The first six resolve through the canonical damage/heal/status pipelines exactly as A70 specifies. `global_slow` remains an intentional no-op because the old slow mechanic was removed in favor of the current evasion/status model. Importing old content that references `global_slow` must not resurrect hidden turn-order/speed debuffs.


# APPENDIX B — FEATURE COVERAGE CHECKLIST

Use this checklist as the final semantic coverage gate. It lists **product capabilities**; the player-visible and canonical behaviors below may not silently disappear.

## B1. Application and account/run flow

- boot and loading with visible progress, retry and safe failure recovery;
- loading bubble minigame independent from real loading;
- main menu, Continue validation, New Game and mode/difficulty selection;
- language, settings, version/release notes, social, donation and tribute surfaces;
- save migration, import/export, corrupt-save recovery and distinct reset scopes;
- solo, Creative, Fortress, co-op and gated PvP routing;
- lazy loading with retry/back recovery and no stale async transition after leaving a screen.

## B2. Planning gameplay

- 5×5 local deployment board and visual river-separated enemy side;
- compact bench with unlockable perimeter capacity;
- shop generation, refresh, lock, purchase, pagination and sell;
- XP/level progression and deploy cap;
- drag/drop, swap, reorder and invalid-move rollback;
- automatic 3-copy star merge, chained merges and equipment overflow handling;
- item inventory, equip/unequip, sell and capacity rules;
- 3×3 crafting table progression, non-destructive staging and atomic craft commit;
- recipe library, technology tree, synergies, augments and unit info;
- attack/skill preview, shared tooltip, context actions, history/log and tutorial guidance;
- Creative sandbox placement and manual enemy setup;
- Fortress service-node interactions;
- multiplayer ownership restrictions and remote-player visibility.

## B3. Combat gameplay

- deterministic queue construction and target selection;
- melee contact movement, assassin behind-target staging and ranged projectile delivery;
- canonical hit/evasion/crit/element/armor/magic/true-damage pipeline;
- role passives, per-unit rage, skills, healing, shield absorption/lock, DoT/control/stat statuses, reflect/counter/guardian reactions, revive and compound status expiry behavior;
- skill effect families: single/global damage, single/global healing, stun, team defense buff and every authored unit-specific effect;
- semantic impact timing so HP/status changes happen at hit/cast impact rather than animation start;
- anti-stall escalation and purchased game-speed pacing without changing deterministic outcomes;
- death cleanup, current-position floating feedback, loot, rewards, HP damage and round transitions;
- synchronized authoritative combat for multiplayer with stale/duplicate protection and idempotent result payout.

## B4. Content and progression

- full normal-unit roster and bosses;
- species identity, role/class, faction, element/tribe, tier, stats, attack, skill and localization;
- 1★/2★/3★ stat and skill evolution;
- variant traits and deterministic ancestry/seed handling through merges;
- unit skins/evolution appearance, deterministic cosmetic-theme metadata and collection unlocks;
- achievements and collection profile;
- battlefield environments and their exact modifiers;
- Endless encounter generation and boss schedule;
- Fortress maps/services and PvP Fortress castle state.

## B5. Presentation and interaction

- cohesive medieval forest-fantasy art direction;
- bright readable voxel/low-poly board, terrain, river, sky, scenery and camera behavior;
- individually authored creature silhouettes and animation sets;
- status billboard for HP/rage/name and real buff/debuff icons;
- cards, Library, details, previews and shared tooltip information staying numerically consistent;
- direct/indirect/scan tile highlighting and clear drag/drop feedback;
- pooled VFX for attacks, healing, shields, statuses, low HP, death, evolution, environment and loot;
- music, semantic SFX, haptics and optional browser speech;
- keyboard, pointer, touch, camera joystick and gamepad navigation;
- responsive desktop/tablet/mobile behavior with safe areas and no clipped critical controls.

## B6. Multiplayer, platform and extension surfaces

- 2-player and 4-player co-op slot ownership and composed allied board views;
- room lifecycle, offer/answer signalling, ready state, disconnect/error recovery and save slots;
- PvP Fortress pairing, repeat-opponent avoidance, ghost opponent and champion flow;
- Discord activity integration with graceful browser fallback;
- offline/service-worker cache recovery;
- mod package registry, enable/disable state and load order;
- Creative and multiplayer modes must remain separable from normal solo persistence/economy semantics.

## B7. Completion rule

A capability is covered only when this prompt explains enough behavior that Opus can implement it without guessing the state transition, important defaults, boundary conditions or failure behavior. A feature name by itself is not coverage. If a missing behavior is discovered during rebuilding, add that behavior to the relevant product contract before treating the feature as complete.

## B8. Developer-only tooling

- source documentation scan, localized JSDoc/comment generation, explicit comment translation, dry-run diff, per-file status report and safe rollback;
- isolated unit/boss visual preview using the same resolver/controllers as production and covering all required stars, skins and action states;
- legacy compatibility inspection for deterministic humanized cosmetic themes, Three-specific locale parity, generated audio/tribute indices, and safe legacy UI helper semantics described by A125;
- development-only tools stay out of player navigation and cannot mutate a live run unless a tool explicitly owns a separate sandbox state.
# APPENDIX C — OPUS EXECUTION DISCIPLINE

Before coding, convert this document into a capability matrix with one row per meaningful gameplay, presentation, content, persistence, network, platform and developer-tool capability described here. Each row must be marked `implemented`, `folded into <replacement>`, `data-only`, or `intentionally unavailable in this mode`, with a reason. `TODO`, `maybe`, and implicit omission are not acceptable final states.

Implement in vertical slices that keep the game runnable: app shell → board/world → Planning mutations → canonical Combat → presentation → content breadth → network/platform features → polish. At the end of each slice, verify actual player flows rather than only checking compilation.

When a visual redesign conflicts with a gameplay rule, preserve gameplay and redesign the presentation around it. When descriptive shorthand appears inconsistent with an explicit operational rule, prefer the formulas/state transitions in Appendix A. Do not invent a new economy, board coordinate model, merge rule, craft transaction or combat formula because it is easier to code.

The rebuild is complete only when a player can start a fresh run, continue a saved run, play every mode enabled by the active availability policy, buy/move/merge/equip/craft/research/select augments, complete the eight-round tutorial, resolve deterministic combat, receive correct result/economy changes, browse collection/recipe/tech surfaces, and use responsive settings/input. Conditional multiplayer and Fortress flows must work when their modes are explicitly enabled; while those modes are gated, the normal menu must explain their unavailable state and reject direct/stale launch attempts.


<!-- SOURCE_TRACEABILITY_LEDGER_START -->
# APPENDIX D — SOURCE TRACEABILITY LEDGER

This ledger is the proof obligation for the instruction **“recover the complete feature set from `src` and `old_src`; do not skip a file.”** Every file present in those two trees at the time this specification was authored appears exactly once below. The ledger does not require obsolete implementation structure to survive; it records which product/developer contract absorbs the behavior or why a historical artifact contributes no independent runtime capability.

Coverage census: **473 current `src` files + 340 `old_src` files = 813 files reviewed.**

Disposition vocabulary: `active` = current source authority/reference; `legacy counterpart` = older implementation reviewed for behavior already represented by the cited canonical contract; `legacy-only recovered` = capability exists only in the old tree and is explicitly retained/folded into the cited contract; `archived snapshot` = backup/intermediate file reviewed only for historical conflict evidence and not a separate product feature.

## D0. Mechanical census and semantic-audit proof

At authoring time, a literal path comparison between the filesystem and this ledger produced **813 actual files, 813 exact ledger paths, 0 missing actual paths, 0 stale ledger paths, and 0 duplicate ledger paths**. The split is **473 `src` + 340 `old_src`**. Dispositions total exactly **473 active + 134 legacy counterpart + 183 legacy-only recovered + 23 archived snapshot = 813**. This check includes non-TypeScript assets/data inside those trees and does not rely on wildcard directory entries.

The `old_src` tree contains **23 `CombatScene.ts.*-bak*` snapshots**. All 23 are listed individually below as `archived snapshot`. A method-surface audit found **0 backup-only class methods across all 23 snapshots** relative to canonical `old_src/scenes/CombatScene.ts`; they are historical merge/conflict evidence rather than 23 separate gameplay APIs. If a deeper content diff later exposes behavior not present in the canonical file or the normative contracts, promote that behavior into the relevant Appendix A section before implementation; never compile/import a backup file as production source.

Semantic audit was performed in addition to path counting. High-risk legacy-only areas were read for behavior, including asset frame math, audio seek/playlist resume, shared/lazy asset loading, CSV quoting/lookup, transactional resolution rollback, round-cycled forest backgrounds, deterministic humanized cosmetic themes, hidden generic-PvP gating, generated audio/tribute indices, Three-specific localization, documentation tooling, visual registry/star evolution, default effect handlers, safe display-object mutation, cover sizing, lazy modal imports, pagination/button/radio helpers and developer visual-preview scenes. The cited contracts must describe their state transitions/defaults/failure behavior; a filename appearing here is not by itself sufficient proof of semantic coverage.

A same-relative-path export-surface comparison was also run across the **106 files that exist in both `src` and `old_src` at the same relative path**. Only two apparent old-only export groups remained after the current refactors: `AugmentDefinition`/`AugmentEffect`, whose type authority moved to `src/data/augments.ts` and is re-exported by the current system, and the old concatenated Continue/New Game/Enter Game emoji-label helpers, whose current replacements deliberately split icon from text so the shared icon/atlas pipeline can render them without missing-font tofu. These are refactor/API-shape deltas, not missing product capabilities; preserve the current typed augment authority and the split semantic-icon behavior.

## D1. Current `src` tree

- `src/app/App.ts` — **active** → #4-6, A52, A60, A64, A98, A115-A118
- `src/app/DebugRuntime.ts` — **active** → #42, A60.4
- `src/app/GameConfig.ts` — **active** → #4-6, A52, A60, A64, A98, A115-A118
- `src/app/GameFlowRouter.ts` — **active** → #4, A64, A115
- `src/app/Haptics.ts` — **active** → #33, A49
- `src/app/PerformanceProfiler.ts` — **active** → #42, A52
- `src/app/SceneLazyRouting.ts` — **active** → #4, A64, A115
- `src/app/SceneManager.ts` — **active** → #4, A64, A115
- `src/app/scenes/CoopLobbyScene.ts` — **active** → #29, A47, A114, A118
- `src/app/scenes/FortressMapScene.ts` — **active** → #28, A48, A117
- `src/app/scenes/LazySceneLoaderScene.ts` — **active** → #4, A64, A115
- `src/app/scenes/LoadingBubbleMinigame.ts` — **active** → #4, A55.1, A97
- `src/app/scenes/LoadingScene.ts` — **active** → #4, A64, A115
- `src/app/scenes/MainMenuScene.ts` — **active** → #5, A60, A98, A116
- `src/assets/fonts/Agbalumo-OFL.txt` — **active** → #1, #51, A58, A92
- `src/assets/fonts/Agbalumo-Regular.woff2` — **active** → #1, #51, A58, A92
- `src/audio/MusicDirector.ts` — **active** → #32, A45, A71
- `src/audio/SoundEffects.ts` — **active** → #32, A45
- `src/combat/combatActionRuntime.ts` — **active** → #16, A119, A120
- `src/combat/combatUnitFactory.ts` — **active** → #22-24, A90, A92, A112
- `src/combat/equipmentRuntime.ts` — **active** → #14.10, A80
- `src/combat/healBlockRuntime.ts` — **active** → #16.11, A70, A120
- `src/combat/healUnitRuntime.ts` — **active** → #16.11, A70, A120
- `src/combat/lootDropText.ts` — **active** → #17, A40, A121
- `src/combat/rolePassiveRuntime.ts` — **active** → #16.7, A78
- `src/combat/skills/attackPreview.ts` — **active** → #16.3-16.5, A41, A70, A76, A89, A119
- `src/combat/skills/attackPreviewRuntime.ts` — **active** → #16.3-16.5, A41, A70, A76, A89, A119
- `src/combat/skills/combatCalcRuntime.ts` — **active** → #16, A31, A56
- `src/combat/skills/commonCombatEffects.ts` — **active** → #16.3-16.5, A41, A70, A76, A89, A119
- `src/combat/skills/commonDefenseEffects.ts` — **active** → #16.3-16.5, A41, A70, A76, A89, A119
- `src/combat/skills/commonEffects.ts` — **active** → #16.3-16.5, A41, A70, A76, A89, A119
- `src/combat/skills/commonEffectUtils.ts` — **active** → #16.3-16.5, A41, A70, A76, A89, A119
- `src/combat/skills/commonUtilityEffects.ts` — **active** → #16.3-16.5, A41, A70, A76, A89, A119
- `src/combat/skills/offensiveEffects.ts` — **active** → #16.3-16.5, A41, A70, A76, A89, A119
- `src/combat/skills/offensiveMageEffects.ts` — **active** → #16.3-16.5, A41, A70, A76, A89, A119
- `src/combat/skills/offensiveMeleeEffects.ts` — **active** → #16.3-16.5, A41, A70, A76, A89, A119
- `src/combat/skills/offensiveRangedEffects.ts` — **active** → #16.3-16.5, A41, A70, A76, A89, A119
- `src/combat/skills/previewCells.ts` — **active** → #16.3-16.5, A41, A70, A76, A89, A119
- `src/combat/skills/previewRuntime.ts` — **active** → #16.3-16.5, A41, A70, A76, A89, A119
- `src/combat/skills/supportEffects.ts` — **active** → #16.3-16.5, A41, A70, A76, A89, A119
- `src/combat/skills/targeting.ts` — **active** → #16.3-16.5, A41, A70, A76, A89, A119
- `src/combat/skills/visualPlan.ts` — **active** → #16.3-16.5, A41, A70, A76, A89, A119
- `src/combat/statusTurnRuntime.ts` — **active** → #16.8, A73, A79, A92, A120
- `src/core/aiModes.ts` — **active** → #18, A33, A102
- `src/core/appMeta.ts` — **active** → #1, #41, A51
- `src/core/augmentPower.ts` — **active** → #14.15, A46
- `src/core/benchTechUnlock.ts` — **active** → #11.6, #14.4, A63, A75, A101.3
- `src/core/boardConstants.ts` — **active** → #11, A2, A63, A75, A91
- `src/core/boardProfiles.ts` — **active** → #11, A2, A63, A75, A91
- `src/core/browserSpeech.ts` — **active** → #44, A49, A109.4
- `src/core/collectionProfile.ts` — **active** → #25, #27, A36, A104, A109
- `src/core/combatCalc.ts` — **active** → #16, A31, A56
- `src/core/combatDamageAftermath.ts` — **active** → #16.10, A74, A120
- `src/core/combatDamageRules.ts` — **active** → #16.10, A74, A120
- `src/core/combatDeathmatch.ts` — **active** → #16, A31, A56
- `src/core/combatLoot.ts` — **active** → #17, A40, A121
- `src/core/combatOutcomeState.ts` — **active** → #16.17, A87, A121
- `src/core/combatPower.ts` — **active** → #16.19, A68, A95
- `src/core/combatQueue.ts` — **active** → #16, A119, A120
- `src/core/combatRandom.ts` — **active** → #16, A31, A56
- `src/core/combatRoundResult.ts` — **active** → #9-10, #14-16, A1-A82
- `src/core/combatSeededRandom.ts` — **active** → #16, A31, A56
- `src/core/combatSkillRaw.ts` — **active** → #16.3-16.5, A41, A70, A76, A89, A119
- `src/core/combatTeamStatus.ts` — **active** → #16.8, A73, A79, A92, A120
- `src/core/coopBoardState.ts` — **active** → #29, A47, A114, A118
- `src/core/coopSaveSlots.ts` — **active** → #29, A47, A114, A118
- `src/core/creativeMode.ts` — **active** → #9-10, #14-16, A1-A82
- `src/core/damageResolver.ts` — **active** → #16.10, A74, A120
- `src/core/donateQr.ts` — **active** → #5.3, A55.2
- `src/core/emojiIcon.ts` — **active** → #36, A61
- `src/core/endlessAchievements.ts` — **active** → #27, A36, A104
- `src/core/endlessBosses.ts` — **active** → #19, A34, A84
- `src/core/enemyEncounter.ts` — **active** → #18, #19, A33
- `src/core/enemyPreview.ts` — **active** → #19, A68
- `src/core/fortressMode.ts` — **active** → #28, A48, A117
- `src/core/gameModeRuntime.ts` — **active** → #8, A60, A116
- `src/core/gameRules.ts` — **active** → #9-10, #14-16, A1-A82
- `src/core/gameSpeed.ts` — **active** → #46, A56
- `src/core/gameUtils.ts` — **active** → #9-10, #14-16, A1-A82
- `src/core/imageAssetLoader.ts` — **active** → #37, A55.4
- `src/core/keyboardBindings.ts` — **active** → #34, A44, A110
- `src/core/mainMenuAvailability.ts` — **active** → #5, A60, A98, A116
- `src/core/modalCoordinator.ts` — **active** → #40, A60.3
- `src/core/newGameRoute.ts` — **active** → #5, #9, A60, A98, A116
- `src/core/offenseDebuff.ts` — **active** → #9-10, #14-16, A1-A82
- `src/core/persistence.ts` — **active** → #10, A57, A103, A113, A114
- `src/core/planningBenchCap.ts` — **active** → #11.6, #14.4, A63, A75, A101.3
- `src/core/planningBoardAccess.ts` — **active** → #11, A2, A63, A75, A91
- `src/core/planningInventoryCap.ts` — **active** → #14.9, A69, A86
- `src/core/rangeText.ts` — **active** → #49, A59
- `src/core/recipeCategory.ts` — **active** → #14.12, A69, A106
- `src/core/renderConfig.ts` — **active** → #37, A58
- `src/core/rolePassives.ts` — **active** → #16.7, A78
- `src/core/runState.ts` — **active** → #9, A62, A103, A114
- `src/core/techResearch.ts` — **active** → #14.13, A111
- `src/core/tooltipInlineMarkup.ts` — **active** → #26, A96, A122
- `src/core/uiResponsive.ts` — **active** → #54, A58
- `src/core/uiSettings.ts` — **active** → #6, A35, A110
- `src/core/uiTheme.ts` — **active** → #51, A58, A92
- `src/core/unitDescriptionHelper.ts` — **active** → #7, #20, A41, A72
- `src/core/unitDescriptionTranslations.ts` — **active** → #7, #20, A41, A72
- `src/core/unitStatsFormatter.ts` — **active** → #49, A59
- `src/core/variantTraits.ts` — **active** → #20, #48, A43
- `src/core/viTextSanitizer.ts` — **active** → #7, #20, A41, A72
- `src/data/augments.ts` — **active** → #14.15, A46
- `src/data/battlefieldEnvironments.ts` — **active** → #12, A32
- `src/data/classSkillVariants.ts` — **active** → #16.3-16.5, A41, A70, A76, A89, A119
- `src/data/elementInfo.ts` — **active** → #21, A41
- `src/data/factionInfo.ts` — **active** → #21, A41
- `src/data/items.ts` — **active** → #14.9-14.11, A40, A69, A80
- `src/data/musicPlaylists.ts` — **active** → #32, A45, A71
- `src/data/shopRoster.ts` — **active** → #14.5, A69
- `src/data/skillRuntime.ts` — **active** → #16.3-16.5, A41, A70, A76, A89, A119
- `src/data/skills.ts` — **active** → #16.3-16.5, A41, A70, A76, A89, A119
- `src/data/synergies.ts` — **active** → #12, #15, #20-23, #27, A32, A36, A41-A43, A83-A84
- `src/data/techTree.ts` — **active** → #14.13, A111
- `src/data/tributeCredits.ts` — **active** → #5.4, A55.3
- `src/data/tutorialSteps.ts` — **active** → #15, A94, A108
- `src/data/unitCatalog.ts` — **active** → #20, A41, A83
- `src/data/unitEvolutionNames.ts` — **active** → #23, A90, A109
- `src/data/unitSfxProfiles.ts` — **active** → #32, A45
- `src/data/unitSkins.ts` — **active** → #23, A90, A109
- `src/data/unitVisuals.ts` — **active** → #22, #23, A90, A112
- `src/gameModes/EndlessPvEClassicMode.ts` — **active** → #8, A60, A116
- `src/gameModes/EndlessPvEFortressMode.ts` — **active** → #28, A48, A117
- `src/gameModes/GameModeConfig.ts` — **active** → #8, A60, A116
- `src/gameModes/GameModeRegistry.ts` — **active** → #8, A60, A116
- `src/gameModes/PVP4FortressMode.ts` — **active** → #30, A48, A100.3
- `src/gameModes/README.integration.md` — **active** → #8, A60, A116
- `src/gameModes/README.md` — **active** → #8, A60, A116
- `src/gameModes/README.modes.md` — **active** → #8, A60, A116
- `src/gameModes/README.overview.md` — **active** → #8, A60, A116
- `src/generated/tributeGallery.js` — **active** → #5.4, A55.3
- `src/i18n/en.ts` — **active** → #7, A72
- `src/i18n/index.ts` — **active** → #7, A72
- `src/i18n/localeText.ts` — **active** → #7, A72
- `src/i18n/uiText.ts` — **active** → #7, A72
- `src/i18n/vi.ts` — **active** → #7, A72
- `src/legacy-types.d.ts` — **active** → #2.1, Appendix C
- `src/main.ts` — **active** → #4, A115
- `src/mods/ModRegistry.ts` — **active** → #35, A50
- `src/network/coopCombatSync.ts` — **active** → #29, A47, A114, A118
- `src/network/coopConfig.ts` — **active** → #29, A47, A114, A118
- `src/network/coopP2PTransport.ts` — **active** → #29, A47, A114, A118
- `src/network/coopPeerClient.ts` — **active** → #29, A47, A114, A118
- `src/network/coopSession.ts` — **active** → #29, A47, A114, A118
- `src/network/pvpFortress.ts` — **active** → #30, A48, A100.3
- `src/platform/discordActivity.ts` — **active** → #31, A51
- `src/render/AssetLoader.ts` — **active** → #37, A55.4
- `src/render/EmojiAtlas.ts` — **active** → #36, A61
- `src/render/FxPool.ts` — **active** → #38, A52, A112
- `src/render/renderTypes.ts` — **active** → #37-38, A52, A55.4, A61
- `src/render/VoxelBlock.ts` — **active** → #37-38, A52, A55.4, A61
- `src/render/VoxelBlockBatch.ts` — **active** → #37-38, A52, A55.4, A61
- `src/render/VoxelCuboidBuilder.ts` — **active** → #37-38, A52, A55.4, A61
- `src/round/combat/CanonicalCombatActionRuntime.ts` — **active** → #16, A119, A120
- `src/round/combat/CanonicalCombatRuntime.ts` — **active** → #16, A119-A121
- `src/round/combat/LootRuntime.ts` — **active** → #16, A119-A121
- `src/round/combat/MultiplayerRuntime.ts` — **active** → #16, A119-A121
- `src/round/combat/Pacing.ts` — **active** → #16, A119-A121
- `src/round/combat/PresentationRuntime.ts` — **active** → #16, A119-A121
- `src/round/combat/ResultFlowRuntime.ts` — **active** → #16, A119-A121
- `src/round/combat/VfxRuntime.ts` — **active** → #38, A52, A112
- `src/round/CombatController.ts` — **active** → #16, A119, A120
- `src/round/DifficultyRuntime.ts` — **active** → #18, A33, A102
- `src/round/GamepadController.ts` — **active** → #34, A49, A65, A105
- `src/round/KeyboardBindingsRuntime.ts` — **active** → #34, A44, A110
- `src/round/PersistenceRuntime.ts` — **active** → #10, A57, A103, A113, A114
- `src/round/planning/BenchLayout.ts` — **active** → #11.6, #14.4, A63, A75, A101.3
- `src/round/planning/constants.ts` — **active** → #14, A75, A85, A86
- `src/round/planning/CraftRuntime.ts` — **active** → #14.11, A86
- `src/round/planning/delegateManifest.json` — **active** → #14, A75, A85, A86
- `src/round/planning/DragRuntime.ts` — **active** → #14, A75, A85, A86
- `src/round/planning/InventoryRuntime.ts` — **active** → #14.9, A69, A86
- `src/round/planning/ItemHelpersRuntime.ts` — **active** → #14.10, A80
- `src/round/planning/MultiplayerRuntime.ts` — **active** → #14, A75, A85, A86
- `src/round/planning/ShopActionsRuntime.ts` — **active** → #14.5, A69
- `src/round/planning/TechRuntime.ts` — **active** → #14, A75, A85, A86
- `src/round/planning/tutorialRuntime.ts` — **active** → #15, A94, A108
- `src/round/PlanningController.ts` — **active** → #14, A75, A85, A86
- `src/round/RoundScene.ts` — **active** → #14, #16, A1, A64
- `src/round/roundSceneTypes.ts` — **active** → #14, #16, A1, A64
- `src/styles.css` — **active** → #2.3, #51, A58
- `src/sw.ts` — **active** → #45, A51
- `src/systems/AISystem.ts` — **active** → #14, #16, #18, A31
- `src/systems/AITargeting.ts` — **active** → #16.4, #18, A33, A76
- `src/systems/AITeamGeneration.ts` — **active** → #18, #19, A33
- `src/systems/AugmentSystem.ts` — **active** → #14.15, A46
- `src/systems/AutoMerge.ts` — **active** → #14.8, A81
- `src/systems/BoardBenchOps.ts` — **active** → #11.6, #14.4, A63, A75, A101.3
- `src/systems/BoardSystem.ts` — **active** → #11, A2, A63, A75, A91
- `src/systems/combat/combatDamageRuntime.ts` — **active** → #16.10, A74, A120
- `src/systems/combat/combatResolutionRuntime.ts` — **active** → #16, A119, A120
- `src/systems/combat/combatStatusRuntime.ts` — **active** → #16.8, A73, A79, A92, A120
- `src/systems/combat/combatTurnRuntime.ts` — **active** → #16, A119, A120
- `src/systems/CombatSystem.ts` — **active** → #16, A119, A120
- `src/systems/DifficultyValidator.ts` — **active** → #18, A33, A102
- `src/systems/ShopSystem.ts` — **active** → #14.5, A69
- `src/systems/StatusEffectHandlers.ts` — **active** → #16.8, A73, A79, A92, A120
- `src/systems/SynergyCalculator.ts` — **active** → #14.14, A82
- `src/systems/SynergySystem.ts` — **active** → #14.14, A82
- `src/systems/UpgradeMergeRuntime.ts` — **active** → #14.8, A81
- `src/systems/UpgradeSystem.ts` — **active** → #14.8, A81
- `src/ui/buttonEmojiLabels.ts` — **active** → #36, A61
- `src/ui/cards/LibraryUnitCard.ts` — **active** → #25, A107.2, A109
- `src/ui/cards/UnitCard.ts` — **active** → #14.6, #25, A59
- `src/ui/cards/UnitPortrait.ts` — **active** → #14.6, #25, A59
- `src/ui/ContextMenu.ts` — **active** → #14.17, A85
- `src/ui/library/LibraryActionPreview.ts` — **active** → #25, A107.2, A109
- `src/ui/library/LibraryBattlePreview.ts` — **active** → #25, A107.2, A109
- `src/ui/library/LibraryModal.ts` — **active** → #25, A107.2, A109
- `src/ui/library/libraryPreviewRuntime.ts` — **active** → #25, A107.2, A109
- `src/ui/library/LibraryStarStats.ts` — **active** → #25, A107.2, A109
- `src/ui/modals/AchievementsModal.ts` — **active** → #27, A36, A104
- `src/ui/modals/AugmentChoiceModal.ts` — **active** → #14.15, A46
- `src/ui/modals/FortressServiceModal.ts` — **active** → #28, A48, A117
- `src/ui/modals/LanguageModal.ts` — **active** → #14, #25-26, #40, #51, A58, A96, A107-A111, A122-A123
- `src/ui/modals/MenuExtrasModal.ts` — **active** → #14, #25-26, #40, #51, A58, A96, A107-A111, A122-A123
- `src/ui/modals/ModManagerModal.ts` — **active** → #35, A50
- `src/ui/modals/ResultOverlay.ts` — **active** → #16.17, A87, A121
- `src/ui/modals/SettingsModal.ts` — **active** → #6, A35, A110
- `src/ui/modals/SynergyModal.ts` — **active** → #14.14, A82
- `src/ui/RecipeDiagram.ts` — **active** → #14.12, A69, A106
- `src/ui/recipeLocalization.ts` — **active** → #14.12, A69, A106
- `src/ui/styles/art.css` — **active** → #14, #25-26, #40, #51, A58, A96, A107-A111, A122-A123
- `src/ui/techTreeLayout.ts` — **active** → #14.13, A111
- `src/ui/theme/AppFont.ts` — **active** → #14, #25-26, #40, #51, A58, A96, A107-A111, A122-A123
- `src/ui/theme/nineSlice.ts` — **active** → #51, A58, A92
- `src/ui/theme/uiArt.ts` — **active** → #51, A58, A92
- `src/ui/theme/UiAssets.ts` — **active** → #51, A58, A92
- `src/ui/theme/UiButton.ts` — **active** → #51, A58, A92
- `src/ui/theme/UiTheme.ts` — **active** → #51, A58, A92
- `src/ui/theme/UiTypography.ts` — **active** → #51, A58, A92
- `src/ui/tooltips/combatTooltipRuntime.ts` — **active** → #26, A96, A122
- `src/ui/tooltips/descriptionRuntime.ts` — **active** → #26, A96, A122
- `src/ui/tooltips/planningTooltipRuntime.ts` — **active** → #26, A96, A122
- `src/ui/tooltips/SharedTooltip.ts` — **active** → #26, A96, A122
- `src/ui/tooltips/synergyTooltipRuntime.ts` — **active** → #26, A96, A122
- `src/ui/tooltips/Tooltip.ts` — **active** → #26, A96, A122
- `src/ui/tooltips/tooltipStatusRuntime.ts` — **active** → #26, A96, A122
- `src/ui/tooltips/tooltipTheme.ts` — **active** → #26, A96, A122
- `src/ui/tooltips/unitTooltipShared.ts` — **active** → #26, A96, A122
- `src/ui/tutorial/TutorialOverlay.ts` — **active** → #15, A94, A108
- `src/ui/tutorial/tutorialProgress.ts` — **active** → #15, A94, A108
- `src/ui/tutorial/tutorialTargetCore.ts` — **active** → #15, A94, A108
- `src/ui/tutorial/TutorialTargetResolver.ts` — **active** → #15, A94, A108
- `src/ui/UnitInfoPanel.ts` — **active** → #14.16, A85, A96
- `src/ui/unitInfoRecommendations.ts` — **active** → #14.16, A85, A96
- `src/ui/unitInfoRuntime.ts` — **active** → #14.16, A85, A96
- `src/units/albatross-wind/AlbatrossWindAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/albatross-wind/AlbatrossWindRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/ant-guard/AntGuardAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/ant-guard/AntGuardRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/armadillo-roll/ArmadilloRollAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/armadillo-roll/ArmadilloRollRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/badger-stone/BadgerStoneAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/badger-stone/BadgerStoneRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/bat-blood/BatBloodAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/bat-blood/BatBloodRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/bear-ancient/BearAncientAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/bear-ancient/BearAncientRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/beetle-drill/BeetleDrillAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/beetle-drill/BeetleDrillRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/beetle-mystic/BeetleMysticAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/beetle-mystic/BeetleMysticRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/bison-stampede/BisonStampedeAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/bison-stampede/BisonStampedeRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/boss-earth-colossus/BossEarthColossusAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/boss-earth-colossus/BossEarthColossusRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/boss-ember-dragon/BossEmberDragonAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/boss-ember-dragon/BossEmberDragonRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/boss-storm-phoenix/BossStormPhoenixAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/boss-storm-phoenix/BossStormPhoenixRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/boss-tempest-jelly/BossTempestJellyAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/boss-tempest-jelly/BossTempestJellyRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/boss-venom-hydra/BossVenomHydraAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/boss-venom-hydra/BossVenomHydraRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/bug-plague/BugPlagueAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/bug-plague/BugPlagueRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/butterfly-mirror/ButterflyMirrorAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/butterfly-mirror/ButterflyMirrorRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/cat-goldbow/CatGoldbowAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/cat-goldbow/CatGoldbowRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/chameleon-stealth/ChameleonStealthAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/chameleon-stealth/ChameleonStealthRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/cobra-venom/CobraVenomAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/cobra-venom/CobraVenomRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/condor-sky/CondorSkyAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/condor-sky/CondorSkyRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/crab-shell/CrabShellAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/crab-shell/CrabShellRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/crow-storm/CrowStormAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/crow-storm/CrowStormRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/deer-song/DeerSongAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/deer-song/DeerSongRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/DefaultUnitAnimation.ts` — **active** → #22-24, A90, A92, A112
- `src/units/dove-peace/DovePeaceAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/dove-peace/DovePeaceRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/dryad-tree/DryadTreeAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/dryad-tree/DryadTreeRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/eagle-marksman/EagleMarksmanAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/eagle-marksman/EagleMarksmanRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/fairy-forest/FairyForestAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/fairy-forest/FairyForestRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/falcon-dive/FalconDiveAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/falcon-dive/FalconDiveRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/ferret-shadow/FerretShadowAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/ferret-shadow/FerretShadowRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/firefly-heal/FireflyHealAnimation.ts` — **active** → #16.11, A70, A120
- `src/units/firefly-heal/FireflyHealRig.ts` — **active** → #16.11, A70, A120
- `src/units/firefly-light/FireflyLightAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/firefly-light/FireflyLightRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/flamingo-shot/FlamingoShotAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/flamingo-shot/FlamingoShotRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/fox-flame/FoxFlameAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/fox-flame/FoxFlameRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/golem-stone/GolemStoneAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/golem-stone/GolemStoneRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/hawk-hunter/HawkHunterAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/hawk-hunter/HawkHunterRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/heron-pierce/HeronPierceAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/heron-pierce/HeronPierceRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/hippo-maul/HippoMaulAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/hippo-maul/HippoMaulRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/horse-charge/HorseChargeAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/horse-charge/HorseChargeRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/hyena-pack/HyenaPackAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/hyena-pack/HyenaPackRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/ice-mage/IceMageAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/ice-mage/IceMageRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/jaguar-hunt/JaguarHuntAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/jaguar-hunt/JaguarHuntRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/jellyfish-shock/JellyfishShockAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/jellyfish-shock/JellyfishShockRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/kangaroo-kick/KangarooKickAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/kangaroo-kick/KangarooKickRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/komodo-bite/KomodoBiteAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/komodo-bite/KomodoBiteRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/mantis-blade/MantisBladeAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/mantis-blade/MantisBladeRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/mink-silent/MinkSilentAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/mink-silent/MinkSilentRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/monkey-spear/MonkeySpearAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/monkey-spear/MonkeySpearRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/mosquito-toxic/MosquitoToxicAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/mosquito-toxic/MosquitoToxicRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/moth-dust/MothDustAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/moth-dust/MothDustRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/newt-fire/NewtFireAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/newt-fire/NewtFireRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/nymph-water/NymphWaterAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/nymph-water/NymphWaterRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/octopus-mind/OctopusMindAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/octopus-mind/OctopusMindRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/otter-river/OtterRiverAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/otter-river/OtterRiverRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/owl-nightshot/OwlNightshotAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/owl-nightshot/OwlNightshotRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/ox-mountain/OxMountainAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/ox-mountain/OxMountainRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/pangolin-plate/PangolinPlateAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/pangolin-plate/PangolinPlateRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/pelican-bomb/PelicanBombAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/pelican-bomb/PelicanBombRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/ram-charge/RamChargeAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/ram-charge/RamChargeRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/rapper-chicken/ChickenRapperAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/rapper-chicken/ChickenRapperGeometry.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/rapper-chicken/ChickenRapperRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/rapper-chicken/SleepyHenGirlAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/rapper-chicken/SleepyHenGirlSkin.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/README.md` — **active** → #20-24, A83, A84, A90, A112
- `src/units/rhino-quake/RhinoQuakeAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/rhino-quake/RhinoQuakeRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/salamander-flame/SalamanderFlameAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/salamander-flame/SalamanderFlameRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/scorpion-king/ScorpionKingAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/scorpion-king/ScorpionKingRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/scorpion-shadow/ScorpionShadowAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/scorpion-shadow/ScorpionShadowRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/shared/AnimalParts.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/shared/archetypes.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/shared/MicroVoxel.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/shared/RigPose.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/shared/VoxelPrototypeAnimalsData.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/shared/VoxelSpiderGeometry.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/shark-frenzy/SharkFrenzyAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/shark-frenzy/SharkFrenzyRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/snail-fortress/SnailFortressAnimation.ts` — **active** → #28, A48, A117
- `src/units/snail-fortress/SnailFortressRig.ts` — **active** → #28, A48, A117
- `src/units/spider/SpiderAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/spider/SpiderRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/spore-mage/SporeMageAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/spore-mage/SporeMageRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/sprite-wind/SpriteWindAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/sprite-wind/SpriteWindRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/squid-ink/SquidInkAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/squid-ink/SquidInkRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/stork-sniper/StorkSniperAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/stork-sniper/StorkSniperRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/storm-mage/StormMageAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/storm-mage/StormMageRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/tiger-fang/TigerFangAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/tiger-fang/TigerFangRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/toad-poison/ToadPoisonAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/toad-poison/ToadPoisonRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/toucan-snipe/ToucanSnipeAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/toucan-snipe/ToucanSnipeRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/triceratops-charge/TriceratopsChargeAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/triceratops-charge/TriceratopsChargeRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/turtle-mire/TurtleMireAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/turtle-mire/TurtleMireRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/UnfinishedUnitVisual.ts` — **active** → #22, #23, A90, A112
- `src/units/unicorn-light/UnicornLightAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/unicorn-light/UnicornLightRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/UnitAnimationController.ts` — **active** → #22-24, A90, A92, A112
- `src/units/UnitAvatarRenderer.ts` — **active** → #22-24, A90, A92, A112
- `src/units/UnitFactory.ts` — **active** → #22-24, A90, A92, A112
- `src/units/UnitGeometryIntegrity.ts` — **active** → #22-24, A90, A92, A112
- `src/units/UnitIdleAnimation.ts` — **active** → #22-24, A90, A92, A112
- `src/units/UnitModelFactory.ts` — **active** → #22-24, A90, A92, A112
- `src/units/UnitMotionProfile.ts` — **active** → #22-24, A90, A92, A112
- `src/units/UnitOwnedRigRegistry.ts` — **active** → #22-24, A90, A92, A112
- `src/units/UnitPolyBuilder.ts` — **active** → #22-24, A90, A92, A112
- `src/units/UnitRosterProfiles.ts` — **active** → #22-24, A90, A92, A112
- `src/units/UnitStarVisuals.ts` — **active** → #22, #23, A90, A112
- `src/units/UnitStatusBillboard.ts` — **active** → #11, A2, A63, A75, A91
- `src/units/UnitVisualMultiplicity.ts` — **active** → #22, #23, A90, A112
- `src/units/viper-strike/ViperStrikeAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/viper-strike/ViperStrikeRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/walrus-ice/WalrusIceAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/walrus-ice/WalrusIceRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/wasp-sting/WaspStingAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/wasp-sting/WaspStingRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/weasel-quick/WeaselQuickAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/weasel-quick/WeaselQuickRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/wisp-light/WispLightAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/wisp-light/WispLightRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/wolf-alpha/WolfAlphaAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/wolf-alpha/WolfAlphaRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/wolverine-rage/WolverineRageAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/wolverine-rage/WolverineRageRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/woodpecker-drill/WoodpeckerDrillAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/woodpecker-drill/WoodpeckerDrillRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/worm-ice/WormIceAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/worm-ice/WormIceRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/worm-queen/WormQueenAnimation.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/units/worm-queen/WormQueenRig.ts` — **active** → #20-24, A83, A84, A90, A112
- `src/visuals/starVisualPresetRegistry.ts` — **active** → #22, #23, A90, A112
- `src/visuals/starVisualTypes.ts` — **active** → #22, #23, A90, A112
- `src/visuals/unitStarVisualIdentity.ts` — **active** → #22, #23, A90, A112
- `src/world/ArenaMetrics.ts` — **active** → #11, #12, A91, A100.1
- `src/world/Board.ts` — **active** → #11, A2, A63, A75, A91
- `src/world/BoardInputController.ts` — **active** → #11, A2, A63, A75, A91
- `src/world/boardInputCore.ts` — **active** → #11, A2, A63, A75, A91
- `src/world/BoardRenderer.ts` — **active** → #11, A2, A63, A75, A91
- `src/world/BoardViewport.ts` — **active** → #11, A2, A63, A75, A91
- `src/world/boardViewportCore.ts` — **active** → #11, A2, A63, A75, A91
- `src/world/CameraJoystick.ts` — **active** → #13, A58, A91
- `src/world/CameraManager.ts` — **active** → #13, A58, A91
- `src/world/Lighting.ts` — **active** → #11, #12, A91, A100.1
- `src/world/RiverDivider.ts` — **active** → #11, #12, A91, A100.1
- `src/world/SkyEnvironment.ts` — **active** → #11, #12, A91, A100.1
- `src/world/terrain/scenery/GreenBox1.ts` — **active** → #11, #12, A91, A100.1
- `src/world/terrain/scenery/GreenBox2.ts` — **active** → #11, #12, A91, A100.1
- `src/world/terrain/scenery/GreenGrassflower1.ts` — **active** → #11, #12, A91, A100.1
- `src/world/terrain/scenery/GreenGrassflower2.ts` — **active** → #11, #12, A91, A100.1
- `src/world/terrain/scenery/GreenGrassmushroom.ts` — **active** → #11, #12, A91, A100.1
- `src/world/terrain/scenery/GreenTree1.ts` — **active** → #11, #12, A91, A100.1
- `src/world/terrain/scenery/GreenTree2.ts` — **active** → #11, #12, A91, A100.1
- `src/world/terrain/VoxelSceneryData.ts` — **active** → #11, #12, A91, A100.1
- `src/world/terrain/VoxelTerrainData.ts` — **active** → #11, #12, A91, A100.1
- `src/world/VoxelTerrain.ts` — **active** → #11, #12, A91, A100.1

## D2. Historical `old_src` tree

- `old_src/assets/fonts/Agbalumo-OFL.txt` — **legacy counterpart** → #1, #51, A58, A92
- `old_src/assets/fonts/Agbalumo-Regular.woff2` — **legacy counterpart** → #1, #51, A58, A92
- `old_src/core/aiModes.ts` — **legacy counterpart** → #18, A33, A102
- `old_src/core/appMeta.ts` — **legacy counterpart** → #1, #41, A51
- `old_src/core/assetFrameSpecs.ts` — **legacy-only recovered** → #37, A55.4, A61, A92
- `old_src/core/audioFx.ts` — **legacy-only recovered** → #32, A45, A71
- `old_src/core/boardConstants.ts` — **legacy counterpart** → #11, A2, A63, A75, A91
- `old_src/core/boardProfiles.ts` — **legacy counterpart** → #11, A2, A63, A75, A91
- `old_src/core/browserSpeech.ts` — **legacy counterpart** → #44, A49, A109.4
- `old_src/core/collectionProfile.ts` — **legacy counterpart** → #25, #27, A36, A104, A109
- `old_src/core/combatCalc.ts` — **legacy counterpart** → #16, A31, A56
- `old_src/core/combatPower.ts` — **legacy counterpart** → #16.19, A68, A95
- `old_src/core/combatQueue.ts` — **legacy counterpart** → #16, A119, A120
- `old_src/core/combatSeededRandom.ts` — **legacy counterpart** → #16, A31, A56
- `old_src/core/coopBoardState.ts` — **legacy counterpart** → #29, A47, A114, A118
- `old_src/core/coopSaveSlots.ts` — **legacy counterpart** → #29, A47, A114, A118
- `old_src/core/creativeMode.ts` — **legacy counterpart** → #9-10, #14-16, A1-A82
- `old_src/core/csvLoader.ts` — **legacy-only recovered** → A67.4
- `old_src/core/damageResolver.ts` — **legacy counterpart** → #16.10, A74, A120
- `old_src/core/emojiAtlas.ts` — **legacy counterpart** → #36, A61
- `old_src/core/endlessAchievements.ts` — **legacy counterpart** → #27, A36, A104
- `old_src/core/endlessBosses.ts` — **legacy counterpart** → #19, A34, A84
- `old_src/core/enemyPreview.ts` — **legacy counterpart** → #19, A68
- `old_src/core/fortressMode.ts` — **legacy counterpart** → #28, A48, A117
- `old_src/core/fxPool.ts` — **legacy counterpart** → #38, A52, A112
- `old_src/core/gameConfig.ts` — **legacy counterpart** → #9-10, #14-16, A1-A82
- `old_src/core/gameModeRuntime.ts` — **legacy counterpart** → #8, A60, A116
- `old_src/core/GamepadController.ts` — **legacy counterpart** → #34, A49, A65, A105
- `old_src/core/gameRules.ts` — **legacy counterpart** → #9-10, #14-16, A1-A82
- `old_src/core/gameSpeed.ts` — **legacy counterpart** → #46, A56
- `old_src/core/gameUtils.ts` — **legacy counterpart** → #9-10, #14-16, A1-A82
- `old_src/core/keyboardBindings.ts` — **legacy counterpart** → #34, A44, A110
- `old_src/core/newGameRoute.ts` — **legacy counterpart** → #5, #9, A60, A98, A116
- `old_src/core/offenseDebuff.ts` — **legacy counterpart** → #9-10, #14-16, A1-A82
- `old_src/core/persistence.ts` — **legacy counterpart** → #10, A57, A103, A113, A114
- `old_src/core/rangeText.ts` — **legacy counterpart** → #49, A59
- `old_src/core/renderConfig.ts` — **legacy counterpart** → #37, A58
- `old_src/core/resolutionManager.ts` — **legacy-only recovered** → #6, A58, A66, A110
- `old_src/core/rolePassives.ts` — **legacy counterpart** → #16.7, A78
- `old_src/core/runState.ts` — **legacy counterpart** → #9, A62, A103, A114
- `old_src/core/sharedAssetLoader.ts` — **legacy-only recovered** → #37, A45, A55.4, A71, A125.4
- `old_src/core/tooltip.ts` — **legacy counterpart** → #26, A96, A122
- `old_src/core/tooltipInlineMarkup.ts` — **legacy counterpart** → #26, A96, A122
- `old_src/core/tooltipTheme.ts` — **legacy counterpart** → #26, A96, A122
- `old_src/core/uiResponsive.ts` — **legacy counterpart** → #54, A58
- `old_src/core/uiSettings.ts` — **legacy counterpart** → #6, A35, A110
- `old_src/core/uiTheme.ts` — **legacy counterpart** → #51, A58, A92
- `old_src/core/unitDescriptionHelper.ts` — **legacy counterpart** → #7, #20, A41, A72
- `old_src/core/unitDescriptionTranslations.ts` — **legacy counterpart** → #7, #20, A41, A72
- `old_src/core/unitStatsFormatter.ts` — **legacy counterpart** → #49, A59
- `old_src/core/variantTraits.ts` — **legacy counterpart** → #20, #48, A43
- `old_src/core/vfx.ts` — **legacy-only recovered** → #38, A52, A112
- `old_src/core/viTextSanitizer.ts` — **legacy counterpart** → #7, #20, A41, A72
- `old_src/data/augments.ts` — **legacy counterpart** → #14.15, A46
- `old_src/data/battlefieldEnvironments.ts` — **legacy counterpart** → #12, A32
- `old_src/data/classSkillVariants.ts` — **legacy counterpart** → #16.3-16.5, A41, A70, A76, A89, A119
- `old_src/data/elementInfo.ts` — **legacy counterpart** → #21, A41
- `old_src/data/factionInfo.ts` — **legacy counterpart** → #21, A41
- `old_src/data/forestBackgrounds.ts` — **legacy-only recovered** → #12, A91, A100.1
- `old_src/data/items.ts` — **legacy counterpart** → #14.9-14.11, A40, A69, A80
- `old_src/data/shopRoster.ts` — **legacy counterpart** → #14.5, A69
- `old_src/data/skillRuntime.ts` — **legacy counterpart** → #16.3-16.5, A41, A70, A76, A89, A119
- `old_src/data/skills.ts` — **legacy counterpart** → #16.3-16.5, A41, A70, A76, A89, A119
- `old_src/data/synergies.ts` — **legacy counterpart** → #12, #15, #20-23, #27, A32, A36, A41-A43, A83-A84
- `old_src/data/techTree.ts` — **legacy counterpart** → #14.13, A111
- `old_src/data/tributeCredits.ts` — **legacy counterpart** → #5.4, A55.3
- `old_src/data/tutorialSteps.ts` — **legacy counterpart** → #15, A94, A108
- `old_src/data/unitCatalog.ts` — **legacy counterpart** → #20, A41, A83
- `old_src/data/unitEvolutionNames.ts` — **legacy counterpart** → #23, A90, A109
- `old_src/data/unitHumanSkinRoster.ts` — **legacy-only recovered** → #23, A109, A125.1
- `old_src/data/unitSkins.ts` — **legacy counterpart** → #23, A90, A109
- `old_src/data/unitVisuals.ts` — **legacy counterpart** → #22, #23, A90, A112
- `old_src/documentation-system/babel-traverse.d.ts` — **legacy-only recovered** → A124.1
- `old_src/documentation-system/CodeAnalyzer.ts` — **legacy-only recovered** → A124.1
- `old_src/documentation-system/CommentTranslator.ts` — **legacy-only recovered** → A124.1
- `old_src/documentation-system/DocumentationGenerator.ts` — **legacy-only recovered** → A124.1
- `old_src/documentation-system/DocumentationWriter.ts` — **legacy-only recovered** → A124.1
- `old_src/documentation-system/index.ts` — **legacy-only recovered** → A124.1
- `old_src/documentation-system/models.ts` — **legacy-only recovered** → A124.1
- `old_src/gameModes/EndlessPvEClassicMode.ts` — **legacy counterpart** → #8, A60, A116
- `old_src/gameModes/EndlessPvEFortressMode.ts` — **legacy counterpart** → #28, A48, A117
- `old_src/gameModes/GameModeConfig.ts` — **legacy counterpart** → #8, A60, A116
- `old_src/gameModes/GameModeRegistry.ts` — **legacy counterpart** → #8, A60, A116
- `old_src/gameModes/PVP4FortressMode.ts` — **legacy counterpart** → #30, A48, A100.3
- `old_src/gameModes/PVPMode.ts` — **legacy-only recovered** → #30, A48, A60, A100.3, A116
- `old_src/gameModes/README.integration.md` — **legacy counterpart** → #8, A60, A116
- `old_src/gameModes/README.md` — **legacy counterpart** → #8, A60, A116
- `old_src/gameModes/README.modes.md` — **legacy counterpart** → #8, A60, A116
- `old_src/gameModes/README.overview.md` — **legacy counterpart** → #8, A60, A116
- `old_src/generated/audioTrackIndex.temp.js` — **legacy-only recovered** → #5.4, #32, A55.3, A71, A125.4
- `old_src/generated/tributeGallery.temp.js` — **legacy-only recovered** → #5.4, A55.3, A125.4
- `old_src/i18n/en.ts` — **legacy counterpart** → #7, A72
- `old_src/i18n/index.ts` — **legacy counterpart** → #7, A72
- `old_src/i18n/localeText.ts` — **legacy counterpart** → #7, A72
- `old_src/i18n/three.ts` — **legacy-only recovered** → #7, A72, A125.2
- `old_src/i18n/vi.ts` — **legacy counterpart** → #7, A72
- `old_src/main.ts` — **legacy counterpart** → #4, A115
- `old_src/network/coopCombatSync.ts` — **legacy counterpart** → #29, A47, A114, A118
- `old_src/network/coopConfig.ts` — **legacy counterpart** → #29, A47, A114, A118
- `old_src/network/coopP2PTransport.ts` — **legacy counterpart** → #29, A47, A114, A118
- `old_src/network/coopPeerClient.ts` — **legacy counterpart** → #29, A47, A114, A118
- `old_src/network/coopSession.ts` — **legacy counterpart** → #29, A47, A114, A118
- `old_src/network/pvpFortress.ts` — **legacy counterpart** → #30, A48, A100.3
- `old_src/platform/discordActivity.ts` — **legacy counterpart** → #31, A51
- `old_src/scenes/BoardPrototypeScene.ts` — **legacy-only recovered** → A124.2
- `old_src/scenes/CombatScene.ts` — **legacy-only recovered** → #16-17, A73-A80, A87-A89, A119-A121
- `old_src/scenes/CombatScene.ts.atomic-bak` — **archived snapshot** → #16, A93 (historical conflict evidence only)
- `old_src/scenes/CombatScene.ts.atomic-bak2` — **archived snapshot** → #16, A93 (historical conflict evidence only)
- `old_src/scenes/CombatScene.ts.atomic-bak3` — **archived snapshot** → #16, A93 (historical conflict evidence only)
- `old_src/scenes/CombatScene.ts.atomic-bak4` — **archived snapshot** → #16, A93 (historical conflict evidence only)
- `old_src/scenes/CombatScene.ts.atomic-bak5` — **archived snapshot** → #16, A93 (historical conflict evidence only)
- `old_src/scenes/CombatScene.ts.atomic-bak6` — **archived snapshot** → #16, A93 (historical conflict evidence only)
- `old_src/scenes/CombatScene.ts.atomic-bak7` — **archived snapshot** → #16, A93 (historical conflict evidence only)
- `old_src/scenes/CombatScene.ts.atomic-bak8` — **archived snapshot** → #16, A93 (historical conflict evidence only)
- `old_src/scenes/CombatScene.ts.comp-bak` — **archived snapshot** → #16, A93 (historical conflict evidence only)
- `old_src/scenes/CombatScene.ts.comp-bak2` — **archived snapshot** → #16, A93 (historical conflict evidence only)
- `old_src/scenes/CombatScene.ts.hand-bak` — **archived snapshot** → #16, A93 (historical conflict evidence only)
- `old_src/scenes/CombatScene.ts.hand-bak10` — **archived snapshot** → #16, A93 (historical conflict evidence only)
- `old_src/scenes/CombatScene.ts.hand-bak11` — **archived snapshot** → #16, A93 (historical conflict evidence only)
- `old_src/scenes/CombatScene.ts.hand-bak12` — **archived snapshot** → #16, A93 (historical conflict evidence only)
- `old_src/scenes/CombatScene.ts.hand-bak13` — **archived snapshot** → #16, A93 (historical conflict evidence only)
- `old_src/scenes/CombatScene.ts.hand-bak15` — **archived snapshot** → #16, A93 (historical conflict evidence only)
- `old_src/scenes/CombatScene.ts.hand-bak16` — **archived snapshot** → #16, A93 (historical conflict evidence only)
- `old_src/scenes/CombatScene.ts.hand-bak2` — **archived snapshot** → #16, A93 (historical conflict evidence only)
- `old_src/scenes/CombatScene.ts.hand-bak3` — **archived snapshot** → #16, A93 (historical conflict evidence only)
- `old_src/scenes/CombatScene.ts.hand-bak5` — **archived snapshot** → #16, A93 (historical conflict evidence only)
- `old_src/scenes/CombatScene.ts.hand-bak7` — **archived snapshot** → #16, A93 (historical conflict evidence only)
- `old_src/scenes/CombatScene.ts.hand-bak8` — **archived snapshot** → #16, A93 (historical conflict evidence only)
- `old_src/scenes/CombatScene.ts.hard-bak` — **archived snapshot** → #16, A93 (historical conflict evidence only)
- `old_src/scenes/CoopLobbyScene.ts` — **legacy counterpart** → #29, A47, A114, A118
- `old_src/scenes/FortressMapScene.ts` — **legacy counterpart** → #28, A48, A117
- `old_src/scenes/LazySceneLoaderScene.ts` — **legacy counterpart** → #4, A64, A115
- `old_src/scenes/LoadingScene.ts` — **legacy counterpart** → #4, A64, A115
- `old_src/scenes/MainMenuAchievementsPanel.ts` — **legacy-only recovered** → #27, A36, A104
- `old_src/scenes/MainMenuScene.ts` — **legacy counterpart** → #5, A60, A98, A116
- `old_src/scenes/MainMenuSocialDonate.ts` — **legacy-only recovered** → #5.3, A55.2
- `old_src/scenes/MainMenuTributeGalleryPanel.ts` — **legacy-only recovered** → #5.4, A55.3
- `old_src/scenes/MainMenuUIHelpers.ts` — **legacy-only recovered** → #5, A60, A98, A116, A125.3
- `old_src/scenes/PlanningScene.ts` — **legacy-only recovered** → #14, A75, A85, A86
- `old_src/scenes/sceneLazyRouting.ts` — **legacy counterpart** → #4, A64, A115
- `old_src/scenes/shared/combatActionButtonsRuntime.ts` — **legacy-only recovered** → #16, A119, A120
- `old_src/scenes/shared/combatHudRuntime.ts` — **legacy-only recovered** → #16.16, A68, A88, A95
- `old_src/scenes/shared/combatInputRuntime.ts` — **legacy-only recovered** → #16, A65, A88
- `old_src/scenes/shared/combatResultFlowRuntime.ts` — **legacy-only recovered** → #16.17, A87, A121
- `old_src/scenes/shared/combatSceneConstructorRuntime.ts` — **legacy-only recovered** → #16, A64, A77, A119-A121
- `old_src/scenes/shared/combatTooltipRuntime.ts` — **legacy counterpart** → #26, A96, A122
- `old_src/scenes/shared/fortressServiceModalRuntime.ts` — **legacy-only recovered** → #28, A48, A117
- `old_src/scenes/shared/loadingBubbleMinigameRuntime.ts` — **legacy-only recovered** → #4, A55.1, A97
- `old_src/scenes/shared/lootDropText.ts` — **legacy counterpart** → #17, A40, A121
- `old_src/scenes/shared/planningActionButtonsRuntime.ts` — **legacy-only recovered** → #14, A75, A85, A86
- `old_src/scenes/shared/planningAttackPreviewRuntime.ts` — **legacy-only recovered** → #16.3-16.5, A41, A70, A76, A89, A119
- `old_src/scenes/shared/planningBenchRuntime.ts` — **legacy-only recovered** → #11.6, #14.4, A63, A75, A101.3
- `old_src/scenes/shared/planningBoardChromeRuntime.ts` — **legacy-only recovered** → #11, A2, A63, A75, A91
- `old_src/scenes/shared/planningBoardInteractionRuntime.ts` — **legacy-only recovered** → #11, A2, A63, A75, A91
- `old_src/scenes/shared/planningBoardMetricsRuntime.ts` — **legacy-only recovered** → #11, A2, A63, A75, A91
- `old_src/scenes/shared/planningBoardUiRuntime.ts` — **legacy-only recovered** → #11, A2, A63, A75, A91
- `old_src/scenes/shared/planningCombatCalcRuntime.ts` — **legacy-only recovered** → #16, A31, A56
- `old_src/scenes/shared/planningCombatTransitionRuntime.ts` — **legacy-only recovered** → #14, A75, A85, A86
- `old_src/scenes/shared/planningContextMenuRuntime.ts` — **legacy-only recovered** → #14.17, A85
- `old_src/scenes/shared/planningCoopSessionRuntime.ts` — **legacy-only recovered** → #29, A47, A114, A118
- `old_src/scenes/shared/planningCortisolRuntime.ts` — **legacy-only recovered** → #14.21, A39
- `old_src/scenes/shared/planningCraftRuntime.ts` — **legacy-only recovered** → #14.11, A86
- `old_src/scenes/shared/planningCreativeSandboxRuntime.ts` — **legacy-only recovered** → #14, A75, A85, A86
- `old_src/scenes/shared/planningDescriptionRuntime.ts` — **legacy-only recovered** → #14, A75, A85, A86
- `old_src/scenes/shared/planningDockHeaderLayout.ts` — **legacy-only recovered** → #14, A75, A85, A86
- `old_src/scenes/shared/planningDragRuntime.ts` — **legacy-only recovered** → #14, A75, A85, A86
- `old_src/scenes/shared/planningFormationRuntime.ts` — **legacy-only recovered** → #14, A75, A85, A86
- `old_src/scenes/shared/planningFortressHelpersRuntime.ts` — **legacy-only recovered** → #28, A48, A117
- `old_src/scenes/shared/planningHudRuntime.ts` — **legacy-only recovered** → #14, A75, A85, A86
- `old_src/scenes/shared/planningInputRuntime.ts` — **legacy-only recovered** → #14, A75, A85, A86
- `old_src/scenes/shared/planningInventoryRuntime.ts` — **legacy-only recovered** → #14.9, A69, A86
- `old_src/scenes/shared/planningItemHelpersRuntime.ts` — **legacy-only recovered** → #14.10, A80
- `old_src/scenes/shared/planningLayoutRuntime.ts` — **legacy-only recovered** → #14, A75, A85, A86
- `old_src/scenes/shared/planningLogRuntime.ts` — **legacy-only recovered** → #14.18, #14.19, A38, A107.1, A123
- `old_src/scenes/shared/planningLowerDockPanelChrome.ts` — **legacy-only recovered** → #14, A75, A85, A86
- `old_src/scenes/shared/planningLowerDockPanelLayout.ts` — **legacy-only recovered** → #14, A75, A85, A86
- `old_src/scenes/shared/planningLowerDockRuntime.ts` — **legacy-only recovered** → #14, A75, A85, A86
- `old_src/scenes/shared/planningPersistenceRuntime.ts` — **legacy-only recovered** → #10, A57, A103, A113, A114
- `old_src/scenes/shared/planningPvpSessionRuntime.ts` — **legacy-only recovered** → #30, A48, A100.3
- `old_src/scenes/shared/planningRefreshUiRuntime.ts` — **legacy-only recovered** → #14, A75, A85, A86
- `old_src/scenes/shared/planningResultModalRuntime.ts` — **legacy-only recovered** → #14, A75, A85, A86
- `old_src/scenes/shared/planningRightPanelRuntime.ts` — **legacy-only recovered** → #14, A75, A85, A86
- `old_src/scenes/shared/planningRunStateRuntime.ts` — **legacy-only recovered** → #9, A62, A103, A114
- `old_src/scenes/shared/planningSceneBootstrapRuntime.ts` — **legacy-only recovered** → #14, A75, A85, A86
- `old_src/scenes/shared/planningSceneConstants.ts` — **legacy-only recovered** → #14, A75, A85, A86
- `old_src/scenes/shared/planningSceneConstructorRuntime.ts` — **legacy-only recovered** → #14, A75, A85, A86
- `old_src/scenes/shared/planningSceneDelegateBindings.ts` — **legacy-only recovered** → #14, A75, A85, A86
- `old_src/scenes/shared/planningSceneDelegateManifest.json` — **legacy-only recovered** → #14, A75, A85, A86
- `old_src/scenes/shared/planningSceneLifecycleRuntime.ts` — **legacy-only recovered** → #14, A75, A85, A86
- `old_src/scenes/shared/planningSettingsRuntime.ts` — **legacy-only recovered** → #6, A35, A110
- `old_src/scenes/shared/planningShopActionsRuntime.ts` — **legacy-only recovered** → #14.5, A69
- `old_src/scenes/shared/planningShopRuntime.ts` — **legacy-only recovered** → #14.5, A69
- `old_src/scenes/shared/planningStorageCraftLayout.ts` — **legacy-only recovered** → #14.11, A86
- `old_src/scenes/shared/planningStorageUiRuntime.ts` — **legacy-only recovered** → #14.9, A69, A86
- `old_src/scenes/shared/planningTechRuntime.ts` — **legacy-only recovered** → #14.13, A111
- `old_src/scenes/shared/planningTechTreeModalRuntime.ts` — **legacy-only recovered** → #14.13, A111
- `old_src/scenes/shared/planningTooltipRuntime.ts` — **legacy counterpart** → #26, A96, A122
- `old_src/scenes/shared/planningTopHeaderLayout.ts` — **legacy-only recovered** → #14, A75, A85, A86
- `old_src/scenes/shared/planningTutorialRuntime.ts` — **legacy-only recovered** → #15, A94, A108
- `old_src/scenes/shared/planningUnitInfoRecommendations.ts` — **legacy-only recovered** → #14.16, A85, A96
- `old_src/scenes/shared/planningUnitInfoRuntime.ts` — **legacy-only recovered** → #14.16, A85, A96
- `old_src/scenes/shared/sceneAttackPreview.ts` — **legacy-only recovered** → #16.3-16.5, A41, A70, A76, A89, A119
- `old_src/scenes/shared/sceneAugmentChoiceModal.ts` — **legacy-only recovered** → #14.15, A46
- `old_src/scenes/shared/sceneBoardInputController.ts` — **legacy-only recovered** → #11, A2, A63, A75, A91
- `old_src/scenes/shared/sceneBoardViewport.ts` — **legacy-only recovered** → #11, A2, A63, A75, A91
- `old_src/scenes/shared/sceneCombatActionRuntime.ts` — **legacy-only recovered** → #16, A119, A120
- `old_src/scenes/shared/sceneCombatUnitFactory.ts` — **legacy-only recovered** → #22-24, A90, A92, A112
- `old_src/scenes/shared/sceneCommonSkillCombatEffects.ts` — **legacy-only recovered** → #16.3-16.5, A41, A70, A76, A89, A119
- `old_src/scenes/shared/sceneCommonSkillDefenseEffects.ts` — **legacy-only recovered** → #16.3-16.5, A41, A70, A76, A89, A119
- `old_src/scenes/shared/sceneCommonSkillEffects.ts` — **legacy-only recovered** → #16.3-16.5, A41, A70, A76, A89, A119
- `old_src/scenes/shared/sceneCommonSkillEffectUtils.ts` — **legacy-only recovered** → #16.3-16.5, A41, A70, A76, A89, A119
- `old_src/scenes/shared/sceneCommonSkillUtilityEffects.ts` — **legacy-only recovered** → #16.3-16.5, A41, A70, A76, A89, A119
- `old_src/scenes/shared/sceneDamageAftermathRuntime.ts` — **legacy-only recovered** → #16.10, A74, A120
- `old_src/scenes/shared/sceneDisplayRuntime.ts` — **legacy-only recovered** → #6.2, #54, A58, A66
- `old_src/scenes/shared/sceneEquipmentRuntime.ts` — **legacy-only recovered** → #14.10, A80
- `old_src/scenes/shared/sceneHealBlockRuntime.ts` — **legacy-only recovered** → #16.11, A70, A120
- `old_src/scenes/shared/sceneHealUnitRuntime.ts` — **legacy-only recovered** → #16.11, A70, A120
- `old_src/scenes/shared/sceneHistoryModalRuntime.ts` — **legacy-only recovered** → #14.18, #14.19, A38, A107.1, A123
- `old_src/scenes/shared/sceneLogRuntime.ts` — **legacy-only recovered** → #14.18, #14.19, A38, A107.1, A123
- `old_src/scenes/shared/sceneOffensiveMageEffects.ts` — **legacy-only recovered** → #16.3-16.5, A70, A76, A89
- `old_src/scenes/shared/sceneOffensiveMeleeEffects.ts` — **legacy-only recovered** → #16.2-16.5, A70, A76, A89, A119
- `old_src/scenes/shared/sceneOffensiveRangedEffects.ts` — **legacy-only recovered** → #16.2-16.5, A70, A76, A89, A119
- `old_src/scenes/shared/sceneOffensiveSkillEffects.ts` — **legacy-only recovered** → #16.3-16.5, A41, A70, A76, A89, A119
- `old_src/scenes/shared/sceneRolePassiveRuntime.ts` — **legacy-only recovered** → #16.7, A78
- `old_src/scenes/shared/sceneSettingsOverlayRuntime.ts` — **legacy-only recovered** → #6, A35, A110
- `old_src/scenes/shared/sceneSkillPreviewCells.ts` — **legacy-only recovered** → #16.3-16.5, A41, A70, A76, A89, A119
- `old_src/scenes/shared/sceneSkillPreviewRuntime.ts` — **legacy-only recovered** → #16.3-16.5, A41, A70, A76, A89, A119
- `old_src/scenes/shared/sceneSkillTargeting.ts` — **legacy-only recovered** → #16.3-16.5, A41, A70, A76, A89, A119
- `old_src/scenes/shared/sceneSkillVisualPlan.ts` — **legacy-only recovered** → #16.3-16.5, A41, A70, A76, A89, A119
- `old_src/scenes/shared/sceneStatusTurnRuntime.ts` — **legacy-only recovered** → #16.8, A73, A79, A92, A120
- `old_src/scenes/shared/sceneSupportSkillEffects.ts` — **legacy-only recovered** → #16.3-16.5, A41, A70, A76, A89, A119
- `old_src/scenes/shared/synergyTooltipRuntime.ts` — **legacy counterpart** → #26, A96, A122
- `old_src/scenes/shared/tooltipStatusRuntime.ts` — **legacy counterpart** → #26, A96, A122
- `old_src/scenes/shared/tooltipTheme.ts` — **legacy counterpart** → #26, A96, A122
- `old_src/scenes/shared/unitTooltipRuntimeShared.ts` — **legacy-only recovered** → #26, A96, A122
- `old_src/scenes/ThreeDemoScene.ts` — **legacy-only recovered** → A124.2
- `old_src/styles.css` — **legacy counterpart** → #2.3, #51, A58
- `old_src/systems/AISystem.ts` — **legacy counterpart** → #14, #16, #18, A31
- `old_src/systems/AITargeting.ts` — **legacy counterpart** → #16.4, #18, A33, A76
- `old_src/systems/AITeamGeneration.ts` — **legacy counterpart** → #18, #19, A33
- `old_src/systems/AugmentSystem.ts` — **legacy counterpart** → #14.15, A46
- `old_src/systems/AutoMerge.ts` — **legacy counterpart** → #14.8, A81
- `old_src/systems/BoardBenchOps.ts` — **legacy counterpart** → #11.6, #14.4, A63, A75, A101.3
- `old_src/systems/BoardSystem.ts` — **legacy counterpart** → #11, A2, A63, A75, A91
- `old_src/systems/combat/combatDamageRuntime.ts` — **legacy counterpart** → #16.10, A74, A120
- `old_src/systems/combat/combatResolutionRuntime.ts` — **legacy counterpart** → #16, A119, A120
- `old_src/systems/combat/combatStatusRuntime.ts` — **legacy counterpart** → #16.8, A73, A79, A92, A120
- `old_src/systems/combat/combatTurnRuntime.ts` — **legacy counterpart** → #16, A119, A120
- `old_src/systems/CombatSystem.ts` — **legacy counterpart** → #16, A119, A120
- `old_src/systems/DefaultEffectHandlers.ts` — **legacy-only recovered** → #16, A70, A125.5
- `old_src/systems/DifficultyValidator.ts` — **legacy counterpart** → #18, A33, A102
- `old_src/systems/ShopSystem.ts` — **legacy counterpart** → #14.5, A69
- `old_src/systems/StatusEffectHandlers.ts` — **legacy counterpart** → #16.8, A73, A79, A92, A120
- `old_src/systems/SynergyCalculator.ts` — **legacy counterpart** → #14.14, A82
- `old_src/systems/SynergySystem.ts` — **legacy counterpart** → #14.14, A82
- `old_src/systems/UpgradeMergeRuntime.ts` — **legacy counterpart** → #14.8, A81
- `old_src/systems/UpgradeSystem.ts` — **legacy counterpart** → #14.8, A81
- `old_src/three/index.ts` — **legacy counterpart** → #4, #37, Appendix C
- `old_src/three/ThreeApp.ts` — **legacy-only recovered** → #4, A52, A58, A64, A91, A115
- `old_src/three/ThreeBoard.ts` — **legacy-only recovered** → #11, A2, A63, A75, A91
- `old_src/three/ThreeBoardInputController.ts` — **legacy-only recovered** → #11, A2, A63, A75, A91
- `old_src/three/ThreeBoardRenderer.ts` — **legacy-only recovered** → #11, A2, A63, A75, A91
- `old_src/three/ThreeBoardViewport.ts` — **legacy-only recovered** → #11, A2, A63, A75, A91
- `old_src/three/ThreeCameraManager.ts` — **legacy-only recovered** → #13, A58, A91
- `old_src/three/ThreeCombatActionButtonsRuntime.ts` — **legacy-only recovered** → #16, A119, A120
- `old_src/three/ThreeCombatHudRuntime.ts` — **legacy-only recovered** → #16.16, A68, A88, A95
- `old_src/three/ThreeCombatQueue.ts` — **legacy-only recovered** → #16, A119, A120
- `old_src/three/ThreeCombatScene.ts` — **legacy-only recovered** → #16-17, A64, A87-A89, A91-A92, A119-A121
- `old_src/three/ThreeEmojiAtlas.ts` — **legacy-only recovered** → #36, A61
- `old_src/three/ThreeForestProps.ts` — **legacy-only recovered** → #11, #12, A91, A100.1
- `old_src/three/ThreeFortressServiceModalRuntime.ts` — **legacy-only recovered** → #28, A48, A117
- `old_src/three/ThreeFxPool.ts` — **legacy-only recovered** → #38, A52, A112
- `old_src/three/ThreeGameConfig.ts` — **legacy-only recovered** → #4, #8, A58, A64
- `old_src/three/ThreeGamepadController.ts` — **legacy-only recovered** → #34, A49, A65, A105
- `old_src/three/ThreeHealUnitRuntime.ts` — **legacy-only recovered** → #16.11, A70, A120
- `old_src/three/ThreeKeyboardBindings.ts` — **legacy-only recovered** → #34, A44, A110
- `old_src/three/ThreeLazySceneLoaderScene.ts` — **legacy-only recovered** → #4, A64, A115
- `old_src/three/ThreeLighting.ts` — **legacy-only recovered** → #11, #12, A91, A100.1
- `old_src/three/ThreeLoadingScene.ts` — **legacy-only recovered** → #4, A64, A115
- `old_src/three/ThreeMainMenuAchievementsPanel.ts` — **legacy-only recovered** → #27, A36, A104
- `old_src/three/ThreeMainMenuScene.ts` — **legacy-only recovered** → #5, A60, A98, A116
- `old_src/three/ThreeMainMenuSocialDonate.ts` — **legacy-only recovered** → #5.3, A55.2
- `old_src/three/ThreeMainMenuTributeGalleryPanel.ts` — **legacy-only recovered** → #5.4, A55.3
- `old_src/three/ThreeMainMenuUIHelpers.ts` — **legacy-only recovered** → #5, A60, A98, A116
- `old_src/three/ThreePlanningActionButtonsRuntime.ts` — **legacy-only recovered** → #14, A75, A85, A86
- `old_src/three/ThreePlanningDockHeaderLayout.ts` — **legacy-only recovered** → #14, A75, A85, A86
- `old_src/three/ThreePlanningFortressHelpersRuntime.ts` — **legacy-only recovered** → #28, A48, A117
- `old_src/three/ThreePlanningScene.ts` — **legacy-only recovered** → #14, A75, A85, A86
- `old_src/three/ThreePlanningTopHeaderLayout.ts` — **legacy-only recovered** → #14, A75, A85, A86
- `old_src/three/ThreeSceneLazyRouting.ts` — **legacy-only recovered** → #4, A64, A115
- `old_src/three/ThreeSceneManager.ts` — **legacy-only recovered** → #4, A64, A115
- `old_src/three/ThreeStarVisualEffectFactory.ts` — **legacy-only recovered** → #22, #23, A90, A112
- `old_src/three/ThreeStatusTurnRuntime.ts` — **legacy-only recovered** → #16.8, A73, A79, A92, A120
- `old_src/three/ThreeUiResponsive.ts` — **legacy-only recovered** → #54, A58
- `old_src/three/ThreeUnitAvatarRenderer.ts` — **legacy-only recovered** → #22-24, A90, A92, A112
- `old_src/three/ThreeUnitFactory.ts` — **legacy-only recovered** → #22-24, A90, A92, A112
- `old_src/three/ThreeVfx.ts` — **legacy-only recovered** → #38, A52, A112
- `old_src/three/types.ts` — **legacy-only recovered** → #2.1, #22, Appendix C
- `old_src/ui/AttackPreview.ts` — **legacy counterpart** → #16.3-16.5, A41, A70, A76, A89, A119
- `old_src/ui/backgroundCover.ts` — **legacy-only recovered** → #14, #25-26, #40, #51, A58, A96, A107-A111, A122-A123, A125.3
- `old_src/ui/BoardRenderer.ts` — **legacy counterpart** → #11, A2, A63, A75, A91
- `old_src/ui/buttonEmojiLabels.ts` — **legacy counterpart** → #36, A61
- `old_src/ui/displayObjectGuards.ts` — **legacy-only recovered** → #14, #25-26, #40, #51, A58, A96, A107-A111, A122-A123, A125.3
- `old_src/ui/HistoryModal.ts` — **legacy-only recovered** → #14.18, #14.19, A38, A107.1, A123
- `old_src/ui/keyboardShortcuts.ts` — **legacy-only recovered** → #34, A44, A110
- `old_src/ui/KeyboardShortcutsSubview.ts` — **legacy-only recovered** → #34, A44, A110
- `old_src/ui/lazyLoaders.ts` — **legacy-only recovered** → #14, #25-26, #40, #51, A58, A96, A107-A111, A122-A123, A125.3
- `old_src/ui/LibraryBattlePreview.ts` — **legacy counterpart** → #25, A107.2, A109
- `old_src/ui/LibraryModal.ts` — **legacy counterpart** → #25, A107.2, A109
- `old_src/ui/LibraryModalFilters.ts` — **legacy-only recovered** → #25, A107.2, A109
- `old_src/ui/libraryPreviewRuntime.ts` — **legacy counterpart** → #25, A107.2, A109
- `old_src/ui/LibraryRenderers.ts` — **legacy-only recovered** → #25, A107.2, A109
- `old_src/ui/PaginationControls.ts` — **legacy-only recovered** → #25, A107.4, A125.3
- `old_src/ui/RecipeDiagram.ts` — **legacy counterpart** → #14.12, A69, A106
- `old_src/ui/RecipeLibraryCraftGrid.ts` — **legacy-only recovered** → #14.12, A69, A106
- `old_src/ui/RecipeLibraryDetail.ts` — **legacy-only recovered** → #14.12, A69, A106
- `old_src/ui/RecipeLibraryPanel.ts` — **legacy-only recovered** → #14.12, A69, A106
- `old_src/ui/recipeLocalization.ts` — **legacy counterpart** → #14.12, A69, A106
- `old_src/ui/runeterraUnitCard.ts` — **legacy-only recovered** → #14.6, #25, A59
- `old_src/ui/SceneButton.ts` — **legacy-only recovered** → #14, #25-26, #40, #51, A58, A96, A107-A111, A122-A123, A125.3
- `old_src/ui/SettingsOverlay.ts` — **legacy-only recovered** → #6, A35, A110
- `old_src/ui/SettingsPanel.ts` — **legacy-only recovered** → #6, A35, A110
- `old_src/ui/SettingsStepperControls.ts` — **legacy-only recovered** → #6, A35, A110
- `old_src/ui/SkillPreview.ts` — **legacy-only recovered** → #16.3-16.5, A41, A70, A76, A89, A119
- `old_src/ui/TechTreeInfoPanel.ts` — **legacy-only recovered** → #14.13, A111
- `old_src/ui/techTreeLayout.ts` — **legacy counterpart** → #14.13, A111
- `old_src/ui/TechTreeModal.ts` — **legacy-only recovered** → #14.13, A111
- `old_src/ui/TutorialOverlay.ts` — **legacy counterpart** → #15, A94, A108
- `old_src/ui/tutorialProgress.ts` — **legacy counterpart** → #15, A94, A108
- `old_src/ui/tutorialTargetResolver.ts` — **legacy counterpart** → #15, A94, A108
- `old_src/ui/unitAvatarRenderer.ts` — **legacy counterpart** → #22-24, A90, A92, A112
- `old_src/ui/VersionInfoModal.ts` — **legacy-only recovered** → #1, #41, A51
- `old_src/visuals/sceneHitLowHpRuntime.ts` — **legacy-only recovered** → #23, #38, A112
- `old_src/visuals/sceneVisualPolish.ts` — **legacy-only recovered** → #23, #38, A112
- `old_src/visuals/starVisualEffectFactory.ts` — **legacy-only recovered** → #22, #23, A90, A112
- `old_src/visuals/starVisualPresetRegistry.ts` — **legacy counterpart** → #22, #23, A90, A112
- `old_src/visuals/starVisualTypes.ts` — **legacy counterpart** → #22, #23, A90, A112
- `old_src/visuals/unitStarEvolution.ts` — **legacy-only recovered** → #23, #38, A90, A112
- `old_src/visuals/unitStarVisualIdentity.ts` — **legacy counterpart** → #22, #23, A90, A112
- `old_src/visuals/visualRegistry.ts` — **legacy-only recovered** → #22, #23, A90, A112

## D3. Ledger acceptance rule

Before implementation begins, Opus must keep this census mechanically checkable. If either tree changes, regenerate/reconcile the ledger and explain every added, removed or renamed path. A file may be marked folded/legacy/data-only, but it may not disappear from the audit merely because its implementation is obsolete. For legacy counterparts, inspect behavioral deltas before deciding the newer canonical contract already covers them. Any newly discovered player-visible, stateful, content, network, platform or developer-tool behavior must be added to the appropriate normative section before that file can be considered covered.

Turn this ledger into a working **source-recovery matrix with one row per actual file**. Every row must record at least:

`path | disposition | behavior/data discovered | delta vs current authority | normative contract | rebuild target | verification evidence`.

Rules for that matrix:

1. The row count must equal the live filesystem census. At the baseline represented by this document that is **813/813**.
2. Do not mark a file covered merely because its filename appears in Appendix D. Read the file, or for a binary/static asset inspect its actual role/provenance from its loaders/consumers.
3. `legacy counterpart` requires an explicit delta judgment: `no semantic delta`, or a short description of the behavior/data that must be recovered elsewhere.
4. `legacy-only recovered` requires a concrete rebuild target or a documented compatibility/data/tooling replacement. “Obsolete” by itself is not an implementation target.
5. `archived snapshot` may remain non-production only after checking that it does not contain a distinct capability absent from canonical source/contracts. The 23 CombatScene backups have the method-surface evidence recorded in D0; repeat deeper comparison if canonical Combat is materially rewritten before parity closure.
6. Generated files count. Font/license/static-data files count. JSON manifests count. Developer tooling counts. A file does not disappear from the proof obligation because it is not imported at runtime.
7. When two files implement the same capability, point both rows to one canonical rebuild target and explain which implementation is authoritative; do not create duplicate live state machines just to mirror source structure.
8. Before declaring the rebuild complete, regenerate the census and report `actual`, `matrix/ledger`, `missing`, `stale`, and `duplicate` counts. Required completion state is zero missing/stale/duplicate paths, plus observable verification for every meaningful capability row.
<!-- SOURCE_TRACEABILITY_LEDGER_END -->
---

# 57. FINAL INSTRUCTION TO OPUS 5.5

Treat this document as the minimum complete product contract, not a list of optional ideas.

You are encouraged to replace the current visual hierarchy, art composition, animation staging, layout, and presentation code when doing so produces a stronger game. You are not allowed to simplify the rebuild by dropping systems that are difficult to present.

Before broad changes, build a capability matrix from this specification. Keep the game runnable through each major vertical slice and verify real player behavior at each stage. At the end, prove every Definition of Done checkbox with observable behavior and targeted verification.

The target is not merely the same game with a superficial reskin.

The target is **Forest Throne rebuilt as a visually coherent, expressive, production-grade 3D tactical game while retaining its complete product capability.**
