// scripts/generate-premium-avatar-assets.mjs
//
// Premium Rload Avatar Collection (Player Identity V2, Phase 2) — 24 original
// vector portraits, replacing the temporary DiceBear "bottts" set. Kept
// entirely separate from scripts/generate-player-assets.mjs (which still
// generates the old avatars/banners/badges) so the old generator is never
// touched — per the brief, it's only retired once this collection is
// visually approved.
//
// SVG, same reasoning as the achievement badges: never blurs at 32–256px,
// no external API dependency at runtime, no downloaded/unlicensed assets —
// every shape here is hand-authored geometry.
//
// Shared visual grammar across all 24 (the "one coherent collection" ask):
//   - circular portrait, front-facing bust, centered, same camera angle
//   - dark indigo/purple base (rarity-tinted background ring)
//   - one shared rim-light + ambient-shadow pass (consistent lighting)
//   - accent palette limited to cyan / magenta / gold / blue — never more
//     than two accents per character, so the set doesn't read as noisy
//   - generous internal padding so a circular object-fit:cover crop (used by
//     some UI surfaces, e.g. the nav bar) never clips a silhouette feature
//
// Run: node scripts/generate-premium-avatar-assets.mjs
// Output: public/assets/player/avatars/<kebab-id>.svg (new filenames only —
// never collides with the old rload-core-*/rload-founder-*.svg files, so
// both sets can coexist until the old ones are removed post-approval).

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "assets", "player", "avatars");
mkdirSync(OUT_DIR, { recursive: true });

// Same official mark extraction used by the achievement badges — never redraw.
const RLOAD_MARK_PATHS = [
  "M131.09,145.81c14.69-19.11,41.29-33.91,29.06-62.04-3.13-7.2-10.53-14.75-17.97-17.45-.62-.22-6.23-1.74-6.57-1.74H58.88v101.02c0,.43.56,1.06,0,1.74h21.52v-81.23h51.72c.36,0,3.13,1.41,3.77,1.78,6.39,3.66,7.16,11.63,2.82,17.31l-20.82,22.57v-28.47h-21.52v68.04h68.04v-21.52h-33.32Z",
  "M131.09,145.81h33.32v21.52h-68.04v-68.04h21.52v28.47l20.82-22.57c4.34-5.68,3.58-13.65-2.82-17.31-.65-.37-3.42-1.78-3.77-1.78h-51.72v81.23h-21.52c.56-.67,0-1.31,0-1.74v-101.02h76.71c.34,0,5.95,1.52,6.57,1.74,7.45,2.7,14.84,10.25,17.97,17.45,12.23,28.13-14.37,42.93-29.06,62.04Z",
];
const MARK_BOX = { x: 58.88, y: 64.57, w: 105.53, h: 102.77 };
function rloadMark(cx, cy, size, fill) {
  const scale = size / Math.max(MARK_BOX.w, MARK_BOX.h);
  const tx = cx - (MARK_BOX.x + MARK_BOX.w / 2) * scale;
  const ty = cy - (MARK_BOX.y + MARK_BOX.h / 2) * scale;
  return `<g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(4)})" fill="${fill}">` +
    RLOAD_MARK_PATHS.map((d) => `<path d="${d}"/>`).join("") + `</g>`;
}

const ACCENT = { cyan: "#22D3EE", magenta: "#EC4899", gold: "#FFC24B", blue: "#3B82F6" };

const RARITY_BG = {
  common:  ["#2b2354", "#1a1533"],
  rare:    ["#1c3a5e", "#161233"],
  epic:    ["#4a1f4e", "#221230"],
  founder: ["#5a3a12", "#241730"],
};

// Shared portrait frame: circular canvas, rarity-tinted radial background,
// one rim-light arc (top-left) + one ambient shadow arc (bottom) so every
// avatar shares the same "camera angle + lighting" regardless of subject.
function portraitFrame({ id, rarity }) {
  const [c1, c2] = RARITY_BG[rarity];
  return `
    <defs>
      <radialGradient id="bg-${id}" cx="42%" cy="38%" r="75%">
        <stop offset="0%" stop-color="${c1}"/>
        <stop offset="100%" stop-color="${c2}"/>
      </radialGradient>
      <linearGradient id="rim-${id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="rgba(255,255,255,0.35)"/>
        <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
      </linearGradient>
    </defs>
    <circle cx="128" cy="128" r="126" fill="url(#bg-${id})"/>
    <circle cx="128" cy="128" r="126" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="2"/>
    <path d="M40 60 A100 100 0 0 1 196 46" stroke="url(#rim-${id})" stroke-width="10" fill="none" stroke-linecap="round" opacity="0.5"/>
    <ellipse cx="128" cy="222" rx="70" ry="16" fill="rgba(0,0,0,0.35)"/>
  `;
}

// ── Reusable feature snippets (mixed/matched per character, never identical
// combinations twice — the "no duplicate silhouettes" QC requirement) ──

const neck = (c) => `<path d="M104 168 L104 196 Q128 210 152 196 L152 168 Z" fill="${c}"/>`;

function earsTriangle(c, spread = 46) {
  return `<path d="M${128-spread} 92 L${128-spread+18} 60 L${128-spread+34} 96 Z" fill="${c}"/>
          <path d="M${128+spread} 92 L${128+spread-18} 60 L${128+spread-34} 96 Z" fill="${c}"/>`;
}
function earsRound(c, spread = 44) {
  return `<circle cx="${128-spread}" cy="88" r="16" fill="${c}"/><circle cx="${128+spread}" cy="88" r="16" fill="${c}"/>`;
}
function earsAngular(c, spread = 48) {
  return `<path d="M${128-spread} 100 L${128-spread+8} 54 L${128-spread+38} 98 Z" fill="${c}"/>
          <path d="M${128+spread} 100 L${128+spread-8} 54 L${128+spread-38} 98 Z" fill="${c}"/>`;
}
function antenna(c, x = 128) {
  return `<line x1="${x}" y1="80" x2="${x}" y2="52" stroke="${c}" stroke-width="4" stroke-linecap="round"/>
          <circle cx="${x}" cy="48" r="6" fill="${c}"/>`;
}
function hood(base, edge) {
  return `<path d="M76 150 Q72 78 128 66 Q184 78 180 150 Q180 178 128 182 Q76 178 76 150 Z" fill="${base}"/>
          <path d="M78 148 Q75 84 128 72 Q181 84 178 148" fill="none" stroke="${edge}" stroke-width="3" opacity="0.6"/>`;
}
function visorBand(c, y = 118, h = 16) {
  return `<rect x="86" y="${y}" width="84" height="${h}" rx="${h/2}" fill="${c}"/>`;
}
function helmet(base) {
  return `<path d="M80 140 Q76 66 128 62 Q180 66 176 140 L176 152 Q128 168 80 152 Z" fill="${base}"/>`;
}
function eyesDot(c, gap = 20, y = 128, r = 6) {
  return `<circle cx="${128-gap}" cy="${y}" r="${r}" fill="${c}"/><circle cx="${128+gap}" cy="${y}" r="${r}" fill="${c}"/>`;
}
function eyesGoggles(c, ring) {
  return `<circle cx="103" cy="128" r="17" fill="none" stroke="${ring}" stroke-width="4"/>
          <circle cx="153" cy="128" r="17" fill="none" stroke="${ring}" stroke-width="4"/>
          <circle cx="103" cy="128" r="8" fill="${c}"/><circle cx="153" cy="128" r="8" fill="${c}"/>
          <line x1="120" y1="128" x2="136" y2="128" stroke="${ring}" stroke-width="4"/>`;
}
function markings(c, opacity = 0.7) {
  return `<path d="M92 150 L104 158 M164 150 L152 158" stroke="${c}" stroke-width="3" opacity="${opacity}" stroke-linecap="round"/>`;
}
function crownSpikes(c, n = 5) {
  const spikes = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = 82 + t * 92;
    const h = i === Math.floor(n / 2) ? 34 : 22 - Math.abs(i - (n - 1) / 2) * 2;
    spikes.push(`<path d="M${x-7} 70 L${x} ${70-h} L${x+7} 70 Z" fill="${c}"/>`);
  }
  return spikes.join("");
}

const HEAD_BASE = "#3a2f66";
const HEAD_SHADE = "#241f42";

function head(shape = "round") {
  if (shape === "round") return `<circle cx="128" cy="128" r="52" fill="${HEAD_BASE}"/><circle cx="128" cy="128" r="52" fill="none" stroke="${HEAD_SHADE}" stroke-width="2"/>`;
  if (shape === "hex") return `<polygon points="128,74 172,100 172,156 128,182 84,156 84,100" fill="${HEAD_BASE}" stroke="${HEAD_SHADE}" stroke-width="2"/>`;
  if (shape === "square") return `<rect x="80" y="80" width="96" height="96" rx="18" fill="${HEAD_BASE}" stroke="${HEAD_SHADE}" stroke-width="2"/>`;
  return `<circle cx="128" cy="128" r="52" fill="${HEAD_BASE}"/>`;
}

// ── The 24 characters ──────────────────────────────────────────────────────

const CHARACTERS = {
  // COMMON
  neon_scout: () => `${neck("#2e2650")}${head("round")}${visorBand(ACCENT.cyan)}${antenna(ACCENT.cyan)}`,
  circuit_fox: () => `${neck("#2e2650")}${head("round")}${earsTriangle("#7a5a3a")}${eyesDot(ACCENT.gold, 18)}${markings(ACCENT.gold)}`,
  pixel_nomad: () => `${neck("#2e2650")}<rect x="78" y="82" width="100" height="100" rx="6" fill="${HEAD_BASE}"/>
    <rect x="78" y="82" width="14" height="14" fill="${ACCENT.gold}"/><rect x="164" y="82" width="14" height="14" fill="${ACCENT.gold}"/>
    <rect x="92" y="168" width="14" height="14" fill="${ACCENT.gold}"/><rect x="122" y="168" width="14" height="14" fill="${ACCENT.gold}"/><rect x="152" y="168" width="14" height="14" fill="${ACCENT.gold}"/>
    <rect x="78" y="82" width="14" height="100" fill="none"/>
    ${eyesDot("#e8e2ff", 18)}`,
  indigo_cat: () => `${neck("#2e2650")}${head("round")}${earsTriangle("#4a3d7a")}${eyesDot(ACCENT.cyan, 17, 128, 5)}`,
  signal_bot: () => `${neck("#2e2650")}${head("square")}${antenna(ACCENT.blue)}<circle cx="128" cy="130" r="14" fill="${ACCENT.blue}"/><circle cx="128" cy="130" r="6" fill="#0f0c1f"/>`,
  lunar_owl: () => `${neck("#2e2650")}${head("round")}${earsRound("#4a3d7a", 40)}${eyesGoggles(ACCENT.blue, "#8ea9e8")}`,
  arcade_runner: () => `${neck("#2e2650")}${head("round")}<rect x="82" y="104" width="92" height="12" rx="6" fill="${ACCENT.magenta}"/>
    <path d="M64 118 L78 122 M64 134 L78 132" stroke="${ACCENT.magenta}" stroke-width="3" opacity="0.6"/>${eyesDot("#e8e2ff", 18)}`,
  violet_pilot: () => `${neck("#2e2650")}${helmet("#4a3d7a")}${visorBand("#241f42", 116, 24)}${visorBand(ACCENT.blue, 122, 8)}`,

  // RARE
  crystal_ranger: () => `${neck("#213048")}${head("round")}${crownSpikes(ACCENT.cyan, 5)}${eyesDot(ACCENT.cyan, 18)}`,
  quantum_wolf: () => `${neck("#213048")}${head("round")}${earsAngular("#2a3a5a")}<circle cx="110" cy="128" r="6" fill="${ACCENT.magenta}"/><circle cx="146" cy="128" r="6" fill="${ACCENT.cyan}"/>`,
  aurora_hacker: () => `${neck("#213048")}${hood("#213a52", ACCENT.cyan)}<rect x="94" y="118" width="68" height="20" rx="4" fill="#0f1a2c"/>
    <rect x="94" y="118" width="68" height="20" rx="4" fill="url(#aurora-grad)"/>
    <defs><linearGradient id="aurora-grad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="${ACCENT.cyan}" stop-opacity="0.7"/><stop offset="100%" stop-color="${ACCENT.magenta}" stop-opacity="0.7"/></linearGradient></defs>`,
  void_monk: () => `${neck("#213048")}${hood("#182640", "#3a5a7a")}
    <circle cx="103" cy="176" r="4" fill="${ACCENT.cyan}" opacity="0.6"/><circle cx="118" cy="182" r="4" fill="${ACCENT.cyan}" opacity="0.6"/><circle cx="138" cy="182" r="4" fill="${ACCENT.cyan}" opacity="0.6"/><circle cx="153" cy="176" r="4" fill="${ACCENT.cyan}" opacity="0.6"/>
    ${eyesDot(ACCENT.cyan, 16, 132, 4)}`,
  neon_raven: () => `${neck("#213048")}${head("round")}<path d="M128 118 L112 138 L128 134 L144 138 Z" fill="#0f1a2c"/>
    <path d="M84 108 Q70 100 78 90 Q92 98 96 112 Z" fill="#1a2a44"/><path d="M172 108 Q186 100 178 90 Q164 98 160 112 Z" fill="#1a2a44"/>
    ${eyesDot(ACCENT.magenta, 16, 118, 4)}`,
  cyber_ronin: () => `${neck("#213048")}${helmet("#1a2a44")}
    <path d="M70 130 L90 96 L104 108 L92 140 Z" fill="#243a5e"/><path d="M186 130 L166 96 L152 108 L164 140 Z" fill="#243a5e"/>
    <path d="M82 98 Q128 78 174 98 L174 112 Q128 94 82 112 Z" fill="${ACCENT.gold}"/>
    <rect x="122" y="114" width="12" height="38" fill="#0a0e1a"/>
    ${eyesDot(ACCENT.gold, 20, 128, 3)}`,
  echo_explorer: () => `${neck("#213048")}${head("round")}${eyesGoggles(ACCENT.cyan, "#bfe3ff")}${antenna("#8ea9e8", 100)}${antenna("#8ea9e8", 156)}`,
  prism_guardian: () => `${neck("#213048")}${head("hex")}<polygon points="128,90 152,106 152,134 128,150 104,134 104,106" fill="none" stroke="${ACCENT.cyan}" stroke-width="3"/>
    ${eyesDot(ACCENT.cyan, 16, 122, 4)}`,

  // EPIC
  astral_warden: () => `${neck("#3a1f42")}${helmet("#3a1f42")}${crownSpikes(ACCENT.gold, 5)}${visorBand("#1a0f22", 118, 18)}${eyesDot(ACCENT.gold, 18, 127, 4)}`,
  rift_walker: () => `${neck("#3a1f42")}
    <g transform="translate(-6 -3)" opacity="0.6">${head("round")}${eyesDot(ACCENT.cyan, 18)}</g>
    <g transform="translate(7 4)" opacity="0.75">${head("round")}${eyesDot(ACCENT.magenta, 18)}</g>
    <rect x="76" y="112" width="104" height="6" fill="#0f0c1f" opacity="0.7"/>
    <rect x="70" y="140" width="116" height="4" fill="#0f0c1f" opacity="0.6"/>`,
  cosmic_alchemist: () => `${neck("#3a1f42")}${hood("#3a2352", ACCENT.gold)}
    <circle cx="176" cy="96" r="12" fill="${ACCENT.gold}" opacity="0.85"/><circle cx="176" cy="96" r="18" fill="none" stroke="${ACCENT.gold}" stroke-width="2" opacity="0.4"/>
    ${eyesDot(ACCENT.gold, 16, 132, 4)}`,
  shadow_navigator: () => `${neck("#3a1f42")}${hood("#241533", "#5a3a6e")}
    <path d="M92 160 Q128 178 164 160 L164 172 Q128 190 92 172 Z" fill="#170e22"/>
    <circle cx="128" cy="128" r="22" fill="none" stroke="${ACCENT.gold}" stroke-width="3"/>
    <line x1="128" y1="108" x2="128" y2="122" stroke="${ACCENT.gold}" stroke-width="3"/>
    <line x1="128" y1="134" x2="128" y2="148" stroke="${ACCENT.gold}" stroke-width="3"/>
    <line x1="108" y1="128" x2="122" y2="128" stroke="${ACCENT.gold}" stroke-width="3"/>
    <line x1="134" y1="128" x2="148" y2="128" stroke="${ACCENT.gold}" stroke-width="3"/>
    <circle cx="128" cy="128" r="4" fill="${ACCENT.gold}"/>`,
  celestial_engineer: () => `${neck("#3a1f42")}${helmet("#2f2050")}<circle cx="128" cy="126" r="20" fill="none" stroke="${ACCENT.gold}" stroke-width="4"/>
    <circle cx="128" cy="126" r="20" fill="none" stroke="${ACCENT.gold}" stroke-width="4" stroke-dasharray="4 6" transform="rotate(20 128 126)"/>
    <circle cx="128" cy="126" r="7" fill="${ACCENT.gold}"/>`,
  nova_sentinel: () => `${neck("#3a1f42")}${helmet("#2f2050")}
    <path d="M128 58 L136 90 L128 100 L120 90 Z" fill="${ACCENT.magenta}"/>
    <path d="M176 78 L152 100 L142 112 L160 94 Z" fill="${ACCENT.magenta}"/>
    <path d="M80 78 L104 100 L114 112 L96 94 Z" fill="${ACCENT.magenta}"/>
    <path d="M188 118 L156 122 L156 132 L188 130 Z" fill="${ACCENT.magenta}" opacity="0.85"/>
    <path d="M68 118 L100 122 L100 132 L68 130 Z" fill="${ACCENT.magenta}" opacity="0.85"/>
    <circle cx="128" cy="128" r="10" fill="${ACCENT.magenta}"/><circle cx="128" cy="128" r="5" fill="#1a1030"/>`,

  // FOUNDER
  day_zero_guardian: () => `${neck("#4a3712")}${helmet("#5a4318")}${crownSpikes(ACCENT.gold, 5)}${visorBand("#1a1206", 118, 20)}${visorBand(ACCENT.gold, 124, 4)}
    <circle cx="128" cy="188" r="17" fill="#1a1206"/>
    ${rloadMark(128, 188, 22, ACCENT.gold)}`,
  rload_founder: () => `${neck("#4a3712")}${head("round")}<path d="M84 150 Q128 168 172 150 L172 168 Q128 186 84 168 Z" fill="#5a4318"/>
    ${rloadMark(128, 128, 46, "rgba(255,255,255,0.95)")}`,
};

const AVATARS = [
  { id: "neon_scout", name: "Neon Scout", rarity: "common" },
  { id: "circuit_fox", name: "Circuit Fox", rarity: "common" },
  { id: "pixel_nomad", name: "Pixel Nomad", rarity: "common" },
  { id: "indigo_cat", name: "Indigo Cat", rarity: "common" },
  { id: "signal_bot", name: "Signal Bot", rarity: "common" },
  { id: "lunar_owl", name: "Lunar Owl", rarity: "common" },
  { id: "arcade_runner", name: "Arcade Runner", rarity: "common" },
  { id: "violet_pilot", name: "Violet Pilot", rarity: "common" },
  { id: "crystal_ranger", name: "Crystal Ranger", rarity: "rare" },
  { id: "quantum_wolf", name: "Quantum Wolf", rarity: "rare" },
  { id: "aurora_hacker", name: "Aurora Hacker", rarity: "rare" },
  { id: "void_monk", name: "Void Monk", rarity: "rare" },
  { id: "neon_raven", name: "Neon Raven", rarity: "rare" },
  { id: "cyber_ronin", name: "Cyber Ronin", rarity: "rare" },
  { id: "echo_explorer", name: "Echo Explorer", rarity: "rare" },
  { id: "prism_guardian", name: "Prism Guardian", rarity: "rare" },
  { id: "astral_warden", name: "Astral Warden", rarity: "epic" },
  { id: "rift_walker", name: "Rift Walker", rarity: "epic" },
  { id: "cosmic_alchemist", name: "Cosmic Alchemist", rarity: "epic" },
  { id: "shadow_navigator", name: "Shadow Navigator", rarity: "epic" },
  { id: "celestial_engineer", name: "Celestial Engineer", rarity: "epic" },
  { id: "nova_sentinel", name: "Nova Sentinel", rarity: "epic" },
  { id: "day_zero_guardian", name: "Day Zero Guardian", rarity: "founder" },
  { id: "rload_founder", name: "Rload Founder", rarity: "founder" },
];

for (const a of AVATARS) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
${portraitFrame({ id: a.id, rarity: a.rarity })}
${CHARACTERS[a.id]()}
</svg>
`;
  const filename = a.id.replace(/_/g, "-") + ".svg";
  writeFileSync(join(OUT_DIR, filename), svg, "utf8");
  console.log("wrote", filename);
}
