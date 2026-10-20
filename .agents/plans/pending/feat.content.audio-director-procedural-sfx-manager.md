# WBS-080: Audio Director & Procedural SFX Manager

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-080 · Phase CONTENT
- **Nhánh đích:** `feat/content/audio-director-procedural-sfx-manager`
- **Tham chiếu:** `§32, A29, A45, A71`
- **Phụ thuộc:** Deps: WBS-012
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-080: Audio Director & Procedural SFX Manager** `§32, A29, A45, A71` *(Deps: WBS-012)*
  - **Mô tả:** Audio director quản lý music/ambient/UI/combat SFX với setting/mute độc lập, BGM transition theo context, ambient forest world presentation và procedural fallback khi thiếu asset.
  - **Tiêu chí nghiệm thu:** Audio permission/resume failure không crash; attack/skill SFX trigger từ semantic action/impact events nên game-speed changes không làm lệch tiếng khỏi visual impact.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: audio categories, permission/resume handling, BGM/ambient/SFX playback and impact synchronization are presentation/audio lifecycle. Semantic combat events remain the gameplay source of truth.
- **Acceptance implementation review (2026-10-21):** Thêm `ambientEnabled`, `uiSfxEnabled`, `combatSfxEnabled` vào normalized/persisted settings với legacy defaults bật; Settings hiển thị mute riêng cho music, ambient, UI SFX, combat SFX. `ForestAmbience.ts` tôn trọng ambient mute; `SoundEffects.ts` phân loại UI/combat events, tắt giọng procedural đang phát khi mute category. Regression tests bao gồm ambient recovery, độc lập UI/combat sample mute, settings reload và semantic attack/skill events tại animation impact.
- **Verification (2026-10-21):** Integration targeted `pnpm exec vitest run tests/audio-ambient.test.ts tests/audio-sfx.test.ts tests/audio-music.test.ts tests/audio-modal-lifecycle.test.ts tests/recovered-playback.test.ts tests/persistence.test.ts` → 6 files / 59 tests PASS; `pnpm typecheck` PASS; `pnpm build` PASS (94 modules). BrowserPanel Settings hiển thị bốn nhóm controls; Combat SFX `Bật → Tắt → Bật` giữ music/ambient/UI SFX bật. Đây là visual/control-state evidence, **không** phải audible playback evidence.
- **Acceptance còn thiếu:** Chưa nghe/đo thực tế music/ambience/SFX, chưa xác minh AudioContext permission/resume failure qua browser, hoặc so khớp audio impact với pixel impact tại từng game-speed. Sample player đang phát không có API hủy, nên mute có thể không cắt tức thì external sample hiện hữu. **Giữ pending** đến khi có bằng chứng runtime phù hợp.
