import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSheet, classifyRoom, dayFlags, type ParsedSheetRoom } from "./morning-sheet";
import { computeTileMeta, showsDirtyEmoji, type RoomStatusFlags } from "./rooms";

const base: ParsedSheetRoom = {
  room_number: 1, night: null, occupancy: "vacant", arriving_today: false, departing_today: false,
  adults: 0, children: 0, infants: 0, lead_name: null, bed: null, dog: false, notes: null,
};

const arrivalFlags: RoomStatusFlags = {
  isStaff: false, isDnd: false, isStayover: false, isDirty: false,
  isClean: false, isArrival: true, isRos: false, hasStatus: true,
};

describe("paperwork clean arrival setup", () => {
  it("rooms 14, 23, 44 and 49 use the orange departure tone until worked on", () => {
    const { rooms } = buildSheet([14, 23, 44, 49].map(room_number => ({
      ...base, room_number, arriving_today: true, departing_today: false,
    })));
    assert.equal(rooms.length, 4);
    for (const room of rooms) {
      assert.equal(room.kind, "arrival");
      for (const role of ["housekeeping", "reception"] as const) {
        const meta = computeTileMeta({ flags: arrivalFlags, state: "todo", isNR: false,
          hasLinenCount: false, earlyCheckIn: true, lateCheckout: true, role, sheetKind: room.kind });
        assert.equal(meta.bg, "var(--room-dirty)");
        assert.equal(meta.fg, "var(--room-dirty-fg)");
        assert.equal(meta.accent, "var(--room-dirty-accent)");
      }
    }
  });
  it("clean arrivals move to progress and completed states normally", () => {
    const args = { flags: arrivalFlags, isNR: false, earlyCheckIn: false,
      role: "housekeeping" as const, sheetKind: "arrival" };
    assert.equal(computeTileMeta({ ...args, state: "progress", hasLinenCount: true }).bg, "var(--room-progress)");
    assert.equal(computeTileMeta({ ...args, state: "done", hasLinenCount: false }).bg, "var(--room-complete)");
  });
  it("actual same-day departures and arrivals keep the departure colour", () => {
    const meta = computeTileMeta({ flags: { ...arrivalFlags, isArrival: false, isDirty: true },
      state: "todo", isNR: false, hasLinenCount: false, earlyCheckIn: false,
      role: "housekeeping", sheetKind: "turnover" });
    assert.equal(meta.bg, "var(--room-dirty)");
  });
});

describe("morning sheet rules", () => {
  it("paperwork departures and Depart / Arrival use Dirty brown, stayovers the deeper stayover blue, without the dirty emoji", () => {
    for (const sheetKind of ["stayover", "departure", "turnover"]) {
      const tone = sheetKind === "stayover" ? "room-stayover-job" : "room-dirty";
      for (const role of ["housekeeping", "reception"] as const) {
        const flags = { ...arrivalFlags, isArrival: false, isDirty: true };
        const meta = computeTileMeta({ flags, state: "todo", isNR: false, hasLinenCount: false, earlyCheckIn: false, role, sheetKind });
        assert.equal(meta.bg, `var(--${tone})`);
        assert.equal(meta.fg, `var(--${tone}-fg)`);
        assert.equal(meta.accent, `var(--${tone}-accent)`);
      }
      assert.equal(showsDirtyEmoji(true, sheetKind), false);
    }
    assert.equal(showsDirtyEmoji(true, null), true);
    assert.equal(showsDirtyEmoji(true, "vacant"), true);
  });
  it("paperwork clean rooms stay Not started red until checked", () => {
    const flags = { ...arrivalFlags, isArrival: false, isClean: true };
    const args = { flags, isNR: false, hasLinenCount: false, earlyCheckIn: false, role: "housekeeping" as const, sheetKind: "vacant" };
    const meta = computeTileMeta({ ...args, state: "todo" });
    assert.equal(meta.bg, "var(--room-todo)");
    assert.equal(meta.label, "Clean\nNot checked");
    assert.equal(computeTileMeta({ ...args, state: "done" }).label, "Clean");
  });
  it("counting linen makes paperwork jobs In Progress yellow in both department views", () => {
    for (const sheetKind of ["stayover", "departure", "turnover", "arrival"]) {
      for (const role of ["housekeeping", "reception"] as const) {
        for (const stayoverOut of [false, true]) {
          const flags = { ...arrivalFlags, isArrival: sheetKind === "arrival", isDirty: sheetKind !== "arrival" };
          const meta = computeTileMeta({ flags, state: "progress", isNR: false, hasLinenCount: true, earlyCheckIn: false, role, sheetKind, stayoverOut });
          assert.equal(meta.bg, "var(--room-progress)");
          assert.equal(meta.fg, "var(--room-progress-fg)");
          assert.equal(meta.accent, "var(--room-progress-accent)");
        }
      }
    }
  });
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

import { isScheduledSheetClean as _sched } from "./rooms";
describe("paperwork departures are scheduled cleans", () => {
  it("counts departures and turnovers as scheduled, not leftover dirty", () => {
    assert.equal(_sched("departure"), true);
    assert.equal(_sched("turnover"), true);
    assert.equal(_sched(null), false);
    assert.equal(_sched("stayover"), false);
  });
});

describe("dayFlags", () => {
  const room = (kind: "arrival" | "turnover" | "departure" | "stayover", extra: Partial<ParsedSheetRoom> = {}) =>
    ({ ...base, ...extra, kind });
  it("dogs, cots and early check-in only on arrival", () => {
    const notes = "baby cot, 12pm early check in please";
    assert.deepEqual(dayFlags(room("arrival", { dog: true, notes })), { dog: true, cot: true, eci: true, lco: false });
    assert.deepEqual(dayFlags(room("turnover", { dog: true, eci: true })), { dog: true, cot: false, eci: true, lco: false });
    assert.deepEqual(dayFlags(room("stayover", { dog: true, eci: true, notes })), { dog: false, cot: false, eci: false, lco: false });
  });
  it("late checkout only on departure", () => {
    assert.equal(dayFlags(room("departure", { notes: "LATE CHECK OUT" })).lco, true);
    assert.equal(dayFlags(room("turnover", { lco: true })).lco, true);
    assert.equal(dayFlags(room("stayover", { lco: true, notes: "late checkout" })).lco, false);
  });
  it("doesn't read cot inside other words", () => {
    assert.equal(dayFlags(room("arrival", { notes: "Scotland trip" })).cot, false);
  });
});
