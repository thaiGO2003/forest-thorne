# WBS-079: PvP Fortress Matchmaking & Ghost Opponent Snapshot

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-079 · Phase CONTENT
- **Nhánh đích:** `feat/content/pvp-fortress-matchmaking-ghost-opponent-snapshot`
- **Tham chiếu:** `§30, A48, A67.3, A100.3`
- **Phụ thuộc:** Deps: WBS-078
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-079: PvP Fortress Matchmaking & Ghost Opponent Snapshot** `§30, A48, A67.3, A100.3` *(Deps: WBS-078)*
  - **Mô tả:** Chỉ triển khai competitive ruleset PvP Fortress theo A48: snapshot đội hình/ownership cần thiết cho pairing/resolution. Generic PvP cũ vẫn là internal/hidden concept và không được biến thành production mode.
  - **Tiêu chí nghiệm thu:** Snapshot giữ canonical owned state cần cho opponent resolution; New Game không expose generic PvP hoặc PvP Fortress khi availability gate hiện hành còn khóa.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: `FortressPvP4` exists only as an explicitly `available: false` mode config and A67.3 keeps generic PvP hidden. No production pairing, ghost opponent, canonical opponent snapshot, castle-damage/elimination, or champion-transition owner is present under `src/`; WBS-079 stays unchecked.
