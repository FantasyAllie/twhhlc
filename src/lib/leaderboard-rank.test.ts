import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rankCategory } from "./leaderboard-rank";

describe("leaderboard ranking", () => {
  it("ranks most categories highest first", () => {
    const tally = { linen_counted: new Map([["Ann", 3], ["Bo", 9]]) };
    assert.deepEqual(rankCategory("linen_counted", tally), [["Bo", 9], ["Ann", 3]]);
  });
  it("ranks fewest rooms marked dirty among everyone who cleaned, 0 included", () => {
    const tally = {
      room_clean: new Map([["Ann", 10], ["Bo", 4], ["Cy", 12]]),
      room_dirty: new Map([["Ann", 2], ["Dee", 1]]),
    };
    // Bo and Cy marked none dirty; Cy cleaned more so wins the tie. Dee never cleaned, so isn't ranked.
    assert.deepEqual(rankCategory("room_dirty", tally), [["Cy", 0], ["Bo", 0], ["Ann", 2]]);
  });
  it("has no one when nobody cleaned", () => {
    assert.deepEqual(rankCategory("room_dirty", { room_dirty: new Map([["Ann", 1]]) }), []);
  });
});
