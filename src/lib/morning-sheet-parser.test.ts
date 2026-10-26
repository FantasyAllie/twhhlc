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
});