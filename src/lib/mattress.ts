// Optional per-room mattress flip schedule. Rooms opt in; a flip is due once
// the interval (months) has passed since the last recorded flip, or straight
// away when tracking is on but no flip has been recorded yet.
import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Room } from "./app-types";

export const DEFAULT_MATTRESS_INTERVAL_MONTHS = 3;

export const mattressNextDue = (room: Partial<Room> | undefined): Date | null => {
  if (!room?.mattress_tracking) return null;
  if (!room.mattress_flipped_at) return new Date(0);
  const d = new Date(room.mattress_flipped_at);
  d.setMonth(d.getMonth() + (room.mattress_interval_months || DEFAULT_MATTRESS_INTERVAL_MONTHS));
  return d;
};

export const isMattressDue = (room: Partial<Room> | undefined, now: Date = new Date()): boolean => {
  const due = mattressNextDue(room);
  return !!due && due.getTime() <= now.getTime();
};

type MattressPatch = Partial<Pick<Room, "mattress_tracking" | "mattress_interval_months" | "mattress_flipped_at" | "mattress_flipped_by">>;

export async function updateRoomMattress(qc: QueryClient, roomNumber: number, patch: MattressPatch) {
  const prev = qc.getQueryData<Room[]>(["rooms"]);
  qc.setQueryData<Room[]>(["rooms"], (old) => old?.map((r) => (r.room_number === roomNumber ? { ...r, ...patch } : r)));
  const { error } = await supabase.from("rooms").update(patch as never).eq("room_number", roomNumber);
  if (error) {
    qc.setQueryData(["rooms"], prev);
    toast.error("Couldn't save mattress details");
    return false;
  }
  return true;
}

export const formatFlipDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "Never";
