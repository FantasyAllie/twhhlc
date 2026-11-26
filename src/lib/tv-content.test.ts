import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { departureLabel, everyHour, nextDepartures, timetableWindow, toMinutes, weatherLabel } from "./tv-content";

describe("lobby TV rules", () => {
  test("hourly times stop at midnight", () => {
    assert.deepEqual(everyHour("22:46", 3), ["22:46", "23:46"]);
    assert.deepEqual(everyHour("08:20", 2, 90), ["08:20", "09:50"]);
  });

  test("timetable window keeps the last bus gone, then the next in gold", () => {
    const times = everyHour("07:46", 12);
    const row = timetableWindow(times, toMinutes("10:42"));
    assert.deepEqual(row.map((t) => t.at), ["09:46", "10:46", "11:46", "12:46", "13:46", "14:46"]);
    assert.deepEqual(row.map((t) => t.state), ["gone", "next", "later", "later", "later", "later"]);
  });

  test("timetable window before the first bus and after the last", () => {
    const times = ["08:00", "09:00", "10:00"];
    assert.deepEqual(timetableWindow(times, toMinutes("06:00")).map((t) => t.state), ["next", "later", "later"]);
    assert.deepEqual(timetableWindow(times, toMinutes("23:00")).map((t) => t.state), ["gone", "gone", "gone"]);
  });

  test("departure labels", () => {
    assert.equal(departureLabel("10:46", toMinutes("10:42")), "4 min");
    assert.equal(departureLabel("10:42", toMinutes("10:42")), "Due");
    assert.equal(departureLabel("11:52", toMinutes("10:42")), "11:52");
  });

  test("next departures are soonest first, at most four", () => {
    const page = nextDepartures(toMinutes("10:42"));
    assert.equal(page.rows.length, 4);
    assert.equal(page.rows[0].time, "4 min");
    assert.equal(nextDepartures(toMinutes("23:59")).rows.length, 0);
  });

  test("weather codes in plain words", () => {
    assert.equal(weatherLabel(0), "Clear");
    assert.equal(weatherLabel(61), "Light rain");
    assert.equal(weatherLabel(81), "Showers");
  });
});
