# WBS-091: Headless Browser Playtest & Visual Screenshot Verification

> Plan tách từ WBS master (Mega Prompt V3) — mỗi task là một plan/nhánh độc lập.

- **WBS:** WBS-091 · Phase POLISH
- **Nhánh đích:** `chore/polish/headless-browser-playtest-visual-screenshot-verification`
- **Tham chiếu:** `§54, §56`
- **Phụ thuộc:** Deps: WBS-036, WBS-052, WBS-056, WBS-066
- **Trạng thái WBS:** Chưa hoàn thành (WBS)

## Nội dung
- [ ] **WBS-091: Headless Browser Playtest & Visual Screenshot Verification** `§54, §56` *(Deps: WBS-036, WBS-052, WBS-056, WBS-066)*
  - **Mô tả:** Quy trình nghiệm thu thực tế bằng Chromium Headless Playwright: khởi động game, chụp ảnh màn hình canvas 3D, đo đạc FPS thực tế, kiểm tra console log sạch 0 error, và chơi thử 1 vòng đấu thật.
  - **Tiêu chí nghiệm thu:** Chứng minh bằng hình ảnh và log thực nghiệm trước khi công bố hoàn thành dự án.
  - **Audit Note:** ⚠ Logic-only audit 2026-10-05: browser boot, screenshots, FPS and console verification are visual/e2e acceptance work rather than runtime gameplay implementation.
