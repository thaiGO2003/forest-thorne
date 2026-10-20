# Trạng thái khôi phục Forest Throne — 2026-10-21

> Báo cáo tiếp nối `docs/worktree-status-2026-10-20.md`. Snapshot ngày 2026-10-20 giữ nguyên. Chỉ ghi nhận việc đã kiểm chứng và phân biệt kiểm tra source/test với trình duyệt.

## 1. Git và migration

- Repository: `https://github.com/thaiGO2003/forest-thorne.git`.
- `main`: `9eb406cd5ed9f3abdbf5696252fcf2e6812354cc` — `chore(agents): migrate .omp to .agents`. Local `main` khớp `origin/main`, worktree sạch.
- `dev`: `8aa2de4be3944b17150091b98974cd7b158b88e6` — `merge(agents): synchronize restored agent configuration into dev`.
- Feature WBS-034: `59aa6aa` → merge `de05e48` vào `dev`.
- Feature WBS-080: `03283e9` → merge `91fc456` vào `dev`.
- Kiểm tra ancestry xác nhận `dev` chứa `9eb406c`, `de05e48` và `91fc456`. Không làm lại merge, không rewrite lịch sử.
- Source fix WBS-049: `ce346ef` — `fix(ui): honor asset-first chrome rendering`.
- Audio acceptance fix WBS-080: `6beffce` — `fix(audio): restore independent sound category controls`.
- Migration `.agents/` đã có `AGENTS.md`, `rules/`, `plans/`; completed WBS-033 plan nằm trong `.agents/plans/done/`. Changelog WBS-034 vẫn ghi tại `.agents/plans/changelog.md`.
- Không có unresolved Git index entries khi kiểm tra dev; trạng thái ban đầu trước audit là clean.

## 2. Worktree hiện có

| Đường dẫn | Branch | Commit ở thời điểm kiểm tra |
| --- | --- | --- |
| `/home/thaigo/forest-thorne` | `main` | `9eb406c` |
| `/home/thaigo/forest-thorne-dev` | `dev` | `8aa2de4` |
| `/home/thaigo/forest-thorne-plan-034` | `feat/world/3d-voxel-arena-terrain-meshes-instancedmesh` | `59aa6aa` |
| `/home/thaigo/forest-thorne-plan-080` | `feat/content/audio-director-procedural-sfx-manager` | `03283e9` |

Cả bốn worktree không có thay đổi chưa commit tại thời điểm khảo sát ban đầu. Không tạo worktree Crow: tính năng này chưa có implementation riêng để khôi phục.

## 3. Verification đã ghi nhận

| Kiểm tra | Bằng chứng / giới hạn |
| --- | --- |
| `main` frozen install | `pnpm install --frozen-lockfile` PASS trong phiên khôi phục |
| `main` typecheck, build | PASS trong phiên khôi phục |
| WBS-034 | `tests/arena-mapping.test.ts`: 8 passed |
| WBS-080 integration trước acceptance | 3 file audio test, 17 PASS |
| `dev` sau migration merge | 4 file targeted Vitest: 25 passed; `pnpm typecheck`, `pnpm build` PASS |
| WBS-049 static/UI smoke sau source fixes | `pnpm exec vitest run tests/emojiIcon.test.ts tests/loading-title.test.ts tests/planning-shortcuts.test.ts`: 3 files, 10 PASS; typecheck/build PASS; HTTP 200 cho homepage và UI PNG manifests/assets. Không chứng minh pixel appearance. |
| WBS-080 acceptance audit (2026-10-21) | 6 targeted files / **59 tests PASS** (audio ambient, SFX, music, modal lifecycle, recovered playback, persistence); `pnpm typecheck` PASS; `pnpm build` PASS (94 modules). Regression tests kiểm tra category mute/recovery và combat impact events. |
| Dev HTTP | Vite `http://127.0.0.1:5173/` trả HTTP 200 trong phiên khôi phục |
| BrowserPanel | 1DevTool BrowserPanel kết nối project `86187d59-4140-460c-a826-d730aa1f693b`, tab `default` |
| Browser settings | Accessibility snapshot trong gameplay có các điều khiển planning và Settings modal; modal Audio có global audio, music, volume, narration, source/track |
| Browser audio independent controls (2026-10-21) | Trên Settings, toggle Ambient `Bật → Tắt → Bật`, sau đó UI SFX `Bật → Tắt → Bật`: snapshot xác nhận các nhóm khác giữ `Bật`. General/music volume vẫn 5/10. Đây chỉ là state/control evidence, không chứng minh âm thanh nghe được. |
| Browser combat audio independent control (2026-10-21) | Sau audio patch, Settings hiển thị music, ambient, UI SFX và combat SFX. Combat SFX `Bật → Tắt → Bật` được xác nhận bằng BrowserPanel snapshots; music/ambient/UI SFX vẫn `Bật`, volume không đổi. Chưa xác nhận audible output. |
| Browser resume flow (2026-10-21) | `Tiếp tục` từ main menu mở màn planning với `Bắt đầu (-1 ❤️)`, `Mua XP`, `Cây công nghệ`, `Chế tạo`, `Lịch sử`, `Thông tin`, `Cài đặt`, `Cửa hàng thú`. Chưa kiểm chứng pixel WebGL/audio trong trận. |
| Browser planning dialog/tooltip (2026-10-21) | `Cây công nghệ` mở dialog, heading `Gốc rừng`; khi đóng Settings và chuyển focus, snapshot có tooltip `Thư viện`. Đây là accessibility/interaction evidence, chưa phải visual pixel audit. |
| Independent desktop/mobile render probe (2026-10-21) | Chromium via Playwright-core với SwiftShader: `#app[data-boot=ready]` hiển thị tại 1280×720 và 390×844; màn hình menu hiển thị board isometric, terrain/props, PNG chrome, modal và toolbar. Screenshot đã được phân tích: không phát hiện blank canvas, broken assets hay clipping/overlap rõ ràng ở hai viewport. Mobile canvas chính 390×844 có WebGL2 context. Đây là **visual smoke màn menu**, không chứng minh tất cả screens, animation, combat hay responsiveness tại mọi kích thước. |
| Browser console | Có Vite HMR WebSocket failure cùng cảnh báo WebGPU trong log; chưa suy ra WebGL không hoạt động từ cảnh báo WebGPU |
| BrowserPanel screenshot | 1DevTool BrowserPanel trả metadata 639×840 nhưng bỏ image payload khỏi model context. Bằng chứng hình ảnh quan sát được đến từ screenshots Playwright-core riêng tại 1280×720 và 390×844 ở `/tmp/forest-recovery-2026-10-21/`. |
| Audio thực | Chưa có bằng chứng nghe được âm thanh hoặc đồng bộ chính xác giữa audio và pixel impact; **không xác nhận playback PASS** |

## 4. WBS acceptance

- **WBS-034**: đã tích hợp code và targeted tests đạt; game board WebGL xuất hiện trong screenshots menu desktop/mobile (không blank/đen, không thấy lỗi rõ ràng). Chưa chứng minh gameplay pixel correctness, scene animation hoặc performance trong trận.
- **WBS-080**: AudioAcceptance đã hoàn tất sửa implementation: độc lập/persist music, ambient, UI và combat mute, backward-compatible settings defaults, category-aware SFX và ambient recovery; regression cho combat semantic events tại animation impact. 6 files / 59 targeted tests, typecheck và build PASS; BrowserPanel đã chứng minh bốn controls và combat toggle độc lập. **Giữ pending**: chưa chứng minh âm thanh thực sự nghe được, AudioContext permission/resume failure, hoặc đồng bộ auditory/visual impact ở các game-speed. External sample đang phát có thể còn tiếp tục ngắn sau mute vì sample player không hỗ trợ cancel.
- **WBS-049**: engine asset-first tại `src/ui/kit.ts` và consumers PNG 9-slice/3-slice; `src/ui/chrome.ts` không tồn tại. Commit `ce346ef` loại bỏ hand-painted selected corners trong `kitButton`, dùng selected PNG, sửa `SLICE[skin]` cho trạng thái planning/combat, chuyển ribbon sang `threeSlice` tại `menu.ts`, `modal.ts`, `loading.ts`, `combat.ts`, và bỏ CSS color/opacity decoration trong `ui.css`. 10 targeted tests, typecheck và build PASS; HTTP PNG smoke PASS. Ảnh menu desktop/mobile hiển thị chrome đầy đủ, không thấy lỗi clipping hoặc asset vỡ rõ ràng. **Giữ pending** cho tới khi kiểm chứng trực tiếp tất cả target panels, states và responsive layouts.
- **Crow**: pending, không đánh dấu hoàn thành và không tạo worktree mới.

## 5. Backup và remote

- `origin/temp/backup-pre-reset-2026-10-20` vẫn tồn tại tại `8c979dbbd3b63e44b6cbb08425d7b8a347afec12`, **không xóa**.
- Remote `main` được kiểm tra tại `9eb406c`; remote `dev` tại `d77892d` trước khi đồng bộ các commit khôi phục.
- **Checkpoint sau push đầu tiên (2026-10-21):** `git push origin dev` fast-forward `d77892d..0226019` (không force); `git ls-remote` xác nhận `origin/dev = 0226019aee4f45ce2768dddb1b0ec46ba1cd4c52`, bằng local `dev` tại checkpoint. `origin/main = 9eb406cd5ed9f3abdbf5696252fcf2e6812354cc`, backup branch vẫn `8c979dbbd3b63e44b6cbb08425d7b8a347afec12`. Addendum báo cáo này sẽ tạo commit mới sau checkpoint; xác minh remote HEAD của commit mới riêng sau push.
- Không force-push, không đưa `.env`, secret hoặc artifacts build vào Git.
- Sau checkpoint trên, cả bốn worktree `main`, `dev`, WBS-034 và WBS-080 đều sạch (`git status --short --branch` chỉ hiển thị branch header, không có file thay đổi).

## 6. Việc cần xử lý / giới hạn bằng chứng

- WBS-080: source fixes và automated integration verification hoàn thành; BrowserPanel xác nhận independent controls. Acceptance audible music/ambient/UI/combat playback, permission recovery và impact synchronization vẫn pending. WBS-049 source fixes, smoke và menu desktop/mobile đã có evidence; vẫn cần pixel review loading/card/modal/combat/planning, trạng thái button và responsive thật.
- Kiểm chứng UI ở các màn chưa cover, WebGL gameplay pixels và audible playback / resume / impact synchronization bằng môi trường có khả năng quan sát tương ứng. Screenshot tĩnh không thay thế kiểm thử interaction/animation hoặc nghe âm thanh.
- Chỉ chuyển plan sang `done/` khi đủ acceptance evidence; với plan chưa đầy đủ phải giữ `pending/` và ghi rõ nguyên nhân.
- Sau khi ghi addendum checkpoint, push `dev` fast-forward lần cuối và xác minh remote HEAD bằng `git ls-remote` so với `git rev-parse dev` (không tự đóng WBS-049/WBS-080).
