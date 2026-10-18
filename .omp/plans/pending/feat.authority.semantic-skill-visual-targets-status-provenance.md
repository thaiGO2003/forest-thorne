# WBS-099: Semantic Skill Visual Targets & Status Provenance

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-099 · Phase AUTHORITY COVERAGE
- **Nhánh đích:** `feat/authority/semantic-skill-visual-targets-status-provenance`
- **Tham chiếu:** `A89`
- **Phụ thuộc:** Deps: WBS-021, WBS-022, WBS-044, WBS-045, WBS-051
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-099: Semantic Skill Visual Targets & Status Provenance** `A89` *(Deps: WBS-021, WBS-022, WBS-044, WBS-045, WBS-051)*
  - **Mô tả:** Skill preview/VFX nhận visual-target plan từ cùng star-aware semantic target rules của Combat; resolve primary target trước, apply target/area star bonus đúng family, bỏ dead/inactive visuals và dedupe stable uid. Status mutation snapshot trước/so sánh sau để ghi source skill/unit/star khi state thực sự thay đổi.
  - **Tiêu chí nghiệm thu:** Animation/VFX không reroll/reselect target; visual affected-unit set không nói dối gameplay; unchanged statuses giữ provenance cũ; tooltip ưu tiên source-skill/current-star summary + current turns/value và fallback generic khi không resolve source.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: implemented the headless A89 provenance slice in `src/core/combat.ts`: timed statuses may carry canonical source skill/unit/base/star plus resulting turns/value; provenance updates only when merged status state changes and weaker/shorter reapplication retains the previous source. Focused regressions cover stronger-source replacement and unchanged-source retention. The semantic visual-target plan and tooltip/VFX consumers remain presentation-facing/missing, so WBS-099 stays unchecked.
