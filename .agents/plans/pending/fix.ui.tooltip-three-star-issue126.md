# Issue #126 — Tooltip mở rộng hiển thị kỹ năng đủ 3 sao

- **Issue:** https://github.com/thaiGO2003/forest-thorne/issues/126 (open, bug, chưa assigned).
- **Plan / branch:** `fix.ui.tooltip-three-star-issue126.md` → `fix/ui/tooltip-three-star-issue126`.
- **Worktree:** `/home/thaigo/forest-thorne-issue-126`, từ `origin/dev`.
- **Target PR:** `dev` (qua Verifier; không mở PR từ Developer).
- **Trạng thái:** pending — visual planning trước, implementation sau.

## Bối cảnh / repro

Trong `src/ui/unitTooltip.ts`, expanded tooltip hiện chọn `skill.starDetailVi[star - 1]` nên cột «Chiêu thức» chỉ cho thấy star hiện tại. Old source có helper để xem milestones theo star trong `old_src/core/unitDescriptionHelper.ts` và `old_src/scenes/shared/unitTooltipRuntimeShared.ts`. Mục tiêu: so sánh cùng lúc 1★/2★/3★, giữ star hiện tại nổi bật. Không đổi compact và summary.

## Acceptance criteria (nguyên văn issue)

- [ ] Expanded tooltip của bất kỳ unit nào cũng có đủ 3 sao.
- [ ] Text khớp `starDetailVi` từng star; không cắt/không lặp.
- [ ] Summary/compact không đổi.
- [ ] Tooltip không vỡ layout, scroll được trên mobile.
- [ ] Có test + screenshot trước/sau.

## Phạm vi thực hiện

- UI/data: `src/ui/unitTooltip.ts`, `src/ui/tooltip.ts` nếu cần, và test tooltip hiện có hoặc test hành vi mới.
- Milestones: đúng thứ tự 1★ → 2★ → 3★, label rõ; highlight current star; giữ rage cost và metadata target/shape/count/duration/formula đúng theo dữ liệu từng star (không tự gán metadata star khác).
- Áp dụng cho các điểm hover cùng dùng expanded: Shop, Library, Planning, Combat, Unit Inventory.
- Scroll/focus/overflow ổn ở mobile; không làm méo chrome PNG; tiếp tục dùng asset-first.
- **Không làm:** đổi font nút (#125), thay đổi combat/skill data, cân bằng unit, thay API ngoài issue, thêm CSS để vẽ chrome.
- Nếu phát hiện vấn đề dữ liệu thiếu/star-specific, ghi rõ cho Leader trước khi đổi contract.

## Visual lane — giao Visual Developer trước

**Surface:** cột «Chiêu thức» trong expanded unit tooltip, không thay đổi summary/compact.

**Trước:** chỉ một block chiêu thức của star hiện tại, không so được mốc 2★/3★.

**Sau:** ba block 1★/2★/3★ nhìn rõ; block current-star nhấn mạnh; scroll được ở 390×844; không lấn icon, label hoặc metadata; desktop 1280×720 không cắt.

**Tham chiếu:** `old_src/core/unitDescriptionHelper.ts`, `old_src/scenes/shared/unitTooltipRuntimeShared.ts`; screenshot gốc trong issue là đường dẫn Windows của chủ repo, không giả định truy cập được trên Linux. Ưu tiên ghi lại baseline thật từ ứng dụng nếu có browser.

**Ownership visual:** Visual Developer khảo sát, chốt bố cục/spacing/label/current-star/overflow, lưu phương án hoặc ảnh evidence trong `.agents/merge-review/fix.ui.tooltip-three-star-issue126/visual/`, bàn giao acceptance và các file có thể đụng. Không sửa combat contract, không PR/merge/approve. Chỉ implement styling nếu có thể cô lập an toàn và đã phối hợp ownership với Developer.

**Visual acceptance:**
- [ ] Xác định visual baseline (expanded + compact); chứng minh 1★/2★/3★ ở expanded.
- [ ] Current star có dấu hiệu nhận diện nhìn được, kể cả khi không dựa vào màu.
- [ ] Mobile 390×844 có scroll, không tràn/cắt; desktop 1280×720 đúng bố cục.
- [ ] Asset/chrome tuân thủ PNG/kit/9-slice, không CSS chrome; giữ keyboard/focus.
- [ ] Evidence `before-390x844.png`, `after-390x844.png`, `after-1280x720.png` sau triển khai; ghi rõ nếu browser không khả dụng. Không tạo ảnh giả.

### Visual lane — kết quả khảo sát (Visual Developer, 2026-11-06, base `a27a325`)

**Evidence baseline (thật, Chromium headless SwiftShader, Vite dev, Library card hover):**
`.agents/merge-review/fix.ui.tooltip-three-star-issue126/visual/`
- `before-390x844.png`, `before-1280x720.png` (= `before-expanded-ant_guard-*`, Kiến Hộ Vệ 1★, repro của issue).
- `before-expanded-rabbit_blood-*` (Huyết Thố: `starDetailVi` dài nhất, 1285 ký tự, stress case), `before-compact-*`, `before-summary-*`.
- `before-metrics-390x844.json`, `before-metrics-1280x720.json`: rect, clipping, overflow, section titles.
- Lưu ý chạy lại: shell đang export `NODE_ENV=production` nên `import.meta.env.DEV=false` và không có `window.__app`; phải khởi động Vite bằng `NODE_ENV=development pnpm exec vite --port 5226`. Script capture để ngoài repo (`/tmp/capture126.mjs`), dùng `scripts/qa/lib.mjs`.

**Quan sát baseline:**
1. 1280×720 expanded: 4 cột, «Chiêu thức» chỉ có 1★. Kiến Hộ Vệ cao 516px, vừa khung. **Huyết Thố cao 788px, đã cắt 76px dưới đáy** dù mới có 1 sao.
2. 390×844 expanded: `tooltip.ts` render khi `innerWidth < 1100` sẽ **rơi về summary sections** («Đặc tính», «Kỹ hiện tại», chỉ câu đầu). Vì vậy mobile hiện **không có cột Chiêu thức**. Nếu chỉ sửa `columns`, mobile vẫn thiếu 3 sao.
3. Tooltip không có `max-height`/`overflow` (`overflowY: visible`). `.layer-tooltip > *` có `pointer-events: none`. Cảm ứng mở bằng long-press, nhưng `pointerleave` sau khi nhấc tay sẽ ẩn tooltip. **Hiện tại không có cách nào cuộn tooltip** bằng chuột, chạm hay bàn phím.
4. Compact và summary ở cả hai viewport vừa khung, không cắt. Không được đổi hai mode này.

**Audit dữ liệu (127 unit, Vitest tạm, đã xoá):** cả 127 unit đều có đủ 3 `starDetailVi` không rỗng. `rageCost` khác nhau theo star ở 127/127 unit. `skillSpec(id, star).damage` khác nhau theo star ở 30 unit. `targetVi/shapeVi/countVi/durationVi` là cấp skill, không theo star. **5 boss có `starDetailVi` trùng nhau giữa các star:** `boss_earth_colossus`, `boss_ember_dragon`, `boss_storm_phoenix`, `boss_tempest_jelly`, `boss_venom_hydra`. AC «không lặp» xung đột với dữ liệu này, cần Leader quyết.

**Đề xuất bố cục (cột «Chiêu thức» expanded):**
```
🔹 Chiêu thức
<skillIcon> Giáp Tái Sinh
▶ ⭐ 1★ · Nộ 2 · (hiện tại)        ← dòng nhãn star hiện tại
  Tự hồi 8% HP tối đa. Nhận 10 khiên…
  💥 Công thức: …                   ← chỉ khi skillSpec(id,1).damage có
⭐⭐ 2★ · Nộ 3
  Tự hồi 10% HP tối đa…
⭐⭐⭐ 3★ · Nộ 4
  Tự hồi 12% HP tối đa…
(dòng trống)
🎯 Mục tiêu / 🌀 Vùng ảnh hưởng / 🎯 Số mục tiêu / ⏳ Thời lượng   ← một lần, dùng chung
```
- Thứ tự cố định 1★ → 2★ → 3★. Mỗi block gồm label (`⭐`×star, `N★`, rage theo star), text `starDetailVi[star-1]` đầy đủ (không `firstSentence`) và formula riêng của star đó. Không dùng formula của star hiện tại cho star khác.
- Metadata cấp skill hiện một lần sau 3 block, giữ khoảng dòng trống như hiện nay. Không lặp metadata trong từng block.
- **Dấu current-star không dựa vào màu:** dùng ký hiệu `▶` ở đầu, chữ `(hiện tại)`/i18n key mới và `font-weight` đậm. Có thể bọc label bằng chip `tile_status` 9-slice có sẵn (`tt-chip` tone `star`) để nhận diện bằng asset. Gắn `aria-current="true"` cho block. Không thêm CSS color/border/background. Hai star còn lại để chữ thường, không chip.
- Mỗi star là một `<section>`/block con, cách nhau 4–6px (`gap`, CSS layout). Text dùng `decorateDescription` như hiện tại.
- Header «Chiêu thức» bỏ `(Nộ N)` sau tên vì rage đã có ở từng label. Summary «Kỹ hiện tại» và compact giữ nguyên `(Nộ N)` của star hiện tại.

**Responsive / scroll:**
- 1280×720: giữ 4 cột (cột skill 1.35fr). Thêm `.tooltip[data-mode="expanded"] { max-height: calc(100dvh - 16px); overflow-y: auto; overscroll-behavior: contain; }`, đây là CSS layout nên hợp lệ với asset-first. Chrome `panel_tooltip` vẽ bằng `surface()` theo kích thước phần tử, nên Developer phải xác nhận 9-slice không bị kéo theo scrollHeight. Phương án an toàn: đặt scroll trên `.tooltip-inner` và giữ `.tooltip` có chiều cao cố định.
- 390×844: ở expanded, nhánh fallback `< 1100px` phải thêm section 3 sao (dùng cùng helper). Có thể stack 4 cột 1fr (CSS ≤760px đã hỗ trợ) hoặc dùng summary + section «Chiêu thức» 3 sao. Đề xuất: summary + section 3 sao, vì ít cao hơn. Mode `summary` thật không đổi.
- **Cần quyết định hành vi (blocker cho AC «scroll được trên mobile»):** để cuộn được, tooltip expanded phải nhận pointer (`pointer-events: auto`), giữ mở sau long-press cho đến khi chạm ra ngoài hoặc Esc, và không ẩn khi chuột di từ anchor sang tooltip. Bàn phím: tooltip cần vùng cuộn có thể focus (`tabindex="0"`) hoặc cuộn bằng phím mũi tên khi anchor đang focus. Đây là thay đổi interaction trong `tooltip.ts` `bind()`, ngoài phạm vi visual. Leader cần chốt trước khi giao Developer.

**File dự kiến đụng:** `src/ui/unitTooltip.ts` (helper milestones + cột skill + section fallback), `src/ui/tooltip.ts` (nhánh fallback expanded, scroll/interaction nếu được duyệt, `aria-current`), `src/ui/ui.css` (chỉ layout: max-height/overflow/gap), `src/core/i18n.ts` (nhãn «hiện tại»/«Mốc sao» nếu cần), test tooltip hiện có.

**After evidence cần chụp:** `after-390x844.png` (Kiến Hộ Vệ, expanded, thấy 3 block hoặc vùng cuộn tới 3★), `after-1280x720.png` (Kiến Hộ Vệ) và thêm Huyết Thố 1280×720 để chứng minh scroll/không cắt. Chạy lại `/tmp/capture126.mjs after … mobile|desktop`.

## Developer implementation checklist

- [x] Xác định helper/mapping `starDetailVi` và rage cost theo star, đối chiếu dữ liệu tác giả.
- [x] Render đúng 3 block ở expanded; không duplicate; current-star marker `▶`, `(hiện tại)`, `aria-current`.
- [x] Formula lấy riêng `skillSpec(id, star)`; metadata target/shape/count/duration chung chỉ render một lần.
- [x] Compact/Summary giữ nguyên; mọi hover entry point tái sử dụng `unitTooltipContent`.
- [x] `pnpm exec vitest --run tests/unit-tooltip.test.ts` (5/5), `pnpm typecheck`, `pnpm build` (137 modules), `git diff --check`.
- [x] Browser desktop 1280×720 + mobile 390×844: 3 sao, scroll chuột/bàn phím/cảm ứng, Escape/ngoài tooltip đóng, 9-slice không méo; screenshot trước/sau có thật.
- [x] Commit có body theo `.agents/rules/commits.md`, push nhánh, báo Leader (Verifier tự tạo PR riêng).

### Developer acceptance evidence (2026-11-06)

- Expanded: 127/127 unit × 3 trạng thái star đều trả `1★ → 2★ → 3★` với nguyên văn `skill.starDetailVi[star - 1]`, rageCost và damage formula theo từng star; marker hiện tại đúng một block. Test xác nhận metadata cấp skill chỉ hiện một lần. Summary và compact tiếp tục dùng `sections`/`lines` gốc.
- **Ngoại lệ source data:** 5 boss có **hai chuỗi mô tả phân biệt trên ba star** (một cặp star trùng nguyên văn), không phải cả ba chuỗi giống nhau. UI vẫn render cả ba nguyên văn; rageCost cả ba khác nhau. Không thay đổi nội dung skill, combat hoặc cân bằng.
- Baseline thật: `before-expanded-rabbit_blood-1280x720.png` bị clipping 76px, `before-390x844.png` không hiển thị milestone skill. Kết quả 1280×720: `after-1280x720.png`, `after-expanded-rabbit_blood-1280x720.png`, `after-scrolled-rabbit_blood-1280x720.png`; mobile: `after-390x844.png`, `after-expanded-rabbit_blood-390x844.png`, `after-touch-scroll-390x844.png`. Tất cả trong `.agents/merge-review/fix.ui.tooltip-three-star-issue126/visual/`.
- Real Chromium smoke: desktop rabbit_blood scrollHeight=1547/clientHeight=680, mobile=1762/804; tooltip rect không clip ở cả 1280×720 và 390×844, `overflowY=auto`, chrome 9-slice Canvas vẫn tồn tại. `PageDown` mobile rabbit_blood `scrollTop=643`, touch gesture `scrollTop=255`; desktop mouse wheel scrollTop=240; Esc/outside click đóng; không có page errors. Metrics: `after-interactions-1280x720.json`, `after-interactions-390x844.json`.
- Scope: chỉ thay unit tooltip, vòng đời và tương tác expanded tooltip, CSS layout-only, i18n label, regression test, plan/README. Không mở PR, không merge, không đóng issue; nhánh chờ Verifier.

## Risks / rollback

- Mismatch dữ liệu 3 star → hiển thị sai chiêu thức; cần phân biệt missing star data và star hiện tại mà không duplicate.
- Tooltip dài trên mobile → overflow/scroll; xác nhận bằng screenshot thật và thao tác touch/keyboard.
- Chia sẻ CSS với #125 → không chạy hai issue chạm cùng style surface khi chưa khóa ownership.
- Rollback bằng revert commit của issue trên branch riêng; không ghi lên `dev`/`main` trực tiếp.

## Handoff / verification

1. Leader → Visual Developer: visual layout/spec + baseline evidence trước.
2. Sau visual sign-off, Leader → Developer: implementation đúng acceptance.
3. Developer → Leader → Verifier: độc lập verify, tạo PR + ảnh pin `Verified-Head`.
4. Pull Verifier review `APPROVED`; closure có audit (automation chưa active trên default `main`); merge PR vào `dev` theo gate.
5. Leader `/plan-done` khi issue/PR/evidence hoàn tất.
