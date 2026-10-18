import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canStartHomeRefresh, isRefreshPull, shouldRefreshHome } from "./home-refresh";

describe("Home pull to refresh", () => {
  it("allows mobile Home at the top", () => {
    assert.equal(canStartHomeRefresh(true, true, 0, false), true);
  });
  it("does not refresh other screens or desktop", () => {
    assert.equal(canStartHomeRefresh(true, false, 0, false), false);
    assert.equal(canStartHomeRefresh(false, true, 0, false), false);
  });
  it("does not refresh partway down the page or while already syncing", () => {
    assert.equal(canStartHomeRefresh(true, true, 120, false), false);
    assert.equal(canStartHomeRefresh(true, true, 0, true), false);
  });
  it("ignores sideways swipes and upward scrolling", () => {
    assert.equal(isRefreshPull(100, 20), false);
    assert.equal(isRefreshPull(0, -100), false);
    assert.equal(isRefreshPull(4, 100), true);
  });
  it("only syncs a deliberate pull", () => {
    assert.equal(shouldRefreshHome(20), false);
    assert.equal(shouldRefreshHome(80), true);
  });
});