# WBS-048: WebGL Context Loss Recovery & Asset Reliability Lifecycle

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-048 · Phase WORLD
- **Nhánh đích:** `feat/world/webgl-context-loss-recovery-asset-reliability-lifecycle`
- **Tham chiếu:** `§37, A105.3`
- **Phụ thuộc:** Deps: WBS-036
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-048: WebGL Context Loss Recovery & Asset Reliability Lifecycle** `§37, A105.3` *(Deps: WBS-036)*
  - **Mô tả:** Hệ thống bảo vệ vòng đời WebGL: lắng nghe sự kiện webglcontextlost và khôi phục mượt mà khi restored, giải phóng bộ nhớ triệt để khi đổi scene (dispose textures, geometries, materials).
  - **Tiêu chí nghiệm thu:** Không bị crash đen màn hình khi chuyển tab hoặc khóa máy điện thoại; ram giữ mức ổn định.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: WebGL context recovery/disposal is renderer reliability lifecycle, outside non-visual gameplay logic.
