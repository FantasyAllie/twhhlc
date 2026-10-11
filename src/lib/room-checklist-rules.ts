export const DEFAULT_ROOM_CHECKLIST = ["TV Remote", "Fan", "Water"];

/** Items ticked as present in this room (none are required). */
export function selectedChecklistItems(items: string[], checked: boolean[]): string[] {
  return items.filter((_, i) => checked[i] === true);
}

/** The checklist only appears for a room that is both marked done and set to Clean or Arrival. */
export function shouldOpenChecklist(done: boolean, isCleanOrArrival: boolean): boolean {
  return done && isCleanOrArrival;
}

export function normalizeChecklist(items: string[]): string[] {
  const cleaned = items.map((item) => item.trim());
  if (cleaned.some((item) => !item)) throw new Error("Every checklist item needs a name.");
  if (new Set(cleaned.map((item) => item.toLowerCase())).size !== cleaned.length) {
    throw new Error("Checklist items must have different names.");
  }
  return cleaned;
}
