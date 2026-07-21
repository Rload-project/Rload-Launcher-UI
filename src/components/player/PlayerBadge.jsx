// src/components/player/PlayerBadge.jsx
import React from "react";
import badges from "../../data/badges.json";

export function findBadge(badgeId) {
  return badges.find((b) => b.id === badgeId) || null;
}

/** Small circular badge icon with a native tooltip. Renders nothing if no badge is active. */
export function PlayerBadge({ badgeId, size = 22 }) {
  const badge = findBadge(badgeId);
  if (!badge) return null;
  return (
    <img
      src={badge.asset}
      alt={badge.name}
      title={`${badge.name} — ${badge.description}`}
      style={{ width: size, height: size, display: "block" }}
    />
  );
}
