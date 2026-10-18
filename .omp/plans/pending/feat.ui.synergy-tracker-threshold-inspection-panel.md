# WBS-062: Synergy Tracker & Threshold Inspection Panel

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-062 · Phase UI
- **Nhánh đích:** `feat/ui/synergy-tracker-threshold-inspection-panel`
- **Tham chiếu:** `§14.14, A9, A82`
- **Phụ thuộc:** Deps: WBS-009, WBS-051, WBS-056
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-062: Synergy Tracker & Threshold Inspection Panel** `§14.14, A9, A82` *(Deps: WBS-009, WBS-051, WBS-056)*
  - **Mô tả:** Bảng theo dõi Tộc/Hệ/Nguyên tố bên cạnh màn hình: hiển thị số lượng cờ hiện tại, mốc đang kích hoạt, mốc tiếp theo và chi tiết chỉ số cộng thêm khi bấm vào xem chi tiết.
  - **Tiêu chí nghiệm thu:** Chỉ đếm các quân cờ đang triển khai trên bàn (trừ cờ trên bench); cập nhật live.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: synergy counting/threshold math is core-owned; this WBS is the live inspection/tracker presentation.
