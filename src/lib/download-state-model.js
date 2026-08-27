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
