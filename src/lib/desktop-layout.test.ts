import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanFirst, fixFirst, liveFeed, liveTime, upNext } from "./desktop-layout";
import type { ListRoom } from "./home-list";

const room = (n: number, extra: Partial<ListRoom> = {}): ListRoom => ({
  n, done: false, neverServiced: false, notRequired: false, stayover: false, ...extra,
});

describe("up next", () => {
  it("lists early check-ins and late checkouts first, then arrivals by room number", () => {
    const rooms = [
      room(9, { sheetKind: "arrival" }), room(4, { sheetKind: "turnover" }),
      room(20, { firstUp: true, sheetKind: "turnover" }), room(14, { firstUp: true, sheetKind: "arrival" }),
    ];
    assert.deepEqual(upNext(rooms).map((r) => r.n), [14, 20, 4, 9]);
  });

  it("leaves out rooms nobody is arriving in", () => {
    const rooms = [room(1, { sheetKind: "departure" }), room(2, { sheetKind: "stayover" }), room(3), room(5, { sheetKind: "arrival" })];
    assert.deepEqual(upNext(rooms).map((r) => r.n), [5]);
  });

  it("drops rooms once they're done, and DND, Staff/ROS and not required rooms", () => {
    const rooms = [
      room(1, { sheetKind: "arrival", done: true }), room(2, { firstUp: true, neverServiced: true }),
      room(3, { sheetKind: "arrival", notRequired: true }), room(4, { firstUp: true, dnd: true }),
      room(6, { firstUp: true }),
    ];
    assert.deepEqual(upNext(rooms).map((r) => r.n), [6]);
  });
});

describe("clean first", () => {
  it("puts early/late first, then turnovers, arrivals and stayovers, each by room number", () => {
    const rooms = [
      room(2, { sheetKind: "stayover" }), room(9, { sheetKind: "arrival" }), room(7, { sheetKind: "turnover" }),
      room(3, { sheetKind: "turnover" }), room(30, { firstUp: true, sheetKind: "stayover" }), room(1, { sheetKind: "stayover" }),
    ];
    assert.deepEqual(cleanFirst(rooms).map((r) => r.n), [30, 3, 7, 9, 1, 2]);
  });

  it("leaves out departures with nobody arriving, and rooms already done or DND", () => {
    const rooms = [
      room(1, { sheetKind: "departure" }), room(2), room(3, { sheetKind: "turnover", done: true }),
      room(4, { sheetKind: "stayover", dnd: true }), room(5, { sheetKind: "stayover" }),
    ];
    assert.deepEqual(cleanFirst(rooms).map((r) => r.n), [5]);
  });
});

describe("fix first", () => {
  const job = (id: string, room_number: number | null, extra: { urgent?: boolean; done?: boolean } = {}) =>
    ({ id, room_number, done: false, ...extra });

  it("lists urgent jobs first, then jobs in rooms a guest is due in, by room number", () => {
    const jobs = [job("a", 30), job("b", null, { urgent: true }), job("c", 12), job("d", 40, { urgent: true })];
    assert.deepEqual(fixFirst(jobs, new Set([12, 30])).map((j) => j.id), ["d", "b", "c", "a"]);
  });

  it("leaves out finished jobs and jobs nobody is waiting on", () => {
    const jobs = [job("a", 5, { urgent: true, done: true }), job("b", 6), job("c", 7)];
    assert.deepEqual(fixFirst(jobs, new Set([7])).map((j) => j.id), ["c"]);
  });
});

describe("live", () => {
  const item = (id: string, created_at: string) => ({ id, kind: "message" as const, created_at, title: id, detail: "" });

  it("shows the newest four, newest first", () => {
    const items = ["01", "05", "03", "02", "04"].map((d) => item(d, `2026-11-${d}T10:00:00Z`));
    assert.deepEqual(liveFeed(items).map((i) => i.id), ["05", "04", "03", "02"]);
  });

  it("gives today's times as hours and minutes, older ones as a day", () => {
    const now = new Date(2026, 10, 21, 18, 0);
    assert.equal(liveTime(new Date(2026, 10, 21, 9, 5).toISOString(), now), "09:05");
    assert.equal(liveTime(new Date(2026, 10, 20, 9, 5).toISOString(), now), "Fri");
    assert.equal(liveTime(new Date(2026, 10, 2, 9, 5).toISOString(), now), "2 Nov");
  });
});
