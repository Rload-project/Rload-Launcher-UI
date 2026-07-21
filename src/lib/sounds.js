// src/lib/sounds.js
//
// Player Identity sound architecture. Every event that should make a sound
// goes through playSound(type) — never a raw Audio()/oscillator call
// elsewhere in the codebase, so there is exactly one place that knows how
// sounds are produced.
//
// No real sound assets exist yet, so every entry below synthesizes a short
// placeholder tone via the Web Audio API (no network request, no bundled
// binary, nothing "downloaded or unlicensed" — just oscillator math). Swap a
// real sound in later by setting that entry's `url` to a bundled asset path
// (e.g. "./sounds/achievement-unlocked.mp3") — playSound() already prefers
// `url` over the synthesized tone when one is present, so every call site
// (notifications.js, PlayerLevel, etc.) never needs to change.

const SOUND_DEFS = {
  achievement_unlocked: { url: null, synth: { freq: 587.33, duration: 0.16, type: "triangle", glideTo: 880 } },
  level_up:             { url: null, synth: { freq: 440,    duration: 0.22, type: "sine",     glideTo: 1108.73 } },
  cosmetic_unlocked:    { url: null, synth: { freq: 660,    duration: 0.1,  type: "sine",     glideTo: null } },
  success:              { url: null, synth: { freq: 523.25, duration: 0.09, type: "sine",     glideTo: null } },
};

const STORAGE_KEY = "rload-sound-enabled";
let enabled = (() => {
  try { return localStorage.getItem(STORAGE_KEY) !== "0"; } catch { return true; }
})();

export function isSoundEnabled() { return enabled; }
export function setSoundEnabled(value) {
  enabled = !!value;
  try { localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0"); } catch {}
}

let audioCtx = null;
function getAudioContext() {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  return audioCtx;
}

function playSynth({ freq, duration, type, glideTo }) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, ctx.currentTime + duration);
  gain.gain.setValueAtTime(0.16, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration + 0.02);
}

/**
 * @param {"achievement_unlocked"|"level_up"|"cosmetic_unlocked"|"success"} type
 */
export function playSound(type) {
  if (!enabled) return;
  const def = SOUND_DEFS[type];
  if (!def) return;
  try {
    if (def.url) {
      const audio = new Audio(def.url);
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } else if (def.synth) {
      playSynth(def.synth);
    }
  } catch {
    // Never let a sound failure break the feature it's attached to.
  }
}
