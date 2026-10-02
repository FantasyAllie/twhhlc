// Messages, maintenance, lost property and export snapshot queries.
// Extracted verbatim from src/routes/app.tsx (stage 4).
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  ExportSnapshot,
  LostPropertyLite,
  MaintenanceArea,
  MaintenanceRequest,
  RoomMessage,
} from "@/lib/app-types";

export const useRoomMessagesQuery = () =>
  useQuery({
    queryKey: ["room_messages"],
    queryFn: async (): Promise<RoomMessage[]> => {
      const { data, error } = await supabase
        .from("room_messages" as never)
        .select("id,room_number,message,created_by_username,created_by_role,reply_to_id,dismissed,thread,done_at,deleted_at,created_at,notes")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RoomMessage[];
    },
  });

export const useMaintenanceRequestsQuery = () =>
  useQuery({
    queryKey: ["maintenance_requests"],
    queryFn: async (): Promise<MaintenanceRequest[]> => {
      const { data, error } = await supabase
        .from("maintenance_requests" as never)
        .select("id,room_number,area_label,message,created_by_username,done,done_by_username,done_at,created_at,photo_paths,notes,urgent")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MaintenanceRequest[];
    },
  });

export const useLostPropertyOpenQuery = () =>
  useQuery({
    queryKey: ["lost_property_lite"],
    queryFn: async (): Promise<LostPropertyLite[]> => {
      const { data, error } = await supabase
        .from("lost_property" as never)
        .select("id,room_number,message,status,created_at,deleted_at,photo_paths")
        .is("deleted_at", null)
        .eq("status", "open")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LostPropertyLite[];
    },
  });

export const useExportSnapshotsQuery = () =>
  useQuery({
    queryKey: ["export_snapshots"],
    queryFn: async (): Promise<ExportSnapshot[]> => {
      const { data, error } = await supabase
        .from("export_snapshots")
        .select("id,created_at,totals,grand_total,kind")
        .order("created_at", { ascending: false })
        // A year of daily snapshots for every report kind.
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as ExportSnapshot[];
    },
  });

export const useMaintenanceAreasQuery = () =>
  useQuery({
    queryKey: ["maintenance_areas"],
    queryFn: async (): Promise<MaintenanceArea[]> => {
      const { data, error } = await supabase
        .from("maintenance_areas" as never)
        .select("id,label,sort_order,created_at")
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("label", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MaintenanceArea[];
    },
  });
