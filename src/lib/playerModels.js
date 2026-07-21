// src/lib/playerModels.js
//
// Player Identity — data architecture.
// These are the shapes every future Player Identity feature (profile, avatars,
// banners, badges, achievements, XP/levels) is built against. The backend is
// the eventual source of truth for achievements/XP; this module only defines
// the contract and small pure helpers so the frontend can work standalone
// today (see playerStore.js for persistence).
//
// Nothing here implies balancing — the XP curve is a placeholder architecture,
// not tuned progression design.

/**
 * @typedef {"common"|"rare"|"epic"|"legendary"} PlayerRarity
 */

/**
 * @typedef {"default"|"points"|"achievement"|"founder"|"promo"} UnlockType
 * - "default"     — unlocked for every player from the start
 * - "points"      — unlocked once the player has spent/reached a points threshold
 * - "achievement" — unlocked by completing a specific achievement id
 * - "founder"     — reserved for early-adopter / Founding Member accounts
 * - "promo"       — granted directly (seasonal event, contest, partnership, future
 *                   promotion) rather than evaluated client-side; playerStore never
 *                   auto-unlocks these — something external calls unlockCosmetic()
 *                   (or a future backend just writes the id into the profile's
 *                   unlocked*Ids list) the same way an achievement reward does.
 *
 * Avatars/banners/badges/titles are all defined against this same union — a
 * PlayerTitle is not a sub-type of achievement rewards, it's an independent
 * cosmetic manifest (src/data/titles.json) that achievements *may* reference
 * via a "title"-type entry in PlayerAchievement.rewards, exactly like they
 * reference badges/avatars/banners. Nothing about the Titles system assumes
 * an achievement is involved.
 */

/**
 * @typedef {Object} PlayerAvatar
 * @property {string} id
 * @property {string} name
 * @property {PlayerRarity} rarity
 * @property {UnlockType} unlockType
 * @property {string} [unlockRequirement]   human-readable condition, or achievement id when unlockType==="achievement"
 * @property {string} preview               path to a small preview image
 * @property {string} asset                 path to the full asset
 * @property {boolean} [locked]             static manifest hint only — actual lock state is always computed at
 *                                           runtime against profile.unlockedAvatarIds, never read from this field
 * @property {string} [category]            thematic grouping (e.g. "explorer", "tech", "warrior"), display-only
 * @property {string} [description]          one-line flavor text shown in the picker
 */

/**
 * @typedef {Object} PlayerBanner
 * @property {string} id
 * @property {string} name                  (older entries may use `title` — read both)
 * @property {string} preview
 * @property {string} asset
 * @property {PlayerRarity} [rarity]
 * @property {UnlockType} unlockType
 * @property {string} [unlockRequirement]
 * @property {string} [category]            thematic grouping (e.g. "cosmic", "digital", "tech"), display-only
 * @property {string} [description]          one-line flavor text shown in the picker
 */

/**
 * @typedef {Object} PlayerBadge
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} preview
 * @property {string} asset
 * @property {PlayerRarity} [rarity]
 * @property {UnlockType} unlockType
 * @property {string} [unlockRequirement]
 * @property {string} [category]            thematic grouping (e.g. "starter", "milestone", "loyalty", "founder"), display-only
 */

/**
 * @typedef {Object} PlayerTitle
 * A cosmetic label shown under the player's display name (e.g. "Day Zero").
 * Distinct from PlayerBadge — titles are text-only, no image asset.
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {UnlockType} unlockType
 * @property {string} [unlockRequirement]
 * @property {boolean} [locked]
 */

/**
 * @typedef {"discovery"|"studios"|"playtime"|"exploration"|"special"|"community"} AchievementCategory
 * Future categories append to this union without breaking existing data —
 * unrecognized categories should render under a generic fallback group.
 */

/**
 * @typedef {"easy"|"medium"|"hard"} AchievementDifficulty
 */

/**
 * @typedef {Object} PlayerReward
 * @property {"avatar"|"banner"|"badge"|"title"} type
 * @property {string} id   references PlayerAvatar.id / PlayerBanner.id / PlayerBadge.id / PlayerTitle.id
 */

/**
 * @typedef {Object} PlayerAchievement
 * @property {string} id
 * @property {AchievementCategory} category
 * @property {string} titleKey          i18n key (LANGS)
 * @property {string} descriptionKey    i18n key (LANGS)
 * @property {AchievementDifficulty} difficulty
 * @property {number} xp
 * @property {number} points
 * @property {number} goal              target count for progress (1 for one-shot achievements)
 * @property {string} [icon]            path to this achievement's badge art
 * @property {PlayerReward[]} rewards   zero, one, or many cosmetic rewards, never monetary
 */

/**
 * @typedef {Object} PlayerProgress
 * @property {string} achievementId
 * @property {number} current
 * @property {number} goal
 * @property {boolean} completed
 * @property {string} [completedAt]     ISO date
 */

/**
 * @typedef {Object} PlayerLevel
 * @property {number} level
 * @property {number} xp                total XP accumulated
 * @property {number} xpIntoLevel        xp earned since reaching `level`
 * @property {number} xpForNextLevel     xp required to reach `level + 1`
 */

/**
 * @typedef {Object} PlayerStats
 * @property {number} gamesInstalled
 * @property {number} gamesPlayed
 * @property {string} hoursPlayed        formatted display string, e.g. "8h 42m" — derived from tracked session minutes
 * @property {number} studiosDiscovered
 * @property {string[]} weekendsPlayed   ISO week keys (e.g. "2026-W28") the player played in
 */

/**
 * @typedef {Object} PlayerProfile
 * @property {string} userId
 * @property {string} displayName
 * @property {string} avatarId
 * @property {string} bannerId
 * @property {string} [activeBadgeId]
 * @property {string} titleId                    always set — falls back to DEFAULT_TITLE_ID
 * @property {number} xp
 * @property {number} points                     cosmetic-only currency, never redeemable for money
 * @property {string[]} unlockedAvatarIds
 * @property {string[]} unlockedBannerIds
 * @property {string[]} unlockedBadgeIds
 * @property {string[]} unlockedTitleIds
 * @property {string[]} achievementIds            completed achievement ids
 * @property {Record<string, PlayerProgress>} achievementProgress  keyed by achievementId
 * @property {PlayerStats} stats
 * @property {boolean} foundingMember
 * @property {string} memberSince                 ISO date
 * @property {string} [country]                   optional, user-selected ISO country code
 */

// ── Defaults ────────────────────────────────────────────────────────────────

export const DEFAULT_AVATAR_ID = "rload-core-01";
export const DEFAULT_BANNER_ID = "neon_grid";
export const DEFAULT_TITLE_ID = "title-rload-member";

/** @returns {PlayerProfile} */
export function createDefaultProfile(userId) {
  return {
    userId: userId || "local",
    displayName: "",
    avatarId: DEFAULT_AVATAR_ID,
    bannerId: DEFAULT_BANNER_ID,
    activeBadgeId: undefined,
    titleId: DEFAULT_TITLE_ID,
    xp: 0,
    points: 0,
    unlockedAvatarIds: [DEFAULT_AVATAR_ID],
    unlockedBannerIds: [DEFAULT_BANNER_ID],
    unlockedBadgeIds: [],
    unlockedTitleIds: [DEFAULT_TITLE_ID],
    achievementIds: [],
    achievementProgress: {},
    stats: {
      gamesInstalled: 0,
      gamesPlayed: 0,
      hoursPlayed: "0h 0m",
      studiosDiscovered: 0,
      weekendsPlayed: [],
    },
    foundingMember: false,
    memberSince: new Date().toISOString(),
    country: undefined,
  };
}

// ── XP / Level curve (architecture only — not balanced) ─────────────────────
//
// Placeholder quadratic curve: level N requires N * 500 more XP than level N-1.
// xpForLevel(1) = 0, xpForLevel(2) = 500, xpForLevel(3) = 1500, xpForLevel(4) = 3000 ...
// Swap this single function out when real balancing lands — every consumer
// (PlayerLevel, PlayerXPBar, notifications) goes through levelFromXp().

const XP_STEP = 500;

/** Total cumulative XP required to *reach* `level`. */
export function xpForLevel(level) {
  if (level <= 1) return 0;
  let total = 0;
  for (let l = 2; l <= level; l++) total += (l - 1) * XP_STEP;
  return total;
}

/** @returns {PlayerLevel} */
export function levelFromXp(xp) {
  const safeXp = Math.max(0, xp || 0);
  let level = 1;
  while (xpForLevel(level + 1) <= safeXp) level++;
  const xpIntoLevel = safeXp - xpForLevel(level);
  const xpForNextLevel = xpForLevel(level + 1) - xpForLevel(level);
  return { level, xp: safeXp, xpIntoLevel, xpForNextLevel };
}

// ── Achievement point/XP table (difficulty → reward) ────────────────────────

export const ACHIEVEMENT_DIFFICULTY_XP = {
  easy: 100,
  medium: 250,
  hard: 500,
};

export const ACHIEVEMENT_DIFFICULTY_POINTS = {
  easy: 100,
  medium: 250,
  hard: 500,
};

export const ACHIEVEMENT_CATEGORIES = [
  "discovery", "studios", "playtime", "exploration", "special", "community",
];
