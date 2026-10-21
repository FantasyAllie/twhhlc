import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canAccessLeaderboard } from "./leaderboard-access";

describe("leaderboard access", () => {
  it("allows anyone assigned Housekeeping regardless of position or other departments", () => {
    for (const position of ["user", "manager", "admin", "regional_admin"] as const) {
      assert.equal(canAccessLeaderboard(position, ["housekeeper"]), true);
      assert.equal(canAccessLeaderboard(position, ["reception", "housekeeper", "maintenance"]), true);
    }
  });
  it("does not expose the leaderboard to other departments without Housekeeping", () => {
    assert.equal(canAccessLeaderboard("user", ["reception", "fnb", "maintenance"]), false);
    assert.equal(canAccessLeaderboard("admin", []), false);
    assert.equal(canAccessLeaderboard(undefined, []), false);
  });
  it("preserves developer access in the new menu location", () => {
    assert.equal(canAccessLeaderboard("developer", []), true);
  });
});