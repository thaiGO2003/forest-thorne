# WBS-052: App Shell & Boot Orchestrator

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-052 · Phase UI
- **Nhánh đích:** `feat/ui/app-shell-boot-orchestrator`
- **Tham chiếu:** `§4, A51, A115`
- **Phụ thuộc:** Deps: WBS-036, WBS-050
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-052: App Shell & Boot Orchestrator** `§4, A51, A115` *(Deps: WBS-036, WBS-050)*
  - **Mô tả:** Khung ứng dụng gốc, bộ bắt lỗi Fatal Error Boundary với thông điệp rõ ràng, điều hướng chuyển cảnh mượt mà giữa Loading Scene → Main Menu → Planning Scene → Combat Scene.
  - **Tiêu chí nghiệm thu:** Không để màn hình đen vô căn cứ; lưu crash log an toàn khi gặp sự cố WebGL.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: app-shell scene routing, fatal UI and WebGL crash presentation are application lifecycle work; no standalone gameplay rule is owned by this WBS.
