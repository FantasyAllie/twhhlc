import { describe, it as test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_ROOM_CHECKLIST, selectedChecklistItems, shouldOpenChecklist, normalizeChecklist } from "./room-checklist-rules";

describe("room completion checklist", () => {
  test("starts with TV Remote, Fan, Water", () => {
    assert.deepEqual(DEFAULT_ROOM_CHECKLIST, ["TV Remote", "Fan", "Water"]);
  });
  test("records only the items selected as in the room; none are required", () => {
    assert.deepEqual(selectedChecklistItems(DEFAULT_ROOM_CHECKLIST, [true, false, true]), ["TV Remote", "Water"]);
    assert.deepEqual(selectedChecklistItems(DEFAULT_ROOM_CHECKLIST, []), []);
  });
  test("opens only when the room is done and Clean or Arrival", () => {
    assert.equal(shouldOpenChecklist(true, true), true);
    assert.equal(shouldOpenChecklist(true, false), false);
    assert.equal(shouldOpenChecklist(false, true), false);
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
