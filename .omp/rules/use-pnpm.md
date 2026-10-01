---
description: Always use pnpm, never npm/npx/yarn
condition:
  - '\bnpm\s'
  - '\bnpx\s'
  - '\byarn\s'
scope: tool:bash
---

# Use pnpm for everything in this repo

Luôn dùng `pnpm` cho mọi lệnh install, run, exec, dlx trong repo này:
install (`pnpm install`, không `npm install`/`yarn`), script (`pnpm run <script>`
hoặc `pnpm <script>`), binary (`pnpm exec <bin>`, không `npx`), add/remove
(`pnpm add` / `pnpm remove`).

Chỉ dùng `npm`/`npx` khi một file cụ thể (ví dụ bash script deploy) yêu cầu,
và phải giải thích rõ lý do ngoại lệ.
