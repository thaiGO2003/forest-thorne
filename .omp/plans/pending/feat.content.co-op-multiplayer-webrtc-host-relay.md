# WBS-078: Co-op Multiplayer WebRTC Host-Relay

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-078 · Phase CONTENT
- **Nhánh đích:** `feat/content/co-op-multiplayer-webrtc-host-relay`
- **Tham chiếu:** `§29, A21, A47, A114, A118`
- **Phụ thuộc:** Deps: WBS-011, WBS-050
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-078: Co-op Multiplayer WebRTC Host-Relay** `§29, A21, A47, A114, A118` *(Deps: WBS-011, WBS-050)*
  - **Mô tả:** Hệ thống kết nối phòng chơi 4 người qua giao thức WebRTC (P2P Mesh/Host-Relay): tạo mã phòng, chia sẻ hạt giống seed, gửi tín hiệu sẵn sàng, đồng bộ kết quả vòng đấu giữa các máy khách.
  - **Tiêu chí nghiệm thu:** Chơi mượt mà không cần cài đặt server tập trung; cơ chế fallback khi rớt mạng.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: persisted co-op slot/capacity primitives exist, but the live tree has no `src/network` session owner and no room signalling, WebRTC host-relay transport, authoritative snapshot/delta/heartbeat, or reconnect lifecycle. Those A47/A114/A118 semantics are production-ownership blocked; WBS-078 stays unchecked rather than inventing a parallel multiplayer architecture.
