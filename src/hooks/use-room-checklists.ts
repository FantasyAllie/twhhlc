import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentHotel } from "@/lib/hotels";
import { DEFAULT_ROOM_CHECKLIST } from "@/lib/room-checklist-rules";

export function useRoomChecklistSettings() {
  const hotel = useCurrentHotel().data;
  return useQuery({
    queryKey: ["room-checklist-settings", hotel?.id],
    enabled: !!hotel?.id,
    queryFn: async (): Promise<string[]> => {
      if (!hotel) throw new Error("Select a hotel first.");
      const { data, error } = await supabase.from("room_checklist_settings").select("items").eq("hotel_id", hotel.id).maybeSingle();
      if (error) throw error;
      return data ? data.items as string[] : [...DEFAULT_ROOM_CHECKLIST];
    },
    staleTime: 0,
  });
}

export function useRoomChecklistRecords(roomNumber: number) {
  const hotel = useCurrentHotel().data;
  return useQuery({
    queryKey: ["room-checklist-records", hotel?.id, roomNumber],
    enabled: !!hotel?.id,
    queryFn: async () => {
      if (!hotel) throw new Error("Select a hotel first.");
      const { data, error } = await supabase.from("room_checklist_completions").select("*").eq("hotel_id", hotel.id).eq("room_number", roomNumber).order("completed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}