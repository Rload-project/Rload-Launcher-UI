// src/components/player/ProfileHeader.jsx
import React from "react";
import { T } from "../../lib/theme";
import { PlayerBanner } from "./PlayerBanner.jsx";
import { PlayerAvatar } from "./PlayerAvatar.jsx";
import { PlayerBadge } from "./PlayerBadge.jsx";
import { PlayerTitle } from "./PlayerTitle.jsx";
import { CollectionOverview } from "./CollectionOverview.jsx";
import { PlayerLevel } from "./PlayerLevel.jsx";
import { PlayerXPBar } from "./PlayerXPBar.jsx";
import { PlayerStatsCard } from "./PlayerStatsCard.jsx";
import { PlayerIcon } from "./icons.jsx";
import { levelFromXp } from "../../lib/playerModels";
import { ACHIEVEMENTS } from "../../lib/achievements";

/**
 * Premium profile header: banner + overlapping avatar, display name, member
 * badge, level, XP bar, points, quick stats, Recent Achievements, Next
 * Reward, and a Cosmetic Collection section with explicit Change
 * Avatar/Banner/Badge entry points.
 *
 * @param {{
 *   profile: import("../../lib/playerModels").PlayerProfile,
 *   username: string,
 *   subscriptionLabel: string,
 *   memberSinceLabel: string,
 *   t: Record<string,string>,
 *   onOpenCosmetics: (tab: "avatar"|"banner"|"badge") => void,
 *   onOpenAchievements: () => void,
 * }} props
 */
export function ProfileHeader({ profile, username, subscriptionLabel, memberSinceLabel, t, onOpenCosmetics, onOpenAchievements }) {
  const { level } = levelFromXp(profile.xp);
  const stats = [
    { icon: "./images/games/icons/gamepad.png", label: t.gamesPlayedStat || "Games Played", value: profile.stats.gamesPlayed },
    { icon: "./images/games/icons/hourglass.png", label: t.hoursPlayedStat || "Hours Played", value: profile.stats.hoursPlayed },
    { icon: "🏆", label: t.achievements || "Achievements", value: `${profile.achievementIds.length} / ${ACHIEVEMENTS.length}` },
    { icon: "🏢", label: t.studiosDiscoveredStat || "Studios Discovered", value: profile.stats.studiosDiscovered },
  ];

  const recentAchievements = [...profile.achievementIds].slice(-3).reverse();
  const nextReward = ACHIEVEMENTS
    .filter((a) => !profile.achievementIds.includes(a.id) && a.rewards?.length)
    .map((a) => ({ achievement: a, progress: profile.achievementProgress?.[a.id] }))
    .filter((x) => x.progress)
    .sort((a, b) => (b.progress.current / b.progress.goal) - (a.progress.current / a.progress.goal))[0];

  return (
    <div style={{ padding: "20px 20px 0" }}>
      {/* Banner + avatar wrapper: the avatar must live OUTSIDE the banner's own
          overflow:hidden box, or its bottom half (the overlap) gets clipped. */}
      <div style={{ position: "relative" }}>
        <PlayerBanner bannerId={profile.bannerId} height={200} onEdit={() => onOpenCosmetics("banner")} editLabel={t.changeBanner || "Change Banner"} />
        <div
          onClick={() => onOpenCosmetics("avatar")}
          style={{ position: "absolute", bottom: -40, left: 24, cursor: "pointer", zIndex: 2, transition: "transform 0.18s ease-out" }}
          title={t.changeAvatar || "Change Avatar"}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.05)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
        >
          <PlayerAvatar avatarId={profile.avatarId} fallbackInitial={username[0]?.toUpperCase() || "U"} size={96} ring />
        </div>
      </div>

      <div style={{ paddingTop: 52, paddingBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: T.text, fontFamily: T.fontHead, letterSpacing: "-0.2px" }}>{username}</div>
              <PlayerLevel level={level} size="md" />
              {profile.activeBadgeId && <PlayerBadge badgeId={profile.activeBadgeId} size={26} />}
            </div>
            {profile.titleId && (
              <div style={{ marginTop: 6 }}>
                <PlayerTitle titleId={profile.titleId} />
              </div>
            )}
            <div style={{ fontSize: 13.5, color: T.textMuted, marginTop: 4 }}>
              {profile.foundingMember ? (t.foundingMemberLabel || "Founding Member") : (t.rloadMemberLabel || "Rload Member")}
              {" · "}{profile.points} {t.pointsLabel || "points"}
            </div>
          </div>
          <button
            onClick={() => onOpenCosmetics("avatar")}
            style={{
              padding: "9px 18px", borderRadius: T.radiusSm, border: `1px solid ${T.borderBrand}`,
              background: "rgba(128,74,240,0.14)", color: T.text, fontSize: 13.5, fontWeight: 600,
              fontFamily: T.fontBody, cursor: "pointer", flexShrink: 0,
            }}
          >
            {t.editProfile || "Edit Profile"}
          </button>
        </div>

        <div style={{ marginTop: 16, maxWidth: 360 }}>
          <PlayerXPBar xp={profile.xp} />
        </div>
      </div>

      {/* Quick stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 18 }}>
        {stats.map((s) => <PlayerStatsCard key={s.label} {...s} />)}
      </div>

      {/* Collection overview — compact counts only; a category click opens its picker/page */}
      <CollectionOverview
        profile={profile}
        t={t}
        onOpenCategory={(category) => (category === "achievements" ? onOpenAchievements() : onOpenCosmetics(category))}
      />

      {/* Recent Achievements + Next Reward */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
        <div onClick={onOpenAchievements} style={{ borderRadius: T.radius, border: `1px solid ${T.border}`, background: T.bgCard, padding: 16, cursor: "pointer" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
            {t.recentAchievements || "Recent Achievements"}
          </div>
          {recentAchievements.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {recentAchievements.map((id) => {
                const a = ACHIEVEMENTS.find((x) => x.id === id);
                if (!a) return null;
                return (
                  <div key={id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: T.text }}>
                    {a.icon ? (
                      <img src={a.icon} alt="" style={{ width: 22, height: 22, objectFit: "contain", flexShrink: 0 }} />
                    ) : (
                      <PlayerIcon.Trophy style={{ color: T.brandLight, flexShrink: 0 }} />
                    )}
                    <span>{t[a.titleKey] || a.id}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: T.textDim }}>{t.noAchievementsYet || "No achievements unlocked yet."}</div>
          )}
        </div>

        <div style={{ borderRadius: T.radius, border: `1px solid ${T.border}`, background: T.bgCard, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
            {t.nextReward || "Next Reward"}
          </div>
          {nextReward ? (
            <div>
              <div style={{ fontSize: 14.5, color: T.text, fontWeight: 600, marginBottom: 8 }}>{t[nextReward.achievement.titleKey] || nextReward.achievement.id}</div>
              <div style={{ height: 6, borderRadius: T.radiusPill, background: "rgba(255,255,255,0.08)", overflow: "hidden", marginBottom: 8 }}>
                <div style={{ height: "100%", width: `${Math.round((nextReward.progress.current / nextReward.progress.goal) * 100)}%`, background: T.brandGrad, borderRadius: T.radiusPill }} />
              </div>
              <div style={{ fontSize: 12.5, color: T.textDim }}>{nextReward.progress.current} / {nextReward.progress.goal}</div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: T.textDim }}>{t.allCaughtUp || "All caught up — new achievements coming soon."}</div>
          )}
        </div>
      </div>

      <div style={{ fontSize: 12, color: T.textMuted, marginTop: 14, marginBottom: 16 }}>
        {subscriptionLabel} · {t.memberSinceStat || "Member Since"} {memberSinceLabel}
      </div>
    </div>
  );
}
