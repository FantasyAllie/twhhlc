// Short synthesised tap sound (Web Audio) used as press feedback, similar to
// the keypress click on mobile operating systems. No audio asset needed.
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
  // Throttle so rapid taps don't stack into a buzz.
  const now = Date.now();
  if (now - lastAt < 40) return;
  lastAt = now;

  const audio = getCtx();
  if (!audio) return;
  if (audio.state === "suspended") void audio.resume().catch(() => {});

  try {
    const t = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(1500, t);
    osc.frequency.exponentialRampToValueAtTime(700, t + 0.03);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.06, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + 0.06);
  } catch {
    // Ignore — audio feedback is non-essential.
  }
}
