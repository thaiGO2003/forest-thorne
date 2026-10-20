# WBS-059: Unit Card & Comprehensive Detail Modal

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-059 · Phase UI
- **Nhánh đích:** `feat/ui/unit-card-comprehensive-detail-modal`
- **Tham chiếu:** `§14.6, §14.16, A59, A76, A85`
- **Phụ thuộc:** Deps: WBS-002, WBS-018, WBS-051
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-059: Unit Card & Comprehensive Detail Modal** `§14.6, §14.16, A59, A76, A85` *(Deps: WBS-002, WBS-018, WBS-051)*
  - **Mô tả:** Thẻ bài cờ chuẩn mực: ảnh đại diện, sao, giá tiền, vai trò, nguyên tố, tộc. Modal chi tiết hiển thị toàn bộ chỉ số gốc, trang bị đang mang, chi tiết kỹ năng theo sao và nút thao tác nhanh.
  - **Tiêu chí nghiệm thu:** Dùng chung một ngôn ngữ thiết kế cho cả màn hình Planning và Library.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: card/detail rendering is presentation-only and must consume catalog/equipment/skill authorities without duplicating stat computation.
