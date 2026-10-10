import { describe, it as test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_ROOM_CHECKLIST, isChecklistComplete, normalizeChecklist } from "./room-checklist-rules";

describe("room completion checklist", () => {
  test("starts with TV Remote, Fan, Water", () => {
    assert.deepEqual(DEFAULT_ROOM_CHECKLIST, ["TV Remote", "Fan", "Water"]);
  });
  test("requires every item before completing a room", () => {
    assert.equal(isChecklistComplete(DEFAULT_ROOM_CHECKLIST, [true, true, false]), false);
    assert.equal(isChecklistComplete(DEFAULT_ROOM_CHECKLIST, [true, true]), false);
    assert.equal(isChecklistComplete(DEFAULT_ROOM_CHECKLIST, [true, true, true]), true);
  });
  test("allows adding, renaming, reordering and removing all default items", () => {
    assert.deepEqual(normalizeChecklist([" Water ", "Hairdryer"]), ["Water", "Hairdryer"]);
    assert.deepEqual(normalizeChecklist([]), []);
  });
  test("rejects empty and duplicate item names", () => {
    assert.throws(() => normalizeChecklist([" "]));
    assert.throws(() => normalizeChecklist(["Water", " water "]));
  });
});