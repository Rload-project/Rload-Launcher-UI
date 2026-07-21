// src/lib/notifications.js
//
// Toast notification queue — a small pub-sub, independent of any component.
// Every future notification (this feature or later ones) should push through
// here rather than inventing another ad-hoc toast, so there is exactly one
// stacking/queueing/dismissal behavior in the whole launcher.
//
// Only one toast is ever shown at a time (large achievement/reward moments
// are meant to be read, not skimmed past in a stack). Everything else queues
// FIFO behind it — order preserved, nothing dropped, nothing duplicated.
// Timing (enter/visible/exit/gap) lives here as the single source of truth;
// UnlockToast/NotificationToastHost only consume these constants.

import { playSound } from "./sounds";

/** @typedef {"achievement_unlocked"|"avatar_unlocked"|"banner_unlocked"|"badge_unlocked"|"title_unlocked"|"level_up"|"profile_updated"|"game_completed"|"game_installed"|"subscription_activated"|"game_update_installed"} NotificationType */

/**
 * @typedef {Object} ToastNotification
 * @property {string} id
 * @property {NotificationType} type
 * @property {string} titleKey        i18n key
 * @property {string} [bodyKey]       i18n key
 * @property {Record<string,string>} [vars]   interpolation values for titleKey/bodyKey
 * @property {string} [icon]          emoji or asset path shown in the toast
 * @property {number} createdAt
 */

export const NOTIFICATION_ENTER_MS = 300;
export const NOTIFICATION_VISIBLE_MS = 3500;
export const NOTIFICATION_EXIT_MS = 350;
export const NOTIFICATION_GAP_MS = 1000;

// Kept for any external caller still importing this — equal to the visible
// duration, since that's the only timing figure that used to exist.
export const NOTIFICATION_DURATION_MS = NOTIFICATION_VISIBLE_MS;

let pending = [];       // FIFO queue of not-yet-shown notifications
let active = null;       // the one notification currently on screen, or null
let gapTimer = null;
const listeners = new Set();

function emit() {
  const snapshot = { active, queuedCount: pending.length };
  for (const cb of listeners) {
    try { cb(snapshot); } catch {}
  }
}

// Whether we've ever shown a toast yet — the very first one should appear
// immediately, not after an artificial 1s gap.
let wasFirstEver = true;

/**
 * Pulls the next queued notification onto screen, after the inter-toast gap.
 * Guarded so at most one gap timer is ever in flight: pushNotification() calls
 * this once per push, and several pushes can land synchronously (e.g. an
 * achievement unlock that grants XP + a badge + a level-up all in one
 * recordGameEvent() call) — without the `gapTimer` guard, each of those calls
 * would schedule its own timer, and whichever fired first would blindly
 * overwrite `active` out from under the one already showing, cutting its
 * visible duration short instead of queuing behind it.
 */
function advanceQueue() {
  if (active || gapTimer || !pending.length) return;
  const delay = wasFirstEver ? 0 : NOTIFICATION_GAP_MS;
  wasFirstEver = false;
  gapTimer = setTimeout(() => {
    gapTimer = null;
    if (active || !pending.length) return;
    active = pending.shift();
    emit();
  }, delay);
}

/**
 * @param {Omit<ToastNotification, "id"|"createdAt">} notif
 */
export function pushNotification(notif) {
  const entry = {
    ...notif,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };
  pending = [...pending, entry];
  emit();
  advanceQueue();
  return entry.id;
}

/** Called by the toast UI once its exit animation has finished. */
export function dismissNotification(id) {
  if (active?.id !== id) return;
  active = null;
  emit();
  advanceQueue();
}

export function subscribeNotifications(cb) {
  listeners.add(cb);
  cb({ active, queuedCount: pending.length });
  return () => listeners.delete(cb);
}

// ── Convenience builders for the Player Identity events ─────────────────────
//
// Each of these is also the sound trigger point (see lib/sounds.js) — one
// playSound() call right where the notification is created, so a toast and
// its sound can never drift out of sync or fire independently of each other.

export function notifyAchievementUnlocked(achievement) {
  playSound("achievement_unlocked");
  return pushNotification({
    type: "achievement_unlocked",
    titleKey: "notifAchievementUnlockedTitle",
    bodyKey: achievement.titleKey,
    icon: achievement.icon || "🏆",
  });
}

export function notifyCosmeticUnlocked(kind, name) {
  playSound("cosmetic_unlocked");
  const typeMap = { avatar: "avatar_unlocked", banner: "banner_unlocked", badge: "badge_unlocked", title: "title_unlocked" };
  const iconMap = { avatar: "🧑‍🚀", banner: "🖼️", badge: "🎖️", title: "🏷️" };
  return pushNotification({
    type: typeMap[kind],
    titleKey: `notif${kind[0].toUpperCase()}${kind.slice(1)}UnlockedTitle`,
    vars: { name },
    icon: iconMap[kind],
  });
}

export function notifyLevelUp(level) {
  playSound("level_up");
  return pushNotification({
    type: "level_up",
    titleKey: "notifLevelUpTitle",
    vars: { level: String(level) },
    icon: "⭐",
  });
}
