import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { defaultSettings, initialsOf, normalizeSettings, parseTimes, playerContent } from "./tv-settings";

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

  test("hotel initials skip small words", () => {
    assert.equal(initialsOf("Three Ways House Hotel"), "TW");
    assert.equal(initialsOf("Development Hotel"), "DH");
    assert.equal(initialsOf("The Lygon Arms"), "LA");
  });
});
