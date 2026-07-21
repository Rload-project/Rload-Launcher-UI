// src/components/player/PlayerBanner.jsx
import React, { useState } from "react";
import { T } from "../../lib/theme";
import banners from "../../data/banners.json";

export function findBanner(bannerId) {
  return banners.find((b) => b.id === bannerId) || null;
}

/**
 * Renders the player's active banner as a slowly-animated background image
 * (subtle Ken Burns drift + a diagonal light sheen sweep, à la Call of Duty
 * emblem banners) — gives the header a "living" feel instead of a flat,
 * static image. Falls back to the brand gradient wash if bannerId isn't found.
 *
 * `onEdit`, if passed, makes the banner itself clickable (a small "Change
 * Banner" hint fades in on hover, top-right — deliberately away from the
 * avatar's own click zone at bottom-left so the two never overlap).
 */
export function PlayerBanner({ bannerId, height = 150, children, style, onEdit, editLabel = "Change Banner" }) {
  const banner = findBanner(bannerId);
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onEdit}
      onMouseEnter={() => onEdit && setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative", height, borderRadius: T.radiusLg, overflow: "hidden",
        border: `1px solid ${T.border}`,
        background: banner ? undefined : "linear-gradient(180deg, rgba(128,74,240,0.28) 0%, rgba(128,74,240,0.06) 100%)",
        cursor: onEdit ? "pointer" : "default",
        ...style,
      }}
    >
      {banner && (
        <div
          className="rl-banner-pan"
          style={{
            position: "absolute", inset: "-4%",
            background: `url(${banner.asset}) center/cover no-repeat`,
          }}
        />
      )}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(15,13,35,0.15) 0%, rgba(15,13,35,0.65) 100%)" }} />
      {banner && <div className="rl-banner-sheen" />}
      {onEdit && (
        <div style={{
          position: "absolute", top: 12, right: 12,
          padding: "6px 12px", borderRadius: T.radiusPill, background: "rgba(15,13,35,0.65)",
          border: `1px solid ${T.borderBrand}`, color: T.text, fontSize: 12, fontWeight: 600,
          opacity: hover ? 1 : 0, transition: "opacity 0.15s ease", pointerEvents: "none",
        }}>
          {editLabel}
        </div>
      )}
      {children}
    </div>
  );
}
