# Hoàn thiện Quạ Phi Tiêu (`crow_storm`) — Tam Sắc Phi Tiêu + rig bespoke

> Plan độc lập cho một unit. Nhánh: `feat/units/crow-chromatic-darts`.

- **Nhánh đích:** `feat/units/crow-chromatic-darts`
- **Đơn vị:** `crow_storm` / "Quạ Phi Tiêu" (tier 1, ARCHER, AVIAN, WIND)
- **Tham chiếu:** `docs.spec.forest-throne-rebuild.md` §5437–5442, §6785; changelog.md:612 (rig đã revert); `feat.units.remaining-roster-bespoke-six-actions.md` row 70 (mâu thuẫn — phải sửa)
- **Trạng thái:** Chờ thực hiện
- **Visual:** concept sheet con quạ do người dùng commit sau; tham khảo layout/VFX từ sheet Nhện Độc (`spider_venom`) và Báo Đốm Săn (`jaguar_hunt`) trong `art/drafts/`, và template code `src/units/roster/jaguarHunt.ts`.

## Bối cảnh

Unit "Quạ thợ săn ném ba phi tiêu màu" **đã tồn tại trong data**, không thêm unit mới:

- `src/content/units.json` → `crow_storm` = "Quạ Phi Tiêu", skill "Tam Sắc Phi Tiêu", family `chromatic_dart_chain`, cost nộ `[4,4,4]`, target = địch `%`máu thấp nhất.
- Kit **đã dùng nộ** (game không có năng lượng/mana) — đúng với yêu cầu "năng lượng → nộ".

Ba vấn đề cần xử lý:

1. **Family `chromatic_dart_chain` chưa được cài.** Chỉ xuất hiện trong `units.json`; `src/core/skills.ts:3-4` nói family lạ "degrade to parsed parts" ⇒ chuỗi 3 phi tiêu + stacking + choáng chưa chạy thật.
2. **Rig `crow_storm` đã bị revert** về `pendingArt(id)` (changelog.md:612) ⇒ đang hiện marker "chưa xong"; cần viết lại rig bespoke từ sheet.
3. **Roster plan row 70 mâu thuẫn spec:** ghi `crow_storm` = "Quạ Bão Táp / Bão Lông Vũ Đen" (lông vũ đen độc, nhiều mục tiêu ngẫu nhiên), trái spec "Quạ Phi Tiêu / Tam Sắc Phi Tiêu".

## Quyết định đã khóa

- **Dùng lại `crow_storm`**, KHÔNG thêm unit mới ⇒ `tests/economy.test.ts:64-66` (120 normal / 5 boss) không đổi.
- Phi tiêu **Xanh**: bỏ hồi máu 50% → **hút nộ** (trừ 1 nộ mục tiêu, cộng 1 nộ cho Quạ; hút tối đa bằng nộ hiện có của mục tiêu).
- Sát thương **physical** (theo spec).
- **Tier 1, chỉ số giữ nguyên:** `hp240 · atk52 · def12 · matk10 · mdef14 · range4 · rageMax4 · crit0.1 · critDmg1.5 · evade0.08 · acc0.95`; cost nộ `4/4/4`.

## Kế hoạch thực hiện

### Phase 0 — Đồng bộ nguồn sự thật (SOT) trước khi code

- [ ] Sửa `docs.spec.forest-throne-rebuild.md` (§5437–5442): đổi `starDetailVi` cả 3★ cụm *"…và hồi máu bằng 50% sát thương thực tế"* → *"…và hút 1 nộ của mục tiêu chuyển cho Quạ (hút tối đa bằng nộ hiện có của mục tiêu)"*. Ghi lý do theo changelog.md:704 (không bịa số ngoài nguồn).
- [ ] Cập nhật `src/content/units.json` field `crow_storm.skill.starDetailVi` khớp spec. **Lưu ý:** `src/content/catalog.ts:2` ghi units.json "generated from the spec manifest; do not hand-edit" — cần xác nhận generator; nếu không có trong repo, sửa trực tiếp riêng entry này và ghi chú ngoại lệ.
- [ ] Sửa `feat.units.remaining-roster-bespoke-six-actions.md` row 70 khớp spec: "Quạ Bão Táp / Bão Lông Vũ Đen" → "Quạ Phi Tiêu / Tam Sắc Phi Tiêu".
- **Nghiệm thu:** không còn cụm "hồi máu bằng 50% sát thương thực tế" cho `crow_storm` trong spec + units.json; row 70 = spec.

### Phase 1 — Cài family `chromatic_dart_chain`

- [ ] `src/core/skills.ts`: thêm nhánh cho family này — selector `lowest_hp_pct` (địch `%`máu thấp nhất) và parse cụm "hút nộ".
- [ ] `src/core/combat.ts`: logic ném chuỗi — Xanh (dmg + hút nộ) → 50%+stack ném Đỏ (nổ thập: 50% dmg thực lên 4 ô kề) → 25%+stack ném Vàng (choáng 2 lượt).
- [ ] Bộ đếm stacking: mỗi phi tiêu đã ném **+5% tỷ lệ Đỏ / +1% tỷ lệ Vàng**, giữ đến hết combat; Đỏ chỉ kiểm tra sau Xanh, Vàng chỉ sau Đỏ.
- **Nghiệm thu:** cast đủ 3 phi tiêu theo thứ tự; stacking cộng dồn qua nhiều lượt; khi Xanh trúng thì nộ Quạ tăng và nộ địch giảm đúng.

### Phase 2 — Rig bespoke `src/units/roster/ravenHunt.ts`

- [ ] Dựng quạ voxel: hat / lantern / khăn đỏ / crossbow + quiver / 3 phi tiêu màu; motion `fly`.
- [ ] 5 state: `idle | attack | skill | hit | move` (skill gồm prep → ném chuỗi → nổ/AoE/CC); biến thể 1★/2★/3★.
- [ ] `src/units/registry.ts`: thêm `crow_storm: ravenHunt` vào `RIGS`, **gỡ** `pendingArt("crow_storm")`.
- [ ] Tham chiếu template `src/units/roster/jaguarHunt.ts` (`defineUnit/part/box/spots`, duration, `build(k,{star})`) và `src/units/roster/toadPoison.ts`.
- **Nghiệm thu:** 5 state khác silhouette; node hat/lantern/wing/quiver chuyển động độc lập; reset ẩn hết mesh tạm (gate roster plan).

### Phase 3 — VFX phi tiêu

- [ ] Nổ **đỏ** (hình thập), **hút xanh** (luồng nộ về Quạ), **choáng vàng** (star/ring, 2 lượt). Mỗi VFX là mesh tạm, reset xác định.

### Phase 4 — Test, verify, changelog

- [ ] `tests/unit-visuals.test.ts`: case `crow_storm` có rig riêng, không dùng marker `pendingArt`.
- [ ] Test skill: hút nộ đổi đúng nộ hai bên; stacking; choáng 2 lượt.
- [ ] `.omp/plans/pending/changelog.md`: ghi rig đã hồi sinh + đổi cơ chế hồi máu → hút nộ.
- [ ] Chạy `pnpm run verify` (typecheck + tests) phải xanh; economy test vẫn 120/5.

## Rủi ro / lưu ý

- `units.json` sinh tự động — nếu có generator ngoài repo, phải chạy lại chứ không sửa tay, nếu không Phase 0 sẽ lệch.
- "hút nộ" là cơ chế mới với parser — cần dạy `parseSkill` hiểu cụm này.
- Không đổi `tests/economy.test.ts` vì không thêm unit.
- Chưa có rig `spider_venom` trong `src/units/roster/` — phần nhện chỉ tham khảo ở mức art sheet.

## Bằng chứng

- `pnpm run verify` pass (typecheck + unit-visuals + skill + economy 120/5).
- Diff spec/units.json không còn cụm hồi máu cho `crow_storm`.
- Ảnh chụp rig 5 state (nếu có môi trường preview).
