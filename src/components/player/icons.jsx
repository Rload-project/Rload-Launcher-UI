// src/components/player/icons.jsx
// Small inline-SVG icon set for Player Identity components — same style
// (stroke-based, currentColor) as the Icon set in routes/launcher-games.jsx,
// kept separate to avoid refactoring that file's internals.
import React from "react";

export const PlayerIcon = {
  Lock: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  Trophy: (props) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4z"/>
      <path d="M7 5H3v2a4 4 0 0 0 4 4M17 5h4v2a4 4 0 0 1-4 4"/>
    </svg>
  ),
  Check: (props) => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  ChevronRight: (props) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
  Close: (props) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" {...props}>
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Sparkle: (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>
    </svg>
  ),
  Star: (props) => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
};
