# WBS-044: Unit Status Billboard Canvas Overlays

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-044 · Phase WORLD
- **Nhánh đích:** `feat/world/unit-status-billboard-canvas-overlays`
- **Tham chiếu:** `§24, A23, A92`
- **Phụ thuộc:** Deps: WBS-036, WBS-038
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-044: Unit Status Billboard Canvas Overlays** `§24, A23, A92` *(Deps: WBS-036, WBS-038)*
  - **Mô tả:** Bảng hiển thị thanh máu, giáp ảo, nộ khí và biểu tượng hiệu ứng bất lợi/có lợi lơ lửng trên đầu unit bằng Dynamic Texture 512x176, tự động quay mặt về camera (billboard) và bám sát vị trí cờ.
  - **Tiêu chí nghiệm thu:** Hiển thị rõ ràng chỉ số HP/nộ; gom nhóm tối đa 6 badge trạng thái không bị đè chữ.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: billboard HP/rage/status rendering is presentation-only. Canonical fighter HP/rage/status state already lives in combat state and must remain the single gameplay authority.
