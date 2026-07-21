// src/components/player/UnlockToast.jsx
import React, { useEffect, useState } from "react";
import { T } from "../../lib/theme";
import { NOTIFICATION_VISIBLE_MS, NOTIFICATION_EXIT_MS } from "../../lib/notifications";

/**
 * A single toast card. Slides/fades/scales in (~300ms), stays ~3.5s, fades
 * out (~350ms), then calls onDone so the host can advance the queue.
 * @param {{ notification: import("../../lib/notifications").ToastNotification, t: Record<string,string>, onDone: () => void }} props
 */
export function UnlockToast({ notification, t, onDone }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    setExiting(false);
    const exitTimer = setTimeout(() => setExiting(true), NOTIFICATION_VISIBLE_MS);
    return () => clearTimeout(exitTimer);
  }, [notification.id]);

  useEffect(() => {
    if (!exiting) return;
    const doneTimer = setTimeout(onDone, NOTIFICATION_EXIT_MS);
    return () => clearTimeout(doneTimer);
  }, [exiting, onDone]);

  const title = t[notification.titleKey] || notification.titleKey;
  const body = notification.bodyKey ? (t[notification.bodyKey] || notification.bodyKey) : null;
  const vars = notification.vars;
  const interpolated = (s) => (vars ? Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, v), s) : s);
  const iconIsImage = typeof notification.icon === "string" && notification.icon.startsWith(".");

  return (
    <div className={exiting ? "rl-toast-exit" : "rl-toast-enter"} style={{
      width: 300, borderRadius: T.radiusSm, background: "rgba(24,21,48,0.96)",
      border: `1px solid ${T.borderBrand}`, boxShadow: T.shadowModal,
      padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: 10,
      backdropFilter: "blur(6px)", pointerEvents: "auto",
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: "0.6rem", flexShrink: 0,
        background: iconIsImage ? "transparent" : T.brandGrad,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, overflow: "hidden",
      }}>
        {iconIsImage ? (
          <img src={notification.icon} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        ) : (
          notification.icon || "🔔"
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text, fontFamily: T.fontHead }}>{interpolated(title)}</div>
        {body && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2, lineHeight: 1.4 }}>{interpolated(body)}</div>}
      </div>
    </div>
  );
}
