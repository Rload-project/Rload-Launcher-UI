// src/components/player/AchievementsPage.jsx
import React from "react";
import { T } from "../../lib/theme";
import { PlayerIcon } from "./icons.jsx";
import { AchievementGrid } from "./AchievementGrid.jsx";
import { ACHIEVEMENTS } from "../../lib/achievements";

/**
 * Achievements sub-page. Keeps its own small shell (rather than importing
 * SubPageShell from routes/launcher-games.jsx) to avoid a circular import —
 * that file imports this component.
 */
export function AchievementsPage({ profile, t, onBack }) {
  const completedCount = profile.achievementIds.length;
  return (
    <div style={{ flex: 1, overflowY: "auto", fontFamily: T.fontBody, scrollBehavior: "smooth" }}>
      <div style={{ padding: "20px 28px 0", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${T.border}`, paddingBottom: 16 }}>
        <div onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: T.textMuted, fontSize: 13, padding: "5px 10px", borderRadius: T.radiusSm, background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, userSelect: "none" }}>
          <PlayerIcon.ChevronRight style={{ transform: "rotate(180deg)" }} /> {t.backToProfile || "Back"}
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: T.text, fontFamily: T.fontHead, letterSpacing: "-0.2px" }}>
          {t.achievements || "Achievements"}
        </div>
        <div style={{ marginLeft: "auto", fontSize: 12, color: T.textMuted }}>
          {completedCount} / {ACHIEVEMENTS.length}
        </div>
      </div>
      <div style={{ padding: "24px 28px" }}>
        <AchievementGrid profile={profile} t={t} />
      </div>
    </div>
  );
}
