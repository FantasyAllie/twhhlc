import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { toggleRoomTab, roomTileAction, type RoomTab } from "./room-navigation";

describe("room navigation", () => {
  for (const tab of ["status", "linen", "edit", "hub"] as RoomTab[]) {
    it(`${tab} opens its view and toggles back to the room view`, () => {
      assert.equal(toggleRoomTab(null, tab), tab);
      assert.equal(toggleRoomTab(tab, tab), null);
    });
  }
  it("switches from linen to status rather than leaving linen selected", () => {
    assert.equal(toggleRoomTab("linen", "status"), "status");
  });
  it("long-press-opened Status returns to the room view when Status is tapped", () => {
    assert.equal(toggleRoomTab("status", "status"), null);
  });
  it("tapping the open room tile returns home, including after a long press", () => {
    assert.equal(roomTileAction(13, 13), "close");
    assert.equal(roomTileAction(13, 14), "open");
    assert.equal(roomTileAction(null, 13), "open");
  });
});