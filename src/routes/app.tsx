import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus, X, Menu, ArrowUp, ArrowDown, Pencil, Check, Trash2, Sun, Moon, List, Bed, Ban, History, Users, User, LogOut, Hash, ConciergeBell, ClipboardList, Printer, Filter, Wrench, DoorOpen, Bell, Eye, EyeOff, HelpCircle, AlertCircle, MessageSquare, PackageSearch, RotateCcw, ChevronDown, Camera } from "lucide-react";
import { ReceptionIconGuide } from "@/components/reception-icon-guide";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getToken, getStoredUser, clearSession } from "@/lib/auth-client";
import { notifyRoomEvent, notifyMaintenanceRequest } from "@/lib/push.functions";
import { NotificationsSheet } from "@/components/notifications-sheet";
import { MessagesSheet, type MessagesThread, type Department as MessagesDepartment } from "@/components/messages-sheet";
import { UsersDialog } from "@/components/users-dialog";
import { UserApprovalDialog } from "@/components/user-approval-dialog";
import { QuickReceptionSheet } from "@/components/quick-reception-sheet";
import { LostPropertySheet } from "@/components/lost-property-sheet";
import { PhotoAttachments, PhotoComposer } from "@/components/entry-photos";
import { StayoverPhotosSheet } from "@/components/stayover-photos-sheet";
import {
  deleteTodayStayoverPhotosForRoom,
  purgeExpiredStayoverPhotos,
  uploadStayoverPhoto,
} from "@/lib/stayover-photos";
import { useServerFn } from "@tanstack/react-start";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useTheme } from "@/components/theme-provider";

export const Route = createFileRoute("/app")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Three Ways House Hotel" },
      { name: "description", content: "Count items per room across 50 rooms." },
    ],
  }),
  component: AppPage,
});

type Category = string;
type RoomType = { id: string; user_id: string; value: Category; label: string; sort_order: number | null; created_at: string; updated_at: string };
type RoomFeature = { id: string; user_id: string; value: string; label: string; sort_order: number | null; created_at: string; updated_at: string };
type RoomFeatureAssignment = { id: string; feature_id: string; room_number: number };
type ReceptionItem = { id: string; user_id: string; kind: "status" | "bed"; label: string; sort_order: number | null; created_at: string; updated_at: string };

function ManageEditableRow({
  label,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onRename,
  onDelete,
}: {
  label: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRename: (v: string) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  useEffect(() => {
    if (!editing) setDraft(label);
  }, [label, editing]);
  const commit = () => {
    const clean = draft.trim();
    if (clean && clean !== label) void onRename(clean);
    setEditing(false);
  };
  return (
    <div className="flex items-center gap-1 rounded-full border bg-background min-h-12 pl-2 pr-1.5">
      <div className="flex flex-col">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-5 w-7 text-muted-foreground"
          onClick={onMoveUp}
          disabled={!canMoveUp}
          aria-label="Move up"
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-5 w-7 text-muted-foreground"
          onClick={onMoveDown}
          disabled={!canMoveDown}
          aria-label="Move down"
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </Button>
      </div>
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setDraft(label);
              setEditing(false);
            }
          }}
          className="flex-1 min-w-0 bg-transparent text-sm font-medium outline-none px-2 py-1 rounded-md border border-input focus:ring-1 focus:ring-ring"
        />
      ) : (
        <span className="flex-1 text-sm font-medium pl-2 truncate">{label}</span>
      )}
      {editing ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground"
          onClick={commit}
          aria-label="Save name"
        >
          <Check className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground"
          onClick={() => setEditing(true)}
          aria-label={`Rename ${label}`}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-muted-foreground hover:text-destructive"
        onClick={onDelete}
        aria-label={`Remove ${label}`}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

const parseCats = (c: string | null | undefined): Category[] =>
  (c ?? "").split(",").map((s) => s.trim()).filter(Boolean);

const categoryLabel = (c: Category | null | undefined, types: RoomType[]) => {
  const vals = parseCats(c);
  if (vals.length === 0) return "Uncategorised";
  return vals.map((v) => types.find((t) => t.value === v)?.label ?? v).join(" / ");
};

const valueFromLabel = (label: string): Category =>
  label.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

const COLOR_SWATCHES: Record<"green" | "yellow" | "red" | "blue", { bg: string; darkBg: string; border: string; solid: string; label: string }> = {
  green:  { bg: "#dcfce7", darkBg: "#14532d", border: "#86efac", solid: "#22c55e", label: "Green" },
  yellow: { bg: "#fef9c3", darkBg: "#713f12", border: "#fde047", solid: "#eab308", label: "Yellow" },
  red:    { bg: "#fee2e2", darkBg: "#7f1d1d", border: "#fca5a5", solid: "#ef4444", label: "Red" },
  blue:   { bg: "#dbeafe", darkBg: "#1e3a8a", border: "#93c5fd", solid: "#3b82f6", label: "Blue" },
};

type ItemColor = "green" | "yellow" | "red" | "blue";
type TemplateItem = { id: string; name: string; created_at: string; category: Category; position: number; default_count: number; color: ItemColor | null; list_type: "housekeeping" | "fnb" };
type RoomExtra = { id: string; room_number: number; name: string; created_at: string };
type RoomCount = {
 id: string;
 room_number: number;
 item_kind: "template" | "extra";
 item_id: string;
 count: number;
};
type Room = { id: string; room_number: number; sort_order?: number; done: boolean; done_reception: boolean; category: Category | null; default_status: string | null; reception_status_id: string | null; reception_bed_id: string | null; housekeeping_note: string | null; needs_maintenance: boolean; guest_vacated: boolean; early_check_in?: boolean };
type TemplateItemRoom = { id: string; template_item_id: string; room_number: number };
type SnapshotRow = { name: string; count: number };
type RoomStatusRow = { room: number; status: string; bed: string; maintenance?: boolean };
type MaintenanceRow = { room: number; note: string };
type ExportSnapshot = {
  id: string;
  created_at: string;
  totals: SnapshotRow[] | RoomStatusRow[] | MaintenanceRow[];
  grand_total: number;
  kind?: "totals" | "rejects" | "room_status" | "maintenance" | "fnb_totals";
};
type RejectCount = { id: string; template_item_id: string; count: number };
type RoomMessage = {
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
type MaintenanceRequest = {
  id: string;
  room_number: number;
  message: string;
  created_by_username: string | null;
  done: boolean;
  done_by_username: string | null;
  done_at: string | null;
  created_at: string;
  photo_paths: string[];
};

function AppPage() {
 const qc = useQueryClient();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const isMobile = useIsMobile();
  const [authUser, setAuthUser] = useState(() => getStoredUser());
  // Admin/Manager "view as" overlay — see definition further below for full context.
type ViewRole = "admin" | "manager" | "user" | "reception" | "fnb" | "maintenance";
  const [viewAsRole, setViewAsRole] = useState<ViewRole | null>(() => {
    if (typeof window === "undefined") return null;
    const v = window.localStorage.getItem("tw_view_as_role");
    return v === "user" || v === "reception" || v === "admin" || v === "manager" || v === "fnb" ? v : null;
  });
  useEffect(() => {
    if (!getStoredUser()) {
      navigate({ to: "/login", replace: true });
    }
    const onChange = () => setAuthUser(getStoredUser());
    window.addEventListener("tw-auth-changed", onChange);
    return () => window.removeEventListener("tw-auth-changed", onChange);
  }, [navigate]);
  useEffect(() => {
    document.title = "Three Ways House Hotel";
  }, []);
  // Mobile keyboard: keep the focused input visible above the on-screen keyboard.
  // We listen to focus on form controls and use visualViewport to detect when the
  // keyboard reduces the visible area, then scroll the field into view.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;

    const isEditable = (el: EventTarget | null): el is HTMLElement => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === "INPUT") {
        const type = (el as HTMLInputElement).type;
        // Skip controls that don't open a keyboard.
        return !["checkbox", "radio", "range", "color", "file", "button", "submit", "reset"].includes(type);
      }
      return tag === "TEXTAREA" || el.isContentEditable;
    };

    const scrollFocused = () => {
      const el = document.activeElement;
      if (!isEditable(el)) return;
      // Wait one frame so the viewport has resized for the keyboard.
      requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const visibleBottom = vv ? vv.height + vv.offsetTop : window.innerHeight;
        const margin = 24;
        if (rect.bottom > visibleBottom - margin || rect.top < margin) {
          el.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      });
    };

    const onFocusIn = (e: FocusEvent) => {
      if (!isEditable(e.target)) return;
      // Defer to allow the keyboard to start opening.
      setTimeout(scrollFocused, 250);
    };

    document.addEventListener("focusin", onFocusIn);
    vv?.addEventListener("resize", scrollFocused);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      vv?.removeEventListener("resize", scrollFocused);
    };
  }, []);
  // Realtime: push room status changes to all signed-in clients (esp. reception)
  useEffect(() => {
    if (!authUser) return;
    const notifyEnabled = (viewAsRole ?? authUser.role) !== "reception";
    if (
      notifyEnabled &&
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission().catch(() => {});
    }
    const channel = supabase
      .channel("rooms-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms" },
        () => {
          qc.invalidateQueries({ queryKey: ["rooms"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_messages" },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["room_messages"] });
          if (!notifyEnabled) return;
          if (payload.eventType !== "INSERT") return;
          const row = payload.new as {
            room_number?: number;
            message?: string;
            created_by_username?: string;
            dismissed?: boolean;
          };
          if (!row || row.dismissed) return;
          const title = `Reception – Room ${row.room_number ?? "?"}`;
          const body = `${row.created_by_username ?? "Reception"}: ${row.message ?? ""}`;
          toast(title, {
            description: row.message ?? "",
            duration: Infinity,
            closeButton: true,
            cancel: { label: "Dismiss", onClick: () => {} },
          });
          try {
            if (
              typeof window !== "undefined" &&
              "Notification" in window &&
              Notification.permission === "granted" &&
              document.visibilityState !== "visible"
            ) {
              new Notification(title, { body, tag: `room-msg-${row.room_number}` });
            }
          } catch {
            /* ignore */
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "maintenance_requests" },
        () => {
          qc.invalidateQueries({ queryKey: ["maintenance_requests"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [authUser, qc, viewAsRole]);
  const signOut = () => {
    clearSession();
    navigate({ to: "/login", replace: true });
  };
  const [accountOpen, setAccountOpen] = useState(false);
  const [usersOpen, setUsersOpen] = useState(false);
  const [userApprovalOpen, setUserApprovalOpen] = useState(false);
 const [openRoom, setOpenRoom] = useState<number | null>(null);
 const [templateOpen, setTemplateOpen] = useState(false);
const [linenListType, setLinenListType] = useState<"housekeeping" | "fnb">("housekeeping");
const [showAllLinen, setShowAllLinen] = useState<Record<number, boolean>>({});
  const [newTemplateName, setNewTemplateName] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemName, setEditingItemName] = useState("");
  const [exportSheetOpen, setExportSheetOpen] = useState(false);
  const [rolePickerSheetOpen, setRolePickerSheetOpen] = useState(false);
  const [editItemSheetId, setEditItemSheetId] = useState<string | null>(null);
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false);
  const [addRoomTypeOpen, setAddRoomTypeOpen] = useState(false);
  const [newRoomTypeLabel, setNewRoomTypeLabel] = useState("");
  const [addRoomFeatureOpen, setAddRoomFeatureOpen] = useState(false);
  const [newRoomFeatureLabel, setNewRoomFeatureLabel] = useState("");
  const [addReceptionItemKind, setAddReceptionItemKind] = useState<"status" | "bed" | null>(null);
  const [newReceptionItemLabel, setNewReceptionItemLabel] = useState("");
  const [receptionFeatureFilter, setReceptionFeatureFilter] = useState<string[]>([]);
  const [receptionStatusFilter, setReceptionStatusFilter] = useState<string[]>([]);
  const [receptionDoneOnlyFilter, setReceptionDoneOnlyFilter] = useState(false);
  const [noteDraft, setNoteDraft] = useState<Record<number, string>>({});
  const [notesSheetRoom, setNotesSheetRoom] = useState<number | null>(null);
  const [receptionSheetRoom, setReceptionSheetRoom] = useState<number | null>(null);
  const [quickReceptionOpen, setQuickReceptionOpen] = useState(false);
  const [editDefaultsSheetRoom, setEditDefaultsSheetRoom] = useState<number | null>(null);
  const [editRoomSheetNumber, setEditRoomSheetNumber] = useState<number | null>(null);
  const [menuSheetOpen, setMenuSheetOpen] = useState(false);
  const [notificationsSheetOpen, setNotificationsSheetOpen] = useState(false);
  const [messagesSheetOpen, setMessagesSheetOpen] = useState(false);
  const [messagesInitial, setMessagesInitial] = useState<{ thread?: MessagesThread; room?: number | null; text?: string; replyTo?: { id: string; sender: string; snippet: string } }>({});
  const [maintenanceLogOpen, setMaintenanceLogOpen] = useState(false);
  const [newMaintenanceRoom, setNewMaintenanceRoom] = useState<string>("");
 const [newMaintenancePhotos, setNewMaintenancePhotos] = useState<File[]>([]);
  const [newMaintenanceText, setNewMaintenanceText] = useState<string>("");
  const [maintenanceComposerOpen, setMaintenanceComposerOpen] = useState(false);
  const [lostPropertyOpen, setLostPropertyOpen] = useState(false);
  // Stayover / DND photo state
  const [stayoverPhotosOpen, setStayoverPhotosOpen] = useState(false);
  const [stayoverPhotosRoomFilter, setStayoverPhotosRoomFilter] = useState<number | undefined>(undefined);
  const [pendingDndRoom, setPendingDndRoom] = useState<number | null>(null);
  const dndFileInputRef = useRef<HTMLInputElement | null>(null);
  // Menu section collapse state, synced to profiles.preferences.menu_collapsed
  const menuPrefsQ = useQuery({
    queryKey: ["profile_preferences", authUser?.id],
    enabled: !!authUser?.id,
    queryFn: async (): Promise<Record<string, unknown>> => {
      if (!authUser?.id) return {};
      const { data } = await supabase
        .from("profiles")
        .select("preferences")
        .eq("id", authUser.id)
        .maybeSingle();
      const prefs = (data as { preferences?: Record<string, unknown> } | null)?.preferences;
      return prefs ?? {};
    },
  });
  const menuCollapsed = (menuPrefsQ.data?.menu_collapsed as Record<string, boolean> | undefined) ?? {};
  const toggleMenuSection = async (key: string) => {
    if (!authUser?.id) return;
    const currentPrefs = (menuPrefsQ.data ?? {}) as Record<string, unknown>;
    const currentCollapsed = (currentPrefs.menu_collapsed as Record<string, boolean> | undefined) ?? {};
    const nextCollapsed = { ...currentCollapsed, [key]: !currentCollapsed[key] };
    const nextPrefs = { ...currentPrefs, menu_collapsed: nextCollapsed };
    qc.setQueryData(["profile_preferences", authUser.id], nextPrefs);
    await supabase
      .from("profiles")
      .update({ preferences: nextPrefs } as never)
      .eq("id", authUser.id);
  };
  // Admin "view as" overlay — lets admins temporarily experience the app as
  // another role. Does NOT change the auth token; backend still treats them
  // as admin. Only affects UI gating and visible affordances.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (viewAsRole) window.localStorage.setItem("tw_view_as_role", viewAsRole);
    else window.localStorage.removeItem("tw_view_as_role");
  }, [viewAsRole]);
  // Clear overlay whenever the current view-as isn't a view this account has.
  // (Actual list computed below; keep the effect narrow — pass position/subRoles.)
  useEffect(() => {
    if (!authUser || !viewAsRole) return;
    const pos = authUser.position;
    const subs = authUser.subRoles;
    const allowed: ViewRole[] = [];
    if (pos === "admin") allowed.push("admin", "manager");
    if (pos === "manager") allowed.push("manager");
    if (pos === "admin" || pos === "manager" || subs.includes("housekeeper")) allowed.push("user");
    if (pos === "admin" || pos === "manager" || subs.includes("reception")) allowed.push("reception");
    if (pos === "admin" || pos === "manager" || subs.includes("fnb")) allowed.push("fnb");
    if (pos === "admin" || pos === "manager" || subs.includes("maintenance")) allowed.push("maintenance");
    if (!allowed.includes(viewAsRole)) setViewAsRole(null);
  }, [authUser, viewAsRole]);

  // Fire-and-forget push fan-out; never blocks the UI.
  const fireRoomNotification = (
    kind: "message" | "checkout" | "done",
    roomNumber: number,
    messageText?: string,
  ) => {
    if (!getToken()) return;
    void notifyRoomEvent({ data: { kind, roomNumber, messageText } }).catch(() => {});
  };
  const [historySheetOpen, setHistorySheetOpen] = useState(false);
  const [roomTypesSheetOpen, setRoomTypesSheetOpen] = useState(false);
  const [roomFeaturesSheetOpen, setRoomFeaturesSheetOpen] = useState(false);
  const [receptionItemsSheetOpen, setReceptionItemsSheetOpen] = useState(false);
 

 const [exportOpen, setExportOpen] = useState(false);
  const [viewingSnapshot, setViewingSnapshot] = useState<ExportSnapshot | null>(null);
  const [rejectsOpen, setRejectsOpen] = useState(false);
  const [rejectExportOpen, setRejectExportOpen] = useState(false);
  const [roomStatusExportOpen, setRoomStatusExportOpen] = useState(false);
  const [manageRoomsOpen, setManageRoomsOpen] = useState(false);
  const [receptionHelpOpen, setReceptionHelpOpen] = useState(false);
  const [confirmOverwrite, setConfirmOverwrite] = useState<
    { kind: "totals" | "rejects" | "room_status" | "maintenance" | "fnb_totals" } | null
  >(null);
  const [newRoomNumber, setNewRoomNumber] = useState<string>("");
  const [addRoomConfirmOpen, setAddRoomConfirmOpen] = useState(false);

  // Per-room reception selections are now persisted on the rooms table;
  // read/write helpers below.

 // Track responsive column count so we can insert the open-room panel
 // right after the row containing the clicked room.
 const [cols, setCols] = useState(10);
 useEffect(() => {
 const md = window.matchMedia("(min-width: 768px)");
 const sm = window.matchMedia("(min-width: 640px)");
 const update = () => setCols(md.matches ? 10 : sm.matches ? 8 : 4);
 update();
 md.addEventListener("change", update);
 sm.addEventListener("change", update);
 return () => {
 md.removeEventListener("change", update);
 sm.removeEventListener("change", update);
 };
 }, []);

 const templateQ = useQuery({
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

 const extrasQ = useQuery({
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

 const countsQ = useQuery({
 queryKey: ["room_counts"],
 queryFn: async (): Promise<RoomCount[]> => {
 const { data, error } = await supabase
 .from("room_item_counts")
 .select("id,room_number,item_kind,item_id,count");
 if (error) throw error;
 return (data ?? []) as RoomCount[];
 },
 });

 type FnbCount = { template_item_id: string; count: number };
 const fnbCountsQ = useQuery({
   queryKey: ["fnb_linen_counts"],
   queryFn: async (): Promise<FnbCount[]> => {
     const { data, error } = await supabase
       .from("fnb_linen_counts" as never)
       .select("template_item_id,count");
     if (error) throw error;
     return (data ?? []) as FnbCount[];
   },
 });

  const roomsQ = useQuery({
    queryKey: ["rooms"],
    queryFn: async (): Promise<Room[]> => {
      const { data, error } = await supabase
        .from("rooms")
        .select("id,room_number,sort_order,done,done_reception,category,default_status,reception_status_id,reception_bed_id,housekeeping_note,needs_maintenance,guest_vacated,early_check_in")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Room[];
    },
  });

  const roomTypesQ = useQuery({
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

  const roomFeaturesQ = useQuery({
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

  const roomFeatureAssignmentsQ = useQuery({
    queryKey: ["room_feature_rooms"],
    queryFn: async (): Promise<RoomFeatureAssignment[]> => {
      const { data, error } = await supabase
        .from("room_feature_rooms" as never)
        .select("id,feature_id,room_number");
      if (error) throw error;
      return (data ?? []) as RoomFeatureAssignment[];
    },
  });

  const receptionItemsQ = useQuery({
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

  const assignmentsQ = useQuery({
    queryKey: ["template_item_rooms"],
    queryFn: async (): Promise<TemplateItemRoom[]> => {
      const { data, error } = await supabase
        .from("template_item_rooms")
        .select("id,template_item_id,room_number");
      if (error) throw error;
      return (data ?? []) as TemplateItemRoom[];
    },
  });

  const snapshotsQ = useQuery({
    queryKey: ["export_snapshots"],
    queryFn: async (): Promise<ExportSnapshot[]> => {
      const { data, error } = await supabase
        .from("export_snapshots")
          .select("id,created_at,totals,grand_total,kind")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as ExportSnapshot[];
    },
  });

  const rejectsQ = useQuery({
    queryKey: ["reject_counts"],
    queryFn: async (): Promise<RejectCount[]> => {
      const { data, error } = await supabase
        .from("reject_counts" as never)
        .select("id,template_item_id,count");
      if (error) throw error;
      return (data ?? []) as RejectCount[];
    },
  });

  const messagesQ = useQuery({
    queryKey: ["room_messages"],
    queryFn: async (): Promise<RoomMessage[]> => {
      const { data, error } = await supabase
        .from("room_messages" as never)
        .select("id,room_number,message,created_by_username,created_by_role,reply_to_id,dismissed,thread,done_at,deleted_at,created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RoomMessage[];
    },
  });

  const maintenanceRequestsQ = useQuery({
    queryKey: ["maintenance_requests"],
    queryFn: async (): Promise<MaintenanceRequest[]> => {
      const { data, error } = await supabase
        .from("maintenance_requests" as never)
        .select("id,room_number,message,created_by_username,done,done_by_username,done_at,created_at,photo_paths")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MaintenanceRequest[];
    },
  });

  const templateAll = templateQ.data ?? [];
  const template = templateAll.filter((t) => (t.list_type ?? "housekeeping") === "housekeeping");
  const templateFnbList = templateAll.filter((t) => t.list_type === "fnb");
  const fnbCounts = fnbCountsQ.data ?? [];
  const fnbCountByItem = new Map<string, number>(
    fnbCounts.map((c) => [c.template_item_id, c.count ?? 0]),
  );
  const setFnbCount = async (template_item_id: string, count: number) => {
    const safe = Math.max(0, Math.floor(count));
    qc.setQueryData<FnbCount[]>(["fnb_linen_counts"], (old) => {
      const list = old ? [...old] : [];
      const idx = list.findIndex((c) => c.template_item_id === template_item_id);
      if (idx >= 0) list[idx] = { ...list[idx], count: safe };
      else list.push({ template_item_id, count: safe });
      return list;
    });
    const { error } = await supabase
      .from("fnb_linen_counts" as never)
      .upsert({ template_item_id, count: safe, updated_at: new Date().toISOString() } as never, {
        onConflict: "template_item_id",
      } as never);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["fnb_linen_counts"] });
  };
  const extras = extrasQ.data ?? [];
  const counts = countsQ.data ?? [];
  const rooms = roomsQ.data ?? [];
  const roomTypes = roomTypesQ.data ?? [];
  const roomFeatures = roomFeaturesQ.data ?? [];
  const roomFeatureAssignments = roomFeatureAssignmentsQ.data ?? [];
  const receptionItems = (receptionItemsQ.data ?? []) as ReceptionItem[];
  const receptionStatuses = receptionItems.filter((i) => i.kind === "status");
  const receptionBeds = receptionItems.filter((i) => i.kind === "bed");
  const assignments = assignmentsQ.data ?? [];
  const snapshots = snapshotsQ.data ?? [];
  const rejects = (rejectsQ.data ?? []) as RejectCount[];
  const roomMessages = (messagesQ.data ?? []) as RoomMessage[];
  const activeMessagesByRoom = (n: number) =>
    roomMessages.filter(
      (m) =>
        m.room_number === n &&
        m.thread === "hk_reception" &&
        !m.done_at &&
        !m.deleted_at &&
        !m.dismissed,
    );
  const hasActiveMessage = (n: number) => activeMessagesByRoom(n).length > 0;
  const maintenanceRequests = (maintenanceRequestsQ.data ?? []) as MaintenanceRequest[];
  const openMaintenanceCount = maintenanceRequests.filter((m) => !m.done).length;
  const hasOpenMaintenance = openMaintenanceCount > 0;

  const [newMessageText, setNewMessageText] = useState("");

  // Auto-assign the Double bed type to Double rooms so exports/status reflect the
  // fixed bed configuration without Reception having to click anything.
  useEffect(() => {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const doubleBed = receptionBeds.find((b) => norm(b.label) === "double");
    if (!doubleBed) return;
    const targets = rooms.filter((r) => {
      const cats = parseCats(r.category).map(norm);
      return cats.includes("double") && !cats.includes("superking") && r.reception_bed_id !== doubleBed.id;
    });
    if (targets.length === 0) return;
    for (const r of targets) {
      void setRoomReceptionBed(r.room_number, doubleBed.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms, receptionBeds]);

  const submitRoomMessage = async (roomNumber: number) => {
    const text = newMessageText.trim();
    if (!text) return;
    const { error } = await supabase.from("room_messages" as never).insert({
      room_number: roomNumber,
      message: text,
      created_by_username: authUser?.username ?? null,
      created_by_role: isReception ? "reception" : (isHousekeeper ? "housekeeping" : (authUser?.role ?? null)),
      thread: "hk_reception",
    } as never);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewMessageText("");
    qc.invalidateQueries({ queryKey: ["room_messages"] });
    toast.success("Message sent");
    fireRoomNotification("message", roomNumber, text);
  };

  const dismissRoomMessage = async (id: string) => {
    qc.setQueryData<RoomMessage[]>(["room_messages"], (old) =>
      old?.map((m) => (m.id === id ? { ...m, dismissed: true, done_at: new Date().toISOString() } : m)) ?? [],
    );
    const { error } = await supabase
      .from("room_messages" as never)
      .update({ dismissed: true, done_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never)
      .eq("id", id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["room_messages"] });
  };

  const confirmRoomMessage = async (m: RoomMessage) => {
    const who = authUser?.username ?? "Housekeeping";
    const ack = `✓ Received & actioned by ${who}: ${m.message}`;
    const { error } = await supabase.from("room_messages" as never).insert({
      room_number: m.room_number,
      message: ack,
      created_by_username: who,
      created_by_role: "housekeeping",
      reply_to_id: m.id,
      thread: "hk_reception",
    } as never);
    if (error) {
      toast.error(error.message);
      return;
    }
    await dismissRoomMessage(m.id);
    toast.success("Confirmation sent to reception");
  };

  const deleteRoomMessage = async (id: string) => {
    qc.setQueryData<RoomMessage[]>(["room_messages"], (old) =>
      old?.filter((m) => m.id !== id) ?? [],
    );
    const { error } = await supabase
      .from("room_messages" as never)
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never)
      .eq("id", id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["room_messages"] });
  };

  const confirmHousekeepingNote = async (roomNumber: number, note: string) => {
    const who = authUser?.username ?? "Reception";
    const ack = `✓ Received & actioned by ${who}: ${note}`;
    const { error } = await supabase.from("room_messages" as never).insert({
      room_number: roomNumber,
      message: ack,
      created_by_username: who,
      created_by_role: "reception",
      thread: "hk_reception",
    } as never);
    if (error) {
      toast.error(error.message);
      return;
    }
    await setRoomHousekeepingNote(roomNumber, "");
    toast.success("Confirmation sent to housekeeping");
  };

  const submitMaintenanceRequest = async () => {
    const roomNumber = Number(newMaintenanceRoom);
    const text = newMaintenanceText.trim();
    if (!Number.isFinite(roomNumber) || roomNumber <= 0) {
      toast.error("Pick a room");
      return;
    }
    if (!text) {
      toast.error("Add a message");
      return;
    }
    const { data: inserted, error } = await supabase
      .from("maintenance_requests" as never)
      .insert({
        room_number: roomNumber,
        message: text,
        created_by_username: authUser?.username ?? null,
      } as never)
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    const newId = (inserted as { id: string } | null)?.id;
    if (newId && newMaintenancePhotos.length > 0) {
      const { uploadEntryPhotos } = await import("@/lib/entry-photos");
      const { paths, errors } = await uploadEntryPhotos(
        "maintenance",
        newId,
        newMaintenancePhotos,
      );
      if (errors.length > 0) toast.error(`Photo upload: ${errors[0]}`);
      if (paths.length > 0) {
        await supabase
          .from("maintenance_requests" as never)
          .update({ photo_paths: paths } as never)
          .eq("id", newId);
      }
    }
    setNewMaintenanceRoom("");
    setNewMaintenanceText("");
    setNewMaintenancePhotos([]);
    qc.invalidateQueries({ queryKey: ["maintenance_requests"] });
    await writeRoomMaintenanceFlag(roomNumber, true);
    void notifyMaintenanceRequest({ data: { roomNumber, message: text } });
    toast.success("Maintenance request logged");
  };

  const setMaintenancePhotoPaths = async (id: string, paths: string[]) => {
    qc.setQueryData<MaintenanceRequest[]>(["maintenance_requests"], (old) =>
      old?.map((m) => (m.id === id ? { ...m, photo_paths: paths } : m)) ?? [],
    );
    const { error } = await supabase
      .from("maintenance_requests" as never)
      .update({ photo_paths: paths } as never)
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["maintenance_requests"] });
    }
  };

  // Low-level: write rooms.needs_maintenance without triggering the
  // maintenance-log sync in setRoomNeedsMaintenance.
  const writeRoomMaintenanceFlag = async (roomNumber: number, value: boolean) => {
    qc.setQueryData<Room[]>(["rooms"], (old) => {
      const list = old ? [...old] : [];
      const idx = list.findIndex((r) => r.room_number === roomNumber);
      if (idx >= 0) list[idx] = { ...list[idx], needs_maintenance: value };
      return list;
    });
    const { error } = await supabase.from("rooms").upsert(
      {
        room_number: roomNumber,
        needs_maintenance: value,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "user_id,room_number" },
    );
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["rooms"] });
  };

  const clearRoomFlagIfNoOpenRequests = async (roomNumber: number) => {
    const stillOpen = (qc.getQueryData<MaintenanceRequest[]>(["maintenance_requests"]) ?? [])
      .some((m) => m.room_number === roomNumber && !m.done);
    if (stillOpen) return;
    const room = (qc.getQueryData<Room[]>(["rooms"]) ?? []).find((r) => r.room_number === roomNumber);
    if (room?.needs_maintenance) await writeRoomMaintenanceFlag(roomNumber, false);
  };

  const markMaintenanceDone = async (id: string) => {
    const who = authUser?.username ?? (isMaintenance ? "Maintenance" : "Reception");
    const target = (qc.getQueryData<MaintenanceRequest[]>(["maintenance_requests"]) ?? [])
      .find((m) => m.id === id);
    qc.setQueryData<MaintenanceRequest[]>(["maintenance_requests"], (old) =>
      old?.map((m) =>
        m.id === id
          ? { ...m, done: true, done_by_username: who, done_at: new Date().toISOString() }
          : m,
      ) ?? [],
    );
    const { error } = await supabase
      .from("maintenance_requests" as never)
      .update({ done: true, done_by_username: who, done_at: new Date().toISOString() } as never)
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["maintenance_requests"] });
      return;
    }
    qc.invalidateQueries({ queryKey: ["maintenance_requests"] });
    if (target) await clearRoomFlagIfNoOpenRequests(target.room_number);
  };

  const deleteMaintenanceRequest = async (id: string) => {
    const target = (qc.getQueryData<MaintenanceRequest[]>(["maintenance_requests"]) ?? [])
      .find((m) => m.id === id);
    qc.setQueryData<MaintenanceRequest[]>(["maintenance_requests"], (old) =>
      old?.filter((m) => m.id !== id) ?? [],
    );
    const { error } = await supabase
      .from("maintenance_requests" as never)
      .delete()
      .eq("id", id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["maintenance_requests"] });
    if (target) await clearRoomFlagIfNoOpenRequests(target.room_number);
  };

  const getRejectCount = (templateItemId: string) =>
    rejects.find((r) => r.template_item_id === templateItemId)?.count ?? 0;

  const updateRejectCount = async (templateItemId: string, delta: number) => {
    const current = getRejectCount(templateItemId);
    const next = Math.max(0, current + delta);
    if (next === current) return;
    qc.setQueryData<RejectCount[]>(["reject_counts"], (old) => {
      const list = old ? [...old] : [];
      const idx = list.findIndex((r) => r.template_item_id === templateItemId);
      if (idx >= 0) list[idx] = { ...list[idx], count: next };
      else list.push({ id: `temp-${templateItemId}`, template_item_id: templateItemId, count: next });
      return list;
    });
    const { error } = await supabase
      .from("reject_counts" as never)
      .upsert(
        { template_item_id: templateItemId, count: next, updated_at: new Date().toISOString() } as never,
        { onConflict: "user_id,template_item_id" },
      );
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["reject_counts"] });
    }
  };

  const resetRejects = async () => {
    if (!confirm("Reset all reject tallies?")) return;
    qc.setQueryData<RejectCount[]>(["reject_counts"], []);
    const { error } = await supabase
      .from("reject_counts" as never)
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["reject_counts"] });
  };
   const position = authUser?.position;
   const subRoles = authUser?.subRoles ?? [];
   const realIsAdmin = position === "admin";
   const realIsManager = position === "manager";
   const hasReceptionRole = subRoles.includes("reception");
   const hasHousekeeperRole = subRoles.includes("housekeeper");
   const hasFnbRole = subRoles.includes("fnb");
   const hasMaintenanceRole = subRoles.includes("maintenance");
    // Which view-as options this account can actually pick. Only sub-role
    // views appear as pills; admins/managers return to their default view
    // by toggling the active pill off.
     const availableViews: ViewRole[] = (() => {
       const out: ViewRole[] = [];
       if (hasHousekeeperRole) out.push("user");
       if (hasReceptionRole) out.push("reception");
       if (hasFnbRole) out.push("fnb");
       if (hasMaintenanceRole) out.push("maintenance");
       return out;
     })();
   // Default view when no "view as" is set.
   const defaultView: ViewRole | undefined = (() => {
      // If the account has F&B assigned but no other operational sub-role
      // (housekeeper/reception), default them to the F&B home view — even if
      // their position is admin/manager. They can still switch views if
      // multiple are available.
      if (hasFnbRole && !hasHousekeeperRole && !hasReceptionRole) return "fnb";
      if (hasMaintenanceRole && !hasHousekeeperRole && !hasReceptionRole && !hasFnbRole) return "maintenance";
     if (realIsAdmin) return "admin";
     if (realIsManager) return "manager";
     if (position === "user") {
       if (hasHousekeeperRole) return "user";
       if (hasReceptionRole) return "reception";
       if (hasFnbRole) return "fnb";
       if (hasMaintenanceRole) return "maintenance";
     }
     return undefined;
   })();
    // Show the switcher when there's at least one sub-role pill and either
    // the user is admin/manager (needs to swap in and out of default) or
    // they have multiple sub-role options.
     const canViewAs = availableViews.length >= 2;
   const safeViewAs: ViewRole | null =
     viewAsRole && availableViews.includes(viewAsRole) ? viewAsRole : null;
   const effectiveRole: ViewRole | undefined =
     canViewAs && safeViewAs ? safeViewAs : defaultView;
   const realRole: ViewRole | undefined = defaultView;
   const isReception = effectiveRole === "reception";
    // A real admin/manager keeps admin capabilities in every view — the
    // pill only changes which home screen they land on.
    const isAdmin = realIsAdmin || realIsManager;
   const isHousekeeper = effectiveRole === "user";
   const isFnb = effectiveRole === "fnb";
   const isMaintenance = effectiveRole === "maintenance";
    // Settings-menu permissions: derived from real position/sub-roles,
    // not the active home-screen pill. The settings menu should stay the
    // same regardless of which view the user is currently in.
    const menuIsAdmin = realIsAdmin || realIsManager;
    const menuHasFnb = menuIsAdmin || hasFnbRole;
    const menuHasHk = menuIsAdmin || hasHousekeeperRole;
    const menuHasMaintenance = menuIsAdmin || hasMaintenanceRole;
    // Lost Property log is only meaningful to Reception + Housekeeping.
    const menuCanUseLostProperty = menuIsAdmin || hasReceptionRole || hasHousekeeperRole;
    // Reception can resolve entries; Housekeeping views them read-only.
    const canResolveLostProperty = menuIsAdmin || hasReceptionRole;
    const availableThreads: MessagesThread[] = (() => {
      const out: MessagesThread[] = [];
      // Messaging rules:
      // 1. Users can only message departments they are assigned to.
      // 2. Every department can also message Reception (universal hub),
      //    and Reception can message every department.
      // 3. Maintenance can message Housekeeping and Reception. F&B cannot
      //    Maintenance can also message F&B directly.
      // Admins/managers keep access to all threads for oversight.
      const isReceptionUser = hasReceptionRole;
      const reachable = new Set<MessagesDepartment>();
      if (hasHousekeeperRole) reachable.add("housekeeping");
      if (hasReceptionRole) reachable.add("reception");
      if (hasFnbRole) reachable.add("fnb");
      if (hasMaintenanceRole) reachable.add("maintenance");
      // Rule 2: reception is always reachable for anyone with any department.
      if (reachable.size > 0) reachable.add("reception");
      // Rule 3: HK and Reception can always reach Maintenance for oversight.
      if (hasHousekeeperRole || hasReceptionRole || hasMaintenanceRole) reachable.add("maintenance");
      // Maintenance can reach every department directly, including F&B.
      if (hasMaintenanceRole) {
        reachable.add("housekeeping");
        reachable.add("fnb");
      }
      if (hasFnbRole) reachable.add("maintenance");
      const bothReachable = (a: MessagesDepartment, b: MessagesDepartment) =>
        menuIsAdmin || isReceptionUser || (reachable.has(a) && reachable.has(b));
      if (bothReachable("housekeeping", "reception")) out.push("hk_reception");
      if (bothReachable("housekeeping", "fnb")) out.push("hk_fnb");
      if (bothReachable("reception", "fnb")) out.push("reception_fnb");
      if (bothReachable("housekeeping", "maintenance")) out.push("hk_maintenance");
      if (bothReachable("reception", "maintenance")) out.push("reception_maintenance");
      if (bothReachable("fnb", "maintenance")) out.push("fnb_maintenance");
      return out;
    })();
    const canUseMessages = availableThreads.length > 0;
    const myMessageDepartments: MessagesDepartment[] = (() => {
      const out: MessagesDepartment[] = [];
      if (hasHousekeeperRole) out.push("housekeeping");
      if (hasReceptionRole) out.push("reception");
      if (hasFnbRole) out.push("fnb");
      if (hasMaintenanceRole) out.push("maintenance");
      return out;
    })();
    const menuIsFnbOnly =
      position === "user" && hasFnbRole && !hasHousekeeperRole && !hasReceptionRole;
    const logLostProperty = async (
      roomNumber: number | null,
      message: string,
      photos: File[] = [],
    ) => {
      const senderRole =
        myMessageDepartments.includes("housekeeping") && !myMessageDepartments.includes("reception")
          ? "housekeeping"
          : myMessageDepartments.includes("reception")
          ? "reception"
          : myMessageDepartments[0] ?? null;
      const { data, error } = await supabase
        .from("lost_property" as never)
        .insert({
          room_number: roomNumber,
          message,
          created_by_username: authUser?.username ?? null,
          created_by_role: senderRole,
        } as never)
        .select("id")
        .single();
      if (error) return { ok: false as const, error: error.message };
      const newId = (data as { id: string } | null)?.id;
      if (newId && photos.length > 0) {
        const { uploadEntryPhotos } = await import("@/lib/entry-photos");
        const { paths, errors } = await uploadEntryPhotos("lost_property", newId, photos);
        if (errors.length > 0) toast.error(`Photo upload: ${errors[0]}`);
        if (paths.length > 0) {
          await supabase
            .from("lost_property" as never)
            .update({ photo_paths: paths, updated_at: new Date().toISOString() } as never)
            .eq("id", newId);
        }
      }
      qc.invalidateQueries({ queryKey: ["lost_property"] });
      return { ok: true as const };
    };
  const doneSet = new Set(
    rooms
      .filter((r) => (isReception ? r.done_reception : r.done))
      .map((r) => r.room_number),
  );
  const receptionDoneSet = new Set(
    rooms.filter((r) => r.done_reception).map((r) => r.room_number),
  );
  const roomsWithCounts = new Set<number>(
    counts.filter((c) => (c.count ?? 0) > 0).map((c) => c.room_number),
  );
  type RoomTileState = "todo" | "progress" | "done" | "complete";
  const getRoomTileState = (n: number, isDone: boolean): RoomTileState => {
    const hasCounts = roomsWithCounts.has(n);
    if (isDone && hasCounts) return "complete";
    if (isDone) return "done";
    if (hasCounts) return "progress";
    return "todo";
  };
  const roomStateMeta: Record<
    RoomTileState,
    { bg: string; fg: string; accent: string; label: string }
  > = {
    todo:     { bg: "var(--room-todo)",     fg: "var(--room-todo-fg)",     accent: "var(--room-todo-accent)",     label: "Stayover\n" },
    progress: { bg: "var(--room-progress)", fg: "var(--room-progress-fg)", accent: "var(--room-progress-accent)", label: "Cleaning in progress" },
    done:     { bg: "var(--room-done)", fg: "var(--room-done-fg)", accent: "var(--room-done-accent)", label: "Clean" },
    complete: { bg: "var(--room-done)", fg: "var(--room-done-fg)", accent: "var(--room-done-accent)", label: "Cleaned & Ready for Guest" },
  };

  const toggleReceptionDone = async (roomNumber: number) => {
    const current = receptionDoneSet.has(roomNumber);
    const next = !current;
    qc.setQueryData<Room[]>(["rooms"], (old) => {
      const list = old ? [...old] : [];
      const idx = list.findIndex((r) => r.room_number === roomNumber);
      if (idx >= 0) list[idx] = { ...list[idx], done_reception: next };
      else
        list.push({
          id: `temp-${roomNumber}`,
          room_number: roomNumber,
          done: false,
          done_reception: next,
          default_status: null,
          category: null,
          reception_status_id: null,
          reception_bed_id: null, housekeeping_note: null, needs_maintenance: false, guest_vacated: false, early_check_in: false,
        });
      return list;
    });
    const { error } = await supabase.from("rooms").upsert(
      { room_number: roomNumber, done_reception: next, updated_at: new Date().toISOString() },
      { onConflict: "user_id,room_number" },
    );
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["rooms"] });
    if (next) fireRoomNotification("done", roomNumber);
  };

  const isAssigned = (templateItemId: string, roomNumber: number) =>
    assignments.some(
      (a) => a.template_item_id === templateItemId && a.room_number === roomNumber,
    );

  const toggleAssignment = async (templateItemId: string, roomNumber: number) => {
    const existing = assignments.find(
      (a) => a.template_item_id === templateItemId && a.room_number === roomNumber,
    );
    if (existing) {
      qc.setQueryData<TemplateItemRoom[]>(["template_item_rooms"], (old) =>
        old?.filter((a) => a.id !== existing.id) ?? [],
      );
      const { error } = await supabase
        .from("template_item_rooms")
        .delete()
        .eq("id", existing.id);
      if (error) {
        toast.error(error.message);
        qc.invalidateQueries({ queryKey: ["template_item_rooms"] });
      }
    } else {
      const tempId = `temp-${templateItemId}-${roomNumber}`;
      qc.setQueryData<TemplateItemRoom[]>(["template_item_rooms"], (old) => [
        ...(old ?? []),
        { id: tempId, template_item_id: templateItemId, room_number: roomNumber },
      ]);
      const { error } = await supabase
        .from("template_item_rooms")
        .insert({ template_item_id: templateItemId, room_number: roomNumber });
      if (error) toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["template_item_rooms"] });
    }
  };

  const assignAllRooms = async (templateItemId: string) => {
    if (!confirm("Add this item to every room?")) return;
    const missing = rooms
      .map((r) => r.room_number)
      .filter((n) => !isAssigned(templateItemId, n));
    if (missing.length === 0) return;
    qc.setQueryData<TemplateItemRoom[]>(["template_item_rooms"], (old) => [
      ...(old ?? []),
      ...missing.map((n) => ({
        id: `temp-${templateItemId}-${n}`,
        template_item_id: templateItemId,
        room_number: n,
      })),
    ]);
    const { error } = await supabase
      .from("template_item_rooms")
      .insert(missing.map((n) => ({ template_item_id: templateItemId, room_number: n })));
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["template_item_rooms"] });
  };

  const removeAllRooms = async (templateItemId: string) => {
    if (!confirm("Remove this item from all rooms?")) return;
    const existing = assignments.filter((a) => a.template_item_id === templateItemId);
    if (existing.length === 0) return;
    qc.setQueryData<TemplateItemRoom[]>(["template_item_rooms"], (old) =>
      old?.filter((a) => a.template_item_id !== templateItemId) ?? [],
    );
    const { error } = await supabase
      .from("template_item_rooms")
      .delete()
      .eq("template_item_id", templateItemId);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["template_item_rooms"] });
  };

 const getCount = (roomNumber: number, kind: "template" | "extra", itemId: string) =>
 counts.find(
 (c) => c.room_number === roomNumber && c.item_kind === kind && c.item_id === itemId,
 )?.count ?? 0;

 // --- Template item mutations ---
  const addTemplateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newTemplateName.trim();
    if (!name) return;
    const category = roomTypes[0]?.value ?? "double";
    const maxPos = templateAll
      .filter((t) => t.list_type === linenListType && t.category === category)
      .reduce((m, t) => Math.max(m, t.position), 0);
    setNewTemplateName("");
    const { error } = await supabase
      .from("template_items")
      .insert({ name, category, position: maxPos + 1, list_type: linenListType });
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["template_items"] });
  };

 const deleteTemplateItem = async (id: string) => {
 qc.setQueryData<TemplateItem[]>(["template_items"], (old) =>
 old?.filter((i) => i.id !== id) ?? [],
 );
 qc.setQueryData<RoomCount[]>(["room_counts"], (old) =>
 old?.filter((c) => !(c.item_kind === "template" && c.item_id === id)) ?? [],
 );
 const { error } = await supabase.from("template_items").delete().eq("id", id);
 if (error) {
 toast.error(error.message);
 qc.invalidateQueries({ queryKey: ["template_items"] });
 qc.invalidateQueries({ queryKey: ["room_counts"] });
 }
 };

 const moveTemplateItem = async (id: string, dir: -1 | 1) => {
 const item = template.find((t) => t.id === id);
 if (!item) return;
 const siblings = template
 .filter((t) => t.category === item.category)
 .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
 const idx = siblings.findIndex((t) => t.id === id);
 const swapIdx = idx + dir;
 if (swapIdx < 0 || swapIdx >= siblings.length) return;
 const other = siblings[swapIdx];
 qc.setQueryData<TemplateItem[]>(["template_items"], (old) =>
 old?.map((t) =>
 t.id === item.id ? { ...t, position: other.position }
 : t.id === other.id ? { ...t, position: item.position }
 : t,
 ) ?? [],
 );
 const [r1, r2] = await Promise.all([
 supabase.from("template_items").update({ position: other.position }).eq("id", item.id),
 supabase.from("template_items").update({ position: item.position }).eq("id", other.id),
 ]);
 if (r1.error || r2.error) toast.error((r1.error ?? r2.error)!.message);
 qc.invalidateQueries({ queryKey: ["template_items"] });
 };

 // --- Room extras ---

  const setTemplateDefault = async (id: string, value: number) => {
    const next = Math.max(0, Math.floor(value) || 0);
    qc.setQueryData<TemplateItem[]>(["template_items"], (old) =>
      old?.map((t) => (t.id === id ? { ...t, default_count: next } : t)) ?? [],
    );
    const { error } = await supabase
      .from("template_items")
      .update({ default_count: next })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["template_items"] });
    }
  };

  const setTemplateColor = async (id: string, color: ItemColor | null) => {
    qc.setQueryData<TemplateItem[]>(["template_items"], (old) =>
      old?.map((t) => (t.id === id ? { ...t, color } : t)) ?? [],
    );
    const { error } = await supabase
      .from("template_items")
      .update({ color } as never)
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["template_items"] });
    }
  };

  const renameTemplateItem = async (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setEditingItemId(null);
      return;
    }
    qc.setQueryData<TemplateItem[]>(["template_items"], (old) =>
      old?.map((t) => (t.id === id ? { ...t, name: trimmed } : t)) ?? [],
    );
    setEditingItemId(null);
    const { error } = await supabase
      .from("template_items")
      .update({ name: trimmed })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["template_items"] });
    }
  };

 const deleteExtra = async (id: string) => {
 qc.setQueryData<RoomExtra[]>(["room_extras"], (old) =>
 old?.filter((e) => e.id !== id) ?? [],
 );
 qc.setQueryData<RoomCount[]>(["room_counts"], (old) =>
 old?.filter((c) => !(c.item_kind === "extra" && c.item_id === id)) ?? [],
 );
 const { error } = await supabase.from("room_extra_items").delete().eq("id", id);
 if (error) {
 toast.error(error.message);
 qc.invalidateQueries({ queryKey: ["room_extras"] });
 qc.invalidateQueries({ queryKey: ["room_counts"] });
 }
 };

 // --- Count updates ---
 const updateCount = async (
 roomNumber: number,
 kind: "template" | "extra",
 itemId: string,
 delta: number,
 ) => {
 const current = getCount(roomNumber, kind, itemId);
 const next = Math.max(0, current + delta);
 if (next === current) return;

 qc.setQueryData<RoomCount[]>(["room_counts"], (old) => {
 const list = old ? [...old] : [];
 const idx = list.findIndex(
 (c) => c.room_number === roomNumber && c.item_kind === kind && c.item_id === itemId,
 );
 if (idx >= 0) list[idx] = { ...list[idx], count: next };
 else
 list.push({
 id: `temp-${roomNumber}-${kind}-${itemId}`,
 room_number: roomNumber,
 item_kind: kind,
 item_id: itemId,
 count: next,
 });
 return list;
 });

 const { error } = await supabase
 .from("room_item_counts")
 .upsert(
 {
 room_number: roomNumber,
 item_kind: kind,
 item_id: itemId,
 count: next,
 updated_at: new Date().toISOString(),
 },
 { onConflict: "user_id,room_number,item_kind,item_id" },
 );
 if (error) {
 toast.error(error.message);
 qc.invalidateQueries({ queryKey: ["room_counts"] });
 }

  // Auto-mark room as done when any item becomes positive.
  if (next > 0) {
  const room = rooms.find((r) => r.room_number === roomNumber);
  if (!room?.done) {
  qc.setQueryData<Room[]>(["rooms"], (old) => {
  const list = old ? [...old] : [];
  const idx = list.findIndex((r) => r.room_number === roomNumber);
  if (idx >= 0) list[idx] = { ...list[idx], done: true };
  else list.push({ id: `temp-${roomNumber}`, room_number: roomNumber, done: true, done_reception: false, category: null, default_status: null, reception_status_id: null, reception_bed_id: null, housekeeping_note: null, needs_maintenance: false, guest_vacated: false, early_check_in: false });
  return list;
  });
  const { error: roomErr } = await supabase.from("rooms").upsert(
  { room_number: roomNumber, done: true, updated_at: new Date().toISOString() },
  { onConflict: "user_id,room_number" },
  );
  if (roomErr) toast.error(roomErr.message);
  qc.invalidateQueries({ queryKey: ["rooms"] });
  }
  }

  // Auto-mark room as not done when no items have counts above default.
  const roomCountsAfter = (qc.getQueryData<RoomCount[]>(["room_counts"]) ?? [])
  .filter((c) => c.room_number === roomNumber);
  const anyMarked = roomCountsAfter.some((c) => c.count > 0);
  if (!anyMarked) {
  const room = rooms.find((r) => r.room_number === roomNumber);
  if (room?.done) {
  qc.setQueryData<Room[]>(["rooms"], (old) => {
  const list = old ? [...old] : [];
  const idx = list.findIndex((r) => r.room_number === roomNumber);
  if (idx >= 0) list[idx] = { ...list[idx], done: false };
  return list;
  });
  const { error: roomErr } = await supabase.from("rooms").upsert(
  { room_number: roomNumber, done: false, updated_at: new Date().toISOString() },
  { onConflict: "user_id,room_number" },
  );
  if (roomErr) toast.error(roomErr.message);
  qc.invalidateQueries({ queryKey: ["rooms"] });
  }
  }
  };


 const openOrToggle = (roomNumber: number) => {
    if (openRoom === roomNumber) {
      setOpenRoom(null);
      return;
    }
    setOpenRoom(roomNumber);
  };

  const resetRoomCounts = async (roomNumber: number) => {
    qc.setQueryData<RoomCount[]>(["room_counts"], (old) =>
      old?.filter((c) => c.room_number !== roomNumber) ?? [],
    );
    const { error } = await supabase
      .from("room_item_counts")
      .delete()
      .eq("room_number", roomNumber);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["room_counts"] });

    // Mark room as not done since all counts are reset.
    const room = rooms.find((r) => r.room_number === roomNumber);
    if (room?.done) {
      qc.setQueryData<Room[]>(["rooms"], (old) => {
        const list = old ? [...old] : [];
        const idx = list.findIndex((r) => r.room_number === roomNumber);
        if (idx >= 0) list[idx] = { ...list[idx], done: false };
        return list;
      });
      const { error: roomErr } = await supabase.from("rooms").upsert(
        { room_number: roomNumber, done: false, updated_at: new Date().toISOString() },
        { onConflict: "user_id,room_number" },
      );
      if (roomErr) toast.error(roomErr.message);
      qc.invalidateQueries({ queryKey: ["rooms"] });
    }
  };

  const resetAll = async () => {
    if (!confirm("Reset done state, counts, and quick status setup for all rooms?")) return;
    qc.setQueryData<Room[]>(["rooms"], (old) =>
      old?.map((r) => ({
        ...r,
        done: false,
        done_reception: false,
        housekeeping_note: null, needs_maintenance: false, guest_vacated: false, early_check_in: false,
        reception_status_id: null,
        reception_bed_id: null,
      })) ?? [],
    );
    qc.setQueryData<RoomCount[]>(["room_counts"], () => []);
    const r1 = await supabase.from("rooms").update({
      done: false,
      done_reception: false,
      housekeeping_note: null, needs_maintenance: false, guest_vacated: false, early_check_in: false,
      reception_status_id: null,
      reception_bed_id: null,
    }).neq("room_number", -1);
    if (r1.error) toast.error(r1.error.message);
    const r2 = await supabase.from("room_item_counts").delete().neq("room_number", -1);
    if (r2.error) toast.error(r2.error.message);
    qc.invalidateQueries({ queryKey: ["rooms"] });
    qc.invalidateQueries({ queryKey: ["room_counts"] });
  };

  const resetReceptionAll = async () => {
    if (!confirm("Reset reception status and bed selections for all rooms?")) return;
    const dndId = receptionStatuses.find((x) => x.label === "DND")?.id ?? null;
    const stayId = receptionStatuses.find((x) => x.label === "Stayover")?.id ?? null;
    const dndRoomNumbers = dndId
      ? rooms.filter((r) => r.reception_status_id === dndId).map((r) => r.room_number)
      : [];
    qc.setQueryData<Room[]>(["rooms"], (old) =>
      old?.map((r) => ({
        ...r,
        done: false,
        done_reception: false,
        housekeeping_note: null,
        needs_maintenance: false,
        guest_vacated: false, early_check_in: false,
        reception_status_id:
          dndId && r.reception_status_id === dndId && stayId ? stayId : null,
        reception_bed_id: null,
      })) ?? [],
    );
    const { error } = await supabase
      .from("rooms")
      .update({ done: false, done_reception: false, reception_status_id: null, reception_bed_id: null, housekeeping_note: null, needs_maintenance: false, guest_vacated: false, early_check_in: false })
      .neq("room_number", -1)
    if (error) toast.error(error.message);
    if (dndRoomNumbers.length > 0) {
      const { error: e2 } = await supabase
        .from("rooms")
        .update({ done: false, done_reception: false, reception_status_id: stayId ?? null, reception_bed_id: null, housekeeping_note: null, needs_maintenance: false, guest_vacated: false, early_check_in: false })
        .in("room_number", dndRoomNumbers);
      if (e2) toast.error(e2.message);
    }
    qc.invalidateQueries({ queryKey: ["rooms"] });
  };

  // --- Export totals + snapshots ---
  const addRoom = async (n: number) => {
    if (!Number.isFinite(n) || n < 1 || n > 999) {
      toast.error("Room number must be between 1 and 999.");
      return;
    }
    if (rooms.some((r) => r.room_number === n)) {
      toast.error(`Room ${n} already exists.`);
      return;
    }
    const nextSort = (rooms.reduce((m, r) => Math.max(m, r.sort_order ?? r.room_number), 0)) + 1;
    qc.setQueryData<Room[]>(["rooms"], (old) => {
      const list = old ? [...old] : [];
      list.push({ id: `temp-${n}`, room_number: n, sort_order: nextSort, done: false, done_reception: false, category: null, default_status: null, reception_status_id: null, reception_bed_id: null, housekeeping_note: null, needs_maintenance: false, guest_vacated: false, early_check_in: false });
      list.sort((a, b) => (a.sort_order ?? a.room_number) - (b.sort_order ?? b.room_number));
      return list;
    });
    const { error } = await supabase.from("rooms").upsert(
      { room_number: n, sort_order: nextSort, done: false, done_reception: false, updated_at: new Date().toISOString() },
      { onConflict: "user_id,room_number" },
    );
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Room ${n} added.`);
    }
    qc.invalidateQueries({ queryKey: ["rooms"] });
  };

  const removeRoom = async (n: number) => {
    if (!confirm(`Remove Room ${n}? This will delete its counts, linen assignments, and messages.`)) return;
    qc.setQueryData<Room[]>(["rooms"], (old) => old?.filter((r) => r.room_number !== n) ?? []);
    qc.setQueryData<RoomCount[]>(["room_counts"], (old) => old?.filter((c) => c.room_number !== n) ?? []);
    qc.setQueryData<TemplateItemRoom[]>(["template_item_rooms"], (old) => old?.filter((a) => a.room_number !== n) ?? []);
    const results = await Promise.all([
      supabase.from("room_item_counts").delete().eq("room_number", n),
      supabase.from("template_item_rooms").delete().eq("room_number", n),
      supabase.from("room_extra_items").delete().eq("room_number", n),
      supabase.from("room_messages" as never).delete().eq("room_number", n),
      supabase.from("rooms").delete().eq("room_number", n),
    ]);
    for (const r of results) {
      if (r.error) toast.error(r.error.message);
    }
    qc.invalidateQueries({ queryKey: ["rooms"] });
    qc.invalidateQueries({ queryKey: ["room_counts"] });
    qc.invalidateQueries({ queryKey: ["template_item_rooms"] });
    qc.invalidateQueries({ queryKey: ["room_extras"] });
    qc.invalidateQueries({ queryKey: ["room_messages"] });
  };

  const moveRoom = async (roomNumber: number, direction: -1 | 1) => {
    const sorted = [...rooms].sort(
      (a, b) => (a.sort_order ?? a.room_number) - (b.sort_order ?? b.room_number),
    );
    const idx = sorted.findIndex((r) => r.room_number === roomNumber);
    if (idx < 0) return;
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[swapIdx];
    const aSort = a.sort_order ?? a.room_number;
    const bSort = b.sort_order ?? b.room_number;
    qc.setQueryData<Room[]>(["rooms"], (old) => {
      if (!old) return old;
      return old
        .map((r) =>
          r.room_number === a.room_number
            ? { ...r, sort_order: bSort }
            : r.room_number === b.room_number
              ? { ...r, sort_order: aSort }
              : r,
        )
        .sort((x, y) => (x.sort_order ?? x.room_number) - (y.sort_order ?? y.room_number));
    });
    const results = await Promise.all([
      supabase.from("rooms").update({ sort_order: bSort }).eq("room_number", a.room_number),
      supabase.from("rooms").update({ sort_order: aSort }).eq("room_number", b.room_number),
    ]);
    for (const r of results) {
      if (r.error) toast.error(r.error.message);
    }
    qc.invalidateQueries({ queryKey: ["rooms"] });
  };

  const computeTotals = (): { rows: SnapshotRow[]; grand: number } => {
    const totals = new Map<string, number>();
    const nameFor = (c: RoomCount) => {
      if (c.item_kind === "template") return template.find((t) => t.id === c.item_id)?.name;
      return extras.find((e) => e.id === c.item_id)?.name;
    };
    for (const c of counts) {
      if (c.count <= 0) continue;
      const raw = nameFor(c);
      if (!raw) continue;
      const key = raw.trim();
      if (!key) continue;
      totals.set(key, (totals.get(key) ?? 0) + c.count);
    }
    const rows = Array.from(totals.entries())
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: "base" }))
      .map(([name, count]) => ({ name, count }));
    const grand = rows.reduce((s, r) => s + r.count, 0);
    return { rows, grand };
  };

  const pruneSnapshots = async (
    kind: "totals" | "rejects" | "room_status" | "maintenance" | "fnb_totals",
  ) => {
    const { data } = await supabase
      .from("export_snapshots")
      .select("id,created_at")
      .eq("kind", kind)
      .order("created_at", { ascending: false })
      .limit(500);
    if (!data) return;
    const byDay = new Map<string, number>();
    const keep = new Set<string>();
    for (const r of data) {
      const day = new Date(r.created_at).toDateString();
      const seen = byDay.get(day);
      if (seen === undefined && byDay.size >= 6) continue;
      const next = (seen ?? 0) + 1;
      if (next > 6) continue;
      byDay.set(day, next);
      keep.add(r.id);
    }
    const remove = data.filter((r) => !keep.has(r.id)).map((r) => r.id);
    if (remove.length > 0) {
      await supabase.from("export_snapshots").delete().in("id", remove);
    }
  };

  const openExport = async () => {
    const { rows } = computeTotals();
    if (rows.length === 0) {
      setExportOpen(true);
      return;
    }
    const today = new Date().toDateString();
    const todays = snapshots.filter(
      (s) => s.kind === "totals" && new Date(s.created_at).toDateString() === today,
    );
    if (todays.length > 0) {
      setConfirmOverwrite({ kind: "totals" });
      return;
    }
    await proceedExport("totals");
  };

  const proceedExport = async (
    kind: "totals" | "rejects" | "room_status" | "maintenance" | "fnb_totals",
  ) => {
    const computed =
      kind === "totals"
        ? computeTotals()
        : kind === "rejects"
        ? computeRejectTotals()
        : kind === "room_status"
        ? computeRoomStatus()
        : kind === "fnb_totals"
        ? computeFnbTotals()
        : computeMaintenance();
    const rows = computed.rows as SnapshotRow[] | RoomStatusRow[] | MaintenanceRow[];
    const grand = computed.grand;
    if (rows.length === 0) {
      if (kind === "totals") setExportOpen(true);
      else if (kind === "rejects") setRejectExportOpen(true);
      else if (kind === "room_status") setRoomStatusExportOpen(true);
      else if (kind === "fnb_totals") toast.error("No F&B linen counted");
      else toast.error("No rooms marked for maintenance");
      return;
    }
    const today = new Date().toDateString();
    const todays = snapshots.filter(
      (s) => s.kind === kind && new Date(s.created_at).toDateString() === today,
    );
    if (todays.length > 0) {
      const ids = todays.map((s) => s.id);
      qc.setQueryData<ExportSnapshot[]>(["export_snapshots"], (old) =>
        old?.filter((s) => !ids.includes(s.id)) ?? [],
      );
      const { error: delErr } = await supabase
        .from("export_snapshots")
        .delete()
        .in("id", ids);
      if (delErr) {
        toast.error(delErr.message);
        return;
      }
    }
    if (kind === "totals") setExportOpen(true);
    else if (kind === "rejects") setRejectExportOpen(true);
    else if (kind === "room_status") setRoomStatusExportOpen(true);
    else if (kind === "fnb_totals") printTotals(rows as SnapshotRow[], grand, new Date(), "fnb_totals");
    else printMaintenance(new Date(), rows as MaintenanceRow[]);
    const { error } = await supabase
      .from("export_snapshots")
      .insert({ totals: rows, grand_total: grand, kind } as never);
    if (error) {
      toast.error(error.message);
      return;
    }
    await pruneSnapshots(kind);
    qc.invalidateQueries({ queryKey: ["export_snapshots"] });
  };

  const computeRejectTotals = (): { rows: SnapshotRow[]; grand: number } => {
    const totals = new Map<string, number>();
    for (const r of rejects) {
      if (r.count <= 0) continue;
      const name = template.find((t) => t.id === r.template_item_id)?.name?.trim();
      if (!name) continue;
      totals.set(name, (totals.get(name) ?? 0) + r.count);
    }
    const rows = Array.from(totals.entries())
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: "base" }))
      .map(([name, count]) => ({ name, count }));
    const grand = rows.reduce((s, r) => s + r.count, 0);
    return { rows, grand };
  };

  const openRejectExport = async () => {
    const { rows } = computeRejectTotals();
    if (rows.length === 0) {
      setRejectExportOpen(true);
      return;
    }
    const today = new Date().toDateString();
    const todays = snapshots.filter(
      (s) => s.kind === "rejects" && new Date(s.created_at).toDateString() === today,
    );
    if (todays.length > 0) {
      setConfirmOverwrite({ kind: "rejects" });
      return;
    }
    await proceedExport("rejects");
  };

  const computeRoomStatus = (): {
    rows: RoomStatusRow[];
    grand: number;
  } => {
    const statusLabel = (id: string | null | undefined) => {
      if (!id) return "";
      const lbl = receptionStatuses.find((s) => s.id === id)?.label ?? "";
      if (lbl === "DND") return "Stayover";
      if (lbl.toLowerCase() === "staff") return "ROS - Staff";
      if (lbl.toLowerCase() === "dirty") return "ROS - Dirty";
      return lbl;
    };
    const bedLabel = (id: string | null | undefined) =>
      id ? receptionBeds.find((b) => b.id === id)?.label ?? "" : "";
    const rows: RoomStatusRow[] = [...rooms]
      .sort((a, b) => a.room_number - b.room_number)
      .map((r) => ({
        room: r.room_number,
        status: statusLabel(r.reception_status_id ?? r.default_status),
        bed: bedLabel(r.reception_bed_id),
        maintenance: !!r.needs_maintenance,
      }));
    return { rows, grand: rows.length };
  };

  const openRoomStatusExport = async () => {
    const { rows } = computeRoomStatus();
    if (rows.length === 0) {
      setRoomStatusExportOpen(true);
      return;
    }
    const today = new Date().toDateString();
    const todays = snapshots.filter(
      (s) =>
        s.kind === "room_status" &&
        new Date(s.created_at).toDateString() === today,
    );
    if (todays.length > 0) {
      setConfirmOverwrite({ kind: "room_status" });
      return;
    }
    await proceedExport("room_status");
  };

  const computeMaintenance = (): { rows: MaintenanceRow[]; grand: number } => {
    const rows: MaintenanceRow[] = [...rooms]
      .filter((r) => r.needs_maintenance)
      .sort((a, b) => a.room_number - b.room_number)
      .map((r) => ({ room: r.room_number, note: (r.housekeeping_note ?? "").trim() }));
    return { rows, grand: rows.length };
  };

  const computeFnbTotals = (): { rows: SnapshotRow[]; grand: number } => {
    const rows: SnapshotRow[] = [];
    for (const item of templateFnbList) {
      const count = fnbCountByItem.get(item.id) ?? 0;
      if (count <= 0) continue;
      rows.push({ name: item.name.trim(), count });
    }
    rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    const grand = rows.reduce((s, r) => s + r.count, 0);
    return { rows, grand };
  };

  const openFnbExport = async () => {
    const { rows } = computeFnbTotals();
    if (rows.length === 0) {
      toast.error("No F&B linen counted");
      return;
    }
    const today = new Date().toDateString();
    const todays = snapshots.filter(
      (s) => s.kind === "fnb_totals" && new Date(s.created_at).toDateString() === today,
    );
    if (todays.length > 0) {
      setConfirmOverwrite({ kind: "fnb_totals" });
      return;
    }
    await proceedExport("fnb_totals");
  };

  const openMaintenanceExport = async () => {
    const { rows } = computeMaintenance();
    if (rows.length === 0) {
      toast.error("No rooms marked for maintenance");
      return;
    }
    const today = new Date().toDateString();
    const todays = snapshots.filter(
      (s) =>
        s.kind === "maintenance" &&
        new Date(s.created_at).toDateString() === today,
    );
    if (todays.length > 0) {
      setConfirmOverwrite({ kind: "maintenance" });
      return;
    }
    await proceedExport("maintenance");
  };

  const deleteSnapshot = async (id: string) => {
    qc.setQueryData<ExportSnapshot[]>(["export_snapshots"], (old) =>
      old?.filter((s) => s.id !== id) ?? [],
    );
    const { error } = await supabase.from("export_snapshots").delete().eq("id", id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["export_snapshots"] });
  };

  const clearAllSnapshots = async (onlyKind?: ExportSnapshot["kind"]) => {
    if (onlyKind) {
      qc.setQueryData<ExportSnapshot[]>(["export_snapshots"], (old) =>
        (old ?? []).filter((s) => s.kind !== onlyKind),
      );
      const { error } = await supabase.from("export_snapshots").delete().eq("kind", onlyKind);
      if (error) toast.error(error.message);
    } else {
      qc.setQueryData<ExportSnapshot[]>(["export_snapshots"], []);
      const { error } = await supabase.from("export_snapshots").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["export_snapshots"] });
  };

  const removeSnapshot = async (id: string) => {
    qc.setQueryData<ExportSnapshot[]>(["export_snapshots"], (old) =>
      old?.filter((s) => s.id !== id) ?? [],
    );
    const { error } = await supabase.from("export_snapshots").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["export_snapshots"] });
    }
  };

  const printTotals = (
    rows: SnapshotRow[],
    grand: number,
    when: Date,
    kind: "totals" | "rejects" | "fnb_totals" = "totals",
  ) => {
    const dateStr = when.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const heading =
      kind === "rejects"
        ? "Three Ways House Hotel Linen Rejects"
        : kind === "fnb_totals"
        ? "Three Ways House Hotel F&B Linen"
        : "Three Ways House Hotel Linen";
    const win = window.open("", "_blank");
    if (!win) {
      toast.error("Pop-up blocked");
      return;
    }
    const esc = (s: string) =>
      s.replace(/[<>&]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[ch]!));
    const tableRows = rows
      .map((r) => `<tr><td>${esc(r.name)}</td><td class="num">${r.count}</td></tr>`)
      .join("");
    win.document.write(`<!doctype html><html><head><title>${esc(heading)} - ${dateStr}</title><style>
      body{font-family:system-ui,-apple-system,sans-serif;color:#000;background:#fff;padding:2rem;max-width:640px;margin:0 auto;}
      h1{font-size:1.5rem;margin:0 0 .25rem;}
      .date{color:#444;margin:0 0 1.5rem;font-size:.95rem;}
      table{width:100%;border-collapse:collapse;font-size:1rem;}
      th,td{text-align:left;padding:.5rem .75rem;border-bottom:1px solid #ccc;}
      th.num,td.num{text-align:right;font-variant-numeric:tabular-nums;}
      tfoot td{font-weight:600;border-top:2px solid #000;border-bottom:none;padding-top:.75rem;}
      @media print{body{padding:0;}}
    </style></head><body>
      <h1>${esc(heading)}</h1>
      <p class="date">${dateStr}</p>
      <table>
        <thead><tr><th>Item</th><th class="num">Count</th></tr></thead>
        <tbody>${tableRows}</tbody>
        <tfoot><tr><td>Total</td><td class="num">${grand}</td></tr></tfoot>
      </table>
      <script>window.onload=()=>{window.print();}</script>
    </body></html>`);
    win.document.close();
  };

  const printRoomStatus = (rows: RoomStatusRow[], when: Date) => {
    const dateStr = when.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const win = window.open("", "_blank");
    if (!win) {
      toast.error("Pop-up blocked");
      return;
    }
    const esc = (s: string) =>
      s.replace(/[<>&]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[ch]!));
    const half = Math.ceil(rows.length / 2);
    const left = rows.slice(0, half);
    const right = rows.slice(half);
    const trs = (list: RoomStatusRow[]) =>
      list
        .map(
          (r) =>
            `<tr><td class="num">${r.room}</td><td>${esc(r.status)}</td><td>${esc(r.bed)}</td></tr>`,
        )
        .join("");
    const tableHead = `<thead><tr><th>Room</th><th>Status</th><th>Set As</th></tr></thead>`;
    win.document.write(`<!doctype html><html><head><title>Room Status Sheet - ${dateStr}</title><style>
      body{font-family:system-ui,-apple-system,sans-serif;color:#000;background:#fff;padding:1.5rem;max-width:900px;margin:0 auto;}
      h1{font-size:1.5rem;margin:0 0 .25rem;text-align:center;text-decoration:underline;}
      .date{margin:0 0 1.25rem;font-size:.95rem;text-align:center;}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem;}
      table{width:100%;border-collapse:collapse;font-size:.95rem;}
      th,td{text-align:center;padding:.35rem .5rem;border:1px solid #444;}
      th.num,td.num{text-align:center;font-variant-numeric:tabular-nums;width:3rem;}
      th{background:#eee;}
      @media print{body{padding:0;}}
    </style></head><body>
      <h1>Room Status Sheet</h1>
      <p class="date">${dateStr}</p>
      <div class="grid">
        <table>${tableHead}<tbody>${trs(left)}</tbody></table>
        <table>${tableHead}<tbody>${trs(right)}</tbody></table>
      </div>
      <script>window.onload=()=>{window.print();}</script>
    </body></html>`);
    win.document.close();
  };

  const printMaintenance = (when: Date, presetList?: MaintenanceRow[]) => {
    const list =
      presetList ??
      [...rooms]
        .filter((r) => r.needs_maintenance)
        .sort((a, b) => a.room_number - b.room_number)
        .map((r) => ({ room: r.room_number, note: (r.housekeeping_note ?? "").trim() }));
    if (list.length === 0) {
      toast.error("No rooms marked for maintenance");
      return;
    }
    const dateStr = when.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const win = window.open("", "_blank");
    if (!win) {
      toast.error("Pop-up blocked");
      return;
    }
    const esc = (s: string) =>
      s.replace(/[<>&]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[ch]!));
    const trs = list
      .map(
        (r) =>
          `<tr><td class="num">${r.room}</td><td>${r.note ? esc(r.note) : '<span class="muted">—</span>'}</td></tr>`,
      )
      .join("");
    win.document.write(`<!doctype html><html><head><title>Maintenance List - ${dateStr}</title><style>
      body{font-family:system-ui,-apple-system,sans-serif;color:#000;background:#fff;padding:1.5rem;max-width:900px;margin:0 auto;}
      h1{font-size:1.5rem;margin:0 0 .25rem;text-align:center;text-decoration:underline;}
      .date{margin:0 0 1.25rem;font-size:.95rem;text-align:center;}
      table{width:100%;border-collapse:collapse;font-size:.95rem;}
      th,td{text-align:left;padding:.45rem .6rem;border:1px solid #444;vertical-align:top;}
      th.num,td.num{text-align:center;font-variant-numeric:tabular-nums;width:4rem;}
      th{background:#eee;}
      .muted{color:#666;}
      @media print{body{padding:0;}}
    </style></head><body>
      <h1>Maintenance List</h1>
      <p class="date">${dateStr}</p>
      <table><thead><tr><th class="num">Room</th><th>Maintenance note</th></tr></thead><tbody>${trs}</tbody></table>
      <script>window.onload=()=>{window.print();}</script>
    </body></html>`);
    win.document.close();
  };

 // --- Room category ---
 const toggleRoomCategory = async (roomNumber: number, value: Category) => {
 const current = parseCats(rooms.find((r) => r.room_number === roomNumber)?.category);
 const next = current.includes(value)
   ? current.filter((v) => v !== value)
   : [...current, value];
 const category = next.join(",") || null;
 qc.setQueryData<Room[]>(["rooms"], (old) => {
 const list = old ? [...old] : [];
 const idx = list.findIndex((r) => r.room_number === roomNumber);
 if (idx >= 0) list[idx] = { ...list[idx], category };
 else
 list.push({
 id: `temp-${roomNumber}`,
 room_number: roomNumber,
 done: false,
 done_reception: false,
 category,
  default_status: null,
  reception_status_id: null,
  reception_bed_id: null, housekeeping_note: null, needs_maintenance: false, guest_vacated: false, early_check_in: false,
 });
 return list;
 });
 const { error } = await supabase.from("rooms").upsert(
 {
 room_number: roomNumber,
 category,
 updated_at: new Date().toISOString(),
 },
 { onConflict: "user_id,room_number" },
 );
 if (error) toast.error(error.message);
 qc.invalidateQueries({ queryKey: ["rooms"] });
 };

 const roomCategory = (n: number): Category | null =>
 rooms.find((r) => r.room_number === n)?.category ?? null;

 const setRoomDefaultStatus = async (roomNumber: number, status: string | null) => {
   qc.setQueryData<Room[]>(["rooms"], (old) => {
     const list = old ? [...old] : [];
     const idx = list.findIndex((r) => r.room_number === roomNumber);
     if (idx >= 0) list[idx] = { ...list[idx], default_status: status };
     else
       list.push({
         id: `temp-${roomNumber}`,
         room_number: roomNumber,
         done: false,
         done_reception: false,
         category: null,
         default_status: status,
          reception_status_id: null,
          reception_bed_id: null, housekeeping_note: null, needs_maintenance: false, guest_vacated: false, early_check_in: false,
       });
     return list;
   });
   const { error } = await supabase.from("rooms").upsert(
     {
       room_number: roomNumber,
       default_status: status,
       updated_at: new Date().toISOString(),
     } as never,
      { onConflict: "user_id,room_number" },
    );
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["rooms"] });
  };

  const setRoomReceptionField = async (
    roomNumber: number,
    field: "reception_status_id" | "reception_bed_id",
    value: string | null,
  ) => {
    qc.setQueryData<Room[]>(["rooms"], (old) => {
      const list = old ? [...old] : [];
      const idx = list.findIndex((r) => r.room_number === roomNumber);
      if (idx >= 0) list[idx] = { ...list[idx], [field]: value };
      else
        list.push({
          id: `temp-${roomNumber}`,
          room_number: roomNumber,
          done: false,
          done_reception: false,
          category: null,
          default_status: null,
          reception_status_id: field === "reception_status_id" ? value : null,
          reception_bed_id: field === "reception_bed_id" ? value : null, housekeeping_note: null, needs_maintenance: false, guest_vacated: false, early_check_in: false,
        });
      return list;
    });
    const { error } = await supabase.from("rooms").upsert(
      {
        room_number: roomNumber,
        [field]: value,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "user_id,room_number" },
    );
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["rooms"] });
  };
  const setRoomReceptionStatus = (n: number, v: string | null) =>
    setRoomReceptionField(n, "reception_status_id", v);
  const setRoomReceptionBed = (n: number, v: string | null) =>
    setRoomReceptionField(n, "reception_bed_id", v);

  const setRoomHousekeepingNote = async (roomNumber: number, value: string) => {
    const clean = value.trim();
    const next = clean.length === 0 ? null : clean;
    qc.setQueryData<Room[]>(["rooms"], (old) => {
      const list = old ? [...old] : [];
      const idx = list.findIndex((r) => r.room_number === roomNumber);
      if (idx >= 0) list[idx] = { ...list[idx], housekeeping_note: next };
      else
        list.push({
          id: `temp-${roomNumber}`,
          room_number: roomNumber,
          done: false,
          done_reception: false,
          category: null,
          default_status: null,
          reception_status_id: null,
          reception_bed_id: null,
          housekeeping_note: next,
          needs_maintenance: false, guest_vacated: false, early_check_in: false,
        });
      return list;
    });
    const { error } = await supabase.from("rooms").upsert(
      {
        room_number: roomNumber,
        housekeeping_note: next,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "user_id,room_number" },
    );
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["rooms"] });
  };

  const setRoomNeedsMaintenance = async (roomNumber: number, value: boolean) => {
    qc.setQueryData<Room[]>(["rooms"], (old) => {
      const list = old ? [...old] : [];
      const idx = list.findIndex((r) => r.room_number === roomNumber);
      if (idx >= 0) list[idx] = { ...list[idx], needs_maintenance: value };
      else
        list.push({
          id: `temp-${roomNumber}`,
          room_number: roomNumber,
          done: false,
          done_reception: false,
          category: null,
          default_status: null,
          reception_status_id: null,
          reception_bed_id: null,
          housekeeping_note: null,
          needs_maintenance: value, guest_vacated: false, early_check_in: false,
        });
      return list;
    });
    const { error } = await supabase.from("rooms").upsert(
      {
        room_number: roomNumber,
        needs_maintenance: value,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "user_id,room_number" },
    );
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["rooms"] });
    // Sync with the Maintenance Log
    if (value) {
      const existingOpen = (qc.getQueryData<MaintenanceRequest[]>(["maintenance_requests"]) ?? [])
        .some((m) => m.room_number === roomNumber && !m.done);
      if (!existingOpen) {
        const room = (qc.getQueryData<Room[]>(["rooms"]) ?? []).find((r) => r.room_number === roomNumber);
        const noteText = (room?.housekeeping_note ?? "").trim();
        const { error: insErr } = await supabase.from("maintenance_requests" as never).insert({
          room_number: roomNumber,
          message: noteText || "Needs maintenance",
          created_by_username: authUser?.username ?? null,
        } as never);
        if (insErr) toast.error(insErr.message);
        qc.invalidateQueries({ queryKey: ["maintenance_requests"] });
        void notifyMaintenanceRequest({
          data: {
            roomNumber,
            message: noteText || "Needs maintenance",
            originDepartment: "housekeeping",
          },
        });
      }
    } else {
      const who = authUser?.username ?? "Housekeeping";
      const openIds = (qc.getQueryData<MaintenanceRequest[]>(["maintenance_requests"]) ?? [])
        .filter((m) => m.room_number === roomNumber && !m.done)
        .map((m) => m.id);
      if (openIds.length > 0) {
        const { error: upErr } = await supabase
          .from("maintenance_requests" as never)
          .update({ done: true, done_by_username: who, done_at: new Date().toISOString() } as never)
          .in("id", openIds);
        if (upErr) toast.error(upErr.message);
        qc.invalidateQueries({ queryKey: ["maintenance_requests"] });
      }
    }
  };

  const setRoomGuestVacated = async (roomNumber: number, value: boolean) => {
    qc.setQueryData<Room[]>(["rooms"], (old) => {
      const list = old ? [...old] : [];
      const idx = list.findIndex((r) => r.room_number === roomNumber);
      if (idx >= 0) list[idx] = { ...list[idx], guest_vacated: value };
      else
        list.push({
          id: `temp-${roomNumber}`,
          room_number: roomNumber,
          done: false,
          done_reception: false,
          category: null,
          default_status: null,
          reception_status_id: null,
          reception_bed_id: null,
          housekeeping_note: null,
          needs_maintenance: false,
          guest_vacated: value,
        });
      return list;
    });
    const { error } = await supabase.from("rooms").upsert(
      {
        room_number: roomNumber,
        guest_vacated: value,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "user_id,room_number" },
    );
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["rooms"] });
    if (value) fireRoomNotification("checkout", roomNumber);
  };

  const setRoomEarlyCheckIn = async (roomNumber: number, value: boolean) => {
    qc.setQueryData<Room[]>(["rooms"], (old) => {
      const list = old ? [...old] : [];
      const idx = list.findIndex((r) => r.room_number === roomNumber);
      if (idx >= 0) list[idx] = { ...list[idx], early_check_in: value };
      else
        list.push({
          id: `temp-${roomNumber}`,
          room_number: roomNumber,
          done: false,
          done_reception: false,
          category: null,
          default_status: null,
          reception_status_id: null,
          reception_bed_id: null,
          housekeeping_note: null,
          needs_maintenance: false,
          guest_vacated: false,
          early_check_in: value,
        });
      return list;
    });
    const { error } = await supabase.from("rooms").upsert(
      {
        room_number: roomNumber,
        early_check_in: value,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "user_id,room_number" },
    );
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["rooms"] });
  };

  // --- Room type management ---
  const addRoomType = async (label: string) => {
    const clean = label.trim();
    if (!clean) return;
    const value = valueFromLabel(clean);
    if (!value) {
      toast.error("Invalid room type name");
      return;
    }
    if (roomTypes.some((rt) => rt.value === value)) {
      toast.error("Room type already exists");
      return;
    }
    qc.setQueryData<RoomType[]>(["room_types"], (old) => [
      ...(old ?? []),
      {
        id: `temp-${value}`,
        user_id: authUser?.id ?? "",
        value,
        label: clean,
        sort_order: ((old ?? []).reduce((m, r) => Math.max(m, r.sort_order ?? 0), 0)) + 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);
    const nextSort = (roomTypes.reduce((m, r) => Math.max(m, r.sort_order ?? 0), 0)) + 1;
    const { error } = await supabase.from("room_types").insert({ value, label: clean, sort_order: nextSort } as never);
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["room_types"] });
      return;
    }
    setAddRoomTypeOpen(false);
    setNewRoomTypeLabel("");
    qc.invalidateQueries({ queryKey: ["room_types"] });
    toast.success("Room type added");
  };

  const deleteRoomType = async (id: string) => {
    const rt = roomTypes.find((r) => r.id === id);
    if (!rt) return;
    const inRooms = rooms.some((r) => parseCats(r.category).includes(rt.value));
    const inTemplates = template.some((t) => t.category === rt.value);
    if (inRooms || inTemplates) {
      toast.error("Cannot remove a room type that is in use");
      return;
    }
    qc.setQueryData<RoomType[]>(["room_types"], (old) =>
      old?.filter((r) => r.id !== id) ?? [],
    );
    const { error } = await supabase.from("room_types").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["room_types"] });
    }
  };

  const renameRoomType = async (id: string, label: string) => {
    const clean = label.trim();
    if (!clean) return;
    qc.setQueryData<RoomType[]>(["room_types"], (old) =>
      old?.map((r) => (r.id === id ? { ...r, label: clean } : r)) ?? [],
    );
    const { error } = await supabase.from("room_types").update({ label: clean } as never).eq("id", id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["room_types"] });
  };

  const moveRoomType = async (id: string, dir: -1 | 1) => {
    const sorted = [...roomTypes].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const idx = sorted.findIndex((r) => r.id === id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[swapIdx];
    const aSort = a.sort_order ?? idx + 1;
    const bSort = b.sort_order ?? swapIdx + 1;
    qc.setQueryData<RoomType[]>(["room_types"], (old) =>
      old?.map((r) =>
        r.id === a.id ? { ...r, sort_order: bSort } : r.id === b.id ? { ...r, sort_order: aSort } : r,
      ) ?? [],
    );
    const [r1, r2] = await Promise.all([
      supabase.from("room_types").update({ sort_order: bSort } as never).eq("id", a.id),
      supabase.from("room_types").update({ sort_order: aSort } as never).eq("id", b.id),
    ]);
    if (r1.error) toast.error(r1.error.message);
    if (r2.error) toast.error(r2.error.message);
    qc.invalidateQueries({ queryKey: ["room_types"] });
  };

  // --- Room feature management ---
  const addRoomFeature = async (label: string) => {
    const clean = label.trim();
    if (!clean) return;
    const value = valueFromLabel(clean);
    if (!value) {
      toast.error("Invalid feature name");
      return;
    }
    if (roomFeatures.some((f) => f.value === value)) {
      toast.error("Feature already exists");
      return;
    }
    const nextSort = (roomFeatures.reduce((m, r) => Math.max(m, r.sort_order ?? 0), 0)) + 1;
    const { error } = await supabase
      .from("room_features" as never)
      .insert({ value, label: clean, sort_order: nextSort, user_id: authUser?.id } as never);
    if (error) {
      toast.error(error.message);
      return;
    }
    setAddRoomFeatureOpen(false);
    setNewRoomFeatureLabel("");
    qc.invalidateQueries({ queryKey: ["room_features"] });
    toast.success("Feature added");
  };

  const deleteRoomFeature = async (id: string) => {
    const inUse = roomFeatureAssignments.some((a) => a.feature_id === id);
    if (inUse) {
      toast.error("Cannot remove a feature that is in use");
      return;
    }
    qc.setQueryData<RoomFeature[]>(["room_features"], (old) =>
      old?.filter((f) => f.id !== id) ?? [],
    );
    const { error } = await supabase.from("room_features" as never).delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["room_features"] });
    }
  };

  const renameRoomFeature = async (id: string, label: string) => {
    const clean = label.trim();
    if (!clean) return;
    qc.setQueryData<RoomFeature[]>(["room_features"], (old) =>
      old?.map((f) => (f.id === id ? { ...f, label: clean } : f)) ?? [],
    );
    const { error } = await supabase.from("room_features" as never).update({ label: clean } as never).eq("id", id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["room_features"] });
  };

  const moveRoomFeature = async (id: string, dir: -1 | 1) => {
    const sorted = [...roomFeatures].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const idx = sorted.findIndex((r) => r.id === id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[swapIdx];
    const aSort = a.sort_order ?? idx + 1;
    const bSort = b.sort_order ?? swapIdx + 1;
    qc.setQueryData<RoomFeature[]>(["room_features"], (old) =>
      old?.map((r) =>
        r.id === a.id ? { ...r, sort_order: bSort } : r.id === b.id ? { ...r, sort_order: aSort } : r,
      ) ?? [],
    );
    const [r1, r2] = await Promise.all([
      supabase.from("room_features" as never).update({ sort_order: bSort } as never).eq("id", a.id),
      supabase.from("room_features" as never).update({ sort_order: aSort } as never).eq("id", b.id),
    ]);
    if (r1.error) toast.error(r1.error.message);
    if (r2.error) toast.error(r2.error.message);
    qc.invalidateQueries({ queryKey: ["room_features"] });
  };

  const toggleRoomFeature = async (roomNumber: number, featureId: string) => {
    const existing = roomFeatureAssignments.find(
      (a) => a.feature_id === featureId && a.room_number === roomNumber,
    );
    if (existing) {
      qc.setQueryData<RoomFeatureAssignment[]>(["room_feature_rooms"], (old) =>
        old?.filter((a) => a.id !== existing.id) ?? [],
      );
      const { error } = await supabase
        .from("room_feature_rooms" as never)
        .delete()
        .eq("id", existing.id);
      if (error) toast.error(error.message);
    } else {
      const { error } = await supabase
        .from("room_feature_rooms" as never)
        .insert({ feature_id: featureId, room_number: roomNumber, user_id: authUser?.id } as never);
      if (error) toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["room_feature_rooms"] });
  };

  // --- Reception items management ---
  const addReceptionItem = async (kind: "status" | "bed", label: string) => {
    const clean = label.trim();
    if (!clean) return;
    if (receptionItems.some((i) => i.kind === kind && i.label.toLowerCase() === clean.toLowerCase())) {
      toast.error("Entry already exists");
      return;
    }
    const sameKind = receptionItems.filter((i) => i.kind === kind);
    const nextSort = (sameKind.reduce((m, r) => Math.max(m, r.sort_order ?? 0), 0)) + 1;
    const { error } = await supabase
      .from("reception_items" as never)
      .insert({ kind, label: clean, sort_order: nextSort, user_id: authUser?.id } as never);
    if (error) {
      toast.error(error.message);
      return;
    }
    setAddReceptionItemKind(null);
    setNewReceptionItemLabel("");
    qc.invalidateQueries({ queryKey: ["reception_items"] });
    toast.success("Entry added");
  };

  const deleteReceptionItem = async (id: string) => {
    qc.setQueryData<ReceptionItem[]>(["reception_items"], (old) =>
      old?.filter((i) => i.id !== id) ?? [],
    );
    const { error } = await supabase.from("reception_items" as never).delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["reception_items"] });
    }
  };

  const renameReceptionItem = async (id: string, label: string) => {
    const clean = label.trim();
    if (!clean) return;
    qc.setQueryData<ReceptionItem[]>(["reception_items"], (old) =>
      old?.map((i) => (i.id === id ? { ...i, label: clean } : i)) ?? [],
    );
    const { error } = await supabase.from("reception_items" as never).update({ label: clean } as never).eq("id", id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["reception_items"] });
  };

  const moveReceptionItem = async (id: string, dir: -1 | 1) => {
    const item = receptionItems.find((i) => i.id === id);
    if (!item) return;
    const sorted = receptionItems
      .filter((i) => i.kind === item.kind)
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const idx = sorted.findIndex((r) => r.id === id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[swapIdx];
    const aSort = a.sort_order ?? idx + 1;
    const bSort = b.sort_order ?? swapIdx + 1;
    qc.setQueryData<ReceptionItem[]>(["reception_items"], (old) =>
      old?.map((r) =>
        r.id === a.id ? { ...r, sort_order: bSort } : r.id === b.id ? { ...r, sort_order: aSort } : r,
      ) ?? [],
    );
    const [r1, r2] = await Promise.all([
      supabase.from("reception_items" as never).update({ sort_order: bSort } as never).eq("id", a.id),
      supabase.from("reception_items" as never).update({ sort_order: aSort } as never).eq("id", b.id),
    ]);
    if (r1.error) toast.error(r1.error.message);
    if (r2.error) toast.error(r2.error.message);
    qc.invalidateQueries({ queryKey: ["reception_items"] });
  };

 const renderRoomPanel = (n: number) => {
 const roomExtras = extras.filter((e) => e.room_number === n);
   const showAll = !!showAllLinen[n];
   const visibleTemplate = template.filter((t) => {
     if (isAssigned(t.id, n)) return true;
     if (showAll) return true;
     return getCount(n, "template", t.id) > 0;
   });
  const cat = roomCategory(n);
  const colorStyle = (color: ItemColor | null | undefined): React.CSSProperties | undefined => {
    const c = color ? COLOR_SWATCHES[color] : null;
    if (!c) return undefined;
    return { backgroundColor: theme === "dark" ? c.darkBg : c.bg, borderLeft: `4px solid ${c.border}` };
  };
  return (
  <div className="border rounded-md bg-muted/30 flex flex-col min-h-0 flex-1 overflow-hidden">
    <div className="p-4 space-y-4 shrink-0">

    {/* Reception messages */}
    {(() => {
      const msgs = activeMessagesByRoom(n);
      const room = rooms.find((r) => r.room_number === n);
      const note = room?.housekeeping_note ?? null;
      const maintenance = !!room?.needs_maintenance;
      const vacated = !!room?.guest_vacated;
      const hasMsg = msgs.length > 0;
      const hasNote = !!note;
      if (isReception) {
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 rounded-md border bg-background p-3">
              <span className="flex items-center gap-2 text-sm font-medium">
                <DoorOpen className={cn("h-4 w-4", room?.early_check_in ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")} />
                Early check-in
              </span>
              <Switch checked={!!room?.early_check_in} onCheckedChange={(v) => setRoomEarlyCheckIn(n, v)} />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border bg-background p-3">
              <span className="flex items-center gap-2 text-sm font-medium">
                <DoorOpen className={cn("h-4 w-4", vacated ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")} />
                Guest has checked out
              </span>
              <Switch checked={vacated} onCheckedChange={(v) => setRoomGuestVacated(n, v)} />
            </div>
            {maintenance && (
              <div className="flex items-center gap-2 rounded-md border border-amber-500/60 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm">
                <Wrench className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="font-medium text-amber-800 dark:text-amber-200">
                  Maintenance requested by Housekeeping
                </span>
              </div>
            )}
            <div className="rounded-md border bg-background p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                From Housekeeping
              </p>
              {note ? (
                <>
                  <p className="text-sm whitespace-pre-wrap break-words">{note}</p>
                  <div className="mt-2 flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => confirmHousekeepingNote(n, note)}
                    >
                      Confirm
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setRoomHousekeepingNote(n, "")}
                    >
                      Dismiss
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No notes from Housekeeping.</p>
              )}
            </div>
            <div className="space-y-2 rounded-md border border-amber-400/60 bg-amber-50 dark:bg-amber-950/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                Leave a message for housekeeping
              </p>
              {hasMsg && (
                <ul className="space-y-1">
                  {msgs.map((m) => (
                    <li key={m.id} className="flex items-start gap-2 text-sm bg-background/70 rounded p-2">
                      <span className="flex-1 break-words whitespace-pre-wrap">{m.message}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => deleteRoomMessage(m.id)}
                        aria-label="Delete message"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <Input
                  value={newMessageText}
                  onChange={(e) => setNewMessageText(e.target.value)}
                  placeholder="Type a message…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submitRoomMessage(n);
                    }
                  }}
                />
                <Button type="button" onClick={() => submitRoomMessage(n)} disabled={!newMessageText.trim()}>
                  Send
                </Button>
              </div>
            </div>
          </div>
        );
      }
      if (isHousekeeper) {
        return null;
      }
      return null;
    })()}

    {isReception && (() => {
      const assigned = roomFeatures.filter((f) =>
        roomFeatureAssignments.some(
          (a) => a.feature_id === f.id && a.room_number === n,
        ),
      );
      if (assigned.length === 0) return null;
      return (
        <div className="space-y-2 rounded-md border bg-background p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Room features
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {assigned.map((f) => (
              <li
                key={f.id}
                className="inline-flex items-center rounded-md border bg-muted px-2 py-1 text-xs font-medium"
              >
                {f.label}
              </li>
            ))}
          </ul>
        </div>
      );
    })()}

    {!isReception && (
      <div className="flex flex-row gap-2">
        <button
          type="button"
          onClick={() => setReceptionSheetRoom(n)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-full border bg-background px-3 sm:px-4 h-11 flex-1 text-sm font-medium cursor-pointer transition-colors hover:bg-accent",
              receptionDoneSet.has(n)
                ? "border-primary bg-primary/10 text-primary"
                : ""
            )}
        >
          Status
        </button>
        <button
          type="button"
          onClick={() =>
            setShowAllLinen((prev) => ({ ...prev, [n]: !prev[n] }))
          }
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-full border bg-background px-3 sm:px-4 h-11 flex-1 text-sm font-medium cursor-pointer transition-colors hover:bg-accent",
            showAll
              ? "border-primary bg-primary/10 text-primary"
              : ""
          )}
        >
          Extra linen
        </button>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setEditDefaultsSheetRoom(n)}
            className="inline-flex items-center justify-center h-11 w-11 shrink-0 rounded-full border bg-background text-sm font-medium cursor-pointer transition-colors hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Edit defaults"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
        {(!isHousekeeper || isAdmin) && (() => {
          const msgs = activeMessagesByRoom(n);
          const room = rooms.find((r) => r.room_number === n);
          const note = room?.housekeeping_note ?? null;
          const maintenance = !!room?.needs_maintenance;
          const vacated = !!room?.guest_vacated;
          // On reception, ignore messages reception themselves sent (they're
          // outgoing to housekeeping). Housekeeping originals and any replies
          // still trigger the dot.
          const relevantMsgs = isReception
            ? msgs.filter((m) => m.created_by_role !== "reception" || !!m.reply_to_id)
            : msgs;
          const hasMsg = relevantMsgs.length > 0;
          const hasNote = !!note;
          const hasIndicator = hasMsg || hasNote || maintenance || vacated;
          return (
            <button
              type="button"
              onClick={() => setNotesSheetRoom(n)}
              className="relative inline-flex items-center justify-center h-11 w-11 shrink-0 rounded-full border bg-background text-sm font-medium cursor-pointer transition-colors hover:bg-accent"
              aria-label="Notifications"
            >
              <MessageSquare className="h-4 w-4" />
              {hasIndicator && (
                <span className="absolute -top-0.5 -right-0.5 flex items-center gap-0.5">
                  {hasMsg && (
                    <span aria-label="Message" className="h-2 w-2 rounded-full bg-amber-500 ring-2 ring-background" />
                  )}
                  {hasNote && (
                    <span aria-label="Note" className="h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
                  )}
                  {maintenance && (
                    <Wrench aria-label="Maintenance" className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                  )}
                  {vacated && (
                    <DoorOpen aria-label="Vacated" className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  )}
                </span>
              )}
            </button>
          );
        })()}
      </div>
    )}
    </div>

    {isReception ? null : (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-4">
    {visibleTemplate.length === 0 && roomExtras.length === 0 ? (
    <p className="text-sm text-muted-foreground">
    No items yet. Add linen list items from the menu, or add an extra below.
    </p>
    ) : (
    <ul className="space-y-1">
    {visibleTemplate.map((item) => {
    const count = getCount(n, "template", item.id);
    return (
     <li
       key={`t-${item.id}`}
        className="flex items-center gap-3 py-2 px-2 rounded-md border"
        style={colorStyle(item.color)}
     >
        <span
          className="flex-1 min-w-0 break-words"
          style={item.color ? { color: theme === "dark" ? "#f8fafc" : "#0f172a" } : undefined}
        >{item.name}</span>
     <div className="flex items-center gap-1 shrink-0">
    {item.default_count > 0 && (
    <Button
    variant="outline"
    size="sm"
    className="h-10 sm:h-8 text-xs mr-1"
    onClick={() => updateCount(n, "template", item.id, item.default_count)}
    >
    + All
    </Button>
    )}
    <Button
    variant="outline"
    size="icon"
    className="h-10 w-10 sm:h-8 sm:w-8"
    onClick={() => updateCount(n, "template", item.id, -1)}
    disabled={count === 0}
    aria-label={`Decrease ${item.name}`}
    >
    <Minus className="h-4 w-4" />
    </Button>
    <span
      className="w-10 sm:w-8 text-center tabular-nums font-medium"
      style={item.color ? { color: theme === "dark" ? "#f8fafc" : "#0f172a" } : undefined}
    >{count}</span>
    <Button
    variant="outline"
    size="icon"
    className="h-10 w-10 sm:h-8 sm:w-8"
    onClick={() => updateCount(n, "template", item.id, 1)}
    aria-label={`Increase ${item.name}`}
    >
    <Plus className="h-4 w-4" />
    </Button>
    </div>
    </li>
    );
    })}
   {roomExtras.map((item) => {
   const count = getCount(n, "extra", item.id);
   return (
    <li
      key={`e-${item.id}`}
      className="flex items-center gap-3 py-2 px-2 rounded-md border"
    >
     <span className="flex-1 min-w-0 break-words">
   {item.name}
   <span className="ml-2 text-xs text-muted-foreground">
   extra
   </span>
   </span>
   <div className="flex items-center gap-1 shrink-0">
   <Button
   variant="outline"
   size="icon"
   className="h-10 w-10 sm:h-8 sm:w-8"
   onClick={() => updateCount(n, "extra", item.id, -1)}
   disabled={count === 0}
   aria-label={`Decrease ${item.name}`}
   >
   <Minus className="h-4 w-4" />
   </Button>
   <span className="w-10 sm:w-8 text-center tabular-nums font-medium">{count}</span>
   <Button
   variant="outline"
   size="icon"
   className="h-10 w-10 sm:h-8 sm:w-8"
   onClick={() => updateCount(n, "extra", item.id, 1)}
   aria-label={`Increase ${item.name}`}
   >
   <Plus className="h-4 w-4" />
   </Button>
   <Button
   variant="ghost"
   size="icon"
   className="h-10 w-10 sm:h-8 sm:w-8 text-muted-foreground hover:text-destructive"
   onClick={() => deleteExtra(item.id)}
   aria-label={`Delete ${item.name}`}
   >
   <X className="h-4 w-4" />
   </Button>
   </div>
   </li>
   );
   })}
   </ul>
   )}

    </div>
    )}

   </div>
   );
  };

 if (authUser?.role === "pending") {
   return (
     <main className="min-h-[100dvh] bg-background flex items-center justify-center p-6">
       <div className="max-w-sm w-full rounded-lg border bg-card p-6 text-center space-y-3 shadow-sm">
         <h1 className="text-lg font-semibold">Waiting for approval</h1>
         <p className="text-sm text-muted-foreground">
           Your account ({authUser.email}) is waiting for an admin to approve access.
           You'll be able to use the app as soon as they do.
         </p>
         <Button onClick={signOut} variant="outline" size="sm" className="w-full">
           Sign out
         </Button>
       </div>
     </main>
   );
 }

 return (
<main
  className="min-h-[100dvh] bg-background"
  style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
>
<div
  className="max-w-2xl md:max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto py-6 sm:py-10 space-y-8 sm:space-y-10"
  style={{
    paddingLeft: "max(1rem, env(safe-area-inset-left))",
    paddingRight: "max(1rem, env(safe-area-inset-right))",
  }}
>
 <header className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            {isReception ? (
              <>
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Three Ways House Hotel</h1>
                <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">
                  An auto-updating room tracker for Housekeeping. Use the help if you get stuck 
                </p>
              </>
            ) : isFnb ? (
              <>
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Three Ways House Hotel</h1>
                <p className="text-xs text-muted-foreground mt-1">
                  Shared workspace for F&B staff
                </p>
              </>
            ) : (
              <>
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Three Ways House Hotel</h1>
                <p className="text-xs text-muted-foreground mt-1">
                  Shared workspace for Housekeeping staff
                </p>
              </>
            )}
          </div>
 <div className="flex items-center gap-2">
    {!isMobile && canViewAs && (
      <div className="inline-flex rounded-md border p-0.5 bg-background h-9 items-center">
        {availableViews.map((r) => {
          const active = (safeViewAs ?? defaultView) === r;
          const label =
            r === "user"
              ? "Housekeeping"
              : r === "fnb"
              ? "F&B"
              : r === "reception"
              ? "Reception"
              : r === "admin"
              ? "Admin"
              : r === "maintenance"
              ? "Maintenance"
              : "Manager";
          return (
            <button
              key={r}
              type="button"
              onClick={() => setViewAsRole(active ? null : r)}
              className={cn(
                "px-3 h-8 text-xs sm:text-sm rounded-[0.3rem] transition-colors whitespace-nowrap",
                active
                  ? "bg-primary text-primary-foreground shadow-sm font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    )}
    {!isMobile && isAdmin && !isReception && (isMobile ? (
      <Sheet open={exportSheetOpen} onOpenChange={setExportSheetOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm">Export</Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl p-4 sm:p-6">
          <SheetHeader className="text-left">
            <SheetTitle>Export</SheetTitle>
            <SheetDescription>Choose what to export.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 grid gap-2">
            <Button
              variant="outline"
              size="lg"
              className="justify-start h-12"
              onClick={() => { setExportSheetOpen(false); openExport(); }}
            >
              <List className="h-5 w-5 mr-2" />
              Linen totals
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="justify-start h-12"
              onClick={() => { setExportSheetOpen(false); openRoomStatusExport(); }}
            >
              <ClipboardList className="h-5 w-5 mr-2" />
              Room status
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="justify-start h-12"
              onClick={() => { setExportSheetOpen(false); void openFnbExport(); }}
            >
              <List className="h-5 w-5 mr-2" />
              F&amp;B Linen totals
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    ) : (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">Export</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Export</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => openExport()}>
            <List className="h-4 w-4 mr-2" />
            Linen totals
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openRoomStatusExport()}>
            <ClipboardList className="h-4 w-4 mr-2" />
            Room status
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void openFnbExport()}>
            <List className="h-4 w-4 mr-2" />
            F&amp;B Linen totals
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ))}
    {!isMobile && isReception && (
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          const { rows } = computeRoomStatus();
          if (rows.length === 0) {
            toast.error("No rooms to print");
            return;
          }
          printRoomStatus(rows, new Date());
        }}
      >
        <Printer className="h-4 w-4 mr-2" />
        Print
      </Button>
    )}
    {!isMobile && isReception && (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setReceptionHelpOpen(true)}
        aria-label="Help"
      >
        <HelpCircle className="h-4 w-4 mr-2" />
        Help
      </Button>
    )}
 {isMobile ? (
   <Button variant="ghost" size="sm" aria-label="Menu" onClick={() => setMenuSheetOpen(true)} className="relative">
     <Menu className="h-4 w-4" />
     {hasOpenMaintenance && (
       <span
         aria-label={`${openMaintenanceCount} open maintenance request${openMaintenanceCount === 1 ? "" : "s"}`}
         className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-background"
       />
     )}
   </Button>
 ) : (
   <DropdownMenu>
     <DropdownMenuTrigger asChild>
       <Button variant="ghost" size="sm" aria-label="Menu" className="relative">
         <Menu className="h-4 w-4" />
         {hasOpenMaintenance && (
           <span
             aria-label={`${openMaintenanceCount} open maintenance request${openMaintenanceCount === 1 ? "" : "s"}`}
             className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-background"
           />
         )}
       </Button>
     </DropdownMenuTrigger>
     <DropdownMenuContent align="end" className="w-64">
          {(menuHasHk || menuHasFnb) && !isMaintenance && (
           <>
             <DropdownMenuLabel>Manage</DropdownMenuLabel>
             <DropdownMenuItem onClick={() => setTemplateOpen(true)}>
               <List className="h-4 w-4 mr-2" /> Linen List
             </DropdownMenuItem>
           </>
         )}
          {menuIsAdmin && !isMaintenance && (
          <>
            <DropdownMenuItem onClick={() => setManageRoomsOpen(true)}>
             <Hash className="h-4 w-4 mr-2" /> Manage Rooms
           </DropdownMenuItem>
           <DropdownMenuItem onClick={() => setRejectsOpen(true)}>
             <Ban className="h-4 w-4 mr-2" /> Rejects
           </DropdownMenuItem>
            {!isReception && (
              <DropdownMenuItem onClick={() => setHistorySheetOpen(true)}>
                <History className="h-4 w-4 mr-2" /> History
              </DropdownMenuItem>
            )}
           <DropdownMenuItem onClick={() => setQuickReceptionOpen(true)}>
             <ConciergeBell className="h-4 w-4 mr-2" /> Bulk Room Status Setup
           </DropdownMenuItem>
           <DropdownMenuSeparator />
         </>
       )}
             {!menuIsFnbOnly && !isMaintenance && (
           <DropdownMenuItem onClick={() => setMaintenanceLogOpen(true)}>
             <Wrench className="h-4 w-4 mr-2" />
             <span className="flex-1">Maintenance Log</span>
             {hasOpenMaintenance && (
               <span className="ml-2 h-2 w-2 rounded-full bg-amber-500" aria-hidden />
             )}
           </DropdownMenuItem>
         )}
           {menuCanUseLostProperty && !isMaintenance && (
             <DropdownMenuItem onClick={() => setLostPropertyOpen(true)}>
               <PackageSearch className="h-4 w-4 mr-2" />
               Lost Property
             </DropdownMenuItem>
           )}
          {canUseMessages && (
            <DropdownMenuItem onClick={() => { setMessagesInitial({}); setMessagesSheetOpen(true); }}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Messages
            </DropdownMenuItem>
          )}
         <DropdownMenuSeparator />
       <DropdownMenuLabel>Appearance</DropdownMenuLabel>
       <DropdownMenuItem onClick={() => toggleTheme()}>
         {theme === "dark" ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
         {theme === "dark" ? "Light mode" : "Dark mode"}
       </DropdownMenuItem>
       <DropdownMenuSeparator />
       <DropdownMenuLabel>Account</DropdownMenuLabel>
        {realIsAdmin && !isMaintenance && (
         <DropdownMenuItem onClick={() => setUsersOpen(true)}>
           <Users className="h-4 w-4 mr-2" /> Users
         </DropdownMenuItem>
       )}
        {realIsManager && !realIsAdmin && !isMaintenance && (
         <DropdownMenuItem onClick={() => setUserApprovalOpen(true)}>
           <Users className="h-4 w-4 mr-2" /> User Approval
         </DropdownMenuItem>
       )}
         {!menuIsFnbOnly && (
          <DropdownMenuItem onClick={() => setNotificationsSheetOpen(true)}>
            <Bell className="h-4 w-4 mr-2" /> Notifications
          </DropdownMenuItem>
        )}
       <DropdownMenuItem onClick={() => setAccountOpen(true)}>
         <User className="h-4 w-4 mr-2" /> Account
       </DropdownMenuItem>
       <DropdownMenuItem onClick={() => void signOut()} className="text-destructive focus:text-destructive">
         <LogOut className="h-4 w-4 mr-2" /> Sign out
       </DropdownMenuItem>
     </DropdownMenuContent>
   </DropdownMenu>
 )}
 </div>
 </header>

 {/* Mobile role-picker sheet (triggered from the burger menu). */}
 {isMobile && canViewAs && (
   <Sheet open={rolePickerSheetOpen} onOpenChange={setRolePickerSheetOpen}>
     <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl p-4 sm:p-6">
       <SheetHeader className="text-left">
         <SheetTitle>Department</SheetTitle>
         <SheetDescription>Switch between your assigned departments.</SheetDescription>
       </SheetHeader>
       <div className="mt-4 grid gap-2">
         {availableViews.map((r) => {
           const active = (safeViewAs ?? defaultView) === r;
           const label =
             r === "user" ? "Housekeeping"
             : r === "fnb" ? "F&B"
             : r === "reception" ? "Reception"
             : r === "admin" ? "Admin"
              : r === "maintenance" ? "Maintenance"
             : "Manager";
           return (
             <Button
               key={r}
               variant={active ? "default" : "outline"}
               size="lg"
               className="justify-start h-12"
               onClick={() => { setViewAsRole(active ? null : r); setRolePickerSheetOpen(false); }}
             >
               <span className="flex-1 text-left">{label}</span>
               {active && <Check className="h-4 w-4 ml-2" />}
             </Button>
           );
         })}
       </div>
     </SheetContent>
   </Sheet>
 )}
 {/* Mobile export sheet (triggered from the burger menu). */}
 {isMobile && isAdmin && !isReception && (
   <Sheet open={exportSheetOpen} onOpenChange={setExportSheetOpen}>
     <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl p-4 sm:p-6">
       <SheetHeader className="text-left">
         <SheetTitle>Export</SheetTitle>
         <SheetDescription>Choose what to export.</SheetDescription>
       </SheetHeader>
       <div className="mt-4 grid gap-2">
         <Button variant="outline" size="lg" className="justify-start h-12" onClick={() => { setExportSheetOpen(false); openExport(); }}>
           <List className="h-5 w-5 mr-2" />
           Linen totals
         </Button>
         <Button variant="outline" size="lg" className="justify-start h-12" onClick={() => { setExportSheetOpen(false); openRoomStatusExport(); }}>
           <ClipboardList className="h-5 w-5 mr-2" />
           Room status
         </Button>
         <Button variant="outline" size="lg" className="justify-start h-12" onClick={() => { setExportSheetOpen(false); void openFnbExport(); }}>
           <List className="h-5 w-5 mr-2" />
           F&amp;B Linen totals
         </Button>
       </div>
     </SheetContent>
   </Sheet>
 )}

 {/* Linen list dialog */}
   <Dialog open={templateOpen} onOpenChange={(o) => {
     setTemplateOpen(o);
     if (o) {
       const canHk = realIsAdmin || realIsManager || hasHousekeeperRole;
       const canFn = realIsAdmin || realIsManager || hasFnbRole;
       if (!canHk && canFn) setLinenListType("fnb");
       else if (canHk && !canFn) setLinenListType("housekeeping");
       else setLinenListType(isFnb ? "fnb" : "housekeeping");
     }
   }}>
<DialogContent className="max-w-2xl w-[calc(100vw-1.5rem)] sm:w-full p-4 sm:p-6">
 <DialogHeader>
 <DialogTitle>Linen List</DialogTitle>
   <DialogDescription>
     Manage the shared list of linen items. Pick which items appear in each
     room from that room's <Pencil className="inline h-3.5 w-3.5 align-[-2px]" /> button.
   </DialogDescription>
 </DialogHeader>
   <div className="space-y-3">
      {(realIsAdmin || realIsManager || (hasHousekeeperRole && hasFnbRole)) && (
      <div className="inline-flex rounded-md border p-0.5 bg-muted/40 self-start">
       <button
         type="button"
         onClick={() => setLinenListType("housekeeping")}
         className={cn(
           "px-3 py-1.5 text-sm rounded-[0.3rem] transition-colors",
           linenListType === "housekeeping" ? "bg-background shadow-sm font-medium" : "text-muted-foreground",
         )}
       >
         Housekeeping
       </button>
       <button
         type="button"
         onClick={() => setLinenListType("fnb")}
         className={cn(
           "px-3 py-1.5 text-sm rounded-[0.3rem] transition-colors",
           linenListType === "fnb" ? "bg-background shadow-sm font-medium" : "text-muted-foreground",
         )}
       >
         F&amp;B
       </button>
      </div>
      )}
    <form onSubmit={addTemplateItem} className="flex gap-2">
      <Input
         placeholder={`Add an item to ${linenListType === "fnb" ? "F&B" : "Housekeeping"}…`}
        value={newTemplateName}
        onChange={(e) => setNewTemplateName(e.target.value)}
      />
       <Button type="submit" disabled={!newTemplateName.trim()}>
        Add
      </Button>
    </form>
     {(() => {
       const listItems = templateAll.filter((t) => (t.list_type ?? "housekeeping") === linenListType);
       return listItems.length === 0 ? (
         <p className="text-sm text-muted-foreground">No items yet.</p>
       ) : (
        <ul className="divide-y border-t max-h-[60vh] overflow-y-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
          <li className="flex items-center gap-1.5 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <span className="h-3 w-3 shrink-0" aria-hidden />
            <span className="flex-1 min-w-0">Item</span>
            <span className="shrink-0 w-[88px] text-right">Actions</span>
          </li>
           {listItems.map((item, idx) => {
          return (
            <li key={item.id} className="flex items-center gap-1.5 py-2">
              <span
                className="h-3 w-3 rounded-full border-2 shrink-0"
                style={{
                  backgroundColor: item.color
                    ? theme === "dark"
                      ? COLOR_SWATCHES[item.color].darkBg
                      : COLOR_SWATCHES[item.color].bg
                    : "transparent",
                  borderColor: item.color ? COLOR_SWATCHES[item.color].border : "hsl(var(--border))",
                }}
                aria-hidden
              />
              <span className="flex-1 min-w-0 break-words text-sm">{item.name}</span>
              <div className="flex items-center gap-1 shrink-0">
                <Sheet
                  open={editItemSheetId === item.id}
                  onOpenChange={(o) => setEditItemSheetId(o ? item.id : null)}
                >
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground"
                      aria-label={`Edit ${item.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl p-4 sm:p-6">
                    <SheetHeader className="text-left">
                      <SheetTitle>Edit item</SheetTitle>
                      <SheetDescription>{item.name}</SheetDescription>
                    </SheetHeader>
                    <div className="mt-4 space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Name</label>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          renameTemplateItem(item.id, editingItemName);
                        }}
                        className="flex items-center gap-2"
                      >
                        <Input
                          autoFocus
                          defaultValue={item.name}
                          onFocus={(e) => {
                            setEditingItemId(item.id);
                            setEditingItemName(e.currentTarget.value);
                          }}
                          onChange={(e) => setEditingItemName(e.target.value)}
                          onBlur={() => {
                            if (editingItemId === item.id) renameTemplateItem(item.id, editingItemName);
                          }}
                          className="h-11 flex-1"
                        />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11 text-muted-foreground"
                          aria-label="Save name"
                        >
                          <Check className="h-5 w-5" />
                        </Button>
                      </form>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Default count</label>
                      <Input
                        type="number"
                        min={0}
                        value={item.default_count}
                        onChange={(e) => setTemplateDefault(item.id, Number(e.target.value))}
                        className="h-11 w-24"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Colour</label>
                      <div className="flex items-center gap-2 flex-wrap">
                        {(Object.keys(COLOR_SWATCHES) as ItemColor[]).map((key) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setTemplateColor(item.id, key)}
                            aria-label={COLOR_SWATCHES[key].label}
                            title={COLOR_SWATCHES[key].label}
                            className={cn(
                              "h-9 w-9 rounded-full border-2 transition",
                              item.color === key ? "ring-2 ring-offset-1 ring-foreground" : "",
                            )}
                            style={{
                              backgroundColor: theme === "dark" ? COLOR_SWATCHES[key].darkBg : COLOR_SWATCHES[key].bg,
                              borderColor: COLOR_SWATCHES[key].border,
                            }}
                          />
                        ))}
                        <button
                          type="button"
                          onClick={() => setTemplateColor(item.id, null)}
                          aria-label="No colour"
                          title="No colour"
                          className={cn(
                            "h-9 w-9 rounded-full border-2 flex items-center justify-center bg-background",
                            item.color === null ? "ring-2 ring-offset-1 ring-foreground" : "",
                          )}
                        >
                          <X className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t">
                      <span className="text-sm text-muted-foreground">Reorder</span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-11 w-11"
                          onClick={() => moveTemplateItem(item.id, -1)}
                          disabled={idx === 0}
                          aria-label="Move up"
                        >
                          <ArrowUp className="h-5 w-5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-11 w-11"
                          onClick={() => moveTemplateItem(item.id, 1)}
                          disabled={idx === listItems.length - 1}
                          aria-label="Move down"
                        >
                          <ArrowDown className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                    </div>
                  </SheetContent>
                </Sheet>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteTemplateItem(item.id)}
                  aria-label={`Delete ${item.name}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
       );
     })()}
  </div>
 </DialogContent>
 </Dialog>

 {/* Notes sheet (User/Admin + Reception) */}
 <Sheet open={notesSheetRoom !== null} onOpenChange={(o) => { if (!o) setNotesSheetRoom(null); }}>
   <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl p-4 sm:p-6">
     {notesSheetRoom !== null && (() => {
       const n = notesSheetRoom;
       const room = rooms.find((r) => r.room_number === n);
       const note = room?.housekeeping_note ?? null;
       const maintenance = !!room?.needs_maintenance;
       const vacated = !!room?.guest_vacated;
       const msgs = activeMessagesByRoom(n);
       return (
         <>
           <SheetHeader className="text-left">
              <SheetTitle className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                 Notifications — Room {n}
             </SheetTitle>
             <SheetDescription>Shared between Housekeeping and Reception</SheetDescription>
           </SheetHeader>
            <div className="mt-4 space-y-3">
              {canUseMessages && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-center gap-2 rounded-full"
                  onClick={() => {
                    setNotesSheetRoom(null);
                    setMessagesInitial({ thread: "hk_reception", room: n });
                    setMessagesSheetOpen(true);
                  }}
                >
                  <MessageSquare className="h-4 w-4" />
                  Open Messages
                </Button>
              )}
             {isReception ? (
               <>
                  <div className="flex items-center justify-between gap-2 rounded-md border bg-background p-3">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <DoorOpen className={cn("h-4 w-4", room?.early_check_in ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")} />
                      Early check-in
                    </span>
                    <Switch checked={!!room?.early_check_in} onCheckedChange={(v) => setRoomEarlyCheckIn(n, v)} />
                  </div>
                 <div className="flex items-center justify-between gap-2 rounded-md border bg-background p-3">
                   <span className="flex items-center gap-2 text-sm font-medium">
                     <DoorOpen className={cn("h-4 w-4", vacated ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")} />
                     Guest has checked out
                   </span>
                   <Switch checked={vacated} onCheckedChange={(v) => setRoomGuestVacated(n, v)} />
                 </div>
                 {maintenance && (
                   <div className="flex items-center gap-2 rounded-md border border-amber-500/60 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm">
                     <Wrench className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                     <span className="font-medium text-amber-800 dark:text-amber-200">
                       Maintenance requested by Housekeeping
                     </span>
                   </div>
                 )}
                 <div className="rounded-md border bg-background p-3">
                   <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                     From Housekeeping
                   </p>
                   {note ? (
                      <>
                        <p className="text-sm whitespace-pre-wrap break-words">{note}</p>
                        <div className="mt-2 flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => confirmHousekeepingNote(n, note)}
                          >
                            Confirm
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setRoomHousekeepingNote(n, "")}
                          >
                            Dismiss
                          </Button>
                        </div>
                      </>
                   ) : (
                     <p className="text-sm text-muted-foreground">No notes from Housekeeping.</p>
                   )}
                 </div>
                 <div className="space-y-2 rounded-md border border-amber-400/60 bg-amber-50 dark:bg-amber-950/40 p-3">
                   <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                     Leave a message for housekeeping
                   </p>
                   {msgs.length > 0 && (
                     <ul className="space-y-1">
                       {msgs.map((m) => (
                         <li key={m.id} className="flex items-start gap-2 text-sm bg-background/70 rounded p-2">
                           <span className="flex-1 break-words whitespace-pre-wrap">{m.message}</span>
                           <Button
                             type="button"
                             variant="ghost"
                             size="sm"
                             className="h-7 px-2 text-xs"
                             onClick={() => deleteRoomMessage(m.id)}
                             aria-label="Delete message"
                           >
                             <X className="h-3 w-3" />
                           </Button>
                         </li>
                       ))}
                     </ul>
                   )}
                    {canUseMessages && (
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            setNotesSheetRoom(null);
                            setMessagesInitial({ thread: "hk_reception", room: n });
                            setMessagesSheetOpen(true);
                          }}
                        >
                          <MessageSquare className="h-3 w-3 mr-1" /> Open in Messages
                        </Button>
                      </div>
                    )}
                   <div className="flex gap-2">
                     <Input
                       value={newMessageText}
                       onChange={(e) => setNewMessageText(e.target.value)}
                       placeholder="Type a message…"
                       onKeyDown={(e) => {
                         if (e.key === "Enter" && !e.shiftKey) {
                           e.preventDefault();
                           submitRoomMessage(n);
                         }
                       }}
                     />
                     <Button type="button" onClick={() => submitRoomMessage(n)} disabled={!newMessageText.trim()}>
                       Send
                     </Button>
                   </div>
                 </div>
               </>
             ) : (
               <>
                 {vacated && (
                   <div className="flex items-center gap-2 rounded-md border border-emerald-500/60 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-sm">
                     <DoorOpen className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                     <span className="font-medium text-emerald-800 dark:text-emerald-200">
                       Guest has vacated — marked by Reception
                     </span>
                   </div>
                 )}
                 {msgs.length > 0 && (
                   <div className="space-y-2 rounded-md border border-amber-400/60 bg-amber-50 dark:bg-amber-950/40 p-3">
                     <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                       Reception message{msgs.length > 1 ? "s" : ""}
                     </p>
                     <ul className="space-y-1">
                       {msgs.map((m) => (
                         <li key={m.id} className="flex items-start gap-2 text-sm bg-background/70 rounded p-2">
                           <div className="flex-1 min-w-0">
                             <p className="break-words whitespace-pre-wrap">{m.message}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {m.created_by_username ? <>from {m.created_by_username} · </> : null}
                                {new Date(m.created_at).toLocaleString(undefined, {
                                  weekday: "short",
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                           </div>
                           <div className="flex flex-col gap-1 shrink-0">
                             <Button
                               type="button"
                               variant="default"
                               size="sm"
                               className="h-7 text-xs"
                               onClick={() => confirmRoomMessage(m)}
                             >
                               Confirm
                             </Button>
                             <Button
                               type="button"
                               variant="outline"
                               size="sm"
                               className="h-7 text-xs"
                               onClick={() => dismissRoomMessage(m.id)}
                             >
                               Dismiss
                             </Button>
                           </div>
                         </li>
                       ))}
                     </ul>
                      {canUseMessages && (
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              setNotesSheetRoom(null);
                              setMessagesInitial({ thread: "hk_reception", room: n });
                              setMessagesSheetOpen(true);
                            }}
                          >
                            <MessageSquare className="h-3 w-3 mr-1" /> Reply in Messages
                          </Button>
                        </div>
                      )}
                   </div>
                 )}
               </>
             )}
           </div>
         </>
       );
     })()}
   </SheetContent>
 </Sheet>

 {/* Reception sheet (Admin/User): Done + Status + Bed */}
 <Sheet open={receptionSheetRoom !== null} onOpenChange={(o) => { if (!o) setReceptionSheetRoom(null); }}>
   <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl p-4 sm:p-6">
     {receptionSheetRoom !== null && (() => {
       const n = receptionSheetRoom;
       const room = rooms.find((r) => r.room_number === n);
       const occ = room?.reception_status_id ?? room?.default_status ?? null;
        const dndIdCurrent = receptionStatuses.find((x) => x.label === "DND")?.id ?? null;
        const isCurrentDnd = !!dndIdCurrent && occ === dndIdCurrent;
       const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
       const cats = parseCats(room?.category).map(norm);
       const hasSuperKing = cats.includes("superking");
       const hasDouble = cats.includes("double");
       const onlyDouble = hasDouble && !hasSuperKing;
       const filteredBeds = receptionBeds.filter((b) => {
         const nb = norm(b.label);
         if (onlyDouble) return nb === "double";
         if (hasSuperKing && nb === "double") return false;
         if (hasDouble && (nb === "king" || nb === "twin")) return false;
         return true;
       });
       const currentBed = room?.reception_bed_id ?? null;
       const Row = ({
         label,
         selected,
         disabled,
         onClick,
       }: { label: React.ReactNode; selected: boolean; disabled?: boolean; onClick: () => void }) => (
         <button
           type="button"
           disabled={disabled}
           onClick={onClick}
           className={cn(
             "w-full flex items-center justify-between gap-3 rounded-full border bg-background px-4 min-h-12 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-60 disabled:cursor-not-allowed",
             selected && "border-primary bg-primary/10 text-primary",
           )}
         >
           <span className="text-left">{label}</span>
           {selected ? <Check className="h-5 w-5" /> : <span className="h-5 w-5" />}
         </button>
       );
       return (
         <>
           <SheetHeader className="text-left">
             <SheetTitle className="flex items-center gap-2">
                <ConciergeBell className="h-4 w-4" />
                Status — Room {n}
             </SheetTitle>
             <SheetDescription>Mark status and bed configuration</SheetDescription>
           </SheetHeader>
              {!isReception && !!room?.guest_vacated && (
                <div className="mt-3 flex items-center justify-between gap-2 rounded-md border bg-background p-3">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <DoorOpen className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    Guest has checked out
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setRoomGuestVacated(n, false)}
                  >
                    Dismiss
                  </Button>
                </div>
              )}
             {(isAdmin || isCurrentDnd) && (
               <div className="mt-2 flex gap-2">
                 {isAdmin && (
                   <Button
                     type="button"
                     size="sm"
                     variant="outline"
                     className="flex-1"
                     onClick={() => {
                       setReceptionSheetRoom(null);
                       setQuickReceptionOpen(true);
                     }}
                   >
                     Edit all rooms
                   </Button>
                 )}
                 {isCurrentDnd && (
                   <Button
                     type="button"
                     size="sm"
                     variant="outline"
                     className="flex-1"
                     onClick={() => {
                       setStayoverPhotosRoomFilter(n);
                       setStayoverPhotosOpen(true);
                     }}
                   >
                     <Camera className="h-4 w-4 mr-1" />
                     Photo
                   </Button>
                 )}
               </div>
             )}
           <div className="mt-4 space-y-4">
             <div className="space-y-2">
               <Row
                 label="Mark as Done"
                 selected={receptionDoneSet.has(n)}
                 onClick={() => toggleReceptionDone(n)}
               />
             </div>
             <div className="space-y-2">
               <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
               {receptionStatuses.length === 0 && (
                 <p className="text-sm text-muted-foreground">No statuses</p>
               )}
                <div className="space-y-1.5">
                   {(() => {
                     const dndId = receptionStatuses.find((x) => x.label === "DND")?.id ?? null;
                     const stayId = receptionStatuses.find((x) => x.label === "Stayover")?.id ?? null;
                      const dirtyId = receptionStatuses.find((x) => x.label === "Dirty")?.id ?? null;
                      const rosId = receptionStatuses.find((x) => x.label === "ROS")?.id ?? null;
                     const dndActive = !!dndId && occ === dndId;
                      const dirtyActive = !!dirtyId && occ === dirtyId;
                     const pairLabels: [string, string][] = [
                       ["DND", "Stayover"],
                       ["Dirty", "ROS"],
                     ];
                     const topLabels = ["Arrival", "Clean", "Staff"];
                     const findStatus = (lbl: string) =>
                       receptionStatuses.find(
                         (x) => x.label.toLowerCase() === lbl.toLowerCase(),
                       ) ?? null;
                     const pairedIds = new Set<string>();
                     pairLabels.forEach(([a, b]) => {
                       const sa = findStatus(a);
                       const sb = findStatus(b);
                       if (sa) pairedIds.add(sa.id);
                       if (sb) pairedIds.add(sb.id);
                     });
                     const topIds = new Set<string>();
                     topLabels.forEach((lbl) => {
                       const s = findStatus(lbl);
                       if (s) topIds.add(s.id);
                     });
                     const handleClick = (s: { id: string }) => {
                       if (occ === s.id) {
                          const next =
                            s.id === dndId && stayId
                              ? stayId
                              : s.id === dirtyId && rosId
                                ? rosId
                                : null;
                          setRoomReceptionStatus(n, next);
                          if (s.id === dndId) {
                            void deleteTodayStayoverPhotosForRoom(n).then(() => {
                              qc.invalidateQueries({ queryKey: ["stayover_photos"] });
                            });
                          }
                       } else {
                          if (s.id === dndId) {
                            // Require a photo of the DND door before applying.
                            setPendingDndRoom(n);
                            dndFileInputRef.current?.click();
                          } else {
                            setRoomReceptionStatus(n, s.id);
                            if (occ === dndId) {
                              void deleteTodayStayoverPhotosForRoom(n).then(() => {
                                qc.invalidateQueries({ queryKey: ["stayover_photos"] });
                              });
                            }
                          }
                       }
                     };
                     const renderRow = (s: { id: string; label: string }) => {
                        const selected =
                          occ === s.id ||
                          (dndActive && s.id === stayId) ||
                          (dirtyActive && s.id === rosId);
                       return (
                         <Row
                           key={s.id}
                           label={s.label}
                           selected={selected}
                           onClick={() => handleClick(s)}
                         />
                       );
                     };
                     const nodes: React.ReactNode[] = [];
                     topLabels.forEach((lbl) => {
                       const s = findStatus(lbl);
                       if (s) nodes.push(renderRow(s));
                     });
                     pairLabels.forEach(([a, b]) => {
                       const sa = findStatus(a);
                       const sb = findStatus(b);
                       if (!sa && !sb) return;
                       nodes.push(
                         <div key={`pair-${a}-${b}`} className="grid grid-cols-2 gap-1.5">
                           {sa ? renderRow(sa) : <div />}
                           {sb ? renderRow(sb) : <div />}
                         </div>,
                       );
                     });
                     receptionStatuses.forEach((s) => {
                       if (pairedIds.has(s.id) || topIds.has(s.id)) return;
                       nodes.push(renderRow(s));
                     });
                     return nodes;
                   })()}
                </div>
             </div>
             <div className="space-y-2">
               <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bed</p>
               {filteredBeds.length === 0 && (
                 <p className="text-sm text-muted-foreground">No bed types</p>
               )}
                <div className="grid grid-cols-2 gap-1.5">
                  {filteredBeds.map((b) => {
                   const lockedDouble = onlyDouble && norm(b.label) === "double";
                   const selected = currentBed === b.id || lockedDouble;
                   return (
                     <Row
                       key={b.id}
                       label={<>{b.label}{lockedDouble ? " (default)" : ""}</>}
                       selected={selected}
                       disabled={lockedDouble && selected}
                       onClick={() => {
                         if (lockedDouble) return;
                         setRoomReceptionBed(n, currentBed === b.id ? null : b.id);
                       }}
                     />
                   );
                 })}
               </div>
             </div>
           </div>
         </>
       );
     })()}
   </SheetContent>
 </Sheet>

 {/* Edit defaults sheet (Admin): which template items appear in this room */}
{/* App menu sheet (burger) */}
{authUser && (() => {
  // Map (position, subRoles) → the notification-visibility bucket:
  //   "admin"     → see all toggles
  //   "reception" → hide the housekeeping "marked done" toggle
  //   "user"      → hide the reception message/checkout toggles
  let bucket: "admin" | "user" | "reception" | "maintenance" = "admin";
  if (authUser.position === "admin" || authUser.position === "manager") bucket = "admin";
  else if (hasReceptionRole && hasHousekeeperRole) bucket = "admin";
  else if (hasReceptionRole) bucket = "reception";
  else if (hasHousekeeperRole) bucket = "user";
  else if (myMessageDepartments.includes("maintenance")) bucket = "maintenance";
  return (
    <NotificationsSheet
      open={notificationsSheetOpen}
      onOpenChange={setNotificationsSheetOpen}
      userRole={bucket}
      myDepartments={myMessageDepartments}
    />
  );
})()}
<MessagesSheet
  open={messagesSheetOpen}
  onOpenChange={setMessagesSheetOpen}
  availableThreads={availableThreads}
  initialThread={messagesInitial.thread}
  initialRoom={messagesInitial.room ?? null}
  initialText={messagesInitial.text}
  initialReplyTo={messagesInitial.replyTo}
  currentUsername={authUser?.username ?? null}
  roomNumbers={rooms.map((r) => r.room_number).sort((a, b) => a - b)}
  myDepartments={myMessageDepartments}
  isAdminOrManager={menuIsAdmin}
  onLogMaintenance={async (roomNumber, message) => {
    const originDepartment =
      myMessageDepartments.includes("housekeeping") && !myMessageDepartments.includes("reception")
        ? "housekeeping"
        : myMessageDepartments.includes("reception")
        ? "reception"
        : myMessageDepartments[0] ?? null;
    const { error } = await supabase.from("maintenance_requests" as never).insert({
      room_number: roomNumber,
      message,
      created_by_username: authUser?.username ?? null,
      origin_department: originDepartment,
    } as never);
    if (error) return { ok: false, error: error.message };
    await writeRoomMaintenanceFlag(roomNumber, true);
    qc.invalidateQueries({ queryKey: ["maintenance_requests"] });
    void notifyMaintenanceRequest({
      data: {
        roomNumber,
        message,
        originDepartment:
          originDepartment === "housekeeping" || originDepartment === "reception" || originDepartment === "fnb"
            ? originDepartment
            : null,
      },
    });
    return { ok: true };
  }}
  onLogLostProperty={async (roomNumber, message) => {
    return logLostProperty(roomNumber, message);
  }}
/>
<LostPropertySheet
  open={lostPropertyOpen}
  onOpenChange={setLostPropertyOpen}
  canResolve={canResolveLostProperty}
  isAdmin={menuIsAdmin}
  currentUsername={authUser?.username ?? null}
  canAdd={menuCanUseLostProperty}
  requireRoom={hasHousekeeperRole && !hasReceptionRole}
  roomNumbers={rooms.map((r) => r.room_number).sort((a, b) => a - b)}
  onAdd={logLostProperty}
/>
<StayoverPhotosSheet
  open={stayoverPhotosOpen}
  onOpenChange={(o) => {
    setStayoverPhotosOpen(o);
    if (!o) setStayoverPhotosRoomFilter(undefined);
  }}
  roomFilter={stayoverPhotosRoomFilter}
  title={
    typeof stayoverPhotosRoomFilter === "number"
      ? `Room ${stayoverPhotosRoomFilter} — DND Photo`
      : "Stayover Photos"
  }
/>
<input
  ref={dndFileInputRef}
  type="file"
  accept="image/*"
  capture="environment"
  className="hidden"
  onChange={async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const room = pendingDndRoom;
    setPendingDndRoom(null);
    if (!file || room === null) return;
    const dndId = receptionStatuses.find((x) => x.label === "DND")?.id ?? null;
    if (!dndId) {
      toast.error("DND status not configured");
      return;
    }
    const res = await uploadStayoverPhoto(room, file, authUser?.username ?? null);
    if (!res.ok) {
      toast.error(res.error ?? "Photo upload failed");
      return;
    }
    setRoomReceptionStatus(room, dndId);
    // Mark room as done (housekeeping + reception) alongside DND.
    qc.setQueryData<Room[]>(["rooms"], (old) => {
      const list = old ? [...old] : [];
      const idx = list.findIndex((r) => r.room_number === room);
      if (idx >= 0) list[idx] = { ...list[idx], done: true, done_reception: true };
      return list;
    });
    await supabase.from("rooms").upsert(
      {
        room_number: room,
        done: true,
        done_reception: true,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "user_id,room_number" },
    );
    qc.invalidateQueries({ queryKey: ["rooms"] });
    qc.invalidateQueries({ queryKey: ["stayover_photos"] });
    toast.success("DND set and photo saved");
  }}
/>
<Sheet open={menuSheetOpen} onOpenChange={setMenuSheetOpen}>
  <SheetContent side="right" disableDragDismiss className="w-auto max-w-[90vw] min-w-[18rem] sm:max-w-md p-0 flex flex-col overflow-hidden [&_[data-sheet-close]]:max-lg:hidden">
    <SheetHeader className="text-left shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 bg-background border-b">
      <SheetTitle className="flex items-center gap-2">
        <Menu className="h-4 w-4" />
        Settings
      </SheetTitle>
      {authUser && (
        <SheetDescription>Signed in as {authUser.username}</SheetDescription>
      )}
    </SheetHeader>
    <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6">
    {(() => {
      const Row = ({
        icon: Icon,
        label,
        onClick,
        destructive,
      }: { icon: React.ComponentType<{ className?: string }>; label: React.ReactNode; onClick: () => void; destructive?: boolean }) => (
        <button
          type="button"
          onClick={onClick}
          className={cn(
            "w-full flex items-center gap-3 rounded-full border bg-background px-4 min-h-12 text-sm font-medium transition-colors hover:bg-accent",
            destructive && "text-destructive hover:text-destructive",
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="text-left flex-1">{label}</span>
        </button>
      );
      const close = () => setMenuSheetOpen(false);
      const Section = ({
        id,
        title,
        children,
      }: { id: string; title: string; children: React.ReactNode }) => {
        const collapsed = !!menuCollapsed[id];
        return (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => void toggleMenuSection(id)}
              className="w-full flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>{title}</span>
              <ChevronDown
                className={cn("h-3.5 w-3.5 transition-transform", collapsed && "-rotate-90")}
                aria-hidden
              />
            </button>
            {!collapsed && <div className="space-y-1.5">{children}</div>}
          </div>
        );
      };
      return (
        <div className="space-y-4">
          {(canViewAs || (isAdmin && !isReception) || isReception) && (
            <Section id="actions" title="Actions">
                {canViewAs && (
                  <Row
                    icon={Users}
                    label="Department"
                    onClick={() => { close(); setRolePickerSheetOpen(true); }}
                  />
                )}
                {isAdmin && !isReception && (
                  <Row
                    icon={ClipboardList}
                    label="Export"
                    onClick={() => { close(); setExportSheetOpen(true); }}
                  />
                )}
                {isReception && (
                  <Row
                    icon={Printer}
                    label="Print"
                    onClick={() => {
                      close();
                      const { rows } = computeRoomStatus();
                      if (rows.length === 0) { toast.error("No rooms to print"); return; }
                      printRoomStatus(rows, new Date());
                    }}
                  />
                )}
                {isReception && (
                  <Row
                    icon={HelpCircle}
                    label="Help"
                    onClick={() => { close(); setReceptionHelpOpen(true); }}
                  />
                )}
            </Section>
          )}
          {((menuHasHk || menuHasFnb) && !isMaintenance) || (menuIsAdmin && !isMaintenance) ? (
            <Section id="manage" title="Manage">
              {(menuHasHk || menuHasFnb) && !isMaintenance && (
                <Row icon={List} label="Linen List" onClick={() => { close(); setTemplateOpen(true); }} />
              )}
              {menuIsAdmin && !isMaintenance && (
                <>
                  <Row icon={Hash} label="Manage Rooms" onClick={() => { close(); setManageRoomsOpen(true); }} />
                  <Row icon={Ban} label="Rejects" onClick={() => { close(); setRejectsOpen(true); }} />
                  {!isReception && (
                    <Row icon={History} label="History" onClick={() => { close(); setHistorySheetOpen(true); }} />
                  )}
                  <Row icon={ConciergeBell} label="Bulk Room Status Setup" onClick={() => { close(); setQuickReceptionOpen(true); }} />
                </>
              )}
            </Section>
          ) : null}
          {((!menuIsFnbOnly && !isMaintenance) || (menuCanUseLostProperty && !isMaintenance) || canUseMessages) && (
            <Section id="utilities" title="Utilities">
              {!menuIsFnbOnly && !isMaintenance && (
                <Row
                  icon={Wrench}
                  label={
                    <span className="flex items-center gap-2">
                      Maintenance Log
                      {hasOpenMaintenance && (
                        <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
                      )}
                    </span>
                  }
                  onClick={() => { close(); setMaintenanceLogOpen(true); }}
                />
              )}
              {menuCanUseLostProperty && !isMaintenance && (
                <Row
                  icon={PackageSearch}
                  label="Lost Property"
                  onClick={() => { close(); setLostPropertyOpen(true); }}
                />
              )}
              {canUseMessages && (
                <Row
                  icon={MessageSquare}
                  label="Messages"
                  onClick={() => { close(); setMessagesInitial({}); setMessagesSheetOpen(true); }}
                />
              )}
            </Section>
          )}
          <Section id="appearance" title="Appearance">
            <Row
              icon={theme === "dark" ? Sun : Moon}
              label={theme === "dark" ? "Light mode" : "Dark mode"}
              onClick={() => toggleTheme()}
            />
          </Section>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account</p>
            <div className="space-y-1.5">
              {realIsAdmin && !isMaintenance && (
                <Row icon={Users} label="Users" onClick={() => { close(); setUsersOpen(true); }} />
              )}
              {realIsManager && !realIsAdmin && !isMaintenance && (
                <Row icon={Users} label="User Approval" onClick={() => { close(); setUserApprovalOpen(true); }} />
              )}
              {!menuIsFnbOnly && (
                <Row icon={Bell} label="Notifications" onClick={() => { close(); setNotificationsSheetOpen(true); }} />
              )}
              <Row icon={User} label="Account" onClick={() => { close(); setAccountOpen(true); }} />
              <Row icon={LogOut} label="Sign out" destructive onClick={() => { close(); void signOut(); }} />
            </div>
          </div>
        </div>
      );
    })()}
    </div>
  </SheetContent>
</Sheet>

{/* History sheet (Admin) */}
<Sheet open={maintenanceLogOpen} onOpenChange={setMaintenanceLogOpen}>
  <SheetContent side="bottom" className="max-h-[90vh] overflow-hidden rounded-t-2xl p-4 sm:p-6 flex flex-col">
    <SheetHeader className="text-left">
      <SheetTitle className="flex items-center gap-2">
        <Wrench className="h-4 w-4" />
        Maintenance Log
        {hasOpenMaintenance && (
          <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-xs font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
            {openMaintenanceCount} open
          </span>
        )}
      </SheetTitle>
      <SheetDescription>
        {isReception || isMaintenance
          ? "Reception and Maintenance can mark requests as complete."
          : "Log a maintenance issue for Reception or Maintenance to action."}
      </SheetDescription>
    </SheetHeader>
    <div className="mt-4 flex flex-col gap-2 border-b pb-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          type="number"
          inputMode="numeric"
          placeholder="Room #"
          value={newMaintenanceRoom}
          onChange={(e) => setNewMaintenanceRoom(e.target.value)}
          className="sm:w-28"
        />
        <Input
          placeholder="Describe the issue…"
          value={newMaintenanceText}
          onChange={(e) => setNewMaintenanceText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submitMaintenanceRequest();
            }
          }}
          className="flex-1"
        />
        <Button type="button" onClick={() => void submitMaintenanceRequest()}>
          <Plus className="h-4 w-4 mr-1" /> Log
        </Button>
      </div>
      <PhotoComposer value={newMaintenancePhotos} onChange={setNewMaintenancePhotos} />
    </div>
    <div className="flex-1 min-h-0 overflow-y-auto mt-4 space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Open ({openMaintenanceCount})
        </p>
        {openMaintenanceCount === 0 ? (
          <p className="text-sm text-muted-foreground">No open maintenance requests.</p>
        ) : (
          maintenanceRequests
            .filter((m) => !m.done)
            .map((m) => (
              <div key={m.id} className="flex items-start gap-2 rounded-lg border bg-background p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex h-6 items-center rounded-full bg-primary/10 text-primary px-2 text-xs font-semibold">
                      Room {m.room_number}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(m.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      {m.created_by_username ? ` · ${m.created_by_username}` : ""}
                    </span>
                  </div>
                  <p className="mt-1 text-sm whitespace-pre-wrap break-words">{m.message}</p>
                  <PhotoAttachments
                    kind="maintenance"
                    entryId={m.id}
                    paths={m.photo_paths ?? []}
                    canEdit={
                      isAdmin ||
                      (!!authUser?.username && m.created_by_username === authUser.username)
                    }
                    onChange={(next) => setMaintenancePhotoPaths(m.id, next)}
                  />
                </div>
                {isReception || isMaintenance ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void markMaintenanceDone(m.id)}
                    aria-label="Mark as done"
                  >
                    <Check className="h-4 w-4 mr-1" /> Done
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground shrink-0 pt-1">Awaiting action</span>
                )}
                {isAdmin && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => void deleteMaintenanceRequest(m.id)}
                    aria-label="Delete request"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))
        )}
      </div>
      {maintenanceRequests.some((m) => m.done) && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Completed</p>
          {maintenanceRequests
            .filter((m) => m.done)
            .slice(0, 25)
            .map((m) => (
              <div key={m.id} className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex h-6 items-center rounded-full bg-muted text-muted-foreground px-2 text-xs font-semibold">
                      Room {m.room_number}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Done{m.done_by_username ? ` by ${m.done_by_username}` : ""}
                      {m.done_at ? ` · ${new Date(m.done_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}
                    </span>
                  </div>
                  <p className="mt-1 text-sm whitespace-pre-wrap break-words text-muted-foreground line-through">{m.message}</p>
                  <PhotoAttachments
                    kind="maintenance"
                    entryId={m.id}
                    paths={m.photo_paths ?? []}
                    canEdit={
                      isAdmin ||
                      (!!authUser?.username && m.created_by_username === authUser.username)
                    }
                    onChange={(next) => setMaintenancePhotoPaths(m.id, next)}
                  />
                </div>
                {(isReception || isMaintenance || isAdmin) && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => void deleteMaintenanceRequest(m.id)}
                    aria-label="Delete request"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  </SheetContent>
</Sheet>

<Sheet open={historySheetOpen} onOpenChange={setHistorySheetOpen}>
   <SheetContent side="bottom" className="max-h-[90vh] overflow-hidden rounded-t-2xl p-4 sm:p-6">
    <SheetHeader className="text-left">
      <SheetTitle className="flex items-center gap-2">
        <History className="h-4 w-4" />
        History
      </SheetTitle>
      <SheetDescription>Recent exports</SheetDescription>
    </SheetHeader>
    <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
      {(isFnb ? snapshots.filter((s) => s.kind === "fnb_totals") : snapshots.filter((s) => s.kind !== "fnb_totals")).length === 0 ? (
        <p className="text-sm text-muted-foreground">No exports yet.</p>
      ) : (
        (() => {
          const visible = isFnb
            ? snapshots.filter((s) => s.kind === "fnb_totals")
            : snapshots.filter((s) => s.kind !== "fnb_totals");
          const groups = new Map<string, typeof snapshots>();
          for (const s of visible) {
            const key = new Date(s.created_at).toDateString();
            const list = groups.get(key) ?? [];
            if (list.length < 6) list.push(s);
            groups.set(key, list);
          }
          const days = Array.from(groups.entries()).slice(0, 6);
          return days.map(([day, items]) => (
            <div key={day} className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {new Date(items[0].created_at).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </p>
              {items.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 rounded-full border bg-background min-h-12 pl-4 pr-1.5"
                >
                  <button
                    type="button"
                    className="flex-1 flex items-center gap-2 text-left text-sm py-2"
                    onClick={() => { setHistorySheetOpen(false); setViewingSnapshot(s); }}
                  >
                    <span>
                      {new Date(s.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                    </span>
                    {s.kind === "rejects" && (
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">Rejects</span>
                    )}
                    {s.kind === "room_status" && (
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">Room status</span>
                    )}
                    {s.kind === "maintenance" && (
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">Maintenance</span>
                    )}
                    {s.kind === "fnb_totals" && (
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">F&amp;B Linen</span>
                    )}
                    <span className="text-xs text-muted-foreground">({s.grand_total})</span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-destructive"
                    onClick={() => removeSnapshot(s.id)}
                    aria-label="Delete history item"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ));
        })()
      )}
      {(isFnb ? snapshots.filter((s) => s.kind === "fnb_totals") : snapshots.filter((s) => s.kind !== "fnb_totals")).length > 0 && (
        <Button
          type="button"
          variant="outline"
          className="w-full text-destructive hover:text-destructive"
          onClick={() => clearAllSnapshots(isFnb ? "fnb_totals" : undefined)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Clear history
        </Button>
      )}
    </div>
  </SheetContent>
</Sheet>

 <Sheet open={editDefaultsSheetRoom !== null} onOpenChange={(o) => { if (!o) setEditDefaultsSheetRoom(null); }}>
   <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl p-4 sm:p-6">
     {editDefaultsSheetRoom !== null && (() => {
       const n = editDefaultsSheetRoom;
       return (
         <>
           <SheetHeader className="text-left">
             <SheetTitle className="flex items-center gap-2">
               <Pencil className="h-4 w-4" />
               Edit defaults — Room {n}
             </SheetTitle>
             <SheetDescription>Choose which linen items appear by default</SheetDescription>
           </SheetHeader>
           <div className="mt-4 space-y-1.5">
             {template.length === 0 ? (
               <p className="text-sm text-muted-foreground">No items yet.</p>
             ) : (
               template.map((t) => {
                 const checked = isAssigned(t.id, n);
                 return (
                   <button
                     key={t.id}
                     type="button"
                     onClick={() => toggleAssignment(t.id, n)}
                     className={cn(
                       "w-full flex items-center justify-between gap-3 rounded-full border bg-background px-4 min-h-12 text-sm font-medium transition-colors hover:bg-accent",
                       checked && "border-primary bg-primary/10 text-primary",
                     )}
                   >
                     <span className="text-left">{t.name}</span>
                     {checked ? <Check className="h-5 w-5" /> : <span className="h-5 w-5" />}
                   </button>
                 );
               })
             )}
           </div>
         </>
       );
     })()}
   </SheetContent>
 </Sheet>

 {/* Room Types sheet (Admin) */}
 <Sheet open={roomTypesSheetOpen} onOpenChange={setRoomTypesSheetOpen}>
  <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto p-4 sm:p-6">
     <SheetHeader className="text-left">
       <SheetTitle className="flex items-center gap-2">
         <Bed className="h-4 w-4" />
         Room types
       </SheetTitle>
       <SheetDescription>Manage the list of room types</SheetDescription>
     </SheetHeader>
     <div className="mt-4 space-y-1.5">
       {roomTypes.length === 0 ? (
         <p className="text-sm text-muted-foreground">No room types yet.</p>
       ) : (
          roomTypes.map((rt, idx) => (
            <ManageEditableRow
              key={rt.id}
              label={rt.label}
              canMoveUp={idx > 0}
              canMoveDown={idx < roomTypes.length - 1}
              onMoveUp={() => moveRoomType(rt.id, -1)}
              onMoveDown={() => moveRoomType(rt.id, 1)}
              onRename={(v: string) => renameRoomType(rt.id, v)}
              onDelete={() => deleteRoomType(rt.id)}
            />
          ))
       )}
       <Button
         type="button"
         variant="outline"
         className="w-full mt-2"
         onClick={() => setAddRoomTypeOpen(true)}
       >
         <Plus className="h-4 w-4 mr-2" />
         Add room type
       </Button>
     </div>
   </SheetContent>
 </Sheet>

 {/* Room Features sheet (Admin) */}
 <Sheet open={roomFeaturesSheetOpen} onOpenChange={setRoomFeaturesSheetOpen}>
  <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto p-4 sm:p-6">
     <SheetHeader className="text-left">
       <SheetTitle className="flex items-center gap-2">
         <List className="h-4 w-4" />
         Room features
       </SheetTitle>
       <SheetDescription>Manage the list of room features</SheetDescription>
     </SheetHeader>
     <div className="mt-4 space-y-1.5">
       {roomFeatures.length === 0 ? (
         <p className="text-sm text-muted-foreground">No features yet.</p>
       ) : (
          roomFeatures.map((f, idx) => (
            <ManageEditableRow
              key={f.id}
              label={f.label}
              canMoveUp={idx > 0}
              canMoveDown={idx < roomFeatures.length - 1}
              onMoveUp={() => moveRoomFeature(f.id, -1)}
              onMoveDown={() => moveRoomFeature(f.id, 1)}
              onRename={(v: string) => renameRoomFeature(f.id, v)}
              onDelete={() => deleteRoomFeature(f.id)}
            />
          ))
       )}
       <Button
         type="button"
         variant="outline"
         className="w-full mt-2"
         onClick={() => setAddRoomFeatureOpen(true)}
       >
         <Plus className="h-4 w-4 mr-2" />
         Add feature
       </Button>
     </div>
   </SheetContent>
 </Sheet>

 {/* Reception items sheet (Admin) */}
 <Sheet open={receptionItemsSheetOpen} onOpenChange={setReceptionItemsSheetOpen}>
  <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto p-4 sm:p-6">
     <SheetHeader className="text-left">
       <SheetTitle className="flex items-center gap-2">
         <ConciergeBell className="h-4 w-4" />
         Reception
       </SheetTitle>
       <SheetDescription>Manage room statuses and bed types</SheetDescription>
     </SheetHeader>
     <div className="mt-4 space-y-5">
       <div className="space-y-2">
         <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Room status</p>
         <div className="space-y-1.5">
           {receptionStatuses.length === 0 && (
             <p className="text-sm text-muted-foreground">No statuses yet.</p>
           )}
            {receptionStatuses.map((s, idx) => (
              <ManageEditableRow
                key={s.id}
                label={s.label}
                canMoveUp={idx > 0}
                canMoveDown={idx < receptionStatuses.length - 1}
                onMoveUp={() => moveReceptionItem(s.id, -1)}
                onMoveDown={() => moveReceptionItem(s.id, 1)}
                onRename={(v: string) => renameReceptionItem(s.id, v)}
                onDelete={() => deleteReceptionItem(s.id)}
              />
            ))}
           <Button
             type="button"
             variant="outline"
             className="w-full"
             onClick={() => setAddReceptionItemKind("status")}
           >
             <Plus className="h-4 w-4 mr-2" />
             Add status
           </Button>
         </div>
       </div>
       <div className="space-y-2">
         <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bed set as</p>
         <div className="space-y-1.5">
           {receptionBeds.length === 0 && (
             <p className="text-sm text-muted-foreground">No bed types yet.</p>
           )}
            {receptionBeds.map((b, idx) => (
              <ManageEditableRow
                key={b.id}
                label={b.label}
                canMoveUp={idx > 0}
                canMoveDown={idx < receptionBeds.length - 1}
                onMoveUp={() => moveReceptionItem(b.id, -1)}
                onMoveDown={() => moveReceptionItem(b.id, 1)}
                onRename={(v: string) => renameReceptionItem(b.id, v)}
                onDelete={() => deleteReceptionItem(b.id)}
              />
            ))}
           <Button
             type="button"
             variant="outline"
             className="w-full"
             onClick={() => setAddReceptionItemKind("bed")}
           >
             <Plus className="h-4 w-4 mr-2" />
             Add bed type
           </Button>
         </div>
       </div>
     </div>
   </SheetContent>
 </Sheet>

  {/* Edit room sheet (Admin) */}
  <Sheet open={editRoomSheetNumber !== null} onOpenChange={(o) => { if (!o) setEditRoomSheetNumber(null); }}>
    <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto p-4 sm:p-6">
      {editRoomSheetNumber !== null && (() => {
        const n = editRoomSheetNumber;
        const r = rooms.find((x) => x.room_number === n);
        if (!r) return null;
        const cats = parseCats(r.category);
        return (
          <>
            <SheetHeader className="text-left">
              <SheetTitle className="flex items-center gap-2">
                <Pencil className="h-4 w-4" />
                Edit Room {n}
              </SheetTitle>
              <SheetDescription>Set room type, default status and features</SheetDescription>
            </SheetHeader>
            <div className="mt-4 space-y-5">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Room type</p>
                <div className="space-y-1.5">
                  {roomTypes.length === 0 && (
                    <p className="text-sm text-muted-foreground">No room types yet.</p>
                  )}
                  {roomTypes.map((c) => {
                    const selected = cats.includes(c.value);
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => toggleRoomCategory(n, c.value)}
                        className={cn(
                          "w-full flex items-center justify-between gap-3 rounded-full border bg-background px-4 min-h-12 text-sm font-medium transition-colors hover:bg-accent",
                          selected && "border-primary bg-primary/10 text-primary",
                        )}
                      >
                        <span className="text-left">{c.label}</span>
                        {selected ? <Check className="h-5 w-5" /> : <span className="h-5 w-5" />}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Default status</p>
                <div className="space-y-1.5">
                  {receptionStatuses.length === 0 && (
                    <p className="text-sm text-muted-foreground">No statuses yet.</p>
                  )}
                  {receptionStatuses.map((s) => {
                    const selected = r.default_status === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setRoomDefaultStatus(n, selected ? null : s.id)}
                        className={cn(
                          "w-full flex items-center justify-between gap-3 rounded-full border bg-background px-4 min-h-12 text-sm font-medium transition-colors hover:bg-accent",
                          selected && "border-primary bg-primary/10 text-primary",
                        )}
                      >
                        <span className="text-left">{s.label}</span>
                        {selected ? <Check className="h-5 w-5" /> : <span className="h-5 w-5" />}
                      </button>
                    );
                  })}
                </div>
              </div>
              {roomFeatures.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Room features</p>
                  <div className="space-y-1.5">
                    {roomFeatures.map((f) => {
                      const selected = roomFeatureAssignments.some(
                        (a) => a.feature_id === f.id && a.room_number === n,
                      );
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => toggleRoomFeature(n, f.id)}
                          className={cn(
                            "w-full flex items-center justify-between gap-3 rounded-full border bg-background px-4 min-h-12 text-sm font-medium transition-colors hover:bg-accent",
                            selected && "border-primary bg-primary/10 text-primary",
                          )}
                        >
                          <span className="text-left">{f.label}</span>
                          {selected ? <Check className="h-5 w-5" /> : <span className="h-5 w-5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        );
      })()}
    </SheetContent>
  </Sheet>

  {/* Add room type dialog */}
  <Dialog open={addRoomTypeOpen} onOpenChange={setAddRoomTypeOpen}>
    <DialogContent className="max-w-sm w-[calc(100vw-1.5rem)] sm:w-full p-4 sm:p-6">
      <DialogHeader>
        <DialogTitle>Add Room Type</DialogTitle>
        <DialogDescription>
          Enter a name for the new room type.
        </DialogDescription>
      </DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addRoomType(newRoomTypeLabel);
        }}
        className="space-y-3"
      >
        <Input
          placeholder="e.g. Twin"
          value={newRoomTypeLabel}
          onChange={(e) => setNewRoomTypeLabel(e.target.value)}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setAddRoomTypeOpen(false);
              setNewRoomTypeLabel("");
            }}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={!newRoomTypeLabel.trim()}>
            Add
          </Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>

  {/* Add room feature dialog */}
  {/* Add reception item dialog */}
  <Dialog
    open={addReceptionItemKind !== null}
    onOpenChange={(o) => {
      if (!o) {
        setAddReceptionItemKind(null);
        setNewReceptionItemLabel("");
      }
    }}
  >
    <DialogContent className="max-w-sm w-[calc(100vw-1.5rem)] sm:w-full p-4 sm:p-6">
      <DialogHeader>
        <DialogTitle>
          {addReceptionItemKind === "bed" ? "Add Bed Type" : "Add Room Status"}
        </DialogTitle>
        <DialogDescription>
          {addReceptionItemKind === "bed"
            ? "Enter a name for the new bed type."
            : "Enter a name for the new room status."}
        </DialogDescription>
      </DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (addReceptionItemKind) {
            addReceptionItem(addReceptionItemKind, newReceptionItemLabel);
          }
        }}
        className="space-y-3"
      >
        <Input
          placeholder={addReceptionItemKind === "bed" ? "e.g. King" : "e.g. Arrival"}
          value={newReceptionItemLabel}
          onChange={(e) => setNewReceptionItemLabel(e.target.value)}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setAddReceptionItemKind(null);
              setNewReceptionItemLabel("");
            }}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={!newReceptionItemLabel.trim()}>
            Add
          </Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>

  {/* Add room feature dialog */}
  <Dialog open={addRoomFeatureOpen} onOpenChange={setAddRoomFeatureOpen}>
    <DialogContent className="max-w-sm w-[calc(100vw-1.5rem)] sm:w-full p-4 sm:p-6">
      <DialogHeader>
        <DialogTitle>Add Room Feature</DialogTitle>
        <DialogDescription>
          Enter a name for the new room feature.
        </DialogDescription>
      </DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addRoomFeature(newRoomFeatureLabel);
        }}
        className="space-y-3"
      >
        <Input
          placeholder="e.g. Balcony"
          value={newRoomFeatureLabel}
          onChange={(e) => setNewRoomFeatureLabel(e.target.value)}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setAddRoomFeatureOpen(false);
              setNewRoomFeatureLabel("");
            }}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={!newRoomFeatureLabel.trim()}>
            Add
          </Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>

 {/* Reception color legend help dialog */}
 <Dialog open={receptionHelpOpen} onOpenChange={setReceptionHelpOpen}>
   <DialogContent className="max-w-md w-[calc(100vw-1.5rem)] sm:w-full p-4 sm:p-6">
     <DialogHeader>
      <DialogTitle>Icon & symbol guide</DialogTitle>
      <DialogDescription>
        Tap any icon or symbol to see what it means.
      </DialogDescription>
     </DialogHeader>
    <ReceptionIconGuide />
   </DialogContent>
 </Dialog>

 {/* Rejects dialog */}
 <Dialog open={rejectsOpen} onOpenChange={setRejectsOpen}>
    <DialogContent className="max-w-md w-[calc(100vw-1.5rem)] sm:w-full p-4 sm:p-6 h-[90vh] sm:h-auto sm:max-h-[85vh] flex flex-col gap-3">
      <DialogHeader className="shrink-0">
       <DialogTitle>Rejects</DialogTitle>
        <DialogDescription>
          Tally all linen rejects before sending back to be cleaned
        </DialogDescription>
     </DialogHeader>
     {template.length === 0 ? (
       <p className="text-sm text-muted-foreground py-4">
         No linen items yet. Add some from the Linen List.
       </p>
     ) : (
         <div className="border rounded-md bg-muted/30 flex flex-col min-h-0 flex-1 overflow-hidden">
           <div className="flex-1 min-h-0 overflow-y-auto p-4">
            <ul className="space-y-1">
              {template.map((item) => {
                const count = getRejectCount(item.id);
                const c = item.color ? COLOR_SWATCHES[item.color] : null;
                const style: React.CSSProperties | undefined = c
                  ? { backgroundColor: theme === "dark" ? c.darkBg : c.bg, borderLeft: `4px solid ${c.border}` }
                  : undefined;
                return (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 py-2 px-2 rounded-md border"
                    style={style}
                  >
                    <span
                      className="flex-1 min-w-0 break-words"
                      style={item.color ? { color: theme === "dark" ? "#f8fafc" : "#0f172a" } : undefined}
                    >
                      {item.name}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 sm:h-8 sm:w-8"
                        onClick={() => updateRejectCount(item.id, -1)}
                        disabled={count === 0}
                        aria-label={`Decrease ${item.name}`}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span
                        className="w-10 sm:w-8 text-center tabular-nums font-medium"
                        style={item.color ? { color: theme === "dark" ? "#f8fafc" : "#0f172a" } : undefined}
                      >
                        {count}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 sm:h-8 sm:w-8"
                        onClick={() => updateRejectCount(item.id, 1)}
                        aria-label={`Increase ${item.name}`}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="flex items-center justify-between gap-2 border-t bg-background/60 px-3 py-2 text-sm">
            <span className="text-muted-foreground">
              Total: {rejects.reduce((s, r) => s + r.count, 0)}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={resetRejects}
              >
                Reset all
              </Button>
              <Button variant="outline" size="sm" onClick={openRejectExport}>
                Export
              </Button>
            </div>
          </div>
        </div>
     )}
   </DialogContent>
 </Dialog>

  {/* Manage Rooms dialog */}
  <Dialog open={manageRoomsOpen} onOpenChange={setManageRoomsOpen}>
    <DialogContent className="max-w-md w-[calc(100vw-1.5rem)] sm:w-full p-4 sm:p-6">
      <DialogHeader>
        <DialogTitle>Manage Rooms</DialogTitle>
        <DialogDescription>
          Add or remove rooms. New rooms work like every other room — they
          appear in the grid, share the Linen List, and support Room Types.
          Rejects always stays at the end.
        </DialogDescription>
        <div className="mt-4 grid w-full grid-cols-2 gap-3">
          <Button variant="outline" size="sm" className="min-w-0 justify-center gap-1.5 px-3 rounded-full" onClick={() => setRoomTypesSheetOpen(true)}>
            <Bed className="h-4 w-4 shrink-0" />
            <span className="truncate">Room Type</span>
          </Button>
          <Button variant="outline" size="sm" className="min-w-0 justify-center gap-1.5 px-3 rounded-full" onClick={() => setRoomFeaturesSheetOpen(true)}>
            <List className="h-4 w-4 shrink-0" />
            <span className="truncate">Features</span>
          </Button>
          <Button variant="outline" size="sm" className="min-w-0 justify-center gap-1.5 px-3 rounded-full" onClick={() => setReceptionItemsSheetOpen(true)}>
            <ConciergeBell className="h-4 w-4 shrink-0" />
            <span className="truncate">Reception</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="min-w-0 justify-center gap-1.5 px-3 rounded-full"
            onClick={() => {
              const used = new Set(rooms.map((r) => r.room_number));
              let suggested = 1;
              while (used.has(suggested)) suggested++;
              setNewRoomNumber(String(suggested));
              setAddRoomConfirmOpen(true);
            }}
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span className="truncate">Add Room</span>
          </Button>
        </div>
      </DialogHeader>
      <div className="space-y-3">
        <div className="text-xs text-muted-foreground">
          {rooms.length} room{rooms.length === 1 ? "" : "s"} total
        </div>
        <ul className="divide-y rounded-md border max-h-[50vh] overflow-y-auto">
          {rooms
            .slice()
            .sort((a, b) => (a.sort_order ?? a.room_number) - (b.sort_order ?? b.room_number))
            .map((r, idx, arr) => (
              <li key={r.id} className="flex items-center gap-3 px-3 py-2">
                <span className="flex-1 text-sm font-medium tabular-nums">
                  Room {r.room_number}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => setEditRoomSheetNumber(r.room_number)}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => removeRoom(r.room_number)}
                  aria-label={`Remove Room ${r.room_number}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={idx === 0}
                  onClick={() => moveRoom(r.room_number, -1)}
                  aria-label={`Move Room ${r.room_number} up`}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={idx === arr.length - 1}
                  onClick={() => moveRoom(r.room_number, 1)}
                  aria-label={`Move Room ${r.room_number} down`}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </li>
            ))}
        </ul>
      </div>
    </DialogContent>
  </Dialog>

  <Dialog open={addRoomConfirmOpen} onOpenChange={setAddRoomConfirmOpen}>
    <DialogContent className="max-w-sm w-[calc(100vw-1.5rem)] sm:w-full p-4 sm:p-6">
      <DialogHeader>
        <DialogTitle>Add room</DialogTitle>
        <DialogDescription>
          Enter a room number. The new room is added to the bottom of the list.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground">Room number</label>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={999}
            autoFocus
            value={newRoomNumber}
            onChange={(e) => setNewRoomNumber(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const n = Number(newRoomNumber);
                if (Number.isFinite(n)) {
                  addRoom(n);
                  setNewRoomNumber("");
                  setAddRoomConfirmOpen(false);
                }
              }
            }}
          />
        </div>
        <Button
          className="w-full"
          onClick={() => {
            const n = Number(newRoomNumber);
            if (!Number.isFinite(n)) {
              toast.error("Enter a valid room number.");
              return;
            }
            addRoom(n);
            setNewRoomNumber("");
            setAddRoomConfirmOpen(false);
          }}
        >
          <Check className="h-4 w-4 mr-1" />
          Confirm
        </Button>
      </div>
    </DialogContent>
  </Dialog>

 {/* Rooms */}
 {isMaintenance ? (
   <section className="space-y-4">
     <div className="flex items-baseline justify-between">
       <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
         Maintenance Requests
       </h2>
       <span className="text-xs text-muted-foreground">
         {openMaintenanceCount} open
       </span>
     </div>
     {(() => {
       const openReqs = maintenanceRequests.filter((m) => !m.done);
       const doneReqs = maintenanceRequests.filter((m) => m.done).slice(0, 30);
       const openMsgs = roomMessages
         .filter(
           (m) =>
             (m.thread === "hk_maintenance" || m.thread === "reception_maintenance") &&
             !m.done_at &&
             !m.deleted_at,
         )
         .slice(0, 100);
       type Item = {
         id: string;
         source: "req" | "msg";
         roomNumber: number | null;
         message: string;
         sender: string | null;
         createdAt: string;
         origin: "housekeeping" | "reception" | null;
         done: boolean;
       };
       const items: Item[] = [
         ...openReqs.map<Item>((m) => ({
           id: `req-${m.id}`,
           source: "req",
           roomNumber: m.room_number,
           message: m.message,
           sender: m.created_by_username,
           createdAt: m.created_at,
           origin:
             ((m as unknown as { origin_department?: string | null }).origin_department as
               | "housekeeping"
               | "reception"
               | null) ?? null,
           done: false,
         })),
         ...openMsgs.map<Item>((m) => ({
           id: `msg-${m.id}`,
           source: "msg",
           roomNumber: m.room_number,
           message: m.message,
           sender: m.created_by_username,
           createdAt: m.created_at,
           origin: m.thread === "reception_maintenance" ? "reception" : "housekeeping",
           done: false,
         })),
       ].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
       const rawId = (id: string) => id.replace(/^req-|^msg-/, "");
       const markDoneItem = async (it: Item) => {
         if (it.source === "req") {
           await markMaintenanceDone(rawId(it.id));
         } else {
           await supabase
             .from("room_messages" as never)
             .update({ done_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never)
             .eq("id", rawId(it.id));
           qc.invalidateQueries({ queryKey: ["room_messages"] });
         }
       };
       const deleteItem = async (it: Item) => {
         if (it.source === "req") {
           await supabase
             .from("maintenance_requests" as never)
             .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString(), done: true, done_at: new Date().toISOString() } as never)
             .eq("id", rawId(it.id));
           qc.invalidateQueries({ queryKey: ["maintenance_requests"] });
         } else {
           await supabase
             .from("room_messages" as never)
             .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never)
             .eq("id", rawId(it.id));
           qc.invalidateQueries({ queryKey: ["room_messages"] });
         }
       };
       const replyToItem = (it: Item) => {
         const thread: MessagesThread =
           it.origin === "reception" ? "reception_maintenance" : "hk_maintenance";
          setMessagesInitial({
            thread,
            room: it.roomNumber ?? null,
            text: "",
            replyTo: {
              id: rawId(it.id),
              sender: it.sender ?? (it.origin === "reception" ? "Reception" : "Housekeeping"),
              snippet: it.message.slice(0, 280),
            },
          });
         setMessagesSheetOpen(true);
       };
       return (
         <>
           {items.length === 0 ? (
             <p className="text-sm text-muted-foreground py-8 text-center">
               No open maintenance items.
             </p>
           ) : (
             <ul className="space-y-2">
               {items.map((it) => (
                 <li key={it.id} className="rounded-lg border bg-background p-3">
                   <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                     {typeof it.roomNumber === "number" && (
                       <span className="inline-flex h-6 items-center rounded-full bg-primary/10 text-primary px-2 font-semibold">
                         Room {it.roomNumber}
                       </span>
                     )}
                     {it.origin && (
                       <span className="inline-flex h-5 items-center rounded-full bg-muted px-2 text-[10px] font-semibold uppercase">
                         {it.origin === "reception" ? "Reception" : "Housekeeping"}
                       </span>
                     )}
                     <span>
                       {new Date(it.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                       {it.sender ? ` · ${it.sender}` : ""}
                     </span>
                   </div>
                   <p className="mt-2 text-sm whitespace-pre-wrap break-words">{it.message}</p>
                   <div className="mt-3 flex flex-wrap justify-end gap-2">
                     <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => void replyToItem(it)}>
                       <MessageSquare className="h-3.5 w-3.5 mr-1" /> Reply
                     </Button>
                     <Button type="button" size="sm" variant="default" className="h-8 text-xs" onClick={() => void markDoneItem(it)}>
                       <Check className="h-3.5 w-3.5 mr-1" /> Done
                     </Button>
                     <Button type="button" size="sm" variant="ghost" className="h-8 text-xs text-destructive hover:text-destructive" onClick={() => void deleteItem(it)}>
                       <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                     </Button>
                   </div>
                 </li>
               ))}
             </ul>
           )}
           {doneReqs.length > 0 && (
             <div className="mt-6 space-y-2">
               <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Completed</p>
               {doneReqs.map((m) => (
                 <div key={m.id} className="rounded-lg border bg-muted/40 p-3">
                   <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                     <span className="inline-flex h-6 items-center rounded-full bg-muted px-2 font-semibold">Room {m.room_number}</span>
                     <span>
                       Done{m.done_by_username ? ` by ${m.done_by_username}` : ""}
                       {m.done_at ? ` · ${new Date(m.done_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}
                     </span>
                   </div>
                   <p className="mt-1 text-sm whitespace-pre-wrap break-words text-muted-foreground line-through">{m.message}</p>
                   <div className="mt-2 flex justify-end">
                     <Button
                       type="button"
                       size="sm"
                       variant="ghost"
                       className="h-7 text-xs"
                       onClick={async () => {
                         await supabase
                           .from("maintenance_requests" as never)
                           .update({ done: false, done_at: null, done_by_username: null, updated_at: new Date().toISOString() } as never)
                           .eq("id", m.id);
                         qc.invalidateQueries({ queryKey: ["maintenance_requests"] });
                       }}
                     >
                       <RotateCcw className="h-3 w-3 mr-1" /> Reopen
                     </Button>
                   </div>
                 </div>
               ))}
             </div>
           )}
         </>
       );
     })()}
   </section>
 ) : isFnb ? (
   <section className="space-y-4">
     <div className="flex items-baseline justify-between">
       <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
         F&amp;B Linen Counter
       </h2>
     </div>
      {templateFnbList.length === 0 ? (
       <p className="text-sm text-muted-foreground">
          No F&amp;B linen items yet. Add some from the Linen List (F&amp;B tab).
       </p>
     ) : (
       <ul className="divide-y border rounded-md bg-muted/30">
          {templateFnbList.map((item) => {
           const value = fnbCountByItem.get(item.id) ?? 0;
           const swatch = item.color ? COLOR_SWATCHES[item.color] : null;
           return (
             <li key={item.id} className="flex items-center gap-3 p-3">
               <span
                 className="h-3 w-3 rounded-full border-2 shrink-0"
                 style={{
                   backgroundColor: swatch
                     ? theme === "dark"
                       ? swatch.darkBg
                       : swatch.bg
                     : "transparent",
                   borderColor: swatch ? swatch.border : "hsl(var(--border))",
                 }}
                 aria-hidden
               />
               <span className="flex-1 min-w-0 break-words text-sm font-medium">{item.name}</span>
               <div className="flex items-center gap-2 shrink-0">
                 <Button
                   variant="outline"
                   size="icon"
                   className="h-10 w-10"
                   onClick={() => setFnbCount(item.id, value - 1)}
                   disabled={value <= 0}
                   aria-label={`Decrease ${item.name}`}
                 >
                   -
                 </Button>
                 <Input
                   type="number"
                   min={0}
                   value={value}
                   onChange={(e) => setFnbCount(item.id, Number(e.target.value))}
                   className="h-10 w-20 text-center tabular-nums"
                 />
                 <Button
                   variant="outline"
                   size="icon"
                   className="h-10 w-10"
                   onClick={() => setFnbCount(item.id, value + 1)}
                   aria-label={`Increase ${item.name}`}
                 >
                   +
                 </Button>
               </div>
             </li>
           );
         })}
       </ul>
     )}
   </section>
 ) : (
 <section className="space-y-4">
 <div className="flex items-baseline justify-between">
 <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
 Rooms
 </h2>
     {isReception && (() => {
         const totalSelected = receptionFeatureFilter.length + receptionStatusFilter.length + (receptionDoneOnlyFilter ? 1 : 0);
         const statusFilterLabels: string[] = ["Stayover", "Arrival", "Dirty", "Clean"];
         const statusFilterOptions = statusFilterLabels
           .map((label) => {
             const match = receptionStatuses.find(
               (s) => s.label.toLowerCase() === label.toLowerCase(),
             );
             return match ? { id: match.id, label } : null;
           })
           .filter((v): v is { id: string; label: string } => v !== null);
       return (
        <Popover open={filtersSheetOpen} onOpenChange={setFiltersSheetOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
              <Filter className="h-3.5 w-3.5" />
              {totalSelected === 0 ? "Filters" : `Filters · ${totalSelected}`}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 max-h-[70vh] overflow-y-auto p-3">
            <div className="space-y-1 pb-2">
              <p className="text-sm font-semibold">Filters</p>
              <p className="text-xs text-muted-foreground">
                {totalSelected === 0 ? "Filter rooms by housekeeping and features." : `${totalSelected} active`}
              </p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Housekeeping</p>
                <label className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted cursor-pointer">
                  <Checkbox
                    checked={receptionDoneOnlyFilter}
                    onCheckedChange={(c) => setReceptionDoneOnlyFilter(!!c)}
                  />
                  <span className="text-sm flex-1">Only show rooms marked done</span>
                </label>
              </div>
              {statusFilterOptions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</p>
                  <div className="grid gap-1">
                    {statusFilterOptions.map((s) => {
                      const checked = receptionStatusFilter.includes(s.id);
                      return (
                        <label
                          key={s.id}
                          className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted cursor-pointer"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(c) => {
                              setReceptionStatusFilter((prev) =>
                                c ? [...prev, s.id] : prev.filter((id) => id !== s.id),
                              );
                            }}
                          />
                          <span className="text-sm flex-1">{s.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
              {roomFeatures.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Features</p>
                  <div className="grid gap-1">
                    {[...roomFeatures]
                      .sort((a, b) => a.label.localeCompare(b.label))
                      .map((f) => {
                        const checked = receptionFeatureFilter.includes(f.id);
                        return (
                          <label
                            key={f.id}
                            className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted cursor-pointer"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(c) => {
                                setReceptionFeatureFilter((prev) =>
                                  c ? [...prev, f.id] : prev.filter((id) => id !== f.id),
                                );
                              }}
                            />
                            <span className="text-sm flex-1">{f.label}</span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}
              {totalSelected > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setReceptionFeatureFilter([]);
                    setReceptionStatusFilter([]);
                    setReceptionDoneOnlyFilter(false);
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear filters
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      );
    })()}
   {!isReception && (
    <button
      type="button"
      onClick={resetAll}
      className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
    >
      Reset all
    </button>
  )}
 </div>

 {/* On-screen interactive accordion */}
 <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8 xl:grid-cols-10 gap-2 md:gap-3">
 {(() => {
  const allRooms = rooms.map((r) => r.room_number);
   const visibleRooms = (isReception && (receptionFeatureFilter.length > 0 || receptionStatusFilter.length > 0 || receptionDoneOnlyFilter))
    ? allRooms.filter((n) => {
        if (receptionDoneOnlyFilter) {
          const rd = rooms.find((x) => x.room_number === n);
          if (!rd?.done) return false;
        }
        const featuresOk = receptionFeatureFilter.every((fid) =>
          roomFeatureAssignments.some((a) => a.feature_id === fid && a.room_number === n),
        );
        if (!featuresOk) return false;
        if (receptionStatusFilter.length === 0) return true;
        const r = rooms.find((x) => x.room_number === n);
        const statusId = r?.reception_status_id ?? r?.default_status ?? null;
        return statusId !== null && receptionStatusFilter.includes(statusId);
      })
    : allRooms;
  const nodes: React.ReactNode[] = [];
   const dndStatusId = receptionStatuses.find((s) => s.label === "DND")?.id ?? null;
    const staffStatusIdGlobal = receptionStatuses.find(
      (s) => s.label.toLowerCase() === "staff",
    )?.id ?? null;
    const stayStatusIdGlobal = receptionStatuses.find(
      (s) => s.label.toLowerCase() === "stayover",
    )?.id ?? null;
    const dirtyStatusIdGlobal = receptionStatuses.find(
      (s) => s.label.toLowerCase() === "dirty",
    )?.id ?? null;
    const cleanStatusIdGlobal = receptionStatuses.find(
      (s) => s.label.toLowerCase() === "clean",
    )?.id ?? null;
    const arrivalStatusIdGlobal = receptionStatuses.find(
      (s) => s.label.toLowerCase() === "arrival",
    )?.id ?? null;
    const rosStatusIdGlobal = receptionStatuses.find(
      (s) => s.label.toLowerCase() === "ros",
    )?.id ?? null;
   for (let i = 0; i < visibleRooms.length; i++) {
   const n = visibleRooms[i];
 const done = doneSet.has(n);
 const isOpen = openRoom === n;
  if (isReception) {
    const room = rooms.find((r) => r.room_number === n);
    const staffStatusId = receptionStatuses.find(
      (s) => s.label.toLowerCase() === "staff",
    )?.id;
    const isStaffRoom = (room?.reception_status_id ?? room?.default_status) === staffStatusId;
    const isDnd = !!dndStatusId && (room?.reception_status_id ?? room?.default_status) === dndStatusId;
     const isStayover = !!stayStatusIdGlobal && (room?.reception_status_id ?? room?.default_status) === stayStatusIdGlobal;
     const isDirty = !!dirtyStatusIdGlobal && (room?.reception_status_id ?? room?.default_status) === dirtyStatusIdGlobal;
     const isClean = !!cleanStatusIdGlobal && (room?.reception_status_id ?? room?.default_status) === cleanStatusIdGlobal;
     const isArrival = !!arrivalStatusIdGlobal && (room?.reception_status_id ?? room?.default_status) === arrivalStatusIdGlobal;
     const isRos = !!rosStatusIdGlobal && (room?.reception_status_id ?? room?.default_status) === rosStatusIdGlobal;
     const state = getRoomTileState(n, done);
     const baseMeta = roomStateMeta[state];
     const hasStatus = !!(room?.reception_status_id ?? room?.default_status);
      const hasLinenCount = counts.some((c) => c.room_number === n && (c.count ?? 0) > 0);
      const meta = isStaffRoom
        ? { bg: "var(--room-staff)", fg: "var(--room-staff-fg)", accent: "var(--room-staff-accent)", label: "Staff" }
        : isRos
          ? { bg: "var(--room-staff)", fg: "var(--room-staff-fg)", accent: "var(--room-staff-accent)", label: "ROS" }
        : (isStayover || isDnd)
          ? { bg: "var(--room-stayover)", fg: "var(--room-stayover-fg)", accent: "var(--room-stayover-accent)", label: "Stayover" }
        : (state === "done" || state === "complete")
          ? (isClean
              ? { bg: "var(--room-cleandone)", fg: "var(--room-cleandone-fg)", accent: "var(--room-cleandone-accent)", label: "Clean" }
              : { bg: "var(--room-complete)", fg: "var(--room-complete-fg)", accent: "var(--room-complete-accent)", label: "Clean & Ready for Guests" })
        : isDirty
          ? { bg: "var(--room-dirty)", fg: "var(--room-dirty-fg)", accent: "var(--room-dirty-accent)", label: "ROS - Dirty" }
          : (hasStatus || hasLinenCount)
            ? { ...roomStateMeta.progress, label: "Cleaning in Progress" }
            : room?.early_check_in
              ? { bg: "var(--room-early)", fg: "var(--room-early-fg)", accent: "var(--room-early-accent)", label: "Early check-in" }
              : { ...roomStateMeta.todo, label: isArrival ? "Arrival" : isDirty ? "Dirty" : isClean ? "Clean" : "Not started" };
    nodes.push(
        <button
        key={`r-${n}`}
          type="button"
          disabled={isStaffRoom}
          onClick={() => openOrToggle(n)}
        className={cn(
             "relative overflow-hidden rounded-lg border text-xs sm:text-sm md:text-base font-medium transition-colors tabular-nums flex flex-col justify-between aspect-[5/4] p-1.5 md:p-2.5 pt-2 md:pt-3 text-left",
             openRoom === n && !isStaffRoom && "ring-2 ring-ring border-transparent bg-accent",
             isStaffRoom && "opacity-90"
        )}
        style={
            openRoom === n
              ? undefined
               : { backgroundColor: meta.bg, color: meta.fg, borderColor: meta.accent, borderTopWidth: 3 }
        }
         aria-label={`Room ${n} ${meta.label}${isStaffRoom ? " staff" : ""}`}
      >
         {!isStaffRoom && (
           <>
              <span className="text-sm sm:text-base font-bold leading-none">{n}</span>
              <span className="text-[9px] sm:text-[10px] md:text-xs font-medium leading-none opacity-90 whitespace-pre-line pr-4">
                 {meta.label}
               </span>
             {isDnd && (
               <span
                   className="absolute right-1.5 top-2 text-xs sm:text-sm font-bold leading-none"
               >
                 DND
               </span>
             )}
           </>
         )}
         {isStaffRoom && (
           <>
             <span className="text-sm sm:text-base font-bold leading-none">{n}</span>
             <span className="text-[9px] sm:text-[10px] md:text-xs font-medium leading-none opacity-90">
               Staff
             </span>
           </>
         )}
          {(hasActiveMessage(n) || !!room?.housekeeping_note) && !isStaffRoom && (
            <span
              aria-label="Housekeeping note"
                className={cn(
                  "absolute right-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-background",
                  room?.guest_vacated ? "top-5" : "top-1",
                )}
            />
          )}
          {room?.needs_maintenance && !isStaffRoom && (
            <Wrench
              aria-label="Maintenance"
              className="absolute bottom-0.5 right-0.5 h-3 w-3 text-amber-600 dark:text-amber-400"
            />
          )}
          {room?.guest_vacated && !isStaffRoom && (
            <span
              aria-label="Guest vacated"
              className="absolute top-0.5 right-0.5 rounded-sm bg-emerald-600 px-1 py-px text-[8px] font-bold leading-none tracking-wide text-white shadow-sm dark:bg-emerald-500 dark:text-emerald-950"
            >
              OUT
            </span>
          )}
        </button>,
    );
  } else {
    const room = rooms.find((r) => r.room_number === n);
    const isDnd = !!dndStatusId && (room?.reception_status_id ?? room?.default_status) === dndStatusId;
    const isStaff = !!staffStatusIdGlobal && (room?.reception_status_id ?? room?.default_status) === staffStatusIdGlobal;
     const isStayover = !!stayStatusIdGlobal && (room?.reception_status_id ?? room?.default_status) === stayStatusIdGlobal;
     const isDirty = !!dirtyStatusIdGlobal && (room?.reception_status_id ?? room?.default_status) === dirtyStatusIdGlobal;
     const isClean = !!cleanStatusIdGlobal && (room?.reception_status_id ?? room?.default_status) === cleanStatusIdGlobal;
    const isArrival = !!arrivalStatusIdGlobal && (room?.reception_status_id ?? room?.default_status) === arrivalStatusIdGlobal;
     const isRos = !!rosStatusIdGlobal && (room?.reception_status_id ?? room?.default_status) === rosStatusIdGlobal;
     const state = getRoomTileState(n, receptionDoneSet.has(n));
      const baseMeta = state === "done"
        ? { bg: "var(--room-done)", fg: "var(--room-done-fg)", accent: "var(--room-done-accent)", label: "Clean" }
        : roomStateMeta[state];
     const hasStatus = !!(room?.reception_status_id ?? room?.default_status);
      const hasLinenCount = counts.some((c) => c.room_number === n && (c.count ?? 0) > 0);
      const meta = isStaff
        ? { bg: "var(--room-staff)", fg: "var(--room-staff-fg)", accent: "var(--room-staff-accent)", label: "Staff" }
        : isRos
          ? { bg: "var(--room-staff)", fg: "var(--room-staff-fg)", accent: "var(--room-staff-accent)", label: "ROS" }
        : (isStayover || isDnd)
          ? { bg: "var(--room-stayover)", fg: "var(--room-stayover-fg)", accent: "var(--room-stayover-accent)", label: "Stayover" }
        : (state === "done" || state === "complete")
          ? (isClean
              ? { bg: "var(--room-cleandone)", fg: "var(--room-cleandone-fg)", accent: "var(--room-cleandone-accent)", label: "Clean" }
              : { bg: "var(--room-complete)", fg: "var(--room-complete-fg)", accent: "var(--room-complete-accent)", label: "Clean & Ready for Guests" })
          : isDirty
            ? { bg: "var(--room-dirty)", fg: "var(--room-dirty-fg)", accent: "var(--room-dirty-accent)", label: "Dirty" }
          : (hasStatus || hasLinenCount || state === "progress")
            ? { ...roomStateMeta.progress, label: "Cleaning in Progress" }
             : room?.early_check_in
               ? { bg: "var(--room-early)", fg: "var(--room-early-fg)", accent: "var(--room-early-accent)", label: "Early check-in" }
               : { ...roomStateMeta.todo, label: isArrival ? "Arrival" : isDirty ? "Dirty" : isClean ? "Clean" : "Not started" };
    nodes.push(
      <button
        key={`r-${n}`}
        type="button"
        onClick={() => openOrToggle(n)}
        className={cn(
             "relative overflow-hidden rounded-lg border text-xs sm:text-sm md:text-base font-medium transition-colors tabular-nums flex flex-col justify-between aspect-[5/4] p-1.5 md:p-2.5 pt-2 md:pt-3 text-left",
          isOpen && "ring-2 ring-ring border-transparent bg-accent",
        )}
        style={
          isOpen
            ? undefined
            : isStaff
              ? { backgroundColor: "var(--room-staff)", color: "var(--room-staff-fg)", borderColor: "var(--room-staff-accent)", borderTopWidth: 3 }
              : { backgroundColor: meta.bg, color: meta.fg, borderColor: meta.accent, borderTopWidth: 3 }
        }
        aria-pressed={done}
        aria-expanded={isOpen}
          aria-label={`Room ${n} ${isStaff ? "staff" : meta.label}`}
      >
          {isDirty && !isStaff && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex items-center justify-center text-6xl md:text-7xl opacity-15 leading-none"
            >
              💩
            </span>
          )}
          {!isStaff && !isRos && !isStayover && !isDnd && (state === "done" || state === "complete") && (!room?.reception_bed_id || !hasStatus) && (
            <AlertCircle
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 m-auto h-[80%] w-[80%] opacity-30"
              style={{ color: meta.accent }}
            />
          )}
         <span className="text-sm sm:text-base md:text-xl font-bold leading-none inline-flex items-center gap-1">
           {n}
          {!isStaff && (state === "done" || state === "complete") && (
            <Check aria-label="Done" className="h-3.5 w-3.5 opacity-80" />
          )}
         </span>
          <span className="text-[9px] sm:text-[10px] md:text-xs font-medium leading-none opacity-90 whitespace-pre-line pr-4">
            {isStaff ? "Staff" : meta.label}
          </span>
          {isDnd && !isStaff && (
           <span
               className="absolute right-1.5 top-2 text-xs sm:text-sm font-bold leading-none"
           >
             DND
           </span>
         )}
          {hasActiveMessage(n) && (
            <span
              aria-label="Message"
                className={cn(
                  "absolute right-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-background",
                  room?.guest_vacated ? "top-5" : "top-1",
                )}
            />
          )}
          {room?.needs_maintenance && (
            <Wrench
              aria-label="Maintenance"
              className="absolute bottom-0.5 right-0.5 h-3 w-3 text-amber-600 dark:text-amber-400"
            />
          )}
          {room?.guest_vacated && (
            <span
              aria-label="Guest vacated"
              className="absolute top-0.5 right-0.5 rounded-sm bg-emerald-600 px-1 py-px text-[8px] font-bold leading-none tracking-wide text-white shadow-sm dark:bg-emerald-500 dark:text-emerald-950"
            >
              OUT
            </span>
          )}
      </button>,
    );
  }
  }
 return nodes;
 })()}
 </div>


            {!isReception && (
              (() => {
                 const staffId = receptionStatuses.find((s) => s.label.toLowerCase() === "staff")?.id ?? null;
                 const rosId = receptionStatuses.find((s) => s.label.toLowerCase() === "ros")?.id ?? null;
                 const statusLabelById = new Map(
                   receptionStatuses.map((s) => [s.id, s.label.toLowerCase()]),
                 );
                 const excludedProgressStatuses = new Set(["staff", "ros", "staff/ros", "ros - staff"]);
                 const eligible = rooms.filter((r) => {
                   const sid = r.reception_status_id ?? r.default_status;
                   const statusLabel = sid ? (statusLabelById.get(sid) ?? sid).toLowerCase() : "";
                   return !excludedProgressStatuses.has(statusLabel);
                 });
                const total = eligible.length;
                const progress = eligible.filter((r) => r.done || r.done_reception).length;
                const pct = total > 0 ? Math.min(100, (progress / total) * 100) : 0;
                 return (
                    <div className="mt-3 space-y-1 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-40 max-lg:mt-0 max-lg:border-t max-lg:border-border max-lg:bg-background/95 max-lg:backdrop-blur max-lg:pl-[calc(env(safe-area-inset-left,0px)+1.5rem)] max-lg:pr-[calc(env(safe-area-inset-right,0px)+1.5rem)] max-lg:pt-2 max-lg:pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] max-lg:shadow-[0_-2px_8px_rgba(0,0,0,0.06)] max-lg:transform-gpu max-lg:will-change-transform max-lg:[backface-visibility:hidden]">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Rooms progress</span>
                      <span className="tabular-nums">{progress} of {total}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })()
            )}
 </section>
 )}
  {!isReception && (
    <div className="lg:hidden h-[calc(env(safe-area-inset-bottom,0px)+3.25rem)]" aria-hidden />
  )}
 </div>

 <Sheet open={openRoom !== null} onOpenChange={(o) => { if (!o) { if (openRoom !== null) setShowAllLinen(prev => ({ ...prev, [openRoom]: false })); setOpenRoom(null); setNewMessageText(""); } }}>
   <SheetContent side="bottom" className="h-[90vh] max-h-[90vh] flex flex-col overflow-hidden rounded-t-2xl p-4 sm:p-6">
     <SheetHeader className="text-left space-y-0">
       <SheetTitle>Room {openRoom} — {categoryLabel(roomCategory(openRoom ?? 0), roomTypes)}</SheetTitle>
     </SheetHeader>
     <div className="flex flex-col flex-1 min-h-0 mt-3">
       {openRoom !== null && renderRoomPanel(openRoom)}
     </div>
   </SheetContent>
 </Sheet>

 <Dialog open={exportOpen} onOpenChange={setExportOpen}>
<DialogContent className="max-w-md w-[calc(100vw-1.5rem)] sm:w-full p-4 sm:p-6">
 <DialogHeader>
 <DialogTitle>Export totals</DialogTitle>
 <DialogDescription>
 Totals across all rooms, grouped by item name. Please only export once. To reprint a previous export, use the History feature
 </DialogDescription>
 </DialogHeader>
 {(() => {
 const totals = new Map<string, number>();
 const nameFor = (c: RoomCount) => {
 if (c.item_kind === "template") {
 return template.find((t) => t.id === c.item_id)?.name;
 }
 return extras.find((e) => e.id === c.item_id)?.name;
 };
 for (const c of counts) {
 if (c.count <= 0) continue;
 const raw = nameFor(c);
 if (!raw) continue;
 const key = raw.trim();
 if (!key) continue;
 totals.set(key, (totals.get(key) ?? 0) + c.count);
 }
 const rows = Array.from(totals.entries()).sort((a, b) =>
 a[0].localeCompare(b[0], undefined, { sensitivity: "base" })
 );
 const grand = rows.reduce((s, [, n]) => s + n, 0);
 const text = rows.map(([n, c]) => `${n}: ${c}`).join("\n");
 if (rows.length === 0) {
 return (
 <p className="text-sm text-muted-foreground py-4">
 No counted items yet.
 </p>
 );
 }
 return (
 <div className="space-y-4">
 <ul className="divide-y rounded-md border">
 {rows.map(([name, count]) => (
 <li
 key={name}
 className="flex items-center justify-between px-3 py-2 text-sm"
 >
 <span className="truncate pr-3">{name}</span>
 <span className="font-mono font-semibold tabular-nums">
 {count}
 </span>
 </li>
 ))}
 </ul>
 <div className="flex items-center justify-between text-sm">
 <span className="text-muted-foreground">
 {rows.length} item{rows.length === 1 ? "" : "s"}
 </span>
 <span className="font-medium">Total: {grand}</span>
 </div>
 <div className="flex justify-end gap-2">
 <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            printTotals(
                              rows.map(([name, count]) => ({ name, count })),
                              grand,
                              new Date(),
                            )
                          }
                        >
                          Print
                        </Button>
                        <Button
 variant="outline"
 size="sm"
 onClick={async () => {
 try {
 await navigator.clipboard.writeText(text);
 toast.success("Copied to clipboard");
 } catch {
 toast.error("Copy failed");
 }
 }}
 >
 Copy
 </Button>
 </div>
 </div>
 );
 })()}
 </DialogContent>
 </Dialog>

 <Dialog open={roomStatusExportOpen} onOpenChange={setRoomStatusExportOpen}>
   <DialogContent className="max-w-3xl w-[calc(100vw-1.5rem)] sm:w-full p-4 sm:p-6">
     <DialogHeader>
       <DialogTitle>Room Status Sheet</DialogTitle>
       <DialogDescription>
         Current Room Status and Bed Set As selections across all rooms.
       </DialogDescription>
     </DialogHeader>
     {(() => {
       const { rows } = computeRoomStatus();
       if (rows.length === 0) {
         return (
           <p className="text-sm text-muted-foreground py-4">
             No rooms configured yet.
           </p>
         );
       }
       const half = Math.ceil(rows.length / 2);
       const left = rows.slice(0, half);
       const right = rows.slice(half);
       const renderTable = (list: RoomStatusRow[]) => (
         <table className="w-full text-sm border-collapse">
           <thead className="bg-muted/50">
             <tr>
               <th className="text-left px-2 py-1 border">Room</th>
               <th className="text-left px-2 py-1 border">Status</th>
               <th className="text-left px-2 py-1 border">Set As</th>
             </tr>
           </thead>
           <tbody>
             {list.map((r) => (
               <tr key={r.room}>
                 <td className="px-2 py-1 border font-mono tabular-nums">{r.room}</td>
                 <td className="px-2 py-1 border">{r.status}</td>
                 <td className="px-2 py-1 border">{r.bed}</td>
               </tr>
             ))}
           </tbody>
         </table>
       );
       return (
         <div className="space-y-4">
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
             {renderTable(left)}
             {renderTable(right)}
           </div>
           <div className="flex justify-end gap-2">
             <Button
               variant="outline"
               size="sm"
               onClick={() => printRoomStatus(rows, new Date())}
             >
               Print
             </Button>
           </div>
         </div>
       );
     })()}
   </DialogContent>
 </Dialog>

 <Dialog open={!!viewingSnapshot} onOpenChange={(o) => !o && setViewingSnapshot(null)}>
   <DialogContent className="max-w-md w-[calc(100vw-1.5rem)] sm:w-full p-4 sm:p-6">
     <DialogHeader>
       <DialogTitle>
         {viewingSnapshot
           ? new Date(viewingSnapshot.created_at).toLocaleString(undefined, {
               year: "numeric",
               month: "long",
               day: "numeric",
               hour: "numeric",
               minute: "2-digit",
             })
           : "Snapshot"}
       </DialogTitle>
       <DialogDescription>Saved totals from this export.</DialogDescription>
     </DialogHeader>
     {viewingSnapshot && (
        viewingSnapshot.kind === "maintenance" ? (
        <div className="space-y-4">
          {viewingSnapshot.totals.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No rooms in this snapshot.</p>
          ) : (
            <div className="rounded-md border max-h-[60vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 w-16">Room</th>
                    <th className="text-left px-3 py-2">Maintenance note</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewingSnapshot.totals as MaintenanceRow[]).map((r) => (
                    <tr key={r.room} className="border-t align-top">
                      <td className="px-3 py-1.5 font-mono tabular-nums">{r.room}</td>
                      <td className="px-3 py-1.5 whitespace-pre-wrap">{r.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {viewingSnapshot.totals.length} room
              {viewingSnapshot.totals.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={async () => {
                if (!confirm("Delete this snapshot?")) return;
                const id = viewingSnapshot.id;
                setViewingSnapshot(null);
                await deleteSnapshot(id);
              }}
            >
              Delete
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                printMaintenance(
                  new Date(viewingSnapshot.created_at),
                  viewingSnapshot.totals as MaintenanceRow[],
                )
              }
            >
              Print
            </Button>
          </div>
        </div>
        ) : viewingSnapshot.kind === "room_status" ? (
        <div className="space-y-4">
          {viewingSnapshot.totals.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No rooms in this snapshot.</p>
          ) : (
            <div className="rounded-md border max-h-[60vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2">Room</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-left px-3 py-2">Set As</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewingSnapshot.totals as RoomStatusRow[]).map((r) => (
                    <tr key={r.room} className="border-t">
                      <td className="px-3 py-1.5 font-mono tabular-nums">{r.room}</td>
                      <td className="px-3 py-1.5">{r.status}</td>
                      <td className="px-3 py-1.5">{r.bed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {viewingSnapshot.totals.length} room
              {viewingSnapshot.totals.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={async () => {
                if (!confirm("Delete this snapshot?")) return;
                const id = viewingSnapshot.id;
                setViewingSnapshot(null);
                await deleteSnapshot(id);
              }}
            >
              Delete
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                printRoomStatus(
                  viewingSnapshot.totals as RoomStatusRow[],
                  new Date(viewingSnapshot.created_at),
                )
              }
            >
              Print
            </Button>
          </div>
        </div>
        ) : (
        <div className="space-y-4">
         {viewingSnapshot.totals.length === 0 ? (
           <p className="text-sm text-muted-foreground py-4">No items in this snapshot.</p>
         ) : (
           <ul className="divide-y rounded-md border max-h-[60vh] overflow-y-auto">
              {(viewingSnapshot.totals as SnapshotRow[]).map((r) => (
               <li
                 key={r.name}
                 className="flex items-center justify-between px-3 py-2 text-sm"
               >
                 <span className="truncate pr-3">{r.name}</span>
                 <span className="font-mono font-semibold tabular-nums">{r.count}</span>
               </li>
             ))}
           </ul>
         )}
         <div className="flex items-center justify-between text-sm">
           <span className="text-muted-foreground">
             {viewingSnapshot.totals.length} item
             {viewingSnapshot.totals.length === 1 ? "" : "s"}
           </span>
           <span className="font-medium">Total: {viewingSnapshot.grand_total}</span>
         </div>
         <div className="flex justify-between gap-2">
           <Button
             variant="ghost"
             size="sm"
             className="text-destructive hover:text-destructive"
             onClick={async () => {
               if (!confirm("Delete this snapshot?")) return;
               const id = viewingSnapshot.id;
               setViewingSnapshot(null);
               await deleteSnapshot(id);
             }}
           >
             Delete
           </Button>
          <div className="flex gap-2">
          <Button
             variant="outline"
             size="sm"
             onClick={async () => {
               try {
                  const text = (viewingSnapshot.totals as SnapshotRow[])
                   .map((r) => `${r.name}: ${r.count}`)
                   .join("\n");
                 await navigator.clipboard.writeText(text);
                 toast.success("Copied to clipboard");
               } catch {
                 toast.error("Copy failed");
               }
             }}
           >
             Copy
           </Button>
          <Button
            variant="outline"
            size="sm"
             onClick={() =>
               printTotals(
                 viewingSnapshot.totals as SnapshotRow[],
                 viewingSnapshot.grand_total,
                 new Date(viewingSnapshot.created_at),
                 viewingSnapshot.kind === "rejects"
                   ? "rejects"
                   : viewingSnapshot.kind === "fnb_totals"
                   ? "fnb_totals"
                   : "totals",
               )
             }
          >
            Print
          </Button>
          </div>
         </div>
       </div>
        )
     )}
   </DialogContent>
 </Dialog>

 {/* Reject export dialog */}
 <Dialog open={rejectExportOpen} onOpenChange={setRejectExportOpen}>
   <DialogContent className="max-w-md w-[calc(100vw-1.5rem)] sm:w-full p-4 sm:p-6">
     <DialogHeader>
       <DialogTitle>Export rejects</DialogTitle>
       <DialogDescription>
         Totals of linen rejected as dirty before use.
       </DialogDescription>
     </DialogHeader>
     {(() => {
       const { rows, grand } = computeRejectTotals();
       const text = rows.map((r) => `${r.name}: ${r.count}`).join("\n");
       if (rows.length === 0) {
         return (
           <p className="text-sm text-muted-foreground py-4">
             No rejects tallied yet.
           </p>
         );
       }
       return (
         <div className="space-y-4">
           <ul className="divide-y rounded-md border">
             {rows.map((r) => (
               <li
                 key={r.name}
                 className="flex items-center justify-between px-3 py-2 text-sm"
               >
                 <span className="truncate pr-3">{r.name}</span>
                 <span className="font-mono font-semibold tabular-nums">
                   {r.count}
                 </span>
               </li>
             ))}
           </ul>
           <div className="flex items-center justify-between text-sm">
             <span className="text-muted-foreground">
               {rows.length} item{rows.length === 1 ? "" : "s"}
             </span>
             <span className="font-medium">Total: {grand}</span>
           </div>
           <div className="flex justify-end gap-2">
             <Button
               variant="outline"
               size="sm"
               onClick={() => printTotals(rows, grand, new Date(), "rejects")}
             >
               Print
             </Button>
             <Button
               variant="outline"
               size="sm"
               onClick={async () => {
                 try {
                   await navigator.clipboard.writeText(text);
                   toast.success("Copied to clipboard");
                 } catch {
                   toast.error("Copy failed");
                 }
               }}
             >
               Copy
             </Button>
           </div>
         </div>
       );
     })()}
   </DialogContent>
 </Dialog>
  <Dialog
    open={confirmOverwrite !== null}
    onOpenChange={(o) => { if (!o) setConfirmOverwrite(null); }}
  >
    <DialogContent className="max-w-md w-[calc(100vw-1.5rem)] sm:w-full p-4 sm:p-6">
      <DialogHeader>
        <DialogTitle>Overwrite today's export?</DialogTitle>
        <DialogDescription>
          {confirmOverwrite?.kind === "rejects"
            ? "A rejects export already exists for today. Continuing will overwrite today's last history item. Please use the history feature to print previous exports. Would you like to continue with your export?"
            : confirmOverwrite?.kind === "room_status"
            ? "A room status export already exists for today. Continuing will overwrite today's last history item. Please use the history feature to print previous exports. Would you like to continue with your export?"
            : confirmOverwrite?.kind === "maintenance"
            ? "A maintenance list export already exists for today. Continuing will overwrite today's last history item. Please use the history feature to print previous exports. Would you like to continue with your export?"
            : confirmOverwrite?.kind === "fnb_totals"
            ? "An F&B linen export already exists for today. Continuing will overwrite today's last history item. Please use the history feature to print previous exports. Would you like to continue with your export?"
            : "A linen export already exists for today. Continuing will overwrite today's last history item. Please use the history feature to print previous exports. Would you like to continue with your export?"}
        </DialogDescription>
      </DialogHeader>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={() => setConfirmOverwrite(null)}>
          No
        </Button>
        <Button
          onClick={async () => {
            const kind = confirmOverwrite?.kind;
            setConfirmOverwrite(null);
            if (kind) await proceedExport(kind);
          }}
        >
          Yes
        </Button>
      </div>
    </DialogContent>
  </Dialog>
  <AccountDialog
    open={accountOpen}
    onOpenChange={setAccountOpen}
    currentUsername={authUser?.username ?? ""}
    onUsernameChanged={(u) => setAuthUser((prev) => prev ? { ...prev, username: u } : prev)}
  />
  <UsersDialog open={usersOpen} onOpenChange={setUsersOpen} />
  <UserApprovalDialog open={userApprovalOpen} onOpenChange={setUserApprovalOpen} />
  <QuickReceptionSheet
    open={quickReceptionOpen}
    onOpenChange={setQuickReceptionOpen}
    rooms={rooms.map((r) => ({
      room_number: r.room_number,
      category: r.category,
      reception_status_id: r.reception_status_id,
      reception_bed_id: r.reception_bed_id,
      default_status: r.default_status,
    }))}
    statuses={receptionStatuses.map((s) => ({ id: s.id, label: s.label }))}
    beds={receptionBeds.map((b) => ({ id: b.id, label: b.label }))}
    onChangeStatus={setRoomReceptionStatus}
    onChangeBed={setRoomReceptionBed}
    onResetAll={resetReceptionAll}
  />
 </main>
 );
}

function AccountDialog({
  open,
  onOpenChange,
  currentUsername,
  onUsernameChanged,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  currentUsername: string;
  onUsernameChanged: (u: string) => void;
}) {
  const [username, setUsername] = useState(currentUsername);
  const [newEmail, setNewEmail] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setUsername(currentUsername);
      setNewEmail("");
      setNewPw("");
      setConfirmPw("");
      setCurrentPw("");
    }
  }, [open, currentUsername]);

  async function saveAll(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const user = getStoredUser();
    if (!user) { toast.error("Not signed in"); return; }

    const trimmedUsername = username.trim();
    const trimmedEmail = newEmail.trim();
    const wantsUsername = trimmedUsername !== "" && trimmedUsername !== currentUsername;
    const wantsEmail = trimmedEmail !== "" && trimmedEmail.toLowerCase() !== user.email.toLowerCase();
    const wantsPassword = newPw.length > 0 || confirmPw.length > 0;

    if (!wantsUsername && !wantsEmail && !wantsPassword) {
      toast.info("Nothing to change");
      return;
    }
    if (wantsPassword && newPw !== confirmPw) {
      toast.error("New passwords do not match");
      return;
    }
    if (!currentPw) {
      toast.error("Enter your current password to save changes");
      return;
    }

    setBusy(true);
    try {
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPw,
      });
      if (signErr) throw new Error("Current password is incorrect");

      const messages: string[] = [];

      if (wantsUsername) {
        const { error: pErr } = await supabase
          .from("profiles")
          .update({ display_name: trimmedUsername })
          .eq("id", user.id);
        if (pErr) throw pErr;
        await supabase.auth.updateUser({ data: { display_name: trimmedUsername } });
        const { refreshSession } = await import("@/lib/auth-client");
        await refreshSession();
        onUsernameChanged(trimmedUsername);
        messages.push("Username updated");
      }

      if (wantsEmail) {
        const { error } = await supabase.auth.updateUser({ email: trimmedEmail });
        if (error) throw error;
        messages.push("Check your new email to confirm the change");
      }

      if (wantsPassword) {
        const { error } = await supabase.auth.updateUser({ password: newPw });
        if (error) throw error;
        messages.push("Password updated");
      }

      toast.success(messages.join(" · "));
      setNewEmail("");
      setNewPw("");
      setConfirmPw("");
      setCurrentPw("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Account</DialogTitle>
          <DialogDescription>
            Update your username, email, or password. Enter your current password once at the bottom to save any changes.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={saveAll} className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">New username</h3>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              placeholder={currentUsername}
            />
          </div>
          <div className="border-t" />
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">New email</h3>
            <p className="text-xs text-muted-foreground">
              We'll send a confirmation link to the new address. The change takes effect once confirmed.
            </p>
            <Input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="name@example.com"
            />
          </div>
          <div className="border-t" />
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">New password</h3>
            <div className="space-y-1">
              <label className="text-xs font-medium">New password</label>
              <Input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Confirm new password</label>
              <Input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>
          <div className="border-t" />
          <div className="space-y-2">
            <label className="text-xs font-medium">Enter existing password to save changes</label>
            <Input
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              autoComplete="current-password"
            />
            <div className="flex justify-end pt-1">
              <Button type="submit" size="sm" disabled={busy}>Save changes</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}