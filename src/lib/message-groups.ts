export const MESSAGE_GROUPS = ["housekeeping", "reception", "fnb", "maintenance"] as const;
export type MessageGroup = (typeof MESSAGE_GROUPS)[number];
export const MESSAGE_GROUP_LABELS: Record<MessageGroup, string> = {
  housekeeping: "Housekeeping", reception: "Reception", fnb: "F&B", maintenance: "Maintenance",
};
export function availableMessageGroups(departments: readonly string[], elevated = false): MessageGroup[] {
  return MESSAGE_GROUPS.filter(group => elevated || group === "reception" || departments.includes(group));
}
export function legacyMessageGroup(thread: string): MessageGroup {
  if (thread.includes("reception")) return "reception";
  if (thread.includes("maintenance")) return "maintenance";
  return "housekeeping";
}