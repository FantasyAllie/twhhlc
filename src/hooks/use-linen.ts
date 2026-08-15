// Linen/counting data queries. Extracted verbatim from src/routes/app.tsx (stage 4).
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  DeliveryCount,
  FnbCount,
  RejectCount,
  RoomCount,
  RoomExtra,
  TemplateItem,
  TemplateItemRoom,
} from "@/lib/app-types";

export const useTemplateItemsQuery = () =>
  useQuery({
    queryKey: ["template_items"],
    queryFn: async (): Promise<TemplateItem[]> => {
      const { data, error } = await supabase
        .from("template_items")
        .select("id,name,created_at,category,position,default_count,color,list_type")
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TemplateItem[];
    },
  });

export const useRoomExtrasQuery = () =>
  useQuery({
    queryKey: ["room_extras"],
    queryFn: async (): Promise<RoomExtra[]> => {
      const { data, error } = await supabase
        .from("room_extra_items")
        .select("id,room_number,name,created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

export const useRoomCountsQuery = () =>
  useQuery({
    queryKey: ["room_counts"],
    queryFn: async (): Promise<RoomCount[]> => {
      const { data, error } = await supabase
        .from("room_item_counts")
        .select("id,room_number,item_kind,item_id,count");
      if (error) throw error;
      return (data ?? []) as RoomCount[];
    },
  });

export const useFnbCountsQuery = () =>
  useQuery({
    queryKey: ["fnb_linen_counts"],
    queryFn: async (): Promise<FnbCount[]> => {
      const { data, error } = await supabase
        .from("fnb_linen_counts" as never)
        .select("template_item_id,count");
      if (error) throw error;
      return (data ?? []) as FnbCount[];
    },
  });

export const useTemplateItemRoomsQuery = () =>
  useQuery({
    queryKey: ["template_item_rooms"],
    queryFn: async (): Promise<TemplateItemRoom[]> => {
      const { data, error } = await supabase
        .from("template_item_rooms")
        .select("id,template_item_id,room_number");
      if (error) throw error;
      return (data ?? []) as TemplateItemRoom[];
    },
  });

export const useRejectCountsQuery = () =>
  useQuery({
    queryKey: ["reject_counts"],
    queryFn: async (): Promise<RejectCount[]> => {
      const { data, error } = await supabase
        .from("reject_counts" as never)
        .select("id,template_item_id,count");
      if (error) throw error;
      return (data ?? []) as RejectCount[];
    },
  });

export const useDeliveryCountsQuery = () =>
  useQuery({
    queryKey: ["delivery_counts"],
    queryFn: async (): Promise<DeliveryCount[]> => {
      const { data, error } = await supabase
        .from("delivery_counts" as never)
        .select("id,template_item_id,count");
      if (error) throw error;
      return (data ?? []) as DeliveryCount[];
    },
  });
