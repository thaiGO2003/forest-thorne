# Plans changelog

## 2026-09-22 08:28:37 +07:00

- Bắt đầu execution pass toàn bộ plan theo yêu cầu owner.
- Quy ước: Git history là archive; plan complete/superseded có thể xoá khỏi HEAD.
- Mọi thay đổi plan/WBS phải ghi timestamp vào changelog tương ứng.
- Không sửa/xoá `old_src/**`.

## 2026-09-22 15:56 +07:00

- Production bootstrap chuyển sang Three-only: xóa runtime `?engine=phaser`, `initGame`, dynamic Phaser boot và Vite Phaser prebundle/chunk path.
- Canonical-owner cleanup: xóa `ThreeUiResponsive.ts`, `ThreeCombatQueue.ts`, `ThreeKeyboardBindings.ts`; bỏ Three alias `createPhaserGameConfig`.
- Audio settings hợp nhất vào `core/uiSettings` với `audioMuted`; xóa storage `forest-throne.audio.*`.
- README/package/docs topology cập nhật; dangling `deploy` script bị xóa.
- `wbs.html` cập nhật theo HEAD và ghi rõ runner/browser gates chưa verify.

## 2026-09-22 17:00 +07:00

- Pinned `three` to exact `0.186.0` in `package.json` and `pnpm-lock.yaml`; frozen-install verification still requires a runner.
- Renderer-neutralized Three-reachable tutorial/combat/shared seams and extracted canonical `src/core/planningBoardAccess.ts` plus `src/core/augmentPower.ts`.
- Updated migration inventory/import-closure generators for Three-only production boot and branch-based rollback.
- Invalidated 2026-09-18 Phase 8/9 verification as historical because it predates the 2026-09-22 cleanup tranche.

## 2026-09-22 20:58 +07:00

- Source-complete plan audit appended to all remaining feature/model plans; they stay in `pending/` because current-HEAD runtime/browser evidence is still missing.
- `three@0.186.0` is now exact in package + lock specifier; frozen install remains unverified because pnpm/network are unavailable in the runner.
- Production release/build tests now require zero Phaser chunks instead of the removed runtime rollback chunk.
- New canonical owners/extractions: `core/planningBoardAccess.ts`, `core/augmentPower.ts`; Three-reachable planning/combat/tutorial seams were repointed away from legacy Phaser-heavy runtimes.
- Phase 8/9 historical evidence from 2026-09-18 is explicitly invalidated for the post-cleanup HEAD and must be rerun.

## 2026-09-22 21:17 +07:00

- Pinned `three` dependency exactly to `0.186.0` and synced the lockfile specifier; frozen-install execution still pending.
- Removed dead `src/three/ThreeMainMenuSocialDonate.ts`; production donation QR logic moved to `src/core/donateQr.ts`.
- I18N sweep moved Loading/Lazy loader, multiplayer, gamepad, combat action and inventory labels into symmetric VI/EN `three.*` keys.
- Inventory/closure generators updated for Three-only rollback policy and removed obsolete structural-adapter assumptions.
- Current HEAD still requires fresh closure/typecheck/Vitest/build/browser evidence before release gates can return to PASS.

## 2026-09-22 21:36 +07:00

- Reconciled Hawk/Monkey/Owl source exit while preserving runtime/browser gates.
- Started remaining-roster bespoke implementation: Wasp Sting, Fox Flame, Scorpion Shadow are now 3/119 SOURCE DONE.
- WBS HTML updated with exact source-vs-runtime verification level.

## 2026-09-22 22:16 +07:00

- Canonicalized equipment mutation ownership into `src/scenes/shared/sceneEquipmentRuntime.ts`; removed duplicate `src/three/ThreeSceneEquipmentRuntime.ts`.
- Repointed `ThreeRoundScene`, Phase 2 parity tests and equipment tests to the shared canonical owner; added a static Phase 10 owner assertion.
- Tightened atomic rejection semantics so normalization does not mutate `unit.equips` before all equip gates pass; added regression coverage for byte-identical rejected state.
- Master plan 4.3–4.5 downgraded to `[~]` SOURCE IMPLEMENTED / RE-RUN REQUIRED because the implementation changed after older evidence.
- Local runner checkout could not be obtained in this session (container has no GitHub DNS/network); no Vitest/typecheck/build/browser PASS claimed.
- Inventory generator source is already Three-only-correct on current `dev`, while generated `docs/three-migration-inventory.md` is still stale until regeneration can actually run.

## 2026-09-22 22:21 +07:00

- Added a three-level static transitive closure audit for Planning attack preview, unit info and tooltip paths; no live Phaser edge was found in the audited source graph.
- Kept Phase 10.2 partial because the authoritative generated AST closure cannot be regenerated in this session.
