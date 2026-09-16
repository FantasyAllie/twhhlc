// Per-device feedback preferences: tap sounds and the end-of-shift outcome
// animations. Stored locally so each phone/computer can be set independently.
const SOUND_KEY = "feedback.buttonSounds";
const OUTCOME_KEY = "feedback.outcomeAnimations";

function read(key: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(key) !== "off";
  } catch {
    return true;
  }
}

function write(key: string, on: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, on ? "on" : "off");
  } catch {
    /* ignore */
  }
}

export function areButtonSoundsEnabled(): boolean {
  return read(SOUND_KEY);
}

export function setButtonSoundsEnabled(on: boolean) {
  write(SOUND_KEY, on);
}

export function areOutcomeAnimationsEnabled(): boolean {
  return read(OUTCOME_KEY);
}

export function setOutcomeAnimationsEnabled(on: boolean) {
  write(OUTCOME_KEY, on);
}
