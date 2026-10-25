// Morning sheet (House Room Status report) rules shared by the parser, preview and banner.

export type ParsedSheetRoom = {
  room_number: number;
  night: string | null;
  occupancy: "vacant" | "occupied" | "departure" | "out_of_service";
  arriving_today: boolean;
  departing_today: boolean;
  adults: number;
  children: number;
  infants: number;
  lead_name: string | null;
  bed: "twin" | "double" | "king" | null;
  dog: boolean;
  /** Housekeeping notes said ECI / LCO. Older uploads lack them. */
  eci?: boolean;
  lco?: boolean;
  notes: string | null;
  /** Paperwork room type code, e.g. SUP_TW_KING. Older uploads lack it. */
  room_type?: string | null;
};

export type SheetKind = "turnover" | "departure" | "stayover" | "arrival" | "ros" | "vacant";

export type SheetRoom = ParsedSheetRoom & { kind: SheetKind; status_label: string };

export type SheetSummary = Record<SheetKind, number> & { dogs: number; guests: number };

/** Status label each kind sets on the room tile. Turnovers start Dirty; Arrival follows once cleaned. */
export const KIND_STATUS: Record<SheetKind, string> = {
  turnover: "Dirty",
  departure: "Dirty",
  stayover: "Stayover",
  arrival: "Arrival",
  ros: "ROS",
  vacant: "Clean",
};

export const KIND_LABEL: Record<SheetKind, string> = {
  turnover: "Turnover",
  departure: "Departure",
  stayover: "Stayover",
  arrival: "Arrival",
  ros: "Out of service",
  vacant: "Vacant",
};

export function classifyRoom(r: ParsedSheetRoom): SheetKind {
  if (r.occupancy === "out_of_service") return "ros";
  const departing = r.occupancy === "departure" || r.departing_today;
  if (departing && r.arriving_today) return "turnover";
  if (departing) return "departure";
  if (r.arriving_today) return "arrival";
  if (r.occupancy === "occupied") return "stayover";
  return "vacant";
}

export function buildSheet(rows: ParsedSheetRoom[]): { rooms: SheetRoom[]; summary: SheetSummary } {
  const seen = new Set<number>();
  const rooms: SheetRoom[] = [];
  for (const r of rows) {
    if (!Number.isInteger(r.room_number) || seen.has(r.room_number)) continue;
    seen.add(r.room_number);
    const kind = classifyRoom(r);
    rooms.push({ ...r, kind, status_label: KIND_STATUS[kind] });
  }
  const summary: SheetSummary = { turnover: 0, departure: 0, stayover: 0, arrival: 0, ros: 0, vacant: 0, dogs: 0, guests: 0 };
  for (const r of rooms) {
    summary[r.kind] += 1;
    if (r.dog) summary.dogs += 1;
    if (r.kind !== "ros" && r.kind !== "vacant") summary.guests += r.adults + r.children + r.infants;
  }
  return { rooms, summary };
}

// --- Room view / tile rules for rooms set up from the sheet -------------------

/** Paperwork room types whose bed can be made up either way. */
const FLEX_ROOM_TYPES = ["twin_king", "sup_tw_king", "family"];
export const isFlexRoomType = (t: string | null | undefined) =>
  !!t && FLEX_ROOM_TYPES.some((f) => t.toLowerCase().replace(/[^a-z_]/g, "").includes(f));

/** Bed for the "Set as:" line: notes bed, then Unknown for flexible rooms, then the room's set bed. */
export function setAsBed(a: { sheetBed: string | null | undefined; sheetRoomType: string | null | undefined; roomBed: string | null | undefined }): string | null {
  if (a.sheetBed) return a.sheetBed.charAt(0).toUpperCase() + a.sheetBed.slice(1);
  if (isFlexRoomType(a.sheetRoomType)) return "Unknown";
  return a.roomBed ?? null;
}

/** Tile wording for sheet departures (hidden "Departure" status shown instead of Dirty). */
export const departureLabel = (kind: string | null | undefined): string | null =>
  kind === "turnover" ? "Depart / Arrival" : kind === "departure" ? "Depart" : null;

/** Reception (any), Housekeeping managers and admins/developers may upload. Database policy mirrors this. */
export function canUploadMorningSheet(position: string | undefined, departments: readonly string[]): boolean {
  if (position === "admin" || position === "developer" || position === "regional_admin") return true;
  if (departments.includes("reception")) return true;
  return position === "manager" && departments.includes("housekeeper");
}
