import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CurrentHotel = {
  id: string;
  name: string;
  slug: string | null;
} | null;

export const DEFAULT_HOTEL_NAME = "The Hotel Hub";

export function useCurrentHotel() {
  return useQuery<CurrentHotel>({
    queryKey: ["current-hotel"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return null;
      const { data: activeData } = await supabase
        .from("user_active_hotel")
        .select("hotels ( id, name, slug )")
        .eq("user_id", uid)
        .maybeSingle();
      const activeHotel = (activeData as { hotels: { id: string; name: string; slug: string | null } | null } | null)?.hotels;
      return activeHotel ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCurrentHotelName(): string {
  const { data } = useCurrentHotel();
  return data?.name ?? DEFAULT_HOTEL_NAME;
}