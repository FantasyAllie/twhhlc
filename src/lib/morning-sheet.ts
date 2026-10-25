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
  notes: string | null;
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
