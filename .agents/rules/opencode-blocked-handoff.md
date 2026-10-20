---
description: Chuyển việc bị kẹt vì lỗi kỹ thuật sang OpenCode qua 1DevTool khi được phép; không chuyển tiếp thao tác bị chặn bởi kiểm tra an toàn hoặc quyền truy cập.
---

# Chuyển việc bị kẹt sang OpenCode

Áp dụng khi agent OMP không thể tiếp tục một việc **đã được người dùng giao** vì sự cố kỹ thuật, và OpenCode có thể xử lý độc lập bằng luồng 1DevTool hợp lệ.

## Phân loại trước khi chuyển

- **Có thể chuyển:** agent/CLI không hoạt động, công cụ thiếu khả năng, hoặc lỗi thực thi không liên quan đến an toàn/quyền; phải xác định nguyên nhân từ kết quả công cụ thực tế và giữ nguyên phạm vi yêu cầu.
- **Không chuyển chính thao tác bị từ chối:** `This tool call was blocked by OpenAI's safety checks.`, từ chối bởi chính sách nền tảng, từ chối quyền truy cập, hay yêu cầu phê duyệt chưa được chấp thuận. Tuân thủ `.agents/skills/safety-check-triage/SKILL.md`; không đổi lời nhắc, chia nhỏ hoặc dùng OpenCode để né lệnh chặn. Chỉ có thể giao **phần việc hợp lệ, độc lập**.
- **Không tạo retry storm:** với 429/503 và lỗi gateway, tuân thủ `.agents/rules/max-concurrent-subagents.md`. Đợi/backoff hoặc báo lỗi; không tăng tải bằng cách chuyển ngay sang agent khác dùng chung gateway.
- **Không vượt quyền sở hữu task:** nếu 1DevTool đã gán task cho terminal/agent cụ thể hoặc đang có approval gate, không tự chuyển quyền hay thực thi thay. Cần có cơ chế giao việc được kích hoạt và quyền điều phối hợp lệ.

## Cách chuyển việc hợp lệ

1. Ghi nhận phần việc còn lại, lỗi hiện tại, kết quả đã hoàn thành và các thay đổi đang có; giữ nguyên dữ liệu của người dùng.
2. Kiểm tra OpenCode có sẵn và 1DevTool orchestration/delegation đang được bật. Không xem `tasks_create` là đã giao task, hoặc xem chart nháp là đã kích hoạt.
3. Giao đúng **phần việc được phép** cho OpenCode qua luồng 1DevTool đã được người dùng cho phép. Prompt phải ghi rõ mục tiêu, thư mục, tiêu chí nghiệm thu, các phần đã hoàn thành, những việc không được lặp lại và giới hạn an toàn.
4. Không đồng thời xử lý cùng một phần việc ở OMP; chỉ tổng hợp đầu ra và xác minh bằng kết quả thực tế do OpenCode trả về.
5. Nếu OpenCode, delegation hoặc approval không khả dụng: báo chính xác lỗi và việc chưa thực hiện. Không dùng đường khác để vòng qua giới hạn.

**Quy tắc ưu tiên:** Không có lỗi kỹ thuật được xác nhận thì tiếp tục xử lý bình thường ở OMP. Không có luồng delegation hợp lệ thì không tuyên bố đã chuyển việc.
