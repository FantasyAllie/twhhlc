import { useSyncExternalStore } from "react";

// How the Home tiles draw their little icons (TileIconStyle in AppearanceSettings.swift,
// Look.tileIcons on Android): Calm in the tile's own text colour, Colourful with each
// flag's own colour. Each person's own choice in this browser, like grid or list.

export type TileIconStyle = "calm" | "colourful";

let userId: string | null = null;
const listeners = new Set<() => void>();
const key = () => `tileIcons.${userId ?? "anyone"}`;

function read(): TileIconStyle {
  try {
    return localStorage.getItem(key()) === "calm" ? "calm" : "colourful";
  } catch {
    return "colourful";
  }
}

let current: TileIconStyle = "colourful";
const notify = () => listeners.forEach((l) => l());

/** Loads this person's choice (Colourful if they haven't picked one). */
export function loadTileIconsFor(id: string | null | undefined) {
  userId = id ?? null;
  current = read();
  notify();
}

export function setTileIconStyle(style: TileIconStyle) {
  current = style;
  try {
    localStorage.setItem(key(), style);
  } catch {
    // Private browsing can block storage; the choice just won't be remembered.
  }
  notify();
}

/** The signed-in person's tile icon style; components using it redraw when it changes. */
export function useTileIconStyle(): TileIconStyle {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => current,
    () => "colourful",
  );
}
