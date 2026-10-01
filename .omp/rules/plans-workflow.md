---
description: Plan file workflow (pending/done/custom)
---

# Plans (`.omp/plans/`)

- `pending/` — plan markdown chuẩn của agent, chờ duyệt / đang thực hiện.
  Plan mode tự sync qua hook `.omp/hooks/pre/plans-sync.ts`: mọi plan ghi vào
  `local://<slug>-plan.md` được mirror vào đây và render ra HTML.
- `done/` — plan đã hoàn tất. Khi hoàn thành plan `<slug>`, chạy
  `/plan-done <slug>` (hook chuyển file, cập nhật badge HTML và index).
  Không di chuyển tay trừ khi hook lỗi.
- `custom/` — trang HTML để người dùng đọc. `custom/plan.css` là **CSS duy nhất**
  cho mọi trang HTML trong `custom/html/` — cần style gì thì bổ sung vào đúng
  file đó, không tạo CSS riêng.
- `custom/html/agent-index.html` — index do hook sinh ra, không sửa tay.
- Trang HTML sinh tự động (`<slug>-plan.html`, `agent-index.html`) sẽ bị ghi đè
  khi plan đổi — nội dung plan chuẩn luôn là file markdown trong `pending/`/`done/`.
