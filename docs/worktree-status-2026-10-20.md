# Báo cáo tình hình worktree — 2026-10-20

> Mục đích: chốt hiện trạng toàn bộ worktree/branch trước khi reset máy, xác định
> phần nào đã đẩy lên GitHub, phần nào còn nằm local, và điểm cần xử lý tiếp.

## 1. Môi trường

| Mục | Giá trị |
| --- | --- |
| Repo | `https://github.com/thaiGO2003/forest-thorne.git` (PUBLIC) |
| Nhánh chính | `main` (bản phát hành), `dev` (tích hợp) |
| Số worktree git | 8 |
| Số worktree OpenCode nhận diện | 2 (`worktree_list`) |
| Stash | 0 (không có stash nào trên toàn repo) |
| Commit chưa push trên mọi branch | 0 (`git log --branches --not --remotes` rỗng) |

Ngoại lệ duy nhất: **working tree của `main` đang dirty** (xem §3.1) — đây là toàn bộ
phần chưa được lưu lên remote.

## 2. Bảng tổng hợp

| # | Worktree | Branch | HEAD | Upstream | Dirty | Tiến độ |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `workspace/forest-thorne` | `main` | `16fd04f` | `origin/main` (0/0) | **1179 file** | Migration `.omp` → `.agents` chưa commit |
| 2 | `orca/workspaces/.../Forest-Thorne` | `thaiGO2003/Forest-Thorne` | `16fd04f` | không có | 0 | Bản sao y `main`, không có gì riêng |
| 3 | `workspace/forest-thorne-dev` | `dev` | `d77892d` | `origin/dev` (0/0) | 0 | Đã gộp PR #5 (WBS-033) + PR #6 (WBS-019) |
| 4 | `workspace/forest-thorne-plan-019` | `feat/combat/combat-queue-...` | `5cca6bb` | có, 0/0 | 0 | WBS-019 xong, đã merge vào `dev` |
| 5 | `workspace/forest-thorne-plan-033` | `feat/world/logical-visual-board-...` | `db14eee` | có, 0/0 | 0 | WBS-033 xong, đã merge vào `dev` |
| 6 | `workspace/forest-thorne-plan-034` | `feat/world/3d-voxel-arena-...` | `59aa6aa` | có, 0/0 | 0 | WBS-034 xong, **chưa merge** (hơn `dev` 2 commit) |
| 7 | `workspace/forest-thorne-plan-049` | `feat/ui/medieval-forest-fantasy-...` | `d77892d` | **không có** | 0 | **Chưa có commit nào** (branch = `dev`) |
| 8 | `workspace/forest-thorne-plan-080` | `feat/content/audio-director-...` | `03283e9` | có, 0/0 | 0 | Xong phần code, **chưa merge**, plan chưa đóng |
| 9 | `workspace/forest-thorne-plan-crow` | `feat/units/crow-chromatic-darts` | `d77892d` | **không có** | 0 | **Chưa bắt đầu** (0/15 task) |

`0/0` = `behind/ahead` so với upstream, tức local và `origin` trùng nhau.

## 3. Chi tiết từng worktree

### 3.1 `main` — `workspace/forest-thorne` (dirty)

- HEAD `16fd04f` = `origin/main`, commit cuối: *assets: thêm nhạc nền (Vietnam) và font
  (Bonestay/Amstrong) cho dự án* (2026-10-18).
- Working tree dirty **1179 mục**, toàn bộ là đợt migration config agent:
  - `D` 585 file: xoá `.omp/` (agents, commands, hooks, plans, skills, rules).
  - `M` 2 file: `AGENTS.md`, `README.md` (cập nhật đường dẫn sang `.agents`).
  - `??` 592 mục: `.agents/` (590 file), `.1devtool/tasks.config.json`,
    `package-lock.json` (sau khi rà soát đã xoá — xem ghi chú bên dưới).
- Plan tương ứng: `.agents/plans/done/chore.agents.migration.md` — đã để ở `done/`
  nhưng **chưa commit**.
- Ghi chú:
  - `package-lock.json` là rác còn lại của `npm` (repo chuẩn dùng `pnpm` +
    `pnpm-lock.yaml`) → **đã xoá khỏi working tree và khỏi bản backup**, không đưa
    vào `main`.
  - Đã quét secret trên 592 file mới (`sk-`, `ghp_`, `AIza`, private key, PAT…):
    **không phát hiện gì**, an toàn để push lên repo public.
  - `.1devtool/tasks.config.json` chỉ chứa cấu hình gate, không có API key.

### 3.2 `orca/workspaces/forest-thorne/Forest-Thorne`

- Branch `thaiGO2003/Forest-Thorne` = `16fd04f`, trùng `main`, không có remote branch,
  working tree sạch.
- Kết luận: không có code riêng, không cần backup.

### 3.3 `dev` — `workspace/forest-thorne-dev`

- HEAD `d77892d` (merge PR #6), sạch, đồng bộ `origin/dev`.
- Hơn `main` 4 commit, nhưng diff thực tế chỉ **4 file (+103/−7)**: WBS-033 (board
  geometry) ở PR #5 và WBS-019 (combat queue) ở PR #6.
- Đây là nhánh tích hợp mới nhất — các plan mới nên tách từ đây.

### 3.4 `plan-019` — WBS-019 Combat Queue

- Branch `feat/combat/combat-queue-deterministic-interleaving-engine`, HEAD `5cca6bb`
  *test(combat): prove deterministic WBS-019 turn queue*.
- Sạch, đã push, đã merge vào `dev` (PR #6).
- Plan `.omp/plans/pending/feat.combat...md`: trạng thái **Hoàn thành (WBS)**,
  audit qua `tests/combat.test.ts`.
- Lệch nhỏ: trong `.omp` plan vẫn nằm ở `pending/` dù đã xong; bản `.agents` (ở
  worktree `main`) đã chuyển sang `done/`.

### 3.5 `plan-033` — WBS-033 Board Geometry

- Branch `feat/world/logical-visual-board-geometry-10-logic-1-river-11-cols`,
  HEAD `db14eee`, sạch, đã push, đã merge `dev` (PR #5).
- Plan ở `done/`, trạng thái **Hoàn thành**, verify `tests/geometry.test.ts` +
  `tests/arena-mapping.test.ts`, ghi chú xác minh 2026-10-19 cho solo/coop2/coop4.

### 3.6 `plan-034` — WBS-034 Voxel Arena (InstancedMesh)

- Branch `feat/world/3d-voxel-arena-terrain-meshes-instancedmesh`, HEAD `59aa6aa`
  *merge(dev): integrate combat verification into arena branch*.
- Sạch, đã push; **hơn `dev` 2 commit**, chưa merge.
- Diff so với `dev`: `src/world/arena.ts` (+29/−10), `tests/arena-mapping.test.ts`
  (+53), `.omp/plans/changelog.md` (+6) → tổng **3 file (+78/−10)**.
- Plan: **Hoàn thành (WBS)**, verify render pixel thật qua `tests/three/`.
- Việc còn lại: mở PR/merge vào `dev`.

### 3.7 `plan-049` — WBS-049 UI Chrome Engine (asset-first)

- Branch `feat/ui/medieval-forest-fantasy-asset-first-ui-chrome-engine` = `d77892d`,
  **không có commit nào**, không có remote branch, working tree sạch.
- Plan `pending/feat.ui.medieval-forest-fantasy-asset-first-ui-chrome-engine.md` ghi
  **"Hoàn thành (WBS)"** + audit note "đã triển khai tại `src/ui/chrome.ts`".
- **Mâu thuẫn cần xử lý**: `dev` không có `src/ui/chrome.ts`; `src/ui/` hiện chỉ có
  `card.ts`, `combat.ts`, `kit.ts`, `modal.ts`, `planning.ts`, `menu.ts`, `settings.ts`,
  `techTree.ts`, `tooltip.ts`, `ui.css`… Kết luận: plan được đánh dấu xong nhưng
  **chưa có code trên branch này**. Cần verify lại chrome engine (có thể nằm trong
  `kit.ts`/`ui.css`?) hoặc mở lại plan.
- Branch chưa push (dù không có commit riêng nên không mất gì).

### 3.8 `plan-080` — WBS-080 Audio Director & Procedural SFX

- Branch `feat/content/audio-director-procedural-sfx-manager`, HEAD `03283e9`
  *feat(audio): integrate contextual music and semantic SFX*, sạch, đã push.
- Hơn `dev` 1 commit, **chưa merge**. Diff: 9 file (+973/−32), gồm
  `src/audio/ForestAmbience.ts` (mới, 339 dòng), `src/audio/SoundEffects.ts`,
  `src/app/app.ts`, `src/app/screens.ts`, `src/ui/modal.ts`, 3 file test
  (`audio-ambient`, `audio-modal-lifecycle`, `audio-sfx`) và `README.md`.
- Nền audio sẵn có trên `dev`: `MusicDirector.ts`, `MusicContinuity.ts`,
  `CombatLowHpMusic.ts`, `SoundEffects.ts` + asset trong `public/assets/audio/**`.
- Plan vẫn ở `pending/` với checkbox `[ ]` và trạng thái **Chưa hoàn thành (WBS)**;
  audit note cũ 2026-10-05 chỉ là logic-only. Việc còn lại: chạy test, cập nhật
  trạng thái plan, merge.

### 3.9 `plan-crow` — Unit Quạ Phi Tiêu (`crow_storm`)

- Branch `feat/units/crow-chromatic-darts` = `d77892d`, **chưa có commit nào**,
  không có remote branch, sạch.
- Plan `pending/feat.units.crow-chromatic-darts.md`: trạng thái **Chờ thực hiện**,
  **0/15 task**, chưa có file rig trong `src/units/roster/` (không có `crow*`).
- Kết luận: mới dừng ở mức plan + concept sheet, chưa code.

## 4. Rủi ro trước khi reset máy

| Rủi ro | Mức | Xử lý |
| --- | --- | --- |
| Migration `.omp` → `.agents` chỉ nằm trong working tree `main` | Cao | Đã backup bằng branch tạm (xem §5) |
| `plan-034` (WBS-034) chưa merge `dev` | Trung bình | Đã có trên `origin`, giữ nguyên để merge sau |
| `plan-080` (WBS-080) chưa merge + plan chưa đóng | Trung bình | Đã có trên `origin` |
| WBS-049 plan ghi "Hoàn thành" nhưng không có code | Trung bình | Ghi nhận trong báo cáo, cần verify/redo |
| Crow chưa bắt đầu | Thấp | Chỉ cần giữ plan (đã có trong `.agents`) |
| Local branch `feat/ui/...`, `feat/units/crow...` chưa push | Thấp | Không có commit riêng → không mất gì |

## 5. Backup trước khi reset

Phần duy nhất chưa lên GitHub là working tree dirty của `main`. Đã chụp lại thành
branch tạm và push:

- Branch: `temp/backup-pre-reset-2026-10-20`
- Nội dung: đúng snapshot working tree `main` tại thời điểm backup (xoá `.omp`, thêm
  `.agents`, cập nhật `AGENTS.md`/`README.md`, kèm `.1devtool/tasks.config.json` và
  `docs/worktree-status-2026-10-20.md`). `package-lock.json` đã bị loại bỏ.
- Kèm `docs/bootstrap-after-os-reset.md` — prompt khôi phục môi trường sau khi cài
  lại OS.
- Không thay đổi `main`, không đổi index/working tree sau khi chụp (dùng
  `git add -A` → `write-tree` → `commit-tree` → `update-ref` → `git reset`).
- Mọi branch `dev` / `feat/*` khác đã có trên `origin` từ trước, không cần backup lại.

## 6. Khôi phục sau khi reset máy

```bash
git clone https://github.com/thaiGO2003/forest-thorne.git
cd forest-thorne

# lấy lại phần migration chưa từng commit
git fetch origin temp/backup-pre-reset-2026-10-20
git switch temp/backup-pre-reset-2026-10-20

# dựng lại các worktree làm việc
git worktree add ../forest-thorne-dev dev
git worktree add ../forest-thorne-plan-034 feat/world/3d-voxel-arena-terrain-meshes-instancedmesh
git worktree add ../forest-thorne-plan-080 feat/content/audio-director-procedural-sfx-manager
```

Sau khi lấy lại, nên commit dứt điểm migration trên `main` (tách commit riêng, bỏ
`package-lock.json`), rồi merge `plan-034` và `plan-080` vào `dev` theo thứ tự.

## 7. Việc tiếp theo (đề xuất)

1. Commit migration `.agents` trên `main` thành commit chính thức (không kèm
   `package-lock.json`), sau đó xoá branch tạm khi đã an tâm.
2. Merge `feat/world/3d-voxel-arena-terrain-meshes-instancedmesh` → `dev`.
3. Verify + đóng plan WBS-080, merge `feat/content/audio-director-procedural-sfx-manager`
   → `dev`.
4. Verify lại WBS-049: plan ghi xong nhưng `src/ui/chrome.ts` không tồn tại.
5. Chuyển các plan `pending/` trong `.omp` đã hoàn thành sang `done/` cho khớp `.agents`.
6. Bắt đầu `feat/units/crow-chromatic-darts` từ `dev` mới nhất.
