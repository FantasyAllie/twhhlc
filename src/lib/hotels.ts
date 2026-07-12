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
      const { data, error } = await supabase
        .from("hotel_members")
        .select("hotels ( id, name, slug )")
        .eq("user_id", uid)
        .maybeSingle();
      if (error) return null;
      const h = (data as { hotels: { id: string; name: string; slug: string | null } | null } | null)?.hotels;
      return h ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCurrentHotelName(): string {
  const { data } = useCurrentHotel();
  return data?.name ?? DEFAULT_HOTEL_NAME;
}