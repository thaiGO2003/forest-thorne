---
description: Open GitHub issue -> Developer -> Verifier PR + evidence -> Pull Verifier merge -> dev
---

# Issue delivery workflow — open issue → dev

Quy trình chuẩn để Leader biến issue GitHub đang mở thành PR có bằng chứng và merge
vào `dev`. Áp dụng cùng:

- `.agents/rules/merge-workflow.md` — cổng review/merge bắt buộc.
- `.agents/rules/plans-workflow.md` — tên plan và vòng đời `pending/` → `done/`.
- `.agents/rules/commits.md` — commit message và body.
- `.agents/rules/test-targeted.md` — chỉ chạy test đúng vùng.
- `.agents/rules/acceptance-batching.md` — một gate, một script, một lần chạy.
- `.agents/rules/max-concurrent-subagents.md` — tối đa 2 developer song song.

## 0. Deployment status (2026-11-05)

Closure automation `.github/workflows/close-verified-pr-issues.yml` hiện chỉ có trên
`origin/dev`, **chưa có trên `main`/default branch** (404). Vì vậy:

- Label-driven closure **CHƯA active** cho đến khi release `dev` → `main`.
- Không claim workflow tự đóng issue trong giai đoạn này.
- Sau khi Pull Verifier duyệt, owner/Verifier đóng issue thủ công kèm audit comment
  (fallback ở Stage 6).
- Không duplicate workflow; việc deploy thuộc release gate `dev` → `main`.

## 1. Vai trò và quyền

| Vai trò | Được làm | Không được làm |
| --- | --- | --- |
| **Leader** | Triage issue, tạo plan/task, giao việc, kiểm handoff, báo owner | Tự code, tự tạo PR thay Developer, tự merge |
| **Developer** | Code trong worktree, test, chụp evidence, commit, push nhánh, báo Leader | Tạo PR, merge, đóng issue, sửa file ngoài phạm vi |
| **Visual Developer** | Lên/hoàn thiện visual, rig/animation, VFX, UI/UX theo visual plan; chụp evidence visual + performance | Đổi gameplay balance/contract, merge, tự duyệt, dùng CSS để vẽ chrome/texture |
| **Verifier** | Verify độc lập, tạo PR, gắn attestation header, post evidence ảnh, đóng issue khi PR còn mở sau khi Pull Verifier duyệt (nếu có quyền) | Merge, tự ghi `APPROVED`, che giấu test fail |
| **Pull Verifier** | Preview, sync, điền dossier, `APPROVED` theo uỷ quyền owner, merge PR vào `dev`, verify sau merge | Tự sửa code, tự nới luật, merge khi thiếu evidence |
| **Human owner** | Uỷ quyền Pull Verifier, gắn label đóng issue khi cần, xử lý escalation | Bỏ qua evidence hoặc hook |

### Uỷ quyền Pull Verifier

Owner đã uỷ quyền thường trực cho agent **Pull Verifier** ngày **2026-11-07**. Mỗi
dossier do Pull Verifier duyệt phải ghi đúng:

```text
Reviewer: agent:pull-verifier
Authorized-by: thaiGO2003 — 2026-11-07 — "tui ko muon human in the loop dau"
```

Nếu owner thu hồi uỷ quyền bằng văn bản, dừng quy trình và quay lại luật người duyệt
mặc định của `.agents/rules/merge-workflow.md`.

## 2. Bất biến (không có ngoại lệ)

- **1 issue = 1 plan = 1 branch = 1 PR** vào `dev`.
- Branch tách từ `origin/dev`; không commit trực tiếp lên `dev`/`main`.
- Không force push, không `--no-verify`, không `-s ours`/`-X ours`.
- **Mọi PR phải có ít nhất một ảnh evidence** trong PR body hoặc comment. Không có
  ảnh = chưa đủ điều kiện review.
- Ảnh evidence phải pin đúng `Verified-Head` (SHA 40 ký tự). Head đổi thì evidence
  và approval cũ hết hiệu lực.
- Verifier không bao giờ ghi `Status: APPROVED`; chỉ Pull Verifier được duyệt theo
  uỷ quyền ở mục 1.
- Hook chặn thì dừng và báo owner; không tìm cách lách.

## 3. Stage 0 — Preflight và triage (Leader)

```bash
git fetch origin --prune
gh auth status
gh label list --search issue-verified-complete
gh issue list --state open --limit 100 \
  --json number,title,labels,assignees,body,url
```

Kiểm tra một lần với owner:

- **Settings → General → Issues → Auto-close issues with merged linked pull requests
  phải đang tắt**. Nếu bật, GitHub có thể đóng issue khi merge trước khi label
  `issue-verified-complete` được duyệt.
- Workflow `.github/workflows/close-verified-pr-issues.yml` phải có trên **default
  branch** (`gh api repos/<owner>/<repo>/actions/workflows`). Nếu chưa deploy, label
  không tự đóng issue; owner đóng thủ công và ghi audit comment.

Issue đủ điều kiện khi:

- Đang mở, chưa có assignee, không mang `blocked` / `needs-info`.
- Có acceptance criteria hoặc repro rõ ràng; phạm vi đủ nhỏ để một PR xử lý.
- Không trùng issue/branch/PR đang mở.

Issue thiếu thông tin: comment câu hỏi cụ thể + gắn `needs-info`, không tạo branch.
Ưu tiên `bug` trước `enhancement`; tối đa **2 developer** chạy song song. Issue dùng
chung file/runtime phải xếp wave hoặc thêm `blocked_by`.

## 4. Stage 1 — Plan, branch, task (Leader)

Tên plan theo `.agents/rules/plans-workflow.md`:

```text
.agents/plans/pending/<type>.<area>.<slug>-issue<N>.md
```

Ví dụ: `fix.ui.tooltip-3-star-issue126.md` → branch `fix/ui/tooltip-3-star-issue126`.

Plan tối thiểu gồm:

- Bối cảnh + acceptance criteria copy nguyên văn từ issue.
- Phạm vi / non-goals / file dự kiến chạm.
- Lệnh verify targeted + evidence cần chụp.
- Rủi ro save/schema/API và cách rollback.

Tạo worktree riêng để không đụng cây làm việc hiện tại:

```bash
git worktree add ../forest-thorne-issue-<N> -b <branch> origin/dev
```

Tạo task board cho Developer, ghi rõ owner slot, plan, branch, acceptance và mẫu báo
cáo. Task phụ thuộc dùng `blocked_by`.

### Visual lane — bắt buộc khi có visual/effect

Nếu issue chạm **visual/effect cho thú** (rig, animation, skill VFX, hit/death,
material) hoặc **UI/UX** (layout, chrome, modal, tooltip, icon, responsive), Leader
phải lên **visual plan** trước khi giao code và gửi cho **Visual Developer**:

- Điền mẫu `.agents/skills/github-issue-orchestrator/references/visual-plan.md`.
- Ghi rõ tham chiếu (concept sheet, `old_src`, screenshot), bề mặt thay đổi, asset
  nguồn, file dự kiến, acceptance visual, performance budget và evidence.
- Tuân thủ UI Asset-First: CSS chỉ layout/toạ độ/responsive; chrome/texture/button
  dùng PNG/sprite/9-slice/Canvas, không vẽ bằng CSS.
- Nếu visual và code cùng nhánh: Visual Developer làm trước hoặc song song nhưng
  không sửa gameplay contract; Developer/Verifier verify integration sau.
- Nếu visual là deliverable lớn hoặc độc lập: tách issue/plan/branch visual riêng
  (`feat/visual/<slug>-issue<N>`), vẫn nối về issue gốc.
- Evidence visual lưu tại `.agents/merge-review/<branch-slug>/visual/` và phải có
  trong PR body/comment: 390×844, 1280×720, trạng thái idle/attack/hit/death hoặc
  hover/active/disabled; clip/GIF nếu là motion; FPS/draw-call nếu có budget.
- Visual Developer báo Leader: file đã sửa, asset nguồn/license, ảnh trước/sau,
  performance, phần còn thiếu. Không tự merge/approve.

## 5. Stage 2 — Developer thực thi

1. Đọc issue + plan; tái hiện bug hoặc baseline test trên `origin/dev` trước khi sửa.
2. Sửa tối thiểu, đúng phạm vi; không dọn code ngoài issue. Nếu có visual plan,
   phối hợp với Visual Developer và không sửa visual ngoài plan.
3. Chạy tối thiểu:

```bash
pnpm typecheck
pnpm exec vitest --run <các file test liên quan>
pnpm build                     # bắt buộc khi chạm shared runtime/UI/hạ tầng
```

4. Ghi evidence vào `.agents/merge-review/<branch-slug>/`:

```text
evidence.md                    # bảng: tiêu chí | lệnh | kết quả | artifact
before-390x844.png
after-390x844.png
after-1280x720.png
gate-<name>.json               # nếu có acceptance gate
```

Quy tắc ảnh:

- UI/visual: bắt buộc before/after ở **390×844** và **1280×720**.
- Không có UI: ảnh terminal/test summary hoặc browser console; vẫn phải có ít nhất
  một ảnh.
- Ảnh phải đọc được, không chứa secret/token; nén nếu > 500 KB.

5. Commit theo `.agents/rules/commits.md`, push branch:

```bash
git push -u origin <branch>
```

6. Báo Leader: branch, head SHA, commit list, lệnh + kết quả, đường dẫn evidence,
   rủi ro/blocker. **Không tạo PR, không merge, không đóng issue.**

## 6. Stage 3 — Leader kiểm handoff

Trước khi giao Verifier, Leader xác nhận:

- `git ls-remote origin <branch>` trả đúng head Developer báo.
- Working tree sạch; không có file ngoài phạm vi; không có secret.
- Evidence ảnh tồn tại và đọc được; test/typecheck/build có kết quả thật.
- Plan + task đang `in_progress`.

Thiếu bất kỳ mục nào: trả lại Developer kèm lỗi cụ thể. Đủ: giao Verifier qua task +
message, kèm PR **chưa** tạo.

## 7. Stage 4 — Verifier tạo PR + evidence ảnh

Verifier làm việc trên worktree/branch của issue, checkout đúng head và verify độc
lập trước khi mở PR:

```bash
git fetch origin --prune
git rev-parse HEAD
git diff --stat origin/dev...HEAD
git diff --name-status origin/dev...HEAD
```

Chạy lại targeted checks; kiểm tra diff không xoá file ngoài phạm vi, không secret,
không binary phình. Nếu fail: báo Leader/Developer kèm lệnh + output, **không tạo PR**.

### 7.1 Đồng bộ trước khi tạo PR

Trên nhánh nguồn, merge `origin/dev` (và `origin/main` nếu main ahead), giải conflict
tại đây, chạy lại verify rồi mới push. Không dùng `-s ours`/`-X ours`.

### 7.2 Tạo attestation header

Dùng helper để tránh sai hash/SHA:

```bash
HEAD_SHA="$(git rev-parse HEAD)"
node .agents/skills/github-issue-orchestrator/scripts/pr-attestation.mjs header \
  --issue <N> --head "$HEAD_SHA" \
  --verification "targeted vitest <files> PASS; pnpm typecheck PASS; pnpm build PASS; browser evidence 390x844/1280x720"
```

Header phải bắt đầu ở **dòng đầu tiên** của PR body, đúng dạng:

```text
Closes #126
Issue-Snapshot: #126 sha256:<64 hex>
Verification: <một dòng, tối đa 1500 ký tự>
Verified-Head: <40 hex>
---
```

Thứ tự bắt buộc: `Closes`/`Fixes`/`Resolves` → `Issue-Snapshot` tương ứng →
`Verification` → `Verified-Head` → đúng dòng `---`. Không được có dòng trống hoặc
whitespace-only trong header; delimiter `----`/`--- ` hoặc thiếu `---` đều invalid.
Sau `---` mới được viết Markdown tự do. Helper và closure consumer dùng chung
`scripts/github/attestation-contract.cjs`. Sai thứ tự, thêm list/quote/code fence
trước `---`, hoặc sai snapshot sẽ làm workflow đóng issue bỏ qua toàn bộ PR.

### 7.3 Tạo PR và comment evidence

```bash
gh pr create --base dev --head <branch> \
  --title "<type>(<scope>): <mô tả> (#<N>)" \
  --body-file /tmp/pr-<N>.md

node .agents/skills/github-issue-orchestrator/scripts/pr-attestation.mjs evidence \
  --dir ".agents/merge-review/<branch-slug>" --head "$HEAD_SHA" \
  > /tmp/evidence-<N>.md
gh pr comment <PR> --body-file /tmp/evidence-<N>.md
```

Ảnh trong PR dùng raw URL pin theo `HEAD_SHA`, ví dụ
`https://raw.githubusercontent.com/thaiGO2003/forest-thorne/<sha>/<path>`. Nếu head
đổi, phải tạo lại comment evidence và cập nhật `Verified-Head`.

### 7.4 Validate trước khi handoff

```bash
node .agents/skills/github-issue-orchestrator/scripts/pr-attestation.mjs check \
  --pr <PR> --head "$HEAD_SHA"
```

Chỉ handoff Pull Verifier khi `check` trả `ok: true`. Gửi kèm: PR URL, branch, head,
issue number, evidence dir, dossier cần tạo.

## 8. Stage 5 — Pull Verifier preview và duyệt

Pull Verifier tạo `.agents/merge-review/<branch-slug>.md` từ `TEMPLATE.md`, ban đầu
`Status: PENDING`, rồi làm đủ các bước:

1. **Identity**: `git fetch origin --prune`; `git rev-parse HEAD` khớp
   `gh pr view <PR> --json headRefOid`.
2. **Sync**: merge `origin/dev` (và `origin/main` nếu main ahead) trên nhánh nguồn.
   Nếu head đổi: push, handoff lại Verifier để cập nhật `Verified-Head` + evidence
   comment + chạy lại `check`; mọi approval/evidence cũ hết hiệu lực và Pull Verifier
   duyệt lại từ bước 1. Pull Verifier không tự viết attestation.
3. **Re-run**:

```bash
pnpm typecheck
pnpm exec vitest --run <các file test liên quan>
pnpm build
git diff --check
```

4. **Preview thật**: mở app ở 390×844 và 1280×720; chụp ảnh trạng thái sau thay đổi;
   với audio/network/coop chạy thêm kịch bản tương ứng. Lưu vào evidence dir và post
   comment PR.
5. **Đối chiếu 3 chiều**: `git diff --stat origin/dev...HEAD`,
   `gh pr view <PR> --json files,additions,deletions,headRefOid,mergeable,isDraft,baseRefName`,
   dossier. File-by-file phải khớp; không có xoá/rename/binary ngoài phạm vi.
6. **Điền dossier** đầy đủ: `Status: APPROVED`, `Head:` full SHA, `Target: dev`,
   `Reviewer: agent:pull-verifier`, `Authorized-by` đúng mục 1, `Reviewed-at` UTC,
   PR link, evidence lệnh + kết quả + ảnh, rủi ro/rollback.
7. **Handoff Verifier**: gửi PR URL, head, dossier APPROVED. Chưa merge ở stage này.
   Nếu có bất kỳ commit mới nào sau bước 1, quay lại bước 1 và duyệt lại.

## 9. Stage 6 — Verifier đóng issue (PR còn mở)

Workflow đóng issue chỉ chạy khi PR **còn mở**, không draft, target `dev`, và label
`issue-verified-complete` được gắn đúng **một lần**. Thứ tự bắt buộc:

1. Pull Verifier đã duyệt xong (dossier `APPROVED` đúng head hiện tại).
2. Verifier xác nhận lại attestation rồi gắn label.
3. Chờ workflow đóng issue và ghi audit comment.
4. Pull Verifier merge ngay, không thêm commit.

Chạy từ worktree nhánh nguồn, HEAD khớp PR head:

```bash
# 1) Xác nhận head/body/snapshot còn đúng
node .agents/skills/github-issue-orchestrator/scripts/pr-attestation.mjs check \
  --pr <PR> --head "$(git rev-parse HEAD)"

# 2) Xác nhận PR thực sự merge được trước khi gắn label
gh pr view <PR> --json state,isDraft,baseRefName,mergeable,mergeStateStatus,statusCheckRollup

# 3) Gắn label khi PR còn mở (tài khoản phải có quyền admin/maintain)
gh pr edit <PR> --add-label issue-verified-complete

# 4) Chờ closure; lặp đến khi state=CLOSED hoặc có audit comment
gh issue view <N> --json state,comments
```

`mergeable` phải là `MERGEABLE` (không phải `CONFLICTING`/`UNKNOWN`), PR không draft,
target `dev`, check bắt buộc xanh. Nếu `UNKNOWN`, chờ GitHub tính lại rồi kiểm
lại trước khi label. Không label khi PR chưa chắc merge được.

- Nếu Verifier không có quyền label: báo owner gắn label; không merge trước khi xử lý.
- Nếu closure skip/fail (issue đổi snapshot, label đã từng gắn, quyền không đủ, workflow
  chưa deploy): dừng, báo owner. Không remove/re-apply label; không merge cho đến khi
  owner xử lý. Fallback: owner đóng issue thủ công bằng `gh issue close <N> --reason
  completed` sau khi đã xác nhận evidence, và ghi audit comment vào issue.
- Không merge trước khi closure xong: PR đã merge sẽ chuyển `closed` và workflow bỏ
  qua vì yêu cầu PR đang mở.

## 10. Stage 7 — Pull Verifier merge và verify sau merge

Sau khi issue đã đóng, head không đổi, merge từ worktree nhánh nguồn (hook kiểm
dossier theo branch/HEAD hiện tại). Phải đứng trên branch nguồn có tên, **không**
chạy từ detached HEAD:

```bash
git branch --show-current    # phải là branch nguồn, không rỗng/HEAD
git rev-parse HEAD           # phải trùng dossier Head
gh pr merge <PR> --merge
```

Không `--admin`, không `--squash`, không `--no-verify`. Nếu hook chặn: dừng, sửa
dossier/evidence, không lách.

Sau merge:

```bash
git fetch origin --prune
git log --oneline origin/dev -3
# trong worktree dev sạch:
pnpm typecheck
pnpm exec vitest --run <các file test liên quan>
```

Fail sau merge: tạo revert PR, không sửa lén rồi push trực tiếp `dev`.

## 11. Stage 8 — Wrap-up

- Leader đánh dấu task `completed`, đưa plan sang `done/` bằng `/plan-done`.
- Báo owner kèm PR/issue/evidence và bất thường (nếu có).

## 12. Ma trận evidence tối thiểu

| Loại thay đổi | Bắt buộc |
| --- | --- |
| Unit visual/effect | Ảnh before/after 390×844 + 1280×720, clip motion, FPS/draw-call, asset provenance |
| UI/UX | Ảnh before/after 390×844 + 1280×720, trạng thái hover/active/disabled, gate JSON |
| Logic / data / combat | Targeted test output, typecheck, ảnh test summary |
| Audio | Log playback + ảnh console/UI trạng thái |
| Network / co-op | Kịch bản 2 client + log + ảnh cả hai phía |
| Docs / tooling | Diff stat + ảnh terminal chạy lệnh kiểm chứng |

## 13. Thất bại và escalation

| Tình huống | Hành động |
| --- | --- |
| Issue thiếu acceptance/repro | `needs-info`, không tạo branch |
| Issue có visual/effect/UI/UX nhưng thiếu visual plan | Tạo visual plan + giao Visual Developer trước khi code |
| Test fail do thay đổi | Trả Developer, PR giữ open, không merge |
| Test fail có sẵn trên `origin/dev` | Ghi rõ baseline + bằng chứng, không che |
| Conflict | Giải trên nhánh nguồn; conflict ngữ nghĩa trả Developer |
| Hook chặn | Dừng, đọc lý do, sửa approval/evidence; không lách |
| Head đổi sau approval | Approval/evidence cũ vô hiệu, chạy lại toàn bộ |
| Verifier không đủ quyền đóng issue | Owner gắn label |
| Merge xong verify fail | Revert PR + mở issue follow-up |

## 14. Definition of Done

- [ ] Issue có plan, branch, task và acceptance rõ ràng.
- [ ] Issue có visual/effect/UI/UX đã có visual plan + handoff Visual Developer.
- [ ] Developer đã push branch + evidence; Leader đã kiểm handoff.
- [ ] PR target `dev`, không draft, header attestation đúng, `check` ok.
- [ ] PR body/comment có ảnh evidence pin đúng `Verified-Head`.
- [ ] Dossier `APPROVED` đúng Head/Target/Reviewer/Authorized-by.
- [ ] Issue đóng qua label `issue-verified-complete` + audit comment **khi PR còn mở**.
- [ ] `gh pr merge --merge` thành công ngay sau closure; `dev` verify lại pass.
- [ ] Plan sang `done/`, task completed, owner nhận báo cáo cuối.
