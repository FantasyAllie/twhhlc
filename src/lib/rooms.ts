// Room status rules: tile state derivation and the "Reset all" decision logic.
// Extracted verbatim from src/routes/app.tsx (stage 3 of the staged refactor).
import type { ReceptionItem, Room } from "./app-types";
import { departureLabel } from "./morning-sheet";

export type RoomTileState = "todo" | "progress" | "done" | "complete";

export const getRoomTileState = (isDone: boolean, hasCounts: boolean): RoomTileState => {
  if (isDone && hasCounts) return "complete";
  if (isDone) return "done";
  if (hasCounts) return "progress";
  return "todo";
};

export const roomStateMeta: Record<
  RoomTileState,
  { bg: string; fg: string; accent: string; label: string }
> = {
  todo:     { bg: "var(--room-todo)",     fg: "var(--room-todo-fg)",     accent: "var(--room-todo-accent)",     label: "Stayover\n" },
  progress: { bg: "var(--room-progress)", fg: "var(--room-progress-fg)", accent: "var(--room-progress-accent)", label: "Cleaning in progress" },
  done:     { bg: "var(--room-done)", fg: "var(--room-done-fg)", accent: "var(--room-done-accent)", label: "Clean" },
  complete: { bg: "var(--room-done)", fg: "var(--room-done-fg)", accent: "var(--room-done-accent)", label: "Cleaned & Ready for Guest" },
};

// --- Reset all: decision logic (shared by housekeeping and reception) -------

export type PreservedFlags = {
  guest_vacated: boolean;
  early_check_in: boolean;
  late_checkout: boolean;
  needs_maintenance: boolean;
  stayover_out: boolean;
  dog_box: boolean;
  guest_vacated_at: string | null;
  early_check_in_at: string | null;
  late_checkout_at: string | null;
  needs_maintenance_at: string | null;
  stayover_out_at: string | null;
  dog_box_at: string | null;
};

// Reception flags set after the most recent 4pm cutoff survive a morning reset.
export const resetCutoff = (now: Date): Date => {
  const cutoff = new Date(now);
  cutoff.setHours(16, 0, 0, 0);
  if (now.getTime() < cutoff.getTime()) cutoff.setDate(cutoff.getDate() - 1);
  return cutoff;
};

export const dirtyStatusId = (receptionStatuses: ReceptionItem[]): string | null =>
  receptionStatuses.find((s) => s.label.toLowerCase() === "dirty")?.id ?? null;

// --- Status id resolution + tile meta (shared by both role tile renderers) ---

export type RoomStatusIds = {
  dnd: string | null;
  staff: string | null;
  stay: string | null;
  dirty: string | null;
  clean: string | null;
  arrival: string | null;
  ros: string | null;
};

const byLabel = (items: ReceptionItem[], label: string) =>
  items.find((s) => s.label.toLowerCase() === label)?.id ?? null;

export const resolveRoomStatusIds = (receptionStatuses: ReceptionItem[]): RoomStatusIds => ({
  dnd: byLabel(receptionStatuses, "dnd"),
  staff: byLabel(receptionStatuses, "staff"),
  stay: byLabel(receptionStatuses, "stayover"),
  dirty: byLabel(receptionStatuses, "dirty"),
  clean: byLabel(receptionStatuses, "clean"),
  arrival: byLabel(receptionStatuses, "arrival"),
  ros: byLabel(receptionStatuses, "ros"),
});

export type RoomStatusFlags = {
  isStaff: boolean;
  isDnd: boolean;
  isStayover: boolean;
  isDirty: boolean;
  isClean: boolean;
  isArrival: boolean;
  isRos: boolean;
  hasStatus: boolean;
};

export const resolveRoomStatusFlags = (
  room: Room | undefined,
  ids: RoomStatusIds,
): RoomStatusFlags => {
  const sid = room?.reception_status_id ?? room?.default_status ?? null;
  return {
    isStaff: !!ids.staff && sid === ids.staff,
    isDnd: !!ids.dnd && sid === ids.dnd,
    isStayover: !!ids.stay && sid === ids.stay,
    isDirty: !!ids.dirty && sid === ids.dirty,
    isClean: !!ids.clean && sid === ids.clean,
    isArrival: !!ids.arrival && sid === ids.arrival,
    isRos: !!ids.ros && sid === ids.ros,
    hasStatus: !!sid,
  };
};

export type TileMeta = {
  bg: string; fg: string; accent: string; label: string;
  /** Clean but not checked yet (polish preview): drawn with a dashed edge. */
  pending?: boolean;
};

/** Paperwork departures/turnovers are scheduled cleans, not leftover Dirty rooms. */
export const isScheduledSheetClean = (sheetKind?: string | null): boolean =>
  sheetKind === "departure" || sheetKind === "turnover";

// Bed short code used on room tiles (e.g. "ARRIVAL - D"), not the full label.
export const bedCode = (label: string | null | undefined): string | null => {
  if (!label) return null;
  const normalized = label.trim();
  const explicit: Record<string, string> = {
    Double: "D",
    King: "K",
    Twin: "T",
    Single: "S",
    Sofa: "SF",
    Cot: "C",
  };
  return explicit[normalized] ?? normalized[0]?.toUpperCase() ?? null;
};

type TileArgs = {
  flags: RoomStatusFlags;
  state: RoomTileState;
  isNR: boolean;
  hasLinenCount: boolean;
  earlyCheckIn: boolean;
  lateCheckout?: boolean;
  stayoverOut?: boolean;
  role: "reception" | "housekeeping";
  /** Job type from the applied morning sheet, if any. */
  sheetKind?: string | null;
  /** Left dirty today (set aside) or on an earlier day (to clean today). */
  leftDirty?: "today" | "earlier" | null;
  /**
   * Polish preview: rooms that are already clean but not checked use a pale
   * version of their done colour (green for arrivals, purple for clean rooms)
   * and read "Not checked", rather than the dirty / to-do colours.
   */
  checkTones?: boolean;
};

/** Tile labels that never use the done flag, so never get the pale dashed look. */
const NEVER_DONE_LABELS = new Set(["ROS", "Staff", "Dirty", "ROS - Dirty"]);

/**
 * Polish preview: a pale version of a tile colour (mixed halfway to the page),
 * for rooms that aren't done yet.
 */
export const paleTone = (colour: string) => `color-mix(in oklab, ${colour} 45%, var(--background))`;

/**
 * The tile's colour and wording. With the polish preview on, every room that
 * isn't done yet (except ROS, Staff and plain Dirty, which never use the done
 * flag) is drawn in a pale version of its colour with a dashed edge: brown to
 * clean, yellow while being cleaned, blue for stayovers, green for an arrival
 * and purple for a clean room still to check. DND and NR are marked done when set.
 */
export const computeTileMeta = (args: TileArgs): TileMeta => {
  const meta = baseTileMeta(args);
  const { checkTones, state, isNR, flags } = args;
  if (!checkTones) return meta;
  const done = state === "done" || state === "complete";
  if (done || isNR || flags.isDnd || NEVER_DONE_LABELS.has(meta.label)) return meta;
  // A paperwork stayover's deeper blue reads darker than a finished stayover, so
  // unfinished stayovers start from the normal stayover blue.
  const tone = meta.bg === "var(--room-stayover-job)"
    ? { bg: "var(--room-stayover)", fg: "var(--room-stayover-fg)", accent: "var(--room-stayover-accent)" }
    : meta;
  return { ...meta, fg: tone.fg, accent: tone.accent, bg: paleTone(tone.bg), pending: true };
};

/**
 * Polish preview: what reception's tile says. The room's status (Depart,
 * Turnover, Arrival, Clean, Stayover, ROS, Dirty…) without "Not started" or
 * "Not checked"; late checkout or early check-in on the second line when set.
 */
export const receptionTileLabel = (
  label: string,
  room: { late_checkout?: boolean | null; early_check_in?: boolean | null; stayover_out?: boolean | null } | undefined,
): string => {
  const extra = room?.late_checkout ? "Late checkout" : room?.early_check_in ? "Early check-in" : null;
  const [first, second] = label.split("\n");
  if (second === "Not started" || second === "Not checked") return extra ? `${first}\n${extra}` : first;
  if (label === "Not started") return room?.stayover_out ? "Stayover" : extra ?? "";
  return label;
};

// Verbatim tile colour/label rules from the route file, with the only
// role difference (dirty label, progress condition) passed in.
const baseTileMeta = (args: TileArgs): TileMeta => {
  const { flags, state, isNR, hasLinenCount, earlyCheckIn, lateCheckout, stayoverOut, role, sheetKind, leftDirty, checkTones } = args;
  const isDone = state === "done" || state === "complete";
  const working = hasLinenCount || (role === "housekeeping" && state === "progress");
  const fromSheet = !!sheetKind && sheetKind !== "vacant" && sheetKind !== "ros";
  const dirtyTone = { bg: "var(--room-dirty)", fg: "var(--room-dirty-fg)", accent: "var(--room-dirty-accent)" };
  const stayoverJobTone = { bg: "var(--room-stayover-job)", fg: "var(--room-stayover-job-fg)", accent: "var(--room-stayover-job-accent)" };
  if (flags.isStaff)
    return { bg: "var(--room-staff)", fg: "var(--room-staff-fg)", accent: "var(--room-staff-accent)", label: "Staff" };
  if (flags.isRos)
    return { bg: "var(--room-staff)", fg: "var(--room-staff-fg)", accent: "var(--room-staff-accent)", label: "ROS" };
  // Left dirty today: set aside until tomorrow. Checked before the stayover rules, so
  // a stayover nobody got to reads Dirty too instead of going back to "Not started".
  if (leftDirty === "today") return { ...dirtyTone, label: "Dirty" };
  if (isNR)
    return { bg: "var(--room-stayover)", fg: "var(--room-stayover-fg)", accent: "var(--room-stayover-accent)", label: "STAYOVER" };
  if (stayoverOut && !isDone && !working)
    return { bg: "var(--room-stayover-out)", fg: "var(--room-stayover-out-fg)", accent: "var(--room-stayover-out-accent)", label: "Not started" };
  // Paperwork jobs use Dirty until started, then the normal progress tone.
  // Paperwork stayovers still to do use a deeper stayover blue, then the progress tone.
  if (sheetKind === "stayover" && (flags.isStayover || flags.isDirty) && !flags.isDnd && !isDone)
    return { ...(working ? roomStateMeta.progress : stayoverJobTone), label: working ? "Stayover\nIn progress" : "Stayover\nNot started" };
  if (flags.isStayover || flags.isDnd)
    return { bg: "var(--room-stayover)", fg: "var(--room-stayover-fg)", accent: "var(--room-stayover-accent)", label: "Stayover" };
  if (isDone)
    return flags.isClean || (sheetKind === "departure" && flags.isDirty)
      ? { bg: "var(--room-cleandone)", fg: "var(--room-cleandone-fg)", accent: "var(--room-cleandone-accent)", label: "Clean" }
      : { bg: "var(--room-complete)", fg: "var(--room-complete-fg)", accent: "var(--room-complete-accent)", label: "Arrival" };
  const dep = departureLabel(sheetKind);
  if (flags.isDirty && dep) return {
    ...(working ? roomStateMeta.progress : dirtyTone),
    label: `${dep}\n${working ? "In progress" : "Not started"}`,
  };
  // An arrival without a departure is already clean on the paperwork,
  // but still needs its arrival setup checked before it is marked done.
  // It uses the same warm tone as a departure/arrival room.
  if (sheetKind === "arrival" && (flags.isArrival || flags.isClean) && checkTones && !working)
    // Polish preview: the arrival green, made pale by computeTileMeta.
    return { bg: "var(--room-complete)", fg: "var(--room-complete-fg)", accent: "var(--room-complete-accent)", label: "Arrival\nNot checked" };
  if (sheetKind === "arrival" && (flags.isArrival || flags.isClean))
    return {
      ...(working ? roomStateMeta.progress : dirtyTone),
      label: `Arrival\n${working ? "In progress" : "Not started"}`,
    };
  // Left dirty on an earlier day: on today's list to clean.
  if (flags.isDirty && leftDirty === "earlier")
    return { ...(working ? roomStateMeta.progress : dirtyTone), label: `Left dirty\n${working ? "In progress" : "Not started"}` };
  if (flags.isDirty)
    return {
      ...(fromSheet && working ? roomStateMeta.progress : dirtyTone),
      label: role === "reception" ? "ROS - Dirty" : "Dirty",
    };
  const inProgress = hasLinenCount || (role === "housekeeping" && state === "progress");
  if (inProgress) return { ...roomStateMeta.progress, label: "Cleaning in Progress" };
  if (lateCheckout)
    return { bg: "var(--room-late)", fg: "var(--room-late-fg)", accent: "var(--room-late-accent)", label: "Late Checkout" };
  if (earlyCheckIn)
    return { bg: "var(--room-early)", fg: "var(--room-early-fg)", accent: "var(--room-early-accent)", label: "Early check-in" };
  const base = flags.isArrival ? "Arrival" : flags.isDirty ? "Dirty" : flags.isClean ? "Clean" : "Not started";
  // Polish preview: the clean purple, made pale by computeTileMeta.
  if (checkTones && sheetKind === "vacant" && flags.isClean)
    return { bg: "var(--room-cleandone)", fg: "var(--room-cleandone-fg)", accent: "var(--room-cleandone-accent)", label: "Clean\nNot checked" };
  return {
    ...roomStateMeta.todo,
    label: sheetKind === "vacant" && flags.isClean
      ? "Clean\nNot checked"
      : fromSheet && base !== "Not started" ? `${base}\nNot started` : base,
  };
};

// Rooms currently marked Dirty get reset like any other room, but the
// "Guest has checked out" flag is switched on so housekeeping can spot rooms
// needing cleaning first thing in the morning.
export const computeResetPreserveMap = (
  rooms: Room[],
  receptionStatuses: ReceptionItem[],
  now: Date,
): Map<number, PreservedFlags> => {
  const cutoffMs = resetCutoff(now).getTime();
  const isFresh = (iso: string | null | undefined) =>
    !!iso && new Date(iso).getTime() >= cutoffMs;
  const dirtyId = dirtyStatusId(receptionStatuses);
  const isDirtyRoom = (r: Room) =>
    !!dirtyId && (r.reception_status_id ?? r.default_status) === dirtyId;

  const preserveMap = new Map<number, PreservedFlags>();
  for (const r of rooms) {
    const dirty = isDirtyRoom(r);
    const gv = dirty || (r.guest_vacated && isFresh(r.guest_vacated_at));
    const ec = isFresh(r.early_check_in_at) && !!r.early_check_in;
    const lc = isFresh(r.late_checkout_at) && !!r.late_checkout;
    const nm = isFresh(r.needs_maintenance_at) && r.needs_maintenance;
    const so = isFresh(r.stayover_out_at) && !!r.stayover_out;
    const dg = isFresh(r.dog_box_at) && !!r.dog_box;
    if (gv || ec || lc || nm || so || dg) {
      preserveMap.set(r.room_number, {
        guest_vacated: gv,
        early_check_in: ec,
        late_checkout: lc,
        needs_maintenance: nm,
        stayover_out: so,
        dog_box: dg,
        guest_vacated_at: gv ? (dirty ? now.toISOString() : r.guest_vacated_at ?? null) : null,
        early_check_in_at: ec ? r.early_check_in_at ?? null : null,
        late_checkout_at: lc ? r.late_checkout_at ?? null : null,
        needs_maintenance_at: nm ? r.needs_maintenance_at ?? null : null,
        stayover_out_at: so ? r.stayover_out_at ?? null : null,
        dog_box_at: dg ? r.dog_box_at ?? null : null,
      });
    }
  }
  return preserveMap;
};

/**
 * The beds a room can be made up as, from its room types (as housekeeping's Status
 * screen offers them): a Super King room is Super King or Twin, a Double room is
 * Double only, otherwise every bed except Double where a Super King is possible.
 */
export function roomBedChoices<B extends { id: string; label: string }>(categories: string[], beds: B[]): B[] {
  const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
  const cats = categories.map(norm);
  const hasSuperKing = cats.includes("superking");
  const hasDouble = cats.includes("double");
  const onlyDouble = hasDouble && !hasSuperKing;
  return beds.filter((b) => {
    const nb = norm(b.label);
    if (onlyDouble) return nb === "double";
    if (hasSuperKing && nb === "double") return false;
    if (hasDouble && (nb === "king" || nb === "twin")) return false;
    return true;
  });
}

/** A pinned note that changed the room's bed starts with this (see the pin composer). */
export const BED_CHANGED_PREFIX = "Bed changed to ";
