import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cupboardLocations, roomsForFloor } from "./floor-rules";

describe("shared floors and cupboards", () => {
  it("inventory uses the floor name while keeping its cupboard count key", () => {
    assert.deepEqual(cupboardLocations([{ id: "1", name: "First Floor", cupboard_key: "20s", sort_order: 0 }]), [{ key: "20s", label: "First Floor" }]);
  });
  it("selects only the rooms assigned to the opened floor", () => {
    assert.deepEqual(roomsForFloor([{ room_number: 21, floor: "First Floor" }, { room_number: 22, floor: "Second Floor" }, { room_number: 23, floor: "First Floor" }, { room_number: 24, floor: null }], "First Floor"), [21, 23]);
  });
});