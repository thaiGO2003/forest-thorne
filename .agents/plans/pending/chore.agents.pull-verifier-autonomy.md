# Pull Verifier autonomy + lint-first merge policy reconciliation

- **Issue:** #151 — https://github.com/thaiGO2003/forest-thorne/issues/151
- **Branch:** `chore/agents/pull-verifier-autonomy`
- **Base:** `origin/dev` + `origin/main` (both merged on source branch)
- **Status:** Docs-only policy reconciliation; ready for Verifier PR handoff.

## Bối cảnh

Owner uỷ quyền ngày 2026-11-07: routine PRs không cần human-in-the-loop. Pull Verifier được
tự duyệt/merge khi pass; khi fail phải báo Leader lý do cụ thể + hướng sửa. Đồng thời repo
đang có hai policy song song:

- `main`: fast path lint-first cho draft/pre-push (`pnpm mr`, CI lint, build khi ready,
  evidence external/gitignored).
- `dev`: merge gate đầy đủ trước khi merge (`typecheck`, targeted tests, build, head-pinned
  evidence, dossier APPROVED, hooks, PR merge dev).

Hai policy không loại trừ nhau: fast path tối ưu vòng lặp draft; merge gate bảo vệ `dev`.
Cần hợp nhất tài liệu để agent không hiểu sai "lint pass = merge approval".

## Phạm vi

- Hợp nhất `.agents/rules/merge-workflow.md` thành Part A (fast path) + Part B (merge gate).
- Giữ nguyên semantics fast path của `main`: pre-push lint/typecheck-only, draft CI lint,
  `pnpm mr`, evidence external/gitignored, build khi ready/`--full`.
- Giữ nguyên merge gate của `dev`: sync `origin/dev`/`origin/main`, `pnpm typecheck`,
  targeted verification, `pnpm build`, head-pinned image evidence, dossier APPROVED,
  hooks, PR merge `dev`.
- §4b đặt sau reviewer checklist của §4; exact `Reviewer`/`Authorized-by` quote.
- Đồng bộ quote 2026-11-07 trong `.agents/rules/issue-delivery-workflow.md` và
  `.agents/skills/github-issue-orchestrator/SKILL.md`.
- Hợp nhất `.agents/AGENTS.md`: giữ BrowserPanel section của `main`, Issue delivery +
  Merge review của `dev`, thêm phân biệt fast path vs merge gate.
- Không sửa gameplay, code runtime, PR #128/#131/#138, primary worktree.

## Quyết định

- **Fast path** chỉ cho draft/pre-push; **không** cấp approval/merge.
- **Merge gate** bắt buộc cho ready/`dev`/`main`; dùng dossier APPROVED đúng HEAD/Target.
- Pull Verifier standing authorization cho routine PR:
  `Reviewer: agent:pull-verifier`
  `Authorized-by: thaiGO2003 — 2026-11-07 — "tui ko muon human in the loop dau"`
- Khi fail: report Leader file:line + command/evidence + failed gate + minimal fix + reason
  not APPROVED. Không chỉ trả REQUEST_CHANGES rồi đứng.
- Không bypass hook/evidence/HEAD/Target; không `--admin`/force/`--no-verify`/ours/theirs.

## Acceptance

- [ ] `origin/dev` và `origin/main` đều là ancestor của source HEAD (trừ commit docs mới).
- [ ] Không còn conflict markers; diff chỉ policy/docs/plan.
- [ ] Fast path và merge gate cùng tồn tại, phân biệt draft/pre-push vs ready/merge.
- [ ] §4b nằm sau reviewer checklist §4, quote đúng 2026-11-07.
- [ ] Issue-delivery workflow + skill dùng cùng quote, không còn quote 2026-11-05 trong
  phần authorization.
- [ ] `.agents/AGENTS.md` giữ BrowserPanel + Issue delivery + Merge review.
- [ ] `git diff --check` PASS; secret scan PASS; docs markdown render OK.
- [ ] Independent Verifier tạo PR target `dev` với Issue-Snapshot/Verified-Head/evidence.

## Kiểm chứng dự kiến

- `git merge origin/dev`, `git merge origin/main`; resolve semantic, no ours/theirs.
- `git rev-list --left-right --count HEAD...origin/dev` và `...origin/main` = 0 behind.
- `git diff --check`.
- Secret scan scoped docs.
- Docs-only smoke: render markdown/link check; no runtime/build required.
- `gh issue view 151` link checks.

## Rủi ro / rollback

- Rủi ro: hiểu nhầm fast path là merge approval; đã tách Part A/B rõ.
- Rủi ro: quote cũ trong workflow/skill gây lệch; đã đồng bộ 2026-11-07.
- Rollback: revert commit policy docs; không ảnh hưởng runtime/save.

## Files scoped

- `.agents/rules/merge-workflow.md`
- `.agents/rules/issue-delivery-workflow.md`
- `.agents/skills/github-issue-orchestrator/SKILL.md`
- `.agents/AGENTS.md`
- `.agents/plans/pending/chore.agents.pull-verifier-autonomy.md`
