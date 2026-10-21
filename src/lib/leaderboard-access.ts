import type { Position, SubRole } from "@/lib/auth-client";

/** Menu visibility only; data access is enforced by database policies. */
export function canAccessLeaderboard(position: Position | undefined, departments: readonly SubRole[]): boolean {
  return position === "developer" || departments.includes("housekeeper");
}