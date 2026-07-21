// src/lib/achievements.js
//
// Achievement architecture + evaluation engine.
//
// The backend is the eventual source of truth for achievement completion.
// This module lets the launcher evaluate achievements locally today (V1,
// frontend-only) against events recorded by playerStore.recordGameEvent(),
// using the exact same PlayerAchievement shape a future backend endpoint
// would return — so swapping local evaluation for a server response later
// is a data-source change, not a UI rewrite.
//
// Known limitation (tracked, not hidden): "belgian_explorer" and
// "hidden_gem_hunter" need catalog metadata (studio country, hidden-gem tag)
// that the current catalog.json schema does not expose yet. The engine reads
// `game.country` / `game.isHiddenGem` when present and simply never
// completes those two achievements until the catalog carries that data —
// this is intentionally partial per the Player Identity V2 brief.

import { ACHIEVEMENT_DIFFICULTY_XP, ACHIEVEMENT_DIFFICULTY_POINTS } from "./playerModels";

/**
 * `rewards` is always an array — zero, one, or many {type, id} entries of any
 * PlayerReward type (avatar/banner/badge/title). Achievements never grant XP
 * directly beyond the difficulty table below; everything else an achievement
 * hands out goes through this one list, so adding a new reward type or
 * granting several rewards from one achievement is a data change here, never
 * a new field or a new code path in playerStore/RewardPreview.
 *
 * @type {import("./playerModels").PlayerAchievement[]}
 */
export const ACHIEVEMENTS = [
  {
    id: "first_step", category: "discovery", difficulty: "easy", goal: 1,
    titleKey: "ach_first_step_title", descriptionKey: "ach_first_step_desc",
    icon: "./assets/player/achievements/boot_sequence.svg",
    rewards: [{ type: "badge", id: "badge-first-steps" }],
  },
  {
    id: "first_launch", category: "discovery", difficulty: "easy", goal: 1,
    titleKey: "ach_first_launch_title", descriptionKey: "ach_first_launch_desc",
    icon: "./assets/player/achievements/ignition.svg",
    rewards: [{ type: "badge", id: "badge-dedicated" }],
  },
  {
    id: "first_discovery", category: "discovery", difficulty: "easy", goal: 1,
    titleKey: "ach_first_discovery_title", descriptionKey: "ach_first_discovery_desc",
    icon: "./assets/player/achievements/signal_found.svg",
    rewards: [{ type: "badge", id: "badge-trailblazer" }, { type: "title", id: "title-signal-hunter" }],
  },
  {
    id: "explorer_i", category: "exploration", difficulty: "medium", goal: 3,
    titleKey: "ach_explorer_i_title", descriptionKey: "ach_explorer_i_desc",
    icon: "./assets/player/achievements/beyond_the_first.svg",
    rewards: [{ type: "badge", id: "badge-collector" }],
  },
  {
    id: "explorer_ii", category: "exploration", difficulty: "hard", goal: 10,
    titleKey: "ach_explorer_ii_title", descriptionKey: "ach_explorer_ii_desc",
    icon: "./assets/player/achievements/wide_horizon.svg",
    rewards: [{ type: "badge", id: "badge-explorer" }, { type: "title", id: "title-wide-horizon" }, { type: "avatar", id: "quantum_wolf" }],
  },
  {
    id: "studio_hopper", category: "studios", difficulty: "medium", goal: 5,
    titleKey: "ach_studio_hopper_title", descriptionKey: "ach_studio_hopper_desc",
    icon: "./assets/player/achievements/studio_drifter.svg",
    rewards: [{ type: "banner", id: "indie_constellation" }, { type: "title", id: "title-studio-drifter" }, { type: "avatar", id: "aurora_hacker" }],
  },
  {
    id: "belgian_explorer", category: "exploration", difficulty: "medium", goal: 3,
    titleKey: "ach_belgian_explorer_title", descriptionKey: "ach_belgian_explorer_desc",
    icon: "./assets/player/achievements/local_frequency.svg",
    rewards: [{ type: "badge", id: "badge-belgian-gamer" }, { type: "title", id: "title-local-frequency" }, { type: "avatar", id: "rift_walker" }],
  },
  {
    id: "hidden_gem_hunter", category: "discovery", difficulty: "medium", goal: 3,
    titleKey: "ach_hidden_gem_hunter_title", descriptionKey: "ach_hidden_gem_hunter_desc",
    icon: "./assets/player/achievements/below_the_surface.svg",
    rewards: [{ type: "badge", id: "badge-hidden-gem-seeker" }, { type: "title", id: "title-gem-hunter" }, { type: "avatar", id: "crystal_ranger" }],
  },
  {
    id: "weekend_player", category: "playtime", difficulty: "medium", goal: 3,
    titleKey: "ach_weekend_player_title", descriptionKey: "ach_weekend_player_desc",
    icon: "./assets/player/achievements/weekend_ritual.svg",
    rewards: [{ type: "badge", id: "badge-weekend-warrior" }, { type: "avatar", id: "void_monk" }],
  },
  {
    id: "completion_starter", category: "special", difficulty: "easy", goal: 5,
    titleKey: "ach_completion_starter_title", descriptionKey: "ach_completion_starter_desc",
    icon: "./assets/player/achievements/chain_reaction.svg",
    rewards: [{ type: "badge", id: "badge-achievement-hunter" }, { type: "title", id: "title-chain-reactor" }, { type: "avatar", id: "astral_warden" }],
  },
  {
    id: "founding_member", category: "special", difficulty: "hard", goal: 1,
    titleKey: "ach_founding_member_title", descriptionKey: "ach_founding_member_desc",
    icon: "./assets/player/achievements/day_zero.svg",
    rewards: [{ type: "banner", id: "day_zero" }, { type: "title", id: "title-day-zero" }],
  },
].map((a) => ({
  ...a,
  xp: ACHIEVEMENT_DIFFICULTY_XP[a.difficulty],
  points: ACHIEVEMENT_DIFFICULTY_POINTS[a.difficulty],
}));

export function getAchievement(id) {
  return ACHIEVEMENTS.find((a) => a.id === id) || null;
}

/**
 * Local play-event context the engine evaluates achievements against.
 * All sets are of gameId (or studio name / week key) strings.
 * @typedef {Object} PlayEventContext
 * @property {Set<string>} installedGameIds
 * @property {Set<string>} launchedGameIds
 * @property {Set<string>} playedGameIds        game had a completed play session
 * @property {Set<string>} studiosPlayed
 * @property {Set<string>} belgianGamesPlayed    requires catalog.country === "Belgium"
 * @property {Set<string>} hiddenGemGamesPlayed  requires catalog.isHiddenGem === true
 * @property {Set<string>} weekendsPlayed        ISO week keys, weekend sessions only
 * @property {boolean} isFoundingMember
 */

function progressFor(id, current, goal) {
  return { achievementId: id, current: Math.min(current, goal), goal, completed: current >= goal };
}

/**
 * Pure function: given a play-event context, returns updated progress for
 * every achievement. Does not mutate the profile — the caller (playerStore)
 * decides what to persist and which newly-completed achievements to grant
 * XP/points/rewards for and surface as unlock toasts.
 *
 * @param {PlayEventContext} ctx
 * @returns {Record<string, import("./playerModels").PlayerProgress>}
 */
export function evaluateAchievements(ctx) {
  const out = {};
  out.first_step = progressFor("first_step", ctx.installedGameIds.size > 0 ? 1 : 0, 1);
  out.first_launch = progressFor("first_launch", ctx.launchedGameIds.size > 0 ? 1 : 0, 1);
  out.first_discovery = progressFor("first_discovery", ctx.playedGameIds.size > 0 ? 1 : 0, 1);
  out.explorer_i = progressFor("explorer_i", ctx.playedGameIds.size, 3);
  out.explorer_ii = progressFor("explorer_ii", ctx.playedGameIds.size, 10);
  out.studio_hopper = progressFor("studio_hopper", ctx.studiosPlayed.size, 5);
  out.belgian_explorer = progressFor("belgian_explorer", ctx.belgianGamesPlayed.size, 3);
  out.hidden_gem_hunter = progressFor("hidden_gem_hunter", ctx.hiddenGemGamesPlayed.size, 3);
  out.weekend_player = progressFor("weekend_player", ctx.weekendsPlayed.size, 3);
  out.founding_member = progressFor("founding_member", ctx.isFoundingMember ? 1 : 0, 1);
  // completion_starter depends on how many *other* achievements are already
  // completed — computed by the caller once it knows the merged progress set,
  // so it's intentionally left out here and finalized in playerStore.
  return out;
}
