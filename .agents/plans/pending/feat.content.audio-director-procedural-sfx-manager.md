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
