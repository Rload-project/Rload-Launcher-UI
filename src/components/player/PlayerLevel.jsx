// src/components/player/PlayerLevel.jsx
import React, { useEffect, useRef, useState } from "react";
import { T } from "../../lib/theme";

/** Small pill showing the player's current level. Pops briefly when the level increases. */
export function PlayerLevel({ level, size = "md" }) {
  const sm = size === "sm";
  const prevLevel = useRef(level);
  const [justLeveledUp, setJustLeveledUp] = useState(false);

  useEffect(() => {
    if (prevLevel.current !== undefined && level > prevLevel.current) {
      setJustLeveledUp(true);
      const timer = setTimeout(() => setJustLeveledUp(false), 600);
      prevLevel.current = level;
      return () => clearTimeout(timer);
    }
    prevLevel.current = level;
  }, [level]);

  return (
    <div
      className={justLeveledUp ? "rl-level-up-pop" : undefined}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: sm ? "2px 8px" : "4px 11px",
        borderRadius: T.radiusPill, background: T.brandGrad, boxShadow: T.brandGlow,
        fontFamily: T.fontHead, fontWeight: 700, color: "#fff",
        fontSize: sm ? 10.5 : 12.5, letterSpacing: "0.02em", whiteSpace: "nowrap",
      }}
    >
      <span style={{ opacity: 0.8 }}>Lvl</span>{level}
    </div>
  );
}
