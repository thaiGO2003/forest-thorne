# WBS-022: Data-Driven Skill Parser & Execution Pipeline

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-022 · Phase COMBAT
- **Nhánh đích:** `feat/combat/data-driven-skill-parser-execution-pipeline`
- **Tham chiếu:** `§16.6, §46, A41, A83`
- **Phụ thuộc:** Deps: WBS-002, WBS-019
- **Trạng thái WBS:** Hoàn thành (WBS)

## Nội dung
- [x] **WBS-022: Data-Driven Skill Parser & Execution Pipeline** `§16.6, §46, A41, A83` *(Deps: WBS-002, WBS-019)*
  - **Mô tả:** Trình phân tích cú pháp biểu thức tiếng Việt trong starDetailVi thành cấu trúc SkillSpec (damage formula, type, heal, shield, buff, debuff, DoT, control). Độ phủ đạt 119/125 skills.
  - **Tiêu chí nghiệm thu:** Không làm méo mó văn bản gốc; parse chính xác các công thức thập phân và dấu ngoặc phức tạp.
  - **Audit Note:** ✓ Verify-combat audit: Passed. Đã kiểm chứng qua tests/skills.test.ts.
