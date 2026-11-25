import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { splitQuestion } from "./polish";

describe("splitQuestion", () => {
  it("keeps today's wording: question as title, the rest as detail", () => {
    assert.deepEqual(splitQuestion(`Delete account "sam"? This cannot be undone.`), {
      title: `Delete account "sam"?`, detail: "This cannot be undone.", action: "Delete", destructive: true,
    });
  });
  it("uses the first word as the button", () => {
    assert.equal(splitQuestion("Add this item to every room?").action, "Add");
    assert.equal(splitQuestion("Add this item to every room?").destructive, false);
    const leave = splitQuestion("Leave 2 rooms dirty?\n\nRooms 1, 2 stay Dirty.");
    assert.equal(leave.action, "Leave");
    assert.equal(leave.detail, "Rooms 1, 2 stay Dirty.");
  });
  it("falls back to OK when the question doesn't start with a word", () => {
    assert.equal(splitQuestion("2 rooms?").action, "OK");
  });
});
