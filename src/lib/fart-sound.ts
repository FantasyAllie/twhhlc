// Short, silly "fart" noise (Web Audio) played when a room is marked Dirty.
// Synthesised so no audio asset is needed; respects the button-sound setting.
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

/** Play a short comedic raspberry. Safe to call on every Dirty toggle. */
export function playFart() {
  if (!areButtonSoundsEnabled()) return;
  const now = Date.now();
  if (now - lastAt < 400) return;
  lastAt = now;

  const audio = getCtx();
  if (!audio) return;
  if (audio.state === "suspended") void audio.resume().catch(() => {});

  try {
    const t = audio.currentTime;
    const dur = 0.5;

    // Wobbling low buzz gives the classic raspberry character.
    const osc = audio.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.linearRampToValueAtTime(75, t + dur * 0.55);
    osc.frequency.linearRampToValueAtTime(55, t + dur);

    const wobble = audio.createOscillator();
    wobble.type = "sine";
    wobble.frequency.setValueAtTime(28, t);
    wobble.frequency.linearRampToValueAtTime(14, t + dur);
    const wobbleGain = audio.createGain();
    wobbleGain.gain.setValueAtTime(42, t);
    wobble.connect(wobbleGain).connect(osc.frequency);

    const filter = audio.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(900, t);
    filter.frequency.exponentialRampToValueAtTime(320, t + dur);
    filter.Q.value = 6;

    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.22, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.12, t + dur * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(filter).connect(gain).connect(audio.destination);
    osc.start(t);
    wobble.start(t);
    osc.stop(t + dur + 0.02);
    wobble.stop(t + dur + 0.02);
  } catch {
    // Ignore — audio feedback is non-essential.
  }
}
