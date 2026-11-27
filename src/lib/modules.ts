// Modules (Plans/MODULES-calendar-todo-notes.md): optional features a hotel
// turns on, for every department, chosen departments, or single people.
// `personHasModule` mirrors the database's private.has_module (migration 0071),
// so the setup screen can say who has each module. The database decides.
import type { Position, SubRole } from "@/lib/auth.functions";

export const MODULES = ["calendar", "todos", "notes"] as const;
export type ModuleKey = (typeof MODULES)[number];

export const MODULE_DEPARTMENTS = ["housekeeping", "reception", "fnb", "maintenance"] as const;
export type ModuleDepartment = (typeof MODULE_DEPARTMENTS)[number];

export const MODULE_INFO: Record<ModuleKey, { label: string; blurb: string }> = {
  calendar: { label: "Calendar", blurb: "Shared calendars such as Tours, Reception and Orders, in day, week, month, year and list views." },
  todos: { label: "To-dos", blurb: "Personal and department to-do lists. To-dos with a date also show on the calendar." },
  notes: { label: "Notes", blurb: "Notes for yourself, or shared with your department." },
};

export const DEPARTMENT_LABEL: Record<ModuleDepartment, string> = {
  housekeeping: "Housekeeping",
  reception: "Reception",
  fnb: "F&B",
  maintenance: "Maintenance",
};

/** A person's departments, as the module keys (housekeeper → housekeeping). */
export function moduleDepartmentsOf(subRoles: readonly SubRole[]): ModuleDepartment[] {
  return MODULE_DEPARTMENTS.filter((d) => subRoles.includes(d === "housekeeping" ? "housekeeper" : d));
}

/** Admins, regional admins, managers and developers always have every module that's on. */
export function alwaysHasModules(position: Position | undefined): boolean {
  return position === "admin" || position === "regional_admin" || position === "manager" || position === "developer";
}

export type ModuleSetting = {
  enabled: boolean;
  allDepartments: boolean;
  departments: ModuleDepartment[];
  /** Person exceptions: user id → has it (true) or not (false). */
  people: Record<string, boolean>;
};

export const MODULE_OFF: ModuleSetting = { enabled: false, allDepartments: true, departments: [], people: {} };

export function personHasModule(
  setting: ModuleSetting,
  person: { id: string; position: Position | undefined; subRoles: readonly SubRole[] },
): boolean {
  if (!setting.enabled || person.position === "pending" || !person.position) return false;
  if (alwaysHasModules(person.position)) return true;
  const own = setting.people[person.id];
  if (own !== undefined) return own;
  if (setting.allDepartments) return true;
  return moduleDepartmentsOf(person.subRoles).some((d) => setting.departments.includes(d));
}

type Rows = {
  hotel: { module: string; enabled: boolean; all_departments: boolean }[];
  departments: { module: string; department: string }[];
  people: { module: string; user_id: string; allowed: boolean }[];
};

/** Turns the three tables' rows into one setting per module. */
export function moduleSettingsFrom(rows: Rows): Record<ModuleKey, ModuleSetting> {
  const fresh = (): ModuleSetting => ({ ...MODULE_OFF, departments: [], people: {} });
  const out: Record<ModuleKey, ModuleSetting> = { calendar: fresh(), todos: fresh(), notes: fresh() };
  const known = (m: string): m is ModuleKey => (MODULES as readonly string[]).includes(m);
  for (const r of rows.hotel) if (known(r.module)) Object.assign(out[r.module], { enabled: r.enabled, allDepartments: r.all_departments });
  for (const r of rows.departments) {
    if (known(r.module) && (MODULE_DEPARTMENTS as readonly string[]).includes(r.department)) out[r.module].departments.push(r.department as ModuleDepartment);
  }
  for (const r of rows.people) if (known(r.module)) out[r.module].people[r.user_id] = r.allowed;
  return out;
}

/** One line under each module, e.g. "Housekeeping and Reception · 2 exceptions". */
export function moduleSummary(s: ModuleSetting): string {
  if (!s.enabled) return "Off";
  const who = s.allDepartments
    ? "Everyone"
    : s.departments.length
      ? joinAnd(MODULE_DEPARTMENTS.filter((d) => s.departments.includes(d)).map((d) => DEPARTMENT_LABEL[d]))
      : "Managers and admins only";
  const n = Object.keys(s.people).length;
  return n ? `${who} · ${n} ${n === 1 ? "exception" : "exceptions"}` : who;
}

function joinAnd(parts: string[]): string {
  return parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}
