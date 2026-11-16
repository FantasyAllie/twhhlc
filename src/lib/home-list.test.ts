import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cardLabel, finished, guestsLabel, hasIncomingGuest, toDo, type ListRoom } from "./home-list";

const room = (n: number, extra: Partial<ListRoom> = {}): ListRoom => ({
  n, done: false, neverServiced: false, notRequired: false, stayover: false, ...extra,
});

describe("home list", () => {
  it("puts checked-out departures first, then by job", () => {
    const rooms = [
      room(9, { sheetKind: "stayover" }), room(4, { sheetKind: "arrival" }), room(7, { sheetKind: "departure" }),
      room(3, { sheetKind: "turnover" }), room(12, { sheetKind: "turnover", guestVacated: true }), room(2),
    ];
    assert.deepEqual(toDo(rooms).map((r) => r.n), [12, 3, 7, 4, 9, 2]);
  });

  it("folds away done, Staff/ROS and not required rooms", () => {
    const rooms = [room(1, { done: true }), room(2, { neverServiced: true }), room(4, { notRequired: true }), room(5)];
    assert.deepEqual(toDo(rooms).map((r) => r.n), [5]);
    assert.deepEqual(finished(rooms).map((r) => r.n), [1, 2, 4]);
  });

  it("shows the bed and head count only for arriving guests", () => {
    assert.equal(hasIncomingGuest("turnover"), true);
    assert.equal(hasIncomingGuest("arrival"), true);
    assert.equal(hasIncomingGuest("departure"), false);
    assert.equal(hasIncomingGuest("stayover"), false);
    assert.equal(guestsLabel(1), "1 guest");
    assert.equal(guestsLabel(2), "2 guests");
  });

  it("puts the tile label on one line", () => {
    assert.equal(cardLabel("Depart / Arrival\nNot started"), "Depart / Arrival · Not started");
    assert.equal(cardLabel("Clean"), "Clean");
  });
});
