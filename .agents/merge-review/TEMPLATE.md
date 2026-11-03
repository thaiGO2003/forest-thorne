# Merge review: <branch>

- Status: PENDING
- Head: <sha đầy đủ của nhánh nguồn>
- Target: dev
- Reviewer:
- Reviewed-at:

## Phạm vi

<1–3 câu: mục tiêu, nhánh nguồn → đích>

## Diff

```text
<git diff --stat origin/dev...HEAD>
```

File bị xoá/đổi tên/binary:

- <...>

## Đồng bộ & conflict

- Đã merge `origin/dev`: <có/không, commit>
- Đã merge `origin/main`: <có/không, commit>
- Conflict: <file + cách giải; hoặc "không">

## Kiểm chứng

- `pnpm typecheck`: <pass/fail>
- `pnpm exec vitest --run <files>`: <số file/test>
- `pnpm build`: <pass/fail>
- Smoke/khác: <...>

## Rủi ro & rollback

- Ảnh hưởng save/schema/API: <...>
- Rollback: <revert merge commit / ...>

## Kết luận

- [ ] Tiêu đề/PR khớp phạm vi
- [ ] Không xoá file ngoài phạm vi
- [ ] Không có secret/binary phình bất thường
- [ ] Evidence tái lập được
