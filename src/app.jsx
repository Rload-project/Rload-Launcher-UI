import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import LauncherGames from "./routes/launcher-games.jsx";

// ---------------------------------------------------------------------------
// Error Boundary
// ---------------------------------------------------------------------------
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary] Uncaught render error:", error, info?.componentStack || "");
  }

  render() {
    if (this.state.error) {
      const msg = this.state.error?.message || String(this.state.error);
      return (
        <div style={errStyles.page}>
          <div style={errStyles.title}>Something went wrong</div>
          <pre style={errStyles.pre}>{msg}</pre>
          <button style={errStyles.btn} onClick={() => this.setState({ error: null })}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const errStyles = {
  page: {
    padding: 36,
    color: "#ff7b7b",
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial",
    background: "#0b0b0d",
    minHeight: "100vh",
  },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 14 },
  pre: {
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    fontSize: 13,
    opacity: 0.85,
    background: "rgba(255,255,255,0.05)",
    padding: 14,
    borderRadius: 10,
    maxWidth: 720,
  },
  btn: {
    marginTop: 20,
    padding: "8px 18px",
    cursor: "pointer",
    borderRadius: 10,
    border: "1px solid rgba(255,123,123,0.45)",
    background: "rgba(255,123,123,0.12)",
    color: "#ff7b7b",
    fontSize: 14,
  },
};

// ---------------------------------------------------------------------------
// Startup intro — plays rload_intro.mp4 once on launch
// mix-blend-mode:screen makes black transparent over the purple bg
// ---------------------------------------------------------------------------
function StartupIntro({ onDone }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      // Pure black background: mix-blend-mode:screen makes all black video
      // areas fully invisible — eliminates the visible rectangle around the logo.
      background: "#000000",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {/* Purple glow — visible through screen blend */}
      <div style={{
        position: "absolute", bottom: "-10%", left: "50%", transform: "translateX(-50%)",
        width: "60%", height: "45%", pointerEvents: "none",
        background: "radial-gradient(ellipse at center,rgba(123,66,246,0.5) 0%,rgba(91,40,214,0.2) 40%,transparent 70%)",
      }}/>
      <video
        src="./videos/rload_intro.mp4"
        autoPlay
        onEnded={onDone}
        onError={onDone}
        style={{
          width: "min(80%,900px)",
          // H.264 lossy encoding makes "black" background pixels slightly non-zero
          // (e.g. rgb(4,2,8) instead of rgb(0,0,0)).  brightness(2) doubles all
          // values so near-black → still dark; contrast(10) then clamps anything
          // below the midpoint to 0, producing true black that screen-blend hides.
          filter: "brightness(2) contrast(10)",
          mixBlendMode: "screen",
          position: "relative", zIndex: 1,
          background: "transparent",
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// UpdaterBanner — fixed overlay, visible on every screen/route
// ---------------------------------------------------------------------------
const BANNER = {
  wrap: {
    position: "fixed", bottom: 24, right: 24, zIndex: 99998,
    background: "rgba(18,14,32,0.97)",
    border: "1px solid rgba(123,66,246,0.45)",
    borderRadius: 14,
    padding: "14px 18px",
    minWidth: 280, maxWidth: 360,
    boxShadow: "0 4px 32px rgba(0,0,0,0.55)",
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial",
    color: "#e8e2ff",
    fontSize: 13,
  },
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },
  label: { fontWeight: 600, fontSize: 13 },
  sub: { opacity: 0.6, fontSize: 12, marginTop: 3 },
  bar: { height: 4, borderRadius: 4, background: "rgba(255,255,255,0.08)", marginTop: 10, overflow: "hidden" },
  fill: (pct) => ({ height: "100%", borderRadius: 4, background: "linear-gradient(90deg,#7b42f6,#a96bff)", width: `${pct}%`, transition: "width 0.3s" }),
  btn: (accent) => ({
    flexShrink: 0,
    padding: "5px 13px",
    borderRadius: 8,
    border: `1px solid ${accent}88`,
    background: `${accent}18`,
    color: accent,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  }),
  dismiss: {
    position: "absolute", top: 8, right: 10,
    background: "none", border: "none", color: "rgba(255,255,255,0.3)",
    cursor: "pointer", fontSize: 15, lineHeight: 1, padding: 0,
  },
};

function UpdaterBanner() {
  const [state, setState] = useState(null);
  // state shape:
  //   null — hidden
  //   { phase: "available",    version }
  //   { phase: "downloading",  version, percent }
  //   { phase: "downloaded",   version }
  //   { phase: "error",        message }

  useEffect(() => {
    if (!window.rload?.updater?.onEvent) return;
    const cleanup = window.rload.updater.onEvent((event) => {
      console.log("[UPDATER]", event);
      switch (event.type) {
        case "available":
          setState({ phase: "available", version: event.version });
          break;
        case "progress":
          setState((prev) => ({ phase: "downloading", version: prev?.version ?? "", percent: event.percent }));
          break;
        case "downloaded":
          setState({ phase: "downloaded", version: event.version });
          break;
        case "error":
          setState({ phase: "error", message: event.message });
          break;
        case "not-available":
        case "checking":
        default:
          break;
      }
    });
    return cleanup;
  }, []);

  if (!state) return null;

  if (state.phase === "available") {
    return (
      <div style={{ ...BANNER.wrap, position: "fixed" }}>
        <button style={BANNER.dismiss} onClick={() => setState(null)}>✕</button>
        <div style={BANNER.row}>
          <div>
            <div style={BANNER.label}>Update available — v{state.version}</div>
            <div style={BANNER.sub}>Download and install on next restart</div>
          </div>
          <button style={BANNER.btn("#a96bff")} onClick={() => {
            setState((prev) => ({ ...prev, phase: "preparing" }));
            window.rload.updater.download();
          }}>Download</button>
        </div>
      </div>
    );
  }

  if (state.phase === "preparing") {
    return (
      <div style={{ ...BANNER.wrap, position: "fixed" }}>
        <div style={BANNER.row}>
          <div style={BANNER.label}>Preparing update<span style={{ animation: "none" }}>…</span></div>
          <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid #a96bff", borderTopColor: "transparent", animation: "rload-spin 0.8s linear infinite", flexShrink: 0 }} />
        </div>
        <style>{`@keyframes rload-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (state.phase === "downloading") {
    return (
      <div style={{ ...BANNER.wrap, position: "fixed" }}>
        <div style={BANNER.row}>
          <div style={BANNER.label}>Downloading update… {state.percent ?? 0}%</div>
        </div>
        <div style={BANNER.bar}><div style={BANNER.fill(state.percent ?? 0)} /></div>
      </div>
    );
  }

  if (state.phase === "downloaded") {
    return (
      <div style={{ ...BANNER.wrap, position: "fixed" }}>
        <button style={BANNER.dismiss} onClick={() => setState(null)}>✕</button>
        <div style={BANNER.row}>
          <div>
            <div style={BANNER.label}>v{state.version} ready to install</div>
            <div style={BANNER.sub}>The launcher will restart</div>
          </div>
          <button style={BANNER.btn("#7bf0a8")} onClick={() => window.rload.updater.install()}>
            Restart &amp; Install
          </button>
        </div>
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div style={{ ...BANNER.wrap, position: "fixed", borderColor: "rgba(255,123,123,0.35)" }}>
        <button style={BANNER.dismiss} onClick={() => setState(null)}>✕</button>
        <div style={{ ...BANNER.label, color: "#ff7b7b" }}>Update error</div>
        <div style={{ ...BANNER.sub, marginTop: 4 }}>{state.message}</div>
      </div>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export default function App() {
  const [introDone, setIntroDone] = useState(false);

  return (
    <ErrorBoundary>
      {!introDone && <StartupIntro onDone={() => setIntroDone(true)} />}
      <UpdaterBanner />
      <Routes>
        <Route path="/launcher/games" element={<LauncherGames />} />
        <Route path="*" element={<Navigate to="/launcher/games" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
