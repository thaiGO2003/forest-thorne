# Forest Throne — convention cho agent

## Plans (`.omp/plans/`)

Chi tiết đầy đủ: `.omp/rules/plans-workflow.md`.

- Tên file plan = tên nhánh git tương lai, 3 cấp `động từ/group/nội dung code`
  (ví dụ `feat/planning-screen/font.md`), đặt trong `pending/` hoặc `done/`.
- `pending/` — plan markdown chuẩn của agent, chờ duyệt / đang thực hiện.
  Plan mode tự sync qua hook `.omp/hooks/pre/plans-sync.ts`: mọi plan ghi vào
  `local://<đường-dẫn>-plan.md` được mirror vào đây và render HTML vào
  `custom/html/pending/` (slug 1 cấp giữ định dạng legacy `<slug>-plan.md`).
- `done/` — plan đã hoàn tất. Khi hoàn thành plan, chạy
  `/plan-done <đường-dẫn-hoặc-tên-leaf>` (hook chuyển file, cập nhật badge
  HTML, xoá HTML pending và index). Không di chuyển tay trừ khi hook lỗi.
- `custom/html/` có đúng 2 nhóm: `pending/` và `done/` (mirror cây plan);
  `custom/plan.css` là **CSS duy nhất** cho tất cả — cần style gì thì bổ sung
  vào đúng file đó, không tạo CSS riêng.
- `custom/html/agent-index.html` — index do hook sinh ra, không sửa tay.
- Trang HTML sinh tự động sẽ bị ghi đè khi plan đổi — nội dung plan chuẩn luôn
  là file markdown trong `pending/`/`done/`.
## UI Asset-First Rules

- Với UI production của game, CSS chỉ dùng cho layout/toạ độ/responsive; không dùng CSS để tô màu hoặc dựng chrome/texture.
- Không thêm `color`, `background-color`, border/outline color, gradient, shadow, pseudo-element trang trí, filter/tint/hue để vẽ button/panel/card/badge/status.
- Ưu tiên cắt PNG từ asset pack đã duyệt và render bằng `<img>`, Canvas `drawImage`, sprite/texture hoặc 9-slice/3-slice; không stretch nguyên PNG làm méo viền.
- `background-image` / `border-image` CSS chỉ giữ cho legacy compatibility, không dùng làm hướng triển khai UI mới.
- Gameplay fill động như HP/rage/highlight có thể do Canvas/WebGL vẽ; frame/chrome tĩnh phải asset-first.
- Emoji/icon semantic ưu tiên đi qua `src/core/emojiIcon.ts` và emoji-api.com khi có `VITE_EMOJI_API_KEY`; không hardcode emoji riêng lẻ nếu helper chung đã hỗ trợ, và tuyệt đối không commit API key.

## Package Manager

- **Luôn dùng `pnpm`** cho mọi lệnh install, run, exec, dlx trong repo này.
  - Install: `pnpm install` (không dùng `npm install` hay `yarn`).
  - Chạy script: `pnpm run <script>` hoặc `pnpm <script>` (shorthand).
  - Exec binary: `pnpm exec <bin>` thay cho `npx`.
  - Add/remove dep: `pnpm add`/`pnpm remove`.
- Khi sinh lệnh trong plan hoặc reply, mặc định dùng `pnpm`; chỉ dùng `npm`/`npx` khi file cụ thể (e.g. bash script deploy) yêu cầu giải thích rõ lý do ngoại lệ.

## Commit Rules

- Tuân thủ quy chuẩn commit chi tiết tại `.omp/rules/commits.md`.
- Mỗi commit bắt buộc có body giải thích rõ nguyên nhân và lý do thay đổi, liệt kê file chỉnh sửa và bằng chứng kiểm thử; không commit message một dòng cụt ngủn cho các thay đổi logic/UI.
