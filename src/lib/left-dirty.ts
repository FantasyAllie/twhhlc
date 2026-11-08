// Rooms left dirty: when housekeeping can't get to every room, the rooms left
// over can be marked "left dirty", one at a time from the room's Status view or
// all the rest at once from Shift progress. The same as the app.
//  • Left today, the room no longer holds the shift open.
//  • From the next day it's on the list to clean again, and Today's brief counts it.
//  • It shows Dirty until it's cleaned: the morning paperwork and Reset all keep
//    it Dirty (unless a guest is staying in it, or it's out of service).
// Stored as rooms.left_dirty_at, cleared by the database once the room is done.
import { isScheduledSheetClean } from "@/lib/rooms";

export type LeftDirtyRoom = {
  left_dirty_at?: string | null;
  done?: boolean | null;
  done_reception?: boolean | null;
  sheet_kind?: string | null;
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** "today" if left dirty today, "earlier" if on an earlier day; null once done or never left. */
export function leftDirtyState(room: LeftDirtyRoom | null | undefined, now: Date = new Date()): "today" | "earlier" | null {
  if (!room?.left_dirty_at || room.done || room.done_reception) return null;
  const at = new Date(room.left_dirty_at);
  if (Number.isNaN(at.getTime())) return null;
  return at >= startOfDay(now) ? "today" : "earlier";
}

/**
 * Not done, and not counted towards today's shift: left dirty today, or Dirty
 * without being on today's list (not a paperwork departure or a room left dirty
 * on an earlier day).
 */
export function isSetAside(room: LeftDirtyRoom, isDirty: boolean, now: Date = new Date()): boolean {
  if (room.done || room.done_reception) return false;
  const state = leftDirtyState(room, now);
  if (state === "today") return true;
  return isDirty && !isScheduledSheetClean(room.sheet_kind) && state !== "earlier";
}

/** Rooms left dirty on an earlier day that still need cleaning (Today's brief). */
export const carriedDirtyCount = (rooms: LeftDirtyRoom[], now: Date = new Date()) =>
  rooms.filter((r) => leftDirtyState(r, now) === "earlier").length;
