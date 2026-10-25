import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentHotel } from "@/lib/hotels";

export function useFloors() {
  const hotelId = useCurrentHotel().data?.id;
  return useQuery({
    queryKey: ["hotel-floors", hotelId],
    enabled: !!hotelId,
    queryFn: async () => {
      if (!hotelId) return [];
      const { data, error } = await supabase.from("hotel_floors").select("id,name,cupboard_key,sort_order").eq("hotel_id", hotelId).order("sort_order").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}