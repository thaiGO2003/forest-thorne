# WBS-035: Tactical Camera System, Viewport & Framing Math

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-035 · Phase WORLD
- **Nhánh đích:** `feat/world/tactical-camera-system-viewport-framing-math`
- **Tham chiếu:** `§13, A91.1`
- **Phụ thuộc:** Deps: WBS-033
- **Trạng thái WBS:** Hoàn thành (WBS)

## Nội dung
- [x] **WBS-035: Tactical Camera System, Viewport & Framing Math** `§13, A91.1` *(Deps: WBS-033)*
  - **Mô tả:** Hệ thống Camera góc nhìn chiến thuật 45 độ với công thức tính khoảng cách bao quát (framing distance) tự động thích ứng tỉ lệ màn hình ngang/dọc, giới hạn trần dolly zoom (+5 unit) và điều khiển OrbitControls.
  - **Tiêu chí nghiệm thu:** Không để bàn cờ bị lọt thỏm hoặc tràn viền màn hình trên thiết bị di động.
  - **Audit Note:** ✓ Verify-world audit: Passed. Đã kiểm tra qua 3 tests trong tests/camera.test.ts.
