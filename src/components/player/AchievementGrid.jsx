// src/components/player/AchievementGrid.jsx
import React from "react";
import { T } from "../../lib/theme";
import { ACHIEVEMENTS } from "../../lib/achievements";
import { ACHIEVEMENT_CATEGORIES } from "../../lib/playerModels";
import { AchievementCard } from "./AchievementCard.jsx";

/**
 * Groups all known achievements by category. Unknown/future categories fall
 * back into a generic trailing group instead of being dropped.
 * @param {{ profile: import("../../lib/playerModels").PlayerProfile, t: Record<string,string> }} props
 */
export function AchievementGrid({ profile, t }) {
  const known = new Set(ACHIEVEMENT_CATEGORIES);
  const extraCategories = [...new Set(ACHIEVEMENTS.map((a) => a.category).filter((c) => !known.has(c)))];
  const orderedCategories = [...ACHIEVEMENT_CATEGORIES, ...extraCategories];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {orderedCategories.map((category) => {
        const items = ACHIEVEMENTS.filter((a) => a.category === category);
        if (!items.length) return null;
        const categoryLabel = t[`achCategory_${category}`] || category;
        return (
          <div key={category}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase",
              letterSpacing: "0.08em", marginBottom: 10, paddingLeft: 2,
            }}>
              {categoryLabel}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
              {items.map((achievement) => (
                <AchievementCard
                  key={achievement.id}
                  achievement={achievement}
                  progress={profile.achievementProgress?.[achievement.id]}
                  title={t[achievement.titleKey] || achievement.id}
                  description={t[achievement.descriptionKey] || ""}
                  categoryLabel={categoryLabel}
                  t={t}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
