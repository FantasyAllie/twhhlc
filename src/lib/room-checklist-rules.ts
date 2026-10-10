export const DEFAULT_ROOM_CHECKLIST = ["TV Remote", "Fan", "Water"];

export function isChecklistComplete(items: string[], checked: boolean[]): boolean {
  return checked.length === items.length && items.every((_, i) => checked[i] === true);
}

export function normalizeChecklist(items: string[]): string[] {
  const cleaned = items.map((item) => item.trim());
  if (cleaned.some((item) => !item)) throw new Error("Every checklist item needs a name.");
  if (new Set(cleaned.map((item) => item.toLowerCase())).size !== cleaned.length) {
    throw new Error("Checklist items must have different names.");
  }
  return cleaned;
}