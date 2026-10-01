---
description: Forbid explicit TypeScript any type
condition:
  - ':\s*any\b'
  - '\bas\s+any\b'
  - '<any[\],>]'
---

# No explicit `any` in TypeScript

Do not emit `: any`, `as any`, `Array<any>`, or any generic `any` in TypeScript code
(`.ts`/`.tsx`), including tool arguments for edit/write.

Use a specific type or interface instead. When the type is genuinely unknown,
use `unknown` and narrow it (type guard, `instanceof`, discriminated union),
or use a generic with a constraint. Never `any`.

`tsconfig` has `strict` + `noImplicitAny`; the code must pass `pnpm typecheck`
with no `// @ts-ignore`, `@ts-expect-error`, or `eslint-disable` suppressions
unless explicitly approved.
