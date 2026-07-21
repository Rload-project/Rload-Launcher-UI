// scripts/generate-premium-banner-assets.mjs
//
// Premium Rload Banner Collection (Player Identity V2, Phase 3) — 12 original
// vector environments, replacing the temporary 20-banner placeholder set.
// Kept separate from scripts/generate-player-assets.mjs (old generator, never
// touched) and scripts/generate-premium-avatar-assets.mjs (avatars) — same
// pattern, own file.
//
// SVG, viewBox 0 0 1600 500 (3.2:1, per brief) — scales cleanly into
// PlayerBanner's height:200 full-bleed box and CosmeticsPickerModal's
// 960/260 preview without ever needing a raster fallback.
//
// Shared visual grammar (the "one coherent collection, atmosphere not
// character" ask):
//   - dark navy/indigo/purple base gradient on every banner
//   - LEFT SAFE ZONE (x < ~480, ~30% of width): kept calm/empty — this is
//     where the avatar overlaps the banner's bottom edge and (in any future
//     layout) where profile text could sit. No focal shapes, no bright
//     stars, no logo placed there on any banner.
//   - RIGHT VISUAL ZONE (x > ~800): every banner's strongest focal element
//     lives here, per the brief.
//   - one shared top-to-bottom dark gradient overlay so every banner reads
//     as "atmosphere" even before PlayerBanner's own CSS overlay is applied
//   - accent palette limited to cyan / magenta / blue / gold, one or two per
//     banner — never more (the "elegant rather than busy" ask)
//
// Run: node scripts/generate-premium-banner-assets.mjs
// Output: public/assets/player/banners/<kebab-id>.svg (new filenames only —
// old rload-*.svg files are untouched and left in place until approved for
// removal).

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "assets", "player", "banners");
mkdirSync(OUT_DIR, { recursive: true });

const W = 1600, H = 500;

// Same official mark extraction used by achievement badges and avatars — never redraw.
const RLOAD_MARK_PATHS = [
  "M131.09,145.81c14.69-19.11,41.29-33.91,29.06-62.04-3.13-7.2-10.53-14.75-17.97-17.45-.62-.22-6.23-1.74-6.57-1.74H58.88v101.02c0,.43.56,1.06,0,1.74h21.52v-81.23h51.72c.36,0,3.13,1.41,3.77,1.78,6.39,3.66,7.16,11.63,2.82,17.31l-20.82,22.57v-28.47h-21.52v68.04h68.04v-21.52h-33.32Z",
  "M131.09,145.81h33.32v21.52h-68.04v-68.04h21.52v28.47l20.82-22.57c4.34-5.68,3.58-13.65-2.82-17.31-.65-.37-3.42-1.78-3.77-1.78h-51.72v81.23h-21.52c.56-.67,0-1.31,0-1.74v-101.02h76.71c.34,0,5.95,1.52,6.57,1.74,7.45,2.7,14.84,10.25,17.97,17.45,12.23,28.13-14.37,42.93-29.06,62.04Z",
];
const MARK_BOX = { x: 58.88, y: 64.57, w: 105.53, h: 102.77 };
function rloadMark(cx, cy, size, fill, opacity = 1) {
  const scale = size / Math.max(MARK_BOX.w, MARK_BOX.h);
  const tx = cx - (MARK_BOX.x + MARK_BOX.w / 2) * scale;
  const ty = cy - (MARK_BOX.y + MARK_BOX.h / 2) * scale;
  return `<g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(4)})" fill="${fill}" opacity="${opacity}">` +
    RLOAD_MARK_PATHS.map((d) => `<path d="${d}"/>`).join("") + `</g>`;
}

const ACCENT = { cyan: "#22D3EE", magenta: "#EC4899", blue: "#3B82F6", gold: "#FFC24B" };

const RARITY_BASE = {
  common:  ["#1c1836", "#100d24"],
  rare:    ["#1a2340", "#0e1128"],
  epic:    ["#2a1c40", "#140f28"],
  founder: ["#2e2412", "#1c1430"],
};

// Shared frame: base gradient + faint star/dust field (kept sparse on the
// left, denser on the right) + a soft top/bottom vignette for readability.
function frame({ id, rarity }) {
  const [c1, c2] = RARITY_BASE[rarity];
  return `
    <defs>
      <linearGradient id="bg-${id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${c1}"/>
        <stop offset="100%" stop-color="${c2}"/>
      </linearGradient>
      <linearGradient id="vig-${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgba(0,0,0,0.25)"/>
        <stop offset="50%" stop-color="rgba(0,0,0,0)"/>
        <stop offset="100%" stop-color="rgba(0,0,0,0.4)"/>
      </linearGradient>
      <radialGradient id="focus-${id}" cx="70%" cy="45%" r="60%">
        <stop offset="0%" stop-color="rgba(255,255,255,0.05)"/>
        <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
      </radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg-${id})"/>
    <rect width="${W}" height="${H}" fill="url(#focus-${id})"/>
  `;
}
function vignette(id) {
  return `<rect width="${W}" height="${H}" fill="url(#vig-${id})"/>`;
}

function dust(seedOffset, color, count, xMin, xMax) {
  const shapes = [];
  let s = seedOffset;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < count; i++) {
    const x = xMin + rand() * (xMax - xMin);
    const y = 40 + rand() * (H - 80);
    const r = 1 + rand() * 2;
    shapes.push(`<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(1)}" fill="${color}" opacity="${(0.3 + rand() * 0.5).toFixed(2)}"/>`);
  }
  return shapes.join("");
}

/** Small square "pixel" dust, used only where the scene wants a blocky (not round) sparkle. */
function pixelDust(seedOffset, color, count, xMin, xMax) {
  const shapes = [];
  let s = seedOffset;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < count; i++) {
    const x = xMin + rand() * (xMax - xMin);
    const y = 40 + rand() * (H - 80);
    const size = 3 + rand() * 5;
    shapes.push(`<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${size.toFixed(1)}" height="${size.toFixed(1)}" fill="${color}" opacity="${(0.3 + rand() * 0.5).toFixed(2)}"/>`);
  }
  return shapes.join("");
}

// ── Per-banner scenes (focal work concentrated x>800, left third kept calm) ──

const SCENES = {
  neon_grid: () => {
    const lines = [];
    for (let i = 0; i <= 10; i++) {
      const x = 700 + i * 90;
      lines.push(`<line x1="${x}" y1="${H}" x2="${700 + i * 40}" y2="180" stroke="${ACCENT.cyan}" stroke-width="1.2" opacity="${0.25 - i * 0.015}"/>`);
    }
    for (let j = 0; j < 5; j++) {
      const y = 260 + j * 45;
      lines.push(`<line x1="600" y1="${y}" x2="${W}" y2="${y - j * 8}" stroke="${ACCENT.cyan}" stroke-width="1" opacity="${0.18 - j * 0.02}"/>`);
    }
    return lines.join("") + `<ellipse cx="1180" cy="230" rx="220" ry="60" fill="${ACCENT.cyan}" opacity="0.06"/>`;
  },
  violet_horizon: () => `
    <ellipse cx="1150" cy="380" rx="500" ry="180" fill="${ACCENT.blue}" opacity="0.10"/>
    <ellipse cx="1200" cy="360" rx="320" ry="110" fill="${ACCENT.magenta}" opacity="0.08"/>
    <line x1="500" y1="360" x2="${W}" y2="360" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
  `,
  arcade_pulse: () => {
    const trails = [];
    for (let i = 0; i < 6; i++) {
      const y = 90 + i * 58;
      const c = i % 2 === 0 ? ACCENT.magenta : ACCENT.cyan;
      trails.push(`<path d="M${880 + i * 20} ${y} Q${1200} ${y - 35} ${1580} ${y + 25}" stroke="${c}" stroke-width="4" fill="none" opacity="${0.55 - i * 0.04}" stroke-linecap="round"/>`);
    }
    return trails.join("") + `<ellipse cx="1350" cy="230" rx="180" ry="90" fill="${ACCENT.magenta}" opacity="0.08"/>`;
  },
  signal_field: () => {
    const waves = [];
    for (let i = 0; i < 4; i++) {
      const y = 140 + i * 72;
      waves.push(`<path d="M550 ${y} Q900 ${y - 45} 1250 ${y} T${W} ${y - 10}" stroke="${ACCENT.blue}" stroke-width="2.5" fill="none" opacity="${0.5 - i * 0.07}"/>`);
    }
    return waves.join("") + `<ellipse cx="1300" cy="250" rx="200" ry="100" fill="${ACCENT.blue}" opacity="0.07"/>`;
  },

  crystal_void: () => {
    const crystals = [];
    const positions = [[1150, 300, 60, ACCENT.cyan], [1280, 220, 40, ACCENT.cyan], [1380, 340, 32, ACCENT.blue], [1050, 200, 26, ACCENT.blue]];
    for (const [cx, cy, size, color] of positions) {
      crystals.push(`<path d="M${cx} ${cy-size} L${cx+size*0.6} ${cy} L${cx} ${cy+size} L${cx-size*0.6} ${cy} Z" fill="${color}" opacity="0.5"/>
        <path d="M${cx} ${cy-size} L${cx+size*0.6} ${cy} L${cx} ${cy+size}" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" fill="none"/>`);
    }
    return dust(11, ACCENT.cyan, 30, 750, W) + crystals.join("");
  },
  aurora_circuit: () => {
    const bands = [];
    for (let i = 0; i < 3; i++) {
      const c = [ACCENT.cyan, ACCENT.magenta, ACCENT.cyan][i];
      bands.push(`<path d="M650 ${380 - i*40} Q950 ${150 - i*30} 1250 ${260 - i*20} T${W} ${200 - i*20}" stroke="${c}" stroke-width="${22 - i*4}" fill="none" opacity="0.32" stroke-linecap="round"/>`);
    }
    const grid = [];
    for (let i = 0; i < 6; i++) grid.push(`<line x1="${700+i*130}" y1="${H}" x2="${700+i*90}" y2="420" stroke="${ACCENT.blue}" stroke-width="1.5" opacity="0.22"/>`);
    return bands.join("") + grid.join("");
  },
  pixel_nebula: () => `
    <ellipse cx="1200" cy="260" rx="260" ry="150" fill="${ACCENT.magenta}" opacity="0.10"/>
    <ellipse cx="1300" cy="220" rx="160" ry="100" fill="${ACCENT.blue}" opacity="0.10"/>
    ${pixelDust(23, ACCENT.magenta, 18, 900, 1500)}
    ${dust(29, "#e8e2ff", 22, 800, W)}
  `,
  indie_constellation: () => {
    let s = 41;
    const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const stars = [];
    for (let i = 0; i < 9; i++) stars.push([900 + rand() * 620, 90 + rand() * 320]);
    const lines = [];
    for (let i = 0; i < stars.length - 1; i++) {
      if (rand() > 0.4) lines.push(`<line x1="${stars[i][0].toFixed(0)}" y1="${stars[i][1].toFixed(0)}" x2="${stars[i+1][0].toFixed(0)}" y2="${stars[i+1][1].toFixed(0)}" stroke="${ACCENT.gold}" stroke-width="1" opacity="0.35"/>`);
    }
    const dots = stars.map(([x, y]) => `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="3" fill="${ACCENT.gold}" opacity="0.8"/>`);
    return lines.join("") + dots.join("") + dust(47, "#e8e2ff", 25, 750, W);
  },

  rift_horizon: () => `
    <path d="M1180 90 L1210 220 L1320 240 L1200 260 L1230 400 L1140 250 L1020 260 L1160 220 Z" fill="${ACCENT.magenta}" opacity="0.4"/>
    <path d="M1180 90 L1210 220 L1320 240 L1200 260 L1230 400" stroke="${ACCENT.cyan}" stroke-width="2" fill="none" opacity="0.6"/>
    <ellipse cx="1190" cy="250" rx="200" ry="140" fill="${ACCENT.magenta}" opacity="0.12"/>
    ${dust(53, ACCENT.cyan, 24, 850, W)}
  `,
  celestial_engine: () => {
    const rings = [];
    for (let i = 0; i < 4; i++) rings.push(`<circle cx="1250" cy="250" r="${60 + i * 45}" fill="none" stroke="${i % 2 === 0 ? ACCENT.gold : ACCENT.blue}" stroke-width="2" opacity="${0.35 - i * 0.06}"/>`);
    return `<ellipse cx="1250" cy="250" rx="260" ry="200" fill="${ACCENT.gold}" opacity="0.08"/>` + rings.join("") +
      `<circle cx="1250" cy="250" r="26" fill="${ACCENT.gold}" opacity="0.55"/>`;
  },
  infinite_library: () => {
    const shelves = [];
    for (let i = 0; i < 6; i++) {
      const y = 110 + i * 58;
      const w = 720 - i * 55;
      shelves.push(`<rect x="${1550 - w}" y="${y}" width="${w}" height="7" fill="${ACCENT.gold}" opacity="${0.4 - i * 0.03}"/>`);
      for (let j = 0; j < 8 - i; j++) {
        shelves.push(`<rect x="${1560 - w + j * (w / (8 - i))}" y="${y - 38}" width="12" height="36" fill="${ACCENT.gold}" opacity="${0.22 + (j % 3) * 0.08}"/>`);
      }
    }
    return shelves.join("") + `<ellipse cx="1250" cy="260" rx="260" ry="180" fill="${ACCENT.gold}" opacity="0.05"/>`;
  },

  day_zero: () => `
    <ellipse cx="1200" cy="250" rx="380" ry="260" fill="${ACCENT.gold}" opacity="0.10"/>
    <circle cx="1200" cy="250" r="150" fill="none" stroke="${ACCENT.gold}" stroke-width="1.5" opacity="0.3"/>
    <circle cx="1200" cy="250" r="190" fill="none" stroke="${ACCENT.gold}" stroke-width="1" opacity="0.18"/>
    ${rloadMark(1200, 250, 200, ACCENT.gold, 0.22)}
    ${dust(67, ACCENT.gold, 40, 750, W)}
  `,
};

const BANNERS = [
  { id: "neon_grid", name: "Neon Grid", rarity: "common", category: "digital",
    description: "A quiet digital horizon illuminated by the first Rload signal." },
  { id: "violet_horizon", name: "Violet Horizon", rarity: "common", category: "landscape",
    description: "A deep indigo landscape beneath a glowing violet sky." },
  { id: "arcade_pulse", name: "Arcade Pulse", rarity: "common", category: "digital",
    description: "Retro-futuristic light trails moving through a dark digital space." },
  { id: "signal_field", name: "Signal Field", rarity: "common", category: "digital",
    description: "Soft waves of data travelling across the Rload network." },
  { id: "crystal_void", name: "Crystal Void", rarity: "rare", category: "cosmic",
    description: "Luminous crystals floating inside a dark cosmic cavern." },
  { id: "aurora_circuit", name: "Aurora Circuit", rarity: "rare", category: "digital",
    description: "An electric aurora flowing above a futuristic circuit landscape." },
  { id: "pixel_nebula", name: "Pixel Nebula", rarity: "rare", category: "cosmic",
    description: "A cloud of fragmented light forming inside deep space." },
  { id: "indie_constellation", name: "Indie Constellation", rarity: "rare", category: "cosmic",
    description: "A field of connected stars representing hidden creative worlds." },
  { id: "rift_horizon", name: "Rift Horizon", rarity: "epic", category: "cosmic",
    description: "A radiant dimensional rift opening above an unknown world." },
  { id: "celestial_engine", name: "Celestial Engine", rarity: "epic", category: "tech",
    description: "A colossal energy core powering the distant Rload network." },
  { id: "infinite_library", name: "Infinite Library", rarity: "epic", category: "archive",
    description: "An endless archive of glowing indie worlds waiting to be discovered." },
  { id: "day_zero", name: "Day Zero", rarity: "founder", category: "founder",
    description: "The original Rload signal emerging at the beginning of the journey." },
];

for (const b of BANNERS) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
${frame({ id: b.id, rarity: b.rarity })}
${SCENES[b.id]()}
${vignette(b.id)}
</svg>
`;
  const filename = b.id.replace(/_/g, "-") + ".svg";
  writeFileSync(join(OUT_DIR, filename), svg, "utf8");
  console.log("wrote", filename);
}
