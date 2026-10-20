# WBS-049: Medieval Forest-Fantasy Asset-First UI Chrome Engine

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-049 · Phase UI
- **Nhánh đích:** `feat/ui/medieval-forest-fantasy-asset-first-ui-chrome-engine`
- **Tham chiếu:** `§2.3, §50, AGENTS.md`
- **Phụ thuộc:** Deps: WBS-001
- **Trạng thái WBS:** Hoàn thành (WBS)

## Nội dung
- [x] **WBS-049: Medieval Forest-Fantasy Asset-First UI Chrome Engine** `§2.3, §50, AGENTS.md` *(Deps: WBS-001)*
  - **Mô tả:** Hệ thống render giao diện theo chuẩn Asset-First: Canvas 2D / 9-slice PNG border, khung gỗ sồi chạm khắc, giấy da parchment, đinh tán kim loại mạ đồng, tuyệt đối không dùng CSS tô màu hoặc gradient.
  - **Tiêu chí nghiệm thu:** CSS chỉ dùng cho bố cục/tọa độ/responsive; toàn bộ panel/button/badge được vẽ qua canvas chrome.
- **Audit Note (2026-10-21 — static/source review + HTTP smoke):** UI chrome engine thực tế là `src/ui/kit.ts` (**không phải** `src/ui/chrome.ts`; không tạo file trùng này). `scripts/gen-ui-kit.mjs` tạo các PNG dưới `public/assets/ui/generated/`; `kit.ts` nạp manifest, render panel/card/status bằng Canvas `nineSlice`, ribbon và thanh bar frame bằng `threeSlice`, button bằng PNG trạng thái (normal/hover/pressed/disabled/selected). Consumer đã đối chiếu: `src/ui/card.ts`, `menu.ts`, `modal.ts`, `combat.ts`, `planning.ts`, `tooltip.ts` và ribbon trong `loading.ts`.
  - **CSS/layout acceptance:** `src/ui/ui.css` dùng bố cục, kích thước, responsive, typography, visibility/interaction; không dùng CSS gradient, shadow, pseudo-element trang trí hay màu nền/viền cho chrome. `border: 0` và `background: none/transparent` chỉ reset native button/input, không vẽ chrome. Đã bỏ màu kế thừa trên `.ui-root` và `opacity` tô nhạt của `.tt-sub` để CSS tuân thủ quy định layout-only. Màu chữ nội dung theo canvas hoặc `panelEl` inline (không phải chrome CSS); thanh máu/XP có dynamic fill qua Canvas bên trong khung PNG.
  - **Sửa vi phạm/độ chính xác:** `kit.ts` dùng PNG `btn_*_selected` đã có sẵn, bỏ tô góc xanh thủ công chồng lên chrome được duyệt; `planning.ts` và `combat.ts` dùng đúng `SLICE[skin]` cho `tile_status`/`slot_well`, không cắt sai độ dày viền. Asset `ribbon` được tạo theo **3-slice ngang**, nên đã đổi bốn callsite trong `menu.ts`, `modal.ts`, `combat.ts`, `loading.ts` từ `nineSlice` sang `threeSlice`, tránh cắt dọc sai hình 48×24 px (slice 16 px).
  - **Automated evidence:** `pnpm exec vitest run tests/emojiIcon.test.ts tests/loading-title.test.ts tests/planning-shortcuts.test.ts` → 3 files/10 tests PASS; `pnpm run build` (`tsc --noEmit` + Vite) PASS (94 modules); Vite preview HTTP HEAD → 200 cho `/`, `/assets/ui/generated/manifest.json`, `/assets/ui/generated/btn_icon_selected.png`, `/assets/ui/generated/slot_well.png`. Những kiểm tra này xác nhận code/build/file served, **không** xác nhận pixel giao diện.
  - **Browser evidence còn thiếu:** chưa chạy Browser MCP, chưa có screenshots/visual pixel PASS. Lead cần xem thực tế loading/menu/card/modal/combat/planning/tooltip, nút trạng thái hover/pressed/disabled/selected và responsive portrait/landscape/desktop; xác minh tương phản chữ, panel/button/status badge, 9-slice/3-slice không méo, focus/interactive layers. Chỉ sau browser review mới chốt visual acceptance.
