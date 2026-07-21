// src/components/player/CollectionOverview.jsx
import React, { useEffect, useRef, useState } from "react";
import { T } from "../../lib/theme";
import avatars from "../../data/avatars.json";
import banners from "../../data/banners.json";
import badges from "../../data/badges.json";
import titles from "../../data/titles.json";
import { ACHIEVEMENTS } from "../../lib/achievements";

/** "have / total" count that briefly ticks green when `have` increases. */
function CountValue({ have, total }) {
  const prev = useRef(have);
  const [ticking, setTicking] = useState(false);

  useEffect(() => {
    if (prev.current !== undefined && have > prev.current) {
      setTicking(true);
      const timer = setTimeout(() => setTicking(false), 500);
      prev.current = have;
      return () => clearTimeout(timer);
    }
    prev.current = have;
  }, [have]);

  return (
    <span className={ticking ? "rl-count-tick" : undefined} style={{ color: T.text, fontWeight: 700, display: "inline-block" }}>
      {have} / {total}
    </span>
  );
}

/**
 * Compact "Collection" overview — not the full Collection page (that's a
 * future phase with its own tabs/cards per item), just a quick at-a-glance
 * count of what the player has vs. what exists across every cosmetic system.
 * Reads manifest lengths directly, so adding a 25th avatar or a 13th banner
 * never requires touching this component.
 * @param {{ profile: import("../../lib/playerModels").PlayerProfile, t: Record<string,string>, onOpenCategory?: (category: string) => void }} props
 */
export function CollectionOverview({ profile, t, onOpenCategory }) {
  const rows = [
    { key: "achievements", label: t.collectionAchievements || "Achievements", have: profile.achievementIds.length, total: ACHIEVEMENTS.length },
    { key: "badge", label: t.collectionBadges || "Profile Badges", have: profile.unlockedBadgeIds.length, total: badges.length },
    { key: "avatar", label: t.collectionAvatars || "Avatars", have: profile.unlockedAvatarIds.length, total: avatars.length },
    { key: "banner", label: t.collectionBanners || "Banners", have: profile.unlockedBannerIds.length, total: banners.length },
    { key: "title", label: t.collectionTitles || "Titles", have: profile.unlockedTitleIds.length, total: titles.length },
  ];

  return (
    <div style={{ borderRadius: T.radius, border: `1px solid ${T.border}`, background: T.bgCard, padding: 16, marginTop: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>
        {t.collectionLabel || "Collection"}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        {rows.map((r) => {
          const pct = r.total > 0 ? Math.min(100, Math.round((r.have / r.total) * 100)) : 0;
          const complete = r.total > 0 && r.have >= r.total;
          return (
            <div
              key={r.key}
              onClick={onOpenCategory ? () => onOpenCategory(r.key) : undefined}
              style={{
                cursor: onOpenCategory ? "pointer" : "default", borderRadius: T.radiusSm,
                padding: "6px 8px", margin: "-6px -8px", transition: "background 0.15s ease",
              }}
              onMouseEnter={(e) => { if (onOpenCategory) e.currentTarget.style.background = T.bgCardHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 5 }}>
                <span style={{ color: T.textMuted }}>{r.label}{complete && " ✓"}</span>
                <CountValue have={r.have} total={r.total} />
              </div>
              <div style={{ height: 5, borderRadius: T.radiusPill, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, borderRadius: T.radiusPill, background: complete ? T.green : T.brandGrad, transition: "width 0.3s ease, background 0.3s ease" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
