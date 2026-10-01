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
    // Taptic-style tap: a tiny, soft low "tock" rather than a bright click.
    const t = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    const lp = audio.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(900, t);
    osc.type = "sine";
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.018);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
    osc.connect(lp).connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + 0.035);
  } catch {
    // Ignore — audio feedback is non-essential.
  }
}
