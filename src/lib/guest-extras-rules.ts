// Pure rules for Guest Extras: which complimentary items a room needs and how many.

export type GuestExtra = { id: string; name: string; icon: string | null; sort_order: number };
export type GuestExtraRule = {
  id: string;
  extra_id: string;
  room_types: string[];
  applies_to: "arrival" | "stayover" | "both";
  quantities: number[];
  extra_per_guest: number;
  sort_order: number;
};
export type ExtrasJob = "arrival" | "stayover" | null;

/** Paperwork job → which rules apply. Departures need no extras; no paperwork counts as an arrival. */
export function jobForSheetKind(sheetKind: string | null | undefined): ExtrasJob {
  if (sheetKind === "departure") return null;
  if (sheetKind === "stayover") return "stayover";
  return "arrival";
}

/** quantities[0] is for 1 guest; each guest past the last entry adds extraPerGuest. */
export function quantityFor(rule: Pick<GuestExtraRule, "quantities" | "extra_per_guest">, guests: number): number {
  const g = Math.max(1, Math.floor(guests));
  const q = rule.quantities;
  if (!q.length) return 0;
  if (g <= q.length) return q[g - 1];
  return q[q.length - 1] + (g - q.length) * rule.extra_per_guest;
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

export function ruleMatches(rule: GuestExtraRule, job: ExtrasJob, roomTypes: (string | null | undefined)[]): boolean {
  if (!job) return false;
  if (rule.applies_to !== "both" && rule.applies_to !== job) return false;
  if (!rule.room_types.length) return true;
  const mine = roomTypes.map(norm).filter(Boolean);
  return rule.room_types.some((t) => mine.includes(norm(t)));
}

/** Items a room needs, in item order. The first matching rule per item wins. */
export function extrasForRoom(
  extras: GuestExtra[],
  rules: GuestExtraRule[],
  room: { job: ExtrasJob; roomTypes: (string | null | undefined)[]; guests: number },
): { extra: GuestExtra; quantity: number }[] {
  const sorted = [...rules].sort((a, b) => a.sort_order - b.sort_order);
  const out: { extra: GuestExtra; quantity: number }[] = [];
  for (const extra of [...extras].sort((a, b) => a.sort_order - b.sort_order)) {
    const rule = sorted.find((r) => r.extra_id === extra.id && ruleMatches(r, room.job, room.roomTypes));
    if (!rule) continue;
    const quantity = quantityFor(rule, room.guests);
    if (quantity > 0) out.push({ extra, quantity });
  }
  return out;
}
