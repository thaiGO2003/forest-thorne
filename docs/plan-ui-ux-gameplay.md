# Kế hoạch cập nhật Forest Throne

Ngày lập: 14/10/2026. Trạng thái: chưa triển khai; các checkbox là việc cần kiểm tra và thực hiện, không phải xác nhận lỗi đã được tái hiện.

## Mục tiêu và phạm vi

Triển khai toàn bộ yêu cầu UI/UX, thư viện, thú, âm thanh, đồ họa và giao tranh trong danh sách người dùng cung cấp. Ưu tiên giao diện dùng được trên mobile dọc, thông tin rõ ràng và animation khớp diễn biến giao tranh.

File này chỉ lập kế hoạch. Việc kéo code, sửa gameplay và nghiên cứu thiết kế trên mạng thuộc các bước triển khai bên dưới.

## Quy định công cụ kiểm thử

- **Không được kiểm thử bằng Chrome**, kể cả Chrome headless hoặc automation chạy Chrome.
- **Bắt buộc dùng 1DevTool Browser MCP** (`onedevtool` browser_* tools, BrowserPanel) cho kiểm thử trình duyệt: kiểm tra UI/UX, tương tác, responsive và chụp ảnh nghiệm thu.
- Nếu 1DevTool Browser MCP chưa khả dụng, ghi rõ phần kiểm thử trình duyệt còn thiếu; không tự chuyển sang Chrome.
- Các lệnh kiểm tra TypeScript, unit test và build vẫn chạy bằng `pnpm` như kế hoạch.

## Hiện trạng và chuẩn bị

- Checkout đang có nhiều thay đổi chưa commit. Trước khi pull, kiểm tra branch, remote và diff; bảo toàn thay đổi hiện có bằng commit hoặc phương án lưu phù hợp, rồi cập nhật code và xử lý xung đột.
- Hai font yêu cầu đã có: `public/fonts/Heading - MTD Amstrong.otf` và `public/fonts/Normal - Bonestay.otf`.
- Chưa thấy thư mục `old_src` trong checkout hiện tại. Tìm lại qua lịch sử Git, branch hoặc nguồn dự án cũ trước khi phục hồi bảng gacha, tooltip, màu ô và chế tạo 3×3. Không tự đoán dữ liệu cũ.
- Tài liệu tham khảo của dự án: `docs/opus-5.5-forest-throne-rebuild-mega-prompt.md`. Nếu yêu cầu mới khác tài liệu cũ, ưu tiên yêu cầu mới trong kế hoạch này.
- Đường dẫn code trong từng giai đoạn là điểm bắt đầu rà soát, không giới hạn phạm vi sửa.

## 1. Cập nhật nguồn và chuẩn hóa giao diện

Điểm bắt đầu: `src/ui/ui.css`, `src/ui/kit.ts`, `src/ui/modal.ts`, `src/ui/settings.ts`, `src/core/i18n.ts`, `src/core/settings.ts`.

- [ ] **01 — Pull code mới:** cập nhật nguồn sau khi bảo toàn các thay đổi đang có; xác định baseline để kiểm tra hồi quy.
- [ ] **02 — Font tiêu đề và nút:** toàn bộ title game và button dùng `Heading - MTD Amstrong.otf`; kiểm tra cả nút chỉ có ký hiệu.
- [ ] **03 — Font nội dung:** toàn bộ chữ còn lại dùng `Normal - Bonestay.otf`, gồm HUD, dialog, modal, tooltip, thư viện và nội dung thiết lập.
- [ ] **04 — Màu chữ:** chữ trong dialog, tooltip, modal và nội dung game chuyển sang đen. Nút giữ màu chữ hiện có và chỉ đổi font. Loading screen áp dụng ngoại lệ ở mục 36.
- [ ] **05 — Thuật ngữ:** nhãn độ phân giải hiển thị `adaptive` thay cho `Thích nghi`; hiển thị `60 FPS` thay cho `60 tốc độ khung hình trên giây`.
- [ ] **06 — Kích thước nút:** mặc định vừa nội dung (`fit-content`); chỉ giữ quy tắc giãn rộng cho các trường hợp bố cục thực sự cần. Kiểm tra cả nhãn dài và bản dịch.
- [ ] **07 — Phím tắt trong cài đặt:** sửa các nút như `Đặt lại phím tắt` bị dính vào nút `M` khi màn hình hẹp; tham khảo bố cục tab Dữ liệu.
- [ ] **08 — Modal và vùng an toàn:** không để browser/page xuất hiện thanh cuộn khi modal mở. Nội dung dài cuộn trong vùng modal; tăng khoảng đệm cả bốn cạnh, tăng thêm phía phải cho scrollbar; nút đóng dạng dấu `-` không đè lên nội dung. Phân biệt khoảng đệm nội bộ và safe area thiết bị.

Nghiệm thu: font tải đúng và không mất dấu tiếng Việt; button giữ màu chữ; nội dung đọc rõ trên nền; modal không gây cuộn trang, không tràn ngang và không che nút đóng.

## 2. Menu, HUD, thao tác và âm thanh

Điểm bắt đầu: `src/ui/menu.ts`, `src/ui/planning.ts`, `src/ui/combat.ts`, `src/app/screens.ts`, `src/app/app.ts`, `src/core/settings.ts`, `src/audio/`.

- [ ] **09 — Mobile dọc:** các nút cạnh phải không hiện label che sân chơi. Panel cửa hàng mặc định ẩn và mở bằng nút mới `Cửa hàng thú`; đóng/mở được bằng cảm ứng.
- [ ] **10 — Menu chính:** bỏ nút Thông tin khỏi menu chính; vẫn có nút Thông tin trong trận cho các tab ở mục 40.
- [ ] **11 — Cộng đồng:** dùng Discord icon và mở link `https://discord.gg/FH9bGFm9G`.
- [ ] **12 — Ủng hộ:** QR nằm bên phải các nút mệnh giá và có khung phù hợp giao diện. Với viewport quá hẹp, bố cục responsive phải giữ QR đọc được và các nút thao tác được.
- [ ] **13 — Cộng hưởng:** bỏ modal Cộng hưởng riêng; đưa nội dung vào nút Thông tin.
- [ ] **14 — Bắt đầu và HUD:** phần modal/panel liên quan nút Bắt đầu phải biến mất hoàn toàn khi đóng, không còn trạng thái thu nhỏ hoặc lớp chặn thao tác. Vòng, tim, vàng, cấp và Ra trận nằm gọn bên trái nút Bắt đầu.
- [ ] **15 — Nhãn Bắt đầu:** bỏ dấu chấm khỏi nút.
- [ ] **16 — Nút tiêu hao:** thống nhất dạng ngoặc tròn chứa số lượng và emoji tài nguyên, ví dụ `Mua (1 🪙)`; áp dụng mua cấp, mua thú, sơ đồ công nghệ và các thao tác tiêu hao khác. Giá hiển thị phải khớp giá thực tế.
- [ ] **17 — Điều khiển nhạc:** nút `<` và `>` của bản nhạc có kích thước tương đương các nút `<` và `>` thông thường.
- [ ] **18 — Tiết kiệm pin:** xóa nút Tiết kiệm pin; rà soát phần liên quan để tránh nút hoặc shortcut còn sót.
- [ ] **19 — Âm nhạc:** thêm nút bật/tắt Âm nhạc riêng. Tắt Âm thanh tắt cả nhạc và hiệu ứng; tắt Âm nhạc chỉ tắt nhạc. Bật lại Âm thanh tôn trọng trạng thái Âm nhạc đã lưu.
- [ ] **20 — Phím mặc định:** đổi phím đổi tướng từ `D` sang `R`; dùng Shift bên phải (`ShiftRight`) cho Ván mới. Cập nhật nhãn hướng dẫn, cấu hình mặc định và kiểm tra xung đột với cấu hình đã lưu.

Nghiệm thu: trên mobile dọc sân không bị label/panel che; các nút vừa nội dung nhưng vẫn dễ bấm; nút Bắt đầu không để lại overlay; kiểm tra đủ tổ hợp bật/tắt Âm thanh và Âm nhạc; Shift trái không kích hoạt Ván mới.

## 3. Thư viện, portrait, tooltip và hoạt ảnh thú

Điểm bắt đầu: `src/ui/library.ts`, `src/ui/card.ts`, `src/ui/tooltip.ts`, `src/units/portraits.ts`, `src/units/kit.ts`, `src/units/rig.ts`, `src/units/billboard.ts`, `src/core/economy.ts`.

- [ ] **21 — Card chung:** tăng khoảng đệm phần info dưới card thư viện; dùng component chung cho card thư viện và card trong modal mua thú để đồng nhất bố cục, chỉ số và tương tác.
- [ ] **22 — Portrait 360°:** avatar thú quay được đủ 360°, không chỉ trái/phải. Canvas portrait khớp vùng hiển thị của kit panel; kiểm tra khung hình, clipping và resize.
- [ ] **23 — Nút hành động:** toàn bộ nút preview hành động dùng màu xanh lá cùng hệ với nút Rảnh rỗi, gồm trạng thái hover, nhấn và disabled.
- [ ] **24 — Bảng gacha:** lấy bảng xác suất ra thú theo giá vàng và level từ `old_src`, đưa vào thư viện. UI phải lấy cùng nguồn dữ liệu với shop thực tế, có chú giải rõ giá thú và cấp người chơi.
- [ ] **25 — Rảnh rỗi và thú thể:** animation rảnh rỗi có cooldown ngẫu nhiên vài giây giữa các lần kích hoạt thay vì phát liên tục. Rà soát animation hiện chỉ chạy trong combat; đổi text và tên biến liên quan theo thuật ngữ người dùng yêu cầu là `thú thể`, thêm nút tương ứng cạnh Rảnh rỗi trong thư viện. Phân biệt rõ hai trạng thái sau khi xác minh tên gọi.
- [ ] **26 — Tooltip thú:** phục hồi nội dung và hành vi tooltip khi hover thú từ `old_src`; đối chiếu các trường thông tin với dữ liệu hiện tại, không chỉ hiển thị bản đơn giản.
- [ ] **27 — Máu và nộ:** thêm phần trăm máu phía phải thanh máu, ngay phía trên phần nộ; emoji tim nằm phía trên emoji sét; cập nhật đúng khi máu/nộ đổi.
- [ ] **28 — Popup ưu tiên hover:** thú đang được hover có popup tên, máu và nộ nổi trên popup các thú khác, đặc biệt khi đội hình dày; trả lại thứ tự bình thường khi hết hover.
- [ ] **29 — Thư viện nhiều tab:** bổ sung tab Thú, Vật phẩm, Trang bị, Chế tạo/công thức, Chúc phúc và Xác suất cửa hàng. Nội dung dựa trên catalog thực tế; có điều hướng và trạng thái chọn tab rõ ràng.

Nghiệm thu: card shop và thư viện dùng chung cấu trúc; mọi thú quay 360° và không bị cắt; animation có khoảng nghỉ, không chồng hành động; bảng xác suất khớp logic shop; popup hover đọc được trong đội hình đông.

## 4. Giao tranh, thời điểm sát thương và màu ô

Điểm bắt đầu: `src/core/combat.ts`, `src/core/combatStaging.ts`, `src/core/skills.ts`, `src/core/preview.ts`, `src/core/environment.ts`, `src/units/combatPlayer.ts`, `src/units/boardView.ts`, `src/world/boardPicking.ts`, `src/app/planningDrag.ts`.

- [ ] **30 — Lịch sử giao tranh:** xác minh lịch sử không bị xóa khi sang vòng mới; nếu đang bị xóa thì sửa vòng đời dữ liệu, phân biệt reset vòng và bắt đầu ván mới.
- [ ] **31 — Di chuyển → đánh → sát thương:** thú hoàn thành animation di chuyển và đứng giữa ô phía trước/phía sau mục tiêu theo role rồi mới phát animation đánh. Số damage nảy đúng lúc callback/mốc animation của chính thú gọi hiệu ứng; không nảy sớm hoặc muộn. Đối chiếu state gameplay, thanh máu và replay để diễn biến thống nhất.
- [ ] **32 — Sát thương theo chu kỳ:** damage như Thiêu đốt kích hoạt khi bắt đầu chu kỳ mới. Xác định rõ mốc chu kỳ của combat, thứ tự xử lý hiệu ứng và số lần tick để không áp dụng lặp.
- [ ] **33 — Màu ô và kỹ năng:** tham khảo `old_src`, áp dụng đối xứng cho phe ta và phe địch, cả preview và combat:
  - Ô đang được quét lần lượt phủ tím; phủ ô, không tô tím thú.
  - Thú triển khai kỹ năng có hiệu ứng rainbow.
  - Ô bị đánh trực tiếp, gồm đánh thường và kỹ năng trực diện, màu đỏ.
  - Ô bị ảnh hưởng bởi đòn lan màu vàng.
  - Quy định thứ tự hiển thị khi quét, hover và vùng đòn đánh chồng nhau để vẫn đọc được mục tiêu chính.
- [ ] **34 — Hover mọi ô:** hover bất kỳ ô hợp lệ đều làm sáng đúng ô đó, gồm cỏ, nước và ô dự bị; không chỉ ô cỏ.
- [ ] **35 — Kéo thả:** thêm animation thú di chuyển theo con trỏ khi kéo; hỗ trợ cảm ứng và xử lý thả, hủy, vị trí không hợp lệ, tránh model nhảy về vị trí sai.

Nghiệm thu: không có attack trước khi di chuyển xong; damage nổi đúng mốc impact do animation gọi, không bị nhân đôi; Thiêu đốt tick đúng đầu chu kỳ; preview và combat thống nhất đỏ/vàng; hover và kéo thả đúng trên cả hai phe, các loại ô và dự bị.

## 5. Loading, asset và đồ họa môi trường

Điểm bắt đầu: `src/ui/loading.ts`, `src/core/emojiIcon.ts`, `src/core/equipment.ts`, `src/world/scenery.ts`, `src/world/arena.ts`, `src/world/stage.ts`, `src/core/settings.ts`, `public/assets/`.

- [ ] **36 — Loading rainbow:** title game ban đầu màu trắng. Khi tải tăng đến phần trăm nào, số ký tự tương ứng đổi sang màu cầu vồng, theo thứ tự trái sang phải và trên xuống dưới; kết thúc tải thì hoàn tất toàn bộ title.
- [ ] **37 — SVG vật phẩm và trang bị:** tự vẽ bộ SVG đồng nhất, dễ phân biệt loại/rarity và đọc được ở kích thước nhỏ; nối asset vào inventory, card, tooltip và slot trang bị.
- [ ] **38 — Emoji thống nhất:** mọi emoji dùng cùng nguồn API/asset bên ngoài, có lớp ánh xạ dùng chung cho DOM và canvas. Chọn nguồn, kiểm tra điều kiện sử dụng, cache và fallback ảnh để không hiện ký tự `?` khi thiếu font; vật phẩm/trang bị dùng SVG tự vẽ ở mục 37.
- [ ] **39 — Ánh sáng, đèn lồng và bên ngoài sân:** thêm bóng đổ cho vật thể khi có ánh sáng, có tùy chọn bật/tắt trong cài đặt; làm đèn lồng chi tiết hơn. Làm rõ yêu cầu nguyên văn `sống bên ngoài sẽ bự dần thay vì chỉ rộng 1 ô`, rồi điều chỉnh kích thước/tăng trưởng đúng đối tượng; chưa mặc định đó là sóng nước hay viền sân.

Nghiệm thu: tiến độ loading phản ánh tải thực và màu ký tự đúng thứ tự; SVG rõ ở slot nhỏ; emoji đồng nhất trên thiết bị; bóng đổ bật/tắt được và được lưu; đánh giá hiệu năng trên mobile khi bật bóng.

## 6. Thông tin trận, inventory thú và chế tạo

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

## 7. Chúc phúc hồi tim và thời tiết

Điểm bắt đầu: `src/core/augments.ts`, `src/core/environment.ts`, `src/core/combat.ts`, `src/core/run.ts`, UI chúc phúc và tab Thông tin.

- [ ] **43 — Kiểm tra và mở rộng chúc phúc:** xác minh các chúc phúc hiện có, bổ sung nhiều loại `Hồi tim` với mô tả và điều kiện kích hoạt rõ ràng.
- [ ] **44 — Chúc phúc thời tiết:** thêm loại chúc phúc thời tiết; khi có nhiều chúc phúc, người chơi chỉnh thứ tự qua UI. Đầu mỗi chu kỳ kích hoạt một chúc phúc tiếp theo, không kích hoạt hết trong chu kỳ đầu; ví dụ bốn chúc phúc lần lượt cho bốn chu kỳ. Các thú sống sót đến chu kỳ mới mới hưởng tác động ở chu kỳ đó.
  - Xác định hành vi sau khi hết hàng đợi, thời gian tác động, việc lưu thứ tự và thời điểm cho phép đổi thứ tự trước khi viết logic.
  - Đồng bộ thứ tự xử lý với Thiêu đốt và các hiệu ứng đầu chu kỳ; đảm bảo mỗi lượt chúc phúc kích hoạt một lần.

Nghiệm thu: bốn chúc phúc phân bổ đúng bốn chu kỳ; thú đã chết không hưởng lượt mới; đổi thứ tự phản ánh đúng trên UI và runtime; load/replay không làm kích hoạt trùng.

## 8. Trình quản lý gói mở rộng

Điểm bắt đầu: `src/mods/ModRegistry.ts`, `src/app/screens.ts`, `src/ui/modal.ts`, `public/mods/index.json`.

- [ ] **45 — Mod manager toàn màn hình:** nút Quản lý mod mở dialog toàn màn hình, có vùng header, điều hướng, danh sách và chi tiết gói; thích ứng desktop/mobile.
- [ ] **46 — Hub có thao tác thực tế:** nghiên cứu thiết kế trên mạng khi triển khai, chọn hướng phù hợp mod selector và theme game. Đề xuất các khu Khám phá, Đã cài, Đang bật, Cập nhật; card gói có icon, tên, tác giả, phiên bản, trạng thái và nút hành động. Kết nối các hành động mà hệ thống thực sự hỗ trợ, như bật/tắt, xem chi tiết, cài/import, gỡ và sắp thứ tự; thể hiện rõ phụ thuộc/xung đột/lỗi nếu có. Không dùng nút giả hoặc màn hình toàn chữ; ghi nguồn tham khảo khi chọn thiết kế.

Nghiệm thu: mở toàn màn hình đúng; điều hướng, lọc/chọn gói và hành động có phản hồi; có trạng thái rỗng, tải và lỗi; thay đổi mod phản ánh đúng registry và được lưu theo khả năng hệ thống.

## Thứ tự thực hiện và phụ thuộc

1. Bảo toàn thay đổi, cập nhật code, tìm `old_src`, tái hiện các lỗi và ghi baseline.
2. Làm font, màu chữ, component button/card/modal và responsive; đây là nền cho các màn hình tiếp theo.
3. Làm menu/HUD, âm thanh, shortcut, portrait và tooltip; thống nhất nguồn icon/SVG.
4. Làm tab thư viện, Thông tin, inventory thú, kho/chế tạo và mod manager.
5. Sửa timeline combat, mốc damage, hiệu ứng đầu chu kỳ, màu ô và kéo thả; sau đó tích hợp chúc phúc thời tiết.
6. Hoàn thiện loading, đèn lồng, bóng đổ và yêu cầu bên ngoài sân sau khi xác minh ý nghĩa.
7. Kiểm tra tích hợp, hiệu năng và đối chiếu toàn bộ checklist 01–46 trước khi hoàn tất.

Phụ thuộc quan trọng: dữ liệu `old_src` trước mục 24/26/33/41; component chung trước các màn hình thư viện và inventory; mô hình chu kỳ trước mục 32/44; nguồn emoji/SVG trước khi chốt nhãn tiêu hao và asset UI.

## Các điểm cần xác minh khi triển khai

- `thú thể`: giữ nguyên thuật ngữ được yêu cầu trong kế hoạch; xác nhận ý nghĩa và nhãn/tên biến phù hợp trước khi đổi rộng toàn code.
- `sống bên ngoài`: chưa rõ đối tượng và cách tăng kích thước theo thời gian/vòng; cần xác minh trước khi sửa môi trường.
- Vị trí đứng trước/sau mục tiêu theo role: đối chiếu quy tắc staging cũ và xử lý ô bị chiếm, mục tiêu xa, nhiều thú cùng hành động.
- Chúc phúc thời tiết: quyết định có lặp lại hàng đợi sau lượt cuối hay không, thời hạn tác động và giới hạn chỉnh thứ tự.
- Mọi việc độc lập tiếp tục được trong lúc xác minh các điểm trên; không chặn toàn bộ kế hoạch.

## Kiểm tra và bàn giao

- [ ] Toàn bộ kiểm thử trình duyệt và kiểm tra trực quan dùng 1DevTool Browser MCP, tuân thủ quy định công cụ kiểm thử ở trên.
- [ ] Chạy `pnpm typecheck`, `pnpm test`, `pnpm build` sau các thay đổi tương ứng; ghi lỗi baseline riêng nếu có.
- [ ] Bổ sung test có ý nghĩa cho timeline damage/chu kỳ, xác suất shop, persistence lịch sử, quyền chỉ đọc thú địch, âm thanh và hàng đợi thời tiết; không viết test chỉ để mô phỏng lại CSS.
- [ ] Kiểm tra trực quan desktop, mobile dọc/ngang và viewport hẹp; đề xuất mốc 360×800, 390×844, 844×390, 1280×720 và 1920×1080.
- [ ] Kiểm tra chuột, cảm ứng, kéo thả, phím R/ShiftRight, modal cuộn nội bộ, chuyển tab và reload dữ liệu đã lưu.
- [ ] Kiểm tra combat ở nhiều tốc độ, lúc di chuyển/đánh/chết và qua vòng mới; đối chiếu preview, HP, damage nổi và lịch sử.
- [ ] Chụp ảnh hoặc video các thay đổi UI/animation quan trọng để nghiệm thu.
- [ ] Đánh dấu từng mục hoàn thành chỉ khi đáp ứng tiêu chí; ghi rõ phụ thuộc còn thiếu, quyết định về điểm mơ hồ và phần chưa triển khai.
