# WBS-056: Planning Phase Master HUD & Status Bar

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-056 · Phase UI
- **Nhánh đích:** `feat/ui/planning-phase-master-hud-status-bar`
- **Tham chiếu:** `§14.1, A22, A38, A39`
- **Phụ thuộc:** Deps: WBS-003, WBS-004, WBS-050, WBS-051
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-056: Planning Phase Master HUD & Status Bar** `§14.1, A22, A38, A39` *(Deps: WBS-003, WBS-004, WBS-050, WBS-051)*
  - **Mô tả:** Thanh thông tin chiến thuật trên cùng: hiển thị Vàng, Máu, Cấp độ, Thanh XP, Sức chứa quân bàn/chờ, Vòng đấu, Nút Bắt đầu trận chiến nổi bật ở giữa, và nút xả stress Hạ Cortisol.
  - **Tiêu chí nghiệm thu:** Tự động co giãn bố cục trên di động để không che khuất bàn cờ 3D.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: HUD rendering/responsive layout is presentation-only; gold/HP/XP/capacity/round legality remain sourced from existing economy/run/phase owners.
