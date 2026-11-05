# Visual plan — issue #<N>

Mẫu Leader điền trước khi giao **Visual Developer**. Dùng cho unit rig/animation,
skill VFX, hit/death, material, UI/UX, icon, responsive. Không dùng CSS để vẽ
chrome/texture.

## 1. Mục tiêu nhìn thấy được

- Bề mặt: `unit rig` / `skill VFX` / `hit-death` / `UI screen` / `icon` / `responsive`.
- Trước thay đổi: <mô tả + ảnh/link>.
- Sau thay đổi: <hành vi/visual người chơi thấy>.
- Issue gốc: `#<N>`; branch: `<branch>`; worktree: `<path>`.

## 2. Tham chiếu

- Concept sheet / screenshot: <đường dẫn>.
- `old_src`: <file:line>.
- Asset pack đã duyệt: <tên/thư mục>.
- Ghi rõ asset provenance/license; không dùng asset ngoài pack nếu chưa được duyệt.

## 3. Phạm vi

- File dự kiến: `src/render/...`, `src/ui/...`, `src/content/...`.
- Không làm: gameplay balance, contract combat, save schema, thay đổi ngoài issue.
- Nếu cần đổi logic để nối visual: ghi rõ và để Developer/Verifier duyệt.

## 4. Acceptance visual

- [ ] Unit: idle / move / attack / hit / death đúng reference.
- [ ] Skill: telegraph → cast → impact → fade, đọc được ở 390×844 và 1280×720.
- [ ] UI: hover / active / disabled / focus; không vỡ layout mobile.
- [ ] Asset-first: chrome/texture/button dùng PNG/sprite/9-slice/Canvas.
- [ ] Reduced-motion hoặc fallback cho mobile yếu.
- [ ] Performance: FPS mục tiêu, draw call/triangles trong budget.
- [ ] Không có asset/secret ngoài phạm vi.

## 5. Evidence

Lưu tại `.agents/merge-review/<branch-slug>/visual/`:

```text
before-390x844.png
after-390x844.png
after-1280x720.png
motion-<state>.gif / .mp4 / .webm   # nếu có animation/VFX
perf-<gate>.json                    # nếu có budget
```

Ảnh phải pin theo `Verified-Head` khi đưa vào PR body/comment.

## 6. Handoff Visual Developer

```text
Issue #<N> — branch <branch> — worktree <path>
Visual plan: .agents/plans/pending/<plan>.md (mục Visual plan)
Phạm vi: <file/asset>
Tham chiếu: <concept/old_src/screenshot>
Acceptance: <copy checklist>
Evidence: .agents/merge-review/<branch-slug>/visual/ — 390x844, 1280x720, motion, perf
Phối hợp: không sửa gameplay contract; báo Leader khi xong
Không merge, không tạo PR, không tự duyệt.
```

Nếu visual là deliverable lớn/độc lập, tách branch `feat/visual/<slug>-issue<N>` và
vẫn link về issue gốc.
