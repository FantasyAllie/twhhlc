import { describe, expect, test } from "bun:test";
import { DEFAULT_ROOM_CHECKLIST, isChecklistComplete, normalizeChecklist } from "./room-checklist-rules";

describe("room completion checklist", () => {
  test("starts with TV Remote, Fan, Water", () => {
    expect(DEFAULT_ROOM_CHECKLIST).toEqual(["TV Remote", "Fan", "Water"]);
  });
  test("requires every item before completing a room", () => {
    expect(isChecklistComplete(DEFAULT_ROOM_CHECKLIST, [true, true, false])).toBe(false);
    expect(isChecklistComplete(DEFAULT_ROOM_CHECKLIST, [true, true])).toBe(false);
    expect(isChecklistComplete(DEFAULT_ROOM_CHECKLIST, [true, true, true])).toBe(true);
  });
  test("allows adding, renaming, reordering and removing all default items", () => {
    expect(normalizeChecklist([" Water ", "Hairdryer"])).toEqual(["Water", "Hairdryer"]);
    expect(normalizeChecklist([])).toEqual([]);
  });
  test("rejects empty and duplicate item names", () => {
    expect(() => normalizeChecklist([" "])).toThrow();
    expect(() => normalizeChecklist(["Water", " water "])).toThrow();
  });
});