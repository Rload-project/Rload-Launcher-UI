import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./app.jsx";
import "./styles.css";

// Global error handlers — log uncaught renderer errors to DevTools console
// so they are visible even if the Error Boundary doesn't catch them
// (e.g. errors in event handlers, async code outside render).
window.onerror = (msg, src, line, col, err) => {
  console.error("[window.onerror]", { msg, src, line, col, err });
};

window.onunhandledrejection = (ev) => {
  console.error("[unhandledrejection]", ev.reason);
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
