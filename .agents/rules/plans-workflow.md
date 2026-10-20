---
description: Plan file workflow (pending/done, tên phẳng 3 phần)
---

# Plans (`.agents/plans/`)

## Quy tắc đặt tên plan file

- Tên file = tên nhánh git tương lai với dấu `/` thay bằng dấu `.`, gồm 3 phần
  `động từ.tiêu đề nhánh.nội dung nhánh.md`:
  - **Động từ**: `feat` / `fix` / `refactor` / `docs` / `chore` / `test` / `build`.
  - **Tiêu đề nhánh**: khu vực/hạng mục chính, ví dụ `ui-ux`, `library`, `combat`.
  - **Nội dung nhánh**: việc cụ thể, ví dụ `gameplay`, `tooltip`, `font`.
  - Ví dụ: `feat.ui-ux.gameplay.md` → nhánh `feat/ui-ux/gameplay`;
    `docs.spec.forest-throne-rebuild.md` → nhánh `docs/spec/forest-throne-rebuild`.
- **File nằm phẳng** trong `pending/` hoặc `done/` — KHÔNG tạo thư mục con
  trong `pending/`/`done/`. Tên file tự chứa đủ 3 phần.
- Slug 1 phần giữ tương thích cũ: `<slug>-plan.md`.
- Plan cũ đang mang tên legacy vẫn hoạt động; đổi tên dần khi chạm tới.

## Vòng đời

- `pending/` — plan markdown chuẩn của agent, chờ duyệt / đang thực hiện.
  Plan mode tự sync qua hook `.agents/hooks/pre/plans-sync.ts`: plan ghi vào
  `local://<đường-dẫn>-plan.md` (ví dụ `local://feat/ui-ux/gameplay-plan.md`)
  được mirror thành `.agents/plans/pending/feat.ui-ux.gameplay.md`.
- `done/` — plan đã hoàn tất. Khi xong, chạy `/plan-done <tên-file-hoặc-slug>`;
  hook dời file sang `done/`. Không di chuyển tay trừ khi hook lỗi.

## Nguồn sự thật

- Markdown trong `pending/`/`done/` là **nguồn duy nhất**; hook chỉ mirror file,
  không render HTML và không có thư mục `custom/` hay trang index.
