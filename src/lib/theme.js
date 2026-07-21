// src/lib/theme.js
//
// Design tokens — official Rload palette (charte graphique), matching the
// M4.5 visual-polish rebrand: base #302861 · surface #442c75 · accent #804af0.
// Extracted from routes/launcher-games.jsx so every new component (Player
// Identity and beyond) shares the exact same palette instead of redefining it.
export const T = {
  bgDeep:       "#302861",   // base — darkest official purple, main app background
  bgMid:        "#442c75",   // surface — official mid violet, nav bar / elevated panels
  bgSidebar:    "#221c46",   // shade of base (darker, same hue family) — sidebar contrast only
  bgCard:       "rgba(255,255,255,0.05)",
  bgCardHover:  "rgba(255,255,255,0.09)",
  bgGlass:      "rgba(255,255,255,0.06)",
  border:       "rgba(255,255,255,0.11)",
  borderBright: "rgba(255,255,255,0.20)",
  borderBrand:  "rgba(128,74,240,0.3)",
  brand:        "#804af0",
  brandGrad:    "linear-gradient(135deg, #804af0 0%, #442c75 100%)",
  brandGradHov: "linear-gradient(135deg, #8f5ff2 0%, #4f3384 100%)",
  brandGlow:    "0 4px 24px rgba(128,74,240,0.45)",
  brandGlowHov: "0 8px 36px rgba(128,74,240,0.6)",
  brandLight:   "#C9AEFB",
  brandSoft:    "#B79AF0",
  green:        "#22c55e",
  greenBg:      "rgba(34,197,94,0.14)",
  greenBorder:  "rgba(34,197,94,0.28)",
  blue:         "#60a5fa",
  blueBg:       "rgba(96,165,250,0.14)",
  blueBorder:   "rgba(96,165,250,0.28)",
  blue2:        "#2B7FFF",
  blue2Bg:      "rgba(43,127,255,0.2)",
  blue2Border:  "rgba(43,127,255,0.3)",
  blue2Light:   "#8EC5FF",
  purple:       "#c084fc",
  purpleBg:     "rgba(192,132,252,0.14)",
  purpleBorder: "rgba(192,132,252,0.28)",
  orange:       "#fb923c",
  orangeBg:     "rgba(251,146,60,0.14)",
  orangeBorder: "rgba(251,146,60,0.28)",
  red:          "#f87171",
  redBg:        "rgba(248,113,113,0.14)",
  redBorder:    "rgba(248,113,113,0.28)",
  gold:         "#FFC24B",   // founder-rarity accent — badges/avatars/banners/CosmeticsPickerModal all share this one token
  goldBg:       "rgba(255,194,75,0.14)",
  goldBorder:   "rgba(255,194,75,0.28)",
  text:         "#FCFCFC",
  textSub:      "rgba(255,255,255,0.72)",
  textMuted:    "rgba(255,255,255,0.50)",
  textDim:      "rgba(255,255,255,0.30)",
  fontHead:     "'Poppins', ui-sans-serif, system-ui, sans-serif",
  fontBody:     "'Poppins', ui-sans-serif, system-ui, sans-serif",
  // ── Radius scale: buttons 12px · cards 16px · panels 20px ──
  radius:       "1rem",        // 16px — cards
  radiusSm:     "0.75rem",     // 12px — buttons / chips
  radiusLg:     "1.25rem",     // 20px — panels / modals
  radiusPill:   "999px",
  // ── Shadow scale ──
  shadowXs:     "0 2px 8px rgba(0,0,0,0.22)",
  shadowCard:   "0 4px 16px rgba(0,0,0,0.30)",
  shadowHover:  "0 12px 32px rgba(0,0,0,0.50)",
  shadowHoverLg:"0 20px 48px rgba(0,0,0,0.55)",
  shadowModal:  "0 24px 64px rgba(0,0,0,0.65)",
  ringBrand:    "0 0 0 1px rgba(128,74,240,0.4)",
  transitionBase: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
  transitionFast: "all 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
};

// Rarity accent colors shared by avatar/banner cosmetic rendering.
export const RARITY_COLOR = {
  common:    { color: T.textSub,    bg: "rgba(255,255,255,0.08)", border: T.border },
  rare:      { color: T.blue2Light, bg: T.blue2Bg,                border: T.blue2Border },
  epic:      { color: T.brandLight, bg: "rgba(128,74,240,0.16)",  border: T.borderBrand },
  legendary: { color: "#f5a623",    bg: "rgba(245,166,35,0.16)",  border: "rgba(245,166,35,0.35)" },
};
