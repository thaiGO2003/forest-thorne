# Merge review: feat/shop/unit-detail

- Status: PENDING
- Head: ff106d64485f793ed09264bf95f3c8a426d4e531
- Target: dev
- Reviewer:
- Reviewed-at:
- PR: https://github.com/thaiGO2003/forest-thorne/pull/47

## Phạm vi

Tích hợp Shop card stats, Library filtering/pagination, Unit Detail keyboard/touch/tooltip và Billboard compact/detailed từ `feat/shop/unit-detail` vào `dev`. Bảo toàn upstream Planning controls, Arena/board changes và canonical state.

## Diff

```text
git diff --stat origin/dev...HEAD: 15 files, 666 insertions(+), 232 deletions(-)
docs/shop-library-unit-detail-acceptance-2026-10-29.md | 76 +++++
src/app/screens.ts                                 | 82 +-----
src/core/i18n.ts                                   |  2 +
src/core/inspection.ts                             | 16 +-
src/ui/card.ts                                     | 83 ++++--
src/ui/library.ts                                  | 40 ++-
src/ui/planning.ts                                 | 35 ++-
src/ui/tooltip.ts                                  | 38 ++-
src/ui/ui.css                                      | 37 ++-
src/ui/unitInventory.ts                            | 325 ++++++++++++++++-----
src/units/billboard.ts                             | 61 +++-
src/units/boardView.ts                             |  7 +-
tests/billboard-presentation.test.ts               | 51 ++--
tests/board-view-presentation.test.ts              |  6 +
tests/unit-inventory.test.ts                       | 39 +++
```

File bị xoá/đổi tên/binary trong feature diff: không có (git diff --name-status origin/dev...HEAD).

## Đồng bộ & conflict

- Đã merge `origin/dev` tại `7239c12f8019134ed729b08af243f48d00303ad7` bằng commit `bb4067c168d6c91efe33ee94831517889769d4ff`.
- `origin/main` (`9eb406cd5ed9f3abdbf5696252fcf2e6812354cc`) đã là ancestor của HEAD, không cần merge lại.
- Resolved conflicts: `src/app/screens.ts`, `src/ui/card.ts`, `src/ui/library.ts`, `src/ui/planning.ts`, `src/units/billboard.ts` bằng kết hợp semantics cả 2 nhánh; giữ Shop unit interaction, upstream buy labels và THREE.Sprite.
- `src/units/boardView.ts`: giữ projection, compact/detailed state, hover render order; `tests/board-view-presentation.test.ts`: bổ sung mock `setDetailed()`.

## Kiểm chứng

- `pnpm typecheck`: PASS (post-conflict).
- Targeted Vitest: 6 files, 32/32 PASS sau merge.
- `pnpm build`: PASS, Vite 95 modules.
- `git diff --cached --check`: PASS trước merge commit.
- Chromium 1DevTool BrowserPanel: Shop card opens Unit Detail bằng click và Enter; Escape closes; Library search `Hổ Nanh` returns 1/125; 3-star changes selected star and skill to Nộ 3; PASS.
- Post-merge Chromium/SwiftShader WebGL2 smoke: eight populated desktop cards (1280×800), four landscape (844×390), two portrait (390×844); viewport geometry and dialog bounds PASS; Shop DOM purchase spends authored 1 gold once, creates canonical bench unit and clears slot; disabled and zero-gold clicks leave state unchanged; no page errors. Evidence: `docs/shop-library-unit-detail-acceptance-2026-10-29.md` (commit `34003f7866a4272517d5c387dadcf51c60be910f`). Outstanding: physical-device touch, hardware framebuffer/performance, long-press/pointercancel post-merge, representative Billboard GPU, small-text readability and overlapping nameplates.

## Rủi ro & rollback

- Không thay đổi canonical save schema dự kiến; inventory UI event binding và billboard presentation API đã đổi, cần review regression và lifecycle.
- Những browser gates còn thiếu phải được kiểm tra trước khi human approval/merge.
- Rollback sau khi merge vào dev: revert merge commit trên dev sau khi đánh giá các dependent commits; không reset/force-push.

## Kết luận

- [x] Tiêu đề/PR khớp phạm vi
- [x] Không xoá file ngoài phạm vi
- [x] Không có secret/binary mới trong feature diff
- [x] Evidence test/build tái lập được
- [ ] Post-merge hardware GPU, physical touchscreen, Billboard/readability visual acceptance (Chromium WebGL2 CSS viewport and purchase checks completed)
- [ ] Human review điền Status APPROVED, Reviewer, Reviewed-at và xác nhận đúng Head trước merge

**Agent chưa phê duyệt.**
