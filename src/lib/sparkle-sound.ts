// Sparkling chime played when a room is marked Arrival or Clean.
// Respects the button-sound setting.
import { areButtonSoundsEnabled } from "./feedback-prefs";

let audioCtx: AudioContext | null = null;
let lastAt = 0;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
  return audioCtx;
}

/** Play a short sparkly chime sound. */
export function playSparkle() {
  if (!areButtonSoundsEnabled()) return;
  const ctx = getCtx();
  if (!ctx) return;
  const now = Date.now();
  if (now - lastAt < 250) return;
  lastAt = now;

  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  const t = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.28, t);
  master.connect(ctx.destination);

  // Twinkles: scattered tiny glockenspiel pings rising up a pentatonic scale,
  // like fairy dust being sprinkled.
  const scale = [2093, 2349, 2637, 3136, 3520, 4186, 4699, 5274, 6272];
  const count = 14;
  for (let i = 0; i < count; i++) {
    const delay = (i / count) * 0.7 + Math.random() * 0.04;
    const idx = Math.min(scale.length - 1, Math.floor((i / count) * scale.length + Math.random() * 2));
    const freq = scale[idx];
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(freq, t + delay);
    const o2 = ctx.createOscillator(); // bell partial
    o2.type = "sine";
    o2.frequency.setValueAtTime(freq * 2.76, t + delay);
    const g = ctx.createGain();
    const vol = 0.18 * (1 - (i / count) * 0.5);
    g.gain.setValueAtTime(0.0001, t + delay);
    g.gain.exponentialRampToValueAtTime(vol, t + delay + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.35);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.25, t + delay);
    o.connect(g);
    o2.connect(g2).connect(g);
    g.connect(master);
    o.start(t + delay);
    o2.start(t + delay);
    o.stop(t + delay + 0.4);
    o2.stop(t + delay + 0.4);
  }

  // Soft airy shimmer underneath.
  const len = Math.floor(ctx.sampleRate * 1.0);
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.setValueAtTime(1.5, t);
  bp.frequency.setValueAtTime(6000, t);
  bp.frequency.exponentialRampToValueAtTime(10000, t + 0.9);
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, t);
  ng.gain.exponentialRampToValueAtTime(0.04, t + 0.2);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
  noise.connect(bp).connect(ng).connect(master);
  noise.start(t);
  noise.stop(t + 1.0);
}
