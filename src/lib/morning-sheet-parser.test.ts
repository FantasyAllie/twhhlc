import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseReportPages, type ReportTextItem } from "./morning-sheet-parser";
import { buildSheet } from "./morning-sheet";

const headings = ["Room ID", "Room Type", "Sub Group", "Room Status", "Housekeeping Status", "Occupied From", "Occupied To", "Lead Name", "Ad", "Ch", "Inf", "Night", "Room Section"];
const page = (rows: string[][], notes = ""): ReportTextItem[] => [
  ...headings.map((text, i) => ({ text, x: i * 100, y: 700 })),
  ...rows.flatMap((r, n) => r.map((text, i) => ({ text, x: i * 100, y: 660 - n * 40 }))),
  ...(notes ? [{ text: "Housekeeping Notes", x: 110, y: 650 }, { text: ":", x: 140, y: 650 }, { text: notes, x: 160, y: 650 }] : []),
  { text: "Page 1 of 1 at 15:40 on the 23/Oct/2026", x: 0, y: 20 },
];
const row = (number = "1") => [number, "SUP_TW_KING", "GROUND_FLOOR", "Vacant", "Room is Clean", "23/Oct/2026", "24/Oct/2026", "Test guest", "2", "1", "0", "0/1", "GROUND_FLOOR"];

describe("fixed report reading without AI", () => {
  it("reads report date and arriving guest counts from the fixed columns", () => {
    const parsed = parseReportPages([page([row()])]);
    assert.equal(parsed.sheet_date, "2026-10-23");
    assert.equal(parsed.rooms[0].adults, 2);
    assert.equal(parsed.rooms[0].children, 1);
    assert.equal(buildSheet(parsed.rooms).rooms[0].kind, "arrival");
  });
  it("extracts bed and DOG/ECI/LCO from split note text, retaining other notes", () => {
    const parsed = parseReportPages([page([row()], "TWIN DOG ECI LCO - single occ.")]).rooms[0];
    assert.equal(parsed.bed, "twin"); assert.equal(parsed.dog, true);
    assert.equal(parsed.eci, true); assert.equal(parsed.lco, true);
    assert.equal(parsed.notes, "single occ.");
  });
  it("keeps CLEAN / ARRIVAL distinct from a real turnover", () => {
    const r = row(); r[4] = "CLEAN / ARRIVAL";
    assert.equal(buildSheet(parseReportPages([page([r])]).rooms).rooms[0].kind, "arrival");
    r[4] = "Departure / Dirty Room";
    assert.equal(buildSheet(parseReportPages([page([r])]).rooms).rooms[0].kind, "turnover");
  });
  it("combines departing and arriving bookings using the arriving guest counts", () => {
    const depart = row(); depart[5] = "22/Oct/2026"; depart[6] = "23/Oct/2026"; depart[11] = "1/1"; depart[8] = "1";
    const parsed = parseReportPages([page([depart, row()])]);
    assert.equal(parsed.rooms.length, 1); assert.equal(parsed.rooms[0].adults, 2);
    assert.equal(buildSheet(parsed.rooms).rooms[0].kind, "turnover");
  });
  it("reads every page and excludes the ROOS returning-to-service appendix", () => {
    const second = page([row("2")]);
    second.push({ text: "ROOS/DFS returning to service today", x: 0, y: 100 }, { text: "34", x: 0, y: 80 });
    assert.deepEqual(parseReportPages([page([row()]), second]).rooms.map(r => r.room_number), [1, 2]);
  });
  it("rejects missing columns rather than guessing", () => {
    assert.throws(() => parseReportPages([page([row()]).filter(i => i.text !== "Night")]), /Room Status Report/);
  });
  it("rejects conflicting duplicate bookings", () => {
    assert.throws(() => parseReportPages([page([row(), row()])]), /appears twice/);
  });
  it("reads room 48 once when identical booking details repeat across a page break", () => {
    const first = page([row("48")]);
    const second = page([row("48"), row("49")], "KING");
    const parsed = parseReportPages([first, second]);
    assert.deepEqual(parsed.rooms.map(r => r.room_number), [48, 49]);
    assert.equal(parsed.rooms[0].bed, "king");
  });
  it("reads room 4 Dog box and king bed notes even below the row midpoint", () => {
    const p = page([row("3"), row("4"), row("5")]);
    p.push({ text: "Housekeeping Notes", x: 110, y: 610 }, { text: ":", x: 140, y: 610 }, { text: "dog box -", x: 160, y: 610 }, { text: "KING bed", x: 160, y: 595 });
    const parsed = parseReportPages([p]).rooms;
    assert.equal(parsed[1].room_number, 4);
    assert.equal(parsed[1].dog, true);
    assert.equal(parsed[1].bed, "king");
    assert.equal(parsed[1].notes, "box - bed");
    for (const neighbour of [parsed[0], parsed[2]]) {
      assert.equal(neighbour.dog, false);
      assert.equal(neighbour.bed, null);
      assert.equal(neighbour.notes, null);
    }
  });
  it("reads multiple labelled housekeeping notes for one room", () => {
    const p = page([row("4"), row("5")], "dog box -");
    p.push({ text: "Housekeeping Notes", x: 110, y: 635 }, { text: ":", x: 140, y: 635 }, { text: "KING bed", x: 160, y: 635 });
    const parsed = parseReportPages([p]).rooms[0];
    assert.equal(parsed.dog, true);
    assert.equal(parsed.bed, "king");
    assert.equal(parsed.notes, "box - bed");
  });
  it("rejects changed booking details even at a page boundary", () => {
    const changed = row("48"); changed[8] = "3";
    assert.throws(() => parseReportPages([page([row("48")]), page([changed])]), /appears twice/);
  });
  it("applies the same note and page-flow rules to any room, not only 4 and 48", () => {
    const withNotes = page([row("21"), row("22"), row("23")]);
    withNotes.push(
      { text: "Housekeeping Notes", x: 110, y: 612 }, { text: ":", x: 140, y: 612 }, { text: "dog box -", x: 160, y: 612 },
      { text: "Housekeeping Notes", x: 110, y: 600 }, { text: ":", x: 140, y: 600 }, { text: "KING bed", x: 160, y: 600 },
    );
    const flowed = page([row("29"), row("30")]);
    const boundary = page([row("30"), row("31")]);
    boundary.push({ text: "Housekeeping Notes", x: 110, y: 645 }, { text: ":", x: 140, y: 645 }, { text: "TWIN", x: 160, y: 645 });
    const parsed = parseReportPages([withNotes, flowed, boundary]);
    assert.deepEqual(parsed.rooms.map(r => r.room_number), [21, 22, 23, 29, 30, 31]);
    const room22 = parsed.rooms.find(r => r.room_number === 22)!;
    assert.equal(room22.dog, true);
    assert.equal(room22.bed, "king");
    const room30 = parsed.rooms.find(r => r.room_number === 30)!;
    assert.equal(room30.bed, "twin");
    assert.equal(parsed.rooms.find(r => r.room_number === 29)!.bed, null);
    assert.equal(parsed.rooms.find(r => r.room_number === 31)!.bed, null);
  });
});