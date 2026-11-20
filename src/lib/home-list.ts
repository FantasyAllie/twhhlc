// Home's list view (HomeList.kt on Android, HomeList.swift on iPhone): the rooms
// still to do (early check-ins and late checkouts first, then by room number), with
// finished rooms folded away underneath.
// "Checked out" is the room's Guest vacated flag (guest_vacated), which clears
// when the room is done or on Reset all.

export type HomeLayout = "grid" | "list";

export type ListRoom = {
  n: number;
  /** Done by housekeeping or reception. */
  done: boolean;
  /** Staff or ROS: never serviced. */
  neverServiced: boolean;
  notRequired: boolean;
  /** A stayover or DND room. */
  stayover: boolean;
  /** Do Not Disturb: the guest asked not to be serviced. */
  dnd?: boolean;
  sheetKind?: string | null;
  guestVacated?: boolean;
  /** An early check-in or late checkout: goes to the top of the list. */
  firstUp?: boolean;
};

/**
 * A room that still needs cleaning today. Do Not Disturb rooms aren't: the guest
 * has asked not to be serviced, so they go straight to Done.
 */
export const isToDo = (r: ListRoom) => !r.done && !r.notRequired && !r.neverServiced && !r.dnd;

/** The rooms to do: early check-ins and late checkouts first, then in room number order. */
export const toDo = (rooms: ListRoom[]) =>
  rooms.filter(isToDo).sort((a, b) => Number(!!b.firstUp) - Number(!!a.firstUp) || a.n - b.n);

/** Everything else (done, DND, Staff, ROS, not required), by room number. */
export const finished = (rooms: ListRoom[]) => rooms.filter((r) => !isToDo(r)).sort((a, b) => a.n - b.n);

/** A guest is arriving today, so housekeeping needs the bed and the head count. */
export const hasIncomingGuest = (sheetKind?: string | null) => sheetKind === "turnover" || sheetKind === "arrival";

export const guestsLabel = (count: number) => (count === 1 ? "1 guest" : `${count} guests`);

/** The tile's two-line label on one line ("Turnover · Not started"). */
export const cardLabel = (tileLabel: string) => tileLabel.split("\n").join(" · ");

/** Each person's choice of grid or list, kept in this browser by their user id. */
export const layoutKey = (userId: string | null | undefined) => `homeLayout.${userId ?? "anyone"}`;

export function loadLayout(userId: string | null | undefined): HomeLayout {
  try {
    return localStorage.getItem(layoutKey(userId)) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

export function saveLayout(userId: string | null | undefined, layout: HomeLayout) {
  try {
    localStorage.setItem(layoutKey(userId), layout);
  } catch {
    // Private browsing can block storage; the choice just won't be remembered.
  }
}
