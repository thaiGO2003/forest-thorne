# Merge review — hướng dẫn

Thư mục này là bằng chứng review merge. Quy trình đầy đủ: `.agents/rules/merge-workflow.md`.

## Quy tắc

- Mỗi nhánh cần merge có một file `<branch-slug>.md`, tên nhánh đổi `/` thành `.` (ví dụ `feat/ui-ux/gameplay` → `feat.ui-ux.gameplay.md`).
- Chỉ **người review** được điền `Status: APPROVED`, `Reviewer:`, `Reviewed-at:`.
- `Head:` phải là SHA đầy đủ của nhánh tại thời điểm review. Có commit mới → approval hết hiệu lực, phải review lại.
- `Target:` là nhánh đích (`dev`, hoặc `main` khi release).
- Khi push `dev`/`main`, approval phải khớp HEAD hiện tại của nhánh đích.
- Không commit approval giả, không sửa `Head` cho khớp sau khi đã thêm commit.

## Mẫu

Sao chép `TEMPLATE.md`, đổi tên theo nhánh, điền đầy đủ. Hook `.agents/hooks/pre/merge-guard.ts` sẽ chặn `git merge`, `git push` vào `dev`/`main` và `gh pr merge` nếu thiếu approval hợp lệ.

## Kiểm tra nhanh

```bash
git rev-parse HEAD
git diff --stat origin/dev...HEAD
git diff --name-status origin/dev...HEAD | grep -E '^(D|R)' || true
pnpm typecheck && pnpm build
```
