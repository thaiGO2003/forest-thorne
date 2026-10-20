# WBS-089: Performance Profiler & Adaptive Quality (30/60 FPS)

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-089 · Phase POLISH
- **Nhánh đích:** `chore/polish/performance-profiler-adaptive-quality-30-60-fps`
- **Tham chiếu:** `§49, A30, A52`
- **Phụ thuộc:** Deps: WBS-036, WBS-045
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-089: Performance Profiler & Adaptive Quality (30/60 FPS)** `§49, A30, A52` *(Deps: WBS-036, WBS-045)*
  - **Mô tả:** Instrument frame/render timing, unit/mesh counts, expensive-effect counts và cleanup/leak signals; adaptive quality có thể giảm particle density, shadow resolution và chọn 30/60 FPS/battery policy theo device health.
  - **Tiêu chí nghiệm thu:** Duy trì tối thiểu 30 FPS trên target thấp; quality scaling không đổi gameplay timing/outcome; profiler giúp phát hiện duplicate previews/browser contexts/asset copies và transient-object leaks.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: profiler instrumentation, render/effect counts and adaptive visual quality are performance tooling/presentation; A30/A52 require them not to change gameplay timing or outcomes.
