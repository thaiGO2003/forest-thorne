# WBS-093: Production Release Checklist & Clean Cutover Sign-off

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-093 · Phase POLISH
- **Nhánh đích:** `chore/polish/production-release-checklist-clean-cutover-sign-off`
- **Tham chiếu:** `§56, §57, A54, A99`
- **Phụ thuộc:** Deps: WBS-090, WBS-091, WBS-092
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-093: Production Release Checklist & Clean Cutover Sign-off** `§56, §57, A54, A99` *(Deps: WBS-090, WBS-091, WBS-092)*
  - **Mô tả:** Release sign-off đối chiếu toàn bộ Mega Prompt, dọn temporary/dead paths và kiểm tra clean Three.js cutover; mọi conflict legacy/prototype phải collapse về một canonical rule trước khi ship.
  - **Tiêu chí nghiệm thu:** Thỏa Definition of Done và A99 completeness gate: từng subsystem có explicit trigger/state/legality/success+no-op mutation/feedback/persistence/mode differences/cleanup cùng mọi numeric boundary/default/tie-break liên quan; không còn hai behavior cạnh tranh cho cùng feature.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: A54/A99 are cross-cutting release gates spanning presentation, networking, tooling and gameplay; this is release-signoff work, not an independently implementable gameplay subsystem.
