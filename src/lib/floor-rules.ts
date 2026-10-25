export type FloorLocation = { id: string; name: string; cupboard_key: string; sort_order: number };

export function cupboardLocations(floors: FloorLocation[]) {
  return floors.map((floor) => ({ key: floor.cupboard_key, label: floor.name }));
}

export function roomsForFloor(rooms: { room_number: number; floor?: string | null }[], name: string) {
  return rooms.filter((room) => room.floor === name).map((room) => room.room_number);
}