# WBS-049: Medieval Forest-Fantasy Asset-First UI Chrome Engine

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-049 · Phase UI
- **Nhánh đích:** `feat/ui/medieval-forest-fantasy-asset-first-ui-chrome-engine`
- **Tham chiếu:** `§2.3, §50, AGENTS.md`
- **Phụ thuộc:** Deps: WBS-001
- **Trạng thái WBS:** Hoàn thành (WBS)

## Nội dung
- [x] **WBS-049: Medieval Forest-Fantasy Asset-First UI Chrome Engine** `§2.3, §50, AGENTS.md` *(Deps: WBS-001)*
  - **Mô tả:** Hệ thống render giao diện theo chuẩn Asset-First: Canvas 2D / 9-slice PNG border, khung gỗ sồi chạm khắc, giấy da parchment, đinh tán kim loại mạ đồng, tuyệt đối không dùng CSS tô màu hoặc gradient.
  - **Tiêu chí nghiệm thu:** CSS chỉ dùng cho bố cục/tọa độ/responsive; toàn bộ panel/button/badge được vẽ qua canvas chrome.
  - **Audit Note:** ✓ Verify-ui audit: Passed. Đã triển khai tại src/ui/chrome.ts tuân thủ nghiêm ngặt quy tắc AGENTS.md.
