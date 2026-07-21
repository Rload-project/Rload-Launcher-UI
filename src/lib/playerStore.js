// src/lib/playerStore.js
//
// Player Identity persistence + mutation API.
//
// Storage: window.rload.player.get()/set() (backed by player-profile.json in
// %APPDATA%\rload-launcher\Rload\, added in preload contract v7 — see
// preload.js) with a localStorage fallback for browser/dev preview, mirroring
// the exact pattern src/lib/rload.js already uses for settings.
//
// This is a frontend-only V1: achievement evaluation runs locally against
// events recorded here. A future backend can become the source of truth by
// having getProfile()/recordGameEvent() call real endpoints instead — every
// consumer (components, ProfilePage) only talks to this module, never to
// window.rload.player directly, so that swap stays contained to this file.

import {
  createDefaultProfile, levelFromXp, DEFAULT_AVATAR_ID, DEFAULT_BANNER_ID, DEFAULT_TITLE_ID,
} from "./playerModels";
import { ACHIEVEMENTS, evaluateAchievements } from "./achievements";
import { notifyAchievementUnlocked, notifyCosmeticUnlocked, notifyLevelUp } from "./notifications";
import avatarManifest from "../data/avatars.json";
import bannerManifest from "../data/banners.json";
import badgeManifest from "../data/badges.json";
import titleManifest from "../data/titles.json";

const MANIFEST_BY_TYPE = {
  avatar: avatarManifest, banner: bannerManifest, badge: badgeManifest, title: titleManifest,
};
const UNLOCKED_KEY_BY_TYPE = {
  avatar: "unlockedAvatarIds", banner: "unlockedBannerIds", badge: "unlockedBadgeIds", title: "unlockedTitleIds",
};

function cosmeticName(type, id) {
  const entry = MANIFEST_BY_TYPE[type]?.find((e) => e.id === id);
  return entry?.name || entry?.title || id;
}

const DEFAULT_AVATAR_IDS = avatarManifest.filter((a) => a.unlockType === "default").map((a) => a.id);
const DEFAULT_BANNER_IDS = bannerManifest.filter((b) => b.unlockType === "default").map((b) => b.id);
const DEFAULT_BADGE_IDS  = badgeManifest.filter((b) => b.unlockType === "default").map((b) => b.id);
const DEFAULT_TITLE_IDS  = titleManifest.filter((t) => t.unlockType === "default").map((t) => t.id);

/** Parses "300 points" → 300. Non-numeric requirements resolve to Infinity (never auto-unlocks). */
function pointsThreshold(unlockRequirement) {
  const n = Number(String(unlockRequirement || "").match(/\d+/)?.[0]);
  return Number.isFinite(n) ? n : Infinity;
}

// ── Avatar ID migration (Premium Avatar Collection, replacing the temporary
// DiceBear set) ──────────────────────────────────────────────────────────
//
// Old manifest was 24 flat "rload-core-01".."20" (all default-unlocked) +
// "rload-founder-01".."04" (founder-gated). New manifest re-labels the same
// 24 *slots* into named characters across four rarity tiers. Mapped 1:1 in
// manifest order so a profile's existing `avatarId` and every entry already
// in `unlockedAvatarIds` carry over exactly — nobody's equipped avatar goes
// missing and nobody loses an avatar they'd already unlocked, even though
// the *new* manifest's own unlockType for that slot may now be stricter
// (e.g. old core-09..16 were free-for-everyone; the new rare equivalents are
// achievement/points-gated for anyone who didn't already have them).
const OLD_TO_NEW_AVATAR_ID = {
  "rload-core-01": "neon_scout", "rload-core-02": "circuit_fox", "rload-core-03": "pixel_nomad",
  "rload-core-04": "indigo_cat", "rload-core-05": "signal_bot", "rload-core-06": "lunar_owl",
  "rload-core-07": "arcade_runner", "rload-core-08": "violet_pilot",
  "rload-core-09": "crystal_ranger", "rload-core-10": "quantum_wolf", "rload-core-11": "aurora_hacker",
  "rload-core-12": "void_monk", "rload-core-13": "neon_raven", "rload-core-14": "cyber_ronin",
  "rload-core-15": "echo_explorer", "rload-core-16": "prism_guardian",
  "rload-core-17": "astral_warden", "rload-core-18": "rift_walker",
  "rload-core-19": "cosmic_alchemist", "rload-core-20": "shadow_navigator",
  "rload-founder-01": "celestial_engineer", "rload-founder-02": "nova_sentinel",
  "rload-founder-03": "day_zero_guardian", "rload-founder-04": "rload_founder",
};

/** Remaps old avatar IDs to their new-collection equivalents; unrecognized ids pass through untouched. */
function migrateAvatarIds(profile) {
  const migrate = (id) => OLD_TO_NEW_AVATAR_ID[id] || id;
  return {
    ...profile,
    avatarId: migrate(profile.avatarId),
    unlockedAvatarIds: [...new Set((profile.unlockedAvatarIds || []).map(migrate))],
  };
}

// ── Banner ID migration (Premium Banner Collection, 20 → 12) ────────────────
//
// Mapped by closest visual concept first, then rarity/unlock-method, sequence
// only as a last resort — per the brief. Several old ids intentionally
// collapse onto the same new id (the collection is consolidating, not just
// renaming 1:1 like the avatars were), which is expected: whoever had either
// old banner unlocked keeps the one new banner unlocked, no data lost.
//
//   rload-minimal-purple  → violet_horizon      (minimal violet/indigo ↔ same)
//   rload-cyber-grid      → neon_grid           (grid ↔ grid)
//   rload-neon-city       → arcade_pulse        (neon/retro-digital ↔ retro light trails)
//   rload-abstract-shapes → signal_field        (abstract digital shapes ↔ abstract wave field)
//   rload-purple-nebula   → pixel_nebula        (nebula ↔ nebula)
//   rload-ocean-depths    → crystal_void        (deep dark environment ↔ dark cosmic cavern)
//   rload-golden-hour     → celestial_engine    (warm gold glow ↔ warm gold energy core)
//   rload-forest          → indie_constellation (no concept match — sequence fallback)
//   rload-mountains       → rift_horizon        (no concept match — sequence fallback)
//   rload-pixel-sunset    → aurora_circuit      (gradient sky bands ↔ flowing aurora bands)
//   rload-arcade          → arcade_pulse        (arcade ↔ arcade)
//   rload-space           → celestial_engine    (cosmic energy ↔ energy core)
//   rload-pixel-galaxy    → pixel_nebula        (galaxy ↔ nebula, pixel ↔ pixel)
//   rload-retro-wave      → aurora_circuit      (wave ↔ flowing wave)
//   rload-desert-dunes    → infinite_library    (no concept match — sequence fallback)
//   rload-storm           → rift_horizon        (turbulent energy ↔ dimensional rift)
//   rload-crystal-cave    → crystal_void        (crystal ↔ crystal, cave ↔ void/cavern)
//   rload-aurora          → indie_constellation (this id is also a live achievement reward —
//                                                 see achievements.js studio_hopper, repointed there too)
//   rload-founders        → day_zero            (founder banner ↔ the one new founder banner)
//   rload-founders-eclipse→ day_zero
const OLD_TO_NEW_BANNER_ID = {
  "rload-minimal-purple": "violet_horizon", "rload-cyber-grid": "neon_grid",
  "rload-neon-city": "arcade_pulse", "rload-abstract-shapes": "signal_field",
  "rload-purple-nebula": "pixel_nebula", "rload-ocean-depths": "crystal_void",
  "rload-golden-hour": "celestial_engine", "rload-forest": "indie_constellation",
  "rload-mountains": "rift_horizon", "rload-pixel-sunset": "aurora_circuit",
  "rload-arcade": "arcade_pulse", "rload-space": "celestial_engine",
  "rload-pixel-galaxy": "pixel_nebula", "rload-retro-wave": "aurora_circuit",
  "rload-desert-dunes": "infinite_library", "rload-storm": "rift_horizon",
  "rload-crystal-cave": "crystal_void", "rload-aurora": "indie_constellation",
  "rload-founders": "day_zero", "rload-founders-eclipse": "day_zero",
};

/**
 * Remaps old banner IDs to their new-collection equivalents. Idempotent: once
 * a profile's ids are all new-collection ids, none match a key in the map and
 * every value passes through `|| id` unchanged, so re-running this on an
 * already-migrated profile is a pure no-op (same object shape, same values) —
 * safe to call unconditionally on every load rather than needing a
 * one-time-migration flag.
 */
function migrateBannerIds(profile) {
  const migrate = (id) => OLD_TO_NEW_BANNER_ID[id] || id;
  return {
    ...profile,
    bannerId: migrate(profile.bannerId),
    unlockedBannerIds: [...new Set((profile.unlockedBannerIds || []).map(migrate))],
  };
}

/**
 * Every avatar/banner/badge/title whose manifest unlockType is "default" must
 * be unlocked for everyone from day one. "points" entries unlock once the
 * profile's points reach their threshold; "founder" entries unlock once the
 * profile is a founding member. Applied on every load (not just at profile
 * creation) so it also self-heals profiles saved before this was in place,
 * and so newly-added cosmetics retroactively unlock for existing players.
 */
function withDefaultCosmeticsUnlocked(profile) {
  const union = (a, b) => [...new Set([...(a || []), ...b])];

  const autoUnlockedIds = (manifest) => manifest
    .filter((e) => (
      (e.unlockType === "points" && profile.points >= pointsThreshold(e.unlockRequirement)) ||
      (e.unlockType === "founder" && profile.foundingMember)
    ))
    .map((e) => e.id);

  return {
    ...profile,
    unlockedAvatarIds: union(profile.unlockedAvatarIds, [...DEFAULT_AVATAR_IDS, ...autoUnlockedIds(avatarManifest)]),
    unlockedBannerIds: union(profile.unlockedBannerIds, [...DEFAULT_BANNER_IDS, ...autoUnlockedIds(bannerManifest)]),
    unlockedBadgeIds: union(profile.unlockedBadgeIds, [...DEFAULT_BADGE_IDS, ...autoUnlockedIds(badgeManifest)]),
    unlockedTitleIds: union(profile.unlockedTitleIds, [...DEFAULT_TITLE_IDS, ...autoUnlockedIds(titleManifest)]),
    titleId: profile.titleId || DEFAULT_TITLE_ID,
  };
}

const LOCAL_KEY = "rload-player-profile";
const TRACKING_KEY = "rload-player-tracking";

function hasRload() {
  return typeof window !== "undefined" && !!window.rload?.player;
}

// ── Raw storage (profile + internal tracking sets) ──────────────────────────

async function readRaw() {
  if (hasRload()) {
    try {
      const res = await window.rload.player.get();
      if (res && typeof res === "object") return res;
    } catch {}
  }
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

async function writeRaw(data) {
  if (hasRload()) {
    try { await window.rload.player.set(data); return; } catch {}
  }
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(data)); } catch {}
}

function emptyTracking() {
  return {
    installedGameIds: [], launchedGameIds: [], playedGameIds: [],
    studiosPlayed: [], belgianGamesPlayed: [], hiddenGemGamesPlayed: [],
    weekendsPlayed: [],
  };
}

function toSets(tracking) {
  const t = tracking || emptyTracking();
  return {
    installedGameIds: new Set(t.installedGameIds || []),
    launchedGameIds: new Set(t.launchedGameIds || []),
    playedGameIds: new Set(t.playedGameIds || []),
    studiosPlayed: new Set(t.studiosPlayed || []),
    belgianGamesPlayed: new Set(t.belgianGamesPlayed || []),
    hiddenGemGamesPlayed: new Set(t.hiddenGemGamesPlayed || []),
    weekendsPlayed: new Set(t.weekendsPlayed || []),
  };
}

function fromSets(sets) {
  return Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, [...v]]));
}

function formatMinutes(mins) {
  const h = Math.floor((mins || 0) / 60);
  const m = (mins || 0) % 60;
  return `${h}h ${m}m`;
}

// ── Pub-sub so ProfileHeader/PlayerXPBar/etc. re-render on any change ───────

const listeners = new Set();
let cached = null;

function emit() {
  for (const cb of listeners) { try { cb(cached); } catch {} }
}

export function subscribeProfile(cb) {
  listeners.add(cb);
  if (cached) cb(cached);
  return () => listeners.delete(cb);
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Load (or initialize) the player profile for the given userId.
 * Safe to call multiple times — idempotent, always returns the cached copy
 * after the first successful load.
 * @returns {Promise<import("./playerModels").PlayerProfile>}
 */
export async function getProfile(userId) {
  const raw = await readRaw();
  cached = withDefaultCosmeticsUnlocked(migrateBannerIds(migrateAvatarIds(raw?.profile || createDefaultProfile(userId))));
  await persist();
  emit();
  return cached;
}

async function persist(tracking) {
  const raw = await readRaw();
  await writeRaw({
    profile: cached,
    tracking: tracking || raw?.tracking || emptyTracking(),
  });
}

async function getTracking() {
  const raw = await readRaw();
  return raw?.tracking || emptyTracking();
}

/** Set the active (equipped) avatar. No-ops if the avatar isn't unlocked. */
export async function setActiveAvatar(avatarId) {
  if (!cached || !cached.unlockedAvatarIds.includes(avatarId)) return cached;
  cached = { ...cached, avatarId };
  await persist();
  emit();
  return cached;
}

export async function setActiveBanner(bannerId) {
  if (!cached || !cached.unlockedBannerIds.includes(bannerId)) return cached;
  cached = { ...cached, bannerId };
  await persist();
  emit();
  return cached;
}

export async function setActiveBadge(badgeId) {
  if (!cached) return cached;
  if (badgeId && !cached.unlockedBadgeIds.includes(badgeId)) return cached;
  cached = { ...cached, activeBadgeId: badgeId || undefined };
  await persist();
  emit();
  return cached;
}

/** Set the active title shown under the display name. Pass null/undefined to show no title. */
export async function setActiveTitle(titleId) {
  if (!cached) return cached;
  if (titleId && !cached.unlockedTitleIds.includes(titleId)) return cached;
  cached = { ...cached, titleId: titleId || undefined };
  await persist();
  emit();
  return cached;
}

/** Optional, user-selected — no unlock gate. */
export async function setCountry(country) {
  if (!cached) return cached;
  cached = { ...cached, country: country || undefined };
  await persist();
  emit();
  return cached;
}

/** User-chosen display name override. Falls back to the Auth0 name/email when unset. */
export async function setDisplayName(name) {
  if (!cached) return cached;
  const trimmed = (name || "").trim();
  cached = { ...cached, displayName: trimmed || undefined };
  await persist();
  emit();
  return cached;
}

/** @returns {boolean} true if this call newly unlocked the cosmetic */
async function unlockCosmetic(type, id) {
  if (!cached) return false;
  const key = UNLOCKED_KEY_BY_TYPE[type];
  if (cached[key].includes(id)) return false;
  cached = { ...cached, [key]: [...cached[key], id] };
  return true;
}

export async function addXP(amount) {
  if (!cached || !amount) return { leveledUp: false };
  const before = levelFromXp(cached.xp);
  cached = { ...cached, xp: cached.xp + amount };
  const after = levelFromXp(cached.xp);
  await persist();
  emit();
  if (after.level > before.level) {
    notifyLevelUp(after.level);
    return { leveledUp: true, level: after.level };
  }
  return { leveledUp: false };
}

export async function addPoints(amount) {
  if (!cached || !amount) return;
  cached = { ...cached, points: cached.points + amount };
  await persist();
  emit();
}

/**
 * Record a gameplay event and re-evaluate achievements against updated
 * tracking sets. Fires unlock toasts for anything newly completed.
 * @param {{type:"installed"|"launched"|"session_completed", gameId:string, studio?:string, country?:string, isHiddenGem?:boolean, isWeekend?:boolean, weekKey?:string}} event
 */
export async function recordGameEvent(event) {
  if (!cached) return;
  const rawTracking = await getTracking();
  const tracking = toSets(rawTracking);
  let totalMinutesPlayed = rawTracking.totalMinutesPlayed || 0;

  if (event.type === "installed") tracking.installedGameIds.add(event.gameId);
  if (event.type === "launched") tracking.launchedGameIds.add(event.gameId);
  if (event.type === "session_completed") {
    tracking.playedGameIds.add(event.gameId);
    if (event.studio) tracking.studiosPlayed.add(event.studio);
    if (event.country === "Belgium") tracking.belgianGamesPlayed.add(event.gameId);
    if (event.isHiddenGem) tracking.hiddenGemGamesPlayed.add(event.gameId);
    if (event.isWeekend && event.weekKey) tracking.weekendsPlayed.add(event.weekKey);
    if (event.durationMinutes > 0) totalMinutesPlayed += event.durationMinutes;
  }

  const ctx = {
    ...tracking,
    isFoundingMember: cached.foundingMember,
  };
  const progress = evaluateAchievements(ctx);

  // completion_starter depends on the *other* completed achievements, so it's
  // finalized here once the rest of `progress` is known.
  const completedSoFar = new Set(cached.achievementIds);
  for (const [id, p] of Object.entries(progress)) if (p.completed) completedSoFar.add(id);
  const completionCount = [...completedSoFar].filter((id) => id !== "completion_starter").length;
  progress.completion_starter = {
    achievementId: "completion_starter",
    current: Math.min(completionCount, 5),
    goal: 5,
    completed: completionCount >= 5,
  };

  const newlyCompleted = [];
  for (const [id, p] of Object.entries(progress)) {
    if (p.completed && !cached.achievementIds.includes(id)) newlyCompleted.push(id);
  }

  cached = {
    ...cached,
    achievementProgress: { ...cached.achievementProgress, ...progress },
    stats: {
      ...cached.stats,
      gamesInstalled: tracking.installedGameIds.size,
      gamesPlayed: tracking.playedGameIds.size,
      hoursPlayed: formatMinutes(totalMinutesPlayed),
      studiosDiscovered: tracking.studiosPlayed.size,
      weekendsPlayed: [...tracking.weekendsPlayed],
    },
  };

  for (const id of newlyCompleted) {
    const achievement = ACHIEVEMENTS.find((a) => a.id === id);
    if (!achievement) continue;
    cached = { ...cached, achievementIds: [...cached.achievementIds, id] };
    await addXP(achievement.xp);
    await addPoints(achievement.points);
    notifyAchievementUnlocked(achievement);
    for (const reward of achievement.rewards) {
      const unlocked = await unlockCosmetic(reward.type, reward.id);
      if (unlocked) notifyCosmeticUnlocked(reward.type, cosmeticName(reward.type, reward.id));
    }
  }

  await persist({ ...fromSets(tracking), totalMinutesPlayed });
  emit();
}

export async function markFoundingMember() {
  if (!cached || cached.foundingMember) return;
  cached = { ...cached, foundingMember: true };
  await persist();
  emit();
  await recordGameEvent({ type: "_noop_recompute", gameId: "" });
}

export { DEFAULT_AVATAR_ID, DEFAULT_BANNER_ID, DEFAULT_TITLE_ID };
