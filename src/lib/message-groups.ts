/** The department chats, kept for older messages. Everyone now uses the one hotel chat. */
export const MESSAGE_GROUPS = ["housekeeping", "reception", "fnb", "maintenance"] as const;
/** "hotel" is the one chat for the whole hotel; every approved member can use it. */
export type MessageGroup = (typeof MESSAGE_GROUPS)[number] | "hotel";
export const HOTEL_CHAT: MessageGroup = "hotel";
export const HOUSEKEEPING_ROOM_MESSAGE_GROUP: MessageGroup = "housekeeping";
export function isHousekeepingRoomMessage(message: { group_key?: string | null; created_by_role?: string | null }) {
  return message.group_key === HOUSEKEEPING_ROOM_MESSAGE_GROUP ||
    (message.group_key === "reception" && message.created_by_role === "reception");
}
export const MESSAGE_GROUP_LABELS: Record<MessageGroup, string> = {
  housekeeping: "Housekeeping", reception: "Reception", fnb: "F&B", maintenance: "Maintenance", hotel: "Hotel chat",
};
export function availableMessageGroups(departments: readonly string[], elevated = false): (typeof MESSAGE_GROUPS)[number][] {
  return MESSAGE_GROUPS.filter(group => elevated || group === "reception" || departments.includes(group));
}
export function legacyMessageGroup(thread: string): MessageGroup {
  if (thread.includes("reception")) return "reception";
  if (thread.includes("maintenance")) return "maintenance";
  return "housekeeping";
}