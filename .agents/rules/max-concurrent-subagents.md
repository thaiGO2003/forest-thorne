---
description: Spawn maximum 2 subagents concurrently to avoid provider rate limit
---

# Subagent Concurrency

Tối đa **2 subagents** chạy đồng thời trong một task. Khi `task` cần
dispatch nhiều hơn 2 slices, **chạy theo waves** (mỗi wave ≤2) với barrier
`await` thay vì spawn parallel.

- `tasks[].length <= 2` cho mỗi `task` call.
- Nếu cần >2 slices: chạy nhiều waves (mỗi wave ≤2), wave sau chỉ start khi
  wave trước xong.
- Lý do: nhiều subagent gọi đồng thời dễ gây rate limit/502/503 và tăng RAM;
  spawn ít để giữ ổn định.
- Có thể dispatch tiếp task độc lập cho DEV trong khi PLAN đang verify; nếu PLAN reject, DEV phải làm lại các task bị ảnh hưởng trước khi coi gate xanh.
- Mỗi OMP được phép nhận tối đa **2 task/slice độc lập đồng thời** để tăng tốc; không giao task có dependency mở hoặc bắt agent ngồi chờ.
- PLAN được phép reject nhiều task cùng lúc khi chúng dùng chung reference hoặc một lỗi parity ảnh hưởng liên đới; mỗi task phải ghi lý do và evidence riêng.
- Ngoại lệ: tác vụ rất nhẹ (chỉ grep/read 1 file) có thể lên 4, nhưng
  **không quá 2 kèm context** (subagent gửi >1 MB payload).

## Retry Discipline

Mọi agent gọi qua gateway BẮT BUỘC:

- **Backoff mũ + jitter, cap 3 lần** (2s → 8s → 30s). Hết 3 lần vẫn
  429/503 → dừng, báo user. Không loop đốt token/RAM gateway.
- **Circuit-breaker:** 5 lỗi 429/503 liên tiếp → nghỉ tối thiểu 5 phút.
  Không mở session mới để "né" lỗi — vẫn đập vào cùng gateway đang quá tải.
- **Phân biệt lỗi:** 429/503 = chờ (backoff); 400/401/404 = dừng ngay
  (sửa request, retry vô ích); 502/timeout = 1 retry rồi backoff.
- Đang gặp 429/503 là tín hiệu **giảm tải**, không spawn thêm subagent.
