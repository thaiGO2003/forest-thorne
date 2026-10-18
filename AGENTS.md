# Forest Throne — agent instructions

> Tài liệu đầy đủ cho agent làm việc trong repo này: [`./.omp/AGENTS.md`](.omp/AGENTS.md).
> File gốc nằm ở `.omp/AGENTS.md`; file này dùng để mọi agent đọc repo mặc định từ root đều có instruction nhất quán.

## Plans (`.omp/plans/`)

Chi tiết: `.omp/rules/plans-workflow.md`.

- Plan markdown nằm ở `pending/` (đang làm) hoặc `done/` (hoàn tất); đặt tên
  file = tên nhánh git tương lai, 3 cấp `động từ/group/nội dung code`
  (ví dụ `feat/planning-screen/font.md` → nhánh `feat/planning-screen/font`).
- Hook `.omp/hooks/pre/plans-sync.ts` mirror plan ghi trong plan mode
  (`local://<đường-dẫn>-plan.md`) vào `pending/`, render HTML vào
  `custom/html/pending/|done/` và sinh `custom/html/agent-index.html`.
- `/plan-done <đường-dẫn-hoặc-tên-leaf>` заверш chuyển sang `done/`.
- `custom/plan.css` là CSS duy nhất cho mọi trang HTML; chỉ sửa trang HTML do
  hook sinh được phép ghi đè tự động.
- Không di chuyển file trong `.omp/plans` bằng tay trừ khi hook lỗi.

## UI Asset-First Rules

- Với UI production của game, CSS chỉ dùng cho layout/toạ độ/responsive; không dùng CSS để tô màu hoặc dựng chrome/texture.
- Không thêm `color`, `background-color`, border/outline color, gradient, shadow, pseudo-element trang trí, filter/tint/hue để vẽ button/panel/card/badge/status.
- Ưu tiên cắt PNG từ asset pack đã duyệt và render bằng `<img>`, Canvas `drawImage`, sprite/texture hoặc 9-slice/3-slice; không stretch nguyên PNG làm méo viền.
- Emojis/icons semantic ưu tiên theo `src/core/emojiIcon.ts` + emoji-api.com; không hardcode emoji riêng lẻ nếu helper chung đã hỗ trợ, tuyệt đối không commit API key.
- Khi production dùng template/engine đặt constraint khác mà asset-first phải theo, priority vẫn ưu tiên asset; chỉ chọn phương án khác khi có ràng buộc硬 và phải ghi rõ.

## Package Manager

- **Luôn dùng `pnpm`** cho mọi lệnh install, run, exec, dlx trong repo này.
  - Install: `pnpm install` (không dùng `npm install` hay `yarn`).
  - Chạy script: `pnpm run <script>` hoặc `pnpm <script>` (shorthand).
  - Exec binary: `pnpm exec <bin>` thay cho `npx`.
  - Add/remove dep: `pnpm add`/`pnpm remove`.
- Khi sinh lệnh trong plan hoặc reply, mặc định dùng `pnpm`; chỉ dùng `npm`/`npx` khi file cụ thể (e.g. bash script deploy) yêu cầu giải thích rõ lý do ngoại lệ.

## Commit Rules

- Tuân thủ quy chuẩn chi tiết tại `.omp/rules/commits.md`.
- Mỗi commit bắt buộc có body giải thích rõ nguyên nhân và lý do thay đổi, liệt kê file chỉnh sửa và bằng chứng kiểm thử; không commit message một dòng cụt ngủn.
- Mỗi commit một mục tiêu duy nhất, không gom thay đổi không liên quan.
