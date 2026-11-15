import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEVELOPER_TEST_ONLY, developerScopeError, isDeveloperViewOnly } from "./developer-scope";

const live = { developer_only: false };
const test = { developer_only: true };

describe("developer scope", () => {
  it("leaves everyone else alone", () => {
    assert.equal(developerScopeError(false, [live], { isDeveloper: false }), null);
  });
  it("lets a developer change test hotels and developer accounts", () => {
    assert.equal(developerScopeError(true, [test]), null);
    assert.equal(developerScopeError(true, [test], { isDeveloper: true }), null);
  });
  it("stops a developer touching a live hotel or a live account", () => {
    assert.equal(developerScopeError(true, [test, live]), DEVELOPER_TEST_ONLY);
    assert.equal(developerScopeError(true, [test], { isDeveloper: false }), DEVELOPER_TEST_ONLY);
  });
  it("makes live hotels view-only for developers only", () => {
    assert.equal(isDeveloperViewOnly("developer", false), true);
    assert.equal(isDeveloperViewOnly("developer", undefined), true);
    assert.equal(isDeveloperViewOnly("developer", true), false);
    assert.equal(isDeveloperViewOnly("admin", false), false);
  });
});
