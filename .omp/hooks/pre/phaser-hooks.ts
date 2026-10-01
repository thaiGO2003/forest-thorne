// Ported from Yakoub-ai/phaser4-gamedev Claude hooks:
//   hooks/scripts/check-v3-api.sh  (PreToolUse v3-API guard — warn-only)
//   hooks/scripts/detect-phaser.sh (SessionStart project detector)
// omp hook factory loaded from .omp/hooks/pre/phaser-hooks.ts
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const RULES = [
  [/Phaser\.Geom\.Point|new Phaser\.Geom\.Point/,
    "Phaser v3 API: Phaser.Geom.Point\n   -> Use Phaser.Math.Vector2 instead\n   -> pt.length() replaces GetMagnitude(), pt.clone() replaces Clone()"],
  [/Math\.PI2\b/,
    "Phaser v3 API: Math.PI2\n   -> Use Math.TAU (= pi*2) or Math.PI_OVER_2 (= pi/2)"],
  [/Phaser\.Structs\.Map|Phaser\.Structs\.Set/,
    "Phaser v3 API: Phaser.Structs.Map/Set\n   -> Use native JavaScript Map / Set instead"],
  [/Camera3D|Layer3D/,
    "Phaser v3 API: Camera3D / Layer3D\n   -> These plugins are removed in Phaser 4. Phaser 4 is 2D only."],
  [/FacebookInstant/,
    "Phaser v3 API: FacebookInstant\n   -> Facebook Instant Games plugin removed in Phaser 4."],
  [/\.(preFX|postFX)\./,
    "Phaser v3 API: preFX / postFX\n   -> Unified into Filters in Phaser 4.\n   -> obj.enableFilters(); obj.filters.internal.addGlow(...)   // was preFX\n   -> obj.enableFilters(); obj.filters.external.addBlur(...)   // was postFX\n   -> Cameras have .filters directly and need no enableFilters() call.\n   -> See skills/phaser-fx/SKILL.md"],
  [/BitmapMask|createBitmapMask\(/,
    "Removed in Phaser 4: BitmapMask\n   -> The class does not exist in v4 and createBitmapMask() is not a Game Object method.\n   -> obj.enableFilters(); obj.filters.internal.addMask(source)\n   -> For a rectangular clip, give the content its own camera and use camera.setViewport().\n   -> See skills/phaser-fx/SKILL.md"],
  [/\.setScissor\(/,
    "Not a Phaser 4 API: camera.setScissor()\n   -> No such method on Phaser.Cameras.Scene2D.Camera in v4.\n   -> Use camera.setViewport(x, y, width, height) for a rectangular clip."],
  [/\.tintFill\b/,
    "Phaser v3 API: tintFill\n   -> v4 separates tint colour from tint mode.\n   -> sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL)\n   -> Modes: MULTIPLY, FILL, ADD, SCREEN, OVERLAY, HARD_LIGHT, MULTIPLY_TWO"],
  [/\.setPipeline\(|\.resetPipeline\(/,
    "Phaser v3 API: setPipeline()\n   -> The pipeline system was replaced by render nodes in Phaser 4.\n   -> Most v3 custom pipelines exist as stock filters now — check skills/phaser-fx/references/filters-api.md first.\n   -> For lighting specifically: setPipeline('Light2D') is now setLighting(true)."],
  [/Phaser\.Create\.GenerateTexture|Create\.GenerateTexture/,
    "Phaser v3 API: Create.GenerateTexture\n   -> Use Graphics.generateTexture() instead:\n   const gfx = this.add.graphics(); gfx.fillRect(0,0,w,h); gfx.generateTexture('key', w, h); gfx.destroy();"],
  [/createGeometryMask\(|setMask\(.*createGeometryMask/,
    "Removed Phaser 3 API: geometry/bitmap mask\n   -> createGeometryMask() and createBitmapMask() do not exist in Phaser 4, and BitmapMask was removed entirely.\n   -> Rectangular clip: give the content its own camera and use camera.setViewport(x, y, w, h). There is no camera.setScissor() in v4.\n   -> Arbitrary shape: obj.enableFilters(); obj.filters.internal.addMask(source)\n   -> See skills/phaser-migrate/references/runtime-gotchas.md section 1."],
  [/setCollisionByProperty\([^,)]+,\s*true\)/,
    "Implicit setCollisionByProperty arguments\n   -> Signature is (properties, collides?, recalculateFaces?, layer?). Pass recalculateFaces explicitly, or players snag on seams between solid tiles.\n   -> layer.setCollisionByProperty({ collides: true }, true, true)\n   -> See skills/phaser-migrate/references/runtime-gotchas.md section 5."],
  [/^export const (GAME_WIDTH|GAME_HEIGHT)\b/m,
    "Architectural anti-pattern: module-level size constant\n   -> GAME_WIDTH / GAME_HEIGHT constants freeze at import time and leak off the right edge when the canvas grows (iOS rotation, Safari toolbar collapse, orientation unlock).\n   -> Use this.cameras.main.width/height inside create() + this.scale.on('resize', ...) listener.\n   -> See skills/phaser-scene/references/scene-patterns.md -> Responsive Sizing: Two Layers."],
  [/\.onFloor\(\)/,
    "body.onFloor() can resolve a frame late\n   -> onFloor() comes from the tile/world pass and may land a step after blocked.down. For jump-landed detection prefer: body.blocked.down || body.onFloor()\n   -> A single dropped frame here is 16ms of eaten jump input at 60fps.\n   -> See skills/phaser-migrate/references/runtime-gotchas.md section 6."],
];

// content-conditioned rules: [contextRegex, ruleRegex, message]
const CONDITIONAL_RULES = [
  [/add\.particles\(/, /maxParticles/, false,
    "Particle emitter without maxParticles\n   -> An uncapped emitter allocates until the frame budget is gone, and only under load — which is why it ships and then shows up as a player report.\n   -> Add maxParticles to the config. Steady-state count is lifespan / frequency * quantity.\n   -> See skills/phaser-particles/SKILL.md"],
  [/tileSprite|TileSprite|add\.tileSprite/, /\.setCrop\(/, true,
    "Phaser v3 API: TileSprite.setCrop()\n   -> TileSprite cropping is not supported in Phaser 4. Use RenderTexture instead."],
  [/close[A-Za-z_]*Panel[^}]*delayedCall[^}]*open[A-Za-z_]*Panel/, /./, true,
    "UI flash anti-pattern: close+delayedCall+open detected\n   -> Visible panel flicker. Replace with in-place content rebuild: snapshot container.length before content build, slice container.list after, destroy only content-region children so chrome stays alive.\n   -> See skills/phaser-ui/references/panel-rebuild-patterns.md."],
];

function addedText(input) {
  if (typeof input?.content === "string" && input.content) return input.content; // write tool
  const patch = input?.input ?? input?.body; // edit tool: patch text with + rows
  if (typeof patch !== "string" || !patch) return "";
  return patch
    .split("\n")
    .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
    .map((l) => l.slice(1))
    .join("\n");
}

function checkContent(content) {
  const warnings = [];
  for (const [re, msg] of RULES) {
    if (re.test(content)) warnings.push(msg);
  }
  for (const [ctxRe, re, ctxRequired, msg] of CONDITIONAL_RULES) {
    const ctxHit = ctxRe.test(content);
    const ruleHit = re.test(content);
    if (ctxRequired ? ctxHit && ruleHit : ctxHit && !ruleHit) warnings.push(msg);
  }
  return warnings;
}

export default function phaserHooks(pi) {
  pi.on("tool_call", async (event) => {
    if (event.toolName !== "write" && event.toolName !== "edit") return;
    const path = String(event.input?.path ?? event.input?.file_path ?? "");
    if (!/\.(ts|tsx|js|jsx)$/.test(path)) return;
    const content = addedText(event.input);
    if (!content) return;
    const warnings = checkContent(content);
    if (warnings.length === 0) return;
    const text =
      `PHASER 4 API WARNING — ${path}\n` +
      warnings.map((w) => `- ${w}`).join("\n\n") +
      `\n\nRun /phaser-migrate for a full migration guide.`;
    pi.sendMessage({ customType: "phaser-v3-guard", content: text, display: true });
  });

  pi.on("session_start", async (_event, ctx) => {
    try {
      const pkgPath = join(ctx.cwd, "package.json");
      if (!existsSync(pkgPath)) return;
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      const version = deps.phaser;
      if (!version) return;
      let skills = [];
      const skillsDir = join(ctx.cwd, ".omp", "skills");
      if (existsSync(skillsDir)) {
        skills = readdirSync(skillsDir, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => d.name);
      }
      const phaserSkills = skills.filter((s) => s.startsWith("phaser-"));
      const text =
        `Phaser project detected (phaser ${version}). ` +
        `Installed tooling: ${skills.length} skills (${phaserSkills.length} phaser-* workflow skills). ` +
        `Workflow commands: /phaser-new, /phaser-run, /phaser-playtest, /phaser-validate, /phaser-build, /phaser-analyze, /phaser-release, /phaser-feedback, /phaser-brainstorm, /phaser-gdd. ` +
        `Agents: phaser-architect, phaser-coder, phaser-debugger, phaser-playtester, phaser-asset-advisor.`;
      pi.sendMessage({ customType: "phaser-detector", content: text, display: true });
    } catch (err) {
      pi.logger?.warn?.("phaser-hooks session_start failed", err);
    }
  });
}
