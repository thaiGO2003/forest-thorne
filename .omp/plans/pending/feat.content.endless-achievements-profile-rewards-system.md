# WBS-075: Endless Achievements & Profile Rewards System

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-075 · Phase CONTENT
- **Nhánh đích:** `feat/content/endless-achievements-profile-rewards-system`
- **Tham chiếu:** `§27, A36, A104.1, A104.2`
- **Phụ thuộc:** Deps: WBS-011, WBS-050
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-075: Endless Achievements & Profile Rewards System** `§27, A36, A104.1, A104.2` *(Deps: WBS-011, WBS-050)*
  - **Mô tả:** Hệ thống thành tựu cấp tài khoản độc lập với lượt chơi: ghi nhận kỷ lục vòng cao nhất, tổng số trận thắng, số lượng cờ đã mua, số lượt reroll,... Tự động mở khóa danh hiệu và skin trang phục độc quyền.
  - **Tiêu chí nghiệm thu:** Không bị xóa khi thua game (Game Over); lưu riêng trong profile tài khoản.
  - **Audit Note:** ⚠ Logic-only re-check 2026-10-05: A104 achievement/profile persistence and `recordEndlessAchievementEvent(...)` remain implemented, but repository call-graph search still finds only the recorder definition under `src/`; no production account-profile owner emits canonical run/shop/round events. End-to-end runtime accumulation remains unwired, so WBS-075 stays unchecked.
