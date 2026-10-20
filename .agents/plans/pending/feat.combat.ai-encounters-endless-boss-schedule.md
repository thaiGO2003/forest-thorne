# WBS-024: AI Encounters & Endless Boss Schedule

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-024 · Phase COMBAT
- **Nhánh đích:** `feat/combat/ai-encounters-endless-boss-schedule`
- **Tham chiếu:** `§18, §19, A33, A34`
- **Phụ thuộc:** Deps: WBS-019
- **Trạng thái WBS:** Hoàn thành (WBS)

## Nội dung
- [x] **WBS-024: AI Encounters & Endless Boss Schedule** `§18, §19, A33, A34` *(Deps: WBS-019)*
  - **Mô tả:** Bộ sinh đội hình AI đối thủ theo ngân sách và cấp độ round, giới hạn số lượng ô theo mode. Lịch trình triệu hồi Boss cố định ở các vòng 10, 20, 30, 40, 50 theo vòng tròn quay tua A34.
  - **Tiêu chí nghiệm thu:** Sinh đội hình ngẫu nhiên nhưng tái lập xác định qua RNG seed; 5 boss rotation cố định.
  - **Audit Note:** ✓ Verify-combat audit: Passed. Đã kiểm chứng 5 boss rotation và solo cap <= 15 ô.
