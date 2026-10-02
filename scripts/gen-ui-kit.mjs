// Generates the approved pixel-art UI kit (medieval forest) as PNGs under public/assets/ui/generated/.
// Usage: node scripts/gen-ui-kit.mjs   — deterministic output; commit the PNGs, not a runtime painter.
// Slice values here must match KIT in src/ui/kit.ts.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = "public/assets/ui/generated";
mkdirSync(OUT, { recursive: true });

// ---------- tiny PNG encoder ----------
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(img) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.w, 0); ihdr.writeUInt32BE(img.h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc((img.w * 4 + 1) * img.h);
  for (let y = 0; y < img.h; y++) img.d.copy(raw, y * (img.w * 4 + 1) + 1, y * img.w * 4, (y + 1) * img.w * 4);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

// ---------- raster helpers ----------
const hex = (s, a = 255) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16), a];
const shade = (c, k) => [...c.slice(0, 3).map((v) => Math.max(0, Math.min(255, Math.round(v * k)))), c[3]];
const gray = (c) => { const g = Math.round(c[0] * 0.3 + c[1] * 0.55 + c[2] * 0.15); return [g, g, g, c[3]]; };
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

class Img {
  constructor(w, h) { this.w = w; this.h = h; this.d = Buffer.alloc(w * h * 4); }
  px(x, y, c) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || !c) return;
    const i = (y * this.w + x) * 4;
    this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = c[3];
  }
  rect(x, y, w, h, c) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.px(i, j, c); }
  save(name) { writeFileSync(`${OUT}/${name}.png`, png(this)); manifest.push(name); }
}
const manifest = [];

const C = {
  ink: hex("#1e120a"), woodD: hex("#3b2414"), wood: hex("#6b4226"), woodL: hex("#8f5b32"), woodH: hex("#b07a45"),
  gold: hex("#e0b04a"), goldL: hex("#ffe08a"), goldD: hex("#9a6a1e"),
  parch: hex("#f1e2bd"), parchS: hex("#e2cd9f"), parchD: hex("#c3a876"),
  green: hex("#3f8f3a"), red: hex("#b23a2e"), blue: hex("#2f6fae"), plum: hex("#6a3f8f"),
};

/**
 * Bordered panel: ink outline (clipped corners), beveled border band, inner bevel, textured fill, gold corner rivets.
 * Transparent `window` leaves the interior empty so dynamic fills can show through (bars/frames).
 */
function panel(w, h, o) {
  const im = new Img(w, h), b = o.border;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const corner = (x === 0 || x === w - 1) && (y === 0 || y === h - 1);
    if (corner) continue;
    const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
    if (edge) { im.px(x, y, C.ink); continue; }
    const inBorder = x <= b || y <= b || x >= w - 1 - b || y >= h - 1 - b;
    if (inBorder) {
      const top = y === 1 || x === 1, bottom = y === h - 2 || x === w - 2;
      const inner = x === b || y === b || x === w - 1 - b || y === h - 1 - b;
      let c = o.band;
      if (top) c = o.bandL; else if (bottom) c = o.bandD; else if (inner) c = o.inkInner ?? C.ink;
      else if (o.grain && hash(x, y >> 1) > 0.82) c = shade(o.band, 0.86);
      im.px(x, y, c);
      continue;
    }
    if (o.window) continue;
    let c = o.fill;
    const n = hash(x, y);
    if (o.texture && n > 0.9) c = o.fillS; else if (o.texture && n < 0.04) c = o.fillD ?? o.fillS;
    if (y === b + 1 && o.fillShadow) c = o.fillShadow; // soft inner top shadow
    im.px(x, y, c);
  }
  if (o.rivets) for (const [rx, ry] of [[2, 2], [w - 4, 2], [2, h - 4], [w - 4, h - 4]]) {
    im.rect(rx, ry, 2, 2, C.gold); im.px(rx, ry, C.goldL); im.px(rx + 1, ry + 1, C.goldD);
  }
  return im;
}

/** Chunky 3D button with lip; `state` drives highlight/press/disabled/selected treatment. */
function button(w, h, base, state, opts = {}) {
  let mid = base, lit = shade(base, 1.35), dark = shade(base, 0.6);
  if (state === "hover") { mid = shade(base, 1.15); lit = shade(base, 1.55); }
  if (state === "disabled") { mid = gray(shade(base, 0.85)); lit = gray(shade(base, 1.1)); dark = gray(shade(base, 0.55)); }
  const im = new Img(w, h), pressed = state === "pressed", lip = pressed ? 1 : 3, r = opts.round ?? 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = Math.min(x, w - 1 - x), dy = Math.min(y, h - 1 - y);
    if (dx + dy < r) continue; // clipped corners
    const edge = dx === 0 || dy === 0 || dx + dy === r;
    if (edge) { im.px(x, y, C.ink); continue; }
    let c = mid;
    if (y >= h - 1 - lip) c = dark;
    else if (pressed && y <= 2) c = dark;
    else if (!pressed && y <= 2) c = lit;
    else if (dx === 1) c = shade(mid, 0.9);
    if (!pressed && y === 3 && hash(x, 3) > 0.5) c = shade(lit, 0.95);
    im.px(x, y, c);
  }
  if (state === "selected" || opts.gold) {
    for (let x = r + 1; x < w - r - 1; x++) { im.px(x, 1, C.goldL); im.px(x, h - 2, C.gold); }
    for (let y = r + 1; y < h - r - 1; y++) { im.px(1, y, C.goldL); im.px(w - 2, y, C.gold); }
  }
  return im;
}

// ---------- panels ----------
panel(48, 48, { border: 4, band: C.wood, bandL: C.woodH, bandD: C.woodD, grain: true, fill: C.parch, fillS: C.parchS, fillD: C.parchD, texture: true, fillShadow: C.parchS, rivets: true }).save("panel_parchment");
panel(48, 48, { border: 4, band: C.wood, bandL: C.woodH, bandD: C.woodD, grain: true, fill: hex("#4a2e1a"), fillS: hex("#553521"), fillD: hex("#3f2716"), texture: true, rivets: true }).save("panel_wood");
panel(24, 24, { border: 2, band: C.woodL, bandL: C.woodH, bandD: C.woodD, fill: C.parch, fillS: C.parchS, texture: true }).save("panel_tooltip");
panel(24, 24, { border: 2, band: C.parchD, bandL: C.parchS, bandD: C.woodL, inkInner: C.woodL, fill: C.parchS, fillS: C.parchD, texture: true }).save("slot_well");
panel(24, 24, { border: 2, band: C.woodD, bandL: C.wood, bandD: C.ink, fill: hex("#2a1a0e", 225), fillS: hex("#33200f", 225), texture: true }).save("shell_billboard");
panel(22, 22, { border: 2, band: C.woodL, bandL: C.woodH, bandD: C.woodD, fill: hex("#3b2414", 235), fillS: hex("#452b18", 235) }).save("tile_status");

// Bars: transparent windows so live fill draws beneath the frame.
panel(72, 16, { border: 2, band: C.gold, bandL: C.goldL, bandD: C.goldD, window: true }).save("frame_bar");
panel(30, 14, { border: 1, band: C.woodL, bandL: C.woodH, bandD: C.woodD, window: true }).save("frame_rage_cell");
{ // backing well for bar windows (dark trough)
  const im = new Img(4, 4); im.rect(0, 0, 4, 4, hex("#1a0f08", 230)); im.save("bar_trough");
}

// Unit card frames by tier (6 = boss).
const TIER = { 1: "#9aa0a6", 2: "#4caf50", 3: "#3d8fe0", 4: "#a05ad8", 5: "#f0b030", 6: "#d8433a" };
for (const [t, col] of Object.entries(TIER)) {
  const band = hex(col);
  panel(40, 56, { border: 4, band, bandL: shade(band, 1.35), bandD: shade(band, 0.55), fill: C.parch, fillS: C.parchS, texture: true, fillShadow: C.parchS, rivets: true }).save(`card_t${t}`);
}

// Buttons: four colors × five states.
const STATES = ["normal", "hover", "pressed", "disabled", "selected"];
for (const [name, base] of Object.entries({ green: C.green, red: C.red, blue: C.blue, wood: C.wood, plum: C.plum })) {
  for (const s of STATES) button(48, 24, base, s).save(`btn_${name}_${s}`);
}
// Round action icon backer (side action stack).
for (const s of STATES) button(40, 40, C.wood, s, { round: 6, gold: s !== "disabled" }).save(`btn_icon_${s}`);
// Close control: minus motif, never an X (A22).
for (const s of ["normal", "hover", "pressed"]) {
  const im = button(24, 24, C.red, s, { round: 4 });
  const y = s === "pressed" ? 11 : 10;
  im.rect(6, y, 12, 3, hex("#fff6e6")); im.rect(6, y + 3, 12, 1, shade(C.red, 0.5));
  im.save(`btn_close_${s}`);
}

// Ribbon banner (title/headers), 3-slice 16.
{
  const w = 48, h = 24, im = new Img(w, h), red = hex("#a3302a");
  for (let y = 2; y < h - 4; y++) for (let x = 0; x < w; x++) {
    const tail = x < 6 || x >= w - 6;
    const notch = tail && Math.abs(y - (h - 4) / 2 - 1) < (x < 6 ? 6 - x : x - (w - 7)) - 1;
    if (notch) continue;
    let c = y === 2 || y === h - 5 ? C.ink : y === 3 ? C.goldL : y === h - 6 ? C.goldD : tail ? shade(red, 0.7) : red;
    if (!tail && (y === 4 || y === h - 7)) c = C.gold;
    im.px(x, y, c);
  }
  for (let x = 6; x < w - 6; x++) im.px(x, h - 4, hex("#1e120a", 120));
  im.save("ribbon");
}

// Modal shade: uniform translucent pixel; stretching cannot distort it.
{ const im = new Img(4, 4); im.rect(0, 0, 4, 4, hex("#0d0904", 160)); im.save("shade"); }

// Circles: joystick base/knob, loading bubble.
function disc(size, fill, rim, opts = {}) {
  const im = new Img(size, size), c = (size - 1) / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = Math.hypot(x - c, y - c);
    if (r > c) continue;
    let col = r > c - (opts.rimW ?? 2) ? rim : fill;
    if (opts.ring && r < c - (opts.rimW ?? 2) - 1) col = opts.ringFill;
    if (opts.shine && Math.hypot(x - c * 0.6, y - c * 0.55) < c * 0.22) col = opts.shine;
    im.px(x, y, col);
  }
  return im;
}
disc(64, hex("#3b2414", 150), hex("#e0b04a", 230), { rimW: 3, ring: true, ringFill: hex("#6b4226", 110) }).save("joy_base");
disc(28, C.woodL, C.goldL, { rimW: 2, shine: C.woodH }).save("joy_knob");
disc(32, hex("#9fe3ff", 90), hex("#e8fbff", 220), { rimW: 2, shine: hex("#ffffff", 235) }).save("bubble");

// Pixel star (rating) and gem pips.
{
  const im = new Img(12, 12);
  const rows = [".....##.....", ".....##.....", "....####....", "############", ".##########.", "..########..", "...######...", "..########..", "..###..###..", ".###....###.", ".##......##.", "............"];
  rows.forEach((r, y) => [...r].forEach((ch, x) => ch === "#" && im.px(x, y, y < 4 ? C.goldL : y > 7 ? C.goldD : C.gold)));
  im.save("star");
}

writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest.sort(), null, 1));
console.log(`ui kit: ${manifest.length} PNGs → ${OUT}`);
