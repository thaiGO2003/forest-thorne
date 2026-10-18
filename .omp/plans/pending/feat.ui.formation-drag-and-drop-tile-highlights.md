# WBS-058: Formation Drag-and-Drop & Tile Highlights

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-058 · Phase UI
- **Nhánh đích:** `feat/ui/formation-drag-and-drop-tile-highlights`
- **Tham chiếu:** `§14.2, §14.3, A75`
- **Phụ thuộc:** Deps: WBS-005, WBS-037, WBS-056
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-058: Formation Drag-and-Drop & Tile Highlights** `§14.2, §14.3, A75` *(Deps: WBS-005, WBS-037, WBS-056)*
  - **Mô tả:** Trình điều khiển kéo thả cờ giữa Bench ↔ Bàn cờ và Bàn cờ ↔ Bàn cờ. Kiểm tra giới hạn số quân deploy, ngăn trùng loài, hiển thị highlight ô xanh khi kéo thả hợp lệ, đỏ khi cấm.
  - **Tiêu chí nghiệm thu:** Thả cờ ra ngoài tự động hoàn tác (atomic rollback); hoán đổi vị trí mượt mà.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: canonical move/swap/deploy legality already lives in planning state and WBS-037 supplies non-visual picking. Drag gestures and tile highlights are presentation/input integration.
