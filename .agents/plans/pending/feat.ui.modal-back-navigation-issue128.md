# Issue #128 — Nút Quay lại cho modal sub-surface

- Issue: https://github.com/thaiGO2003/forest-thorne/issues/128
- Owner verdict: APPROVE WITH CHANGES, comment `6701404339`
- Branch: `feat/ui/modal-back-navigation-issue128`
- Base: `origin/dev` at `45ac2af24a5dd5963ad19fa3ffcfe67cc954b244`
- Worktree: `/home/thaigo/forest-thorne-issue-128`

## Vấn đề

Modal host hiện chỉ giữ một modal hoạt động và thay modal sẽ dispose view trước. Back phải khôi phục đúng parent surface/context mà không dựng một global modal stack, không nhầm navigation với user dismissal, và không gây callback/focus cleanup hai lần.

## Contract đã được owner duyệt

- Giữ one-active-modal host; **không** tạo global modal stack.
- `ModalOptions.onBack?: { label: string; restore(): void }`; chỉ render control khi được cung cấp.
- Dùng `ModalOrigin` là discriminated union có kiểu cụ thể cho từng surface (Library, Inventory, Enemy detail, Settings confirm); không để `unknown` trong API cuối.
- Tách close reason `dismiss` (X/Escape/shade), `back`, `replace`. `replace` không chạy side effect của user-dismissal, không gọi `onClose` và không khôi phục focus stale; cleanup đúng một lần.
- Khôi phục focus sau khi parent render; nếu opener không còn tồn tại thì focus fallback hợp lệ trong parent.
- Giữ preview star/skin/animation trong cùng detail session; không persist qua lần root reopen.

## Phạm vi theo wave

### P0 — API/control và Settings confirmation

- Thêm contract origin/back/close-reason tối thiểu vào modal host/helper hiện có.
- Render nút `Quay lại` từ kit asset-first, accessible và chỉ khi có callback.
- Settings → return-menu confirm: Back/Cancel/X/Escape trở về Settings, giữ nguyên options.
- Bảo đảm dismiss và replace semantics, focus restore/fallback và cleanup một lần.

### P1 — Cross-surface parent restoration

- Library grid → detail: giữ tab/query/filter/page/scroll/focused card; detail mở trực tiếp không có origin thì **không** tạo Back giả. Browse → detail dùng Back nội bộ hiện có.
- Planning owned unit → unit inventory: giữ selection/focus; Inventory → Library detail: giữ UID/equipment/scroll/action context.
- Planning enemy preview → enemy detail: Back khôi phục đúng Planning/preview context.
- UID/route invalid hoặc unit đã bị xóa: bỏ origin cũ, fallback về Planning hiện tại; không mở modal rỗng/khôi phục stale selection.

### P2 — Crafting local history

- Giữ nhiều bước item/recipe/related-item trong local overlay history của Crafting, không đưa history vào modal host toàn cục.
- Back lùi đúng một child; X/Escape dismiss child flow về workbench.
- Quick-nav là transient navigation, không tự tạo returnable parent.

## Non-goals

- Không global modal stack hoặc thay đổi kiến trúc one-active-modal.
- Không Back thừa cho root Menu/Settings/Library/Recipes/Craft/Tech/History/Inventory/Information; không thêm Back vào modal mandatory augment/blessing/result; modal mandatory vẫn non-dismissible.
- Không biến quick-nav thành navigation history.
- Không thay đổi gameplay, inventory/save schema hoặc preview state ngoài cùng detail session.
- Không vẽ chrome bằng CSS; Back control phải dùng asset/kit có sẵn.

## Acceptance

- Open → Back trả về parent và khôi phục state/focus được yêu cầu.
- Child → grandchild → Back ×2 lùi đúng từng cấp.
- Back rồi X/Escape không double-close, không gọi `onClose` lặp.
- Invalid/removed UID hoặc changed route fallback an toàn về Planning hiện tại.
- Root/mandatory modal không có Back sai hoặc dismissal không hợp lệ.
- Lặp open/close 50–100 lần không rò listener/canvas/history; focus/key handling hoạt động với Tab/Enter/Back/Escape.
- Có bảng modal → parent → cần Back? trong mô tả PR.
- Chụp ảnh before/after trên browser thật ở 390×844 và 1280×720; 844×390 là viewport bổ sung. Back không che title, X hay nội dung.
- UI tuân thủ asset-first; không thêm CSS chrome/color/gradient/shadow/border để dựng nút.

## Kiểm chứng và evidence

- `pnpm typecheck`
- `pnpm exec vitest --run <test files liên quan tới ModalHost, Settings confirmation, Library, Planning inventory/enemy detail và Crafting overlays>`
- `pnpm build` (shared UI/runtime)
- `git diff --check`
- Smoke thực tế trên 390×844, 1280×720; ghi rõ browser/tool thực dùng và giới hạn nếu BrowserPanel không mount.
- Evidence tại `.agents/merge-review/feat.ui.modal-back-navigation-issue128/`: `evidence.md`, screenshot 390×844, 1280×720, và gate output nếu có.

## Rủi ro và rollback

- Rủi ro chính: callback close side effect chạy sai reason, stale focus target, origin union thiếu case, local Crafting history không giải phóng resources.
- Giữ API có scope hẹp; nếu phát sinh surface ngoài danh sách, ghi rõ matrix/decision thay vì thêm fallback `unknown` hoặc global stack.
- Nếu regression sau merge, revert PR sau khi kiểm tra downstream dependencies; không reset/force-push dev.
