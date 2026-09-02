import React, { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useReceptionItemsQuery,
  useRoomFeatureAssignmentsQuery,
  useRoomFeaturesQuery,
  useRoomTypesQuery,
  useRoomsQuery,
} from "@/hooks/use-rooms";
import {
  useFnbCountsQuery,
  useDeliveryCountsQuery,
  useRejectCountsQuery,
  useRoomCountsQuery,
  useRoomExtrasQuery,
  useTemplateItemRoomsQuery,
  useTemplateItemsQuery,
} from "@/hooks/use-linen";
import {
  useExportSnapshotsQuery,
  useLostPropertyOpenQuery,
  useMaintenanceRequestsQuery,
  useMaintenanceAreasQuery,
  useRoomMessagesQuery,
} from "@/hooks/use-ops-log";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus, X, Menu, ArrowUp, ArrowDown, Pencil, Check, Trash2, Sun, Moon, List, Bed, House, Ban, History, Users, User, LogOut, Hash, ConciergeBell, ClipboardList, Printer, Filter, Wrench, DoorOpen, Footprints, Bell, Eye, EyeOff, HelpCircle, AlertCircle, MessageSquare, PackageSearch, RotateCcw, ChevronDown, Camera, LayoutGrid, Truck } from "lucide-react";
import {
  AccountDialog,
  AddConfigDialogs,
  DeliveryDialog,
  EditRoomDefaultsSheet,
  EditRoomSheet,
  ExportPreviewDialogs,
  HistorySheet,
  LinenCountPrintDialog,
  LinenListDialog,
  LostPropertySheet,
  MaintenanceAreasSheet,
  MaintenanceDashboard,
  MaintenanceLogSheet,
  MaintenancePrintDialog,
  ManageRoomsDialogs,
  MessagesSheet,
  NotificationsSheet,
  QuickReceptionSheet,
  ReceptionItemsSheet,
  ReceptionStatusSheet,
  RejectsDialog,
  RoomFeaturesSheet,
  RoomNotesSheet,
  RoomStatusPrintDialog,
  RoomTypesSheet,
  SnapshotPrintDialog,
  SnapshotViewerDialog,
  StayoverPhotosSheet,
  UserApprovalDialog,
  UsersDialog,
} from "@/components/lazy-panels";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getToken, getStoredUser, clearSession } from "@/lib/auth-client";
import { notifyRoomEvent, notifyMaintenanceRequest } from "@/lib/push.functions";
import type { MessagesThread, Department as MessagesDepartment } from "@/components/messages-sheet";
import { PhotoAttachments, PhotoComposer } from "@/components/entry-photos";
import { DndDoorPhoto } from "@/components/dnd-door-photo";
import { BroomBurst } from "@/components/broom-burst";
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
import { useCurrentHotel, DEFAULT_HOTEL_NAME } from "@/lib/hotels";
import { listHotels, setActiveHotel, createHotel, type HotelOption } from "@/lib/auth.functions";
import { parseCats, categoryLabel, valueFromLabel, maintenanceLocation, COLOR_SWATCHES } from "@/lib/app-format";
import type {
  Category,
  ItemColor,
  RoomType,
  RoomFeature,
  RoomFeatureAssignment,
  ReceptionItem,
  TemplateItem,
  RoomExtra,
  RoomCount,
  Room,
  TemplateItemRoom,
  SnapshotRow,
  RoomStatusRow,
  MaintenanceRow,
  ExportSnapshot,
  RejectCount,
  DeliveryCount,
  RoomMessage,
  MaintenanceArea,
  MaintenanceRequest,
  ViewRole,
  FnbCount,
  LostPropertyLite,
} from "@/lib/app-types";
import * as Exp from "@/lib/exports";
import type { SnapshotKind } from "@/lib/exports";
import {
  computeResetPreserveMap,
  getRoomTileState as computeRoomTileState,
  resolveRoomStatusIds,
  roomStateMeta,
} from "@/lib/rooms";
import type { RoomTileState } from "@/lib/rooms";
import { usePendingCounts } from "@/lib/pending-counts";
import { HousekeepingRoomTile, ReceptionRoomTile } from "@/components/rooms/room-tile";

export const Route = createFileRoute("/app")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "The Hotel Hub" },
      { name: "description", content: "Count items per room across 50 rooms." },
    ],
  }),
  component: AppPage,
});

function AppPage() {
 const qc = useQueryClient();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const isMobile = useIsMobile();
  const [authUser, setAuthUser] = useState(() => getStoredUser());
  const currentHotelQ = useCurrentHotel();
  const hotelName = currentHotelQ.data?.name ?? DEFAULT_HOTEL_NAME;
  const linenDeliveryDays: number[] = currentHotelQ.data?.linen_delivery_days ?? [];
  const todayIsMonday = new Date().getDay() === 1;
  const listHotelsFn = useServerFn(listHotels);
  const setActiveHotelFn = useServerFn(setActiveHotel);
  const createHotelFn = useServerFn(createHotel);
  const hotelsQ = useQuery({
    queryKey: ["my-hotels"],
    enabled: !!authUser,
    queryFn: () => listHotelsFn() as Promise<HotelOption[]>,
  });
  const availableHotels = hotelsQ.data ?? [];
  const [hotelSwitcherOpen, setHotelSwitcherOpen] = useState(false);
  const [switchingHotelId, setSwitchingHotelId] = useState<string | null>(null);
  const [newHotelName, setNewHotelName] = useState("");
  const [creatingHotel, setCreatingHotel] = useState(false);
  async function switchHotel(hotelId: string) {
    if (switchingHotelId) return;
    setSwitchingHotelId(hotelId);
    try {
      await setActiveHotelFn({ data: { hotelId } });
      await qc.invalidateQueries();
      toast.success("Workspace switched");
      setHotelSwitcherOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to switch workspace");
    } finally {
      setSwitchingHotelId(null);
    }
  }
  // Admin/Manager "view as" overlay — see definition further below for full context.
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
    document.title = hotelName ?? DEFAULT_HOTEL_NAME;
  }, [hotelName]);
  // Purge stayover photos older than 48 hours on load.
  useEffect(() => {
    void purgeExpiredStayoverPhotos();
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
  const [realtimeEpoch, setRealtimeEpoch] = useState(0);
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lost_property" },
        () => {
          qc.invalidateQueries({ queryKey: ["lost_property"] });
          qc.invalidateQueries({ queryKey: ["lost_property_lite"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reject_counts" },
        () => {
          qc.invalidateQueries({ queryKey: ["reject_counts"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "delivery_counts" },
        () => {
          qc.invalidateQueries({ queryKey: ["delivery_counts"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_item_counts" },
        () => {
          qc.invalidateQueries({ queryKey: ["room_counts"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fnb_linen_counts" },
        () => {
          qc.invalidateQueries({ queryKey: ["fnb_linen_counts"] });
        },
      )
      .subscribe((status) => {
        // iOS/Android suspend sockets in the background; when the socket dies
        // we rebuild the channel instead of silently going stale.
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          window.setTimeout(() => setRealtimeEpoch((n) => n + 1), 2000);
        }
        if (status === "SUBSCRIBED") {
          qc.invalidateQueries({ type: "active" });
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [authUser, qc, viewAsRole, realtimeEpoch]);
  // Resume + polling safety net: refetch whatever is on screen when the app
  // comes back to the foreground, regains network, or every 20s while visible.
  useEffect(() => {
    if (!authUser) return;
    const resync = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      qc.invalidateQueries({ type: "active" });
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      setRealtimeEpoch((n) => n + 1);
      resync();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", resync);
    window.addEventListener("online", onVisible);
    window.addEventListener("pageshow", onVisible);
    const poll = window.setInterval(resync, 20_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", resync);
      window.removeEventListener("online", onVisible);
      window.removeEventListener("pageshow", onVisible);
      window.clearInterval(poll);
    };
  }, [authUser, qc]);
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
  const [endShiftPrintOpen, setEndShiftPrintOpen] = useState(false);
  const [recordPromptOpen, setRecordPromptOpen] = useState(false);
  const [rolePickerSheetOpen, setRolePickerSheetOpen] = useState(false);
  const [editItemSheetId, setEditItemSheetId] = useState<string | null>(null);
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false);
  const [hideCompletedRooms, setHideCompletedRooms] = useState(false);
  const [hkFiltersOpen, setHkFiltersOpen] = useState(false);
  const [hkStatusFilter, setHkStatusFilter] = useState<string[]>([]);
  const [addRoomTypeOpen, setAddRoomTypeOpen] = useState(false);
  const [newRoomTypeLabel, setNewRoomTypeLabel] = useState("");
  const [addRoomFeatureOpen, setAddRoomFeatureOpen] = useState(false);
  const [newRoomFeatureLabel, setNewRoomFeatureLabel] = useState("");
  const [addReceptionItemKind, setAddReceptionItemKind] = useState<"status" | "bed" | null>(null);
  const [newReceptionItemLabel, setNewReceptionItemLabel] = useState("");
  const [receptionFeatureFilter, setReceptionFeatureFilter] = useState<string[]>([]);
  const [receptionStatusFilter, setReceptionStatusFilter] = useState<string[]>([]);
  const [receptionDoneOnlyFilter, setReceptionDoneOnlyFilter] = useState(false);
  const [receptionRoomTypeFilter, setReceptionRoomTypeFilter] = useState<string[]>([]);
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
   // Progress-bar easter egg: 7 taps within a 2-second rolling window →
   // immediate full reset + fancy broom-burst animation. If more than 2 seconds
   // elapses between taps, the counter resets and the user starts again.
  const progressTapCountRef = useRef(0);
  const progressTapTimerRef = useRef<number | null>(null);
  const [broomBurstActive, setBroomBurstActive] = useState(false);
  const handleProgressTap = () => {
    if (progressTapTimerRef.current) {
      window.clearTimeout(progressTapTimerRef.current);
      progressTapTimerRef.current = null;
    }
    const next = progressTapCountRef.current + 1;
     if (next >= 7) {
       progressTapCountRef.current = 0;
       setBroomBurstActive(true);
       void (async () => {
         try {
           await performResetAll();
         } catch (err) {
           console.error("Easter-egg reset failed", err);
           toast.error(err instanceof Error ? err.message : "Reset failed");
         }
       })();
       return;
     }
    progressTapCountRef.current = next;
    progressTapTimerRef.current = window.setTimeout(() => {
      progressTapCountRef.current = 0;
      progressTapTimerRef.current = null;
    }, 2000);
  };
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
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [roomStatusPrintOpen, setRoomStatusPrintOpen] = useState(false);
  const [linenPrintOpen, setLinenPrintOpen] = useState(false);
  const [rejectsPrintOpen, setRejectsPrintOpen] = useState(false);
  const [deliveryPrintOpen, setDeliveryPrintOpen] = useState(false);
  const [fnbPrintOpen, setFnbPrintOpen] = useState(false);
  const [maintenancePrintOpen, setMaintenancePrintOpen] = useState(false);
  const [maintenanceAreasOpen, setMaintenanceAreasOpen] = useState(false);
  const [rejectExportOpen, setRejectExportOpen] = useState(false);
  const [roomStatusExportOpen, setRoomStatusExportOpen] = useState(false);
  const [manageRoomsOpen, setManageRoomsOpen] = useState(false);
  const [linenDeliveryOpen, setLinenDeliveryOpen] = useState(false);
  const [savingDeliveryDays, setSavingDeliveryDays] = useState(false);
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

  const templateQ = useTemplateItemsQuery();
  const extrasQ = useRoomExtrasQuery();
  const countsQ = useRoomCountsQuery();
  const fnbCountsQ = useFnbCountsQuery();
  const roomsQ = useRoomsQuery();

  // "Not Required" (Stayover - Service Declined) is persisted on the room row so
  // it survives reloads, just like the other reception flags.
  const nrOnRooms = useMemo(
    () => new Set((roomsQ.data ?? []).filter((r) => r.not_required).map((r) => r.room_number)),
    [roomsQ.data],
  );

  const roomTypesQ = useRoomTypesQuery();
  const roomFeaturesQ = useRoomFeaturesQuery();
  const roomFeatureAssignmentsQ = useRoomFeatureAssignmentsQuery();
  const receptionItemsQ = useReceptionItemsQuery();
  const assignmentsQ = useTemplateItemRoomsQuery();
  const snapshotsQ = useExportSnapshotsQuery();
  const rejectsQ = useRejectCountsQuery();
  const deliveryQ = useDeliveryCountsQuery();
  const messagesQ = useRoomMessagesQuery();
  const maintenanceRequestsQ = useMaintenanceRequestsQuery();
  const maintenanceAreasQ = useMaintenanceAreasQuery();
  const lostPropertyQ = useLostPropertyOpenQuery();
  const lostPropertyOpenItems = (lostPropertyQ.data ?? []) as LostPropertyLite[];

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
  const serverCounts = countsQ.data ?? [];
  // Locally intended linen values win over server data until the server has
  // confirmed them (see usePendingCounts) so taps never flash a stale number.
  const pendingCounts = usePendingCounts({
    write: async (room, kind, itemId, value) => {
      const { error } = await supabase.from("room_item_counts").upsert(
        {
          room_number: room,
          item_kind: kind,
          item_id: itemId,
          count: value,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,hotel_id,room_number,item_kind,item_id" },
      );
      if (error) throw new Error(error.message);
    },
    onError: (message) => {
      toast.error(message);
      qc.invalidateQueries({ queryKey: ["room_counts"] });
    },
  });
  const counts = useMemo(() => {
    const entries = Object.values(pendingCounts.pending);
    if (entries.length === 0) return serverCounts;
    const list = [...serverCounts];
    for (const entry of entries) {
      const idx = list.findIndex(
        (c) =>
          c.room_number === entry.room &&
          c.item_kind === entry.kind &&
          c.item_id === entry.itemId,
      );
      if (idx >= 0) list[idx] = { ...list[idx], count: entry.value };
      else
        list.push({
          id: `pending-${entry.room}-${entry.kind}-${entry.itemId}`,
          room_number: entry.room,
          item_kind: entry.kind,
          item_id: entry.itemId,
          count: entry.value,
        });
    }
    return list;
  }, [serverCounts, pendingCounts.pending]);
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
  const deliveryCounts = (deliveryQ.data ?? []) as DeliveryCount[];
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
  const maintenanceAreas = (maintenanceAreasQ.data ?? []) as MaintenanceArea[];
  const addMaintenanceArea = async (label: string) => {
    const { error } = await supabase
      .from("maintenance_areas" as never)
      .insert({ label } as never);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["maintenance_areas"] });
    toast.success("Area added");
  };
  const deleteMaintenanceArea = async (id: string) => {
    const { error } = await supabase.from("maintenance_areas" as never).delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["maintenance_areas"] });
  };
  const openMaintenanceCount = maintenanceRequests.filter((m) => !m.done).length;
  const hasOpenMaintenance = openMaintenanceCount > 0;

  // Whether the housekeeping shift is complete — all eligible rooms are done.
  // Used to reveal the "Mark shift as finished" shortcut and to hide the now
  // redundant Linen totals / Room status items from the Export menu.
  // DND rooms are never serviceable, so they are excluded from the total.
  const isShiftComplete = (() => {
    const statusLabelById = new Map(
      receptionStatuses.map((s) => [s.id, s.label.toLowerCase()]),
    );
    const excluded = new Set(["staff", "ros", "staff/ros", "ros - staff"]);
    const dndId = receptionStatuses.find((s) => s.label.toLowerCase() === "dnd")?.id ?? null;
    const eligible = rooms.filter((r) => {
      const sid = r.reception_status_id ?? r.default_status;
      const lbl = sid ? (statusLabelById.get(sid) ?? sid).toLowerCase() : "";
      if (excluded.has(lbl)) return false;
      if (dndId && sid === dndId) return false;
      return true;
    });
    const total = eligible.length;
    const done = eligible.filter((r) => r.done || r.done_reception).length;
    return total > 0 && done >= total;
  })();

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
    const isArea = newMaintenanceRoom.startsWith("area:");
    const areaLabel = isArea ? newMaintenanceRoom.slice(5) : null;
    const roomNumber = isArea ? null : Number(newMaintenanceRoom);
    const text = newMaintenanceText.trim();
    if (!isArea && (!Number.isFinite(roomNumber as number) || (roomNumber as number) <= 0)) {
      toast.error("Pick a location");
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
        area_label: areaLabel,
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
    if (roomNumber != null) await writeRoomMaintenanceFlag(roomNumber, true);
    void notifyMaintenanceRequest({ data: { roomNumber, areaLabel: areaLabel, message: text } });
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
      { onConflict: "user_id,hotel_id,room_number" },
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
    if (target?.room_number != null) await clearRoomFlagIfNoOpenRequests(target.room_number);
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
    if (target?.room_number != null) await clearRoomFlagIfNoOpenRequests(target.room_number);
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
        { onConflict: "user_id,hotel_id,template_item_id" },
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

  // --- Delivery counter -----------------------------------------------------
  // Same shape as rejects, but counts arrive in large batches so the panel uses
  // direct number entry instead of +/- steppers.
  const getDeliveryCount = (templateItemId: string) =>
    deliveryCounts.find((r) => r.template_item_id === templateItemId)?.count ?? 0;

  const setDeliveryCount = async (templateItemId: string, value: number) => {
    const next = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
    qc.setQueryData<DeliveryCount[]>(["delivery_counts"], (old) => {
      const list = old ? [...old] : [];
      const idx = list.findIndex((r) => r.template_item_id === templateItemId);
      if (idx >= 0) list[idx] = { ...list[idx], count: next };
      else list.push({ id: `temp-${templateItemId}`, template_item_id: templateItemId, count: next });
      return list;
    });
    const { error } = await supabase
      .from("delivery_counts" as never)
      .upsert(
        { template_item_id: templateItemId, count: next, updated_at: new Date().toISOString() } as never,
        { onConflict: "user_id,hotel_id,template_item_id" },
      );
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["delivery_counts"] });
    }
  };

  const resetDeliveryCounts = async () => {
    if (!confirm("Reset all delivery counts?")) return;
    qc.setQueryData<DeliveryCount[]>(["delivery_counts"], []);
    const { error } = await supabase
      .from("delivery_counts" as never)
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["delivery_counts"] });
  };
   const position = authUser?.position;
   const subRoles = authUser?.subRoles ?? [];
   const realIsRegionalAdmin = position === "regional_admin";
   const realIsDeveloper = position === "developer";
   // Developers get full admin/regional rights everywhere.
   const realIsAdmin = position === "admin" || realIsRegionalAdmin || realIsDeveloper;
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
    const foundByDepartment =
      senderRole === "housekeeping"
        ? "HK"
        : senderRole === "fnb"
        ? "F&B"
        : senderRole === "maintenance"
        ? "MNT"
        : senderRole === "reception"
        ? "Reception"
        : null;
      const { data, error } = await supabase
        .from("lost_property" as never)
        .insert({
          room_number: roomNumber,
          message,
          created_by_username: authUser?.username ?? null,
          created_by_role: senderRole,
        found_by_department: foundByDepartment,
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
      qc.invalidateQueries({ queryKey: ["lost_property_lite"] });
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
  // Housekeeping's own completion flag, used so reception tiles reflect
  // Clean / Arrival exactly as housekeeping left them.
  const hkDoneSet = new Set(rooms.filter((r) => r.done).map((r) => r.room_number));
  const roomsWithCounts = new Set<number>(
    counts.filter((c) => (c.count ?? 0) > 0).map((c) => c.room_number),
  );
  const getRoomTileState = (n: number, isDone: boolean): RoomTileState =>
    computeRoomTileState(isDone, roomsWithCounts.has(n));

  const toggleReceptionDone = async (roomNumber: number) => {
    const current = receptionDoneSet.has(roomNumber);
    const next = !current;
    qc.setQueryData<Room[]>(["rooms"], (old) => {
      const list = old ? [...old] : [];
      const idx = list.findIndex((r) => r.room_number === roomNumber);
      if (idx >= 0) list[idx] = { ...list[idx], done_reception: next, guest_vacated: next ? false : list[idx].guest_vacated, guest_vacated_at: next ? null : list[idx].guest_vacated_at };
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
      { room_number: roomNumber, done_reception: next, ...(next ? { guest_vacated: false, guest_vacated_at: null } : {}), updated_at: new Date().toISOString() },
      { onConflict: "user_id,hotel_id,room_number" },
    );
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["rooms"] });
    if (next) fireRoomNotification("done", roomNumber);
  };

  const toggleHousekeepingDone = async (roomNumber: number) => {
    const room = rooms.find((r) => r.room_number === roomNumber);
    const next = !room?.done;
    qc.setQueryData<Room[]>(["rooms"], (old) =>
      (old ?? []).map((r) =>
        r.room_number === roomNumber
          ? {
              ...r,
              done: next,
              guest_vacated: next ? false : r.guest_vacated,
              guest_vacated_at: next ? null : r.guest_vacated_at,
            }
          : r,
      ),
    );
    const { error } = await supabase.from("rooms").upsert(
      {
        room_number: roomNumber,
        done: next,
        ...(next ? { guest_vacated: false, guest_vacated_at: null } : {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,hotel_id,room_number" },
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
  // Synchronous: the intended value lands in the pending overlay immediately
  // and the network write is queued/coalesced per item.
  const updateCount = (
    roomNumber: number,
    kind: "template" | "extra",
    itemId: string,
    delta: number,
  ) => {
    const current = getCount(roomNumber, kind, itemId);
    const next = Math.max(0, current + delta);
    if (next === current) return;
    pendingCounts.setTarget(roomNumber, kind, itemId, next);
  };


 const openOrToggle = (roomNumber: number) => {
    if (openRoom === roomNumber) {
      setOpenRoom(null);
      return;
    }
    setOpenRoom(roomNumber);
  };

  const resetRoomCounts = async (roomNumber: number) => {
    pendingCounts.clearAll();
    qc.setQueryData<RoomCount[]>(["room_counts"], (old) =>

      old?.filter((c) => c.room_number !== roomNumber) ?? [],
    );
    const { error } = await supabase
      .from("room_item_counts")
      .delete()
      .eq("room_number", roomNumber);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["room_counts"] });

  };

  const resetAll = async () => {
    if (!confirm("Reset all rooms? Reception flags added after 4pm will stay.")) return;
    await performResetAll();
  };

  const performResetAll = async () => {
    pendingCounts.clearAll();
    const now = new Date();
    const currentRooms = qc.getQueryData<Room[]>(["rooms"]) ?? [];
    // Preserve reception flags (guest_vacated / early_check_in / needs_maintenance)
    // set after the most recent 4pm cutoff; Dirty rooms get the checkout flag.
    const preserveMap = computeResetPreserveMap(currentRooms, receptionStatuses, now);

    qc.setQueryData<Room[]>(["rooms"], (old) =>
      old?.map((r) => {
        const keep = preserveMap.get(r.room_number);
        return {
          ...r,
          done: false,
          done_reception: false,
          housekeeping_note: null,
          reception_status_id: null,
          reception_bed_id: null,
          guest_vacated: keep?.guest_vacated ?? false,
          stayover_out: false,
          stayover_out_at: null,
          early_check_in: keep?.early_check_in ?? false,
          needs_maintenance: keep?.needs_maintenance ?? false,
          guest_vacated_at: keep?.guest_vacated_at ?? null,
          early_check_in_at: keep?.early_check_in_at ?? null,
          needs_maintenance_at: keep?.needs_maintenance_at ?? null,
          not_required: false,
          not_required_at: null,
        };
      }) ?? [],
    );
    qc.setQueryData<RoomCount[]>(["room_counts"], () => []);

    const preservedNumbers = Array.from(preserveMap.keys());
    // Full reset for rooms with no fresh flags.
    let q1 = supabase.from("rooms").update({
      done: false,
      done_reception: false,
      housekeeping_note: null,
      needs_maintenance: false,
      needs_maintenance_at: null,
      guest_vacated: false,
      guest_vacated_at: null,
      stayover_out: false,
      stayover_out_at: null,
      early_check_in: false,
      early_check_in_at: null,
      reception_status_id: null,
      reception_bed_id: null,
      not_required: false,
      not_required_at: null,
    } as never).neq("room_number", -1);
    if (preservedNumbers.length > 0) q1 = q1.not("room_number", "in", `(${preservedNumbers.join(",")})`);
    const r1 = await q1;
    if (r1.error) toast.error(r1.error.message);

    // Partial reset for preserved rooms — clear housekeeping-side state only,
    // and only clear each reception flag if it isn't fresh.
    for (const [rn, keep] of preserveMap) {
      const r = await supabase.from("rooms").update({
        done: false,
        done_reception: false,
        housekeeping_note: null,
        reception_status_id: null,
        reception_bed_id: null,
        guest_vacated: keep.guest_vacated,
        guest_vacated_at: keep.guest_vacated_at,
        stayover_out: false,
        stayover_out_at: null,
        early_check_in: keep.early_check_in,
        early_check_in_at: keep.early_check_in_at,
        needs_maintenance: keep.needs_maintenance,
        needs_maintenance_at: keep.needs_maintenance_at,
        not_required: false,
        not_required_at: null,
      } as never).eq("room_number", rn);
      if (r.error) toast.error(r.error.message);
    }

    // Clear room linen counts, rejects, and delivery counts so the reset
    // zeroes rooms for all departments (reception's reset runs the same path
    // as housekeeping's).
    qc.setQueryData(["reject_counts"], () => []);
    qc.setQueryData(["delivery_counts"], () => []);
    const [r2, rRej, rDel] = await Promise.all([
      supabase.from("room_item_counts").delete().neq("room_number", -1),
      supabase.from("reject_counts").delete().neq("count", -1),
      supabase.from("delivery_counts" as never).delete().neq("count", -1),
    ]);
    if (r2.error) toast.error(r2.error.message);
    if (rRej.error) toast.error(rRej.error.message);
    if (rDel.error) toast.error(rDel.error.message);
    // Verify the linen counts actually cleared (RLS or a partial failure would
    // otherwise leave stale counts showing after the cache refetches).
    const { data: leftover } = await supabase
      .from("room_item_counts")
      .select("id")
      .limit(1);
    if (leftover && leftover.length > 0) {
      toast.error("Some linen counts could not be cleared.");
    }
    // Clear pinned room messages from the tiles WITHOUT deleting them —
    // marking them dismissed + done removes the amber dot / peek but keeps
    // them visible in the corresponding chat thread (Messages window).
    const nowIso = new Date().toISOString();
    const r3 = await supabase
      .from("room_messages" as never)
      .update({ dismissed: true, done_at: nowIso, updated_at: nowIso } as never)
      .not("room_number", "is", null)
      .is("deleted_at", null)
      .eq("dismissed", false);
    if (r3.error) toast.error(r3.error.message);
    // Record the housekeeping reset on the active hotel so Reception's own
    // "Reset all" button (visible after 7am) can hide itself for the rest of
    // the day.
    const activeHotelId = currentHotelQ.data?.id;
    if (activeHotelId) {
      const { error: hErr } = await supabase
        .from("hotels")
        .update({ last_hk_reset_at: nowIso } as never)
        .eq("id", activeHotelId);
      if (hErr) toast.error(hErr.message);
      qc.invalidateQueries({ queryKey: ["current-hotel"] });
    }
    qc.invalidateQueries({ queryKey: ["rooms"] });
    await qc.refetchQueries({ queryKey: ["room_counts"] });
    qc.invalidateQueries({ queryKey: ["reject_counts"] });
    qc.invalidateQueries({ queryKey: ["delivery_counts"] });
    qc.invalidateQueries({ queryKey: ["room_messages"] });
  };

  const resetReceptionAll = async () => {
    // Reception's "Reset all" now resets exactly the same content as the
    // housekeeping reset (same preservation rules, counts, and pinned messages).
    if (!confirm("Reset all rooms? Reception flags added after 4pm will stay.")) return;
    await performResetAll();
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
      { onConflict: "user_id,hotel_id,room_number" },
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

  const computeTotals = () => Exp.computeTotals(counts, template, extras);
  const computeRejectTotals = () => Exp.computeRejectTotals(rejects, template);
  const computeDeliveryTotals = () =>
    Exp.computeRejectTotals(deliveryCounts as unknown as RejectCount[], template);
  const computeRoomStatus = () => Exp.computeRoomStatus(rooms, receptionStatuses, receptionBeds);
  const computeMaintenance = () => Exp.computeMaintenance(rooms);
  const computeFnbTotals = () => Exp.computeFnbTotals(templateFnbList, fnbCountByItem);
  const computeDeliveryLinenTotals = () =>
    Exp.computeDeliveryLinenTotals(snapshots, linenDeliveryDays);
  const computeWeeklyFnbTotals = () => Exp.computeWeeklyFnbTotals(snapshots);

  const saveSnapshot = (kind: SnapshotKind, rows: unknown[], grand: number) =>
    Exp.saveSnapshot(qc, kind, rows, grand);

  const printTotals = (
    rows: SnapshotRow[],
    grand: number,
    when: Date,
    kind: "totals" | "rejects" | "fnb_totals" | "delivery" = "totals",
    subheading?: string,
    footer?: string,
  ) => Exp.printTotals(hotelName, rows, grand, when, kind, subheading, footer);

  const openDeliveryExport = async () => {
    const { rows, grand } = computeDeliveryTotals();
    if (rows.length === 0) {
      toast.error("No delivery counted yet");
      return;
    }
    printTotals(rows, grand, new Date(), "delivery");
    const ok = await Exp.saveSnapshot(qc, "delivery", rows, grand);
    if (ok) qc.invalidateQueries({ queryKey: ["export_snapshots"] });
  };
  const printRoomStatus = Exp.printRoomStatus;
  const printMaintenance = (when: Date, presetList?: MaintenanceRow[]) =>
    Exp.printMaintenance(when, presetList ?? computeMaintenance().rows);

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

  const openDeliveryLinenTotals = async () => {
    const { rows, grand, start, end } = computeDeliveryLinenTotals();
    if (rows.length === 0) {
      toast.error("No linen totals recorded since the last delivery day");
      return;
    }
    const sub = `Printed Range: ${Exp.formatLongDate(start, false)} - ${Exp.formatLongDate(end, false)}`;
    const footer = `Date Printed: ${Exp.formatLongDate(new Date(), true)}`;
    printTotals(rows, grand, end, "totals", sub, footer);
    // Ranged (delivery-window) linen counts are stored under their own kind so
    // history can label them separately and they never pollute daily roll-ups.
    const ok = await saveSnapshot("totals_range", rows, grand);
    if (ok) qc.invalidateQueries({ queryKey: ["export_snapshots"] });
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
    if (kind === "totals") setExportOpen(true);
    else if (kind === "rejects") setRejectExportOpen(true);
    else if (kind === "room_status") setRoomStatusExportOpen(true);
    else if (kind === "fnb_totals") printTotals(rows as SnapshotRow[], grand, new Date(), "fnb_totals");
    else printMaintenance(new Date(), rows as MaintenanceRow[]);
    const ok = await saveSnapshot(kind, rows, grand);
    if (!ok) return;
    qc.invalidateQueries({ queryKey: ["export_snapshots"] });
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

  const openWeeklyFnbTotals = () => {
    const { rows, grand, start, end } = computeWeeklyFnbTotals();
    if (rows.length === 0) {
      toast.error("No F&B linen recorded last week");
      return;
    }
    printTotals(
      rows,
      grand,
      end,
      "fnb_totals",
      `Weekly total, ${Exp.formatShortDate(start)} – ${Exp.formatShortDate(end)}`,
    );
  };

  // End-of-shift backup: silently snapshot every kind that has data (replacing
  // any same-day snapshot of that kind), then offer to print the room status
  // sheet. Replaces the multi-item Export dropdown on the home screen; the
  // per-kind manual exports remain available in Settings → Actions → Export.
  const runEndOfShiftBackup = async () => {
    type Kind = "totals" | "fnb_totals" | "room_status" | "maintenance" | "delivery";
    const jobs: Array<{ kind: Kind; rows: unknown[]; grand: number }> = [];
    const t = computeTotals();
    if (t.rows.length) jobs.push({ kind: "totals", rows: t.rows, grand: t.grand });
    const f = computeFnbTotals();
    if (f.rows.length) jobs.push({ kind: "fnb_totals", rows: f.rows, grand: f.grand });
    const d = computeDeliveryTotals();
    if (d.rows.length) jobs.push({ kind: "delivery", rows: d.rows, grand: d.grand });
    const rs = computeRoomStatus();
    if (rs.rows.length) jobs.push({ kind: "room_status", rows: rs.rows, grand: rs.grand });
    const m = computeMaintenance();
    if (m.rows.length) jobs.push({ kind: "maintenance", rows: m.rows, grand: m.grand });
    if (jobs.length === 0) {
      toast.error("Nothing to back up yet");
      return;
    }
    for (const job of jobs) {
      const ok = await saveSnapshot(job.kind, job.rows, job.grand);
      if (!ok) return;
    }
    qc.invalidateQueries({ queryKey: ["export_snapshots"] });
    toast.success(`Backup saved (${jobs.length} ${jobs.length === 1 ? "item" : "items"})`);
  };

  // Reports entry point: ask whether to record today's data first. Maintenance
  // accounts have no data to back up, so they go straight to the reports list.
  const openReports = () => {
    if (isMaintenance) {
      setEndShiftPrintOpen(true);
      return;
    }
    setRecordPromptOpen(true);
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
 { onConflict: "user_id,hotel_id,room_number" },
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
      { onConflict: "user_id,hotel_id,room_number" },
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
      { onConflict: "user_id,hotel_id,room_number" },
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
      { onConflict: "user_id,hotel_id,room_number" },
    );
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["rooms"] });
  };

  const setRoomNeedsMaintenance = async (roomNumber: number, value: boolean) => {
    const nowIso = new Date().toISOString();
    qc.setQueryData<Room[]>(["rooms"], (old) => {
      const list = old ? [...old] : [];
      const idx = list.findIndex((r) => r.room_number === roomNumber);
      if (idx >= 0) list[idx] = { ...list[idx], needs_maintenance: value, needs_maintenance_at: value ? nowIso : null };
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
          needs_maintenance: value, needs_maintenance_at: value ? nowIso : null, guest_vacated: false, early_check_in: false,
        });
      return list;
    });
    const { error } = await supabase.from("rooms").upsert(
      {
        room_number: roomNumber,
        needs_maintenance: value,
        needs_maintenance_at: value ? nowIso : null,
        updated_at: nowIso,
      } as never,
      { onConflict: "user_id,hotel_id,room_number" },
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
    const nowIso = new Date().toISOString();
    qc.setQueryData<Room[]>(["rooms"], (old) => {
      const list = old ? [...old] : [];
      const idx = list.findIndex((r) => r.room_number === roomNumber);
      if (idx >= 0) list[idx] = { ...list[idx], guest_vacated: value, guest_vacated_at: value ? nowIso : null };
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
          guest_vacated_at: value ? nowIso : null,
        });
      return list;
    });
    const { error } = await supabase.from("rooms").upsert(
      {
        room_number: roomNumber,
        guest_vacated: value,
        guest_vacated_at: value ? nowIso : null,
        updated_at: nowIso,
      } as never,
      { onConflict: "user_id,hotel_id,room_number" },
    );
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["rooms"] });
    if (value) fireRoomNotification("checkout", roomNumber);
  };

  // Stayover guest has gone out for the day: room is empty and can be
  // serviced now. Separate from guest_vacated (checked out for good).
  const setRoomStayoverOut = async (roomNumber: number, value: boolean) => {
    const nowIso = new Date().toISOString();
    qc.setQueryData<Room[]>(["rooms"], (old) => {
      const list = old ? [...old] : [];
      const idx = list.findIndex((r) => r.room_number === roomNumber);
      if (idx >= 0)
        list[idx] = { ...list[idx], stayover_out: value, stayover_out_at: value ? nowIso : null };
      return list;
    });
    const { error } = await supabase.from("rooms").upsert(
      {
        room_number: roomNumber,
        stayover_out: value,
        stayover_out_at: value ? nowIso : null,
        updated_at: nowIso,
      } as never,
      { onConflict: "user_id,hotel_id,room_number" },
    );
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["rooms"] });
  };

  const setRoomNotRequired = async (roomNumber: number, value: boolean) => {
    const nowIso = new Date().toISOString();
    qc.setQueryData<Room[]>(["rooms"], (old) => {
      const list = old ? [...old] : [];
      const idx = list.findIndex((r) => r.room_number === roomNumber);
      if (idx >= 0)
        list[idx] = { ...list[idx], not_required: value, not_required_at: value ? nowIso : null };
      return list;
    });
    const { error } = await supabase.from("rooms").upsert(
      {
        room_number: roomNumber,
        not_required: value,
        not_required_at: value ? nowIso : null,
        updated_at: nowIso,
      } as never,
      { onConflict: "user_id,hotel_id,room_number" },
    );
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["rooms"] });
  };

  const setRoomEarlyCheckIn = async (roomNumber: number, value: boolean) => {
    const nowIso = new Date().toISOString();
    qc.setQueryData<Room[]>(["rooms"], (old) => {
      const list = old ? [...old] : [];
      const idx = list.findIndex((r) => r.room_number === roomNumber);
      if (idx >= 0) list[idx] = { ...list[idx], early_check_in: value, early_check_in_at: value ? nowIso : null };
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
          early_check_in_at: value ? nowIso : null,
        });
      return list;
    });
    const { error } = await supabase.from("rooms").upsert(
      {
        room_number: roomNumber,
        early_check_in: value,
        early_check_in_at: value ? nowIso : null,
        updated_at: nowIso,
      } as never,
      { onConflict: "user_id,hotel_id,room_number" },
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
    return { backgroundColor: theme === "dark" ? c.darkBg : c.bg };
  };
  return (
  <div className="border rounded-xl bg-muted/30 flex flex-col min-h-0 flex-1 overflow-hidden">
    <div className={cn("p-4 space-y-4", isReception ? "flex-1 min-h-0 overflow-y-auto" : "shrink-0")}>

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
            {(() => {
              const statusId = room?.reception_status_id ?? room?.default_status ?? null;
              const rawStatus = statusId
                ? receptionStatuses.find((s) => s.id === statusId)?.label ?? null
                : null;
              const statusText = rawStatus === "DND"
                ? "Stayover"
                : rawStatus?.toLowerCase() === "staff"
                  ? "ROS - Staff"
                  : rawStatus?.toLowerCase() === "dirty"
                    ? "ROS - Dirty"
                    : rawStatus;
              const bedText = room?.reception_bed_id
                ? receptionBeds.find((b) => b.id === room.reception_bed_id)?.label ?? null
                : null;
              const hasAny = !!statusText || !!bedText;
              return (
                <div className="rounded-xl border bg-muted/40 p-3 space-y-2 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Room status
                  </p>
                  {hasAny ? (
                    <div className="grid grid-cols-2 gap-3">
                      <p className="text-foreground">
                        <span className="font-medium">Status:</span>{" "}
                        {statusText ?? <span className="text-muted-foreground">Not set</span>}
                      </p>
                      <p className="text-foreground">
                        <span className="font-medium">Bed:</span>{" "}
                        {bedText ?? <span className="text-muted-foreground">Not set</span>}
                      </p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Status not currently set</p>
                  )}
                </div>
              );
            })()}
            <div className="flex items-center justify-between gap-2 rounded-xl border bg-background p-3">
              <span className="flex items-center gap-2 text-sm font-medium">
                <DoorOpen className={cn("h-4 w-4", room?.early_check_in ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")} />
                Early check-in
              </span>
              <Switch checked={!!room?.early_check_in} onCheckedChange={(v) => setRoomEarlyCheckIn(n, v)} />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-xl border bg-background p-3">
              <span className="flex items-center gap-2 text-sm font-medium">
                <DoorOpen className={cn("h-4 w-4", vacated ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")} />
                Guest has checked out
              </span>
              <Switch checked={vacated} onCheckedChange={(v) => setRoomGuestVacated(n, v)} />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-xl border bg-background p-3">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Footprints className={cn("h-4 w-4", room?.stayover_out ? "text-sky-600 dark:text-sky-400" : "text-muted-foreground")} />
                Stayover — guest out for the day
              </span>
              <Switch checked={!!room?.stayover_out} onCheckedChange={(v) => setRoomStayoverOut(n, v)} />
            </div>
            {maintenance && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-500/60 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm">
                <Wrench className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="font-medium text-amber-800 dark:text-amber-200">
                  Maintenance requested by Housekeeping
                </span>
              </div>
            )}
            <div className="rounded-xl border bg-background p-3">
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
            <div className="space-y-2 rounded-xl border border-emerald-400/60 bg-emerald-50 dark:bg-emerald-950/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
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
        <div className="space-y-2 rounded-xl border bg-background p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Room features
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {assigned.map((f) => (
              <li
                key={f.id}
                className="inline-flex items-center rounded-xl border bg-muted px-2 py-1 text-xs font-medium"
              >
                {f.label}
              </li>
            ))}
          </ul>
        </div>
      );
    })()}

    {isReception && (() => {
      const room = rooms.find((r) => r.room_number === n);
      const occ = room?.reception_status_id ?? room?.default_status ?? null;
      const dndId = receptionStatuses.find((x) => x.label === "DND")?.id ?? null;
      if (!dndId || occ !== dndId) return null;
      return <DndDoorPhoto roomNumber={n} />;
    })()}

    {isReception && (() => {
      const openMaint = (maintenanceRequestsQ.data ?? []).filter(
        (m) => m.room_number === n && !m.done,
      );
      const openLp = lostPropertyOpenItems.filter((lp) => lp.room_number === n);
      if (openMaint.length === 0 && openLp.length === 0) return null;
      const fmt = (iso: string) =>
        new Date(iso).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
      return (
        <div className="space-y-3">
          {openMaint.length > 0 && (
            <div className="space-y-2 rounded-xl border border-amber-400/60 bg-amber-50 dark:bg-amber-950/40 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                <Wrench className="h-3.5 w-3.5" />
                Open maintenance ({openMaint.length})
              </p>
              <ul className="space-y-1.5">
                {openMaint.map((m) => (
                  <li key={m.id} className="rounded bg-background/70 p-2 text-sm">
                    <div className="whitespace-pre-wrap break-words">{m.message}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {m.created_by_username ?? "Unknown"} · {fmt(m.created_at)}
                    </div>
                    {Array.isArray(m.photo_paths) && m.photo_paths.length > 0 && (
                      <div className="mt-2">
                        <PhotoAttachments
                          kind="maintenance"
                          entryId={m.id}
                          paths={m.photo_paths}
                          canEdit={false}
                          onChange={() => {}}
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {openLp.length > 0 && (
            <div className="space-y-2 rounded-xl border border-rose-400/60 bg-rose-50 dark:bg-rose-950/40 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
                <PackageSearch className="h-3.5 w-3.5" />
                Lost property ({openLp.length})
              </p>
              <ul className="space-y-1.5">
                {openLp.map((lp) => (
                  <li key={lp.id} className="rounded bg-background/70 p-2 text-sm">
                    <div className="whitespace-pre-wrap break-words">{lp.message}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      Logged {fmt(lp.created_at)}
                    </div>
                    {Array.isArray(lp.photo_paths) && lp.photo_paths.length > 0 && (
                      <div className="mt-2">
                        <PhotoAttachments
                          kind="lost_property"
                          entryId={lp.id}
                          paths={lp.photo_paths}
                          canEdit={false}
                          onChange={() => {}}
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    })()}

    {!isReception && (
      <div className="flex flex-row gap-2">
        <button
          type="button"
          onClick={() => setReceptionSheetRoom(n)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-xl border bg-background px-3 sm:px-4 h-11 shadow-sm active:scale-[0.97] active:shadow-none flex-1 text-sm font-medium cursor-pointer transition-colors hover:bg-accent",
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
            "flex items-center justify-center gap-1.5 rounded-xl border bg-background px-3 sm:px-4 h-11 shadow-sm active:scale-[0.97] active:shadow-none flex-1 text-sm font-medium cursor-pointer transition-colors hover:bg-accent",
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
            className="inline-flex items-center justify-center h-11 w-11 shrink-0 rounded-xl border bg-background shadow-sm active:scale-[0.97] active:shadow-none text-sm font-medium cursor-pointer transition-colors hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="relative inline-flex items-center justify-center h-11 w-11 shrink-0 rounded-xl border bg-background shadow-sm active:scale-[0.97] active:shadow-none text-sm font-medium cursor-pointer transition-colors hover:bg-accent"
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
    {/* Compact message peek — shows the latest active room message directly
        under the action row. Tap to open the notifications panel to
        dismiss/confirm. */}
    {!isReception && (() => {
      const room = rooms.find((r) => r.room_number === n);
      const msgs = activeMessagesByRoom(n);
      if (msgs.length === 0 && !room?.housekeeping_note) return null;
      const latest = msgs[msgs.length - 1];
      const preview = latest?.message ?? room?.housekeeping_note ?? "";
      const sender = latest?.created_by_username
        ? latest.created_by_username
        : latest
          ? "Reception"
          : "Note";
      return (
        <button
          type="button"
          onClick={() => setNotesSheetRoom(n)}
          className="mt-2 flex w-full items-center gap-2 rounded-xl border border-amber-400/60 bg-amber-50 px-3 py-2 text-left text-xs hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-950/60"
          aria-label="Open room message"
        >
          <MessageSquare className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="font-semibold text-amber-800 dark:text-amber-200 shrink-0">
            {sender}:
          </span>
          <span className="truncate text-amber-900/90 dark:text-amber-100/90">
            {preview}
          </span>
        </button>
      );
    })()}
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
        className="flex items-center gap-3 py-2 px-2 rounded-xl border"
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
      className="flex items-center gap-3 py-2 px-2 rounded-xl border"
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

  type MenuAction = {
    key: string;
    icon: React.ComponentType<{ className?: string }>;
    label: React.ReactNode;
    onClick: () => void;
    destructive?: boolean;
  };
  const menuGroups: { id: string; title: string; items: MenuAction[] }[] = (() => {
    const actions: MenuAction[] = [];
    // Settings menu content is uniform across screen sizes. Larger screens also
    // surface End of shift / Departments on the home header, but they stay here too.
    if ((realIsAdmin || (realIsManager && hasHousekeeperRole)) && !isReception && !menuIsFnbOnly) {
      actions.push({
        key: "end-of-shift",
        icon: ClipboardList,
        label: "Reports",
        onClick: () => openReports(),
      });
    } else if (isMaintenance) {
      actions.push({
        key: "end-of-shift",
        icon: ClipboardList,
        label: "Reports",
        onClick: () => openReports(),
      });
    }
    if (isReception) {
      actions.push({
        key: "print", icon: Printer, label: "Print",
        onClick: () => printRoomStatus(computeRoomStatus().rows, new Date()),
      });
      actions.push({ key: "help", icon: HelpCircle, label: "Help", onClick: () => setReceptionHelpOpen(true) });
    }
    const utilities: MenuAction[] = [];
    if (!menuIsFnbOnly && !isMaintenance) {
      utilities.push({
        key: "maintenance-log", icon: Wrench,
        label: (
          <span className="flex items-center gap-2">
            Maintenance Log
            {hasOpenMaintenance && (<span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />)}
          </span>
        ),
        onClick: () => setMaintenanceLogOpen(true),
      });
    }
    if (menuCanUseLostProperty && !isMaintenance) {
      utilities.push({ key: "lost-property", icon: PackageSearch, label: "Lost Property", onClick: () => setLostPropertyOpen(true) });
    }
    if ((menuIsAdmin || hasHousekeeperRole || hasReceptionRole) && !isMaintenance) {
      utilities.push({
        key: "stayover-photos", icon: Camera, label: "Stayover Photos",
        onClick: () => { setStayoverPhotosRoomFilter(undefined); setStayoverPhotosOpen(true); },
      });
    }
    if (canUseMessages) {
      utilities.push({
        key: "messages", icon: MessageSquare, label: "Messages",
        onClick: () => { setMessagesInitial({}); setMessagesSheetOpen(true); },
      });
    }
    const manage: MenuAction[] = [];
    if ((menuHasHk || menuHasFnb) && !isMaintenance) {
      manage.push({ key: "linen-list", icon: List, label: "Linen List", onClick: () => setTemplateOpen(true) });
    }
    if (menuIsAdmin && !isMaintenance) {
      manage.push({ key: "manage-rooms", icon: Hash, label: "Manage Rooms", onClick: () => setManageRoomsOpen(true) });
      manage.push({
        key: "rejects",
        icon: Ban,
        label: "Rejects",
        onClick: () => {
          qc.invalidateQueries({ queryKey: ["reject_counts"] });
          setRejectsOpen(true);
        },
      });
      manage.push({
        key: "delivery",
        icon: Truck,
        label: "Delivery",
        onClick: () => {
          qc.invalidateQueries({ queryKey: ["delivery_counts"] });
          setDeliveryOpen(true);
        },
      });
      if (!isReception) {
        manage.push({ key: "history", icon: History, label: "History", onClick: () => setHistorySheetOpen(true) });
      }
      manage.push({ key: "bulk", icon: ConciergeBell, label: "Bulk Room Status Setup", onClick: () => setQuickReceptionOpen(true) });
    }
    if ((realIsAdmin || (realIsManager && hasHousekeeperRole)) && !isMaintenance) {
      manage.push({ key: "linen-days", icon: List, label: "Linen delivery days", onClick: () => setLinenDeliveryOpen(true) });
    }
    const account: MenuAction[] = [];
    // Also exposed as pills on the home header where the screen is wide enough.
    if (canViewAs) {
      account.push({ key: "departments", icon: LayoutGrid, label: "Departments", onClick: () => setRolePickerSheetOpen(true) });
    }
    if (availableHotels.length > 1 || realIsAdmin) {
      account.push({ key: "switch-hotel", icon: RotateCcw, label: "Switch hotel", onClick: () => setHotelSwitcherOpen(true) });
    }
    if ((realIsAdmin || realIsManager) && !isMaintenance) {
      account.push({ key: "users", icon: Users, label: "Users", onClick: () => setUsersOpen(true) });
    }
    if (!menuIsFnbOnly) {
      account.push({ key: "notifications", icon: Bell, label: "Notifications", onClick: () => setNotificationsSheetOpen(true) });
    }
    account.push({ key: "account", icon: User, label: "Account", onClick: () => setAccountOpen(true) });
    account.push({ key: "signout", icon: LogOut, label: "Sign out", destructive: true, onClick: () => void signOut() });
    const appearance: MenuAction[] = [{
      key: "theme",
      icon: theme === "dark" ? Sun : Moon,
      label: theme === "dark" ? "Light mode" : "Dark mode",
      onClick: () => toggleTheme(),
    }];
    return [
      { id: "actions", title: "Actions", items: actions },
      { id: "utilities", title: "Utilities", items: utilities },
      { id: "manage", title: "Manage", items: manage },
      { id: "account", title: "Account", items: account },
      { id: "appearance", title: "Appearance", items: appearance },
    ].filter((g) => g.items.length > 0);
  })();

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
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{hotelName}</h1>
                <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">
                  An auto-updating room tracker for Housekeeping. Use the help button if you're stuck
                </p>
              </>
            ) : isFnb ? (
              <>
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{hotelName}</h1>
                <p className="text-xs text-muted-foreground mt-1">
                  Shared workspace for F&B staff
                </p>
              </>
            ) : (
              <>
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{hotelName}</h1>
                <p className="text-xs text-muted-foreground mt-1">
                  Shared workspace for Housekeeping staff
                </p>
              </>
            )}
            {canViewAs && !isMobile && (
              <div className="mt-3 inline-flex flex-wrap rounded-xl border p-0.5 bg-background items-center">
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
          </div>
 <div className="flex items-center gap-2">
    {!isMobile && ((isAdmin && !isReception) || isMaintenance) && (
      <Button
        variant="outline"
        size="sm"
        onClick={openReports}
        title="Back up today's data and print reports"
      >
        <ClipboardList className="h-4 w-4 mr-2" />
        Reports
      </Button>
    )}
    {!isMobile && isReception && (
      <Button
        variant="outline"
        size="sm"
        onClick={() => printRoomStatus(computeRoomStatus().rows, new Date())}
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
        {menuGroups.map((group, gi) => (
          <React.Fragment key={group.id}>
            {gi > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.title}
            </DropdownMenuLabel>
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <DropdownMenuItem
                  key={item.key}
                  onClick={item.onClick}
                  className={item.destructive ? "text-destructive focus:text-destructive" : undefined}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  <span className="flex-1">{item.label}</span>
                </DropdownMenuItem>
              );
            })}
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )}
 </div>
 </header>

 {/* Mobile role-picker sheet (triggered from the burger menu). */}
 {isMobile && canViewAs && (
   <Sheet open={rolePickerSheetOpen} onOpenChange={setRolePickerSheetOpen}>
     <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl p-4 sm:p-6">
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
  {/* End-of-shift: after backup, offer to print the room status sheet. */}
  <Dialog open={recordPromptOpen} onOpenChange={setRecordPromptOpen}>
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>Would you like to record today's data?</DialogTitle>
        <DialogDescription>
          Recording saves a backup of today's counts and room statuses before you open the reports.
        </DialogDescription>
      </DialogHeader>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="h-12"
          onClick={() => {
            setRecordPromptOpen(false);
            setEndShiftPrintOpen(true);
          }}
        >
          No
        </Button>
        <Button
          className="h-12"
          onClick={async () => {
            setRecordPromptOpen(false);
            await runEndOfShiftBackup();
            setEndShiftPrintOpen(true);
          }}
        >
          Yes
        </Button>
      </div>
    </DialogContent>
  </Dialog>
  <Dialog open={endShiftPrintOpen} onOpenChange={setEndShiftPrintOpen}>
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>Reports</DialogTitle>
        <DialogDescription>
          {isMaintenance
            ? "Print maintenance jobs for a day or date range."
            : "Back up today's data, or choose a report and pick the date to print."}
        </DialogDescription>
      </DialogHeader>
      <div className="mt-2 grid gap-2">
        {!isMaintenance && (
          <Button
            className="justify-start h-12"
            onClick={() => void runEndOfShiftBackup()}
          >
            <ClipboardList className="h-4 w-4 mr-2" />
            Back up data now
          </Button>
        )}
        {!isMaintenance && (
          <>
        <Button
          variant="outline"
          className="justify-start h-12"
          onClick={() => {
            setEndShiftPrintOpen(false);
            setRoomStatusPrintOpen(true);
          }}
        >
          <House className="h-4 w-4 mr-2" />
          Room Status
        </Button>
        <Button
          variant="outline"
          className="justify-start h-12"
          onClick={() => {
            setEndShiftPrintOpen(false);
            setLinenPrintOpen(true);
          }}
        >
          <Bed className="h-4 w-4 mr-2" />
          Linen Count
        </Button>
        <Button
          variant="outline"
          className="justify-start h-12"
          onClick={() => {
            setEndShiftPrintOpen(false);
            setRejectsPrintOpen(true);
          }}
        >
          <Ban className="h-4 w-4 mr-2" />
          Rejects
        </Button>
        <Button
          variant="outline"
          className="justify-start h-12"
          onClick={() => {
            setEndShiftPrintOpen(false);
            setDeliveryPrintOpen(true);
          }}
        >
          <Truck className="h-4 w-4 mr-2" />
          Delivery
        </Button>
        <Button
          variant="outline"
          className="justify-start h-12"
          onClick={() => {
            setEndShiftPrintOpen(false);
            setFnbPrintOpen(true);
          }}
        >
          <List className="h-4 w-4 mr-2" />
          F&amp;B Linen
        </Button>
          </>
        )}
        <Button
          variant="outline"
          className="justify-start h-12"
          onClick={() => {
            setEndShiftPrintOpen(false);
            setMaintenancePrintOpen(true);
          }}
        >
          <Wrench className="h-4 w-4 mr-2" />
          Maintenance
        </Button>
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="ghost" onClick={() => setEndShiftPrintOpen(false)}>
          Done
        </Button>
      </div>
    </DialogContent>
  </Dialog>

  <RoomStatusPrintDialog
    open={roomStatusPrintOpen}
    onOpenChange={setRoomStatusPrintOpen}
    snapshots={snapshots}
    liveRows={computeRoomStatus().rows}
    printRoomStatus={printRoomStatus}
    onBack={() => {
      setRoomStatusPrintOpen(false);
      setEndShiftPrintOpen(true);
    }}
  />
  <LinenCountPrintDialog
    open={linenPrintOpen}
    onOpenChange={setLinenPrintOpen}
    snapshots={snapshots}
    liveRows={computeTotals().rows}
    linenDeliveryDays={linenDeliveryDays}
    printTotals={(rows, grand, when, subheading, footer) =>
      printTotals(rows, grand, when, "totals", subheading, footer)
    }
    onBack={() => {
      setLinenPrintOpen(false);
      setEndShiftPrintOpen(true);
    }}
  />
  <SnapshotPrintDialog
    open={rejectsPrintOpen}
    onOpenChange={setRejectsPrintOpen}
    snapshots={snapshots}
    kind="rejects"
    title="Rejects"
    liveRows={computeRejectTotals().rows}
    printTotals={(rows, grand, when, footer) =>
      printTotals(rows, grand, when, "rejects", undefined, footer)
    }
    onBack={() => {
      setRejectsPrintOpen(false);
      setEndShiftPrintOpen(true);
    }}
  />
  <SnapshotPrintDialog
    open={deliveryPrintOpen}
    onOpenChange={setDeliveryPrintOpen}
    snapshots={snapshots}
    kind="delivery"
    title="Delivery"
    liveRows={computeDeliveryTotals().rows}
    printTotals={(rows, grand, when, footer) =>
      printTotals(rows, grand, when, "delivery", undefined, footer)
    }
    onBack={() => {
      setDeliveryPrintOpen(false);
      setEndShiftPrintOpen(true);
    }}
  />
  <SnapshotPrintDialog
    open={fnbPrintOpen}
    onOpenChange={setFnbPrintOpen}
    snapshots={snapshots}
    kind="fnb_totals"
    title="F&B Linen"
    liveRows={computeFnbTotals().rows}
    printTotals={(rows, grand, when, footer) =>
      printTotals(rows, grand, when, "fnb_totals", undefined, footer)
    }
    onBack={() => {
      setFnbPrintOpen(false);
      setEndShiftPrintOpen(true);
    }}
  />
  <MaintenancePrintDialog
    open={maintenancePrintOpen}
    onOpenChange={setMaintenancePrintOpen}
    requests={maintenanceRequests}
    locationLabel={maintenanceLocation}
    printJobs={(title, subheading, rows, showCompleted) =>
      Exp.printMaintenanceJobs(hotelName, title, subheading, rows, showCompleted)
    }
    onBack={() => {
      setMaintenancePrintOpen(false);
      setEndShiftPrintOpen(true);
    }}
  />

  {/* Linen list dialog */}
  <LinenListDialog
    templateOpen={templateOpen}
    setTemplateOpen={setTemplateOpen}
    realIsAdmin={realIsAdmin}
    realIsManager={realIsManager}
    hasHousekeeperRole={hasHousekeeperRole}
    hasFnbRole={hasFnbRole}
    isFnb={isFnb}
    linenListType={linenListType}
    setLinenListType={setLinenListType}
    templateAll={templateAll}
    theme={theme}
    newTemplateName={newTemplateName}
    setNewTemplateName={setNewTemplateName}
    addTemplateItem={addTemplateItem}
    editItemSheetId={editItemSheetId}
    setEditItemSheetId={setEditItemSheetId}
    editingItemId={editingItemId}
    setEditingItemId={setEditingItemId}
    editingItemName={editingItemName}
    setEditingItemName={setEditingItemName}
    renameTemplateItem={renameTemplateItem}
    setTemplateDefault={setTemplateDefault}
    setTemplateColor={setTemplateColor}
    moveTemplateItem={moveTemplateItem}
    deleteTemplateItem={deleteTemplateItem}
  />

  {/* Notes sheet (User/Admin + Reception) */}
  <RoomNotesSheet
    notesSheetRoom={notesSheetRoom}
    setNotesSheetRoom={setNotesSheetRoom}
    rooms={rooms}
    activeMessagesByRoom={activeMessagesByRoom}
    canUseMessages={canUseMessages}
    isReception={isReception}
    setMessagesInitial={setMessagesInitial}
    setMessagesSheetOpen={setMessagesSheetOpen}
    setRoomEarlyCheckIn={setRoomEarlyCheckIn}
    setRoomGuestVacated={setRoomGuestVacated}
    setRoomStayoverOut={setRoomStayoverOut}
    confirmHousekeepingNote={confirmHousekeepingNote}
    setRoomHousekeepingNote={setRoomHousekeepingNote}
    deleteRoomMessage={deleteRoomMessage}
    newMessageText={newMessageText}
    setNewMessageText={setNewMessageText}
    submitRoomMessage={submitRoomMessage}
    confirmRoomMessage={confirmRoomMessage}
    dismissRoomMessage={dismissRoomMessage}
  />

 {/* Reception sheet (Admin/User): Done + Status + Bed */}
  <ReceptionStatusSheet
    receptionSheetRoom={receptionSheetRoom}
    setReceptionSheetRoom={setReceptionSheetRoom}
    rooms={rooms}
    receptionStatuses={receptionStatuses}
    receptionBeds={receptionBeds}
    parseCats={parseCats}
    isReception={isReception}
    isAdmin={isAdmin}
    housekeepingDoneSet={new Set(rooms.filter((r) => r.done).map((r) => r.room_number))}
    receptionDoneSet={receptionDoneSet}
    nrOnRooms={nrOnRooms}
    qc={qc}
    dndFileInputRef={dndFileInputRef}
    setRoomGuestVacated={setRoomGuestVacated}
    setRoomStayoverOut={setRoomStayoverOut}
    setQuickReceptionOpen={setQuickReceptionOpen}
    setStayoverPhotosRoomFilter={setStayoverPhotosRoomFilter}
    setStayoverPhotosOpen={setStayoverPhotosOpen}
    toggleReceptionDone={toggleReceptionDone}
    toggleHousekeepingDone={toggleHousekeepingDone}
    setRoomReceptionStatus={setRoomReceptionStatus}
    setRoomReceptionBed={setRoomReceptionBed}
    setRoomNotRequired={setRoomNotRequired}
    deleteTodayStayoverPhotosForRoom={deleteTodayStayoverPhotosForRoom}
    setPendingDndRoom={setPendingDndRoom}
  />

{/* App menu sheet (burger) */}
{authUser && (() => {
  // Map (position, subRoles) → the notification-visibility bucket:
  //   "admin"     → see all toggles
  //   "reception" → hide the housekeeping "marked done" toggle
  //   "user"      → hide the reception message/checkout toggles
  let bucket: "admin" | "user" | "reception" | "maintenance" = "admin";
  if (authUser.position === "developer" || authUser.position === "regional_admin" || authUser.position === "admin" || authUser.position === "manager") bucket = "admin";
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
  onReply={(item) => {
    setLostPropertyOpen(false);
    setMessagesInitial({
      thread: "hk_reception",
      room: item.roomNumber,
      replyTo: {
        id: item.id,
        sender: item.sender ?? "Housekeeping",
        snippet: item.message.slice(0, 280),
      },
    });
    setMessagesSheetOpen(true);
  }}
/>
<BroomBurst
  active={broomBurstActive}
  onDone={() => setBroomBurstActive(false)}
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
            "w-full flex items-center gap-3 rounded-xl border bg-background px-4 min-h-12 text-sm font-medium shadow-elevation-1 transition-[transform,box-shadow,background-color] duration-150 hover:bg-accent active:scale-[0.985] active:shadow-none",
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
          {menuGroups.map((group) => (
            <Section key={group.id} id={group.id} title={group.title}>
              {group.items.map((item) => (
                <Row
                  key={item.key}
                  icon={item.icon}
                  label={item.label}
                  destructive={item.destructive}
                  onClick={() => { close(); item.onClick(); }}
                />
              ))}
            </Section>
          ))}
        </div>
      );
    })()}
    </div>
  </SheetContent>
</Sheet>

{/* History sheet (Admin) */}
{/* Hotel switcher sheet */}
<Sheet open={hotelSwitcherOpen} onOpenChange={setHotelSwitcherOpen}>
  <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl p-4 sm:p-6">
    <SheetHeader className="text-left">
      <SheetTitle>Switch hotel</SheetTitle>
      <SheetDescription>Choose which hotel workspace to work in.</SheetDescription>
    </SheetHeader>
    <div className="mt-4 grid gap-2">
      {availableHotels.map((h) => {
        const active = currentHotelQ.data?.id === h.id;
        return (
          <Button
            key={h.id}
            variant={active ? "default" : "outline"}
            size="lg"
            className="justify-start h-12"
            disabled={active || switchingHotelId !== null}
            onClick={() => void switchHotel(h.id)}
          >
            <span className="flex-1 text-left">{h.name}</span>
            {active && <Check className="h-4 w-4 ml-2" />}
            {switchingHotelId === h.id && <span className="text-xs ml-2">Switching…</span>}
          </Button>
        );
      })}
    </div>
    {realIsAdmin && (
      <div className="mt-6 border-t pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Create new hotel workspace
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="Hotel name"
            value={newHotelName}
            onChange={(e) => setNewHotelName(e.target.value)}
            disabled={creatingHotel}
          />
          <Button
            type="button"
            disabled={creatingHotel || newHotelName.trim().length < 2}
            onClick={async () => {
              setCreatingHotel(true);
              try {
                await createHotelFn({ data: { name: newHotelName.trim() } });
                setNewHotelName("");
                await qc.invalidateQueries({ queryKey: ["my-hotels"] });
                toast.success("Hotel created");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed to create hotel");
              } finally {
                setCreatingHotel(false);
              }
            }}
          >
            {creatingHotel ? "Creating…" : "Create"}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Only admins and regional managers can create hotel workspaces.
        </p>
      </div>
    )}
  </SheetContent>
</Sheet>

<MaintenanceLogSheet
  open={maintenanceLogOpen}
  onOpenChange={setMaintenanceLogOpen}
  rooms={rooms}
  maintenanceRequests={maintenanceRequests}
  maintenanceAreas={maintenanceAreas}
  canManageAreas={isAdmin}
  onManageAreas={() => setMaintenanceAreasOpen(true)}
  hasOpenMaintenance={hasOpenMaintenance}
  openMaintenanceCount={openMaintenanceCount}
  isReception={isReception}
  isMaintenance={isMaintenance}
  isAdmin={isAdmin}
  authUsername={authUser?.username}
  maintenanceComposerOpen={maintenanceComposerOpen}
  setMaintenanceComposerOpen={setMaintenanceComposerOpen}
  newMaintenanceRoom={newMaintenanceRoom}
  setNewMaintenanceRoom={setNewMaintenanceRoom}
  newMaintenanceText={newMaintenanceText}
  setNewMaintenanceText={setNewMaintenanceText}
  newMaintenancePhotos={newMaintenancePhotos}
  setNewMaintenancePhotos={setNewMaintenancePhotos}
  submitMaintenanceRequest={submitMaintenanceRequest}
  markMaintenanceDone={markMaintenanceDone}
  deleteMaintenanceRequest={deleteMaintenanceRequest}
  setMaintenancePhotoPaths={setMaintenancePhotoPaths}
/>

<MaintenanceAreasSheet
  open={maintenanceAreasOpen}
  onOpenChange={setMaintenanceAreasOpen}
  areas={maintenanceAreas}
  addArea={addMaintenanceArea}
  deleteArea={deleteMaintenanceArea}
/>

<HistorySheet
  open={historySheetOpen}
  onOpenChange={setHistorySheetOpen}
  snapshots={snapshots}
  isFnb={isFnb}
  setViewingSnapshot={setViewingSnapshot}
  removeSnapshot={removeSnapshot}
  clearAllSnapshots={clearAllSnapshots}
/>

<EditRoomDefaultsSheet
   editDefaultsSheetRoom={editDefaultsSheetRoom}
   setEditDefaultsSheetRoom={setEditDefaultsSheetRoom}
   template={template}
   isAssigned={isAssigned}
   toggleAssignment={toggleAssignment}
 />

 {/* Room Types sheet (Admin) */}
  <RoomTypesSheet
    open={roomTypesSheetOpen}
    onOpenChange={setRoomTypesSheetOpen}
    roomTypes={roomTypes}
    onMove={moveRoomType}
    onRename={renameRoomType}
    onDelete={deleteRoomType}
    onAdd={() => setAddRoomTypeOpen(true)}
  />

  {/* Room Features sheet (Admin) */}
  <RoomFeaturesSheet
    open={roomFeaturesSheetOpen}
    onOpenChange={setRoomFeaturesSheetOpen}
    roomFeatures={roomFeatures}
    onMove={moveRoomFeature}
    onRename={renameRoomFeature}
    onDelete={deleteRoomFeature}
    onAdd={() => setAddRoomFeatureOpen(true)}
  />

  {/* Reception items sheet (Admin) */}
  <ReceptionItemsSheet
    open={receptionItemsSheetOpen}
    onOpenChange={setReceptionItemsSheetOpen}
    statuses={receptionStatuses}
    beds={receptionBeds}
    onMove={moveReceptionItem}
    onRename={renameReceptionItem}
    onDelete={deleteReceptionItem}
    onAddStatus={() => setAddReceptionItemKind("status")}
    onAddBed={() => setAddReceptionItemKind("bed")}
  />

  {/* Edit room sheet (Admin) */}
<EditRoomSheet
    editRoomSheetNumber={editRoomSheetNumber}
    setEditRoomSheetNumber={setEditRoomSheetNumber}
    rooms={rooms}
    roomTypes={roomTypes}
    receptionStatuses={receptionStatuses}
    roomFeatures={roomFeatures}
    roomFeatureAssignments={roomFeatureAssignments}
    parseCats={parseCats}
    toggleRoomCategory={toggleRoomCategory}
    setRoomDefaultStatus={setRoomDefaultStatus}
    toggleRoomFeature={toggleRoomFeature}
  />

  {/* Add / config dialogs (room types, features, reception items, icon guide) */}
  <AddConfigDialogs
    addRoomTypeOpen={addRoomTypeOpen}
    setAddRoomTypeOpen={setAddRoomTypeOpen}
    newRoomTypeLabel={newRoomTypeLabel}
    setNewRoomTypeLabel={setNewRoomTypeLabel}
    addRoomType={addRoomType}
    addRoomFeatureOpen={addRoomFeatureOpen}
    setAddRoomFeatureOpen={setAddRoomFeatureOpen}
    newRoomFeatureLabel={newRoomFeatureLabel}
    setNewRoomFeatureLabel={setNewRoomFeatureLabel}
    addRoomFeature={addRoomFeature}
    addReceptionItemKind={addReceptionItemKind}
    setAddReceptionItemKind={setAddReceptionItemKind}
    newReceptionItemLabel={newReceptionItemLabel}
    setNewReceptionItemLabel={setNewReceptionItemLabel}
    addReceptionItem={addReceptionItem}
    receptionHelpOpen={receptionHelpOpen}
    setReceptionHelpOpen={setReceptionHelpOpen}
  />


 {/* Rejects dialog */}
  <RejectsDialog
    open={rejectsOpen}
    onOpenChange={(o) => {
      setRejectsOpen(o);
      if (o) qc.invalidateQueries({ queryKey: ["reject_counts"] });
    }}
    template={template}
    theme={theme}
    total={rejects.reduce((s, r) => s + r.count, 0)}
    getRejectCount={getRejectCount}
    updateRejectCount={updateRejectCount}
    onResetAll={resetRejects}
    onExport={openRejectExport}
  />

  {/* Delivery counter dialog — number entry for large delivery batches. */}
  <DeliveryDialog
    open={deliveryOpen}
    onOpenChange={(o) => {
      setDeliveryOpen(o);
      if (o) qc.invalidateQueries({ queryKey: ["delivery_counts"] });
    }}
    template={template}
    theme={theme}
    total={deliveryCounts.reduce((s, r) => s + r.count, 0)}
    getDeliveryCount={getDeliveryCount}
    setDeliveryCount={setDeliveryCount}
    onResetAll={resetDeliveryCounts}
    onExport={() => void openDeliveryExport()}
  />

  {/* Manage Rooms dialogs (Admin) */}
  <ManageRoomsDialogs
    manageRoomsOpen={manageRoomsOpen}
    setManageRoomsOpen={setManageRoomsOpen}
    addRoomConfirmOpen={addRoomConfirmOpen}
    setAddRoomConfirmOpen={setAddRoomConfirmOpen}
    rooms={rooms}
    newRoomNumber={newRoomNumber}
    setNewRoomNumber={setNewRoomNumber}
    setRoomTypesSheetOpen={setRoomTypesSheetOpen}
    setRoomFeaturesSheetOpen={setRoomFeaturesSheetOpen}
    setReceptionItemsSheetOpen={setReceptionItemsSheetOpen}
    setEditRoomSheetNumber={setEditRoomSheetNumber}
    addRoom={addRoom}
    removeRoom={removeRoom}
    moveRoom={moveRoom}
  />

 {/* Rooms */}
 {isMaintenance ? (
<MaintenanceDashboard
     maintenanceRequests={maintenanceRequests}
     roomMessages={roomMessages}
     openMaintenanceCount={openMaintenanceCount}
     markMaintenanceDone={markMaintenanceDone}
     qc={qc}
     setMessagesInitial={setMessagesInitial}
     setMessagesSheetOpen={setMessagesSheetOpen}
   />
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
       <ul className="divide-y border rounded-xl bg-muted/30">
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
 <div className="relative flex items-center justify-between">
 <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
 Rooms
 </h2>
     {isReception && (() => {
          const totalSelected =
            receptionFeatureFilter.length +
            receptionStatusFilter.length +
            receptionRoomTypeFilter.length +
            (receptionDoneOnlyFilter ? 1 : 0);
         const statusFilterLabels: string[] = ["Stayover", "Arrival", "Dirty", "Clean"];
         const statusFilterOptions = statusFilterLabels
           .map((label) => {
             const match = receptionStatuses.find(
               (s) => s.label.toLowerCase() === label.toLowerCase(),
             );
             return match ? { id: match.id, label } : null;
           })
           .filter((v): v is { id: string; label: string } => v !== null);
          const doneOnlyCount = rooms.filter((r) => r.done_reception || r.done).length;
          const statusCountFor = (statusId: string) =>
            rooms.filter(
              (r) => (r.reception_status_id ?? r.default_status) === statusId,
            ).length;
          const roomTypeCountFor = (val: string) =>
            rooms.filter((r) => parseCats(r.category).includes(val as Category)).length;
          const featureCountFor = (featureId: string) =>
            new Set(
              roomFeatureAssignments
                .filter((a) => a.feature_id === featureId)
                .map((a) => a.room_number),
            ).size;
          const clearAllFilters = () => {
            setReceptionFeatureFilter([]);
            setReceptionStatusFilter([]);
            setReceptionRoomTypeFilter([]);
            setReceptionDoneOnlyFilter(false);
          };
       return (
          <div className="absolute left-1/2 -translate-x-1/2 inline-flex items-center rounded-lg border border-input bg-background shadow-sm overflow-hidden">
        <Popover open={filtersSheetOpen} onOpenChange={setFiltersSheetOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 gap-1.5 text-xs font-medium rounded-none border-0 px-3 ${totalSelected > 0 ? "border-r border-input" : ""}`}
            >
              <Filter className="h-3.5 w-3.5" />
              {totalSelected === 0 ? "Filters" : `Filters · ${totalSelected}`}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="center" className="w-72 max-h-[70dvh] overflow-y-auto p-3">
            <div className="space-y-1 pb-2">
              <p className="text-sm font-semibold">Filters</p>
              <p className="text-xs text-muted-foreground">
                {totalSelected === 0 ? "Filter rooms by housekeeping and features." : `${totalSelected} active`}
              </p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Housekeeping</p>
                <label className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted cursor-pointer">
                  <Checkbox
                    checked={receptionDoneOnlyFilter}
                    onCheckedChange={(c) => setReceptionDoneOnlyFilter(!!c)}
                  />
                  <span className="text-sm flex-1">Only show rooms marked done</span>
                   <span className="text-xs text-muted-foreground tabular-nums">{doneOnlyCount}</span>
                </label>
              </div>
              {statusFilterOptions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</p>
                  <div className="grid gap-1">
                    {statusFilterOptions.map((s) => {
                      const checked = receptionStatusFilter.includes(s.id);
                       const count = statusCountFor(s.id);
                      return (
                        <label
                          key={s.id}
                          className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted cursor-pointer"
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
                           <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
                {roomTypes.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Room type</p>
                    <div className="grid gap-1">
                      {roomTypes.map((rt) => {
                        const checked = receptionRoomTypeFilter.includes(rt.value);
                         const count = roomTypeCountFor(rt.value);
                        return (
                          <label
                            key={rt.id}
                            className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted cursor-pointer"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(c) => {
                                setReceptionRoomTypeFilter((prev) =>
                                  c ? [...prev, rt.value] : prev.filter((v) => v !== rt.value),
                                );
                              }}
                            />
                            <span className="text-sm flex-1">{rt.label}</span>
                             <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
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
                         const count = featureCountFor(f.id);
                        return (
                          <label
                            key={f.id}
                            className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted cursor-pointer"
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
                             <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
          {totalSelected > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs rounded-none border-0 px-3 text-muted-foreground hover:text-foreground"
              onClick={clearAllFilters}
              aria-label="Clear filters"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
          </div>
      );
    })()}
    {!isReception && (
     (() => {
        // Compute per-room primary status bucket for HK filter counts.
        const statusLabelById = new Map(
          receptionStatuses.map((s) => [s.id, s.label.toLowerCase()]),
        );
        const bucketFor = (n: number): string => {
          const r = rooms.find((x) => x.room_number === n);
          if (!r) return "not_started";
          if (nrOnRooms.has(n)) return "nr";
          const sid = r.reception_status_id ?? r.default_status;
          const label = sid ? (statusLabelById.get(sid) ?? "") : "";
          if (label === "staff") return "staff";
          if (label === "ros") return "ros";
          if (label === "dnd") return "dnd";
          if (label === "stayover") return "stayover";
          if (label === "arrival") return "arrival";
          if (label === "dirty") return "dirty";
          if (label === "clean") return "clean";
          if (label) return "progress";
          const hasLinen = counts.some((c) => c.room_number === n && (c.count ?? 0) > 0);
          if (hasLinen) return "progress";
          return "not_started";
        };
        const isRoomDone = (n: number) => doneSet.has(n) || receptionDoneSet.has(n);
        const roomBuckets = rooms.map((r) => ({
          n: r.room_number,
          bucket: bucketFor(r.room_number),
          done: isRoomDone(r.room_number),
        }));
        const statusOptions: { key: string; label: string }[] = [
          { key: "done", label: "Done" },
          { key: "not_started", label: "Not started" },
          { key: "progress", label: "In progress" },
          { key: "dirty", label: "Dirty" },
          { key: "clean", label: "Clean" },
          { key: "arrival", label: "Arrival" },
          { key: "stayover", label: "Stayover" },
          { key: "staff", label: "Staff" },
          { key: "ros", label: "ROS" },
        ];
        const countFor = (key: string) =>
          key === "done"
            ? roomBuckets.filter((r) => r.done).length
            : key === "stayover"
            ? roomBuckets.filter((r) => r.bucket === "stayover" || r.bucket === "dnd" || r.bucket === "nr").length
            : roomBuckets.filter((r) => r.bucket === key).length;
        const totalActive = hkStatusFilter.length + (hideCompletedRooms ? 1 : 0);
        const clearHkFilters = () => {
          setHkStatusFilter([]);
          setHideCompletedRooms(false);
        };
        return (
          <div className="absolute left-1/2 -translate-x-1/2 inline-flex items-center rounded-lg border border-input bg-background shadow-sm overflow-hidden">
            {(() => {
              const triggerBtn = (
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-8 gap-1.5 text-xs font-medium rounded-none border-0 px-3 ${totalActive > 0 ? "border-r border-input" : ""}`}
                >
                  <Filter className="h-3.5 w-3.5" />
                  {totalActive === 0 ? "Filters" : `Filters · ${totalActive}`}
                </Button>
              );
              const body = (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Visibility</p>
                    <label className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted cursor-pointer">
                      <Checkbox
                        checked={hideCompletedRooms}
                        onCheckedChange={(c) => setHideCompletedRooms(!!c)}
                      />
                      <span className="text-sm flex-1">Hide completed rooms</span>
                    </label>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</p>
                    <div className="grid gap-1">
                      {statusOptions.map((s) => {
                        const checked = hkStatusFilter.includes(s.key);
                        const count = countFor(s.key);
                        return (
                          <label
                            key={s.key}
                            className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted cursor-pointer"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(c) => {
                                setHkStatusFilter((prev) =>
                                  c ? [...prev, s.key] : prev.filter((k) => k !== s.key),
                                );
                              }}
                            />
                            <span className="text-sm flex-1">{s.label}</span>
                            <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
              return isMobile ? (
                <Sheet open={hkFiltersOpen} onOpenChange={setHkFiltersOpen}>
                  <SheetTrigger asChild>{triggerBtn}</SheetTrigger>
                  <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl p-4 sm:p-6">
                    <SheetHeader className="text-left px-0">
                      <SheetTitle>Filter rooms</SheetTitle>
                      <SheetDescription>
                        {totalActive === 0 ? "Filter by status. Select multiple." : `${totalActive} active`}
                      </SheetDescription>
                    </SheetHeader>
                    <div className="pt-2">{body}</div>
                  </SheetContent>
                </Sheet>
              ) : (
                <Popover open={hkFiltersOpen} onOpenChange={setHkFiltersOpen}>
                  <PopoverTrigger asChild>{triggerBtn}</PopoverTrigger>
                  <PopoverContent align="center" className="w-64 max-h-[70dvh] overflow-y-auto p-3">
                    <div className="space-y-1 pb-2">
                      <p className="text-sm font-semibold">Filter rooms</p>
                      <p className="text-xs text-muted-foreground">
                        {totalActive === 0 ? "Filter by status. Select multiple." : `${totalActive} active`}
                      </p>
                    </div>
                    {body}
                  </PopoverContent>
                </Popover>
              );
            })()}
            {totalActive > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs rounded-none border-0 px-3 text-muted-foreground hover:text-foreground"
                onClick={clearHkFilters}
                aria-label="Clear filters"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </div>
        );
      })()
    )}
    {!isReception && (
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 rounded-lg text-xs font-medium shadow-sm"
        onClick={resetAll}
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Reset all
      </Button>
   )}
    {isReception && (() => {
      // Reception can reset their own selections (status/bed) once per day
      // after 7am, but only if Housekeeping hasn't already done a full reset.
      const now = new Date();
      if (now.getHours() < 7) return null;
      const hkResetIso = currentHotelQ.data?.last_hk_reset_at ?? null;
      if (hkResetIso) {
        const hk = new Date(hkResetIso);
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        if (hk.getTime() >= startOfToday.getTime()) return null;
      }
      return (
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 rounded-lg text-xs font-medium shadow-sm"
          onClick={resetReceptionAll}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset all
        </Button>
      );
    })()}
 </div>

 {/* On-screen interactive accordion */}
 <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8 xl:grid-cols-10 gap-2 md:gap-3">
 {(() => {
  const allRooms = rooms.map((r) => r.room_number);
    let visibleRooms = (isReception && (receptionFeatureFilter.length > 0 || receptionStatusFilter.length > 0 || receptionRoomTypeFilter.length > 0 || receptionDoneOnlyFilter))
    ? allRooms.filter((n) => {
         const rd = rooms.find((x) => x.room_number === n);
         if (receptionDoneOnlyFilter) {
           // Reception considers a room "done" if reception has confirmed it,
           // OR housekeeping has marked it done. Previously this only checked
           // `done` which missed rooms reception had just confirmed.
           if (!(rd?.done_reception || rd?.done)) return false;
         }
         if (receptionRoomTypeFilter.length > 0) {
           const cats = parseCats(rd?.category);
           if (!receptionRoomTypeFilter.some((v) => cats.includes(v as Category))) return false;
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
   if (!isReception && hideCompletedRooms) {
     // On the housekeeping view, the tile's "done" indicator is driven by the
     // union of r.done and r.done_reception (see room-tile state calc + shift-
     // complete metric). Match that here so the filter hides everything the
     // user visually recognises as completed.
     visibleRooms = visibleRooms.filter(
       (n) => !doneSet.has(n) && !receptionDoneSet.has(n),
     );
   }
    if (!isReception && hkStatusFilter.length > 0) {
      const statusLabelById2 = new Map(
        receptionStatuses.map((s) => [s.id, s.label.toLowerCase()]),
      );
      const bucketForRoom = (n: number): string => {
        const r = rooms.find((x) => x.room_number === n);
        if (!r) return "not_started";
        if (nrOnRooms.has(n)) return "nr";
        const sid = r.reception_status_id ?? r.default_status;
        const label = sid ? (statusLabelById2.get(sid) ?? "") : "";
        if (label === "staff") return "staff";
        if (label === "ros") return "ros";
        if (label === "dnd") return "dnd";
        if (label === "stayover") return "stayover";
        if (label === "arrival") return "arrival";
        if (label === "dirty") return "dirty";
        if (label === "clean") return "clean";
        if (label) return "progress";
        const hasLinen = counts.some((c) => c.room_number === n && (c.count ?? 0) > 0);
        if (hasLinen) return "progress";
        return "not_started";
      };
      visibleRooms = visibleRooms.filter((n) => {
        const bucket = bucketForRoom(n);
        const isDone = doneSet.has(n) || receptionDoneSet.has(n);
        return hkStatusFilter.some((k) => {
          if (k === "done") return isDone;
          if (k === "stayover") return bucket === "stayover" || bucket === "dnd" || bucket === "nr";
          return k === bucket;
        });
      });
    }
  const nodes: React.ReactNode[] = [];
    const statusIds = resolveRoomStatusIds(receptionStatuses);
    // Index rooms/counts once instead of scanning the arrays per tile.
    const roomByNumber = new Map<number, Room>();
    for (const r of rooms) roomByNumber.set(r.room_number, r);
    const countedRooms = new Set<number>();
    for (const c of counts) if ((c.count ?? 0) > 0) countedRooms.add(c.room_number);
   for (let i = 0; i < visibleRooms.length; i++) {
   const n = visibleRooms[i];
 const done = doneSet.has(n);
 const isOpen = openRoom === n;
   const room = roomByNumber.get(n);
   const hasLinenCount = countedRooms.has(n);
   const isNR = nrOnRooms.has(n);
   if (isReception) {
     nodes.push(
       <ReceptionRoomTile
         key={`r-${n}`}
         n={n}
         room={room}
         statusIds={statusIds}
         state={getRoomTileState(n, hkDoneSet.has(n))}
         isNR={isNR}
         hasLinenCount={hasLinenCount}
         isOpen={isOpen}
         hasMessage={hasActiveMessage(n)}
         onClick={() => openOrToggle(n)}
       />,
     );
   } else {
     nodes.push(
       <HousekeepingRoomTile
         key={`r-${n}`}
         n={n}
         room={room}
         statusIds={statusIds}
         state={getRoomTileState(n, done)}
         isNR={isNR}
         hasLinenCount={hasLinenCount}
         isOpen={isOpen}
         hasMessage={hasActiveMessage(n)}
         onClick={() => openOrToggle(n)}
         done={done}
       />,
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
                  const dndId = receptionStatuses.find((s) => s.label.toLowerCase() === "dnd")?.id ?? null;
                  const statusLabelById = new Map(
                    receptionStatuses.map((s) => [s.id, s.label.toLowerCase()]),
                  );
                  const excludedProgressStatuses = new Set(["staff", "ros", "staff/ros", "ros - staff"]);
                  const eligible = rooms.filter((r) => {
                    const sid = r.reception_status_id ?? r.default_status;
                    const statusLabel = sid ? (statusLabelById.get(sid) ?? sid).toLowerCase() : "";
                     if (excludedProgressStatuses.has(statusLabel)) return false;
                     if (dndId && sid === dndId) return false;
                     return true;
                  });
                 const total = eligible.length;
                 const progress = eligible.filter((r) => r.done || r.done_reception).length;
                const pct = total > 0 ? Math.min(100, (progress / total) * 100) : 0;
                const isComplete = total > 0 && progress >= total;
                 return (
                      <div className="mt-3 space-y-2 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-40 max-lg:mt-0 max-lg:border-t max-lg:border-border max-lg:bg-background/95 max-lg:backdrop-blur max-lg:pl-[calc(env(safe-area-inset-left,0px)+1.5rem)] max-lg:pr-[calc(env(safe-area-inset-right,0px)+1.5rem)] max-lg:pt-3 max-lg:pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
                    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        {isComplete ? (
                          <Check className="h-3.5 w-3.5 text-room-complete-accent" />
                        ) : (
                          <House className="h-3.5 w-3.5" />
                        )}
                        Rooms progress
                      </span>
                      <span className="tabular-nums">{progress} of {total}</span>
                    </div>
                    <div
                      role="button"
                      tabIndex={-1}
                      onClick={handleProgressTap}
                      className="relative h-5 w-full overflow-hidden rounded-full bg-muted shadow-elevation-1 cursor-pointer select-none active:scale-[0.99] transition-transform"
                    >
                      <div
                        className={cn(
                          "h-full rounded-full transition-[width,background-color] duration-300 shadow-elevation-1",
                          isComplete && "bg-room-complete",
                        )}
                        style={{
                          width: `${pct}%`,
                          backgroundColor: isComplete
                            ? undefined
                            : pct < 30
                              ? "var(--color-room-todo)"
                              : pct < 70
                                ? "var(--color-room-progress)"
                                : pct < 100
                                  ? "var(--color-room-done)"
                                  : "var(--color-room-complete)",
                        }}
                      />
                      {isComplete && (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-bold uppercase tracking-widest text-room-complete-fg">
                          Complete
                        </div>
                      )}
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
   <SheetContent side="bottom" className="h-[90dvh] max-h-[90dvh] flex flex-col overflow-hidden rounded-t-2xl p-4 sm:p-6">
     <SheetHeader className="text-left space-y-0">
       <SheetTitle>Room {openRoom} — {categoryLabel(roomCategory(openRoom ?? 0), roomTypes)}</SheetTitle>
      {(() => {
        if (openRoom === null) return null;
        const r = rooms.find((x) => x.room_number === openRoom);
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
        const cats = parseCats(r?.category).map(norm);
        const onlyDouble = cats.includes("double") && !cats.includes("superking");
        const bedLabel =
          receptionBeds.find((b) => b.id === r?.reception_bed_id)?.label ??
          (onlyDouble ? "Double" : null);
        if (!bedLabel) return null;
        return (
          <SheetDescription className="mt-0.5">Bed: {bedLabel}</SheetDescription>
        );
      })()}
     </SheetHeader>
     <div className="flex flex-col flex-1 min-h-0 mt-3">
       {openRoom !== null && renderRoomPanel(openRoom)}
     </div>
   </SheetContent>
 </Sheet>

  <ExportPreviewDialogs
    exportOpen={exportOpen}
    setExportOpen={setExportOpen}
    template={template}
    extras={extras}
    counts={counts}
    roomStatusExportOpen={roomStatusExportOpen}
    setRoomStatusExportOpen={setRoomStatusExportOpen}
    computeRoomStatus={computeRoomStatus}
    printRoomStatus={printRoomStatus}
    rejectExportOpen={rejectExportOpen}
    setRejectExportOpen={setRejectExportOpen}
    computeRejectTotals={computeRejectTotals}
    confirmOverwrite={confirmOverwrite}
    setConfirmOverwrite={setConfirmOverwrite}
    proceedExport={proceedExport}
    printTotals={printTotals}
  />

  <SnapshotViewerDialog
    viewingSnapshot={viewingSnapshot}
    setViewingSnapshot={setViewingSnapshot}
    deleteSnapshot={deleteSnapshot}
    printTotals={printTotals}
  />
  <AccountDialog
    open={accountOpen}
    onOpenChange={setAccountOpen}
    currentUsername={authUser?.username ?? ""}
    onUsernameChanged={(u) => setAuthUser((prev) => prev ? { ...prev, username: u } : prev)}
  />
  <UsersDialog open={usersOpen} onOpenChange={setUsersOpen} />
  <Sheet open={linenDeliveryOpen} onOpenChange={setLinenDeliveryOpen}>
    <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl p-4 sm:p-6">
      <SheetHeader className="text-left">
        <SheetTitle>Linen delivery days</SheetTitle>
        <SheetDescription>
          Pick the days your linen delivery arrives. The "Ranged Linen Totals"
          print adds up the daily linen totals for the period between your two
          most recent delivery days.
        </SheetDescription>
      </SheetHeader>
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { d: 1, label: "Monday" },
          { d: 2, label: "Tuesday" },
          { d: 3, label: "Wednesday" },
          { d: 4, label: "Thursday" },
          { d: 5, label: "Friday" },
          { d: 6, label: "Saturday" },
          { d: 0, label: "Sunday" },
        ].map(({ d, label }) => {
          const active = linenDeliveryDays.includes(d);
          return (
            <Button
              key={d}
              variant={active ? "default" : "outline"}
              size="lg"
              className="justify-center h-12"
              disabled={savingDeliveryDays || !currentHotelQ.data?.id}
              onClick={async () => {
                const hotelId = currentHotelQ.data?.id;
                if (!hotelId) return;
                const next = active
                  ? linenDeliveryDays.filter((x) => x !== d)
                  : [...linenDeliveryDays, d].sort((a, b) => a - b);
                setSavingDeliveryDays(true);
                const { error } = await supabase
                  .from("hotels")
                  .update({ linen_delivery_days: next } as never)
                  .eq("id", hotelId);
                setSavingDeliveryDays(false);
                if (error) {
                  toast.error(error.message);
                  return;
                }
                await qc.invalidateQueries({ queryKey: ["current-hotel"] });
              }}
            >
              {label}
              {active && <Check className="h-4 w-4 ml-2" />}
            </Button>
          );
        })}
      </div>
      {linenDeliveryDays.length === 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          No delivery days selected. "Ranged Linen Totals" will fall back to the last 7 days.
        </p>
      )}
    </SheetContent>
  </Sheet>
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
      guest_vacated: r.guest_vacated,
      early_check_in: r.early_check_in,
      stayover_out: r.stayover_out,
    }))}
    statuses={receptionStatuses
      .filter((s) => s.label !== "Staff" && s.label !== "DND")
      .map((s) => ({ id: s.id, label: s.label }))}
    beds={receptionBeds.map((b) => ({ id: b.id, label: b.label }))}
    onChangeStatus={setRoomReceptionStatus}
    onChangeBed={setRoomReceptionBed}
    onResetAll={resetReceptionAll}
  />
 </main>
 );
}
