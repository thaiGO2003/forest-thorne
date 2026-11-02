---
description: Merge request policy (lint-first, deferred build, browser evidence)
---

# Merge request workflow

Mục tiêu: giữ vòng lặp làm việc nhanh, chỉ chạy cái đắt tiền khi công việc đã xong.

## Nguyên tắc

1. **Fast path chỉ lint.** Mọi MR chỉ chạy lint: ESLint nếu repo có cấu hình ESLint
   (`eslint.config.*` / `.eslintrc*`), ngược lại dùng `tsc --noEmit` (`pnpm typecheck`).
   Hiện repo chưa có ESLint nên mặc định là typecheck.
2. **Không chạy test tích hợp trong fast path.** `vitest`/QA scripts không nằm trong hook
   hay CI lint. Chạy tay khi cần: `pnpm test` hoặc `pnpm test:changed`.
3. **Build chỉ khi đã xong.** Build (`tsc --noEmit && vite build`) chạy bằng
   `pnpm mr --full`, hoặc trên CI khi PR đã ra khỏi draft (ready for review).
4. **MR phải có evidence.** `pnpm mr` tự bật dev server, chụp ảnh desktop + mobile bằng
   Chromium headless, upload gist public và nhúng ảnh vào description của MR.
5. **Không commit ảnh evidence vào repo.** Ảnh nằm ở `artifacts/mr/<timestamp>/` (đã gitignore),
   phần upload dùng gist.

## Lệnh

```bash
pnpm hooks:install     # cài .git/hooks/pre-push (lint gate)
pnpm mr --dry-run      # lint + chụp evidence + in body, không push/không tạo PR
pnpm mr --draft        # tạo PR draft
pnpm mr                # lint + evidence + push + tạo/cập nhật PR
pnpm mr --full         # như trên, kèm build (dùng khi đã xong)
pnpm mr --lint-only    # chỉ lint (hook pre-push gọi lệnh này)
```

Hook `pre-push` chỉ chạy lint và chặn push nếu lint lỗi; không chạy test tích hợp,
không build.

## CI (`pr-checks.yml`)

- Job `lint`: luôn chạy khi PR mở/cập nhật.
- Job `build`: chỉ chạy khi `draft == false` (đã xong), phụ thuộc job lint.
- Không có job test tích hợp — giữ CI nhanh; test chạy theo yêu cầu.
