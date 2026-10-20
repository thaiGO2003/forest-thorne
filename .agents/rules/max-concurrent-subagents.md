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
- Lý do 1 (provider): Omniroute/9router combo đã 502/503 hàng loạt khi nhiều
  agent gọi đồng thời (log omp PID 798477: 6 retry 502 `gpt-5.6-luna-xhigh`;
  PID 770161: 503 capacity unavailable). Spawn ít để tránh rate limit.
- Lý do 2 (RAM): server chỉ có 7 GB RAM; >4 subagents với context lớn dễ OOM
  (xem log AionUi renderer build 2 GB heap).
- Có thể dispatch tiếp task độc lập cho DEV trong khi PLAN đang verify; nếu PLAN reject, DEV phải làm lại các task bị ảnh hưởng trước khi coi gate xanh.
- Mỗi OMP được phép nhận tối đa **2 task/slice độc lập đồng thời** để tăng tốc; không giao task có dependency mở hoặc bắt agent ngồi chờ.
- PLAN được phép reject nhiều task cùng lúc khi chúng dùng chung reference hoặc một lỗi parity ảnh hưởng liên đới; mỗi task phải ghi lý do và evidence riêng.
- Ngoại lệ: tác vụ rất nhẹ (chỉ grep/read 1 file) có thể lên 4, nhưng
  **không quá 2 kèm context** (subagent gửi >1 MB payload).

## Retry Discipline (chống retry-storm, sự cố thật 2026-09-17/18)

Upstream từng trả 13k× 503 + 12.9k× 429 trong 2 ngày; client retry tới
`retry 4+` (≥5 attempts/request) → storm khuếch đại tải → omniroute HWM
~3.9 GB → treo máy, reboot. Mọi agent gọi qua gateway BẮT BUỘC:

- **Backoff mũ + jitter, cap 3 lần** (2s → 8s → 30s). Hết 3 lần vẫn
  429/503 → dừng, báo user. Không loop đốt token/RAM gateway.
- **Circuit-breaker:** 5 lỗi 429/503 liên tiếp → nghỉ tối thiểu 5 phút.
  Không mở session mới để "né" lỗi — vẫn đập vào cùng gateway đang quá tải.
- **Phân biệt lỗi:** 429/503 = chờ (backoff); 400/401/404 = dừng ngay
  (sửa request, retry vô ích); 502/timeout = 1 retry rồi backoff.
- Đang gặp 429/503 là tín hiệu **giảm tải**, không spawn thêm subagent.
