// launcher-ui/src/routes/launcher-games.jsx
// ── Rload Launcher — Premium UI (Vercel website style) ──

import React, { useCallback, useEffect, useRef, useState } from "react";
import { GameSinglePage } from "./GameSinglePage.jsx";

import {
  rloadAvailable, listLocalGames, getInstalledStatus, installGame, updateGame,
  pauseDownload, resumeDownload, cancelDownload, uninstallGame, launchGame,
  subscribeDownloads, subscribeRunning, isUpdateAvailable,
  getSession, login, logout, subscribeSession, subscribeAuthError,
  getSubscriptionStatus, subscribeSubscriptionRefresh,
} from "../lib/rload";

// ─────────────────────────────────────────────────────────────────────────────
// Local cover images — fallback when CDN has no thumbnail for a game
// ─────────────────────────────────────────────────────────────────────────────
const LOCAL_COVERS = {
  "karlson":              "./images/games/covers/karlson.png",
  "jelly-drift":          "./images/games/covers/jelly-drift.png",
  "rerun":                "./images/games/covers/rerun.png",
  "ums-quest":            "./images/games/covers/ums-quest.jpg",
  "balls":                "./images/games/covers/balls.png",
  "dont-fall-in-the-pool":"./images/games/covers/dont-fall-in-the-pool.png",
  "pinoseeo":             "./images/games/covers/pinoseeo.png",
  "below-decks":          "./images/games/covers/below-decks.png",
  "gravity-warrior":      "./images/games/covers/gravity-warrior.jpg",
  "alternate-watch":      "./images/games/covers/alternate-watch.png",
};

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens — matches rload-website-vercel exactly
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  // ── Official Rload palette (charte graphique) — base #302861 · surface #442c75 · accent #804af0 ──
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
  // ── Motion — shared easing for hover/press transitions ──
  transitionBase: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
  transitionFast: "all 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
};

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
// Angular tile shape (AAA game-UI cut corner — Riot/PlayStation/Xbox client style) instead of a
// soft rounded rectangle: sharp corners with one diagonal notch, used for the "wow" editorial cards.
function cutCorner(size = 22) {
  return `polygon(0 0, calc(100% - ${size}px) 0, 100% ${size}px, 100% 100%, 0 100%)`;
}
function humanBytes(n) {
  if (!Number.isFinite(n) || n < 0) return "0 B";
  const u = ["B","KB","MB","GB","TB"]; let i=0,v=n;
  while (v >= 1024 && i < u.length-1) { v/=1024; i++; }
  return `${v.toFixed(i===0?0:1)} ${u[i]}`;
}
function toErrStr(e) {
  if (!e) return "";
  if (typeof e === "string") return e;
  if (typeof e === "number") return String(e);
  if (e instanceof Error) return e.message || String(e);
  if (typeof e.message === "string") return e.message;
  try { return JSON.stringify(e); } catch { return String(e); }
}

// ─────────────────────────────────────────────────────────────────────────────
// UI state machine
// ─────────────────────────────────────────────────────────────────────────────
const UI = {
  IDLE:"idle", DOWNLOADING:"downloading", PAUSED:"paused",
  INSTALLING:"installing", INSTALLED:"installed",
  INSTALLED_NO_EXE:"installed_no_exe", UPDATE_AVAILABLE:"update_available",
  UPDATING:"updating", RUNNING:"running", ERROR:"error", CANCELED:"canceled",
};
const DOWNLOAD_SAFE_STATES = new Set([
  UI.INSTALLED, UI.INSTALLED_NO_EXE, UI.UPDATE_AVAILABLE, UI.UPDATING, UI.RUNNING,
]);
function mapBackendStateToUI(s) {
  const state = (s||"").toLowerCase();
  if (!state) return null;
  if (["downloading","download","in_progress","progress"].includes(state)) return UI.DOWNLOADING;
  if (["paused"].includes(state))                                           return UI.PAUSED;
  if (["installing","extracting","verifying"].includes(state))             return UI.INSTALLING;
  if (["completed","done","finished"].includes(state))                     return UI.INSTALLING;
  if (["canceled","cancelled"].includes(state))                            return UI.CANCELED;
  if (["error","failed"].includes(state))                                  return UI.ERROR;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Badge config
// ─────────────────────────────────────────────────────────────────────────────
function getStateBadge(uiState) {
  switch(uiState) {
    case UI.INSTALLED:        return { label:"Installed",  color:T.green,  bg:T.greenBg,   border:T.greenBorder  };
    case UI.UPDATE_AVAILABLE: return { label:"Update",     color:T.blue2Light, bg:T.blue2Bg, border:T.blue2Border };
    case UI.RUNNING:          return { label:"Playing",    color:T.purple, bg:T.purpleBg,  border:T.purpleBorder };
    case UI.DOWNLOADING:      return { label:"Loading…",  color:T.blue,   bg:T.blueBg,    border:T.blueBorder   };
    case UI.PAUSED:           return { label:"Paused",     color:T.orange, bg:T.orangeBg,  border:T.orangeBorder };
    case UI.INSTALLING:       return { label:"Installing", color:T.blue,   bg:T.blueBg,    border:T.blueBorder   };
    case UI.UPDATING:         return { label:"Updating",   color:T.blue,   bg:T.blueBg,    border:T.blueBorder   };
    case UI.INSTALLED_NO_EXE: return { label:"Installed",  color:T.orange, bg:T.orangeBg,  border:T.orangeBorder };
    case UI.ERROR:            return { label:"Error",      color:T.red,    bg:T.redBg,     border:T.redBorder    };
    default: return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cover placeholder gradient
// ─────────────────────────────────────────────────────────────────────────────
const GRAD_PAIRS = [
  ["#1a1a2e","#4a1942"],["#0f3460","#16213e"],["#2d1b69","#0d4f56"],
  ["#1a0533","#4c1d95"],["#0c1445","#1e3a5f"],["#2c0a4e","#0a3d2b"],
  ["#3d0429","#1a0f3c"],["#0a2942","#1a4a35"],
];
function coverGradient(gameId) {
  const idx = (gameId||"").split("").reduce((a,c)=>a+c.charCodeAt(0),0) % GRAD_PAIRS.length;
  const [a,b] = GRAD_PAIRS[idx];
  return `linear-gradient(145deg, ${a} 0%, ${b} 100%)`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Real events data (from Vercel website Events.tsx)
// ─────────────────────────────────────────────────────────────────────────────
const UPCOMING_EVENTS = [
  { id:"reboot-2026",    day:"22", month:"APR", category:"Creator Events",  status:"Upcoming", title:"Reboot Develop Blue 2026",          description:"Europe's leading indie & AA developer conference.",                                 time:"22–25 Apr · Dubrovnik, Croatia",   lieu:"Dubrovnik, Croatia",   imageUrl:"./images/events/reboot-develop-blue-2026.jpg"    },
  { id:"amaze-2026",     day:"06", month:"MAY", category:"Creator Events",  status:"Upcoming", title:"A MAZE. Berlin 2026",                description:"International festival celebrating art games and indie culture.",                  time:"6–10 May · Berlin, Germany",       lieu:"Berlin, Germany",      imageUrl:"./images/events/amaze-berlin-2026.jpeg"           },
  { id:"nordicgame-2026",day:"20", month:"MAY", category:"Creator Events",  status:"Upcoming", title:"Nordic Game 2026",                   description:"The leading games conference in the Nordics — B2B, pitching, and talks.",         time:"20–22 May · Malmö, Sweden",        lieu:"Malmö, Sweden",        imageUrl:"./images/events/nordic-game-2026.jpg"             },
  { id:"devcom-2026",    day:"17", month:"AUG", category:"Creator Events",  status:"Upcoming", title:"devcom Developer Conference 2026",   description:"Europe's largest game developer conference, co-located with Gamescom.",           time:"17–18 Aug · Cologne, Germany",     lieu:"Cologne, Germany",     imageUrl:"./images/events/devcom-2026.jpeg"                 },
  // Local asset was just the gamescom wordmark on white — swapped for a real crowd/booth photo so
  // the thumbnail actually reads as an event, not a logo. CC0, Wikimedia Commons (see M4.6 summary).
  { id:"gamescom-2026",  day:"19", month:"AUG", category:"Games Launches",  status:"Upcoming", title:"Gamescom 2026",                      description:"The world's largest gaming event — reveals, demos, and live shows.",              time:"19–23 Aug · Cologne, Germany",     lieu:"Cologne, Germany",     imageUrl:"https://upload.wikimedia.org/wikipedia/commons/7/77/Gamescom-crowd.jpg"                },
  { id:"egx-2026",       day:"24", month:"SEP", category:"Games Launches",  status:"Upcoming", title:"EGX 2026",                           description:"The UK's biggest gaming festival — playable demos, tournaments, and reveals.",     time:"24–27 Sep · London, UK",           lieu:"London, UK",           imageUrl:"./images/events/egx-2026.jpeg"                    },
  { id:"pgw-2026",       day:"29", month:"OCT", category:"Games Launches",  status:"Upcoming", title:"Paris Games Week 2026",              description:"France's premier gaming event. Indie spotlight, reveals, and esports stages.",    time:"29 Oct – 2 Nov · Paris, France",   lieu:"Paris, France",        imageUrl:"./images/events/pgw-2026.jpg"                     },
  { id:"indigo-2026",    day:"05", month:"NOV", category:"Creator Events",  status:"Upcoming", title:"IndiGO Showcase 2026",               description:"European indie games showcase — demos, pitches, and publisher meetings.",         time:"5–6 Nov · Amsterdam, Netherlands", lieu:"Amsterdam, Netherlands",imageUrl:"./images/events/events_placeholder.jpg"           },
  { id:"bxlgames-2026",  day:"20", month:"NOV", category:"Tournaments",     status:"Upcoming", title:"Brussels Games Festival 2026",       description:"Indie games, esports, and developer talks in the heart of Europe.",               time:"20–22 Nov · Brussels, Belgium",    lieu:"Brussels, Belgium",    imageUrl:"./images/events/events_placeholder.jpg"           },
  { id:"gameawards-2026",day:"10", month:"DEC", category:"Lives & streams", status:"Upcoming", title:"The Game Awards 2026 — Watch Party", description:"Community watch party for the biggest night in gaming. Live reactions & giveaways.", time:"10 Dec · Online + Local screenings",lieu:"Online",             imageUrl:"./images/events/game-awards-2026.png"             },
];
const PREVIOUS_EVENTS = [
  { day:"26", month:"MAR", category:"Creator Events",  title:"GDC 2026 Recap Stream",           time:"18:00 – 20:00" },
  { day:"14", month:"MAR", category:"Tournaments",     title:"Rload Spring Cup — Finals",       time:"17:00 – 23:00" },
  { day:"01", month:"MAR", category:"Games Launches",  title:"Steam Next Fest March 2026",      time:"All week"      },
  { day:"14", month:"FEB", category:"Lives & streams", title:"Valentine's Indie Showcase",      time:"20:00 – 22:00" },
  { day:"30", month:"JAN", category:"Creator Events",  title:"Rotterdam WASD Developer Day",    time:"10:00 – 18:00" },
  { day:"10", month:"JAN", category:"Games Launches",  title:"New Year Indie Drop — 10 Titles", time:"00:01"         },
];
const EVENT_CATEGORIES = ["All events","Creator Events","Games Launches","Tournaments","Lives & streams"];
function eventCategoryColor(cat) {
  if (cat === "Creator Events")  return { color:T.brandLight, bg:"rgba(128,74,240,0.2)",  border:"rgba(128,74,240,0.3)"  };
  if (cat === "Games Launches")  return { color:T.blue2Light, bg:T.blue2Bg,              border:T.blue2Border           };
  if (cat === "Tournaments")     return { color:T.orange,     bg:T.orangeBg,             border:T.orangeBorder          };
  if (cat === "Lives & streams") return { color:T.green,      bg:T.greenBg,              border:T.greenBorder           };
  return { color:T.textSub, bg:T.bgCard, border:T.border };
}

// ─────────────────────────────────────────────────────────────────────────────
// Static home page data (from Vercel website)
// ─────────────────────────────────────────────────────────────────────────────
const HERO_IMAGE = "https://cdn.rload.be/covers/ravenfield.jpg";

// ── This Week on Rload (M4.6) — one story, not four cards. A single featured game with editorial
// copy, plus three quiet secondary picks that never compete with it. ──
const FEATURED_THIS_WEEK = {
  title: "Blackline Protocol",
  studio: "Iron Forge Dev",
  imageUrl: "./images/streaming/blackline_protocol.png",
  imagePosition: "center 48%",
  tagline: "Tactical FPS where every move has weight.",
  paragraph: "Discipline over chaos. In Blackline Protocol, tight environments, realistic firefights, and limited intel turn every mission into a test of judgment. Think. Coordinate. Execute. There's no room for mistakes.",
  whyWePickedIt: [
    "Outstanding atmosphere and environmental storytelling",
    "Tactical gameplay where every decision matters",
    "One of this week's standout discoveries",
  ],
};
// ── Studio Spotlight — real studio, real data only. No testimonial: none has been verified, so none is shown.
// Bio verified against the studio's own listing on Walga (Wallonia Games Association) — real studio,
// real other titles, not invented. See sources in the M4.6 follow-up summary. ──
const KAKUDO_SPOTLIGHT = {
  gameId:    "kakudo",
  studio:    "Bad Weather Studios",
  game:      "KAKUDO",
  bioParagraphs: [
    "Bad Weather Studios is an independent game studio focused on strong identities and memorable experiences. The studio creates games with tight gameplay, strange atmospheres, and distinctive worlds. As the creators of «KAKUDO», «The Strange Laboratory», and «Invasion», Bad Weather Studios moves freely between action-driven and experimental projects, always prioritizing player feel and artistic coherence.",
    "The studio has also contributed as a support team on well-known fan-projects such as Rayman 2 Redreamed and TimeSplitters Rewind, showcasing solid technical expertise and the ability to collaborate on ambitious productions.",
  ],
  bgImage:   "./images/games/kakudo/screenshots/ss_3.jpg",
  collage:   ["./images/games/kakudo/banner.jpg", "./images/games/kakudo/screenshots/ss_5.jpg", "./images/games/kakudo/cover.jpg"],
  stats:     ["1 game on Rload", "Belgium", "Independent Studio"],
};

const COMING_SOON_ITEMS = [
  { id:0, title:"KAKUDO",           subtitle:"Exploration maze",       genre:"Adventure", studio:"Bad Weather Studios", imageUrl:"./images/games/kakudo/banner.jpg"                 },
  { id:1, title:"Crater Signal",    subtitle:"Sci-fi survival",       genre:"Survival",  studio:"Voxel Minds",      imageUrl:"./images/home/hero_slides/rooftop_bg.png"           },
  { id:2, title:"Hollow Circuit",   subtitle:"Rogue cyberpunk",        genre:"Roguelike", studio:"Synthcode Games",  imageUrl:"./images/home/hero_slides/cranktop_bg.png"          },
  { id:3, title:"Tundra Run",       subtitle:"Extreme racing",         genre:"Racing",    studio:"Arctic Pixel Lab", imageUrl:"./images/home/hero_slides/tundra_bg.png"            },
  { id:4, title:"Aether Echo",      subtitle:"Atmospheric platformer", genre:"Platformer",studio:"Dusk Forge",        imageUrl:"./images/home/hero_slides/rooftop_bg.png"           },
  { id:5, title:"Voidwatcher",      subtitle:"Deep space horror",      genre:"Horror",    studio:"Dark Matter Labs", imageUrl:"./images/home/new_releases/steel_trigger.png"       },
];
const PC_RANKED_ITEMS = [
  { rank:1, title:"Iron Onslaught",     genre:["Action","Tactical"],  studio:"FireLine Studios", plays:"48.2k", imageUrl:"./images/games/placeholders/iron_onslaught.png", imagePosition:"center 30%" },
  { rank:2, title:"Gladiator Battle",   genre:["Fights","Arena"],     studio:"Arena Forge",      plays:"39.7k", imageUrl:"./images/games/placeholders/gladiator_battle.png"    },
  { rank:3, title:"Circuit Bloom",      genre:["Puzzle","Chill"],     studio:"PixelNova",        plays:"31.4k", imageUrl:"./images/games/placeholders/circuit_bloom.png"       },
  { rank:4, title:"Steelbound Legacy",  genre:["RPG","Strategy"],     studio:"IronLore Games",   plays:"28.9k", imageUrl:"./images/games/placeholders/steelbound_legacy.png"   },
  { rank:5, title:"Neon Cyclone",       genre:["Racing","Arcade"],    studio:"Speedcraft Labs",  plays:"22.1k", imageUrl:"./images/games/placeholders/neon_cyclone.png"        },
  { rank:6, title:"Cybernetic Showdown",genre:["Shooter","Sci-Fi"],   studio:"SynthCore Dev",    plays:"19.5k", imageUrl:"./images/games/placeholders/cybernetic_showdown.png" },
  { rank:7, title:"Knight's Fiery Stand",genre:["RPG","Fantasy"],     studio:"Mythic Leaf",      plays:"16.8k", imageUrl:"./images/games/placeholders/knights_stand.png"       },
  { rank:8, title:"Underground Battle", genre:["Fights","Street"],    studio:"Street Level",     plays:"14.2k", imageUrl:"./images/games/placeholders/underground_battle.png"  },
];
// ─────────────────────────────────────────────────────────────────────────────
// Icons (inline SVG — no external deps)
// ─────────────────────────────────────────────────────────────────────────────
const Icon = {
  // Navigation / feature — 20px
  Home:      () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>),
  Games:     () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M12 12h.01M7 12h.01"/><path d="M17 10v4"/></svg>),
  Events:    () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>),
  Community: () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>),
  Profile:   () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>),
  Streaming: () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>),
  About:     () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>),
  Bell:      () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>),
  Logout:    () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>),
  Settings:  () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>),
  Globe:     () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>),
  Shield:    () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>),
  Monitor:   () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>),
  // Action — 16px
  Search:      () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>),
  Play:        () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>),
  Download:    () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>),
  Update:      () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>),
  Close:       () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>),
  Filter:      () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>),
  ArrowRight:  () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>),
  ChevronRight:() => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>),
  ChevronLeft: () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>),
  // Inline / decorative — 14px (used inside text-flow)
  Calendar: () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>),
  Star:     () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>),
};

// ─────────────────────────────────────────────────────────────────────────────
// Language strings (EN / FR / NL)
// ─────────────────────────────────────────────────────────────────────────────
const LANGS = {
  en: {
    // Nav
    home:"Home", games:"Games", streaming:"Streaming", events:"Events",
    community:"Community", about:"About", profile:"Account",
    // Auth
    signIn:"Sign In", signOut:"Sign Out", signingOut:"Signing out…",
    openingBrowser:"Opening browser…",
    // Hero
    welcome:"Welcome to Rload", tagline:"Your indie games, one launcher.",
    // Actions
    play:"Play Now", install:"Install Game", update:"Update",
    pause:"Pause Download", resume:"Resume", cancel:"Cancel",
    installing:"Installing…", downloading:"Downloading…",
    uninstall:"Uninstall", viewDetails:"View Details",
    // Settings / Profile
    settings:"Settings", language:"Language", notifications:"Notifications",
    accountDetails:"Account Details", privacy:"Privacy & Security",
    display:"Display Mode", backToProfile:"Back",
    pushNotifications:"Push notifications", emailNotifications:"Email notifications",
    newReleases:"New releases", notifyNewGames:"Notify me when new games are added",
    receiveAlerts:"Receive desktop alerts from Rload", getUpdatesEmail:"Get updates via email",
    chooseLanguage:"Choose your preferred language for the launcher interface.",
    dataPrivacy:"Data & Privacy", security:"Security",
    // Games
    installed:"Installed", updates:"Updates", library:"Library",
    allGames:"All Games", notInstalled:"Not Installed", favorites:"Favorites",
    totalGames:"Total Games", playtimeWeek:"Playtime This Week",
    lastPlayed:"Last Played", recentlyPlayed:"Recently Played",
    updatesAvailable:"Updates Available", recommendedForYou:"Recommended for You",
    overview:"Overview",
    // Account
    accountInfo:"Account Info", launcherVersion:"Launcher",
    editUsername:"Edit Username", editEmail:"Edit Email Address",
    newPassword:"New Password", confirmPassword:"Confirm Password",
    saveChanges:"Save", cancelChanges:"Cancel",
    // Search
    searchGames:"Search games…", searchEvents:"Search events…",
    noGames:"No games in this category", noEvents:"No events match your filters.",
    // Events
    upcomingEvents:"Upcoming Events", previousEvents:"Previous events",
    gameEventsSchedule:"Game Events Schedule",
    eventsSubtitle:"Events not to be missed on Rload and in your region",
    // Footer
    footerTagline:"Curated indie games, exclusive perks, and a platform built for indie fans.",
    platform:"Platform", developers:"Developers", support:"Support", legal:"Legal",
    developerPortal:"Developer Portal", aboutRload:"About Rload", submitGame:"Submit a Game",
    contact:"Contact", helpCenter:"Help Center", reportIssue:"Report an Issue",
    terms:"Terms & Conditions", privacyPolicy:"Privacy Policy",
    newsletter:"Get new releases, weekly quests, and exclusive drops.",
    emailPlaceholder:"Enter your email", subscribe:"Subscribe",
    copyright:"© {year} Rload. All rights reserved.",
    // Errors
    errorTitle:"Error", installFailed:"Install failed.", updateFailed:"Update failed.",
    launchFailed:"Launch failed.", uninstallFailed:"Uninstall failed.",
    closeGameFirst:"Close the game first.",
    // About
    whyDevsChoose:"Why Developers Choose Rload",
    onboardingTitle:"How to Join Rload",
    step1Title:"Create Developer Account", step1Desc:"Sign up as a developer on rload.be and set up your studio profile in minutes.",
    step2Title:"Upload Your Game Build", step2Desc:"Upload your game files directly. We support all major formats and handle delivery.",
    step3Title:"Set Price & Metadata", step3Desc:"Configure your game's title, description, pricing, genres, and release details.",
    step4Title:"Publish and Go Live", step4Desc:"Hit publish and your game is instantly accessible to the entire Rload community.",
  },
  fr: {
    home:"Accueil", games:"Jeux", streaming:"Streaming", events:"Événements",
    community:"Communauté", about:"À propos", profile:"Compte",
    signIn:"Se connecter", signOut:"Se déconnecter", signingOut:"Déconnexion…",
    openingBrowser:"Ouverture du navigateur…",
    welcome:"Bienvenue sur Rload", tagline:"Vos jeux indés, un seul launcher.",
    play:"Jouer", install:"Installer", update:"Mettre à jour",
    pause:"Mettre en pause", resume:"Reprendre", cancel:"Annuler",
    installing:"Installation…", downloading:"Téléchargement…",
    uninstall:"Désinstaller", viewDetails:"Voir les détails",
    settings:"Paramètres", language:"Langue", notifications:"Notifications",
    accountDetails:"Détails du compte", privacy:"Confidentialité & Sécurité",
    display:"Mode d'affichage", backToProfile:"Retour",
    pushNotifications:"Notifications push", emailNotifications:"Notifications email",
    newReleases:"Nouvelles sorties", notifyNewGames:"Me notifier des nouveaux jeux",
    receiveAlerts:"Recevoir des alertes bureau de Rload", getUpdatesEmail:"Recevoir les mises à jour par email",
    chooseLanguage:"Choisissez votre langue préférée pour le launcher.",
    dataPrivacy:"Données & Confidentialité", security:"Sécurité",
    installed:"Installé", updates:"Mises à jour", library:"Bibliothèque",
    allGames:"Tous les jeux", notInstalled:"Non installé", favorites:"Favoris",
    totalGames:"Jeux au total", playtimeWeek:"Temps de jeu cette semaine",
    lastPlayed:"Dernier joué", recentlyPlayed:"Récemment joués",
    updatesAvailable:"Mises à jour disponibles", recommendedForYou:"Recommandé pour vous",
    overview:"Aperçu",
    accountInfo:"Infos du compte", launcherVersion:"Launcher",
    editUsername:"Modifier le nom d'utilisateur", editEmail:"Modifier l'adresse e-mail",
    newPassword:"Nouveau mot de passe", confirmPassword:"Confirmer le mot de passe",
    saveChanges:"Enregistrer", cancelChanges:"Annuler",
    searchGames:"Rechercher des jeux…", searchEvents:"Rechercher des événements…",
    noGames:"Aucun jeu dans cette catégorie", noEvents:"Aucun événement ne correspond aux filtres.",
    upcomingEvents:"Événements à venir", previousEvents:"Événements passés",
    gameEventsSchedule:"Calendrier des événements", eventsSubtitle:"Événements à ne pas manquer sur Rload",
    footerTagline:"Jeux indés sélectionnés, avantages exclusifs et une plateforme pour les fans.",
    platform:"Plateforme", developers:"Développeurs", support:"Support", legal:"Légal",
    developerPortal:"Portail développeur", aboutRload:"À propos de Rload", submitGame:"Soumettre un jeu",
    contact:"Contact", helpCenter:"Centre d'aide", reportIssue:"Signaler un problème",
    terms:"Conditions d'utilisation", privacyPolicy:"Politique de confidentialité",
    newsletter:"Nouvelles sorties, quêtes et contenus exclusifs.",
    emailPlaceholder:"Votre adresse e-mail", subscribe:"S'abonner",
    copyright:"© {year} Rload. Tous droits réservés.",
    errorTitle:"Erreur", installFailed:"Installation échouée.", updateFailed:"Mise à jour échouée.",
    launchFailed:"Lancement échoué.", uninstallFailed:"Désinstallation échouée.",
    closeGameFirst:"Fermez le jeu d'abord.",
    whyDevsChoose:"Pourquoi les développeurs choisissent Rload",
    onboardingTitle:"Comment rejoindre Rload",
    step1Title:"Créer un compte développeur", step1Desc:"Inscrivez-vous sur rload.be et configurez votre profil de studio en quelques minutes.",
    step2Title:"Uploader votre build", step2Desc:"Uploadez vos fichiers de jeu directement. Nous supportons tous les formats majeurs.",
    step3Title:"Définir le prix & métadonnées", step3Desc:"Configurez le titre, la description, le prix, les genres et les détails de sortie.",
    step4Title:"Publier et aller en ligne", step4Desc:"Publiez et votre jeu est instantanément accessible à toute la communauté Rload.",
  },
  nl: {
    home:"Thuis", games:"Spellen", streaming:"Streaming", events:"Evenementen",
    community:"Gemeenschap", about:"Over", profile:"Account",
    signIn:"Aanmelden", signOut:"Afmelden", signingOut:"Afmelden…",
    openingBrowser:"Browser openen…",
    welcome:"Welkom bij Rload", tagline:"Jouw indie games, één launcher.",
    play:"Nu spelen", install:"Installeren", update:"Bijwerken",
    pause:"Pauzeren", resume:"Hervatten", cancel:"Annuleren",
    installing:"Installeren…", downloading:"Downloaden…",
    uninstall:"Verwijderen", viewDetails:"Details bekijken",
    settings:"Instellingen", language:"Taal", notifications:"Meldingen",
    accountDetails:"Accountgegevens", privacy:"Privacy en beveiliging",
    display:"Weergavemodus", backToProfile:"Terug",
    pushNotifications:"Pushmeldingen", emailNotifications:"E-mailmeldingen",
    newReleases:"Nieuwe releases", notifyNewGames:"Meld mij nieuwe games",
    receiveAlerts:"Bureaubladmeldingen van Rload ontvangen", getUpdatesEmail:"Updates ontvangen via e-mail",
    chooseLanguage:"Kies uw voorkeurstaal voor de launcher.",
    dataPrivacy:"Gegevens & Privacy", security:"Beveiliging",
    installed:"Geïnstalleerd", updates:"Updates", library:"Bibliotheek",
    allGames:"Alle spellen", notInstalled:"Niet geïnstalleerd", favorites:"Favorieten",
    totalGames:"Totaal spellen", playtimeWeek:"Speeltijd deze week",
    lastPlayed:"Laatst gespeeld", recentlyPlayed:"Recent gespeeld",
    updatesAvailable:"Updates beschikbaar", recommendedForYou:"Aanbevolen voor u",
    overview:"Overzicht",
    accountInfo:"Accountinfo", launcherVersion:"Launcher",
    editUsername:"Gebruikersnaam bewerken", editEmail:"E-mailadres bewerken",
    newPassword:"Nieuw wachtwoord", confirmPassword:"Wachtwoord bevestigen",
    saveChanges:"Opslaan", cancelChanges:"Annuleren",
    searchGames:"Spellen zoeken…", searchEvents:"Evenementen zoeken…",
    noGames:"Geen spellen in deze categorie", noEvents:"Geen evenementen gevonden.",
    upcomingEvents:"Aankomende evenementen", previousEvents:"Vorige evenementen",
    gameEventsSchedule:"Evenementenrooster", eventsSubtitle:"Evenementen om niet te missen op Rload",
    footerTagline:"Gecureerde indie games, exclusieve voordelen en een platform voor indie-fans.",
    platform:"Platform", developers:"Ontwikkelaars", support:"Ondersteuning", legal:"Juridisch",
    developerPortal:"Ontwikkelaarsportaal", aboutRload:"Over Rload", submitGame:"Spel indienen",
    contact:"Contact", helpCenter:"Helpcentrum", reportIssue:"Probleem melden",
    terms:"Gebruiksvoorwaarden", privacyPolicy:"Privacybeleid",
    newsletter:"Nieuwe releases, quests en exclusieve drops.",
    emailPlaceholder:"Uw e-mailadres", subscribe:"Abonneren",
    copyright:"© {year} Rload. Alle rechten voorbehouden.",
    errorTitle:"Fout", installFailed:"Installatie mislukt.", updateFailed:"Update mislukt.",
    launchFailed:"Starten mislukt.", uninstallFailed:"Verwijderen mislukt.",
    closeGameFirst:"Sluit het spel eerst.",
    whyDevsChoose:"Waarom ontwikkelaars Rload kiezen",
    onboardingTitle:"Hoe u Rload kunt joinen",
    step1Title:"Ontwikkelaarsaccount aanmaken", step1Desc:"Meld u aan op rload.be en stel uw studioprofiel in enkele minuten in.",
    step2Title:"Uw game build uploaden", step2Desc:"Upload uw gamebestanden direct. Wij ondersteunen alle grote formaten.",
    step3Title:"Prijs & metadata instellen", step3Desc:"Configureer de titel, beschrijving, prijs, genres en releasegegevens.",
    step4Title:"Publiceren en live gaan", step4Desc:"Publiceer en uw spel is direct toegankelijk voor de hele Rload-gemeenschap.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LoginScreen — matches rload-desktop.vercel.app reference
// ─────────────────────────────────────────────────────────────────────────────
// White logo helper — SVG + CSS filter to produce white-on-transparent logo
const WHITE_LOGO_STYLE = { objectFit:"contain", filter:"brightness(0) invert(1)" };

function LoginScreen({ authBusy, authError, onSignIn }) {
  const [appInfo, setAppInfo] = useState(null);
  useEffect(() => {
    window.rload?.getAppInfo?.().then(info => { if (info) setAppInfo(info); }).catch(()=>{});
  }, []);

  const version = appInfo?.version ?? "1.0.0";

  return (
    <div style={{
      height:"100vh", width:"100vw", position:"relative",
      fontFamily:T.fontBody, overflow:"hidden",
      // Richer base: deep navy-black → very dark purple at bottom
      background:"linear-gradient(180deg, #05040f 0%, #09071a 45%, #0d0820 100%)",
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
    }}>
      <style dangerouslySetInnerHTML={{ __html:`
        @keyframes rl-login-bg {
          0%,100% { opacity:0.55; transform:scale(1); }
          50%     { opacity:0.85; transform:scale(1.04); }
        }
        @keyframes rl-spin { to { transform:rotate(360deg); } }
        /* Staggered element fade-ins */
        @keyframes rl-fadein-up {
          from { opacity:0; transform:translateY(10px); }
          to   { opacity:1; transform:translateY(0);    }
        }
        .rl-login-logo   { animation: rl-fadein-up 0.22s ease-out both; animation-delay:0ms;   }
        .rl-login-btn    { animation: rl-fadein-up 0.22s ease-out both; animation-delay:80ms;  }
        .rl-login-helper { animation: rl-fadein-up 0.22s ease-out both; animation-delay:140ms; }
        .rl-login-lower  { animation: rl-fadein-up 0.22s ease-out both; animation-delay:180ms; }
        /* Button resting glow — calmer, more cinematic */
        @keyframes rl-btn-glow {
          0%,100% { box-shadow:0 0 22px rgba(128,74,240,0.30), 0 4px 20px rgba(0,0,0,0.40); }
          50%     { box-shadow:0 0 38px rgba(128,74,240,0.52), 0 6px 24px rgba(0,0,0,0.40); }
        }
        .rl-signin-btn { animation: rl-btn-glow 4s ease-in-out infinite; }
        .rl-signin-btn:hover:not(:disabled) {
          background: linear-gradient(135deg,#9055FF 0%,#7040F0 100%) !important;
          box-shadow: 0 0 48px rgba(128,74,240,0.70), 0 8px 28px rgba(0,0,0,0.45) !important;
          transform: translateY(-1px) !important;
          animation: none !important;
        }
        .rl-signin-btn:active:not(:disabled) {
          transform: translateY(0) !important;
          animation: none !important;
        }
        .rl-footer-link { cursor:pointer; transition: color 0.18s ease-out; }
        .rl-footer-link:hover { color:rgba(255,255,255,0.50) !important; }
      ` }}/>

      {/* Thin drag zone at top */}
      <div style={{ position:"absolute", top:0, left:0, right:0, height:36, WebkitAppRegion:"drag", zIndex:10, pointerEvents:"none" }}/>

      {/* Ambient radial glow — slow breathe */}
      <div style={{
        position:"absolute", inset:0, pointerEvents:"none",
        background:"radial-gradient(ellipse 72% 60% at 50% 48%, rgba(95,42,210,0.20) 0%, rgba(52,18,130,0.09) 50%, transparent 75%)",
        animation:"rl-login-bg 6s ease-in-out infinite",
      }}/>
      {/* Secondary off-center blue accent — gives depth */}
      <div style={{ position:"absolute", bottom:"10%", left:"30%", width:"42%", height:"38%", pointerEvents:"none",
        background:"radial-gradient(ellipse at center, rgba(43,127,255,0.06) 0%, transparent 70%)" }}/>
      {/* Top vignette — stronger, longer */}
      <div style={{ position:"absolute", top:0, left:0, right:0, height:"40%", pointerEvents:"none",
        background:"linear-gradient(to bottom, rgba(3,2,12,0.92) 0%, rgba(3,2,12,0.30) 60%, transparent 100%)" }}/>
      {/* Bottom vignette */}
      <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"35%", pointerEvents:"none",
        background:"linear-gradient(to top, rgba(3,2,12,0.85) 0%, rgba(3,2,12,0.20) 55%, transparent 100%)" }}/>

      {/* ── Single centered column ── */}
      <div style={{
        position:"relative", zIndex:2,
        display:"flex", flexDirection:"column", alignItems:"center",
        width:"100%", maxWidth:400,
        padding:"0 36px",
      }}>

        {/* Logo — slightly larger, stronger anchor */}
        <img src="./images/common/Logo-couleur.svg" alt="Rload"
          className="rl-login-logo"
          style={{ height:88, display:"block", marginBottom:48, ...WHITE_LOGO_STYLE }}/>

        {/* Sign-in button */}
        <button
          className="rl-signin-btn rl-login-btn"
          disabled={authBusy}
          onClick={onSignIn}
          style={{
            width:"100%", padding:"14px 28px",
            borderRadius:T.radiusPill, fontSize:14.5, fontWeight:600,
            cursor:authBusy?"not-allowed":"pointer",
            border:"none",
            background:"linear-gradient(135deg, #8048F8 0%, #6432E8 100%)",
            color:"#fff",
            opacity:authBusy?0.55:1,
            fontFamily:T.fontBody,
            transition:"background 0.2s ease-out, transform 0.2s ease-out, box-shadow 0.2s ease-out",
            letterSpacing:"0.02em",
            display:"flex", alignItems:"center", justifyContent:"center", gap:10,
          }}>
          {authBusy ? (
            <>
              <div style={{ width:14, height:14, border:"2px solid rgba(255,255,255,0.28)", borderTop:"2px solid #fff", borderRadius:"50%", animation:"rl-spin 0.75s linear infinite" }}/>
              Opening browser…
            </>
          ) : (
            <><Icon.Profile/> Sign in to Rload</>
          )}
        </button>

        {authError && (
          <div style={{ marginTop:12, width:"100%", fontSize:12.5, color:T.red, lineHeight:1.6, padding:"9px 14px", background:T.redBg, borderRadius:T.radiusSm, border:`1px solid ${T.redBorder}`, textAlign:"center" }}>
            {authError}
          </div>
        )}

        {/* Helper text */}
        <div className="rl-login-helper" style={{ marginTop:16, textAlign:"center", fontSize:12, color:"rgba(255,255,255,0.30)", lineHeight:1.75, letterSpacing:"0.01em" }}>
          A browser window will open to complete your sign-in securely.
        </div>

        {/* Separator */}
        <div style={{ width:36, height:1, background:"rgba(255,255,255,0.08)", margin:"40px 0 36px" }}/>

        {/* Headline + bullets — lower section */}
        <div className="rl-login-lower" style={{ display:"flex", flexDirection:"column", alignItems:"center", width:"100%" }}>
          {/* Headline */}
          <div style={{
            textAlign:"center", fontSize:17, fontWeight:600, color:"rgba(255,255,255,0.82)",
            fontFamily:T.fontHead, letterSpacing:"-0.3px", lineHeight:1.4, marginBottom:24,
          }}>
            Discover indie games, all in one place
          </div>

          {/* Bullets */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", gap:12, width:"100%", maxWidth:272 }}>
            {[
              { icon:"🎮", text:"Fresh games every month" },
              { icon:"🌐", text:"A passionate community" },
              { icon:"📅", text:"Local and international events" },
            ].map(({ icon, text }) => (
              <div key={text} style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:26, height:26, borderRadius:"0.45rem", flexShrink:0,
                  background:"rgba(128,74,240,0.12)", border:"1px solid rgba(128,74,240,0.20)",
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:12 }}>{icon}</div>
                <span style={{ fontSize:12.5, color:"rgba(255,255,255,0.42)", lineHeight:1.5 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mini footer */}
      <div style={{
        position:"absolute", bottom:0, left:0, right:0,
        padding:"14px 24px",
        borderTop:"1px solid rgba(255,255,255,0.04)",
        display:"flex", justifyContent:"center", alignItems:"center", gap:16,
        zIndex:3,
      }}>
        <span style={{ fontSize:10.5, color:"rgba(255,255,255,0.18)", fontFamily:T.fontBody, letterSpacing:"0.02em" }}>
          v{version}
        </span>
        {[
          { label:"Privacy", url:"https://rload.be/privacy" },
          { label:"Terms",   url:"https://rload.be/terms"   },
          { label:"Status",  url:"https://status.rload.be"  },
        ].map(({ label, url }) => (
          <React.Fragment key={label}>
            <span style={{ fontSize:10.5, color:"rgba(255,255,255,0.10)" }}>·</span>
            <span
              className="rl-footer-link"
              onClick={()=>openExternal(url)}
              style={{ fontSize:10.5, color:"rgba(255,255,255,0.22)", fontFamily:T.fontBody }}>
              {label}
            </span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LaunchOverlay — premium "Launching Game" effect
// ─────────────────────────────────────────────────────────────────────────────
function LaunchOverlay({ game }) {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column" }}>
      <style dangerouslySetInnerHTML={{ __html:`
        @keyframes rl-game-title { 0%{opacity:0;transform:translateY(12px)} 100%{opacity:1;transform:translateY(0)} }
        @keyframes rl-dot { 0%,80%,100%{opacity:0.25;transform:scale(0.8)} 40%{opacity:1;transform:scale(1)} }
        @keyframes rl-overlay-in { from{opacity:0} to{opacity:1} }
        @keyframes rl-glow-pulse { 0%,100%{opacity:0.5;transform:scale(1)} 50%{opacity:0.85;transform:scale(1.1)} }
      ` }}/>

      {/* Background */}
      <div style={{ position:"absolute", inset:0, background:"rgba(14,12,31,0.97)" }}/>

      {/* Blurred game cover — ambient background */}
      {(game.thumbnail||game.coverUrl) && (
        <div style={{ position:"absolute", inset:0, overflow:"hidden", zIndex:0, animation:"rl-overlay-in 0.4s ease forwards" }}>
          <img src={game.thumbnail||game.coverUrl} alt=""
            style={{ width:"100%", height:"100%", objectFit:"cover", opacity:0.08, filter:"blur(48px) saturate(2.5)" }}/>
        </div>
      )}

      {/* Bottom radial glow */}
      <div style={{ position:"absolute", bottom:"-10%", left:"50%", transform:"translateX(-50%)",
        width:"60%", height:"45%", zIndex:0,
        background:"radial-gradient(ellipse at center,rgba(128,74,240,0.4) 0%,rgba(68,44,117,0.15) 40%,transparent 70%)",
        animation:"rl-glow-pulse 3s ease-in-out infinite",
      }}/>

      {/* Launch info */}
      <div style={{ position:"relative", zIndex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:20,
        animation:"rl-game-title 0.35s ease forwards" }}>
        <img src="./images/common/Logo-couleur.svg" alt="Rload"
          style={{ height:22, objectFit:"contain", opacity:0.4, marginBottom:8, filter:"brightness(0) invert(1)" }}/>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:11, color:T.textDim, letterSpacing:"0.14em", textTransform:"uppercase", fontFamily:T.fontBody, marginBottom:10, fontWeight:500 }}>Launching</div>
          <div style={{ fontSize:30, fontWeight:800, color:T.text, fontFamily:T.fontHead, letterSpacing:"-0.5px", lineHeight:1.1 }}>{game.title||game.gameId}</div>
        </div>
        <div style={{ display:"flex", gap:7 }}>
          {[0,1,2].map(i=>(
            <div key={i} style={{ width:7, height:7, borderRadius:"50%", background:T.brand, animation:`rl-dot 1.2s ease-in-out ${i*0.18}s infinite` }}/>
          ))}
        </div>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// TopNavBar — replaces sidebar, matches Vercel website nav
// ─────────────────────────────────────────────────────────────────────────────
// Streaming & Community are built (ComingSoonPage) but hidden from nav/footer for now — may return later.
const NAV_ITEMS = [
  { id:"home",      label:"Home"      },
  { id:"games",     label:"Games"     },
  { id:"events",    label:"Events"    },
  { id:"about",     label:"About"     },
];

function TopNavBar({ tab, onTab, user, updatesCount, catalogSource, desktop }) {
  const [hov, setHov] = useState(null);
  const initial = (user?.email||user?.name||"U")[0].toUpperCase();
  return (
    <div style={{ height:62, flexShrink:0, background:T.bgMid, borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", padding:"0 152px 0 24px", fontFamily:T.fontBody, position:"relative", zIndex:100, WebkitAppRegion:"drag" }}>
      {/* Logo — white transparent SVG */}
      <div onClick={()=>onTab("home")} onMouseEnter={()=>setHov("logo")} onMouseLeave={()=>setHov(null)}
        style={{ cursor:"pointer", flexShrink:0, marginRight:28, userSelect:"none", display:"flex", alignItems:"center",
          opacity: hov==="logo" ? 0.75 : 1, transition:"opacity 0.14s", WebkitAppRegion:"no-drag" }}>
        <img src="./images/common/Logo-couleur.svg" alt="Rload"
          style={{ height:24, objectFit:"contain", filter:"brightness(0) invert(1)" }}/>
      </div>
      {/* Nav links */}
      <div style={{ display:"flex", gap:4, flex:1, alignItems:"center", WebkitAppRegion:"no-drag" }}>
        {NAV_ITEMS.map(({ id, label }) => {
          const active = tab === id;
          const isHov  = hov === id;
          return (
            <div key={id} onClick={()=>onTab(id)} onMouseEnter={()=>setHov(id)} onMouseLeave={()=>setHov(null)}
              style={{ position:"relative", padding:"7px 16px", borderRadius:T.radiusSm, cursor:"pointer", userSelect:"none",
                color:active ? T.text : isHov ? T.text : "rgba(255,255,255,0.50)",
                background:active ? "rgba(128,74,240,0.18)" : isHov ? "rgba(255,255,255,0.07)" : "transparent",
                fontSize:14.5, fontWeight:active?600:450,
                transition:"color 0.18s ease, background 0.18s ease, opacity 0.18s ease",
              }}>
              {label}
              {active && <div style={{ position:"absolute", bottom:-1, left:"50%", transform:"translateX(-50%)", width:32, height:2.5, background:T.brand, borderRadius:"2px 2px 0 0", opacity:1 }}/>}
              {id==="games" && updatesCount>0 && (
                <span style={{ position:"absolute", top:3, right:5, width:6, height:6, borderRadius:"50%", background:T.blue2Light, border:`1.5px solid ${T.bgMid}`, display:"block" }}/>
              )}
            </div>
          );
        })}
      </div>
      {/* Right side */}
      <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0, WebkitAppRegion:"no-drag" }}>
        {!desktop && <div style={{ padding:"3px 9px", borderRadius:T.radiusPill, fontSize:9.5, background:"rgba(251,146,60,0.1)", border:`1px solid ${T.orangeBorder}`, color:T.orange }}>Desktop only</div>}
        {/* Bell */}
        <div onMouseEnter={()=>setHov("bell")} onMouseLeave={()=>setHov(null)}
          style={{ width:38, height:38, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer",
            color:hov==="bell"?T.text:"rgba(255,255,255,0.6)", background:hov==="bell"?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.04)",
            border:`1px solid ${hov==="bell" ? T.border : "rgba(255,255,255,0.07)"}`,
            transition:"background 0.18s ease-out, color 0.18s ease-out, border-color 0.18s ease-out, box-shadow 0.18s ease-out" }}>
          <Icon.Bell/>
        </div>
        {/* Profile avatar button */}
        <div onClick={()=>onTab("profile")} onMouseEnter={()=>setHov("profile")} onMouseLeave={()=>setHov(null)}
          style={{ width:38, height:38, borderRadius:"50%",
            background:tab==="profile" ? T.brandGrad : "rgba(128,74,240,0.25)",
            border:`2px solid ${tab==="profile" ? T.brand : "rgba(128,74,240,0.45)"}`,
            display:"flex", alignItems:"center", justifyContent:"center",
            cursor:"pointer", fontSize:14, fontWeight:700, color:"#fff",
            transition:"background 0.18s ease-out, color 0.18s ease-out, border-color 0.18s ease-out, box-shadow 0.18s ease-out", boxShadow:tab==="profile" ? T.brandGlow : "none",
            userSelect:"none",
          }}>
          {initial}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SectionHeader
// ─────────────────────────────────────────────────────────────────────────────
function SectionHeader({ title, count, onMore, subtitle }) {
  return (
    <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", marginBottom:14 }}>
      <div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ fontSize:17, fontWeight:700, color:T.text, fontFamily:T.fontHead, letterSpacing:"-0.2px" }}>{title}</div>
          {count !== undefined && <span style={{ fontSize:11, padding:"1px 7px", borderRadius:T.radiusPill, background:"rgba(255,255,255,0.06)", color:T.textMuted }}>{count}</span>}
        </div>
        {subtitle && <div style={{ fontSize:12, color:T.textDim, marginTop:2 }}>{subtitle}</div>}
      </div>
      {onMore && (
        <button onClick={onMore} style={{ fontSize:12, color:T.brand, background:"none", border:"none", cursor:"pointer", padding:"2px 0", display:"flex", alignItems:"center", gap:4, fontFamily:T.fontBody }}>
          See all <Icon.ArrowRight/>
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GameGridCard — portrait card for 4-col grid
// ─────────────────────────────────────────────────────────────────────────────
function GameGridCard({ game, uiState, dl, isSelected, onSelect }) {
  const [hov, setHov] = useState(false);
  const badge = getStateBadge(uiState);
  const pct   = clamp(dl?.percent??0, 0, 100);
  const isXfer = [UI.DOWNLOADING,UI.INSTALLING,UI.PAUSED,UI.UPDATING].includes(uiState);
  return (
    <div role="button" tabIndex={0}
      onClick={()=>onSelect(game)}
      onKeyDown={e=>(e.key==="Enter"||e.key===" ")&&onSelect(game)}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ borderRadius:T.radius, overflow:"hidden",
        background:isSelected ? "rgba(128,74,240,0.10)" : T.bgCard,
        border:isSelected ? `1px solid ${T.brand}` : `1px solid ${T.border}`,
        cursor:"pointer", userSelect:"none",
        boxShadow:isSelected ? `0 0 0 1px ${T.brand}, 0 16px 48px rgba(0,0,0,0.55)` : hov ? "0 12px 40px rgba(0,0,0,0.5)" : "none",
        transform:hov&&!isSelected ? "translateY(-3px)" : "translateY(0)",
        transition:"transform 0.2s ease-out, box-shadow 0.2s ease-out, border-color 0.2s ease-out, background 0.2s ease-out",
      }}>
      {/* Cover */}
      <div style={{ position:"relative", width:"100%", paddingTop:"133%", overflow:"hidden", background:"#0a0914" }}>
        <img src={game.thumbnail||game.coverUrl||"./images/games/default_game_cover.png"} alt={game.title}
          style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", display:"block", transform:hov?"scale(1.07)":"scale(1)", transition:"transform 0.22s ease-out" }}
          onError={e=>{ e.currentTarget.src="./images/games/default_game_cover.png"; e.currentTarget.onerror=null; }}/>
        {badge && (
          <div style={{ position:"absolute", top:8, right:8, padding:"3px 8px", borderRadius:T.radiusPill, fontSize:9, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", color:badge.color, background:badge.bg, border:`1px solid ${badge.border}`, backdropFilter:"blur(8px)" }}>
            {badge.label}
          </div>
        )}
        {isXfer && (
          <div style={{ position:"absolute", bottom:0, left:0, right:0, height:3, background:"rgba(255,255,255,0.07)" }}>
            <div style={{ height:"100%", width:`${pct}%`, background:T.brandGrad, transition:"width 0.3s ease" }}/>
          </div>
        )}
        {hov && <div style={{ position:"absolute", inset:0, background:"linear-gradient(to top, rgba(14,12,31,0.65) 0%, transparent 50%)", pointerEvents:"none" }}/>}
      </div>
      <div style={{ padding:"9px 11px 11px" }}>
        <div style={{ fontSize:12.5, fontWeight:650, color:T.text, lineHeight:1.3, marginBottom:1, fontFamily:T.fontHead, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{game.title||game.gameId}</div>
        {game.studio && <div style={{ fontSize:10.5, color:T.textDim }}>{game.studio}</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GameDetailPanel — right panel
// ─────────────────────────────────────────────────────────────────────────────
function GameDetailPanel({ game, dl, uiState, resolvedExe, installedVersion, error, busy, hasAccess, onInstall, onUpdate, onPause, onResume, onCancel, onPlay, onUninstall, onClose, onRefreshAccess }) {
  const pct      = clamp(dl?.percent??0, 0, 100);
  const [refreshing, setRefreshing] = useState(false);
  async function doRefresh() {
    if (refreshing || !onRefreshAccess) return;
    setRefreshing(true);
    try { await onRefreshAccess(); } finally { setRefreshing(false); }
  }
  const hasUrl   = !!(game.downloadUrl||game.url);
  const bytesDown  = Number.isFinite(dl?.bytesDownloaded) ? dl.bytesDownloaded : 0;
  const bytesTotal = Number.isFinite(dl?.totalBytes)      ? dl.totalBytes      : 0;
  const showInstall = [UI.IDLE,UI.CANCELED,UI.ERROR].includes(uiState);
  const showPause   = uiState===UI.DOWNLOADING;
  const showResume  = uiState===UI.PAUSED;
  const showCancel  = [UI.DOWNLOADING,UI.PAUSED,UI.INSTALLING,UI.UPDATING].includes(uiState);
  const showUpdate  = uiState===UI.UPDATE_AVAILABLE;
  const showPlay    = uiState===UI.INSTALLED && !!resolvedExe;
  const showNoExe   = uiState===UI.INSTALLED_NO_EXE || (uiState===UI.INSTALLED && !resolvedExe);
  const showRunning = uiState===UI.RUNNING;
  const isXfer      = [UI.DOWNLOADING,UI.INSTALLING,UI.UPDATING].includes(uiState);
  const badge = getStateBadge(uiState);

  return (
    <div style={{ width:340, flexShrink:0, background:T.bgDeep, borderLeft:`1px solid ${T.border}`, display:"flex", flexDirection:"column", overflowY:"auto", fontFamily:T.fontBody, scrollBehavior:"smooth" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"13px 16px 11px", borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
        <div style={{ fontSize:12, fontWeight:600, color:T.textMuted }}>{game.studio||"Unknown Studio"}</div>
        <button onClick={onClose} style={{ background:"rgba(255,255,255,0.06)", border:`1px solid ${T.border}`, color:T.textMuted, borderRadius:T.radiusSm, padding:"4px 8px", cursor:"pointer", display:"flex", alignItems:"center" }}>
          <Icon.Close/>
        </button>
      </div>
      {/* Cover banner */}
      <div style={{ position:"relative", width:"100%", paddingTop:"56.25%", overflow:"hidden", background:"#0a0914", flexShrink:0 }}>
        <img src={game.thumbnail||game.coverUrl||"./images/games/default_game_cover.png"} alt={game.title} style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }}
          onError={e=>{ e.currentTarget.src="./images/games/default_game_cover.png"; e.currentTarget.onerror=null; }}/>
        <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"55%", background:"linear-gradient(to top, rgba(14,12,31,0.95) 0%, transparent 100%)", pointerEvents:"none" }}/>
        {badge && (
          <div style={{ position:"absolute", top:10, right:10, padding:"3px 10px", borderRadius:T.radiusPill, fontSize:9.5, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", color:badge.color, background:badge.bg, border:`1px solid ${badge.border}`, backdropFilter:"blur(8px)" }}>{badge.label}</div>
        )}
      </div>
      {/* Body */}
      <div style={{ padding:"16px 18px 28px", flex:1 }}>
        <div style={{ fontSize:19, fontWeight:700, color:T.text, fontFamily:T.fontHead, letterSpacing:"-0.3px", lineHeight:1.2, marginBottom:6 }}>{game.title||game.gameId}</div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:12 }}>
          <span style={{ fontSize:10.5, padding:"2px 9px", borderRadius:T.radiusPill, background:"rgba(255,255,255,0.05)", border:`1px solid ${T.border}`, color:T.textMuted }}>
            {uiState===UI.UPDATE_AVAILABLE&&installedVersion ? `v${installedVersion} → v${game.version}` : `v${game.version}`}
          </span>
          {game.downloadSize && (
            <span style={{ fontSize:10.5, padding:"2px 9px", borderRadius:T.radiusPill, background:"rgba(255,255,255,0.04)", border:`1px solid ${T.border}`, color:T.textMuted }}>{humanBytes(game.downloadSize)}</span>
          )}
        </div>
        {game.tags?.length>0 && (
          <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:12 }}>
            {game.tags.map(tag=>(
              <span key={tag} style={{ fontSize:9.5, padding:"2px 8px", borderRadius:T.radiusPill, background:"rgba(128,74,240,0.12)", border:"1px solid rgba(128,74,240,0.22)", color:T.brandLight, fontWeight:500 }}>{tag}</span>
            ))}
          </div>
        )}
        {game.description && (
          <div style={{ fontSize:12.5, color:T.textSub, lineHeight:1.65, marginBottom:16 }}>{game.description}</div>
        )}
        {/* Progress */}
        {isXfer && (
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11.5, color:T.textMuted, marginBottom:6 }}>
              {(uiState===UI.INSTALLING||uiState===UI.UPDATING)&&pct>=100
                ? (uiState===UI.UPDATING ? "Extracting update…" : "Extracting…")
                : uiState===UI.UPDATING
                ? `Updating… ${pct}% — ${humanBytes(bytesDown)} / ${humanBytes(bytesTotal)}`
                : `Downloading… ${pct}% — ${humanBytes(bytesDown)} / ${humanBytes(bytesTotal)}`}
            </div>
            <div style={{ height:5, borderRadius:999, background:"rgba(255,255,255,0.07)", overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${pct}%`, background:T.brandGrad, borderRadius:999, transition:"width 0.25s ease" }}/>
            </div>
          </div>
        )}
        {uiState===UI.PAUSED && <div style={{ fontSize:12, color:T.orange, marginBottom:14 }}>Paused — {pct}% downloaded</div>}
        {!!error && <div style={{ fontSize:12, color:T.red, marginBottom:12, lineHeight:1.5, padding:"8px 12px", background:T.redBg, borderRadius:T.radiusSm, border:`1px solid ${T.redBorder}` }}>{uiState===UI.ERROR?"Error: ":""}{toErrStr(error)||"unknown"}</div>}
        {showNoExe && <div style={{ fontSize:12, color:T.orange, marginBottom:12, lineHeight:1.5, padding:"8px 12px", background:T.orangeBg, borderRadius:T.radiusSm, border:`1px solid ${T.orangeBorder}` }}>Installed — no executable found. Uninstall and reinstall to retry.</div>}
        {showRunning && <div style={{ fontSize:12.5, color:T.green, fontWeight:600, marginBottom:12, display:"flex", alignItems:"center", gap:6 }}><span style={{ width:8, height:8, borderRadius:"50%", background:T.green, display:"inline-block" }}/> Running</div>}
        {showUpdate && <div style={{ fontSize:12, color:T.blue2Light, fontWeight:500, marginBottom:12, padding:"8px 12px", background:T.blue2Bg, borderRadius:T.radiusSm, border:`1px solid ${T.blue2Border}` }}>Update available — v{installedVersion} → v{game.version}</div>}
        {showInstall&&!hasUrl && <div style={{ fontSize:12, color:T.orange, marginBottom:12 }}>No download URL configured.</div>}
        {/* Actions */}
        <div style={{ display:"flex", flexDirection:"column", gap:7, marginTop:4 }}>
          {!hasAccess && (showPlay || showInstall || showUpdate) && (
            <button onClick={()=>openExternal("https://rload.be/pricing?source=launcher")} style={{ padding:"12px 16px", borderRadius:T.radius, fontWeight:700, fontSize:14.5, border:"none", background:T.brandGrad, color:"#fff", cursor:"pointer", boxShadow:T.brandGlow, display:"flex", alignItems:"center", justifyContent:"center", gap:8, fontFamily:T.fontBody }}>
              Subscribe to Play
            </button>
          )}
          {showPlay && hasAccess && (
            <button onClick={onPlay} disabled={busy} style={{ padding:"12px 16px", borderRadius:T.radius, fontWeight:700, fontSize:14.5, border:"none", background:T.brandGrad, color:"#fff", cursor:busy?"not-allowed":"pointer", boxShadow:T.brandGlow, display:"flex", alignItems:"center", justifyContent:"center", gap:8, fontFamily:T.fontBody }}>
              <Icon.Play/> Play Now
            </button>
          )}
          {showInstall && hasAccess && (
            <button onClick={onInstall} disabled={busy||!hasUrl} style={{ padding:"10px 16px", borderRadius:T.radius, fontWeight:600, fontSize:13.5, border:`1px solid ${T.borderBrand}`, background:"rgba(128,74,240,0.12)", color:T.text, cursor:(busy||!hasUrl)?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, fontFamily:T.fontBody }}>
              <Icon.Download/> Install Game
            </button>
          )}
          {showUpdate && hasAccess && (
            <button onClick={onUpdate} disabled={busy||!hasUrl} style={{ padding:"10px 16px", borderRadius:T.radius, fontWeight:600, fontSize:13.5, border:`1px solid ${T.blue2Border}`, background:T.blue2Bg, color:T.blue2Light, cursor:(busy||!hasUrl)?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, fontFamily:T.fontBody }}>
              <Icon.Update/> Update
            </button>
          )}
          {showPause && <button onClick={onPause} disabled={busy} style={{ padding:"8px 16px", borderRadius:T.radius, border:`1px solid ${T.border}`, background:T.bgCard, color:T.textSub, cursor:"pointer", fontSize:12.5, fontFamily:T.fontBody }}>Pause Download</button>}
          {showResume && <button onClick={onResume} disabled={busy} style={{ padding:"8px 16px", borderRadius:T.radius, border:`1px solid ${T.border}`, background:T.bgCard, color:T.textSub, cursor:"pointer", fontSize:12.5, fontFamily:T.fontBody }}>Resume</button>}
          {showCancel && <button onClick={onCancel} disabled={busy} style={{ padding:"8px 16px", borderRadius:T.radius, border:`1px solid ${T.border}`, background:T.bgCard, color:T.textMuted, cursor:"pointer", fontSize:12.5, fontFamily:T.fontBody }}>Cancel</button>}
          {showRunning && <button disabled style={{ padding:"8px 16px", borderRadius:T.radius, border:`1px solid ${T.border}`, background:"rgba(255,255,255,0.02)", color:T.textMuted, cursor:"not-allowed", fontSize:12.5, opacity:0.5, fontFamily:T.fontBody }}>Game Running…</button>}
          {[UI.INSTALLED, UI.INSTALLED_NO_EXE, UI.UPDATE_AVAILABLE, UI.ERROR].includes(uiState) && (
            <button onClick={onUninstall} disabled={busy} style={{ marginTop:2, padding:"7px 16px", borderRadius:T.radius, border:"1px solid rgba(248,113,113,0.18)", background:"rgba(248,113,113,0.05)", color:"rgba(248,113,113,0.65)", cursor:busy?"not-allowed":"pointer", fontSize:11.5, fontFamily:T.fontBody }}>
              Uninstall
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SmallCoverCard — compact portrait for Home grids
// ─────────────────────────────────────────────────────────────────────────────
function SmallCoverCard({ game, uiState, onSelect }) {
  const [hov, setHov] = useState(false);
  const badge = getStateBadge(uiState);
  return (
    <div onClick={()=>onSelect(game)} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ borderRadius:T.radiusSm, overflow:"hidden", cursor:"pointer", transform:hov?"translateY(-2px)":"none", transition:"transform 0.18s ease-out, border-color 0.18s ease-out, background 0.18s ease-out", border:`1px solid ${hov?T.borderBright:T.border}` }}>
      <div style={{ position:"relative", paddingTop:"133%", background:"#0a0914" }}>
        <img src={game.thumbnail||game.coverUrl||"./images/games/default_game_cover.png"} alt="" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }}
          onError={e=>{ e.currentTarget.src="./images/games/default_game_cover.png"; e.currentTarget.onerror=null; }}/>
        {badge && <div style={{ position:"absolute", top:5, right:5, padding:"2px 6px", borderRadius:T.radiusPill, fontSize:8.5, fontWeight:700, color:badge.color, background:badge.bg, border:`1px solid ${badge.border}` }}>{badge.label}</div>}
        <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"40%", background:"linear-gradient(to top, rgba(14,12,31,0.7) 0%, transparent 100%)" }}/>
      </div>
      <div style={{ padding:"5px 7px 7px", background:T.bgCard }}>
        <div style={{ fontSize:10.5, fontWeight:600, color:T.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontFamily:T.fontHead }}>{game.title||game.gameId}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HomeFeaturedCard — landscape 16:9 card used in HomePage featured section
// ─────────────────────────────────────────────────────────────────────────────
function HomeFeaturedCard({ game, uiState, onSelect }) {
  const [hov, setHov] = useState(false);
  const badge = getStateBadge(uiState);
  return (
    <div onClick={()=>onSelect(game)} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ position:"relative", borderRadius:T.radius, overflow:"hidden", cursor:"pointer", aspectRatio:"2/1", background:coverGradient(game.gameId),
        transform:hov?"translateY(-2px)":"none", transition:"transform 0.18s ease-out, box-shadow 0.18s ease-out, border-color 0.18s ease-out",
        boxShadow:hov?T.shadowHover:T.shadowCard,
        border:`1px solid ${hov?T.borderBright:T.border}`,
      }}>
      {(game.thumbnail||game.coverUrl) && (
        <img src={game.thumbnail||game.coverUrl} alt={game.title}
          style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", transform:hov?"scale(1.04)":"scale(1)", transition:"transform 0.2s ease-out" }}
          onError={e=>e.currentTarget.style.display="none"}/>
      )}
      {/* Gradient overlay */}
      <div style={{ position:"absolute", inset:0, background:"linear-gradient(0deg, rgba(14,12,31,0.88) 0%, rgba(14,12,31,0.1) 55%, transparent 100%)" }}/>
      <div style={{ position:"absolute", inset:0, background:"linear-gradient(270deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.55) 100%)" }}/>
      {/* Content */}
      <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"14px 18px" }}>
        <div style={{ fontSize:15, fontWeight:700, color:T.text, fontFamily:T.fontHead, letterSpacing:"-0.2px", lineHeight:1.2 }}>{game.title||game.gameId}</div>
        {game.studio && <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)", marginTop:2 }}>{game.studio}</div>}
      </div>
      {badge && <div style={{ position:"absolute", top:10, right:10, padding:"3px 9px", borderRadius:T.radiusPill, fontSize:9.5, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", color:badge.color, background:badge.bg, border:`1px solid ${badge.border}`, backdropFilter:"blur(8px)" }}>{badge.label}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EventCard — matches Vercel website EventCard design with thumbnail
// ─────────────────────────────────────────────────────────────────────────────
function EventCard({ ev, showThumbnail = false, thumbSize = 100 }) {
  const cc = eventCategoryColor(ev.category);
  const [imgErr, setImgErr] = useState(false);
  return (
    <div style={{ borderRadius:T.radius, padding:16, display:"flex", alignItems:thumbSize>120?"center":"flex-start", gap:16, border:"1px solid rgba(255,255,255,0.1)", background:"rgba(255,255,255,0.05)" }}>
      {/* Thumbnail — shown in EventsPage list view. Home opts into a bigger thumbSize; the
          Events tab keeps the original compact size — they share this component, so sizing is a
          prop, not a shared default, to avoid one page's request silently resizing the other. */}
      {showThumbnail && ev.imageUrl && !imgErr && (
        <div style={{ width:thumbSize, height:thumbSize===100?90:thumbSize, borderRadius:"0.75rem", overflow:"hidden", flexShrink:0, background:coverGradient(ev.id) }}>
          <img src={ev.imageUrl} alt={ev.title}
            style={{ width:"100%", height:"100%", objectFit:"cover" }}
            onError={()=>setImgErr(true)}/>
        </div>
      )}
      {/* Date block */}
      <div style={{ minWidth:72, textAlign:"center", flexShrink:0 }}>
        <div style={{ background:"linear-gradient(135deg, rgba(128,74,240,0.2) 0%, rgba(38,35,80,0.2) 100%)", borderRadius:"1rem", border:"1px solid rgba(128,74,240,0.3)", padding:"16px 8px" }}>
          <div style={{ fontSize:22, fontWeight:700, color:T.text, fontFamily:T.fontHead, lineHeight:1 }}>{ev.day}</div>
          <div style={{ fontSize:11, fontWeight:600, color:T.brand, marginTop:3, letterSpacing:"0.04em" }}>{ev.month}</div>
        </div>
      </div>
      {/* Content */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", gap:6, marginBottom:8, flexWrap:"wrap" }}>
          <span style={{ fontSize:10, fontWeight:600, padding:"2px 10px", borderRadius:T.radiusPill, color:cc.color, background:"#804af033", border:"1px solid rgba(128,74,240,0.3)" }}>{ev.category}</span>
          {ev.status && (
            <span style={{ fontSize:10, fontWeight:600, padding:"2px 10px", borderRadius:T.radiusPill, color:T.blue2Light, background:"#2B7FFF33", border:"1px solid rgba(43,127,255,0.3)" }}>{ev.status}</span>
          )}
        </div>
        <div style={{ fontSize:15, fontWeight:600, color:T.text, fontFamily:T.fontHead, lineHeight:1.3, marginBottom:4 }}>{ev.title}</div>
        {ev.description && <div style={{ fontSize:12, color:"#878787", lineHeight:1.5, marginBottom:4 }}>{ev.description}</div>}
        {ev.time && (
          <div style={{ display:"flex", alignItems:"center", gap:6, color:"#878787", fontSize:12, marginTop:4 }}>
            <Icon.Calendar/> {ev.time}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MiniGameCard — horizontal for Home lists
// ─────────────────────────────────────────────────────────────────────────────
function MiniGameCard({ game, uiState, onSelect }) {
  const [hov, setHov] = useState(false);
  const badge = getStateBadge(uiState);
  return (
    <div onClick={()=>onSelect(game)} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ display:"flex", gap:11, alignItems:"center", padding:"9px 13px", borderRadius:T.radiusSm, cursor:"pointer",
        background:hov?"rgba(255,255,255,0.05)":"transparent",
        border:`1px solid ${hov?T.borderBright:T.border}`, transition:"background 0.18s ease-out, color 0.18s ease-out, border-color 0.18s ease-out, box-shadow 0.18s ease-out" }}>
      <div style={{ width:42, height:42, borderRadius:"0.5rem", overflow:"hidden", flexShrink:0, background:coverGradient(game.gameId) }}>
        {(game.thumbnail||game.coverUrl) && <img src={game.thumbnail||game.coverUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} onError={e=>e.currentTarget.style.display="none"}/>}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12.5, fontWeight:600, color:T.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontFamily:T.fontHead }}>{game.title||game.gameId}</div>
        <div style={{ fontSize:10.5, color:T.textDim }}>{game.studio||"Unknown"}</div>
      </div>
      {badge && <div style={{ padding:"2px 8px", borderRadius:T.radiusPill, fontSize:9.5, fontWeight:700, color:badge.color, background:badge.bg, border:`1px solid ${badge.border}`, flexShrink:0 }}>{badge.label}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HeroPortraitCard — portrait card for Recommended / New Releases rows
// ─────────────────────────────────────────────────────────────────────────────
function HeroPortraitCard({ title, imageUrl }) {
  const [hov, setHov] = useState(false);
  const [err, setErr]  = useState(false);
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ position:"relative", minWidth:180, width:180, borderRadius:"1.1rem", overflow:"hidden", cursor:"pointer", flexShrink:0,
        border:`1px solid ${hov ? T.borderBrand : T.border}`,
        transform:hov?"translateY(-3px)":"translateY(0)", transition:"transform 0.18s ease-out, box-shadow 0.18s ease-out, border-color 0.18s ease-out",
        boxShadow:hov?T.shadowHover:T.shadowCard,
      }}>
      {/* Cover — 3:4 portrait */}
      <div style={{ position:"relative", paddingTop:"133%", background:coverGradient(title), overflow:"hidden" }}>
        {!err && (
          <img src={imageUrl} alt={title}
            style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", transform:hov?"scale(1.07)":"scale(1)", transition:"transform 0.2s ease-out" }}
            onError={()=>setErr(true)}/>
        )}
        {/* Bottom gradient */}
        <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"50%", background:"linear-gradient(to top, rgba(14,12,31,0.92) 0%, transparent 100%)" }}/>
        {/* Title + Discover button */}
        <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"0 12px 14px" }}>
          <div style={{ fontSize:12.5, fontWeight:700, color:T.text, fontFamily:T.fontHead, lineHeight:1.25, marginBottom:8 }}>{title}</div>
          <div style={{ display:"inline-block", padding:"5px 14px", borderRadius:T.radiusPill, background:T.brand, color:"#fff", fontSize:11, fontWeight:600, letterSpacing:"0.02em" }}>
            Discover
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ComingSoonCard — landscape card for Coming Soon row
// ─────────────────────────────────────────────────────────────────────────────
function ComingSoonCard({ title, imageUrl }) {
  const [hov, setHov] = useState(false);
  const [err, setErr]  = useState(false);
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ position:"relative", minWidth:260, clipPath:cutCorner(18), cursor:"pointer", flexShrink:0,
        border:`1px solid ${hov ? T.border : "rgba(255,255,255,0.07)"}`,
        transform:hov?"translateY(-3px)":"none", transition:"transform 0.18s ease-out, box-shadow 0.18s ease-out, border-color 0.18s ease-out",
        boxShadow:hov?"0 16px 40px rgba(0,0,0,0.5)":"none",
      }}>
      <div style={{ position:"relative", paddingTop:"56.25%", background:coverGradient(title), overflow:"hidden" }}>
        {!err && (
          <img src={imageUrl} alt={title}
            style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", filter:"brightness(0.55)", transform:hov?"scale(1.05)":"scale(1)", transition:"transform 0.2s ease-out" }}
            onError={()=>setErr(true)}/>
        )}
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(to top, rgba(14,12,31,0.9) 0%, rgba(14,12,31,0.2) 60%, transparent 100%)" }}/>
        <div style={{ position:"absolute", top:10, right:10, padding:"3px 9px", borderRadius:T.radiusPill, background:"rgba(255,255,255,0.12)", border:`1px solid ${T.border}`, fontSize:9.5, fontWeight:600, color:T.textMuted, backdropFilter:"blur(8px)" }}>
          Coming Soon
        </div>
        <div style={{ position:"absolute", bottom:12, left:14, right:14 }}>
          <div style={{ fontSize:13, fontWeight:700, color:T.text, fontFamily:T.fontHead, lineHeight:1.2 }}>{title}</div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EnrichedPortraitCard — 3:4 portrait with star rating + tag + Discover btn
// ─────────────────────────────────────────────────────────────────────────────
function EnrichedPortraitCard({ title, imageUrl, rating, genre, studio, tag }) {
  const [hov, setHov] = useState(false);
  const [err, setErr]  = useState(false);
  void tag; // tag intentionally not displayed — kept in data for future use
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ position:"relative", minWidth:200, width:200, borderRadius:"1.1rem", overflow:"hidden", cursor:"pointer", flexShrink:0,
        border:`1px solid ${hov ? T.borderBrand : T.border}`,
        transform:hov?"translateY(-3px)":"translateY(0)", transition:"transform 0.18s ease-out, box-shadow 0.18s ease-out, border-color 0.18s ease-out",
        boxShadow:hov?T.shadowHover:T.shadowCard,
      }}>
      {/* Cover — 3:4 */}
      <div style={{ position:"relative", paddingTop:"133%", background:coverGradient(title), overflow:"hidden" }}>
        {!err && (
          <img src={imageUrl} alt={title}
            style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", transform:hov?"scale(1.07)":"scale(1)", transition:"transform 0.2s ease-out" }}
            onError={()=>setErr(true)}/>
        )}
        <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"60%", background:"linear-gradient(to top, rgba(14,12,31,0.97) 0%, transparent 100%)" }}/>
        <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"0 12px 14px" }}>
          <div style={{ fontSize:13, fontWeight:700, color:T.text, fontFamily:T.fontHead, lineHeight:1.2, marginBottom:5 }}>{title}</div>
          {rating && (
            <div style={{ display:"flex", alignItems:"center", gap:3, marginBottom:7 }}>
              <span style={{ color:"#F5C842" }}><Icon.Star/></span>
              <span style={{ fontSize:11, fontWeight:600, color:"#F5C842" }}>{rating}</span>
              {genre && <span style={{ fontSize:10, color:T.textDim, marginLeft:4 }}>{genre}</span>}
            </div>
          )}
          <div style={{ display:"inline-block", padding:"5px 14px", borderRadius:T.radiusPill, background:T.brand, color:"#fff", fontSize:11, fontWeight:600 }}>
            Discover
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ExclusivePortraitCard — purple border + gold star, for RLOAD Exclusives
// ─────────────────────────────────────────────────────────────────────────────
function ExclusivePortraitCard({ title, imageUrl, rating, genre, studio, tag }) {
  const [hov, setHov] = useState(false);
  const [err, setErr]  = useState(false);
  void tag; // tag not displayed on card
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ position:"relative", minWidth:200, width:200, borderRadius:"1.1rem", overflow:"hidden", cursor:"pointer", flexShrink:0,
        border:`1.5px solid ${hov ? T.brand : T.borderBrand}`,
        transform:hov?"translateY(-3px)":"translateY(0)", transition:"transform 0.18s ease-out, box-shadow 0.18s ease-out, border-color 0.18s ease-out",
        boxShadow:hov?`0 22px 52px rgba(128,74,240,0.35), ${T.brandGlow}`:`0 4px 16px rgba(128,74,240,0.15)`,
      }}>
      {/* Gold star decoration */}
      <div style={{ position:"absolute", top:-2, right:10, fontSize:16, zIndex:2, filter:"drop-shadow(0 2px 6px rgba(245,200,66,0.7))" }}>★</div>
      {/* Cover */}
      <div style={{ position:"relative", paddingTop:"133%", background:coverGradient(title), overflow:"hidden" }}>
        {!err && (
          <img src={imageUrl} alt={title}
            style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", transform:hov?"scale(1.07)":"scale(1)", transition:"transform 0.2s ease-out" }}
            onError={()=>setErr(true)}/>
        )}
        <div style={{ position:"absolute", inset:0, background:`linear-gradient(135deg, rgba(128,74,240,0.12) 0%, transparent 50%)` }}/>
        <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"60%", background:"linear-gradient(to top, rgba(14,12,31,0.97) 0%, transparent 100%)" }}/>
        <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"0 12px 14px" }}>
          <div style={{ fontSize:13, fontWeight:700, color:T.text, fontFamily:T.fontHead, lineHeight:1.2, marginBottom:5 }}>{title}</div>
          {rating && (
            <div style={{ display:"flex", alignItems:"center", gap:3, marginBottom:7 }}>
              <span style={{ color:"#F5C842" }}><Icon.Star/></span>
              <span style={{ fontSize:11, fontWeight:600, color:"#F5C842" }}>{rating}</span>
              {genre && <span style={{ fontSize:10, color:T.textDim, marginLeft:4 }}>{genre}</span>}
            </div>
          )}
          <div style={{ display:"inline-block", padding:"5px 14px", borderRadius:T.radiusPill, background:T.brandGrad, color:"#fff", fontSize:11, fontWeight:600, boxShadow:"0 2px 12px rgba(128,74,240,0.4)" }}>
            Discover
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WideCard — 16:9 landscape card with title+rating overlay
// ─────────────────────────────────────────────────────────────────────────────
function WideCard({ title, imageUrl, rating, studio, country }) {
  const [hov, setHov] = useState(false);
  const [err, setErr]  = useState(false);
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ position:"relative", borderRadius:T.radius, overflow:"hidden", cursor:"pointer",
        border:`1px solid ${hov ? T.borderBrand : "rgba(255,255,255,0.07)"}`,
        transform:hov?"translateY(-3px)":"none", transition:"transform 0.18s ease-out, box-shadow 0.18s ease-out, border-color 0.18s ease-out",
        boxShadow:hov?"0 16px 40px rgba(0,0,0,0.55)":"0 4px 12px rgba(0,0,0,0.3)",
      }}>
      <div style={{ position:"relative", paddingTop:"56.25%"/* 16:9 */, background:coverGradient(title), overflow:"hidden" }}>
        {!err && (
          <img src={imageUrl} alt={title}
            style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", transform:hov?"scale(1.05)":"scale(1)", transition:"transform 0.2s ease-out" }}
            onError={()=>setErr(true)}/>
        )}
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(to top, rgba(14,12,31,0.88) 0%, rgba(14,12,31,0.1) 55%, transparent 100%)" }}/>
        <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"0 12px 12px" }}>
          <div style={{ fontSize:12.5, fontWeight:700, color:T.text, fontFamily:T.fontHead, lineHeight:1.2, marginBottom:3 }}>{title}</div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            {rating && (
              <div style={{ display:"flex", alignItems:"center", gap:3 }}>
                <span style={{ color:"#F5C842" }}><Icon.Star/></span>
                <span style={{ fontSize:10, fontWeight:600, color:"#F5C842" }}>{rating}</span>
              </div>
            )}
            {country && <span style={{ fontSize:10, color:T.textDim }}>{country}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StreamerCard — portrait card with live viewer badge
// ─────────────────────────────────────────────────────────────────────────────
function StreamerCard({ title, imageUrl, viewers }) {
  const [hov, setHov] = useState(false);
  const [err, setErr]  = useState(false);
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ position:"relative", minWidth:160, width:160, borderRadius:"1.1rem", overflow:"hidden", cursor:"pointer", flexShrink:0,
        border:`1px solid ${hov ? T.borderBrand : T.border}`,
        transform:hov?"translateY(-3px)":"none", transition:"transform 0.18s ease-out, box-shadow 0.18s ease-out, border-color 0.18s ease-out",
        boxShadow:hov?T.shadowHover:T.shadowCard,
      }}>
      <div style={{ position:"relative", paddingTop:"133%", background:coverGradient(title), overflow:"hidden" }}>
        {!err && (
          <img src={imageUrl} alt={title}
            style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", transform:hov?"scale(1.06)":"scale(1)", transition:"transform 0.2s ease-out" }}
            onError={()=>setErr(true)}/>
        )}
        <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"55%", background:"linear-gradient(to top, rgba(14,12,31,0.95) 0%, transparent 100%)" }}/>
        {viewers && (
          <div style={{ position:"absolute", top:9, right:9, display:"flex", alignItems:"center", gap:4, padding:"3px 8px", borderRadius:T.radiusPill, background:"rgba(239,68,68,0.85)", backdropFilter:"blur(6px)" }}>
            <span style={{ width:5, height:5, borderRadius:"50%", background:"#fff", display:"inline-block" }}/>
            <span style={{ fontSize:9, fontWeight:700, color:"#fff" }}>{viewers}</span>
          </div>
        )}
        <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"0 10px 12px" }}>
          <div style={{ fontSize:12, fontWeight:700, color:T.text, fontFamily:T.fontHead, lineHeight:1.2, marginBottom:4 }}>{title}</div>
          <div style={{ display:"inline-block", padding:"4px 12px", borderRadius:T.radiusPill, background:T.brand, color:"#fff", fontSize:10.5, fontWeight:600 }}>
            Watch
          </div>
        </div>
      </div>
    </div>
  );
}

// Hero primary CTA — glow appears only on hover, never permanent, so the game art stays the star.
function HeroPlayButton({ onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ height:54, padding:"0 32px", borderRadius:T.radiusPill, background:T.brandGrad, color:"#fff",
        border:"none", fontSize:14, fontWeight:700, cursor:"pointer",
        boxShadow: hov ? T.brandGlowHov : "none",
        fontFamily:T.fontBody, display:"flex", alignItems:"center", gap:9, transition:T.transitionBase }}>
      <Icon.Play/> Play Now
    </button>
  );
}

// Studio Spotlight — one real studio, one real (unreleased) game. Right side is a small
// overlapping collage of actual Kakudo screenshots rather than a single flat background.
// Bolds «Quoted Titles» within a bio paragraph — a "press kit" convention (game names as the
// visual anchor points a reader's eye catches first), without hardcoding JSX into the data.
function renderStudioBio(text) {
  return text.split(/(«[^»]+»)/g).map((part, i) =>
    part.startsWith("«") ? <strong key={i} style={{ color:T.text, fontWeight:700 }}>{part}</strong> : part
  );
}

function StudioSpotlight({ games, onSelectGame, onTabChange }) {
  const kakudoGame = games.find(g => g.gameId === KAKUDO_SPOTLIGHT.gameId);
  const openKakudo = () => kakudoGame ? onSelectGame(kakudoGame) : onTabChange("games");
  return (
    <div style={{ padding:"0 32px", marginBottom:32 }}>
      <div style={{ position:"relative", borderRadius:T.radiusLg, overflow:"hidden", minHeight:400,
        border:`1px solid ${T.borderBrand}`, display:"flex", background:T.bgDeep }}>
        <img src={KAKUDO_SPOTLIGHT.bgImage} alt=""
          style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", objectPosition:"center 40%", opacity:0.55 }}
          onError={e=>e.currentTarget.style.display="none"}/>
        {/* Masking overlay kept light (~15%) so the real screenshot reads through, not a flat violet block */}
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(90deg, rgba(20,16,42,0.55) 0%, rgba(20,16,42,0.30) 45%, rgba(20,16,42,0.15) 100%)" }}/>
        {/* Faint violet halo behind the CTA zone */}
        <div style={{ position:"absolute", left:-60, bottom:-100, width:380, height:380, borderRadius:"50%",
          background:"radial-gradient(circle, rgba(128,74,240,0.28) 0%, transparent 70%)", pointerEvents:"none" }}/>

        {/* Left — studio text. Light: identity + bio + CTA, nothing else (no genre/category chips). */}
        <div style={{ position:"relative", flex:"0 0 62%", padding:"32px 40px 32px 40px", display:"flex", flexDirection:"column", justifyContent:"center" }}>
          <div style={{ fontSize:10.5, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", color:T.brandLight, marginBottom:12, textShadow:"0 2px 12px rgba(0,0,0,0.6)" }}>
            Studio Spotlight
          </div>
          <div style={{ fontSize:30, fontWeight:800, color:T.text, fontFamily:T.fontHead, marginBottom:8, letterSpacing:"-0.3px", textShadow:"0 2px 16px rgba(0,0,0,0.65)" }}>
            {KAKUDO_SPOTLIGHT.studio}
          </div>
          <div style={{ fontSize:14, color:"rgba(255,255,255,0.9)", fontWeight:600, marginBottom:14, textShadow:"0 2px 12px rgba(0,0,0,0.6)" }}>
            Meet the team behind Kakudo.
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:14, marginBottom:20 }}>
            {KAKUDO_SPOTLIGHT.bioParagraphs.map((p,i)=>(
              <div key={i} style={{ fontSize:15.5, fontWeight:500, color:"rgba(255,255,255,0.86)", lineHeight:1.65, maxWidth:900, textShadow:"0 1px 10px rgba(0,0,0,0.55)" }}>
                {renderStudioBio(p)}
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:22 }}>
            {KAKUDO_SPOTLIGHT.stats.map(s=>(
              <span key={s} style={{ fontSize:11, padding:"5px 12px", borderRadius:T.radiusPill,
                background:"rgba(20,16,42,0.55)", border:"1px solid rgba(255,255,255,0.16)", color:T.textMuted, backdropFilter:"blur(6px)" }}>
                {s}
              </span>
            ))}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:22 }}>
            {/* No dedicated studio page exists yet — routes to the Games tab as the closest
                available destination rather than duplicating the Play Kakudo button below. */}
            <button onClick={()=>onTabChange("games")}
              style={{ padding:"11px 24px", borderRadius:T.radiusPill, background:T.brandGrad, color:"#fff",
                border:"none", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:T.fontBody, transition:T.transitionBase }}>
              Explore Bad Weather Studios
            </button>
            <button onClick={openKakudo}
              style={{ padding:0, background:"none", border:"none", color:"rgba(255,255,255,0.6)", fontSize:12.5,
                fontWeight:600, cursor:"pointer", fontFamily:T.fontBody, display:"flex", alignItems:"center", gap:6 }}>
              <Icon.Play/> Play Kakudo
            </button>
          </div>
        </div>

        {/* Right — overlapping collage of real Kakudo screenshots, 16:9 and ~1.3x bigger than the
            first pass. Interactive: hover straightens + enlarges + brings to front, no click needed. */}
        <div style={{ position:"relative", flex:"0 0 38%" }}>
          <KakudoCollage images={KAKUDO_SPOTLIGHT.collage}
            imgW={260} imgH={146} tilts={[-4,3,-2]} rights={[10,50,90]} tops={[50,150,250]}/>
        </div>
      </div>
    </div>
  );
}

// Hover: straighten to 0deg, scale up slightly, and jump in front of its siblings — no click needed.
function KakudoCollage({ images, imgW=190, imgH=120, tilts=[-5,4,-3], rights=[130,70,10], tops=[70,70,70] }) {
  const [hovIdx, setHovIdx] = useState(null);
  return (
    <>
      {images.map((src, i)=>{
        const isHov = hovIdx === i;
        return (
          <img key={src} src={src} alt="" onMouseEnter={()=>setHovIdx(i)} onMouseLeave={()=>setHovIdx(null)}
            style={{ position:"absolute", width:imgW, height:imgH, objectFit:"cover", clipPath:cutCorner(14),
              boxShadow: isHov ? "0 16px 40px rgba(0,0,0,0.55)" : T.shadowHoverLg,
              border:"1px solid rgba(255,255,255,0.16)", cursor:"pointer",
              right: rights[i], top: tops[i],
              zIndex: isHov ? 10 : i,
              transform: isHov ? "rotate(0deg) scale(1.08)" : `rotate(${tilts[i]}deg) scale(1)`,
              transition:"transform 0.25s cubic-bezier(0.16,1,0.3,1), box-shadow 0.25s ease-out" }}
            onError={e=>{ e.currentTarget.style.display="none"; }}/>
        );
      })}
    </>
  );
}

// Community Favorites card — wide editorial tile. #1 gets a subtle violet accent,
// never a gold/yellow medal — that reads as mobile-game leaderboard, not Rload.
function CommunityFavoriteCard({ item }) {
  const [hov, setHov] = useState(false);
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ position:"relative", clipPath:cutCorner(26), aspectRatio:"16/10",
        background:coverGradient(item.title),
        boxShadow: hov ? T.shadowHover : T.shadowCard,
        transform: hov ? "translateY(-3px)" : "none", cursor:"pointer", transition:T.transitionBase }}>
      {/* Artwork fills the card edge-to-edge — no letterbox bars. */}
      <img src={item.imageUrl} alt={item.title}
        style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover",
          objectPosition: item.imagePosition || "center",
          transform:hov?"scale(1.05)":"scale(1)", transition:"transform 0.3s ease-out" }}
        onError={e=>e.currentTarget.style.display="none"}/>
      <div style={{ position:"absolute", inset:0, background:"linear-gradient(0deg, rgba(14,12,31,0.85) 0%, rgba(14,12,31,0.15) 55%, transparent 100%)" }}/>
      {/* A thin violet line tracing the cut edge — sells the "cut," not just a diagonal crop */}
      <div style={{ position:"absolute", top:0, right:0, width:37, height:37,
        borderTop:`1.5px solid ${T.brand}`, borderRight:`1.5px solid ${T.brand}`, opacity:0.55,
        clipPath:"polygon(48% 0, 100% 0, 100% 52%)" }}/>
      <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"14px 16px" }}>
        <div style={{ fontSize:14.5, fontWeight:700, color:T.text, fontFamily:T.fontHead, letterSpacing:"-0.1px", marginBottom:2 }}>
          {item.title}
        </div>
        <div style={{ fontSize:11, color:"rgba(255,255,255,0.55)", marginBottom:8 }}>{item.studio}</div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span style={{ fontSize:9.5, padding:"2px 9px", borderRadius:T.radiusPill, background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.15)", color:T.textMuted }}>
            {item.genre?.[0]}
          </span>
          <span style={{ fontSize:10.5, color:"rgba(255,255,255,0.45)" }}>{item.plays} plays</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HomePage — premium redesign with 12+ sections and varied card families
// ─────────────────────────────────────────────────────────────────────────────
function HomePage({ games, uiByGame, dlByGame, onSelectGame, user, onTabChange }) {
  const [heroMode, setHeroMode] = useState("video"); // "video" | "img" | "gone"
  const installed = games.filter(g=>[UI.INSTALLED,UI.RUNNING,UI.UPDATE_AVAILABLE,UI.INSTALLED_NO_EXE].includes(uiByGame[g.gameId]||UI.IDLE));
  const running   = games.filter(g=>uiByGame[g.gameId]===UI.RUNNING);
  // Only ever show events that haven't happened yet — a past date on the Home page reads as neglect.
  const now = new Date();
  const nextEvents = UPCOMING_EVENTS
    .filter(ev => new Date(`${ev.day} ${ev.month} 2026`) >= now)
    .sort((a,b)=> new Date(`${a.day} ${a.month} 2026`) - new Date(`${b.day} ${b.month} 2026`))
    .slice(0,2);

  return (
    <div style={{ flex:1, overflowY:"auto", fontFamily:T.fontBody, scrollBehavior:"smooth" }}>

      {/* ── Cinematic Hero — one game, full commitment. Atmosphere → identity → invitation. ── */}
      <div style={{ position:"relative", height:"calc(75vh - 62px)", minHeight:520, maxHeight:720, background:coverGradient("ravenfield"), overflow:"hidden", flexShrink:0 }}>
        {/* Video (primary) */}
        {heroMode === "video" && (
          <video src="./videos/ravenfield_highlight.mp4" autoPlay muted loop playsInline preload="auto"
            style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", objectPosition:"center 35%" }}
            onError={()=>setHeroMode("img")}/>
        )}
        {/* Static image fallback */}
        {heroMode === "img" && (
          <img src={HERO_IMAGE} alt="Ravenfield"
            style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", objectPosition:"center 35%" }}
            onError={()=>setHeroMode("gone")}/>
        )}
        {/* Dark overlays — left fade for readability, bottom fade. Restored to the pre-M4.5 neutral
            dark navy treatment (no purple wash over the video). */}
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(90deg, rgba(14,12,31,0.62) 0%, rgba(14,12,31,0.34) 45%, rgba(14,12,31,0.0) 100%)" }}/>
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(0deg, rgba(14,12,31,0.68) 0%, rgba(14,12,31,0.37) 22%, transparent 65%)" }}/>
        {/* Content overlay — left side */}
        <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", justifyContent:"flex-end", padding:"0 48px 48px", maxWidth:520 }}>
          {/* A quiet label, not a glowing badge — the CTA below is the only bright element on this screen */}
          <div style={{ fontSize:10.5, fontWeight:600, color:"rgba(255,255,255,0.55)", letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:14 }}>
            This Week on Rload
          </div>
          <div style={{ fontSize:36, fontWeight:800, color:T.text, fontFamily:T.fontHead, letterSpacing:"-0.7px", lineHeight:1.1, marginBottom:10, textShadow:"0 2px 20px rgba(0,0,0,0.7)" }}>
            Ravenfield
          </div>
          <div style={{ fontSize:13, color:T.brandLight, fontWeight:600, marginBottom:10 }}>by SteelRaven7</div>
          <div style={{ fontSize:13.5, color:"rgba(255,255,255,0.72)", marginBottom:24, lineHeight:1.6, maxWidth:420 }}>
            Solo battle against an AI-controlled enemy army. Take to the skies, drive tanks, and command your troops to victory across vast, dynamic battlefields.
          </div>
          {/* One invitation, not three — a single dominant action, one quiet secondary link */}
          <div style={{ display:"flex", alignItems:"center", gap:22, marginBottom:16 }}>
            <HeroPlayButton onClick={()=>onTabChange("games")}/>
            <button onClick={()=>onTabChange("games")}
              style={{ padding:0, background:"none", border:"none", color:"rgba(255,255,255,0.6)", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:T.fontBody, display:"flex", alignItems:"center", gap:6, transition:T.transitionFast }}>
              View Details <Icon.ArrowRight/>
            </button>
          </div>
          {/* Genre row — plain neutral chips, no competing color */}
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {["Action","Sandbox","PC"].map(tag=>(
              <span key={tag} style={{ fontSize:9.5, padding:"2px 9px", borderRadius:T.radiusPill, background:"rgba(255,255,255,0.08)", border:`1px solid rgba(255,255,255,0.15)`, color:T.textMuted }}>{tag}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Continue Playing (live running games) ───────────────────────────── */}
      {running.length > 0 && (
        <div style={{ padding:"28px 32px 0", marginBottom:28 }}>
          <SectionHeader title="Continue Playing"/>
          <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
            {running.map(g=>(
              <div key={g.gameId} onClick={()=>onSelectGame(g)}
                style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", borderRadius:T.radius, background:"linear-gradient(135deg, rgba(192,132,252,0.1) 0%, rgba(128,74,240,0.07) 100%)", border:`1px solid ${T.purpleBorder}`, cursor:"pointer", minWidth:200 }}>
                <div style={{ width:40, height:40, borderRadius:"0.5rem", overflow:"hidden", background:coverGradient(g.gameId), flexShrink:0 }}>
                  {(g.thumbnail||g.coverUrl)&&<img src={g.thumbnail||g.coverUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} onError={e=>e.currentTarget.style.display="none"}/>}
                </div>
                <div>
                  <div style={{ fontSize:13.5, fontWeight:600, color:T.text, fontFamily:T.fontHead }}>{g.title}</div>
                  <div style={{ fontSize:11, color:T.purple, display:"flex", alignItems:"center", gap:4 }}><span style={{ width:6, height:6, borderRadius:"50%", background:T.purple, display:"inline-block" }}/> Playing now</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── This Week on Rload (M4.6) — one story, not a grid. See ThisWeekFeature. ── */}
      <div style={{ padding:"28px 40px 0", maxWidth:1700, margin:"0 auto 32px" }}>
        <ThisWeekFeature featured={FEATURED_THIS_WEEK} onSelect={()=>onTabChange("games")}/>
      </div>

      {/* ── Studio Spotlight — real studio, real game (Bad Weather Studios / KAKUDO). No invented quote. ── */}
      <StudioSpotlight games={games} onSelectGame={onSelectGame} onTabChange={onTabChange}/>

      {/* ── Your Library — one calm row, not a grid. Installed / continue-playing first. ───── */}
      {installed.length > 0 && (
        <div style={{ padding:"0 32px", marginBottom:28 }}>
          <SectionHeader title="Your Library" count={installed.length} onMore={()=>onTabChange("games")}/>
          <LibraryRow games={installed.slice(0,9)} uiByGame={uiByGame} onSelectGame={onSelectGame}/>
        </div>
      )}

      {/* ── Community Favorites — three wide editorial cards, not a leaderboard. No medals, no gold. ── */}
      <div style={{ padding:"0 32px", marginBottom:32 }}>
        <SectionHeader title="Community Favorites" subtitle="Most played by Rload members this month" onMore={()=>onTabChange("games")}/>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:14 }}>
          {PC_RANKED_ITEMS.slice(0,3).map(item=>(
            <CommunityFavoriteCard key={item.rank} item={item}/>
          ))}
        </div>
      </div>

      {/* ── Coming Soon — no decorative watermark, just the games themselves. ── */}
      <div style={{ padding:"0 32px", marginBottom:28 }}>
        <SectionHeader title="Coming Soon" subtitle="Games arriving on Rload soon"/>
        <div style={{ display:"flex", gap:12, overflowX:"auto", paddingBottom:8 }} className="hide-scrollbar">
          {COMING_SOON_ITEMS.map(item=>(
            <ComingSoonCard key={item.id} title={item.title} imageUrl={item.imageUrl}/>
          ))}
        </div>
      </div>

      {/* ── Events — sober, editorial, 2 max on Home; the rest lives on the Events tab ── */}
      <div style={{ padding:"0 32px", marginBottom:32 }}>
        <SectionHeader title="Events" subtitle="Indie events and developer moments" onMore={()=>onTabChange("events")}/>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}>
          {nextEvents.map(ev=><EventCard key={ev.id} ev={ev} showThumbnail={true} thumbSize={247}/>)}
        </div>
      </div>

      {/* ── Footer — same footer as Developers/Events, per explicit request to make it consistent. ── */}
      <AppFooter onTabChange={onTabChange}/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ThisWeekFeature (M4.6) — one composition, one story. No card borders, no boxed
// layout, no visible subdivisions: the artwork is masked directly into the
// section background rather than sitting inside a bordered panel. A single
// featured game gets full editorial treatment; three quiet secondary picks sit
// below in a low-weight strip so they never compete with the hero above them.
// ─────────────────────────────────────────────────────────────────────────────
// Reuses T.bgDeep (not a custom near-black) so the section blends seamlessly into the Hero above
// and Studio Spotlight below instead of showing a visible brightness seam at its edges.
const WEEK_BG = T.bgDeep;
function ThisWeekFeature({ featured, onSelect }) {
  const [parallax, setParallax] = useState({ x:0, y:0 });
  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setParallax({ x: px * -5, y: py * -4 }); // capped ~2-3px net after the transform's own scale
  };
  const resetParallax = () => setParallax({ x:0, y:0 });

  return (
    <div style={{ position:"relative", height:430, overflow:"hidden", background:WEEK_BG }}>
      {/* Featured artwork fills the whole left panel edge-to-edge (cover, not contain — contain
          left empty letterbox bars, which read as unfinished rather than "full frame"). The crop
          position is tuned so the subject and title text stay in frame. No color wash over the
          artwork — it renders at full clarity, exactly as shot. */}
      <div onMouseMove={handleMove} onMouseLeave={resetParallax}
        style={{ position:"absolute", left:0, top:0, width:"68%", height:"100%", overflow:"hidden" }}>
        <img src={featured.imageUrl} alt={featured.title}
          style={{ position:"absolute", inset:-8, width:"calc(100% + 16px)", height:"calc(100% + 16px)", objectFit:"cover",
            objectPosition: featured.imagePosition || "center",
            transform:`translate(${parallax.x}px, ${parallax.y}px)`, transition:"transform 1.1s cubic-bezier(0.16,1,0.3,1)" }}
          onError={e=>e.currentTarget.style.display="none"}/>
      </div>

      {/* Editorial column fills the remaining right side. */}
      <div style={{ position:"relative", zIndex:1, display:"flex", height:"100%" }}>
        <div style={{ width:"68%", flexShrink:0 }}/>
        <div style={{ flex:1, minWidth:0, padding:"36px 48px", display:"flex", flexDirection:"column", justifyContent:"center", alignItems:"flex-start", boxSizing:"border-box" }}>
          <div style={{ fontSize:11, fontWeight:600, letterSpacing:"3px", textTransform:"uppercase", color:"rgba(180,168,214,0.6)", marginBottom:10 }}>
            This Week on Rload
          </div>
          <div style={{ fontSize:46, fontWeight:700, color:"#fff", fontFamily:T.fontHead, lineHeight:1.02, letterSpacing:"-0.5px", marginBottom:8 }}>
            {featured.title}
          </div>
          <div style={{ fontSize:13.5, fontWeight:500, color:T.brandLight, marginBottom:14, cursor:"pointer" }}>
            {featured.studio}
          </div>
          <div style={{ fontSize:14.5, fontWeight:600, color:"rgba(255,255,255,0.92)", lineHeight:1.4, marginBottom:8 }}>
            {featured.tagline}
          </div>
          <div style={{ fontSize:12.5, color:"rgba(216,210,232,0.7)", lineHeight:1.55, marginBottom:16 }}>
            {featured.paragraph}
          </div>
          <div style={{ display:"flex", gap:30, marginBottom:18 }}>
            {featured.whyWePickedIt.map((reason,i)=>(
              <div key={reason} style={{ display:"flex", alignItems:"flex-start", gap:8, maxWidth:170 }}>
                <span style={{ color:T.brand, flexShrink:0, marginTop:1 }}>{WHY_ICONS[i]}</span>
                <span style={{ fontSize:11, color:"rgba(216,210,232,0.72)", lineHeight:1.4 }}>{reason}</span>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:22 }}>
            <PlayNowFeatured onClick={onSelect}/>
            <button onClick={onSelect}
              style={{ padding:0, background:"none", border:"none", color:"rgba(255,255,255,0.6)", fontSize:13,
                fontWeight:600, cursor:"pointer", fontFamily:T.fontBody, display:"flex", alignItems:"center", gap:6 }}>
              View Details <Icon.ArrowRight/>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
const WHY_ICONS = [
  <svg key="a" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>,
  <svg key="b" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="4" x2="12" y2="8"/><line x1="12" y1="16" x2="12" y2="20"/><line x1="4" y1="12" x2="8" y2="12"/><line x1="16" y1="12" x2="20" y2="12"/></svg>,
  <Icon.Star key="c"/>,
];

function PlayNowFeatured({ onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ alignSelf:"flex-start", height:52, padding:"0 34px", borderRadius:T.radiusPill, background:T.brandGrad, color:"#fff",
        border:"none", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:T.fontBody,
        display:"flex", alignItems:"center", gap:9,
        transform: hov ? "translateY(-2px)" : "none",
        boxShadow: hov ? T.brandGlow : "none",
        transition:"transform 0.2s ease-out, box-shadow 0.2s ease-out" }}>
      <Icon.Play/> Play Now
    </button>
  );
}

// Secondary pick — artwork, title, studio, nothing else. No genre, no badge, no CTA:
// its only job is to say "here are three more," never to compete with the hero above.
// ─────────────────────────────────────────────────────────────────────────────
// Vercel-style game row card (Recently Played / Updates Available)
// ─────────────────────────────────────────────────────────────────────────────
// Fake game arrays removed — all sections use real CDN games from the `games` prop.

function HScrollCard({ item }) {
  const [hov, setHov] = useState(false);
  const [err, setErr]  = useState(false);
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ minWidth:240, flex:1, height:200, borderRadius:"0.85rem", position:"relative", cursor:"pointer", flexShrink:0,
        overflow:"hidden", background:coverGradient(item.title),
        transform:hov?"scale(1.05)":"scale(1)", transition:"transform 0.2s ease-out",
      }}>
      <img src={item.imageUrl||"./images/games/default_game_cover.png"} alt={item.title} style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"center 40%", position:"absolute", inset:0 }} onError={e=>{ e.currentTarget.src="./images/games/default_game_cover.png"; e.currentTarget.onerror=null; }}/>
      <div style={{ position:"absolute", inset:0, background:"linear-gradient(0deg, rgba(255,255,255,0.02), rgba(255,255,255,0.02)), linear-gradient(270deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.9) 100%)", borderRadius:"0.85rem" }}/>
      <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:14 }}>
        <div style={{ fontSize:15, fontWeight:600, color:"#fff", fontFamily:T.fontHead }}>{item.title}</div>
      </div>
    </div>
  );
}

function LibraryGridCard({ g }) {
  const [hov, setHov] = useState(false);
  const [err, setErr]  = useState(false);
  const statusColor = g.status==="installed"||g.status==="Installed" ? { bg:T.brand, text:"white" }
    : g.status==="Update" ? { bg:T.blue2, text:"white" }
    : g.status==="Favorite" ? { bg:"transparent", text:T.brand }
    : { bg:T.brand, text:"white" };
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      className="group"
      style={{ minWidth:140, flex:1, height:200, borderRadius:"0.85rem", position:"relative", cursor:"pointer", flexShrink:0,
        overflow:"hidden", background:coverGradient(g.game),
        transform:hov?"scale(1.05)":"scale(1)", transition:"transform 0.2s ease-out", padding:"8px 16px",
      }}>
      {!err && <img src={g.imageUrl} alt={g.game} style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"center 40%", position:"absolute", inset:0 }} onError={()=>setErr(true)}/>}
      <div style={{ position:"absolute", inset:0, background:"linear-gradient(0deg, rgba(252,252,252,0.02), rgba(252,252,252,0.02)), linear-gradient(270deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.9) 100%)", borderRadius:"0.85rem" }}/>
      {/* Status badge */}
      <div style={{ position:"relative", display:"inline-block", padding:"2px 14px", borderRadius:T.radiusPill, background:statusColor.bg, color:statusColor.text, fontSize:11, fontWeight:500, marginTop:4 }}>
        {g.status}
      </div>
      {/* Title */}
      <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"6px 14px 8px" }}>
        <div style={{ background:"rgba(252,252,252,0.12)", backdropFilter:"blur(32px)", borderRadius:T.radiusPill, padding:"4px 14px", display:"inline-block", maxWidth:"100%" }}>
          <div style={{ fontSize:11, fontWeight:600, color:"white", fontFamily:T.fontHead, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{g.game}</div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MyGamesPage — sidebar layout, real CDN logic preserved, placeholder safety
// ─────────────────────────────────────────────────────────────────────────────

// PLACEHOLDER_GAMES — visual-only grid cards. isPlaceholder:true is the guard flag.
// These are NEVER passed into install / download / launch flows.
const PLACEHOLDER_GAMES = [
  { id:"ph-01", isPlaceholder:true, title:"Rogue Barrel",       genre:"Shooter",  imageUrl:"./images/games/placeholders/ph_rogue_barrel.png"   },
  { id:"ph-02", isPlaceholder:true, title:"Snailtrain",         genre:"Puzzle",   imageUrl:"./images/games/placeholders/ph_snailtrain.png"      },
  { id:"ph-03", isPlaceholder:true, title:"Neon Prism",         genre:"Puzzle",   imageUrl:"./images/games/placeholders/ph_neon_prism.png"      },
  { id:"ph-04", isPlaceholder:true, title:"Circuit Bloom",      genre:"Puzzle",   imageUrl:"./images/games/placeholders/ph_circuit_bloom.png"   },
  { id:"ph-05", isPlaceholder:true, title:"Bouncewood",         genre:"Platform", imageUrl:"./images/games/placeholders/ph_bouncewood.png"      },
  { id:"ph-06", isPlaceholder:true, title:"Steampunk Tower",    genre:"Platform", imageUrl:"./images/games/placeholders/ph_steampunk.png"       },
  { id:"ph-07", isPlaceholder:true, title:"Echoes: Room 313",   genre:"Horror",   imageUrl:"./images/games/placeholders/ph_echoes_room.png"     },
  { id:"ph-08", isPlaceholder:true, title:"Toy Factory Terror", genre:"Horror",   imageUrl:"./images/games/placeholders/ph_toy_factory.png"     },
  { id:"ph-09", isPlaceholder:true, title:"Eerie Forest",       genre:"Horror",   imageUrl:"./images/games/placeholders/ph_eerie_forest.png"    },
  { id:"ph-10", isPlaceholder:true, title:"Knights Stand",      genre:"RPG",      imageUrl:"./images/games/placeholders/ph_knight.png"          },
  { id:"ph-11", isPlaceholder:true, title:"Tokyo Drift Night",  genre:"Racing",   imageUrl:"./images/games/placeholders/ph_tokyo_drift.png"     },
  { id:"ph-12", isPlaceholder:true, title:"Overdrive 2099",     genre:"Racing",   imageUrl:"./images/games/placeholders/ph_overdrive.png"       },
  { id:"ph-13", isPlaceholder:true, title:"Shadow Samurai",     genre:"Fights",   imageUrl:"./images/games/placeholders/ph_shadow_samurai.png"  },
  { id:"ph-14", isPlaceholder:true, title:"Mech Battle",        genre:"Fights",   imageUrl:"./images/games/placeholders/ph_mech_battle.png"     },
  { id:"ph-15", isPlaceholder:true, title:"Hellcode 16",        genre:"Shooter",  imageUrl:"./images/games/placeholders/ph_hellcode.png"        },
];

// FEATURED_PLACEHOLDERS — visual-only featured section (character art style).
// isPlaceholder:true — never enter CDN flows.
const FEATURED_PLACEHOLDERS = [
  { id:"fp-01", isPlaceholder:true, title:"Cyberpunk Battle",   genre:"Action",   imageUrl:"./images/games/placeholders/ph_cyberpunk_battle.png" },
  { id:"fp-02", isPlaceholder:true, title:"Nightfall Blade",    genre:"Action",   imageUrl:"./images/games/placeholders/ph_nightfall_blade.png"  },
  { id:"fp-03", isPlaceholder:true, title:"Desert Bounty",      genre:"Action",   imageUrl:"./images/games/placeholders/ph_bounty_hunter.png"    },
  { id:"fp-04", isPlaceholder:true, title:"Gladiator Arena",    genre:"Fights",   imageUrl:"./images/games/placeholders/ph_gladiator.png"        },
  { id:"fp-05", isPlaceholder:true, title:"Shadow Assassin",    genre:"Shooter",  imageUrl:"./images/games/placeholders/ph_assassin.png"         },
  { id:"fp-06", isPlaceholder:true, title:"Wasteland Rising",   genre:"Action",   imageUrl:"./images/games/placeholders/ph_wasteland.png"        },
];

// PlaceholderCard — purely visual, no CDN actions. Dimmed & "Soon" badge.
function PlaceholderCard({ p }) {
  const [hov, setHov] = useState(false);
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ borderRadius:T.radius, overflow:"hidden", position:"relative",
        border:"1px solid rgba(255,255,255,0.05)", cursor:"default", userSelect:"none",
        transform:hov?"translateY(-2px)":"none", transition:"transform 0.18s ease-out" }}>
      <div style={{ position:"relative", width:"100%", paddingTop:"133%", background:"#0a0914" }}>
        <img src={p.imageUrl} alt={p.title}
          style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover",
            filter:"brightness(0.55) saturate(0.65)",
            transform:hov?"scale(1.04)":"scale(1)", transition:"transform 0.2s ease-out" }}
          onError={e=>e.currentTarget.style.display="none"}/>
        <div style={{ position:"absolute", top:8, right:8, padding:"2px 7px", borderRadius:T.radiusPill,
          fontSize:8.5, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase",
          color:"rgba(255,255,255,0.28)", background:"rgba(255,255,255,0.05)",
          border:"1px solid rgba(255,255,255,0.08)" }}>
          Soon
        </div>
      </div>
      <div style={{ padding:"9px 11px 11px" }}>
        <div style={{ fontSize:12, fontWeight:500, color:"rgba(255,255,255,0.25)",
          fontFamily:T.fontHead, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {p.title}
        </div>
      </div>
    </div>
  );
}

// SidebarSectionLabel — small uppercase section divider, premium style
function SidebarSectionLabel({ label }) {
  return (
    <div style={{ fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.28)", letterSpacing:"0.14em",
      textTransform:"uppercase", padding:"18px 14px 6px", userSelect:"none", fontFamily:T.fontBody }}>
      {label}
    </div>
  );
}

// SidebarNavItem — premium pill-style active state matching reference screenshot
function SidebarNavItem({ icon, label, active, onClick, badge, disabled }) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={disabled?undefined:onClick}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px",
        borderRadius:"0.75rem", cursor:disabled?"default":"pointer", userSelect:"none", margin:"1px 0",
        background: active
          ? "linear-gradient(135deg, rgba(128,74,240,0.38) 0%, rgba(68,44,117,0.28) 100%)"
          : (hov&&!disabled)?"rgba(255,255,255,0.07)":"transparent",
        boxShadow: active ? "0 2px 16px rgba(128,74,240,0.28), inset 0 1px 0 rgba(255,255,255,0.08)" : "none",
        border: active ? "1px solid rgba(128,74,240,0.45)" : "1px solid transparent",
        color: active?"#fff":disabled?"rgba(255,255,255,0.22)":hov?"rgba(255,255,255,0.82)":"rgba(255,255,255,0.54)",
        opacity:disabled?0.45:1,
        transition:"background 0.15s ease-out, color 0.15s ease-out, box-shadow 0.15s ease-out, border-color 0.15s ease-out" }}>
      <span style={{ fontSize:15, lineHeight:1, flexShrink:0, width:20, textAlign:"center",
        filter: active ? "drop-shadow(0 0 4px rgba(128,74,240,0.7))" : "none",
        transition:"filter 0.15s ease-out" }}>{icon}</span>
      <span style={{ fontSize:13, fontWeight:active?600:450, flex:1,
        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
        letterSpacing:active?"-0.1px":"0" }}>{label}</span>
      {badge!=null && badge>0 && (
        <span style={{ fontSize:9.5, fontWeight:700, padding:"2px 7px", borderRadius:99,
          background:active?"rgba(255,255,255,0.22)":"rgba(128,74,240,0.40)",
          color:"#fff", flexShrink:0, minWidth:18, textAlign:"center" }}>
          {badge}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton loading components (.rl-sk class defined globally in styles.css)
// ─────────────────────────────────────────────────────────────────────────────

function SkeletonOverviewCard() {
  return (
    <div style={{ borderRadius:"1rem", border:"1px solid rgba(255,255,255,0.06)", padding:"24px 12px 20px",
      display:"flex", flexDirection:"column", alignItems:"center", gap:10, background:"rgba(255,255,255,0.03)" }}>
      <div className="rl-sk" style={{ width:30, height:30, borderRadius:"0.4rem" }}/>
      <div className="rl-sk" style={{ width:72, height:10, borderRadius:4 }}/>
      <div className="rl-sk" style={{ width:44, height:22, borderRadius:6 }}/>
    </div>
  );
}

function SkeletonGameCard() {
  return (
    <div style={{ height:220, borderRadius:"1rem", overflow:"hidden", border:"1px solid rgba(255,255,255,0.05)", background:"rgba(255,255,255,0.03)" }}>
      <div className="rl-sk" style={{ width:"100%", height:"100%" }}/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LastPlayedCard — immersive, enhanced (Task 2)
// ─────────────────────────────────────────────────────────────────────────────
function LastPlayedCard({ game, imageUrl, weeklyMins, onResume }) {
  const [hov, setHov] = useState(false);
  const [imgErr, setImgErr] = useState(false);
  const title = game?.title || "Last Game";
  const playtime = weeklyMins > 0
    ? `Played ${Math.floor(weeklyMins/60)}h ${weeklyMins%60}m this week`
    : "Resume your game";

  const [btnHov, setBtnHov] = useState(false);

  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ position:"relative", borderRadius:"1.1rem", overflow:"hidden",
        background:"rgba(255,255,255,0.03)",
        border:`1px solid ${hov ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.07)"}`,
        display:"flex", alignItems:"center", gap:0, height:164,
        boxShadow: hov ? "0 16px 56px rgba(0,0,0,0.6), 0 0 0 1px rgba(128,74,240,0.12)" : "0 8px 40px rgba(0,0,0,0.45)",
        transform: hov ? "scale(1.008)" : "scale(1)",
        transition:"transform 0.2s ease-out, box-shadow 0.2s ease-out, border-color 0.2s ease-out",
        cursor:"pointer",
      }}>
      {/* Blurred ambient background from game cover */}
      {!imgErr && (
        <div style={{ position:"absolute", inset:0, zIndex:0, overflow:"hidden" }}>
          <img src={imageUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", filter:"blur(40px) saturate(2.4)", opacity: hov ? 0.28 : 0.22, transform:"scale(1.2)", transition:"opacity 0.2s ease-out" }} onError={()=>setImgErr(true)}/>
        </div>
      )}
      <div style={{ position:"absolute", inset:0, background:"linear-gradient(90deg, rgba(14,12,31,0.05) 0%, rgba(14,12,31,0.82) 100%)", zIndex:0 }}/>

      {/* Game cover */}
      <div onClick={onResume}
        style={{ position:"relative", zIndex:1, flexShrink:0, cursor:"pointer",
          width:120, height:"100%", overflow:"hidden" }}>
        {!imgErr ? (
          <img src={imageUrl} alt={title}
            style={{ width:"100%", height:"100%", objectFit:"cover",
              transform: hov ? "scale(1.06)" : "scale(1)", transition:"transform 0.22s ease-out" }}
            onError={()=>setImgErr(true)}/>
        ) : (
          <div style={{ width:"100%", height:"100%", background:coverGradient(title), display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Icon.Games/>
          </div>
        )}
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(90deg, transparent 55%, rgba(14,12,31,0.65) 100%)" }}/>
      </div>

      {/* Info + resume */}
      <div style={{ position:"relative", zIndex:1, flex:1, padding:"22px 24px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize:10, color:T.textDim, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8, fontWeight:600 }}>Last Played</div>
          <div style={{ fontSize:19, fontWeight:700, color:T.text, fontFamily:T.fontHead, marginBottom:6, letterSpacing:"-0.3px" }}>{title}</div>
          <div style={{ fontSize:12, color:T.textMuted }}>{playtime}</div>
        </div>

        {/* Resume button */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:7 }}>
          {/* Soft glow ring behind the button */}
          <div style={{ position:"relative" }}>
            {(hov || btnHov) && (
              <div style={{ position:"absolute", inset:-8, borderRadius:"50%",
                background:"radial-gradient(circle, rgba(128,74,240,0.25) 0%, transparent 70%)",
                pointerEvents:"none" }}/>
            )}
            <div onClick={onResume}
              onMouseEnter={()=>setBtnHov(true)}
              onMouseLeave={()=>setBtnHov(false)}
              style={{ position:"relative", width:58, height:58, borderRadius:"50%",
                background: btnHov ? T.brandGradHov : T.brandGrad,
                boxShadow: btnHov ? T.brandGlowHov : T.brandGlow,
                display:"flex", alignItems:"center", justifyContent:"center",
                cursor:"pointer",
                transform: btnHov ? "scale(1.08)" : "scale(1)",
                transition:"background 0.2s ease-out, box-shadow 0.2s ease-out, transform 0.2s ease-out",
                paddingLeft:3 }}>
              <Icon.Play/>
            </div>
          </div>
          <div style={{ fontSize:11, fontWeight:600, color:T.brandLight, letterSpacing:"0.02em" }}>Resume</div>
        </div>

        {/* Friends */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:7 }}>
          <div style={{ display:"flex" }}>
            {["./images/community/people1.jpg","./images/community/people2.jpg","./images/community/people3.jpg"].map((src,i)=>(
              <img key={i} src={src} alt="" style={{ width:34, height:34, borderRadius:"50%", objectFit:"cover", border:`2px solid rgba(14,12,31,0.8)`, marginLeft:i>0?-9:0 }} onError={e=>e.currentTarget.style.display="none"}/>
            ))}
          </div>
          <div style={{ fontSize:10.5, color:T.textDim }}>3 friends playing</div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Games tab sub-components
// ─────────────────────────────────────────────────────────────────────────────

// SectionHeading — consistent section title with optional bottom margin
function SectionHeading({ title, noMargin }) {
  return (
    <div style={{ fontSize:15, fontWeight:700, color:T.text, fontFamily:T.fontHead,
      letterSpacing:"-0.2px", marginBottom:noMargin?0:14 }}>
      {title}
    </div>
  );
}

// ContinuePlayingHero — large immersive banner for last/currently played game
function ContinuePlayingHero({ heroGame, heroImg, isRunning, onSelect }) {
  const [hov, setHov] = useState(false);
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      onClick={onSelect}
      style={{ position:"relative", height:190, borderRadius:T.radiusLg, overflow:"hidden",
        background:coverGradient(heroGame.gameId),
        border:`1px solid ${hov?"rgba(128,74,240,0.5)":"rgba(128,74,240,0.22)"}`,
        boxShadow:hov?"0 16px 56px rgba(0,0,0,0.7), 0 0 0 1px rgba(128,74,240,0.2)":"0 8px 40px rgba(0,0,0,0.55)",
        cursor:"pointer",
        transform:hov?"scale(1.004)":"scale(1)",
        transition:"transform 0.2s ease-out, box-shadow 0.2s ease-out, border-color 0.2s ease-out" }}>
      {/* Background art */}
      {heroImg && (
        <img src={heroImg} alt={heroGame.title}
          style={{ position:"absolute", inset:0, width:"100%", height:"100%",
            objectFit:"cover", objectPosition:"center 25%",
            transform:hov?"scale(1.04)":"scale(1)",
            transition:"transform 0.4s ease-out" }}
          onError={e=>e.currentTarget.style.display="none"}/>
      )}
      {/* Dark gradient left → right for text legibility */}
      <div style={{ position:"absolute", inset:0,
        background:"linear-gradient(90deg, rgba(10,8,28,0.97) 0%, rgba(10,8,28,0.78) 38%, rgba(10,8,28,0.25) 72%, rgba(10,8,28,0.0) 100%)" }}/>
      <div style={{ position:"absolute", inset:0,
        background:"linear-gradient(0deg, rgba(10,8,28,0.65) 0%, transparent 50%)" }}/>
      {/* Ambient glow on hover */}
      {hov && <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at 20% 50%, rgba(128,74,240,0.09) 0%, transparent 65%)", pointerEvents:"none" }}/>}

      {/* Content */}
      <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", padding:"0 28px", gap:20 }}>
        <div style={{ flex:1, minWidth:0 }}>
          {/* "LAST PLAYED" label */}
          <div style={{ display:"inline-flex", alignItems:"center", gap:6, marginBottom:10 }}>
            <span style={{ fontSize:9, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase",
              color:"rgba(255,255,255,0.45)", background:"rgba(255,255,255,0.08)",
              border:"1px solid rgba(255,255,255,0.12)", borderRadius:T.radiusPill,
              padding:"3px 10px" }}>
              {isRunning ? "Now Playing" : "Last Played"}
            </span>
          </div>
          {/* Studio */}
          {heroGame.studio && (
            <div style={{ fontSize:10, color:T.brandLight, letterSpacing:"0.1em",
              textTransform:"uppercase", fontWeight:600, marginBottom:4 }}>
              {heroGame.studio}
            </div>
          )}
          {/* Title */}
          <div style={{ fontSize:26, fontWeight:800, color:"#fff", fontFamily:T.fontHead,
            letterSpacing:"-0.5px", lineHeight:1.1, marginBottom:16,
            textShadow:"0 2px 20px rgba(0,0,0,0.9)",
            overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>
            {heroGame.title}
          </div>
          {/* Resume / Playing button */}
          <div style={{ display:"inline-flex", alignItems:"center", gap:8,
            padding:"10px 24px", borderRadius:T.radiusPill,
            background:isRunning?"rgba(34,197,94,0.18)":T.brandGrad,
            border:isRunning?"1px solid rgba(34,197,94,0.4)":"none",
            color:"#fff", fontSize:13.5, fontWeight:700,
            boxShadow:isRunning?"0 4px 18px rgba(34,197,94,0.3)":T.brandGlow,
            letterSpacing:"0.01em", cursor:"pointer",
            transform:hov?"translateX(3px)":"none",
            transition:"transform 0.2s ease-out" }}>
            {isRunning
              ? <><span style={{ width:7, height:7, borderRadius:"50%", background:"#22c55e", display:"inline-block", boxShadow:"0 0 6px rgba(34,197,94,0.8)" }}/> Playing Now</>
              : <><Icon.Play/> Resume</>}
          </div>
        </div>

        {/* Right side — version tag */}
        {heroGame.version && (
          <div style={{ flexShrink:0, padding:"4px 12px", borderRadius:T.radiusPill,
            background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)",
            fontSize:11, color:"rgba(255,255,255,0.45)", backdropFilter:"blur(8px)" }}>
            v{heroGame.version}
          </div>
        )}
      </div>
    </div>
  );
}

// RecentCard — medium landscape card in the recently played row
function RecentCard({ g, badge, sel, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      onClick={onClick}
      style={{ minWidth:198, width:198, height:124, borderRadius:T.radius,
        position:"relative", overflow:"hidden", flexShrink:0, cursor:"pointer",
        background:coverGradient(g.gameId),
        border:sel?`1.5px solid ${T.brand}`:hov?"1px solid rgba(255,255,255,0.18)":"1px solid rgba(255,255,255,0.07)",
        boxShadow:hov?"0 16px 40px rgba(0,0,0,0.65)":"0 4px 16px rgba(0,0,0,0.35)",
        transform:hov?"translateY(-4px)":"translateY(0)",
        transition:"transform 0.18s ease-out, box-shadow 0.18s ease-out, border-color 0.18s ease-out" }}>
      <img src={g.thumbnail||g.coverUrl||"./images/games/default_game_cover.png"} alt={g.title}
        style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover",
          transform:hov?"scale(1.06)":"scale(1)", transition:"transform 0.28s ease-out" }}
        onError={e=>{ e.currentTarget.src="./images/games/default_game_cover.png"; e.currentTarget.onerror=null; }}/>
      <div style={{ position:"absolute", inset:0,
        background:"linear-gradient(0deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.20) 55%, transparent 100%)" }}/>
      {badge && (
        <div style={{ position:"absolute", top:8, right:8, padding:"2px 8px",
          borderRadius:T.radiusPill, fontSize:8.5, fontWeight:700, textTransform:"uppercase",
          color:badge.color, background:badge.bg, border:`1px solid ${badge.border}`,
          backdropFilter:"blur(8px)" }}>
          {badge.label}
        </div>
      )}
      <div style={{ position:"absolute", bottom:9, left:11, right:11 }}>
        <div style={{ fontSize:13, fontWeight:700, color:"#fff", fontFamily:T.fontHead,
          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
          textShadow:"0 1px 8px rgba(0,0,0,0.8)" }}>
          {g.title}
        </div>
      </div>
    </div>
  );
}

// FeaturedCard — large character-art style card (landscape) for Featured section
// FeaturedCard — individual card used inside the FeaturedBento grid
function FeaturedCard({ game, large, onSelect }) {
  const [hov, setHov] = useState(false);
  const imgSrc = game.isPlaceholder
    ? game.imageUrl
    : (LOCAL_COVERS[game.gameId] || game.thumbnail || game.coverUrl || "./images/games/default_game_cover.png");
  const genreLabel = game.isPlaceholder ? game.genre : (game.tags?.[0] || "");

  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      onClick={onSelect}
      style={{ position:"relative", borderRadius:T.radius, overflow:"hidden",
        height:"100%", cursor:onSelect?"pointer":"default",
        background:coverGradient(game.isPlaceholder?game.id:game.gameId),
        border:`1px solid ${hov&&onSelect?"rgba(255,255,255,0.22)":"rgba(255,255,255,0.07)"}`,
        boxShadow:hov&&onSelect?"0 24px 64px rgba(0,0,0,0.7)":"0 4px 20px rgba(0,0,0,0.35)",
        transform:hov&&onSelect?"scale(1.015)":"scale(1)",
        transition:"transform 0.22s ease-out, box-shadow 0.22s ease-out, border-color 0.22s ease-out" }}>
      {/* Character art — objectPosition top to show characters not background */}
      <img src={imgSrc} alt={game.title||game.gameId}
        style={{ position:"absolute", inset:0, width:"100%", height:"100%",
          objectFit:"cover", objectPosition:"center top",
          transform:hov?"scale(1.06)":"scale(1)",
          transition:"transform 0.4s ease-out" }}
        onError={e=>e.currentTarget.style.display="none"}/>
      {/* Bottom gradient for text */}
      <div style={{ position:"absolute", inset:0,
        background:"linear-gradient(0deg, rgba(6,4,18,0.96) 0%, rgba(6,4,18,0.60) 35%, rgba(6,4,18,0.12) 65%, transparent 100%)" }}/>
      {/* Genre / FEATURED pill — lime green like reference */}
      <div style={{ position:"absolute", top:10, left:10,
        padding:"3px 10px", borderRadius:T.radiusPill, fontSize:9, fontWeight:800,
        letterSpacing:"0.1em", textTransform:"uppercase", backdropFilter:"blur(8px)",
        background:"rgba(128,74,240,0.18)", border:"1px solid rgba(128,74,240,0.5)",
        color:"#c9aefb" }}>
        {genreLabel || "FEATURED"}
      </div>
      {game.isPlaceholder && (
        <div style={{ position:"absolute", top:10, right:10, padding:"2px 8px",
          borderRadius:T.radiusPill, background:"rgba(255,255,255,0.06)",
          border:"1px solid rgba(255,255,255,0.10)", fontSize:8.5, fontWeight:700,
          textTransform:"uppercase", color:"rgba(255,255,255,0.28)" }}>Soon</div>
      )}
      {/* Info */}
      <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:large?"16px 18px":"11px 13px" }}>
        <div style={{ fontSize:large?16:13, fontWeight:700, color:"#fff", fontFamily:T.fontHead,
          marginBottom:3, textShadow:"0 2px 12px rgba(0,0,0,0.95)",
          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
          {game.title||game.gameId}
        </div>
        {(game.studio||genreLabel) && (
          <div style={{ fontSize:large?11.5:10.5, color:"rgba(255,255,255,0.48)" }}>
            {game.studio || genreLabel}
          </div>
        )}
      </div>
      {/* Hover play ring — real games only */}
      {hov && onSelect && (
        <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center",
          justifyContent:"center" }}>
          <div style={{ width:large?52:40, height:large?52:40, borderRadius:"50%",
            background:"rgba(128,74,240,0.18)", border:"1.5px solid rgba(128,74,240,0.6)",
            display:"flex", alignItems:"center", justifyContent:"center",
            backdropFilter:"blur(8px)", boxShadow:"0 4px 24px rgba(128,74,240,0.3)" }}>
            <Icon.Play/>
          </div>
        </div>
      )}
    </div>
  );
}

// FeaturedBento — Image #5 inspired layout: 1 big left + 3 right in a grid
function FeaturedBento({ cards, onSelect }) {
  const [big, ...rest] = cards;
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1.45fr 1fr", gridTemplateRows:"220px", gap:10 }}>
      {/* Big left card */}
      <div style={{ gridRow:"1", gridColumn:"1" }}>
        <FeaturedCard game={big} large={true}
          onSelect={big&&!big.isPlaceholder?()=>onSelect(big):undefined}/>
      </div>
      {/* Right column — 2 stacked smaller cards */}
      <div style={{ display:"grid", gridTemplateRows:"1fr 1fr", gap:10 }}>
        {rest.slice(0,2).map((g,i)=>(
          <FeaturedCard key={g.isPlaceholder?g.id:g.gameId} game={g} large={false}
            onSelect={g&&!g.isPlaceholder?()=>onSelect(g):undefined}/>
        ))}
      </div>
    </div>
  );
}

// useScrollDots — pagination for a horizontal overflow row: figures out how many "pages" the
// row can be swiped through (by how many items fit per view), tracks which page is currently
// scrolled into view, and exposes goToPage() to jump there with a smooth scroll. Native
// drag/wheel scrolling is untouched — this only adds an extra way to page through.
function useScrollDots(itemCount, itemSize, gap) {
  const scrollRef = useRef(null);
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const perPage = () => Math.max(1, Math.floor((el.clientWidth + gap) / (itemSize + gap)));
    const recompute = () => setPageCount(Math.max(1, Math.ceil(itemCount / perPage())));
    recompute();
    // Map scrollLeft's fraction of the actual scrollable range onto a page index — NOT
    // scrollLeft / pageWidth. The last page is almost always shorter than a full page's
    // worth of items (e.g. 9 items at 7-per-page leaves only 2 items, ~280px, of real
    // scroll range), so dividing by a full page-width would round straight back to 0 and
    // the active dot would never leave page 1 no matter how far the row was scrolled.
    const onScroll = () => {
      const pages = Math.max(1, Math.ceil(itemCount / perPage()));
      const maxScroll = el.scrollWidth - el.clientWidth;
      const idx = maxScroll > 0 ? Math.round((el.scrollLeft / maxScroll) * (pages - 1)) : 0;
      setPage(Math.min(pages - 1, Math.max(0, idx)));
    };
    window.addEventListener("resize", recompute);
    el.addEventListener("scroll", onScroll, { passive:true });
    return () => {
      window.removeEventListener("resize", recompute);
      el.removeEventListener("scroll", onScroll);
    };
  }, [itemCount, itemSize, gap]);

  const goToPage = (p) => {
    const el = scrollRef.current;
    if (!el) return;
    const perPage = Math.max(1, Math.floor((el.clientWidth + gap) / (itemSize + gap)));
    const pages = Math.max(1, Math.ceil(itemCount / perPage));
    const maxScroll = el.scrollWidth - el.clientWidth;
    const target = pages > 1 ? (p / (pages - 1)) * maxScroll : 0;
    el.scrollTo({ left: target, behavior:"smooth" });
  };

  return { scrollRef, page, pageCount, goToPage };
}

// CarouselDots — Apple-TV-style page indicator below a swipeable row. Renders nothing when
// the row doesn't actually overflow (not enough items to need paging).
function CarouselDots({ page, pageCount, onSelect }) {
  if (pageCount <= 1) return null;
  return (
    <div style={{ display:"flex", justifyContent:"center", gap:6, marginTop:10 }}>
      {Array.from({ length:pageCount }).map((_,i)=>(
        <button key={i} onClick={()=>onSelect(i)} aria-label={`Go to page ${i+1}`}
          style={{ width:i===page?18:6, height:6, borderRadius:3, border:"none", padding:0, cursor:"pointer",
            background:i===page?T.brand:"rgba(255,255,255,0.22)",
            transition:"width 0.2s ease-out, background 0.2s ease-out" }}/>
      ))}
    </div>
  );
}

// RecentPlayedRow — "Recently Played" scroll row (Games page), with page dots underneath.
function RecentPlayedRow({ games, uiByGame, selectedGameId, onSelectGame }) {
  const itemSize = 198, gap = 12;
  const { scrollRef, page, pageCount, goToPage } = useScrollDots(games.length, itemSize, gap);
  return (
    <div>
      <div ref={scrollRef} style={{ display:"flex", gap, overflowX:"auto", paddingBottom:4 }} className="hide-scrollbar">
        {games.map(g=>{
          const badge = getStateBadge(uiByGame[g.gameId]);
          const sel   = selectedGameId===g.gameId;
          return (
            <RecentCard key={g.gameId} g={g} badge={badge} sel={sel}
              onClick={()=>onSelectGame(g.gameId===selectedGameId?null:g)}/>
          );
        })}
      </div>
      <CarouselDots page={page} pageCount={pageCount} onSelect={goToPage}/>
    </div>
  );
}

// LibraryRow — "Your Library" scroll row (Home), with page dots underneath.
function LibraryRow({ games, uiByGame, onSelectGame }) {
  const itemSize = 132, gap = 14;
  const { scrollRef, page, pageCount, goToPage } = useScrollDots(games.length, itemSize, gap);
  return (
    <div>
      <div ref={scrollRef} style={{ display:"flex", gap, overflowX:"auto", paddingBottom:8 }} className="hide-scrollbar">
        {games.map(g=>(
          <div key={g.gameId} style={{ width:itemSize, flexShrink:0 }}>
            <SmallCoverCard game={g} uiState={uiByGame[g.gameId]||UI.IDLE} onSelect={onSelectGame}/>
          </div>
        ))}
      </div>
      <CarouselDots page={page} pageCount={pageCount} onSelect={goToPage}/>
    </div>
  );
}

// ThreeDRow — Image #4 inspired subtle 3D perspective row (one special row only), with page dots underneath.
function ThreeDRow({ games, uiByGame, dlByGame, selectedGameId, onSelectGame }) {
  const itemSize = 160, gap = 14;
  const { scrollRef, page, pageCount, goToPage } = useScrollDots(games.length, itemSize, gap);
  return (
    <div>
      <div ref={scrollRef} style={{ perspective:"900px", perspectiveOrigin:"50% 50%",
        display:"flex", gap, overflowX:"auto", paddingBottom:8, paddingTop:4 }}
        className="hide-scrollbar">
        {games.map((g, i) => {
          const mid   = (games.length - 1) / 2;
          const dist  = i - mid;
          const rotY  = dist * -5;   // mild Y rotation: edges tilt away
          const scl   = 1 - Math.abs(dist) * 0.025;
          const badge = getStateBadge(uiByGame[g.gameId]);
          const sel   = selectedGameId === g.gameId;
          return (
            <ThreeDCard key={g.gameId} game={g} badge={badge} sel={sel} rotY={rotY} scl={scl}
              onClick={()=>onSelectGame(g.gameId===selectedGameId?null:g)}/>
          );
        })}
      </div>
      <CarouselDots page={page} pageCount={pageCount} onSelect={goToPage}/>
    </div>
  );
}

function ThreeDCard({ game, badge, sel, rotY, scl, onClick }) {
  const [hov, setHov] = useState(false);
  const imgSrc = LOCAL_COVERS[game.gameId] || game.thumbnail || game.coverUrl || "./images/games/default_game_cover.png";
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      onClick={onClick}
      style={{ minWidth:160, width:160, height:220, borderRadius:T.radius,
        position:"relative", overflow:"hidden", flexShrink:0, cursor:"pointer",
        background:coverGradient(game.gameId),
        border:sel?`1.5px solid ${T.brand}`:hov?"1px solid rgba(255,255,255,0.25)":"1px solid rgba(255,255,255,0.08)",
        transformOrigin:"center center",
        transform:hov
          ? `rotateY(0deg) scale(1.06) translateZ(12px)`
          : `rotateY(${rotY}deg) scale(${scl}) translateZ(0px)`,
        boxShadow:hov
          ? `0 24px 64px rgba(0,0,0,0.75), 0 0 0 1px rgba(128,74,240,0.22)`
          : `0 8px 28px rgba(0,0,0,0.55)`,
        transition:"transform 0.28s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.22s ease-out, border-color 0.18s ease-out" }}>
      <img src={imgSrc} alt={game.title}
        style={{ position:"absolute", inset:0, width:"100%", height:"100%",
          objectFit:"cover", objectPosition:"center top" }}
        onError={e=>{ e.currentTarget.src="./images/games/default_game_cover.png"; e.currentTarget.onerror=null; }}/>
      <div style={{ position:"absolute", inset:0,
        background:"linear-gradient(0deg, rgba(0,0,0,0.85) 0%, transparent 55%)" }}/>
      {badge && (
        <div style={{ position:"absolute", top:7, right:7, padding:"2px 7px",
          borderRadius:T.radiusPill, fontSize:8.5, fontWeight:700, textTransform:"uppercase",
          color:badge.color, background:badge.bg, border:`1px solid ${badge.border}`,
          backdropFilter:"blur(6px)" }}>{badge.label}</div>
      )}
      <div style={{ position:"absolute", bottom:9, left:10, right:10 }}>
        <div style={{ fontSize:12.5, fontWeight:700, color:"#fff", fontFamily:T.fontHead,
          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
          textShadow:"0 1px 8px rgba(0,0,0,0.9)" }}>{game.title}</div>
        {game.studio && <div style={{ fontSize:10, color:"rgba(255,255,255,0.42)", marginTop:2 }}>{game.studio}</div>}
      </div>
    </div>
  );
}

// ── Playtime helpers ──────────────────────────────────────────────────────────
function getWeekKey() {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const wk = Math.ceil((((d - jan1) / 86400000) + jan1.getDay() + 1) / 7);
  return `rload-playtime-${d.getFullYear()}-w${wk}`;
}
function formatPlaytime(mins) {
  if (!mins) return "0m";
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function MyGamesPage({ games, uiByGame, dlByGame, selectedGameId, onSelectGame, gameDetailProps, gamesLoading, onTabChange }) {
  const [sidebarView, setSidebarView] = useState("all"); // all|installed|updates|favorites|recent|downloads|queue|tag:X
  const [search, setSearch]           = useState("");
  const [online, setOnline]           = useState(navigator.onLine);
  useEffect(() => {
    const on  = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online",  on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // ── Favorites (localStorage) — unchanged CDN logic ────────────────────────
  const [favorites, setFavorites] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("rload-favorites")||"[]")); }
    catch { return new Set(); }
  });
  const toggleFavorite = (gameId) => {
    setFavorites(prev => {
      const next = new Set(prev);
      next.has(gameId) ? next.delete(gameId) : next.add(gameId);
      localStorage.setItem("rload-favorites", JSON.stringify([...next]));
      return next;
    });
  };

  // ── Playtime tracking — unchanged CDN logic ───────────────────────────────
  const [weeklyMins, setWeeklyMins] = useState(() =>
    parseInt(localStorage.getItem(getWeekKey())||"0", 10)
  );
  const runStart = useRef({});
  useEffect(() => {
    for (const [gid, state] of Object.entries(uiByGame)) {
      if (state === UI.RUNNING && !runStart.current[gid]) {
        runStart.current[gid] = Date.now();
      } else if (state !== UI.RUNNING && runStart.current[gid]) {
        const elapsed = Math.round((Date.now() - runStart.current[gid]) / 60000);
        if (elapsed > 0) {
          const key = getWeekKey();
          const total = parseInt(localStorage.getItem(key)||"0", 10) + elapsed;
          localStorage.setItem(key, total);
          setWeeklyMins(total);
        }
        delete runStart.current[gid];
      }
    }
  }, [uiByGame]);

  // ── App version (for sidebar footer) ─────────────────────────────────────
  const [appVer, setAppVer] = useState("1.0.0");
  useEffect(() => {
    window.rload?.getAppInfo?.().then(i=>{ if(i?.version) setAppVer(i.version); }).catch(()=>{});
  }, []);

  // ── Derived game sets — all CDN logic preserved ───────────────────────────
  const INSTALLED_SET  = new Set([UI.INSTALLED, UI.RUNNING, UI.UPDATE_AVAILABLE, UI.INSTALLED_NO_EXE]);
  const realGames      = games.filter(g => g.gameId !== "smoke");
  const installed      = realGames.filter(g => INSTALLED_SET.has(uiByGame[g.gameId]));
  const withUpdates    = realGames.filter(g => uiByGame[g.gameId] === UI.UPDATE_AVAILABLE);
  const favorited      = realGames.filter(g => favorites.has(g.gameId));
  const activeDownloads= realGames.filter(g => [UI.DOWNLOADING,UI.PAUSED,UI.INSTALLING,UI.UPDATING].includes(uiByGame[g.gameId]));
  const running        = realGames.filter(g => uiByGame[g.gameId] === UI.RUNNING);

  // Continue Playing — prefer: running → last played (localStorage) → first installed
  const lastPlayedId   = localStorage.getItem("rload-last-played");
  const lastPlayedGame = lastPlayedId ? realGames.find(g => g.gameId === lastPlayedId && INSTALLED_SET.has(uiByGame[g.gameId])) : null;
  const heroGame = running[0] || lastPlayedGame || installed[0] || null;
  const heroImg  = heroGame ? (LOCAL_COVERS[heroGame.gameId] || heroGame.thumbnail || heroGame.coverUrl || null) : null;

  // Search base — real games only
  const searchBase = search
    ? realGames.filter(g =>
        (g.title||g.gameId).toLowerCase().includes(search.toLowerCase()) ||
        (g.studio||"").toLowerCase().includes(search.toLowerCase()))
    : realGames;

  // ── Sidebar counts ────────────────────────────────────────────────────────
  const counts = {
    all:       realGames.length,
    installed: installed.length,
    updates:   withUpdates.length,
    favorites: favorited.length,
    downloads: activeDownloads.length,
  };

  // ── Tag-based filters — disabled gracefully if no games carry the tag ─────
  const TAG_FILTERS = [
    { id:"multiplayer", label:"Multiplayer", icon:"👥" },
    { id:"local",       label:"Local Co-op", icon:"🖥" },
    { id:"controller",  label:"Controller",  icon:"🕹" },
    { id:"demo",        label:"Demo",        icon:"🎮" },
  ].map(tf => ({
    ...tf,
    count: realGames.filter(g => g.tags?.some(t => t.toLowerCase().includes(tf.id))).length,
  }));

  // ── Grid games based on sidebar view ─────────────────────────────────────
  const getGridGames = () => {
    const activeTag = sidebarView.startsWith("tag:") ? sidebarView.slice(4) : null;
    if (activeTag)                    return realGames.filter(g => g.tags?.some(t=>t.toLowerCase().includes(activeTag)));
    if (sidebarView==="installed")    return search ? searchBase.filter(g=>INSTALLED_SET.has(uiByGame[g.gameId])) : installed;
    if (sidebarView==="updates")      return withUpdates;
    if (sidebarView==="favorites")    return search ? searchBase.filter(g=>favorites.has(g.gameId)) : favorited;
    if (sidebarView==="recent")       return installed.length ? installed : realGames;
    if (sidebarView==="downloads")    return activeDownloads;
    if (sidebarView==="queue")        return [];
    return searchBase; // "all"
  };
  const gridGames    = getGridGames();
  const selectedGame = selectedGameId ? games.find(g=>g.gameId===selectedGameId) : null;

  // Placeholder slots — visual padding when real library is small (all view only)
  const placeholderSlots = (sidebarView==="all" && !search)
    ? Math.min(Math.max(0, 12 - realGames.length), PLACEHOLDER_GAMES.length)
    : 0;

  // Section label text for the grid header
  const gridTitle = sidebarView==="all"||sidebarView==="recent"  ? "Library"
    : sidebarView==="installed"  ? "Installed Games"
    : sidebarView==="updates"    ? "Updates Available"
    : sidebarView==="favorites"  ? "Favorites"
    : sidebarView==="downloads"  ? "Active Downloads"
    : sidebarView==="queue"      ? "Download Queue"
    : TAG_FILTERS.find(t=>t.id===sidebarView.slice(4))?.label || "Games";

  // ── Featured: prefer real CDN games, pad with FEATURED_PLACEHOLDERS ─────
  const featuredReal = realGames.slice(0, 3);
  const featuredPad  = FEATURED_PLACEHOLDERS.slice(0, Math.max(0, 3 - featuredReal.length));
  const featuredCards = [...featuredReal, ...featuredPad];

  return (
    <div style={{ display:"flex", flex:1, overflow:"hidden", fontFamily:T.fontBody }}>

      {/* ── LEFT SIDEBAR — premium pill style ────────────────────────────── */}
      <div style={{ width:218, flexShrink:0, display:"flex", flexDirection:"column",
        background:`linear-gradient(180deg, #0d0b20 0%, #100e24 100%)`,
        borderRight:`1px solid rgba(255,255,255,0.08)`,
        boxShadow:"2px 0 16px rgba(0,0,0,0.35)",
        overflowY:"auto", overflowX:"hidden" }} className="hide-scrollbar">

        <div style={{ flex:1, padding:"8px 10px 0" }}>

          {/* LIBRARY */}
          <SidebarSectionLabel label="Library"/>
          <SidebarNavItem icon="🎮" label="All Games"       active={sidebarView==="all"}       onClick={()=>{ setSidebarView("all"); setSearch(""); }} badge={counts.all}/>
          <SidebarNavItem icon="📥" label="Installed"       active={sidebarView==="installed"} onClick={()=>{ setSidebarView("installed"); setSearch(""); }} badge={counts.installed}/>
          <SidebarNavItem icon="🔄" label="Updates"         active={sidebarView==="updates"}   onClick={()=>{ setSidebarView("updates"); setSearch(""); }} badge={counts.updates}/>
          <SidebarNavItem icon="⭐" label="Favorites"       active={sidebarView==="favorites"} onClick={()=>{ setSidebarView("favorites"); setSearch(""); }} badge={counts.favorites}/>
          <SidebarNavItem icon="🕐" label="Recently Played" active={sidebarView==="recent"}    onClick={()=>{ setSidebarView("recent"); setSearch(""); }}/>

          {/* DOWNLOADS */}
          <SidebarSectionLabel label="Downloads"/>
          <SidebarNavItem icon="⬇" label="Active Downloads" active={sidebarView==="downloads"} onClick={()=>{ setSidebarView("downloads"); setSearch(""); }} badge={counts.downloads}/>
          <SidebarNavItem icon="☰" label="Queue"             active={sidebarView==="queue"}     onClick={()=>setSidebarView("queue")} disabled={true}/>

          {/* TAGS */}
          <SidebarSectionLabel label="Tags"/>
          {TAG_FILTERS.map(tf=>(
            <SidebarNavItem key={tf.id}
              icon={tf.icon} label={tf.label}
              active={sidebarView===`tag:${tf.id}`}
              onClick={()=>setSidebarView(`tag:${tf.id}`)}
              disabled={tf.count===0}
              badge={tf.count>0?tf.count:null}/>
          ))}

          {/* SYSTEM */}
          <SidebarSectionLabel label="System"/>
          <SidebarNavItem icon="⚙️" label="Settings" active={false} onClick={()=>onTabChange?.("profile")}/>
          <SidebarNavItem icon="💬" label="Support"  active={false} onClick={()=>openExternal("https://rload.be/support")}/>
          <SidebarNavItem icon="🟢" label="Status"   active={false} onClick={()=>openExternal("https://status.rload.be")}/>
        </div>

        {/* Version footer */}
        <div style={{ padding:"12px 14px 16px", flexShrink:0,
          borderTop:"1px solid rgba(255,255,255,0.06)",
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span style={{ fontSize:10.5, color:"rgba(255,255,255,0.22)", fontWeight:500 }}>
            Rload v{appVer}
          </span>
          <span style={{ width:6, height:6, borderRadius:"50%", background:"#22c55e",
            boxShadow:"0 0 6px rgba(34,197,94,0.7)", display:"inline-block" }}/>
        </div>
      </div>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

          {/* Top bar — search + offline notice */}
          <div style={{ padding:"10px 22px", borderBottom:`1px solid rgba(255,255,255,0.07)`,
            flexShrink:0, display:"flex", alignItems:"center", gap:12,
            background:"rgba(255,255,255,0.02)" }}>
            <div style={{ position:"relative", flex:1, maxWidth:400 }}>
              <div style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)",
                color:"rgba(255,255,255,0.28)", pointerEvents:"none", fontSize:13 }}><Icon.Search/></div>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search games…"
                style={{ width:"100%", padding:"8px 14px 8px 36px",
                  background:"rgba(255,255,255,0.05)", backdropFilter:"blur(8px)",
                  border:`1px solid rgba(255,255,255,0.10)`, borderRadius:"0.75rem",
                  color:T.text, fontSize:13, fontFamily:T.fontBody, outline:"none",
                  transition:"border-color 0.15s ease-out" }}
                onFocus={e=>e.target.style.borderColor="rgba(128,74,240,0.5)"}
                onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.10)"}
              />
            </div>
            {!online && (
              <div style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 14px",
                borderRadius:T.radiusPill, background:"rgba(251,146,60,0.08)",
                border:`1px solid ${T.orangeBorder}`, flexShrink:0 }}>
                <Icon.Globe/>
                <span style={{ fontSize:11.5, color:T.orange }}>Offline</span>
              </div>
            )}
          </div>

          {/* ── Scrollable body ───────────────────────────────────────── */}
          <div style={{ flex:1, overflowY:"auto", scrollBehavior:"smooth" }}
            className="hide-scrollbar">

            {/* ═══════════════════════════════════════════════════════
                SECTION 1 — CONTINUE PLAYING (all / recent views)
            ═══════════════════════════════════════════════════════ */}
            {(sidebarView==="all"||sidebarView==="recent") && (
              <div style={{ padding:"20px 22px 0" }}>
                <SectionHeading title={running.length>0 ? "▶ Now Playing" : "Continue Playing"}/>

                {gamesLoading ? (
                  <div className="rl-sk" style={{ height:190, borderRadius:T.radiusLg }}/>
                ) : heroGame ? (
                  <ContinuePlayingHero
                    heroGame={heroGame} heroImg={heroImg}
                    isRunning={uiByGame[heroGame.gameId]===UI.RUNNING}
                    onSelect={()=>onSelectGame(heroGame.gameId===selectedGameId?null:heroGame)}/>
                ) : (
                  <div style={{ height:140, borderRadius:T.radiusLg,
                    border:`1px dashed rgba(255,255,255,0.10)`,
                    background:"rgba(255,255,255,0.02)",
                    display:"flex", flexDirection:"column", alignItems:"center",
                    justifyContent:"center", gap:8 }}>
                    <span style={{ fontSize:22, opacity:0.4 }}>🎮</span>
                    <div style={{ fontSize:13, color:T.textMuted }}>No games installed yet</div>
                    <div style={{ fontSize:11.5, color:T.textDim }}>Install a game from the Library below</div>
                  </div>
                )}
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════
                SECTION 2 — RECENTLY PLAYED (all / recent views)
            ═══════════════════════════════════════════════════════ */}
            {(sidebarView==="all"||sidebarView==="recent") && installed.length>0 && (
              <div style={{ padding:"22px 22px 0" }}>
                <SectionHeading title="Recently Played"/>
                <RecentPlayedRow games={installed} uiByGame={uiByGame}
                  selectedGameId={selectedGameId} onSelectGame={onSelectGame}/>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════
                SECTION 3 — FEATURED ON RLOAD (bento grid, Image #5 style)
                all view only, no search
            ═══════════════════════════════════════════════════════ */}
            {sidebarView==="all" && !search && (
              <div style={{ padding:"22px 22px 0" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                  marginBottom:14 }}>
                  <SectionHeading title="Featured on Rload" noMargin/>
                  <span style={{ fontSize:11, color:"rgba(128,74,240,0.7)", fontWeight:600,
                    letterSpacing:"0.04em" }}>Handpicked</span>
                </div>
                <FeaturedBento
                  cards={featuredCards.slice(0,3)}
                  onSelect={g=>onSelectGame(g.gameId===selectedGameId?null:g)}/>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════
                SECTION 3b — 3D CARD ROW (Image #4 style, all / recent)
                Subtle perspective depth effect — one row only
            ═══════════════════════════════════════════════════════ */}
            {(sidebarView==="all"||sidebarView==="recent") && installed.length>0 && (
              <div style={{ padding:"22px 22px 0" }}>
                <SectionHeading title="Your Games"/>
                <ThreeDRow
                  games={installed}
                  uiByGame={uiByGame}
                  dlByGame={dlByGame}
                  selectedGameId={selectedGameId}
                  onSelectGame={onSelectGame}/>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════
                SECTION 4 — LIBRARY GRID (all views)
            ═══════════════════════════════════════════════════════ */}
            <div style={{ padding:"22px 22px 0" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                marginBottom:14 }}>
                <SectionHeading title={gridTitle} noMargin/>
                {(sidebarView==="all"||sidebarView==="recent") && (
                  <span style={{ fontSize:11, color:T.textDim }}>{realGames.length} games</span>
                )}
              </div>

              {gamesLoading ? (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))", gap:14 }}>
                  {[0,1,2,3,4,5,6,7].map(i=><SkeletonGameCard key={i}/>)}
                </div>
              ) : sidebarView==="queue" ? (
                <div style={{ padding:"48px 0", textAlign:"center", color:T.textDim, fontSize:13 }}>
                  No games queued
                </div>
              ) : gridGames.length===0 ? (
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
                  justifyContent:"center", padding:"52px 0", gap:12 }}>
                  <span style={{ fontSize:28, opacity:0.35 }}>🎮</span>
                  <div style={{ fontSize:14, color:T.textMuted, fontWeight:500 }}>
                    {sidebarView.startsWith("tag:") ? "No games with this tag yet"
                      : search ? `No results for "${search}"`
                      : "No games in this category"}
                  </div>
                </div>
              ) : (
                <div style={{ display:"grid",
                  gridTemplateColumns:selectedGame?"repeat(auto-fill,minmax(138px,1fr))":"repeat(auto-fill,minmax(155px,1fr))",
                  gap:14 }}>
                  {/* Real CDN games — fully functional */}
                  {gridGames.map(g=>(
                    <GameGridCard key={g.gameId} game={g}
                      uiState={uiByGame[g.gameId]||UI.IDLE}
                      dl={dlByGame[g.gameId]}
                      isSelected={selectedGameId===g.gameId}
                      onSelect={gm=>onSelectGame(gm.gameId===selectedGameId?null:gm)}/>
                  ))}
                  {/* Visual placeholder fill — isPlaceholder:true, never enter CDN flows */}
                  {PLACEHOLDER_GAMES.slice(0, placeholderSlots).map(p=>(
                    <PlaceholderCard key={p.id} p={p}/>
                  ))}
                </div>
              )}
            </div>

            {/* ═══════════════════════════════════════════════════════
                FOOTER — consistent with other pages
            ═══════════════════════════════════════════════════════ */}
            <div style={{ margin:"32px 22px 0",
              borderTop:"1px solid rgba(255,255,255,0.06)",
              padding:"20px 0 28px",
              display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <img src="./images/common/rload_mini_logo.png" alt="Rload"
                  style={{ height:20, opacity:0.5 }}
                  onError={e=>e.currentTarget.style.display="none"}/>
                <span style={{ fontSize:11.5, color:"rgba(255,255,255,0.22)", fontWeight:500 }}>
                  Rload Launcher v{appVer}
                </span>
              </div>
              <span style={{ fontSize:11, color:"rgba(255,255,255,0.16)" }}>
                {realGames.length} game{realGames.length!==1?"s":""} in catalog
              </span>
            </div>

          </div>
        </div>

        {/* ── Game detail panel — CDN logic unchanged ───────────────── */}
        {selectedGame && gameDetailProps && (
          <GameDetailPanel game={selectedGame} {...gameDetailProps} onClose={()=>onSelectGame(null)}/>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EventsPage — matches Vercel website layout exactly
// ─────────────────────────────────────────────────────────────────────────────
const TIMEFRAMES = ["all","today","week","month"];
function EventsPage({ onTabChange }) {
  const [search, setSearch]     = useState("");
  const [category, setCategory] = useState("All events");
  const [timeframe, setTimeframe] = useState("all");

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const matchesTimeframe = (ev) => {
    if (timeframe === "all") return true;
    const d = new Date(`${ev.day} ${ev.month} 2026`);
    if (timeframe === "today") return d >= startOfToday && d < new Date(startOfToday.getTime() + 86400000);
    if (timeframe === "week")  return d >= startOfToday && d <= new Date(startOfToday.getTime() + 7*86400000);
    if (timeframe === "month") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && d >= startOfToday;
    return true;
  };

  const filtered = UPCOMING_EVENTS.filter(ev=>{
    if (category!=="All events" && ev.category!==category) return false;
    if (!matchesTimeframe(ev)) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!`${ev.title} ${ev.description||""}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const timeframeLabel = { all:"All", today:"Today", week:"This week", month:"This month" };

  return (
    <div style={{ flex:1, overflowY:"auto", fontFamily:T.fontBody, scrollBehavior:"smooth" }}>

      {/* ── Hero — matching Vercel EventHero ── */}
      <div style={{ position:"relative", overflow:"hidden", minHeight:220, display:"flex", alignItems:"flex-end" }}>
        <img src="./images/unprotected/landing/landing_hero_bg.jpg" alt=""
          style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", objectPosition:"top" }}
          onError={e=>e.currentTarget.style.display="none"}/>
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(90deg, rgba(128,74,240,0.2) 0%, rgba(0,0,0,0) 50%, rgba(38,35,80,0.2) 100%)" }}/>
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(0deg, #221F47 0%, rgba(34,31,71,0.8) 50%, rgba(0,0,0,0) 100%)" }}/>
        <div style={{ position:"relative", zIndex:1, width:"100%", padding:"0 40px 32px", transform:"translateY(15%)" }}>
          <div style={{ fontSize:28, fontWeight:600, color:T.text, fontFamily:T.fontHead, letterSpacing:"-0.4px", marginBottom:18 }}>Game Events Schedule</div>
          <div style={{ position:"relative", maxWidth:400 }}>
            <div style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:T.brand, pointerEvents:"none" }}><Icon.Search/></div>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search"
              style={{ width:"100%", padding:"11px 16px 11px 40px", background:"transparent", border:`1px solid ${T.brand}`, borderRadius:"1rem", color:T.text, fontSize:13, fontFamily:T.fontBody, outline:"none", boxSizing:"border-box" }}/>
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div style={{ padding:"28px 40px 16px" }}>
        {/* Category buttons */}
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:14 }}>
          {["All events","Lives & streams","Tournaments","Games Launches","Creator Events"].map(cat=>{
            const active = category===cat;
            return (
              <button key={cat} onClick={()=>setCategory(cat)}
                style={{ padding:"6px 18px", borderRadius:T.radiusPill, fontSize:12.5, fontWeight:500, cursor:"pointer", fontFamily:T.fontBody, transition:"background 0.18s ease-out, color 0.18s ease-out, border-color 0.18s ease-out, box-shadow 0.18s ease-out", border:"none",
                  background:active ? "#7B58C9" : "#2D2A50",
                  color:"white",
                }}>{cat}</button>
            );
          })}
        </div>
        {/* Timeframe buttons */}
        <div style={{ display:"flex", gap:10 }}>
          {TIMEFRAMES.slice(1).map(tf=>{
            const active = timeframe===tf;
            return (
              <button key={tf} onClick={()=>setTimeframe(tf===timeframe?"all":tf)}
                style={{ padding:"5px 16px", borderRadius:T.radiusPill, fontSize:12, cursor:"pointer", fontFamily:T.fontBody, border:"none",
                  background:active ? "#7B58C9" : "#2D2A50", color:"white",
                }}>{timeframeLabel[tf]}</button>
            );
          })}
        </div>
      </div>

      {/* ── Events list + side image (2-column Vercel layout) ── */}
      <div style={{ padding:"0 40px 32px", display:"grid", gridTemplateColumns:"2fr 1fr", gap:32 }}>
        <div>
          {filtered.length===0 ? (
            <div style={{ textAlign:"center", padding:"48px 0", color:T.textDim, fontSize:13.5 }}>No events match your filters.</div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {filtered.map(ev=><EventCard key={ev.id} ev={ev} showThumbnail={true}/>)}
            </div>
          )}
        </div>
        {/* Side placeholder image */}
        <div style={{ borderRadius:"1rem", overflow:"hidden", background:"url('./images/events/events_placeholder.jpg') no-repeat center/cover", minHeight:400 }}/>
      </div>

      {/* ── Previous events — 3-column grid ── */}
      <div style={{ background:"rgba(255,255,255,0.02)", borderTop:`1px solid ${T.border}`, padding:"40px 40px 48px" }}>
        <div style={{ fontSize:20, fontWeight:700, color:T.text, fontFamily:T.fontHead, marginBottom:24, letterSpacing:"-0.2px" }}>Previous events</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:16 }}>
          {PREVIOUS_EVENTS.map((ev,i)=>{
            const cc = eventCategoryColor(ev.category);
            return (
              <div key={i} style={{ background:"rgba(255,255,255,0.03)", padding:16, borderRadius:"1rem", display:"flex", alignItems:"center", gap:14, color:"#99A1AF" }}>
                <div style={{ minWidth:64, textAlign:"center", flexShrink:0 }}>
                  <div style={{ background:"rgba(255,255,255,0.06)", border:`1px solid ${T.border}`, borderRadius:"1rem", padding:"12px 8px" }}>
                    <div style={{ fontSize:18, fontWeight:700, color:T.text, fontFamily:T.fontHead, lineHeight:1 }}>{ev.day}</div>
                    <div style={{ fontSize:10, color:T.textDim, marginTop:2 }}>{ev.month}</div>
                  </div>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  {ev.category && (
                    <span style={{ fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:T.radiusPill, color:cc.color, background:"rgba(255,255,255,0.06)", border:`1px solid ${T.border}`, display:"inline-block", marginBottom:6 }}>{ev.category}</span>
                  )}
                  <div style={{ fontSize:13, fontWeight:600, color:T.text, marginBottom:4, lineHeight:1.3 }}>{ev.title}</div>
                  {ev.time && (
                    <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:"#878787" }}>
                      <Icon.Calendar/> {ev.time}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AppFooter onTabChange={onTabChange}/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ComingSoonPage — generic placeholder for Streaming / Community
// ─────────────────────────────────────────────────────────────────────────────
function ComingSoonPage({ icon: PageIcon, title, description }) {
  return (
    <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:22, padding:48, fontFamily:T.fontBody }}>
      <div style={{ width:72, height:72, borderRadius:T.radiusLg, background:"linear-gradient(135deg, rgba(128,74,240,0.18) 0%, rgba(68,44,117,0.12) 100%)", border:`1px solid ${T.borderBrand}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <PageIcon/>
      </div>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:24, fontWeight:700, color:T.text, fontFamily:T.fontHead, letterSpacing:"-0.3px", marginBottom:8 }}>{title}</div>
        <div style={{ fontSize:14, color:T.textMuted, maxWidth:380, lineHeight:1.65 }}>{description}</div>
      </div>
      <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"8px 20px", borderRadius:T.radiusPill, background:"rgba(128,74,240,0.12)", border:`1px solid ${T.borderBrand}`, fontSize:12.5, color:T.brandLight, fontWeight:600 }}>
        <span style={{ width:7, height:7, borderRadius:"50%", background:T.brand, display:"inline-block", animation:"rl-dot 1.2s ease-in-out 0s infinite" }}/>
        Coming Soon
      </div>
    </div>
  );
}

function CommunityPage() {
  return (
    <ComingSoonPage
      icon={Icon.Community}
      title="Community"
      description="Connect with other players, join guilds, find teammates, and be part of the Rload gaming community. Social features are coming soon."
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StreamingPage
// ─────────────────────────────────────────────────────────────────────────────
function StreamingPage() {
  return (
    <ComingSoonPage
      icon={Icon.Streaming}
      title="Streaming"
      description="Watch live game streams, tune in to tournaments, and share your own gameplay directly from the launcher. Streaming features are on the way."
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Footer — matches Vercel website Footer exactly
// ─────────────────────────────────────────────────────────────────────────────
function openExternal(url) {
  try { window.rload?.openExternal?.(url); } catch {}
}

function FooterSection({ title, links }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10, minWidth:120 }}>
      <div style={{ fontSize:11, fontWeight:600, color:"white", textTransform:"uppercase", letterSpacing:"0.08em" }}>{title}</div>
      {links.map(item=>(
        <div key={item.label} onClick={item.onClick}
          style={{ fontSize:12, color:"rgba(252,252,252,0.5)", cursor: item.onClick ? "pointer" : "default", transition:"color 0.14s" }}
          onMouseEnter={e=>{ if(item.onClick) e.currentTarget.style.color="white"; }}
          onMouseLeave={e=>e.currentTarget.style.color="rgba(252,252,252,0.5)"}>
          {item.label}
        </div>
      ))}
    </div>
  );
}

// ── Legal modal content ───────────────────────────────────────────────────────
const TERMS_TEXT = `TERMS OF USE — Last updated: 09/01/2026

1. Acceptance of Terms
By accessing or using the Rload platform, you agree to these Terms of Use. If you do not agree, please do not use the service.

2. Description of the Service
Rload is a video game subscription platform providing access to a curated library of third-party games. Rload does not sell individual games and does not claim ownership of the games provided.

3. Accounts
Users must create an account to access the platform. You are responsible for maintaining the confidentiality of your account credentials.

4. Subscriptions and Payments
Rload offers free and paid subscription plans. Free users may see advertisements. Paid users receive ad-free access and additional features. Payments are processed securely by third-party providers such as Stripe.

5. Content and Age Ratings
Some games available on Rload may be subject to age restrictions (e.g. 12+, 16+, 18+). By using Rload, you confirm that you meet the minimum age requirements for the content you access and you comply with applicable age ratings. Rload is not responsible for misuse of age-restricted content.

6. Intellectual Property
All trademarks, logos, and platform content belong to Rload SRL or its partners. Users are granted a limited, non-exclusive right to access content for personal use only.

7. Prohibited Use
You agree not to attempt to bypass security measures, redistribute or resell platform content, or use the service for illegal purposes.

8. Availability and Liability
Rload is provided "as is" and "as available". We do not guarantee uninterrupted access and are not liable for damages arising from service interruptions.

9. Termination
Rload reserves the right to suspend or terminate accounts that violate these Terms.

10. Governing Law
These Terms are governed by Belgian law. Any disputes shall be subject to the jurisdiction of Belgian courts.`;

const PRIVACY_TEXT = `PRIVACY POLICY — Last updated: 09/01/2026

Company: Rload SRL · Rue Albert de Cuyck 24 · Belgium · info@rload.be

1. Introduction
Rload SRL respects your privacy and is committed to protecting your personal data. This Privacy Policy explains how we collect, use, store, and protect your information when you use the Rload platform and website.

2. Data We Collect
• Account information: email address, username, subscription status
• Payment information: handled securely by third-party providers (Stripe). We do not store credit card details.
• Usage data: pages visited, games accessed, session duration
• Technical data: IP address, device type, browser, operating system
• Cookies and advertising identifiers

3. Purpose of Data Processing
Your data is used to provide access to the Rload platform, manage subscriptions and payments, improve platform performance, display advertising for free-tier users, and comply with legal obligations.

4. Advertising and Cookies
Rload may display ads to free users. We use third-party advertising services including Google AdSense, which may use cookies or similar technologies to show relevant ads.

5. Legal Basis (GDPR)
We process personal data based on your consent, the performance of a contract, legal obligations, and legitimate interest.

6. Data Sharing
We may share limited data with trusted third parties: payment providers (Stripe), analytics and advertising providers (Google). These partners process data in compliance with GDPR.

7. Data Retention
We retain personal data only for as long as necessary to fulfill the purposes described or as required by law.

8. Your Rights
Under GDPR, you have the right to access, correct, or delete your data, withdraw consent, object to processing, and request data portability. Send requests to: info@rload.be

9. Data Security
We implement appropriate technical and organizational measures to protect your data against unauthorized access, loss, or misuse.

10. Changes
We may update this Privacy Policy from time to time. Updates will be published on this page.`;

function LegalModal({ title, text, onClose }) {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:99998, background:"rgba(0,0,0,0.75)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", padding:32 }}
      onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={{ background:"#1D1B3E", border:`1px solid ${T.border}`, borderRadius:T.radiusLg, maxWidth:640, width:"100%", maxHeight:"80vh", display:"flex", flexDirection:"column", boxShadow:T.shadowModal }}>
        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 24px", borderBottom:`1px solid ${T.border}` }}>
          <div style={{ fontSize:17, fontWeight:700, color:T.text, fontFamily:T.fontHead }}>{title}</div>
          <div onClick={onClose} style={{ cursor:"pointer", color:T.textMuted, padding:4 }}><Icon.Close/></div>
        </div>
        {/* Body */}
        <div style={{ padding:"24px", overflowY:"auto", flex:1, scrollBehavior:"smooth" }}>
          <pre style={{ fontSize:12.5, color:T.textSub, lineHeight:1.75, fontFamily:T.fontBody, whiteSpace:"pre-wrap", margin:0 }}>{text}</pre>
        </div>
      </div>
    </div>
  );
}

function AppFooter({ onTabChange }) {
  const [emailInput, setEmailInput] = useState("");
  const [showTerms, setShowTerms]   = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const year = new Date().getFullYear();

  // Pre-fill support emails with user ID, version, and OS
  async function openSupportEmail(type) {
    let userId = "Not logged in";
    let version = "Unknown";
    let osInfo  = "Unknown";
    try {
      const session = await window.rload?.auth?.getSession?.();
      if (session?.user) {
        userId = session.user.email || session.user.sub || "Authenticated";
      }
    } catch {}
    try {
      const info = await window.rload?.getAppInfo?.();
      if (info) { version = info.version; osInfo = info.os; }
    } catch {}

    if (type === "help") {
      const body = [
        "User ID:          " + userId,
        "Launcher Version: " + version,
        "Operating System: " + osInfo,
        "",
        "Issue description:",
        "",
        "",
      ].join("\n");
      openExternal(
        "mailto:info@rload.be" +
        "?subject=" + encodeURIComponent("Support Request — Rload Launcher") +
        "&body="    + encodeURIComponent(body)
      );
    } else {
      const body = [
        "User ID:          " + userId,
        "Launcher Version: " + version,
        "Operating System: " + osInfo,
        "",
        "Error message:",
        "",
        "",
        "Steps to reproduce:",
        "",
        "1.",
        "2.",
        "3.",
      ].join("\n");
      openExternal(
        "mailto:info@rload.be" +
        "?subject=" + encodeURIComponent("Bug Report — Rload Launcher") +
        "&body="    + encodeURIComponent(body)
      );
    }
  }

  const socials = [
    { icon:"ig", title:"Instagram @rload.hq", url:"https://www.instagram.com/rload.hq" },
    { icon:"yt", title:"YouTube",             url:"https://www.youtube.com/@rload" },
    { icon:"dc", title:"Discord",             url:"https://discord.gg/rload" },
    { icon:"tt", title:"TikTok",              url:"https://www.tiktok.com/@rload" },
  ];

  const SocialIcon = ({ icon }) => {
    if (icon==="ig") return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>;
    if (icon==="yt") return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>;
    if (icon==="dc") return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z"/></svg>;
    return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.67a8.18 8.18 0 004.77 1.52V6.71a4.85 4.85 0 01-1-.02z"/></svg>;
  };

  return (
    <>
      {showTerms   && <LegalModal title="Terms & Conditions" text={TERMS_TEXT}   onClose={()=>setShowTerms(false)}/>}
      {showPrivacy && <LegalModal title="Privacy Policy"     text={PRIVACY_TEXT} onClose={()=>setShowPrivacy(false)}/>}

      <div style={{ background:"#1D1B3E", borderTop:"0.5px solid rgba(255,255,255,0.12)", padding:"40px 40px 20px", fontFamily:T.fontBody, color:"rgba(252,252,252,0.5)", flexShrink:0 }}>
        {/* Top row */}
        <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:40, marginBottom:40 }}>
          {/* Brand */}
          <div style={{ display:"flex", flexDirection:"column", gap:14, maxWidth:220 }}>
            <img src="./images/common/Logo-couleur.svg" alt="Rload" style={{ height:22, objectFit:"contain", alignSelf:"flex-start", filter:"brightness(0) invert(1)" }} onError={e=>e.currentTarget.style.display="none"}/>
            <div style={{ fontSize:12, lineHeight:1.65 }}>Curated indie games, exclusive perks, and a platform built for indie fans.</div>
            <div style={{ display:"flex", gap:10 }}>
              {socials.map(s=>(
                <div key={s.title} title={s.title} onClick={()=>openExternal(s.url)}
                  style={{ width:30, height:30, borderRadius:"50%", background:"rgba(255,255,255,0.08)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"rgba(252,252,252,0.5)", transition:"background 0.18s ease-out, color 0.18s ease-out, border-color 0.18s ease-out, box-shadow 0.18s ease-out" }}
                  onMouseEnter={e=>{ e.currentTarget.style.color="white"; e.currentTarget.style.background="rgba(128,74,240,0.25)"; }}
                  onMouseLeave={e=>{ e.currentTarget.style.color="rgba(252,252,252,0.5)"; e.currentTarget.style.background="rgba(255,255,255,0.08)"; }}>
                  <SocialIcon icon={s.icon}/>
                </div>
              ))}
            </div>
          </div>

          {/* Links grid */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4, auto)", gap:40 }}>
            <FooterSection title="Platform" links={[
              {label:"Home",      onClick:()=>onTabChange?.("home")},
              {label:"Games",     onClick:()=>onTabChange?.("games")},
              {label:"Events",    onClick:()=>onTabChange?.("events")},
            ]}/>
            <FooterSection title="Developers" links={[
              {label:"Developer Portal", onClick:()=>openExternal("https://rload.be/dev")},
              {label:"About Rload"},
              {label:"Submit a Game",    onClick:()=>openExternal("mailto:info@rload.be?subject=Game%20Submission")},
            ]}/>
            <FooterSection title="Support" links={[
              {label:"Contact",         onClick:()=>openExternal("mailto:info@rload.be")},
              {label:"Help Center",     onClick:()=>openSupportEmail("help")},
              {label:"Report an Issue", onClick:()=>openSupportEmail("bug")},
            ]}/>
            <FooterSection title="Legal" links={[
              {label:"Terms & Conditions", onClick:()=>setShowTerms(true)},
              {label:"Privacy Policy",     onClick:()=>setShowPrivacy(true)},
            ]}/>
          </div>

          {/* Newsletter */}
          <div style={{ flex:1, minWidth:240, maxWidth:360 }}>
            <div style={{ fontSize:12, color:"white", fontWeight:500, marginBottom:10, lineHeight:1.5 }}>Get new releases, weekly quests, and exclusive drops.</div>
            <div style={{ display:"flex", gap:0 }}>
              <input value={emailInput} onChange={e=>setEmailInput(e.target.value)} placeholder="Enter your email"
                style={{ flex:1, padding:"12px 16px", background:"transparent", border:`1px solid ${T.brand}`, borderRight:"none", borderRadius:"0.85rem 0 0 0.85rem", color:"white", fontSize:12, fontFamily:T.fontBody, outline:"none" }}/>
              <button onClick={()=>{ if(emailInput) openExternal(`mailto:info@rload.be?subject=Newsletter&body=${encodeURIComponent(emailInput)}`); }}
                style={{ padding:"12px 18px", background:T.brand, border:`1px solid ${T.brand}`, borderRadius:"0 0.85rem 0.85rem 0", color:"white", fontSize:12, cursor:"pointer", fontFamily:T.fontBody, fontWeight:500 }}>
                Subscribe
              </button>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height:1, background:"rgba(255,255,255,0.12)", marginBottom:16 }}/>

        {/* Bottom bar */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8, fontSize:11 }}>
          <div>© {year} Rload SRL · info@rload.be · Belgium</div>
          <div style={{ display:"flex", gap:16 }}>
            <span style={{ cursor:"pointer" }} onClick={()=>setShowTerms(true)}
              onMouseEnter={e=>e.currentTarget.style.color="white"} onMouseLeave={e=>e.currentTarget.style.color="rgba(252,252,252,0.5)"}>Terms</span>
            <span style={{ cursor:"pointer" }} onClick={()=>setShowPrivacy(true)}
              onMouseEnter={e=>e.currentTarget.style.color="white"} onMouseLeave={e=>e.currentTarget.style.color="rgba(252,252,252,0.5)"}>Privacy</span>
          </div>
        </div>
      </div>
    </>
  );
}

// AboutPage — content mirrored from Vercel website About page
// ─────────────────────────────────────────────────────────────────────────────
function AboutPage({ onTabChange }) {
  const [heroErr, setHeroErr] = useState(false);
  const cards = [
    {
      imageUrl: "./images/unprotected/about/about_card_1.png",
      title: "Discover Indie Games Like Never Before",
      description: "Rload is a dedicated launcher and marketplace built around one idea: putting indie games front and centre. Unlike traditional stores where indie titles get buried under blockbuster releases, every game on Rload is curated for quality and creativity. You browse by genre, mood, or community recommendation — not by marketing budget. Games update automatically via our global CDN, and your entire library is accessible in one click. Whether you're a casual player or a hardcore collector, Rload surfaces titles you'll actually care about.",
      reverse: false,
    },
    {
      imageUrl: "./images/unprotected/about/about_card_2.png",
      title: "Showcase Your Game to the Right Audience",
      description: "Publishing on Rload means reaching players who specifically chose a platform for indie games — not stumbling across your title in a sea of AAA titles. Your game gets a dedicated store page with full media support: trailer, screenshots, devlog, and changelogs. We surface your game in category spotlights, newsletter features, and event pages. You retain 100% creative control and receive transparent analytics: installs, session times, player retention, and region breakdowns. No exclusivity lock-in, no hidden fees — just a fair revenue split and a community that respects the craft.",
      reverse: true,
    },
  ];

  const onboardingSteps = [
    {
      step:"01",
      icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
      title:"Create Developer Account",
      desc:"Register at rload.be/dev. Verify your identity, create your studio profile, and accept the developer agreement. Takes under 5 minutes. You'll immediately get access to the developer dashboard and publishing tools.",
      bullets:["Verify identity & studio name","Set up payout method","Access dev dashboard"],
    },
    {
      step:"02",
      icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>,
      title:"Upload Your Game",
      desc:"Use the Rload CLI or web portal to upload your game build as a ZIP. Add cover art, screenshots, a trailer URL, and a description. Specify supported platforms, minimum specs, and tag your genres.",
      bullets:["Upload build via CLI or portal","Add assets: cover, screenshots, trailer","Configure platforms & system requirements"],
    },
    {
      step:"03",
      icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>,
      title:"Review & Validation",
      desc:"Our automated pipeline scans for malware, validates the executable, and checks compatibility. A human reviewer then confirms the catalogue entry meets quality standards. Average review time: 48–72 hours.",
      bullets:["Automated malware & exe scan","Compatibility check across Windows versions","Human quality review"],
    },
    {
      step:"04",
      icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
      title:"Publish & Distribute",
      desc:"Once approved, click Publish. Your game goes live on the Rload CDN, is indexed in search, and appears in new-release feeds. Track downloads, session analytics, and revenue in your dashboard from day one.",
      bullets:["Instant CDN distribution","Indexed in search & new-release feeds","Live analytics: installs, sessions, revenue"],
    },
  ];

  return (
    <div style={{ flex:1, overflowY:"auto", fontFamily:T.fontBody, display:"flex", flexDirection:"column" }}>
      {/* Hero */}
      <div style={{ position:"relative", width:"100%", paddingTop:"30%", background:"linear-gradient(160deg, #1a1438 0%, #120f2e 100%)", overflow:"hidden", flexShrink:0 }}>
        {!heroErr && (
          <img src="./images/unprotected/about/about_hero.png" alt="About Rload"
            style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", objectPosition:"top" }}
            onError={()=>setHeroErr(true)}/>
        )}
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(90deg, rgba(128,74,240,0.2) 0%, rgba(0,0,0,0) 50%, rgba(38,35,80,0.2) 100%)" }}/>
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(0deg, rgba(14,12,31,1) 0%, rgba(14,12,31,0.7) 50%, rgba(0,0,0,0) 100%)" }}/>
        <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"0 40px 32px" }}>
          <div style={{ fontSize:28, fontWeight:800, color:T.text, fontFamily:T.fontHead, letterSpacing:"-0.5px" }}>About Rload</div>
          <div style={{ fontSize:14, color:T.textMuted, marginTop:6, maxWidth:440 }}>The indie game platform built for creators and players alike.</div>
        </div>
      </div>

      {/* Cards */}
      <div style={{ padding:"32px 40px", display:"flex", flexDirection:"column", gap:36, flex:1 }}>
        {cards.map((card, i) => (
          <div key={i} style={{ display:"flex", gap:32, alignItems:"center", flexDirection: card.reverse ? "row-reverse" : "row" }}>
            <div style={{ flex:"0 0 42%", borderRadius:T.radiusLg, overflow:"hidden", border:`1px solid ${T.border}` }}>
              <img src={card.imageUrl} alt={card.title} style={{ width:"100%", display:"block", objectFit:"cover" }} onError={e=>e.currentTarget.style.opacity="0"}/>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:20, fontWeight:700, color:T.text, fontFamily:T.fontHead, letterSpacing:"-0.3px", lineHeight:1.25, marginBottom:12 }}>{card.title}</div>
              <div style={{ fontSize:13.5, color:T.textSub, lineHeight:1.72 }}>{card.description}</div>
            </div>
          </div>
        ))}

        {/* Why Developers Choose Rload — Testimonials */}
        <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:32 }}>
          <div style={{ fontSize:20, fontWeight:700, color:T.text, fontFamily:T.fontHead, marginBottom:24, letterSpacing:"-0.2px" }}>Why Devs Choose Rload</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:20 }}>
            {[
              { avatar:"./images/unprotected/about/testifier1.jpg", name:"Daniel Y.", role:"Narrative game developer", quote:"Getting raw, honest feedback from real players helped me improve my game way faster than posting it on social media." },
              { avatar:"./images/unprotected/about/testifier2.jpg", name:"Chloe R.",  role:"Former AAA dev turned indie", quote:"This is the only place where I felt my game was understood. Everyone here truly values indie creativity." },
              { avatar:"./images/unprotected/about/testifier3.jpg", name:"Aria K.",   role:"Experimental game designer", quote:"Unlike other marketplaces, here I felt totally free to experiment. No algorithms blocking me, just passionate players." },
            ].map(t=>(
              <div key={t.name} style={{ padding:"24px 22px", borderRadius:"1rem", background:"rgba(255,255,255,0.04)", border:`1px solid ${T.border}` }}>
                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
                  <img src={t.avatar} alt={t.name} style={{ width:44, height:44, borderRadius:"50%", objectFit:"cover", border:`2px solid ${T.borderBrand}` }} onError={e=>e.currentTarget.style.display="none"}/>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:T.text, fontFamily:T.fontHead }}>{t.name}</div>
                    <div style={{ fontSize:11.5, color:T.textDim, marginTop:2 }}>{t.role}</div>
                  </div>
                </div>
                <div style={{ fontSize:12, color:"#878787" }}>{"⭐⭐⭐⭐⭐"}</div>
                <div style={{ fontSize:13, color:T.textSub, lineHeight:1.65, marginTop:10, fontStyle:"italic" }}>"{t.quote}"</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Developer onboarding — 3-card layout ── */}
        <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:40 }}>
          <div style={{ textAlign:"center", marginBottom:36 }}>
            <div style={{ fontSize:22, fontWeight:800, color:T.text, fontFamily:T.fontHead, letterSpacing:"-0.3px", marginBottom:10 }}>
              Are You a Solo Developer or a Studio?
            </div>
            <div style={{ fontSize:13.5, color:T.textMuted, lineHeight:1.6, maxWidth:480, margin:"0 auto" }}>
              Join Rload and bring your game to players who are ready to discover something new.
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:20 }}>
            {[
              {
                accentColor:"#7B9CFF",
                accentBg:"rgba(123,156,255,0.10)",
                accentBorder:"rgba(123,156,255,0.22)",
                title:"Submit your game",
                desc:"Tell us about your project, gameplay, screenshots, and platform details.",
                icon:(
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 16 12 12 8 16"/>
                    <line x1="12" y1="12" x2="12" y2="21"/>
                    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
                  </svg>
                ),
              },
              {
                accentColor:"#A78BFA",
                accentBg:"rgba(167,139,250,0.10)",
                accentBorder:"rgba(167,139,250,0.22)",
                title:"Get onboarded",
                desc:"We review your game and help you prepare everything for launch.",
                icon:(
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 11l3 3L22 4"/>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                  </svg>
                ),
              },
              {
                accentColor:"#34D399",
                accentBg:"rgba(52,211,153,0.10)",
                accentBorder:"rgba(52,211,153,0.22)",
                title:"Launch to players",
                desc:"Your game goes live and reaches players across the Rload platform.",
                icon:(
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
                    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
                    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
                    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
                  </svg>
                ),
              },
            ].map(card => (
              <div key={card.title} style={{
                background:"rgba(255,255,255,0.03)",
                borderRadius:T.radiusLg,
                padding:"32px 28px",
                display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center",
                border:`1px solid ${card.accentBorder}`,
              }}>
                {/* Icon container */}
                <div style={{
                  width:60, height:60, borderRadius:"0.9rem",
                  background:card.accentBg,
                  border:`1px solid ${card.accentBorder}`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  color:card.accentColor, marginBottom:20, flexShrink:0,
                }}>{card.icon}</div>
                {/* Title */}
                <div style={{ fontSize:15.5, fontWeight:700, color:T.text, fontFamily:T.fontHead, marginBottom:10, letterSpacing:"-0.2px" }}>
                  {card.title}
                </div>
                {/* Description */}
                <div style={{ fontSize:13, color:T.textMuted, lineHeight:1.75 }}>
                  {card.desc}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Boost Visibility section — full character visible, side-by-side layout */}
        <div style={{ borderRadius:T.radiusLg, overflow:"hidden", border:`1px solid ${T.borderBrand}`,
          background:"linear-gradient(135deg, rgba(128,74,240,0.12) 0%, rgba(14,12,31,0.95) 100%)",
          display:"flex", alignItems:"stretch", minHeight:220 }}>
          {/* Image side — full height, no cropping */}
          <div style={{ flex:"0 0 38%", position:"relative", overflow:"hidden" }}>
            <img src="./images/unprotected/about/creator_desk.jpg" alt="Creator"
              style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"center center",
                display:"block" }}
              onError={e=>e.currentTarget.style.display="none"}/>
            <div style={{ position:"absolute", inset:0,
              background:"linear-gradient(90deg, rgba(14,12,31,0) 60%, rgba(14,12,31,0.95) 100%)" }}/>
          </div>
          {/* Text side */}
          <div style={{ flex:1, padding:"32px 36px", display:"flex", flexDirection:"column", justifyContent:"center" }}>
            <div style={{ fontSize:22, fontWeight:800, color:T.text, fontFamily:T.fontHead,
              marginBottom:12, letterSpacing:"-0.3px", lineHeight:1.25 }}>
              Boost Your Game's Visibility
            </div>
            <div style={{ fontSize:13.5, color:T.textSub, lineHeight:1.75, maxWidth:440, marginBottom:20 }}>
              Games on Rload benefit from active promotion across the platform. Featured placements rotate weekly, giving every title its moment in the spotlight — not just the titles with the biggest marketing spend. Your game can appear in the home page hero, the newsletter sent to thousands of subscribers, and curated event showcases.
            </div>
            <div style={{ display:"flex", gap:20, flexWrap:"wrap" }}>
              {[
                { icon:"📢", label:"Featured placements" },
                { icon:"📬", label:"Newsletter features"  },
                { icon:"🎯", label:"Category spotlights"  },
              ].map(({icon,label})=>(
                <div key={label} style={{ display:"flex", alignItems:"center", gap:7,
                  padding:"6px 14px", borderRadius:T.radiusPill,
                  background:"rgba(128,74,240,0.12)", border:`1px solid ${T.borderBrand}` }}>
                  <span style={{ fontSize:14 }}>{icon}</span>
                  <span style={{ fontSize:12, fontWeight:500, color:T.brandLight }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer — identical to Vercel */}
      <AppFooter onTabChange={onTabChange}/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ProfilePage — website-style with sub-navigation
// ─────────────────────────────────────────────────────────────────────────────
function SettingsRow({ icon: RowIcon, label, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ display:"flex", alignItems:"center", gap:13, padding:"13px 16px", cursor:"pointer",
        background:hov?"rgba(255,255,255,0.04)":"transparent", borderRadius:T.radiusSm, transition:"background 0.18s ease-out, color 0.18s ease-out, border-color 0.18s ease-out, box-shadow 0.18s ease-out" }}>
      <div style={{ width:32, height:32, borderRadius:"0.6rem", background:"rgba(255,255,255,0.06)", border:`1px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"center", color:T.textMuted, flexShrink:0 }}>
        <RowIcon/>
      </div>
      <span style={{ flex:1, fontSize:13.5, fontWeight:500, color:T.text, fontFamily:T.fontBody }}>{label}</span>
      <span style={{ color:T.textDim }}><Icon.ChevronRight/></span>
    </div>
  );
}

function SubPageShell({ title, onBack, children }) {
  return (
    <div style={{ flex:1, overflowY:"auto", fontFamily:T.fontBody, scrollBehavior:"smooth" }}>
      <div style={{ padding:"20px 28px 0", display:"flex", alignItems:"center", gap:12, borderBottom:`1px solid ${T.border}`, paddingBottom:16 }}>
        <div onClick={onBack} style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", color:T.textMuted, fontSize:13, padding:"5px 10px", borderRadius:T.radiusSm, background:"rgba(255,255,255,0.04)", border:`1px solid ${T.border}`, userSelect:"none" }}>
          <Icon.ChevronLeft/> Back
        </div>
        <div style={{ fontSize:17, fontWeight:700, color:T.text, fontFamily:T.fontHead, letterSpacing:"-0.2px" }}>{title}</div>
      </div>
      <div style={{ padding:"24px 28px" }}>{children}</div>
    </div>
  );
}

function AccountDetailsPage({ user, onBack }) {
  const field = (label, value) => (
    <div style={{ marginBottom:16 }}>
      <div style={{ fontSize:11.5, fontWeight:600, color:T.textMuted, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.07em" }}>{label}</div>
      <div style={{ padding:"11px 14px", borderRadius:T.radiusSm, background:"rgba(255,255,255,0.04)", border:`1px solid ${T.border}`, fontSize:13.5, color:T.text }}>{value||"—"}</div>
    </div>
  );
  return (
    <SubPageShell title="Account Details" onBack={onBack}>
      <div style={{ maxWidth:420 }}>
        {field("Username", user?.name||user?.email?.split("@")[0]||"User")}
        {field("Email", user?.email)}
        {field("User ID", user?.sub?.split("|").pop()?.substring(0,16))}
        {field("Auth Provider", user?.sub?.includes("google")?"Google":user?.sub?.includes("auth0")?"Email / Password":"Auth0")}
        {field("Launcher Version", "v1.0.0")}
      </div>
    </SubPageShell>
  );
}

function NotifToggle({ on, setOn }) {
  return (
    <div onClick={()=>setOn(!on)} style={{ width:40, height:22, borderRadius:11, background:on?T.brand:"rgba(255,255,255,0.12)", cursor:"pointer", position:"relative", transition:"background 0.18s", flexShrink:0 }}>
      <div style={{ position:"absolute", top:3, left:on?20:3, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left 0.18s", boxShadow:"0 1px 4px rgba(0,0,0,0.3)" }}/>
    </div>
  );
}
function NotifRow({ label, desc, on, setOn }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 0", borderBottom:`1px solid ${T.border}` }}>
      <div>
        <div style={{ fontSize:13.5, fontWeight:500, color:T.text, marginBottom:2 }}>{label}</div>
        <div style={{ fontSize:11.5, color:T.textDim }}>{desc}</div>
      </div>
      <NotifToggle on={on} setOn={setOn}/>
    </div>
  );
}
function NotificationsPage({ onBack }) {
  const [push, setPush]   = useState(true);
  const [email, setEmail] = useState(false);
  const [newRel, setNewRel] = useState(true);
  return (
    <SubPageShell title="Notifications" onBack={onBack}>
      <div style={{ maxWidth:420 }}>
        <NotifRow label="Push notifications"  desc="Receive desktop alerts from Rload"  on={push}   setOn={setPush}/>
        <NotifRow label="Email notifications" desc="Get updates via email"               on={email}  setOn={setEmail}/>
        <NotifRow label="New releases"        desc="Notify me when new games are added"  on={newRel} setOn={setNewRel}/>
      </div>
    </SubPageShell>
  );
}

function LanguagePage({ lang, changeLang, onBack }) {
  const LANGS_LIST = [
    { code:"en", label:"English",    native:"English"    },
    { code:"fr", label:"French",     native:"Français"   },
    { code:"nl", label:"Dutch",      native:"Nederlands" },
  ];
  return (
    <SubPageShell title="Language" onBack={onBack}>
      <div style={{ maxWidth:380 }}>
        <div style={{ fontSize:12, color:T.textDim, marginBottom:16 }}>Choose your preferred language for the launcher interface.</div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {LANGS_LIST.map(l => {
            const active = lang === l.code;
            return (
              <div key={l.code} onClick={()=>changeLang(l.code)}
                style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 16px", borderRadius:T.radius, cursor:"pointer",
                  background:active?"rgba(128,74,240,0.12)":"rgba(255,255,255,0.03)",
                  border:`1px solid ${active?T.brand:T.border}`, transition:"background 0.18s ease-out, color 0.18s ease-out, border-color 0.18s ease-out, box-shadow 0.18s ease-out" }}>
                <div>
                  <div style={{ fontSize:13.5, fontWeight:600, color:T.text }}>{l.native}</div>
                  <div style={{ fontSize:11.5, color:T.textDim }}>{l.label}</div>
                </div>
                {active && <div style={{ width:18, height:18, borderRadius:"50%", background:T.brand, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>}
              </div>
            );
          })}
        </div>
      </div>
    </SubPageShell>
  );
}

function PrivacyPage({ onBack }) {
  return (
    <SubPageShell title="Privacy & Security" onBack={onBack}>
      <div style={{ maxWidth:420 }}>
        <div style={{ padding:"18px 16px", borderRadius:T.radius, background:"rgba(255,255,255,0.03)", border:`1px solid ${T.border}`, marginBottom:14 }}>
          <div style={{ fontSize:13.5, fontWeight:600, color:T.text, marginBottom:8 }}>Data & Privacy</div>
          <div style={{ fontSize:12.5, color:T.textMuted, lineHeight:1.65 }}>Rload collects minimal data required to operate the launcher. Your game install paths and preferences are stored locally on your device only. Authentication is handled securely via Auth0.</div>
        </div>
        <div style={{ padding:"18px 16px", borderRadius:T.radius, background:"rgba(255,255,255,0.03)", border:`1px solid ${T.border}` }}>
          <div style={{ fontSize:13.5, fontWeight:600, color:T.text, marginBottom:8 }}>Security</div>
          <div style={{ fontSize:12.5, color:T.textMuted, lineHeight:1.65 }}>All connections to Rload services use HTTPS. Tokens are stored securely using the OS credential store. You can sign out at any time to revoke access.</div>
        </div>
      </div>
    </SubPageShell>
  );
}

function InfoField({ label, value }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>{label}</div>
      <div style={{ padding: "9px 12px", borderRadius: T.radiusSm, background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, fontSize: 12.5, color: T.text, fontFamily: T.fontBody }}>{value || "—"}</div>
    </div>
  );
}
function InfoActionBtn({ label, onClick, color, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ flex: "1 1 auto", padding: "10px 14px", borderRadius: T.radiusSm, background: `${color}18`, border: `1px solid ${color}55`, color, fontSize: 12, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1, fontFamily: T.fontBody, whiteSpace: "nowrap" }}>
      {label}
    </button>
  );
}
function LauncherInfoPage({ onBack }) {
  const [info, setInfo]         = useState(null);
  const [copied, setCopied]     = useState(false);
  const [checking, setChecking] = useState(false);

  const fetchInfo = useCallback(async () => {
    try {
      const diag = await window.rload?.updater?.getDiagnostics?.();
      if (diag && !diag.error) setInfo(diag);
    } catch {}
  }, []);

  useEffect(() => { fetchInfo(); }, [fetchInfo]);

  // Human-readable OS label derived from user agent (no sensitive data)
  const osLabel = (() => {
    try {
      const m = navigator.userAgent.match(/Windows NT (\d+\.\d+)/);
      if (m) {
        const v = parseFloat(m[1]);
        if (v >= 10) return "Windows 10 / 11";
        if (v >= 6.3) return "Windows 8.1";
        if (v >= 6.2) return "Windows 8";
        return "Windows";
      }
    } catch {}
    return "Windows";
  })();

  const STATUS_LABEL = {
    idle:        "Up to date",
    available:   "Update available",
    downloading: "Downloading…",
    downloaded:  "Ready to install",
    checking:    "Checking…",
    error:       "Error",
  };
  const STATUS_COLOR = {
    idle:"#22c55e", available:"#fb923c", downloading:"#60a5fa",
    downloaded:"#22c55e", checking:"#c084fc", error:"#f87171",
  };

  const copySupportInfo = () => {
    if (!info) return;
    const lines = [
      `Rload Support Info`,
      `──────────────────────────────────`,
      `Launcher version:          v${info.currentVersion ?? "—"}`,
      `Latest available version:  ${info.availableVersion ? `v${info.availableVersion}` : "Up to date"}`,
      `Update status:             ${STATUS_LABEL[info.updateStatus] ?? info.updateStatus ?? "—"}`,
      `Last update check:         ${info.lastCheckedAt ? new Date(info.lastCheckedAt).toLocaleString() : "Not yet"}`,
      `Platform:                  Windows`,
      `Installation type:         Standard Windows installer`,
      `OS version:                ${osLabel}`,
    ];
    navigator.clipboard.writeText(lines.join("\n"))
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2400); })
      .catch(() => {});
  };

  const checkForUpdates = async () => {
    setChecking(true);
    try { await window.rload?.updater?.check?.(); await fetchInfo(); } catch {}
    setChecking(false);
  };

  const statusKey  = info?.updateStatus ?? "idle";
  const statusColor = STATUS_COLOR[statusKey] || T.textMuted;
  const statusLabel = STATUS_LABEL[statusKey] || statusKey;

  return (
    <SubPageShell title="Launcher Information" onBack={onBack}>
      <div style={{ maxWidth: 420 }}>
        {/* Primary actions */}
        <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          <InfoActionBtn label={checking ? "Checking…" : "Check for Updates"} onClick={checkForUpdates} color={T.brand} disabled={checking}/>
          <InfoActionBtn label={copied ? "Copied!" : "Copy Support Info"} onClick={copySupportInfo} color={copied ? T.green : T.textSub}/>
        </div>
        {/* Secondary action */}
        <div style={{ marginBottom: 24 }}>
          <InfoActionBtn label="Open Logs Folder" onClick={() => window.rload?.app?.openLogs?.()} color={T.textMuted}/>
        </div>

        {info ? (
          <>
            <InfoField label="Launcher Version"          value={`v${info.currentVersion}`}/>
            <InfoField label="Latest Available Version"  value={info.availableVersion ? `v${info.availableVersion}` : "Up to date"}/>

            {/* Status row with dot */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Update Status</div>
              <div style={{ padding: "9px 12px", borderRadius: T.radiusSm, background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor, flexShrink: 0 }}/>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: statusColor }}>{statusLabel}</span>
              </div>
            </div>

            <InfoField label="Last Update Check"  value={info.lastCheckedAt ? new Date(info.lastCheckedAt).toLocaleString() : "Not yet"}/>
            <InfoField label="Installation Type"  value="Standard Windows installer"/>
            <InfoField label="Platform"           value={`Windows · ${osLabel}`}/>
          </>
        ) : (
          <div style={{ padding: 32, textAlign: "center", color: T.textDim, fontSize: 13 }}>Loading…</div>
        )}
      </div>
    </SubPageShell>
  );
}

function ProfilePage({ user, authBusy, onLogout, games, uiByGame, lang, changeLang }) {
  const [subPage, setSubPage] = useState(null);
  const [displayMode, setDisplayMode] = useState("dark");
  // Hooks must run unconditionally on every render — declared before the sub-page early returns below.
  const [profileFavorites] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("rload-favorites")||"[]")); }
    catch { return new Set(); }
  });
  const INSTALLED_SET = new Set([UI.INSTALLED,UI.RUNNING,UI.UPDATE_AVAILABLE,UI.INSTALLED_NO_EXE]);
  const installed = games.filter(g=>INSTALLED_SET.has(uiByGame[g.gameId]||UI.IDLE));
  const t = LANGS[lang] || LANGS.en;

  if (subPage === "account")        return <AccountDetailsPage user={user} onBack={()=>setSubPage(null)}/>;
  if (subPage === "notifications")  return <NotificationsPage onBack={()=>setSubPage(null)}/>;
  if (subPage === "language")       return <LanguagePage lang={lang} changeLang={changeLang} onBack={()=>setSubPage(null)}/>;
  if (subPage === "privacy")        return <PrivacyPage onBack={()=>setSubPage(null)}/>;
  if (subPage === "launcher-info")  return <LauncherInfoPage onBack={()=>setSubPage(null)}/>;

  const username = user?.name || user?.email?.split("@")[0] || "User";
  const userInitial = username[0]?.toUpperCase() || "U";

  const profileWeeklyMins = parseInt(localStorage.getItem(getWeekKey())||"0", 10);
  const overviewStats = [
    { icon:"./images/games/icons/gamepad.png",       label:"Total Games",        value: games.length             },
    { icon:"./images/games/icons/download_icon.png", label:"Installed",          value: installed.length         },
    { icon:"./images/games/icons/noto_star.png",     label:"Favorites",          value: profileFavorites.size    },
    { icon:"./images/games/icons/hourglass.png",     label:"This Week",          value: formatPlaytime(profileWeeklyMins) },
  ];

  const actionTiles = [
    { icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.11"/></svg>, label:"Achievements" },
    { icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>, label:t.favorites||"Favorites" },
    { icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>, label:"Purchase History" },
    { icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>, label:"Help & Support" },
  ];

  return (
    <div style={{ flex:1, overflowY:"auto", fontFamily:T.fontBody, scrollBehavior:"smooth" }}>
      {/* Profile header */}
      <div style={{ background:"linear-gradient(180deg, rgba(128,74,240,0.22) 0%, rgba(128,74,240,0.04) 100%)", borderBottom:`1px solid ${T.border}`, padding:"24px 20px 20px" }}>

        {/* Top row: identity + cog */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:46, height:46, borderRadius:"0.85rem", background:T.brandGrad, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:800, color:"#fff", fontFamily:T.fontHead, boxShadow:T.brandGlow, flexShrink:0 }}>
              {userInitial}
            </div>
            <div>
              <div style={{ fontSize:17, fontWeight:700, color:T.text, fontFamily:T.fontHead, letterSpacing:"-0.2px" }}>{username}</div>
              <div style={{ fontSize:11, color:T.textDim, marginTop:2 }}>Rload Member</div>
            </div>
          </div>
          <div style={{ width:38, height:38, borderRadius:T.radiusSm, background:"rgba(255,255,255,0.06)", border:`1px solid ${T.border}`,
            display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:T.textMuted }}>
            <Icon.Settings/>
          </div>
        </div>

        {/* Overview stats */}
        <div style={{ background:"rgba(128,74,240,0.08)", borderRadius:"0.85rem", border:`1px solid ${T.borderBrand}`, padding:10, marginBottom:14 }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:8 }}>
            {overviewStats.map(({icon,label,value})=>(
              <div key={label} style={{ background:"rgba(128,74,240,0.14)", borderRadius:"0.65rem", border:`1px solid ${T.borderBrand}`, padding:"12px 6px", display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                <img src={icon} alt="" style={{ width:18, height:18 }} onError={e=>e.currentTarget.style.display="none"}/>
                <div style={{ fontSize:9.5, color:T.textSub, textAlign:"center", lineHeight:1.2 }}>{label}</div>
                <div style={{ fontSize:13, fontWeight:700, color:T.text, textAlign:"center" }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 4 action tiles */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {actionTiles.map(({icon,label}) => (
            <div key={label} style={{ padding:"13px 12px", borderRadius:T.radiusSm,
              background:"rgba(255,255,255,0.05)", border:`1px solid ${T.border}`,
              display:"flex", flexDirection:"column", alignItems:"center", gap:8,
              cursor:"pointer", transition:"background 0.18s ease-out, color 0.18s ease-out, border-color 0.18s ease-out, box-shadow 0.18s ease-out" }}
              onMouseEnter={e=>{ e.currentTarget.style.background="rgba(255,255,255,0.08)"; e.currentTarget.style.borderColor=T.borderBrand; }}
              onMouseLeave={e=>{ e.currentTarget.style.background="rgba(255,255,255,0.05)"; e.currentTarget.style.borderColor=T.border; }}>
              <div style={{ width:34, height:34, borderRadius:"0.6rem", background:"rgba(128,74,240,0.15)", border:`1px solid ${T.borderBrand}`, display:"flex", alignItems:"center", justifyContent:"center", color:T.brandLight }}>
                {icon}
              </div>
              <span style={{ fontSize:11.5, fontWeight:500, color:T.text, textAlign:"center" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Settings list */}
      <div style={{ padding:"16px 20px" }}>
        <div style={{ fontSize:11, fontWeight:700, color:T.textMuted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8, paddingLeft:6 }}>{t.settings}</div>
        <div style={{ borderRadius:T.radius, background:T.bgCard, border:`1px solid ${T.border}`, overflow:"hidden" }}>
          <SettingsRow icon={Icon.Profile}   label={t.accountDetails}  onClick={()=>setSubPage("account")}/>
          <div style={{ height:1, background:T.border, margin:"0 16px" }}/>
          <SettingsRow icon={Icon.Bell}      label={t.notifications}   onClick={()=>setSubPage("notifications")}/>
          <div style={{ height:1, background:T.border, margin:"0 16px" }}/>

          {/* Display Mode row (inline toggle, no sub-page) */}
          <div style={{ display:"flex", alignItems:"center", gap:13, padding:"13px 16px" }}>
            <div style={{ width:32, height:32, borderRadius:"0.6rem", background:"rgba(255,255,255,0.06)", border:`1px solid ${T.border}`,
              display:"flex", alignItems:"center", justifyContent:"center", color:T.textMuted, flexShrink:0 }}>
              <Icon.Monitor/>
            </div>
            <span style={{ flex:1, fontSize:13.5, fontWeight:500, color:T.text, fontFamily:T.fontBody }}>Display Mode</span>
            <div style={{ display:"flex", gap:0, background:"rgba(255,255,255,0.06)", borderRadius:"0.5rem", padding:"3px" }}>
              <div onClick={()=>setDisplayMode("light")}
                style={{ padding:"4px 10px", borderRadius:"0.4rem", cursor:"pointer", transition:"background 0.14s",
                  background:displayMode==="light"?T.brand:"transparent",
                  color:displayMode==="light"?"#fff":T.textMuted, fontSize:13 }}>
                ☀
              </div>
              <div onClick={()=>setDisplayMode("dark")}
                style={{ padding:"4px 10px", borderRadius:"0.4rem", cursor:"pointer", transition:"background 0.14s",
                  background:displayMode==="dark"?T.brand:"transparent",
                  color:displayMode==="dark"?"#fff":T.textMuted, fontSize:13 }}>
                🌙
              </div>
            </div>
          </div>

          <div style={{ height:1, background:T.border, margin:"0 16px" }}/>
          <SettingsRow icon={Icon.Globe}     label={t.language}           onClick={()=>setSubPage("language")}/>
          <div style={{ height:1, background:T.border, margin:"0 16px" }}/>
          <SettingsRow icon={Icon.Shield}    label={t.privacy}            onClick={()=>setSubPage("privacy")}/>
          <div style={{ height:1, background:T.border, margin:"0 16px" }}/>
          <SettingsRow icon={Icon.About}     label="Launcher Information" onClick={()=>setSubPage("launcher-info")}/>
        </div>

        {/* Sign out of all devices */}
        <button onClick={onLogout} disabled={authBusy}
          style={{ width:"100%", marginTop:18, padding:"12px 16px", borderRadius:T.radius,
            border:"1px solid rgba(248,113,113,0.25)", background:"rgba(248,113,113,0.07)",
            color:T.red, cursor:authBusy?"not-allowed":"pointer",
            fontSize:13.5, fontWeight:600, fontFamily:T.fontBody, opacity:authBusy?0.6:1,
            display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
          <Icon.Logout/> {authBusy ? t.signingOut : t.signOut}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LauncherGames — main component (all state/logic unchanged)
// ─────────────────────────────────────────────────────────────────────────────
export default function LauncherGames() {
  const [authSession, setAuthSession]                       = useState(undefined);
  const [authBusy, setAuthBusy]                             = useState(false);
  const [authError, setAuthError]                           = useState(null);
  const [subscriptionStatus, setSubscriptionStatus]         = useState(null);
  const [games, setGames]                                   = useState([]);
  const [gamesLoading, setGamesLoading]                     = useState(true);
  const [catalogSource, setCatalogSource]                   = useState(null);
  const [uiByGame, setUiByGame]                             = useState({});
  const [exeByGame, setExeByGame]                           = useState({});
  const [installedVersionByGame, setInstalledVersionByGame] = useState({});
  const [dlByGame, setDlByGame]                             = useState({});
  const [dlIdByGame, setDlIdByGame]                         = useState({});
  const [errByGame, setErrByGame]                           = useState({});
  const [busyByGame, setBusyByGame]                         = useState({});
  const [activeTab, setActiveTab]                           = useState("home");
  const [selectedGameId, setSelectedGameId]                 = useState(null);
  const [prevGameTab, setPrevGameTab]                       = useState("home");
  const [launchingGame, setLaunchingGame]                   = useState(null);
  const [lang, setLang]                                     = useState(() => localStorage.getItem("rload-lang") || "en");
  const [demoMode, setDemoMode] = useState(false); // safe default: gates enforced until IPC responds
  const unsubRef    = useRef(null);
  const unsubRunRef = useRef(null);

  // Fetch demoMode from main process — RLOAD_DEMO_MODE env var is the single source of truth
  useEffect(() => {
    window.rload?.app?.getConfig?.()
      .then(c => { if (c?.demoMode) setDemoMode(true); })
      .catch(() => {}); // stays false — subscription gates enforced on error
  }, []);

  const changeLang = useCallback((l) => {
    localStorage.setItem("rload-lang", l);
    setLang(l);
    try { window.rload?.settings?.setLanguage?.(l); } catch {}
  }, []);

  // Derived translations — re-computed on every lang change (cheap object lookup)
  const t = LANGS[lang] || LANGS.en;

  // Load persisted language from settings.json (written by installer or Settings page)
  useEffect(() => {
    (async () => {
      try {
        const saved = await window.rload?.settings?.getLanguage?.();
        if (saved && ["en","fr","nl"].includes(saved)) {
          setLang(saved);
          localStorage.setItem("rload-lang", saved);
        }
      } catch {}
    })();
  }, []);

  // handleTabChange MUST be declared before the auth gate (Rules of Hooks)
  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    if (tab !== "games") setSelectedGameId(null);
  }, []);

  const desktop = rloadAvailable();

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    getSession().then(s => {
      if (!alive) return;
      setAuthSession(s ?? null);
      if (s) getSubscriptionStatus().then(st => { if (alive) setSubscriptionStatus(st); });
    });
    const unsub    = subscribeSession(s => {
      setAuthSession(s ?? null); setAuthError(null); setAuthBusy(false);
      if (s) getSubscriptionStatus().then(st => setSubscriptionStatus(st));
      else setSubscriptionStatus(null);
    });
    const unsubErr = subscribeAuthError(({ code, message }) => {
      const c=(code||"").toLowerCase(), m=(message||"").toLowerCase();
      setAuthError(c==="user_exists"||m.includes("already exists")||m.includes("already in use")
        ? "This email is already in use. Please sign in or reset your password."
        : "Sign-in failed. Please try again.");
      setAuthBusy(false);
    });
    return () => { alive=false; unsub(); unsubErr(); };
  }, []);

  // ── Subscription refresh via rload://subscription-activated deep link ─────
  useEffect(() => {
    const unsub = subscribeSubscriptionRefresh(async () => {
      const st = await getSubscriptionStatus();
      setSubscriptionStatus(st);
      // Retry once after 3 s to cover Stripe webhook processing delay
      if (!st?.hasAccess) {
        setTimeout(async () => {
          const st2 = await getSubscriptionStatus();
          setSubscriptionStatus(st2);
        }, 3000);
      }
    });
    return unsub;
  }, []);

  const handleSignIn  = useCallback(async () => {
    if (authBusy) return;
    setAuthBusy(true); setAuthError(null);
    try { await login(); } catch(e) { console.error("[AUTH]",e); setAuthBusy(false); }
  }, [authBusy]);

  const handleSignOut = useCallback(async () => {
    setAuthBusy(true);
    try { await logout(); } catch(e) { console.error("[AUTH]",e); }
    finally { setAuthBusy(false); }
  }, []);

  // ── Catalog ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await listLocalGames();
      if (!alive) return;
      const source = list[0]?._source || null;
      setCatalogSource(source==="local"?"local":source==="remote"?"remote":null);
      const normalized = list.map(g => ({
        gameId:         g.gameId,
        title:          g.title || g.name || g.gameId,
        studio:         g.studio || null,
        version:        g.version || "1.0.0",
        exe:            g.exe || g.exePath || g.exeRelativePath || "",
        downloadUrl:    g.downloadUrl || g.url || "",
        sha256:         g.sha256 || "",
        downloadSize:   g.downloadSize || null,
        updateStrategy: g.updateStrategy || "full",
        description:    g.description || null,
        shortDescription: g.shortDescription || null,
        thumbnail:      g.thumbnail || g.coverUrl || LOCAL_COVERS[g.gameId] || null,
        coverUrl:       g.coverUrl  || g.thumbnail || LOCAL_COVERS[g.gameId] || null,
        coverImage:     g.coverImage || null,
        banner:         g.banner || null,
        screenshots:    Array.isArray(g.screenshots) ? g.screenshots : [],
        trailer:        g.trailer || null,
        tags:           Array.isArray(g.tags) ? g.tags : [],
        genres:         Array.isArray(g.genres) ? g.genres : [],
        // M4 fields
        comingSoon:         !!g.comingSoon,
        releaseDate:        g.releaseDate || null,
        languages:          Array.isArray(g.languages) ? g.languages : [],
        ageRating:          g.ageRating || null,
        featureCards:       Array.isArray(g.featureCards) ? g.featureCards : [],
        systemRequirements: g.systemRequirements || null,
        studioSlug:         g.studioSlug || null,
        studioLogo:         g.studioLogo || null,
        studioCountry:      g.studioCountry || null,
        studioLinks:        g.studioLinks || null,
        _source:        g._source || null,
      }));
      setGames(normalized);
      for (const game of normalized) {
        const { installed, extracted, exePath, installedVersion } =
          await getInstalledStatus(game.gameId, game.version, game.exe);
        if (!alive) return;
        if (installed && exePath)  setExeByGame(p => ({ ...p, [game.gameId]: exePath }));
        if (installedVersion)      setInstalledVersionByGame(p => ({ ...p, [game.gameId]: installedVersion }));
        const needsUpdate = installed && installedVersion && isUpdateAvailable(installedVersion, game.version);
        const nextState = installed ? (needsUpdate ? UI.UPDATE_AVAILABLE : UI.INSTALLED)
                        : extracted ? UI.INSTALLED_NO_EXE : UI.IDLE;
        setUiByGame(p => ({ ...p, [game.gameId]: nextState }));
      }
      if (alive) setGamesLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  // ── Download events ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!desktop) return;
    const unsub = subscribeDownloads({
      onProgress: p => {
        if (!p?.gameId) return;
        setDlByGame(prev => ({ ...prev, [p.gameId]: p }));
        if (p.id) setDlIdByGame(prev => ({ ...prev, [p.gameId]: p.id }));
        setUiByGame(prev => {
          if (DOWNLOAD_SAFE_STATES.has(prev[p.gameId])) return prev;
          return { ...prev, [p.gameId]: prev[p.gameId]===UI.PAUSED ? UI.PAUSED : UI.DOWNLOADING };
        });
      },
      onState: s => {
        if (!s?.gameId) return;
        if (s.id) setDlIdByGame(prev => ({ ...prev, [s.gameId]: s.id }));
        const mapped = mapBackendStateToUI(s.state);
        if (mapped) setUiByGame(prev => {
          if (DOWNLOAD_SAFE_STATES.has(prev[s.gameId])) return prev;
          return { ...prev, [s.gameId]: mapped };
        });
        if (mapped===UI.ERROR)    setErrByGame(prev => ({ ...prev, [s.gameId]: toErrStr(s.error)||"failed" }));
        if (mapped===UI.CANCELED) setBusyByGame(prev => ({ ...prev, [s.gameId]: false }));
      },
    });
    unsubRef.current = unsub;
    return () => { try { unsubRef.current?.(); } catch {} unsubRef.current = null; };
  }, [desktop]);

  // ── Running events ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!desktop) return;
    const unsub = subscribeRunning(r => {
      if (!r?.gameId) return;
      if (r.running) setUiByGame(p => ({ ...p, [r.gameId]: UI.RUNNING }));
      else setUiByGame(p => { if (p[r.gameId]===UI.RUNNING) return { ...p, [r.gameId]: UI.INSTALLED }; return p; });
    });
    unsubRunRef.current = unsub;
    return () => { try { unsubRunRef.current?.(); } catch {} unsubRunRef.current = null; };
  }, [desktop]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleInstall = useCallback(async game => {
    const id = game.gameId;
    const tl = LANGS[lang] || LANGS.en;
    if (!subscriptionStatus?.hasAccess) {
      if (!demoMode) {
        openExternal("https://rload.be/pricing?source=launcher");
        return;
      }
      console.warn("[RLOAD DEMO MODE] Subscription gate bypassed for local demo.");
    }
    setBusyByGame(p=>({...p,[id]:true})); setErrByGame(p=>({...p,[id]:""}));
    setExeByGame(p=>({...p,[id]:null})); setUiByGame(p=>({...p,[id]:UI.DOWNLOADING}));
    setTimeout(()=>setBusyByGame(p=>({...p,[id]:false})),600);
    let res;
    try { res = await installGame(game); }
    catch(e) {
      setUiByGame(p=>{if(p[id]===UI.CANCELED)return p;return{...p,[id]:UI.ERROR}});
      setErrByGame(p=>({...p,[id]:toErrStr(e)||tl.installFailed})); return;
    }
    if (!res||res.ok===false) {
      if (res?.code==="SUBSCRIPTION_REQUIRED"||res?.code==="AUTH_REQUIRED") {
        if (!demoMode) {
          setUiByGame(p=>({...p,[id]:UI.IDLE}));
          openExternal("https://rload.be/pricing?source=launcher");
          return;
        }
        console.warn("[RLOAD DEMO MODE] SUBSCRIPTION_REQUIRED from backend bypassed.");
        setUiByGame(p=>({...p,[id]:UI.IDLE}));
        return;
      }
      setUiByGame(p=>{if(p[id]===UI.CANCELED)return p;return{...p,[id]:UI.ERROR}});
      setErrByGame(p=>({...p,[id]:toErrStr(res?.error)||tl.installFailed}));
    } else if (res.exePath) {
      setExeByGame(p=>({...p,[id]:res.exePath}));
      setInstalledVersionByGame(p=>({...p,[id]:res.installedVersion||game.version}));
      setUiByGame(p=>({...p,[id]:UI.INSTALLED}));
      setDlByGame(p=>({...p,[id]:{...(p[id]||{}),percent:100}}));
    } else {
      setUiByGame(p=>({...p,[id]:UI.INSTALLED_NO_EXE}));
    }
  }, [lang, subscriptionStatus, demoMode]);

  const handleUpdate = useCallback(async (game, oldVersion) => {
    const id = game.gameId;
    const tl = LANGS[lang] || LANGS.en;
    if (!subscriptionStatus?.hasAccess) {
      if (!demoMode) {
        openExternal("https://rload.be/pricing?source=launcher");
        return;
      }
      console.warn("[RLOAD DEMO MODE] Subscription gate bypassed for local demo.");
    }
    setBusyByGame(p=>({...p,[id]:true})); setErrByGame(p=>({...p,[id]:""}));
    setUiByGame(p=>({...p,[id]:UI.UPDATING}));
    setTimeout(()=>setBusyByGame(p=>({...p,[id]:false})),600);
    let res;
    try { res = await updateGame(game, oldVersion); }
    catch(e) {
      setUiByGame(p=>({...p,[id]:UI.UPDATE_AVAILABLE}));
      setErrByGame(p=>({...p,[id]:toErrStr(e)||tl.updateFailed})); return;
    }
    if (!res||res.ok===false) {
      if (res?.code==="SUBSCRIPTION_REQUIRED"||res?.code==="AUTH_REQUIRED") {
        if (!demoMode) {
          setUiByGame(p=>({...p,[id]:UI.UPDATE_AVAILABLE}));
          openExternal("https://rload.be/pricing?source=launcher");
          return;
        }
        console.warn("[RLOAD DEMO MODE] SUBSCRIPTION_REQUIRED from backend bypassed.");
        setUiByGame(p=>({...p,[id]:UI.UPDATE_AVAILABLE}));
        return;
      }
      setUiByGame(p=>({...p,[id]:UI.UPDATE_AVAILABLE}));
      setErrByGame(p=>({...p,[id]:toErrStr(res?.error)||tl.updateFailed}));
    } else if (res.exePath) {
      setExeByGame(p=>({...p,[id]:res.exePath}));
      setInstalledVersionByGame(p=>({...p,[id]:res.installedVersion||game.version}));
      setUiByGame(p=>({...p,[id]:UI.INSTALLED}));
      setDlByGame(p=>({...p,[id]:{...(p[id]||{}),percent:100}}));
    } else {
      setInstalledVersionByGame(p=>({...p,[id]:res.installedVersion||game.version}));
      setUiByGame(p=>({...p,[id]:UI.INSTALLED_NO_EXE}));
    }
  }, [lang, subscriptionStatus, demoMode]);

  const handlePlay = useCallback(async game => {
    // Subscription gate — only block Play, never block startup or install
    if (!subscriptionStatus?.hasAccess) {
      if (!demoMode) {
        openExternal("https://rload.be/pricing?source=launcher");
        return;
      }
      console.warn("[RLOAD DEMO MODE] Subscription gate bypassed for local demo.");
    }
    const id = game.gameId;
    setBusyByGame(p=>({...p,[id]:true})); setErrByGame(p=>({...p,[id]:""}));
    // Track last played — persists across sessions so Continue Playing shows the real game
    localStorage.setItem("rload-last-played", id);
    // Show launch overlay
    setLaunchingGame({ title:game.title||game.gameId, gameId:id, thumbnail:game.thumbnail, coverUrl:game.coverUrl });
    setTimeout(()=>setLaunchingGame(null), 7000);
    try {
      const res = await launchGame(game);
      const tl = LANGS[lang] || LANGS.en;
      if (res?.ok||res?.code==="ALREADY_RUNNING") setUiByGame(p=>({...p,[id]:UI.RUNNING}));
      else if (res?.code==="SUBSCRIPTION_REQUIRED") {
        if (!demoMode) { openExternal("https://rload.be/pricing?source=launcher"); }
        else { console.warn("[RLOAD DEMO MODE] SUBSCRIPTION_REQUIRED from backend bypassed."); setUiByGame(p=>({...p,[id]:UI.INSTALLED})); }
      }
      else setErrByGame(p=>({...p,[id]:toErrStr(res?.error)||tl.launchFailed}));
    } catch(e) {
      const tl = LANGS[lang] || LANGS.en;
      setErrByGame(p=>({...p,[id]:toErrStr(e)||tl.launchFailed}));
    } finally {
      setTimeout(()=>setBusyByGame(p=>({...p,[id]:false})),300);
    }
  }, [lang, subscriptionStatus, demoMode]);

  const handleRefreshSubscription = useCallback(async () => {
    const st = await getSubscriptionStatus();
    setSubscriptionStatus(st);
  }, []);

  const handleUninstall = useCallback(async game => {
    const id = game.gameId;
    const tl = LANGS[lang] || LANGS.en;
    setBusyByGame(p=>({...p,[id]:true})); setErrByGame(p=>({...p,[id]:""}));
    try {
      const res = await uninstallGame(id);
      if (!res||res.ok===false) {
        if (res?.code==="GAME_RUNNING") setErrByGame(p=>({...p,[id]:res.message||tl.closeGameFirst}));
        else { setUiByGame(p=>({...p,[id]:UI.ERROR})); setErrByGame(p=>({...p,[id]:toErrStr(res?.message||res?.error)||tl.uninstallFailed})); }
      } else {
        setUiByGame(p=>({...p,[id]:UI.IDLE})); setExeByGame(p=>({...p,[id]:null}));
        setInstalledVersionByGame(p=>({...p,[id]:null}));
        setDlByGame(p=>({...p,[id]:{percent:0,bytesDownloaded:0,totalBytes:0}}));
        setDlIdByGame(p=>({...p,[id]:null})); setErrByGame(p=>({...p,[id]:""}));
      }
    } catch(e) {
      setUiByGame(p=>({...p,[id]:UI.ERROR})); setErrByGame(p=>({...p,[id]:toErrStr(e)||tl.uninstallFailed}));
    } finally {
      setTimeout(()=>setBusyByGame(p=>({...p,[id]:false})),500);
    }
  }, [lang]);

  const wrapBusy = useCallback(async (id, fn) => {
    setBusyByGame(p=>({...p,[id]:true})); setErrByGame(p=>({...p,[id]:""}));
    try {
      const res = await fn();
      if (res&&res.ok===false) { setUiByGame(p=>({...p,[id]:UI.ERROR})); setErrByGame(p=>({...p,[id]:toErrStr(res.error)||"failed"})); }
      return res;
    } catch(e) { setUiByGame(p=>({...p,[id]:UI.ERROR})); setErrByGame(p=>({...p,[id]:toErrStr(e)||"failed"})); }
    finally { setTimeout(()=>setBusyByGame(p=>({...p,[id]:false})),500); }
  }, []);

  // ── handleSelectGame — navigate to full game page ─────────────────────────
  const handleSelectGame = useCallback(gameOrNull => {
    if (!gameOrNull) {
      setSelectedGameId(null);
      setActiveTab(prevGameTab);
      return;
    }
    const id = typeof gameOrNull==="string" ? gameOrNull : gameOrNull.gameId;
    setPrevGameTab(prev => activeTab === "game" ? prev : activeTab);
    setSelectedGameId(id);
    setActiveTab("game");
  }, [activeTab, prevGameTab]);

  const handleBackFromGame = useCallback(() => {
    setSelectedGameId(null);
    setActiveTab(prevGameTab);
  }, [prevGameTab]);

  // ── Auth gate ──────────────────────────────────────────────────────────────
  if (authSession === undefined) return null;
  if (!authSession) return <LoginScreen authBusy={authBusy} authError={authError} onSignIn={handleSignIn}/>;

  // ── Detail panel props ────────────────────────────────────────────────────
  const selGame = selectedGameId ? games.find(g=>g.gameId===selectedGameId) : null;
  const selId   = selGame?.gameId;
  const gameDetailProps = selId ? {
    dl:               dlByGame[selId],
    uiState:          uiByGame[selId]               || UI.IDLE,
    resolvedExe:      exeByGame[selId]              || null,
    installedVersion: installedVersionByGame[selId] || null,
    error:            errByGame[selId],
    busy:             !!busyByGame[selId],
    hasAccess:        demoMode ? true : (subscriptionStatus?.hasAccess ?? false),
    onInstall:  ()=>handleInstall(selGame),
    onUpdate:   ()=>handleUpdate(selGame, installedVersionByGame[selId]||null),
    onPlay:     ()=>handlePlay(selGame),
    onPause:    ()=>wrapBusy(selId, async()=>{ if(!dlIdByGame[selId]) return {ok:false}; setUiByGame(p=>({...p,[selId]:UI.PAUSED})); return await pauseDownload(dlIdByGame[selId]); }),
    onResume:   ()=>wrapBusy(selId, async()=>{ if(!dlIdByGame[selId]) return {ok:false}; setUiByGame(p=>({...p,[selId]:UI.DOWNLOADING})); return await resumeDownload(dlIdByGame[selId]); }),
    onCancel:   ()=>wrapBusy(selId, async()=>{ if(!dlIdByGame[selId]) return {ok:false}; setUiByGame(p=>({...p,[selId]:p[selId]===UI.UPDATING?UI.UPDATE_AVAILABLE:UI.CANCELED})); return await cancelDownload(dlIdByGame[selId]); }),
    onUninstall:        ()=>handleUninstall(selGame),
    onRefreshAccess:    handleRefreshSubscription,
  } : null;

  // ── Derived stats ─────────────────────────────────────────────────────────
  const INSTALLED_SET = new Set([UI.INSTALLED,UI.RUNNING,UI.UPDATE_AVAILABLE,UI.INSTALLED_NO_EXE]);
  const updatesCount = games.filter(g=>uiByGame[g.gameId]===UI.UPDATE_AVAILABLE).length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", overflow:"hidden", background:`linear-gradient(160deg, ${T.bgDeep} 0%, #0d0b1f 60%, #100e24 100%)`, color:T.text, fontFamily:T.fontBody }}>
      {/* Launch overlay */}
      {launchingGame && <LaunchOverlay game={launchingGame}/>}

      {/* Top navigation bar */}
      <TopNavBar
        tab={activeTab === "game" ? "games" : activeTab}
        onTab={handleTabChange}
        user={authSession?.user}
        updatesCount={updatesCount}
        catalogSource={catalogSource}
        desktop={desktop}
      />

      {/* Page content */}
      <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
        {activeTab==="game" && selGame && (
          <GameSinglePage
            game={selGame}
            {...gameDetailProps}
            onBack={handleBackFromGame}
            allGames={games}
            uiByGame={uiByGame}
            onSelectGame={handleSelectGame}
            subscriptionStatus={subscriptionStatus}
            demoMode={demoMode}
            onViewAllGames={()=>{ setSelectedGameId(null); handleTabChange("games"); }}
          />
        )}
        {activeTab==="home" && (
          <HomePage games={games} uiByGame={uiByGame} dlByGame={dlByGame}
            onSelectGame={handleSelectGame} user={authSession?.user}
            onTabChange={handleTabChange}/>
        )}
        {activeTab==="games" && (
          <MyGamesPage games={games} uiByGame={uiByGame} dlByGame={dlByGame}
            selectedGameId={selectedGameId} onSelectGame={handleSelectGame}
            gameDetailProps={gameDetailProps} gamesLoading={gamesLoading}
            onTabChange={handleTabChange}/>
        )}
        {activeTab==="events"    && <EventsPage onTabChange={handleTabChange}/>}
        {activeTab==="streaming" && <StreamingPage/>}
        {activeTab==="community" && <CommunityPage/>}
        {activeTab==="about"     && <AboutPage onTabChange={handleTabChange}/>}
        {activeTab==="profile"   && (
          <ProfilePage user={authSession?.user} authBusy={authBusy}
            onLogout={handleSignOut} games={games} uiByGame={uiByGame}
            lang={lang} changeLang={changeLang}/>
        )}
      </div>
    </div>
  );
}
