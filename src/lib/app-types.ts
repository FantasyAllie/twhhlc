// Shared domain types for the operational app screen.
// Extracted from src/routes/app.tsx (stage 1 of the staged refactor).

export type Category = string;

export type ItemColor = "green" | "yellow" | "red" | "blue";

export type RoomType = {
  id: string;
  user_id: string;
  value: Category;
  label: string;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
};

export type RoomFeature = {
  id: string;
  user_id: string;
  value: string;
  label: string;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
};

export type RoomFeatureAssignment = { id: string; feature_id: string; room_number: number };

export type ReceptionItem = {
  id: string;
  user_id: string;
  kind: "status" | "bed";
  label: string;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
};

export type TemplateItem = {
  id: string;
  name: string;
  created_at: string;
  category: Category;
  position: number;
  default_count: number;
  color: ItemColor | null;
  list_type: "housekeeping" | "fnb";
};

export type RoomExtra = { id: string; room_number: number; name: string; created_at: string };

export type RoomCount = {
  id: string;
  room_number: number;
  item_kind: "template" | "extra";
  item_id: string;
  count: number;
};

export type Room = {
  id: string;
  room_number: number;
  sort_order?: number;
  done: boolean;
  done_reception: boolean;
  category: Category | null;
  default_status: string | null;
  reception_status_id: string | null;
  reception_bed_id: string | null;
  housekeeping_note: string | null;
  needs_maintenance: boolean;
  guest_vacated: boolean;
  // Stayover room whose guest has gone out for the day: room is empty and can
  // be serviced now (distinct from guest_vacated = checked out for good).
  stayover_out?: boolean;
  // Reception flag: room needs a dog box for a guest's dog.
  dog_box?: boolean;
  dog_box_at?: string | null;
  stayover_out_at?: string | null;
  early_check_in?: boolean;
  // Reception flag: guest is staying past normal checkout time.
  late_checkout?: boolean;
  not_required?: boolean;
  guest_vacated_at?: string | null;
  early_check_in_at?: string | null;
  late_checkout_at?: string | null;
  needs_maintenance_at?: string | null;
  not_required_at?: string | null;
};

export type TemplateItemRoom = { id: string; template_item_id: string; room_number: number };

export type SnapshotRow = { name: string; count: number };
export type RoomStatusRow = { room: number; status: string; bed: string; maintenance?: boolean };
export type MaintenanceRow = { room: number; note: string };

export type ExportSnapshotKind =
  | "totals"
  | "rejects"
  | "delivery"
  | "room_status"
  | "maintenance"
  | "fnb_totals"
  | "totals_range";

export type ExportSnapshot = {
  id: string;
  created_at: string;
  totals: SnapshotRow[] | RoomStatusRow[] | MaintenanceRow[];
  grand_total: number;
  kind?: ExportSnapshotKind;
};

export type RejectCount = { id: string; template_item_id: string; count: number };

export type DeliveryCount = { id: string; template_item_id: string; count: number };

export type RoomMessage = {
  id: string;
  room_number: number | null;
  message: string;
  created_by_username: string | null;
  created_by_role: string | null;
  reply_to_id: string | null;
  dismissed: boolean;
  thread: "hk_reception" | "hk_fnb" | "reception_fnb" | "hk_maintenance" | "reception_maintenance";
  done_at: string | null;
  deleted_at: string | null;
  created_at: string;
};

export type MaintenanceRequest = {
  id: string;
  room_number: number | null;
  area_label?: string | null;
  message: string;
  created_by_username: string | null;
  done: boolean;
  done_by_username: string | null;
  done_at: string | null;
  created_at: string;
  photo_paths: string[];
  // Free-text repair notes: what needs doing, parts needed, what's outstanding.
  notes?: string | null;
};

export type ViewRole = "admin" | "manager" | "user" | "reception" | "fnb" | "maintenance";

export type FnbCount = { template_item_id: string; count: number };

export type LostPropertyLite = {
  id: string;
  room_number: number | null;
  message: string;
  status: "open" | "collected" | "discarded";
  created_at: string;
  photo_paths?: string[] | null;
};

// Non-room parts of the hotel (lobby, kitchen, car park...) that maintenance
// issues can be logged against. Configured by admins and managers.
export type MaintenanceArea = {
  id: string;
  label: string;
  sort_order: number | null;
  created_at: string;
};
