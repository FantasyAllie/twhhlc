import { describe, it, expect } from "vitest";
import { extrasForRoom, jobForSheetKind, quantityFor, type GuestExtraRule } from "./guest-extras-rules";

const rule = (p: Partial<GuestExtraRule>): GuestExtraRule => ({
  id: "r", extra_id: "water", room_types: [], applies_to: "arrival", quantities: [1], extra_per_guest: 0, sort_order: 0, ...p,
});
const water = { id: "water", name: "Water", icon: null, sort_order: 0 };

describe("guest extras", () => {
  it("uses the quantity for the guest count, then adds per extra guest", () => {
    const r = rule({ quantities: [1, 2], extra_per_guest: 1 });
    expect(quantityFor(r, 1)).toBe(1);
    expect(quantityFor(r, 2)).toBe(2);
    expect(quantityFor(r, 4)).toBe(4);
  });
  it("departures need no extras, no paperwork counts as arrival", () => {
    expect(jobForSheetKind("departure")).toBeNull();
    expect(jobForSheetKind(null)).toBe("arrival");
    expect(jobForSheetKind("turnover")).toBe("arrival");
  });
  it("only applies rules for the room type and job", () => {
    const rules = [rule({ room_types: ["suite"], applies_to: "stayover" })];
    expect(extrasForRoom([water], rules, { job: "stayover", roomTypes: ["Suite"], guests: 2 })).toHaveLength(1);
    expect(extrasForRoom([water], rules, { job: "arrival", roomTypes: ["suite"], guests: 2 })).toHaveLength(0);
    expect(extrasForRoom([water], rules, { job: "stayover", roomTypes: ["double"], guests: 2 })).toHaveLength(0);
  });
});
