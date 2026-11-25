// The new desktop layout (DESKTOP-layout-spec.md): a sidebar, the rooms, and a
// panel for the open room, on computers only. People opt in from the menu and can
// switch back at any time. The choice is kept in this browser; with it off (the
// default) the website is exactly as it was.
import { useSyncExternalStore } from "react";
import { hasIncomingGuest, toDo, type ListRoom } from "./home-list";

export const DESKTOP_LAYOUT_KEY = "tw_desktop_layout";

const listeners = new Set<() => void>();

export function readDesktopLayout(): boolean {
  try {
    return localStorage.getItem(DESKTOP_LAYOUT_KEY) === "on";
  } catch {
    return false;
  }
}

export function writeDesktopLayout(on: boolean) {
  try {
    localStorage.setItem(DESKTOP_LAYOUT_KEY, on ? "on" : "off");
  } catch {
    // Private browsing can block storage; the switch then stays as it was.
  }
  listeners.forEach((l) => l());
}

/** The switch, kept in step across components and other tabs of this browser. */
export function useDesktopLayoutPref(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      const onStorage = (e: StorageEvent) => { if (e.key === DESKTOP_LAYOUT_KEY) l(); };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(l);
        window.removeEventListener("storage", onStorage);
      };
    },
    readDesktopLayout,
    () => false,
  );
  return [on, writeDesktopLayout];
}

/** How many rooms Up next shows before "+n more". */
export const UP_NEXT_LIMIT = 5;

/**
 * Up next (Reception) and Clean first (Housekeeping): the rooms a guest is waiting
 * on, in the To do order (early check-ins and late checkouts first, then room
 * number). A room is waiting on when it's an early check-in or late checkout, or a
 * guest is arriving in it today (arrival or turnover), and it isn't done yet.
 */
export function upNext(rooms: ListRoom[]): ListRoom[] {
  return toDo(rooms).filter((r) => r.firstUp || hasIncomingGuest(r.sheetKind));
}

/** Clean first's order: the more urgent the day's job, the earlier it comes. */
const CLEAN_FIRST_RANK: Record<string, number> = { turnover: 0, arrival: 1, stayover: 2 };

/**
 * Clean first (Housekeeping): the rooms that have to be done today, most urgent
 * first. Early check-ins and late checkouts, then turnovers (a guest leaving and
 * another arriving), arrivals, then stayovers; room number within each. Departures
 * with nobody arriving can wait, so they stay in To do but not here.
 */
export function cleanFirst(rooms: ListRoom[]): ListRoom[] {
  const rank = (r: ListRoom) => (r.firstUp ? -1 : CLEAN_FIRST_RANK[r.sheetKind ?? ""] ?? 3);
  return toDo(rooms)
    .filter((r) => rank(r) < 3)
    .sort((a, b) => rank(a) - rank(b) || a.n - b.n);
}

export type FixFirstJob = { id: string; room_number: number | null; urgent?: boolean; done: boolean };

/**
 * Maintenance's Fix first: open jobs that are urgent, or in a room a guest is due
 * in today. Urgent first, then by room number (jobs not in a room last).
 */
export function fixFirst<T extends FixFirstJob>(jobs: T[], guestDueRooms: Set<number>): T[] {
  const roomKey = (j: T) => j.room_number ?? Number.MAX_SAFE_INTEGER;
  return jobs
    .filter((j) => !j.done && (j.urgent || (j.room_number != null && guestDueRooms.has(j.room_number))))
    .sort((a, b) => Number(!!b.urgent) - Number(!!a.urgent) || roomKey(a) - roomKey(b));
}

export type LiveItem = { id: string; kind: "message" | "maintenance" | "lost"; created_at: string; title: string; detail: string };

/** The sidebar's Live box: the newest few things, newest first. */
export function liveFeed(items: LiveItem[], limit = 4): LiveItem[] {
  return [...items].sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0)).slice(0, limit);
}

/** "10:42" today, "Fri" earlier this week, "20 Nov" before that. */
export function liveTime(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (d.toDateString() === now.toDateString()) {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  const days = (now.getTime() - d.getTime()) / 86_400_000;
  if (days < 6) return d.toLocaleDateString("en-GB", { weekday: "short" });
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
