import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSheet, classifyRoom, type ParsedSheetRoom } from "./morning-sheet";

const base: ParsedSheetRoom = {
  room_number: 1, night: null, occupancy: "vacant", arriving_today: false, departing_today: false,
  adults: 0, children: 0, infants: 0, lead_name: null, bed: null, dog: false, notes: null,
};

describe("morning sheet rules", () => {
  it("same-day departure and arrival is a turnover that starts Dirty", () => {
    const { rooms } = buildSheet([{ ...base, occupancy: "departure", arriving_today: true }]);
    assert.equal(rooms[0].kind, "turnover");
    assert.equal(rooms[0].status_label, "Dirty");
  });
  it("arrival into an empty room shows Arrival (yellow)", () => {
    assert.equal(classifyRoom({ ...base, arriving_today: true, night: "0/1" }), "arrival");
  });
  it("guest mid-stay is a Stayover (pink)", () => {
    assert.equal(classifyRoom({ ...base, occupancy: "occupied", night: "1/2" }), "stayover");
  });
  it("out of service wins over anything else", () => {
    assert.equal(classifyRoom({ ...base, occupancy: "out_of_service", arriving_today: true }), "ros");
  });
  it("summary counts dogs and guests only for occupied rooms", () => {
    const { summary } = buildSheet([
      { ...base, room_number: 1, arriving_today: true, adults: 2, dog: true },
      { ...base, room_number: 2, occupancy: "out_of_service", adults: 3 },
      { ...base, room_number: 1, arriving_today: true, adults: 9 },
    ]);
    assert.equal(summary.arrival, 1);
    assert.equal(summary.dogs, 1);
    assert.equal(summary.guests, 2);
  });
});

import { canUploadMorningSheet, setAsBed, departureLabel } from "./morning-sheet";
describe("morning sheet room details", () => {
  it("notes bed wins", () => assert.equal(setAsBed({ sheetBed: "twin", sheetRoomType: "SUP_TW_KING", roomBed: "King" }), "Twin"));
  it("flexible room types with no notes bed are Unknown", () => {
    for (const t of ["TWIN_KING", "SUP_TW_KING", "Family"]) assert.equal(setAsBed({ sheetBed: null, sheetRoomType: t, roomBed: "King" }), "Unknown");
  });
  it("other rooms use their set bed", () => assert.equal(setAsBed({ sheetBed: null, sheetRoomType: "STD_DBL", roomBed: "Double" }), "Double"));
  it("departures say Depart, turnovers Depart / Arrival", () => {
    assert.equal(departureLabel("departure"), "Depart");
    assert.equal(departureLabel("turnover"), "Depart / Arrival");
    assert.equal(departureLabel("stayover"), null);
  });
  it("only Reception, Housekeeping managers and admins can upload", () => {
    assert.equal(canUploadMorningSheet("user", ["reception"]), true);
    assert.equal(canUploadMorningSheet("manager", ["housekeeper"]), true);
    assert.equal(canUploadMorningSheet("user", ["housekeeper"]), false);
    assert.equal(canUploadMorningSheet("manager", ["fnb"]), false);
    assert.equal(canUploadMorningSheet("admin", []), true);
  });
});
