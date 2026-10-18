# WBS-082: User Mod Management & Validation Engine

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-082 · Phase CONTENT
- **Nhánh đích:** `feat/content/user-mod-management-validation-engine`
- **Tham chiếu:** `§35, A28, A50, A67.4`
- **Phụ thuộc:** Deps: WBS-011, WBS-050
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-082: User Mod Management & Validation Engine** `§35, A28, A50, A67.4` *(Deps: WBS-011, WBS-050)*
  - **Mô tả:** Public mod surface cho `.ftunit`/`.ftlogic`/`.ftmodpack` và optional CSV/import content: manifest/version validation, deterministic registration, same validation contract như built-in content, quoted-field-safe parsing và management state enabled/source/version/dependencies/conflicts/reload.
  - **Tiêu chí nghiệm thu:** Bad mod/import bị reject và error-isolated không corrupt base catalog/run; conflict được report deterministic; loader không trực tiếp mutate active-run internals; CSV parser giữ commas/quotes/empty fields đúng chuẩn.
  - **Audit Note:** ⚠ Re-audit 2026-10-14: a canonical owner now exists at `src/mods/ModRegistry.ts`. `ModManager.importLocalPackage(...)` validates and deterministically appends `.ftunit` / `.ftlogic` / `.ftmodpack`, forces local source metadata, rejects unsupported extension / malformed JSON / invalid manifest / duplicate ID atomically, and the fullscreen Mods UI exposes the matching local file chooser without executing packages. Focused `tests/mod-registry.test.ts` coverage passes, and player-facing package/source metadata is localized. WBS-082 stays unchecked because the broader authored contract still includes dependency/conflict/load-order/reload management and optional quoted-field-safe CSV import, which this slice does not claim.
