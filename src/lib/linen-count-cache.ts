import type { RoomCount } from "./app-types";

/** Preserve a successful linen write in the cache before its overlay expires. */
export function cacheSavedRoomCount(
  old: RoomCount[] | undefined,
  room: number,
  kind: "template" | "extra",
  itemId: string,
  value: number,
): RoomCount[] {
  const list = [...(old ?? [])];
  const idx = list.findIndex((c) => c.room_number === room && c.item_kind === kind && c.item_id === itemId);
  if (idx >= 0) list[idx] = { ...list[idx], count: value };
  else list.push({ id: `saved-${room}-${kind}-${itemId}`, room_number: room, item_kind: kind, item_id: itemId, count: value });
  return list;
}