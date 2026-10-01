# Forest Throne — Bá chủ khu rừng

Tactical voxel auto-battler for the browser. Collect, upgrade, position, equip and command forest creatures across repeated Planning and Combat rounds.

*Auto-battler chiến thuật voxel chạy trên trình duyệt. Thu thập, nâng cấp, bố trận, trang bị và chỉ huy các sinh vật rừng qua nhiều vòng Chuẩn bị / Giao tranh.*

Author / Tác giả: **Thái Gõ** · Version / Phiên bản: **0.1**

## Stack

- TypeScript (strict, no explicit `any`)
- Three.js (WebGL renderer)
- Vite + Vitest
- pnpm (only / bắt buộc)

## Quick start / Bắt đầu nhanh

```bash
pnpm install
pnpm dev        # dev server
pnpm test       # unit tests
pnpm build      # production build -> dist/
```

## Layout / Cấu trúc

```
src/
  core/        shared types, rng, events, i18n, icon authority
  game/        canonical rules: run state, board, economy, shop, merge,
               inventory, craft, tech, synergy, augments, combat, ai, loot
  content/     unit catalog, bosses, items, recipes, augments, environments
  persist/     save envelope, settings, collection, achievements
  render/      3D world, board, unit rigs, vfx, camera
  ui/          DOM screens, HUD, tooltips, modals (asset-first)
  platform/    audio, input, haptics, speech, discord, service worker
  net/         co-op / PvP fortress contracts
  app/         boot, router, loading
```

Gameplay rules live only in `src/game`; rendering and UI read and stage that state.

*Luật chơi chỉ nằm ở `src/game`; render/UI chỉ đọc và dàn dựng state đó.*

## Spec

The product contract is `opus-5.5-forest-throne-rebuild-mega-prompt.md`.

*Hợp đồng sản phẩm: `opus-5.5-forest-throne-rebuild-mega-prompt.md`.*

## Contributing / Đóng góp

Follow `.omp/rules/commits.md` for commit messages. Use `pnpm` for every command.

*Commit theo `.omp/rules/commits.md`. Mọi lệnh dùng `pnpm`.*

## License / Giấy phép

Source-available, all rights reserved. See [LICENSE](LICENSE).

*Mã nguồn chỉ để xem và đóng góp vào repo chính thức. Xem [LICENSE](LICENSE).*
