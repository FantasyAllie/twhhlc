import { toggleRoomTab, roomTileAction, type RoomTab } from "@/lib/room-navigation";
import { NamedAvatar } from "@/components/user-avatar";
import { Textarea } from "@/components/ui/textarea";
import { hasRoomItemSelection } from "@/lib/room-checklist-rules";
import { playDoorBell } from "@/lib/door-bell";
import { createPortal } from "react-dom";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { CountRow } from "@/components/linen/inventory-dialog";
import { Loader2, CalendarDays, Trophy } from "lucide-react";
import { LeaderboardSheet } from "@/components/leaderboard-sheet";
import { RoomFlagsContext, FlagIcon, mergeFlagDefs, useFlagSettingsQuery, useCustomFlagsQuery, type FlagDef } from "@/lib/room-flags";
import { RoomFlagsSheet } from "@/components/rooms/room-flags-sheet";
import { useHomeRefresh } from "@/hooks/use-home-refresh";
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
  useInventoryCountsQuery,
  type InventoryCount,
  useRejectCountsQuery,
  useRoomCountsQuery,
  useRoomExtrasQuery,
  useTemplateItemRoomsQuery,
  useRoomPreferredItemsQuery,
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
import { InventoryDialog, CUPBOARDS, type InventorySection } from "@/components/linen/inventory-dialog";
import { Minus, Plus, X, Menu, ArrowUp, ArrowDown, Pencil, Check, Trash2, Sun, SunDim, Moon, MoonStar, List, Bed, House, Ban, History, Users, User, LogOut, Hash, ConciergeBell, ClipboardList, Printer, Filter, Wrench, DoorOpen, Footprints, Bell, Eye, EyeOff, HelpCircle, AlertCircle, MessageSquare, PackageSearch, RotateCcw, ChevronDown, ChevronRight, Camera, LayoutGrid, Truck, Clock, Dog, Undo2, Inbox, MapPin, Flag } from "lucide-react";
import {
  AccountDialog,
  AddConfigDialogs,
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
import { notifyRoomEvent, notifyMaintenanceRequest, notifyMaintenanceCompleted, type RoomEventKind } from "@/lib/push.functions";
import type { MessagesThread, Department as MessagesDepartment } from "@/components/messages-sheet";
import { PhotoAttachments, PhotoComposer } from "@/components/entry-photos";
import { DndDoorPhoto } from "@/components/dnd-door-photo";
import { RoomInfoTiles } from "@/components/rooms/room-info-tiles";
import { BroomBurst } from "@/components/broom-burst";
import { CelebrationBurst } from "@/components/celebration-burst";
import { areOutcomeAnimationsEnabled } from "@/lib/feedback-prefs";
import { GloomBurst } from "@/components/gloom-burst";
import { playFart } from "@/lib/fart-sound";
import { playSparkle } from "@/lib/sparkle-sound";

import {
  deleteTodayStayoverPhotosForRoom,
  listStayoverPhotos,
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetInlineProvider,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useTheme } from "@/components/theme-provider";
import { armSheetTakeover, isTakeoverReplacing, setSheetTakeoverSlot, releaseSheetTakeover, useSheetTakeoverActive } from "@/components/ui/sheet";
import { Palette } from "lucide-react";
import { ACCENTS, readAccent, applyAccent, type AccentId } from "@/lib/accent-colour";
import { useCurrentHotel, DEFAULT_HOTEL_NAME } from "@/lib/hotels";
import { listHotels, setActiveHotel, createHotel, type HotelOption } from "@/lib/auth.functions";
import { parseCats, categoryLabel, valueFromLabel, maintenanceLocation, COLOR_SWATCHES } from "@/lib/app-format";
import type {
  Category,
  ChecklistSnapshotRow,
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
  RoomPreferredItem,
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
import { buildOpsState, captureOpsSnapshot, undoLastOpsSnapshot } from "@/lib/ops-snapshots";
import { HousekeepingRoomTile, ReceptionRoomTile } from "@/components/rooms/room-tile";

export const Route = createFileRoute("/app")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "The Hotel Hub" },
      { name: "description", content: "Manage rooms, housekeeping, linen and hotel operations in The Hotel Hub." },
      { property: "og:title", content: "Operations — The Hotel Hub" },
      { property: "og:description", content: "Manage rooms, housekeeping, linen and hotel operations in The Hotel Hub." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AppPage,
});

function AppPage() {
 const qc = useQueryClient();
  const navigate = useNavigate();
  const { theme, level, levelLabel, cycleTheme } = useTheme();
  const [accent, setAccent] = useState<AccentId>("brass");
  useEffect(() => { const a = readAccent(); setAccent(a); applyAccent(a); }, []);
  const cycleAccent = () => {
    const next = ACCENTS[(ACCENTS.findIndex((a) => a.id === accent) + 1) % ACCENTS.length].id;
    setAccent(next); applyAccent(next);
  };
  const ThemeGlyph =
    level === "white" ? Sun : level === "cream" ? SunDim : level === "navy" ? Moon : MoonStar;
  const isMobile = useIsMobile();
  // Tablet: gets the mobile layout (tab bar, top bar) but is 768–1023px wide.
  const [isTablet, setIsTablet] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px) and (max-width: 1023px)");
    const update = () => setIsTablet(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
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
  const flagSettingsQ = useFlagSettingsQuery();
  const customFlagsQ = useCustomFlagsQuery();
  const [roomFlagsSheetOpen, setRoomFlagsSheetOpen] = useState(false);
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
    let disposed = false;
    let retryTimer: number | null = null;
    const channel = supabase
      .channel("rooms-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms" },
        (payload) => {
          // Shop door bell when another device marks a guest as checked out.
          // Comparing with the cached row skips this device's own changes
          // (already applied optimistically).
          const next = payload.new as { room_number?: number; guest_vacated?: boolean } | undefined;
          if (payload.eventType === "UPDATE" && next?.guest_vacated) {
            const cached = qc
              .getQueriesData<{ room_number: number; guest_vacated?: boolean }[]>({ queryKey: ["rooms"] })
              .flatMap(([, d]) => (Array.isArray(d) ? d : []))
              .find((r) => r.room_number === next.room_number);
            if (cached && !cached.guest_vacated) playDoorBell();
          }
          qc.invalidateQueries({ queryKey: ["rooms"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_custom_flags" },
        () => {
          qc.invalidateQueries({ queryKey: ["room_custom_flags"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_flag_settings" },
        () => {
          qc.invalidateQueries({ queryKey: ["room_flag_settings"] });
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
        { event: "*", schema: "public", table: "inventory_counts" },
        () => {
          qc.invalidateQueries({ queryKey: ["inventory_counts"] });
          qc.invalidateQueries({ queryKey: ["reject_counts"] });
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
        // Ignore status events from a channel we tore down ourselves —
        // removeChannel() emits CLOSED, which previously re-triggered a
        // rebuild + full refetch in an endless loop.
        if (disposed) return;
        // iOS/Android suspend sockets in the background; when the socket dies
        // we rebuild the channel instead of silently going stale.
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          if (retryTimer === null) {
            retryTimer = window.setTimeout(() => setRealtimeEpoch((n) => n + 1), 5000);
          }
        }
        if (status === "SUBSCRIBED" && realtimeEpoch > 0) {
          // Only catch up after a reconnect, not on first connect.
          qc.invalidateQueries({ type: "active" });
        }
      });
    return () => {
      disposed = true;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
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
    const poll = window.setInterval(resync, 120_000);
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
  const [rolePickerSheetOpen, setRolePickerSheetOpen] = useState(false);
  const [editItemSheetId, setEditItemSheetId] = useState<string | null>(null);
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false);
  const [hideCompletedRooms, setHideCompletedRooms] = useState(false);
  const [hkFiltersOpen, setHkFiltersOpen] = useState(false);
  const [hkFiltersAnchor, setHkFiltersAnchor] = useState<{ top: number; left: number } | null>(null);
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
  const [roomInfoTab, setRoomInfoTab] = useState<
    { room: number; tab: "dnd" | "lp" | "maint" } | null
  >(null);
  const roomInfoExpandedRef = useRef<HTMLDivElement>(null);
  // When reception expands a bottom tile (DND, maintenance, lost property), scroll
  // the panel content into view only if it falls below the fold.
  useEffect(() => {
    if (!roomInfoTab || !roomInfoExpandedRef.current) return;
    const el = roomInfoExpandedRef.current;
    const rect = el.getBoundingClientRect();
    const margin = 16;
    if (rect.bottom > window.innerHeight - margin) {
      const top = window.scrollY + rect.top - margin;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }, [roomInfoTab]);
  const [receptionSheetRoom, setReceptionSheetRoom] = useState<number | null>(null);
  const [quickReceptionOpen, setQuickReceptionOpen] = useState(false);
  const [quickSlotEl, setQuickSlotEl] = useState<HTMLDivElement | null>(null);
  const [editDefaultsSheetRoom, setEditDefaultsSheetRoom] = useState<number | null>(null);
  const [editRoomSheetNumber, setEditRoomSheetNumber] = useState<number | null>(null);
  const [menuSheetOpen, setMenuSheetOpen] = useState(false);
  const [notificationsSheetOpen, setNotificationsSheetOpen] = useState(false);
  const [messagesSheetOpen, setMessagesSheetOpen] = useState(false);
  const [messagesInitial, setMessagesInitial] = useState<{ thread?: MessagesThread; room?: number | null; text?: string; replyTo?: { id: string; sender: string; snippet: string } }>({});
  const [maintenanceLogOpen, setMaintenanceLogOpen] = useState(false);
  const [newMaintenanceRoom, setNewMaintenanceRoom] = useState<string>("");
 const [newMaintenancePhotos, setNewMaintenancePhotos] = useState<File[]>([]);
 const [donePhotoTarget, setDonePhotoTarget] = useState<string | null>(null);
 const [donePhotos, setDonePhotos] = useState<File[]>([]);
 const [doneNotes, setDoneNotes] = useState("");
 const [donePhotoBusy, setDonePhotoBusy] = useState(false);
  const [newMaintenanceText, setNewMaintenanceText] = useState<string>("");
  const [newMaintenanceUrgent, setNewMaintenanceUrgent] = useState(false);
  const [maintenanceComposerOpen, setMaintenanceComposerOpen] = useState(false);
  // iOS room-hub logging: centred compose-only popups instead of the full log windows.
  const [maintenanceComposeRoom, setMaintenanceComposeRoom] = useState<number | null>(null);
  const [lostComposeRoom, setLostComposeRoom] = useState<number | null>(null);

  const [lostPropertyOpen, setLostPropertyOpen] = useState(false);
  // Room number pre-selected in the lost property composer when it's opened
  // from a room hub, so the user doesn't have to pick the room again.
  const [lostPropertyInitialRoom, setLostPropertyInitialRoom] = useState<number | null>(null);

   // Progress-bar easter egg: 7 taps within a 2-second rolling window →
   // immediate full reset + fancy broom-burst animation. If more than 2 seconds
   // elapses between taps, the counter resets and the user starts again.
  const progressTapCountRef = useRef(0);
  const progressTapTimerRef = useRef<number | null>(null);
  const [broomBurstActive, setBroomBurstActive] = useState(false);
  const [progressSheetOpen, setProgressSheetOpen] = useState(false);
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
  // Home-screen takeover: a shortcut card can swap the department home for a panel.
  type HomeView = "maintenance" | "messages" | "lost" | "stayover";
  const [homeView, setHomeView] = useState<HomeView | null>(null);
  const menuTakeoverActive = useSheetTakeoverActive();
  const [homeSlotEl, setHomeSlotEl] = useState<HTMLDivElement | null>(null);
  // Only one panel may occupy the home screen: close every other one first.
  const closeHomePanels = (keep?: HomeView | "quick") => {
    releaseSheetTakeover();
    if (keep !== "maintenance") setMaintenanceLogOpen(false);
    if (keep !== "messages") setMessagesSheetOpen(false);
    if (keep !== "lost") setLostPropertyOpen(false);
    if (keep !== "stayover") setStayoverPhotosOpen(false);
    if (keep !== "quick") setQuickReceptionOpen(false);
    if (keep === undefined || keep === "quick") setHomeView(null);
  };
  // Housekeeping room grid: the open room expands inline below its row.
  const [roomGridEl, setRoomGridEl] = useState<HTMLDivElement | null>(null);
  const [roomSlotEl, setRoomSlotEl] = useState<HTMLDivElement | null>(null);
  const [roomViewBodyEl, setRoomViewBodyEl] = useState<HTMLDivElement | null>(null);
  const [roomGridCols, setRoomGridCols] = useState(4);
  useEffect(() => {
    if (!roomGridEl) return;
    const measure = () => {
      const cols = getComputedStyle(roomGridEl).gridTemplateColumns.split(" ").filter(Boolean).length;
      setRoomGridCols(Math.max(1, cols));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(roomGridEl);
    return () => ro.disconnect();
  }, [roomGridEl]);
  // Bring the tapped tile to the top of the screen once its room has expanded.
  // The slot grows over its open animation, so lower rows can't scroll up far
  // enough at first; scroll again as it grows. Offset by the sticky top bar.
  useEffect(() => {
    if (openRoom === null || !roomGridEl || !roomSlotEl) return;
    const scrollToTile = () => {
      const tiles = Array.from(roomGridEl.children).filter(
        (el) => !(el as HTMLElement).hasAttribute("data-room-slot"),
      ) as HTMLElement[];
      const tile = tiles.find((el) => new RegExp(`^${openRoom}(\\D|$)`).test(el.textContent?.trim() ?? ""));
      const target = tile ?? roomSlotEl;
      const bar = document.querySelector<HTMLElement>("[data-mobile-topbar]");
      const offset = (bar?.getBoundingClientRect().height ?? 0) + 12;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    };
    const raf = requestAnimationFrame(scrollToTile);
    const timers = [250, 500, 800].map((ms) => window.setTimeout(scrollToTile, ms));
    return () => { cancelAnimationFrame(raf); timers.forEach((t) => window.clearTimeout(t)); };
  }, [openRoom, roomGridEl, roomSlotEl]);
  const [topBarSlot, setTopBarSlot] = useState<HTMLDivElement | null>(null);
  // Stayover / DND photo state
  const [stayoverPhotosOpen, setStayoverPhotosOpen] = useState(false);
  const [stayoverPhotosRoomFilter, setStayoverPhotosRoomFilter] = useState<number | undefined>(undefined);
  // Leave the home takeover when its panel is closed from inside.
  useEffect(() => {
    if (
      (homeView === "maintenance" && !maintenanceLogOpen) ||
      (homeView === "messages" && !messagesSheetOpen) ||
      (homeView === "lost" && !lostPropertyOpen) ||
      (homeView === "stayover" && !stayoverPhotosOpen)
    )
      setHomeView(null);
  }, [homeView, maintenanceLogOpen, messagesSheetOpen, lostPropertyOpen, stayoverPhotosOpen]);
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
  const isMenuCollapsed = (key: string) => {
    const v = menuCollapsed[key];
    return v === undefined ? key !== "account" : v;
  };
  const toggleMenuSection = async (key: string) => {
    if (!authUser?.id) return;
    const currentPrefs = (menuPrefsQ.data ?? {}) as Record<string, unknown>;
    const currentCollapsed = (currentPrefs.menu_collapsed as Record<string, boolean> | undefined) ?? {};
    const nextCollapsed = { ...currentCollapsed, [key]: !(currentCollapsed[key] ?? key !== "account") };
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
    kind: RoomEventKind,
    roomNumber: number,
    messageText?: string,
  ) => {
    if (!getToken()) return;
    void notifyRoomEvent({ data: { kind, roomNumber, messageText } }).catch(() => {});
  };
  const [historySheetOpen, setHistorySheetOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [roomTypesSheetOpen, setRoomTypesSheetOpen] = useState(false);
  const [roomFeaturesSheetOpen, setRoomFeaturesSheetOpen] = useState(false);
  const [receptionItemsSheetOpen, setReceptionItemsSheetOpen] = useState(false);
  // Set when a Room Management sub-panel opens, so its Back returns to Room Management.
  const manageBackRef = useRef(false);
 

 const [exportOpen, setExportOpen] = useState(false);
  const [viewingSnapshot, setViewingSnapshot] = useState<ExportSnapshot | null>(null);
  const [rejectsOpen, setRejectsOpen] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [roomStatusPrintOpen, setRoomStatusPrintOpen] = useState(false);
  const [linenPrintOpen, setLinenPrintOpen] = useState(false);
  const [rejectsPrintOpen, setRejectsPrintOpen] = useState(false);
  const [deliveryPrintOpen, setDeliveryPrintOpen] = useState(false);
  const [invRoomsPrintOpen, setInvRoomsPrintOpen] = useState(false);
  const [invCupboardsPrintOpen, setInvCupboardsPrintOpen] = useState(false);
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
  const preferredQ = useRoomPreferredItemsQuery();
  const snapshotsQ = useExportSnapshotsQuery();
  const rejectsQ = useRejectCountsQuery();
  const deliveryQ = useDeliveryCountsQuery();
  const inventoryQ = useInventoryCountsQuery();
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
  // Emergency snapshot: silently record the shared state after a room is
  // marked done, so Settings → Actions → Undo can roll it back. Values are read
  // from the live cache so the newest change is always included.
  const captureEmergencySnapshot = (label: string) => {
    captureOpsSnapshot(
      currentHotelQ.data?.id,
      buildOpsState({
        rooms: qc.getQueryData<Room[]>(["rooms"]) ?? [],
        counts: qc.getQueryData<RoomCount[]>(["room_counts"]) ?? [],
        reject: qc.getQueryData<RejectCount[]>(["reject_counts"]) ?? [],
        delivery: qc.getQueryData<DeliveryCount[]>(["delivery_counts"]) ?? [],
        fnb: qc.getQueryData<FnbCount[]>(["fnb_linen_counts"]) ?? [],
      }),
      label,
    );
  };
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

  // Whether the housekeeping shift is complete — all serviceable rooms are done.
  // Used to reveal the "Mark shift as finished" shortcut and to hide the now
  // redundant Linen totals / Room status items from the Export menu.
  // DND rooms are never serviceable, so they are excluded from the total.
  // Dirty rooms are also left out of the visible count, but they don't hold the
  // shift open: once every other room is done the shift reads as complete and
  // any leftover Dirty rooms switch the outcome to the "not finished" one.
  const { isShiftComplete, hasLeftoverDirtyRooms } = (() => {
    const statusLabelById = new Map(
      receptionStatuses.map((s) => [s.id, s.label.toLowerCase()]),
    );
    const excluded = new Set(["staff", "ros", "staff/ros", "ros - staff"]);
    const dndId = receptionStatuses.find((s) => s.label.toLowerCase() === "dnd")?.id ?? null;
    const dirtyId = receptionStatuses.find((s) => s.label.toLowerCase() === "dirty")?.id ?? null;
    let counted = 0;
    let done = 0;
    let dirtyLeft = 0;
    for (const r of rooms) {
      const sid = r.reception_status_id ?? r.default_status;
      const lbl = sid ? (statusLabelById.get(sid) ?? sid).toLowerCase() : "";
      if (excluded.has(lbl)) continue;
      if (dndId && sid === dndId) continue;
      const isDone = r.done || r.done_reception;
      if (dirtyId && sid === dirtyId) {
        if (!isDone) dirtyLeft += 1;
        continue;
      }
      counted += 1;
      if (isDone) done += 1;
    }
    const complete = counted + dirtyLeft > 0 && done >= counted;
    return { isShiftComplete: complete, hasLeftoverDirtyRooms: dirtyLeft > 0 };
  })();

  // Outcome animation when the room progress reaches 100%. It only plays on the
  // device that marked the final room as done, once per time the bar fills:
  // fireworks when everything was serviced, sad trombone when Dirty rooms remain.
  const [celebrationActive, setCelebrationActive] = useState(false);
  const [gloomActive, setGloomActive] = useState(false);
  const wasShiftCompleteRef = useRef(false);
  const markedDoneHereRef = useRef(false);
  const celebratedRef = useRef(false);
  const autoBackupRef = useRef<(() => Promise<void>) | null>(null);
  useEffect(() => {
    if (isShiftComplete) {
      if (!wasShiftCompleteRef.current && markedDoneHereRef.current && !celebratedRef.current) {
        celebratedRef.current = true;
        // Full progress bar = end of shift: save today's backup automatically
        // (only on the device that finished the last room, to avoid duplicates).
        void autoBackupRef.current?.();
        if (areOutcomeAnimationsEnabled()) {
          if (hasLeftoverDirtyRooms) setGloomActive(true);
          else setCelebrationActive(true);
        }
      }
    } else {
      celebratedRef.current = false;
    }
    markedDoneHereRef.current = false;
    wasShiftCompleteRef.current = isShiftComplete;
  }, [isShiftComplete, hasLeftoverDirtyRooms]);

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

  // Maintenance-thread messages shown in the Maintenance Log can be completed
  // from there as well, so all departments see the same state.
  const markMaintenanceMessageDone = async (id: string) => {
    const { error } = await supabase
      .from("room_messages" as never)
      .update({ done_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never)
      .eq("id", id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["room_messages"] });
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
        urgent: newMaintenanceUrgent,
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
    setNewMaintenanceUrgent(false);
    qc.invalidateQueries({ queryKey: ["maintenance_requests"] });
    if (roomNumber != null) await writeRoomMaintenanceFlag(roomNumber, true);
    void notifyMaintenanceRequest({ data: { roomNumber, areaLabel: areaLabel, message: text } });
    toast.success("Maintenance request logged");
  };

  // Flag/unflag a request as needing urgent action (independent of completion).
  const setMaintenanceUrgent = async (id: string, urgent: boolean) => {
    qc.setQueryData<MaintenanceRequest[]>(["maintenance_requests"], (old) =>
      old?.map((m) => (m.id === id ? { ...m, urgent } : m)) ?? [],
    );
    const { error } = await supabase
      .from("maintenance_requests" as never)
      .update({ urgent, updated_at: new Date().toISOString() } as never)
      .eq("id", id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["maintenance_requests"] });
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

  // Completing a job first offers the person the chance to photograph the work.
  const markMaintenanceDone = async (id: string) => {
    setDonePhotoTarget(id);
    setDonePhotos([]);
    setDoneNotes("");
  };

  const completeMaintenanceRequest = async (id: string, files: File[], workNotes: string) => {
    const who = authUser?.username ?? (isMaintenance ? "Maintenance" : "Reception");
    const target = (qc.getQueryData<MaintenanceRequest[]>(["maintenance_requests"]) ?? [])
      .find((m) => m.id === id);
    qc.setQueryData<MaintenanceRequest[]>(["maintenance_requests"], (old) =>
      old?.map((m) =>
        m.id === id
          ? { ...m, done: true, done_by_username: who, done_at: new Date().toISOString(), completion_notes: workNotes }
          : m,
      ) ?? [],
    );
    const { error } = await supabase
      .from("maintenance_requests" as never)
      .update({ done: true, done_by_username: who, done_at: new Date().toISOString(), completion_notes: workNotes } as never)
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["maintenance_requests"] });
      return;
    }
    if (files.length > 0) {
      const { uploadEntryPhotos } = await import("@/lib/entry-photos");
      const { paths, errors } = await uploadEntryPhotos("maintenance", id, files);
      if (errors.length > 0) toast.error(errors[0]);
      if (paths.length > 0) {
        const next = [...(target?.photo_paths ?? []), ...paths];
        const { error: photoErr } = await supabase
          .from("maintenance_requests" as never)
          .update({ photo_paths: next } as never)
          .eq("id", id);
        if (photoErr) toast.error(photoErr.message);
      }
    }
    qc.invalidateQueries({ queryKey: ["maintenance_requests"] });
    if (getToken())
      void notifyMaintenanceCompleted({
        data: {
          roomNumber: target?.room_number ?? null,
          areaLabel: target?.area_label ?? null,
          message: target?.message ?? "",
        },
      }).catch(() => {});
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

  const resetRejects = async (skipConfirm = false) => {
    if (!skipConfirm && !confirm("Reset all reject tallies?")) return;
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

  // --- Inventory (bedrooms + floor cupboards) ------------------------------
  // Stock counts persist until changed; they are not cleared by Reset all.
  const inventoryCounts = inventoryQ.data ?? [];
  const getInventoryCount = (section: InventorySection, location: string, itemId: string) => {
    if (section === "delivery") return getDeliveryCount(itemId);
    if (section === "rejects") return getRejectCount(itemId);
    return (
      inventoryCounts.find(
        (r) => r.section === section && r.location === location && r.template_item_id === itemId,
      )?.count ?? 0
    );
  };
  const setInventoryCount = async (
    section: InventorySection,
    location: string,
    itemId: string,
    value: number,
  ) => {
    if (section === "delivery") return setDeliveryCount(itemId, value);
    if (section === "rejects") {
      const next = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
      return updateRejectCount(itemId, next - getRejectCount(itemId));
    }
    const next = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
    qc.setQueryData<InventoryCount[]>(["inventory_counts"], (old) => {
      const list = old ? [...old] : [];
      const idx = list.findIndex(
        (r) => r.section === section && r.location === location && r.template_item_id === itemId,
      );
      if (idx >= 0) list[idx] = { ...list[idx], count: next };
      else list.push({ id: `temp-${section}-${location}-${itemId}`, section, location, template_item_id: itemId, count: next });
      return list;
    });
    const hotelId = currentHotelQ.data?.id;
    const { error } = await supabase.from("inventory_counts").upsert(
      {
        ...(hotelId ? { hotel_id: hotelId } : {}),
        section,
        location,
        template_item_id: itemId,
        count: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "hotel_id,section,location,template_item_id" },
    );
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["inventory_counts"] });
    }
  };
  const resetInventorySection = async (section: InventorySection, location: string) => {
    if (section === "delivery") return resetDeliveryCounts(true);
    if (section === "rejects") return resetRejects(true);
    qc.setQueryData<InventoryCount[]>(["inventory_counts"], (old) =>
      (old ?? []).filter((r) => !(r.section === section && (location === "*" || r.location === location))),
    );
    let q = supabase.from("inventory_counts").delete().eq("section", section);
    if (location !== "*") q = q.eq("location", location);
    const { error } = await q;
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["inventory_counts"] });
  };
  const computeInventoryTotals = (section: "room" | "cupboard") => {
    const nameOf = new Map(template.map((t) => [t.id, t.name]));
    const locLabel = (loc: string) =>
      section === "room" ? `Room ${loc}` : (CUPBOARDS.find((c) => c.key === loc)?.label ?? loc);
    const order = section === "room"
      ? (loc: string) => Number(loc)
      : (loc: string) => CUPBOARDS.findIndex((c) => c.key === loc);
    const rows = inventoryCounts
      .filter((r) => r.section === section && r.count > 0 && nameOf.has(r.template_item_id))
      .sort((a, b) => order(a.location) - order(b.location) || (nameOf.get(a.template_item_id) ?? "").localeCompare(nameOf.get(b.template_item_id) ?? ""))
      .map((r) => ({ name: `${locLabel(r.location)} — ${nameOf.get(r.template_item_id)}`, count: r.count }));
    return { rows, grand: rows.reduce((s, r) => s + r.count, 0) };
  };

  const exportInventory = () => {
    const nameOf = new Map(template.map((t) => [t.id, t.name]));
    const sumBy = (list: { template_item_id: string; count: number }[]) => {
      const m = new Map<string, number>();
      for (const r of list) {
        if (r.count > 0 && nameOf.has(r.template_item_id))
          m.set(r.template_item_id, (m.get(r.template_item_id) ?? 0) + r.count);
      }
      return template.filter((t) => m.has(t.id)).map((t) => ({ name: t.name, count: m.get(t.id)! }));
    };
    const sections: Exp.InventoryPrintSection[] = [];
    const del = sumBy(deliveryCounts);
    if (del.length) sections.push({ title: "Delivery", groups: [{ rows: del }] });
    const rej = sumBy(rejects);
    if (rej.length) sections.push({ title: "Rejects", groups: [{ rows: rej }] });
    const beds = sumBy(inventoryCounts.filter((r) => r.section === "room"));
    if (beds.length) sections.push({ title: "Bedrooms", groups: [{ rows: beds }] });
    const cupGroups = CUPBOARDS.map((c) => ({
      heading: c.label,
      rows: sumBy(inventoryCounts.filter((r) => r.section === "cupboard" && r.location === c.key)),
    })).filter((g) => g.rows.length);
    if (cupGroups.length) sections.push({ title: "Cupboards", groups: cupGroups });
    if (!sections.length) {
      toast.error("Nothing counted yet");
      return;
    }
    Exp.printInventory(hotelName, sections, new Date());
  };

  const resetDeliveryCounts = async (skipConfirm = false) => {
    if (!skipConfirm && !confirm("Reset all delivery counts?")) return;
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
   // Always land in a real department so the pill and behaviour match.
   const fallbackView: ViewRole | undefined =
     defaultView && availableViews.includes(defaultView)
       ? defaultView
       : availableViews[0] ?? defaultView;
   const effectiveRole: ViewRole | undefined =
     canViewAs && safeViewAs ? safeViewAs : fallbackView;
   const realRole: ViewRole | undefined = defaultView;
   const isReception = effectiveRole === "reception";
   const quickSetupInline = quickReceptionOpen && effectiveRole === "user";
    // A real admin/manager keeps admin capabilities in every view — the
    // pill only changes which home screen they land on.
    const isAdmin = realIsAdmin || realIsManager;
   const isHousekeeper = effectiveRole === "user";
   const isFnb = effectiveRole === "fnb";
   const isMaintenance = effectiveRole === "maintenance";
   useEffect(() => {
     setHomeView(null);
     setMaintenanceLogOpen(false);
     setMessagesSheetOpen(false);
     setLostPropertyOpen(false);
     setStayoverPhotosOpen(false);
   }, [effectiveRole]);
    // Settings-menu permissions: derived from real position/sub-roles,
    // not the active home-screen pill. The settings menu should stay the
    // same regardless of which view the user is currently in.
    const menuIsAdmin = realIsAdmin || realIsManager;
    const menuHasFnb = menuIsAdmin || hasFnbRole;
    const menuHasHk = menuIsAdmin || hasHousekeeperRole;
    const menuHasMaintenance = menuIsAdmin || hasMaintenanceRole;
    // Lost Property log is only meaningful to Reception + Housekeeping.
    const menuCanUseLostProperty = true;
    // Housekeeping & Reception log against rooms; every other department
    // logs against hotel areas.
    const logScope: "rooms" | "areas" = isFnb || isMaintenance ? "areas" : "rooms";
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
    const isMaintenanceOnlyUser =
      !menuIsAdmin && hasMaintenanceRole && !hasHousekeeperRole && !hasReceptionRole && !hasFnbRole;
    const menuIsFnbOnly =
      position === "user" && hasFnbRole && !hasHousekeeperRole && !hasReceptionRole;
    const logLostProperty = async (
      roomNumber: number | null,
      message: string,
      photos: File[] = [],
      areaLabel: string | null = null,
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
          area_label: areaLabel,
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

  const completeSelectedRoomItems = async (roomNumber: number, department: "housekeeping" | "reception") => {
    const { error } = await supabase.rpc("complete_selected_room_items", { p_room_number: roomNumber, p_department: department });
    if (error) { toast.error(error.message); return; }
    markedDoneHereRef.current = true;
    await Promise.all([qc.invalidateQueries({ queryKey: ["rooms"] }), qc.invalidateQueries({ queryKey: ["room-checklist-records"] })]);
    fireRoomNotification("done", roomNumber);
    captureEmergencySnapshot(`Room ${roomNumber} marked done`);
  };

  const toggleReceptionDone = async (roomNumber: number) => {
    const current = receptionDoneSet.has(roomNumber);
    const next = !current;
    if (next && hasRoomItemSelection(rooms.find((r) => r.room_number === roomNumber)?.checked_items)) {
      await completeSelectedRoomItems(roomNumber, "reception");
      return;
    }
    // Flag before the optimistic cache update so the celebration effect,
    // which runs on the resulting re-render, sees that this user did it.
    if (next) markedDoneHereRef.current = true;
    const clearedReceptionFlags = {
      guest_vacated: false,
      guest_vacated_at: null,
      early_check_in: false,
      early_check_in_at: null,
      late_checkout: false,
      late_checkout_at: null,
      stayover_out: false,
      stayover_out_at: null,
    } as const;
    qc.setQueryData<Room[]>(["rooms"], (old) => {
      const list = old ? [...old] : [];
      const idx = list.findIndex((r) => r.room_number === roomNumber);
      if (idx >= 0) list[idx] = { ...list[idx], done_reception: next, ...(next ? clearedReceptionFlags : {}) };
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
      { room_number: roomNumber, done_reception: next, ...(next ? clearedReceptionFlags : {}), updated_at: new Date().toISOString() },
      { onConflict: "user_id,hotel_id,room_number" },
    );

    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["rooms"] });
    if (next) {
      fireRoomNotification("done", roomNumber);
      captureEmergencySnapshot(`Room ${roomNumber} marked done`);
    }
  };

  const toggleHousekeepingDone = async (roomNumber: number) => {
    const room = rooms.find((r) => r.room_number === roomNumber);
    const next = !room?.done;
    if (next && hasRoomItemSelection(room?.checked_items)) {
      await completeSelectedRoomItems(roomNumber, "housekeeping");
      return;
    }
    // Flag before the optimistic cache update so the celebration effect,
    // which runs on the resulting re-render, sees that this user did it.
    if (next) markedDoneHereRef.current = true;
    // Marking done clears reception's guest flags: the room is serviced, so
    // early check-in / late checkout / vacated / stayover-out no longer apply.
    const clearedFlags = {
      guest_vacated: false,
      guest_vacated_at: null,
      early_check_in: false,
      early_check_in_at: null,
      late_checkout: false,
      late_checkout_at: null,
      stayover_out: false,
      stayover_out_at: null,
    } as const;
    qc.setQueryData<Room[]>(["rooms"], (old) =>
      (old ?? []).map((r) =>
        r.room_number === roomNumber
          ? { ...r, done: next, ...(next ? clearedFlags : {}) }
          : r,
      ),
    );
    const { error } = await supabase.from("rooms").upsert(
      {
        room_number: roomNumber,
        done: next,
        ...(next ? clearedFlags : {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,hotel_id,room_number" },
    );
    if (error) toast.error(error.message);

    qc.invalidateQueries({ queryKey: ["rooms"] });
    if (next) {
      fireRoomNotification("done", roomNumber);
      captureEmergencySnapshot(`Room ${roomNumber} marked done`);
    }
  };

  const preferredItems = preferredQ.data ?? [];

  const isPreferred = (templateItemId: string, roomNumber: number) =>
    preferredItems.some(
      (p) => p.template_item_id === templateItemId && p.room_number === roomNumber,
    );

  // Mark/unmark a linen item as the room's preferred choice.
  const togglePreferred = async (templateItemId: string, roomNumber: number) => {
    const existing = preferredItems.find(
      (p) => p.template_item_id === templateItemId && p.room_number === roomNumber,
    );
    if (existing) {
      qc.setQueryData<RoomPreferredItem[]>(["room_preferred_items"], (old) =>
        old?.filter((p) => p.id !== existing.id) ?? [],
      );
      const { error } = await supabase
        .from("room_preferred_items" as never)
        .delete()
        .eq("id", existing.id);
      if (error) toast.error(error.message);
    } else {
      qc.setQueryData<RoomPreferredItem[]>(["room_preferred_items"], (old) => [
        ...(old ?? []),
        { id: `temp-${templateItemId}-${roomNumber}`, template_item_id: templateItemId, room_number: roomNumber },
      ]);
      const { error } = await supabase
        .from("room_preferred_items" as never)
        .insert({ template_item_id: templateItemId, room_number: roomNumber } as never);
      if (error) toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["room_preferred_items"] });
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


 // Collapse the inline room panel with an animation, then run `done`.
 const collapseRoomSlot = (done: () => void) => {
    const el = document.querySelector<HTMLDivElement>("[data-room-slot]");
    if (isReception || !el || !el.firstElementChild || typeof el.animate !== "function" ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      done();
      return;
    }
    const h = el.getBoundingClientRect().height;
    el.style.overflow = "hidden";
    const anim = el.animate(
      [
        { height: `${h}px`, opacity: 1, transform: "translateY(0)" },
        { height: "0px", opacity: 0, transform: "translateY(-8px)" },
      ],
      { duration: 260, easing: "cubic-bezier(0.4, 0, 0.2, 1)", fill: "forwards" },
    );
    anim.onfinish = () => {
      el.dataset.collapsed = "1";
      done();
      // Keep the collapsed frame until React has removed the panel, otherwise
      // the slot pops back to full height for a frame (tiles flash).
      let tries = 0;
      const release = () => {
        if (el.isConnected && el.childElementCount > 0 && tries++ < 30) {
          requestAnimationFrame(release);
          return;
        }
        anim.cancel();
        el.style.overflow = "";
      };
      requestAnimationFrame(release);
    };
  };

 const openOrToggle = (roomNumber: number) => {
    if (roomTileAction(openRoom, roomNumber) === "close") {
      closeRoomView();
      return;
    }
    clearRoomTabs();
    setOpenRoom(roomNumber);
  };

 // Marking a room done finishes the visit to it: drop the status view and the
 // open room slot together so the user lands back on the room tile grid.
 const closeRoomView = () => {
    const closing = openRoom;
    collapseRoomSlot(() => {
      if (closing !== null) setShowAllLinen((prev) => ({ ...prev, [closing]: false }));
      setOpenRoom(null);
      clearRoomTabs();
      setNewMessageText("");
    });
  };


  // Housekeeping shows the status view inside the open room's slot; drop it
  // when the room closes or a different room opens.
  useEffect(() => {
    if (isReception) return;
    setReceptionSheetRoom((cur) => (cur !== null && cur !== openRoom ? null : cur));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRoom]);

  // Animate only the room opening. Tab bodies swap inside a persistent frame
  // without collapsing or moving the navigation.
  // Observes the stable grid and runs synchronously (MutationObserver fires
  // before paint), so the new content never flashes at full height first.
  useEffect(() => {
    const grid = roomGridEl;
    if (isReception || !grid) return;
    const heights = new WeakMap<HTMLElement, number>();
    const mo = new MutationObserver(() => {
      const el = grid.querySelector<HTMLDivElement>("[data-room-slot]");
      if (!el || typeof el.animate !== "function") return;
      if (el.getAnimations().length > 0) return; // collapsing or already animating
      const from = heights.get(el) ?? 0;
      const to = el.getBoundingClientRect().height;
      heights.set(el, to);
      if (to === 0 || Math.abs(to - from) < 24 ||
          window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const opening = from === 0;
      if (!opening) return;
      el.style.overflow = "hidden";
      const anim = el.animate(
        [
          { height: `${from}px`, opacity: opening ? 0 : 1, transform: opening ? "translateY(-8px)" : "none" },
          { height: `${to}px`, opacity: 1, transform: "none" },
        ],
        { duration: 280, easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
      );
      // Hold the first frame until the browser is free to paint, so the
      // heavy first render doesn't eat the start of the animation.
      anim.pause();
      // Drive the clock by hand with each step capped at one frame, so a
      // stalled frame (the panel's first render) can't skip part of the motion.
      let t = 0; let prev = -1;
      const step = (now: number) => {
        if (anim.playState === "finished" || anim.playState === "idle") return;
        if (prev >= 0) t += Math.min(now - prev, 20);
        prev = now;
        if (t >= 280) { anim.finish(); return; }
        anim.currentTime = t;
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      anim.onfinish = () => { el.style.overflow = ""; heights.set(el, el.getBoundingClientRect().height); };
    });
    mo.observe(grid, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden"] });
    return () => mo.disconnect();
  }, [roomGridEl, isReception]);

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
    // Record the state before wiping it so Undo can bring it all back.
    captureEmergencySnapshot("Reset all");
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
          stayover_out: keep?.stayover_out ?? false,
          stayover_out_at: keep?.stayover_out_at ?? null,
          dog_box: keep?.dog_box ?? false,
          dog_box_at: keep?.dog_box_at ?? null,
          early_check_in: keep?.early_check_in ?? false,
          late_checkout: keep?.late_checkout ?? false,
          needs_maintenance: keep?.needs_maintenance ?? false,
          guest_vacated_at: keep?.guest_vacated_at ?? null,
          early_check_in_at: keep?.early_check_in_at ?? null,
          late_checkout_at: keep?.late_checkout_at ?? null,
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
      dog_box: false,
      dog_box_at: null,
      early_check_in: false,
      early_check_in_at: null,
      late_checkout: false,
      late_checkout_at: null,
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
        stayover_out: keep.stayover_out,
        stayover_out_at: keep.stayover_out_at,
        dog_box: keep.dog_box,
        dog_box_at: keep.dog_box_at,
        early_check_in: keep.early_check_in,
        early_check_in_at: keep.early_check_in_at,
        late_checkout: keep.late_checkout,
        late_checkout_at: keep.late_checkout_at,
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
    // Room messages are NOT cleared by Reset all — they stay pinned to the
    // room until someone actions (dismisses) them.
    const nowIso = new Date().toISOString();
    // Record the housekeeping reset on the active hotel so Reception's own
    // "Reset all" button (visible after 7am) can hide itself for the rest of
    // the day.
    const activeHotelId = currentHotelQ.data?.id;
    if (activeHotelId) {
      // Custom guest & room info toggles always clear on Reset all.
      await supabase.from("room_custom_flags" as never).delete().eq("hotel_id", activeHotelId);
      qc.setQueryData(["room_custom_flags"], []);
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
    kind: "totals" | "rejects" | "fnb_totals" | "delivery" | "inventory_rooms" | "inventory_cupboards" = "totals",
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
    // F&B exports overwrite any earlier export saved for the day, without
    // asking first (saveSnapshot replaces same-day snapshots of the kind).
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
  const runEndOfShiftBackup = async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    type Kind = "totals" | "fnb_totals" | "room_status" | "maintenance" | "delivery" | "inventory_rooms" | "inventory_cupboards" | "checklists";
    const jobs: Array<{ kind: Kind; rows: unknown[]; grand: number }> = [];
    // Completed room checklists from today, so the records export with the rest.
    const hotelId = currentHotelQ.data?.id;
    if (hotelId) {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const { data: completions } = await supabase
        .from("room_checklist_completions")
        .select("room_number,department,items,completed_by_name,completed_at")
        .eq("hotel_id", hotelId)
        .gte("completed_at", startOfToday.toISOString())
        .order("room_number", { ascending: true });
      const checklistRows: ChecklistSnapshotRow[] = (completions ?? []).map((c) => ({
        room: c.room_number,
        department: c.department,
        items: (c.items as string[]) ?? [],
        by: c.completed_by_name,
        at: c.completed_at,
      }));
      if (checklistRows.length) {
        jobs.push({ kind: "checklists", rows: checklistRows, grand: checklistRows.length });
      }
    }
    const t = computeTotals();
    if (t.rows.length) jobs.push({ kind: "totals", rows: t.rows, grand: t.grand });
    const f = computeFnbTotals();
    if (f.rows.length) jobs.push({ kind: "fnb_totals", rows: f.rows, grand: f.grand });
    const d = computeDeliveryTotals();
    if (d.rows.length) jobs.push({ kind: "delivery", rows: d.rows, grand: d.grand });
    const ir = computeInventoryTotals("room");
    if (ir.rows.length) jobs.push({ kind: "inventory_rooms", rows: ir.rows, grand: ir.grand });
    const ic = computeInventoryTotals("cupboard");
    if (ic.rows.length) jobs.push({ kind: "inventory_cupboards", rows: ic.rows, grand: ic.grand });
    const rs = computeRoomStatus();
    if (rs.rows.length) jobs.push({ kind: "room_status", rows: rs.rows, grand: rs.grand });
    const m = computeMaintenance();
    if (m.rows.length) jobs.push({ kind: "maintenance", rows: m.rows, grand: m.grand });
    if (jobs.length === 0) {
      if (!silent) toast.error("Nothing to back up yet");
      return;
    }
    // Counters whose numbers haven't changed since the last saved day are
    // left out, so idle counters (e.g. an unused F&B list) don't fill History.
    const counterKinds = new Set<Kind>(["totals", "fnb_totals", "delivery", "inventory_rooms", "inventory_cupboards"]);
    const todayStr = new Date().toDateString();
    const sig = (rows: unknown) => JSON.stringify(rows);
    const kept = jobs.filter((job) => {
      if (!counterKinds.has(job.kind)) return true;
      if (job.kind === "fnb_totals" && fnbCounts.length === 0) return false;
      const prev = snapshots
        .filter((s) => s.kind === job.kind && new Date(s.created_at).toDateString() !== todayStr)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      return !prev || sig(prev.totals) !== sig(job.rows);
    });
    if (kept.length === 0) {
      if (!silent) toast.error("Nothing has changed to back up");
      return;
    }
    jobs.length = 0;
    jobs.push(...kept);
    for (const job of jobs) {
      const ok = await saveSnapshot(job.kind, job.rows, job.grand);
      if (!ok) return;
    }
    qc.invalidateQueries({ queryKey: ["export_snapshots"] });
    toast.success(`Backup saved (${jobs.length} ${jobs.length === 1 ? "item" : "items"})`);
  };

  // Records today's data automatically the first time it's needed each day.
  // If a snapshot already exists for today, this is a no-op.
  const ensureTodaysBackup = async () => {
    if (isMaintenance) return;
    const today = new Date().toDateString();
    const hasToday = snapshots.some(
      (s) => new Date(s.created_at).toDateString() === today,
    );
    if (hasToday) return;
    await runEndOfShiftBackup({ silent: true });
  };
  autoBackupRef.current = () => runEndOfShiftBackup({ silent: true });

  // Reports entry point: record today's data automatically on first open.
  // Emergency undo: rolls the shared state back to the most recent hidden
  // snapshot (taken whenever a room was marked done).
  const [undoing, setUndoing] = useState(false);
  const runEmergencyUndo = async () => {
    if (undoing) return;
    if (!confirm("Undo the last recorded change? Rooms and linen counts will go back to the previous snapshot.")) return;
    setUndoing(true);
    const result = await undoLastOpsSnapshot();
    setUndoing(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    pendingCounts.clearAll();
    for (const key of [
      "rooms",
      "room_counts",
      "reject_counts",
      "delivery_counts",
      "fnb_linen_counts",
    ]) {
      qc.invalidateQueries({ queryKey: [key] });
    }
    toast.success(result.message);
  };

  const openReports = async () => {
    await ensureTodaysBackup();
    setEndShiftPrintOpen(true);
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
    // Marking a room Dirty can be the action that fills the progress bar, so it
    // counts as "the outcome happened on this device" just like Mark as done.
    if (field === "reception_status_id" && value) {
      const dirtyId =
        receptionStatuses.find((s) => s.label.toLowerCase() === "dirty")?.id ?? null;
      const cleanId =
        receptionStatuses.find((s) => s.label.toLowerCase() === "clean")?.id ?? null;
      const arrivalId =
        receptionStatuses.find((s) => s.label.toLowerCase() === "arrival")?.id ?? null;
      const previousStatusId = (qc.getQueryData<Room[]>(["rooms"]) ?? []).find(
        (r) => r.room_number === roomNumber,
      )?.reception_status_id;
      if (dirtyId && value === dirtyId) {
        markedDoneHereRef.current = true;
        if (previousStatusId !== dirtyId) playFart();
      }
      if (
        (cleanId && value === cleanId) ||
        (arrivalId && value === arrivalId)
      ) {
        if (previousStatusId !== value) playSparkle();
      }
    }

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
    if (value) fireRoomNotification("stayover_out", roomNumber);
  };

  // Reception flag: this room's guest has a dog and needs a dog box put in.
  const setRoomDogBox = async (roomNumber: number, value: boolean) => {
    const nowIso = new Date().toISOString();
    qc.setQueryData<Room[]>(["rooms"], (old) => {
      const list = old ? [...old] : [];
      const idx = list.findIndex((r) => r.room_number === roomNumber);
      if (idx >= 0)
        list[idx] = { ...list[idx], dog_box: value, dog_box_at: value ? nowIso : null };
      return list;
    });
    const { error } = await supabase.from("rooms").upsert(
      {
        room_number: roomNumber,
        dog_box: value,
        dog_box_at: value ? nowIso : null,
        updated_at: nowIso,
      } as never,
      { onConflict: "user_id,hotel_id,room_number" },
    );
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["rooms"] });
    if (value) fireRoomNotification("dog_box", roomNumber);
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
    if (value) fireRoomNotification("early_checkin", roomNumber);
  };

  const setRoomLateCheckout = async (roomNumber: number, value: boolean) => {
    const nowIso = new Date().toISOString();
    qc.setQueryData<Room[]>(["rooms"], (old) => {
      const list = old ? [...old] : [];
      const idx = list.findIndex((r) => r.room_number === roomNumber);
      if (idx >= 0) list[idx] = { ...list[idx], late_checkout: value, late_checkout_at: value ? nowIso : null };
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
          late_checkout: value,
          late_checkout_at: value ? nowIso : null,
        });
      return list;
    });
    const { error } = await supabase.from("rooms").upsert(
      {
        room_number: roomNumber,
        late_checkout: value,
        late_checkout_at: value ? nowIso : null,
        updated_at: nowIso,
      } as never,
      { onConflict: "user_id,hotel_id,room_number" },
    );
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["rooms"] });
    if (value) fireRoomNotification("late_checkout", roomNumber);
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

 const activeRoomTab = (n: number): RoomTab | null =>
    receptionSheetRoom === n ? "status" : editDefaultsSheetRoom === n ? "edit" : notesSheetRoom === n ? "hub" : showAllLinen[n] ? "linen" : null;

 const clearRoomTabs = () => {
    setReceptionSheetRoom(null);
    setEditDefaultsSheetRoom(null);
    setNotesSheetRoom(null);
    setShowAllLinen({});
 };

  const selectRoomTab = (n: number, tab: RoomTab) => {
    const next = toggleRoomTab(activeRoomTab(n), tab);
    clearRoomTabs();
    if (next === "status") setReceptionSheetRoom(n);
    if (next === "linen") setShowAllLinen({ [n]: true });
    if (next === "edit") setEditDefaultsSheetRoom(n);
    if (next === "hub") setNotesSheetRoom(n);
  };

  // Keep the room summary visible until the tab body has actually mounted, so
  // a slow first render can't leave an empty gap that pulls the tiles up.
  const [roomSummaryHidden, setRoomSummaryHidden] = useState(false);
  const roomTabActive =
    !isReception && openRoom !== null &&
    ["status", "edit", "hub"].includes(activeRoomTab(openRoom) ?? "");
  useEffect(() => {
    if (!roomTabActive) {
      setRoomSummaryHidden(false);
      return;
    }
    const body = roomViewBodyEl;
    if (!body) return;
    const check = () => setRoomSummaryHidden(!!body.querySelector('[data-sheet-inline="room"]'));
    check();
    const mo = new MutationObserver(check);
    mo.observe(body, { childList: true });
    return () => mo.disconnect();
  }, [roomTabActive, roomViewBodyEl]);

 const renderRoomNavigation = (n: number) => {
    const active = activeRoomTab(n);
    return (

      <div role="group" aria-label="Room views" className="flex flex-row gap-2 shrink-0 mb-3">
        <Button
          type="button"
          data-ios-glass
          variant="outline"
          aria-pressed={active === "status"}
          data-ios-selected={active === "status" ? "true" : undefined}
          onClick={() => selectRoomTab(n, "status")}
          className={cn(
              "flex items-center justify-center gap-1.5 rounded-xl border bg-background px-3 sm:px-4 h-11 shadow-sm active:scale-[0.97] active:shadow-none flex-1 text-sm font-medium cursor-pointer transition-colors hover:bg-accent",
              active === "status"
                ? "border-primary bg-primary/10 text-primary"
                : ""
            )}
        >
          Status
        </Button>
        <Button
          type="button"
          data-ios-glass
          variant="outline"
          aria-pressed={active === "linen"}
          data-ios-selected={active === "linen" ? "true" : undefined}
          onClick={() => selectRoomTab(n, "linen")}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-xl border bg-background px-3 sm:px-4 h-11 shadow-sm active:scale-[0.97] active:shadow-none flex-1 text-sm font-medium cursor-pointer transition-colors hover:bg-accent",
            active === "linen"
              ? "border-primary bg-primary/10 text-primary"
              : ""
          )}
        >
          Extra linen
        </Button>
        {isAdmin && (
          <Button
            type="button"
            data-ios-glass
            variant="outline"
            aria-pressed={active === "edit"}
            data-ios-selected={active === "edit" ? "true" : undefined}
            onClick={() => selectRoomTab(n, "edit")}
            className={cn("inline-flex items-center justify-center h-11 w-11 shrink-0 rounded-xl border bg-background shadow-sm active:scale-[0.97] active:shadow-none text-sm font-medium cursor-pointer transition-colors hover:bg-accent", active === "edit" && "border-primary bg-primary/10 text-primary")}
            aria-label="Edit defaults"
          >
            <Pencil className="h-4 w-4" />
          </Button>
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
            <Button
              type="button"
              data-ios-glass
              variant="outline"
              aria-pressed={active === "hub"}
              data-ios-selected={active === "hub" ? "true" : undefined}
              onClick={() => selectRoomTab(n, "hub")}
              className={cn("relative inline-flex items-center justify-center h-11 w-11 shrink-0 rounded-xl border bg-background shadow-sm active:scale-[0.97] active:shadow-none text-sm font-medium cursor-pointer transition-colors hover:bg-accent", active === "hub" && "border-primary bg-primary/10 text-primary")}
              aria-label="Room hub"
            >
              <Inbox className="h-4 w-4" />

              {hasIndicator && (
                <span className="absolute -top-0.5 -right-0.5 z-10 flex items-center gap-0.5">
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
            </Button>
          );
        })()}
      </div>
    );
 };

 const renderRoomPanel = (n: number) => {
 const roomExtras = extras.filter((e) => e.room_number === n);
   const showAll = !!showAllLinen[n];
    const visibleTemplate = template.filter((t) => {
      if (isPreferred(t.id, n)) return true;
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
  <div data-room-panel-body className="flex flex-col min-h-0 flex-1 overflow-hidden">
    <div className={cn("space-y-4", isReception ? "flex-1 min-h-0 overflow-y-auto" : "shrink-0")}>

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
              const assigned = roomFeatures.filter((f) =>
                roomFeatureAssignments.some(
                  (a) => a.feature_id === f.id && a.room_number === n,
                ),
              );
              return (
                <div className="rounded-xl border bg-muted/40 p-3 space-y-2 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Room status
                  </p>
                  {statusText ? (
                    <div>
                      <p className="text-foreground">
                        <span className="font-medium">Status:</span>{" "}
                        {statusText ?? <span className="text-muted-foreground">Not set</span>}
                      </p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Status not currently set</p>
                  )}
                  {assigned.length > 0 && (
                    <>
                      <div className="border-t border-border/60" />
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Features
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
                    </>
                  )}
                  {(() => {
                    const checked = rooms.find((r) => r.room_number === n)?.checked_items ?? null;
                    return (
                      <>
                        <div className="border-t border-border/60" />
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Checked Items
                          </p>
                          {checked && checked.length > 0 ? (
                            <ul className="flex flex-wrap gap-1.5">
                              {checked.map((item) => (
                                <li key={item} className="inline-flex items-center rounded-xl border border-primary bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                                  {item}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-muted-foreground">No items checked yet</p>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              );
            })()}
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {roomFlagsCtx.flags.map((d) => {
              const on = roomFlagsCtx.isOn(room, n, d);
              return (
                <Button key={d.key} type="button" variant="outline" aria-pressed={on}
                  onClick={() => roomFlagsCtx.toggle(n, d, !on)}
                  className={cn("h-auto min-h-12 w-full min-w-0 justify-center gap-2 whitespace-normal rounded-xl px-3 py-3 text-center text-sm font-medium", on && "border-primary bg-primary/10 text-primary hover:bg-primary/15")}>
                  <FlagIcon def={d} className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 break-words">
                    {d.label}
                  </span>
                </Button>
              );
            })}
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
      const room = rooms.find((r) => r.room_number === n);
      const occ = room?.reception_status_id ?? room?.default_status ?? null;
      const dndId = receptionStatuses.find((x) => x.label === "DND")?.id ?? null;
      const hasDnd = !!dndId && occ === dndId;
      const openMaint = (maintenanceRequestsQ.data ?? []).filter(
        (m) => m.room_number === n && !m.done,
      );
      const openLp = lostPropertyOpenItems.filter((lp) => lp.room_number === n);
      const active = roomInfoTab?.room === n ? roomInfoTab.tab : null;
      return (
        <RoomInfoTiles
          roomNumber={n}
          hasDnd={hasDnd}
          openMaint={openMaint}
          openLp={openLp}
          active={active}
          onToggle={(tab) => setRoomInfoTab(active === tab ? null : { room: n, tab })}
          expandedRef={roomInfoExpandedRef}
        />
      );
    })()}


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
    <div className="flex-1 min-h-0 overflow-y-auto mt-3 space-y-4">
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
        className="flex items-center gap-3 py-2 px-3 rounded-xl border"
        style={colorStyle(item.color)}
     >
        <span
          className="flex-1 min-w-0 break-words"
          style={item.color ? { color: theme === "dark" ? "#f8fafc" : "#0f172a" } : undefined}
        >
          {item.name}
          {isPreferred(item.id, n) && (
            <span className="ml-2 text-xs font-semibold opacity-70">(Preferred)</span>
          )}
        </span>
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
      className="flex items-center gap-3 py-2 px-3 rounded-xl border"
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
    notify?: boolean;
  };
  const menuGroups: { id: string; title: string; items: MenuAction[] }[] = (() => {
    const actions: MenuAction[] = [];
    if (!menuIsFnbOnly && !isMaintenance) {
      actions.push({
        key: "undo",
        icon: Undo2,
        label: undoing ? "Undoing…" : "Undo last change",
        onClick: () => void runEmergencyUndo(),
      });
    }
    // Settings menu content is uniform across screen sizes. Larger screens also
    // surface End of shift / Departments on the home header, but they stay here too.
    if ((realIsAdmin || (realIsManager && hasHousekeeperRole)) && !isReception && !menuIsFnbOnly && isMobile) {
      actions.push({
        key: "end-of-shift",
        icon: ClipboardList,
        label: "Reports",
        onClick: () => void openReports(),
      });
    } else if (isMaintenance && isMobile) {
      actions.push({
        key: "end-of-shift",
        icon: ClipboardList,
        label: "Reports",
        onClick: () => void openReports(),
      });
    }
    if (isReception && isMobile) {
      actions.push({
        key: "print", icon: Printer, label: "Print",
        onClick: async () => {
          await ensureTodaysBackup();
          printRoomStatus(computeRoomStatus().rows, new Date());
        },
      });
      actions.push({ key: "help", icon: HelpCircle, label: "Help", onClick: () => setReceptionHelpOpen(true) });
    }
    const utilities: MenuAction[] = [];
    {
      utilities.push({
        key: "maintenance-log", icon: Wrench,
        label: "Maintenance Log",
        notify: hasOpenMaintenance,
        onClick: () => setMaintenanceLogOpen(true),
      });
    }
    {
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
    const developer: MenuAction[] = [];
    if (realIsDeveloper) {
      developer.push({ key: "leaderboard", icon: Trophy, label: "Leaderboard", onClick: () => setLeaderboardOpen(true) });
    }
    const linen: MenuAction[] = [];
    const locations: MenuAction[] = [];
    if ((menuHasHk || menuHasFnb) && !isMaintenance) {
      if (menuHasHk && !menuIsAdmin) {
        linen.push({ key: "linen-list-hk", icon: List, label: "Linen List", onClick: () => { setLinenListType("housekeeping"); setTemplateOpen(true); } });
      }
    }
    if (menuIsAdmin && !isMaintenance) {
      locations.push({ key: "manage-rooms", icon: Hash, label: "Room Management", onClick: () => setManageRoomsOpen(true) });
      locations.push({ key: "hotel-areas", icon: MapPin, label: "Public & Hotel Areas", onClick: () => setMaintenanceAreasOpen(true) });
      linen.push({
        key: "delivery",
        icon: Truck,
        label: "Inventory & Stock",
        onClick: () => {
          qc.invalidateQueries({ queryKey: ["delivery_counts"] });
          qc.invalidateQueries({ queryKey: ["inventory_counts"] });
          setDeliveryOpen(true);
        },
      });
      if (!isReception) {
        actions.push({ key: "history", icon: History, label: "History", onClick: () => setHistorySheetOpen(true) });
      }
      locations.push({ key: "room-flags", icon: Flag, label: "Guest & Room Info", onClick: () => setRoomFlagsSheetOpen(true) });
    }
    if ((realIsAdmin || (realIsManager && hasHousekeeperRole)) && !isMaintenance) {
      linen.push({ key: "linen-days", icon: CalendarDays, label: "Delivery Schedule", onClick: () => setLinenDeliveryOpen(true) });
    }
    const account: MenuAction[] = [];
    // Also exposed as pills on the home header where the screen is wide enough.
    if (canViewAs && isMobile) {
      actions.push({ key: "departments", icon: LayoutGrid, label: "Departments", onClick: () => setRolePickerSheetOpen(true) });
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
      icon: ThemeGlyph,
      label: `Theme: ${levelLabel}`,
      onClick: () => cycleTheme(),
    }, {
      key: "accent",
      icon: Palette,
      label: `Accent: ${ACCENTS.find((a) => a.id === accent)?.label ?? "Brass"}`,
      onClick: () => cycleAccent(),
    }];
    const opsOrder = ["messages", "maintenance-log", "lost-property", "stayover-photos"];
    utilities.sort((a, b) => opsOrder.indexOf(a.key) - opsOrder.indexOf(b.key));
    const linenOrder = ["delivery", "linen-list", "linen-list-hk", "linen-days"];
    linen.sort((a, b) => linenOrder.indexOf(a.key) - linenOrder.indexOf(b.key));
    return [
      { id: "utilities", title: "Daily Operations", items: utilities },
      { id: "linen", title: "Linen Management", items: linen },
      { id: "locations", title: "Property Setup", items: locations },
      { id: "actions", title: "Actions", items: actions },
      { id: "account", title: "Account", items: account },
      { id: "appearance", title: "Appearance", items: appearance },
      { id: "developer", title: "Developer", items: developer },
    ].filter((g) => g.items.length > 0);
  })();

  // Pull the home screen down from the top to refetch everything on screen.
  const homeRefresh = useHomeRefresh(
    async () => {
      try {
        await qc.invalidateQueries({ refetchType: "active" }, { throwOnError: true });
        toast.success("Data synced");
      } catch {
        toast.error("Could not sync. Check your connection and pull again.");
      }
    },
    isMobile && !homeView && !menuTakeoverActive && !menuSheetOpen && !quickReceptionOpen && openRoom === null,
  );

  const allFlagDefs = mergeFlagDefs(flagSettingsQ.data ?? []);
  const customFlagRows = customFlagsQ.data ?? [];
  const roomFlagsCtx = {
    all: allFlagDefs,
    flags: allFlagDefs.filter((d) => !d.hidden),
    isOn: (room: Partial<Room> | undefined, roomNumber: number, def: FlagDef) =>
      def.custom
        ? customFlagRows.some((r) => r.room_number === roomNumber && r.flag_key === def.key)
        : !!(room as Record<string, unknown> | undefined)?.[def.key],
    toggle: (roomNumber: number, def: FlagDef, value: boolean) => {
      if (!def.custom) {
        const fn = {
          guest_vacated: setRoomGuestVacated,
          early_check_in: setRoomEarlyCheckIn,
          late_checkout: setRoomLateCheckout,
          stayover_out: setRoomStayoverOut,
          dog_box: setRoomDogBox,
        }[def.key as "dog_box"];
        void fn?.(roomNumber, value);
        return;
      }
      qc.setQueryData<typeof customFlagRows>(["room_custom_flags"], (old = []) =>
        value
          ? [...old, { id: "tmp-" + def.key + roomNumber, room_number: roomNumber, flag_key: def.key }]
          : old.filter((r) => !(r.room_number === roomNumber && r.flag_key === def.key)),
      );
      void (async () => {
        const res = value
          ? await supabase.from("room_custom_flags" as never).upsert({ room_number: roomNumber, flag_key: def.key } as never, { onConflict: "hotel_id,room_number,flag_key" })
          : await supabase.from("room_custom_flags" as never).delete().eq("room_number", roomNumber).eq("flag_key", def.key);
        if (res.error) toast.error(res.error.message);
        qc.invalidateQueries({ queryKey: ["room_custom_flags"] });
      })();
    },
  };

  return (
<RoomFlagsContext.Provider value={roomFlagsCtx}>
<RoomFlagsSheet open={roomFlagsSheetOpen} onOpenChange={setRoomFlagsSheetOpen} />
<main
  ref={homeRefresh.ref}
  data-home-refresh
  className="min-h-[100dvh] bg-background"
  style={{ paddingBottom: isMobile ? 0 : "max(1.5rem, env(safe-area-inset-bottom))" }}
>
{(homeRefresh.pull > 0 || homeRefresh.refreshing) && (
  <div
    role="status"
    aria-label={homeRefresh.refreshing ? "Syncing latest data" : "Pull to refresh"}
    className="flex items-center justify-center text-muted-foreground"
    style={{ height: homeRefresh.refreshing ? 28 : homeRefresh.pull }}
  >
    <Loader2
      className={"h-4 w-4 " + (homeRefresh.refreshing ? "animate-spin" : "")}
      aria-hidden
    />
  </div>
)}
<div
  className="max-w-2xl md:max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto pt-6 pb-2 sm:py-10 space-y-6 sm:space-y-10"
  style={{
    paddingLeft: "max(1rem, env(safe-area-inset-left))",
    paddingRight: "max(1rem, env(safe-area-inset-right))",
  }}
>
 {isMobile ? (
    <div
      data-mobile-topbar
      className="-mt-6 sticky top-0 z-40 border-b border-sidebar-border bg-sidebar text-sidebar-foreground shadow-elevation-1"
      style={{
        marginLeft: "calc(-1 * max(1rem, env(safe-area-inset-left)))",
        marginRight: "calc(-1 * max(1rem, env(safe-area-inset-right)))",
        paddingLeft: "max(1rem, env(safe-area-inset-left))",
        paddingRight: "max(0.5rem, env(safe-area-inset-right))",
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      <div data-mobile-topbar-row className="flex h-11 items-center justify-between gap-2">
        <h1 data-ios-title className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight">{hotelName}</h1>
        {isTablet && (((realIsAdmin || (realIsManager && hasHousekeeperRole)) && !isReception && !menuIsFnbOnly) || isMaintenance) && (
          <Button
            variant="ghost"
            size="sm"
            data-ios-glass
            data-reports
            aria-label="Reports"
            title="Back up today's data and print reports"
            className={cn("shrink-0 size-9 p-0 text-sidebar-foreground")}
            onClick={() => void openReports()}
          >
            <ClipboardList className="h-4 w-4" />
          </Button>
        )}
        {(isReception || isHousekeeper || (isAdmin && !isFnb && !isMaintenance)) && (
          <Button
            variant="ghost"
            size="sm"
            data-ios-glass
            data-quick-setup
            aria-label="Quick Room Setup"
            className={cn("shrink-0 size-9 p-0 text-sidebar-foreground", quickReceptionOpen && "text-sidebar-primary")}
            onClick={() => { if (quickReceptionOpen) setQuickReceptionOpen(false); else { closeHomePanels("quick"); setQuickReceptionOpen(true); } }}
          >
            <ConciergeBell className="h-4 w-4" />
          </Button>
        )}
        <div ref={setTopBarSlot} className="empty:hidden shrink-0 order-last" />
      </div>
    </div>
 ) : (
 <header className="flex items-start justify-between gap-3 flex-wrap rounded-2xl border border-primary/20 bg-sidebar px-4 pt-4 pb-3 sm:px-5 sm:pt-5 sm:pb-4 shadow-elevation-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-sidebar-primary">
              The Hotel <span className="text-sidebar-foreground">Hub</span>
            </p>
            <h1 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight text-sidebar-foreground">{hotelName}</h1>
          </div>
 <div className="flex items-center gap-2 [&_button]:border-sidebar-border [&_button]:bg-transparent [&_button]:text-sidebar-foreground [&_button:hover]:bg-sidebar-accent [&_button:hover]:text-sidebar-foreground">
    {!isMobile && ((isAdmin && !isReception) || isMaintenance) && (
      <Button
        variant="outline"
        size="sm"
        onClick={() => void openReports()}
        title="Back up today's data and print reports"
      >
        <ClipboardList className="h-4 w-4 mr-2" />
        Reports
      </Button>
    )}
    {(isReception || isHousekeeper || (isAdmin && !isFnb && !isMaintenance)) && (
      <Button
        variant="outline"
        size="sm"
        onClick={() => { if (quickReceptionOpen) setQuickReceptionOpen(false); else { closeHomePanels("quick"); setQuickReceptionOpen(true); } }}
        title="Set status, bed and flags for every room in one place"
      >
        <ConciergeBell className="h-4 w-4 sm:mr-2" />
        <span className="hidden sm:inline">Quick Setup</span>
      </Button>
    )}
    {!isMobile && isReception && (
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          await ensureTodaysBackup();
          printRoomStatus(computeRoomStatus().rows, new Date());
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
          className="absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-background"
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
              className="absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-background"
            />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {[
          ...menuGroups.filter((g) => g.id === "appearance"),
          ...menuGroups.filter((g) => g.id !== "appearance"),
        ].map((group, gi) => (
          <React.Fragment key={group.id}>
            {gi > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.title}
            </DropdownMenuLabel>
            {group.items.map((item) => {
              const Icon = item.icon;
              const keepOpen = item.key === "theme" || item.key === "accent";
              return (
                <DropdownMenuItem
                  key={item.key}
                  onSelect={(e) => {
                    if (keepOpen) e.preventDefault();
                    else if (item.key !== "signout") {
                      closeHomePanels();
                      armSheetTakeover();
                    }
                    item.onClick();
                  }}
                  className={item.destructive ? "text-destructive focus:text-destructive" : undefined}
                >
                  <Icon className={cn("h-4 w-4 mr-2", item.notify && "text-amber-500")} />
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
            <p className="basis-full -mt-2 text-xs text-sidebar-foreground/60 whitespace-pre-line">
              {isReception
                ? "An auto-updating room tracker for Housekeeping. Use the help button if you're stuck"
                : isFnb
                ? "Shared workspace for F&B staff"
                : isMaintenance
                ? "Shared workspace for Maintenance staff"
                : "Shared workspace for Housekeeping staff"}

            </p>
            {canViewAs && !isMobile && (
              <div className="basis-full w-full flex rounded-full border p-1 bg-background items-center">
                {availableViews.map((r) => {
                  const active = effectiveRole === r;
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
                        "flex-1 px-4 h-8 text-xs sm:text-sm rounded-full transition-colors whitespace-nowrap",
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
 </header>
 )}

 {/* Mobile role-picker sheet (triggered from the burger menu). */}
 {isMobile && canViewAs && (
   <Sheet open={rolePickerSheetOpen} onOpenChange={setRolePickerSheetOpen}>
     <SheetContent side="bottom" className="overflow-y-auto rounded-t-2xl p-4 sm:p-6">
       <SheetHeader className="text-left">
         <SheetTitle>Department</SheetTitle>
         <SheetDescription>Switch between your assigned departments.</SheetDescription>
       </SheetHeader>
       <div className="mt-4 grid gap-2">
         {availableViews.map((r) => {
           const active = effectiveRole === r;
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
            setInvRoomsPrintOpen(true);
          }}
        >
          <Bed className="h-4 w-4 mr-2" />
          Room inventory
        </Button>
        <Button
          variant="outline"
          className="justify-start h-12"
          onClick={() => {
            setEndShiftPrintOpen(false);
            setInvCupboardsPrintOpen(true);
          }}
        >
          <LayoutGrid className="h-4 w-4 mr-2" />
          Floor inventory
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
    linenDeliveryDays={linenDeliveryDays}
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
    open={invRoomsPrintOpen}
    onOpenChange={setInvRoomsPrintOpen}
    snapshots={snapshots}
    linenDeliveryDays={linenDeliveryDays}
    kind="inventory_rooms"
    title="Room inventory"
    liveRows={computeInventoryTotals("room").rows}
    printTotals={(rows, grand, when, footer) =>
      printTotals(rows, grand, when, "inventory_rooms", undefined, footer)
    }
    onBack={() => {
      setInvRoomsPrintOpen(false);
      setEndShiftPrintOpen(true);
    }}
  />
  <SnapshotPrintDialog
    open={invCupboardsPrintOpen}
    onOpenChange={setInvCupboardsPrintOpen}
    snapshots={snapshots}
    linenDeliveryDays={linenDeliveryDays}
    kind="inventory_cupboards"
    title="Floor inventory"
    liveRows={computeInventoryTotals("cupboard").rows}
    printTotals={(rows, grand, when, footer) =>
      printTotals(rows, grand, when, "inventory_cupboards", undefined, footer)
    }
    onBack={() => {
      setInvCupboardsPrintOpen(false);
      setEndShiftPrintOpen(true);
    }}
  />
  <SnapshotPrintDialog
    open={deliveryPrintOpen}
    onOpenChange={setDeliveryPrintOpen}
    snapshots={snapshots}
    linenDeliveryDays={linenDeliveryDays}
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
    linenDeliveryDays={linenDeliveryDays}
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
    setTemplateOpen={(o) => { setTemplateOpen(o); if (!o && manageBackRef.current) { manageBackRef.current = false; if (isTakeoverReplacing()) return; armSheetTakeover(); setManageRoomsOpen(true); } }}
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
  <HomeInline active={!isReception && openRoom !== null && notesSheetRoom === openRoom} target={roomViewBodyEl} noFit>
  <RoomNotesSheet
    inlineView={!isReception && openRoom !== null && notesSheetRoom === openRoom}
    notesSheetRoom={notesSheetRoom}
    setNotesSheetRoom={setNotesSheetRoom}
    rooms={rooms}
    activeMessagesByRoom={activeMessagesByRoom}
    canUseMessages={canUseMessages}
    isReception={isReception}
    setMessagesInitial={setMessagesInitial}
    setMessagesSheetOpen={setMessagesSheetOpen}
    setRoomEarlyCheckIn={setRoomEarlyCheckIn}
    setRoomLateCheckout={setRoomLateCheckout}
    setRoomGuestVacated={setRoomGuestVacated}
    setRoomStayoverOut={setRoomStayoverOut}
    setRoomDogBox={setRoomDogBox}
    confirmHousekeepingNote={confirmHousekeepingNote}
    setRoomHousekeepingNote={setRoomHousekeepingNote}
    deleteRoomMessage={deleteRoomMessage}
    newMessageText={newMessageText}
    setNewMessageText={setNewMessageText}
    submitRoomMessage={submitRoomMessage}
    confirmRoomMessage={confirmRoomMessage}
    dismissRoomMessage={dismissRoomMessage}
    onLogMaintenance={(n) => {
      setNewMaintenanceRoom(String(n));
      if (isIosMobileView()) {
        setMaintenanceComposeRoom(n);
        return;
      }
      setMaintenanceComposerOpen(true);
      setMaintenanceLogOpen(true);
    }}
    onLogLostProperty={(n) => {
      if (isIosMobileView()) {
        setLostComposeRoom(n);
        return;
      }
      setLostPropertyInitialRoom(n);
      setLostPropertyOpen(true);
    }}
    onMessageReception={(n) => {
      setMessagesInitial({ thread: "hk_reception", room: n });
      setMessagesSheetOpen(true);
    }}
    hasDnd={(() => {
      if (notesSheetRoom === null) return false;
      const room = rooms.find((r) => r.room_number === notesSheetRoom);
      const occ = room?.reception_status_id ?? room?.default_status ?? null;
      const dndId = receptionStatuses.find((x) => x.label === "DND")?.id ?? null;
      return !!dndId && occ === dndId;
    })()}
    openMaintenance={(maintenanceRequestsQ.data ?? []).filter(
      (m) => m.room_number === notesSheetRoom && !m.done,
    )}
    openLostProperty={lostPropertyOpenItems.filter((lp) => lp.room_number === notesSheetRoom)}
  />
  </HomeInline>


 {/* Reception sheet (Admin/User): Done + Status + Bed */}
  <HomeInline active={!isReception && openRoom !== null && receptionSheetRoom === openRoom} target={roomViewBodyEl} noFit>
  <ReceptionStatusSheet
    inlineView={!isReception && openRoom !== null && receptionSheetRoom === openRoom}
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
    setRoomEarlyCheckIn={setRoomEarlyCheckIn}
    setRoomLateCheckout={setRoomLateCheckout}
    setRoomDogBox={setRoomDogBox}
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
    closeRoomView={closeRoomView}

  />
  </HomeInline>

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
<HomeInline active={homeView === "messages"} target={homeSlotEl}>
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
</HomeInline>
<HomeInline active={homeView === "lost"} target={homeSlotEl}>
<LostPropertySheet
  open={lostPropertyOpen}
  onOpenChange={(o) => {
    setLostPropertyOpen(o);
    if (!o) setLostPropertyInitialRoom(null);
  }}
  initialAddRoom={lostPropertyInitialRoom}
  openComposerOnOpen={lostPropertyInitialRoom !== null}
  canResolve={canResolveLostProperty}
  isAdmin={menuIsAdmin}
  currentUsername={authUser?.username ?? null}
  canAdd={menuCanUseLostProperty}
  requireRoom={hasHousekeeperRole && !hasReceptionRole}
  scope={logScope}
  departments={menuIsAdmin || hasReceptionRole ? null : myMessageDepartments}
  areaLabels={maintenanceAreas.map((a) => a.label)}
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
</HomeInline>
{/* iOS: centred compose-only popup when logging from the room hub */}
<LostPropertySheet
  open={lostComposeRoom !== null}
  onOpenChange={(o) => { if (!o) setLostComposeRoom(null); }}
  composeOnly
  contentClassName={IOS_CENTRED_POPUP}
  initialAddRoom={lostComposeRoom}
  openComposerOnOpen
  canResolve={canResolveLostProperty}
  isAdmin={menuIsAdmin}
  currentUsername={authUser?.username ?? null}
  canAdd={menuCanUseLostProperty}
  requireRoom={hasHousekeeperRole && !hasReceptionRole}
  scope={logScope}
  departments={menuIsAdmin || hasReceptionRole ? null : myMessageDepartments}
  areaLabels={maintenanceAreas.map((a) => a.label)}
  roomNumbers={rooms.map((r) => r.room_number).sort((a, b) => a - b)}
  onAdd={logLostProperty}
/>
<BroomBurst
  active={broomBurstActive}
  onDone={() => setBroomBurstActive(false)}
/>
<CelebrationBurst
  active={celebrationActive}
  onDone={() => setCelebrationActive(false)}
/>
<GloomBurst
  active={gloomActive}
  onDone={() => setGloomActive(false)}
/>
<HomeInline active={homeView === "stayover"} target={homeSlotEl}>
<LeaderboardSheet open={leaderboardOpen} onOpenChange={setLeaderboardOpen} hotelId={currentHotelQ.data?.id} />
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
</HomeInline>
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
  <SheetContent side="right" disableDragDismiss className="app-menu-screen w-auto max-w-[90vw] min-w-[18rem] sm:max-w-md p-0 flex flex-col overflow-hidden [&_[data-sheet-close]]:max-lg:hidden">
    <SheetHeader className="relative text-left shrink-0 px-4 max-lg:px-0 max-lg:pt-0 max-lg:bg-transparent ios-menu-header sm:px-6 pt-4 sm:pt-6 pb-3 bg-background border-b">
      <SheetTitle className="sr-only">Menu</SheetTitle>

      {authUser && (
        <SheetDescription className="flex items-center gap-2.5">
          <NamedAvatar name={authUser.username} className="h-9 w-9 text-base" />
          <span>Signed in as {authUser.username}</span>
        </SheetDescription>
      )}
    </SheetHeader>
    <div className="flex-1 min-h-0 overflow-y-auto px-4 max-lg:px-0 sm:px-6 py-4 sm:py-6">
    {(() => {
      const Row = ({
        icon: Icon,
        label,
        onClick,
        destructive,
        notify,
      }: { icon: React.ComponentType<{ className?: string }>; label: React.ReactNode; onClick: () => void; destructive?: boolean; notify?: boolean }) => (
        <button
          type="button"
          onClick={onClick}
          data-ios-row
          className={cn(
            "w-full flex items-center gap-3 rounded-xl border bg-background px-4 min-h-12 text-sm font-medium shadow-elevation-1 transition-[transform,box-shadow,background-color] duration-150 hover:bg-accent active:scale-[0.985] active:shadow-none",
            destructive && "text-destructive hover:text-destructive",
          )}
        >
          <span data-ios-icon className="shrink-0"><Icon className={cn("h-4 w-4 shrink-0", notify && "text-amber-500")} /></span>
          <span className="text-left flex-1">{label}</span>
          <ChevronRight data-ios-chevron className="hidden h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />
        </button>
      );
      const close = () => setMenuSheetOpen(false);
      const Section = ({
        id,
        title,
        children,
      }: { id: string; title: string; children: React.ReactNode }) => {
        const collapsed = isMenuCollapsed(id);
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
            {!collapsed && <div data-ios-group className="space-y-1.5">{children}</div>}
          </div>
        );
      };
      return (
        <div className="space-y-4">
          <div className="space-y-2">
          <div className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Theme/Accent</div>
          <div className="grid grid-cols-2 gap-1 rounded-full border bg-muted p-1">
            <button
              type="button"
              onClick={() => cycleTheme()}
              className="flex min-w-0 items-center justify-center gap-2 rounded-full bg-background px-3 py-2 text-sm font-medium shadow-sm active:scale-[0.98]"
            >
              <ThemeGlyph className="h-4 w-4 shrink-0" />
              <span className="truncate">{levelLabel}</span>
            </button>
            <button
              type="button"
              onClick={() => cycleAccent()}
              className="flex min-w-0 items-center justify-center gap-2 rounded-full bg-background px-3 py-2 text-sm font-medium shadow-sm active:scale-[0.98]"
            >
              <span className="h-3.5 w-3.5 shrink-0 rounded-full bg-brass" aria-hidden />
              <span className="truncate">{ACCENTS.find((a) => a.id === accent)?.label ?? "Brass"}</span>
            </button>
          </div>
          </div>
          {menuGroups.filter((g) => g.id !== "appearance").map((group) => ({ ...group, items: group.items.filter((i) => i.key !== "theme" && i.key !== "accent") })).filter((g) => g.items.length > 0).map((group) => (
            <Section key={group.id} id={group.id} title={group.title}>
              {group.items.map((item) => (
                <Row
                  key={item.key}
                  icon={item.icon}
                  label={item.label}
                  destructive={item.destructive}
                  notify={item.notify}
                  onClick={() => { close(); if (item.key !== "signout" && item.key !== "theme" && item.key !== "accent") { closeHomePanels(); armSheetTakeover(); } item.onClick(); }}
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
  <SheetContent side="bottom" className="overflow-y-auto rounded-t-2xl p-4 sm:p-6">
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

<HomeInline active={homeView === "maintenance"} target={homeSlotEl}>
<MaintenanceLogSheet
  open={maintenanceLogOpen}
  onOpenChange={setMaintenanceLogOpen}
  rooms={rooms}
  maintenanceRequests={maintenanceRequests}
  maintenanceMessages={roomMessages}
  markMessageDone={markMaintenanceMessageDone}
  deleteMessage={deleteRoomMessage}
  maintenanceAreas={maintenanceAreas}
  scope={logScope}
  composeOnly={isMaintenanceOnlyUser}
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
  newMaintenanceUrgent={newMaintenanceUrgent}
  setNewMaintenanceUrgent={setNewMaintenanceUrgent}
  setMaintenanceUrgent={setMaintenanceUrgent}

  setNewMaintenanceText={setNewMaintenanceText}
  newMaintenancePhotos={newMaintenancePhotos}
  setNewMaintenancePhotos={setNewMaintenancePhotos}
  submitMaintenanceRequest={submitMaintenanceRequest}
  markMaintenanceDone={markMaintenanceDone}
  deleteMaintenanceRequest={deleteMaintenanceRequest}
  setMaintenancePhotoPaths={setMaintenancePhotoPaths}
/>
</HomeInline>

{/* iOS: centred compose-only popup when logging from the room hub */}
<MaintenanceLogSheet
  open={maintenanceComposeRoom !== null}
  onOpenChange={(o) => { if (!o) setMaintenanceComposeRoom(null); }}
  rooms={rooms}
  maintenanceRequests={maintenanceRequests}
  maintenanceAreas={maintenanceAreas}
  scope={logScope}
  composeOnly
  contentClassName={IOS_CENTRED_POPUP}
  hasOpenMaintenance={hasOpenMaintenance}
  openMaintenanceCount={openMaintenanceCount}
  isReception={isReception}
  isMaintenance={isMaintenance}
  isAdmin={isAdmin}
  authUsername={authUser?.username}
  maintenanceComposerOpen={true}
  setMaintenanceComposerOpen={() => {}}
  newMaintenanceRoom={newMaintenanceRoom}
  setNewMaintenanceRoom={setNewMaintenanceRoom}
  newMaintenanceText={newMaintenanceText}
  setNewMaintenanceText={setNewMaintenanceText}
  newMaintenanceUrgent={newMaintenanceUrgent}
  setNewMaintenanceUrgent={setNewMaintenanceUrgent}
  newMaintenancePhotos={newMaintenancePhotos}
  setNewMaintenancePhotos={setNewMaintenancePhotos}
  submitMaintenanceRequest={async () => {
    const okLocation = newMaintenanceRoom.startsWith("area:") || Number(newMaintenanceRoom) > 0;
    const hasText = !!newMaintenanceText.trim();
    await submitMaintenanceRequest();
    if (okLocation && hasText) setMaintenanceComposeRoom(null);
  }}
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
  showAll={realIsAdmin}
  setViewingSnapshot={setViewingSnapshot}
  removeSnapshot={removeSnapshot}
  clearAllSnapshots={clearAllSnapshots}
/>

<HomeInline active={!isReception && openRoom !== null && editDefaultsSheetRoom === openRoom} target={roomViewBodyEl} noFit>
<EditRoomDefaultsSheet
   inlineView={!isReception && openRoom !== null && editDefaultsSheetRoom === openRoom}
   editDefaultsSheetRoom={editDefaultsSheetRoom}
   isPreferred={isPreferred}
   togglePreferred={togglePreferred}
   setEditDefaultsSheetRoom={setEditDefaultsSheetRoom}
   template={template}
   isAssigned={isAssigned}
   toggleAssignment={toggleAssignment}
 />
 </HomeInline>

 {/* Room Types sheet (Admin) */}
  <RoomTypesSheet
    open={roomTypesSheetOpen}
    onOpenChange={(o) => { setRoomTypesSheetOpen(o); if (!o && manageBackRef.current) { manageBackRef.current = false; if (isTakeoverReplacing()) return; armSheetTakeover(); setManageRoomsOpen(true); } }}
    roomTypes={roomTypes}
    onMove={moveRoomType}
    onRename={renameRoomType}
    onDelete={deleteRoomType}
    onAdd={() => setAddRoomTypeOpen(true)}
  />

  {/* Room Features sheet (Admin) */}
  <RoomFeaturesSheet
    open={roomFeaturesSheetOpen}
    onOpenChange={(o) => { setRoomFeaturesSheetOpen(o); if (!o && manageBackRef.current) { manageBackRef.current = false; if (isTakeoverReplacing()) return; armSheetTakeover(); setManageRoomsOpen(true); } }}
    roomFeatures={roomFeatures}
    onMove={moveRoomFeature}
    onRename={renameRoomFeature}
    onDelete={deleteRoomFeature}
    onAdd={() => setAddRoomFeatureOpen(true)}
  />

  {/* Reception items sheet (Admin) */}
  <ReceptionItemsSheet
    open={receptionItemsSheetOpen}
    onOpenChange={(o) => { setReceptionItemsSheetOpen(o); if (!o && manageBackRef.current) { manageBackRef.current = false; if (isTakeoverReplacing()) return; armSheetTakeover(); setManageRoomsOpen(true); } }}
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


  {/* Delivery counter dialog — number entry for large delivery batches. */}
  <InventoryDialog
    open={deliveryOpen}
    onOpenChange={(o) => {
      setDeliveryOpen(o);
      if (o) {
        qc.invalidateQueries({ queryKey: ["delivery_counts"] });
        qc.invalidateQueries({ queryKey: ["inventory_counts"] });
      }
    }}
    template={template}
    theme={theme}
    roomNumbers={[...rooms].map((r) => r.room_number).sort((x, y) => x - y)}
    getCount={getInventoryCount}
    setCount={(sec, loc, id, v) => void setInventoryCount(sec, loc, id, v)}
    onResetSection={(sec, loc) => void resetInventorySection(sec, loc)}
    onExport={exportInventory}
    isRoomDefault={(id, rn) => isPreferred(id, rn) || isAssigned(id, rn)}
    isPreferred={isPreferred}
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
    setRoomTypesSheetOpen={(v) => { manageBackRef.current = true; armSheetTakeover({ closeLabel: "Back" }); setRoomTypesSheetOpen(v); }}
    setRoomFeaturesSheetOpen={(v) => { manageBackRef.current = true; armSheetTakeover({ closeLabel: "Back" }); setRoomFeaturesSheetOpen(v); }}
    setReceptionItemsSheetOpen={(v) => { manageBackRef.current = true; armSheetTakeover({ closeLabel: "Back" }); setReceptionItemsSheetOpen(v); }}
    openLinenList={() => { manageBackRef.current = true; armSheetTakeover({ closeLabel: "Back" }); setLinenListType("housekeeping"); setTemplateOpen(true); }}
    setEditRoomSheetNumber={setEditRoomSheetNumber}
    addRoom={addRoom}
    removeRoom={removeRoom}
    moveRoom={moveRoom}
  />

 {quickSetupInline && <div ref={setQuickSlotEl} className="mb-4" />}

 {/* Rooms */}
 {homeView && <div ref={setHomeSlotEl} className="mb-4" />}
 <div ref={setSheetTakeoverSlot} className="[&:not(:empty)]:mb-4" />
 <div className={homeView || quickSetupInline || menuTakeoverActive ? "hidden" : undefined}>
 {isMaintenance ? (
<MaintenanceDashboard
     maintenanceRequests={maintenanceRequests}
     roomMessages={roomMessages}
     openMaintenanceCount={openMaintenanceCount}
     markMaintenanceDone={markMaintenanceDone}
     setMaintenanceUrgent={setMaintenanceUrgent}

     qc={qc}
     setMessagesInitial={setMessagesInitial}
     setMessagesSheetOpen={setMessagesSheetOpen}
     onLogNewIssue={() => {
       setMaintenanceComposerOpen(true);
       setMaintenanceLogOpen(true);
     }}
   />
 ) : isFnb ? (
   <section className="space-y-4">
     <div className="flex items-baseline justify-between gap-2">
       <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
         LINEN COUNTER
       </h2>
       <button
         type="button"
         onClick={() => {
           manageBackRef.current = false;
           closeHomePanels();
           armSheetTakeover();
           setLinenListType("fnb");
           setTemplateOpen(true);
         }}
         className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border bg-background px-3 text-xs font-medium leading-none text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
       >
         <Pencil className="h-3.5 w-3.5" />
         Edit linen list
       </button>
     </div>

      {templateFnbList.length === 0 ? (
       <p className="text-sm text-muted-foreground">
          No F&amp;B linen items yet. Use "Edit linen list" to add some.
       </p>

     ) : (
       <>
       <ul className="space-y-2">
          {templateFnbList.map((item) => (
           <CountRow
             key={item.id}
             item={item}
             theme={theme}
             count={fnbCountByItem.get(item.id) ?? 0}
             setCount={(v) => void setFnbCount(item.id, Math.max(0, v))}
           />
         ))}
       </ul>
       <div className="mt-[5px] flex items-center justify-between gap-2 border rounded-xl bg-background/60 px-3 py-2 text-sm">
         <span className="text-muted-foreground">
           F&amp;B total:{" "}
           <span className="font-semibold text-foreground tabular-nums">
             {templateFnbList.reduce((s, t) => s + (fnbCountByItem.get(t.id) ?? 0), 0)}
           </span>
         </span>
         <div className="flex items-center gap-2">
           <Button
             variant="ghost"
             size="sm"
             className="text-destructive hover:text-destructive"
             onClick={async () => {
               if (!confirm("Reset all F&B counts?")) return;
               for (const t of templateFnbList) {
                 if ((fnbCountByItem.get(t.id) ?? 0) !== 0) await setFnbCount(t.id, 0);
               }
             }}
           >
             Reset
           </Button>
           <Button variant="outline" size="sm" onClick={() => void openFnbExport()}>
             Export & Print
           </Button>
         </div>
       </div>
       </>
     )}
   </section>
 ) : (
  <section className="space-y-4">


 <div className="relative flex items-center justify-between">
 {isReception && <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
 Rooms
 </h2>}
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
          <div data-ios-glass className="absolute left-1/2 -translate-x-1/2 inline-flex items-center rounded-lg border border-input bg-background shadow-sm overflow-hidden">
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
          <div data-ios-glass className="inline-flex items-center rounded-lg border border-input bg-background shadow-sm overflow-hidden">
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
              const isIOSFilters = isMobile && typeof document !== "undefined" && document.documentElement.dataset.platform === "ios";
              if (isIOSFilters) {
                return (
                  <>
                    <span
                      className="contents"
                      onClick={(e) => {
                        const r = (e.currentTarget.firstElementChild as HTMLElement | null)?.getBoundingClientRect();
                        setHkFiltersAnchor(r ? { top: r.bottom + 8, left: r.left } : null);
                        setHkFiltersOpen((o) => !o);
                      }}
                    >
                      {triggerBtn}
                    </span>
                    {hkFiltersOpen && createPortal(
                      <div className="fixed inset-0 z-[60]" onClick={() => setHkFiltersOpen(false)}>
                        <div
                          data-ios-progress-pop
                          data-ios-filters-pop
                          role="dialog"
                          aria-label="Filter rooms"
                          onClick={(e) => e.stopPropagation()}
                          className="absolute w-[min(18rem,calc(100vw-1.5rem))] max-h-[65dvh] overflow-y-auto rounded-[22px] p-4 text-sidebar-foreground [&_.text-muted-foreground]:text-sidebar-foreground/70 [&_label:hover]:bg-sidebar-foreground/10"
                          style={{ top: hkFiltersAnchor?.top ?? 120, left: Math.max(12, hkFiltersAnchor?.left ?? 12) }}
                        >
                          <div className="flex items-baseline justify-between pb-2">
                            <span className="text-[15px] font-semibold">Filter rooms</span>
                            <span className="text-xs opacity-70">{totalActive === 0 ? "Select multiple" : `${totalActive} active`}</span>
                          </div>
                          {body}
                        </div>
                      </div>,
                      document.body,
                    )}
                  </>
                );
              }
              return isMobile ? (
                <Sheet open={hkFiltersOpen} onOpenChange={setHkFiltersOpen}>
                  <SheetTrigger asChild>{triggerBtn}</SheetTrigger>
                  <SheetContent side="bottom" className="overflow-y-auto rounded-t-2xl p-4 sm:p-6">
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
        data-ios-glass
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
          data-ios-glass
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
 <div ref={setRoomGridEl} className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8 xl:grid-cols-10 gap-2 md:gap-3">
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
    const bedLabelById = new Map<string, string>();
    for (const b of receptionBeds) bedLabelById.set(b.id, b.label);
    for (const c of counts) if ((c.count ?? 0) > 0) countedRooms.add(c.room_number);
   const openIdx = openRoom !== null ? visibleRooms.indexOf(openRoom) : -1;
   const slotAfter =
     openIdx >= 0
       ? Math.min(visibleRooms.length - 1, (Math.floor(openIdx / roomGridCols) + 1) * roomGridCols - 1)
       : -1;
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
         bedLabel={room?.reception_bed_id ? bedLabelById.get(room.reception_bed_id) ?? null : null}
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
         openBack={false}
         onLongPress={() => { clearRoomTabs(); setOpenRoom(n); setReceptionSheetRoom(n); }}
         done={done}
         openTypeLabel={isOpen ? categoryLabel(roomCategory(n), roomTypes) : null}
         openBedLabel={isOpen ? (() => {
           const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
           const cats = parseCats(room?.category).map(norm);
           const onlyDouble = cats.includes("double") && !cats.includes("superking");
           if (onlyDouble) return null;
           return receptionBeds.find((b) => b.id === room?.reception_bed_id)?.label ?? null;
         })() : null}
       />,
     );
   }
   if (i === slotAfter) {
     nodes.push(
       <div key="room-inline-slot" data-room-slot ref={setRoomSlotEl} className="col-span-full" />,
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
                  // Dirty rooms are hidden from the visible count, and they don't
                  // hold the bar back either — the bar fills once everything else
                  // is done (leftover Dirty rooms change the outcome animation).
                  const dirtyProgressId =
                    receptionStatuses.find((s) => s.label.toLowerCase() === "dirty")?.id ?? null;
                  const eligible = rooms.filter((r) => {
                    const sid = r.reception_status_id ?? r.default_status;
                    const statusLabel = sid ? (statusLabelById.get(sid) ?? sid).toLowerCase() : "";
                     if (excludedProgressStatuses.has(statusLabel)) return false;
                     if (dndId && sid === dndId) return false;
                     if (dirtyProgressId && sid === dirtyProgressId && !(r.done || r.done_reception))
                       return false;
                     return true;
                  });
                 const total = eligible.length;
                 const progress = eligible.filter((r) => r.done || r.done_reception).length;
                const pct = total > 0 ? Math.min(100, (progress / total) * 100) : 0;
                const isComplete = total > 0 && progress >= total;
                  const progressBar = (
                        <div className={`${isMobile ? "pr-2" : "mt-3"} space-y-1.5 max-lg:space-y-1 ${isMobile ? "" : "rounded-2xl border border-sidebar-border bg-sidebar px-4 py-2 shadow-elevation-2 lg:px-5"}`}>
                     <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.18em] text-sidebar-foreground/60">
                       <span className="flex items-center gap-1.5">
                         {isComplete ? (
                           <Check className="h-3.5 w-3.5 text-room-complete-accent" />
                         ) : (
                           <House className="h-3.5 w-3.5 text-sidebar-primary" />
                         )}
                         Rooms progress
                       </span>
                       <span className="tabular-nums text-sidebar-primary">{progress} of {total}</span>
                     </div>
                     <div
                       role="button"
                       data-touch-exempt
                       tabIndex={-1}
                       onClick={handleProgressTap}
                       className="relative h-3 max-lg:h-4 w-full overflow-hidden rounded-full bg-sidebar-accent shadow-elevation-1 cursor-pointer select-none active:scale-[0.99] transition-transform"
                     >
                      <div
                        className={cn(
                          "h-full rounded-full transition-[width,background-color] duration-500 ease-out",
                          isComplete && "bg-room-complete-accent",
                        )}
                        style={{
                          width: `${pct}%`,
                          backgroundColor: isComplete
                            ? undefined
                            : pct < 30
                              ? "var(--color-room-todo-accent)"
                              : pct < 70
                                ? "var(--color-room-progress-accent)"
                                : "var(--brass)",
                        }}
                      />
                      {isComplete && (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-bold uppercase tracking-[0.25em] text-ink">
                          Complete
                        </div>
                      )}
                    </div>
                  </div>
                );
                  if (isMobile && topBarSlot) {
                    const r = 13;
                    const c = 2 * Math.PI * r;
                    const ringColour = isComplete
                      ? "var(--color-room-complete-accent)"
                      : pct < 30
                        ? "var(--color-room-todo-accent)"
                        : pct < 70
                          ? "var(--color-room-progress-accent)"
                          : "var(--brass)";
                    const ring = (
                      <button
                        type="button"
                        data-touch-exempt
                        onClick={() => { handleProgressTap(); setProgressSheetOpen(true); }}
                        data-ios-glass
                        aria-label={`Rooms progress: ${progress} of ${total} done`}
                        data-ios-ring-pill
                        className="flex h-9 items-center gap-1.5 rounded-full pl-1 pr-3 active:scale-95 transition-transform"
                      >
                        <span className="relative flex h-7 w-7 shrink-0 items-center justify-center">
                        <svg viewBox="0 0 32 32" className="absolute inset-0 h-full w-full -rotate-90">
                          <circle cx="16" cy="16" r={r} fill="none" strokeWidth="3.5" className="stroke-sidebar-accent" />
                          <circle
                            cx="16" cy="16" r={r} fill="none" strokeWidth="3.5" strokeLinecap="round"
                            stroke={ringColour}
                            strokeDasharray={c}
                            strokeDashoffset={c - (c * pct) / 100}
                            style={{ transition: "stroke-dashoffset 500ms ease-out, stroke 500ms" }}
                          />
                        </svg>
                        {isComplete && <Check className="relative h-3.5 w-3.5 text-room-complete-accent" />}
                        </span>
                        <span className="text-sm font-semibold tabular-nums text-sidebar-foreground">
                          {progress}/{total}
                        </span>
                      </button>
                    );
                    const lblById = new Map(receptionStatuses.map((s) => [s.id, s.label.toLowerCase()]));
                    const bucketOf = (r: (typeof rooms)[number]): string => {
                      if (nrOnRooms.has(r.room_number)) return "stayover";
                      const sid = r.reception_status_id ?? r.default_status;
                      const l = sid ? (lblById.get(sid) ?? "") : "";
                      if (l === "staff" || l === "ros") return "rosstaff";
                      if (l === "dnd" || l.replace(/[^a-z]/g, "").startsWith("stay")) return "stayover";
                      if (["arrival", "dirty", "clean"].includes(l)) return l;
                      if (l) return "progress";
                      return counts.some((c) => c.room_number === r.room_number && (c.count ?? 0) > 0) ? "progress" : "not_started";
                    };
                    const tally = new Map<string, number>();
                    rooms.forEach((r) => { const b = bucketOf(r); tally.set(b, (tally.get(b) ?? 0) + 1); });
                    const countOf = (k: string) => tally.get(k) ?? 0;
                    const rows = [
                      { label: "Not started", value: countOf("not_started"), colour: "var(--color-room-todo-accent)" },
                      { label: "In progress", value: countOf("progress"), colour: "var(--brass)" },
                      { label: "Clean", value: countOf("clean"), colour: "var(--color-room-complete-accent)" },
                      { label: "Arrival", value: countOf("arrival"), colour: "var(--color-room-progress-accent)" },
                      { label: "Stayover", value: countOf("stayover"), colour: "var(--color-room-stayover-accent)" },
                      { label: "Dirty", value: countOf("dirty"), colour: "var(--color-room-dirty-accent)" },
                      { label: "ROS / Staff", value: countOf("rosstaff"), colour: "var(--color-room-staff-accent)" },
                    ];
                    const isIOSPlatform = typeof document !== "undefined" && document.documentElement.dataset.platform === "ios";
                    if (isIOSPlatform) {
                      return (
                        <>
                          {createPortal(ring, topBarSlot)}
                          {progressSheetOpen && createPortal(
                            <div className="fixed inset-0 z-[60]" onClick={() => setProgressSheetOpen(false)}>
                              <div
                                data-ios-progress-pop
                                role="dialog"
                                aria-label="Shift progress"
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-3 w-[min(18rem,calc(100vw-1.5rem))] rounded-[22px] p-4 text-sidebar-foreground"
                                style={{ top: "calc(env(safe-area-inset-top) + 3.75rem)" }}
                              >
                                <div className="flex items-baseline justify-between">
                                  <span className="text-[15px] font-semibold">Shift progress</span>
                                  <span className="text-xs opacity-70 tabular-nums">{progress}/{total}{isComplete ? " ✓" : ""}</span>
                                </div>
                                <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-sidebar-accent">
                                  <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, backgroundColor: ringColour }} />
                                </div>
                                <ul className="mt-3 divide-y divide-sidebar-foreground/10">
                                  {rows.map((row) => (
                                    <li key={row.label} className="flex items-center justify-between py-2.5 text-sm">
                                      <span className="flex items-center gap-2.5">
                                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.colour }} />
                                        {row.label}
                                      </span>
                                      <span className="font-semibold tabular-nums">{row.value}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>,
                            document.body,
                          )}
                        </>
                      );
                    }
                    return (
                      <>
                        {createPortal(ring, topBarSlot)}
                        <Sheet open={progressSheetOpen} onOpenChange={setProgressSheetOpen}>
                          <SheetContent side="bottom" className="max-lg:h-auto max-lg:max-h-[70dvh] rounded-t-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                            <SheetHeader className="text-left px-0">
                              <SheetTitle>Shift progress</SheetTitle>
                              <SheetDescription>{progress} of {total} rooms done{isComplete ? " — all complete" : ""}</SheetDescription>
                            </SheetHeader>
                            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, backgroundColor: ringColour }} />
                            </div>
                            <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
                              {rows.map((row) => (
                                <li key={row.label} className="flex items-center justify-between px-4 py-3 text-sm">
                                  <span className="flex items-center gap-2.5">
                                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.colour }} />
                                    {row.label}
                                  </span>
                                  <span className="font-semibold tabular-nums">{row.value} {row.value === 1 ? "room" : "rooms"}</span>
                                </li>
                              ))}
                            </ul>
                          </SheetContent>
                        </Sheet>
                      </>
                    );
                  }
                  return progressBar;
              })()
            )}
 </section>
 )}
 </div>
 </div>

 <HomeInline active={openRoom !== null} target={roomSlotEl} noFit>
 <Sheet open={openRoom !== null} onOpenChange={(o) => { if (!o) closeRoomView(); }}>
   <SheetContent side="bottom" className={cn("flex flex-col overflow-hidden rounded-t-2xl p-4 sm:p-6")}>
      <SheetHeader className="sr-only">
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
        if (!bedLabel || isReception) return null;
        return (
          <SheetDescription className="mt-0.5">Bed: {bedLabel}</SheetDescription>
        );
      })()}
     </SheetHeader>
      {!isReception && openRoom !== null && renderRoomNavigation(openRoom)}
      <div ref={setRoomViewBodyEl} data-room-view-body className="flex flex-col flex-1 min-h-0">
        <div hidden={roomSummaryHidden}>
          {openRoom !== null && renderRoomPanel(openRoom)}
        </div>
      </div>
   </SheetContent>
 </Sheet>
 </HomeInline>

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
    <SheetContent side="bottom" className="overflow-y-auto rounded-t-2xl p-4 sm:p-6">
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
  <HomeInline active={quickSetupInline} target={quickSlotEl}>
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
      late_checkout: r.late_checkout,
      stayover_out: r.stayover_out,
      dog_box: r.dog_box,
      done: r.done,
    }))}
    statuses={receptionStatuses
      .filter((s) => s.label !== "Staff" && s.label !== "DND")
      .map((s) => ({ id: s.id, label: s.label }))}
    beds={receptionBeds.map((b) => ({ id: b.id, label: b.label }))}
    onChangeStatus={setRoomReceptionStatus}
    onChangeBed={setRoomReceptionBed}
    onResetAll={isReception ? undefined : resetReceptionAll}
    flagsOnly={isReception}
    onChangeVacant={(n, v) => void setRoomGuestVacated(n, v)}
    onChangeEarlyCheckIn={(n, v) => void setRoomEarlyCheckIn(n, v)}
    onChangeLateCheckout={(n, v) => void setRoomLateCheckout(n, v)}
    onChangeStayoverOut={(n, v) => void setRoomStayoverOut(n, v)}
    onChangeDogBox={(n, v) => void setRoomDogBox(n, v)}
    onToggleDone={isReception ? undefined : (n) => void toggleHousekeepingDone(n)}
  />
  </HomeInline>
  <Dialog
    open={!!donePhotoTarget}
    onOpenChange={(open) => {
      if (!open && !donePhotoBusy) {
        setDonePhotoTarget(null);
        setDonePhotos([]);
      }
    }}
  >
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>Mark job as done</DialogTitle>
        <DialogDescription>
          Describe the work carried out (required). You can also add a photo of the finished work.
        </DialogDescription>
      </DialogHeader>
      <Textarea
        value={doneNotes}
        onChange={(e) => setDoneNotes(e.target.value.slice(0, 2000))}
        placeholder="e.g. Replaced shower cartridge and tested"
        rows={4}
        autoFocus
      />
      <PhotoComposer value={donePhotos} onChange={setDonePhotos} />
      <DialogFooter className="gap-2">
        <Button
          variant="outline"
          disabled={donePhotoBusy}
          onClick={() => { setDonePhotoTarget(null); setDonePhotos([]); setDoneNotes(""); }}
        >
          Cancel
        </Button>
        <Button
          disabled={donePhotoBusy || doneNotes.trim().length === 0}
          onClick={async () => {
            const id = donePhotoTarget;
            if (!id || !doneNotes.trim()) return;
            setDonePhotoBusy(true);
            await completeMaintenanceRequest(id, donePhotos, doneNotes.trim());
            setDonePhotoBusy(false);
            setDonePhotoTarget(null);
            setDonePhotos([]);
            setDoneNotes("");
          }}
        >
          {donePhotoBusy ? "Saving…" : "Complete"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  <div data-tabbar-spacer className="lg:hidden" style={{ height: "calc(3.5rem + env(safe-area-inset-bottom, 0px))" }} aria-hidden />
  {/* Mobile bottom tab bar: same five tabs for every department. */}
  <nav
    aria-label="Main"
    data-mobile-tabbar
    className="lg:hidden fixed inset-x-0 bottom-0 z-50 border-t border-sidebar-border bg-sidebar text-sidebar-foreground"
    style={{
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
      paddingLeft: "env(safe-area-inset-left, 0px)",
      paddingRight: "env(safe-area-inset-right, 0px)",
    }}
  >
    <div className="grid grid-cols-5 h-14">
      {(() => {
        const anyPanel = messagesSheetOpen || maintenanceLogOpen || lostPropertyOpen;
        const openTab = (key: "messages" | "maintenance" | "lost", open: () => void, isOpen: boolean) => {
          if (isOpen) { closeHomePanels(); return; }
          closeHomePanels(key);
          armSheetTakeover({ hideClose: window.innerWidth < 1024 });
          open();
        };
        const tabs = [
          {
            key: "home", label: "Home", icon: House, active: !anyPanel && !menuSheetOpen,
            onClick: () => {
              setMenuSheetOpen(false);
              closeHomePanels();
              if (openRoom !== null) closeRoomView();
              window.scrollTo({ top: 0, behavior: "smooth" });
            },
          },
          {
            key: "messages", label: "Messages", icon: MessageSquare, active: messagesSheetOpen,
            disabled: !canUseMessages,
            onClick: () => { setMenuSheetOpen(false); openTab("messages", () => { setMessagesInitial({}); setMessagesSheetOpen(true); }, messagesSheetOpen); },
          },
          {
            key: "maintenance", label: "Maintenance", icon: Wrench, active: maintenanceLogOpen, dot: hasOpenMaintenance,
            onClick: () => { setMenuSheetOpen(false); openTab("maintenance", () => setMaintenanceLogOpen(true), maintenanceLogOpen); },
          },
          {
            key: "lost", label: "Lost Property", icon: PackageSearch, active: lostPropertyOpen,
            onClick: () => { setMenuSheetOpen(false); openTab("lost", () => setLostPropertyOpen(true), lostPropertyOpen); },
          },
          {
            key: "more", label: "More", icon: Menu, active: menuSheetOpen,
            onClick: () => {
              if (window.innerWidth < 1024) {
                if (menuSheetOpen) return;
                closeHomePanels();
                armSheetTakeover({ hideClose: true });
              }
              window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
              setMenuSheetOpen(true);
            },
          },
        ];
        return tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              disabled={t.disabled}
              onClick={t.onClick}
              aria-current={t.active ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors disabled:opacity-40",
                t.active ? "text-sidebar-primary" : "text-sidebar-foreground/70",
              )}
            >
              <span className="relative" data-tab-icon>
                <Icon className="h-5 w-5" />
                {t.dot && (
                  <span className="absolute -top-0.5 -right-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-sidebar" />
                )}
              </span>
              <span className="leading-none truncate max-w-full px-1">{t.label}</span>
            </button>
          );
        });
      })()}
    </div>
  </nav>
 </main>
</RoomFlagsContext.Provider>
 );
}

// Renders a panel in place of the Home screen (via portal) when active.
// iPhone/iPad only: room-hub logging opens a centred compose popup.
const isIosMobileView = () =>
  typeof document !== "undefined" &&
  document.documentElement.dataset.platform === "ios" &&
  window.innerWidth < 1024;

// Centred card override for a bottom sheet on small screens (iOS popups).
const IOS_CENTRED_POPUP =
  "max-lg:left-4 max-lg:right-4 max-lg:top-1/2 max-lg:bottom-auto max-lg:w-auto max-lg:h-auto max-lg:max-h-[80dvh] max-lg:-translate-y-1/2 max-lg:rounded-3xl max-lg:border max-lg:data-[state=open]:animate-[sheet-pop-in_250ms_ease-out] max-lg:data-[state=closed]:animate-[sheet-pop-out_180ms_ease-in]";

// Display name for each view role, shared by the header pills and the picker.
const viewRoleLabel = (r: string): string =>
  r === "user" ? "Housekeeping"
  : r === "fnb" ? "F&B"
  : r === "reception" ? "Reception"
  : r === "admin" ? "Admin"
  : r === "maintenance" ? "Maintenance"
  : "Manager";

function HomeInline({
  active,
  target,
  noFit,
  children,
}: {
  active: boolean;
  target: HTMLElement | null;
  noFit?: boolean;
  children: React.ReactNode;
}) {
  const content = <SheetInlineProvider inline={active && !!target} noFit={noFit}>{children}</SheetInlineProvider>;
  return active && target ? createPortal(content, target) : content;
}
