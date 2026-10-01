// Short synthesised tap sound (Web Audio) used as press feedback, similar to
// the keypress click on mobile operating systems. No audio asset needed.
import { areButtonSoundsEnabled } from "./feedback-prefs";

let ctx: AudioContext | null = null;
let lastAt = 0;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  return ctx;
}

/** Play a very short, quiet click. Safe to call on every press. */
export function playClick() {
  if (!areButtonSoundsEnabled()) return;
  // Throttle so rapid taps don't stack into a buzz.
  const now = Date.now();
  if (now - lastAt < 40) return;
  lastAt = now;

  const audio = getCtx();
  if (!audio) return;
  if (audio.state === "suspended") void audio.resume().catch(() => {});

  // Light haptic pulse where supported (Android; iOS Safari ignores it).
  try {
    navigator.vibrate?.(8);
  } catch {
    /* ignore */
  }

  try {
    // Keyboard-style click: a very short burst of filtered noise.
    const t = audio.currentTime;
    const len = Math.floor(audio.sampleRate * 0.012);
    const buf = audio.createBuffer(1, len, audio.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    const src = audio.createBufferSource();
    src.buffer = buf;
    const bp = audio.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(3200, t);
    bp.Q.setValueAtTime(1.2, t);
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.18, t);
    src.connect(bp).connect(gain).connect(audio.destination);
    src.start(t);
    src.stop(t + 0.015);
  } catch {
    // Ignore — audio feedback is non-essential.
  }
}
