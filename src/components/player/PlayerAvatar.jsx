// src/components/player/PlayerAvatar.jsx
import React from "react";
import { T } from "../../lib/theme";
import avatars from "../../data/avatars.json";

export function findAvatar(avatarId) {
  return avatars.find((a) => a.id === avatarId) || null;
}

/**
 * Renders the player's active avatar. Falls back to an initial-letter circle
 * (the pre-Player-Identity behavior) if the avatarId isn't found, so it's
 * always safe to render even for profiles created before this feature.
 */
export function PlayerAvatar({ avatarId, fallbackInitial = "U", size = 48, ring = true }) {
  const avatar = findAvatar(avatarId);
  const style = {
    width: size, height: size, borderRadius: "50%", flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: avatar ? T.bgCard : T.brandGrad,
    border: ring ? `2px solid ${T.borderBrand}` : "none",
    boxShadow: ring ? T.brandGlow : "none",
    overflow: "hidden",
  };
  if (avatar) {
    return (
      <div style={style} title={avatar.name}>
        <img src={avatar.asset} alt={avatar.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    );
  }
  return (
    <div style={{ ...style, fontSize: size * 0.42, fontWeight: 800, color: "#fff", fontFamily: T.fontHead }}>
      {fallbackInitial}
    </div>
  );
}
