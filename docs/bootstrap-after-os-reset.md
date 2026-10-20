# Bootstrap sau khi cài lại OS — Forest Throne

Tài liệu này để dùng **một lần** sau khi máy được cài lại hệ điều hành: cài agent
AI, dán prompt ở §2, để agent dựng lại môi trường, khôi phục phần code chưa từng
commit, tạo lại worktree và merge các nhánh còn treo.

Trạng thái repo tại thời điểm backup: xem `docs/worktree-status-2026-10-20.md`.

---

## 1. Việc con người phải làm trước (agent không tự làm được)

1. Cài agent coding CLI (OpenCode / 1DevTool hoặc tương đương) và mở terminal
   tại thư mục sẽ chứa code (ví dụ `C:\Users\<user>\workspace`).
2. Đăng nhập GitHub trên máy: `gh auth login` (hoặc chuẩn bị PAT). Agent không có
   credential trong repo.
3. Dán nguyên khối prompt ở §2.

---

## 2. Prompt dán cho agent

```text
Bạn đang khôi phục môi trường phát triển cho dự án Forest Throne trên một máy vừa
cài lại OS (Windows). Máy mới trống: chưa có source, chưa có toolchain, chưa có
danh tính git. Hãy làm toàn bộ các bước dưới đây, tuần tự, dừng lại hỏi tôi khi
cần quyết định, và báo rõ bằng chứng sau mỗi bước.

## 0. Sự thật nền (đừng đoán lại, hãy verify)
- Repo: https://github.com/thaiGO2003/forest-thorne.git (PUBLIC, source-available).
- Nhánh chính: `main` = bản release cũ (16fd04f); `dev` = nhánh tích hợp mới nhất
  (d77892d, đã gộp PR #5 WBS-033 board geometry và PR #6 WBS-019 combat queue).
- Các nhánh `feat/*` đã có trên origin, KHÔNG xoá, KHÔNG force-push.
- Có một nhánh backup tạm: `temp/backup-pre-reset-2026-10-20` (parent = `main`
  16fd04f, lấy commit hiện tại bằng `git rev-parse`). Đây là snapshot working tree
  của `main` trước khi reset:
  585 file `.omp/**` bị xoá, 590 file `.agents/**` được thêm, `AGENTS.md` +
  `README.md` sửa theo đường dẫn mới, thêm `.1devtool/tasks.config.json` và
  `docs/worktree-status-2026-10-20.md`. `package-lock.json` đã bị loại bỏ (repo dùng
  pnpm, file này là rác của npm).
- Worktrees cũ cần dựng lại: `forest-thorne-dev` (dev),
  `forest-thorne-plan-034` (feat/world/3d-voxel-arena-terrain-meshes-instancedmesh),
  `forest-thorne-plan-080` (feat/content/audio-director-procedural-sfx-manager),
  `forest-thorne-plan-crow` (feat/units/crow-chromatic-darts, chưa bắt đầu).

## 1. Cài toolchain (Windows)
- Git for Windows (đã có sẵn nếu mở được terminal git-bash/cmd có `git`).
- Node.js 24 LTS (project đã chạy 24.20.0). Kiểm tra: `node -v` → v24.x.
- pnpm đúng version trong package.json: `packageManager: pnpm@11.25.0`
  → `corepack enable` rồi `corepack prepare pnpm@11.25.0 --activate`
  → `pnpm -v` phải ra 11.25.0.
- GitHub CLI: `gh --version`; nếu chưa có thì cài bằng winget
  (`winget install GitHub.cli`) rồi MỞ TERMINAL MỚI.
- Kiểm tra `git --version`, `node -v`, `pnpm -v`, `gh --version` và in kết quả.

## 2. Danh tính + auth
- `git config --global user.name "Lương Quốc Thái"`
- `git config --global user.email "luongquocthai.thaigo.2003@gmail.com"`
- `git config --global core.autocrlf true` (repo Windows, có file CRLF legacy).
- `gh auth status`; nếu chưa đăng nhập thì DỪNG và bảo tôi chạy `gh auth login`.

## 3. Clone + khôi phục phần chưa từng commit
- Chọn thư mục làm việc, hỏi tôi nếu chưa rõ, mặc định `%USERPROFILE%\workspace`.
- `git clone https://github.com/thaiGO2003/forest-thorne.git`
- `cd forest-thorne`
- `git fetch origin temp/backup-pre-reset-2026-10-20`
- So sánh: `git diff --stat main origin/temp/backup-pre-reset-2026-10-20`
  → phải thấy đúng nhóm `.omp` bị xoá, `.agents` được thêm, 2 file AGENTS.md/README.md
  sửa, `.1devtool/tasks.config.json`, `docs/*`. Nếu thấy file lạ (secret, .env,
  node_modules, dist, package-lock.json) thì DỪNG, báo tôi.
- Đưa snapshot lên `main` thành commit chính thức (giữ đúng 1 commit sạch trên nền
  `main`, vì backup commit đã có parent là `main`):
  1. `git switch -c chore/agents-migration origin/temp/backup-pre-reset-2026-10-20`
  2. `git diff --name-status main...HEAD` để rà danh sách file; phải thấy `.omp` bị
     xoá, `.agents/**` được thêm, `AGENTS.md`/`README.md` sửa, `.1devtool/tasks.config.json`,
     `docs/*`. Không được có secret, `.env`, `node_modules`, `dist`, `package-lock.json`.
  3. `git commit --amend -F <file-message>` với tiêu đề `chore(agents): migrate .omp to .agents`,
     body nêu lý do, nhóm file thay đổi và bằng chứng kiểm thử (theo `.agents/rules/commits.md`).
  4. `git switch main && git merge --ff-only chore/agents-migration && git push origin main`
- Sau khi `main` đã có commit migration và `git status` sạch: hỏi tôi có xoá nhánh
  backup trên remote không (`git push origin --delete temp/backup-pre-reset-2026-10-20`).
  Không tự xoá khi chưa được đồng ý.

## 4. Cài dependency + gate chất lượng
- `pnpm install` (tuyệt đối không dùng npm/yarn; nếu thấy `package-lock.json` xuất
  hiện thì xoá).
- Chạy và báo kết quả từng lệnh: `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Nếu có test fail: ghi rõ file/test fail, KHÔNG sửa lung tung, báo tôi trước.

## 5. Dựng lại worktree
- `git worktree add ../forest-thorne-dev dev`
- `git worktree add ../forest-thorne-plan-034 feat/world/3d-voxel-arena-terrain-meshes-instancedmesh`
- `git worktree add ../forest-thorne-plan-080 feat/content/audio-director-procedural-sfx-manager`
- Chỉ tạo `forest-thorne-plan-crow` (feat/units/crow-chromatic-darts) khi bắt đầu
  làm unit Quạ Phi Tiêu.
- `git worktree list` để xác nhận.

## 6. Merge các nhánh còn treo (theo thứ tự, verify sau mỗi bước)
1. `feat/world/3d-voxel-arena-terrain-meshes-instancedmesh` (WBS-034, hơn dev 2
   commit, 3 file +78/−10) → merge vào `dev`, chạy `pnpm typecheck`,`pnpm test`,
   push `dev`.
2. `feat/content/audio-director-procedural-sfx-manager` (WBS-080, hơn dev 1 commit,
   9 file +973/−32) → merge vào `dev`, chạy lại gate, cập nhật plan
   `.agents/plans/pending/feat.content.audio-director-procedural-sfx-manager.md`
   (đánh dấu hoàn thành, ghi bằng chứng test) rồi `/plan-done` hoặc chuyển file
   sang `.agents/plans/done/` theo `.agents/rules/plans-workflow.md`.
3. Không merge gì vào `main` nếu tôi chưa yêu cầu.

## 7. Việc cần kiểm tra lại (đừng tự “sửa cho xong”)
- WBS-049: plan `.agents/plans/pending/feat.ui.medieval-forest-fantasy-asset-first-ui-chrome-engine.md`
  ghi "Hoàn thành" và nói đã code `src/ui/chrome.ts`, nhưng file này KHÔNG tồn tại
  trên `dev` (xem lại `docs/worktree-status-2026-10-20.md`). Hãy kiểm tra thực tế
  `src/ui/*` rồi báo tôi: xác nhận đã xong (nếu chrome engine nằm trong `kit.ts`/`ui.css`)
  hay cần mở lại plan.
- Branch `feat/ui/...` và `feat/units/crow-chromatic-darts` chưa từng có commit
  riêng, trùng `dev`; không cần push thêm.

## 8. Luật bắt buộc của repo
- Đọc trước khi sửa code: `.agents/AGENTS.md`, `.agents/rules/commits.md`,
  `.agents/rules/plans-workflow.md`, `.agents/rules/use-pnpm.md`,
  `.agents/rules/test-targeted.md`, `.agents/rules/no-explicit-any.md`.
- Mọi lệnh dùng `pnpm` (không npm/npx/yarn).
- Commit phải có body: nguyên nhân, file thay đổi, bằng chứng test. Mỗi commit một
  mục tiêu.
- UI production theo asset-first: CSS chỉ layout/toạ độ/responsive, không dùng CSS
  để tô màu/dựng chrome.
- Không commit secret/API key, không commit `node_modules`, `dist`, `package-lock.json`.
- Không force-push `main`, `dev`, hay bất kỳ nhánh `feat/*` đã push.

## 9. Định nghĩa hoàn thành
Báo cáo lại cho tôi: `git log --oneline -3 main`, `git branch -vv`,
`git worktree list`, trạng thái `dev` so với `origin/dev`, kết quả
`pnpm typecheck` / `pnpm test` / `pnpm build`, và danh sách việc còn treo
(WBS-049, audio merge, crow). Cập nhật `docs/worktree-status-*.md` nếu trạng thái
đã khác bản 2026-10-20.
```

---

## 3. Sau khi agent chạy xong

- `docs/worktree-status-2026-10-20.md` mô tả trạng thái trước reset; nếu agent đã
  merge WBS-034/WBS-080 thì nên tạo báo cáo mới thay vì sửa bản cũ.
- Nhánh `temp/backup-pre-reset-2026-10-20` chỉ nên xoá sau khi `main` đã có commit
  migration và đã `pnpm build` pass.
