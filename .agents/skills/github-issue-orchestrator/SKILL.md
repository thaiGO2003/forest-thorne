---
name: github-issue-orchestrator
description: Orchestrate open GitHub issues through Developer implementation, Verifier-created PRs with mandatory image evidence, Pull Verifier preview/approval, and merge into dev. Use when the leader is asked to process open issues, assign implementation tasks, open PRs, collect evidence, close verified issues, or run the issue-to-dev pipeline.
---

# GitHub issue orchestrator (Leader)

Điều phối issue mở thành PR đã kiểm chứng và merge `dev`. Skill này là runbook cho
**Leader**; nguồn luật đầy đủ là `.agents/rules/issue-delivery-workflow.md`.

Đọc trước khi chạy:

- `.agents/rules/issue-delivery-workflow.md`
- `.agents/rules/merge-workflow.md`
- `.agents/rules/plans-workflow.md`, `commits.md`, `test-targeted.md`,
  `acceptance-batching.md`, `max-concurrent-subagents.md`

## Deployment status (2026-11-05)

`.github/workflows/close-verified-pr-issues.yml` chỉ có trên `origin/dev`, chưa có
trên `main`/default branch (404). Label-driven closure **chưa active** cho đến khi
release `dev` → `main`. Trong giai đoạn này, sau khi Pull Verifier duyệt, owner hoặc
Verifier đóng issue thủ công kèm audit comment; không claim automation đã chạy và
không duplicate workflow.

## Khi nào dùng

- "Xử lý open issues", "giao task issue", "issue → dev", "điều phối PR".
- Cần biến nhiều issue thành PR tuần tự/có batch, có evidence và merge gate.

Không dùng cho: sửa một bug đơn lẻ không qua issue, hoặc merge khẩn cấp bỏ qua
review. Các việc đó vẫn theo luật repo hiện có.

## Bất biến

1. **1 issue = 1 plan = 1 branch = 1 PR** vào `dev`.
2. Developer **không** tạo PR, không merge, không đóng issue.
3. Verifier tạo PR + ảnh evidence; **không** ghi `APPROVED`, không merge.
4. Pull Verifier duyệt/merge theo uỷ quyền owner:
   `Reviewer: agent:pull-verifier` + `Authorized-by: thaiGO2003 — 2026-11-07 — "tui ko muon human in the loop dau"`.
5. Mọi PR phải có **ít nhất một ảnh evidence** trong body hoặc comment, pin theo
   `Verified-Head`.
6. Head đổi → evidence/approval cũ vô hiệu.
7. Hook chặn → dừng, báo owner; không lách.

## State machine

| State | Owner | Artifact bắt buộc |
| --- | --- | --- |
| `triaged` | Leader | issue đủ điều kiện + plan + task |
| `visual-planning` | Leader → Visual Developer | visual plan + handoff + evidence visual |
| `implementing` | Developer | branch pushed + evidence dir + báo cáo |
| `verified` | Verifier | PR + header attestation + comment ảnh + `check ok` |
| `approved` | Pull Verifier | dossier `APPROVED` đúng Head/Target |
| `closed` | Verifier/owner | label `issue-verified-complete` + audit comment (PR còn mở) |
| `merged` | Pull Verifier | `origin/dev` chứa merge + verify lại pass |

Task board dùng đúng state: `pending` → `in_progress` → `completed`; task bị chặn
thêm `blocked_by` thay vì bắt agent ngồi chờ.

## Runbook

### 1. Preflight

```bash
git fetch origin --prune
gh auth status
gh label list --search issue-verified-complete
gh issue list --state open --limit 100 \
  --json number,title,labels,assignees,body,url
```

Kiểm tra với owner: auto-close issue khi merge phải **tắt**; workflow
`.github/workflows/close-verified-pr-issues.yml` phải có trên **default branch**
(`gh api repos/<owner>/<repo>/actions/workflows`). Nếu workflow chưa deploy, label
không tự đóng issue — owner đóng thủ công kèm audit comment.

Issue thiếu acceptance criteria/repro → comment hỏi + gắn `needs-info`, không tạo
branch.

### 2. Chọn batch

- Ưu tiên `bug` trước `enhancement`; issue nhỏ, độc lập trước.
- Tối đa **2 developer** đồng thời (`max-concurrent-subagents.md`).
- Issue chạm cùng file/runtime: xếp wave hoặc `blocked_by`.
- Mỗi issue tạo plan `pending/<type>.<area>.<slug>-issue<N>.md` và worktree riêng:

```bash
git worktree add ../forest-thorne-issue-<N> -b <branch> origin/dev
```

### 2b. Visual lane (unit visual/effect hoặc UI/UX)

Trigger: issue chạm rig/animation/skill VFX/hit-death/material, hoặc UI/UX/icon/
responsive. Leader **phải** lên visual plan trước khi Developer khóa code:

- Điền `references/visual-plan.md` (mục tiêu, reference, phạm vi, acceptance, evidence).
- Giao **Visual Developer** (lấy `slot_id` từ `team_members`) kèm worktree/branch,
  file ownership, reference và evidence cần chụp.
- Asset-first: CSS chỉ layout/toạ độ/responsive; chrome/texture/button dùng
  PNG/sprite/9-slice/Canvas, không vẽ bằng CSS.
- Visual nhỏ: làm cùng branch, trước hoặc song song, không sửa gameplay contract.
- Visual lớn/độc lập: tách branch `feat/visual/<slug>-issue<N>`, vẫn link issue gốc.
- Evidence `.agents/merge-review/<branch-slug>/visual/`: 390×844, 1280×720,
  idle/attack/hit/death hoặc hover/active/disabled, clip nếu motion, FPS/draw-call.
- Visual Developer không tạo PR/merge/approve; báo Leader khi xong.

### 3. Giao Developer

Dùng `team_members` để lấy `slot_id` hiện tại, rồi tạo task + gửi brief. Brief mẫu:

```text
Issue #<N>: <title>
Plan: .agents/plans/pending/<plan>.md
Visual plan: .agents/skills/github-issue-orchestrator/references/visual-plan.md (nếu issue có visual/UI/UX)
Worktree: ../forest-thorne-issue-<N> — branch <branch> (từ origin/dev)
Acceptance: <copy checklist>
Verify: pnpm typecheck; pnpm exec vitest --run <files>; pnpm build (nếu chạm shared/UI)
Evidence: .agents/merge-review/<branch-slug>/ — tối thiểu 1 ảnh; UI cần before/after 390x844 + 1280x720
Commit: theo .agents/rules/commits.md; push branch
Báo lại: branch, HEAD SHA, commit list, lệnh + kết quả, evidence path, blocker
Không tạo PR, không merge, không đóng issue.
```

### 4. Kiểm handoff Developer

```bash
git ls-remote origin <branch>
git -C ../forest-thorne-issue-<N> status --short
find .agents/merge-review/<branch-slug> -maxdepth 1 -type f
```

Đủ head/evidence/verify sạch → giao Verifier. Thiếu → trả Developer kèm lỗi cụ thể.

### 5. Giao Verifier

```text
Issue #<N> — branch <branch> — HEAD <sha>
Chưa có PR. Verify độc lập, sync origin/dev (và origin/main nếu ahead), chạy lại targeted checks.
Tạo PR target dev với attestation header bằng:
  node .agents/skills/github-issue-orchestrator/scripts/pr-attestation.mjs header --issue <N> --head "$(git rev-parse HEAD)" --verification "..."
Post comment evidence ảnh:
  node .agents/skills/github-issue-orchestrator/scripts/pr-attestation.mjs evidence --dir .agents/merge-review/<branch-slug> --head "$(git rev-parse HEAD)" > /tmp/evidence-<N>.md
  gh pr comment <PR> --body-file /tmp/evidence-<N>.md
Validate: node .../pr-attestation.mjs check --pr <PR> --head "$(git rev-parse HEAD)"
Handoff Pull Verifier kèm PR URL, head, issue, evidence dir.
Không merge, không ghi APPROVED. Chờ Pull Verifier duyệt xong rồi mới đóng issue
khi PR còn mở (xem bước 7), sau đó Pull Verifier merge.
```

### 6. Giao Pull Verifier

```text
PR #<PR> — branch <branch> — HEAD <sha> — issue #<N>
Dossier: .agents/merge-review/<branch-slug>.md (tạo từ TEMPLATE, bắt đầu PENDING)
Uỷ quyền: Reviewer agent:pull-verifier + Authorized-by đúng workflow mục 1.
Sync origin/dev/main; nếu head đổi thì handoff Verifier cập nhật Verified-Head + evidence comment + check lại,
rồi duyệt lại từ đầu (Pull Verifier không tự viết attestation).
Re-run typecheck, targeted tests, build; preview 390x844 và 1280x720.
Điền dossier APPROVED đúng Head/Target=dev rồi handoff lại Verifier để đóng issue.
Chỉ merge sau khi closure xong, head không đổi:
  gh pr merge <PR> --merge   (đứng trên branch nguồn có tên trong worktree, không detached HEAD;
                              không --admin/--squash/--no-verify)
Sau merge: fetch, verify origin/dev, chạy lại typecheck + targeted.
```

### 7. Đóng issue (trước merge, PR còn mở)

Thứ tự bắt buộc: Pull Verifier duyệt xong → Verifier đóng issue → Pull Verifier merge
ngay. Workflow closure yêu cầu PR đang mở; merge trước sẽ làm PR `closed` và closure
bị bỏ qua.

```bash
node .agents/skills/github-issue-orchestrator/scripts/pr-attestation.mjs check \
  --pr <PR> --head "$(git rev-parse HEAD)"
gh pr view <PR> --json state,isDraft,baseRefName,mergeable,mergeStateStatus,statusCheckRollup
gh pr edit <PR> --add-label issue-verified-complete
gh issue view <N> --json state,comments   # chờ state=CLOSED + audit comment
```

Chỉ label khi `mergeable=MERGEABLE` (không `CONFLICTING`/`UNKNOWN`), PR không draft,
target `dev`, check bắt buộc xanh. Nếu `UNKNOWN`, chờ GitHub tính lại.

Label cần tài khoản admin/maintain; nếu Verifier không có quyền, báo owner. Không
remove/re-apply label. Nếu issue title/body đổi sau snapshot, closure skip, hoặc
workflow chưa deploy: dừng, báo owner, không merge; fallback owner đóng thủ công
`gh issue close <N> --reason completed` + audit comment. Nếu closure xong: báo Pull
Verifier merge ngay, không thêm commit.

### 8. Báo cáo owner

```text
| Issue | State | PR | Head | Evidence | Next |
| #126 | merged | #130 | abc1234 | 4 ảnh + gate JSON | wrap-up |
```

Kèm bất thường: test fail có sẵn, conflict, hook block, quyền label.

## Helper

`scripts/pr-attestation.mjs` — deterministic, không ghi git state:

```bash
node .../pr-attestation.mjs header   --issue <N> --head <sha> --verification "<text>"
node .../pr-attestation.mjs evidence --dir <evidence-dir> --head <sha>
node .../pr-attestation.mjs check    --pr <PR> --head <sha>
```

- `header`: in header attestation với snapshot SHA-256 lấy trực tiếp từ GitHub.
- `evidence`: in bảng Markdown + raw URL pin theo head cho ảnh trong evidence dir.
- `check`: kiểm PR target `dev`, không draft, `Verified-Head` khớp head, snapshot
  issue còn đúng. Exit code 1 nếu fail.

Chi tiết header/evidence/closure: `references/pr-evidence.md`.

## Stop conditions

Dừng và báo owner khi:

- Issue không đủ acceptance/repro hoặc đang bị block.
- Developer không cung cấp được ảnh evidence/verify thật.
- Verifier không tạo được `check ok` hoặc test fail.
- Pull Verifier không sync được `origin/dev`/`origin/main`.
- Hook merge-guard chặn, approval lệch Head, hoặc label closure không hợp lệ.
- Bất kỳ bước nào phải dùng `--force`, `--no-verify`, `-s ours`, hoặc `--admin`.
