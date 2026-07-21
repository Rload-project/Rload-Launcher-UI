// scripts/generate-premium-badge-assets.mjs
//
// Premium Rload Profile Badge Collection (Player Identity V2, Phase 4) —
// replaces the temporary procedural-glyph badges with real medal artwork,
// matching the quality bar set by the avatar/banner/achievement passes.
//
// No ID migration needed here — unlike avatars/banners, every badge id in
// src/data/badges.json is already a stable, semantic slug (badge-first-steps,
// badge-veteran, ...), not a sequential placeholder — so this is a pure
// asset+manifest quality upgrade, same ids, same unlockType/unlockRequirement.
//
// Visual differentiation from the other three cosmetic systems (all four
// now read as one family, but never identical shapes):
//   - Achievements  → hexagon frame            (scripts/generate-achievement-assets.mjs)
//   - Avatars       → circular portrait bust   (scripts/generate-premium-avatar-assets.mjs)
//   - Banners       → wide 3.2:1 environment   (scripts/generate-premium-banner-assets.mjs)
//   - Profile Badges→ circular medal + ribbon  (this file)
//
// Run: node scripts/generate-premium-badge-assets.mjs
// Output: public/assets/player/badges/<id>.svg (same filenames as today —
// overwrites the old procedural glyphs; nothing else references the old
// pixel content, only the path, which stays identical).

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "assets", "player", "badges");

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

const RARITY_METAL = {
  common:  ["#3a2f66", "#241f42"],
  rare:    ["#1f4a6e", "#152c40"],
  epic:    ["#5a2f66", "#301a3a"],
  founder: ["#5a4318", "#2a1f0a"],
};
const RARITY_ACCENT = { common: "#9B7BFF", rare: "#22D3EE", epic: "#EC4899", founder: "#FFC24B" };

// Circular medal + two ribbon tails, rarity-tinted — the shared frame every
// badge uses, same lighting/shadow/thickness so the set reads as handcrafted.
function medalFrame({ id, rarity }) {
  const [m1, m2] = RARITY_METAL[rarity];
  const accent = RARITY_ACCENT[rarity];
  return `
    <defs>
      <linearGradient id="metal-${id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${m1}"/>
        <stop offset="100%" stop-color="${m2}"/>
      </linearGradient>
      <radialGradient id="core-${id}" cx="50%" cy="40%" r="60%">
        <stop offset="0%" stop-color="rgba(255,255,255,0.28)"/>
        <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
      </radialGradient>
      <filter id="shadow-${id}" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.4"/>
      </filter>
    </defs>
    <path d="M100 150 L82 232 L108 218 L128 236 L148 218 L174 232 L156 150 Z" fill="${m2}" opacity="0.85"/>
    <g filter="url(#shadow-${id})">
      <circle cx="128" cy="112" r="88" fill="url(#metal-${id})"/>
    </g>
    <circle cx="128" cy="112" r="88" fill="none" stroke="${accent}" stroke-width="2.5"/>
    <circle cx="128" cy="112" r="78" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
    <circle cx="128" cy="112" r="70" fill="url(#core-${id})"/>
    <circle cx="128" cy="112" r="70" fill="none" stroke="${accent}" stroke-opacity="0.5" stroke-width="1.2"/>
  `;
}

const C = { star: "#FFC24B", cyan: "#22D3EE", magenta: "#EC4899", blue: "#3B82F6", warm: "#FDBA74" };

// ── Per-badge icon glyphs, centered at (128,112), ~70px ──────────────────────
const ICONS = {
  "badge-rising-star": (c) => `<path d="M128 66 L140 100 L176 100 L146 122 L158 156 L128 134 L98 156 L110 122 L80 100 L116 100 Z" fill="${c}"/>`,
  "badge-newcomer": (c) => `<path d="M128 70 L128 130 M128 70 L110 88 M128 70 L146 88" stroke="${c}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M96 150 Q128 170 160 150" stroke="${c}" stroke-width="6" fill="none" stroke-linecap="round"/>`,
  "badge-supporter": (c) => `<path d="M128 148 C90 118 88 88 108 76 C120 69 128 80 128 88 C128 80 136 69 148 76 C168 88 166 118 128 148 Z" fill="${c}"/>`,
  "badge-enthusiast": (c) => `<path d="M128 66 C112 92 100 106 100 126 a28 28 0 0 0 56 0 C156 106 144 92 128 66 Z M128 96 C120 110 116 118 116 128 a12 12 0 0 0 24 0 C140 118 136 110 128 96 Z" fill="${c}"/>`,
  "badge-pioneer-spirit": (c) => `<circle cx="128" cy="112" r="38" fill="none" stroke="${c}" stroke-width="5"/><path d="M128 84 L140 108 L128 140 L116 108 Z" fill="${c}"/>`,
  "badge-first-steps": (c) => `<ellipse cx="112" cy="96" rx="12" ry="18" fill="${c}" transform="rotate(-15 112 96)"/><ellipse cx="146" cy="132" rx="12" ry="18" fill="${c}" transform="rotate(12 146 132)"/>`,
  "badge-dedicated": (c) => `<path d="M100 72 L100 152" stroke="${c}" stroke-width="6" stroke-linecap="round"/><path d="M100 76 L156 90 L100 108 Z" fill="${c}"/>`,
  "badge-trailblazer": (c) => `<path d="M128 70 C112 96 108 110 116 126 a14 14 0 0 0 24 0 c8-16 4-30-12-56 Z" fill="${c}"/><rect x="122" y="126" width="12" height="26" fill="${c}"/>`,
  "badge-collector": (c) => `<rect x="96" y="120" width="28" height="28" rx="4" fill="${c}" opacity="0.9"/><rect x="132" y="112" width="28" height="28" rx="4" fill="${c}"/><rect x="114" y="86" width="28" height="28" rx="4" fill="${c}" opacity="0.75"/>`,
  "badge-weekend-warrior": (c) => `<path d="M128 70 L166 84 L166 118 C166 146 148 162 128 170 C108 162 90 146 90 118 L90 84 Z" fill="${c}"/>`,
  "badge-explorer": (c) => `<circle cx="128" cy="112" r="42" fill="none" stroke="${c}" stroke-width="4"/><path d="M112 128 L136 96 L144 96 L120 128 Z" fill="${c}"/><circle cx="128" cy="112" r="4" fill="${c}"/>`,
  "badge-belgian-gamer": (c) => `<circle cx="102" cy="112" r="8" fill="${c}"/><path d="M96 120 Q128 148 160 120" stroke="${c}" stroke-width="4" fill="none"/><path d="M90 108 Q128 132 166 108" stroke="${c}" stroke-width="4" fill="none" opacity="0.6"/><path d="M84 96 Q128 116 172 96" stroke="${c}" stroke-width="4" fill="none" opacity="0.35"/>`,
  "badge-achievement-hunter": (c) => `<path d="M104 78 L152 78 L152 100 C152 118 140 128 128 128 C116 128 104 118 104 100 Z" fill="${c}"/><path d="M104 82 L88 82 L88 96 C88 106 96 112 104 110 M152 82 L168 82 L168 96 C168 106 160 112 152 110" stroke="${c}" stroke-width="4" fill="none"/><rect x="120" y="128" width="16" height="18" fill="${c}"/>`,
  "badge-hidden-gem-seeker": (c) => `<path d="M100 104 L128 76 L156 104 L128 152 Z" fill="${c}" opacity="0.9"/><path d="M100 104 L156 104 M128 76 L114 104 L128 152 M128 76 L142 104 L128 152" stroke="rgba(255,255,255,0.5)" stroke-width="2"/>`,
  "badge-early-supporter": (c) => `<circle cx="128" cy="112" r="36" fill="none" stroke="${c}" stroke-width="5"/><path d="M128 92 L128 112 L144 122" stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  "badge-indie-lover": (c) => `<path d="M128 140 C98 116 96 92 112 82 C120 77 128 85 128 92 C128 85 136 77 144 82 C160 92 158 116 128 140 Z" fill="${c}"/><circle cx="128" cy="100" r="6" fill="#1a1530"/>`,
  "badge-developer-friend": (c) => `<circle cx="128" cy="112" r="16" fill="none" stroke="${c}" stroke-width="6"/><path d="M128 88 L128 78 M128 146 L128 136 M104 112 L94 112 M162 112 L152 112 M111 95 L104 88 M145 95 L152 88 M111 129 L104 136 M145 129 L152 136" stroke="${c}" stroke-width="5" stroke-linecap="round"/>`,
  "badge-speedrunner": (c) => `<path d="M136 68 L100 120 L122 120 L114 156 L156 100 L132 100 Z" fill="${c}"/>`,
  "badge-night-owl": (c) => `<path d="M148 82 a34 34 0 1 0 0 60 a28 28 0 1 1 0-60 Z" fill="${c}"/>`,
  "badge-veteran": (c) => `<path d="M128 70 L162 84 L162 116 C162 142 146 158 128 166 C110 158 94 142 94 116 L94 84 Z" fill="${c}"/><path d="M128 92 L136 108 L154 110 L140 122 L144 140 L128 130 L112 140 L116 122 L102 110 L120 108 Z" fill="rgba(255,255,255,0.85)"/>`,
  "badge-founder": (c, id) => rloadMark(128, 112, 84, c),
  "badge-community-pioneer": (c) => `<circle cx="108" cy="120" r="16" fill="${c}" opacity="0.8"/><circle cx="148" cy="120" r="16" fill="${c}" opacity="0.8"/><circle cx="128" cy="96" r="18" fill="${c}"/>`,
  "badge-tester": (c) => `<circle cx="118" cy="102" r="24" fill="none" stroke="${c}" stroke-width="5"/><path d="M136 120 L156 140" stroke="${c}" stroke-width="6" stroke-linecap="round"/><path d="M108 102 L115 109 L130 92" stroke="${c}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  "badge-perfectionist": (c) => `<path d="M128 72 L160 100 L146 152 L110 152 L96 100 Z" fill="${c}" opacity="0.9"/><path d="M128 72 L160 100 M128 72 L96 100 M96 100 L146 152 M160 100 L110 152 M96 100 L160 100" stroke="rgba(255,255,255,0.5)" stroke-width="1.5" fill="none"/>`,
};

const BADGES = [
  { id: "badge-rising-star", rarity: "common", category: "starter" },
  { id: "badge-newcomer", rarity: "common", category: "starter" },
  { id: "badge-supporter", rarity: "common", category: "starter" },
  { id: "badge-enthusiast", rarity: "common", category: "starter" },
  { id: "badge-pioneer-spirit", rarity: "common", category: "starter" },
  { id: "badge-first-steps", rarity: "rare", category: "milestone" },
  { id: "badge-dedicated", rarity: "rare", category: "milestone" },
  { id: "badge-trailblazer", rarity: "rare", category: "milestone" },
  { id: "badge-collector", rarity: "rare", category: "milestone" },
  { id: "badge-weekend-warrior", rarity: "rare", category: "milestone" },
  { id: "badge-explorer", rarity: "rare", category: "milestone" },
  { id: "badge-belgian-gamer", rarity: "rare", category: "milestone" },
  { id: "badge-achievement-hunter", rarity: "rare", category: "milestone" },
  { id: "badge-hidden-gem-seeker", rarity: "rare", category: "milestone" },
  { id: "badge-early-supporter", rarity: "epic", category: "loyalty" },
  { id: "badge-indie-lover", rarity: "epic", category: "loyalty" },
  { id: "badge-developer-friend", rarity: "epic", category: "loyalty" },
  { id: "badge-speedrunner", rarity: "epic", category: "loyalty" },
  { id: "badge-night-owl", rarity: "epic", category: "loyalty" },
  { id: "badge-veteran", rarity: "epic", category: "loyalty" },
  { id: "badge-founder", rarity: "founder", category: "founder" },
  { id: "badge-community-pioneer", rarity: "founder", category: "founder" },
  { id: "badge-tester", rarity: "founder", category: "founder" },
  { id: "badge-perfectionist", rarity: "founder", category: "founder" },
];

for (const b of BADGES) {
  const accent = RARITY_ACCENT[b.rarity];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
${medalFrame({ id: b.id, rarity: b.rarity })}
${ICONS[b.id](accent, b.id)}
</svg>
`;
  writeFileSync(join(OUT_DIR, `${b.id}.svg`), svg, "utf8");
  console.log("wrote", b.id + ".svg");
}
