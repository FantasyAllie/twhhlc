import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { availableMessageGroups, legacyMessageGroup } from "./message-groups";

describe("department group access", () => {
  it("everyone can access Reception", () => {
    assert.deepEqual(availableMessageGroups([]), ["reception"]);
  });
  it("staff only access their assigned groups plus Reception", () => {
    assert.deepEqual(availableMessageGroups(["fnb"]), ["reception", "fnb"]);
    assert.deepEqual(availableMessageGroups(["maintenance"]), ["reception", "maintenance"]);
    assert.deepEqual(availableMessageGroups(["housekeeping", "fnb"]), ["housekeeping", "reception", "fnb"]);
  });
  it("admins and managers retain all groups", () => {
    assert.deepEqual(availableMessageGroups([], true), ["housekeeping", "reception", "fnb", "maintenance"]);
  });
  it("preserves old messages in their destination groups", () => {
    assert.equal(legacyMessageGroup("hk_reception"), "reception");
    assert.equal(legacyMessageGroup("hk_maintenance"), "maintenance");
  });
});