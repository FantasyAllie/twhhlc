export type RoomTab = "status" | "linen" | "edit" | "hub";

export function toggleRoomTab(current: RoomTab | null, pressed: RoomTab): RoomTab | null {
  return current === pressed ? null : pressed;
}

export function roomTileAction(openRoom: number | null, pressedRoom: number): "close" | "open" {
  return openRoom === pressedRoom ? "close" : "open";
}