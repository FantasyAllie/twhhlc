export function shouldShowDepartmentTab(department: string | undefined, assignedDepartments: readonly string[]) {
  if (department === undefined) return true;
  // Hide a department's tab only when that department is the user's sole
  // assignment; users with several departments keep the shortcut tab.
  return !(assignedDepartments.length === 1 && assignedDepartments[0] === department);
}
