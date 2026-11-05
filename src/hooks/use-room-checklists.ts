import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentHotel } from "@/lib/hotels";

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