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

/** Play a short, low, sputtering fart. Safe to call on every Dirty toggle. */
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
    const dur = 0.72;

    // A falling low tone supplies the body of the sound.
    const osc = audio.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(105, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + dur);

    // Fast pitch wobble makes the tone flap rather than sound like a buzzer.
    const wobble = audio.createOscillator();
    wobble.type = "square";
    wobble.frequency.setValueAtTime(34, t);
    wobble.frequency.exponentialRampToValueAtTime(13, t + dur);
    const wobbleGain = audio.createGain();
    wobbleGain.gain.setValueAtTime(30, t);
    wobbleGain.gain.linearRampToValueAtTime(12, t + dur);
    wobble.connect(wobbleGain).connect(osc.frequency);

    // Filtered noise adds the breathy, irregular raspberry texture.
    const noiseBuffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * dur), audio.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < noiseData.length; i += 1) {
      brown = (brown + 0.025 * (Math.random() * 2 - 1)) / 1.025;
      noiseData[i] = brown * 4.2;
    }
    const noise = audio.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = audio.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(520, t);
    filter.frequency.exponentialRampToValueAtTime(150, t + dur);
    filter.Q.value = 2.5;

    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.24, t + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.06, t + 0.16);
    gain.gain.exponentialRampToValueAtTime(0.2, t + 0.22);
    gain.gain.exponentialRampToValueAtTime(0.045, t + 0.36);
    gain.gain.exponentialRampToValueAtTime(0.14, t + 0.42);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(filter).connect(gain).connect(audio.destination);
    noise.connect(filter);
    osc.start(t);
    wobble.start(t);
    noise.start(t);
    osc.stop(t + dur + 0.02);
    wobble.stop(t + dur + 0.02);
    noise.stop(t + dur + 0.02);
  } catch {
    // Ignore — audio feedback is non-essential.
  }
}
