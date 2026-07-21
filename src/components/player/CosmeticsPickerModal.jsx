// src/components/player/CosmeticsPickerModal.jsx
import React, { useState } from "react";
import { T } from "../../lib/theme";
import { PlayerIcon } from "./icons.jsx";
import avatars from "../../data/avatars.json";
import banners from "../../data/banners.json";
import badges from "../../data/badges.json";
import titles from "../../data/titles.json";
import { setActiveAvatar, setActiveBanner, setActiveBadge, setActiveTitle } from "../../lib/playerStore";
import { ACHIEVEMENTS } from "../../lib/achievements";

const TABS = [
  { id: "avatar", items: avatars, unlockedKey: "unlockedAvatarIds", activeKey: "avatarId" },
  { id: "banner", items: banners, unlockedKey: "unlockedBannerIds", activeKey: "bannerId" },
  { id: "badge",  items: badges,  unlockedKey: "unlockedBadgeIds",  activeKey: "activeBadgeId" },
  { id: "title",  items: titles,  unlockedKey: "unlockedTitleIds",  activeKey: "titleId" },
];

/** Turns a manifest's raw unlockType/unlockRequirement into a human, translated label. */
function unlockLabel(entry, t) {
  if (entry.unlockType === "achievement") {
    const achievement = ACHIEVEMENTS.find((a) => a.id === entry.unlockRequirement);
    return achievement ? (t[achievement.titleKey] || achievement.id) : entry.unlockRequirement;
  }
  if (entry.unlockType === "points") {
    const n = (entry.unlockRequirement || "").match(/\d+/)?.[0] || "?";
    return `${n} ${t.pointsLabel || "points"}`;
  }
  if (entry.unlockType === "founder") {
    return t.foundingMemberLabel || "Founding Member";
  }
  return entry.unlockRequirement;
}

function TitleGridItem({ entry, unlocked, selected, onClick, t }) {
  const label = unlockLabel(entry, t);
  return (
    <div
      onClick={unlocked ? onClick : undefined}
      title={unlocked ? entry.description : `${entry.name} — ${label || t.locked || "Locked"}`}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        cursor: unlocked ? "pointer" : "not-allowed", borderRadius: T.radiusSm,
        border: `2px solid ${selected ? T.brand : T.border}`,
        boxShadow: selected ? T.brandGlow : "none",
        background: T.bgCard, padding: "10px 12px", opacity: unlocked ? 1 : 0.6,
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: unlocked ? T.text : T.textMuted }}>{entry.name}</div>
        {!unlocked && <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>{label}</div>}
      </div>
      {!unlocked ? (
        <PlayerIcon.Lock style={{ color: T.textDim, flexShrink: 0 }} />
      ) : selected ? (
        <div style={{ width: 18, height: 18, borderRadius: "50%", background: T.brand, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0 }}>
          <PlayerIcon.Check />
        </div>
      ) : null}
    </div>
  );
}

const RARITY_COLOR = { common: T.textMuted, rare: T.blue, epic: T.purple, founder: T.gold };

/**
 * Wide-format card for the banner tab — a square avatar-style tile would
 * either crop a 3.2:1 banner badly or shrink it illegibly, so banners get
 * their own layout: full-width 3:1 preview on top, name/rarity/description
 * as real visible text below (not just a hover tooltip like the other tabs).
 */
function BannerGridItem({ entry, unlocked, selected, onClick, t }) {
  const label = unlockLabel(entry, t);
  const rarityColor = RARITY_COLOR[entry.rarity] || T.textMuted;
  return (
    <div
      onClick={unlocked ? onClick : undefined}
      style={{
        cursor: unlocked ? "pointer" : "not-allowed", borderRadius: T.radiusSm, overflow: "hidden",
        border: `2px solid ${selected ? T.brand : T.border}`, boxShadow: selected ? T.brandGlow : "none",
        background: T.bgCard,
      }}
    >
      <div style={{ position: "relative", aspectRatio: "3/1" }}>
        <img src={entry.asset} alt={entry.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: unlocked ? "none" : "grayscale(0.6) brightness(0.5)" }} />
        {!unlocked && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(10,9,25,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <PlayerIcon.Lock style={{ color: T.textMuted }} />
          </div>
        )}
        {selected && unlocked && (
          <div style={{ position: "absolute", top: 6, right: 6, width: 20, height: 20, borderRadius: "50%", background: T.brand, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
            <PlayerIcon.Check />
          </div>
        )}
      </div>
      <div style={{ padding: "8px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: unlocked ? T.text : T.textMuted }}>{entry.name}</span>
          {entry.rarity && (
            <span style={{ fontSize: 9, fontWeight: 700, color: rarityColor, textTransform: "uppercase", letterSpacing: "0.05em" }}>{entry.rarity}</span>
          )}
        </div>
        <div style={{ fontSize: 10.5, color: T.textDim, marginTop: 2, lineHeight: 1.35 }}>
          {unlocked ? entry.description : label}
        </div>
      </div>
    </div>
  );
}

function GridItem({ entry, unlocked, selected, onClick, t }) {
  const name = entry.name || entry.title;
  const label = unlockLabel(entry, t);
  return (
    <div
      onClick={unlocked ? onClick : undefined}
      style={{
        position: "relative", cursor: unlocked ? "pointer" : "not-allowed",
        borderRadius: T.radiusSm, overflow: "hidden",
        border: `2px solid ${selected ? T.brand : T.border}`,
        boxShadow: selected ? T.brandGlow : "none",
        aspectRatio: "1/1",
        background: T.bgCard,
      }}
      title={unlocked ? name : `${name} — ${label || t.locked || "Locked"}`}
    >
      <img src={entry.asset} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: unlocked ? "none" : "grayscale(0.6) brightness(0.5)" }} />
      {!unlocked && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(10,9,25,0.55)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, color: T.textMuted, padding: 6, textAlign: "center" }}>
          <PlayerIcon.Lock />
          <span style={{ fontSize: 9, lineHeight: 1.3 }}>{label}</span>
        </div>
      )}
      {selected && unlocked && (
        <div style={{ position: "absolute", top: 4, right: 4, width: 18, height: 18, borderRadius: "50%", background: T.brand, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
          <PlayerIcon.Check />
        </div>
      )}
    </div>
  );
}

/**
 * Full cosmetics customization modal — choose avatar, banner, badge, Save/Cancel.
 * Persists through playerStore on Save; Cancel discards local selection.
 */
export function CosmeticsPickerModal({ profile, t, onClose, initialTab = "avatar" }) {
  const [tab, setTab] = useState(initialTab);
  const [pending, setPending] = useState({
    avatarId: profile.avatarId, bannerId: profile.bannerId, activeBadgeId: profile.activeBadgeId, titleId: profile.titleId,
  });

  const activeTab = TABS.find((tb) => tb.id === tab);

  const handleSave = async () => {
    if (pending.avatarId !== profile.avatarId) await setActiveAvatar(pending.avatarId);
    if (pending.bannerId !== profile.bannerId) await setActiveBanner(pending.bannerId);
    if (pending.activeBadgeId !== profile.activeBadgeId) await setActiveBadge(pending.activeBadgeId);
    if (pending.titleId !== profile.titleId) await setActiveTitle(pending.titleId);
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(8,7,20,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div
        style={{ width: "100%", maxWidth: 560, maxHeight: "82vh", display: "flex", flexDirection: "column", background: T.bgMid, border: `1px solid ${T.border}`, borderRadius: T.radiusLg, boxShadow: T.shadowModal, overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text, fontFamily: T.fontHead }}>{t.editProfile || "Edit Profile"}</div>
          <div onClick={onClose} style={{ cursor: "pointer", color: T.textMuted, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: T.radiusSm }}>
            <PlayerIcon.Close />
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, padding: "12px 20px 0" }}>
          {TABS.map((tb) => (
            <div
              key={tb.id}
              onClick={() => setTab(tb.id)}
              style={{
                padding: "7px 14px", borderRadius: T.radiusSm, cursor: "pointer", fontSize: 12.5, fontWeight: 600,
                background: tab === tb.id ? "rgba(128,74,240,0.16)" : "transparent",
                color: tab === tb.id ? T.brandLight : T.textMuted,
                border: `1px solid ${tab === tb.id ? T.borderBrand : "transparent"}`,
              }}
            >
              {t[`cosmeticTab_${tb.id}`] || tb.id}
            </div>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: activeTab.id === "banner" ? "repeat(auto-fill, minmax(240px, 1fr))"
              : activeTab.id === "title" ? "repeat(auto-fill, minmax(180px, 1fr))"
              : "repeat(auto-fill, minmax(76px, 1fr))",
            gap: 12,
          }}>
            {activeTab.items.map((entry) => {
              const unlocked = profile[activeTab.unlockedKey]?.includes(entry.id) ?? false;
              const selected = pending[activeTab.activeKey] === entry.id;
              if (activeTab.id === "title") {
                return (
                  <TitleGridItem
                    key={entry.id}
                    entry={entry}
                    unlocked={unlocked}
                    selected={selected}
                    t={t}
                    onClick={() => setPending((p) => ({ ...p, titleId: entry.id }))}
                  />
                );
              }
              if (activeTab.id === "banner") {
                return (
                  <BannerGridItem
                    key={entry.id}
                    entry={entry}
                    unlocked={unlocked}
                    selected={selected}
                    t={t}
                    onClick={() => setPending((p) => ({ ...p, bannerId: entry.id }))}
                  />
                );
              }
              return (
                <GridItem
                  key={entry.id}
                  entry={entry}
                  unlocked={unlocked}
                  selected={selected}
                  t={t}
                  onClick={() => setPending((p) => ({ ...p, [activeTab.activeKey]: entry.id }))}
                />
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 20px", borderTop: `1px solid ${T.border}` }}>
          <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: "transparent", color: T.textMuted, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
            {t.cancelChanges || "Cancel"}
          </button>
          <button onClick={handleSave} style={{ padding: "9px 18px", borderRadius: T.radiusSm, border: "none", background: T.brandGrad, boxShadow: T.brandGlow, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
            {t.saveChanges || "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
