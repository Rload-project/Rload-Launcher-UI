// src/components/player/PlayerXPBar.jsx
import React from "react";
import { T } from "../../lib/theme";
import { levelFromXp } from "../../lib/playerModels";

/** XP progress bar for the current level, driven purely by total xp. */
export function PlayerXPBar({ xp, showLabel = true }) {
  const { xpIntoLevel, xpForNextLevel, level } = levelFromXp(xp);
  const pct = xpForNextLevel > 0 ? Math.min(100, Math.round((xpIntoLevel / xpForNextLevel) * 100)) : 100;
  return (
    <div>
      <div style={{ height: 7, borderRadius: T.radiusPill, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`, borderRadius: T.radiusPill,
          background: T.brandGrad, transition: "width 0.4s ease-out",
        }} />
      </div>
      {showLabel && (
        <div style={{ marginTop: 5, fontSize: 10.5, color: T.textDim, display: "flex", justifyContent: "space-between" }}>
          <span>{xpIntoLevel} / {xpForNextLevel} XP</span>
          <span>Level {level + 1} next</span>
        </div>
      )}
    </div>
  );
}
