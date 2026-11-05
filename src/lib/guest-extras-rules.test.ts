import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extrasForRoom, quantityFor, roomJob, type GuestExtra, type GuestExtraRule } from "./guest-extras-rules";

const rule = (p: Partial<GuestExtraRule>): GuestExtraRule => ({
  id: "r", extra_id: "water", room_types: [], room_features: [], except_features: [], flags: [], note_words: [],
  applies_to: "arrival", quantities: [1], extra_per_guest: 0, sort_order: 0, ...p,
});
const water: GuestExtra = { id: "water", name: "Water", icon: null, kind: "leave", sort_order: 0 };
const remote: GuestExtra = { id: "remote", name: "TV remote", icon: null, kind: "check", sort_order: 1 };
const room = (p: Partial<Parameters<typeof extrasForRoom>[2]> = {}) => ({
  job: "arrival" as const, roomTypes: [], featureIds: [], flagKeysOn: [], note: null, guests: 2, done: [], ...p,
});

describe("room checklist rules", () => {
  it("uses the quantity for the guest count, then adds per extra guest", () => {
    const r = rule({ quantities: [1, 2], extra_per_guest: 1 });
    assert.equal(quantityFor(r, 1), 1);
    assert.equal(quantityFor(r, 4), 4);
  });
  it("takes the job from paperwork first, then the status", () => {
    assert.equal(roomJob("turnover", "dirty"), "arrival");
    assert.equal(roomJob("departure", "arrival"), null);
    assert.equal(roomJob(null, "Stay-over"), "stayover");
    assert.equal(roomJob(null, "clean"), null);
  });
  it("'any' rules apply with no job, 'both' needs a job", () => {
    const extras = [remote];
    assert.equal(extrasForRoom(extras, [rule({ extra_id: "remote", applies_to: "any" })], room({ job: null })).length, 1);
    assert.equal(extrasForRoom(extras, [rule({ extra_id: "remote", applies_to: "both" })], room({ job: null })).length, 0);
  });
  it("checks are always 1 and listed before extras", () => {
    const needs = extrasForRoom([water, remote], [rule({ quantities: [3] }), rule({ extra_id: "remote", quantities: [5] })], room());
    assert.deepEqual(needs.map((n) => [n.extra.id, n.quantity]), [["remote", 1], ["water", 3]]);
  });
  it("except features exclude a room, the most specific rule wins", () => {
    const rules = [rule({ id: "a", quantities: [1] }), rule({ id: "b", note_words: ["Anniversary"], quantities: [4] })];
    assert.equal(extrasForRoom([water], rules, room({ note: "anniversary trip", guests: 1 }))[0].quantity, 4);
    assert.equal(extrasForRoom([water], [rule({ except_features: ["f1"] })], room({ featureIds: ["f1"] })).length, 0);
  });
  it("no guest count counts as 1", () => {
    assert.equal(extrasForRoom([water], [rule({ quantities: [1, 2] })], room({ guests: null }))[0].quantity, 1);
  });
});
