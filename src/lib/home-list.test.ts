import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cardLabel, finished, guestsLabel, hasIncomingGuest, toDo, type ListRoom } from "./home-list";

const room = (n: number, extra: Partial<ListRoom> = {}): ListRoom => ({
  n, done: false, neverServiced: false, notRequired: false, stayover: false, ...extra,
});

describe("home list", () => {
  it("lists the rooms to do in room number order", () => {
    const rooms = [
      room(9, { sheetKind: "stayover" }), room(4, { sheetKind: "arrival" }), room(7, { sheetKind: "departure" }),
      room(3, { sheetKind: "turnover" }), room(12, { sheetKind: "turnover", guestVacated: true }), room(2),
    ];
    assert.deepEqual(toDo(rooms).map((r) => r.n), [2, 3, 4, 7, 9, 12]);
  });

  it("puts early check-ins and late checkouts first", () => {
    const rooms = [room(2), room(9, { firstUp: true }), room(5), room(7, { firstUp: true })];
    assert.deepEqual(toDo(rooms).map((r) => r.n), [7, 9, 2, 5]);
  });

  it("sends Do Not Disturb rooms straight to Done", () => {
    const rooms = [room(6, { stayover: true, dnd: true }), room(5)];
    assert.deepEqual(toDo(rooms).map((r) => r.n), [5]);
    assert.deepEqual(finished(rooms).map((r) => r.n), [6]);
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
    assert.equal(cardLabel("Turnover\nNot started"), "Turnover · Not started");
    assert.equal(cardLabel("Clean"), "Clean");
  });
});
