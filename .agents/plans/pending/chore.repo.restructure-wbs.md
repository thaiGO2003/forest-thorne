# Forest Throne — WBS tái cấu trúc repository, tài liệu, mã nguồn và nhánh Git

## 0. Kết quả bắt buộc

Repository dễ tìm, dễ sửa, không còn cấu trúc spaghetti; runtime hoạt động chỉ còn Three.js; `old_src/` giữ nguyên read-only; tài liệu phản ánh code; naming nhất quán; monolith được chia theo trách nhiệm; TypeScript không lỗi. Mọi tranche thực hiện trên nhánh riêng từ `dev`, merge vào `dev`, browser/computer-use PASS sau merge rồi mới xóa nhánh.

## 1. Quyết định đã chốt

1. `dev` là nhánh tích hợp và default branch mới.
2. `feature/threejs-migration` trở thành `dev`. Baseline: `dev` ahead 3, behind 0 so với `origin/feature/threejs-migration`; nếu ancestry vẫn đúng lúc thực thi thì không merge giả, chỉ giữ tip `dev` rồi xóa branch cũ.
3. `origin/main` hiện tại được bảo tồn nguyên commit thành `archived/2D-Phaser`; không rewrite archive.
4. Sau cleanup, local/remote chỉ còn `dev`, `archived/2D-Phaser`.
5. Trước xóa branch, tạo Git bundle ngoài repo + SHA-256 + manifest ref→commit. Bundle không commit/push.
6. `old_src/` có 340 tracked files: giữ read-only tuyệt đối; không rename/move/format/import/fix comment/xóa.
7. Runtime chính thức chỉ còn Three.js. Rollback `?engine=phaser`, live Phaser trong `src/`, dependency/config/mock Phaser chỉ xóa sau closure + test + typecheck + browser gate.
8. Bỏ tiền tố `Three` khỏi filename/symbol active sau cutover. Giữ tên package `three`, namespace `THREE.*`, lịch sử “Three.js migration”.
9. Filename:
   - `PascalCase.ts`: primary export là class/component/scene/modal/controller.
   - `camelCase.ts`: functions/data/config/constants/adapter/procedural runtime.
   - Tests dùng cùng basename + `.test.ts`; không prefix `three`.
   - Directory lowercase `kebab-case`.
   - Cấm ALL_CAPS, snake_case, engine prefix dư, `Utils`/`Helpers` chung chung.
10. Comment không phải quota. Giữ/thêm khi giải thích reason, invariant, WebGL/browser trap, lifecycle/disposal, concurrency, coordinate/layout formula, compatibility có exit condition. Xóa banner filename, comment kể lại code, migration status hết hạn.
11. Không chạy production build vì `AGENTS.md` cấm khi chưa được user cho phép. Không chạy Playwright/harness. Gate bằng typecheck, lint scope, tests scope, actual Vite app + browser/computer-use.
12. Không sửa trực tiếp `dev`; không force-push `dev`; branch chỉ xóa sau post-merge verification.
13. `old_src/` là archive phụ read-only dù `archived/2D-Phaser` tồn tại. Đánh giá xóa archive phụ phải là kế hoạch khác có owner approval mới.

## 2. Baseline đã xác minh

- Root tracked baseline đã được dọn: giữ `AGENTS.md`, `README.md`, `data/`, `docs/`, `old_src/`, `scripts/`, `src/`, `tests/` và config còn consumer; handoff/status tạm thời đã xoá theo policy Git-history-as-archive.
- `src/`: 417 source files; `src/three/`: 139 files; 128 filename bắt đầu `Three`.
- Naming hiện trộn khoảng 223 camelCase, 191 PascalCase, 1 kebab-case, 2 kiểu khác.
- Monolith ưu tiên: `ThreeRoundScene.ts` 7,473 dòng; legacy `CombatScene.ts` 6,057; `styles.css` 4,409; `tooltip.ts` 2,515; `unitDescriptionHelper.ts` 2,373; `unitCatalog.ts` 2,243; `ThreeCoopLobbyScene.ts` 1,900; legacy `CoopLobbyScene.ts` 1,786; `ThreePlanningDragRuntime.ts` 1,568; legacy `MainMenuScene.ts` 1,503.
- `README.md` còn ghi Phaser 3/version 0.9.0; `package.json` tên `forest-throne-phaser`, version 0.1.0, dependency Phaser 4.2.1. Drift rõ ràng.
- `.vitest-ls.json*` là local artifacts.
- `docs/three-import-closure.json` generated 2.1 MB; inventory/census khác cũng generated.
- `src/generated/audioTrackIndex.temp.js`, `tributeGallery.temp.js` live-imported; không phải rác.
- GitHub default branch hiện `feature/threejs-migration`; PR #1 từ branch đó vào `main` còn mở.
- `dev` đang track sai `origin/feature/threejs-migration` thay vì `origin/dev`.
- Remote còn `main`, `master`, `app`, `make3D`, `codex/*`, `feat/remove-discord-sdk`, `feature/threejs-migration`; local còn `feature/mobile-panel-ui` với commit riêng.
- `src/main.ts` vẫn hỗ trợ `?engine=phaser`; scan hiện thấy nhiều file `src` chứa Phaser references. Cutover chưa hoàn tất.

## 3. Cấu trúc đích

```text
/
├── AGENTS.md
├── README.md
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── index.html
├── eslint.config.js
├── vite.config.js
├── vitest.config.js
├── tsconfig.json
├── vercel.json
├── config/typescript/             # chỉ tsconfig phụ còn consumer thật
├── data/                          # authored game content
│   ├── README.md
│   ├── units/
│   ├── items/
│   └── *.csv
├── docs/
│   ├── README.md                  # map + authority
│   ├── architecture/
│   ├── migration/
│   ├── generated/
│   └── reviews/
├── old_src/                       # immutable
├── public/
├── scripts/
│   ├── generate/
│   ├── verify/
│   ├── release/
│   └── maintenance/
├── src/
│   ├── app/
│   ├── core/
│   ├── data/
│   ├── game-modes/
│   ├── gameplay/
│   │   ├── combat/
│   │   ├── coop/
│   │   ├── fortress/
│   │   ├── planning/
│   │   └── round/
│   ├── generated/
│   ├── i18n/
│   ├── network/
│   ├── platform/
│   ├── rendering/
│   │   ├── board/
│   │   ├── effects/
│   │   ├── engine/
│   │   ├── terrain/
│   │   └── units/
│   ├── systems/
│   ├── ui/
│   ├── styles/
│   ├── types/
│   └── main.ts
└── tests/                         # mirror src domains; không tests/three
    ├── app/
    ├── core/
    ├── data/
    ├── gameplay/
    ├── integration/
    ├── network/
    ├── rendering/
    ├── ui/
    └── visual/
```

### 3.1 Root policy

Giữ tool-native config tại root: package/lock/workspace, Vite, Vitest, ESLint, base tsconfig, Vercel, `index.html`. Giữ `README.md`, `AGENTS.md`. Không tạo `config/` chỉ để giấu config chuẩn; chỉ move tsconfig phụ còn dùng.

### 3.2 Anti-patterns cấm

- Không rename máy móc toàn bộ sang PascalCase/camelCase.
- Không split chỉ theo số dòng; boundary phải có responsibility/lifecycle/data owner độc lập.
- Không barrel `index.ts` mọi nơi; chỉ public boundary thật.
- Không tạo `utils/`, `helpers/`, `common/`, `misc/` làm bãi rác.
- Không duplicate authority giữa `core`, `systems`, `gameplay`.
- Không compatibility shim/re-export sau clean cutover.
- Không import `old_src/`.

## 4. Manifest quyết định từng file

Tạo manifest execution với một dòng cho mọi tracked path ngoài nội dung chi tiết `old_src/`:

```text
path | owner-domain | kind(runtime/generated/history/config) | primary-export |
static-consumers | dynamic-consumers | action | destination | evidence | gate
```

`old_src/` ghi một dòng immutable tree + aggregate tree hash.

Quy tắc:

1. **keep**: có consumer, đúng domain, tên đúng.
2. **move**: đúng code, sai domain; dùng LSP `rename_file`.
3. **rename**: basename không khớp primary export hoặc `Three` dư; LSP references + rename.
4. **merge**: wrapper mỏng chỉ alias/re-export canonical API, không tạo boundary. Audit trước: `ThreeShopSystem`, `ThreeTechTree`, `ThreeItems`, `ThreeGameSpeed`, `ThreeFortressMode`, `ThreePvpFortress`, `ThreeUpgradeSystem`, `ThreeStatusTurnRuntime`, `ThreeHealUnitRuntime`, `ThreeDamageAftermathRuntime`.
5. **split**: nhiều lifecycle/responsibility độc lập; extract theo contract, không theo số dòng tùy ý.
6. **delete**: reproducible generated/cache; stale handoff; duplicate HTML; legacy hết consumer; orphan chứng minh static + dynamic/assets/routes.
7. **archive**: Git history là archive mặc định. Không giữ file stale chỉ vì “có thể cần”.
8. **blocked**: dynamic consumer chưa chứng minh. Giữ file, nêu blocker cụ thể.

## 5. WBS thực thi

## Phase A — Git safety và branch topology

### A1. Freeze/snapshot

- Giữ cron autopull paused.
- Xác nhận worktree sạch; không rebase/merge/cherry-pick.
- Fetch/prune; ghi local refs, remote refs, upstream, default branch, PR mở.
- Tạo `/home/thaigo/backups/forest-throne-branches-<UTC>.bundle` bằng `git bundle create --all`.
- Tạo `.sha256`, `.refs.txt`; `git bundle verify`; verify từng branch tip có trong bundle.

**Done:** bundle verified; manifest đủ refs; repository content chưa đổi.

### A2. Archive 2D

- Dùng exact `origin/main`, không local `main` nếu khác hash.
- Tạo/push `archived/2D-Phaser` trỏ đúng hash đó.
- Fetch; assert `origin/archived/2D-Phaser == origin/main`.
- Không merge/rebase/cherry-pick vào archive.

**Done:** exact object identity trước xóa `main`.

### A3. Hấp thụ migration vào dev

- Assert `origin/feature/threejs-migration` ancestor của `origin/dev`; baseline ahead 3/behind 0.
- Nếu đúng: không merge; giữ tip `dev`.
- Nếu remote đổi: dừng deletion, reconcile trên branch tạm, verify lại.
- Sửa local `dev` upstream→`origin/dev`.
- Đổi GitHub default branch→`dev`.
- Đóng PR #1 “superseded by verified dev ancestry”; không merge vào archive.

**Done:** default=`dev`; upstream đúng; PR cũ đóng; migration commits reachable từ `dev`.

### A4. Audit/salvage/xóa branch thừa

- Với từng branch: `git cherry -v dev <branch>`, merge-base, diffstat, changed paths.
- Commit riêng còn giá trị đi qua `salvage/<topic>`; port phần live, không merge nguyên prototype history.
- `feature/mobile-panel-ui`: kiểm tra pixel-art pipeline/assets live consumers; port nếu current requirement, nếu superseded ghi replacement evidence.
- `feat/remove-discord-sdk`: không port Discord removal nếu Activity vẫn product surface; chỉ lấy infra độc lập đang dùng.
- `make3D`, `app`, `master`, `codex/*`: prototype/obsolete trừ khi chứng minh contract live thiếu.
- Mỗi salvage branch qua Phase J gates.
- Xóa remote/local thừa; `main` xóa cuối sau archive hash check.

**Done:** chỉ `dev`, `archived/2D-Phaser`; commits cần giữ nằm trong `dev` hoặc verified bundle; remote HEAD→`dev`.

## Phase B — Read-only disposition audit

### B1. Inventory toàn repo

- Inventory tracked/ignored/untracked/generated; exclude `node_modules`; checksum `old_src/` nhưng không đọc/sửa từng file trong execution.
- Source graph: TypeScript AST/LSP static imports, exports, dynamic imports, `import.meta.glob`, string routes.
- Asset graph: CSS URLs, HTML, service worker cache, runtime loaders, manifests, generated indices.
- Script/config graph: `package.json`, deploy, docs command references.
- Docs/plans: authority/current/generated/history/stale.

**Done:** 100% tracked path ngoài protected tree có action; mọi delete có zero-consumer hoặc generator evidence.

### B2. DAG thay đổi

- Regenerate inventory/closure ra temp; diff tracked reports; không overwrite trong audit pass.
- Lập collision map cho rename legacy/new-engine basenames.
- Order: merge thin wrappers → remove Phaser → remove `Three` → move domains → split monolith → docs cleanup.

**Done:** mỗi rename có destination duy nhất; mọi caller nằm trong migration list; không dự kiến cycle mới.

## Phase C — Rác chắc chắn

Branch `chore/repository-artifact-cleanup`.

### C1. Artifacts

- Xóa `.vitest-ls.json`, `.shm`, `.wal`; giữ ignore rule.
- Xóa `dist`, test/browser output, logs, scratch, backup suffix khi tồn tại/reproducible.
- Không xóa `src/generated/*.temp.js`; chúng là live generated source.

### C2. Root/config

- Tìm consumer `tsconfig.cs-check.json`, `tsconfig.library-check.json`, `tsconfig.planning-input-check.json`.
- Không consumer: xóa. Có gate thật: move `config/typescript/`, extends base, cập nhật command.
- Xóa tracked release/output chỉ khi source+generator tồn tại.

### C3. Duplicate plan HTML

- Markdown `.omp/plans` là source; HTML là generated.
- Chỉ giữ WBS published cần thiết; xóa hand-edited duplicate.
- Một authority giữa `.omp/plans/wbs.html` và `public/wbs.html`; source→generated destination rõ.

**Gate:** typecheck; affected lint/tests/generator checks; browser WBS nếu public WBS đổi.

## Phase D — Xóa live Phaser

Branch `refactor/remove-live-phaser-runtime`.

### D1. Closure trước delete

- Sửa default Three static graph còn kéo Phaser.
- `src/scenes/ThreeDemoScene.ts → src/three/**`: orphan thì xóa; còn route thì move sang app/gameplay rồi cập nhật route.
- Type-only Phaser dependencies đổi thành renderer-neutral local contracts.
- `old_src/` chỉ reference, không copy/mutate.

### D2. Xóa rollback

- `src/main.ts`: xóa `PhaserGameLike`, `shouldBootPhaser`, query `engine=phaser`, dynamic legacy bootstrap, copy nhắc Phaser.
- Xóa `createPhaserGameConfig`, aliases/mocks/config chỉ phục vụ Phaser.
- Xóa live legacy scenes/UI theo regenerated safe-deletion manifest; shared renderer-neutral core/systems/data/network/platform/i18n phải giữ/move.

### D3. Dependency

- `pnpm remove phaser`; lockfile cập nhật.
- Xóa `phaser3spectorjs` alias/mock nếu zero consumer.
- Xóa rollback-only scripts/tests/docs.
- Regenerate closure; zero live Phaser imports/dependency.

**Gate:** `pnpm run verify:three:cutover`; closure gate; typecheck; pre-reorg `pnpm exec vitest --run tests/three`; affected lint; actual browser desktop+mobile boot/menu/new run/planning/combat; console/pageerror/requestfailed. Không Playwright script/build.

**Done:** Three-only live runtime; `?engine=phaser` hết contract; `old_src/` tree hash unchanged.

## Phase E — Source naming/layout cutover

Mỗi mục là branch độc lập.

### E1. App/engine — `refactor/app-rendering-layout`

- `ThreeApp.ts`→`src/app/App.ts`, symbol `App`.
- `ThreeGameFlowRouter.ts`→`src/app/GameFlowRouter.ts`.
- Loading/lazy/main menu scenes→`src/app/scenes/` bỏ prefix.
- SceneManager/CameraManager/CameraJoystick/Lighting/AssetLoader/PerformanceProfiler/GameConfig→`src/rendering/engine/` bỏ prefix.
- Xóa alias kiểu `LoadingScene as ThreeLoadingSceneAlias`; migrate callers trực tiếp.
- Thu nhỏ rồi xóa `src/three/index.ts`; cuối tranche không barrel compatibility.

### E2. Rendering domains — `refactor/rendering-domains`

- Board group→`rendering/board`: Board, Renderer, Viewport, InputController, ArenaAssets, RiverDivider.
- Terrain group→`rendering/terrain`: voxel block/cuboid/terrain/data/scenery.
- Effects group→`rendering/effects`; status/avatar/star/model group→`rendering/units`.
- Bespoke models→`rendering/units/models/<species>/`.
- Split catch-all `types.ts` theo owner; không tạo new catch-all.

### E3. Planning — `refactor/planning-domain`

- `ThreePlanning*`→`gameplay/planning`; subfolders chỉ khi ≥2 cohesive modules: input, shop, inventory, tech, crafting, presentation.
- Xóa `ThreePlanningScene.ts` alias 398B nếu không behavior.
- `PlanningDragRuntime` split: pointer session, projection, drop resolution, presentation. Board mutation vẫn do canonical BoardBenchOps.

### E4. Round/combat — `refactor/round-combat-domain`

- `ThreeRoundScene.ts` 7,473 dòng→coordinator nhỏ + phase state, Planning controller, Combat controller, spawn, timeline, persistence bridge, presentation bridge.
- Không truyền whole scene nếu module chỉ cần vài dependency.
- Combat group→`gameplay/combat`: action, formation, pacing, queue, HUD, presentation, multiplayer, result, loot, VFX bridge.
- Xóa `ThreeCombatScene.ts` alias 469B nếu zero behavior.

### E5. Co-op/fortress — `refactor/coop-fortress-domain`

- Lobby→`gameplay/coop`; split room session, transport subscriptions, ready state, presentation.
- Fortress map/service/PvP fortress→`gameplay/fortress`.
- Network protocol không trộn DOM.

### E6. UI/styles/core/data — các branch nhỏ

- Modals/components/theme/responsive/typography→`ui/`; naming theo primary export.
- `styles.css`→ordered `styles/{tokens,base,layout,components,gameplay,responsive}.css`; một `index.css` import order. Characterize cascade trước split.
- `tooltip.ts`: model building, formatting, DOM presentation.
- `unitDescriptionHelper.ts`: rename theo responsibility; không “Helper”.
- `unitCatalog.ts`: parsing/indexing/star-skill resolution; tránh speculative abstraction.
- `gameModes`→`game-modes` bằng LSP rename-file/import updates.
- Generated live files đổi `.temp.js`→`.generated.ts/js`; header `GENERATED—DO NOT EDIT`, generator command/provenance.

**Gate mỗi branch:** LSP diagnostics; typecheck; affected full directory tests nếu shared runtime; actual browser flow; merge dev; post-merge rerun; rồi delete branch.

## Phase F — Test layout

Branch `refactor/test-layout`.

1. Mirror source domains; xóa category `tests/three`.
2. Rename `threeX.test.*` theo canonical basename.
3. LSP/AST update imports; không redirects.
4. Gộp duplicate khi assert cùng observable contract.
5. Xóa source-text/comment/incidental wiring tests; giữ boundaries, invariants, transitions, layout equations, combat behavior, import graph, generated manifests.
6. Coverage include từ `src/**/*.js` sang thực tế TS/JS; giữ threshold 80%, không hạ để xanh.
7. Shared runtime mocks faithful; scan mọi object literal/`vi.mock` sau signature change.

**Done:** zero test prefix `three`; zero old import; discovery không duplicate; suites xanh.

## Phase G — Comments/cohesion/naming

Branch `refactor/source-hygiene`.

### G1. Comment rules

- Public API JSDoc khi contract, side effect, ownership/disposal, units, coordinates, failure behavior không hiển nhiên.
- File block chỉ cho boundary quan trọng; không lặp filename.
- Group comments chỉ chia lifecycle/phase thật.
- Inline comments chỉ reason/trap/invariant.
- Xóa date log/migration status/banner/“temporary” không exit condition.
- Compatibility comment cần owner + removal condition; nếu không, resolve code.

### G2. Cohesion

- Target source 200–400 dòng.
- >800 bắt buộc split hoặc documented exception cụ thể.
- Function >50 review; split nếu nhiều phases/transitions.
- Generated/data/vendor/test fixture exception có header source/generator.
- Không interface một implementation/factory một product.

### G3. Automated naming gate

- Validator PascalCase primary-class, camelCase function/data.
- Cấm active basename `Three*`; whitelist external `THREE`/historical docs only.
- Case-sensitive imports + existing `forceConsistentCasingInFileNames`.

**Done:** gate xanh; mọi >800 disposition/exception; runtime comments không còn migration noise.

## Phase H — Documentation governance

Branch `docs/repository-truth`.

### H1. README

Rewrite từ live code:
- Three.js stack; version authority duy nhất.
- pnpm setup/dev/typecheck/lint/targeted tests.
- Actual repository layout/architecture/data/generated/old_src policy.
- Actual URLs/deploy facts.
- Browser verification policy.
- Link docs map; zero removed path.

### H2. Handoff/status/migration docs

- Handoff/status tạm thời ở root đã được xoá khỏi HEAD; không tạo lại bản archive/duplicate vì Git history là archive.
- Trạng thái hiện tại chỉ nằm trong WBS/master plan hoặc canonical docs còn active; không duy trì append-only migration log.
- `docs/migration/final-replay.md` — moved 2026-09-22.
- `docs/migration/phaser-to-three.md` — moved 2026-09-22; sau cutover chỉ giữ decision/history cần thiết.
- Review matrix còn open gap→`docs/reviews`; gap đóng thì transfer durable rule, xóa matrix.

### H3. Generated docs

- Inventory/closure/census→`docs/generated`.
- Generator update atomic; header command+commit+policy; deterministic order; zero absolute paths.
- Regenerate lần hai phải no diff.

### H4. `.omp/plans`

- Một master active plan.
- `SOURCE IMPLEMENTED — verification pending` vẫn pending; merge rows về master nếu trùng.
- Verified plans→`done`; superseded plans xóa sau transfer unique decisions.
- WBS/agent index generated, không hand-edit.

### H5. Docs map/link gate

- `docs/README.md`: doc, owner, authority kind, generator, update trigger.
- Link checker paths/headings.
- Zero stale active references: `feature/threejs-migration`, `src/three`, removed `Three*.ts`, root status/handoff.

**Done:** README/package/source一致; one authority per topic; claims match executed evidence.

## Phase I — Scripts/assets/data

### I1. Scripts

- Group generate/verify/release/maintenance.
- `package.json` scripts verb:scope.
- Delete one-off migration scripts if output canonical and no maintained workflow.
- Maintained scripts validate inputs, nonzero failure, no personal paths.

### I2. Assets

- Build consumer manifest before rename/delete.
- Update imports/manifests/service-worker in same branch.
- New names lowercase kebab ASCII where safe; do not bulk rename Unicode media cosmetically.
- Delete orphan only if literal/dynamic/generated/SW scans all zero.

### I3. Data

- `data/` authored content; `src/data/` typed runtime API.
- `data/README.md`: schema/source/generator/validator.
- Do not move hundreds of item files for aesthetics; prioritize schema/manifest validation.

## Phase J — Mandatory tranche gate

1. Switch `dev`; fetch; fast-forward-only; clean tree.
2. Create `<type>/<scope>` branch.
3. Run smallest relevant baseline test; record result.
4. Move/rename via LSP `rename_file`; exported symbol via references+rename.
5. LSP diagnostics affected globs.
6. `pnpm run typecheck`; zero error hard gate.
7. ESLint affected files; no whole-repo formatting.
8. Targeted tests; shared runtime/infrastructure→full affected directory per `AGENTS.md`.
9. Generator/gate; second generation no diff.
10. Start Vite supervised; actual browser/computer-use, no Playwright harness.
11. Minimum browser: full page; Main Menu; new run; Planning shop/bench/drag; Combat; return Planning; Settings/Library if touched; mobile if layout touched.
12. Inspect console, pageerror, failed requests. Canvas-only black capture cannot decide.
13. Atomic commit; merge only green.
14. Post-merge typecheck + affected suite + affected browser flow.
15. Push `dev`; verify remote hash.
16. Delete feature branch local/remote only after post-merge PASS.
17. Gate failure: keep branch, fix source, never relax test/gate.

## Phase K — Final integration verification

### K1. Static/source

- Clean worktree.
- `old_src/` hash equals baseline.
- Exactly two branches; default `dev`.
- Zero stale branch references outside historical context.
- Zero active `Three*` files/symbol prefixes except `THREE` namespace/history.
- Zero Phaser dependency/import in live source/config/tests.
- Typecheck zero; lint zero.
- Import closure zero unresolved.
- Filename/case/link/generated determinism gates green.

### K2. Tests

- All affected suites per tranche.
- Final full repository suite because shared runtime changed broadly; worker count bounded for ~7GB RAM; browser not concurrent.
- Coverage only after TS include fixed and resources safe; threshold remains 80%.
- No mock-echo/source-text/bare-not-throw tests.

### K3. Browser/computer-use

- Desktop + mobile.
- Boot/menu/localization/settings/library.
- Start game; buy/reroll; bench/board drag; tooltip/context; start combat; action/result; next Planning.
- Multiplayer/fortress touched paths get matching flow or exact external prerequisite.
- Verify layout, overflow, assets, responsive touch targets, WebGL.
- Zero unexplained console/page/request failure.
- No Playwright project script; no build.

### K4. Documentation seal

- README commands proven.
- Links valid.
- Status claims only commands/browser actually run on final commit.
- Final replay records commit, browser, viewport, timestamp, evidence.
- Plan states correct.

## 6. Rollback policy

- Deleted branch: restore from external verified bundle.
- Merged regression: revert merge/atomic commit; never force-push `dev`.
- Rename failure: revert tranche; no permanent compatibility exports.
- Browser regression: do not merge/delete branch.
- Generated nondeterminism: fix ordering/time policy before commit.
- Dynamic asset uncertainty: keep + blocked record, never guess.
- Never rollback by mutating `old_src/` or reintroducing live Phaser.

## 7. Final acceptance

- Git: only `dev`, `archived/2D-Phaser`; default `dev`; feature branches deleted only after post-merge browser PASS.
- Runtime: Three-only; live Phaser dependency/import zero; archive preserved.
- Structure: source/tests/scripts/docs by domain; no `src/three`, `tests/three`, catch-all folder.
- Naming: filename follows primary export; no `Three` prefix; import case exact.
- Cohesion: every >800-line source split or justified; `RoundScene` no longer 7,473-line monolith; CSS has explicit cascade ownership.
- Docs: README truth; stale handoff gone; one short status; generated reports marked; one authority/topic.
- Comments: reason/invariant, not narration/status.
- Cleanliness: caches/temp/backups/proven orphans gone; live generated files named/headered correctly.
- Quality: TypeScript/lint/tests/browser gates green; build not claimed.
- Preservation: `old_src/` byte-identical; all deleted branch tips recoverable from bundle.

## 8. Nhật ký thực thi (evidence log)

### A1 — Snapshot

- Bundle: `/home/thaigo/backups/forest-throne-branches-20260921T172202Z.bundle` + `.sha256` + `.refs.txt`; `git bundle verify` PASS; tip mọi ref local (dev, archived/2D-Phaser, fix/typecheck-baseline, chore/*, tag backup/junk-audit-dev, stash-recover) verify OK; repository content không đổi.
- Cron `forest-throne-autopull.sh` đang PAUSED (crontab), không còn process `git pull` chạy.
- Invariant `old_src/`: `git rev-parse HEAD:old_src` = `f5cb17218b4cf4355ec47e35708751e3dcb59d48`, 340 tracked file. Mọi tranche sau phải giữ nguyên hash này.

### A2 — Archive 2D

- `archived/2D-Phaser` = `3d0fabf64fc9dd68b94303810a1edfe4a33b103c` — hash lịch sử của `origin/main` tại thời điểm snapshot (ghi trong bundle manifest `.refs.txt`); không dùng local `main` (khác hash).
- Push xong; `origin/archived/2D-Phaser` verify = `3d0fabf` ngay sau push. Vì `origin/main` đã bị prune, evidence equality là bundle manifest + output push, không phải so hai ref runtime. Không merge/rebase/cherry-pick vào archive.

### A3 — Hấp thụ migration vào dev

- `origin/feature/threejs-migration` (`f37a634`) là ancestor của `dev` (`merge-base --is-ancestor` PASS) ⇒ không merge giả, giữ nguyên tip `dev`.
- Local `dev` upstream đã trỏ `origin/dev`; GitHub default branch = `dev`; remote HEAD→`dev`.
- PR #1 (`feature/threejs-migration`→`main`) = CLOSED, lý do superseded-by-dev-ancestry.

### A4 — Audit/salvage branch thừa

Ba tip không-ancestor của `dev` (đã bị prune khỏi local/remote; object còn trong bundle user):

| Tip | merge-base với `dev` | commits ngoài `dev` | Bundle ref | Quyết định + lý do |
|---|---|---|---|---|
| `9a7b435` `feature/mobile-panel-ui` | `35f4832` | 4 | `refs/heads/feature/mobile-panel-ui` | Không port. Replacement surface đã có trên `dev`: `src/visuals/*` (gồm `visualRegistry.ts` mà branch này sửa), `scripts/sync-emoji-assets.mjs`, `src/generated/*.temp.js`. Không có consumer live còn thiếu. |
| `186e5e8` `feat/remove-discord-sdk` | `4adf0ac` | 5 | `refs/remotes/origin/feat/remove-discord-sdk` | Không port. Discord Activity vẫn là product surface: `src/platform/discordActivity.ts` vẫn là product surface qua `src/main.ts`, legacy `src/scenes/MainMenuSocialDonate.ts` và live `src/three/ThreeMenuExtrasModal.ts`; dead `src/three/ThreeMainMenuSocialDonate.ts` đã bị xoá 2026-09-22 sau khi QR builder chuyển vào `src/core/donateQr.ts`. |
| `ed846ba` `make3D` | `5d65d76` | 34 | `refs/remotes/origin/make3D` | Không port. Prototype 3D 2026-03 (`src/world/Board3D.js`, `Camera3D.js`, `Environment3D.js`…) đã bị thay bằng runtime `src/three`; không có contract live thiếu. |

Verdict: không tạo `salvage/*`; ba tip giữ trong bundle verified + hash ghi ở trên. Sau bước này local còn `dev`, `archived/2D-Phaser`, `fix/typecheck-baseline`, `chore/repository-artifact-cleanup` và tag `backup/junk-audit-dev`, `stash-recover`; trạng thái “chỉ còn 2 branch” (§0/§1.4) chỉ đạt sau browser post-merge PASS + xóa tranche branch ở Phase J/K.

### C1 — Artifacts

- Xóa `.vitest-ls.json`, `.shm`, `.wal`, `dist/`, `_tmp/`; giữ ignore rule trong `.gitignore`. Kiểm tra lại: cả 5 path đều absent.
- `git ls-tree -r dev` không còn artifact `*.log|*.tmp|*.orig|comp-bak|hard-bak|atomic-bak|.vitest-ls` ngoài `old_src/**` (protected, không đụng).
- Không xóa `src/generated/*.temp.js` (live generated source).

### C2 — Root/config

- Consumer của `tsconfig.cs-check.json`, `tsconfig.library-check.json`, `tsconfig.planning-input-check.json`: `git grep` toàn tracked (trừ `old_src/`) chỉ match chính dòng mô tả trong WBS này; không có `.github/workflows`; `package.json` scripts không tham chiếu. ⇒ zero consumer ⇒ xóa 3 file (không move sang `config/typescript/`).

### C3 — Duplicate plan HTML

- Authority: `.omp/plans/wbs.html` là source hand-authored (không có marker generated) → `public/wbs.html` chỉ là stub `<meta http-equiv="refresh">` trỏ `https://forest-throne-wbs.devgovietnam.io.vn/wbs.html`; hai file không trùng nội dung nên không có bản sao hand-edited để xóa.
- Generated: `.omp/plans/custom/html/<slug>-plan.html` + `agent-index.html` sinh từ markdown trong `.omp/plans/pending/` bằng hook `.omp/hooks/pre/plans-sync.ts`; markdown là source.
- Kiểm live 2026-09-22: WBS public từng trả HTTP 502 nên runtime equality chưa được assert; handoff cũ chứa claim sai về symlink đã được xoá theo cleanup policy.

### B1 — Inventory toàn repo

- Phương pháp: `git ls-files` mặc định quote path non-ASCII ⇒ mọi inventory phải dùng `git -c core.quotePath=false ls-files` (hoặc `-z`). Nhóm `"public` (21 path) trong lần đo trước là artifact quote, không phải thư mục — số liệu dưới đây đã sửa.
- Tracked 2646 path = live 2306 + protected `old_src/` 340 (`f5cb17218b4cf4355ec47e35708751e3dcb59d48`). Phân bố live: `data` 1001, `src` 425, `tests` 407, `.omp` 334, `public` 96, `scripts` 20, `docs` 6, root 17.
- Source graph: resolve static import/export cho 417 file `src/**/*.{ts,tsx,js}`; specifier TS trỏ `.js` cho source `.ts` nên mọi lookup phải extension-insensitive (stem × `.ts/.tsx/.js`, kể cả `.js`→`.ts` swap). Dynamic: `import.meta.glob("/data/items/**/*.js")` (`src/data/items.ts:91`), `data/units/*.js|*/index.js` + `./skins/**/*.js` (`src/data/unitCatalog.ts:60`), `import.meta.glob("../../src/three/**/*.ts")` trong `tests/three/sceneImportGraph.test.js`.
- Orphan evidence: 197/407 test “no-consumer” là false positive (vitest entrypoint); 809 file `data/**` no-consumer là dynamic-glob ⇒ giữ. Chỉ 101 file vượt được cả static + symbol + asset/route test — đã xóa ở `f8356c0`; plan audit riêng đã hoàn tất và được dọn khỏi HEAD.
- Asset graph: `public/` 96 tracked; asset zero static ref vẫn giữ khi thuộc runtime route (`src/core/sharedAssetLoader.ts`), CSS URL (`src/styles.css`), `public/_headers`, service worker. Live generated source: `src/generated/{audioTrackIndex,tributeGallery}.temp.js` (C1: không xóa).
- Script/config graph: 43 → 20 script sau junk-audit; không có `.github/workflows`. **Finding (I-candidate):** `package.json` script `deploy` = `bash deploy/deploy-ssh.sh` nhưng path `deploy/` không tồn tại và chưa từng tracked ⇒ command dangling, phải xử ở Phase I.
- Docs authority: source = markdown `.omp/plans/{pending,done}/` + `.omp/plans/wbs.html` (hand-authored); generated = `.omp/plans/custom/html/*.html` qua hook `.omp/hooks/pre/plans-sync.ts`. Report generated tracked: `docs/three-import-closure.json`, `docs/three-migration-inventory.md`. Report generated **chưa từng tracked**: `docs/three-feature-census.{md,json}`, `docs/three-asset-consumption-census.{md,json}` — không doc/test nào tham chiếu, tái tạo bằng `pnpm census:three-features` / `pnpm census:three-assets` ⇒ quyết định: **không commit**, chỉ chạy tại gate. Hand-authored: `docs/migration/phaser-to-three.md`, `docs/migration/legacy-feature-animation-census.md`, `docs/migration/final-replay.md`, `docs/reviews/phase-2-review-matrix.md`.
- Report drift (đo, không overwrite): regenerate closure + inventory cho diff `docs/three-import-closure.json` 49+/22-, `docs/three-migration-inventory.md` 6+/7- so với tracked; nguyên nhân là commit `438c8ba`/`a51213a` thêm import `src/core/runState.ts`→`src/data/techTree.ts`, `src/i18n/index.ts`, `src/three/ThreeLoadingScene.ts` và đổi nhãn authority `phaser-or-shared`→`shared-core`. Working tree đã restore bằng `git checkout --` (audit pass không mutate); việc regen + commit thuộc D3 (“Regenerate closure”) và H.

### B2 — DAG thay đổi

- Rename map: 128 module `Three*` trong `src/three` (139 file `.ts`); 12 file không prefix: `index.ts`, `types.ts`, `VoxelPrototypeAnimalsData.ts`, `VoxelSpiderGeometry.ts`, 7 scenery `Green*.ts`, `README.md`.
- Destination sau khi bỏ prefix: **0 trùng trong nội bộ `src/three`** (`inThreeDestTaken` rỗng).
- Collision map với phần còn lại của live tree: **55** basename collision (case-insensitive). Chia theo bằng chứng importer:
  - **36 giải quyết bởi Phase D** — không có importer `src/three` nào, consumer chỉ ở `src/scenes/**` hoặc `src/ui/**` legacy (`ThreeCombatScene`><`src/scenes/CombatScene.ts`, `ThreePlanningScene`><`src/scenes/PlanningScene.ts`, `ThreeLoadingScene`><`src/scenes/LoadingScene.ts`, `ThreeMainMenuScene`, `ThreeLibraryModal`><`src/ui/LibraryModal.ts`, …). ⇒ **D phải chạy trước E1/E2**.
  - **19 tồn tại sau D** (counterpart thuộc root renderer-neutral được D giữ, hoặc đã có importer `src/three`): `ThreeCombatQueue`><`src/core/combatQueue.ts`, `ThreeEmojiAtlas`><`src/core/emojiAtlas.ts`, `ThreeEmojiIcon`><`src/core/emojiIcon.ts`, `ThreeFortressMode`><`src/core/fortressMode.ts`, `ThreeFxPool`><`src/core/fxPool.ts`, `ThreeGameConfig`><`src/core/gameConfig.ts`, `ThreeGameModeRuntime`><`src/core/gameModeRuntime.ts`, `ThreeGameSpeed`><`src/core/gameSpeed.ts`, `ThreeGamepadController`><`src/core/GamepadController.ts`, `ThreeItems`><`src/data/items.ts`, `ThreeKeyboardBindings`><`src/core/keyboardBindings.ts`, `ThreePvpFortress`><`src/network/pvpFortress.ts`, `ThreeSceneEquipmentRuntime`><`src/scenes/shared/sceneEquipmentRuntime.ts`, `ThreeShopSystem`><`src/systems/ShopSystem.ts`, `ThreeStarVisualEffectFactory`><`src/visuals/starVisualEffectFactory.ts`, `ThreeTechTree`><`src/data/techTree.ts`, `ThreeUiResponsive`><`src/core/uiResponsive.ts`, `ThreeUpgradeSystem`><`src/systems/UpgradeSystem.ts`, `ThreeVfx`><`src/core/vfx.ts`. Mỗi case phải nhận disposition tường minh trong tranche sở hữu (xóa counterpart nếu proven dead, hoặc đặt tên theo responsibility) — không để trùng basename ngầm.
- Destination duy nhất được assert ở mức path: `src/app/**`, `src/rendering/{engine,board,terrain,effects,units}/**`, `src/gameplay/{planning,combat,coop,fortress}/**`, `src/ui/**` — không path nào trong 55 case trùng path đích.
- Thứ tự lock: **(1) merge thin wrappers → (2) D xóa Phaser → (3) E1→E6 → (4) F test layout → (5) G/H docs**. Lý do cứng: uniqueness basename (trên) + wrapper phải trỏ target cuối trước khi rename.
- Thin wrapper (pure re-export, 0 logic) — branch `refactor/merge-thin-wrappers` chạy trước D: `ThreeEmojiIcon`→`src/core/emojiIcon.ts`, `ThreeFortressMode`→`src/core/fortressMode.ts`, `ThreeGameModeRuntime`→`src/core/gameModeRuntime.ts`, `ThreeItems`→`src/data/items.ts`, `ThreePvpFortress`→`src/network/pvpFortress.ts`, `ThreeShopSystem`→`src/systems/ShopSystem.ts`, `ThreeTechTree`→`src/data/techTree.ts`, `ThreeUpgradeSystem`→`src/systems/UpgradeSystem.ts`. Mọi wrapper đều còn consumer live (src và/hoặc tests: `ThreeItems` 4, `ThreeEmojiIcon` 2+`index.ts`+2 test, `ThreeShopSystem` 2+test, `ThreeTechTree` có `ThreePlanningTechRuntime`+test, `ThreeFortressMode` có `ThreeFortressMapScene`+test, `ThreeGameModeRuntime` có `ThreeCoopLobbyScene`+test, `ThreeUpgradeSystem`/`ThreePvpFortress` có `ThreePlanningShopActionsRuntime`/`ThreePvpFortressRuntime`) ⇒ không xóa trực tiếp: trỏ consumer sang canonical rồi xóa shim.
- `src/three/index.ts` barrel: 0 consumer live trong `src/` ⇒ E1 shrink + xóa (đúng E1); không tạo barrel mới.
- Caller migration list: importer map (src/tests) đã dựng cho toàn bộ 417 file `src`; mỗi tranche phải re-derive bằng LSP `references`/`rename_file`, không dùng text-replace.
- Cycle: closure generator **không có** cycle detector (`grep -n cycle scripts/generate-three-import-closure.mjs` chỉ ra nhãn tier). Rủi ro cycle do E-move chỉ được chặn bằng `tests/three/sceneImportGraph.test.js` (assert không có runtime import ngược scenes↔three) + guard init-cycle trong `vite.config.js:38-43` (`/data/units/`, `/src/data/` phải cùng chunk `game-data`) ⇒ mọi tranche relocate `src/data/*` hoặc đổi glob `data/**` phải rerun test đó + `inventory:three-closure:gate`.

### W1 — Merge thin wrappers (branch `refactor/merge-thin-wrappers`)

- Phạm vi: xóa wrapper mỏng dead/alias-only và trỏ consumer về canonical. Commit `a33cdf2` — `git show --name-status a33cdf2` có đúng **8** dòng `D`: `ThreeEmojiIcon`, `ThreeFortressMode`, `ThreeGameModeRuntime`, `ThreeItems`, `ThreePvpFortress`, `ThreeShopSystem`, `ThreeTechTree`, `ThreeUpgradeSystem`; phần còn lại của commit là 15 file `src/three/*` + 16 file `tests/three/*` sửa import, `scripts/generate-three-import-closure.mjs`, docs (`phaser-three-migration-rule.md`, `three-migration-inventory.md`, `three-import-closure.json`), `public/assets/ui/icons/README.md`. `417080c` — 3 runtime `ThreeDamageAftermathRuntime`, `ThreeHealUnitRuntime`, `ThreeStatusTurnRuntime`; `6bcd1bd` — `ThreeGameSpeed`.
- Caller migration: `ThreePlanningShopActionsRuntime.ts:21` → `../core/gameSpeed.js`; 3 test (`threeCombatFlow.test.ts`, `threeGameSpeed.test.js`, `threeMobileE2EFullFlow.test.js`) → `../../src/core/gameSpeed.js`; `ThreeCanonicalCombatActionRuntime.ts:44-49` → `../core/combatDamageAftermath.js`. Class `ThreeGameSpeed` xác nhận dead (0 `new`, 0 export barrel) trước khi xóa.
- Parity test: không để lại arm tự-so-với-chính-nó. `threeHealUnitRuntime.test.js` / `threeStatusTurnRuntime.test.js`: xóa arm shim, giữ arm canonical (7 và 11 case hành vi — `grep -c -E "^\s*(it|test)\("`, không trùng ở `tests/scenes|shop|units`); `threeDamageAftermathParity.test.ts` repoint import canonical.
- Gate (chạy trên branch, HEAD `6bcd1bd`):
  - `pnpm exec tsc --noEmit` = **0**.
  - `pnpm run lint` = `376 problems (0 errors, 376 warnings)`, trùng khít baseline (`/tmp/ft-base-wraps` @ `0f97972`: 376/0, diff log chỉ khác dòng pnpm/node warning). Lưu ý: `eslint.config.js:29` chỉ `files: ["**/*.js","**/*.mjs","**/*.cjs"]` ⇒ **`.ts` không được eslint phủ**; xác nhận TS chỉ dựa `tsc`.
  - `inventory:three-migration` + `inventory:three-closure` regenerate sạch: 404 candidates (374 reachable), 1972 edges, 56 routes, **16 unresolved references**, 4 unresolved module (`ThreeCombatScene`, `ThreeKeyboardBindings`, `ThreePlanningScene`, `ThreeStarVisualEffectFactory`) — **giống hệt** tập unresolved đo tại `a33cdf2` ⇒ pre-existing, không do tranche.
  - Test ảnh hưởng: `tests/three` baseline-diff 109 vs 109 fail (tập file trùng khít trước/sau `417080c`); 3 file đổi import (`threeCombatFlow`, `threeGameSpeed`, `threeMobileE2EFullFlow`) baseline-diff bằng stash tại cùng HEAD: **cùng 3 fail**, không fail mới; `threeMobileE2EFullFlow` fail thuộc `tests/three` baseline 109.
  - Runtime probe (KHÔNG thay thế browser gate): Vite dev server 5173 transform 200 cho `ThreePlanningShopActionsRuntime.ts` (body trỏ `"/src/core/gameSpeed.ts"`), `core/gameSpeed.ts`, `three/index.ts`, `ThreeCanonicalCombatActionRuntime.ts`; `GET /src/three/ThreeGameSpeed.ts` fallback về `index.html` ⇒ wrapper xóa đã có hiệu lực trong tree đang serve.
- Browser/computer-use gate (§J11/J14): **UNVERIFIED**. Tool `browser` hỏng trong session này: `Browser open timed out after 120000ms`, `Navigating frame was detached`, `Failed to clear browser request interception after browser.run` (tab bị kill). Đã thử reset daemon headless + URL tunnel public đều không qua được lớp interception; theo §J không dùng Playwright harness. Vì gate này chưa đạt: **branch `refactor/merge-thin-wrappers` được giữ, không xóa (§J16), chưa FF vào `dev`**.
- Branch topology: 2 commit trên đã lỡ land trực tiếp `dev` → sửa bằng `git branch -f refactor/merge-thin-wrappers 6bcd1bd; git switch refactor/merge-thin-wrappers; git branch -f dev a33cdf2` ⇒ `dev` = `a33cdf2`, tranche nằm đúng branch riêng.
- Invariant: `git rev-parse HEAD:old_src` = `f5cb17218b4cf4355ec47e35708751e3dcb59d48` ⇒ `old_src/` nguyên vẹn ở cả hai commit.

### W2 — Merge `refactor/merge-thin-wrappers` + `fix/tech-fit-button-alignment` vào `dev`

- Input: `dev` @ `a33cdf2`; FF lên `08392c3` (tranche W1); merge `fix/tech-fit-button-alignment` (`410fef8`, chỉ `src/three/ThreePlanningTechRuntime.ts`) → merge commit `c25248f`.
- Disjoint: 19 file tranche vs 1 file fix, **0 overlap** (`comm` xác nhận) ⇒ không conflict, không mất diff nào.
- Gate sau merge (HEAD `c25248f`):
  - `pnpm exec tsc --noEmit` = **0**.
  - `pnpm run lint` = `376 problems (0 errors, 376 warnings)` (`.ts` không được eslint phủ — xem W1).
  - `inventory:three-migration` + `inventory:three-closure` = 404 candidates (374 reachable), 1972 edges, 56 routes, **16 unresolved references** + 4 unresolved module — **giống hệt** `a33cdf2`, pre-existing.
  - Test ảnh hưởng (8 file, pre-merge baseline `/tmp/merge-pre.json` @ `a33cdf2` so `/tmp/merge-post.json` @ `c25248f`): cùng **5 fail / tập tên trùng khít** (`diff` rỗng). Pass 62 → 44 là do tranche gỡ arm shim trùng: `threeHealUnitRuntime` 14→7, `threeStatusTurnRuntime` 22→11 (mỗi case còn đúng 1 arm canonical, không mất case hành vi).
- Browser/computer-use gate (§J11/J14): vẫn **UNVERIFIED** (tool `browser` hỏng — 3 lỗi ở W1). Không dùng Playwright harness (§AGENTS). Hệ quả: `refactor/merge-thin-wrappers` **không xóa** (§J16).
- Invariant: `git rev-parse HEAD:old_src` = `f5cb17218b4cf4355ec47e35708751e3dcb59d48` (giữ nguyên sau merge).

### W3 — Three-only boot + canonical-owner/doc governance pass (2026-09-22 15:56 +07:00)

- Production bootstrap:
  - `src/main.ts` không còn runtime `?engine=phaser`, `initGame`, `shouldBootPhaser` hay dynamic `import("phaser")`.
  - `vite.config.js` không còn Phaser-specific optimize/chunk path cho production boot.
  - `tests/core/mainBootstrap.test.js` và `tests/three/threeBootStaticGraph.test.ts` đã đổi contract sang Three-only. Runner chưa có trong connector session ⇒ **UNVERIFIED**, không claim PASS.
- Canonical-owner cleanup:
  - xóa `src/three/ThreeUiResponsive.ts`; caller/test/barrel trỏ `src/core/uiResponsive.ts`.
  - xóa `src/three/ThreeCombatQueue.ts`; parity test co lại thành canonical queue contract.
  - xóa `src/three/ThreeKeyboardBindings.ts`; live Planning/test/barrel trỏ `src/core/keyboardBindings.ts`.
  - bỏ alias `createPhaserGameConfig` khỏi `ThreeGameConfig.ts`.
- Settings/audio:
  - `audioMuted` trở thành canonical `UiSettings`.
  - `ThreeSoundEffects` không còn storage riêng `forest-throne.audio.*`; enable/mute/volume persist qua `forest_throne_ui_settings_v1`.
- Docs/root:
  - `README.md` rewrite Three-only + pnpm + current layout/authority.
  - package name đổi từ `forest-throne-phaser` → `forest-throne-classic`; xóa script `deploy` dangling.
  - tạo `docs/README.md`; move hand-authored migration/review docs vào `docs/migration/` và `docs/reviews/`.
- Plan remediation:
  - master plan còn 11 checkbox `[ ]`; remediation source cases chuyển `[~]` và giữ runtime/browser gates mở.
  - thêm regression source tests cho offense-debuff auto-by-role và tutorial canonical offers/state.
- Branch topology:
  - GitHub compare xác nhận `refactor/merge-thin-wrappers@08392c3` và `fix/tech-fit-button-alignment@410fef8` đều là ancestor của `dev` (behind=0 theo hướng branch→dev).
  - connector không expose delete-ref; vì vậy target “chỉ còn dev + archived/2D-Phaser” chưa thể hoàn tất trong session này.
- Protected invariant: không có write/delete nào dưới `old_src/**`.

## W4 — Canonical equipment mutation owner (2026-09-22 22:12 +07:00)

- Moved equip / unequip-all / single-unequip validation and mutation semantics into `src/scenes/shared/sceneEquipmentRuntime.ts`.
- `src/three/ThreeRoundScene.ts` and affected Three tests now import the shared canonical owner directly.
- Deleted duplicate `src/three/ThreeSceneEquipmentRuntime.ts`; no replacement wrapper was introduced.
- Rejection semantics are now atomic even when pre-existing `unit.equips` requires normalization; regression coverage was added for byte-identical rejected state.
- Static source readback completed. Targeted Vitest/typecheck/build/browser remain **RE-RUN REQUIRED** because this session has no runnable checkout/browser.
- Generated `docs/three-migration-inventory.md` remains stale until the generator can be rerun; do not hand-edit its counts/content.
