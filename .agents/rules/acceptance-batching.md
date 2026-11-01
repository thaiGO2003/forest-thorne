# Acceptance batching — một cổng, một script, một lần chạy

Quy tắc này áp dụng cho mọi agent/người chạy nghiệm thu browser (QA) trên repo Forest Throne.

## Vấn đề

Nghiệm thu kiểu "mỗi assertion một lượt" (`eval` hover → `eval` click → `eval` đo màu → `eval`
screenshot) tốn một lượt model cho mỗi thao tác chuột. Đo trên session OMP ngày 2026-10-31:
**345 `eval` browser trong 2h40** cho một cổng, ~**$121** cho một buổi chiều, trong khi chỉ có
**2 commit** phát sinh sau 19:04. Phần lớn thời gian là round-trip, không phải công việc thật.

## Quy tắc

1. **Một acceptance matrix = một file `scripts/qa/<gate>.mjs`.** Script mở app một lần, seed
   state một lần, chạy toàn bộ chuỗi thao tác thật (mouse/keyboard), assert toàn bộ matrix, in
   JSON và trả exit code.
2. **Chạy bằng một lệnh:** `pnpm qa:<gate> <url>`. Agent chỉ đọc kết quả, không tự bấm lại.
3. **Cấm** vòng lặp `eval` từng bước để "xem thử" rồi sửa. Nếu thiếu assertion, **thêm vào
   gate** rồi chạy lại — gate là nguồn sự thật duy nhất.
4. **Tối đa 2 lần chạy cho một vòng sửa.** Lần thứ 3 bắt buộc phải là "thêm assertion còn
   thiếu", không phải "chạy lại cho chắc".
5. **Screenshot chỉ khi FAIL.** Ảnh thành công không phải bằng chứng thay cho assertion.
6. **Seed tất định:** dùng seam dev `window.__app` / `window.__stage` để tạo run, đặt unit,
   vào Planning. Không chơi lại UI từ menu cho mỗi kịch bản.
7. **Gate chạy trên dev server** (`pnpm dev`), không chạy trên `dist` vì seam chỉ tồn tại khi
   `import.meta.env.DEV`.
8. **Báo cáo**: dán dòng `GATE PASS/FAIL` + đường dẫn JSON vào commit body hoặc docs. Không
   mô tả lại từng bước bằng lời.

## Khung chuẩn

- Harness dùng chung: `scripts/qa/lib.mjs` (launch SwiftShader, boot, seed, screen point của
  unit, hover/click, snapshot màu tile, `check`, `finishGate`).
- Gate mẫu: `scripts/qa/planning-interaction.mjs` — hover/click thú phe mình, hover/click thú
  địch, Escape, và parity màu ô hover giữa hai phe.
- Chạy: `pnpm qa:planning http://127.0.0.1:5199/` → `/tmp/forest-qa/<gate>-<iso>.json`.

## Prompt mẫu cho OMP

```text
Trước khi sửa: chạy `pnpm qa:<gate> <url>` đúng 1 lần.
Nếu FAIL: đọc JSON report, sửa nguyên nhân, chạy lại tối đa 2 lần.
Không dùng browser eval từng bước. Thiếu assertion thì bổ sung vào scripts/qa/<gate>.mjs
rồi chạy lại; không tạo probe tạm trong /tmp.
```

## Ngoại lệ

- Điều tra hình ảnh/hiệu năng một lần (không lặp): được phép `shot`/devtools, nhưng phải biến
  kết luận thành assertion trong gate ngay sau đó.
- Bug chỉ tái hiện trên thiết bị thật (touch, GPU thật): ghi rõ là gate thủ công, vẫn phải có
  checklist một lượt thay vì hỏi–đáp từng bước.
