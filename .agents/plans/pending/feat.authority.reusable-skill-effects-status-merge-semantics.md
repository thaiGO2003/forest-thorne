# WBS-096: Reusable Skill Effects & Status-Merge Semantics

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-096 · Phase AUTHORITY COVERAGE
- **Nhánh đích:** `feat/authority/reusable-skill-effects-status-merge-semantics`
- **Tham chiếu:** `A70`
- **Phụ thuộc:** Deps: WBS-019, WBS-020, WBS-021, WBS-022
- **Trạng thái WBS:** Hoàn thành (WBS)

## Nội dung
- [x] **WBS-096: Reusable Skill Effects & Status-Merge Semantics** `A70` *(Deps: WBS-019, WBS-020, WBS-021, WBS-022)*
  - **Mô tả:** Chuẩn hóa reusable effect families: single/global damage qua canonical resolver; single heal chọn living injured ally có HP ratio thấp nhất; global heal cho mọi living ally; stun resolves damage trước; DEF buff merge giữ value mạnh hơn và duration dài hơn; generic slow intentionally inert.
  - **Tiêu chí nghiệm thu:** Stun chỉ áp nếu target sống, chance clamp đúng authored chance×star multiplier với default 100%/1 turn; DEF buff default +15/3 turns; không subsystem nào tạo một damage/heal/status resolver song song.
  - **Audit Note:** ✅ Logic-only verification 2026-10-05: authored stun chance được giữ trong `SkillSpec`, star chance dùng `1.0/1.4/2.0`, stun gate sau damage và bỏ qua target chết, refresh stun không rút ngắn duration, single/global heal theo living injured semantics, team DEF dùng default `+15/3` và keyed max-value/max-duration merge; generic slow vẫn inert. Targeted `skills+combat` 18/18 pass, typecheck pass, production SSR smoke xác nhận cast→damage→stun→skip và lethal cast→damage→death không có stun.
