import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MODULE_OFF, moduleDepartmentsOf, moduleSettingsFrom, moduleSummary, personHasModule, type ModuleSetting } from "./modules";

const on = (s: Partial<ModuleSetting> = {}): ModuleSetting => ({ ...MODULE_OFF, enabled: true, departments: [], people: {}, ...s });
const sam = { id: "sam", position: "user" as const, subRoles: ["reception" as const] };
const jo = { id: "jo", position: "user" as const, subRoles: ["housekeeper" as const, "fnb" as const] };

describe("modules: who has a module", () => {
  it("is off for everyone, managers included, when the hotel has it off", () => {
    assert.equal(personHasModule(MODULE_OFF, sam), false);
    assert.equal(personHasModule(MODULE_OFF, { id: "m", position: "manager", subRoles: [] }), false);
  });
  it("goes to everyone when switched on for all departments", () => {
    assert.equal(personHasModule(on(), sam), true);
    assert.equal(personHasModule(on(), { id: "x", position: "user", subRoles: [] }), true);
  });
  it("goes only to chosen departments; either of a person's departments is enough", () => {
    const s = on({ allDepartments: false, departments: ["fnb"] });
    assert.equal(personHasModule(s, sam), false);
    assert.equal(personHasModule(s, jo), true);
  });
  it("lets a person setting beat the department setting, both ways", () => {
    const s = on({ allDepartments: false, departments: ["reception"], people: { sam: false, jo: true } });
    assert.equal(personHasModule(s, sam), false);
    assert.equal(personHasModule(s, jo), true);
  });
  it("always gives admins, regional admins, managers and developers a module that's on", () => {
    const s = on({ allDepartments: false, departments: [], people: { boss: false } });
    for (const position of ["admin", "regional_admin", "manager", "developer"] as const) {
      assert.equal(personHasModule(s, { id: "boss", position, subRoles: [] }), true);
    }
  });
  it("never gives it to accounts still waiting for approval", () => {
    assert.equal(personHasModule(on({ people: { p: true } }), { id: "p", position: "pending", subRoles: [] }), false);
  });
  it("maps the housekeeper role to the housekeeping department", () => {
    assert.deepEqual(moduleDepartmentsOf(["housekeeper", "maintenance"]), ["housekeeping", "maintenance"]);
  });
});

describe("modules: reading the tables", () => {
  it("builds one setting per module, ignoring unknown rows", () => {
    const s = moduleSettingsFrom({
      hotel: [{ module: "notes", enabled: true, all_departments: false }, { module: "games", enabled: true, all_departments: true }],
      departments: [{ module: "notes", department: "reception" }, { module: "notes", department: "spa" }],
      people: [{ module: "notes", user_id: "jo", allowed: true }],
    });
    assert.deepEqual(s.notes, { enabled: true, allDepartments: false, departments: ["reception"], people: { jo: true } });
    assert.deepEqual(s.calendar, MODULE_OFF);
    assert.equal(s.calendar === MODULE_OFF, false);
  });
  it("summarises who has it", () => {
    assert.equal(moduleSummary(MODULE_OFF), "Off");
    assert.equal(moduleSummary(on()), "Everyone");
    assert.equal(moduleSummary(on({ allDepartments: false, departments: ["reception", "housekeeping"] })), "Housekeeping and Reception");
    assert.equal(moduleSummary(on({ allDepartments: false })), "Managers and admins only");
    assert.equal(moduleSummary(on({ people: { a: true } })), "Everyone · 1 exception");
  });
});
