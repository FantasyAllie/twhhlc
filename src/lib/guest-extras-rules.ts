// Pure rules for the Room Checklist: which room items (checks and guest extras) a
// room needs today, and how many. Matches the iPhone app exactly.

export type GuestExtra = { id: string; name: string; icon: string | null; kind: "check" | "leave"; sort_order: number };
export type GuestExtraRule = {
  id: string; extra_id: string; room_types: string[]; room_features: string[]; except_features: string[];
  flags: string[]; note_words: string[]; applies_to: "arrival" | "stayover" | "both" | "any";
  quantities: number[]; extra_per_guest: number; sort_order: number;
};
export type ExtrasJob = "arrival" | "stayover" | null;
export type RoomNeed = { extra: GuestExtra; quantity: number; done: boolean };

/** The room's job today: the paperwork first, then its status label. No job means only "any" rules apply. */
export function roomJob(sheetKind: string | null | undefined, statusLabel: string): ExtrasJob {
  if (sheetKind === "arrival" || sheetKind === "turnover") return "arrival";
  if (sheetKind === "stayover") return "stayover";
  if (sheetKind === "departure" || sheetKind === "vacant" || sheetKind === "ros") return null;
  const l = statusLabel.toLowerCase();
  if (l === "arrival") return "arrival";
  if (l.replace(/[^a-z]/g, "").startsWith("stay")) return "stayover";
  return null;
}

/** quantities[0] is for 1 guest; each guest past the last entry adds extra_per_guest. */
export function quantityFor(rule: Pick<GuestExtraRule, "quantities" | "extra_per_guest">, guests: number): number {
  const q = rule.quantities;
  if (!q.length) return 0;
  const g = Math.max(1, Math.floor(guests));
  return g <= q.length ? q[g - 1] : q[q.length - 1] + (g - q.length) * rule.extra_per_guest;
}

/** How many conditions a rule names besides its job. The fitting rule with the most wins, then the earliest. */
export const specificity = (r: GuestExtraRule) =>
  [r.room_types, r.room_features, r.except_features, r.flags, r.note_words].filter((a) => a.length > 0).length;

export function extrasForRoom(extras: GuestExtra[], rules: GuestExtraRule[], room: {
  job: ExtrasJob;
  roomTypes: string[];   // parseCats(room.category) only, not the paperwork room code
  featureIds: string[];  // the room's room_feature_rooms.feature_id
  flagKeysOn: string[];  // built-in flags that are true + the room's custom flag keys
  note: string | null;   // room.housekeeping_note (the paperwork writes its notes here)
  guests: number | null; // room.guest_extras_guests ?? (sheet_guests when sheet_kind is a guest job), else null
  done: string[];        // room.guest_extras_done ?? []
}): RoomNeed[] {
  const note = (room.note ?? "").toLowerCase();
  const has = (list: string[], set: string[]) => list.some((x) => set.includes(x));
  const fits = (r: GuestExtraRule) =>
    (r.applies_to === "any" || (r.applies_to === "both" ? room.job !== null : r.applies_to === room.job)) &&
    (!r.room_types.length || has(r.room_types, room.roomTypes)) &&
    (!r.room_features.length || has(r.room_features, room.featureIds)) &&
    !has(r.except_features, room.featureIds) &&
    (!r.flags.length || has(r.flags, room.flagKeysOn)) &&
    (!r.note_words.length || r.note_words.some((w) => w && note.includes(w.toLowerCase())));
  const needs: RoomNeed[] = [];
  for (const extra of [...extras].sort((a, b) => a.sort_order - b.sort_order)) {
    const fitting = rules.filter((r) => r.extra_id === extra.id && fits(r)).sort((a, b) => a.sort_order - b.sort_order);
    if (!fitting.length) continue;
    const best = Math.max(...fitting.map(specificity));
    const rule = fitting.find((r) => specificity(r) === best)!;
    const quantity = extra.kind === "check" ? 1 : quantityFor(rule, room.guests ?? 1);
    if (quantity > 0) needs.push({ extra, quantity, done: room.done.includes(extra.id) });
  }
  return [...needs.filter((n) => n.extra.kind === "check"), ...needs.filter((n) => n.extra.kind === "leave")];
}
