# Issue delivery workflow — GitHub issue → dev

- **Nhánh:** `chore/agents/issue-delivery-workflow`
- **Base:** `origin/dev` (`a27a325`)
- **Trạng thái:** Hoàn tất phần workflow/skill; chờ review/merge.

## Bối cảnh

Repo cần một quy trình thống nhất để Leader xử lý open GitHub issues: giao Developer,
Verifier tạo PR kèm ảnh evidence, Pull Verifier preview/duyệt theo uỷ quyền owner, rồi
merge vào `dev`. Quy trình phải khớp luật hiện có (`merge-workflow.md`,
`plans-workflow.md`, `commits.md`, `test-targeted.md`) và không thay đổi gameplay.

## Phạm vi

- Thêm `.agents/rules/issue-delivery-workflow.md`: pipeline 8 stage, vai trò, visual
  lane cho unit visual/effect + UI/UX, evidence matrix, escalation, Definition of Done.
- Thêm `.agents/skills/github-issue-orchestrator/`: runbook Leader, template visual
  plan, tài liệu PR attestation/evidence, helper `pr-attestation.mjs` + test.
- Cập nhật `AGENTS.md`, `.agents/AGENTS.md`, `.agents/rules/merge-workflow.md` để trỏ
  tới workflow/skill và ghi nhận merge qua GitHub PR.

Không làm: thay đổi gameplay, combat contract, save/schema, UI production; không sửa
62 file WIP đang có trên worktree `dev`; không tạo PR/merge/label/close issue.

## Acceptance

- [x] Workflow mô tả đúng thứ tự: Developer → Verifier tạo PR + ảnh evidence →
  Pull Verifier preview/duyệt → Verifier đóng issue khi PR còn mở → merge `dev`.
- [x] Có visual lane bắt buộc cho unit visual/effect và UI/UX; giao Visual Developer
  trước khi Developer khóa code.
- [x] Mọi PR yêu cầu ít nhất một ảnh evidence trong body/comment, pin `Verified-Head`.
- [x] Merge guard/approval được tôn trọng; không hướng dẫn force/`--no-verify`/`--admin`.
- [x] Ghi rõ closure automation chưa active vì workflow chỉ có trên `dev`, chưa có
  trên `main`/default branch; fallback đóng issue thủ công kèm audit comment.
- [x] Helper `pr-attestation.mjs` có `header`, `evidence`, `check`; fail-closed khi
  thiếu ảnh/header sai/snapshot lệch.

## Kiểm chứng

- `node --test .agents/skills/github-issue-orchestrator/scripts/pr-attestation.test.mjs`
  → **9/9 PASS**, exit 0.
- `pnpm typecheck` → **PASS**, exit 0 (tsc --noEmit).
- `node --check .agents/skills/github-issue-orchestrator/scripts/pr-attestation.mjs`
  → PASS.
- Không có secret/API key trong các file scoped (grep mẫu token/key trả rỗng).

## Rủi ro / rollback

- Rủi ro thấp: thay đổi docs + Node helper, không chạm runtime/gameplay.
- Rủi ro vận hành: closure automation chưa deploy lên default branch; phải đóng issue
  thủ công đến khi release `dev` → `main`. Không duplicate workflow.
- Rollback: revert commit này; không ảnh hưởng save/schema.

## File scoped

- `.agents/rules/issue-delivery-workflow.md` (mới)
- `.agents/skills/github-issue-orchestrator/` (mới: SKILL, references, scripts, test)
- `.agents/AGENTS.md`
- `AGENTS.md`
- `.agents/rules/merge-workflow.md`
- `.agents/plans/pending/chore.agents.issue-delivery-workflow.md` (plan này)
