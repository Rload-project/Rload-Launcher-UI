// src/lib/download-state-model.js
//
// Pure, DOM-free, Electron-free logic for turning raw download/game state
// into what the renderer shows. Extracted out of launcher-games.jsx (a
// .jsx file, unparseable by plain node:test) specifically so it can be
// unit-tested with node:test — no Vitest/jsdom, no React, no real download.
// See download-state-model.test.mjs.
//
// Imported back into launcher-games.jsx as the single source of truth for
// these values — no behavior change, just a relocation.

import { T } from './theme.js';

export function toErrStr(e) {
  if (!e) return "";
  if (typeof e === "string") return e;
  if (typeof e === "number") return String(e);
  if (e instanceof Error) return e.message || String(e);
  if (typeof e.message === "string") return e.message;
  try { return JSON.stringify(e); } catch { return String(e); }
}

export const UI = {
  IDLE:"idle", DOWNLOADING:"downloading", PAUSED:"paused",
  INSTALLING:"installing", INSTALLED:"installed",
  INSTALLED_NO_EXE:"installed_no_exe", UPDATE_AVAILABLE:"update_available",
  UPDATING:"updating", RUNNING:"running", ERROR:"error", CANCELED:"canceled",
};

export const DOWNLOAD_SAFE_STATES = new Set([
  UI.INSTALLED, UI.INSTALLED_NO_EXE, UI.UPDATE_AVAILABLE, UI.UPDATING, UI.RUNNING,
]);

export function mapBackendStateToUI(s) {
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

// Website-First download-only games — a download can exist (downloads.json /
// an installation_job) for a gameId that is deliberately absent from the
// catalog (e.g. a staging-only synthetic test, or any future Website-First
// title not yet published to catalog.json). Before this fix, `games` (the
// catalog array) was the ONLY source ever iterated to build Active Downloads,
// so such a job was invisible and uncontrollable no matter its real status —
// see the "Gate de contrôle des téléchargements Website-First" audit.
//
// A shadow game is the minimal, safe-to-render stand-in used ONLY for a
// gameId that has no catalog entry. It intentionally mirrors the exact shape
// listLocalGames()'s normalization already produces (same fields, empty/
// null defaults) so every existing consumer (GameGridCard, GameSinglePage,
// search, badges) can render it without a special case — except
// `_source:"download-only"`, which GameSinglePage.jsx uses to suppress the
// catalog-only "RETRY INSTALL" action for a job that structurally cannot be
// retried in place (see state-machine `failed: []` on the backend).
// Cold-start hydration — pure decision logic, extracted out of the
// listDownloads() useEffect in launcher-games.jsx so it's unit-testable
// with node:test (no DOM, no timers, no real Runtime). Given one raw
// downloads.json entry and a snapshot of what's already known for that
// gameId (from live events that may have already fired first — a real
// race, not hypothetical), returns exactly what should change, or null if
// this entry has nothing to contribute. `undefined` on an output field
// means "leave this piece of state alone" (dedup: a live event or an
// earlier hydration pass already owns it) — the caller skips that
// setState call entirely, it's not "set to undefined".
export function computeHydratedEntryUpdate(existing, rawEntry) {
  const { uiState = null, hasDl = false, hasDlId = false, hasErr = false } = existing || {};
  if (!rawEntry?.gameId) return null;
  const mapped = mapBackendStateToUI(rawEntry.status ?? rawEntry.state);
  if (!mapped) return null;

  const bytesDownloaded = rawEntry.bytesDownloaded ?? 0;
  const totalBytes = rawEntry.totalBytes ?? 0;

  return {
    gameId: rawEntry.gameId,
    dlId: hasDlId ? undefined : (rawEntry.id ?? undefined),
    dl: hasDl ? undefined : {
      id: rawEntry.id ?? null, gameId: rawEntry.gameId, version: rawEntry.version ?? null,
      bytesDownloaded, totalBytes,
      percent: totalBytes > 0 ? Math.round((bytesDownloaded / totalBytes) * 100) : 0,
      canResume: rawEntry.canResume ?? null,
    },
    // uiByGame's own live-event handlers use `prev[gameId] != null` as their
    // dedup guard (see launcher-games.jsx) — mirrored here so a hydration
    // pass never clobbers a state a live onState()/catalog-install effect
    // already set, regardless of which fired first.
    uiState: uiState != null ? undefined : mapped,
    err: (mapped === UI.ERROR && !hasErr) ? (toErrStr(rawEntry.error) || 'failed') : undefined,
  };
}

// Badge label/colors for a given UI state — pure projection, no JSX. Used
// by GameGridCard/SmallCoverCard/ThreeDRow etc. Moved here (still
// re-exported the same way from launcher-games.jsx) so RENDER_PATH_TESTED
// covers at least this much of what's actually shown without needing a
// DOM/Vitest/jsdom setup: the ERROR badge is what makes the failed job
// visually distinguishable at all in Active Downloads.
export function getStateBadge(uiState) {
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

export function buildShadowGame(gameId, dl) {
  return {
    gameId,
    title: gameId, // no catalog title to enrich with — fallback is the raw gameId, per spec
    studio: null,
    version: dl?.version || "",
    exe: "",
    downloadUrl: "",
    sha256: "",
    downloadSize: dl?.totalBytes || null,
    updateStrategy: "full",
    description: null,
    shortDescription: null,
    thumbnail: null,
    coverUrl: null,
    coverImage: null,
    banner: null,
    screenshots: [],
    trailer: null,
    tags: [],
    genres: [],
    comingSoon: false,
    releaseDate: null,
    languages: [],
    ageRating: null,
    featureCards: [],
    systemRequirements: null,
    studioSlug: null,
    studioLogo: null,
    studioCountry: null,
    studioLinks: null,
    _source: "download-only",
  };
}
