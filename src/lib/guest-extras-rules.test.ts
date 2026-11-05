import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extrasForRoom, jobForSheetKind, quantityFor, type GuestExtraRule } from "./guest-extras-rules";

const rule = (p: Partial<GuestExtraRule>): GuestExtraRule => ({
  id: "r", extra_id: "water", room_types: [], applies_to: "arrival", quantities: [1], extra_per_guest: 0, sort_order: 0, ...p,
});
const water = { id: "water", name: "Water", icon: null, sort_order: 0 };

describe("guest extras", () => {
  it("uses the quantity for the guest count, then adds per extra guest", () => {
    const r = rule({ quantities: [1, 2], extra_per_guest: 1 });
    assert.equal(quantityFor(r, 1), 1);
    assert.equal(quantityFor(r, 2), 2);
    assert.equal(quantityFor(r, 4), 4);
  });
  it("departures need no extras, no paperwork counts as arrival", () => {
    assert.equal(jobForSheetKind("departure"), null);
    assert.equal(jobForSheetKind(null), "arrival");
    assert.equal(jobForSheetKind("turnover"), "arrival");
  });
  it("only applies rules for the room type and job", () => {
    const rules = [rule({ room_types: ["suite"], applies_to: "stayover" })];
    assert.equal((extrasForRoom([water], rules, { job: "stayover", roomTypes: ["Suite"], guests: 2 })).length, 1);
    assert.equal((extrasForRoom([water], rules, { job: "arrival", roomTypes: ["suite"], guests: 2 })).length, 0);
    assert.equal((extrasForRoom([water], rules, { job: "stayover", roomTypes: ["double"], guests: 2 })).length, 0);
  });
});
