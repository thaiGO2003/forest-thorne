# WBS-027: Combat Action Staging & Visual Sync Timing

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-027 · Phase COMBAT
- **Nhánh đích:** `feat/combat/combat-action-staging-visual-sync-timing`
- **Tham chiếu:** `§16.13, A16, A112, A119`
- **Phụ thuộc:** Deps: WBS-019
- **Trạng thái WBS:** Hoàn thành (WBS)

## Nội dung
- [x] **WBS-027: Combat Action Staging & Visual Sync Timing** `§16.13, A16, A112, A119` *(Deps: WBS-019)*
  - **Mô tả:** Định thời diễn hoạt đòn đánh: tiếp cận cận chiến (140ms lướt, 35ms impact chém, 45ms dư chấn, 140ms lùi về), sát thủ nhảy ra sau lưng, đồng bộ chính xác thời điểm trừ máu ở khoảnh khắc va chạm.
  - **Tiêu chí nghiệm thu:** Không trừ máu trước khi hoạt ảnh chạm đích; giữ tính nhất quán giữa simulation và presentation.
  - **Audit Note:** ✅ Logic-only completion 2026-10-05: `src/core/combatStaging.ts` + `src/core/gameSpeed.ts` expose renderer-neutral A119 melee/Assassin phase timing and semantic impact metadata while combat remains deterministic/synchronous; Assassin staging never mutates canonical coordinates. Targeted `combat-staging+combat` 12/12 pass, typecheck pass, and production SSR smoke verified impact/total timing plus 6× display scaling. Animation playback/VFX/rendering consumers remain presentation-only and are not claimed by this headless completion.
