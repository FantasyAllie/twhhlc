import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus, X, Menu, ArrowUp, ArrowDown, Pencil, Check, Trash2, Sun, Moon, List, Bed, Ban, History, Users, User, LogOut, Hash, ConciergeBell, ClipboardList, Printer, Filter, Wrench, StickyNote, DoorOpen, Bell, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getToken, getStoredUser, clearSession } from "@/lib/auth-client";
import { notifyRoomEvent } from "@/lib/push.functions";
import { NotificationsSheet } from "@/components/notifications-sheet";
import { UsersDialog } from "@/components/users-dialog";
import { QuickReceptionSheet } from "@/components/quick-reception-sheet";
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
      { title: "Three Ways House Hotel Housekeeping" },
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
type TemplateItem = { id: string; name: string; created_at: string; category: Category; position: number; default_count: number; color: ItemColor | null };
type RoomExtra = { id: string; room_number: number; name: string; created_at: string };
type RoomCount = {
 id: string;
 room_number: number;
 item_kind: "template" | "extra";
 item_id: string;
 count: number;
};
type Room = { id: string; room_number: number; sort_order?: number; done: boolean; done_reception: boolean; category: Category | null; default_status: string | null; reception_status_id: string | null; reception_bed_id: string | null; housekeeping_note: string | null; needs_maintenance: boolean; guest_vacated: boolean };
type TemplateItemRoom = { id: string; template_item_id: string; room_number: number };
type SnapshotRow = { name: string; count: number };
type RoomStatusRow = { room: number; status: string; bed: string; maintenance?: boolean };
type ExportSnapshot = {
  id: string;
  created_at: string;
  totals: SnapshotRow[] | RoomStatusRow[];
  grand_total: number;
  kind?: "totals" | "rejects" | "room_status";
};
type RejectCount = { id: string; template_item_id: string; count: number };
type RoomMessage = {
  id: string;
  room_number: number;
  message: string;
  created_by_username: string | null;
  dismissed: boolean;
  created_at: string;
};

function AppPage() {
 const qc = useQueryClient();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const isMobile = useIsMobile();
  const [authUser, setAuthUser] = useState(() => getStoredUser());
  // Admin "view as" overlay — see definition further below for full context.
 type ViewRole = "admin" | "manager" | "user" | "reception";
  const [viewAsRole, setViewAsRole] = useState<ViewRole | null>(() => {
    if (typeof window === "undefined") return null;
    const v = window.localStorage.getItem("tw_view_as_role");
    return v === "user" || v === "reception" || v === "admin" ? v : null;
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
    document.title = "Three Ways House Hotel Housekeeping";
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
 const [openRoom, setOpenRoom] = useState<number | null>(null);
 const [templateOpen, setTemplateOpen] = useState(false);
const [showAllLinen, setShowAllLinen] = useState<Record<number, boolean>>({});
  const [newTemplateName, setNewTemplateName] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemName, setEditingItemName] = useState("");
  const [exportSheetOpen, setExportSheetOpen] = useState(false);
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
  // Admin "view as" overlay — lets admins temporarily experience the app as
  // another role. Does NOT change the auth token; backend still treats them
  // as admin. Only affects UI gating and visible affordances.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (viewAsRole) window.localStorage.setItem("tw_view_as_role", viewAsRole);
    else window.localStorage.removeItem("tw_view_as_role");
  }, [viewAsRole]);
  // Clear overlay if the signed-in user can't use view-as, or if a manager
  // somehow has "admin" selected (managers may not impersonate admin).
  useEffect(() => {
    if (!authUser || !viewAsRole) return;
    const role = authUser.role;
    if (role !== "admin" && role !== "manager") setViewAsRole(null);
    else if (role === "manager" && viewAsRole === "admin") setViewAsRole(null);
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
  const [confirmOverwrite, setConfirmOverwrite] = useState<
    { kind: "totals" | "rejects" | "room_status" } | null
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
   .select("id,name,created_at,category,position,default_count,color")
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

  const roomsQ = useQuery({
    queryKey: ["rooms"],
    queryFn: async (): Promise<Room[]> => {
      const { data, error } = await supabase
        .from("rooms")
        .select("id,room_number,sort_order,done,done_reception,category,default_status,reception_status_id,reception_bed_id,housekeeping_note,needs_maintenance,guest_vacated")
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
        .select("id,room_number,message,created_by_username,dismissed,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RoomMessage[];
    },
  });

  const template = templateQ.data ?? [];
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
    roomMessages.filter((m) => m.room_number === n && !m.dismissed);
  const hasActiveMessage = (n: number) => activeMessagesByRoom(n).length > 0;

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
      old?.map((m) => (m.id === id ? { ...m, dismissed: true } : m)) ?? [],
    );
    const { error } = await supabase
      .from("room_messages" as never)
      .update({ dismissed: true, updated_at: new Date().toISOString() } as never)
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
      .delete()
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
    } as never);
    if (error) {
      toast.error(error.message);
      return;
    }
    await setRoomHousekeepingNote(roomNumber, "");
    toast.success("Confirmation sent to housekeeping");
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
   const realRole = authUser?.role === "pending" ? undefined : (authUser?.role as ViewRole | undefined);
   const realIsAdmin = realRole === "admin";
   const realIsManager = realRole === "manager";
   const canViewAs = realIsAdmin || realIsManager;
   // Managers can view-as housekeeper/reception, but never as admin.
   const safeViewAs: ViewRole | null =
     viewAsRole && realIsManager && viewAsRole === "admin" ? null : viewAsRole;
   const effectiveRole: ViewRole | undefined =
     canViewAs && safeViewAs ? safeViewAs : realRole;
   const isReception = effectiveRole === "reception";
   const isAdmin = effectiveRole === "admin" || effectiveRole === "manager";
  const isHousekeeper = effectiveRole === "user";
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
    done:     { bg: "var(--room-done)", fg: "var(--room-done-fg)", accent: "var(--room-done-accent)", label: "Cleaned & Ready for Quest\n" },
    complete: { bg: "var(--room-done)", fg: "var(--room-done-fg)", accent: "var(--room-done-accent)", label: "Cleaned & Ready for Quest\n" },
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
          reception_bed_id: null, housekeeping_note: null, needs_maintenance: false, guest_vacated: false,
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
    const maxPos = template
      .filter((t) => t.category === category)
      .reduce((m, t) => Math.max(m, t.position), 0);
    setNewTemplateName("");
    const { error } = await supabase
      .from("template_items")
      .insert({ name, category, position: maxPos + 1 });
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
  else list.push({ id: `temp-${roomNumber}`, room_number: roomNumber, done: true, done_reception: false, category: null, default_status: null, reception_status_id: null, reception_bed_id: null, housekeeping_note: null, needs_maintenance: false, guest_vacated: false });
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
    const dndId = receptionStatuses.find((x) => x.label === "DND")?.id ?? null;
    const stayId = receptionStatuses.find((x) => x.label === "Stayover")?.id ?? null;
    qc.setQueryData<Room[]>(["rooms"], (old) =>
      old?.map((r) => ({
        ...r,
        done: false,
        done_reception: false,
        housekeeping_note: null, needs_maintenance: false, guest_vacated: false,
        reception_status_id:
          dndId && r.reception_status_id === dndId && stayId ? stayId : null,
        reception_bed_id: null,
      })) ?? [],
    );
    qc.setQueryData<RoomCount[]>(["room_counts"], () => []);
    // Clear non-DND rooms first so we don't wipe DND before restoring to Stayover.
    const r1 = await supabase.from("rooms").update({
      done: false,
      done_reception: false,
      housekeeping_note: null, needs_maintenance: false, guest_vacated: false,
      reception_status_id: null,
      reception_bed_id: null,
    }).neq("room_number", -1).neq("reception_status_id", dndId ?? "00000000-0000-0000-0000-000000000000");
    if (r1.error) toast.error(r1.error.message);
    if (dndId) {
      const { error: e3 } = await supabase
        .from("rooms")
        .update({
          done: false,
          done_reception: false,
          housekeeping_note: null, needs_maintenance: false, guest_vacated: false,
          reception_status_id: stayId ?? null,
          reception_bed_id: null,
        })
        .eq("reception_status_id", dndId);
      if (e3) toast.error(e3.message);
    }
    const r2 = await supabase.from("room_item_counts").delete().neq("room_number", -1);
    if (r2.error) toast.error(r2.error.message);
    qc.invalidateQueries({ queryKey: ["rooms"] });
    qc.invalidateQueries({ queryKey: ["room_counts"] });
  };

  const resetReceptionAll = async () => {
    if (!confirm("Reset reception status and bed selections for all rooms?")) return;
    const dndId = receptionStatuses.find((x) => x.label === "DND")?.id ?? null;
    const stayId = receptionStatuses.find((x) => x.label === "Stayover")?.id ?? null;
    qc.setQueryData<Room[]>(["rooms"], (old) =>
      old?.map((r) => ({
        ...r,
        reception_status_id:
          dndId && r.reception_status_id === dndId && stayId ? stayId : null,
        reception_bed_id: null,
      })) ?? [],
    );
    // Clear everything to null first, then for DND rooms restore Stayover.
    const { error } = await supabase
      .from("rooms")
      .update({ reception_status_id: null, reception_bed_id: null })
      .neq("room_number", -1)
      .neq("reception_status_id", dndId ?? "00000000-0000-0000-0000-000000000000");
    if (error) toast.error(error.message);
    if (dndId && stayId) {
      const { error: e2 } = await supabase
        .from("rooms")
        .update({ reception_status_id: stayId, reception_bed_id: null })
        .eq("reception_status_id", dndId);
      if (e2) toast.error(e2.message);
    } else if (dndId) {
      const { error: e2 } = await supabase
        .from("rooms")
        .update({ reception_status_id: null, reception_bed_id: null })
        .eq("reception_status_id", dndId);
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
      list.push({ id: `temp-${n}`, room_number: n, sort_order: nextSort, done: false, done_reception: false, category: null, default_status: null, reception_status_id: null, reception_bed_id: null, housekeeping_note: null, needs_maintenance: false, guest_vacated: false });
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
    kind: "totals" | "rejects" | "room_status",
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
    kind: "totals" | "rejects" | "room_status",
  ) => {
    const computed =
      kind === "totals"
        ? computeTotals()
        : kind === "rejects"
        ? computeRejectTotals()
        : computeRoomStatus();
    const rows = computed.rows as SnapshotRow[] | RoomStatusRow[];
    const grand = computed.grand;
    if (rows.length === 0) {
      if (kind === "totals") setExportOpen(true);
      else if (kind === "rejects") setRejectExportOpen(true);
      else setRoomStatusExportOpen(true);
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
    else setRoomStatusExportOpen(true);
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
      return lbl === "DND" ? "DND/Stay" : lbl;
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

  const deleteSnapshot = async (id: string) => {
    qc.setQueryData<ExportSnapshot[]>(["export_snapshots"], (old) =>
      old?.filter((s) => s.id !== id) ?? [],
    );
    const { error } = await supabase.from("export_snapshots").delete().eq("id", id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["export_snapshots"] });
  };

  const clearAllSnapshots = async () => {
    qc.setQueryData<ExportSnapshot[]>(["export_snapshots"], []);
    const { error } = await supabase.from("export_snapshots").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) toast.error(error.message);
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
    kind: "totals" | "rejects" = "totals",
  ) => {
    const dateStr = when.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const heading =
      kind === "rejects"
        ? "Three Ways House Hotel Linen Rejects"
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
  reception_bed_id: null, housekeeping_note: null, needs_maintenance: false, guest_vacated: false,
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
          reception_bed_id: null, housekeeping_note: null, needs_maintenance: false, guest_vacated: false,
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
          reception_bed_id: field === "reception_bed_id" ? value : null, housekeeping_note: null, needs_maintenance: false, guest_vacated: false,
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
          needs_maintenance: false, guest_vacated: false,
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
          needs_maintenance: value, guest_vacated: false,
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
      return (
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start gap-2 h-11"
          onClick={() => setNotesSheetRoom(n)}
        >
          <StickyNote className="h-4 w-4" />
          <span>Notes</span>
          <span className="ml-auto flex items-center gap-1.5">
            {hasMsg && (
              <span aria-label="Message" className="h-2 w-2 rounded-full bg-amber-500" />
            )}
            {hasNote && (
              <span aria-label="Note" className="h-2 w-2 rounded-full bg-primary" />
            )}
            {maintenance && (
              <Wrench aria-label="Maintenance" className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            )}
            {vacated && (
              <DoorOpen aria-label="Vacated" className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            )}
          </span>
        </Button>
      );
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
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Three Ways House Hotel Housekeeping</h1>
                <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">
                  This checker shows when Housekeeping have finished with a room and the room is ready for a customer. {"\n\n"}Click on a room to see it's features and send a message to Housekeeping if needed.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Three Ways House Hotel Housekeeping</h1>
                <p className="text-xs text-muted-foreground mt-1">
                  Shared workspace for Housekeeping staff
                </p>
              </>
            )}
          </div>
 <div className="flex items-center gap-2">
    {isAdmin && (isMobile ? (
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
        </DropdownMenuContent>
      </DropdownMenu>
    ))}
    {isReception && (
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
 {isMobile ? (
   <Button variant="ghost" size="sm" aria-label="Menu" onClick={() => setMenuSheetOpen(true)}>
     <Menu className="h-4 w-4" />
   </Button>
 ) : (
   <DropdownMenu>
     <DropdownMenuTrigger asChild>
       <Button variant="ghost" size="sm" aria-label="Menu">
         <Menu className="h-4 w-4" />
       </Button>
     </DropdownMenuTrigger>
     <DropdownMenuContent align="end" className="w-64">
       {isAdmin && (
         <>
           <DropdownMenuLabel>Manage</DropdownMenuLabel>
           <DropdownMenuItem onClick={() => setTemplateOpen(true)}>
             <List className="h-4 w-4 mr-2" /> Linen List
           </DropdownMenuItem>
           <DropdownMenuItem onClick={() => setManageRoomsOpen(true)}>
             <Hash className="h-4 w-4 mr-2" /> Manage Rooms
           </DropdownMenuItem>
           <DropdownMenuItem onClick={() => setRejectsOpen(true)}>
             <Ban className="h-4 w-4 mr-2" /> Rejects
           </DropdownMenuItem>
           <DropdownMenuItem onClick={() => setHistorySheetOpen(true)}>
             <History className="h-4 w-4 mr-2" /> History
           </DropdownMenuItem>
           <DropdownMenuItem onClick={() => setQuickReceptionOpen(true)}>
             <ConciergeBell className="h-4 w-4 mr-2" /> Bulk Room Status Setup
           </DropdownMenuItem>
           <DropdownMenuSeparator />
         </>
       )}
       <DropdownMenuLabel>Appearance</DropdownMenuLabel>
       <DropdownMenuItem onClick={() => toggleTheme()}>
         {theme === "dark" ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
         {theme === "dark" ? "Light mode" : "Dark mode"}
       </DropdownMenuItem>
       <DropdownMenuSeparator />
       <DropdownMenuLabel>Account</DropdownMenuLabel>
       {realIsAdmin && (
         <DropdownMenuItem onClick={() => setUsersOpen(true)}>
           <Users className="h-4 w-4 mr-2" /> Users
         </DropdownMenuItem>
       )}
       <DropdownMenuItem onClick={() => setNotificationsSheetOpen(true)}>
         <Bell className="h-4 w-4 mr-2" /> Notifications
       </DropdownMenuItem>
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
   {canViewAs && safeViewAs && (
    <div className="bg-amber-500/15 border-b border-amber-500/40 text-amber-900 dark:text-amber-200 px-3 py-1.5 text-xs flex items-center justify-between gap-2">
      <span className="flex items-center gap-2">
        <Eye className="h-3.5 w-3.5" />
         Viewing as <span className="font-semibold capitalize">{safeViewAs === "user" ? "housekeeper" : safeViewAs}</span>
      </span>
      <button
        type="button"
        onClick={() => setViewAsRole(null)}
        className="underline underline-offset-2 hover:no-underline font-medium"
      >
        Exit
      </button>
    </div>
  )}

 {/* Linen list dialog */}
 <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
<DialogContent className="max-w-2xl w-[calc(100vw-1.5rem)] sm:w-full p-4 sm:p-6">
 <DialogHeader>
 <DialogTitle>Linen List</DialogTitle>
   <DialogDescription>
     Manage the shared list of linen items. Pick which items appear in each
     room from that room's <Pencil className="inline h-3.5 w-3.5 align-[-2px]" /> button.
   </DialogDescription>
 </DialogHeader>
   <div className="space-y-3">
    <form onSubmit={addTemplateItem} className="flex gap-2">
      <Input
        placeholder="Add an item…"
        value={newTemplateName}
        onChange={(e) => setNewTemplateName(e.target.value)}
      />
       <Button type="submit" disabled={!newTemplateName.trim()}>
        Add
      </Button>
    </form>
    {template.length === 0 ? (
      <p className="text-sm text-muted-foreground">No items yet.</p>
    ) : (
        <ul className="divide-y border-t max-h-[60vh] overflow-y-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
          <li className="flex items-center gap-1.5 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <span className="h-3 w-3 shrink-0" aria-hidden />
            <span className="flex-1 min-w-0">Item</span>
            <span className="shrink-0 w-[88px] text-right">Actions</span>
          </li>
          {template.map((item, idx) => {
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
                          disabled={idx === template.length - 1}
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
    )}
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
               <StickyNote className="h-4 w-4" />
               Notes — Room {n}
             </SheetTitle>
             <SheetDescription>Shared between Housekeeping and Reception</SheetDescription>
           </SheetHeader>
           <div className="mt-4 space-y-3">
             {isReception ? (
               <>
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
                             {m.created_by_username && (
                               <p className="text-[10px] text-muted-foreground mt-0.5">
                                 from {m.created_by_username}
                               </p>
                             )}
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
                   </div>
                 )}
                 <div className="space-y-2 rounded-md border bg-background p-3">
                   <div className="flex items-center justify-between gap-2">
                     <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                       For Reception
                     </p>
                     <label className="flex items-center gap-2 text-xs font-medium">
                       <Wrench className={cn("h-3.5 w-3.5", maintenance ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")} />
                       Needs maintenance
                       <Switch
                         checked={maintenance}
                         onCheckedChange={(v) => setRoomNeedsMaintenance(n, v)}
                       />
                     </label>
                   </div>
                   {(() => {
                     const draft = noteDraft[n] ?? note ?? "";
                     const dirty = draft !== (note ?? "");
                     return (
                       <>
                         <textarea
                           value={draft}
                           onChange={(e) => setNoteDraft((p) => ({ ...p, [n]: e.target.value }))}
                           placeholder="Note for Reception (e.g. fan broken, no hot water)…"
                           rows={3}
                           className="w-full rounded-md border bg-background px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                         />
                         <div className="flex justify-end gap-2">
                           {note && (
                             <Button
                               type="button"
                               variant="ghost"
                               size="sm"
                               className="h-8 text-xs"
                               onClick={() => {
                                 setNoteDraft((p) => ({ ...p, [n]: "" }));
                                 setRoomHousekeepingNote(n, "");
                               }}
                             >
                               Clear
                             </Button>
                           )}
                           <Button
                             type="button"
                             size="sm"
                             className="h-8 text-xs"
                             disabled={!dirty}
                             onClick={() => setRoomHousekeepingNote(n, draft)}
                           >
                             Save note
                           </Button>
                         </div>
                       </>
                     );
                   })()}
                 </div>
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
               Reception — Room {n}
             </SheetTitle>
             <SheetDescription>Mark status and bed configuration</SheetDescription>
           </SheetHeader>
             {isAdmin && (
               <div className="mt-2">
                 <Button
                   type="button"
                   size="sm"
                   variant="outline"
                   className="w-full"
                   onClick={() => {
                     setReceptionSheetRoom(null);
                     setQuickReceptionOpen(true);
                   }}
                 >
                   Edit all rooms
                 </Button>
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
                       } else {
                         setRoomReceptionStatus(n, s.id);
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
{authUser && (
  <NotificationsSheet
    open={notificationsSheetOpen}
    onOpenChange={setNotificationsSheetOpen}
    userRole={(authUser.role === "manager" ? "admin" : authUser.role) as "admin" | "user" | "reception"}
  />
)}
<Sheet open={menuSheetOpen} onOpenChange={setMenuSheetOpen}>
  <SheetContent side="right" className="w-auto max-w-[90vw] min-w-[18rem] sm:max-w-md overflow-y-auto p-4 sm:p-6">
    <SheetHeader className="text-left">
      <SheetTitle className="flex items-center gap-2">
        <Menu className="h-4 w-4" />
        Settings
      </SheetTitle>
      {authUser && (
        <SheetDescription>Signed in as {authUser.username}</SheetDescription>
      )}
    </SheetHeader>
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
      return (
        <div className="mt-4 space-y-4">
          {isAdmin && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Manage</p>
              <div className="space-y-1.5">
                <Row icon={List} label="Linen List" onClick={() => { close(); setTemplateOpen(true); }} />
                <Row icon={Hash} label="Manage Rooms" onClick={() => { close(); setManageRoomsOpen(true); }} />
                <Row icon={Ban} label="Rejects" onClick={() => { close(); setRejectsOpen(true); }} />
                <Row icon={History} label="History" onClick={() => { close(); setHistorySheetOpen(true); }} />
                <Row icon={ConciergeBell} label="Bulk Room Status Setup" onClick={() => { close(); setQuickReceptionOpen(true); }} />
              </div>
            </div>
          )}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Appearance</p>
            <Row
              icon={theme === "dark" ? Sun : Moon}
              label={theme === "dark" ? "Light mode" : "Dark mode"}
              onClick={() => toggleTheme()}
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account</p>
            <div className="space-y-1.5">
              {realIsAdmin && (
                <Row icon={Users} label="Users" onClick={() => { close(); setUsersOpen(true); }} />
              )}
              <Row icon={Bell} label="Notifications" onClick={() => { close(); setNotificationsSheetOpen(true); }} />
              <Row icon={User} label="Account" onClick={() => { close(); setAccountOpen(true); }} />
              <Row icon={LogOut} label="Sign out" destructive onClick={() => { close(); void signOut(); }} />
            </div>
          </div>
        </div>
      );
    })()}
  </SheetContent>
</Sheet>

{/* History sheet (Admin) */}
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
      {snapshots.length === 0 ? (
        <p className="text-sm text-muted-foreground">No exports yet.</p>
      ) : (
        (() => {
          const groups = new Map<string, typeof snapshots>();
          for (const s of snapshots) {
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
      {snapshots.length > 0 && (
        <Button
          type="button"
          variant="outline"
          className="w-full text-destructive hover:text-destructive"
          onClick={() => clearAllSnapshots()}
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

 {/* Rejects dialog */}
 <Dialog open={rejectsOpen} onOpenChange={setRejectsOpen}>
   <DialogContent className="max-w-md w-[calc(100vw-1.5rem)] sm:w-full p-4 sm:p-6">
     <DialogHeader>
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
       <div className="space-y-3">
         <ul className="divide-y rounded-md border max-h-[60vh] overflow-y-auto">
           {template.map((item) => {
             const count = getRejectCount(item.id);
             return (
               <li key={item.id} className="flex items-center gap-3 px-3 py-2">
                 <span className="flex-1 truncate text-sm">{item.name}</span>
                 <div className="flex items-center gap-1">
                   <Button
                     variant="outline"
                     size="icon"
                     className="h-8 w-8"
                     onClick={() => updateRejectCount(item.id, -1)}
                     disabled={count === 0}
                     aria-label={`Decrease ${item.name}`}
                   >
                     <Minus className="h-4 w-4" />
                   </Button>
                   <span className="w-8 text-center tabular-nums font-medium">{count}</span>
                   <Button
                     variant="outline"
                     size="icon"
                     className="h-8 w-8"
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
         <div className="flex items-center justify-between text-sm">
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
 <section className="space-y-4">
 <div className="flex items-baseline justify-between">
 <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
 Rooms
 </h2>
     {isReception && (() => {
        const totalSelected = receptionFeatureFilter.length + (receptionDoneOnlyFilter ? 1 : 0);
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
     const state = getRoomTileState(n, done);
     const baseMeta = roomStateMeta[state];
     const hasStatus = !!(room?.reception_status_id ?? room?.default_status);
      const hasLinenCount = counts.some((c) => c.room_number === n && (c.count ?? 0) > 0);
      const meta = isStaffRoom
        ? { bg: "var(--room-staff)", fg: "var(--room-staff-fg)", accent: "var(--room-staff-accent)", label: "Staff" }
        : isDirty
        ? { bg: "var(--room-dirty)", fg: "var(--room-dirty-fg)", accent: "var(--room-dirty-accent)", label: "Dirty" }
         : isClean
         ? { bg: "var(--room-done)", fg: "var(--room-done-fg)", accent: "var(--room-done-accent)", label: "Cleaned & Ready for Quest\n" }
        : (isStayover || isDnd)
          ? { ...roomStateMeta.todo, label: "Stayover" }
           : isArrival && (state === "done" || state === "complete") && hasLinenCount
             ? { bg: "var(--room-complete)", fg: "var(--room-complete-fg)", accent: "var(--room-complete-accent)", label: "Cleaned & Ready for Quest\n" }
           : isArrival && (state === "done" || state === "complete")
             ? { bg: "var(--room-done)", fg: "var(--room-done-fg)", accent: "var(--room-done-accent)", label: "Cleaned & Ready for Quest\n" }
           : isArrival && state === "todo"
             ? { ...roomStateMeta.todo, label: "Not started" }
          : !hasStatus
            ? { ...roomStateMeta.todo, label: "Not started" }
            : baseMeta;
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
              <span className="text-[9px] sm:text-[10px] md:text-xs font-medium leading-none opacity-90 whitespace-pre-line">
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
               className="absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-background"
            />
          )}
          {room?.needs_maintenance && !isStaffRoom && (
            <Wrench
              aria-label="Maintenance"
              className="absolute bottom-0.5 left-0.5 h-3 w-3 text-amber-600 dark:text-amber-400"
            />
          )}
          {room?.guest_vacated && !isStaffRoom && (
            <span
              aria-label="Guest vacated"
              className="absolute top-0.5 left-0.5 rounded-sm bg-emerald-600 px-1 py-px text-[8px] font-bold leading-none tracking-wide text-white shadow-sm dark:bg-emerald-500 dark:text-emerald-950"
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
     const state = getRoomTileState(n, receptionDoneSet.has(n));
      const baseMeta = state === "done"
        ? { bg: "var(--room-done)", fg: "var(--room-done-fg)", accent: "var(--room-done-accent)", label: "Clean" }
        : roomStateMeta[state];
     const hasStatus = !!(room?.reception_status_id ?? room?.default_status);
      const hasLinenCount = counts.some((c) => c.room_number === n && (c.count ?? 0) > 0);
      const meta = isDirty && !isStaff
        ? { bg: "var(--room-dirty)", fg: "var(--room-dirty-fg)", accent: "var(--room-dirty-accent)", label: "Dirty" }
        : isClean && !isStaff
        ? { bg: "var(--room-done)", fg: "var(--room-done-fg)", accent: "var(--room-done-accent)", label: "Clean" }
        : (isStayover || isDnd) && !isStaff
          ? { ...roomStateMeta.todo, label: "Stayover" }
          : isArrival && !isStaff && (state === "done" || state === "complete") && hasLinenCount
            ? { bg: "var(--room-complete)", fg: "var(--room-complete-fg)", accent: "var(--room-complete-accent)", label: "Clean" }
          : isArrival && !isStaff && (state === "done" || state === "complete")
            ? { bg: "var(--room-done)", fg: "var(--room-done-fg)", accent: "var(--room-done-accent)", label: "Clean" }
          : isArrival && !isStaff && state === "todo"
            ? { ...roomStateMeta.todo, label: "Not started" }
          : !hasStatus && !isStaff
            ? { ...roomStateMeta.todo, label: "Not started" }
            : baseMeta;
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
         <span className="text-sm sm:text-base md:text-xl font-bold leading-none inline-flex items-center gap-1">
           {n}
           {receptionDoneSet.has(n) && (
             <Check aria-label="Done" className="h-3 w-3" strokeWidth={4} />
           )}
         </span>
          <span className="text-[9px] sm:text-[10px] md:text-xs font-medium leading-none opacity-90 whitespace-pre-line">
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
               className="absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-background"
            />
          )}
          {room?.needs_maintenance && (
            <Wrench
              aria-label="Maintenance"
              className="absolute bottom-0.5 left-0.5 h-3 w-3 text-amber-600 dark:text-amber-400"
            />
          )}
          {room?.guest_vacated && (
            <span
              aria-label="Guest vacated"
              className="absolute top-0.5 left-0.5 rounded-sm bg-emerald-600 px-1 py-px text-[8px] font-bold leading-none tracking-wide text-white shadow-sm dark:bg-emerald-500 dark:text-emerald-950"
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
              <p className="text-xs text-muted-foreground">
                {doneSet.size} of {rooms.length} done
              </p>
            )}
 </section>
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
        viewingSnapshot.kind === "room_status" ? (
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
                viewingSnapshot.kind === "rejects" ? "rejects" : "totals",
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
   canViewAs={canViewAs}
   selfRole={realRole === "manager" ? "manager" : "admin"}
   viewAsRole={safeViewAs}
   onViewAsRoleChange={(r) => {
     // Guard: managers may never view as admin.
     if (realIsManager && r === "admin") return;
     setViewAsRole(r);
   }}
  />
  <UsersDialog open={usersOpen} onOpenChange={setUsersOpen} />
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
  canViewAs,
  selfRole,
  viewAsRole,
  onViewAsRoleChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  currentUsername: string;
  onUsernameChanged: (u: string) => void;
  canViewAs: boolean;
  selfRole: "admin" | "manager";
  viewAsRole: "admin" | "manager" | "user" | "reception" | null;
  onViewAsRoleChange: (r: "admin" | "manager" | "user" | "reception" | null) => void;
}) {
  const [username, setUsername] = useState(currentUsername);
  const [unCurrentPw, setUnCurrentPw] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setUsername(currentUsername);
      setUnCurrentPw("");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    }
  }, [open, currentUsername]);

  async function saveUsername(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (username.trim() === currentUsername) {
      toast.info("Display name is unchanged");
      return;
    }
    setBusy(true);
    try {
      const user = getStoredUser();
      if (!user) throw new Error("Not signed in");
      // Optionally re-verify current password before updating.
      if (unCurrentPw) {
        const { error: signErr } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: unCurrentPw,
        });
        if (signErr) throw new Error("Current password is incorrect");
      }
      const newName = username.trim();
      const { error: pErr } = await supabase
        .from("profiles")
        .update({ display_name: newName })
        .eq("id", user.id);
      if (pErr) throw pErr;
      await supabase.auth.updateUser({ data: { display_name: newName } });
      // Refresh cached session so the new name appears immediately.
      const { refreshSession } = await import("@/lib/auth-client");
      await refreshSession();
      onUsernameChanged(newName);
      toast.success("Display name updated");
      setUnCurrentPw("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update display name");
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (newPw !== confirmPw) {
      toast.error("New passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const user = getStoredUser();
      if (!user) throw new Error("Not signed in");
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPw,
      });
      if (signErr) throw new Error("Current password is incorrect");
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      toast.success("Password updated");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update password");
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
            Update your username or password. Your current password is required to confirm changes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {canViewAs && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">View as</h3>
              <p className="text-xs text-muted-foreground">
                Temporarily experience the app as another role. Your account stays {selfRole === "manager" ? "a manager" : "an admin"}.
              </p>
              <div className="space-y-1.5">
                {((selfRole === "manager"
                  ? ["manager", "user", "reception"]
                  : ["admin", "user", "reception"]) as ReadonlyArray<"admin" | "manager" | "user" | "reception">).map((r) => {
                  const active = (viewAsRole ?? selfRole) === r;
                  const label =
                    r === "user"
                      ? "Housekeeper"
                      : r === "reception"
                      ? "Reception"
                      : r === "manager"
                      ? "Manager (your role)"
                      : "Admin (your role)";
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        onViewAsRoleChange(r === selfRole ? null : r);
                        onOpenChange(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 rounded-full border px-4 min-h-11 text-sm font-medium transition-colors hover:bg-accent",
                        active ? "bg-accent border-primary" : "bg-background",
                      )}
                    >
                      <span className="text-left flex-1">{label}</span>
                      {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {canViewAs && <div className="border-t" />}
          <form onSubmit={saveUsername} className="space-y-2">
            <h3 className="text-sm font-semibold">Change username</h3>
            <div className="space-y-1">
              <label className="text-xs font-medium">New username</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Current password</label>
              <Input
                type="password"
                value={unCurrentPw}
                onChange={(e) => setUnCurrentPw(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={busy}>Save username</Button>
            </div>
          </form>
          <div className="border-t" />
          <form onSubmit={savePassword} className="space-y-2">
            <h3 className="text-sm font-semibold">Change password</h3>
            <div className="space-y-1">
              <label className="text-xs font-medium">Current password</label>
              <Input
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                autoComplete="current-password"
              />
            </div>
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
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={busy}>Save password</Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}