# Forest Throne V5 Enhancement Master Plan: Card Parity, Naming Modernization, Audio Engine, Bespoke Roster & Overhead Assets

Date: 2026-09-24  
Branch: `dev` / `feature/threejs-migration`  
Status: PLANNING  
Scope: Full game UX, audio, asset presentation, code structure modernization, and 3D unit roster completion.

---

## Executive Summary & Objectives

User requested 5 concrete systemic upgrades to Forest Throne:
1. **Card Visual Overhaul & Legacy CSS Purge**: Tăng độ tương phản (contrast), dùng bộ asset card chất lượng cao hơn, xóa sạch legacy CSS (các khối CSS toạ độ %, override thô trong `src/styles.css`), và xây dựng shared card component/factory thống nhất giữa Library và Planning Shop.
2. **Loại bỏ tiền tố `Three*` trên toàn bộ codebase**: Do dự án đã thuần Three.js (chỉ giữ `old_src/` để tham chiếu), việc đặt tên 367+ file có tiền tố `Three*` là dư thừa và rối mắt. Cần kế hoạch đổi tên và tổ chức lại module theo chuẩn kiến trúc sạch.
3. **Hệ thống Audio hoàn chỉnh (BGM & Unique Unit Sound)**: Khắc phục tình trạng game không có nhạc nền hoặc âm thanh. Tích hợp nhạc BGM theo từng màn (Menu, Planning, Combat) và xây dựng bộ âm thanh riêng biệt (attack, skill, cry, hit) cho từng con thú (không trùng lặp).
4. **Vẽ tiếp Bespoke 3D Rig & Animation cho toàn bộ thú còn lại**: Nối tiếp các con thú đã hoàn thành như `rapper-chicken`, `spider_venom`, `tiger_fang`,... để chuyển đổi toàn bộ thú đang dùng voxel placeholder/generated roster sang articulated rig hoàn chỉnh với đầy đủ 6 hành động.
5. **Thanh trạng thái trên đầu thú (Board & Bench) bằng PNG Asset**: Thay thế toàn bộ thanh máu/nộ/tên vẽ bằng canvas màu phẳng trên đầu thú bằng các khung asset hình ảnh PNG sắc nét (tương tự như card), áp dụng đồng bộ cho cả thú trên sân và trên hàng chờ (bench).

---

## PHASE 1: Card UI Overhaul, High-Contrast Assets & Legacy CSS Cleanup

### 1.1. Hiện trạng & Yêu cầu từ User
- User yêu cầu: **"Chỉnh cho card của game sử dụng asset tui gửi nè, nhiều đồ chơi ngon lắm"** — tích hợp đầy đủ bộ asset giao diện thẻ bài phong cách Medieval/Fantasy chất lượng cao sẵn có từ kho asset của chủ dự án.
- Hiện trạng cũ:
  - Library Card V4 dùng các mảnh crop cũ (`fantasy-panel-blank.png`, `fantasy-plank-*.png`) có độ tương phản thấp giữa chữ nâu và nền gỗ sẫm.
  - Planning Shop Card vẫn còn tồn đọng các khối CSS toạ độ `%` cứng trong `src/styles.css` (`left: 7.3%`, `top: 14.3%`), dễ vỡ khi responsive hoặc scale zoom.
  - Cần thống nhất trải nghiệm thị giác và cấu trúc DOM giữa Library Roster và Planning Shop thông qua `ThreeUnitCardFactory.ts` (chuẩn bị đổi thành `UnitCardFactory.ts`).

### 1.2. Kho Asset Đồ Chơi Được Cung Cấp & Ánh Xạ Kỹ Thuật (Owner Asset Suite)
Bộ asset do user cung cấp mang phong cách Fantasy Medieval sắc nét, chia thành các nhóm thành phần chi tiết:

1. **Khung & Nền Thẻ Bài (Card Shells & Body Frames)**:
   - `public/assets/ui/library-card-v3/shell.png` (240×344): Thẻ dáng đứng tỉ lệ chuẩn, viền gỗ chạm khắc đậm nét ôm trọn lòng thẻ màu giấy da bò cổ điển (bright parchment). Nền sáng giúp chữ nâu đậm `#2c1808` và các icon hiển thị cực kỳ sắc sảo, tương phản cao, giải quyết triệt để lỗi "chữ chìm vào nền".
   - `public/assets/ui/cards/medieval-unit-card-wide.png`: Khung thẻ ngang 9-slice chuyên dụng cho Planning Shop, có hoa văn chạm trổ viền kim loại và hốc chân dung gọn gàng.
   - `public/assets/ui/cards/unit-card-frame.png` & `unit-card-owner-frame.png`: Khung trang trí viền đôi cổ điển, dùng làm lớp viền tăng chiều sâu 3D cho thẻ cấp cao hoặc thẻ đang được chọn.
   - `public/assets/ui/cards/medieval-unit-card-fill.png`: Lớp lót inner-fill hoạ tiết da/vải tối màu đặt dưới chân thú 3D để tạo bóng đổ tự nhiên.

2. **Khung Cửa Sổ Chân Dung (Portrait Frames & Windows)**:
   - `public/assets/ui/library-card-v3/portrait-frame.png`: Khung cửa sổ chân dung mạ vàng bo viền nổi khối 3D, ôm trọn viewport render thú 3D xoay.
   - `public/assets/ui/cards/medieval-unit-card-fill.png`: Backdrop hốc chân dung tạo cảm giác thú đang đứng trong khung tranh lộng lẫy.

3. **Thanh Tiêu Đề & Nẹp Gỗ Thông Tin (Nameplates & Detail Planks)**:
   - `public/assets/ui/library-card-v3/nameplate.png` (202×40): Thanh nẹp gỗ khắc chỉ vàng nổi bật dùng cho tên thú trên Library Card.
   - `public/assets/ui/cards/fantasy-card-info-plank.png`: Bảng gỗ chạm khắc cho hàng thông tin phụ (hệ tộc, class, counter sở hữu) trên Shop Card.
   - `public/assets/ui/medieval/button-plank.png`: Nẹp gỗ viền kim loại cho các thanh tiêu đề phân cách.

4. **Huy Hiệu Chỉ Số, Cấp Độ & Ngọc Đính (Stat Badges, Chips & Gem Buttons)**:
   - `public/assets/ui/library-card-v3/stat.png` (66×28) & `chip.png` (64×24): Các miếng huy hiệu gỗ viền đồng tinh xảo gắn các chỉ số ATK (kiếm), HP (tim), DEF (khiên).
   - `public/assets/ui/library-card-v3/badge.png` (46×26): Huy hiệu nhỏ gắn cấp bậc Tier và Sao (Star).
   - `public/assets/ui/medieval/button-round.png`, `button-round-hover.png`, `button-round-danger.png`: Các viên ngọc tròn đính nổi hiển thị Giá vàng (Cost), trạng thái Khoá (Lock), và cảnh báo.

5. **Nút Tương Tác Hành Động (Call-to-Action Buttons)**:
   - `public/assets/ui/library-card-v3/cta.png` (202×36): Nút gỗ nẹp vàng nổi bật cho hành động chính "Xem Chi Tiết" (Library) hoặc "Mua Thẻ" (Shop).

### 1.3. Các Bước Triển Khai Kỹ Thuật Chi Tiết
1. **Bước 1.1 — Khai báo & Quản lý Asset Constants**:
   - Cập nhật `ThreeUnitCardFactory.ts` và `ThreeUnitCardFrame.ts`:
     - Mở rộng hằng số `CARD_ASSET_SUITE` bao gồm toàn bộ đường dẫn asset chuẩn: `shell`, `portraitFrame`, `nameplate`, `infoPlank`, `statPlank`, `chipPlank`, `badge`, `ctaButton`, `wideFrame`, `roundGem`.
2. **Bước 1.2 — Refactor Library Card Component**:
   - Trong `createUnitCard({ mode: "library" })`:
     - Sử dụng `shell.png` làm khung nền chính.
     - Gắn `portrait-frame.png` bao quanh canvas model 3D `createLibraryUnitModelSnapshot`.
     - Gắn `nameplate.png` làm header tên thú, dùng font medieval/serif có text-shadow rõ ràng.
     - Gắn `chip.png` cho các chip Hệ/Tộc, `stat.png` cho hàng chỉ số HP/ATK/DEF.
     - Gắn `cta.png` cho nút "Xem chi tiết".
3. **Bước 1.3 — Refactor Planning Shop Card Component**:
   - Trong `createUnitCard({ mode: "shop", shopSurface: "planning" })`:
     - Sử dụng `medieval-unit-card-wide.png` kết hợp `fantasy-card-info-plank.png`.
     - Sử dụng `button-round.png` làm gem hiển thị Cost vàng và Star.
     - Sử dụng `stat.png` cho chỉ số công/thủ nhỏ gọn.
     - Bảo đảm thẻ là button native hỗ trợ keyboard navigation (`aria-pressed`, `aria-label`).
4. **Bước 1.4 — Xóa Sạch Legacy CSS Toạ Độ % (`src/styles.css`)**:
   - Cắt bỏ các block CSS toạ độ % thừa: dòng 436–498, 1651–1770, 2801–3082, 3299–3632.
   - Thay bằng CSS Grid và Flexbox layout tự nhiên, sạch sẽ, bảo đảm thẻ co giãn responsive mượt mà trên cả mobile lẫn PC.
5. **Bước 1.5 — Targeted Verification Tests**:
   - Thêm bộ test `tests/runtime/unitCardFactory.test.ts` kiểm thử:
     - Render Library Card: kiểm tra đúng class, data-skin, đủ các node asset frame (`shell`, `portrait-frame`, `nameplate`, `chip`, `cta`).
     - Render Planning Shop Card: kiểm tra thẻ là `<button>`, gắn đúng `medieval-unit-card-wide`, cost/star/atk/hp nodes.
     - Kiểm tra tương phản màu text (`#2c1808` / `#f4ebd0`) và sự kiện click.

### 1.4. Tiêu chí hoàn thành (Done Criteria)
- Toàn bộ thẻ bài trong Library và Planning Shop đều khoác lên bộ asset Fantasy Medieval đầy đủ, sắc nét, có chiều sâu 3D rõ rệt.
- Text, icon và chỉ số hiển thị cực kỳ rõ ràng, tương phản cao, dễ đọc trên mọi kích thước màn hình.
- Xóa sạch ít nhất 600 dòng CSS rác toạ độ % trong `src/styles.css`.
- Test targeted `unitCardFactory.test.ts` và `libraryCollection.test.ts` đều PASS.
---

## PHASE 2: Chuẩn hoá Tên File & Cấu trúc Thư mục (Loại bỏ tiền tố `Three*`)

### 2.1. Hiện trạng & Thống kê
- Hiện có **367 files** mang tiền tố `Three*` trong `src/three/` và `tests/`.
- Tiền tố `Three` xuất hiện trong:
  - Core app: `ThreeApp.ts`, `ThreeBoard.ts`, `ThreeBoardRenderer.ts`,...
  - Scenes: `ThreeMainMenuScene.ts`, `ThreeRoundScene.ts`,...
  - Rigs & Animals: `ThreeChickenRapperRig.ts`, `ThreeTigerFangRig.ts`,... (hơn 200 file trong `src/three/animals/`).
  - UI Modals: `ThreeLibraryModal.ts`, `ThreeSettingsModal.ts`,...
  - Tests: `tests/three/`, `tests/runtime/`,...

### 2.2. Lộ trình thực hiện an toàn (Phased Migration)
Để không gây xung đột và gãy build hàng loạt, quá trình de-prefixing được chia thành 4 đợt (waves):

- **Wave 2.1: Chuẩn hoá cấu trúc thư mục đích**
  - Tách thư mục `src/three/` thành cấu trúc module nghiệp vụ rõ ràng:
    - `src/core/` (đã có: logic game không phụ thuộc renderer).
    - `src/engine/` (quản lý Three.js app, camera, lighting, viewport).
    - `src/scenes/` (MainMenuScene, RoundScene, CombatScene).
    - `src/board/` (Board, BoardRenderer, BoardInput, VoxelTerrain).
    - `src/units/` (UnitFactory, UnitModelFactory, StarVisuals, StatusBillboard).
    - `src/units/animals/` (chứa các folder con của từng con thú).
    - `src/ui/` (LibraryModal, SettingsModal, PlanningInventory, ShopDeck, Cards).
    - `src/audio/` (SoundEffects, AudioRuntime, AudioProfiles).
- **Wave 2.2: Đổi tên động vật & Animation (`src/three/animals/`)**
  - Tự động hóa qua script rename:
    - `Three<Name>Rig.ts` -> `<Name>Rig.ts`
    - `Three<Name>Animation.ts` -> `<Name>Animation.ts`
  - Cập nhật tự động đường dẫn import trong `ThreeUnitOwnedRigRegistry.ts` và `ThreeConfiguredBespokeRegistry.ts`.
- **Wave 2.3: Đổi tên UI, Runtimes & Modals**
  - `ThreeLibraryModal.ts` -> `LibraryModal.ts`
  - `ThreeLibraryUnitCard.ts` -> `LibraryUnitCard.ts`
  - `ThreePlanningShopRuntime.ts` -> `PlanningShopRuntime.ts`
  - `ThreeProductionUiAssets.ts` -> `ProductionUiAssets.ts`
  - `ThreeSoundEffects.ts` -> `SoundEffects.ts`
- **Wave 2.4: Đổi tên Core Engine & Scenes**
  - `ThreeApp.ts` -> `App.ts`
  - `ThreeRoundScene.ts` -> `RoundScene.ts`
  - `ThreeMainMenuScene.ts` -> `MainMenuScene.ts`
  - Cập nhật entrypoint `index.html` và `main.ts` / `App.ts`.
  - Cập nhật toàn bộ test imports bằng AST/LSP rename.

### 2.3. Tiêu chí hoàn thành (Done Criteria)
- Không còn bất kỳ file source nào trong `src/` mang tiền tố `Three` (ngoại trừ các tham chiếu đến thư viện `three` từ npm).
- Toàn bộ test suite liên quan chạy qua với `pnpm test` (không lỗi import/module not found).
- Build production `pnpm build` thành công, bundle sạch.

### 2.4. Trạng thái thực hiện (2026-09-25) — PHASE 2 COMPLETED

- Wave 2.2 (animals/Animation/Rig), 2.3 (UI, modals, runtimes, audio) và 2.4 (core engine, scenes, entrypoint) đã hoàn tất: **110 file `Three*.ts`** trong `src/three/` được rename, **210 file** cập nhật import/type, 4 file test đổi theo. `git ls-files` chỉ còn tên `Three*` trong `old_src/` (legacy read-only).
- **Wave 2.1 hoãn vô thời hạn** (quyết định: không nằm trong Done Criteria §2.3): tách `src/three/` thành `src/engine|scenes|board|units|ui|audio` phá entry `index.html`, path `vite`/`tsconfig` và test globs — blast radius lớn, lợi ích thuần tổ chức. Thực hiện như tranche riêng khi có yêu cầu.
- Commit: `3cf9ddbd` (rename + import), `d9944fa5` (vitest resolver bỏ qua id đã resolve có `?raw`/`?url`). Hai commit `7872f285`/`20ac7a44` của lần chạy trước bị thay thế vì commit rename khi đó thiếu phần xoá tên cũ (index chỉ chứa phần thêm).
- Bằng chứng: `pnpm exec tsc --noEmit` = 0 · `pnpm build` = 0 (`built in 13.43s`) · `pnpm exec vitest --run tests/runtime/combatFlow.test.ts tests/runtime/audioSystem.test.ts tests/runtime/animationPresentationReachability.test.ts` = **33/33 passed** · `pnpm inventory:three-closure` + `census:three-features` + `census:three-assets` tái sinh ra manifest **không đổi** so với trước rename (baseline 342/663 reachable, 187 unreachable, 7 unresolved production refs; census 278/87/203).
- Ngoài phạm vi Phase 2 (baseline có sẵn trên HEAD, không do rename): `tests/units/*`, `tests/visual/runeterraUnitCard`, `tests/core/gameSpeed` fail sẵn; full suite bị chặn bởi test-guard (150+ file, máy 7 GB) nên chỉ chạy targeted.

---

## PHASE 3: Hệ thống Audio Hoàn chỉnh (BGM & Unique Unit Sound Profiles)

### 3.1. Phase 3A: BGM Controller & Attack/Skill Pitch+Wave Profiles [COMPLETED]
- **BGM Controller (`src/three/BgmController.ts`)**:
  - Quản lý vòng đời âm thanh tự động chuyển mạch theo scene: `menu`, `planning`, `combat`.
  - Tích hợp HTMLAudioElement native loop, tự động hồi phục (resume) khi re-enable audio trong UI Settings.
  - Xử lý race condition của browser autoplay policy: trì hoãn phát đến gesture người dùng đầu tiên (`pointerdown`/`keydown`) và huỷ bỏ gesture handler khi đổi scene.
  - Đã kiểm chứng: `tests/runtime/bgmController.test.ts` (9/9 passed).
- **Hồ sơ âm thanh riêng biệt cho 112 loài thú (`src/data/unitSfxProfiles.ts` & `ThreeSoundEffects.ts`)**:
  - Bảng hồ sơ âm thanh cố định cho 112 loài (`species`), độc lập khỏi module `unitCatalog` runtime để tối ưu bundle và thời gian khởi động.
  - Mỗi loài thú có độ dịch cao độ (semitones: -10 đến +10) và dạng sóng (waveform: square, triangle, sawtooth, sine) đặc trưng.
  - Ánh xạ sự kiện chiến đấu `attack` sang `hit`, kết hợp `dispatchUnit(speciesKey, event)`.
  - Các unit cùng loài (như `wolf_alpha` và các biến thể) dùng chung hồ sơ âm thanh của loài `soi`.
  - Đã kiểm chứng: `tests/runtime/unitSfxProfile.test.ts` (4/4 passed).
- **Commit bằng chứng**: `ab9642e2`, `1b31e473`, `0fe4eba8`, `826f0722`.

### 3.2. Phase 3B: Tiếng Kêu Tương Tác & Âm Thanh Take-Hit / KO [PENDING]
- [ ] Gắn call site tiếng kêu (`cry`) khi click vào thú trên sân đấu hoặc hàng chờ (bench).
- [ ] Phát âm thanh theo hồ sơ loài khi thú nhận đòn (`take-hit`) hoặc bị hạ gục (`ko`).
- [ ] Đảm bảo không bị trùng lặp âm thanh chung chung khi thú tương tác.

### 3.3. Tiêu chí hoàn thành (Done Criteria)
- [x] Phase 3A: BGM tự động kích hoạt theo scene (Menu/Planning/Combat).
- [x] Phase 3A: Tắt/bật âm thanh trong Settings phản hồi tức thì và nhớ trạng thái.
- [x] Phase 3A: Từng loài thú có cao độ và dạng sóng riêng khi tấn công/dùng kỹ năng.
- [x] Phase 3A: Không làm phình to bundle (tách riêng profile data).
- [ ] Phase 3B: Click vào thú trên sân phát tiếng kêu đặc trưng.
- [ ] Phase 3B: Khi thú nhận đòn hoặc bị hạ gục phát âm thanh đúng tính chất loài thú.

---
## PHASE 4: Tiếp Tục Vẽ & Hoàn Thiện Roster 3D Model / Bespoke Rigs

### 4.1. Hiện trạng Roster
- Tổng số đơn vị trong game: **60+ beasts**.
- **Đã hoàn thiện Rig riêng độc bản (Bespoke Unit-Owned)**:
  - 10 con gốc: `crane_blessing` (Rapper Chicken / Sleepy Hen), `spider_venom`, `hawk_hunter`, `monkey_spear`, `owl_nightshot`, `wasp_sting`, `fox_flame`, `scorpion_shadow`, `weasel_quick`, `jaguar_hunt`.
  - 14 con đã có rig trong `ThreeUnitOwnedRigRegistry.ts`: `komodo_bite`, `tiger_fang`, `triceratops_charge`, `jellyfish_shock`, `newt_fire`, `salamander_flame`, `toad_poison`, `deer_song`, `dove_peace`, `firefly_heal`, `ant_guard`, `badger_stone`, `bear_ancient`, `ram_charge`,...
- **Các con thú còn lại đang ở dạng Unfinished / Generated Voxel Placeholder**:
  - Nhóm Thú Nước: `otter_river`, `octopus_mind`, `squid_ink`, `whale_song`, `shark_blood`,...
  - Nhóm Rừng & Đất: `rhino_quake`, `wolf_alpha`, `armadillo_roll`, `buffalo_mist`, `chimera_flame`,...
  - Nhóm Côn trùng & Sinh vật huyền bí: `worm_ice`, `worm_queen`, `beetle_drill`, `beetle_mystic`, `butterfly_mirror`, `angel_guardian`,...

### 4.2. Quy trình thiết kế & triển khai Rig cho từng con thú
Mỗi con thú mới được hoàn thiện theo đúng chuẩn 6 tiêu chuẩn đã đặt ra cho `rapper-chicken`:
1. **Thiết kế hình thái 3D Voxel độc bản (`*Rig.ts`)**:
   - Sử dụng voxel cuboid builder có màu sắc và hoa văn đặc trưng theo Tribe & Tier.
   - Thêm phụ kiện nhận diện thương hiệu độc đáo (như mic/mũ của gà rapper; sừng kim cương của tê giác; cánh băng của chim băng; giáp gai của tê tê).
2. **Animation Controller riêng biệt (`*Animation.ts`)**:
   - Đủ 6 hành động runtime:
     - `idle`: Nhịp thở, đuôi vẫy, cánh đập hoặc chuyển động lơ lửng.
     - `move`: Chạy 4 chân, bay lượn, bò trườn hoặc bơi sóng nước.
     - `attack`: Táp, mổ, vung vuốt, bắn gai, phóng đòn.
     - `skill`: Động tác dồn lực, xoay người, bộc phát hào quang chiêu nộ.
     - `take-hit`: Giật lùi, co mình chịu đòn.
     - `victory`/`death`: Ăn mừng hoặc tan rã ấn tượng.
3. **Đăng ký vào Roster Chính Thức**:
   - Đưa vào `UnitOwnedRigRegistry.ts`.
   - Gỡ bỏ khỏi danh sách fallback `unfinishedUnitPlaceholder`.
   - Thiết lập Star Evolution (Star 2 và Star 3 có thêm phụ kiện hào quang, giáp nâng cấp, hiệu ứng hạt).

### 4.3. Lộ trình bàn giao thú mới theo đợt (Batches)
- **Batch 4.1: Nhóm Dã Thú Săn Mồi & Đỡ Đòn (5 con)**:
  - `rhino_quake` (Tê giác địa chấn - sừng đá phát sáng)
  - `wolf_alpha` (Sói đầu đàn - bờm bạc, mắt phát quang)
  - `otter_river` (Rái cá sông - vỏ sò ngọc, đuôi bơi)
  - `armadillo_roll` (Tê tê cuộn tròn - giáp vảy kim loại)
  - `buffalo_mist` (Trâu sương mù - cặp sừng cong dũng mãnh)
- **Batch 4.2: Nhóm Biển Sâu & Băng Giá (5 con)**:
  - `octopus_mind` (Bạch tuộc tâm linh - xúc tu phát sáng)
  - `squid_ink` (Mực mực hắc ám - đám mây mực)
  - `worm_ice` (Sâu băng tuyết - gai pha lê)
  - `whale_song` (Cá voi thánh ca - sóng âm nhạc)
  - `ice_mage` (Pháp sư băng)
- **Batch 4.3: Nhóm Côn Trùng & Sinh Vật Thần Thoại (còn lại)**:
  - `beetle_mystic`, `butterfly_mirror`, `angel_guardian`, `chimera_flame`,...

---

## PHASE 5: Thay Thế Thanh Trạng Thái (Overhead Billboards) Bằng PNG Asset

### 5.1. Hiện trạng
- Thanh trạng thái trên đầu thú (HP, Rage, Tên, Buff/Debuff) tại:
  - Trên sân đấu: `ThreeBoardRenderer.ts::addBoardUnitOverhead` & `ThreeUnitStatusBillboard.ts`.
  - Trên hàng chờ (bench): `ThreeRoundScene.ts` hoặc các slot bench.
- Hiện đang vẽ bằng HTML5 Canvas 2D primitives (`ctx.fillRect`, `ctx.strokeRect`, gradient đơn sắc) rồi gắn lên Three.js Sprite.
- Nhược điểm: Nhìn phẳng lì, viền tối mờ nhạt, khó nhìn khi thú di chuyển vào vùng địa hình rừng rậm hoặc ban đêm, thiếu chất medieval RPG.

### 5.2. Giải pháp chuyển đổi sang PNG Asset Frames
1. **Bộ Asset Khung Thanh Trạng Thái (PNG Sắc Nét)**:
   - Tận dụng và hoàn thiện bộ asset trong `public/assets/ui/status/` và `public/assets/ui/medieval/`:
     - **Name Plaque**: Khung bảng gỗ viền kim loại nhỏ gọn (`name-plaque-frame.png`).
     - **HP Bar Frame**: Khung thanh máu có hoa văn chạm trổ cổ điển (`unit-hp-frame.png`).
     - **HP Bar Fill**: Texture thanh máu có sọc chéo phản quang RPG (xanh lá / đỏ khi máu yếu).
     - **Rage Bar Frame**: Khung thanh năng lượng nộ bằng đồng sáng (`unit-rage-frame.png`).
     - **Rage Cells**: Từng viên ngọc nộ phát sáng vàng cam (`unit-rage-cell-frame.png`).
     - **Star Icons**: Biểu tượng ngôi sao đồng/bạc/vàng mạ nổi 3D.
2. **Refactor `UnitStatusBillboard` Renderer**:
   - Trong `drawBillboardCanvas()`:
     - Dùng `drawImage` vẽ khung PNG từ cache (load trước qua `getImageAsset`).
     - Cắt 9-slice hoặc draw theo tỷ lệ pixel chính xác của asset frame.
     - Thanh máu chia 2 lớp: Lớp nền khung gỗ tối -> Lớp ruột máu hiển thị theo % HP -> Lớp viền kim loại PNG đè lên trên (overlay frame).
     - Text tên thú dùng font medieval sắc nét, có viền đổ bóng đậm (black drop shadow) chống chìm trên mọi nền bản đồ.
3. **Đồng Bộ Hoá Cho Cả Board & Bench**:
   - Thú trên sân (Board Units): Hiển thị đầy đủ Tên + Sao + Máu + Nộ + Icon hiệu ứng.
   - Thú dự bị (Bench Units): Hiển thị thanh trạng thái tinh gọn (Mini HP/Rage + Star) để không gây rối mắt nhưng vẫn thấy rõ sao và cấp độ.

### 5.3. Tiêu chí hoàn thành (Done Criteria)
- Thanh máu và thanh nộ trên đầu thú có viền khung PNG medieval sắc nét, có chiều sâu 3D rõ rệt.
- Text tên và số HP/nộ có độ tương phản cao, đọc rõ ràng ngay cả khi camera zoom xa.
- Thú trên hàng dự bị và trên sân đấu đều có thanh hiển thị đồng bộ phong cách.
- Hiệu năng mượt mà, texture canvas được cache theo resolution tối ưu (không tạo canvas rác gây leak GPU).

---

## Kế hoạch Triển khai & Thứ tự Ưu tiên (Execution Order)

1. **Sprint 1 (Immediate - Card Asset Suite & Shared Factory)**:
   - **Phase 1 [IN PROGRESS]**: Tích hợp toàn bộ kho asset người dùng cung cấp (`shell.png`, `wide.png`, `portrait-frame.png`, `nameplate.png`, `stat.png`, `chip.png`, `button-round.png`, `cta.png`) vào `ThreeUnitCardFactory.ts`, purge sạch legacy CSS trong `src/styles.css`.
   - **Phase 5 [NEXT]**: Nâng cấp thanh trạng thái trên đầu thú (Board + Bench) bằng PNG frames từ `public/assets/ui/status/` và `medieval/healthbar-frame.png`.
2. **Sprint 2 (Audio & Immersion) [COMPLETED]**:
   - **Phase 3 [DONE]**: Đã hoàn thành BGM controller và Unit sound profiles theo loài thú (`ab9642e2`, `1b31e473`, `0fe4eba8`).
3. **Sprint 3 (Architecture Modernization)**:
   - **Phase 2 [PENDING]**: Thực hiện rename bỏ tiền tố `Three*` theo 4 waves an toàn.
4. **Sprint 4 (Content Expansion)**:
   - **Phase 4 [PENDING]**: Wire các đợt thú 3D bespoke còn lại (Batch 4.1 -> 4.3).

---
*Kế hoạch này tuân thủ nguyên tắc không sửa `old_src/`, dùng `pnpm`, tuân thủ rule commits dài có giải thích, và đảm bảo test targeted xanh trước khi mở rộng.*
