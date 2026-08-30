// Room-domain data queries. Extracted verbatim from src/routes/app.tsx (stage 4).
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  ReceptionItem,
  Room,
  RoomFeature,
  RoomFeatureAssignment,
  RoomType,
} from "@/lib/app-types";

export const useRoomsQuery = () =>
  useQuery({
    queryKey: ["rooms"],
    queryFn: async (): Promise<Room[]> => {
      const { data, error } = await supabase
        .from("rooms")
        .select("id,room_number,sort_order,done,done_reception,category,default_status,reception_status_id,reception_bed_id,housekeeping_note,needs_maintenance,guest_vacated,stayover_out,stayover_out_at,early_check_in,not_required,guest_vacated_at,early_check_in_at,needs_maintenance_at,not_required_at")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Room[];
    },
  });

export const useRoomTypesQuery = () =>
  useQuery({
    queryKey: ["room_types"],
    queryFn: async (): Promise<RoomType[]> => {
      const { data, error } = await supabase
        .from("room_types")
        .select("id,user_id,value,label,sort_order,created_at,updated_at")
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as RoomType[];
    },
  });

export const useRoomFeaturesQuery = () =>
  useQuery({
    queryKey: ["room_features"],
    queryFn: async (): Promise<RoomFeature[]> => {
      const { data, error } = await supabase
        .from("room_features" as never)
        .select("id,user_id,value,label,sort_order,created_at,updated_at")
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as RoomFeature[];
    },
  });

export const useRoomFeatureAssignmentsQuery = () =>
  useQuery({
    queryKey: ["room_feature_rooms"],
    queryFn: async (): Promise<RoomFeatureAssignment[]> => {
      const { data, error } = await supabase
        .from("room_feature_rooms" as never)
        .select("id,feature_id,room_number");
      if (error) throw error;
      return (data ?? []) as RoomFeatureAssignment[];
    },
  });

export const useReceptionItemsQuery = () =>
  useQuery({
    queryKey: ["reception_items"],
    queryFn: async (): Promise<ReceptionItem[]> => {
      const { data, error } = await supabase
        .from("reception_items" as never)
        .select("id,user_id,kind,label,sort_order,created_at,updated_at")
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ReceptionItem[];
    },
  });
