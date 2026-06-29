// GameSinglePage.jsx — M4 enhanced game detail view
// Layout: Hero (cover + metadata) → Screenshots → Why Play → About+Sidebar → Studio → More Games

import React, { useState, useRef, useEffect } from "react";

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  bgDeep:       "#121029",
  bgMid:        "#181530",
  bgCard:       "rgba(255,255,255,0.05)",
  bgCardHover:  "rgba(255,255,255,0.09)",
  bgGlass:      "rgba(255,255,255,0.06)",
  border:       "rgba(255,255,255,0.11)",
  borderBright: "rgba(255,255,255,0.20)",
  borderBrand:  "rgba(123,66,246,0.3)",
  brand:        "#7B42F6",
  brandGrad:    "linear-gradient(135deg, #7B42F6 0%, #5B28D6 100%)",
  brandGlow:    "0 4px 24px rgba(123,66,246,0.45)",
  brandLight:   "#DAB2FF",
  brandSoft:    "rgba(123,66,246,0.15)",
  green:        "#22c55e",
  greenGrad:    "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
  greenGlow:    "0 4px 24px rgba(34,197,94,0.4)",
  orange:       "#fb923c",
  orangeGrad:   "linear-gradient(135deg, #fb923c 0%, #ea7c1a 100%)",
  orangeGlow:   "0 4px 24px rgba(251,146,60,0.4)",
  red:          "#f87171",
  redBg:        "rgba(248,113,113,0.14)",
  redBorder:    "rgba(248,113,113,0.28)",
  blue:         "#60a5fa",
  text:         "#FCFCFC",
  textSub:      "rgba(255,255,255,0.72)",
  textMuted:    "rgba(255,255,255,0.50)",
  textDim:      "rgba(255,255,255,0.30)",
  fontHead:     "'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
  fontBody:     "'Inter', ui-sans-serif, system-ui, sans-serif",
  radius:       "1rem",
  radiusSm:     "0.75rem",
  radiusLg:     "1.25rem",
  radiusPill:   "999px",
  shadowCover:  "0 24px 64px rgba(0,0,0,0.75)",
  shadowCard:   "0 4px 16px rgba(0,0,0,0.30)",
};

// ── UI state constants ────────────────────────────────────────────────────────
const UI = {
  IDLE:"idle", DOWNLOADING:"downloading", PAUSED:"paused",
  INSTALLING:"installing", INSTALLED:"installed",
  INSTALLED_NO_EXE:"installed_no_exe", UPDATE_AVAILABLE:"update_available",
  UPDATING:"updating", RUNNING:"running", ERROR:"error", CANCELED:"canceled",
};

// ── Utilities ─────────────────────────────────────────────────────────────────
function humanBytes(n) {
  if (!Number.isFinite(n) || n <= 0) return null;
  const u = ["B","KB","MB","GB","TB"]; let i = 0, v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}
function formatYear(d) {
  if (!d) return null;
  const p = new Date(d);
  return isNaN(p.getTime()) ? null : String(p.getFullYear());
}
function countryFlag(code) {
  if (!code || code.length !== 2) return "";
  const base = 0x1F1E6 - 65;
  return String.fromCodePoint(code.toUpperCase().charCodeAt(0) + base) +
         String.fromCodePoint(code.toUpperCase().charCodeAt(1) + base);
}
function countryName(code) {
  const map = { BE:"Belgium", FR:"France", DE:"Germany", NL:"Netherlands", GB:"United Kingdom",
    US:"United States", CA:"Canada", JP:"Japan", KR:"South Korea", AU:"Australia",
    SE:"Sweden", DK:"Denmark", PL:"Poland", CZ:"Czech Republic" };
  return map[(code || "").toUpperCase()] || code || null;
}
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

// ── Icons ─────────────────────────────────────────────────────────────────────
const BackIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);
const PlayIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
);
const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);
const PauseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
  </svg>
);
const UpdateIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);
const ArrowRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
);
const GlobeIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);

// ── CTA configuration ─────────────────────────────────────────────────────────
function ctaConfig(uiState, hasAccess, game, dl, busy) {
  if (game?.comingSoon) return { label: "Coming Soon on Rload", variant: "comingsoon", action: null, icon: null, disabled: true };
  if (!hasAccess) return { label: "Subscribe to Play", variant: "subscribe", action: "subscribe", icon: null, disabled: false };
  switch (uiState) {
    case UI.DOWNLOADING: {
      const pct = dl?.percent ?? 0;
      const speed = dl?.speed ? ` · ${humanBytes(dl.speed)}/s` : "";
      return { label: `Downloading ${pct}%${speed}`, variant: "progress", action: "pause", icon: <PauseIcon/>, disabled: busy };
    }
    case UI.PAUSED:      return { label: "Resume Download", variant: "paused",   action: "resume",  icon: <PlayIcon/>,     disabled: busy };
    case UI.INSTALLING:  return { label: "Installing…",      variant: "progress", action: null,      icon: null,           disabled: true };
    case UI.INSTALLED:   return { label: `Play ${game.title}`,variant: "play",    action: "play",    icon: <PlayIcon size={18}/>, disabled: busy };
    case UI.RUNNING:     return { label: "Playing…",          variant: "running",  action: null,      icon: null,           disabled: true };
    case UI.UPDATE_AVAILABLE: return { label: "Update Available", variant: "update", action: "update", icon: <UpdateIcon/>, disabled: busy };
    case UI.UPDATING: {
      const pct = dl?.percent ?? 0;
      return { label: `Updating ${pct}%`, variant: "progress", action: "pause", icon: <PauseIcon/>, disabled: busy };
    }
    case UI.ERROR: return { label: "Retry Install", variant: "install", action: "install", icon: <DownloadIcon/>, disabled: busy };
    default: {
      const sz = humanBytes(game.downloadSize);
      return { label: sz ? `Install — ${sz}` : "Install", variant: "install", action: "install", icon: <DownloadIcon/>, disabled: busy };
    }
  }
}

const CTA_STYLES = {
  subscribe:  { background: T.brandGrad,  color: "#fff", boxShadow: T.brandGlow },
  install:    { background: T.brandGrad,  color: "#fff", boxShadow: T.brandGlow },
  play:       { background: T.greenGrad,  color: "#fff", boxShadow: T.greenGlow },
  update:     { background: T.orangeGrad, color: "#fff", boxShadow: T.orangeGlow },
  progress:   { background: "rgba(255,255,255,0.07)", color: T.textSub, boxShadow: "none" },
  paused:     { background: "rgba(255,255,255,0.07)", color: T.textSub, boxShadow: "none" },
  running:    { background: "rgba(255,255,255,0.07)", color: T.textSub, boxShadow: "none" },
  comingsoon: { background: "transparent", color: T.textMuted, boxShadow: "none", border: `1px solid ${T.border}` },
};

// ── ProgressBar ───────────────────────────────────────────────────────────────
function ProgressBar({ dl, uiState }) {
  const active    = [UI.DOWNLOADING, UI.UPDATING].includes(uiState);
  const paused    = uiState === UI.PAUSED;
  const installing = uiState === UI.INSTALLING;
  if (!active && !paused && !installing) return null;
  const pct   = installing ? 100 : (dl?.percent ?? 0);
  const color = installing ? T.brand : (paused ? T.orange : T.green);
  return (
    <div style={{ marginTop: 10, width: "100%", maxWidth: 300 }}>
      <div style={{ height: 3, background: "rgba(255,255,255,0.12)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 999, transition: "width 0.4s ease" }}/>
      </div>
      {dl?.bytesDownloaded != null && dl?.totalBytes > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
          <span style={{ fontSize: 10, color: T.textDim }}>{humanBytes(dl.bytesDownloaded)} / {humanBytes(dl.totalBytes)}</span>
          <span style={{ fontSize: 10, color: T.textDim }}>{pct}%</span>
        </div>
      )}
    </div>
  );
}

// ── MetaDot — separator ───────────────────────────────────────────────────────
function MetaDot() {
  return <span style={{ color: T.textDim, fontSize: 12, userSelect: "none", flexShrink: 0 }}>·</span>;
}

// ── Section heading ───────────────────────────────────────────────────────────
function SectionHeading({ children, tight }) {
  return (
    <h2 style={{ fontFamily: T.fontHead, fontSize: 18, fontWeight: 700, color: T.text, margin: tight ? "0 0 12px" : "0 0 18px", letterSpacing: "-0.01em" }}>
      {children}
    </h2>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. GAME HERO — cover art left, banner background, all key metadata
// ═══════════════════════════════════════════════════════════════════════════════
function GameHero({ game, uiState, dl, subscriptionStatus, demoMode, busy, installedVersion,
  onInstall, onPlay, onUpdate, onPause, onResume, onCancel, onBack, onRefreshAccess, onUninstall }) {

  const hasAccess = demoMode ? true : (subscriptionStatus?.hasAccess ?? false);
  const cfg       = ctaConfig(uiState, hasAccess, game, dl, busy);
  const ctaStyle  = CTA_STYLES[cfg.variant] || CTA_STYLES.install;
  const [refreshing, setRefreshing] = useState(false);
  async function doRefresh() {
    if (refreshing || !onRefreshAccess) return;
    setRefreshing(true);
    try { await onRefreshAccess(); } finally { setRefreshing(false); }
  }

  const [uninstallArm, setUninstallArm] = useState(false);
  const uninstallTimer = useRef(null);
  function handleUninstallClick() {
    if (uninstallArm) {
      clearTimeout(uninstallTimer.current);
      setUninstallArm(false);
      onUninstall?.();
    } else {
      setUninstallArm(true);
      uninstallTimer.current = setTimeout(() => setUninstallArm(false), 3000);
    }
  }

  const bannerSrc = game.banner || game.coverImage || game.thumbnail || game.coverUrl || null;
  const coverSrc  = game.coverImage || game.thumbnail || game.coverUrl || game.banner || null;

  const releaseYear  = formatYear(game.releaseDate);
  const langCount    = game.languages?.length || 0;
  const sizeFmt      = humanBytes(game.downloadSize);
  const flag         = countryFlag(game.studioCountry);

  function handleCta() {
    if (cfg.disabled || !cfg.action) return;
    switch (cfg.action) {
      case "subscribe":
        if (!demoMode) { window.rload?.openExternal?.("https://rload.be/pricing?source=launcher"); }
        else { console.warn("[RLOAD DEMO MODE] Subscribe redirect suppressed."); }
        break;
      case "install":   onInstall?.(); break;
      case "play":      onPlay?.();    break;
      case "update":    onUpdate?.();  break;
      case "pause":     onPause?.();   break;
      case "resume":    onResume?.();  break;
      case "cancel":    onCancel?.();  break;
    }
  }

  return (
    <div style={{ position: "relative", width: "100%", minHeight: 520, flexShrink: 0, overflow: "hidden" }}>

      {/* Banner background */}
      {bannerSrc ? (
        <img src={bannerSrc} alt="" aria-hidden="true"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 20%" }}/>
      ) : (
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #1e1648 0%, #0d0b1f 100%)" }}/>
      )}

      {/* Gradient overlays */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to right, rgba(18,16,41,0.98) 0%, rgba(18,16,41,0.85) 40%, rgba(18,16,41,0.3) 65%, rgba(18,16,41,0.1) 100%)",
      }}/>
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to bottom, rgba(18,16,41,0.0) 0%, rgba(18,16,41,0.0) 50%, rgba(18,16,41,0.6) 80%, rgba(18,16,41,1) 100%)",
      }}/>

      {/* Top chrome */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", zIndex: 2 }}>
        <button onClick={onBack} style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "6px 14px 6px 10px", borderRadius: T.radiusPill,
          background: "rgba(18,16,41,0.7)", backdropFilter: "blur(16px)",
          border: `1px solid ${T.border}`, color: T.textSub,
          fontSize: 13, fontFamily: T.fontBody, cursor: "pointer",
          transition: "all 0.15s",
        }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = T.text; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(18,16,41,0.7)"; e.currentTarget.style.color = T.textSub; }}
        >
          <BackIcon/> Library
        </button>

        {game.comingSoon ? (
          <div style={{
            padding: "5px 14px", borderRadius: T.radiusPill,
            background: "rgba(251,146,60,0.15)", backdropFilter: "blur(12px)",
            border: "1px solid rgba(251,146,60,0.35)",
            fontSize: 11, fontWeight: 600, color: T.orange, letterSpacing: "0.04em",
          }}>
            Coming Soon
          </div>
        ) : (
          <div style={{
            padding: "5px 14px", borderRadius: T.radiusPill,
            background: "rgba(123,66,246,0.2)", backdropFilter: "blur(12px)",
            border: "1px solid rgba(123,66,246,0.4)",
            fontSize: 11, fontWeight: 600, color: T.brandLight, letterSpacing: "0.04em",
          }}>
            Available with Rload
          </div>
        )}
      </div>

      {/* Main content row */}
      <div style={{
        position: "relative", zIndex: 1,
        display: "flex", alignItems: "flex-end", gap: 36,
        padding: "100px 48px 40px",
      }}>

        {/* Cover art */}
        {coverSrc && (
          <div style={{
            flexShrink: 0, width: 220, height: 293,
            borderRadius: T.radius, overflow: "hidden",
            boxShadow: T.shadowCover,
            border: "1px solid rgba(255,255,255,0.12)",
          }}>
            <img src={coverSrc} alt={game.title}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}/>
          </div>
        )}

        {/* Info block */}
        <div style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>

          {/* Genre badges */}
          {game.genres?.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {game.genres.map(g => (
                <span key={g} style={{
                  padding: "3px 10px", borderRadius: T.radiusPill,
                  background: "rgba(123,66,246,0.2)", border: "1px solid rgba(123,66,246,0.35)",
                  color: T.brandLight, fontSize: 11, fontWeight: 600, letterSpacing: "0.03em",
                }}>
                  {capitalize(g)}
                </span>
              ))}
            </div>
          )}

          {/* Title */}
          <h1 style={{
            fontFamily: T.fontHead, fontSize: 48, fontWeight: 800,
            color: T.text, margin: 0, lineHeight: 1.05, letterSpacing: "-0.02em",
            textShadow: "0 2px 24px rgba(0,0,0,0.6)",
          }}>
            {game.title}
          </h1>

          {/* Studio + country */}
          {game.studio && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
              <span style={{ fontSize: 14, color: T.textMuted, fontWeight: 500 }}>by</span>
              <span style={{ fontSize: 14, color: T.brandLight, fontWeight: 600 }}>{game.studio}</span>
              {flag && <span style={{ fontSize: 16 }}>{flag}</span>}
            </div>
          )}

          {/* Short description */}
          {game.shortDescription && (
            <p style={{
              color: T.textSub, fontSize: 14, marginTop: 10, maxWidth: 520,
              lineHeight: 1.6, textShadow: "0 1px 8px rgba(0,0,0,0.4)",
            }}>
              {game.shortDescription}
            </p>
          )}

          {/* Metadata row */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            {releaseYear && <>
              <span style={{ fontSize: 12, color: T.textMuted }}>{releaseYear}</span>
              <MetaDot/>
            </>}
            {langCount > 0 && <>
              <span style={{ fontSize: 12, color: T.textMuted }}>{langCount} language{langCount !== 1 ? "s" : ""}</span>
              <MetaDot/>
            </>}
            {sizeFmt && <>
              <span style={{ fontSize: 12, color: T.textMuted }}>{sizeFmt}</span>
              <MetaDot/>
            </>}
            {game.ageRating && (
              <span style={{
                fontSize: 11, fontWeight: 600, color: T.orange,
                padding: "2px 8px", borderRadius: 4,
                background: "rgba(251,146,60,0.15)", border: "1px solid rgba(251,146,60,0.3)",
              }}>
                {game.ageRating}
              </span>
            )}
          </div>

          {/* CTA row */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
            <button onClick={handleCta} disabled={cfg.disabled} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "13px 28px", borderRadius: T.radiusSm,
              fontSize: 15, fontWeight: 700, fontFamily: T.fontBody,
              cursor: cfg.disabled ? "not-allowed" : "pointer",
              opacity: cfg.disabled ? (cfg.variant === "comingsoon" ? 1 : 0.65) : 1,
              border: "none", transition: "all 0.18s",
              ...ctaStyle,
            }}
              onMouseEnter={e => { if (!cfg.disabled && cfg.variant !== "progress") e.currentTarget.style.filter = "brightness(1.1)"; }}
              onMouseLeave={e => { e.currentTarget.style.filter = "none"; }}
            >
              {cfg.icon}
              {cfg.label}
            </button>

            {cfg.variant === "subscribe" && onRefreshAccess && (
              <button onClick={doRefresh} disabled={refreshing} style={{
                padding: "12px 20px", borderRadius: T.radiusSm,
                background: "rgba(255,255,255,0.05)", border: `1px solid ${T.border}`,
                color: T.textSub, fontSize: 14, fontWeight: 500, fontFamily: T.fontBody,
                cursor: refreshing ? "not-allowed" : "pointer", transition: "all 0.15s",
              }}
                onMouseEnter={e => { if (!refreshing) e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
              >
                {refreshing ? "Checking…" : "↻ Refresh Access"}
              </button>
            )}

            {uiState === UI.UPDATE_AVAILABLE && hasAccess && (
              <button onClick={onPlay} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "12px 20px", borderRadius: T.radiusSm,
                background: "rgba(255,255,255,0.07)", border: `1px solid ${T.border}`,
                color: T.textSub, fontSize: 14, fontWeight: 500, fontFamily: T.fontBody,
                cursor: "pointer", transition: "all 0.15s",
              }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.12)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}
              >
                <PlayIcon/> Play current
              </button>
            )}

            {[UI.DOWNLOADING, UI.UPDATING].includes(uiState) && (
              <button onClick={onCancel} style={{
                padding: "12px 16px", borderRadius: T.radiusSm,
                background: "transparent", border: `1px solid ${T.border}`,
                color: T.textMuted, fontSize: 13, cursor: "pointer",
                fontFamily: T.fontBody, transition: "border-color 0.15s",
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = T.red}
                onMouseLeave={e => e.currentTarget.style.borderColor = T.border}
              >
                Cancel
              </button>
            )}

            {[UI.INSTALLED, UI.INSTALLED_NO_EXE, UI.UPDATE_AVAILABLE, UI.ERROR].includes(uiState) && hasAccess && !game?.comingSoon && (
              <button onClick={handleUninstallClick} disabled={busy} style={{
                padding: "12px 16px", borderRadius: T.radiusSm,
                background: uninstallArm ? "rgba(248,113,113,0.10)" : "transparent",
                border: `1px solid ${uninstallArm ? "rgba(248,113,113,0.45)" : "rgba(248,113,113,0.22)"}`,
                color: uninstallArm ? T.red : "rgba(248,113,113,0.55)",
                fontSize: 13, cursor: busy ? "not-allowed" : "pointer",
                fontFamily: T.fontBody, transition: "all 0.18s", whiteSpace: "nowrap",
              }}
                onMouseEnter={e => { if (!busy) { e.currentTarget.style.borderColor = "rgba(248,113,113,0.55)"; e.currentTarget.style.color = T.red; } }}
                onMouseLeave={e => { if (!uninstallArm) { e.currentTarget.style.borderColor = "rgba(248,113,113,0.22)"; e.currentTarget.style.color = "rgba(248,113,113,0.55)"; } }}
              >
                {uninstallArm ? "Confirm uninstall?" : "Uninstall"}
              </button>
            )}
          </div>

          <ProgressBar dl={dl} uiState={uiState}/>

          {installedVersion && [UI.INSTALLED, UI.INSTALLED_NO_EXE, UI.UPDATE_AVAILABLE, UI.RUNNING].includes(uiState) && (
            <div style={{ marginTop: 8, fontSize: 11, color: uiState === UI.UPDATE_AVAILABLE ? T.orange : T.green, display: "flex", alignItems: "center", gap: 5, opacity: 0.85 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
              {uiState === UI.UPDATE_AVAILABLE
                ? `v${installedVersion} installed · v${game.version} available`
                : `v${installedVersion} installed`}
            </div>
          )}
        </div>
      </div>

      {/* Scroll indicator */}
      <style>{`@keyframes rload-scroll-hint{0%,100%{opacity:.3;transform:translateX(-50%) translateY(0)}50%{opacity:.6;transform:translateX(-50%) translateY(7px)}}`}</style>
      <div style={{ position:"absolute", bottom:18, left:"50%", zIndex:3, pointerEvents:"none", animation:"rload-scroll-hint 2.4s ease-in-out infinite" }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. SCREENSHOTS — full-width, featured + filmstrip
// ═══════════════════════════════════════════════════════════════════════════════
function GameScreenshots({ screenshots }) {
  const [active, setActive] = useState(0);
  if (!screenshots || screenshots.length === 0) return null;

  return (
    <div>
      <SectionHeading>Screenshots</SectionHeading>

      {/* Featured */}
      <div style={{
        width: "100%", borderRadius: T.radius, overflow: "hidden",
        aspectRatio: "16/9", background: "rgba(0,0,0,0.35)",
        border: `1px solid ${T.border}`,
      }}>
        <img src={screenshots[active]} alt={`Screenshot ${active + 1}`}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}/>
      </div>

      {/* Filmstrip */}
      {screenshots.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginTop: 8, overflowX: "auto", paddingBottom: 2 }}>
          {screenshots.map((src, i) => (
            <button key={i} onClick={() => setActive(i)} style={{
              flexShrink: 0, width: 112, height: 63, padding: 0, border: "none", cursor: "pointer",
              borderRadius: T.radiusSm, overflow: "hidden",
              outline: i === active ? `2px solid ${T.brand}` : "2px solid transparent",
              outlineOffset: 1, opacity: i === active ? 1 : 0.6,
              transition: "outline 0.12s, opacity 0.12s",
            }}>
              <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. WHY PLAY — editorial cards, Rload recommendation voice
// ═══════════════════════════════════════════════════════════════════════════════
const CARD_ICONS = {
  maze: "🌀", score: "🏆", haiku: "📜", explore: "🗺️", zen: "🧘",
  art: "🎨", puzzle: "🧩", story: "📖", action: "⚔️", music: "🎵",
  world: "🌍", coop: "👥", speed: "⚡", craft: "🔨", nature: "🌿",
};
function getCardIcon(key) {
  if (!key) return "✨";
  return CARD_ICONS[key.toLowerCase()] || "✨";
}

function GameWhyPlay({ featureCards }) {
  if (!featureCards || featureCards.length === 0) return null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <SectionHeading tight>Why Play?</SectionHeading>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: T.brandLight,
          padding: "3px 10px", borderRadius: T.radiusPill,
          background: T.brandSoft, border: `1px solid ${T.borderBrand}`,
          textTransform: "uppercase",
        }}>
          Rload Editorial
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(featureCards.length, 3)}, 1fr)`, gap: 12 }}>
        {featureCards.map((card, i) => (
          <div key={i} style={{
            padding: "22px 20px", borderRadius: T.radius,
            background: T.bgCard,
            border: `1px solid ${T.border}`,
            display: "flex", flexDirection: "column", gap: 10,
            transition: "border-color 0.15s, background 0.15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = T.bgCardHover; e.currentTarget.style.borderColor = T.borderBrand; }}
            onMouseLeave={e => { e.currentTarget.style.background = T.bgCard; e.currentTarget.style.borderColor = T.border; }}
          >
            <div style={{ fontSize: 32, lineHeight: 1 }}>{getCardIcon(card.icon)}</div>
            <div style={{
              fontFamily: T.fontHead, fontSize: 15, fontWeight: 700,
              color: T.text, lineHeight: 1.3,
            }}>
              {card.title}
            </div>
            <div style={{ fontSize: 13, color: T.textSub, lineHeight: 1.65 }}>
              {card.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. ABOUT
// ═══════════════════════════════════════════════════════════════════════════════
function GameAbout({ game }) {
  if (!game.description) return null;
  return (
    <div>
      <SectionHeading>About {game.title}</SectionHeading>
      <p style={{ fontSize: 14, color: T.textSub, lineHeight: 1.8, margin: 0, whiteSpace: "pre-line" }}>
        {game.description}
      </p>
    </div>
  );
}

// ── Trailer ───────────────────────────────────────────────────────────────────
function GameTrailer({ trailerUrl }) {
  if (!trailerUrl) return null;
  const yt = trailerUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  const embed = yt ? `https://www.youtube.com/embed/${yt[1]}?rel=0` : null;
  const isVideo = /\.(mp4|webm|ogg)(\?|$)/i.test(trailerUrl);
  if (!embed && !isVideo) return null;
  return (
    <div>
      <SectionHeading>Trailer</SectionHeading>
      <div style={{ width: "100%", aspectRatio: "16/9", borderRadius: T.radius, overflow: "hidden", background: "#000", border: `1px solid ${T.border}` }}>
        {embed ? (
          <iframe src={embed} title="Game trailer" style={{ width: "100%", height: "100%", border: "none" }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen/>
        ) : (
          <video src={trailerUrl} controls style={{ width: "100%", height: "100%", objectFit: "contain" }}/>
        )}
      </div>
    </div>
  );
}

// ── System Requirements ───────────────────────────────────────────────────────
function GameRequirements({ systemRequirements }) {
  if (!systemRequirements) return null;
  const { min, rec } = systemRequirements;
  if (!min && !rec) return null;

  const fields = [
    { key: "os",      label: "OS" },
    { key: "cpu",     label: "CPU" },
    { key: "ram",     label: "RAM" },
    { key: "gpu",     label: "GPU" },
    { key: "storage", label: "Storage" },
    { key: "directx", label: "DirectX" },
  ];

  function ReqCard({ title, req, accent }) {
    if (!req) return null;
    const rows = fields.filter(f => req[f.key]);
    if (rows.length === 0) return null;
    return (
      <div style={{
        flex: 1, padding: "18px 20px", borderRadius: T.radius,
        background: T.bgCard,
        border: `1px solid ${accent ? T.borderBrand : T.border}`,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: accent ? T.brand : T.textMuted, marginBottom: 14, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {title}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {rows.map(f => (
            <div key={f.key} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <span style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.06em" }}>{f.label}</span>
              <span style={{ fontSize: 13, color: T.textSub }}>{req[f.key]}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionHeading>System Requirements</SectionHeading>
      <div style={{ display: "flex", gap: 12 }}>
        <ReqCard title="Minimum" req={min} accent={false}/>
        <ReqCard title="Recommended" req={rec} accent={true}/>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. GAME INFO GRID — sidebar
// ═══════════════════════════════════════════════════════════════════════════════
function GameInfoGrid({ game }) {
  const cells = [];
  if (game.studio)           cells.push({ label: "Developer",  value: game.studio });
  if (game.version)          cells.push({ label: "Version",    value: game.version });
  if (game.releaseDate)      { const y = formatYear(game.releaseDate); if (y) cells.push({ label: "Released", value: y }); }
  if (game.genres?.length)   cells.push({ label: "Genre",      value: game.genres.map(capitalize).join(", ") });
  if (game.ageRating)        cells.push({ label: "Age Rating", value: game.ageRating });
  if (game.languages?.length) cells.push({ label: "Languages", value: `${game.languages.length} supported` });
  if (!game.comingSoon)      { const s = humanBytes(game.downloadSize); cells.push({ label: "Download", value: s || "—" }); }
  const platforms = game.platform?.length ? game.platform : ["Windows"];
  cells.push({ label: "Platform", value: platforms.join(", ") });
  if (game.tags?.length)     cells.push({ label: "Tags", value: game.tags.slice(0, 6).join(", ") });

  if (cells.length === 0) return null;

  return (
    <div>
      <SectionHeading tight>Game Info</SectionHeading>
      <div style={{ borderRadius: T.radius, overflow: "hidden", border: `1px solid ${T.border}` }}>
        {cells.map((cell, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between", alignItems: "flex-start",
            padding: "9px 14px", gap: 12,
            background: i % 2 === 0 ? "rgba(255,255,255,0.025)" : "transparent",
            borderBottom: i < cells.length - 1 ? `1px solid ${T.border}` : "none",
          }}>
            <span style={{ fontSize: 11, color: T.textDim, fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0 }}>{cell.label}</span>
            <span style={{ fontSize: 12, color: T.textSub, textAlign: "right" }}>{cell.value}</span>
          </div>
        ))}
      </div>

      {/* External links */}
      {(game.website || game.studioLinks?.website || game.studioLinks?.steam) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
          {(game.website || game.studioLinks?.website) && (
            <button onClick={() => window.rload?.openExternal?.(game.website || game.studioLinks.website)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 12px", borderRadius: T.radiusSm,
                background: T.bgCard, border: `1px solid ${T.border}`,
                color: T.textSub, fontSize: 12, cursor: "pointer", textAlign: "left",
                transition: "all 0.15s", fontFamily: T.fontBody, width: "100%",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = T.bgCardHover; e.currentTarget.style.color = T.text; }}
              onMouseLeave={e => { e.currentTarget.style.background = T.bgCard; e.currentTarget.style.color = T.textSub; }}
            >
              <GlobeIcon/> Official Website
            </button>
          )}
          {game.studioLinks?.steam && (
            <button onClick={() => window.rload?.openExternal?.(game.studioLinks.steam)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 12px", borderRadius: T.radiusSm,
                background: T.bgCard, border: `1px solid ${T.border}`,
                color: T.textSub, fontSize: 12, cursor: "pointer", textAlign: "left",
                transition: "all 0.15s", fontFamily: T.fontBody, width: "100%",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = T.bgCardHover; e.currentTarget.style.color = T.text; }}
              onMouseLeave={e => { e.currentTarget.style.background = T.bgCard; e.currentTarget.style.color = T.textSub; }}
            >
              ◈ View on Steam
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. STUDIO BLOCK — significantly improved
// ═══════════════════════════════════════════════════════════════════════════════
function GameStudioBlock({ game, allGames }) {
  if (!game.studio) return null;

  const studioGamesCount = allGames
    ? allGames.filter(g => g.studio === game.studio).length
    : null;

  const flag    = countryFlag(game.studioCountry);
  const country = countryName(game.studioCountry);
  const hasLinks = game.studioLinks && Object.values(game.studioLinks).some(Boolean);

  return (
    <div>
      <SectionHeading tight>About the Studio</SectionHeading>
      <div style={{
        padding: "20px", borderRadius: T.radius,
        background: T.bgCard,
        border: `1px solid ${T.border}`,
      }}>
        {/* Logo + name row */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div style={{
            width: 60, height: 60, borderRadius: T.radiusSm, flexShrink: 0,
            background: game.studioLogo ? "transparent" : T.brandGrad,
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden", border: `1px solid ${T.border}`,
            boxShadow: T.shadowCard,
          }}>
            {game.studioLogo ? (
              <img src={game.studioLogo} alt={game.studio} style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
            ) : (
              <span style={{ fontFamily: T.fontHead, fontSize: 24, fontWeight: 800, color: "#fff" }}>
                {game.studio.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: T.fontHead, fontSize: 16, fontWeight: 700, color: T.text, lineHeight: 1.2 }}>
              {game.studio}
            </div>
            {(country || flag) && (
              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 3 }}>
                {flag && <span style={{ marginRight: 5 }}>{flag}</span>}
                {country}
              </div>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div style={{
          display: "flex", gap: 0,
          borderRadius: T.radiusSm, overflow: "hidden",
          border: `1px solid ${T.border}`,
          marginBottom: 14,
        }}>
          {studioGamesCount !== null && (
            <div style={{ flex: 1, padding: "10px 14px", borderRight: `1px solid ${T.border}`, textAlign: "center" }}>
              <div style={{ fontFamily: T.fontHead, fontSize: 20, fontWeight: 700, color: T.text }}>
                {studioGamesCount}
              </div>
              <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 1 }}>
                {studioGamesCount === 1 ? "Game" : "Games"} on Rload
              </div>
            </div>
          )}
          <div style={{ flex: 1, padding: "10px 14px", textAlign: "center" }}>
            <div style={{ fontFamily: T.fontHead, fontSize: 20, fontWeight: 700, color: T.text }}>
              {game.studioCountry || "—"}
            </div>
            <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 1 }}>
              Country
            </div>
          </div>
        </div>

        {/* View Studio button (M5 stub) */}
        <button
          onClick={() => { /* M5: navigate to studio page */ }}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            width: "100%", padding: "10px 16px", borderRadius: T.radiusSm,
            background: T.brandSoft, border: `1px solid ${T.borderBrand}`,
            color: T.brandLight, fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: T.fontBody, transition: "all 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(123,66,246,0.25)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = T.brandSoft; }}
        >
          View Studio <ArrowRightIcon/>
        </button>

        {/* Social links */}
        {hasLinks && (
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {game.studioLinks?.website && (
              <button onClick={() => window.rload?.openExternal?.(game.studioLinks.website)}
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: T.radiusSm, background: T.bgCard, border: `1px solid ${T.border}`, color: T.textMuted, fontSize: 11, cursor: "pointer", fontFamily: T.fontBody, transition: "color 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.color = T.text}
                onMouseLeave={e => e.currentTarget.style.color = T.textMuted}
              >
                <GlobeIcon/> Website
              </button>
            )}
            {game.studioLinks?.discord && (
              <button onClick={() => window.rload?.openExternal?.(game.studioLinks.discord)}
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: T.radiusSm, background: T.bgCard, border: `1px solid ${T.border}`, color: T.textMuted, fontSize: 11, cursor: "pointer", fontFamily: T.fontBody, transition: "color 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.color = T.text}
                onMouseLeave={e => e.currentTarget.style.color = T.textMuted}
              >
                Discord
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. MORE GAMES — full width, always at bottom
// ═══════════════════════════════════════════════════════════════════════════════
function MoreGames({ currentGameId, allGames, uiByGame, onSelectGame, onViewAll }) {
  const related = (allGames || []).filter(g => g.gameId !== currentGameId).slice(0, 8);
  if (related.length === 0) return null;

  function statusChip(gameId) {
    const s = uiByGame?.[gameId];
    if (s === UI.INSTALLED || s === UI.RUNNING)  return { color: T.green,  label: "Installed" };
    if (s === UI.UPDATE_AVAILABLE)               return { color: T.orange, label: "Update" };
    if (s === UI.DOWNLOADING || s === UI.UPDATING) return { color: T.blue, label: "Installing" };
    return null;
  }

  return (
    <div style={{
      padding: "28px 48px 48px",
      borderTop: `1px solid ${T.border}`,
      marginTop: 8,
    }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <SectionHeading tight>More Games</SectionHeading>
          <span style={{ fontSize: 12, color: T.textDim }}>on Rload</span>
        </div>
        {onViewAll && (
          <button onClick={onViewAll} style={{
            display: "flex", alignItems: "center", gap: 5,
            background: "none", border: "none", cursor: "pointer",
            fontSize: 12, color: T.textMuted, fontFamily: T.fontBody, padding: 0,
            transition: "color 0.15s",
          }}
            onMouseEnter={e => e.currentTarget.style.color = T.brandLight}
            onMouseLeave={e => e.currentTarget.style.color = T.textMuted}
          >
            See all games
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 6 }}>
        {related.map(g => {
          const cover = g.thumbnail || g.coverUrl || g.coverImage || null;
          const chip  = statusChip(g.gameId);
          return (
            <button key={g.gameId} onClick={() => onSelectGame?.(g)} style={{
              flexShrink: 0, width: 148, padding: 0, background: "none", border: "none",
              cursor: "pointer", textAlign: "left",
            }}>
              <div style={{
                width: 148, height: 93, borderRadius: T.radiusSm, overflow: "hidden",
                background: cover ? "transparent" : "rgba(123,66,246,0.12)",
                border: `1px solid ${T.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                position: "relative", transition: "border-color 0.15s",
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderBrand; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; }}
              >
                {cover ? (
                  <img src={cover} alt={g.title} style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
                ) : (
                  <span style={{ fontSize: 11, color: T.textDim, fontStyle: "italic", textAlign: "center", padding: "0 8px" }}>Coming Soon</span>
                )}
                {chip && (
                  <div style={{
                    position: "absolute", bottom: 5, left: 5,
                    padding: "2px 7px", borderRadius: T.radiusPill,
                    background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
                    fontSize: 9, fontWeight: 700, color: chip.color, letterSpacing: "0.04em",
                  }}>
                    {chip.label}
                  </div>
                )}
              </div>
              <div style={{ marginTop: 7, fontSize: 12, fontWeight: 600, color: T.textSub, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {g.title}
              </div>
              {g.studio && (
                <div style={{ fontSize: 11, color: T.textDim, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {g.studio}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT — GameSinglePage
// Layout: Hero → Screenshots → WhyPlay → [About + Sidebar] → [Studio] → MoreGames
// ═══════════════════════════════════════════════════════════════════════════════
export function GameSinglePage({
  game, uiState, dl, resolvedExe, installedVersion,
  subscriptionStatus, demoMode, busy, error,
  onInstall, onPlay, onUpdate, onPause, onResume, onCancel, onUninstall,
  onBack, allGames, uiByGame, onSelectGame, onRefreshAccess, onViewAllGames,
}) {
  const effectiveUiState = uiState || UI.IDLE;

  const [uninstallToast, setUninstallToast] = useState(false);
  const prevGameIdRef  = useRef(game?.gameId);
  const prevUiStateRef = useRef(effectiveUiState);

  useEffect(() => {
    if (prevGameIdRef.current !== game?.gameId) {
      prevGameIdRef.current  = game?.gameId;
      prevUiStateRef.current = effectiveUiState;
      return;
    }
    const prev = prevUiStateRef.current;
    prevUiStateRef.current = effectiveUiState;
    const wasInstalled = [UI.INSTALLED, UI.INSTALLED_NO_EXE, UI.UPDATE_AVAILABLE, UI.ERROR, UI.RUNNING].includes(prev);
    if (wasInstalled && effectiveUiState === UI.IDLE) {
      setUninstallToast(true);
      const t = setTimeout(() => setUninstallToast(false), 3500);
      return () => clearTimeout(t);
    }
  }, [effectiveUiState, game?.gameId]);

  if (!game) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, fontFamily: T.fontBody }}>
        Game not found.
      </div>
    );
  }

  const hasContent = (game.screenshots?.length > 0) || game.featureCards?.length > 0
    || game.description || game.systemRequirements || game.trailer;

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      overflowY: "auto",
      background: `linear-gradient(160deg, ${T.bgDeep} 0%, #0d0b1f 60%, #100e24 100%)`,
      fontFamily: T.fontBody, color: T.text,
    }}>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <GameHero
        game={game}
        uiState={effectiveUiState}
        dl={dl}
        installedVersion={installedVersion}
        subscriptionStatus={subscriptionStatus}
        demoMode={demoMode}
        busy={busy}
        onInstall={onInstall}
        onPlay={onPlay}
        onUpdate={onUpdate}
        onPause={onPause}
        onResume={onResume}
        onCancel={onCancel}
        onBack={onBack}
        onRefreshAccess={onRefreshAccess}
        onUninstall={onUninstall}
      />

      {/* ── Uninstall success toast ───────────────────────────────────────── */}
      {uninstallToast && (
        <div style={{ margin: "12px 48px 0", padding: "10px 16px", borderRadius: T.radiusSm, background: "rgba(34,197,94,0.10)", border: "1px solid rgba(34,197,94,0.28)", fontSize: 13, color: T.green, display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          {game.title} has been uninstalled successfully.
        </div>
      )}

      {/* ── Error notice ──────────────────────────────────────────────────── */}
      {error && (
        <div style={{ margin: "12px 48px 0", padding: "10px 16px", borderRadius: T.radiusSm, background: T.redBg, border: `1px solid ${T.redBorder}`, fontSize: 13, color: T.red }}>
          {error}
        </div>
      )}

      {/* ── INSTALLED_NO_EXE notice ───────────────────────────────────────── */}
      {effectiveUiState === UI.INSTALLED_NO_EXE && (
        <div style={{ margin: "12px 48px 0", padding: "10px 16px", borderRadius: T.radiusSm, background: "rgba(251,146,60,0.10)", border: "1px solid rgba(251,146,60,0.28)", fontSize: 13, color: T.orange }}>
          Game is installed but the executable could not be found. Try uninstalling then reinstalling.
        </div>
      )}

      {/* ── Main content ──────────────────────────────────────────────────── */}
      {hasContent ? (
        <div style={{ padding: "32px 48px 0" }}>

          {/* Full-width: Screenshots */}
          {game.screenshots?.length > 0 && (
            <div style={{ marginBottom: 40 }}>
              <GameScreenshots screenshots={game.screenshots}/>
            </div>
          )}

          {/* Full-width: Why Play */}
          {game.featureCards?.length > 0 && (
            <div style={{ marginBottom: 40 }}>
              <GameWhyPlay featureCards={game.featureCards}/>
            </div>
          )}

          {/* Two-column: About + Sidebar */}
          <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>

            {/* Left — primary editorial content */}
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 36 }}>
              <GameAbout game={game}/>
              <GameTrailer trailerUrl={game.trailer}/>
              <GameRequirements systemRequirements={game.systemRequirements}/>
            </div>

            {/* Right — metadata sidebar */}
            <div style={{ width: 272, flexShrink: 0, display: "flex", flexDirection: "column", gap: 24 }}>
              <GameInfoGrid game={game}/>
              <GameStudioBlock game={game} allGames={allGames}/>
            </div>
          </div>

          <div style={{ paddingBottom: 8 }}/>
        </div>
      ) : (
        <div style={{ margin: "40px 48px", padding: "32px", borderRadius: T.radius, background: T.bgCard, border: `1px solid ${T.border}`, textAlign: "center" }}>
          <div style={{ fontSize: 22, marginBottom: 10 }}>🎮</div>
          <div style={{ fontSize: 14, color: T.textMuted, fontFamily: T.fontBody }}>More details coming soon.</div>
        </div>
      )}

      {/* ── More Games — always full width at bottom ──────────────────────── */}
      <MoreGames
        currentGameId={game.gameId}
        allGames={allGames}
        uiByGame={uiByGame}
        onSelectGame={onSelectGame}
        onViewAll={onViewAllGames}
      />
    </div>
  );
}
