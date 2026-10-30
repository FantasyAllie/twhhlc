import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cacheSavedRoomCount } from "./linen-count-cache";

describe("saved room linen counts", () => {
  it("a saved count of 3 remains 3 when its pending display is removed, not zero", () => {
    const cached = cacheSavedRoomCount([], 4, "template", "sheet", 3);
    assert.equal(cached.find(c => c.room_number === 4 && c.item_id === "sheet")?.count ?? 0, 3);
    assert.equal(cacheSavedRoomCount(cached, 4, "template", "sheet", 5)[0].count, 5);
    assert.equal(cached[0].count, 3);
  });
});