---
name: phaser-migrate
description: This skill should be used when the user asks to "migrate from Phaser 3", "upgrade to Phaser 4", "convert my v3 game", "Phaser 3 to 4 migration", "update Phaser version", "my Phaser 3 game broke after upgrading", "behavior changed after upgrading Phaser 4", "upgrade Phaser 4.0 to 4.2", or has code that uses deprecated or removed Phaser 3 APIs or behavior that silently drifted between Phaser 4 RC releases.
version: 0.7.0
---

> Companion reference (do not duplicate here): See P:/DevGOVietnam/homeserver-forest-throne/.omp/skills/v3-to-v4-migration/SKILL.md for the API reference already installed alongside this skill.

# Phaser 3 → Phaser 4 Migration

Migrating from Phaser 3 to Phaser 4 is mostly straightforward. The core public API is preserved. This skill covers the migration workflow, the runtime behaviour that compiles cleanly and still surprises you, and moving between Phaser 4 point releases (4.0 → 4.1 → 4.2). The full v3→v4 breaking-change list — every removed API and how to fix it — is documented in the companion skill `v3-to-v4-migration` (see the companion line above); it is not duplicated here.

## Step 1 — Update the Package

```bash
npm uninstall phaser
npm install phaser
```

Verify installed version:
```bash
node -e "const p = require('phaser'); console.log(p.VERSION)"
```

Should print `4.2.1` (or later RC).

## Step 2 — Scan for Breaking Changes

Run these grep searches to find every issue in your `src/` directory:

```bash
# 1. Point → Vector2
grep -rn "Geom\.Point\|new Phaser\.Geom\.Point\|Geom\.Point\." src/

# 2. Math.PI2 → Math.TAU
grep -rn "Math\.PI2\b" src/

# 3. Phaser.Structs
grep -rn "Phaser\.Structs\." src/

# 4. DynamicTexture / RenderTexture (check for missing .render())
grep -rn "DynamicTexture\|RenderTexture\|addDynamicTexture\|addRenderTexture" src/

# 5. Removed plugins
grep -rn "Camera3D\|Layer3D\|FacebookInstant\|SpinePlugin\|SpineFile" src/

# 6. TileSprite crop (setCrop on TileSprite — no longer supported)
grep -rn "tileSprite.*setCrop\|setCrop.*tileSprite" src/

# 7. Create.GenerateTexture (removed)
grep -rn "Create\.GenerateTexture\|Phaser\.Create\." src/

# 8. Spine (use official Esoteric plugin instead)
grep -rn "spine\|Spine" src/ -i

# 9. phaser-ie9 entry point
grep -rn "phaser-ie9" . 

# 10. WebGL geometry masks (stencil-based masks changed in Phaser 4 — use a camera viewport or the Mask filter instead)
grep -rn "createGeometryMask\|createBitmapMask\|BitmapMask\|setMask\b\|clearMask\|setScissor" src/ 
```

## Step 3 — Apply Fixes

The companion skill `v3-to-v4-migration` documents the fix for every breaking change the Step 2 scans find:

- Geom.Point → Vector2 (its §13)
- Math.PI2 → Math.TAU (§14)
- Phaser.Structs → native Map/Set (§15)
- DynamicTexture / RenderTexture `render()` (§7)
- Removed plugins and entry points (§18)
- Spine — official Esoteric plugin (§20)
- TileSprite cropping (§11)
- Create.GenerateTexture (§19)
- Masks → camera viewport or the Mask filter (§3)

Work through each grep hit from Step 2 with that reference, then continue to Step 4.

## Step 4 — Update TypeScript Config

If using TypeScript, ensure `tsconfig.json` is correct for v4:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

Phaser 4 publishes its types through the `exports` map in its own `package.json`, so a
modern resolver picks them up from a plain `import Phaser from 'phaser';` with no extra
config.

> **Delete `typeRoots: ["./node_modules/phaser/types"]` and `types: ["Phaser"]` if your v3
> tsconfig has them.** Against Phaser 4 that pair fails with
> `TS2688: Cannot find type definition file for 'Phaser'` — v4 ships one `types/phaser.d.ts`
> file, which is not a valid type-root package.

## Step 5 — Verify and Test

```bash
# Type check — must pass with 0 errors
npx tsc --noEmit

# Start dev server and check browser console
npm run dev
```

Check in browser:
1. No console errors on startup
2. All scenes load correctly
3. Physics behaves the same as v3
4. Animations play correctly

## Quick Migration Checklist

- [ ] `npm install phaser` run
- [ ] `tsconfig.json` v3-era `typeRoots` + `types: ["Phaser"]` removed; `moduleResolution` is `bundler`/`node16`
- [ ] All `Phaser.Geom.Point` replaced with `Phaser.Math.Vector2`
- [ ] All `Math.PI2` replaced with `Math.TAU`
- [ ] All `Phaser.Structs.Map/Set` replaced with native `Map`/`Set`
- [ ] All `DynamicTexture`/`RenderTexture` have `render()` calls after drawing
- [ ] Removed plugin references deleted (Camera3D, Layer3D, Facebook, old Spine)
- [ ] `TileSprite.setCrop()` calls replaced or removed
- [ ] `Phaser.Create.GenerateTexture` replaced with Graphics/textures
- [ ] `phaser-ie9` imports replaced with `phaser`
- [ ] WebGL masks (`createGeometryMask` / `createBitmapMask` / `BitmapMask`) replaced with a camera viewport or `filters.internal.addMask()`; no `camera.setScissor()` calls
- [ ] `npx tsc --noEmit` passes
- [ ] `node skills/phaser-playtest/scripts/playtest.mjs --project .` passes — a green `tsc` says nothing about whether the migrated game renders

## Additional Resources

### Reference Files
- **`references/v3-to-v4-changes.md`** — the v3→v4 breaking-change details live in the companion `v3-to-v4-migration` skill; this file keeps the "Not Changed (Preserved API)" list of v3 systems that work identically in v4.
- **`references/runtime-gotchas.md`** — Behaviour that compiles cleanly and still surprises you: masking, animation state switches, camera follow, tilemap collision, `onFloor()` timing, cross-scene wiring, scale manager. Read when the compiler is happy but the game is not.
- **`references/v4-release-notes.md`** — What shipped in 4.0.0, 4.1.0, 4.2.0 and 4.2.1, and what to change when moving between them. Read when upgrading Phaser 4 point releases, or to find out whether a bug you are chasing is already fixed upstream.
