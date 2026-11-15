import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CurrentHotel = {
  id: string;
  name: string;
  slug: string | null;
  linen_delivery_days: number[];
  last_hk_reset_at: string | null;
  mattress_interval_months: number;
  /** A developer-only test hotel (migration 0021). */
  developer_only: boolean;
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
        .select("hotels ( id, name, slug, linen_delivery_days, last_hk_reset_at, mattress_interval_months, developer_only )")
        .eq("user_id", uid)
        .maybeSingle();
      const activeHotel = (activeData as {
        hotels: {
          id: string;
          name: string;
          slug: string | null;
          linen_delivery_days: number[] | null;
          last_hk_reset_at: string | null;
          mattress_interval_months: number | null;
          developer_only: boolean | null;
        } | null;
      } | null)?.hotels;
      if (!activeHotel) return null;
      return {
        id: activeHotel.id,
        name: activeHotel.name,
        slug: activeHotel.slug,
        linen_delivery_days: activeHotel.linen_delivery_days ?? [],
        last_hk_reset_at: activeHotel.last_hk_reset_at ?? null,
        mattress_interval_months: activeHotel.mattress_interval_months ?? 3,
        developer_only: activeHotel.developer_only === true,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCurrentHotelName(): string {
  const { data } = useCurrentHotel();
  return data?.name ?? DEFAULT_HOTEL_NAME;
}