import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { defaultSettings, initialsOf, normalizeSettings, parseTimes, playerContent, savable } from "./tv-settings";

const url = (p: string) => `https://cdn.example/${p}`;

describe("lobby screen settings", () => {
  test("typed times are tidied, sorted and deduplicated", () => {
    assert.deepEqual(parseTimes("9.46, 07:46 8:46; 07:46 25:00 noon"), ["07:46", "08:46", "09:46"]);
  });

  test("a hotel with no saved row gets editable examples", () => {
    const s = normalizeSettings("h1", null);
    assert.equal(s.hotel_id, "h1");
    assert.ok(s.info_cards.some((c) => c.title === "Checking in and out"));
  });

  test("odd stored values don't break the screen", () => {
    const s = normalizeSettings("h1", { welcome: 5, bus_timetable: [{ route: "1", to: "X", times: ["10:00", "bad", 3] }, "junk"], latitude: "52" });
    assert.equal(s.welcome, "");
    assert.deepEqual(s.bus_timetable[0].times, ["10:00"]);
    assert.equal(s.bus_timetable.length, 1);
    assert.equal(s.latitude, null);
  });

  test("the screen shows only filled-in, switched-on items", () => {
    const s = defaultSettings("h1");
    s.logo_path = "h1/logo.png";
    s.notices = [{ id: "a", tag: "", text: "Jazz tonight", show: true }, { id: "b", tag: "X", text: "Hidden", show: false }];
    const c = playerContent(s, "Three Ways House Hotel", url);
    assert.equal(c.logoUrl, "https://cdn.example/h1/logo.png");
    // Wi-Fi has no values yet and the special and offers are switched off.
    assert.deepEqual(c.info.map((i) => i.title), ["Checking in and out", "Dining today"]);
    assert.deepEqual(c.notices, [{ tag: "Notice", text: "Jazz tonight" }]);
    assert.equal(c.demo, false);
  });

  test("BODS times replace typed ones for the day they cover", () => {
    const s = normalizeSettings("h1", {
      bus_timetable: [{ id: "x", route: "9", to: "Typed", times: ["10:00"] }],
      bus_timetable_auto: {
        generated_at: "2026-11-27T06:50:00Z",
        stops: [{ code: "1600A", name: "Village Hall" }],
        days: [{ date: "2026-11-27", routes: [{ route: "1", to: "Stratford", times: ["07:06", "bad"] }] }],
        error: null,
      },
    });
    const today = playerContent(s, "H", url, "2026-11-27");
    assert.deepEqual(today.timetable, [{ route: "1", to: "Stratford", times: ["07:06"] }]);
    assert.equal(today.timetableFrom, "Village Hall");
    // A day the job didn't cover falls back to the typed timetable.
    const later = playerContent(s, "H", url, "2026-12-05");
    assert.equal(later.timetable[0].to, "Typed");
    assert.equal(later.timetableFrom, null);
    // Saving from the page never touches the job's column.
    assert.ok(!("bus_timetable_auto" in savable(s)));
  });

  test("hotel initials skip small words", () => {
    assert.equal(initialsOf("Three Ways House Hotel"), "TW");
    assert.equal(initialsOf("Development Hotel"), "DH");
    assert.equal(initialsOf("The Lygon Arms"), "LA");
  });
});
