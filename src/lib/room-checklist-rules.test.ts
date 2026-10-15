import { describe, it as test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_ROOM_CHECKLIST, selectedChecklistItems, hasRoomItemSelection, normalizeChecklist } from "./room-checklist-rules";

describe("room completion checklist", () => {
  test("starts with TV Remote, Fan, Water", () => {
    assert.deepEqual(DEFAULT_ROOM_CHECKLIST, ["TV Remote", "Fan", "Water"]);
  });
  test("records only the items selected as in the room; none are required", () => {
    assert.deepEqual(selectedChecklistItems(DEFAULT_ROOM_CHECKLIST, [true, false, true]), ["TV Remote", "Water"]);
    assert.deepEqual(selectedChecklistItems(DEFAULT_ROOM_CHECKLIST, []), []);
  });
  test("an unused checklist does not require a selection to mark the room done", () => {
    assert.equal(hasRoomItemSelection(null), false);
    assert.equal(hasRoomItemSelection(undefined), false);
  });
  test("records selected room contents including an explicitly empty selection", () => {
    assert.equal(hasRoomItemSelection(["TV Remote", "Water"]), true);
    assert.equal(hasRoomItemSelection([]), true);
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
