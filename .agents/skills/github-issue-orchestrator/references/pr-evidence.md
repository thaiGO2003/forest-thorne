# PR attestation và evidence

Tài liệu chi tiết cho Verifier/Pull Verifier. Luật gốc:
`.agents/rules/issue-delivery-workflow.md` và `.agents/rules/merge-workflow.md`.

## 1. Header attestation

Header phải bắt đầu ở dòng đầu tiên của PR body. Không có tiêu đề, list, quote, code
fence hay HTML trước nó.

```text
Closes #126
Issue-Snapshot: #126 sha256:<64 hex>
Verification: targeted vitest tests/unit-tooltip.test.ts PASS; pnpm typecheck PASS; pnpm build PASS; browser evidence 390x844 + 1280x720
Verified-Head: <40 hex>
---
```

Quy tắc:

- Thứ tự bắt buộc: (các) dòng `Closes` / `Fixes` / `Resolves` → các
  `Issue-Snapshot` tương ứng → `Verification` → `Verified-Head` → đúng dòng `---`.
- Dòng đầu tiên phải là declaration; không được có dòng trống hoặc whitespace-only
  trong header. Dòng trống chỉ được phép sau `---`.
- `Closes` / `Fixes` / `Resolves` viết độc lập, mỗi issue một dòng.
- Mỗi issue có đúng **một** `Issue-Snapshot`; không thừa, không thiếu.
- `Verification` là một dòng, tối đa 1500 ký tự, mô tả lệnh + kết quả + evidence.
- `Verified-Head` là SHA 40 ký tự của chính PR head tại thời điểm attest.
- Delimiter phải là đúng `---`; `----`, `--- ` hoặc thiếu delimiter đều invalid.
- Sau `---` mới được viết Markdown tự do.
- Helper và closure consumer dùng chung contract
  `scripts/github/attestation-contract.cjs`; cả hai phải accept/reject giống nhau.

Sinh header:

```bash
node .agents/skills/github-issue-orchestrator/scripts/pr-attestation.mjs header \
  --issue 126 --head "$(git rev-parse HEAD)" \
  --verification "targeted vitest PASS; pnpm typecheck PASS; pnpm build PASS; browser evidence 390x844/1280x720"
```

Snapshot là SHA-256 của `JSON.stringify([String(issue.title ?? ""), String(issue.body ?? "")])`
lấy trực tiếp từ GitHub Issue API. Không hash Markdown đã render, không tự copy tay.

Kiểm tra trước khi handoff:

```bash
node .agents/skills/github-issue-orchestrator/scripts/pr-attestation.mjs check \
  --pr <PR> --head "$(git rev-parse HEAD)"
```

`check` phải trả `ok: true`, PR target `dev`, không draft.

## 2. Evidence directory

Mỗi branch một thư mục:

```text
.agents/merge-review/<branch-slug>/
  evidence.md
  before-390x844.png
  after-390x844.png
  after-1280x720.png
  gate-<name>.json
```

`branch-slug` = tên branch đổi `/` thành `.` (ví dụ
`fix/ui/tooltip-3-star-issue126` → `fix.ui.tooltip-3-star-issue126`).

Tối thiểu:

- **UI/visual**: before/after ở 390×844 và 1280×720.
- **Không UI**: ảnh terminal/test summary hoặc browser console.
- Luôn có ít nhất một ảnh trong PR body hoặc comment.
- Ảnh không chứa secret; nén nếu > 500 KB.

`evidence.md` mẫu:

```markdown
# Evidence — issue #126

- Head: <sha>
- Lệnh: `pnpm typecheck` → PASS
- Lệnh: `pnpm exec vitest --run tests/unit-tooltip.test.ts` → 12/12 PASS

| Tiêu chí | Artifact |
| --- | --- |
| Expanded tooltip đủ 3 sao | after-390x844.png, after-1280x720.png |
| Không vỡ layout mobile | after-390x844.png |
```

## 3. Nhúng ảnh vào PR

Commit ảnh lên branch, rồi pin raw URL theo `Verified-Head`:

```bash
node .agents/skills/github-issue-orchestrator/scripts/pr-attestation.mjs evidence \
  --dir ".agents/merge-review/<branch-slug>" \
  --head "$(git rev-parse HEAD)" \
  > /tmp/evidence-<N>.md

gh pr comment <PR> --body-file /tmp/evidence-<N>.md
```

Helper in bảng:

```markdown
| # | Artifact | Preview |
| --- | --- | --- |
| 1 | `after-390x844.png` | ![after-390x844](https://raw.githubusercontent.com/thaiGO2003/forest-thorne/<sha>/...png) |
```

Nếu head đổi:

1. Tạo lại evidence (ảnh mới nếu cần).
2. Cập nhật `Verified-Head` trong PR body.
3. Post/refresh comment evidence.
4. Chạy lại `check`.
5. Approval cũ hết hiệu lực; Pull Verifier duyệt lại.

Có thể sửa comment gần nhất thay vì spam:

```bash
gh pr comment <PR> --edit-last --body-file /tmp/evidence-<N>.md
```

## 4. Đóng issue

**Deployment status (2026-11-05):** workflow `.github/workflows/close-verified-pr-issues.yml`
chỉ có trên `origin/dev`, chưa có trên `main`/default branch (404). Label-driven
closure **chưa active** cho đến khi release `dev` → `main`; giai đoạn này owner/Verifier
đóng issue thủ công kèm audit comment và không claim automation đã chạy.

Workflow closure chỉ chạy khi PR **còn mở** và target `dev`. Vì vậy thứ tự bắt buộc
là: Pull Verifier duyệt xong → Verifier đóng issue → Pull Verifier merge ngay.

```bash
# 1) Xác nhận head/body/snapshot còn đúng
node .agents/skills/github-issue-orchestrator/scripts/pr-attestation.mjs check \
  --pr <PR> --head "$(git rev-parse HEAD)"

# 2) Gắn label khi PR còn mở
gh pr edit <PR> --add-label issue-verified-complete

# 3) Chờ closure xong rồi mới merge
gh issue view <N> --json state,comments
```

Không merge trước khi closure xong: PR đã merge chuyển `closed` và workflow bỏ qua.
Nếu closure skip/fail, dừng và báo owner; không remove/re-apply label.

Điều kiện của workflow đóng issue:

- PR không draft, target `dev`, cùng repo, đang mở.
- `Verified-Head` khớp PR head hiện tại.
- Body PR không đổi sau khi gắn label.
- Mỗi issue liên kết có đúng một snapshot khớp title/body hiện tại.
- Người gắn label có quyền admin/maintain tại thời điểm chạy.
- Workflow `.github/workflows/close-verified-pr-issues.yml` đã có trên default branch.
- Label chỉ được gắn **một lần** trong vòng đời PR; không remove/re-apply.

Nếu issue đổi title/body sau snapshot: closure dừng. Tạo PR mới với snapshot mới;
không sửa body PR đã label rồi tái sử dụng label cũ.

Nếu tài khoản agent không đủ quyền hoặc workflow chưa deploy trên default branch:
báo owner gắn label/đóng issue. Fallback có audit: owner chạy
`gh issue close <N> --reason completed` sau khi xác nhận evidence, rồi comment lại
PR/issue. Không dùng `--admin`, không tự nâng quyền.

## 5. Lỗi thường gặp

| Triệu chứng | Nguyên nhân | Cách xử lý |
| --- | --- | --- |
| `check` báo head mismatch | Có commit mới sau attest | Cập nhật `Verified-Head`, evidence, chạy lại |
| Closure skip "missing snapshot" | Thiếu/sai/thừa `Issue-Snapshot` | Sinh lại header bằng helper |
| Closure skip "issue snapshot changed" | Issue bị sửa sau attest | PR mới + snapshot mới |
| Ảnh không hiển thị | URL không pin đúng SHA hoặc repo private | Dùng raw URL đúng head; kiểm tra quyền xem repo |
| Hook chặn merge | Dossier thiếu `APPROVED`/sai Head/Target | Sửa dossier, không lách hook |
| Merge xong test fail | Thiếu sync/verify trước merge | Revert PR, mở issue follow-up |
