# WBS-102: Developer Source Documentation & Unit Visual-QA Tools

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-102 · Phase AUTHORITY COVERAGE
- **Nhánh đích:** `feat/authority/developer-source-documentation-unit-visual-qa-tools`
- **Tham chiếu:** `A124`
- **Phụ thuộc:** Deps: WBS-002, WBS-038, WBS-039, WBS-073
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-102: Developer Source Documentation & Unit Visual-QA Tools** `A124` *(Deps: WBS-002, WBS-038, WBS-039, WBS-073)*
  - **Mô tả:** Developer-only workflows: source documentation assistant có scan/exclusion/priority, structural report, localized header/JSDoc/comment proposals, translation-preserving technical tokens và dry-run/write modes; unit visual-QA preview dùng production resolver/controller để inspect canonical unit/boss 1★/2★/3★, skins và action states mà không tạo/mutate gameplay run.
  - **Tiêu chí nghiệm thu:** Parse/file failure isolated; write validates JSDoc, preserves original and rolls back only failed file while continuing; totals/status không report false success. Visual QA exposes unknown id/missing action/broken anatomy/fallback visibly và disposes temporary scene/model/audio/VFX/input on close/change.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: A124 is developer workflow/visual-QA tooling. It intentionally sits outside this gameplay-logic pass and must reuse production resolvers rather than create new gameplay behavior.
