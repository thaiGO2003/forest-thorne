---
description: Merge request policy — lint-first fast path + dev/main merge review gate
---

# Merge request workflow

Mục tiêu: giữ vòng lặp làm việc nhanh cho draft/pre-push, nhưng **không** thay thế
merge gate khi đưa vào `dev`/`main`.

- **Part A — Fast path** chỉ áp dụng cho draft, pre-push, `pnpm mr` và CI lint.
- **Part B — Merge gate** áp dụng khi PR ready và merge vào `dev`, hoặc release `dev` → `main`.
- Fast path **không** cấp approval, không thay targeted tests/build/evidence/dossier.

## Part A — Fast path (lint-first, draft/pre-push)

### Nguyên tắc

1. **Fast path chỉ lint.** Mọi MR chỉ chạy lint: ESLint nếu repo có cấu hình ESLint
   (`eslint.config.*` / `.eslintrc*`), ngược lại dùng `tsc --noEmit` (`pnpm typecheck`).
   Hiện repo chưa có ESLint nên mặc định là typecheck.
2. **Không chạy test tích hợp trong fast path.** `vitest`/QA scripts không nằm trong hook
   hay CI lint. Chạy tay khi cần: `pnpm test` hoặc `pnpm test:changed`.
3. **Build chỉ khi đã xong.** Build (`tsc --noEmit && vite build`) chạy bằng
   `pnpm mr --full`, hoặc trên CI khi PR đã ra khỏi draft (ready for review).
4. **MR phải có evidence.** `pnpm mr` tự bật dev server, chụp ảnh desktop + mobile bằng
   Chromium headless; ảnh được upload lên **branch evidence riêng** (`MR_EVIDENCE_BRANCH`,
   mặc định `mr-evidence`) qua GitHub contents API và nhúng raw URL vào description của MR.
   Gist không nhận binary nên không dùng gist cho evidence.
5. **Không commit ảnh evidence vào repo.** Ảnh local nằm ở `artifacts/mr/<timestamp>/`
   (đã gitignore); ảnh upload nằm trên branch evidence, không nằm trong diff MR.
6. **Fast path không phải merge approval.** Pre-push/draft CI pass chỉ cho phép push/PR draft;
   merge vào `dev` vẫn phải qua Part B.

### Lệnh

```bash
pnpm hooks:install     # cài .git/hooks/pre-push (lint gate)
pnpm mr --dry-run      # lint + chụp evidence + in body, không push/không tạo PR
pnpm mr --draft        # tạo PR draft
pnpm mr                # lint + evidence + push + tạo/cập nhật PR
pnpm mr --full         # như trên, kèm build (dùng khi đã xong)
pnpm mr --lint-only    # chỉ lint (hook pre-push gọi lệnh này)
```

Hook `pre-push` chỉ chạy lint và chặn push nếu lint lỗi; không chạy test tích hợp,
không build. `pnpm hooks:install` resolves the real hook path (`git rev-parse --git-path hooks`,
including linked worktrees and `core.hooksPath`), chains an existing pre-push as
`pre-push.forest-thorne-existing`, and fails closed when node/`scripts/mr.mjs` is missing.

### CI (`pr-checks.yml`) — chưa triển khai trong repo hiện tại

- Hiện repo chỉ có `.github/workflows/agents-migration-guard.yml` và
  `.github/workflows/close-verified-pr-issues.yml`; chưa có `pr-checks.yml`.
- Khi workflow này được bổ sung, policy dự kiến: job `lint` luôn chạy khi PR mở/cập nhật;
  job `build` chỉ chạy khi `draft == false` (đã xong), phụ thuộc job lint; không có job test
  tích hợp — giữ CI nhanh, test chạy theo yêu cầu.
- Không claim CI lint/build hiện tại đang chạy khi workflow chưa tồn tại.

### Ranh giới draft → ready

- **Draft/pre-push:** lint + evidence `pnpm mr` (branch evidence `mr-evidence`), chưa cần targeted test/build
  merge gate.
- **Ready/merge:** phải chạy Part B; `pnpm mr --full` build chỉ là một phần, không thay
  targeted tests, head-pinned evidence, dossier APPROVED.

## Part B — Merge gate cho `dev`/`main`

Quy trình này áp dụng cho **mọi** agent/developer trong repo Forest Throne, đặc biệt là OMP
chạy trên homeserver. Không có ngoại lệ cho "merge nhanh", "chỉ docs", "chỉ rename" hay
"đã test rồi".

### Nhánh và vai trò

- `main` — production, chỉ nhận từ `dev` qua release PR.
- `dev` — nhánh tích hợp, nhận feature branch qua PR/merge đã review.
- `feat/*`, `fix/*`, `chore/*` — nhánh công việc, tách từ `dev`.

### Cấm tuyệt đối

- Merge khi chưa có merge review `APPROVED` hợp lệ (người duyệt, hoặc agent được chủ repo
  uỷ quyền rõ ràng theo mục 4/4b).
- `git merge -s ours`, `git merge -X ours/theirs` để "nuốt" thay đổi của nhánh kia.
- Force push (`--force`, `--force-with-lease`) lên `dev`/`main`.
- Push trực tiếp vào `dev`/`main` từ máy agent.
- `--no-verify`, bỏ qua hook/test.
- Merge PR khi GitHub báo `CONFLICTING`/`DIRTY`, hoặc khi head của PR khác mô tả.
- Squash/merge làm mất commit gốc nếu chưa được người duyệt đồng ý.

### Quy trình 6 bước

#### 1. Chuẩn bị

```bash
git fetch origin --prune
git status --short          # phải sạch; không merge khi có thay đổi dở dang
git log --oneline --decorate -5
```

Xác định rõ: nhánh nguồn, nhánh đích (`dev`), và phạm vi thay đổi.

#### 2. Đồng bộ ngược (BẮT BUỘC trước khi merge)

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

#### 3. Kiểm chứng

Chạy tối thiểu, ghi lại lệnh + kết quả:

```bash
pnpm typecheck
pnpm exec vitest --run <các file test liên quan>
pnpm build
git diff --check
```

- Test-guard chặn full suite; chỉ chạy full khi đổi hạ tầng và có `ALLOW_FULL_TESTS=1`.
- Với thay đổi UI/audio/runtime: chạy thêm smoke phù hợp và ghi bằng chứng.
- `pnpm mr --full`/CI build không thay thế targeted test và evidence head-pinned.

#### 4. Merge review (bắt buộc)

Tạo file `.agents/merge-review/<branch-slug>.md` (dấu `/` trong tên nhánh đổi thành dấu `.`),
theo mẫu `.agents/merge-review/TEMPLATE.md`, gồm:

- Phạm vi và mục tiêu (1–3 câu), nhánh nguồn → đích.
- `git diff --stat origin/dev...HEAD` và danh sách file bị xoá/đổi tên/binary.
- Conflict đã gặp và cách giải (không được bỏ qua file ngoài phạm vi).
- Bằng chứng kiểm chứng (lệnh + kết quả).
- Rủi ro, ảnh hưởng save/schema/API, cách rollback.
- `Head:` là SHA **đầy đủ** của nhánh tại thời điểm review; thêm commit mới thì approval
  hết hiệu lực.
- `Status: APPROVED` + `Reviewer:` + `Reviewed-at:`.
- Mặc định `Reviewer` là người. Agent chỉ được tự review/duyệt khi chủ repo uỷ quyền rõ ràng
  (tin nhắn, issue hoặc PR comment), và phải ghi ngay dưới `Reviewer: agent:<tên>` dòng
  `Authorized-by: <owner> — <ngày> — "<trích nguyên văn>"`. Không có uỷ quyền thì không được
  tự duyệt.
- Agent tự review vẫn phải làm đủ bước 1–3 và checklist; nếu bất kỳ check nào fail hoặc còn
  review comment chưa xử lý thì không được merge.

Reviewer phải kiểm tra tối thiểu: tiêu đề/PR khớp phạm vi, không xoá file ngoài phạm vi,
không có secret, không có asset/binary phình bất thường, test evidence tái lập được.

#### 4b. Pull Verifier — owner standing authorization (no human loop)

Owner đã uỷ quyền thường trực cho **Pull Verifier** được tự duyệt và merge các PR thường khi
mọi gate pass, không cần human approval từng PR. Dossier phải ghi đúng:

```text
Reviewer: agent:pull-verifier
Authorized-by: thaiGO2003 — 2026-11-07 — "tui ko muon human in the loop dau"
```

- Nếu PR **không đạt**, Pull Verifier phải báo Leader: file:line, command/evidence, điều kiện
  fail, hướng sửa tối thiểu, và vì sao chưa APPROVED. Không chỉ trả REQUEST_CHANGES rồi đứng.
- Leader giao remediation; Pull Verifier re-review sau khi fix; không đẩy owner vào routine
  approval.
- Owner chỉ xử lý policy/owner-taste conflict hoặc thay đổi luật; không phải gate merge thường.
- Vẫn không `--admin`, không bỏ qua evidence/test/hook, không merge khi head/body/target lệch.
- §4b là nguồn chuẩn cho approval/merge PR thường. Quote uỷ quyền issue-specific cũ
  (ví dụ 2026-11-05) không thay thế cặp `Reviewer`/`Authorized-by` này cho routine merge;
  issue-delivery workflow khi merge phải dùng cùng cặp này.

#### 5. Merge vào `dev`

Chỉ sau khi bước 4 có `APPROVED` đúng `Head` và `Target: dev`:

```bash
git switch dev
git pull --ff-only
git merge --no-ff <nhánh-đã-review>
```

Sau merge, chạy lại `pnpm typecheck` + test targeted trên `dev`. Nếu fail, revert merge ngay;
không sửa lén trên `dev`.

Muốn push `dev` lên remote: cập nhật approval cho **chính HEAD mới của `dev`**
(`Target: dev`, `Head: <sha sau merge>`, người review duyệt lại), rồi mới push. Hook chặn
force/`--delete`/`--all`/`--mirror` lên `dev`/`main` trong mọi trường hợp.

Với feature/fix branch, có thể merge qua GitHub PR thay cho local merge:

```bash
# đứng trên branch nguồn có tên trong worktree, HEAD trùng dossier
git branch --show-current
git rev-parse HEAD
gh pr merge <N> --merge
```

- Không `--admin`, không `--squash` (trừ khi owner đồng ý), không `--no-verify`.
- Hook `merge-guard` kiểm dossier của branch nguồn + `Target: dev`; chạy từ detached
  HEAD sẽ trượt approval.
- Sau merge: `git fetch origin --prune`, xác nhận `origin/dev` chứa merge, rồi chạy
  lại `pnpm typecheck` + test targeted trên `dev` sạch.

#### 6. Release `dev` → `main`

- Mở PR `dev` → `main`, chạy lại toàn bộ gate (typecheck, test, build, smoke acceptance).
- Áp dụng đúng bước 4; `main` không nhận push trực tiếp.

### Hook thực thi

`.agents/hooks/pre/merge-guard.ts` chặn ở runtime:

- `git merge <nhánh>` khi đang ở `dev`/`main` mà thiếu approval cho nhánh nguồn.
- `git push` có đích `dev`/`main` (kể cả `HEAD:dev`, `--all`, `--mirror`, `--delete`).
- `gh pr merge` khi thiếu approval; chặn `--admin`.
- Tự set `MERGE_REVIEW_APPROVED=1` ngay trong câu lệnh.

Nếu hook chặn, **không tìm cách lách**. Hoàn tất review hoặc báo người dùng.

### Checklist ngắn

- [ ] Working tree sạch, đã `git fetch`.
- [ ] Nhánh đã merge `origin/dev` và `origin/main` (nếu main ahead).
- [ ] Conflict giải trên nhánh nguồn, không dùng ours.
- [ ] `pnpm typecheck`, test targeted, `pnpm build` pass.
- [ ] `.agents/merge-review/<branch>.md` có `Status: APPROVED`, `Head` đúng, `Target` đúng,
  `Reviewer` hợp lệ (người, hoặc `agent:<tên>` kèm `Authorized-by`).
- [ ] `.agents/merge-review/<branch>/` có ảnh evidence khớp code (hoặc ghi `No visual surface`
  cho docs-only).
- [ ] Diff không xoá file ngoài phạm vi, không có secret/binary bất thường.
- [ ] Merge vào `dev` xong chạy lại verify.
