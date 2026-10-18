# WBS-101: Combat Aftermath, Status Turns & Reactive Auto-Cast

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-101 · Phase AUTHORITY COVERAGE
- **Nhánh đích:** `feat/authority/combat-aftermath-status-turns-reactive-auto-cast`
- **Tham chiếu:** `A120`
- **Phụ thuộc:** Deps: WBS-019, WBS-020, WBS-021, WBS-022
- **Trạng thái WBS:** Hoàn thành (WBS)

## Nội dung
- [x] **WBS-101: Combat Aftermath, Status Turns & Reactive Auto-Cast** `A120` *(Deps: WBS-019, WBS-020, WBS-021, WBS-022)*
  - **Mô tả:** Canonical post-damage pipeline cho rage, burn/poison/lifesteal, reflect/counter, Phoenix revive/death, berserk kill chain, start-of-turn DOT/HOT/disease/environment aura và Tanker/Support rage auto-cast.
  - **Tiêu chí nghiệm thu:** Reflect true-damage/force-hit/no-recursion; burn/poison refresh ≥2 turns giữ damage mạnh hơn; revive default 30% clamped 1..100% và one-shot; DOT không grant rage/reflect; status skips đúng freeze/stun/sleep/death; auto-cast revalidate trước consume rage, dùng normal cast pipeline và clear in-flight latch trong `finally`.
  - **Audit Note:** ✅ Logic-only completion re-verified 2026-10-09: A73/A74/A120 authored reactions remain materialized on canonical `Fighter` state. Reflect now stores independent percentages per damage type, including mixed Pangolin physical/magic reflect; its offense-debuff rider only runs after a matching positive reflect while the attacker survives, and lethal reflect prevents counter/lifesteal from running through death. Authored gradual max-HP healing is parsed separately from immediate heal, distributed across its authored duration, stored as canonical timed `hot`, and resolved through the shared heal path at the start of a living recipient turn before that unit acts. Counter, Phoenix one-shot rebirth, Berserk and deferred TANKER/SUPPORT auto-cast semantics remain intact. Targeted `skills+combat` = 37/37 and typecheck passed. A new 1DevTool BrowserPanel smoke could not be completed because `browser_navigate` timed out while the mounted automation tab itself remained ready; the previously recorded production Vite SSR counter smoke remains the latest live runtime evidence.
