// Pure formatting/label helpers for the operational app screen.
// Extracted from src/routes/app.tsx (stage 1 of the staged refactor).
import type { Category, ItemColor, RoomType } from "./app-types";

export const parseCats = (c: string | null | undefined): Category[] =>
  (c ?? "").split(",").map((s) => s.trim()).filter(Boolean);

export const categoryLabel = (c: Category | null | undefined, types: RoomType[]) => {
  const vals = parseCats(c);
  if (vals.length === 0) return "Uncategorised";
  return vals.map((v) => types.find((t) => t.value === v)?.label ?? v).join(" / ");
};

export const valueFromLabel = (label: string): Category =>
  label.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

export const COLOR_SWATCHES: Record<
  ItemColor,
  { bg: string; darkBg: string; border: string; solid: string; label: string }
> = {
  green: { bg: "#dcfce7", darkBg: "#14532d", border: "#86efac", solid: "#22c55e", label: "Green" },
  yellow: { bg: "#fef9c3", darkBg: "#713f12", border: "#fde047", solid: "#eab308", label: "Yellow" },
  red: { bg: "#fee2e2", darkBg: "#7f1d1d", border: "#fca5a5", solid: "#ef4444", label: "Red" },
  blue: { bg: "#dbeafe", darkBg: "#1e3a8a", border: "#93c5fd", solid: "#3b82f6", label: "Blue" },
};

// Where a maintenance request was logged: a room number, or a configured
// hotel area (lobby, kitchen, car park...) when no room applies.
export const maintenanceLocation = (m: {
  room_number: number | null;
  area_label?: string | null;
}) => (m.room_number != null ? `Room ${m.room_number}` : (m.area_label || "Hotel"));
