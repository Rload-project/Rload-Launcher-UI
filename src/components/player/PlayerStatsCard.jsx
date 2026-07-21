// src/components/player/PlayerStatsCard.jsx
import React from "react";
import { T } from "../../lib/theme";

/** Generic small stat tile — the reusable version of ProfilePage's old inline overviewStats markup. */
export function PlayerStatsCard({ icon, label, value }) {
  return (
    <div style={{
      background: "rgba(128,74,240,0.14)", borderRadius: "0.65rem", border: `1px solid ${T.borderBrand}`,
      padding: "12px 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
    }}>
      {typeof icon === "string" && (icon.startsWith(".") || icon.startsWith("/"))
        ? <img src={icon} alt="" style={{ width: 22, height: 22 }} onError={(e) => (e.currentTarget.style.display = "none")} />
        : <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>}
      <div style={{ fontSize: 11.5, color: T.textSub, textAlign: "center", lineHeight: 1.25 }}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 700, color: T.text, textAlign: "center" }}>{value}</div>
    </div>
  );
}
