/**
 * Developer accounts are for test hotels: on a developer-only hotel they can
 * change anything, on a live hotel they can look but not change. The database
 * enforces this for the app (migration 0061); the server functions that write
 * with full rights check it here.
 */
export const DEVELOPER_TEST_ONLY = "Developer accounts can only change test hotels";

/** True when the screen should be view-only: a developer looking at a live hotel. */
export function isDeveloperViewOnly(position: string | undefined | null, hotelDeveloperOnly: boolean | undefined | null): boolean {
  return position === "developer" && hotelDeveloperOnly !== true;
}

/**
 * Why a developer may not make this change, or null when they may.
 * `hotels` are every hotel the change touches; `target` is the account being
 * changed, if any (only developer accounts live in test hotels).
 */
export function developerScopeError(
  callerIsDeveloper: boolean,
  hotels: ReadonlyArray<{ developer_only: boolean }>,
  target?: { isDeveloper: boolean },
): string | null {
  if (!callerIsDeveloper) return null;
  if (hotels.some((h) => !h.developer_only)) return DEVELOPER_TEST_ONLY;
  if (target && !target.isDeveloper) return DEVELOPER_TEST_ONLY;
  return null;
}
