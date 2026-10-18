# Kế hoạch cập nhật Forest Throne

- **Ngày lập:** 14/10/2026. **Cập nhật bố cục:** 18/10/2026 (gom vào `.omp/plans`, thống nhất bố cục file plan; nội dung không đổi).
- **Trạng thái:** đang triển khai; các checkbox là việc cần kiểm tra và thực hiện, không phải xác nhận lỗi đã được tái hiện.
- **Nhánh đích:** tên file = tên nhánh — `feat/ui-ux/gameplay`.
- **File spec tham chiếu:** `.omp/plans/pending/docs.spec.forest-throne-rebuild.md`. Nếu yêu cầu mới khác spec cũ, ưu tiên yêu cầu mới trong kế hoạch này.

## Mục tiêu và phạm vi

Triển khai toàn bộ yêu cầu UI/UX, thư viện, thú, âm thanh, đồ họa và giao tranh trong danh sách người dùng cung cấp. Ưu tiên giao diện dùng được trên mobile dọc, thông tin rõ ràng và animation khớp diễn biến giao tranh.

File này chỉ lập kế hoạch. Việc kéo code, sửa gameplay và nghiên cứu thiết kế trên mạng thuộc các bước triển khai bên dưới.

## Quy ước kiểm thử và công cụ

- **Không được kiểm thử bằng Chrome**, kể cả Chrome headless hoặc automation chạy Chrome.
- **Bắt buộc dùng 1DevTool Browser MCP** (`onedevtool` browser_* tools, BrowserPanel) cho kiểm thử trình duyệt: kiểm tra UI/UX, tương tác, responsive và chụp ảnh nghiệm thu.
- Nếu 1DevTool Browser MCP chưa khả dụng, ghi rõ phần kiểm thử trình duyệt còn thiếu; không tự chuyển sang Chrome.
- Các lệnh kiểm tra TypeScript, unit test và build vẫn chạy bằng `pnpm` như kế hoạch.

## Vị trí chủ yếu cần sửa

Trọng tâm sửa là mã nguồn TypeScript dưới `src/` (UI, core, units, world, app, data) cùng asset dưới `public/assets/` và font dưới `public/fonts/`. Cột "Điểm bắt đầu" dưới mỗi nhóm là danh sách rà soát chi tiết; đường dẫn là điểm khởi đầu, không giới hạn phạm vi sửa.

### Chuẩn bị hiện trạng

- Checkout đang có nhiều thay đổi chưa commit. Trước khi pull, kiểm tra branch, remote và diff; bảo toàn thay đổi hiện có bằng commit hoặc phương án lưu phù hợp, rồi cập nhật code và xử lý xung đột.
- Font baseline cần cập nhật theo yêu cầu mới ngày 17/10/2026: giữ `public/fonts/Heading - MTD Amstrong.otf` cho Heading; đổi vai trò/tên `public/fonts/Normal - Bonestay.otf` thành `public/fonts/Story - Bonestay.otf` chỉ cho nội dung cốt truyện; nguồn font Normal mới là `/home/thaigo/Downloads/a30345f9cb9b8b72000575d5fdcd3390.zip` (chỉ lấy `MTD-Ampihan.otf` hoặc `MTD-Ampihan.ttf` theo một định dạng phù hợp, bỏ qua file `.url`).
- Chưa thấy thư mục `old_src` trong checkout hiện tại. Tìm lại qua lịch sử Git, branch hoặc nguồn dự án cũ trước khi phục hồi bảng gacha, tooltip, màu ô và chế tạo 3×3. Không tự đoán dữ liệu cũ.
- Tài liệu tham khảo của dự án: `.omp/plans/docs/spec/forest-throne-rebuild.md`. Nếu yêu cầu mới khác tài liệu cũ, ưu tiên yêu cầu mới trong kế hoạch này.
- Nguồn yêu cầu nguyên văn để đối chiếu checklist là `/home/thaigo/.codex/attachments/60d585b4-181e-4b24-8a8b-ca5d6f83817f/Pasted text.txt`. Khi wording gốc mơ hồ hoặc có câu “thay vì” dễ đảo chiều, dùng đính chính rõ ràng mới nhất của người dùng làm nguồn quyết định; không dùng prompt cũ để ghi đè các đính chính mới hơn.
- Đường dẫn code trong từng giai đoạn là điểm bắt đầu rà soát, không giới hạn phạm vi sửa.

## Nội dung công việc

### 1. Cập nhật nguồn và chuẩn hóa giao diện

Điểm bắt đầu: `src/ui/ui.css`, `src/ui/kit.ts`, `src/ui/modal.ts`, `src/ui/settings.ts`, `src/core/i18n.ts`, `src/core/settings.ts`.

- [x] **01 — Pull code mới:** cập nhật nguồn sau khi bảo toàn các thay đổi đang có; xác định baseline để kiểm tra hồi quy.
- [x] **02 — Font tiêu đề và nút:** toàn bộ title game và button dùng `Heading - MTD Amstrong.otf`; kiểm tra cả nút chỉ có ký hiệu.
- [ ] **03 — Font nội dung (cập nhật 17/10/2026, thay thế tiêu chí Bonestay cũ):** đưa **MTD Ampihan** vào assets font dự án và dùng làm **Normal** cho toàn bộ nội dung UI/game, ngoại trừ vùng **Heading** và nội dung **cốt truyện**. Ví dụ tên đích: `public/fonts/Normal - MTD Ampihan.otf`. Đổi `Normal - Bonestay.otf` thành `Story - Bonestay.otf` và chỉ dùng cho cốt truyện; không dùng Bonestay làm body mặc định. Giữ `Heading - MTD Amstrong.otf` cho Heading. Tách rõ Heading / Normal / Story ở mọi renderer thực tế, gồm DOM và canvas; chữ hướng dẫn, tooltip, modal và UI thông thường phải dùng Normal, không phải Story.
- [ ] **04 — Màu chữ theo nền thực tế (đính chính 17/10/2026):** chọn màu chữ theo **mặt nền ngay bên dưới vùng chữ**, không theo màu khung bao ngoài và không áp một màu cho toàn bộ dialog/modal. Trên nền vỏ gỗ sồi nâu hoặc gỗ nâu tối dùng chữ **trắng**; trên nền trắng/sáng kiểu gỗ bạch dương dùng chữ **đen**. Quy tắc này áp dụng nhất quán cho nội dung, nhãn và nút nằm trên đúng hai loại nền; nếu một modal chứa nhiều vùng nền thì từng vùng dùng màu tương phản tương ứng. Với nền màu khác và ngoại lệ loading ở mục 36, giữ yêu cầu hiện hành trừ khi có tiêu chí cụ thể hơn. Việc đổi màu không thay đổi vai trò font Heading / Normal / Story.
- [x] **05 — Thuật ngữ (đính chính 17/10/2026):** nhãn độ phân giải tiếng Việt phải hiển thị chính xác **`Thích nghi`**, không phải `adaptive` và không phải `Tự động`; giá trị/enum/key lưu nội bộ `adaptive` được giữ nguyên nếu hợp đồng code cần. Giới hạn FPS hiển thị theo dạng **`<số> Khung hình trên giây`**, ví dụ **`60 Khung hình trên giây`**; không dùng `60 FPS` và không dùng `60 tốc độ khung hình trên giây`. Không thay số hoặc logic giới hạn FPS chỉ để sửa nhãn.
- [ ] **06 — Kích thước nút theo ngữ cảnh (đính chính 17/10/2026):** không áp `fit-content` đồng loạt. Chọn `fit-content`, giới hạn `max-width`, hoặc giãn/ràng buộc chiều rộng theo nội dung, vai trò control, bố cục và viewport. Nút ôm nội dung khi hợp lý nhưng phải bị giới hạn bởi vùng chứa khi cần; nhãn dài, bản dịch và mobile không được tràn, che/lấn nút cạnh bên, bị cắt khó đọc hoặc mất khả năng thao tác. Icon/close/stepper/compact controls không bị kéo full-width máy móc; action group/grid có thể giãn theo cell khi bố cục yêu cầu.
- [x] **07 — Phím tắt trong cài đặt:** sửa các nút như `Đặt lại phím tắt` bị dính vào nút `M` khi màn hình hẹp; tham khảo bố cục tab Dữ liệu.
- [ ] **08 — Modal và vùng an toàn:** không để browser/page xuất hiện thanh cuộn khi modal mở. Nội dung dài cuộn trong vùng modal; tăng khoảng đệm cả bốn cạnh, tăng thêm phía phải cho scrollbar; nút đóng dạng dấu `-` không đè lên nội dung. Phân biệt khoảng đệm nội bộ và safe area thiết bị.

Nghiệm thu: Heading / Normal / Story tải đúng vai trò; MTD Ampihan hiển thị đầy đủ dấu tiếng Việt; các đường dẫn sau đổi tên, fallback và layout không hồi quy; vùng cốt truyện dùng Story, UI thường dùng Normal, Heading không đổi. Màu chữ phải bám **mặt nền thực tế**: trắng trên gỗ nâu/tối, đen trên nền sáng kiểu bạch dương, kể cả nhãn/nút ở hai loại nền này; không suy màu từ khung bao ngoài và không ép cả modal về một màu. Nhãn độ phân giải tiếng Việt phải là **`Thích nghi`**; giới hạn FPS dùng **`<số> Khung hình trên giây`**. Button phải được sizing theo ngữ cảnh, không tràn/chồng ở nhãn dài, bản dịch hoặc mobile. Modal không gây cuộn trang, không tràn ngang và không che nút đóng. Kiểm tra font/màu/button bằng targeted checks và đúng 1DevTool BrowserPanel MCP; tiêu chí trực quan dùng ảnh BrowserPanel thật, không chỉ accessibility snapshot.
- Trạng thái kiểm chứng 03A (18/10/2026): đã cài `Normal - MTD Ampihan.otf`, đổi asset Bonestay thành `Story - Bonestay.otf`, tách `Forest Heading` / `Forest Normal` / `Forest Story` cho DOM và canvas, và không gán Story cho History/tutorial/UI thường. `fc-query` xác nhận Ampihan có các dải ký tự tiếng Việt `0102-0103`, `0110-0111`, `01A0-01B0`, `1EA0-1EF9`. Gap Story consumer đã được sửa trên surface narrative thật: `src/ui/library.ts` render riêng `unitDef.pitchVi` bằng `lib-story`, còn skill/detail/tooltip/UI thường giữ Normal; search hiện chỉ có consumer Story production này ngoài plumbing chung. `pnpm typecheck` và `pnpm build` pass; BrowserPanel generation 16 mở detail Kiến Hộ Vệ và thấy đúng `pitchVi` "Giữ cùng hàng bằng giáp, khiên và che đòn cho đồng minh yếu máu." trên runtime. Giữ mục 03 mở vì screenshot BrowserPanel hiện bị runtime bridge trả `[image omitted: the active model does not support image input]`, nên chưa có pixel proof trực tiếp rằng Bonestay thực sự render đúng trên surface Story dù source/runtime state đã khép implementation gap.
- Trạng thái kiểm chứng 04/06/08 (18/10/2026): BrowserPanel ảnh thật ở viewport 581×719 xác nhận tab/nút gỗ nâu dùng chữ trắng, label/ô giá trị trên nền bạch dương sáng dùng chữ đen; ở Cài đặt → Âm thanh, sau khi transition ổn định, nút trước/sau Bản nhạc có kích thước nhìn tương đương stepper `<`/`>` thường và panel không bị cắt mép. Phạm vi này chỉ bao phủ Settings tại 581×719: mục 04 còn cần kiểm tra nhất quán trên các surface khác; mục 06 còn cần nhãn dài/mobile landscape/desktop; mục 08 còn cần page-scroll, safe-area, cuộn nội bộ và overlap nút đóng.

### 2. Menu, HUD, thao tác và âm thanh

Điểm bắt đầu: `src/ui/menu.ts`, `src/ui/planning.ts`, `src/ui/combat.ts`, `src/app/screens.ts`, `src/app/app.ts`, `src/core/settings.ts`, `src/audio/`.

- [x] **09 — Mobile dọc:** các nút cạnh phải không hiện label che sân chơi. Panel cửa hàng mặc định ẩn và mở bằng nút mới `Cửa hàng thú`; đóng/mở được bằng cảm ứng.
- [x] **10 — Menu chính:** bỏ nút Thông tin khỏi menu chính; vẫn có nút Thông tin trong trận cho các tab ở mục 40.
- [x] **11 — Cộng đồng:** dùng Discord icon và mở link `https://discord.gg/FH9bGFm9G`.
- [ ] **12 — Ủng hộ:** QR nằm bên phải các nút mệnh giá và có khung phù hợp giao diện. Với viewport quá hẹp, bố cục responsive phải giữ QR đọc được và các nút thao tác được.
- [x] **13 — Cộng hưởng:** bỏ modal Cộng hưởng riêng; đưa nội dung vào nút Thông tin.
- [ ] **14 — Bắt đầu và HUD:** phần modal/panel liên quan nút Bắt đầu phải biến mất hoàn toàn khi đóng, không còn trạng thái thu nhỏ hoặc lớp chặn thao tác. Vòng, tim, vàng, cấp và Ra trận nằm gọn bên trái nút Bắt đầu.
- [x] **15 — Nhãn Bắt đầu:** bỏ dấu chấm khỏi nút.
- [x] **16 — Nút tiêu hao:** thống nhất dạng ngoặc tròn chứa số lượng và emoji tài nguyên, ví dụ `Mua (1 🪙)`; áp dụng mua cấp, mua thú, sơ đồ công nghệ và các thao tác tiêu hao khác. Giá hiển thị phải khớp giá thực tế.
- [x] **17 — Điều khiển nhạc:** nút `<` và `>` của bản nhạc có kích thước tương đương các nút `<` và `>` thông thường.
- [x] **18 — Tiết kiệm pin:** xóa nút Tiết kiệm pin; rà soát phần liên quan để tránh nút hoặc shortcut còn sót.
- [x] **19 — Âm nhạc:** thêm nút bật/tắt Âm nhạc riêng. Tắt Âm thanh tắt cả nhạc và hiệu ứng; tắt Âm nhạc chỉ tắt nhạc. Bật lại Âm thanh tôn trọng trạng thái Âm nhạc đã lưu.
- [x] **20 — Phím mặc định:** đổi phím đổi tướng từ `D` sang `R`; dùng Shift bên phải (`ShiftRight`) cho Ván mới. Cập nhật nhãn hướng dẫn, cấu hình mặc định và kiểm tra xung đột với cấu hình đã lưu.

Nghiệm thu: trên mobile dọc sân không bị label/panel che; kích thước nút thích ứng đúng ngữ cảnh, nhãn dài/bản dịch không tràn hoặc lấn control bên cạnh và vẫn dễ bấm; nút Bắt đầu không để lại overlay; kiểm tra đủ tổ hợp bật/tắt Âm thanh và Âm nhạc; Shift trái không kích hoạt Ván mới.
- Trạng thái kiểm chứng 12/14/17 (18/10/2026): Requirement 17 đã nghiệm thu bằng BrowserPanel ảnh thật 581×719 sau khi transition ổn định; nút trước/sau Bản nhạc có kích thước nhìn tương đương stepper `<`/`>` của Âm lượng/Âm lượng nhạc và panel không bị cắt mép. Requirement 12 và 14 vẫn mở vì QR bên phải + responsive, việc panel Bắt đầu biến mất hoàn toàn và HUD placement chưa có pixel acceptance trực tiếp.

### 3. Thư viện, portrait, tooltip và hoạt ảnh thú

Điểm bắt đầu: `src/ui/library.ts`, `src/ui/card.ts`, `src/ui/tooltip.ts`, `src/units/portraits.ts`, `src/units/kit.ts`, `src/units/rig.ts`, `src/units/billboard.ts`, `src/core/economy.ts`.

- [ ] **21 — Card chung:** tăng khoảng đệm phần info dưới card thư viện; dùng component chung cho card thư viện và card trong modal mua thú để đồng nhất bố cục, chỉ số và tương tác.
- [ ] **22 — Portrait 360°:** avatar thú quay được đủ 360°, không chỉ trái/phải. Canvas portrait khớp vùng hiển thị của kit panel; kiểm tra khung hình, clipping và resize.
- [ ] **23 — Nút hành động:** toàn bộ nút preview hành động dùng màu xanh lá cùng hệ với nút Rảnh rỗi, gồm trạng thái hover, nhấn và disabled.
- [x] **24 — Bảng gacha:** lấy bảng xác suất ra thú theo giá vàng và level từ `old_src`, đưa vào thư viện. UI phải lấy cùng nguồn dữ liệu với shop thực tế, có chú giải rõ giá thú và cấp người chơi.
- [x] **25 — Rảnh rỗi và thú thể:** animation rảnh rỗi có cooldown ngẫu nhiên vài giây giữa các lần kích hoạt thay vì phát liên tục. Rà soát animation hiện chỉ chạy trong combat; đổi text và tên biến liên quan theo thuật ngữ người dùng yêu cầu là `thú thể`, thêm nút tương ứng cạnh Rảnh rỗi trong thư viện. Phân biệt rõ hai trạng thái sau khi xác minh tên gọi.
- [ ] **26 — Tooltip thú:** phục hồi nội dung và hành vi tooltip khi hover thú từ `old_src`; đối chiếu các trường thông tin với dữ liệu hiện tại, không chỉ hiển thị bản đơn giản.
- [x] **27 — Máu và nộ:** thêm phần trăm máu phía phải thanh máu, ngay phía trên phần nộ; emoji tim nằm phía trên emoji sét; cập nhật đúng khi máu/nộ đổi.
- [x] **28 — Popup ưu tiên hover:** thú đang được hover có popup tên, máu và nộ nổi trên popup các thú khác, đặc biệt khi đội hình dày; trả lại thứ tự bình thường khi hết hover.
- [x] **29 — Thư viện nhiều tab:** bổ sung tab Thú, Vật phẩm, Trang bị, Chế tạo/công thức, Chúc phúc và Xác suất cửa hàng. Nội dung dựa trên catalog thực tế; có điều hướng và trạng thái chọn tab rõ ràng.

Nghiệm thu: card shop và thư viện dùng chung cấu trúc; mọi thú quay 360° và không bị cắt; animation có khoảng nghỉ, không chồng hành động; bảng xác suất khớp logic shop; popup hover đọc được trong đội hình đông.
- Trạng thái kiểm chứng 21–23/26: card parity/padding, portrait 360° + clipping/resize, action-state green visuals và tooltip rich vẫn cần runtime/pixel acceptance. Mục 25 đã nghiệm thu current-state: `scheduleIdle()` dùng cooldown ngẫu nhiên 4–9 giây; `Rảnh rỗi` đặt viewer về non-combat và giữ timer; `Thú thể` đặt combat pose, phát idle pose tương ứng rồi dừng timer. BrowserPanel sau reload hiển thị `Rảnh rỗi` và `Thú thể` liền nhau trong detail Kiến Hộ Vệ; keyboard focus/Enter đi qua control `Thú thể`. `pnpm exec vitest run tests/unit-visuals.test.ts` pass 8/8.
- Trạng thái kiểm chứng 27–28 (17/10/2026): `tests/billboard-presentation.test.ts` chạy trực tiếp renderer production, xác nhận readout tim/HP% có tọa độ Y phía trên readout sét/nộ và `setPriority(true/false)` đổi `Sprite.renderOrder` 10→20→10. `tests/board-view-presentation.test.ts` xác nhận live HP/nộ được đẩy vào billboard + HP ratio và hover chuyển priority giữa các thú rồi reset khi hết hover. `tests/planning-drag.test.ts` cùng `tests/recovered-playback.test.ts` bảo toàn interaction/playback. Targeted run 5 files / 18 tests pass; `pnpm typecheck` pass.

### 4. Giao tranh, thời điểm sát thương và màu ô

Điểm bắt đầu: `src/core/combat.ts`, `src/core/combatStaging.ts`, `src/core/skills.ts`, `src/core/preview.ts`, `src/core/environment.ts`, `src/units/combatPlayer.ts`, `src/units/boardView.ts`, `src/world/boardPicking.ts`, `src/app/planningDrag.ts`.

- [x] **30 — Lịch sử giao tranh:** xác minh lịch sử không bị xóa khi sang vòng mới; nếu đang bị xóa thì sửa vòng đời dữ liệu, phân biệt reset vòng và bắt đầu ván mới.
- [x] **31 — Di chuyển → đánh → sát thương:** thú hoàn thành animation di chuyển và đứng giữa ô phía trước/phía sau mục tiêu theo role rồi mới phát animation đánh. Số damage nảy đúng lúc callback/mốc animation của chính thú gọi hiệu ứng; không nảy sớm hoặc muộn. Đối chiếu state gameplay, thanh máu và replay để diễn biến thống nhất.
- [x] **32 — Sát thương theo chu kỳ:** damage như Thiêu đốt kích hoạt khi bắt đầu chu kỳ mới. Xác định rõ mốc chu kỳ của combat, thứ tự xử lý hiệu ứng và số lần tick để không áp dụng lặp.
- [ ] **33 — Màu ô và kỹ năng:** tham khảo `old_src`, áp dụng đối xứng cho phe ta và phe địch, cả preview và combat:
  - Ô đang được quét lần lượt phủ tím; phủ ô, không tô tím thú.
  - Thú triển khai kỹ năng có hiệu ứng rainbow.
  - Ô bị đánh trực tiếp, gồm đánh thường và kỹ năng trực diện, màu đỏ.
  - Ô bị ảnh hưởng bởi đòn lan màu vàng.
  - Quy định thứ tự hiển thị khi quét, hover và vùng đòn đánh chồng nhau để vẫn đọc được mục tiêu chính.
- [x] **34 — Hover mọi ô:** hover bất kỳ ô hợp lệ đều làm sáng đúng ô đó, gồm cỏ, nước và ô dự bị; không chỉ ô cỏ.
- [x] **35 — Kéo thả:** thêm animation thú di chuyển theo con trỏ khi kéo; hỗ trợ cảm ứng và xử lý thả, hủy, vị trí không hợp lệ, tránh model nhảy về vị trí sai.

Nghiệm thu: không có attack trước khi di chuyển xong; damage nổi đúng mốc impact do animation gọi, không bị nhân đôi; Thiêu đốt tick đúng đầu chu kỳ; preview và combat thống nhất đỏ/vàng; hover và kéo thả đúng trên cả hai phe, các loại ô và dự bị.
- Trạng thái kiểm chứng 33: source + targeted regressions đã hoàn tất cho scan tím, caster rainbow, direct đỏ, splash vàng, priority `direct > splash > scan`, đối xứng hai phe và preview read-only. Live Planning hover vẫn chưa nghiệm thu được vì save hiện có 0 thú triển khai; BrowserPanel hiện chỉ có exact-ref accessibility input, không có coordinate/pointer-move/drag primitive để kéo hợp lệ thú từ canvas bench lên board. Không inject/fabricate state để vượt blocker này.

### 5. Loading, asset và đồ họa môi trường

Điểm bắt đầu: `src/ui/loading.ts`, `src/core/emojiIcon.ts`, `src/core/equipment.ts`, `src/world/scenery.ts`, `src/world/arena.ts`, `src/world/stage.ts`, `src/core/settings.ts`, `public/assets/`.

- [x] **36 — Loading rainbow (ngoại lệ màu bắt buộc):** title game ban đầu **màu trắng**, không bị quy tắc màu nền ở mục 04 ghi đè. Khi tải tăng đến phần trăm nào, các **ký tự của TITLE** tương ứng đổi sang màu cầu vồng theo thứ tự **trái → phải, trên → dưới**; kết thúc tải thì hoàn tất toàn bộ title.
- [ ] **37 — SVG vật phẩm và trang bị:** tự vẽ bộ SVG đồng nhất, dễ phân biệt loại/rarity và đọc được ở kích thước nhỏ; nối asset vào inventory, card, tooltip và slot trang bị.
- [ ] **38 — Emoji thống nhất:** mọi emoji dùng cùng nguồn API/asset bên ngoài, có lớp ánh xạ dùng chung cho DOM và canvas. Chọn nguồn, kiểm tra điều kiện sử dụng, cache và fallback ảnh để không hiện ký tự `?` khi thiếu font; vật phẩm/trang bị dùng SVG tự vẽ ở mục 37.
- [ ] **39 — Ánh sáng, đèn lồng và bên ngoài sân:** thêm bóng đổ cho vật thể khi có ánh sáng, có tùy chọn bật/tắt trong cài đặt; làm đèn lồng chi tiết hơn. Làm rõ yêu cầu nguyên văn `sống bên ngoài sẽ bự dần thay vì chỉ rộng 1 ô`, rồi điều chỉnh kích thước/tăng trưởng đúng đối tượng; chưa mặc định đó là sóng nước hay viền sân.
- Trạng thái kiểm chứng 36: renderer production được kiểm thử trực tiếp ở progress 0/50/100%; title bắt đầu toàn trắng, sau đó đổi màu đúng thứ tự trái → phải, trên → dưới. `app.ts` cấp progress từ `loadKit(...)` và frame đầu của stage, không dùng progress giả.
- Trạng thái kiểm chứng 37: catalog SVG và các consumer production đã được audit; targeted equipment/craft tests pass, nhưng chưa có bằng chứng pixel cho khả năng đọc ở slot nhỏ nên giữ mục 37 chưa hoàn tất.
- Trạng thái kiểm chứng 38: semantic registry, DOM/canvas/Three.js cùng dùng nguồn ảnh Twemoji 16.0.1 (CC BY 4.0), có cache, single-flight load, remote question fallback và fallback ảnh local khi CDN lỗi; targeted emoji tests 18/18 pass, typecheck pass, BrowserPanel reload + Library navigation không phát sinh lỗi emoji/accessibility. Screenshot hiện bị runtime bỏ phần ảnh nên chưa có pixel proof xuyên thiết bị; giữ mục 38 chưa hoàn tất cho tới khi có kiểm tra trực quan đọc được ảnh.
- Trạng thái kiểm chứng 39: persisted shadow toggle, quality precedence và BrowserPanel reload persistence đã pass. Cụm `sống bên ngoài sẽ bự dần thay vì chỉ rộng 1 ô` đã được đối chiếu với implementation hiện hữu và được xử lý như typo `sông bên ngoài`: sông trang trí chỉ ngoài arena giữ bề rộng 1 ô sát biên rồi rộng dần theo khoảng cách khỏi sân, không đổi gameplay grid/river trong arena. `tests/scenery-presentation.test.ts` kiểm tra sông vẫn ngoài arena, có meander nhiều vị trí X, bề rộng gần > 1 và bề rộng xa tăng > 2 so với gần; targeted suite pass 2/2. Mục 39 vẫn mở vì còn thiếu đánh giá hiệu năng mobile và pixel proof đèn lồng chi tiết hơn.

Nghiệm thu: loading bắt đầu với title trắng và tiến độ tải thực làm đổi màu từng ký tự TITLE đúng thứ tự trái → phải, trên → dưới; SVG rõ ở slot nhỏ; emoji đồng nhất trên thiết bị; bóng đổ bật/tắt được và được lưu; đánh giá hiệu năng trên mobile khi bật bóng.
- Trạng thái kiểm chứng visual 37/38/39: không nâng checkbox chỉ từ source/tests. 37 và 38 còn thiếu pixel proof ở slot/thiết bị; 39 đã có shadow toggle + persistence/quality independence và regression cho sông ngoài sân rộng dần, nhưng còn thiếu mobile performance và pixel proof đèn lồng.

### 6. Thông tin trận, inventory thú và chế tạo

Điểm bắt đầu: `src/app/screens.ts`, `src/ui/modal.ts`, `src/core/inspection.ts`, `src/core/equipment.ts`, `src/core/craft.ts`, `src/core/synergy.ts`, `src/core/environment.ts`, `src/core/run.ts`.

- [ ] **40 — Hub Thông tin trong trận:** thiết kế giao diện nhiều tab có tương tác, gồm:
  - Tổng quan: vòng/chu kỳ, trạng thái trận và các chỉ số cần quan sát nhanh.
  - Thời tiết: hiện tại, dự báo vòng sau và vòng kế tiếp; phân biệt thông tin đã xác định và dự báo.
  - Hai phe: lực chiến và máu, có thanh so sánh cùng chỉ số cụ thể.
  - Đội hình: liệt kê thú phe ta/phe địch; bấm mở modal thú với trang bị theo hướng inventory như Ninja School.
  - Cộng hưởng: đưa nội dung từ modal cũ vào đây.
  - Hiệu ứng/chúc phúc: mô tả ảnh hưởng hiện tại và thứ tự thời tiết ở mục 43.
  - Lịch sử giao tranh: giữ các vòng trước và có điều hướng xem lại.
  - Brainstorm thêm thông tin hữu ích từ dữ liệu game đang có; ưu tiên thanh chỉ số, icon, thẻ và nút thao tác, tránh màn hình chỉ có chữ.
- [ ] **41 — Gộp kho đồ và chế tạo:** dùng một nút `Chế tạo` để truy cập cả kho vật phẩm, trang bị và bàn chế tạo 3×3. Phục hồi hành vi/công thức từ `old_src`; thể hiện nguyên liệu, kết quả, thiếu nguyên liệu và thao tác chế tạo rõ ràng.
- [ ] **42 — Inventory từng thú:** bấm thú trên sân hoặc trong danh sách mở inventory gồm portrait, thanh chỉ số và trang bị. Thú phe ta có nút Chọn và **Bán thú**; không nhầm với bán trang bị. Thú phe địch xem được ở chế độ chỉ đọc, không sửa/bán/chuyển trang bị qua bất kỳ đường thao tác nào.
  - Hiển thị ba lớp chỉ số: **gốc**; **sau trang bị, môi trường và modifier**; **hiện tại trong giao tranh** gồm máu đã mất và hiệu ứng đang hoạt động.
  - Xem chi tiết từng buff/debuff: nội dung, nguồn, thời hạn nếu có và ảnh hưởng thực tế lên thú đang xem.

Nghiệm thu: mở thú từ sân và từ tab đội hình cho cùng thông tin; bán đúng thú và cập nhật tài nguyên; thú địch không bị sửa state; chỉ số không cộng buff hai lần; kho và chế tạo nằm trong một luồng dùng được trên mobile.
- Trạng thái kiểm chứng 40: BrowserPanel đã mở các tab Thông tin và xác nhận Tổng quan/Thời tiết/Hai phe/Đội hình/Cộng hưởng/Hiệu ứng với dữ liệu live. Lần bấm `Bắt đầu (-1 ❤️)` thực tế gần nhất không vào combat vì 0 thú triển khai; snapshot sau đó vẫn là `Chuẩn bị`, `Chu kỳ —`, `Thú trên sân 0`, nên tiêu chí chu kỳ combat non-null còn mở.
- Trạng thái kiểm chứng 41: source hiện có một luồng Inventory → Chế tạo → Công thức với bàn 3×3; staging không phá bag, `activeIndices(...)` giới hạn ô theo cấp bàn và `craft(...)` commit nguyên tử khi recipe + bag hợp lệ. Runtime crafting bằng dữ liệu gameplay thật vẫn cần nguyên liệu thật; không inject save/materials. Dataset đầy đủ 506 công thức chưa có nguồn authoritative trong repo: `RECIPES` hiện chỉ chứa tutorial recipe `blue_buff`, nên completeness của recipe catalog vẫn là dependency bên ngoài thay vì tự bịa dữ liệu.
- Trạng thái kiểm chứng 42: enemy detail readonly đã được xác nhận live. Owned-unit inventory dùng chung owner/path trong source cho board selection và Information → Đội hình, nhưng nghiệm thu hai entry point trên một thú phe ta thật còn bị chặn bởi việc không thể triển khai thú qua BrowserPanel canvas trong session hiện tại.

### 7. Chúc phúc hồi tim và thời tiết

Điểm bắt đầu: `src/core/augments.ts`, `src/core/environment.ts`, `src/core/combat.ts`, `src/core/run.ts`, UI chúc phúc và tab Thông tin.

- [x] **43 — Kiểm tra và mở rộng chúc phúc:** xác minh các chúc phúc hiện có, bổ sung nhiều loại `Hồi tim` với mô tả và điều kiện kích hoạt rõ ràng.
- [ ] **44 — Chúc phúc thời tiết:** thêm loại chúc phúc thời tiết; khi có nhiều chúc phúc, người chơi chỉnh thứ tự qua UI. Đầu mỗi chu kỳ kích hoạt một chúc phúc tiếp theo, không kích hoạt hết trong chu kỳ đầu; ví dụ bốn chúc phúc lần lượt cho bốn chu kỳ. Các thú sống sót đến chu kỳ mới mới hưởng tác động ở chu kỳ đó.
  - Xác định hành vi sau khi hết hàng đợi, thời gian tác động, việc lưu thứ tự và thời điểm cho phép đổi thứ tự trước khi viết logic.
  - Đồng bộ thứ tự xử lý với Thiêu đốt và các hiệu ứng đầu chu kỳ; đảm bảo mỗi lượt chúc phúc kích hoạt một lần.
- Trạng thái kiểm chứng 44: phần đã có authority gồm weather-blessing IDs → environment mapping, queue normalization, UI reorder/persistence và consume đúng một blessing theo mỗi surviving-cycle boundary. Phần còn thiếu authority/implementation là effect payload thực tế lên thú sống sót, lifetime/scope, thứ tự tương tác chi tiết với effect đầu chu kỳ và semantics sau khi queue cạn; không suy diễn các phần này.

Nghiệm thu: bốn chúc phúc phân bổ đúng bốn chu kỳ; thú đã chết không hưởng lượt mới; đổi thứ tự phản ánh đúng trên UI và runtime; load/replay không làm kích hoạt trùng.

### 8. Trình quản lý gói mở rộng

Điểm bắt đầu: `src/mods/ModRegistry.ts`, `src/app/screens.ts`, `src/ui/modal.ts`, `public/mods/index.json`.

- [ ] **45 — Mod manager toàn màn hình:** nút Quản lý mod mở dialog toàn màn hình, có vùng header, điều hướng, danh sách và chi tiết gói; thích ứng desktop/mobile.
- [ ] **46 — Hub có thao tác thực tế:** nghiên cứu thiết kế trên mạng khi triển khai, chọn hướng phù hợp mod selector và theme game. Đề xuất các khu Khám phá, Đã cài, Đang bật, Cập nhật; card gói có icon, tên, tác giả, phiên bản, trạng thái và nút hành động. Kết nối các hành động mà hệ thống thực sự hỗ trợ, như bật/tắt, xem chi tiết, cài/import, gỡ và sắp thứ tự; thể hiện rõ phụ thuộc/xung đột/lỗi nếu có. Không dùng nút giả hoặc màn hình toàn chữ; ghi nguồn tham khảo khi chọn thiết kế.

Nghiệm thu: mở toàn màn hình đúng; điều hướng, lọc/chọn gói và hành động có phản hồi; có trạng thái rỗng, tải và lỗi; thay đổi mod phản ánh đúng registry và được lưu theo khả năng hệ thống.
- Trạng thái kiểm chứng 45: full-screen Mod manager, tab/import/summary/validation và empty state đã có source/runtime evidence; vẫn mở vì chưa có pixel acceptance desktop/mobile.
- Trạng thái kiểm chứng 46: live registry `public/mods/index.json` đang rỗng. UI chỉ expose capability ModRegistry thực sự hỗ trợ; empty/read-only/validation path đã có evidence, nhưng enable/disable/remove/reorder trên package production thật chưa thể nghiệm thu nếu không có package thật. Không dùng fixture/injected package để thay cho production acceptance.

## Thứ tự thực hiện và phụ thuộc

1. Bảo toàn thay đổi, cập nhật code, tìm `old_src`, tái hiện các lỗi và ghi baseline.
2. Làm font, màu chữ, component button/card/modal và responsive; đây là nền cho các màn hình tiếp theo.
3. Làm menu/HUD, âm thanh, shortcut, portrait và tooltip; thống nhất nguồn icon/SVG.
4. Làm tab thư viện, Thông tin, inventory thú, kho/chế tạo và mod manager.
5. Sửa timeline combat, mốc damage, hiệu ứng đầu chu kỳ, màu ô và kéo thả; sau đó tích hợp chúc phúc thời tiết.
6. Hoàn thiện loading, đèn lồng, bóng đổ và yêu cầu bên ngoài sân sau khi xác minh ý nghĩa.
7. Kiểm tra tích hợp, hiệu năng và đối chiếu toàn bộ checklist 01–46 trước khi hoàn tất.

Phụ thuộc quan trọng: dữ liệu `old_src` trước mục 24/26/33/41; component chung trước các màn hình thư viện và inventory; mô hình chu kỳ trước mục 32/44; nguồn emoji/SVG trước khi chốt nhãn tiêu hao và asset UI.

## Phụ lục A. Đối chiếu prompt gốc → checklist hiện tại

Số ở cột “Nguồn” là thứ tự gạch đầu dòng trong `Pasted text.txt`; số ở cột “Plan” là requirement hiện tại. Việc gom/đổi số không làm thay đổi phạm vi. Các đính chính ngày 17/10/2026 luôn ưu tiên hơn wording gốc khi có xung đột.

| Nguồn | Plan | Đối chiếu |
| ---: | ---: | --- |
| 1 | 01 | Pull code mới. |
| 2 | 02 | Heading/title/button dùng MTD Amstrong. |
| 3 | 03 + 03A | Đã bị đính chính: Normal = MTD Ampihan; Bonestay chuyển sang Story; Heading giữ nguyên. |
| 4 | 09 | Mobile dọc, ẩn label cạnh phải và thêm nút Cửa hàng thú. |
| 5 | 04 | Đã bị đính chính: màu chữ theo nền thực tế, không “mọi chữ đen”. |
| 6 | 05 | Đính chính mới nhất: nhãn hiển thị là `Thích nghi`; internal value `adaptive` giữ nguyên nếu cần. |
| 7 | 05 | Đính chính mới nhất: `<số> Khung hình trên giây`, ví dụ `60 Khung hình trên giây`; không đổi logic FPS. |
| 8 | 07 | Nút Đặt lại phím tắt và layout hẹp. |
| 9 | 08 | Modal, page-scroll, safe area và khoảng trống cho scrollbar. |
| 10 | 10 | Bỏ Thông tin khỏi menu chính. |
| 11 | 11 | Discord icon + link cộng đồng. |
| 12 | 12 | QR ủng hộ bên phải nút mệnh giá + khung. |
| 13 | 13 | Cộng hưởng chuyển vào Thông tin. |
| 14 | 14 | Panel Bắt đầu biến mất hoàn toàn; HUD gọn bên trái. |
| 15 | 15 | Bỏ dấu chấm khỏi nhãn Bắt đầu. |
| 16 | 16 | Nút tiêu hao dạng ngoặc tròn với số lượng + emoji. |
| 17 | 17 | Nút `<`/`>` nhạc cùng cỡ stepper thường. |
| 18 | 21 | Card thư viện/shop dùng common structure và safe area info. |
| 19 | 22 | Portrait thú quay 360° và canvas khớp panel. |
| 20 | 23 | Nút hành động preview cùng hệ xanh với Rảnh rỗi. |
| 21 | 24 | Bảng gacha/xác suất theo level từ nguồn cũ, đưa vào thư viện. |
| 22 | 25 | Cooldown idle + yêu cầu “thú thể”; giữ phần mơ hồ để xác minh trước khi đổi rộng. |
| 23 | 26 | Tooltip thú từ old_src. |
| 24 | 27 | HP%, heart/rage/lightning placement và live update. |
| 25 | 18 | Xóa Tiết kiệm pin. |
| 26 | 19 | Music toggle tách khỏi Sound. |
| 27 | 20 | D→R và ShiftRight cho Ván mới. |
| 28 | 06 | Đã bị đính chính: sizing theo ngữ cảnh; không `fit-content` máy móc toàn bộ. |
| 29 | 39 | Shadow theo ánh sáng + toggle cài đặt. |
| 30 | 30 | Lịch sử giao tranh không reset theo vòng. |
| 31 | 31 | Di chuyển xong → attack animation → damage đúng authored impact. |
| 32 | 32 | Burn/DOT tick ở đầu chu kỳ. |
| 33 | 33 | Màu ô scan/skill/direct/splash + preview/combat hai phe. |
| 34 | 34 | Hover làm sáng mọi ô hợp lệ, gồm nước/dự bị. |
| 35 | 37 | Tự vẽ SVG vật phẩm/trang bị. |
| 36 | 35 | Kéo thả thú theo con trỏ. |
| 37 | 36 | Loading title ban đầu trắng; rainbow theo ký tự TITLE trái→phải, trên→dưới. |
| 38 | 39 | Làm đèn lồng chi tiết hơn. |
| 39 | 29 | Thư viện nhiều tab. |
| 40 | 45 | Mod manager full-screen. |
| 41 | 40 + 46 | UI/UX phải có control/action thực, không phải màn hình toàn chữ. |
| 42 | 40 | Hub Thông tin: forecast, lực chiến/máu, đội hình, modal thú, dữ liệu đa dạng. |
| 43 | 41 | Gộp kho đồ + chế tạo thành một luồng, bàn 3×3. |
| 44 | 42 | Inventory từng thú, ba lớp chỉ số, buff/debuff; enemy readonly; bán thú. |
| 45 | 38 | Emoji dùng nguồn ảnh/API chung; item/equipment dùng SVG riêng. |
| 46 | 43 | Bổ sung nhiều loại chúc phúc Hồi tim dựa trên semantics có thật. |
| 47 | 44 | Chúc phúc thời tiết có thứ tự, một lượt mỗi chu kỳ, survivor mới hưởng. |
| 48 | 28 | Hover ưu tiên popup của thú đang trỏ. |
| 49 | 39 | `sống bên ngoài sẽ bự dần...` đã được đối chiếu với scenery hiện hữu như typo `sông bên ngoài`; triển khai widening chỉ cho sông trang trí ngoài arena và giữ gameplay grid canonical. |

Kết quả rà soát: không có gạch đầu dòng nguồn nào bị bỏ khỏi plan. Các chỗ diễn giải sai thật đã được sửa ở 04/05/06; 03/03A là yêu cầu bổ sung mới thay thế font Normal cũ; 36 được khóa ngoại lệ loading để quy tắc màu chung không ghi đè.

## Phụ lục B. Task phát sinh trong quá trình thực hiện

- OMP và các agent cộng tác được chủ động tạo, ưu tiên và thực hiện task phát sinh liên quan khi có bằng chứng thực tế; phạm vi không bị giới hạn cứng ở Requirement 01–46 và không cần xin phép lại cho từng sửa chữa thông thường nằm trong goal đã giao.
- Mỗi task phát sinh dùng ID ổn định dạng `PS-NNN` và phải ghi ngắn gọn: vấn đề; thực tế so với kỳ vọng; bằng chứng/cách tái hiện; ảnh hưởng/mức ưu tiên; phạm vi sửa; tiêu chí nghiệm thu; phụ thuộc/owner khi cần. Không đánh lại số 01–46.
- Task phát sinh phải được ghi ở cả plan này và TODO đang chạy. Tạo task chỉ ghi nhận công việc; không đồng nghĩa task đã hoàn tất và không được xóa evidence/checklist cũ.
- Phân biệt rõ lỗi đã xác minh với giả thuyết/câu hỏi yêu cầu. Không tự chế gameplay semantics hoặc thay quyết định mới nhất của user; yêu cầu thật sự chưa rõ hay thay đổi thiết kế lớn phải vào phần cần xác minh riêng, trong khi phần độc lập vẫn tiếp tục.
- Khi bàn giao cuối, đối chiếu toàn bộ `PS-NNN` cùng Requirement/checklist còn mở; không âm thầm bỏ sót task bắt buộc và không tạo bug/task minh họa nếu chưa có bằng chứng.
- **Policy OMP Advisor cho goal này:** khi built-in Advisor hoạt động, Advisor phải chủ động review yêu cầu mới nhất, caller/state/persistence, UI thực tế, regression và acceptance ở mỗi mốc subsystem/implementation và bắt buộc trước khi tick hoàn tất. Round nhỏ có thể gom tối đa khoảng 3 tool-call rounds nhưng không được bỏ completion review. Note có bằng chứng phải được lead chuyển thành `PS-NNN` ổn định ngay vòng kế tiếp; hypothesis chưa đủ bằng chứng phải ghi `cần xác minh`, không được nâng thành verified bug. Advisor chỉ review/note; lead vẫn chịu trách nhiệm nghiệm thu và không dùng task subagent/judge thay Advisor.
- **Trạng thái Advisor runtime (18/10/2026):** native Advisor tồn tại, `advisor.reviewMode=turn`, `advisor.reviewInterval=1`, nhưng `advisor.enabled=false`. Tài liệu runtime xác nhận `modelRoles.advisor` là role hợp lệ và khi unset sẽ dùng `slow`/strong-model fallback. Yêu cầu binding riêng Advisor vào Web model `openai-codex/chatgpt-web/gpt-5.6-sol:high` chưa áp dụng được: lần ghi live `modelRoles` đã mở approval prompt và hết hạn, tool xác nhận không có thay đổi; theo policy không retry thao tác đó nếu user chưa yêu cầu lại. Vì chưa bind đúng Web model nên chưa bật Advisor bằng fallback khác để tránh chạy sai model so với chỉ đạo.

### Danh sách task phát sinh

- **PS-001 — Loại bỏ API Three.js đã bị deprecate/removed trong runtime.** Vấn đề đã xác minh: live BrowserPanel console lặp `THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.` và `THREE.WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead.`; source tương ứng nằm ở `src/world/stage.ts` và `src/units/portraits.ts`. Thực tế hiện tại: runtime tự fallback shadow type và phát warning mỗi lần khởi tạo; kỳ vọng: dùng API hợp lệ của Three 0.186 mà không đổi gameplay/render-loop ownership. Ảnh hưởng: **P2 / compatibility + console-noise**, có thể che lỗi thật và làm cấu hình shadow khác với tên constant source. Phạm vi sửa: thay `Clock` bằng `Timer` theo đúng `update()`/delta lifecycle, dùng shadow-map type còn hỗ trợ, dispose timer khi owner teardown. Nghiệm thu: targeted/typecheck/build phù hợp pass; reload BrowserPanel không còn hai warning này; FPS throttling, portrait auto-yaw và shadow toggle vẫn hoạt động. Owner: OMP; dependency: none.
  - **Trạng thái: hoàn tất.** Source đã chuyển `THREE.Clock` → `THREE.Timer`, `PCFSoftShadowMap` → `PCFShadowMap`, dừng animation loop trước dispose và dispose timer. Verify: targeted `camera/scenery/arena-mapping/performance-profiler` pass 4 files / 15 tests; typecheck/build trước đó pass; BrowserPanel reload generation 16 tạo main stage rồi mở portrait detail mà không có entry `THREE.Clock` hoặc `PCFSoftShadowMap` mới sau timestamp boundary `1792296672511`. Shadow enable/quality independence và FPS limiting paths được cover bởi targeted tests/source; portrait auto-yaw loop vẫn cập nhật yaw bằng Timer delta.

## Phụ lục C. Các điểm cần xác minh khi triển khai

- `thú thể`: giữ nguyên thuật ngữ được yêu cầu trong kế hoạch; xác nhận ý nghĩa và nhãn/tên biến phù hợp trước khi đổi rộng toàn code.
- `sống bên ngoài`: đã chốt theo evidence source/runtime hiện có là typo `sông bên ngoài`; implementation chỉ nới rộng sông trang trí ngoài arena theo khoảng cách, không thay đổi gameplay grid hay sông trong arena.
- Vị trí đứng trước/sau mục tiêu theo role: đối chiếu quy tắc staging cũ và xử lý ô bị chiếm, mục tiêu xa, nhiều thú cùng hành động.
- Chúc phúc thời tiết: quyết định có lặp lại hàng đợi sau lượt cuối hay không, thời hạn tác động và giới hạn chỉnh thứ tự.
- Mọi việc độc lập tiếp tục được trong lúc xác minh các điểm trên; không chặn toàn bộ kế hoạch.

## Nghiệm thu và bàn giao

- [x] Toàn bộ kiểm thử trình duyệt và kiểm tra trực quan dùng 1DevTool Browser MCP, tuân thủ quy định công cụ kiểm thử ở trên.
- [x] Chạy `pnpm typecheck`, `pnpm test`, `pnpm build` sau các thay đổi tương ứng; ghi lỗi baseline riêng nếu có. Final verification 18/10/2026 hiện tại: `pnpm typecheck` pass; `pnpm build` pass; `pnpm run test:changed` pass 28 files / 224 tests; `pnpm test` pass 51 files / 383 tests; targeted suites liên quan cũng pass.
- [x] Bổ sung test có ý nghĩa cho timeline damage/chu kỳ, xác suất shop, persistence lịch sử, quyền chỉ đọc thú địch, âm thanh và hàng đợi thời tiết; không viết test chỉ để mô phỏng lại CSS. Final checklist suite 18/10/2026 chạy `combat`, `economy`, `achievements-history`, `wave7-diagnostics`, `audio-*`, `blessings` và pass 8 files / 87 tests.
- [ ] Kiểm tra trực quan desktop, mobile dọc/ngang và viewport hẹp; đề xuất mốc 360×800, 390×844, 844×390, 1280×720 và 1920×1080. Trong cùng lượt nghiệm thu, xác nhận chữ trắng trên vùng gỗ nâu/tối, chữ đen trên vùng sáng kiểu bạch dương, không suy màu từ khung ngoài; xác nhận button sizing theo từng control/layout và không tràn/chồng ở nhãn dài hoặc bản dịch; xác nhận loading vẫn bắt đầu title trắng trước khi rainbow theo tiến độ.
- [ ] Kiểm tra chuột, cảm ứng, kéo thả, phím R/ShiftRight, modal cuộn nội bộ, chuyển tab và reload dữ liệu đã lưu.
- [ ] Kiểm tra combat ở nhiều tốc độ, lúc di chuyển/đánh/chết và qua vòng mới; đối chiếu preview, HP, damage nổi và lịch sử.
- [ ] Chụp ảnh hoặc video các thay đổi UI/animation quan trọng để nghiệm thu.
- [x] Đánh dấu từng mục hoàn thành chỉ khi đáp ứng tiêu chí; ghi rõ phụ thuộc còn thiếu, quyết định về điểm mơ hồ và phần chưa triển khai. Các mục visual/input/live-data chưa có evidence trực tiếp vẫn được giữ mở.

Trạng thái bàn giao hiện tại: checklist 245–248 giữ mở vì còn thiếu direct visual/input/combat evidence. Requirement 17 đã được đóng bằng ảnh BrowserPanel thật ở viewport 581×719. Các Requirement còn mở hiện là 03/04/06/08/12/14/21/22/23/26/33/37/38/39/40/41/42/44/45/46. Bằng chứng 581×719 hiện có chỉ bao phủ Settings: màu chữ đúng trên vùng gỗ nâu/bạch dương đã quan sát, body tiếng Việt có dấu đọc rõ và khác Heading, control nhạc có parity kích thước và panel ổn định không clipping; không suy rộng thành acceptance cho Story, toàn game hoặc mọi viewport. BrowserPanel catalog current-state 18/10/2026 có 16 browser_* tools nhưng không có primitive pointer-move/drag theo tọa độ hoặc resize. Đường `view_image` native của Codex hiện tại cũng trả lỗi rằng turn này không advertise `view_image`/native exec gateway; đây chỉ là giới hạn của đường phân tích ảnh nội bộ, không phủ nhận bằng chứng ảnh BrowserPanel do điều phối quan sát trực tiếp. 33/40/42 đang được rà lại đường deploy production trước khi chốt blocker; 41 tách UI/atomic crafting khỏi thiếu authored recipe dataset; 44 thiếu authoritative blessing effect/lifetime/scope/application contract; 46 thiếu package production thật để nghiệm thu mutation. Không fabricate save/game state, materials, blessing semantics hoặc mod catalog để vượt acceptance.
- Final verification 18/10/2026: `pnpm typecheck` pass; `pnpm build` pass; `pnpm run test:changed` pass 28 files / 224 tests; handoff checklist suite pass 8 files / 87 tests; `pnpm test` pass 51 files / 383 tests; `git diff --check` sạch. Gameplay/scenery targeted suite gần nhất pass 13 files / 89 tests và focused UI/audio suite gần nhất pass 6 files / 39 tests. BrowserPanel current-state bổ sung: reload thành công tới `documentGeneration = 14`; sau reload UI trở lại menu đầy đủ; Settings → Hiển thị vẫn có `Bóng đổ: Tắt`, `Chất lượng đồ họa: Cao`, `Khung hình: Thích nghi`, `60 Khung hình trên giây`, nên persistence reload của shadow/display state đã được xác nhận. Console logs hiện đọc được; quan sát thực tế gồm Vite HMR websocket không kết nối và warning Three.js về `THREE.Clock` deprecated cùng `PCFSoftShadowMap` đã bị loại bỏ. Settings → Phím tắt trước đó đã xác nhận `R` cho Đổi thú, `SHIFTRIGHT` cho Ván mới và `Escape` đóng modal thật.
