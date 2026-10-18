---
description: Plan file workflow (pending/done/custom)
---

# Plans (`.omp/plans/`)

## Quy tắc đặt tên plan file

- Tên file = **tên nhánh git** tương lai, dạng 3 cấp `động từ/group/nội dung code`:
  - Động từ: `feat` / `fix` / `refactor` / `docs` / `chore` / `test` / `build`.
  - Group: khu vực code chịu tác động chính (screen/system), ví dụ `planning-screen`, `library`, `combat`, `mod-manager`.
  - Nội dung: việc cụ thể, ví dụ `font`, `tooltip`, `billboard`.
  - Ví dụ: `feat/planning-screen/font.md` → nhánh `feat/planning-screen/font`.
- File nằm trong `pending/` hoặc `done/` (bảo toàn cây thư mục trên):
  `.omp/plans/pending/feat/planning-screen/font.md`,
  `.omp/plans/done/fix/library/tooltip.md`.

## Vòng đời

- `pending/` — plan markdown chuẩn của agent, chờ duyệt / đang thực hiện.
  Plan mode tự sync qua hook `.omp/hooks/pre/plans-sync.ts`: mọi plan ghi vào
  `local://<dường-dẫn>-plan.md` (có thể nhiều cấp, ví dụ
  `local://feat/planning-screen/font-plan.md`) được mirror vào
  `.omp/plans/pending/<tên-file>.md` và render HTML tương ứng.
- Slug 1 cấp giữ tương thích cũ: `local://<slug>-plan.md` →
  `.omp/plans/pending/<slug>-plan.md`.
- `done/` — plan đã hoàn tất. Khi hoàn thành, chạy
  `/plan-done <đường-dẫn-hoặc-tên-leaf>`; hook dời file (giữ nguyên cây thư mục),
  render HTML vào group `done` với badge DONE, xoá HTML pending tương ứng.
  Không di chuyển tay trừ khi hook lỗi.
- Plan file legacy (tên phẳng sẵn có trong `pending/`/`done/`) vẫn hoạt động
  nguyên vẹn; đổi tên dần quy tắc mới khi chạm tới.

## Custom (trang HTML đọc cho người dùng)

- `custom/plan.css` là **CSS duy nhất** cho mọi trang HTML trong `custom/html/` —
  cần style gì thì bổ sung vào đúng file đó, không tạo CSS riêng.
- `custom/html/` có đúng **2 nhóm**: `pending/` và `done/`, mirror cây file plan
  (`custom/html/pending/feat/planning-screen/font.html` ↔
  `custom/html/done/...`), kèm `custom/html/agent-index.html` (hook sinh, gồm
  đúng 2 section Pending/Done + mục Custom viết tay).
- Chỉ `agent-index.html` và HTML do hook render được ghi đè tự động; trang viết
  tay (ví dụ `pending/wbs.html`) không bị hook đè.
- Nội dung plan chuẩn luôn là markdown trong `pending/`/`done/`.
