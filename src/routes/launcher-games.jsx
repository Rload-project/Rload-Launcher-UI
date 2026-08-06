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
import { T } from "../lib/theme";
import { getProfile as getPlayerProfile, subscribeProfile as subscribePlayerProfile, recordGameEvent, setCountry as setPlayerCountry, setDisplayName as setPlayerDisplayName } from "../lib/playerStore";
import { ProfileHeader } from "../components/player/ProfileHeader.jsx";
import { AchievementsPage } from "../components/player/AchievementsPage.jsx";
import { CosmeticsPickerModal } from "../components/player/CosmeticsPickerModal.jsx";
import { NotificationToastHost } from "../components/player/NotificationToastHost.jsx";
import { findAvatar } from "../components/player/PlayerAvatar.jsx";
import { findBanner } from "../components/player/PlayerBanner.jsx";
import { findBadge } from "../components/player/PlayerBadge.jsx";

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
// Design tokens — moved to ../lib/theme.js (imported above) so Player
// Identity components share the exact same (official Rload) palette.
// ─────────────────────────────────────────────────────────────────────────────

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

// ── Favorites — single source of truth (localStorage "rload-favorites") shared by every
// heart button in the app (Home cards, Games grid, MyGamesPage's sidebar filter). A card's
// own useState was never wired to this before, so liking a game on Home didn't show up
// in Games > Favorites. window event keeps every mounted heart in sync when any of them toggles. ──
const FAVORITES_KEY = "rload-favorites";
const FAVORITES_EVENT = "rload:favorites-changed";
function getFavoriteIds() {
  try { return new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY)||"[]")); }
  catch { return new Set(); }
}
function toggleFavoriteId(gameId) {
  const next = getFavoriteIds();
  next.has(gameId) ? next.delete(gameId) : next.add(gameId);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
  window.dispatchEvent(new Event(FAVORITES_EVENT));
  return next;
}
function useIsFavorite(gameId) {
  const [fav, setFav] = useState(()=>getFavoriteIds().has(gameId));
  useEffect(() => {
    setFav(getFavoriteIds().has(gameId));
    const onChange = () => setFav(getFavoriteIds().has(gameId));
    window.addEventListener(FAVORITES_EVENT, onChange);
    return () => window.removeEventListener(FAVORITES_EVENT, onChange);
  }, [gameId]);
  return [fav, ()=>toggleFavoriteId(gameId)];
}

// ─────────────────────────────────────────────────────────────────────────────
// Real events data (from Vercel website Events.tsx)
// ─────────────────────────────────────────────────────────────────────────────
const UPCOMING_EVENTS = [
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
  { day:"20", month:"MAY", category:"Creator Events",  title:"Nordic Game 2026",                time:"Malmö, Sweden" },
  { day:"06", month:"MAY", category:"Creator Events",  title:"A MAZE. Berlin 2026",              time:"Berlin, Germany" },
  { day:"22", month:"APR", category:"Creator Events",  title:"Reboot Develop Blue 2026",         time:"Dubrovnik, Croatia" },
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
// Derives HomeGameCard/SearchPage result items from the REAL catalog (`games`,
// as returned by listLocalGames()) — replaces what used to be a static list of
// fabricated titles/studios/play-counts. Same image-resolution convention used
// everywhere else in this file: LOCAL_COVERS override, then CDN thumbnail/coverUrl,
// then the generic default cover.
function gameToRankedItem(game, rank) {
  return {
    rank,
    game,
    title: game.title,
    genre: game.tags?.length ? game.tags : [game.studio || "Game"],
    studio: game.studio || "",
    imageUrl: LOCAL_COVERS[game.gameId] || game.thumbnail || game.coverUrl || "./images/games/default_game_cover.png",
  };
}
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
    dataPrivacyBody:"Rload collects minimal data required to operate the launcher. Your game install paths and preferences are stored locally on your device only. Authentication is handled securely via Auth0.",
    securityBody:"All connections to Rload services use HTTPS. Tokens are stored securely using the OS credential store. You can sign out at any time to revoke access.",
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
    // Player Identity
    profileDetails:"Profile Details", launcherInformation:"Launcher Information",
    editProfile:"Edit Profile", membership:"Membership", helpSupport:"Help & Support",
    achievements:"Achievements", pointsLabel:"points",
    foundingMemberLabel:"Founding Member", rloadMemberLabel:"Rload Member",
    gamesPlayedStat:"Games Played", hoursPlayedStat:"Hours Played",
    studiosDiscoveredStat:"Studios Discovered", subscriptionStat:"Subscription", memberSinceStat:"Member Since",
    subscriptionDemo:"Demo Mode", subscriptionPremium:"Premium", subscriptionFree:"Free",
    avatarLabel:"Avatar", bannerLabel:"Banner", badgeLabel:"Badge", countryLabel:"Country", noneLabel:"None", locked:"Locked",
    displayNameLabel:"Display Name", editLabel:"Edit", saveLabel:"Save", cancelLabel:"Cancel",
    cosmeticTab_avatar:"Avatar", cosmeticTab_banner:"Banner", cosmeticTab_badge:"Badge", cosmeticTab_title:"Title",
    achCategory_discovery:"Discovery", achCategory_studios:"Studios", achCategory_playtime:"Playtime",
    achCategory_exploration:"Exploration", achCategory_special:"Special", achCategory_community:"Community",
    ach_first_step_title:"Boot Sequence", ach_first_step_desc:"You installed your first game on Rload.",
    ach_first_launch_title:"First Launch", ach_first_launch_desc:"You launched your first game.",
    ach_first_discovery_title:"Signal Found", ach_first_discovery_desc:"You discovered and played your first indie game.",
    ach_explorer_i_title:"Triple Play", ach_explorer_i_desc:"You played 3 different games.",
    ach_explorer_ii_title:"World Traveler", ach_explorer_ii_desc:"You played 10 different games.",
    ach_studio_hopper_title:"Studio Drifter", ach_studio_hopper_desc:"You played games from 5 different studios.",
    ach_belgian_explorer_title:"Local Legend", ach_belgian_explorer_desc:"You played Belgian-made indie games.",
    ach_hidden_gem_hunter_title:"Below the Surface", ach_hidden_gem_hunter_desc:"You uncovered 3 hidden indie gems.",
    ach_weekend_player_title:"Weekend Ritual", ach_weekend_player_desc:"You played during 3 different weekends.",
    ach_completion_starter_title:"Chain Reaction", ach_completion_starter_desc:"You unlocked 5 achievements.",
    ach_founding_member_title:"Day Zero", ach_founding_member_desc:"You were here at the beginning of Rload.",
    notifAchievementUnlockedTitle:"🏆 Achievement Unlocked",
    notifAvatarUnlockedTitle:"New avatar unlocked: {name}",
    notifBannerUnlockedTitle:"New banner unlocked: {name}",
    notifBadgeUnlockedTitle:"New badge unlocked: {name}",
    notifTitleUnlockedTitle:"New title unlocked: {name}",
    notifLevelUpTitle:"Level up! You reached level {level}",
    rewardsWaiting:"{count} rewards waiting",
    rewardLabel:"Reward", rewardTypeAvatar:"Avatar", rewardTypeBanner:"Banner", rewardTypeBadge:"Profile Badge", rewardTypeTitle:"Title",
    collectionLabel:"Collection", collectionAchievements:"Achievements", collectionAvatars:"Avatars",
    collectionBanners:"Banners", collectionBadges:"Profile Badges", collectionTitles:"Titles",
    recentAchievements:"Recent Achievements", nextReward:"Next Reward",
    noAchievementsYet:"No achievements unlocked yet.", allCaughtUp:"All caught up — new achievements coming soon.",
    cosmeticCollection:"Cosmetic Collection",
    changeAvatar:"Change Avatar", changeBanner:"Change Banner", changeBadge:"Change Badge",
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
    dataPrivacyBody:"Rload collecte le minimum de données nécessaires au fonctionnement du launcher. Les chemins d'installation et vos préférences restent stockés localement sur votre appareil. L'authentification est gérée de façon sécurisée via Auth0.",
    securityBody:"Toutes les connexions aux services Rload utilisent HTTPS. Les jetons sont stockés de façon sécurisée dans le gestionnaire d'identifiants du système. Vous pouvez vous déconnecter à tout moment pour révoquer l'accès.",
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
    // Player Identity
    profileDetails:"Détails du profil", launcherInformation:"Informations du launcher",
    editProfile:"Modifier le profil", membership:"Abonnement", helpSupport:"Aide & Support",
    achievements:"Succès", pointsLabel:"points",
    foundingMemberLabel:"Membre fondateur", rloadMemberLabel:"Membre Rload",
    gamesPlayedStat:"Jeux joués", hoursPlayedStat:"Heures jouées",
    studiosDiscoveredStat:"Studios découverts", subscriptionStat:"Abonnement", memberSinceStat:"Membre depuis",
    subscriptionDemo:"Mode démo", subscriptionPremium:"Premium", subscriptionFree:"Gratuit",
    avatarLabel:"Avatar", bannerLabel:"Bannière", badgeLabel:"Badge", countryLabel:"Pays", noneLabel:"Aucun", locked:"Verrouillé",
    displayNameLabel:"Nom affiché", editLabel:"Modifier", saveLabel:"Enregistrer", cancelLabel:"Annuler",
    cosmeticTab_avatar:"Avatar", cosmeticTab_banner:"Bannière", cosmeticTab_badge:"Badge", cosmeticTab_title:"Titre",
    achCategory_discovery:"Découverte", achCategory_studios:"Studios", achCategory_playtime:"Temps de jeu",
    achCategory_exploration:"Exploration", achCategory_special:"Spécial", achCategory_community:"Communauté",
    ach_first_step_title:"Boot Sequence", ach_first_step_desc:"Vous avez installé votre premier jeu sur Rload.",
    ach_first_launch_title:"Premier lancement", ach_first_launch_desc:"Vous avez lancé votre premier jeu.",
    ach_first_discovery_title:"Signal Found", ach_first_discovery_desc:"Vous avez découvert et joué à votre premier jeu indé.",
    ach_explorer_i_title:"Triple Play", ach_explorer_i_desc:"Vous avez joué à 3 jeux différents.",
    ach_explorer_ii_title:"Globe-trotteur", ach_explorer_ii_desc:"Vous avez joué à 10 jeux différents.",
    ach_studio_hopper_title:"Studio Drifter", ach_studio_hopper_desc:"Vous avez joué à des jeux de 5 studios différents.",
    ach_belgian_explorer_title:"Légende Locale", ach_belgian_explorer_desc:"Vous avez joué à des jeux indés belges.",
    ach_hidden_gem_hunter_title:"Below the Surface", ach_hidden_gem_hunter_desc:"Vous avez déniché 3 pépites indé cachées.",
    ach_weekend_player_title:"Weekend Ritual", ach_weekend_player_desc:"Vous avez joué pendant 3 week-ends différents.",
    ach_completion_starter_title:"Chain Reaction", ach_completion_starter_desc:"Vous avez débloqué 5 succès.",
    ach_founding_member_title:"Day Zero", ach_founding_member_desc:"Vous étiez là dès les débuts de Rload.",
    notifAchievementUnlockedTitle:"🏆 Succès débloqué",
    notifAvatarUnlockedTitle:"Nouvel avatar débloqué : {name}",
    notifBannerUnlockedTitle:"Nouvelle bannière débloquée : {name}",
    notifBadgeUnlockedTitle:"Nouveau badge débloqué : {name}",
    notifTitleUnlockedTitle:"Nouveau titre débloqué : {name}",
    notifLevelUpTitle:"Niveau supérieur ! Vous avez atteint le niveau {level}",
    rewardsWaiting:"{count} récompenses en attente",
    rewardLabel:"Récompense", rewardTypeAvatar:"Avatar", rewardTypeBanner:"Bannière", rewardTypeBadge:"Badge de profil", rewardTypeTitle:"Titre",
    collectionLabel:"Collection", collectionAchievements:"Succès", collectionAvatars:"Avatars",
    collectionBanners:"Bannières", collectionBadges:"Badges de profil", collectionTitles:"Titres",
    recentAchievements:"Succès récents", nextReward:"Prochaine récompense",
    noAchievementsYet:"Aucun succès débloqué pour l'instant.", allCaughtUp:"Tout est à jour — de nouveaux succès arrivent bientôt.",
    cosmeticCollection:"Collection cosmétique",
    changeAvatar:"Changer d'avatar", changeBanner:"Changer de bannière", changeBadge:"Changer de badge",
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
    dataPrivacyBody:"Rload verzamelt enkel de minimale gegevens die nodig zijn om de launcher te laten werken. Je installatiepaden en voorkeuren worden uitsluitend lokaal op je apparaat opgeslagen. Authenticatie verloopt veilig via Auth0.",
    securityBody:"Alle verbindingen met Rload-diensten gebruiken HTTPS. Tokens worden veilig opgeslagen in het credential-systeem van het besturingssysteem. Je kan op elk moment afmelden om de toegang in te trekken.",
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
    // Player Identity
    profileDetails:"Profielgegevens", launcherInformation:"Launcherinformatie",
    editProfile:"Profiel bewerken", membership:"Lidmaatschap", helpSupport:"Hulp & Ondersteuning",
    achievements:"Prestaties", pointsLabel:"punten",
    foundingMemberLabel:"Oprichtend lid", rloadMemberLabel:"Rload-lid",
    gamesPlayedStat:"Gespeelde spellen", hoursPlayedStat:"Gespeelde uren",
    studiosDiscoveredStat:"Ontdekte studio's", subscriptionStat:"Abonnement", memberSinceStat:"Lid sinds",
    subscriptionDemo:"Demomodus", subscriptionPremium:"Premium", subscriptionFree:"Gratis",
    avatarLabel:"Avatar", bannerLabel:"Banier", badgeLabel:"Badge", countryLabel:"Land", noneLabel:"Geen", locked:"Vergrendeld",
    displayNameLabel:"Weergavenaam", editLabel:"Bewerken", saveLabel:"Opslaan", cancelLabel:"Annuleren",
    cosmeticTab_avatar:"Avatar", cosmeticTab_banner:"Banier", cosmeticTab_badge:"Badge", cosmeticTab_title:"Titel",
    achCategory_discovery:"Ontdekking", achCategory_studios:"Studio's", achCategory_playtime:"Speeltijd",
    achCategory_exploration:"Verkenning", achCategory_special:"Speciaal", achCategory_community:"Gemeenschap",
    ach_first_step_title:"Boot Sequence", ach_first_step_desc:"Je hebt je eerste spel op Rload geïnstalleerd.",
    ach_first_launch_title:"Eerste start", ach_first_launch_desc:"Je hebt je eerste spel gestart.",
    ach_first_discovery_title:"Signal Found", ach_first_discovery_desc:"Je hebt je eerste indiegame ontdekt en gespeeld.",
    ach_explorer_i_title:"Triple Play", ach_explorer_i_desc:"Je hebt 3 verschillende spellen gespeeld.",
    ach_explorer_ii_title:"Wereldreiziger", ach_explorer_ii_desc:"Je hebt 10 verschillende spellen gespeeld.",
    ach_studio_hopper_title:"Studio Drifter", ach_studio_hopper_desc:"Je hebt spellen van 5 verschillende studio's gespeeld.",
    ach_belgian_explorer_title:"Lokale Legende", ach_belgian_explorer_desc:"Je hebt Belgische indiegames gespeeld.",
    ach_hidden_gem_hunter_title:"Below the Surface", ach_hidden_gem_hunter_desc:"Je hebt 3 verborgen indieparels ontdekt.",
    ach_weekend_player_title:"Weekend Ritual", ach_weekend_player_desc:"Je hebt tijdens 3 verschillende weekends gespeeld.",
    ach_completion_starter_title:"Chain Reaction", ach_completion_starter_desc:"Je hebt 5 prestaties ontgrendeld.",
    ach_founding_member_title:"Day Zero", ach_founding_member_desc:"Je was erbij vanaf het prille begin van Rload.",
    notifAchievementUnlockedTitle:"🏆 Prestatie ontgrendeld",
    notifAvatarUnlockedTitle:"Nieuwe avatar ontgrendeld: {name}",
    notifBannerUnlockedTitle:"Nieuwe banier ontgrendeld: {name}",
    notifBadgeUnlockedTitle:"Nieuwe badge ontgrendeld: {name}",
    notifTitleUnlockedTitle:"Nieuwe titel ontgrendeld: {name}",
    notifLevelUpTitle:"Level omhoog! Je bereikte level {level}",
    rewardsWaiting:"{count} beloningen in wachtrij",
    rewardLabel:"Beloning", rewardTypeAvatar:"Avatar", rewardTypeBanner:"Banier", rewardTypeBadge:"Profielbadge", rewardTypeTitle:"Titel",
    collectionLabel:"Collectie", collectionAchievements:"Prestaties", collectionAvatars:"Avatars",
    collectionBanners:"Banieren", collectionBadges:"Profielbadges", collectionTitles:"Titels",
    recentAchievements:"Recente prestaties", nextReward:"Volgende beloning",
    noAchievementsYet:"Nog geen prestaties ontgrendeld.", allCaughtUp:"Alles bijgewerkt — binnenkort nieuwe prestaties.",
    cosmeticCollection:"Cosmetische collectie",
    changeAvatar:"Avatar wijzigen", changeBanner:"Banier wijzigen", changeBadge:"Badge wijzigen",
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
  { id:"myrload",   label:"My Rload"  },
  { id:"about",     label:"About"     },
];

function TopNavBar({ tab, onTab, user, updatesCount, catalogSource, desktop }) {
  const [hov, setHov] = useState(null);
  const [navAvatarId, setNavAvatarId] = useState(null);
  const initial = (user?.email||user?.name||"U")[0].toUpperCase();

  // Mirrors whatever avatar the player has equipped (ProfilePage owns the
  // authoritative load/init) — subscribes independently so the nav circle
  // updates immediately after a Save in the cosmetics picker.
  useEffect(() => {
    const unsub = subscribePlayerProfile((p) => setNavAvatarId(p?.avatarId || null));
    return unsub;
  }, []);
  const navAvatar = navAvatarId ? findAvatar(navAvatarId) : null;
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
        {/* Profile avatar button — shows the player's equipped avatar once loaded, falls back to initial */}
        <div onClick={()=>onTab("profile")} onMouseEnter={()=>setHov("profile")} onMouseLeave={()=>setHov(null)}
          style={{ width:38, height:38, borderRadius:"50%",
            background:navAvatar ? "transparent" : (tab==="profile" ? T.brandGrad : "rgba(128,74,240,0.25)"),
            border:`2px solid ${tab==="profile" ? T.brand : "rgba(128,74,240,0.45)"}`,
            display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden",
            cursor:"pointer", fontSize:14, fontWeight:700, color:"#fff",
            transition:"background 0.18s ease-out, color 0.18s ease-out, border-color 0.18s ease-out, box-shadow 0.18s ease-out", boxShadow:tab==="profile" ? T.brandGlow : "none",
            userSelect:"none",
          }}>
          {navAvatar ? <img src={navAvatar.asset} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : initial}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SectionHeader
// ─────────────────────────────────────────────────────────────────────────────
function SectionHeader({ title, count, onMore, subtitle, moreLabel="See all" }) {
  return (
    <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", marginBottom:14 }}>
      <div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {/* Figma Dev Mode (Home, "Games"/"Community Favorite" heading): Poppins 700 40px/48px — was 17px, badly undersized. */}
          <div style={{ fontSize:40, fontWeight:700, color:T.text, fontFamily:T.fontHead, letterSpacing:"-0.5px", lineHeight:"48px" }}>{title}</div>
          {count !== undefined && <span style={{ fontSize:13, padding:"2px 9px", borderRadius:T.radiusPill, background:"rgba(255,255,255,0.06)", color:T.textMuted }}>{count}</span>}
        </div>
        {subtitle && <div style={{ fontSize:14, color:T.textDim, marginTop:4 }}>{subtitle}</div>}
      </div>
      {onMore && (
        <button onClick={onMore} style={{ fontSize:15, fontWeight:600, color:T.brandLight, background:"none", border:"none", cursor:"pointer", padding:"2px 0", display:"flex", alignItems:"center", gap:6, fontFamily:T.fontBody }}>
          {moreLabel} <Icon.ArrowRight/>
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GameGridCard — portrait card for 4-col grid
// ─────────────────────────────────────────────────────────────────────────────
// Cover-overlay treatment matches HomeGameCard (Figma Home grid) — gradient
// scrim, title + genre pill + rating overlaid at the bottom of the art —
// instead of the old separate text block below the image. Install-state
// badge, transfer progress bar and selection ring are real functional UI
// with no Figma equivalent, so they're kept as-is, layered on top.
function GameGridCard({ game, uiState, dl, isSelected, onSelect }) {
  const [hov, setHov] = useState(false);
  const [liked, toggleLiked] = useIsFavorite(game.gameId);
  const badge = getStateBadge(uiState);
  const pct   = clamp(dl?.percent??0, 0, 100);
  const isXfer = [UI.DOWNLOADING,UI.INSTALLING,UI.PAUSED,UI.UPDATING].includes(uiState);
  // Catalog `tags` is just the gameId repeated (e.g. tags:["ultrakill"]) — `genres`
  // holds the real genre labels (e.g. ["Action","FPS","Indie"]); prefer that.
  const genre = game.genres?.[0] || game.tags?.[0] || "Game";
  return (
    <div role="button" tabIndex={0}
      onClick={()=>onSelect(game)}
      onKeyDown={e=>(e.key==="Enter"||e.key===" ")&&onSelect(game)}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ position:"relative", borderRadius:16, overflow:"hidden", aspectRatio:"259/353",
        cursor:"pointer", userSelect:"none", background:coverGradient(game.title||game.gameId),
        boxShadow:isSelected ? `0 0 0 2px ${T.brand}, 0 16px 48px rgba(0,0,0,0.55)` : hov ? "0 12px 40px rgba(0,0,0,0.5)" : "none",
        transform:hov&&!isSelected ? "translateY(-3px)" : "translateY(0)",
        transition:"transform 0.2s ease-out, box-shadow 0.2s ease-out",
      }}>
      <img src={game.thumbnail||game.coverUrl||"./images/games/default_game_cover.png"} alt={game.title}
        style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", display:"block", transform:hov?"scale(1.07)":"scale(1)", transition:"transform 0.22s ease-out" }}
        onError={e=>{ e.currentTarget.src="./images/games/default_game_cover.png"; e.currentTarget.onerror=null; }}/>
      {/* Light bottom-only scrim for text legibility — no full-cover dark holo; covers stay vibrant, like Figma. */}
      <div style={{ position:"absolute", left:0, right:0, bottom:0, height:"55%", background:"linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.75) 100%)" }}/>
      {badge && (
        <div style={{ position:"absolute", top:12, left:12, padding:"3px 8px", borderRadius:T.radiusPill, fontSize:9, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", color:badge.color, background:badge.bg, border:`1px solid ${badge.border}`, backdropFilter:"blur(8px)" }}>
          {badge.label}
        </div>
      )}
      <button onClick={e=>{ e.stopPropagation(); toggleLiked(); }} aria-label="Like"
        style={{ position:"absolute", top:12, right:12, width:32, height:32, borderRadius:16, background:"rgba(0,0,0,0.35)", border:"1px solid rgba(255,255,255,0.14)", color:liked?T.brandLight:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>
        {liked ? "♥" : "♡"}
      </button>
      {isXfer && (
        <div style={{ position:"absolute", bottom:0, left:0, right:0, height:3, background:"rgba(255,255,255,0.07)" }}>
          <div style={{ height:"100%", width:`${pct}%`, background:T.brandGrad, transition:"width 0.3s ease" }}/>
        </div>
      )}
      <div style={{ position:"absolute", left:0, right:0, bottom:0, padding:16 }}>
        <div style={{ fontSize:24, fontWeight:700, color:"#fff", fontFamily:T.fontHead, marginBottom:8, textShadow:"0 2px 12px rgba(0,0,0,0.6)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{game.title||game.gameId}</div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ padding:"5px 14px", borderRadius:999, background:T.brand, color:"rgba(255,255,255,0.9)", fontSize:11, fontWeight:500 }}>{genre}</span>
          <span style={{ fontSize:12, fontWeight:600, color:"#ffffa6" }}>★ {mockRating(game.title||game.gameId)}</span>
        </div>
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
  const big = thumbSize > 120;

  // Big mode (Home): image ~34% / content ~66%, date badge overlaid on the image corner instead
  // of its own column — frees the width the old 3-column layout (image + date + content) was
  // wasting, so title/description get real room instead of a cramped sliver on the right.
  if (big) {
    return (
      <div style={{ borderRadius:T.radius, padding:12, display:"flex", alignItems:"center", gap:14, border:"1px solid rgba(255,255,255,0.1)", background:"rgba(255,255,255,0.05)" }}>
        {showThumbnail && ev.imageUrl && !imgErr && (
          <div style={{ position:"relative", aspectRatio:"1/1", height:thumbSize, borderRadius:"0.75rem", overflow:"hidden", flexShrink:0, background:coverGradient(ev.id) }}>
            <img src={ev.imageUrl} alt={ev.title}
              style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"center" }}
              onError={()=>setImgErr(true)}/>
            <div style={{ position:"absolute", left:10, bottom:10, textAlign:"center", background:"rgba(20,16,42,0.85)", backdropFilter:"blur(6px)", borderRadius:"0.7rem", border:"1px solid rgba(128,74,240,0.4)", padding:"6px 10px" }}>
              <div style={{ fontSize:16, fontWeight:700, color:"#fff", fontFamily:T.fontHead, lineHeight:1 }}>{ev.day}</div>
              <div style={{ fontSize:9, fontWeight:600, color:T.brandLight, marginTop:2, letterSpacing:"0.04em" }}>{ev.month}</div>
            </div>
          </div>
        )}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", gap:6, marginBottom:6, flexWrap:"wrap" }}>
            <span style={{ fontSize:10, fontWeight:600, padding:"2px 10px", borderRadius:T.radiusPill, color:cc.color, background:"#804af033", border:"1px solid rgba(128,74,240,0.3)" }}>{ev.category}</span>
            {ev.status && (
              <span style={{ fontSize:10, fontWeight:600, padding:"2px 10px", borderRadius:T.radiusPill, color:T.blue2Light, background:"#2B7FFF33", border:"1px solid rgba(43,127,255,0.3)" }}>{ev.status}</span>
            )}
          </div>
          <div style={{ fontSize:17, fontWeight:600, color:T.text, fontFamily:T.fontHead, lineHeight:1.25, marginBottom:4 }}>{ev.title}</div>
          {ev.description && <div style={{ fontSize:12.5, color:"#a0a0a0", lineHeight:1.4, marginBottom:4, whiteSpace:"normal" }}>{ev.description}</div>}
          {ev.time && (
            <div style={{ display:"flex", alignItems:"center", gap:6, color:"#878787", fontSize:12, marginTop:2 }}>
              <Icon.Calendar/> {ev.time}
            </div>
          )}
        </div>
      </div>
    );
  }

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

// "Studios à la une" — Figma pairs the spotlight card with a sidebar list of
// featured studios. Only REAL_STUDIOS (studios the catalog actually names) go
// in it — never padded with STUDIOS' placeholder roster, since this sidebar
// reads as "these studios are active on Rload right now".
function FeaturedStudiosSidebar({ onSelectStudio }) {
  return (
    <div style={{ flex:"0 0 35%", display:"flex", gap:24 }}>
      <div style={{ width:3, borderRadius:999, background:T.brand, flexShrink:0 }}/>
      <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center", gap:32 }}>
        <div style={{ fontSize:32, fontWeight:700, color:T.text, fontFamily:T.fontHead, letterSpacing:"-0.4px" }}>Studios à la une</div>
        <div style={{ display:"flex", flexDirection:"column", gap:26 }}>
          {REAL_STUDIOS.map(s=>(
            <div key={s.id} onClick={()=>onSelectStudio?.(s.id)} role="button" tabIndex={0}
              style={{ display:"flex", alignItems:"center", gap:14, cursor:"pointer" }}>
              <StudioLogo initial={s.initial} size={52} fontSize={19}/>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:19, fontWeight:600, color:T.text, fontFamily:T.fontHead, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.name}</div>
                <div style={{ fontSize:14, color:T.textMuted, marginTop:2 }}>{s.games} jeu{s.games>1?"x":""} sur Rload</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StudioSpotlight({ games, onSelectGame, onTabChange, onSelectStudio }) {
  const kakudoGame = games.find(g => g.gameId === KAKUDO_SPOTLIGHT.gameId);
  const openKakudo = () => kakudoGame ? onSelectGame(kakudoGame) : onTabChange("games");
  return (
    <div style={{ padding:"0 32px", marginBottom:32, display:"flex", gap:32, alignItems:"stretch" }}>
      {/* Single full-bleed image, bottom overlay bar — matches Figma's studio card exactly.
          No floating collage/screenshot squares (removed per direct request). */}
      <div style={{ position:"relative", borderRadius:T.radiusLg, overflow:"hidden", minHeight:400, flex:"0 0 65%",
        border:`1px solid ${T.borderBrand}`, cursor:"pointer" }} onClick={openKakudo}>
        <img src={KAKUDO_SPOTLIGHT.bgImage} alt=""
          style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", objectPosition:"center 35%" }}
          onError={e=>e.currentTarget.style.display="none"}/>
        <div style={{ position:"absolute", top:16, left:16, fontSize:10.5, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", color:T.brandLight, textShadow:"0 2px 12px rgba(0,0,0,0.7)" }}>
          Studio Spotlight
        </div>
        <div style={{ position:"absolute", left:16, right:16, bottom:16, padding:"20px 24px", borderRadius:T.radius,
          background:"rgba(20,16,42,0.72)", backdropFilter:"blur(10px)" }} onClick={e=>e.stopPropagation()}>
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16, marginBottom:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12, minWidth:0 }}>
              <StudioLogo initial="B" size={44} fontSize={16}/>
              <div style={{ fontSize:26, fontWeight:700, color:T.text, fontFamily:T.fontHead, letterSpacing:"-0.3px" }}>
                {KAKUDO_SPOTLIGHT.studio}
              </div>
            </div>
            <button onClick={()=>onTabChange("studios")}
              style={{ flexShrink:0, padding:"9px 20px", borderRadius:T.radiusPill, background:T.brandGrad, color:"#fff",
                border:"none", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:T.fontBody }}>
              + Suivre
            </button>
          </div>
          <div style={{ fontSize:13, color:T.textMuted, marginBottom:8 }}>
            {KAKUDO_SPOTLIGHT.stats.join(" · ")}
          </div>
          <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", gap:16 }}>
            <div style={{ fontSize:14.5, color:"rgba(255,255,255,0.85)", lineHeight:1.5, maxWidth:640 }}>
              Meet the team behind Kakudo.
            </div>
            <button onClick={()=>onTabChange("studios")}
              style={{ flexShrink:0, padding:0, background:"none", border:"none", color:T.brandLight, fontSize:13,
                fontWeight:600, cursor:"pointer", fontFamily:T.fontBody, display:"flex", alignItems:"center", gap:6 }}>
              Voir le studio <Icon.ArrowRight/>
            </button>
          </div>
        </div>
      </div>
      <FeaturedStudiosSidebar onSelectStudio={onSelectStudio}/>
    </div>
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
// ─────────────────────────────────────────────────────────────────────────────
// HomePage — Figma "Home_Rload" layout: hero carousel, category filters, two
// game-grid rows, an upgrade banner, the studio spotlight, upcoming events,
// and the shared footer.
// ─────────────────────────────────────────────────────────────────────────────
// Slide backgrounds: Ravenfield keeps its real gameplay video (matches Figma's
// "Ready for Dev" hero exactly). Jelly Drift and Karlson have no hero-quality
// background asset yet — Figma's own mockup uses generic mood photography
// there too (not real screenshots), so these use the same placeholder
// convention: a high-quality stock photo, not a stretched cover thumbnail.
const HERO_SLIDES = [
  { gameId:"ravenfield",  title:"Ravenfield",  studio:"SteelRaven7", rating:"4.8", video:"./videos/ravenfield_highlight.mp4", image:HERO_IMAGE, tags:["FPS","Action","Solo"],
    description:"Solo battle against an AI enemy that always wins. Help the Blue side win, and singlehandedly fight your way to victory across the battlefield." },
  { gameId:"jelly-drift", title:"Jelly Drift", studio:"Wobble Games", rating:"4.5", image:HERO_IMAGE, tags:["Racing","Arcade","Party"],
    description:"An arcade racing game on ever-sliding jelly. Take impossible turns and stay in one piece." },
  // No hero-quality wallpaper for Below Decks — reuse its real portrait cover, object-fit:cover
  // crops it to fill the wide banner (the "resize if you don't find one" fallback). No real studio
  // on file for this game (catalog: studio:null), so `studio` stays unset — omitted in the UI
  // rather than invented.
  { gameId:"below-decks", title:"Below Decks", studio:null, rating:"4.5", image:LOCAL_COVERS["below-decks"], tags:["Indie","Unreal"],
    description:"Below Decks is an Unreal Engine game available on Rload." },
];

function HeroCarousel({ games, onSelectGame, onTabChange, height }) {
  const [index, setIndex] = useState(0);
  const [videoFailed, setVideoFailed] = useState(false);
  const slide = HERO_SLIDES[index];
  const go = (i) => { setIndex((i + HERO_SLIDES.length) % HERO_SLIDES.length); setVideoFailed(false); };
  const openSlide = () => {
    const matched = games.find(g => g.gameId === slide.gameId);
    matched ? onSelectGame(matched) : onTabChange("games");
  };

  return (
    <div style={{ position:"relative", height:height||"calc(100vh - 130px)", minHeight:height?undefined:560, overflow:"hidden", flexShrink:0, borderRadius:20, background:coverGradient(slide.gameId) }}>
      {/* Ravenfield keeps its original video background; other slides (no CDN video yet) use a static image. */}
      {slide.video && !videoFailed ? (
        <video key={slide.gameId} src={slide.video} autoPlay muted loop playsInline preload="auto"
          style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", objectPosition:"center 35%" }}
          onError={()=>setVideoFailed(true)}/>
      ) : (
        <img key={slide.gameId} src={slide.image} alt={slide.title}
          style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", objectPosition:"center 35%" }}
          onError={e=>{ e.currentTarget.style.display="none"; }}/>
      )}
      <div style={{ position:"absolute", inset:0, background:"linear-gradient(90deg, rgba(14,12,31,0.62) 0%, rgba(14,12,31,0.34) 45%, rgba(14,12,31,0.0) 100%)" }}/>
      <div style={{ position:"absolute", inset:0, background:"linear-gradient(0deg, rgba(14,12,31,0.68) 0%, rgba(14,12,31,0.37) 22%, transparent 65%)" }}/>

      <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", justifyContent:"flex-end", padding:"0 48px 48px", maxWidth:560 }}>
        <div style={{ fontSize:44, fontWeight:800, color:T.text, fontFamily:T.fontHead, letterSpacing:"-1px", lineHeight:1.05, marginBottom:10, textShadow:"0 2px 20px rgba(0,0,0,0.7)" }}>
          {slide.title}
        </div>
        <div style={{ fontSize:13, color:T.brandLight, fontWeight:600, marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
          {slide.studio && <>by {slide.studio} <span style={{ opacity:0.4 }}>·</span></>} <span style={{ color:"#ffffa6" }}>★ {slide.rating}</span>
        </div>
        <div style={{ fontSize:13.5, color:"rgba(255,255,255,0.72)", marginBottom:20, lineHeight:1.6, maxWidth:460 }}>
          {slide.description}
        </div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:22 }}>
          {slide.tags.map(tag=>(
            <span key={tag} style={{ fontSize:11, padding:"3px 10px", borderRadius:8, background:"rgba(255,255,255,0.08)", color:T.textMuted }}>{tag}</span>
          ))}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={openSlide}
            style={{ height:48, padding:"0 26px", borderRadius:14, background:T.brandGrad, color:"#fff", border:"none", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:T.fontBody, display:"flex", alignItems:"center", gap:9, boxShadow:T.brandGlow }}>
            <Icon.Play/> Play Now
          </button>
          <button onClick={openSlide}
            style={{ height:48, padding:"0 26px", borderRadius:14, background:"rgba(255,255,255,0.1)", border:`1px solid ${T.border}`, color:T.text, fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:T.fontBody }}>
            View Details
          </button>
        </div>
      </div>

      {/* Prev / next + dots — bottom-center, matching the Figma hero exactly. */}
      <div style={{ position:"absolute", left:"50%", bottom:24, transform:"translateX(-50%)", display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={()=>go(index-1)} aria-label="Previous slide"
            style={{ width:36, height:36, borderRadius:14, background:"rgba(255,255,255,0.1)", border:`1px solid ${T.border}`, color:T.text, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Icon.ChevronLeft/>
          </button>
          <button onClick={()=>go(index+1)} aria-label="Next slide"
            style={{ width:36, height:36, borderRadius:14, background:"rgba(255,255,255,0.1)", border:`1px solid ${T.border}`, color:T.text, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Icon.ChevronRight/>
          </button>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          {HERO_SLIDES.map((s,i)=>(
            <button key={s.gameId} onClick={()=>go(i)} aria-label={`Go to slide ${i+1}`}
              style={{ width:i===index?24:6, height:6, borderRadius:999, border:"none", cursor:"pointer",
                background:i===index?"#fff":"rgba(255,255,255,0.35)", transition:"width 0.2s ease" }}/>
          ))}
        </div>
      </div>
    </div>
  );
}

// "In my library" — Figma pairs the Games-page hero with a sidebar list of the
// player's own installed games. Real data only (uiByGame-filtered `games`, passed
// in by the caller) — no placeholder titles.
function InMyLibraryWidget({ games, onSelectGame }) {
  return (
    <div style={{ flex:"0 0 280px", background:"rgba(128,74,240,0.14)", border:`1px solid ${T.borderBrand}`,
      borderRadius:T.radiusLg, padding:"22px 20px", display:"flex", flexDirection:"column", gap:16, overflowY:"auto" }}
      className="hide-scrollbar">
      <div style={{ fontSize:19, fontWeight:700, color:T.text, fontFamily:T.fontHead }}>In my library</div>
      {games.length===0 && <div style={{ fontSize:12.5, color:T.textMuted }}>No games installed yet.</div>}
      {games.slice(0,6).map(g=>(
        <div key={g.gameId} onClick={()=>onSelectGame(g)} role="button" tabIndex={0}
          style={{ display:"flex", alignItems:"center", gap:12, cursor:"pointer" }}>
          <img src={LOCAL_COVERS[g.gameId]||g.thumbnail||g.coverUrl||"./images/games/default_game_cover.png"} alt={g.title}
            style={{ width:44, height:44, borderRadius:10, objectFit:"cover", flexShrink:0, background:"#0a0914" }}
            onError={e=>{ e.currentTarget.src="./images/games/default_game_cover.png"; e.currentTarget.onerror=null; }}/>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:14.5, fontWeight:600, color:T.text, fontFamily:T.fontHead, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{g.title||g.gameId}</div>
            <div style={{ display:"flex", gap:6, marginTop:3 }}>
              {(g.genres||g.tags||[]).slice(0,2).map(tag=>(
                <span key={tag} style={{ fontSize:10.5, padding:"2px 8px", borderRadius:999, background:"rgba(255,255,255,0.08)", color:T.textMuted }}>{tag}</span>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Category filter chips — a browse aid; selecting one jumps to the Games tab. ──
const HOME_CATEGORIES = ["All","Action","Adventure","FPS","Racing","Platformer","Casual","Indie","RPG","Sports"];
function CategoryFilterBar({ onTabChange }) {
  const [active, setActive] = useState("All");
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:24, padding:"20px 32px", background:"rgba(26,7,55,0.77)" }}>
      <div style={{ display:"flex", flex:1, justifyContent:"space-between", flexWrap:"wrap" }}>
        {HOME_CATEGORIES.map(cat=>(
          <button key={cat} onClick={()=>{ setActive(cat); onTabChange("games"); }}
            style={{ padding:"7px 16px", borderRadius:999, border:"none", cursor:"pointer", fontSize:13.5, fontWeight:500, fontFamily:T.fontBody,
              background:active===cat ? T.brand : T.bgMid, color:active===cat ? "#fff" : T.textMuted,
              boxShadow:active===cat ? "0 2px 12px rgba(124,92,252,0.35)" : "none", whiteSpace:"nowrap" }}>
            {cat}
          </button>
        ))}
      </div>
      <button onClick={()=>onTabChange("search")} aria-label="Search games"
        style={{ width:44, height:44, borderRadius:999, background:"rgba(255,255,255,0.08)", border:`1px solid ${T.textDim}`, color:T.textMuted, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
        <Icon.Search/>
      </button>
    </div>
  );
}

// ── Deterministic ~3.8–4.9 rating per title — same fabricated-mockup-rating convention the hero already used (a hardcoded "★ 4.8"). ──
function mockRating(title) {
  const n = (title||"").split("").reduce((a,c)=>a+c.charCodeAt(0),0);
  return (3.8 + (n % 12) / 10).toFixed(1);
}

// ── HomeGameCard — full-bleed portrait cover, gradient title block, genre pill + rating, like toggle. ──
function HomeGameCard({ title, gameId, imageUrl, imagePosition, genre, onSelect }) {
  const [liked, toggleLiked] = useIsFavorite(gameId);
  return (
    <div onClick={onSelect} role="button" tabIndex={0} onKeyDown={e=>(e.key==="Enter"||e.key===" ")&&onSelect()}
      style={{ position:"relative", borderRadius:16, overflow:"hidden", cursor:"pointer", aspectRatio:"259/353", background:coverGradient(title) }}>
      <img src={imageUrl} alt={title} style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", objectPosition:imagePosition||"center" }}
        onError={e=>{ e.currentTarget.style.display="none"; }}/>
      {/* Light bottom-only scrim for text legibility — no full-cover dark holo; covers stay vibrant, like Figma. */}
      <div style={{ position:"absolute", left:0, right:0, bottom:0, height:"55%", background:"linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.75) 100%)" }}/>
      <button onClick={e=>{ e.stopPropagation(); toggleLiked(); }} aria-label="Like"
        style={{ position:"absolute", top:12, right:12, width:32, height:32, borderRadius:16, background:"rgba(0,0,0,0.35)", border:"1px solid rgba(255,255,255,0.14)", color:liked?T.brandLight:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>
        {liked ? "♥" : "♡"}
      </button>
      <div style={{ position:"absolute", left:0, right:0, bottom:0, padding:16 }}>
        <div style={{ fontSize:28, fontWeight:700, color:"#fff", fontFamily:T.fontHead, marginBottom:8, textShadow:"0 2px 12px rgba(0,0,0,0.6)" }}>{title}</div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ padding:"5px 14px", borderRadius:999, background:T.brand, color:"rgba(255,255,255,0.9)", fontSize:12, fontWeight:500 }}>{genre}</span>
          <span style={{ fontSize:12, fontWeight:600, color:"#ffffa6" }}>★ {mockRating(title)}</span>
        </div>
      </div>
    </div>
  );
}

function HomeGameGrid({ items, onSelectGame, onTabChange }) {
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(5, 1fr)", gap:14 }}>
      {items.map(item=>(
        <HomeGameCard key={item.title} title={item.title} gameId={item.game?.gameId} imageUrl={item.imageUrl} imagePosition={item.imagePosition}
          genre={Array.isArray(item.genre) ? item.genre[0] : item.genre}
          onSelect={()=>item.game && onSelectGame ? onSelectGame(item.game) : onTabChange("games")}/>
      ))}
    </div>
  );
}

// ── Upgrade banner — routes to Profile/Membership, the closest existing destination. ──
function UpgradeBanner({ onTabChange }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:24, padding:"22px 24px", background:"linear-gradient(90deg, #4306a6 0%, #33077e 100%)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:16 }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#FFC24B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7Z"/>
        </svg>
        <span style={{ fontSize:20, fontWeight:700, color:"#fff", fontFamily:T.fontHead, letterSpacing:"0.3px" }}>Upgrade your plan</span>
      </div>
      <button onClick={()=>onTabChange("profile")}
        style={{ padding:"10px 24px", borderRadius:14, border:"none", cursor:"pointer", fontSize:14, fontWeight:600, fontFamily:T.fontBody, color:"#fff",
          background:"linear-gradient(163deg, rgba(124,92,252,1) 0%, rgba(124,92,252,0.8) 100%)", boxShadow:"0 4px 24px rgba(124,92,252,0.4)" }}>
        Upgrade
      </button>
    </div>
  );
}

function HomePage({ games, onSelectGame, onTabChange, onSelectStudio }) {
  const now = new Date();
  const nextEvents = UPCOMING_EVENTS
    .filter(ev => new Date(`${ev.day} ${ev.month} 2026`) >= now)
    .sort((a,b)=> new Date(`${a.day} ${a.month} 2026`) - new Date(`${b.day} ${b.month} 2026`))
    .slice(0,2);

  // "Games": curated for cover art that actually shows the game's name/branding
  // (per direct request) rather than pure hero/spotlight exclusion — Ravenfield
  // and Karlson are welcome back here even though they're also the hero/were the
  // hero, since their covers are clearly branded; UMS Quest and Balls? (generic,
  // unbranded covers) are dropped. Jelly Drift/Below Decks (hero slides 2-3) and
  // Kakudo (studio spotlight, same page) stay excluded to avoid repeating the
  // exact same card twice in view. Figma's "Games" section (verified in Dev
  // Mode) is 2 rows of 5 (10 cards) — with a 14-game catalog and this curation,
  // there are 9 candidates, so the second row renders 4 rather than inventing a
  // 10th.
  const featuredIds = new Set(["jelly-drift", KAKUDO_SPOTLIGHT.gameId]);
  const weakCoverIds = new Set(["ums-quest","balls"]);
  const remainingGames = games.filter(g=>!featuredIds.has(g.gameId) && !weakCoverIds.has(g.gameId));
  const gamesRow     = remainingGames.slice(0,10).map((g,i)=>gameToRankedItem(g,i+1));
  const communityRow = [...remainingGames].reverse().slice(0,5).map((g,i)=>gameToRankedItem(g,i+1));

  return (
    <div style={{ flex:1, overflowY:"auto", fontFamily:T.fontBody, scrollBehavior:"smooth" }}>
      <div style={{ padding:"24px 24px 12px" }}>
        <HeroCarousel games={games} onSelectGame={onSelectGame} onTabChange={onTabChange}/>
      </div>

      <CategoryFilterBar onTabChange={onTabChange}/>

      <div style={{ padding:"40px 32px 0" }}>
        <SectionHeader title="Games" onMore={()=>onTabChange("games")}/>
        <HomeGameGrid items={gamesRow} onSelectGame={onSelectGame} onTabChange={onTabChange}/>
      </div>

      <div style={{ margin:"40px 0" }}>
        <UpgradeBanner onTabChange={onTabChange}/>
      </div>

      {/* ── Studio Spotlight — real studio, real game (Bad Weather Studios / KAKUDO). No invented quote. ── */}
      <StudioSpotlight games={games} onSelectGame={onSelectGame} onTabChange={onTabChange} onSelectStudio={onSelectStudio}/>

      <div style={{ padding:"8px 32px 0", marginBottom:40 }}>
        <SectionHeader title="Community Favorite" onMore={()=>onTabChange("games")}/>
        <HomeGameGrid items={communityRow} onSelectGame={onSelectGame} onTabChange={onTabChange}/>
      </div>

      {/* ── Events — same page background as the rest of Home (no special band), no subtitle, "See more" — 2 max on Home; the rest lives on the Events tab ── */}
      <div style={{ padding:"8px 32px 0", marginBottom:32 }}>
        <SectionHeader title="Events" onMore={()=>onTabChange("events")} moreLabel="See more"/>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:14 }}>
          {nextEvents.map(ev=><EventCard key={ev.id} ev={ev} showThumbnail={true} thumbSize={168}/>)}
        </div>
      </div>

      {/* ── Footer — same footer as every other page, kept for cross-page consistency. ── */}
      <AppFooter onTabChange={onTabChange}/>
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
      textTransform:"uppercase", padding:"28px 14px 8px", userSelect:"none", fontFamily:T.fontBody }}>
      {label}
    </div>
  );
}

// SidebarNavItem — Apple TV-inspired floating sidebar, adapted to Rload's purple identity
function SidebarNavItem({ icon, label, active, onClick, badge, disabled }) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={disabled?undefined:onClick}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ display:"flex", alignItems:"center", gap:10, padding:"0 12px", height:44,
        borderRadius:10, cursor:disabled?"default":"pointer", userSelect:"none", margin:"1px 0",
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

  // ── Favorites (shared FAVORITES_KEY/EVENT — same source hearts on Home/Games grid use,
  // so liking a game anywhere shows up here and vice versa) ────────────────────────
  const [favorites, setFavorites] = useState(getFavoriteIds);
  useEffect(() => {
    const onChange = () => setFavorites(getFavoriteIds());
    window.addEventListener(FAVORITES_EVENT, onChange);
    return () => window.removeEventListener(FAVORITES_EVENT, onChange);
  }, []);
  const toggleFavorite = (gameId) => setFavorites(toggleFavoriteId(gameId));

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

  // ── Grid games based on sidebar view ─────────────────────────────────────
  const getGridGames = () => {
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
    : "Games";

  // ── Featured: prefer real CDN games, pad with FEATURED_PLACEHOLDERS ─────
  const featuredReal = realGames.slice(0, 3);
  const featuredPad  = FEATURED_PLACEHOLDERS.slice(0, Math.max(0, 3 - featuredReal.length));
  const featuredCards = [...featuredReal, ...featuredPad];

  return (
    <div style={{ display:"flex", flex:1, overflow:"hidden", fontFamily:T.fontBody }}>

      {/* ── LEFT SIDEBAR — floating frosted-glass panel, Apple TV-inspired, Rload identity ─── */}
      <div style={{ width:240, flexShrink:0, display:"flex", flexDirection:"column",
        margin:"20px 0 20px 20px", borderRadius:22,
        background:"rgba(20,20,22,0.78)", backdropFilter:"blur(22px)", WebkitBackdropFilter:"blur(22px)",
        border:"1px solid rgba(255,255,255,0.06)",
        boxShadow:"0 8px 32px rgba(0,0,0,0.35)",
        overflowY:"auto", overflowX:"hidden" }} className="hide-scrollbar">

        <div style={{ flex:1, padding:"20px 10px 0" }}>

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

          {/* SYSTEM */}
          <SidebarSectionLabel label="System"/>
          <SidebarNavItem icon="⚙️" label="Settings" active={false} onClick={()=>onTabChange?.("profile")}/>
          <SidebarNavItem icon="💬" label="Support"  active={false} onClick={()=>openExternal("https://rload.be/support")}/>
          {/* status.rload.be does not exist yet — disabled rather than linking
              to a dead page. Re-enable once a real status page is live. */}
          <SidebarNavItem icon="🟢" label="Status"   active={false} disabled={true} onClick={()=>{}}/>
        </div>

        {/* Upgrade widget — same destination as Home's UpgradeBanner/CTA, no subscription
            check here (that banner is shown unconditionally elsewhere in the app too). */}
        <div style={{ margin:"16px 12px", padding:"20px 16px", borderRadius:16, flexShrink:0,
          background:"linear-gradient(163deg, rgba(124,92,252,1) 0%, rgba(88,46,214,1) 100%)",
          display:"flex", flexDirection:"column", alignItems:"center", gap:12, textAlign:"center" }}>
          <span style={{ fontSize:22 }}>👑</span>
          <div style={{ fontSize:15, fontWeight:700, color:"#fff", fontFamily:T.fontHead, lineHeight:1.2 }}>Upgrade your plan</div>
          <button onClick={()=>openExternal("https://rload.be/pricing?source=launcher")}
            style={{ padding:"8px 20px", borderRadius:999, background:"rgba(255,255,255,0.16)", border:"1px solid rgba(255,255,255,0.3)", color:"#fff", fontSize:12.5, fontWeight:600, cursor:"pointer", fontFamily:T.fontBody }}>
            See now
          </button>
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
                Figma hero — same featured HeroCarousel as Home, paired with a
                real "In my library" list (installed games only, no placeholders).
            ═══════════════════════════════════════════════════════ */}
            {sidebarView==="all" && !search && (
              <div style={{ padding:"20px 22px 0", display:"flex", gap:20, alignItems:"stretch" }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <HeroCarousel games={games} onSelectGame={onSelectGame} onTabChange={onTabChange} height={420}/>
                </div>
                <InMyLibraryWidget games={installed} onSelectGame={onSelectGame}/>
              </div>
            )}

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
                  <span style={{ fontSize:11, color:T.textDim }}>{gridGames.length} games</span>
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

function SubPageShell({ title, onBack, children, t }) {
  return (
    <div style={{ flex:1, overflowY:"auto", fontFamily:T.fontBody, scrollBehavior:"smooth" }}>
      <div style={{ padding:"20px 28px 0", display:"flex", alignItems:"center", gap:12, borderBottom:`1px solid ${T.border}`, paddingBottom:16 }}>
        <div onClick={onBack} style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", color:T.textMuted, fontSize:13, padding:"5px 10px", borderRadius:T.radiusSm, background:"rgba(255,255,255,0.04)", border:`1px solid ${T.border}`, userSelect:"none" }}>
          <Icon.ChevronLeft/> {t?.backToProfile || "Back"}
        </div>
        <div style={{ fontSize:17, fontWeight:700, color:T.text, fontFamily:T.fontHead, letterSpacing:"-0.2px" }}>{title}</div>
      </div>
      <div style={{ padding:"24px 28px" }}>{children}</div>
    </div>
  );
}

const COUNTRY_OPTIONS = [
  { code:"BE", label:"Belgique" }, { code:"FR", label:"France" }, { code:"NL", label:"Nederland" },
  { code:"DE", label:"Deutschland" }, { code:"LU", label:"Luxembourg" }, { code:"CH", label:"Suisse" },
  { code:"OTHER", label:"Other / Autre" },
];

function DisplayNameField({ label, value, fallback, t }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || fallback || "");

  const startEdit = () => { setDraft(value || fallback || ""); setEditing(true); };
  const save = () => { setPlayerDisplayName(draft); setEditing(false); };
  const cancel = () => setEditing(false);

  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ fontSize:11.5, fontWeight:600, color:T.textMuted, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.07em" }}>{label}</div>
      {editing ? (
        <div style={{ display:"flex", gap:8 }}>
          <input
            autoFocus value={draft} maxLength={32}
            onChange={(e)=>setDraft(e.target.value)}
            onKeyDown={(e)=>{ if (e.key==="Enter") save(); if (e.key==="Escape") cancel(); }}
            style={{ flex:1, padding:"11px 14px", borderRadius:T.radiusSm, background:"rgba(255,255,255,0.06)", border:`1px solid ${T.borderBrand}`, fontSize:13.5, color:T.text, fontFamily:T.fontBody }}
          />
          <button onClick={save} style={{ padding:"0 16px", borderRadius:T.radiusSm, border:"none", background:T.brandGrad, color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:T.fontBody }}>
            {t.saveLabel || "Save"}
          </button>
          <button onClick={cancel} style={{ padding:"0 16px", borderRadius:T.radiusSm, border:`1px solid ${T.border}`, background:"transparent", color:T.textMuted, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:T.fontBody }}>
            {t.cancelLabel || "Cancel"}
          </button>
        </div>
      ) : (
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ flex:1, padding:"11px 14px", borderRadius:T.radiusSm, background:"rgba(255,255,255,0.04)", border:`1px solid ${T.border}`, fontSize:13.5, color:T.text }}>{value || fallback || "—"}</div>
          <button onClick={startEdit} style={{ padding:"0 16px", height:"100%", borderRadius:T.radiusSm, border:`1px solid ${T.border}`, background:"rgba(255,255,255,0.04)", color:T.text, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:T.fontBody, flexShrink:0 }}>
            {t.editLabel || "Edit"}
          </button>
        </div>
      )}
    </div>
  );
}

function ProfileDetailsPage({ user, profile, lang, subscriptionLabel, memberSinceLabel, t, onBack }) {
  const field = (label, value) => (
    <div style={{ marginBottom:16 }}>
      <div style={{ fontSize:11.5, fontWeight:600, color:T.textMuted, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.07em" }}>{label}</div>
      <div style={{ padding:"11px 14px", borderRadius:T.radiusSm, background:"rgba(255,255,255,0.04)", border:`1px solid ${T.border}`, fontSize:13.5, color:T.text }}>{value||"—"}</div>
    </div>
  );
  const avatar = findAvatar(profile.avatarId);
  const banner = findBanner(profile.bannerId);
  const badge  = profile.activeBadgeId ? findBadge(profile.activeBadgeId) : null;
  const langLabel = { en:"English", fr:"Français", nl:"Nederlands" }[lang] || lang;
  const thumb = (src, name, round) => (
    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
      <div style={{ width:32, height:32, borderRadius: round ? "50%" : 6, overflow:"hidden", border:`1px solid ${T.borderBrand}`, flexShrink:0 }}>
        <img src={src} alt={name} style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
      </div>
      <span>{name}</span>
    </div>
  );
  return (
    <SubPageShell title={t.profileDetails || "Profile Details"} onBack={onBack} t={t}>
      <div style={{ maxWidth:420 }}>
        <DisplayNameField label={t.displayNameLabel || "Display Name"} value={profile.displayName} fallback={user?.name||user?.email?.split("@")[0]||"User"} t={t}/>
        {field("Email", user?.email)}
        {field(t.avatarLabel || "Avatar", avatar ? thumb(avatar.asset, avatar.name, true) : "—")}
        {field(t.bannerLabel || "Banner", banner ? thumb(banner.asset, banner.name || banner.title, false) : "—")}
        {field(t.badgeLabel || "Badge", badge ? thumb(badge.asset, badge.name, true) : (t.noneLabel || "None"))}
        {field(t.language, langLabel)}
        {field(t.memberSinceStat || "Member Since", memberSinceLabel)}
        {field(t.subscriptionStat || "Subscription", subscriptionLabel)}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11.5, fontWeight:600, color:T.textMuted, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.07em" }}>{t.countryLabel || "Country"}</div>
          <select
            value={profile.country || ""}
            onChange={(e)=>setPlayerCountry(e.target.value || undefined)}
            style={{ width:"100%", padding:"11px 14px", borderRadius:T.radiusSm, background:"rgba(255,255,255,0.04)", border:`1px solid ${T.border}`, fontSize:13.5, color:T.text, fontFamily:T.fontBody, cursor:"pointer" }}
          >
            <option value="" style={{ background:T.bgMid }}>—</option>
            {COUNTRY_OPTIONS.map(c => <option key={c.code} value={c.code} style={{ background:T.bgMid }}>{c.label}</option>)}
          </select>
        </div>
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
const NOTIFICATION_DEFAULTS = { push: true, email: false, newReleases: true };

function NotificationsPage({ onBack, t }) {
  const [prefs, setPrefs] = useState(null); // null while loading — avoids flashing defaults then flipping

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const saved = await window.rload?.settings?.get?.();
        if (alive) setPrefs({ ...NOTIFICATION_DEFAULTS, ...(saved?.notifications || {}) });
      } catch { if (alive) setPrefs(NOTIFICATION_DEFAULTS); }
    })();
    return () => { alive = false; };
  }, []);

  const update = (key, value) => {
    setPrefs(prev => {
      const next = { ...prev, [key]: value };
      window.rload?.settings?.set?.({ notifications: next }).catch(() => {});
      return next;
    });
  };

  if (!prefs) return <SubPageShell title={t.notifications} onBack={onBack} t={t}><div/></SubPageShell>;

  return (
    <SubPageShell title={t.notifications} onBack={onBack} t={t}>
      <div style={{ maxWidth:420 }}>
        <NotifRow label={t.pushNotifications}  desc={t.receiveAlerts}   on={prefs.push}        setOn={(v)=>update("push", v)}/>
        <NotifRow label={t.emailNotifications} desc={t.getUpdatesEmail} on={prefs.email}       setOn={(v)=>update("email", v)}/>
        <NotifRow label={t.newReleases}        desc={t.notifyNewGames}  on={prefs.newReleases} setOn={(v)=>update("newReleases", v)}/>
      </div>
    </SubPageShell>
  );
}

function LanguagePage({ lang, changeLang, onBack, t }) {
  const LANGS_LIST = [
    { code:"en", label:"English",    native:"English"    },
    { code:"fr", label:"French",     native:"Français"   },
    { code:"nl", label:"Dutch",      native:"Nederlands" },
  ];
  return (
    <SubPageShell title={t.language} onBack={onBack} t={t}>
      <div style={{ maxWidth:380 }}>
        <div style={{ fontSize:12, color:T.textDim, marginBottom:16 }}>{t.chooseLanguage}</div>
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

function PrivacyPage({ onBack, t }) {
  return (
    <SubPageShell title={t.privacy} onBack={onBack} t={t}>
      <div style={{ maxWidth:420 }}>
        <div style={{ padding:"18px 16px", borderRadius:T.radius, background:"rgba(255,255,255,0.03)", border:`1px solid ${T.border}`, marginBottom:14 }}>
          <div style={{ fontSize:13.5, fontWeight:600, color:T.text, marginBottom:8 }}>{t.dataPrivacy}</div>
          <div style={{ fontSize:12.5, color:T.textMuted, lineHeight:1.65 }}>{t.dataPrivacyBody}</div>
        </div>
        <div style={{ padding:"18px 16px", borderRadius:T.radius, background:"rgba(255,255,255,0.03)", border:`1px solid ${T.border}` }}>
          <div style={{ fontSize:13.5, fontWeight:600, color:T.text, marginBottom:8 }}>{t.security}</div>
          <div style={{ fontSize:12.5, color:T.textMuted, lineHeight:1.65 }}>{t.securityBody}</div>
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
function LauncherInfoPage({ onBack, user, t }) {
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
    <SubPageShell title={t.launcherInformation || "Launcher Information"} onBack={onBack} t={t}>
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

            {/* Diagnostics — moved here from Profile Details (technical, not identity) */}
            <div style={{ fontSize: 10, fontWeight: 700, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.08em", margin: "20px 0 10px" }}>Diagnostics</div>
            <InfoField label="User ID"       value={user?.sub?.split("|").pop()?.substring(0,16)}/>
            <InfoField label="Auth Provider" value={user?.sub?.includes("google")?"Google":user?.sub?.includes("auth0")?"Email / Password":"Auth0"}/>
          </>
        ) : (
          <div style={{ padding: 32, textAlign: "center", color: T.textDim, fontSize: 13 }}>Loading…</div>
        )}
      </div>
    </SubPageShell>
  );
}

function MembershipPage({ onBack, t, subscriptionLabel, subscriptionStatus, demoMode }) {
  const periodEnd = subscriptionStatus?.currentPeriodEnd
    ? new Date(subscriptionStatus.currentPeriodEnd).toLocaleDateString()
    : null;
  return (
    <SubPageShell title={t.membership || "Membership"} onBack={onBack} t={t}>
      <div style={{ maxWidth:420 }}>
        <div style={{ padding:"18px 16px", borderRadius:T.radius, background:"rgba(128,74,240,0.08)", border:`1px solid ${T.borderBrand}`, marginBottom:14 }}>
          <div style={{ fontSize:11, color:T.textMuted, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>{t.subscriptionStat || "Subscription"}</div>
          <div style={{ fontSize:17, fontWeight:700, color:T.text, fontFamily:T.fontHead }}>{subscriptionLabel}</div>
          {periodEnd && <div style={{ fontSize:12, color:T.textMuted, marginTop:6 }}>Renews {periodEnd}</div>}
          {demoMode && <div style={{ fontSize:11, color:T.orange, marginTop:6 }}>Demo build — subscription gates bypassed locally.</div>}
        </div>
        <button onClick={()=>openExternal("https://rload.be/pricing?source=launcher")}
          style={{ width:"100%", padding:"12px 16px", borderRadius:T.radius, border:`1px solid ${T.borderBrand}`,
            background:T.brandGrad, boxShadow:T.brandGlow, color:"#fff", fontSize:13.5, fontWeight:700, cursor:"pointer", fontFamily:T.fontBody }}>
          Manage Subscription
        </button>
      </div>
    </SubPageShell>
  );
}

function ProfilePage({ user, authBusy, onLogout, games, uiByGame, lang, changeLang, subscriptionStatus, demoMode }) {
  const [subPage, setSubPage] = useState(null);
  const [displayMode, setDisplayMode] = useState("dark");
  // Hooks must run unconditionally on every render — declared before the sub-page early returns below.
  const [profileFavorites] = useState(() => {
    try { return getFavoriteIds(); }
    catch { return new Set(); }
  });
  const INSTALLED_SET = new Set([UI.INSTALLED,UI.RUNNING,UI.UPDATE_AVAILABLE,UI.INSTALLED_NO_EXE]);
  const installed = games.filter(g=>INSTALLED_SET.has(uiByGame[g.gameId]||UI.IDLE));
  const [cosmeticsTab, setCosmeticsTab] = useState(null); // "avatar" | "banner" | "badge" | null
  const [profile, setProfile] = useState(null);
  const t = LANGS[lang] || LANGS.en;

  const username = profile?.displayName || user?.name || user?.email?.split("@")[0] || "User";

  useEffect(() => {
    let unsub = () => {};
    getPlayerProfile(user?.sub).then(() => {
      unsub = subscribePlayerProfile(setProfile);
    });
    return () => unsub();
  }, [user?.sub]);

  const profileWeeklyMins = parseInt(localStorage.getItem(getWeekKey())||"0", 10);
  const overviewStats = [
    { icon:"./images/games/icons/gamepad.png",       label:"Total Games",        value: games.length             },
    { icon:"./images/games/icons/download_icon.png", label:"Installed",          value: installed.length         },
    { icon:"./images/games/icons/noto_star.png",     label:"Favorites",          value: profileFavorites.size    },
    { icon:"./images/games/icons/hourglass.png",     label:"This Week",          value: formatPlaytime(profileWeeklyMins) },
  ];
  const subscriptionLabel = demoMode
    ? (t.subscriptionDemo || "Demo Mode")
    : subscriptionStatus?.hasAccess
      ? (subscriptionStatus.planName || t.subscriptionPremium || "Premium")
      : (t.subscriptionFree || "Free");

  const memberSinceLabel = profile
    ? new Date(profile.memberSince).toLocaleDateString(lang === "en" ? "en-US" : lang, { year: "numeric", month: "short" })
    : "—";

  if (subPage === "profile-details" && profile) {
    return <ProfileDetailsPage user={user} profile={profile} lang={lang} subscriptionLabel={subscriptionLabel} memberSinceLabel={memberSinceLabel} t={t} onBack={()=>setSubPage(null)}/>;
  }
  if (subPage === "achievements" && profile) {
    return <AchievementsPage profile={profile} t={t} onBack={()=>setSubPage(null)}/>;
  }
  if (subPage === "membership") {
    return <MembershipPage t={t} subscriptionLabel={subscriptionLabel} subscriptionStatus={subscriptionStatus} demoMode={demoMode} onBack={()=>setSubPage(null)}/>;
  }
  if (subPage === "notifications")  return <NotificationsPage t={t} onBack={()=>setSubPage(null)}/>;
  if (subPage === "language")       return <LanguagePage lang={lang} changeLang={changeLang} t={t} onBack={()=>setSubPage(null)}/>;
  if (subPage === "privacy")        return <PrivacyPage t={t} onBack={()=>setSubPage(null)}/>;
  if (subPage === "launcher-info")  return <LauncherInfoPage user={user} t={t} onBack={()=>setSubPage(null)}/>;

  if (!profile) {
    return <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:T.textDim, fontSize:13 }}>Loading…</div>;
  }

  return (
    <div style={{ flex:1, overflowY:"auto", fontFamily:T.fontBody, scrollBehavior:"smooth" }}>
      <ProfileHeader
        profile={profile} username={username}
        subscriptionLabel={subscriptionLabel} memberSinceLabel={memberSinceLabel}
        t={t} onOpenCosmetics={(tab)=>setCosmeticsTab(tab || "avatar")}
        onOpenAchievements={()=>setSubPage("achievements")}
      />

      {/* Membership — the only remaining "tile" outside Settings, since it's
          the one thing a player checks often (renewal date, plan). */}
      <div style={{ padding:"0 20px 16px" }}>
        <div onClick={()=>setSubPage("membership")} style={{ padding:"13px 16px", borderRadius:T.radiusSm,
          background:"rgba(255,255,255,0.05)", border:`1px solid ${T.border}`,
          display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:"0.6rem", background:"rgba(128,74,240,0.15)", border:`1px solid ${T.borderBrand}`, display:"flex", alignItems:"center", justifyContent:"center", color:T.brandLight }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            </div>
            <span style={{ fontSize:13, fontWeight:600, color:T.text }}>{t.membership || "Membership"}</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8, color:T.textMuted }}>
            <span style={{ fontSize:12 }}>{subscriptionLabel}</span>
            <Icon.ChevronRight/>
          </div>
        </div>
      </div>

      {/* Settings list */}
      <div style={{ padding:"16px 20px" }}>
        <div style={{ fontSize:11, fontWeight:700, color:T.textMuted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8, paddingLeft:6 }}>{t.settings}</div>
        <div style={{ borderRadius:T.radius, background:T.bgCard, border:`1px solid ${T.border}`, overflow:"hidden" }}>
          <SettingsRow icon={Icon.Profile}   label={t.profileDetails || "Profile Details"}  onClick={()=>setSubPage("profile-details")}/>
          <div style={{ height:1, background:T.border, margin:"0 16px" }}/>
          <SettingsRow icon={Icon.Bell}      label={t.notifications}   onClick={()=>setSubPage("notifications")}/>
          <div style={{ height:1, background:T.border, margin:"0 16px" }}/>
          <SettingsRow icon={Icon.Globe}     label={t.language}           onClick={()=>setSubPage("language")}/>
          <div style={{ height:1, background:T.border, margin:"0 16px" }}/>
          <SettingsRow icon={Icon.Shield}    label={t.privacy}            onClick={()=>setSubPage("privacy")}/>
          <div style={{ height:1, background:T.border, margin:"0 16px" }}/>
          <SettingsRow icon={Icon.About}     label={t.launcherInformation || "Launcher Information"} onClick={()=>setSubPage("launcher-info")}/>
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

      {cosmeticsTab && (
        <CosmeticsPickerModal profile={profile} t={t} initialTab={cosmeticsTab} onClose={()=>setCosmeticsTab(null)}/>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Studios, My Rload, Search — Figma "Wireframes" pages with no prior
// implementation. Reuses T tokens, Icon set, coverGradient, EventCard,
// SectionHeader, HomeGameCard, AppFooter, and the games/UPCOMING_EVENTS data
// already used elsewhere in this file.
// ─────────────────────────────────────────────────────────────────────────────
// REAL_STUDIOS — only the studios the catalog actually names (`game.studio`
// non-null): New Blood Interactive, SteelRaven7, Dani, Bad Weather Studios.
// Used wherever a claim of real activity is implied (Home's "Studios à la
// une" sidebar, "Studios suivis" on My Rload) — never padded with mockups.
const REAL_STUDIOS = [
  { id:"new-blood",   name:"New Blood Interactive", initial:"N", country:"États-Unis", founded:2016, genre:"Action",   games:1, gameTitle:"ULTRAKILL",
    location:"Los Angeles, USA", tagline:"Loud games, made by people who mean it.",
    bio:"New Blood Interactive started as a scrappy publishing label for games that were too loud, too fast, or too strange for anyone else to take a chance on. What began as prototypes traded in Discord DMs has grown into a home for retro-inspired shooters and cult classics, built by solo developers and small teams who'd rather ship something weird than safe. The philosophy hasn't changed since day one: back the games that make noise.",
    team:[ {initials:"AP", name:'Arsi "Hakita" Patala', role:"Founder & Creative Director"}, {initials:"DR", name:"Dillon Rogers", role:"Community Lead"}, {initials:"LW", name:"Leo Wolfe", role:"Art Director"}, {initials:"SE", name:"Sam Ecoff", role:"Composer"} ] },
  { id:"kakudo",      name:"Bad Weather Studios",    initial:"B", country:"Belgique",                  genre:"Aventure", games:1, gameTitle:"KAKUDO",
    bio:KAKUDO_SPOTLIGHT.bioParagraphs.join(" ") },
  { id:"steelraven7", name:"SteelRaven7",            initial:"S",                                      genre:"Action",   games:1, gameTitle:"Ravenfield" },
  { id:"dani",        name:"Dani",                   initial:"D",                                      genre:"Action",   games:1, gameTitle:"KARLSON" },
];
// STUDIOS — the Studios listing/detail pages, per explicit direction: put back
// exactly what Figma's mockup shows (same fields/style Pam used — country,
// founding year, genre, game count), clearly as placeholder content sized for
// ~30 studios, so it's a straight data swap once real studios onboard. Two
// entries (new-blood, kakudo) are kept accurate since we already have the real
// data for them; the rest are Figma's own invented roster, not fabricated here.
const STUDIOS = [
  { id:"new-blood",      name:"New Blood Interactive",   initial:"N", country:"États-Unis",     founded:2016, genre:"Action",     games:1, gameTitle:"ULTRAKILL",
    location:"Los Angeles, USA", tagline:"Loud games, made by people who mean it.",
    bio:"New Blood Interactive started as a scrappy publishing label for games that were too loud, too fast, or too strange for anyone else to take a chance on. What began as prototypes traded in Discord DMs has grown into a home for retro-inspired shooters and cult classics, built by solo developers and small teams who'd rather ship something weird than safe. The philosophy hasn't changed since day one: back the games that make noise.",
    team:[ {initials:"AP", name:'Arsi "Hakita" Patala', role:"Founder & Creative Director"}, {initials:"DR", name:"Dillon Rogers", role:"Community Lead"}, {initials:"LW", name:"Leo Wolfe", role:"Art Director"}, {initials:"SE", name:"Sam Ecoff", role:"Composer"} ] },
  { id:"kakudo",          name:"Bad Weather Studios",    initial:"B", country:"Belgique",       founded:2018, genre:"Aventure",   games:1, gameTitle:"KAKUDO",
    bio:KAKUDO_SPOTLIGHT.bioParagraphs.join(" ") },
  { id:"nightshift",      name:"Nightshift Interactive",  initial:"N", country:"Canada",         founded:2019, genre:"Horreur",    games:1 },
  { id:"pale-horse",      name:"Pale Horse Games",        initial:"P", country:"Royaume-Uni",    founded:2020, genre:"Horreur",    games:1 },
  { id:"steelraven7",     name:"SteelRaven7",             initial:"S", country:"Pays-Bas",       founded:2014, genre:"Action",     games:1, gameTitle:"Ravenfield" },
  { id:"klei-vale",       name:"Klei Vale Studio",        initial:"K", country:"Suède",          founded:2017, genre:"Puzzle",     games:2 },
  { id:"copper-fox",      name:"Copper Fox Games",        initial:"C", country:"France",         founded:2015, genre:"Aventure",   games:3 },
  { id:"voltpixel",       name:"Voltpixel",               initial:"V", country:"Allemagne",      founded:2019, genre:"Course",     games:1 },
  { id:"moonlit-owl",     name:"Moonlit Owl Interactive",  initial:"M", country:"Pologne",        founded:2021, genre:"Aventure",   games:1 },
  { id:"redline",         name:"Redline Motorsport Devs", initial:"R", country:"Italie",         founded:2018, genre:"Course",     games:2 },
  { id:"static-bloom",    name:"Static Bloom",            initial:"S", country:"États-Unis",     founded:2022, genre:"Puzzle",     games:1 },
  { id:"hollow-circuit",  name:"Hollow Circuit Studio",   initial:"H", country:"Corée du Sud",   founded:2017, genre:"Action",     games:2 },
  { id:"driftwood",       name:"Driftwood Collective",    initial:"D", country:"Australie",      founded:2016, genre:"Simulation", games:1 },
  { id:"nine-lanterns",   name:"Nine Lanterns",           initial:"N", country:"Vietnam",        founded:2020, genre:"Aventure",   games:1 },
  { id:"ferrous-kingdom", name:"Ferrous Kingdom",         initial:"F", country:"Espagne",        founded:2019, genre:"Action",     games:2 },
  { id:"glasswing",       name:"Glasswing Studio",        initial:"G", country:"Portugal",       founded:2021, genre:"Puzzle",     games:1 },
  { id:"blackout",        name:"Blackout Interactive",    initial:"B", country:"Finlande",       founded:2018, genre:"Horreur",    games:1 },
  { id:"tidepool",        name:"Tidepool Games",          initial:"T", country:"Norvège",        founded:2022, genre:"Simulation", games:1 },
  { id:"rustbelt",        name:"Rustbelt Devs",           initial:"R", country:"Tchéquie",       founded:2015, genre:"Action",     games:3 },
  { id:"wandermoss",      name:"Wandermoss",              initial:"W", country:"Irlande",        founded:2023, genre:"Aventure",   games:1 },
  { id:"dani",            name:"Dani",                    initial:"D", country:"Royaume-Uni",    founded:2016, genre:"Action",     games:1, gameTitle:"KARLSON" },
  { id:"paper-owl",       name:"Paper Owl Studio",        initial:"P", country:"Danemark",       founded:2019, genre:"Puzzle",     games:1 },
  { id:"iron-tide",       name:"Iron Tide Games",         initial:"I", country:"Suisse",         founded:2017, genre:"Action",     games:2 },
  { id:"velvet-static",   name:"Velvet Static",           initial:"V", country:"États-Unis",     founded:2021, genre:"Horreur",    games:1 },
  { id:"birchwood",       name:"Birchwood Interactive",   initial:"B", country:"Suède",          founded:2020, genre:"Simulation", games:1 },
  { id:"copperline",      name:"Copperline Studio",       initial:"C", country:"Nouvelle-Zélande",founded:2018, genre:"Aventure",   games:2 },
  { id:"faultline",       name:"Faultline Games",         initial:"F", country:"Japon",          founded:2016, genre:"Action",     games:3 },
  { id:"quietstorm",      name:"Quietstorm",              initial:"Q", country:"Norvège",        founded:2022, genre:"Puzzle",     games:1 },
  { id:"driftglass",      name:"Driftglass Studio",       initial:"D", country:"Écosse",         founded:2019, genre:"Aventure",   games:1 },
  { id:"emberlane",       name:"Emberlane Interactive",   initial:"E", country:"Belgique",       founded:2020, genre:"Action",     games:2 },
];
const FOLLOWED_STUDIO_IDS = ["new-blood","kakudo"];
// New Blood's own devlog history, shown on its studio_single page only.
const NEW_BLOOD_DEVLOGS = [
  { time:"il y a 2 jours",    title:"Patch 1.3 — équilibrage des armes",             text:"Le fusil à pompe recule un peu en dégâts, la scie circulaire y gagne en portée. Notes complètes dans le changelog." },
  { time:"il y a 1 semaine",  title:"Pourquoi on a mis 8 mois sur l'écran-titre",    text:"Un petit post un peu long sur l'itération artistique et pourquoi le perfectionnisme n'est pas toujours un défaut." },
  { time:"il y a 3 semaines", title:"ULTRAKILL sur consoles : où on en est",         text:"Spoiler : ça avance, mais on ne donne pas de date tant que ce n'est pas irréprochable." },
];
// Cross-studio feed shown on the My Rload page ("Devlogs des studios suivis").
const FOLLOWED_DEVLOG_FEED = [
  { studioId:"kakudo",     studio:"Bad Weather Studios",   initial:"B", time:"Il y a 2 jours",   title:"Aperçu du niveau 4 : le marais empoisonné",  text:"On teste un nouveau système de brouillard dynamique qui réagit à vos pas. Encore expérimental, mais ça change tout l'ambiance du niveau." },
  { studioId:"new-blood",  studio:"New Blood Interactive", initial:"N", time:"Il y a 5 jours",   title:"Patch 1.3 — équilibrage des armes",          text:"Le fusil à pompe recule un peu en dégâts, la scie circulaire y gagne en portée. Notes complètes dans le changelog." },
];
const GAME_HISTORY = [
  { title:"Ravenfield",  imageUrl:HERO_IMAGE,                  meta:"Il y a 2h" },
  { title:"ULTRAKILL",   imageUrl:"./images/games/default_game_cover.png", meta:"Hier" },
  { title:"Jelly Drift", imageUrl:LOCAL_COVERS["jelly-drift"], meta:"La semaine dernière" },
  { title:"Karlson",     imageUrl:LOCAL_COVERS["karlson"],     meta:"Il y a 5 jours" },
  { title:"Machinarium", imageUrl:"./images/games/default_game_cover.png", meta:"Il y a 3 jours" },
];
const LIKED_GAMES = [
  { title:"ULTRAKILL",   imageUrl:"./images/games/default_game_cover.png", meta:"Hier" },
  { title:"Ravenfield",  imageUrl:HERO_IMAGE,                  meta:"Il y a 2h" },
  { title:"Karlson",     imageUrl:LOCAL_COVERS["karlson"],     meta:"Il y a 5 jours" },
  { title:"Machinarium", imageUrl:"./images/games/default_game_cover.png", meta:"Il y a 3 jours" },
  { title:"Jelly Drift", imageUrl:LOCAL_COVERS["jelly-drift"], meta:"La semaine dernière" },
];
const SAVED_EVENTS = [
  { id:"gamescom-2026",  day:"19", month:"AUG", category:"Games Launches",  title:"Gamescom 2026",                        lieu:"Cologne, Allemagne" },
  { id:"devcom-2026",    day:"17", month:"AUG", category:"Creator Events",  title:"devcom Developer Conference",          lieu:"Cologne, Allemagne" },
  { id:"pgw-2026",       day:"29", month:"OCT", category:"Games Launches",  title:"Paris Games Week 2026",                lieu:"Paris, France" },
  { id:"gameawards-2026",day:"10", month:"DEC", category:"Lives & streams", title:"The Game Awards — Watch Party",        lieu:"En ligne" },
  { id:"igds-2026",      day:"19", month:"AUG", category:"Workshops & Panels", title:"Indie Game Developer Summit",       lieu:"Berlin, Allemagne" },
];
// Matches the real Stripe plan structure (planType "trial"/"monthly"/"yearly",
// see [[rload-stripe-decisions]] memory) and the pricing screen Figma: Pack
// Découverte (5-day trial), Elite Pack (monthly), Pack Annuel (yearly).
const PLAN_TIERS = [
  { id:"trial",  planType:"trial",  name:"Pack Découverte", headline:"5 jours gratuits", badge:null,
    features:["Accès aux jeux indés sélectionnés","Téléchargements limités","Publicités activées","Pas de multijoueur","Pas de titres premium","Pas d'avantages événements exclusifs","Annulez à tout moment"],
    cta:"Essai gratuit 5 jours" },
  { id:"monthly",planType:"monthly",name:"Elite Pack",      price:"9,99 €",  period:"/ mois", badge:"LE PLUS POPULAIRE",
    features:["Accès complet à tous les jeux","Jeu sans publicité","Multijoueur activé","Téléchargements illimités","Sauvegardes cloud","Support prioritaire","Avantages événements exclusifs"],
    cta:"S'inscrire" },
  { id:"yearly", planType:"yearly", name:"Pack Annuel",     price:"99,99 €", period:"/ an",   badge:"MEILLEURE OFFRE",
    features:["Tout ce qui est dans Premium","Meilleure valeur, économisez vs mensuel","Accès anticipé aux nouveaux titres","Badge exclusif annuel","Téléchargements illimités","Avantages événements exclusifs","Sauvegardes cloud prioritaires"],
    cta:"S'inscrire" },
];

function FollowButton({ following=false, onToggle }) {
  const [isFollowing, setIsFollowing] = useState(following);
  return (
    <button onClick={e=>{ e.stopPropagation(); setIsFollowing(v=>!v); onToggle?.(!isFollowing); }}
      style={{ padding:"10px 20px", borderRadius:999, cursor:"pointer", fontSize:13.5, fontWeight:600, fontFamily:T.fontBody, width:"100%",
        background:isFollowing ? "rgba(255,255,255,0.08)" : T.brand,
        border:isFollowing ? `1px solid ${T.border}` : "none", color:"#fff" }}>
      {isFollowing ? "✓ Suivi" : "+ Suivre"}
    </button>
  );
}

function StudioLogo({ initial, size=48, fontSize=18 }) {
  return (
    <div style={{ width:size, height:size, borderRadius:size/2, background:"linear-gradient(90deg, #7255e5 0%, #261a40 100%)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
      <span style={{ fontSize, fontWeight:700, color:"#fff", fontFamily:T.fontHead }}>{initial}</span>
    </div>
  );
}

function StudioCard({ studio, onSelect }) {
  return (
    <div onClick={onSelect} role="button" tabIndex={0} onKeyDown={e=>(e.key==="Enter"||e.key===" ")&&onSelect()}
      style={{ background:"rgba(255,255,255,0.05)", border:`1px solid ${T.border}`, borderRadius:16, padding:20, cursor:"pointer", display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"flex", gap:12, alignItems:"center" }}>
        <StudioLogo initial={studio.initial}/>
        <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:4 }}>
          <div style={{ fontSize:14.5, fontWeight:600, color:T.text, fontFamily:T.fontHead, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{studio.name}</div>
          <span style={{ alignSelf:"flex-start", padding:"2px 9px", borderRadius:999, background:"rgba(114,85,229,0.14)", color:"#c2b5fa", fontSize:10.5, fontWeight:500 }}>{studio.genre}</span>
        </div>
      </div>
      <div style={{ fontSize:12, color:T.textMuted }}>
        🌍 {[studio.country, studio.founded && `Fondé en ${studio.founded}`].filter(Boolean).join(" · ") || "Studio indépendant"}
      </div>
      <div style={{ fontSize:12, color:T.textMuted }}>🎮 {studio.games} jeu{studio.games>1?"x":""} sur Rload</div>
      <FollowButton/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StudiosPage — listing of the 20 studios that publish on Rload.
// ─────────────────────────────────────────────────────────────────────────────
function StudiosPage({ onSelectStudio, onTabChange }) {
  const [query, setQuery] = useState("");
  const filtered = query.trim()
    ? STUDIOS.filter(s => s.name.toLowerCase().includes(query.trim().toLowerCase()))
    : STUDIOS;

  return (
    <div style={{ flex:1, overflowY:"auto", fontFamily:T.fontBody }}>
      <div style={{ padding:"48px 24px 0" }}>
        <div style={{ fontSize:44, fontWeight:700, color:T.text, fontFamily:T.fontHead, letterSpacing:"-0.5px", marginBottom:8 }}>Studios</div>
        <div style={{ fontSize:14, color:T.textMuted, marginBottom:32 }}>Découvre les studios indépendants qui font vivre Rload.</div>
        <div style={{ display:"flex", gap:12, marginBottom:32, maxWidth:560 }}>
          <div style={{ flex:1, display:"flex", alignItems:"center", gap:12, padding:"10px 24px", borderRadius:999, background:"rgba(255,255,255,0.05)", border:`1.5px solid ${T.borderBrand}` }}>
            <span style={{ color:T.textMuted, fontSize:18 }}>⌕</span>
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher un studio..."
              style={{ flex:1, background:"none", border:"none", outline:"none", color:T.text, fontSize:14, fontFamily:T.fontBody }}/>
          </div>
          <button style={{ padding:"10px 24px", borderRadius:999, background:T.brand, border:"none", color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:T.fontBody }}>
            Rechercher
          </button>
        </div>
        <div style={{ fontSize:12, color:T.textDim, marginBottom:16 }}>{filtered.length} studio{filtered.length>1?"s":""}</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:20, paddingBottom:40 }}>
          {filtered.map(studio=>(
            <StudioCard key={studio.id} studio={studio} onSelect={()=>onSelectStudio(studio.id)}/>
          ))}
        </div>
      </div>
      <AppFooter onTabChange={onTabChange}/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StudioSinglePage — one studio's profile. Full fidelity for New Blood
// Interactive (the studio Figma fully specified: bio, team, own devlogs);
// other studios get the same structure using only the data the listing has.
// ─────────────────────────────────────────────────────────────────────────────
function StudioSinglePage({ studioId, onBack, onTabChange }) {
  const studio = STUDIOS.find(s=>s.id===studioId) || STUDIOS[0];
  const nextEvents = UPCOMING_EVENTS.slice(0,2);

  return (
    <div style={{ flex:1, overflowY:"auto", fontFamily:T.fontBody }}>
      <div style={{ padding:"48px 24px 40px", display:"flex", flexDirection:"column", gap:40 }}>
        <button onClick={onBack} style={{ alignSelf:"flex-start", background:"none", border:"none", color:T.textMuted, fontSize:13, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:6, fontFamily:T.fontBody }}>
          <Icon.ChevronLeft/> Retour aux studios
        </button>

        {/* Studio hero */}
        <div style={{ background:"linear-gradient(90deg, #291a47 0%, #170f2e 100%)", border:`1px solid ${T.border}`, borderRadius:20, padding:32, display:"flex", flexDirection:"column", gap:20 }}>
          <div style={{ display:"flex", gap:24, alignItems:"center" }}>
            <StudioLogo initial={studio.initial} size={88} fontSize={34}/>
            <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:6 }}>
              <div style={{ fontSize:44, fontWeight:700, color:T.text, fontFamily:T.fontHead, letterSpacing:"-0.5px" }}>{studio.name}</div>
              <div style={{ fontSize:14.5, color:T.textMuted }}>{studio.tagline || [studio.genre, studio.country].filter(Boolean).join(" · ")}</div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:10, alignItems:"flex-end" }}>
              <div style={{ display:"flex", gap:8 }}>
                {["🌐","𝕏","▶","◆"].map((ic,i)=>(
                  <div key={i} style={{ width:36, height:36, borderRadius:999, background:"rgba(255,255,255,0.06)", border:`1px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"center", color:"rgba(255,255,255,0.7)", fontSize:13 }}>{ic}</div>
                ))}
              </div>
              <div style={{ width:94 }}><FollowButton/></div>
            </div>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center", fontSize:13, color:T.textMuted, flexWrap:"wrap" }}>
            {(studio.location || studio.country) && <><span>📍 {studio.location || studio.country}</span><span style={{ opacity:0.4 }}>·</span></>}
            {studio.founded && <><span>📅 Fondé en {studio.founded}</span><span style={{ opacity:0.4 }}>·</span></>}
            {studio.team && <><span>👥 {studio.team.length * 3} personnes</span><span style={{ opacity:0.4 }}>·</span></>}
            <span>🎮 {studio.games} jeu{studio.games>1?"x":""} sur Rload</span>
          </div>
        </div>

        {/* About */}
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ fontSize:22, fontWeight:700, color:T.text, fontFamily:T.fontHead }}>À propos</div>
          <div style={{ fontSize:15, color:T.textSub, lineHeight:1.65, maxWidth:1100 }}>
            {studio.bio || (studio.country
              ? `${studio.name} est un studio indépendant basé en ${studio.country}, connu pour ses jeux du genre ${studio.genre}.`
              : `${studio.name} — profil détaillé à venir.`)}
          </div>
        </div>

        {/* Team */}
        {studio.team && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ fontSize:22, fontWeight:700, color:T.text, fontFamily:T.fontHead }}>L'équipe</div>
            <div style={{ display:"grid", gridTemplateColumns:`repeat(${studio.team.length}, 1fr)`, gap:16 }}>
              {studio.team.map(member=>(
                <div key={member.name} style={{ background:"rgba(255,255,255,0.05)", border:`1px solid ${T.border}`, borderRadius:16, padding:"20px 18px", display:"flex", flexDirection:"column", gap:12 }}>
                  <div style={{ width:44, height:44, borderRadius:22, background:"rgba(114,85,229,0.35)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <span style={{ fontSize:14, fontWeight:600, color:"#fff" }}>{member.initials}</span>
                  </div>
                  <div style={{ fontSize:14, fontWeight:600, color:T.text, fontFamily:T.fontHead }}>{member.name}</div>
                  <div style={{ fontSize:12, color:T.textMuted }}>{member.role}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Games */}
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ fontSize:22, fontWeight:700, color:T.text, fontFamily:T.fontHead }}>Jeux du studio</div>
          <div style={{ display:"flex", gap:14 }}>
            <div style={{ width:259 }}>
              <HomeGameCard title={studio.gameTitle || studio.name} imageUrl={"./images/games/default_game_cover.png"} genre={studio.genre} onSelect={()=>onTabChange("games")}/>
            </div>
          </div>
        </div>

        {/* Devlogs — only where Figma specified real content (New Blood). */}
        {studioId==="new-blood" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ fontSize:22, fontWeight:700, color:T.text, fontFamily:T.fontHead }}>Devlogs & news</div>
            {NEW_BLOOD_DEVLOGS.map(d=>(
              <div key={d.title} style={{ background:"rgba(255,255,255,0.05)", border:`1px solid ${T.border}`, borderRadius:16, padding:18, display:"flex", gap:16, alignItems:"center" }}>
                <StudioLogo initial={studio.initial} size={40} fontSize={15}/>
                <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:4 }}>
                  <div style={{ fontSize:11.5, color:T.textDim }}>{d.time}</div>
                  <div style={{ fontSize:15, fontWeight:600, color:T.text, fontFamily:T.fontHead }}>{d.title}</div>
                  <div style={{ fontSize:13, color:T.textMuted }}>{d.text}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Events */}
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ fontSize:22, fontWeight:700, color:T.text, fontFamily:T.fontHead }}>Événements à venir</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}>
            {nextEvents.map(ev=><EventCard key={ev.id} ev={ev}/>)}
          </div>
        </div>
      </div>
      <AppFooter onTabChange={onTabChange}/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MyRloadPage — personal hub: history, likes, followed studios + their
// devlogs, saved events, and subscription/billing.
// ─────────────────────────────────────────────────────────────────────────────
function MyRloadGameRow({ items, onTabChange }) {
  return (
    <div style={{ display:"flex", gap:24, overflowX:"auto", paddingBottom:4 }} className="hide-scrollbar">
      {items.map((g,i)=>(
        <div key={g.title+i} style={{ width:259, flexShrink:0 }}>
          <HomeGameCard title={g.title} imageUrl={g.imageUrl} genre={g.meta} onSelect={()=>onTabChange("games")}/>
        </div>
      ))}
    </div>
  );
}

function SavedEventCard({ ev }) {
  return (
    <div style={{ width:280, flexShrink:0, background:"rgba(255,255,255,0.05)", border:`1px solid ${T.border}`, borderRadius:16, overflow:"hidden" }}>
      <div style={{ position:"relative", height:120, background:coverGradient(ev.title) }}>
        <div style={{ position:"absolute", top:10, left:10, background:"#fff", borderRadius:10, padding:"6px 8px", textAlign:"center", minWidth:36 }}>
          <div style={{ fontSize:16, fontWeight:700, color:"#140f24", fontFamily:T.fontHead, lineHeight:1 }}>{ev.day}</div>
          <div style={{ fontSize:10, fontWeight:600, color:"rgba(20,15,36,0.6)" }}>{ev.month}</div>
        </div>
      </div>
      <div style={{ padding:"12px 14px 14px", display:"flex", flexDirection:"column", gap:6 }}>
        <span style={{ alignSelf:"flex-start", padding:"4px 10px", borderRadius:999, background:"rgba(114,85,229,0.18)", color:"#c2b5fa", fontSize:10 }}>{ev.category}</span>
        <div style={{ fontSize:14, fontWeight:600, color:T.text, fontFamily:T.fontHead }}>{ev.title}</div>
        <div style={{ fontSize:12, color:T.textMuted }}>{ev.lieu}</div>
      </div>
    </div>
  );
}

function PlanTierCard({ tier, isCurrent }) {
  const highlight = tier.badge === "LE PLUS POPULAIRE";
  return (
    <div style={{ position:"relative", flex:1, background:"rgba(255,255,255,0.04)",
      border:highlight ? `1.5px solid ${T.borderBrand}` : `1px solid ${T.border}`,
      borderRadius:20, padding:"30px 24px 24px", display:"flex", flexDirection:"column", gap:16,
      boxShadow:highlight ? T.brandGlow : "none" }}>
      {tier.badge && (
        <span style={{ position:"absolute", top:-13, left:"50%", transform:"translateX(-50%)",
          padding:"6px 16px", borderRadius:999, fontSize:11, fontWeight:700, whiteSpace:"nowrap",
          background:highlight ? T.brandGrad : "#f2b400", color:highlight ? "#fff" : "#241a05" }}>
          {tier.badge}
        </span>
      )}
      <div>
        <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.08em", color:T.textMuted, textTransform:"uppercase", marginBottom:10 }}>{tier.name}</div>
        {tier.headline ? (
          <div style={{ fontSize:26, fontWeight:700, color:T.text, fontFamily:T.fontHead }}>{tier.headline}</div>
        ) : (
          <div style={{ display:"flex", alignItems:"baseline", gap:4 }}>
            <span style={{ fontSize:32, fontWeight:700, color:T.text, fontFamily:T.fontHead }}>{tier.price}</span>
            <span style={{ fontSize:14, color:T.textMuted }}>{tier.period}</span>
          </div>
        )}
      </div>
      <div style={{ height:1, background:T.border }}/>
      <div style={{ flex:1, display:"flex", flexDirection:"column", gap:11, fontSize:13.5, color:T.textSub }}>
        {tier.features.map(f=>(
          <div key={f} style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ width:18, height:18, borderRadius:"50%", background:"rgba(255,255,255,0.08)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:T.textMuted, flexShrink:0 }}>✓</span>
            {f}
          </div>
        ))}
      </div>
      <button onClick={()=>openExternal("https://rload.be/pricing?source=launcher")} disabled={isCurrent}
        style={{ padding:"12px 0", borderRadius:999, border:highlight ? "none" : `1px solid ${T.border}`,
          background:highlight ? T.brandGrad : (isCurrent ? "rgba(255,255,255,0.06)" : "transparent"),
          color:isCurrent ? T.textMuted : "#fff", fontSize:13.5, fontWeight:700,
          cursor:isCurrent ? "default" : "pointer", fontFamily:T.fontBody }}>
        {isCurrent ? "Plan actuel" : tier.cta}
      </button>
    </div>
  );
}

function MyRloadPage({ games, onTabChange, onSelectStudio, subscriptionStatus, demoMode }) {
  const followedStudios = REAL_STUDIOS.filter(s=>FOLLOWED_STUDIO_IDS.includes(s.id));
  const periodEnd = subscriptionStatus?.currentPeriodEnd ? new Date(subscriptionStatus.currentPeriodEnd).toLocaleDateString() : null;
  const trialEnd  = subscriptionStatus?.trialEnd ? new Date(subscriptionStatus.trialEnd).toLocaleDateString() : null;
  const currentPlanTierId = subscriptionStatus?.hasAccess ? PLAN_TIERS.find(t=>t.planType===subscriptionStatus.planType)?.id : null;

  return (
    <div style={{ flex:1, overflowY:"auto", fontFamily:T.fontBody }}>
      <div style={{ position:"relative", height:272, display:"flex", alignItems:"flex-end", padding:"0 24px 32px", overflow:"hidden", background:coverGradient("myrload") }}>
        <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.35)" }}/>
        <div style={{ position:"relative", fontSize:44, fontWeight:800, color:T.text, fontFamily:T.fontHead, letterSpacing:"-1px" }}>My Rload</div>
      </div>

      <div style={{ padding:"32px 24px 40px", display:"flex", flexDirection:"column", gap:32 }}>
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ fontSize:24, fontWeight:700, color:T.text, fontFamily:T.fontHead }}>Historique de jeu</div>
          <MyRloadGameRow items={GAME_HISTORY} onTabChange={onTabChange}/>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ fontSize:24, fontWeight:700, color:T.text, fontFamily:T.fontHead }}>Jeux aimés</div>
          <MyRloadGameRow items={LIKED_GAMES} onTabChange={onTabChange}/>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ fontSize:24, fontWeight:700, color:T.text, fontFamily:T.fontHead }}>Studios suivis</div>
          <div style={{ display:"flex", gap:20, flexWrap:"wrap" }}>
            {followedStudios.map(s=>(
              <div key={s.id} onClick={()=>onSelectStudio(s.id)} role="button" tabIndex={0}
                style={{ width:310, height:80, background:"rgba(255,255,255,0.05)", border:`1px solid ${T.border}`, borderRadius:16, padding:16, display:"flex", alignItems:"center", gap:12, cursor:"pointer" }}>
                <StudioLogo initial={s.initial}/>
                <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:4 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:T.text, fontFamily:T.fontHead, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.name}</div>
                  <div style={{ fontSize:12, color:T.textMuted }}>{s.games} jeu{s.games>1?"x":""} sur Rload</div>
                </div>
                <span style={{ padding:"6px 12px", borderRadius:999, background:"rgba(114,85,229,0.18)", color:"#7255e5", fontSize:12, flexShrink:0 }}>Suivi</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ fontSize:24, fontWeight:700, color:T.text, fontFamily:T.fontHead }}>Devlogs des studios suivis</div>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {FOLLOWED_DEVLOG_FEED.map(d=>(
              <div key={d.title} onClick={()=>onSelectStudio(d.studioId)} role="button" tabIndex={0}
                style={{ background:"rgba(255,255,255,0.05)", border:`1px solid ${T.border}`, borderRadius:16, padding:16, display:"flex", gap:14, cursor:"pointer" }}>
                <StudioLogo initial={d.initial} size={40} fontSize={15}/>
                <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:6 }}>
                  <div style={{ display:"flex", gap:6, alignItems:"center", fontSize:13 }}>
                    <span style={{ fontWeight:600, color:T.text }}>{d.studio}</span>
                    <span style={{ color:T.textDim }}>·</span>
                    <span style={{ color:T.textDim }}>{d.time}</span>
                  </div>
                  <div style={{ fontSize:15, fontWeight:600, color:T.text, fontFamily:T.fontHead }}>{d.title}</div>
                  <div style={{ fontSize:13, color:T.textMuted }}>{d.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ fontSize:24, fontWeight:700, color:T.text, fontFamily:T.fontHead }}>Événements enregistrés</div>
          <div style={{ display:"flex", gap:20, overflowX:"auto", paddingBottom:4 }} className="hide-scrollbar">
            {SAVED_EVENTS.map(ev=><SavedEventCard key={ev.id} ev={ev}/>)}
          </div>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ fontSize:24, fontWeight:700, color:T.text, fontFamily:T.fontHead }}>Mon abonnement</div>
          <div style={{ background:"linear-gradient(90deg, rgba(114,85,229,0.35) 0%, rgba(38,26,64,0.35) 100%)", border:`1px solid ${T.borderBrand}`, borderRadius:16, padding:"20px 24px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              <div style={{ fontSize:12, fontWeight:600, color:T.textMuted, letterSpacing:"0.06em" }}>PLAN ACTUEL</div>
              <div style={{ fontSize:22, fontWeight:700, color:T.text, fontFamily:T.fontHead }}>
                {demoMode ? "Mode démo" : (subscriptionStatus?.planName || "Aucun abonnement actif")}
              </div>
              <div style={{ fontSize:13, color:T.textSub }}>
                {demoMode
                  ? "Abonnement non requis — build de démonstration."
                  : subscriptionStatus?.hasAccess
                    ? (periodEnd ? `Prochain renouvellement le ${periodEnd}` : "Actif")
                    : trialEnd
                      ? `Essai expiré le ${trialEnd}`
                      : "Choisis un plan ci-dessous pour débloquer l'accès complet."}
              </div>
            </div>
            <button onClick={()=>openExternal("https://rload.be/pricing?source=launcher")} style={{ padding:"10px 18px", borderRadius:999, background:"rgba(255,255,255,0.1)", border:`1px solid ${T.border}`, color:T.text, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:T.fontBody }}>
              {subscriptionStatus?.hasAccess ? "Gérer le paiement" : "S'abonner"}
            </button>
          </div>
          <div style={{ display:"flex", gap:24 }}>
            {PLAN_TIERS.map(tier=><PlanTierCard key={tier.id} tier={tier} isCurrent={tier.id===currentPlanTierId}/>)}
          </div>
        </div>
      </div>
      <AppFooter onTabChange={onTabChange}/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SearchPage — hero search + category chips + genre filter chips; results
// filter the real games/studios data locally (no backend to call).
// ─────────────────────────────────────────────────────────────────────────────
const SEARCH_GENRES = ["Action","Aventure","FPS","Course","Plateforme","Casual","Indie","Horreur","Puzzle","Simulation"];
const TRENDING_SEARCHES = ["Ravenfield","ULTRAKILL","Indie","Multiplayer","Gamescom 2026"];

function SearchPage({ games, onSelectGame, onTabChange, onSelectStudio }) {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");

  const runSearch = (q) => setSubmitted(q.trim());

  const q = submitted.toLowerCase();
  const gameResults = q
    ? games
        .map((g,i)=>gameToRankedItem(g,i+1))
        .filter(g=>
          g.title.toLowerCase().includes(q) ||
          g.genre.some(genre=>genre?.toLowerCase().includes(q)))
    : [];
  const studioResults = q
    ? STUDIOS.filter(s=>s.name.toLowerCase().includes(q) || s.genre.toLowerCase().includes(q))
    : [];

  return (
    <div style={{ flex:1, overflowY:"auto", fontFamily:T.fontBody }}>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:20, padding:"56px 24px 0" }}>
        <div style={{ fontSize:44, fontWeight:800, color:T.text, fontFamily:T.fontHead, letterSpacing:"-1px", textAlign:"center" }}>
          Find your next favorite game
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12, width:"100%", maxWidth:720, padding:"10px 10px 10px 24px", borderRadius:999, background:"rgba(255,255,255,0.05)", border:`1.5px solid ${T.borderBrand}` }}>
          <span style={{ color:T.textMuted }}>⌕</span>
          <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&runSearch(query)}
            placeholder="Rechercher un jeu, un événement, un studio..."
            style={{ flex:1, background:"none", border:"none", outline:"none", color:T.text, fontSize:16, fontFamily:T.fontBody }}/>
          <button onClick={()=>runSearch(query)} style={{ padding:"12px 22px", borderRadius:999, background:T.brand, border:"none", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:T.fontBody }}>
            Search
          </button>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10, alignItems:"center" }}>
          <div style={{ fontSize:12, fontWeight:600, color:T.textMuted }}>Trending searches</div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", justifyContent:"center" }}>
            {TRENDING_SEARCHES.map(t=>(
              <button key={t} onClick={()=>{ setQuery(t); runSearch(t); }}
                style={{ padding:"7px 14px", borderRadius:999, border:`1px solid ${T.border}`, background:"none", color:T.textMuted, fontSize:13, cursor:"pointer", fontFamily:T.fontBody }}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", justifyContent:"center", maxWidth:900 }}>
          {SEARCH_GENRES.map(g=>(
            <button key={g} onClick={()=>{ setQuery(g); runSearch(g); }}
              style={{ padding:"9px 16px", borderRadius:999, border:`1px solid ${T.border}`, background:"rgba(255,255,255,0.05)", color:"rgba(255,255,255,0.65)", fontSize:13.5, cursor:"pointer", fontFamily:T.fontBody }}>
              {g}
            </button>
          ))}
        </div>

        <div style={{ width:"100%", maxWidth:1312, display:"flex", flexDirection:"column", gap:20, padding:"24px 0 64px" }}>
          {submitted && (
            <>
              <div style={{ display:"flex", gap:6, alignItems:"baseline" }}>
                <span style={{ fontSize:24, fontWeight:700, color:T.text, fontFamily:T.fontHead }}>Games</span>
                <span style={{ fontSize:14, color:T.textMuted }}>· {gameResults.length} results for "{submitted}"</span>
              </div>
              {gameResults.length > 0 ? (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(5, 1fr)", gap:14 }}>
                  {gameResults.map(item=>(
                    <HomeGameCard key={item.title} title={item.title} imageUrl={item.imageUrl} imagePosition={item.imagePosition}
                      genre={Array.isArray(item.genre)?item.genre[0]:item.genre} onSelect={()=>onTabChange("games")}/>
                  ))}
                </div>
              ) : <div style={{ fontSize:13, color:T.textDim }}>Aucun jeu trouvé.</div>}

              <div style={{ fontSize:24, fontWeight:700, color:T.text, fontFamily:T.fontHead, marginTop:16 }}>
                Studios · {studioResults.length} result{studioResults.length>1?"s":""}
              </div>
              {studioResults.map(s=>(
                <div key={s.id} onClick={()=>onSelectStudio(s.id)} role="button" tabIndex={0}
                  style={{ background:"rgba(255,255,255,0.05)", border:`1px solid ${T.border}`, borderRadius:14, padding:"16px 20px", display:"flex", alignItems:"center", gap:16, cursor:"pointer" }}>
                  <StudioLogo initial={s.initial} size={50} fontSize={18}/>
                  <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                    <div style={{ fontSize:16, fontWeight:700, color:T.text, fontFamily:T.fontHead }}>{s.name}</div>
                    <div style={{ fontSize:14, color:T.textMuted }}>{s.games} jeu{s.games>1?"x":""} sur Rload{s.gameTitle?` · ${s.gameTitle}`:""}</div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
      <AppFooter onTabChange={onTabChange}/>
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
  const [selectedStudioId, setSelectedStudioId]             = useState(null);
  const [prevGameTab, setPrevGameTab]                       = useState("home");
  const [launchingGame, setLaunchingGame]                   = useState(null);
  const [lang, setLang]                                     = useState(() => localStorage.getItem("rload-lang") || "en");
  const [demoMode, setDemoMode] = useState(false); // safe default: gates enforced until IPC responds
  const unsubRef    = useRef(null);
  const unsubRunRef = useRef(null);
  const sessionStartRef = useRef({}); // gameId -> Date.now() at session start, for real playtime tracking

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

  // ── Player Identity — load/init the profile as soon as we know who's
  // signed in, so install/launch/session events can be recorded even if the
  // user never opens the Profile tab this session. ProfilePage re-reads the
  // same cached profile via subscribeProfile() for its own rendering.
  useEffect(() => {
    if (authSession === undefined) return; // still resolving initial session
    getPlayerProfile(authSession?.user?.sub);
  }, [authSession]);

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
      if (r.running) {
        sessionStartRef.current[r.gameId] = Date.now();
        setUiByGame(p => ({ ...p, [r.gameId]: UI.RUNNING }));
      }
      else setUiByGame(p => {
        if (p[r.gameId]!==UI.RUNNING) return p;
        // Process exited after a real running session — counts as a completed
        // play session for achievement tracking (Explorer/Studio Hopper/etc)
        // and feeds real Hours Played (Player Identity ProfileHeader stat).
        const startedAt = sessionStartRef.current[r.gameId];
        const durationMinutes = startedAt ? Math.round((Date.now() - startedAt) / 60000) : 0;
        delete sessionStartRef.current[r.gameId];
        const playedGame = games.find(g => g.gameId === r.gameId);
        const isWeekend = [0, 6].includes(new Date().getDay());
        recordGameEvent({
          type: "session_completed", gameId: r.gameId, durationMinutes,
          studio: playedGame?.studio, country: playedGame?.country, isHiddenGem: playedGame?.isHiddenGem,
          isWeekend, weekKey: isWeekend ? getWeekKey() : undefined,
        });
        return { ...p, [r.gameId]: UI.INSTALLED };
      });
    });
    unsubRunRef.current = unsub;
    return () => { try { unsubRunRef.current?.(); } catch {} unsubRunRef.current = null; };
  }, [desktop, games]);

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
      recordGameEvent({ type:"installed", gameId:id });
    } else {
      setUiByGame(p=>({...p,[id]:UI.INSTALLED_NO_EXE}));
      recordGameEvent({ type:"installed", gameId:id });
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
      if (res?.ok||res?.code==="ALREADY_RUNNING") {
        setUiByGame(p=>({...p,[id]:UI.RUNNING}));
        recordGameEvent({ type:"launched", gameId:id });
      }
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

      {/* Player Identity — achievement/unlock/level-up toasts, stacked top-right */}
      <NotificationToastHost t={t}/>

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
            onTabChange={handleTabChange}
            onSelectStudio={(id)=>{ setSelectedStudioId(id); handleTabChange("studios"); }}/>
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
        {activeTab==="myrload"   && (
          <MyRloadPage games={games} onTabChange={handleTabChange}
            onSelectStudio={(id)=>{ setSelectedStudioId(id); handleTabChange("studios"); }}
            subscriptionStatus={subscriptionStatus} demoMode={demoMode}/>
        )}
        {activeTab==="studios" && (
          selectedStudioId ? (
            <StudioSinglePage studioId={selectedStudioId} onTabChange={handleTabChange}
              onBack={()=>setSelectedStudioId(null)}/>
          ) : (
            <StudiosPage onTabChange={handleTabChange}
              onSelectStudio={(id)=>setSelectedStudioId(id)}/>
          )
        )}
        {activeTab==="search" && (
          <SearchPage games={games} onSelectGame={handleSelectGame} onTabChange={handleTabChange}
            onSelectStudio={(id)=>{ setSelectedStudioId(id); handleTabChange("studios"); }}/>
        )}
        {activeTab==="profile"   && (
          <ProfilePage user={authSession?.user} authBusy={authBusy}
            onLogout={handleSignOut} games={games} uiByGame={uiByGame}
            lang={lang} changeLang={changeLang}
            subscriptionStatus={subscriptionStatus} demoMode={demoMode}/>
        )}
      </div>
    </div>
  );
}
