// Configurable "Guest & room info" flags. Built-in flags map to room columns
// and keep their special behaviour; custom flags are stored per room in
// room_custom_flags and only show a badge until Reset all.
import { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DoorOpen, Clock, Footprints, Dog, Flag, Baby, Accessibility, Bell, Star, Gift, Heart,
  Key, Luggage, Sparkles, AlertTriangle, Cake, Utensils, Bed, Coffee, Wine, Car, Wifi,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Room } from "@/lib/app-types";

export const FLAG_ICONS: Record<string, LucideIcon> = {
  "door-open": DoorOpen, clock: Clock, footprints: Footprints, dog: Dog, flag: Flag,
  baby: Baby, accessibility: Accessibility, bell: Bell, star: Star, gift: Gift,
  heart: Heart, key: Key, luggage: Luggage, sparkles: Sparkles, alert: AlertTriangle,
  cake: Cake, utensils: Utensils, bed: Bed, coffee: Coffee, wine: Wine, car: Car, wifi: Wifi,
};

// Pastel flag colours — room status colours are the only loud colour on screen.
export const FLAG_COLORS: Record<string, { text: string; badge: string; label: string }> = {
  emerald: { text: "text-emerald-600 dark:text-emerald-400", badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200", label: "Green" },
  amber: { text: "text-amber-600 dark:text-amber-400", badge: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200", label: "Amber" },
  red: { text: "text-red-700 dark:text-red-400", badge: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200", label: "Red" },
  sky: { text: "text-sky-600 dark:text-sky-400", badge: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200", label: "Blue" },
  violet: { text: "text-violet-600 dark:text-violet-400", badge: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200", label: "Violet" },
  pink: { text: "text-pink-600 dark:text-pink-400", badge: "bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-200", label: "Pink" },
  slate: { text: "text-slate-600 dark:text-slate-300", badge: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200", label: "Grey" },
};

export type BuiltinFlagKey = "guest_vacated" | "early_check_in" | "late_checkout" | "stayover_out" | "dog_box";

export const BUILTIN_FLAGS: { key: BuiltinFlagKey; label: string; icon: string; color: string }[] = [
  { key: "guest_vacated", label: "Guest has checked out", icon: "door-open", color: "emerald" },
  { key: "early_check_in", label: "Early check-in", icon: "clock", color: "amber" },
  { key: "late_checkout", label: "Late checkout", icon: "clock", color: "red" },
  { key: "stayover_out", label: "Stayover — guest out", icon: "footprints", color: "sky" },
  { key: "dog_box", label: "Dog", icon: "dog", color: "violet" },
];

export type FlagSettingRow = {
  id: string; key: string; label: string; icon: string; color: string;
  hidden: boolean; is_custom: boolean; sort_order: number;
};

export type FlagDef = {
  key: string; label: string; icon: string; color: string;
  hidden: boolean; custom: boolean; sort: number; settingId?: string;
};

export type CustomFlagRow = { id: string; room_number: number; flag_key: string };

export const useFlagSettingsQuery = () =>
  useQuery({
    queryKey: ["room_flag_settings"],
    queryFn: async (): Promise<FlagSettingRow[]> => {
      const { data, error } = await supabase
        .from("room_flag_settings" as never)
        .select("id,key,label,icon,color,hidden,is_custom,sort_order");
      if (error) throw error;
      return (data ?? []) as FlagSettingRow[];
    },
  });

export const useCustomFlagsQuery = () =>
  useQuery({
    queryKey: ["room_custom_flags"],
    queryFn: async (): Promise<CustomFlagRow[]> => {
      const { data, error } = await supabase
        .from("room_custom_flags" as never)
        .select("id,room_number,flag_key");
      if (error) throw error;
      return (data ?? []) as CustomFlagRow[];
    },
  });

export function mergeFlagDefs(rows: FlagSettingRow[]): FlagDef[] {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const out: FlagDef[] = BUILTIN_FLAGS.map((b, i) => {
    const r = byKey.get(b.key);
    return {
      key: b.key,
      label: r?.label || b.label,
      icon: r?.icon || b.icon,
      color: r?.color || b.color,
      hidden: r?.hidden ?? false,
      custom: false,
      sort: r?.sort_order ?? i,
      settingId: r?.id,
    };
  });
  rows.filter((r) => r.is_custom).forEach((r) =>
    out.push({ key: r.key, label: r.label, icon: r.icon, color: r.color, hidden: r.hidden, custom: true, sort: r.sort_order, settingId: r.id }),
  );
  return out.sort((a, b) => a.sort - b.sort);
}

type Ctx = {
  /** All flags (including hidden), sorted. */
  all: FlagDef[];
  /** Visible flags, sorted. */
  flags: FlagDef[];
  isOn: (room: Partial<Room> | undefined, roomNumber: number, def: FlagDef) => boolean;
  toggle: (roomNumber: number, def: FlagDef, value: boolean) => void;
};

const defaults: Ctx = {
  all: BUILTIN_FLAGS.map((b, i) => ({ ...b, hidden: false, custom: false, sort: i })),
  flags: BUILTIN_FLAGS.map((b, i) => ({ ...b, hidden: false, custom: false, sort: i })),
  isOn: (room, _n, def) => !def.custom && !!(room as Record<string, unknown> | undefined)?.[def.key],
  toggle: () => {},
};

export const RoomFlagsContext = createContext<Ctx>(defaults);
export const useRoomFlags = () => useContext(RoomFlagsContext);

export function FlagIcon({ def, className }: { def: Pick<FlagDef, "icon">; className?: string }) {
  const Icon = FLAG_ICONS[def.icon] ?? Flag;
  return <Icon className={className} />;
}
