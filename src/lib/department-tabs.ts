export function shouldShowDepartmentTab(department: string | undefined, assignedDepartments: readonly string[]) {
  return department === undefined || !assignedDepartments.includes(department);
}