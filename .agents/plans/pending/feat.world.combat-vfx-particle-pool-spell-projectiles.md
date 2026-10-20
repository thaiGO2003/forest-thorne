# WBS-045: Combat VFX Particle Pool & Spell Projectiles

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-045 · Phase WORLD
- **Nhánh đích:** `feat/world/combat-vfx-particle-pool-spell-projectiles`
- **Tham chiếu:** `§38, A29, A105.2`
- **Phụ thuộc:** Deps: WBS-036, WBS-038
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-045: Combat VFX Particle Pool & Spell Projectiles** `§38, A29, A105.2` *(Deps: WBS-036, WBS-038)*
  - **Mô tả:** Hệ thống VFX pooled cho projectile, beam, impact, scan, status, death, loot và spell effects; mọi effect bám semantic rig/world anchor thay vì screen-coordinate magic number và tự cleanup deterministic.
  - **Tiêu chí nghiệm thu:** Không allocation mesh liên tục theo frame; quality/reduced-effects chỉ giảm density/shake, không đổi canonical action timing hoặc combat outcome; effect transient không rò rỉ sau action/scene teardown.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: pooled projectiles/VFX, semantic anchors, density scaling and cleanup are presentation/resource-lifecycle work. A29 forbids these effects from changing canonical action timing or outcomes.
