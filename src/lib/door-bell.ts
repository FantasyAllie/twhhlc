// Shop door bell played when a guest is marked as checked out.
// Respects the button-sound setting.
import { areButtonSoundsEnabled } from "./feedback-prefs";

let ctx: AudioContext | null = null;
let lastAt = 0;

export function playDoorBell() {
  if (typeof window === "undefined" || !areButtonSoundsEnabled()) return;
  const now = Date.now();
  if (now - lastAt < 1500) return;
  lastAt = now;
  if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  const t0 = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.35, t0);
  master.connect(ctx.destination);
  // Two-bell jingle, struck a few times as the door swings.
  const strikes = [0, 0.11, 0.2, 0.34, 0.5];
  strikes.forEach((d, i) => {
    const base = i % 2 === 0 ? 1318 : 1568;
    const amp = 1 - i * 0.15;
    // Inharmonic bell partials.
    [1, 2.76, 5.4].forEach((ratio, p) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(base * ratio * (1 + (Math.random() - 0.5) * 0.004), t0 + d);
      const peak = (0.5 / (p + 1)) * amp;
      const decay = 1.2 / (p + 1);
      g.gain.setValueAtTime(0.0001, t0 + d);
      g.gain.exponentialRampToValueAtTime(peak, t0 + d + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + decay);
      o.connect(g).connect(master);
      o.start(t0 + d);
      o.stop(t0 + d + decay + 0.05);
    });
  });
  if ("vibrate" in navigator) navigator.vibrate?.([60, 40, 60]);
}
