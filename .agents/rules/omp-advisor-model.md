---
description: OMP Advisor must review with GPT-6 Sol High via local Codex Web, never the legacy GPT-5.6 or Instant model.
---

# OMP Advisor — GPT-6 Sol

- Advisor phải dùng **`codex-chatgpt-web/chatgpt-web/gpt-6-sol:high`** (GPT-6 Sol bản thường, suy luận High). Không tự đổi Advisor sang `gpt-6-sol-instant` hoặc `openai-codex/gpt-5.6-sol`.
- Judge là một role **riêng**, tiếp tục dùng **`codex-chatgpt-web/chatgpt-web/gpt-6-sol-instant:auto`**. Không dùng thiết lập Judge thay cho Advisor.
- Model Advisor được chọn bằng `modelRoles.advisor` trong **`~/.omp/agent/config.yml`**. File rule này chỉ mô tả quy ước cho agent; chính cấu hình OMP mới quyết định model được gọi.
- Khi Advisor báo `Could not parse your authentication token`, trước tiên kiểm tra model/provider thực tế bằng `omp config get modelRoles`; kiểm tra `codex-chatgpt-web` đang trỏ về local shim và shim/upstream có hoạt động. Không tự in, sao chép hoặc sửa token.
- Nếu phiên OMP hiện tại vẫn dùng model cũ, khởi động một phiên OMP mới sau khi cấu hình được cập nhật. Nếu request vẫn báo lỗi, ghi đúng provider, model, trạng thái kết nối và lỗi; không retry liên tục lỗi xác thực 400/401.
- Sau lần chạy installer hoặc cập nhật OMP, xác nhận `modelRoles.advisor` vẫn là GPT-6 Sol High và `modelRoles.judge` vẫn là GPT-6 Sol Instant Auto.
