// Suggested floor label for a room number, used when a room is added and as
// the placeholder in the room editor. The label is editable per room; this is
// only the starting point.
export const floorForRoom = (n: number): string => {
  if (n < 20) return "Ground Floor";
  if (n < 30) return "20's";
  if (n < 40) return "30's";
  if (n < 50) return "40's";
  return `Floor ${Math.floor(n / 10)}`;
};
