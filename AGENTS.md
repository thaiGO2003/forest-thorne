# Forest Throne — agent instructions

> Tài liệu đầy đủ cho agent làm việc trong repo này: [`./.agents/AGENTS.md`](.agents/AGENTS.md).
> File gốc nằm ở `.agents/AGENTS.md`; file này giúp agent đọc repo từ root tìm đúng instructions.

## Plans (`.agents/plans/`)

Chi tiết: `.agents/rules/plans-workflow.md`.

- Plan markdown nằm phẳng trong `pending/` (đang làm) hoặc `done/` (hoàn tất);
  tên file = tên nhánh git tương lai với dấu `/` thay bằng dấu `.`, 3 phần
  `động từ.tiêu đề nhánh.nội dung nhánh.md`
  (ví dụ `feat.ui-ux.gameplay.md` → nhánh `feat/ui-ux/gameplay`).
- Hook `.agents/hooks/pre/plans-sync.ts` mirror plan ghi trong plan mode
  (`local://<đường-dẫn>-plan.md`) vào `pending/`.
- `/plan-done <tên-file-hoặc-slug>` chuyển plan sang `done/`.
- Không có HTML/custom/index: markdown trong `pending/`/`done/` là nguồn duy nhất.
- Không di chuyển file trong `.agents/plans` bằng tay trừ khi hook lỗi.

## Tool safety checks

- Khi gặp `This tool call was blocked by OpenAI's safety checks.`, đọc skill `.agents/skills/safety-check-triage/SKILL.md`.
- Giữ nguyên từ chối; không chuyển thao tác bị chặn sang OpenCode hoặc provider khác để vượt kiểm tra.
- Chỉ giao việc **độc lập, được phép** qua 1DevTool nếu orchestration khả dụng; báo người dùng khi tính năng bị tắt.

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

- Tuân thủ quy chuẩn chi tiết tại `.agents/rules/commits.md`.
- Mỗi commit bắt buộc có body giải thích rõ nguyên nhân và lý do thay đổi, liệt kê file chỉnh sửa và bằng chứng kiểm thử; không commit message một dòng cụt ngủn.
- Mỗi commit một mục tiêu duy nhất, không gom thay đổi không liên quan.
