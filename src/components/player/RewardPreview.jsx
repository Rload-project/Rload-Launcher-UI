// src/components/player/RewardPreview.jsx
import React from "react";
import { T } from "../../lib/theme";
import { findAvatar } from "./PlayerAvatar.jsx";
import { findBanner } from "./PlayerBanner.jsx";
import { findBadge } from "./PlayerBadge.jsx";
import { findTitle } from "./PlayerTitle.jsx";

const TYPE_LABEL_KEY = {
  avatar: "rewardTypeAvatar", banner: "rewardTypeBanner", badge: "rewardTypeBadge", title: "rewardTypeTitle",
};
const TYPE_LABEL_FALLBACK = {
  avatar: "Avatar", banner: "Banner", badge: "Profile Badge", title: "Title",
};

function resolveReward(reward) {
  const entry =
    reward.type === "avatar" ? findAvatar(reward.id) :
    reward.type === "banner" ? findBanner(reward.id) :
    reward.type === "title" ? findTitle(reward.id) :
    findBadge(reward.id);
  if (!entry) return null;
  return { entry, name: entry.name || entry.title };
}

/**
 * One reward row: "Reward — <Type>" label above the actual name, plus a
 * thumbnail for image-backed cosmetics (avatar/banner/badge) or a small text
 * chip for titles (which have no asset). Used inside AchievementCard and
 * unlock toasts — anywhere an achievement's `rewards` list needs to read as
 * "you get this specific thing", not just a flat XP number.
 * @param {{ rewards: import("../../lib/playerModels").PlayerReward[] | null | undefined, t?: Record<string,string> }} props
 */
export function RewardPreview({ rewards, t = {} }) {
  if (!rewards || !rewards.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
      {rewards.map((reward) => {
        const resolved = resolveReward(reward);
        if (!resolved) return null;
        const { entry, name } = resolved;
        const isBanner = reward.type === "banner";
        const typeLabel = t[TYPE_LABEL_KEY[reward.type]] || TYPE_LABEL_FALLBACK[reward.type];
        return (
          <div key={`${reward.type}-${reward.id}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {reward.type === "title" ? (
              <div style={{
                width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                background: "rgba(128,74,240,0.14)", border: `1px solid ${T.borderBrand}`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11,
              }}>
                🏷️
              </div>
            ) : (
              <div style={{
                width: isBanner ? 36 : 24, height: 24, borderRadius: isBanner ? 6 : "50%",
                overflow: "hidden", flexShrink: 0, border: `1px solid ${T.borderBrand}`,
                background: T.bgCard,
              }}>
                <img src={entry.asset} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 9.5, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>
                {t.rewardLabel || "Reward"} — {typeLabel}
              </div>
              <div style={{ fontSize: 11.5, color: T.brandLight, fontWeight: 600, lineHeight: 1.2 }}>{name}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
