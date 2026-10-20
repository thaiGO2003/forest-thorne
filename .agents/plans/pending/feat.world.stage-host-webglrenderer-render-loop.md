# WBS-036: Stage Host, WebGLRenderer & Render Loop

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-036 · Phase WORLD
- **Nhánh đích:** `feat/world/stage-host-webglrenderer-render-loop`
- **Tham chiếu:** `§37, §43, A91.5, A105.3`
- **Phụ thuộc:** Deps: WBS-034, WBS-035
- **Trạng thái WBS:** Hoàn thành (WBS)

## Nội dung
- [x] **WBS-036: Stage Host, WebGLRenderer & Render Loop** `§37, §43, A91.5, A105.3` *(Deps: WBS-034, WBS-035)*
  - **Mô tả:** Khung quản lý vòng lặp render Three.js, cấu hình WebGLRenderer với antialias, đổ bóng shadowMap, kẹp DPR <= 2, tự động lắng nghe co giãn khung nhìn resize và giải phóng tài nguyên an toàn.
  - **Tiêu chí nghiệm thu:** Render mượt mà, không rò rỉ bộ nhớ WebGL context khi khởi động lại scene.
  - **Audit Note:** ✓ Verify-world audit: Passed. Đã tích hợp tại src/world/stage.ts.
