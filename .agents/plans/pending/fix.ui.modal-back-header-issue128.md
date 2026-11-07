# Issue #128 addendum — Back icon và căn tiêu đề modal

- Issue: https://github.com/thaiGO2003/forest-thorne/issues/128
- Nhánh: `fix/ui/modal-back-header-issue128`
- Worktree: `/home/thaigo/forest-thorne-issue-128-header`
- Base: `origin/dev` tại `ff435c84faaeff9086faa09cf409ebe12320aa34` (PR #150 đã merge).
- Prerequisite: visual plan từ Visual Developer, task `01a1b5e2-4a5d-7700-845f-939a788ec7aa`. Không triển khai code trước khi nhận plan.

## Contract của owner

- Back chỉ có icon, đặt ngay bên trái nút Close (X), hit target tối thiểu 44×44 CSS px, `aria-label="Quay lại"`; tooltip tùy chọn.
- Tiêu đề modal mặc định căn trái. Nếu góc header có từ hai action buttons trở lên (ví dụ Back + Close hoặc headerAction + Close), tiêu đề có thể giữ căn giữa; chỉ Close thì tiêu đề căn trái.
- Không che tiêu đề, X, action khác hoặc nội dung ở 390×844 và 1280×720; phải có ảnh thật cho cả hai trạng thái header một nút và từ hai nút.
- Giữ one-active-modal, typed origin, close reasons, cleanup/focus và hành vi Back đã merge; không tạo global stack. Không mở rộng lại phạm vi #128.
- UI asset-first: dùng asset/kit đã duyệt; CSS chỉ bố trí/kích thước/responsive, không vẽ chrome.

## Triển khai sau visual plan

1. Đối chiếu visual plan với asset/kit hiện có và modal host; áp dụng layout theo phương án được bàn giao.
2. Bảo toàn thứ tự Tab, Enter/Space, Escape, nhãn accessible, focus/close semantics; kiểm tra headerAction và modal mandatory.
3. Bổ sung hoặc cập nhật targeted behavioral regression cho số nút, vị trí/khả năng sử dụng và các nhánh modal bị ảnh hưởng; không coi remediation keyboard chưa merge ở worktree cũ là đã pass.
4. Smoke bằng browser thật; chụp 4 ảnh: một nút và từ hai nút tại 390×844 và 1280×720. Ghi rõ tool, thiết lập DPR và giới hạn. Kiểm tra va chạm title/action/content.
5. Chạy targeted suite, `pnpm typecheck`, `pnpm build`, `git diff --check`; báo SHA, files, kết quả và evidence cho Leader. Không tạo PR, merge hoặc đóng issue.

## Không thuộc phạm vi

Không chỉnh worktree cũ `/home/thaigo/forest-thorne-issue-128` hoặc mang các thay đổi remediation chưa commit sang đây khi chưa được giao. Không chỉnh gameplay, logic navigation, schema hay asset không liên quan.

## Visual plan — Visual Developer (task `01a1b5e2`, 2026-11-07, base `ff435c8`)

### Baseline hiện có (sau PR #150)
- `.agents/merge-review/feat.ui.modal-back-navigation-issue128/after-mobile-390x844.png` và `after-desktop-1280x720.png` là baseline "before" cho trạng thái **≥2 nút** của addendum này: Settings → «Về menu chính». Trong ảnh, Back là nút gỗ có chữ «Quay lại» ở góc trái trên, X ở góc phải. `.modal-frame:has(> .modal-back) .modal-head { margin-top: 44px }` đẩy ribbon xuống 44px, và ribbon căn giữa.
- `before-*-390x844/1280x720.png` (base `45ac2af`) là trạng thái **1 nút** (chỉ X, ribbon căn giữa). Ảnh này chụp trước #150. Developer nên chụp lại trạng thái 1 nút trên `ff435c8` (ví dụ Library root hoặc History) để before và after cùng base.
- Chưa có baseline cho **headerAction + X** (Settings root, nút 🏠). Cần chụp trước khi sửa.

### Asset / provenance (chỉ dùng thứ có sẵn)
- Khung nút: `public/assets/ui/generated/btn_icon_{normal,hover,pressed,selected,disabled}.png`, sinh bởi `scripts/gen-ui-kit.mjs:193`. Đây là cùng skin `icon` mà `.modal-header-action` đang dùng, nên tự có đủ trạng thái hover/active/focus/disabled.
- X: `btn_close_{normal,hover,pressed}.png` (`gen-ui-kit.mjs:199`), giữ nguyên.
- Ribbon tiêu đề: `ribbon` 3-slice (`gen-ui-kit.mjs:214`), giữ nguyên asset, chỉ đổi toạ độ vẽ.
- **Glyph Back: chưa có icon được duyệt.** `SEMANTIC_EMOJIS` trong `src/core/emojiIcon.ts` không có mục back/arrow-left (chỉ có `refresh 🔄`, `bow 🏹`). Đề xuất (provisional, cần Leader/owner duyệt): thêm một mục semantic `back: { char: "↩️", slug: "right-arrow-curving-left" }` theo đúng pipeline emoji-api hiện có. Không vẽ asset mới, không hard-code emoji trong `modal.ts`. Phương án dự phòng là `⬅️` (`left-arrow`). Không dùng 🔄, vì icon đó đã có nghĩa reroll.

### Bố cục header
Cụm nút góc phải, ô 44×44, khe 4px, cách mép phải 14px (mobile ≤760px: 8px) như `.modal-close` hiện tại:
```
[ title/ribbon ............ ] [Back][🏠?][X]
```
- Thứ tự từ phải sang trái: X ở `right:14`, Back ngay trái X ở `right:62`. Nếu có headerAction thì đặt bên trái Back ở `right:110`. Hiện không có modal nào có cả Back lẫn headerAction (Settings root có 🏠 nhưng không có Back; confirm có Back nhưng không có 🏠). Dù vậy layout vẫn phải chịu được trường hợp này.
- Back: `kitButton({ skin: "icon", icon: ICONS.back, aria: t("ui.back"), cls: "modal-back" })`, chỉ có icon, không có label chữ. Kích thước 44×44, `top` bằng X. Bỏ rule `margin-top: 44px` của `.modal-head`.
- Tooltip ngắn: tuỳ chọn. Nếu thêm, dùng `tip.bind(el, () => ({ title: t("ui.back") }))` như các nút icon ở planning. Không cần tooltip trên mobile.
- Tab order đề xuất: title/body → Back → (🏠) → X, hoặc giữ thứ tự DOM hiện tại. Tiêu chí bắt buộc là Back phải đứng trước X khi Tab. Focus ring giữ như hiện tại (hover state + outline trình duyệt).

### Căn title (vẽ trong painter `ribbon` của `modal.ts`)
- Gọi `n` là số nút ở góc, `cluster = 14 + n*44 + (n-1)*4` (mobile: 8 thay cho 14).
- **n = 1 (chỉ X):** ribbon bắt đầu ở x = 0 (căn trái), `rw = min(w - cluster - 8, max(240, len*24+100))`. Label căn giữa trong ribbon, vì ribbon là băng có hai đuôi. Ribbon không được vượt quá phần đầu cụm nút.
- **n ≥ 2:** căn giữa **chỉ khi ribbon vừa khoảng đối xứng**, tức `rw ≤ w - 2*cluster`. Nếu không vừa thì rơi về căn trái như n = 1.
  - Kết quả đo: modal-sm ở 390 có head khoảng 346px, cluster(2) ≈ 100px nên ribbon căn giữa tối đa ≈ 146px. Mức này nhỏ hơn min 240, nên **mobile luôn căn trái**.
  - Ở 1280: modal-sm có head khoảng 360px, nên cũng phải căn trái; modal-lg/full (≥860px) căn giữa được. Owner cho phép căn giữa ("được phép") chứ không bắt buộc, nên rơi về căn trái không trái contract. Cần nêu rõ điều này trong evidence.
- `maxW` của label = `rw - 108` như cũ. Title dài bị co bằng maxW, không đè lên nút.
- CSS chỉ dùng cho layout: `.modal-back { right: 62px; left: auto; width/height: 44px }`, cập nhật `.modal-header-action` khi có Back, và media ≤760px đổi offset. Không thêm màu/viền/bóng. Painter dùng lại `threeSlice("ribbon")`, chỉ đổi x.

### Ngoài modal host (cần Leader chốt scope)
- `.craft-overlay-head` (crafting `overlay.ts:42`, `library.ts:410`) vẫn dùng Back gỗ có chữ. Owner viết "trong cùng cụm header", nên để nhất quán đề xuất đổi luôn sang icon-only, đặt sát trái X của overlay. Title overlay là `h2` DOM nên căn trái là mặc định.
- `.lib-back` («Về thư viện») là điều hướng nội bộ trong body, không phải header. Đề xuất giữ nguyên.

### Evidence cần chụp (sau implement; trước implement chụp cùng màn trên `ff435c8`)
| Trạng thái | Màn | 390×844 | 1280×720 |
|---|---|---|---|
| 1 nút (X), title trái | Library root hoặc History | before/after | before/after |
| ≥2 nút (Back+X) | Settings → «Về menu chính» (modal-sm, căn trái fallback) | before = ảnh #150 | before = ảnh #150 |
| ≥2 nút, căn giữa thật | Library detail mở từ Inventory (modal-lg), Back + X | before/after | before/after |
| headerAction + X | Settings root (🏠 + X) | before/after | before/after |
| Back hover / pressed / focus (Tab) | Settings confirm | — | after |
| Crafting overlay Back (nếu được duyệt) | Craft → Thư viện → item | after | after |

Metrics nên đo bằng `getBoundingClientRect`:
- Back và X đều 44×44.
- Diện tích giao giữa Back, X, 🏠 và ribbon/title bằng 0.
- Không nút nào đè lên `.modal-body`.
- `aria-label="Quay lại"`.
- `document.activeElement` khi Tab.
- Không có request ảnh mới nào ngoài emoji `back`, kiểm bằng network log.

### Visual acceptance
- [ ] Back chỉ có icon, nằm ngay trái X, 44×44, `aria-label` «Quay lại», đủ hover/pressed/focus qua `btn_icon_*`.
- [ ] 1 nút: title trái. ≥2 nút: title giữa khi vừa, nếu không vừa thì căn trái; evidence ghi rõ trường hợp nào.
- [ ] Không chồng title/X/🏠/content ở 390×844 và 1280×720. Ribbon không còn bị đẩy xuống 44px.
- [ ] Không có CSS chrome mới, không có asset ảnh mới ngoài một emoji semantic (nếu được duyệt). Không thêm loop/animation.
- [ ] Hành vi Back/Esc/X, one-active-modal và focus restore không đổi (test #150 vẫn pass).

### Quyết định Leader
1. Glyph `⬅️`, semantic `left-arrow` qua `src/core/emojiIcon.ts` và pipeline asset hiện có.
2. Header từ hai nút: title chỉ căn giữa khi đủ chỗ, nếu không thì căn trái.
3. Crafting overlay và `.lib-back` trong body ngoài phạm vi addendum.
4. Tooltip tùy chọn; không thêm.
