// Polish preview (Plans/WEBSITE-polish-research.md): Tsuyu's own confirm dialogs,
// "Done · Undo" notes, a command menu and hover hints. Opt-in per browser, off by
// default; with it off the website is exactly as it was (browser confirm boxes).
import { useSyncExternalStore } from "react";

export const POLISH_KEY = "tw_polish";

const listeners = new Set<() => void>();

export function readPolish(): boolean {
  try {
    return localStorage.getItem(POLISH_KEY) === "on";
  } catch {
    return false;
  }
}

export function writePolish(on: boolean) {
  try {
    localStorage.setItem(POLISH_KEY, on ? "on" : "off");
  } catch {
    // Storage blocked: the switch stays off.
  }
  listeners.forEach((l) => l());
}

export function usePolishPref(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      const onStorage = (e: StorageEvent) => { if (e.key === POLISH_KEY) l(); };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(l);
        window.removeEventListener("storage", onStorage);
      };
    },
    readPolish,
    () => false,
  );
  return [on, writePolish];
}

// ---- Confirm dialogs ----------------------------------------------------

export type AskRequest = {
  title: string;
  detail: string;
  action: string;
  destructive: boolean;
  resolve: (ok: boolean) => void;
};

const DESTRUCTIVE = new Set(["Delete", "Remove", "Reset", "Disable", "Undo", "Leave"]);

/**
 * Splits today's confirm text into a title (the question) and the detail after
 * it, and takes the button label from its first word ("Delete", "Reset"…), so
 * the wording stays exactly as it is.
 */
export function splitQuestion(message: string): Omit<AskRequest, "resolve"> {
  const text = message.trim();
  const q = text.indexOf("?");
  const title = q >= 0 ? text.slice(0, q + 1) : text;
  const detail = q >= 0 ? text.slice(q + 1).trim() : "";
  const first = title.split(/\s+/)[0] ?? "";
  const action = /^[A-Z][a-z]+$/.test(first) ? first : "OK";
  return { title, detail, action, destructive: DESTRUCTIVE.has(action) };
}

let host: ((req: AskRequest) => void) | null = null;

export function registerAskHost(fn: ((req: AskRequest) => void) | null) {
  host = fn;
}

/**
 * Same question, same answer as `confirm()`. With the preview on (and the dialog
 * host mounted) it's Tsuyu's own dialog; otherwise the browser's box as today.
 */
export function ask(message: string): Promise<boolean> {
  const wide = typeof window !== "undefined" && window.innerWidth >= 1024;
  if (!readPolish() || !wide || !host) return Promise.resolve(window.confirm(message));
  const show = host;
  return new Promise((resolve) => show({ ...splitQuestion(message), resolve }));
}

/** The command menu's shortcut: ⌘K on Macs, Ctrl K elsewhere. */
export function commandShortcut(): string {
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  return mac ? "⌘K" : "Ctrl K";
}

// ---- Room tile detail (mouse and keyboard layout) -------------------------

export const TILE_DETAIL_KEY = "tw_tile_detail";
const detailListeners = new Set<() => void>();

const readTileDetail = (): boolean => {
  try {
    return localStorage.getItem(TILE_DETAIL_KEY) === "on";
  } catch {
    return false;
  }
};

/** Simple tiles (number, bed, status, maintenance) unless "Detailed" is on. */
export function useTileDetailPref(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(
    (l) => { detailListeners.add(l); return () => { detailListeners.delete(l); }; },
    readTileDetail,
    () => false,
  );
  const set = (next: boolean) => {
    try { localStorage.setItem(TILE_DETAIL_KEY, next ? "on" : "off"); } catch { /* stays as it was */ }
    detailListeners.forEach((l) => l());
  };
  return [on, set];
}

// ---- Tile colours ----------------------------------------------------------

const wideQuery = "(min-width: 1024px)";

/** The polish preview's tile colours: on when the switch is on, on a computer. */
export function usePolishTiles(): boolean {
  const [on] = usePolishPref();
  const wide = useSyncExternalStore(
    (l) => {
      const mq = window.matchMedia(wideQuery);
      mq.addEventListener("change", l);
      return () => mq.removeEventListener("change", l);
    },
    () => window.matchMedia(wideQuery).matches,
    () => false,
  );
  return on && wide;
}
