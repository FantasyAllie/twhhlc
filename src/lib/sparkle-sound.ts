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

  const t = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.35, t);
  master.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
  master.connect(ctx.destination);

  // Main bell-like tone with a bright attack
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(1760, t);
  osc.frequency.exponentialRampToValueAtTime(880, t + 0.6);
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0, t);
  oscGain.gain.linearRampToValueAtTime(0.7, t + 0.02);
  oscGain.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
  osc.connect(oscGain);
  oscGain.connect(master);
  osc.start(t);
  osc.stop(t + 1.1);

  // High shimmer overtones
  const shimmerFreqs = [2637, 3136, 3520, 4186];
  shimmerFreqs.forEach((freq, i) => {
    const s = ctx.createOscillator();
    s.type = "triangle";
    s.frequency.setValueAtTime(freq, t);
    const g = ctx.createGain();
    const delay = i * 0.04;
    g.gain.setValueAtTime(0, t + delay);
    g.gain.linearRampToValueAtTime(0.12, t + delay + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.55);
    s.connect(g);
    g.connect(master);
    s.start(t + delay);
    s.stop(t + delay + 0.6);
  });

  // White-noise sparkle burst
  const bufferSize = ctx.sampleRate * 0.5;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "highpass";
  noiseFilter.frequency.setValueAtTime(4000, t);
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0, t);
  noiseGain.gain.linearRampToValueAtTime(0.25, t + 0.01);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(master);
  noise.start(t);
  noise.stop(t + 0.4);
}
