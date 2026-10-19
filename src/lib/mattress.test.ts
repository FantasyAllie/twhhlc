import { describe, expect, it } from "vitest";
import { isMattressDue } from "./mattress";

describe("mattress flip due", () => {
  const now = new Date("2026-10-19T12:00:00Z");
  it("is never due when the room doesn't track flips", () => {
    expect(isMattressDue({ mattress_tracking: false, mattress_flipped_at: null }, now)).toBe(false);
  });
  it("is due when tracked but never flipped", () => {
    expect(isMattressDue({ mattress_tracking: true, mattress_flipped_at: null, mattress_interval_months: 3 }, now)).toBe(true);
  });
  it("is not due within 3 months of the last flip", () => {
    expect(isMattressDue({ mattress_tracking: true, mattress_flipped_at: "2026-08-01T12:00:00Z", mattress_interval_months: 3 }, now)).toBe(false);
  });
  it("is due once 3 months have passed", () => {
    expect(isMattressDue({ mattress_tracking: true, mattress_flipped_at: "2026-07-18T12:00:00Z", mattress_interval_months: 3 }, now)).toBe(true);
  });
  it("respects an edited interval", () => {
    expect(isMattressDue({ mattress_tracking: true, mattress_flipped_at: "2026-07-18T12:00:00Z", mattress_interval_months: 6 }, now)).toBe(false);
  });
});
