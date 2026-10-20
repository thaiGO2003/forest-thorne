# WBS-013: Bilingual Localization Engine (Vietnamese/English)

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-013 · Phase FOUNDATION
- **Nhánh đích:** `feat/foundation/bilingual-localization-engine-vietnamese-english`
- **Tham chiếu:** `§7, A55, A72`
- **Phụ thuộc:** Deps: WBS-001
- **Trạng thái WBS:** Hoàn thành (WBS)

## Nội dung
- [x] **WBS-013: Bilingual Localization Engine (Vietnamese/English)** `§7, A55, A72` *(Deps: WBS-001)*
  - **Mô tả:** Hệ thống từ điển song ngữ tiếng Việt & tiếng Anh với helper t(key, params). Bảo tồn chính xác các placeholder token ({val}, {star}, {gold},...). Đồng bộ key parity 100% giữa 2 ngôn ngữ.
  - **Tiêu chí nghiệm thu:** Chuyển đổi ngôn ngữ live không làm mất placeholder; kiểm tra tự động parity key.
  - **Audit Note:** ✓ Verify-foundation audit refreshed 2026-10-14: `tests/i18n.test.ts` still proves VI/EN key parity and now also locks player-facing graphics quality (`quality.high`: `Cao` / `High`) plus localized Mod package/source metadata values so raw enum identifiers do not leak through that modal.
