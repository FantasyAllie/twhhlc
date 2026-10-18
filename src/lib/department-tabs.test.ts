import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shouldShowDepartmentTab } from "./department-tabs";

describe("department navigation", () => {
  it("maintenance-only users see Home, Messages, Lost Property and More", () => {
    const tabs = [
      { key: "home" }, { key: "messages" },
      { key: "maintenance", department: "maintenance" },
      { key: "lost" }, { key: "more" },
    ];
    assert.deepEqual(tabs.filter(t => shouldShowDepartmentTab(t.department, ["maintenance"])).map(t => t.key), ["home", "messages", "lost", "more"]);
  });
  it("multi-department users keep every department tab, including maintenance", () => {
    assert.equal(shouldShowDepartmentTab("maintenance", ["fnb", "maintenance"]), true);
    assert.equal(shouldShowDepartmentTab("fnb", ["fnb", "maintenance"]), true);
  });
  it("solely-assigned departments still have their tab omitted", () => {
    assert.equal(shouldShowDepartmentTab("fnb", ["fnb"]), false);
    assert.equal(shouldShowDepartmentTab("maintenance", ["maintenance"]), false);
    assert.equal(shouldShowDepartmentTab("reception", ["housekeeping"]), true);
    assert.equal(shouldShowDepartmentTab(undefined, ["maintenance"]), true);
  });
});
