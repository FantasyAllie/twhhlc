// Uploaded fart sound played when a room is marked Dirty.
// Respects the button-sound setting.
import { areButtonSoundsEnabled } from "./feedback-prefs";
import fartAsset from "@/assets/fart.m4a.asset.json";

let audio: HTMLAudioElement | null = null;
let lastAt = 0;

function getAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!audio) {
    audio = new Audio(fartAsset.url);
    audio.preload = "auto";
    audio.volume = 0.8;
  }
  return audio;
}

/** Play the uploaded fart sound. Safe to call on every Dirty toggle. */
export function playFart() {
  if (!areButtonSoundsEnabled()) return;
  const now = Date.now();
  if (now - lastAt < 400) return;
  lastAt = now;

  const player = getAudio();
  if (!player) return;
  player.currentTime = 0;
  void player.play().catch(() => {});
}
