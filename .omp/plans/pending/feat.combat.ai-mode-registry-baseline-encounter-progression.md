# WBS-029: AI Mode Registry & Baseline Encounter Progression

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-029 · Phase COMBAT
- **Nhánh đích:** `feat/combat/ai-mode-registry-baseline-encounter-progression`
- **Tham chiếu:** `§18, A33`
- **Phụ thuộc:** Deps: WBS-019, WBS-024
- **Trạng thái WBS:** Hoàn thành (WBS)

## Nội dung
- [x] **WBS-029: AI Mode Registry & Baseline Encounter Progression** `§18, A33` *(Deps: WBS-019, WBS-024)*
  - **Mô tả:** Registry mode AI canonical cho TUTORIAL, EASY, MEDIUM, HARD, CREATIVE cùng các biến thể COOP/COOP4; chuẩn hóa mode và chọn profile encounter deterministic theo round/mode thay vì duy trì tier `NIGHTMARE` không có trong authority hiện hành.
  - **Tiêu chí nghiệm thu:** Mode không hợp lệ normalize theo rule A33; encounter generation deterministic theo RNG seed và chỉ dùng mode được selected game mode cho phép. Ma trận số đầy đủ, star/equipment pressure và targeting order được tách sang WBS-100/A102.
  - **Audit Note:** ✓ Coverage audit 2026-10-04: giữ trạng thái hoàn thành cho baseline A33 đã kiểm chứng; bỏ prose `NIGHTMARE` cũ mâu thuẫn authority. Full A102 contract chưa được claim ở task này.
