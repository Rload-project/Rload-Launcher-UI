// src/components/player/NotificationToastHost.jsx
import React, { useEffect, useState } from "react";
import { subscribeNotifications, dismissNotification } from "../../lib/notifications";
import { UnlockToast } from "./UnlockToast.jsx";

/**
 * Mount once near the app root. Renders the single currently-active
 * notification (top-right, entering from the top toward the left), plus a
 * small "N rewards waiting" indicator when more are queued behind it. Every
 * future toast (this feature and beyond) should go through
 * lib/notifications.js so it appears here automatically.
 */
export function NotificationToastHost({ t }) {
  const [state, setState] = useState({ active: null, queuedCount: 0 });

  useEffect(() => subscribeNotifications(setState), []);

  if (!state.active) return null;

  return (
    <div style={{
      position: "fixed", top: 16, right: 16, zIndex: 9999,
      display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, pointerEvents: "none",
    }}>
      <UnlockToast
        key={state.active.id}
        notification={state.active}
        t={t}
        onDone={() => dismissNotification(state.active.id)}
      />
      {state.queuedCount > 0 && (
        <div style={{
          fontSize: 10.5, fontWeight: 600, color: "rgba(255,255,255,0.55)",
          padding: "3px 9px", borderRadius: 999, background: "rgba(24,21,48,0.7)",
        }}>
          {(t.rewardsWaiting || "{count} rewards waiting").replace("{count}", state.queuedCount)}
        </div>
      )}
    </div>
  );
}
