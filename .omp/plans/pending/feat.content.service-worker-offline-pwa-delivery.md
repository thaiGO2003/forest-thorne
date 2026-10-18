# WBS-087: Service Worker & Offline PWA Delivery

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-087 · Phase CONTENT
- **Nhánh đích:** `feat/content/service-worker-offline-pwa-delivery`
- **Tham chiếu:** `§44, A51.3`
- **Phụ thuộc:** Deps: WBS-052
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-087: Service Worker & Offline PWA Delivery** `§44, A51.3` *(Deps: WBS-052)*
  - **Mô tả:** Đăng ký Service Worker và cấu hình Web App Manifest (PWA): lưu bộ nhớ đệm cache các tài nguyên tĩnh, cho phép cài đặt game lên màn hình chính điện thoại và chơi hoàn toàn offline không cần internet.
  - **Tiêu chí nghiệm thu:** Không bị gián đoạn khi mất kết nối mạng đột ngột; tự động cập nhật khi có phiên bản mới.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: Service Worker/cache/manifest/update behavior is delivery infrastructure, outside gameplay logic.
