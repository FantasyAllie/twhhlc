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

export type TileMeta = { bg: string; fg: string; accent: string; label: string };

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

// Verbatim tile colour/label rules from the route file, with the only
// role difference (dirty label, progress condition) passed in.
export const computeTileMeta = (args: {
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
}): TileMeta => {
  const { flags, state, isNR, hasLinenCount, earlyCheckIn, lateCheckout, stayoverOut, role, sheetKind } = args;
  const isDone = state === "done" || state === "complete";
  const working = hasLinenCount || (role === "housekeeping" && state === "progress");
  const fromSheet = !!sheetKind && sheetKind !== "vacant" && sheetKind !== "ros";
  const dirtyTone = { bg: "var(--room-dirty)", fg: "var(--room-dirty-fg)", accent: "var(--room-dirty-accent)" };
  if (flags.isStaff)
    return { bg: "var(--room-staff)", fg: "var(--room-staff-fg)", accent: "var(--room-staff-accent)", label: "Staff" };
  if (flags.isRos)
    return { bg: "var(--room-staff)", fg: "var(--room-staff-fg)", accent: "var(--room-staff-accent)", label: "ROS" };
  if (isNR)
    return { bg: "var(--room-stayover)", fg: "var(--room-stayover-fg)", accent: "var(--room-stayover-accent)", label: "STAYOVER" };
  if (stayoverOut && !isDone)
    return { bg: "var(--room-stayover-out)", fg: "var(--room-stayover-out-fg)", accent: "var(--room-stayover-out-accent)", label: "Not started" };
  // Sheet stayovers stay in the dirty tone until DND, Not required or done.
  if (sheetKind === "stayover" && flags.isStayover && !flags.isDnd && !isDone)
    return { ...dirtyTone, label: working ? "Stayover\nIn progress" : "Stayover\nNot started" };
  if (flags.isStayover || flags.isDnd)
    return { bg: "var(--room-stayover)", fg: "var(--room-stayover-fg)", accent: "var(--room-stayover-accent)", label: "Stayover" };
  if (isDone)
    return flags.isClean
      ? { bg: "var(--room-cleandone)", fg: "var(--room-cleandone-fg)", accent: "var(--room-cleandone-accent)", label: "Clean" }
      : { bg: "var(--room-complete)", fg: "var(--room-complete-fg)", accent: "var(--room-complete-accent)", label: "Arrival" };
  const dep = departureLabel(sheetKind);
  if (flags.isDirty && dep) return { ...dirtyTone, label: `${dep}\n${working ? "In progress" : "Not started"}` };
  if (flags.isDirty)
    return {
      bg: "var(--room-dirty)",
      fg: "var(--room-dirty-fg)",
      accent: "var(--room-dirty-accent)",
      label: role === "reception" ? "ROS - Dirty" : "Dirty",
    };
  const inProgress = hasLinenCount || (role === "housekeeping" && state === "progress");
  if (inProgress) return { ...roomStateMeta.progress, label: "Cleaning in Progress" };
  if (lateCheckout)
    return { bg: "var(--room-late)", fg: "var(--room-late-fg)", accent: "var(--room-late-accent)", label: "Late Checkout" };
  if (earlyCheckIn)
    return { bg: "var(--room-early)", fg: "var(--room-early-fg)", accent: "var(--room-early-accent)", label: "Early check-in" };
  const base = flags.isArrival ? "Arrival" : flags.isDirty ? "Dirty" : flags.isClean ? "Clean" : "Not started";
  return {
    ...roomStateMeta.todo,
    label: fromSheet && base !== "Not started" ? `${base}\nNot started` : base,
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
