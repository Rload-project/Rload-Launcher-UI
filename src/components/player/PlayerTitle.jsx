// src/components/player/PlayerTitle.jsx
import React from "react";
import { T } from "../../lib/theme";
import titles from "../../data/titles.json";

export function findTitle(titleId) {
  return titles.find((tt) => tt.id === titleId) || null;
}

/** Small text label shown under the player's display name. Renders nothing if no title is set. */
export function PlayerTitle({ titleId }) {
  const title = findTitle(titleId);
  if (!title) return null;
  return (
    <span
      title={title.description}
      style={{
        fontSize: 12, fontWeight: 700, color: T.brandLight, letterSpacing: "0.02em",
        padding: "1px 9px", borderRadius: T.radiusPill, border: `1px solid ${T.borderBrand}`,
        background: "rgba(128,74,240,0.10)", whiteSpace: "nowrap",
      }}
    >
      {title.name}
    </span>
  );
}
