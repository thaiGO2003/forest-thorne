# WBS-051: Universal Viewport Tooltip Engine

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-051 · Phase UI
- **Nhánh đích:** `feat/ui/universal-viewport-tooltip-engine`
- **Tham chiếu:** `§26, A23, A67.1, A96, A122`
- **Phụ thuộc:** Deps: WBS-049, WBS-050
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-051: Universal Viewport Tooltip Engine** `§26, A23, A67.1, A96, A122` *(Deps: WBS-049, WBS-050)*
  - **Mô tả:** Một tooltip behavior dùng chung cho unit/synergy/Planning/Combat với modes off/compact/summary/expanded; hỗ trợ portrait, stats, HP/rage meters, real status chips, skill text và mobile pinning.
  - **Tiêu chí nghiệm thu:** Tooltip luôn nằm trong usable viewport, flip/reposition khi overflow, không click-through khi pinned; hover-out/source destroy/modal close/scene teardown cleanup sạch; speech optional fail-silent.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: tooltip layout/pinning/lifecycle/speech are presentation behavior. Tooltip content must read canonical combat/catalog state rather than introduce a second gameplay resolver.
