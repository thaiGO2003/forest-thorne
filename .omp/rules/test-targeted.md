---
description: Targeted tests only — small edits must not trigger the full 150+ file suite
---

# Targeted Tests (chống test lâu)

Repo có 150+ test files (`tests/runtime/` đã 152). Sửa nhỏ → **chỉ chạy test
đúng phần vừa sửa**. Hook `test-guard` chặn full suite ở runtime; rule này là
bản đồ để agent chọn lệnh đúng.

- 1 file: `pnpm exec vitest --run tests/runtime/<ten-file>.test.ts`
  (thêm `NODE_OPTIONS='--localstorage-file=.vitest-ls.json'` như script `test`).
- 1 test trong file: thêm `-t "<tên test>"`.
- Vùng vừa đổi theo git: `pnpm run test:changed`.
- Test nặng chỉ chạy khi đụng đúng vùng: `threeMobileE2EFullFlow`,
  `threeFullFlow`, `threeMultiModeE2E`, `threeMobileResponsivenessAudit`,
  `liveShopRewriteRuntime` (mỗi test timeout tới 30s).
- `vitest.config.js` đã cap `maxWorkers: 2` (máy 7 GB RAM, mỗi worker ~300 MB).
  Không override bằng `--maxWorkers` lớn hơn.
- Chỉ chạy full suite (`ALLOW_FULL_TESTS=1 pnpm test`) khi đổi shared
  runtime/hạ tầng: `vitest.config.js`, `tests/setup.js`, `tests/mocks/`.
