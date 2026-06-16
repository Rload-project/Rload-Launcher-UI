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
// UpdateModal — mandatory blocking update flow (v1.2.1+)
//
// Phases:
//   "available"  — full-screen block; user must click Download Update
//   "downloading"
//     background=false — blocking progress screen
//     background=true  — collapsed corner indicator, launcher is usable
//   "downloaded" — full-screen block; user must click Restart and Install
//   null         — no update found, nothing rendered
// ---------------------------------------------------------------------------
function humanBytes(n) {
  if (!Number.isFinite(n) || n < 0) return "0 B";
  const u = ["B","KB","MB","GB","TB"]; let i = 0, v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}

function InfoRow({ label, value, accent }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.55)" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: accent ? "#a96bff" : "rgba(255,255,255,0.85)" }}>{value}</span>
    </div>
  );
}

const OVERLAY = {
  position: "fixed", inset: 0, zIndex: 99997,
  background: "rgba(0,0,0,0.8)",
  display: "flex", alignItems: "center", justifyContent: "center",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
};
const MODAL_BASE = {
  background: "linear-gradient(145deg,#181530 0%,#120f2a 100%)",
  border: "1px solid rgba(123,66,246,0.4)",
  borderRadius: 20,
  padding: "36px 32px",
  width: 420,
  maxWidth: "90vw",
  boxShadow: "0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(123,66,246,0.12)",
  fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial",
  color: "#FCFCFC",
};

function UpdateModal() {
  const [state, setState] = useState(null);
  const [currentVersion, setCurrentVersion] = useState("—");

  useEffect(() => {
    window.rload?.getAppInfo?.()
      .then((info) => { if (info?.version) setCurrentVersion(info.version); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!window.rload?.updater?.onEvent) return;
    return window.rload.updater.onEvent((event) => {
      console.log("[UPDATER]", event);
      switch (event.type) {
        case "available":
          setState({ phase: "available", version: event.version, size: event.size ?? null });
          break;
        case "progress":
          setState((prev) => ({
            phase:       "downloading",
            version:     prev?.version ?? "",
            size:        prev?.size ?? null,
            percent:     event.percent ?? 0,
            speed:       event.bytesPerSecond ?? 0,
            transferred: event.transferred ?? 0,
            total:       event.total ?? 0,
            background:  prev?.background ?? false,
          }));
          break;
        case "downloaded":
          setState({ phase: "downloaded", version: event.version });
          break;
        case "canceled":
          setState((prev) => ({ phase: "available", version: prev?.version ?? "", size: prev?.size ?? null }));
          break;
        case "error":
          setState((prev) =>
            prev?.phase === "available" || prev?.phase === "downloading"
              ? { phase: "error", message: event.message }
              : null
          );
          break;
        default:
          break;
      }
    });
  }, []);

  if (!state) return null;

  const { phase, version, size, percent, speed, transferred, total, background } = state;

  // ── Background corner indicator (non-blocking) ─────────────────────────
  if (phase === "downloading" && background) {
    return (
      <div style={{
        position: "fixed", bottom: 20, right: 20, zIndex: 99998,
        background: "rgba(18,14,32,0.97)", border: "1px solid rgba(123,66,246,0.45)",
        borderRadius: 14, padding: "12px 16px", minWidth: 240,
        boxShadow: "0 4px 32px rgba(0,0,0,0.55)",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial",
        color: "#e8e2ff",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>Downloading update… {percent ?? 0}%</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{humanBytes(speed)}/s</div>
        </div>
        <div style={{ height: 3, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 3, background: "linear-gradient(90deg,#7b42f6,#a96bff)", width: `${percent ?? 0}%`, transition: "width 0.3s" }} />
        </div>
      </div>
    );
  }

  // ── Available — blocking modal ──────────────────────────────────────────
  if (phase === "available") {
    return (
      <div style={OVERLAY}>
        <div style={MODAL_BASE}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg,#7b42f6,#5b28d6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 24px rgba(123,66,246,0.5)" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
              </svg>
            </div>
          </div>

          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.3px", marginBottom: 8 }}>Update Available</div>
            <div style={{ fontSize: 13.5, color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>
              A new version of Rload is available.
            </div>
          </div>

          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 12, padding: "14px 16px", marginBottom: 24, display: "flex", flexDirection: "column", gap: 10 }}>
            <InfoRow label="Current version"   value={`v${currentVersion}`} />
            <InfoRow label="Available version" value={`v${version}`} accent />
            {size && <InfoRow label="Download size" value={humanBytes(size)} />}
          </div>

          <button
            onClick={() => {
              setState((prev) => ({ ...prev, phase: "downloading", percent: 0, speed: 0, transferred: 0, total: 0, background: false }));
              window.rload?.updater?.download?.();
            }}
            style={{ width: "100%", padding: "13px 0", borderRadius: 12, background: "linear-gradient(135deg,#7b42f6,#5b28d6)", border: "none", color: "#fff", fontSize: 14.5, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px rgba(123,66,246,0.45)", letterSpacing: "-0.1px" }}>
            Download Update
          </button>
        </div>
      </div>
    );
  }

  // ── Downloading — blocking progress screen ─────────────────────────────
  if (phase === "downloading") {
    const remaining = total && transferred ? total - transferred : 0;
    return (
      <div style={OVERLAY}>
        <div style={MODAL_BASE}>
          <div style={{ textAlign: "center", marginBottom: 6 }}>
            <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.3px" }}>
              {(percent ?? 0) === 0 ? "Preparing update…" : `Downloading update… ${percent}%`}
            </div>
          </div>
          <div style={{ textAlign: "center", fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 22, minHeight: 20 }}>
            {(percent ?? 0) === 0
              ? "Connecting to update server…"
              : `${humanBytes(speed)}/s${remaining > 0 ? ` · ${humanBytes(remaining)} remaining` : ""}`}
          </div>

          <div style={{ height: 6, borderRadius: 6, background: "rgba(255,255,255,0.08)", marginBottom: 28, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 6, background: "linear-gradient(90deg,#7b42f6,#a96bff)", width: `${percent ?? 0}%`, transition: "width 0.35s" }} />
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => setState((prev) => ({ ...prev, background: true }))}
              style={{ flex: 1, padding: "11px 0", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Continue in Background
            </button>
            <button
              onClick={async () => {
                await window.rload?.updater?.cancel?.();
                setState((prev) => ({ phase: "available", version: prev?.version, size: prev?.size }));
              }}
              style={{ flex: 1, padding: "11px 0", borderRadius: 12, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Cancel Download
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Downloaded — blocking install modal ───────────────────────────────
  if (phase === "downloaded") {
    return (
      <div style={OVERLAY}>
        <div style={MODAL_BASE}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(34,197,94,0.14)", border: "1px solid rgba(34,197,94,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
          </div>

          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.3px", marginBottom: 8 }}>Update Ready</div>
            <div style={{ fontSize: 13.5, color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>
              The update has been downloaded and is ready to install.
            </div>
          </div>

          <div style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 12, padding: "14px 16px", marginBottom: 24, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>Version</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#22c55e" }}>v{version}</div>
          </div>

          <button
            onClick={() => window.rload?.updater?.install?.()}
            style={{ width: "100%", padding: "13px 0", borderRadius: 12, background: "linear-gradient(135deg,#22c55e,#16a34a)", border: "none", color: "#fff", fontSize: 14.5, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px rgba(34,197,94,0.35)", letterSpacing: "-0.1px" }}>
            Restart and Install
          </button>
        </div>
      </div>
    );
  }

  // ── Error — dismissible corner banner ─────────────────────────────────
  if (phase === "error") {
    return (
      <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 99998, background: "rgba(18,14,32,0.97)", border: "1px solid rgba(248,113,113,0.35)", borderRadius: 14, padding: "14px 18px", maxWidth: 360, boxShadow: "0 4px 32px rgba(0,0,0,0.55)", fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial", color: "#f87171", fontSize: 13 }}>
        <button onClick={() => setState(null)} style={{ position: "absolute", top: 8, right: 10, background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 15, lineHeight: 1, padding: 0 }}>✕</button>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Update error</div>
        <div style={{ opacity: 0.7, fontSize: 11.5 }}>{state.message}</div>
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
      <UpdateModal />
      <Routes>
        <Route path="/launcher/games" element={<LauncherGames />} />
        <Route path="*" element={<Navigate to="/launcher/games" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
