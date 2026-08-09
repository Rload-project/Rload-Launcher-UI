// src/components/player/PlayerStatsCard.jsx
import React from "react";
import { T } from "../../lib/theme";

/** Generic small stat tile — the reusable version of ProfilePage's old inline overviewStats markup. */
export function PlayerStatsCard({ icon, label, value }) {
  return (
    <div style={{
      background:"rgba(255,255,255,.05)", borderRadius:16, border:"1px solid rgba(255,255,255,.07)",
      padding:"24px 16px", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8,
    }}>
      {typeof icon === "string" && (icon.startsWith(".") || icon.startsWith("/"))
        ? <span style={{ width:40, height:40, borderRadius:12, background:"rgba(114,85,229,.18)", display:"grid", placeItems:"center" }}><img src={icon} alt="" style={{ width:24, height:24 }} onError={(e) => (e.currentTarget.style.display = "none")} /></span>
        : <span style={{ width:40, height:40, borderRadius:12, background:"rgba(255,199,0,.18)", display:"grid", placeItems:"center", fontSize:24 }}>{icon}</span>}
      <div style={{ fontSize:14, color:T.textMuted, textAlign:"center" }}>{label}</div>
      <div style={{ fontSize:26, fontWeight:700, color:T.text, fontFamily:T.fontHead, textAlign:"center" }}>{value}</div>
    </div>
  );
}
