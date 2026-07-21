// scripts/generate-achievement-assets.mjs
//
// Generates the 11 achievement badge icons (Player Identity V2) as vector
// SVG — hex-metal frame + category accent + per-achievement symbol, matching
// the approved concept-board direction (hexagonal base, brushed metal,
// Rload Purple palette, soft multi-layer lighting, subtle outer glow).
//
// SVG, not the .webp originally sketched in the brief: every other Player
// Identity asset in this repo (avatars/banners/badges) is SVG, and vector art
// never blurs at 512/256/128/64/32 — it satisfies "verify readability at
// small sizes" strictly better than a raster resize would. If a raster
// export is ever needed for an external surface (store page, social), render
// these SVGs through a real rasterizer (Inkscape/resvg) at that time.
//
// The official Rload mark is never redrawn here — every badge that shows it
// inlines the exact path data from public/assets/brand/rload-mark-official.svg
// (itself extracted from public/images/common/Logo-couleur.svg, the same
// source as launcher/assets/taskbar-icon.ico). See RLOAD_MARK_PATHS below.
//
// Run: node scripts/generate-achievement-assets.mjs
// Output: public/assets/player/achievements/<id>.svg

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "assets", "player", "achievements");
mkdirSync(OUT_DIR, { recursive: true });

// Exact path data extracted from public/assets/brand/rload-mark-official.svg —
// do not hand-edit; re-extract from the source logo if the mark ever changes.
const RLOAD_MARK_PATHS = [
  "M131.09,145.81c14.69-19.11,41.29-33.91,29.06-62.04-3.13-7.2-10.53-14.75-17.97-17.45-.62-.22-6.23-1.74-6.57-1.74H58.88v101.02c0,.43.56,1.06,0,1.74h21.52v-81.23h51.72c.36,0,3.13,1.41,3.77,1.78,6.39,3.66,7.16,11.63,2.82,17.31l-20.82,22.57v-28.47h-21.52v68.04h68.04v-21.52h-33.32Z",
  "M131.09,145.81h33.32v21.52h-68.04v-68.04h21.52v28.47l20.82-22.57c4.34-5.68,3.58-13.65-2.82-17.31-.65-.37-3.42-1.78-3.77-1.78h-51.72v81.23h-21.52c.56-.67,0-1.31,0-1.74v-101.02h76.71c.34,0,5.95,1.52,6.57,1.74,7.45,2.7,14.84,10.25,17.97,17.45,12.23,28.13-14.37,42.93-29.06,62.04Z",
];
// Native bbox of the mark within its own path coordinate space (see extraction).
const MARK_BOX = { x: 58.88, y: 64.57, w: 105.53, h: 102.77 };

/** Inline the official mark, scaled/positioned to fit a `size`-wide square centered at (cx, cy). */
function rloadMark(cx, cy, size, fillId) {
  const scale = size / Math.max(MARK_BOX.w, MARK_BOX.h);
  const tx = cx - (MARK_BOX.x + MARK_BOX.w / 2) * scale;
  const ty = cy - (MARK_BOX.y + MARK_BOX.h / 2) * scale;
  return `<g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(4)})" fill="${fillId}">` +
    RLOAD_MARK_PATHS.map((d) => `<path d="${d}"/>`).join("") +
    `</g>`;
}

// Small 4-point sparkle, scattered around Day Zero's central mark only —
// the "founding-era" premium flourish (gold contour + halo already come from
// the `founder` accent color and the stronger glow filter above; this is the
// "little stars" half of that ask).
function sparkle(cx, cy, size, color, opacity) {
  const s = size;
  return `<path d="M${cx} ${cy - s} L${cx + s * 0.22} ${cy - s * 0.22} L${cx + s} ${cy} L${cx + s * 0.22} ${cy + s * 0.22} L${cx} ${cy + s} L${cx - s * 0.22} ${cy + s * 0.22} L${cx - s} ${cy} L${cx - s * 0.22} ${cy - s * 0.22} Z" fill="${color}" opacity="${opacity}"/>`;
}
function founderSparkles() {
  return [
    sparkle(72, 70, 7, "#FFE9B8", 0.9),
    sparkle(190, 82, 5, "#FFE9B8", 0.7),
    sparkle(78, 178, 5, "#FFE9B8", 0.65),
    sparkle(184, 172, 8, "#FFE9B8", 0.85),
  ].join("");
}

const CATEGORY_COLOR = {
  discovery: "#8B5CF6",
  exploration: "#22D3EE",
  studios: "#F59E0B",
  playtime: "#3B82F6",
  special: "#EC4899",
  belgian: "#FCD34D", // manual override lane, not a real achievement category
};

const DIFFICULTY_RING = { easy: 1, medium: 2, hard: 3 };

// 256x256 canvas — hex frame vertices (flat-top hexagon), brushed-metal fill,
// category-accent edge, soft outer glow, translucent circular core so the
// central symbol always reads clearly regardless of frame busyness.
function hexFrame({ id, accent, ringCount, founder = false }) {
  const hex = "128,8 240,68 240,188 128,248 16,188 16,68";
  const hexInner = (inset) => {
    // Rough inward-scaled hexagon for the metal bevel + accent rings.
    const pts = hex.split(" ").map((p) => p.split(",").map(Number));
    return pts.map(([x, y]) => {
      const dx = x - 128, dy = y - 128;
      const d = Math.hypot(dx, dy) || 1;
      const f = (d - inset) / d;
      return `${(128 + dx * f).toFixed(1)},${(128 + dy * f).toFixed(1)}`;
    }).join(" ");
  };

  const rings = [];
  for (let i = 0; i < ringCount; i++) {
    rings.push(
      `<polygon points="${hexInner(6 + i * 5)}" fill="none" stroke="${accent}" stroke-opacity="${0.85 - i * 0.22}" stroke-width="1.4"/>`
    );
  }

  return `
    <defs>
      <linearGradient id="metal-${id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${founder ? "#3a2f66" : "#241f42"}"/>
        <stop offset="45%" stop-color="${founder ? "#57406e" : "#3a2f66"}"/>
        <stop offset="100%" stop-color="${founder ? "#1a1530" : "#17132b"}"/>
      </linearGradient>
      <radialGradient id="core-${id}" cx="50%" cy="42%" r="65%">
        <stop offset="0%" stop-color="rgba(255,255,255,0.30)"/>
        <stop offset="60%" stop-color="rgba(255,255,255,0.08)"/>
        <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
      </radialGradient>
      <filter id="glow-${id}" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="${founder ? 8 : 5}" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="shadow-${id}" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000" flood-opacity="0.45"/>
      </filter>
    </defs>
    <g filter="url(#shadow-${id})">
      <polygon points="${hex}" fill="url(#metal-${id})"/>
    </g>
    <polygon points="${hex}" fill="none" stroke="${accent}" stroke-width="2.5" filter="url(#glow-${id})"/>
    <polygon points="${hexInner(4)}" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1"/>
    ${rings.join("")}
    <circle cx="128" cy="122" r="66" fill="url(#core-${id})"/>
    <circle cx="128" cy="122" r="66" fill="none" stroke="${accent}" stroke-opacity="0.5" stroke-width="1.2"/>
  `;
}

// Small official-mark roundel stamped on the lower frame of every badge
// (per the approved concept board), separate from Day Zero's central use.
function lowerMarkRoundel(id) {
  return `
    <circle cx="128" cy="222" r="17" fill="#0f0c1f" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>
    <circle cx="128" cy="222" r="13.5" fill="rgba(255,255,255,0.85)"/>
    ${rloadMark(128, 222, 17, `url(#metal-${id})`).replace(`url(#metal-${id})`, "#2a2350")}
  `;
}

// ── Per-achievement central symbol (flat vector line-art, centered at 128,122, ~70px) ──

const SYMBOLS = {
  first_step: (c) => `
    <g stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M96 150 L96 110 L128 96 L160 110 L160 150 L128 164 Z"/>
      <path d="M96 110 L128 124 L160 110 M128 124 L128 164"/>
      <path d="M128 60 L128 90 M116 78 L128 92 L140 78" stroke-width="5.5"/>
    </g>`,
  first_launch: (c) => `
    <g stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="128" cy="122" r="34"/>
      <path d="M118 104 L146 122 L118 140 Z" fill="${c}" stroke="none"/>
      <path d="M128 68 L128 82 M167 84 L157 93 M89 84 L99 93 M180 122 L166 122 M76 122 L90 122" stroke-width="5.5"/>
    </g>`,
  first_discovery: (c) => `
    <g stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="122" cy="128" r="38"/>
      <circle cx="122" cy="128" r="24"/>
      <circle cx="122" cy="128" r="10"/>
      <path d="M150 100 L176 74" />
      <path d="M176 74 L176 90 M176 74 L160 74" stroke-width="5"/>
    </g>`,
  explorer_i: (c) => `
    <g stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="92" cy="150" r="11" fill="${c}" stroke="none"/>
      <circle cx="128" cy="118" r="11" fill="${c}" stroke="none" opacity="0.85"/>
      <circle cx="164" cy="150" r="11" fill="${c}" stroke="none" opacity="0.65"/>
      <path d="M92 150 L128 118 L164 150" stroke-dasharray="2 8"/>
    </g>`,
  explorer_ii: (c) => `
    <g stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="128" cy="122" r="40"/>
      <path d="M128 82 L136 114 L128 122 L120 114 Z" fill="${c}" stroke="none"/>
      <path d="M128 162 L120 130 L128 122 L136 130 Z" fill="${c}" stroke="none" opacity="0.55"/>
      <circle cx="128" cy="122" r="4.5" fill="${c}" stroke="none"/>
    </g>`,
  studio_hopper: (c) => `
    <g stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round">
      <circle cx="128" cy="98" r="9" fill="${c}" stroke="none"/>
      <circle cx="96" cy="128" r="9" fill="${c}" stroke="none"/>
      <circle cx="160" cy="128" r="9" fill="${c}" stroke="none"/>
      <circle cx="108" cy="158" r="9" fill="${c}" stroke="none"/>
      <circle cx="148" cy="158" r="9" fill="${c}" stroke="none"/>
      <path d="M128 98 L96 128 M128 98 L160 128 M96 128 L108 158 M160 128 L148 158 M108 158 L148 158" stroke-opacity="0.7"/>
    </g>`,
  belgian_explorer: (c) => `
    <g stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="128" cy="140" r="6" fill="${c}" stroke="none"/>
      <path d="M108 140 a20 20 0 0 1 40 0"/>
      <path d="M96 140 a32 32 0 0 1 64 0"/>
      <path d="M84 140 a44 44 0 0 1 88 0"/>
    </g>`,
  hidden_gem_hunter: (c) => `
    <g stroke-linecap="round" stroke-linejoin="round">
      <path d="M100 118 L128 86 L156 118 L128 168 Z" fill="${c}" fill-opacity="0.9" stroke="${c}" stroke-width="3"/>
      <path d="M100 118 L156 118 M128 86 L114 118 L128 168 M128 86 L142 118 L128 168" stroke="rgba(255,255,255,0.55)" stroke-width="2" fill="none"/>
      <circle cx="86" cy="150" r="4" fill="${c}"/>
      <circle cx="170" cy="140" r="3" fill="${c}" opacity="0.7"/>
      <circle cx="150" cy="176" r="3" fill="${c}" opacity="0.6"/>
    </g>`,
  weekend_player: (c) => `
    <g stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M150 92 a34 34 0 1 0 0 60 a28 28 0 1 1 0-60 Z" fill="${c}" fill-opacity="0.85" stroke="none"/>
      <circle cx="110" cy="160" r="3.5" fill="${c}"/>
      <circle cx="122" cy="168" r="3.5" fill="${c}" opacity="0.7"/>
      <circle cx="98" cy="170" r="3.5" fill="${c}" opacity="0.55"/>
    </g>`,
  completion_starter: (c) => `
    <g stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round">
      <ellipse cx="104" cy="104" rx="15" ry="11" transform="rotate(-40 104 104)"/>
      <ellipse cx="128" cy="122" rx="15" ry="11" transform="rotate(-40 128 122)"/>
      <ellipse cx="152" cy="140" rx="15" ry="11" transform="rotate(-40 152 140)"/>
      <ellipse cx="176" cy="158" rx="15" ry="11" transform="rotate(-40 176 158)" opacity="0.55"/>
      <ellipse cx="80" cy="86" rx="15" ry="11" transform="rotate(-40 80 86)" opacity="0.55"/>
    </g>`,
};

const ACHIEVEMENTS = [
  { id: "boot_sequence",      achId: "first_step",         category: "discovery",   difficulty: "easy" },
  { id: "ignition",           achId: "first_launch",       category: "discovery",   difficulty: "easy" },
  { id: "signal_found",       achId: "first_discovery",     category: "discovery",   difficulty: "easy" },
  { id: "beyond_the_first",   achId: "explorer_i",          category: "exploration", difficulty: "medium" },
  { id: "wide_horizon",       achId: "explorer_ii",         category: "exploration", difficulty: "hard" },
  { id: "studio_drifter",     achId: "studio_hopper",       category: "studios",     difficulty: "medium" },
  { id: "local_frequency",    achId: "belgian_explorer",    category: "belgian",    difficulty: "medium" },
  { id: "below_the_surface",  achId: "hidden_gem_hunter",   category: "discovery",   difficulty: "medium" },
  { id: "weekend_ritual",     achId: "weekend_player",      category: "playtime",   difficulty: "medium" },
  { id: "chain_reaction",     achId: "completion_starter",  category: "special",     difficulty: "easy" },
  { id: "day_zero",           achId: "founding_member",     category: "special",     difficulty: "hard", founder: true },
];

for (const a of ACHIEVEMENTS) {
  const accent = a.founder ? "#FFC24B" : CATEGORY_COLOR[a.category] || CATEGORY_COLOR.special;
  const ringCount = DIFFICULTY_RING[a.difficulty] || 1;
  const centralSymbol = a.founder ? rloadMark(128, 116, 100, "rgba(255,255,255,0.94)") : (SYMBOLS[a.achId]?.(accent) || "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
${hexFrame({ id: a.id, accent, ringCount, founder: a.founder })}
${a.founder ? founderSparkles() : ""}
${centralSymbol}
${lowerMarkRoundel(a.id)}
</svg>
`;
  writeFileSync(join(OUT_DIR, `${a.id}.svg`), svg, "utf8");
  console.log("wrote", a.id + ".svg");
}
