// src/components/player/AchievementCard.jsx
import React from "react";
import { T } from "../../lib/theme";
import { PlayerIcon } from "./icons.jsx";
import { RewardPreview } from "./RewardPreview.jsx";

const DIFFICULTY_COLOR = {
  easy: T.green, medium: T.orange, hard: T.red,
};

/**
 * @param {{
 *   achievement: import("../../lib/playerModels").PlayerAchievement,
 *   progress: import("../../lib/playerModels").PlayerProgress | undefined,
 *   title: string, description: string, categoryLabel?: string,
 *   t?: Record<string,string>,
 *   justUnlocked?: boolean,
 * }} props
 */
export function AchievementCard({ achievement, progress, title, description, categoryLabel, t = {}, justUnlocked = false }) {
  const current = progress?.current ?? 0;
  const goal = achievement.goal;
  const completed = progress?.completed ?? false;
  const pct = goal > 0 ? Math.min(100, Math.round((current / goal) * 100)) : 0;
  const diffColor = DIFFICULTY_COLOR[achievement.difficulty] || T.textMuted;
  // Day Zero is the one-of-a-kind founding-era badge — it gets the premium
  // gold-glow treatment the rest of the collection intentionally doesn't.
  const isPremiumHero = achievement.id === "founding_member" && completed;

  return (
    <div
      className={[justUnlocked && "rl-unlock-pulse", isPremiumHero && "rl-day-zero-glow"].filter(Boolean).join(" ") || undefined}
      style={{
        borderRadius: T.radius,
        border: `1px solid ${isPremiumHero ? "rgba(255,194,75,0.55)" : completed ? T.borderBrand : T.border}`,
        background: completed ? "rgba(128,74,240,0.08)" : T.bgCard,
        padding: 16, display: "flex", flexDirection: "column", gap: 10,
        opacity: completed ? 1 : 0.92,
        transition: "background 0.2s ease, border-color 0.2s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: "0.7rem", flexShrink: 0,
          background: achievement.icon ? "transparent" : (completed ? T.brandGrad : "rgba(255,255,255,0.06)"),
          border: achievement.icon ? "none" : `1px solid ${completed ? T.borderBrand : T.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: completed ? "#fff" : T.textMuted,
        }}>
          {achievement.icon ? (
            <img
              src={achievement.icon}
              alt=""
              style={{
                width: "100%", height: "100%", objectFit: "contain",
                filter: completed ? "none" : "grayscale(0.7) brightness(0.65)",
                transition: "filter 0.25s ease",
              }}
            />
          ) : (
            <PlayerIcon.Trophy />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text, fontFamily: T.fontHead }}>{title}</div>
            {categoryLabel && (
              <span style={{
                fontSize: 9, fontWeight: 700, color: T.textDim, textTransform: "uppercase",
                letterSpacing: "0.05em", padding: "1px 6px", borderRadius: T.radiusPill,
                border: `1px solid ${T.border}`,
              }}>
                {categoryLabel}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 2, lineHeight: 1.4 }}>{description}</div>
        </div>
        {completed && (
          <div style={{
            width: 22, height: 22, borderRadius: "50%", background: T.green, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
          }}>
            <PlayerIcon.Check />
          </div>
        )}
      </div>

      <div>
        <div style={{ height: 6, borderRadius: T.radiusPill, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, borderRadius: T.radiusPill, background: completed ? T.green : T.brandGrad, transition: "width 0.3s ease" }} />
        </div>
        <div style={{ marginTop: 4, fontSize: 10, color: T.textDim }}>{current} / {goal}</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: diffColor, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {achievement.difficulty}
        </span>
        <span style={{ fontSize: 10.5, color: T.brandLight, fontWeight: 600 }}>+{achievement.xp} XP</span>
      </div>

      {achievement.rewards?.length > 0 && (
        <div style={{ paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
          <RewardPreview rewards={achievement.rewards} t={t} />
        </div>
      )}
    </div>
  );
}
