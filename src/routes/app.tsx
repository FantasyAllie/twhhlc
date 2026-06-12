import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus, X, Menu, ArrowUp, ArrowDown, Pencil, Check, Trash2, Lock, Unlock, Sun, Moon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getToken, getStoredUser, clearSession } from "@/lib/auth-client";
import { setSession } from "@/lib/auth-client";
import { useServerFn } from "@tanstack/react-start";
import { updateMyPassword, updateMyUsername } from "@/lib/auth.functions";
import {
 DropdownMenu,
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
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/components/theme-provider";

export const Route = createFileRoute("/app")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Three Ways House Hotel Linen Counter" },
      { name: "description", content: "Count items per room across 50 rooms." },
    ],
  }),
  component: AppPage,
});

type Category = "double" | "super_king";
const CATEGORIES: { value: Category; label: string }[] = [
 { value: "double", label: "Double" },
 { value: "super_king", label: "Super King" },
];
const categoryLabel = (c: Category | null | undefined) =>
 CATEGORIES.find((x) => x.value === c)?.label ?? "Uncategorised";

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
type Room = { id: string; room_number: number; done: boolean; done_reception: boolean; category: Category | null };
type TemplateItemRoom = { id: string; template_item_id: string; room_number: number };
type SnapshotRow = { name: string; count: number };
type ExportSnapshot = {
  id: string;
  created_at: string;
  totals: SnapshotRow[];
  grand_total: number;
  kind?: "totals" | "rejects";
};
type RejectCount = { id: string; template_item_id: string; count: number };

function AppPage() {
 const qc = useQueryClient();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [authUser, setAuthUser] = useState(() => getStoredUser());
  useEffect(() => {
    if (!getToken() || !getStoredUser()) {
      navigate({ to: "/login", replace: true });
    }
    const onChange = () => setAuthUser(getStoredUser());
    window.addEventListener("tw-auth-changed", onChange);
    return () => window.removeEventListener("tw-auth-changed", onChange);
  }, [navigate]);
  useEffect(() => {
    if (authUser?.role === "reception") {
      document.title = "Three Ways House Hotel Room Checker";
    } else {
      document.title = "Three Ways House Hotel Linen Counter";
    }
  }, [authUser]);
  // Realtime: push room status changes to all signed-in clients (esp. reception)
  useEffect(() => {
    if (!authUser) return;
    const channel = supabase
      .channel("rooms-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms" },
        () => {
          qc.invalidateQueries({ queryKey: ["rooms"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [authUser, qc]);
  const signOut = () => {
    clearSession();
    navigate({ to: "/login", replace: true });
  };
  const [accountOpen, setAccountOpen] = useState(false);
 const [openRoom, setOpenRoom] = useState<number | null>(null);
 const [templateOpen, setTemplateOpen] = useState(false);
const [showAllLinen, setShowAllLinen] = useState<Record<number, boolean>>({});
const [linenLocked, setLinenLocked] = useState<boolean>(() => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("linen-locked") === "1";
});
useEffect(() => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("linen-locked", linenLocked ? "1" : "0");
}, [linenLocked]);
 const [categoriesOpen, setCategoriesOpen] = useState(false);
 const [newTemplateName, setNewTemplateName] = useState("");
 const [newTemplateCategory, setNewTemplateCategory] = useState<Category>("double");
 const [editingItemId, setEditingItemId] = useState<string | null>(null);
 const [editingItemName, setEditingItemName] = useState("");
 

 const [exportOpen, setExportOpen] = useState(false);
  const [viewingSnapshot, setViewingSnapshot] = useState<ExportSnapshot | null>(null);
  const [rejectsOpen, setRejectsOpen] = useState(false);
  const [rejectExportOpen, setRejectExportOpen] = useState(false);

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
        .select("id,room_number,done,done_reception,category")
 .order("room_number", { ascending: true });
 if (error) throw error;
 return (data ?? []) as Room[];
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

 const template = templateQ.data ?? [];
 const extras = extrasQ.data ?? [];
 const counts = countsQ.data ?? [];
 const rooms = roomsQ.data ?? [];
  const assignments = assignmentsQ.data ?? [];
  const snapshots = snapshotsQ.data ?? [];
  const rejects = (rejectsQ.data ?? []) as RejectCount[];

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
  const isReception = authUser?.role === "reception";
  const doneSet = new Set(
    rooms
      .filter((r) => (isReception ? r.done_reception : r.done))
      .map((r) => r.room_number),
  );
  const receptionDoneSet = new Set(
    rooms.filter((r) => r.done_reception).map((r) => r.room_number),
  );

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
          category: null,
        });
      return list;
    });
    const { error } = await supabase.from("rooms").upsert(
      { room_number: roomNumber, done_reception: next, updated_at: new Date().toISOString() },
      { onConflict: "user_id,room_number" },
    );
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["rooms"] });
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
 const category = newTemplateCategory;
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
  else list.push({ id: `temp-${roomNumber}`, room_number: roomNumber, done: true, done_reception: false, category: null });
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
 if (!confirm("Reset done state and counts for all rooms?")) return;
 qc.setQueryData<Room[]>(["rooms"], (old) =>
 old?.map((r) => ({ ...r, done: false, done_reception: false })) ?? [],
 );
 qc.setQueryData<RoomCount[]>(["room_counts"], () => []);
 const [r1, r2] = await Promise.all([
 supabase.from("rooms").update({ done: false, done_reception: false }).neq("room_number", -1),
 supabase.from("room_item_counts").delete().neq("room_number", -1),
 ]);
 if (r1.error) toast.error(r1.error.message);
 if (r2.error) toast.error(r2.error.message);
 qc.invalidateQueries({ queryKey: ["rooms"] });
 qc.invalidateQueries({ queryKey: ["room_counts"] });
 };

  // --- Export totals + snapshots ---
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

  const openExport = async () => {
    setExportOpen(true);
    const { rows, grand } = computeTotals();
    if (rows.length === 0) return;
    const { error } = await supabase
      .from("export_snapshots")
      .insert({ totals: rows, grand_total: grand, kind: "totals" } as never);
    if (error) {
      toast.error(error.message);
      return;
    }
    // Keep only the 6 most recent totals snapshots.
    const { data: keep } = await supabase
      .from("export_snapshots")
      .select("id")
      .eq("kind", "totals")
      .order("created_at", { ascending: false })
      .limit(6);
    const keepIds = (keep ?? []).map((s) => s.id);
    if (keepIds.length > 0) {
      await supabase
        .from("export_snapshots")
        .delete()
        .eq("kind", "totals")
        .not("id", "in", `(${keepIds.join(",")})`);
    }
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
    setRejectExportOpen(true);
    const { rows, grand } = computeRejectTotals();
    if (rows.length === 0) return;
    const { error } = await supabase
      .from("export_snapshots")
      .insert({ totals: rows, grand_total: grand, kind: "rejects" } as never);
    if (error) {
      toast.error(error.message);
      return;
    }
    const { data: keep } = await supabase
      .from("export_snapshots")
      .select("id")
      .eq("kind", "rejects")
      .order("created_at", { ascending: false })
      .limit(6);
    const keepIds = (keep ?? []).map((s) => s.id);
    if (keepIds.length > 0) {
      await supabase
        .from("export_snapshots")
        .delete()
        .eq("kind", "rejects")
        .not("id", "in", `(${keepIds.join(",")})`);
    }
    qc.invalidateQueries({ queryKey: ["export_snapshots"] });
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

 // --- Room category ---
 const setRoomCategory = async (roomNumber: number, category: Category) => {
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
  <div className="border rounded-md p-4 space-y-4 bg-muted/30">
   <div className="flex items-center">
     <span className="text-sm font-medium">{categoryLabel(cat)}</span>
   </div>

    {!isReception && (
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={() => toggleReceptionDone(n)}
          className={cn(
            "flex items-center justify-center gap-2 rounded-md border px-3 py-2 flex-1 text-sm font-medium transition-colors cursor-pointer",
            receptionDoneSet.has(n)
              ? "border-primary bg-primary/10 text-primary"
              : "border bg-card hover:bg-muted"
          )}
        >
          Mark as done (Reception)
        </button>
        <button
          type="button"
          onClick={() =>
            setShowAllLinen((prev) => ({ ...prev, [n]: !prev[n] }))
          }
          className={cn(
            "flex items-center justify-center gap-2 rounded-md border px-3 py-2 flex-1 text-sm font-medium transition-colors cursor-pointer",
            showAll
              ? "border-primary bg-primary/10 text-primary"
              : "border bg-card hover:bg-muted"
          )}
        >
          Show all linen
        </button>
      </div>
    )}

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
  className="h-8 text-xs mr-1"
  onClick={() => updateCount(n, "template", item.id, item.default_count)}
  >
  + All
  </Button>
  )}
  <Button
  variant="outline"
  size="icon"
  className="h-8 w-8"
  onClick={() => updateCount(n, "template", item.id, -1)}
  disabled={count === 0}
  aria-label={`Decrease ${item.name}`}
  >
  <Minus className="h-4 w-4" />
  </Button>
  <span
    className="w-8 text-center tabular-nums font-medium"
    style={item.color ? { color: theme === "dark" ? "#f8fafc" : "#0f172a" } : undefined}
  >{count}</span>
  <Button
  variant="outline"
  size="icon"
  className="h-8 w-8"
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
 className="h-8 w-8"
 onClick={() => updateCount(n, "extra", item.id, -1)}
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
 onClick={() => updateCount(n, "extra", item.id, 1)}
 aria-label={`Increase ${item.name}`}
 >
 <Plus className="h-4 w-4" />
 </Button>
 <Button
 variant="ghost"
 size="icon"
 className="h-8 w-8 text-muted-foreground hover:text-destructive"
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


  <Button
    type="button"
    variant="ghost"
    className="w-full h-10 text-muted-foreground hover:text-destructive"
    onClick={() => resetRoomCounts(n)}
  >
    Reset Tally
  </Button>

  </div>
  );
 };

 return (
 <main className="min-h-screen bg-background">
 <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10 space-y-8 sm:space-y-10">
 <header className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            {isReception ? (
              <>
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Three Ways House Hotel Room Checker</h1>
                <p className="text-xs text-muted-foreground mt-1">
                  This checker shows when Housekeeping have finished with a room and the room is ready for a customer. Green means room is ready, Red means room is not ready, or has not been serviced
                </p>
              </>
            ) : (
              <>
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Three Ways House Hotel Linen Counter</h1>
                <p className="text-xs text-muted-foreground mt-1">
                  Shared workspace
                </p>
              </>
            )}
          </div>
 <div className="flex items-center gap-2">
   {!isReception && (
     <Button variant="outline" size="sm" onClick={openExport}>
       Export
     </Button>
   )}
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="ghost" size="sm" className="" aria-label="Menu">
 <Menu className="h-4 w-4" />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end">
  {!isReception && (
    <>
      <DropdownMenuItem onSelect={() => setTemplateOpen(true)}>
        Linen List
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => setCategoriesOpen(true)}>
        Room Type
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => setRejectsOpen(true)}>
        Rejects
      </DropdownMenuItem>
      <DropdownMenuSub>
    <DropdownMenuSubTrigger>History</DropdownMenuSubTrigger>
    <DropdownMenuSubContent className="max-h-80 overflow-y-auto">
      {snapshots.length === 0 ? (
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          No exports yet
        </DropdownMenuLabel>
      ) : (
        snapshots.map((s) => (
          <DropdownMenuItem
            key={s.id}
            onSelect={() => setViewingSnapshot(s)}
          >
            {new Date(s.created_at).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
            {s.kind === "rejects" && (
              <span className="ml-2 text-xs uppercase tracking-wide text-muted-foreground">
                Rejects
              </span>
            )}
            <span className="ml-2 text-xs text-muted-foreground">
              ({s.grand_total})
            </span>
          </DropdownMenuItem>
        ))
      )}
      {snapshots.length > 0 && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={clearAllSnapshots}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear history
          </DropdownMenuItem>
        </>
      )}
    </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSeparator />
    </>
  )}
  {authUser?.role === "admin" && (
    <DropdownMenuItem asChild>
      <Link to="/users">Users</Link>
    </DropdownMenuItem>
  )}
  <DropdownMenuItem onSelect={() => setAccountOpen(true)}>Account</DropdownMenuItem>
  <DropdownMenuItem onSelect={(e) => { e.preventDefault(); toggleTheme(); }}>
    {theme === "dark" ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
    {theme === "dark" ? "Light mode" : "Dark mode"}
  </DropdownMenuItem>
  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
    {authUser ? `Signed in as ${authUser.username}` : ""}
  </DropdownMenuLabel>
  <DropdownMenuItem onSelect={signOut}>Sign out</DropdownMenuItem>
 </DropdownMenuContent>
 </DropdownMenu>
 </div>
 </header>

 {/* Linen list dialog */}
 <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
<DialogContent className="max-w-2xl w-[calc(100vw-1.5rem)] sm:w-full p-4 sm:p-6">
 <DialogHeader>
 <DialogTitle>Linen List</DialogTitle>
 <DialogDescription>
  Pick which rooms each item should show up in.
 </DialogDescription>
 </DialogHeader>
  <div className="space-y-3">
    <div className="flex justify-end">
      <Button
        type="button"
        variant={linenLocked ? "default" : "outline"}
        size="sm"
        className="h-8 gap-1.5"
        onClick={() => {
          setLinenLocked((v) => {
            const next = !v;
            toast.success(next ? "Linen list locked" : "Linen list unlocked");
            return next;
          });
        }}
        aria-pressed={linenLocked}
        aria-label={linenLocked ? "Unlock linen list" : "Lock linen list"}
      >
        {linenLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
        {linenLocked ? "Locked" : "Unlocked"}
      </Button>
    </div>
    <form onSubmit={addTemplateItem} className="flex gap-2">
      <Input
        placeholder="Add an item…"
        value={newTemplateName}
        onChange={(e) => setNewTemplateName(e.target.value)}
        disabled={linenLocked}
      />
      <Button type="submit" disabled={linenLocked || !newTemplateName.trim()}>
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
            <span className="shrink-0 w-[72px] text-center">Rooms</span>
            <span className="shrink-0 w-[88px] text-right">Actions</span>
          </li>
          {template.map((item, idx) => {
          const assignedCount = assignments.filter(
            (a) => a.template_item_id === item.id,
          ).length;
          return (
            <li key={item.id} className="flex items-center gap-1.5 py-2">
              <span
                className="h-3 w-3 rounded-full border shrink-0"
                style={{
                  backgroundColor: item.color ? COLOR_SWATCHES[item.color].solid : "transparent",
                  borderColor: item.color ? COLOR_SWATCHES[item.color].solid : "hsl(var(--border))",
                }}
                aria-hidden
              />
              <span className="flex-1 min-w-0 break-words text-sm">{item.name}</span>
              <div className="flex items-center gap-1 shrink-0">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs" disabled={linenLocked}>
                      {assignedCount}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-56 p-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="w-full h-8 mb-2"
                      onClick={() =>
                        assignedCount === rooms.length
                          ? removeAllRooms(item.id)
                          : assignAllRooms(item.id)
                      }
                    >
                      {assignedCount === rooms.length ? "No Rooms" : "All Rooms"}
                    </Button>
                    <div
                      className="max-h-64 overflow-y-auto overscroll-contain space-y-1"
                      onWheel={(e) => e.stopPropagation()}
                      onTouchMove={(e) => e.stopPropagation()}
                    >
                      {rooms.map((r) => {
                        const checked = isAssigned(item.id, r.room_number);
                        return (
                          <label
                            key={r.room_number}
                            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent cursor-pointer text-sm"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() =>
                                toggleAssignment(item.id, r.room_number)
                              }
                            />
                            <span className="tabular-nums">Room {r.room_number}</span>
                          </label>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground"
                      aria-label={`Edit ${item.name}`}
                      disabled={linenLocked}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-64 p-3 space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Name</label>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          renameTemplateItem(item.id, editingItemName);
                        }}
                        className="flex items-center gap-1"
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
                          className="h-8 flex-1"
                        />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground"
                          aria-label="Save name"
                        >
                          <Check className="h-4 w-4" />
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
                        className="h-8 w-20"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Colour</label>
                      <div className="flex items-center gap-1.5">
                        {(Object.keys(COLOR_SWATCHES) as ItemColor[]).map((key) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setTemplateColor(item.id, key)}
                            aria-label={COLOR_SWATCHES[key].label}
                            title={COLOR_SWATCHES[key].label}
                            className={cn(
                              "h-6 w-6 rounded-full border-2 transition",
                              item.color === key ? "ring-2 ring-offset-1 ring-foreground" : "",
                            )}
                            style={{ backgroundColor: COLOR_SWATCHES[key].solid, borderColor: COLOR_SWATCHES[key].solid }}
                          />
                        ))}
                        <button
                          type="button"
                          onClick={() => setTemplateColor(item.id, null)}
                          aria-label="No colour"
                          title="No colour"
                          className={cn(
                            "h-6 w-6 rounded-full border-2 flex items-center justify-center bg-background",
                            item.color === null ? "ring-2 ring-offset-1 ring-foreground" : "",
                          )}
                        >
                          <X className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t">
                      <span className="text-xs text-muted-foreground">Reorder</span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground"
                          onClick={() => moveTemplateItem(item.id, -1)}
                          disabled={idx === 0}
                          aria-label="Move up"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground"
                          onClick={() => moveTemplateItem(item.id, 1)}
                          disabled={idx === template.length - 1}
                          aria-label="Move down"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteTemplateItem(item.id)}
                  aria-label={`Delete ${item.name}`}
                  disabled={linenLocked}
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

 {/* Room type dialog */}
 <Dialog open={categoriesOpen} onOpenChange={setCategoriesOpen}>
<DialogContent className="max-w-lg w-[calc(100vw-1.5rem)] sm:w-full p-4 sm:p-6">
 <DialogHeader>
               <DialogTitle>Room Type</DialogTitle>
               <DialogDescription>
                 Assign a type to each room so you know what it is when counting.
 </DialogDescription>
 </DialogHeader>
 <div className="max-h-[60vh] overflow-y-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
 <ul className="divide-y">
 {rooms.map((r) => r.room_number).map((n) => {
 const cat = roomCategory(n);
 return (
 <li key={n} className="flex items-center gap-3 py-2">
 <span className="w-12 text-sm font-medium tabular-nums">Room {n}</span>
 <div className="flex-1 flex flex-wrap gap-1 justify-end">
 {CATEGORIES.map((c) => (
 <Button
 key={c.value}
 type="button"
 size="sm"
 variant={cat === c.value ? "default" : "outline"}
 className="h-7 text-xs"
 onClick={() => setRoomCategory(n, c.value)}
 >
 {c.label}
 </Button>
 ))}
 </div>
 </li>
 );
 })}
 </ul>
 </div>
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

 {/* Rooms */}
 <section className="space-y-4">
 <div className="flex items-baseline justify-between">
 <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
 Rooms
 </h2>
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
 <div className="grid grid-cols-4 sm:grid-cols-8 md:grid-cols-10 gap-2">
 {(() => {
  const allRooms = rooms.map((r) => r.room_number);
  const openIdx =
  openRoom !== null ? allRooms.indexOf(openRoom) : -1;
  const openRowEndIdx =
  openIdx >= 0 ? Math.ceil((openIdx + 1) / cols) * cols - 1 : -1;
 const nodes: React.ReactNode[] = [];
  for (let i = 0; i < allRooms.length; i++) {
  const n = allRooms[i];
 const done = doneSet.has(n);
 const isOpen = openRoom === n;
  if (isReception) {
    nodes.push(
      <div
        key={`r-${n}`}
        className={cn(
          "aspect-square rounded-md border text-sm font-medium transition-colors tabular-nums flex items-center justify-center cursor-default",
          done
            ? "bg-green-100 text-green-800 line-through border-transparent"
            : "bg-red-100 text-red-900 border-red-200",
        )}
        aria-label={`Room ${n}${done ? " done" : ""}`}
      >
        {n}
      </div>,
    );
  } else {
    nodes.push(
      <button
        key={`r-${n}`}
        type="button"
        onClick={() => openOrToggle(n)}
        className={cn(
          "aspect-square rounded-md border text-sm font-medium transition-colors tabular-nums",
          isOpen
            ? "ring-2 ring-ring border-transparent bg-accent"
            : done
              ? "bg-green-100 text-green-800 line-through border-transparent"
              : "bg-red-100 text-red-900 hover:bg-red-200 border-red-200",
        )}
        aria-pressed={done}
        aria-expanded={isOpen}
        aria-label={`Room ${n}${done ? " done" : ""}`}
      >
        {n}
      </button>,
    );
  }
   if (
   openIdx >= 0 &&
   i >= openIdx &&
   (i === openRowEndIdx ||
   (openRowEndIdx >= allRooms.length && i === allRooms.length - 1))
   ) {
 nodes.push(
 <div key={`panel-${openRoom}`} className="col-span-full space-y-2 mt-1">
 <div className="flex items-center justify-between">
 <h3 className="text-sm font-semibold">Room {openRoom}</h3>
 <button
 type="button"
 onClick={() => setOpenRoom(null)}
 className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
 >
 Close
 </button>
 </div>
  {renderRoomPanel(openRoom!)}
 </div>,
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

 <Dialog open={exportOpen} onOpenChange={setExportOpen}>
<DialogContent className="max-w-md w-[calc(100vw-1.5rem)] sm:w-full p-4 sm:p-6">
 <DialogHeader>
 <DialogTitle>Export totals</DialogTitle>
 <DialogDescription>
 Totals across all rooms, grouped by item name.
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
       <div className="space-y-4">
         {viewingSnapshot.totals.length === 0 ? (
           <p className="text-sm text-muted-foreground py-4">No items in this snapshot.</p>
         ) : (
           <ul className="divide-y rounded-md border max-h-[60vh] overflow-y-auto">
             {viewingSnapshot.totals.map((r) => (
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
                 const text = viewingSnapshot.totals
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
                viewingSnapshot.totals,
                viewingSnapshot.grand_total,
                new Date(viewingSnapshot.created_at),
                                viewingSnapshot.kind,
              )
            }
          >
            Print
          </Button>
          </div>
         </div>
       </div>
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
  <AccountDialog
    open={accountOpen}
    onOpenChange={setAccountOpen}
    currentUsername={authUser?.username ?? ""}
    onUsernameChanged={(u) => setAuthUser((prev) => prev ? { ...prev, username: u } : prev)}
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
  const pwFn = useServerFn(updateMyPassword);
  const unFn = useServerFn(updateMyUsername);
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
    const token = getToken();
    if (!token) return;
    if (username.trim() === currentUsername) {
      toast.info("Username is unchanged");
      return;
    }
    setBusy(true);
    try {
      const res = await unFn({
        data: { token, currentPassword: unCurrentPw, newUsername: username.trim() },
      });
      setSession(res.token, res.user);
      onUsernameChanged(res.user.username);
      toast.success("Username updated");
      setUnCurrentPw("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update username");
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const token = getToken();
    if (!token) return;
    if (newPw !== confirmPw) {
      toast.error("New passwords do not match");
      return;
    }
    setBusy(true);
    try {
      await pwFn({ data: { token, currentPassword: currentPw, newPassword: newPw } });
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