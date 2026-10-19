import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isMattressDue } from "./mattress";

describe("mattress flip due", () => {
  const now = new Date("2026-10-19T12:00:00Z");
  it("is never due when the room doesn't track flips", () => {
    assert.equal(isMattressDue({ mattress_tracking: false, mattress_flipped_at: null }, now), false);
  });
  it("is due when tracked but never flipped", () => {
    assert.equal(isMattressDue({ mattress_tracking: true, mattress_flipped_at: null, mattress_interval_months: 3 }, now), true);
  });
  it("is not due within 3 months of the last flip", () => {
    assert.equal(isMattressDue({ mattress_tracking: true, mattress_flipped_at: "2026-08-01T12:00:00Z", mattress_interval_months: 3 }, now), false);
  });
  it("is due once 3 months have passed", () => {
    assert.equal(isMattressDue({ mattress_tracking: true, mattress_flipped_at: "2026-07-18T12:00:00Z", mattress_interval_months: 3 }, now), true);
  });
  it("respects an edited interval", () => {
    assert.equal(isMattressDue({ mattress_tracking: true, mattress_flipped_at: "2026-07-18T12:00:00Z", mattress_interval_months: 6 }, now), false);
  });
});
