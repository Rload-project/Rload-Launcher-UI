// src/lib/rload.js

function hasRload() {
  return typeof window !== "undefined" && !!window.rload;
}

function safeFn(fn, fallback) {
  try { return fn(); } catch { return fallback; }
}

export function rloadAvailable() {
  return hasRload();
}

// ---------------------------------------------------------------------------
// Version comparison
//
// compareVersions(a, b) → -1 | 0 | 1
//
// Strategy (in priority order):
//   1. Exact string equality → 0 (no update needed)
//   2. Parse as dot-separated numeric parts, ignoring non-numeric suffixes
//      e.g. "1.0-demo" → [1, 0], "1.1" → [1, 1], "test" → [0]
//   3. Compare part-by-part numerically
//   4. If all numeric parts are equal, longer version is considered newer
//      e.g. "1.0.1" > "1.0"
//
// Registry is always treated as authoritative for the update decision:
// if registryVersion !== installedVersion → update is offered.
// The comparison function is used to log whether registry is newer/older/equal.
// ---------------------------------------------------------------------------
export function compareVersions(a, b) {
  if (a === b) return 0;

  const parseParts = (v) =>
    String(v || "0")
      .split(".")
      .map((p) => parseInt(p, 10) || 0);

  const pa = parseParts(a);
  const pb = parseParts(b);
  const len = Math.max(pa.length, pb.length);

  for (let i = 0; i < len; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

/**
 * Returns true if registryVersion is considered an update target for installedVersion.
 * Logic: any version difference where registry ≠ installed triggers an update offer.
 * The registry is authoritative — a different version in the registry means update.
 */
export function isUpdateAvailable(installedVersion, registryVersion) {
  if (!installedVersion || !registryVersion) return false;
  return installedVersion !== registryVersion;
}

// ---------------------------------------------------------------------------
// Payload normalizers
// ---------------------------------------------------------------------------

function normalizeProgress(p) {
  if (!p) return null;
  const id      = p.id      || null;
  const gameId  = p.gameId  || null;
  const version = p.version || null;
  const bytesDownloaded = p.bytesDownloaded ?? p.receivedBytes ?? p.received ?? p.downloaded ?? 0;
  const totalBytes      = p.totalBytes      ?? p.total         ?? p.size     ?? 0;
  const percent =
    p.percent != null
      ? Math.round(p.percent)
      : totalBytes > 0
      ? Math.round((bytesDownloaded / totalBytes) * 100)
      : 0;
  return { id, gameId, version, bytesDownloaded, totalBytes, percent };
}

function normalizeState(s) {
  if (!s) return null;
  const id      = s.id      || null;
  const gameId  = s.gameId  || null;
  const version = s.version || null;
  const state           = s.status || s.state || null;
  const bytesDownloaded = s.bytesDownloaded ?? 0;
  const totalBytes      = s.totalBytes      ?? 0;
  const error           = s.error           || null;
  return { id, gameId, version, state, bytesDownloaded, totalBytes, error };
}

// ---------------------------------------------------------------------------
// Catalog / Registry
// ---------------------------------------------------------------------------

export async function listLocalGames() {
  if (!hasRload()) {
    // Dev/browser fallback — mirrors catalog.json structure (normalized)
    return [
      {
        gameId: "smoke",     title: "Smoke Test", studio: "Rload Internal",
        version: "1.0",      exeRelativePath: null,
        downloadUrl: "https://cdn.rload.be/test.zip",
        sha256: null, updateStrategy: "full", _source: "fallback",
      },
      {
        gameId: "ultrakill", title: "ULTRAKILL",  studio: "New Blood Interactive",
        version: "1.0-demo", exeRelativePath: "ULTRAKILL/ULTRAKILL.exe",
        downloadUrl: "https://cdn.rload.be/ULTRAKILL_v1.zip",
        sha256: null, updateStrategy: "full", _source: "fallback",
      },
    ];
  }

  const api = window.rload.games;
  if (api?.listLocal) {
    const res = await api.listLocal();
    // res shape: { ok, games, source } from loadCatalog()
    const games = Array.isArray(res) ? res : res?.games;
    if (Array.isArray(games) && games.length) return games;
  }

  // Hard fallback if IPC returns empty
  return [
    {
      gameId: "smoke", title: "Smoke Test", studio: "Rload Internal",
      version: "1.0", exeRelativePath: null,
      downloadUrl: "https://cdn.rload.be/test.zip",
      sha256: null, updateStrategy: "full", _source: "fallback",
    },
  ];
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/**
 * Returns:
 *   installed:        true — exe confirmed on disk → Play is safe
 *   extracted:        true — sentinel present but no exe → INSTALLED_NO_EXE
 *   exePath:               — resolved absolute exe path (null if not found)
 *   installedVersion:      — version string from manifest (for update comparison)
 */
export async function getInstalledStatus(gameId, version, exe) {
  if (!hasRload()) return { installed: false, extracted: false, exePath: null, installedVersion: null };

  const api = window.rload.games;
  if (api?.isInstalled) {
    const res = await api.isInstalled({ gameId, version, exe: exe || "" });
    return {
      installed:        res?.installed === true,
      extracted:        res?.extracted === true,
      exePath:          res?.target    || null,
      installedVersion: res?.installedVersion || null,
    };
  }

  return { installed: false, extracted: false, exePath: null, installedVersion: null };
}

/**
 * Query whether a game process is currently running.
 * Always false on launcher startup (running state is in-memory only).
 */
export async function getRunningStatus(gameId) {
  if (!hasRload()) return { running: false, pid: null };
  const api = window.rload.games;
  if (api?.isRunning) {
    const res = await api.isRunning(gameId);
    return { running: res?.running === true, pid: res?.pid || null };
  }
  return { running: false, pid: null };
}

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

/**
 * Trigger the full install pipeline for a game.
 * Passes all registry fields including updateStrategy.
 */
export async function installGame(game) {
  if (!hasRload()) return { ok: false, error: "Desktop app required" };

  const g = window.rload.games;
  if (g?.install) {
    return await g.install({
      gameId:         game.gameId,
      version:        game.version,
      url:            game.downloadUrl || game.url,
      sha256:         game.sha256 || undefined,
      exe:            game.exe || "",
      updateStrategy: game.updateStrategy || "full",
    });
  }

  return { ok: false, error: "No install method found on window.rload" };
}

// ---------------------------------------------------------------------------
// Update
//
// updateStrategy field:
//   "full"  — complete ZIP re-download + extract (current behaviour)
//   "delta" — future: download patch + apply on top of existing install
//
// The backend (main.js updateGamePipeline) routes on this field.
// When delta support is implemented, pass updateStrategy:"delta" from the
// registry entry and the backend will handle the different code path.
// ---------------------------------------------------------------------------

/**
 * Trigger the update pipeline for a game.
 * oldVersion: currently installed version (for cleanup after successful update)
 * game.version: registry version (the update target)
 */
export async function updateGame(game, oldVersion) {
  if (!hasRload()) return { ok: false, error: "Desktop app required" };

  const g = window.rload.games;
  if (g?.update) {
    return await g.update({
      gameId:         game.gameId,
      oldVersion,
      newVersion:     game.version,
      url:            game.downloadUrl || game.url,
      sha256:         game.sha256 || undefined,
      exe:            game.exe || "",
      updateStrategy: game.updateStrategy || "full",
    });
  }

  return { ok: false, error: "No update method found on window.rload" };
}

// ---------------------------------------------------------------------------
// Pause / Resume / Cancel
// ---------------------------------------------------------------------------

export async function pauseDownload(downloadId) {
  if (!hasRload()) return { ok: false, error: "Desktop app required" };
  const d = window.rload.downloads;
  if (!d?.pause) return { ok: false, error: "pause() not available" };
  return await d.pause(downloadId);
}

export async function resumeDownload(downloadId) {
  if (!hasRload()) return { ok: false, error: "Desktop app required" };
  const d = window.rload.downloads;
  if (!d?.resume) return { ok: false, error: "resume() not available" };
  return await d.resume(downloadId);
}

export async function cancelDownload(downloadId) {
  if (!hasRload()) return { ok: false, error: "Desktop app required" };
  const d = window.rload.downloads;
  if (!d?.cancel) return { ok: false, error: "cancel() not available" };
  return await d.cancel(downloadId);
}

// ---------------------------------------------------------------------------
// Reset / Launch
// ---------------------------------------------------------------------------

export async function resetGame(gameId, version) {
  if (!hasRload()) return { ok: false, error: "Desktop app required" };
  const g = window.rload.games;
  if (!g?.reset) return { ok: false, error: "reset() not available" };
  return await g.reset({ gameId, version });
}

/**
 * Uninstall a game — removes the entire gameId folder from installs/ and
 * downloads/ and clears all download records. Blocked if the game is running.
 * @param {string} gameId
 * @returns {Promise<{ ok: boolean, code?: string, message?: string }>}
 */
export async function uninstallGame(gameId) {
  if (!hasRload()) return { ok: false, error: "Desktop app required" };
  const g = window.rload.games;
  if (!g?.uninstall) return { ok: false, error: "uninstall() not available" };
  return await g.uninstall(gameId);
}

export async function launchGame(game) {
  if (!hasRload()) return { ok: false, error: "Desktop app required" };
  const g = window.rload.games;
  if (!g?.launch) return { ok: false, error: "launch() not available" };
  return await g.launch({ gameId: game.gameId, version: game.version, exe: game.exe });
}

// ---------------------------------------------------------------------------
// Event subscriptions
// ---------------------------------------------------------------------------

export function subscribeDownloads({ onProgress, onState }) {
  if (!hasRload()) return () => {};

  const g = window.rload.games;
  const unsubs = [];

  if (g?.onProgress) {
    const u = safeFn(() => g.onProgress((p) => onProgress?.(normalizeProgress(p))), null);
    if (typeof u === "function") unsubs.push(u);
  }

  if (g?.onState) {
    const u = safeFn(() => g.onState((s) => onState?.(normalizeState(s))), null);
    if (typeof u === "function") unsubs.push(u);
  }

  return () => { for (const u of unsubs) { try { u(); } catch {} } };
}

export function subscribeRunning(onRunning) {
  if (!hasRload()) return () => {};
  const g = window.rload.games;
  if (!g?.onRunning) return () => {};
  const u = safeFn(() => g.onRunning((r) => onRunning?.(r)), null);
  return typeof u === "function" ? u : () => {};
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/**
 * Returns { user, expiresAt } or null if no active session.
 */
export async function getSession() {
  if (!hasRload()) return null;
  const a = window.rload.auth;
  if (!a?.getSession) return null;
  try { return await a.getSession(); } catch { return null; }
}

/**
 * Open Auth0 login in system browser.
 */
export async function login() {
  if (!hasRload()) return { ok: false, error: "Desktop app required" };
  const a = window.rload.auth;
  if (!a?.login) return { ok: false, error: "auth.login() not available" };
  return await a.login();
}

/**
 * Clear session and open Auth0 logout URL.
 */
export async function logout() {
  if (!hasRload()) return { ok: false, error: "Desktop app required" };
  const a = window.rload.auth;
  if (!a?.logout) return { ok: false, error: "auth.logout() not available" };
  return await a.logout();
}

/**
 * Subscribe to session changes. Callback receives { user, expiresAt } or null.
 * @returns {function} cleanup
 */
export function subscribeSession(cb) {
  if (!hasRload()) return () => {};
  const a = window.rload.auth;
  if (!a?.onSessionChanged) return () => {};
  const u = safeFn(() => a.onSessionChanged((s) => cb?.(s)), null);
  return typeof u === "function" ? u : () => {};
}

/**
 * Subscribe to auth errors (e.g. signup with existing email, invalid grant).
 * Callback receives { message: string, code: string|null }.
 * @returns {function} cleanup
 */
export function subscribeAuthError(cb) {
  if (!hasRload()) return () => {};
  const a = window.rload.auth;
  if (!a?.onAuthError) return () => {};
  const u = safeFn(() => a.onAuthError((e) => cb?.(e)), null);
  return typeof u === "function" ? u : () => {};
}

/**
 * Fetch the current user's subscription status from the backend via the main process.
 * Returns { hasAccess, subscriptionStatus, planType, planName, trialEnd, currentPeriodEnd } or { hasAccess: false }.
 */
export async function getSubscriptionStatus() {
  if (!hasRload()) return { hasAccess: false, subscriptionStatus: "none" };
  const a = window.rload.auth;
  if (!a?.getSubscriptionStatus) return { hasAccess: false, subscriptionStatus: "none" };
  try { return await a.getSubscriptionStatus(); } catch { return { hasAccess: false, subscriptionStatus: "none" }; }
}

/**
 * Subscribe to subscription refresh requests pushed by the main process.
 * Fired when the user returns via rload://subscription-activated.
 * @param {function} cb
 * @returns {function} cleanup
 */
export function subscribeSubscriptionRefresh(cb) {
  if (!hasRload()) return () => {};
  const a = window.rload.auth;
  if (!a?.onSubscriptionRefresh) return () => {};
  const u = safeFn(() => a.onSubscriptionRefresh(() => cb?.()), null);
  return typeof u === "function" ? u : () => {};
}
