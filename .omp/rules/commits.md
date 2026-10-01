# Commit Rules — Forest Throne

Quy chuẩn commit cho repository Forest Throne. Áp dụng cho mọi commit từ agent và developer.

## Cấu trúc commit message

```
<type>(<scope>): <mô tả ngắn một dòng>

<chi tiết lý do vì sao thay đổi>

<chi tiết kỹ thuật đã thực hiện>

<kết quả kiểm chứng / tests>
```

## Types
- `feat`: Thêm tính năng, màn hình, UI component, hoặc cơ chế mới.
- `fix`: Sửa lỗi hiển thị, logic, vỡ layout, crash, hoặc vi phạm contract.
- `refactor`: Tái cấu trúc mã nguồn, dọn dẹp logic/CSS, không đổi hành vi nghiệp vụ.
- `test`: Thêm hoặc cập nhật test cases, mocks, fixtures.
- `docs`: Cập nhật tài liệu, kế hoạch (`.omp/plans/`), conventions.
- `chore`: Cấu hình build, dependencies, tooling.

## Yêu cầu nội dung (BẮT BUỘC)

1. **Không viết commit ngắn 1 dòng cho thay đổi logic/UI**:
   - Dòng tiêu đề: Tóm tắt hành động (<72 ký tự).
   - Phần thân (body): **Phải giải thích rõ TẠI SAO** cần thay đổi (root cause của vấn đề là gì, trước đó bị gì, hậu quả ra sao).
   - Danh sách gạch đầu dòng các file và thay đổi cụ thể.
   - Ghi rõ bằng chứng kiểm thử (lệnh test đã chạy, kết quả pass/fail).

2. **Không gom thay đổi không liên quan**:
   - Mỗi commit giải quyết một mục tiêu duy nhất.
   - Không commit đè các thay đổi đang dở dang ở working tree khác phạm vi.

3. **Ngôn ngữ**:
   - Tiêu đề viết tiếng Anh hoặc tiếng Việt chuẩn mực kĩ thuật.
   - Phần body giải thích chi tiết, ưu tiên tiếng Việt hoặc tiếng Anh rõ nghĩa, rành mạch.
