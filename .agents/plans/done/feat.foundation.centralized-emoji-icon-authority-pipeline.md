# WBS-015: Centralized Emoji & Icon Authority Pipeline

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-015 · Phase FOUNDATION
- **Nhánh đích:** `feat/foundation/centralized-emoji-icon-authority-pipeline`
- **Tham chiếu:** `§36, A61, AGENTS.md`
- **Phụ thuộc:** Deps: WBS-001
- **Trạng thái WBS:** Hoàn thành (WBS)

## Nội dung
- [x] **WBS-015: Centralized Emoji & Icon Authority Pipeline** `§36, A61, AGENTS.md` *(Deps: WBS-001)*
  - **Mô tả:** Pipeline semantic icon/emoji thống nhất: normalize semantic name/Unicode alias, fallback Unicode tức thì, metadata lookup tùy chọn qua emoji-api.com với `VITE_EMOJI_API_KEY`, cache cả lookup thành công/thất bại, và shared Three.js texture cache cho world-space emoji.
  - **Tiêu chí nghiệm thu:** Không cần API key/network vẫn render đúng; unknown text fallback an toàn; variation-selector alias dùng chung texture key; headless không crash; dispose atlas giải phóng texture, xóa cache và reset readiness; tuyệt đối không commit API key.
  - **Audit Note:** ✓ Coverage audit 2026-10-04: A61 được map vào owner hiện hữu; `src/core/emojiIcon.ts` và `tests/emojiIcon.test.ts` đã có semantic fallback, API cache, Three texture reuse/headless/disposal coverage.
