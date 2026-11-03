---
description: Merge review gate — sync dev/main, verify, review, then merge into dev
---

# Merge workflow — bắt buộc review trước khi merge

Quy trình này áp dụng cho **mọi** agent/developer trong repo Forest Throne, đặc biệt là OMP chạy trên homeserver. Không có ngoại lệ cho "merge nhanh", "chỉ docs", "chỉ rename" hay "đã test rồi".

## Nhánh và vai trò

- `main` — production, chỉ nhận từ `dev` qua release PR.
- `dev` — nhánh tích hợp, nhận feature branch qua PR/merge đã review.
- `feat/*`, `fix/*`, `chore/*` — nhánh công việc, tách từ `dev`.

## Cấm tuyệt đối

- Merge khi chưa có merge review `APPROVED` hợp lệ (người duyệt, hoặc agent được chủ repo uỷ quyền rõ ràng theo mục 4).
- `git merge -s ours`, `git merge -X ours/theirs` để "nuốt" thay đổi của nhánh kia.
- Force push (`--force`, `--force-with-lease`) lên `dev`/`main`.
- Push trực tiếp vào `dev`/`main` từ máy agent.
- `--no-verify`, bỏ qua hook/test.
- Merge PR khi GitHub báo `CONFLICTING`/`DIRTY`, hoặc khi head của PR khác mô tả.
- Squash/merge làm mất commit gốc nếu chưa được người duyệt đồng ý.

## Quy trình 6 bước

### 1. Chuẩn bị

```bash
git fetch origin --prune
git status --short          # phải sạch; không merge khi có thay đổi dở dang
git log --oneline --decorate -5
```

Xác định rõ: nhánh nguồn, nhánh đích (`dev`), và phạm vi thay đổi.

### 2. Đồng bộ ngược (BẮT BUỘC trước khi merge)

Trên **nhánh công việc** (không phải trên `dev`/`main`):

```bash
git merge origin/dev
# nếu main có commit chưa nằm trong dev:
git merge origin/main
```

- Giải quyết conflict ngay trên nhánh công việc; không đẩy conflict sang `dev`.
- Không dùng `-s ours`/`-X ours`.
- Nếu nhánh đã push, không rebase lịch sử trừ khi người dùng cho phép rõ ràng.
- Sau khi đồng bộ, nhánh phải chứa **toàn bộ** `origin/dev` và `origin/main` hiện tại.

### 3. Kiểm chứng

Chạy tối thiểu, ghi lại lệnh + kết quả:

```bash
pnpm typecheck
pnpm exec vitest --run <các file test liên quan>
pnpm build
git diff --check
```

- Test-guard chặn full suite; chỉ chạy full khi đổi hạ tầng và có `ALLOW_FULL_TESTS=1`.
- Với thay đổi UI/audio/runtime: chạy thêm smoke phù hợp và ghi bằng chứng.

### 4. Merge review (bắt buộc)

Tạo file `.agents/merge-review/<branch-slug>.md` (dấu `/` trong tên nhánh đổi thành dấu `.`), theo mẫu `.agents/merge-review/TEMPLATE.md`, gồm:

- Phạm vi và mục tiêu (1–3 câu), nhánh nguồn → đích.
- `git diff --stat origin/dev...HEAD` và danh sách file bị xoá/đổi tên/binary.
- Conflict đã gặp và cách giải (không được bỏ qua file ngoài phạm vi).
- Bằng chứng kiểm chứng (lệnh + kết quả).
- Rủi ro, ảnh hưởng save/schema/API, cách rollback.
- `Head:` là SHA **đầy đủ** của nhánh tại thời điểm review; thêm commit mới thì approval hết hiệu lực.
- `Status: APPROVED` + `Reviewer:` + `Reviewed-at:`.
- Mặc định `Reviewer` là người. Agent chỉ được tự review/duyệt khi chủ repo uỷ quyền rõ ràng (tin nhắn, issue hoặc PR comment), và phải ghi ngay dưới `Reviewer: agent:<tên>` dòng `Authorized-by: <owner> — <ngày> — "<trích nguyên văn>"`. Không có uỷ quyền thì không được tự duyệt.
- Agent tự review vẫn phải làm đủ bước 1–3 và checklist; nếu bất kỳ check nào fail hoặc còn review comment chưa xử lý thì không được merge.

Reviewer phải kiểm tra tối thiểu: tiêu đề/PR khớp phạm vi, không xoá file ngoài phạm vi, không có secret, không có asset/binary phình bất thường, test evidence tái lập được.

### 5. Merge vào `dev`

Chỉ sau khi bước 4 có `APPROVED` đúng `Head` và `Target: dev`:

```bash
git switch dev
git pull --ff-only
git merge --no-ff <nhánh-đã-review>
```

Sau merge, chạy lại `pnpm typecheck` + test targeted trên `dev`. Nếu fail, revert merge ngay; không sửa lén trên `dev`.

Muốn push `dev` lên remote: cập nhật approval cho **chính HEAD mới của `dev`** (`Target: dev`, `Head: <sha sau merge>`, người review duyệt lại), rồi mới push. Hook chặn force/`--delete`/`--all`/`--mirror` lên `dev`/`main` trong mọi trường hợp.

### 6. Release `dev` → `main`

- Mở PR `dev` → `main`, chạy lại toàn bộ gate (typecheck, test, build, smoke acceptance).
- Áp dụng đúng bước 4; `main` không nhận push trực tiếp.

## Hook thực thi

`.agents/hooks/pre/merge-guard.ts` chặn ở runtime:

- `git merge <nhánh>` khi đang ở `dev`/`main` mà thiếu approval cho nhánh nguồn.
- `git push` có đích `dev`/`main` (kể cả `HEAD:dev`, `--all`, `--mirror`, `--delete`).
- `gh pr merge` khi thiếu approval; chặn `--admin`.
- Tự set `MERGE_REVIEW_APPROVED=1` ngay trong câu lệnh.

Nếu hook chặn, **không tìm cách lách**. Hoàn tất review hoặc báo người dùng.

## Checklist ngắn

- [ ] Working tree sạch, đã `git fetch`.
- [ ] Nhánh đã merge `origin/dev` và `origin/main` (nếu main ahead).
- [ ] Conflict giải trên nhánh nguồn, không dùng ours.
- [ ] `pnpm typecheck`, test targeted, `pnpm build` pass.
- [ ] `.agents/merge-review/<branch>.md` có `Status: APPROVED`, `Head` đúng, `Target` đúng, `Reviewer` hợp lệ (người, hoặc `agent:<tên>` kèm `Authorized-by`).
- [ ] Diff không xoá file ngoài phạm vi, không có secret/binary bất thường.
- [ ] Merge vào `dev` xong chạy lại verify.
