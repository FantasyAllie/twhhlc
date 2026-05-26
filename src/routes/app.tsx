import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus, X, Menu, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuItem,
 DropdownMenuSeparator,
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

export const Route = createFileRoute("/app")({
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

type TemplateItem = { id: string; name: string; created_at: string; category: Category; position: number; default_count: number };
type RoomExtra = { id: string; room_number: number; name: string; created_at: string };
type RoomCount = {
 id: string;
 room_number: number;
 item_kind: "template" | "extra";
 item_id: string;
 count: number;
};
type Room = { id: string; room_number: number; done: boolean; category: Category | null };
type TemplateItemRoom = { id: string; template_item_id: string; room_number: number };

function AppPage() {
 const qc = useQueryClient();
 const [openRoom, setOpenRoom] = useState<number | null>(null);
 const [templateOpen, setTemplateOpen] = useState(false);
 const [categoriesOpen, setCategoriesOpen] = useState(false);
 const [newTemplateName, setNewTemplateName] = useState("");
 const [newTemplateCategory, setNewTemplateCategory] = useState<Category>("double");
 

 const [exportOpen, setExportOpen] = useState(false);

 // Track responsive column count so we can insert the open-room panel
 // right after the row containing the clicked room.
 const [cols, setCols] = useState(10);
 useEffect(() => {
 const md = window.matchMedia("(min-width: 768px)");
 const sm = window.matchMedia("(min-width: 640px)");
 const update = () => setCols(md.matches ? 10 : sm.matches ? 8 : 5);
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
  .select("id,name,created_at,category,position,default_count")
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
 .select("id,room_number,done,category")
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

 const template = templateQ.data ?? [];
 const extras = extrasQ.data ?? [];
 const counts = countsQ.data ?? [];
 const rooms = roomsQ.data ?? [];
  const assignments = assignmentsQ.data ?? [];
 const doneSet = new Set(rooms.filter((r) => r.done).map((r) => r.room_number));

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
  else list.push({ id: `temp-${roomNumber}`, room_number: roomNumber, done: true, category: null });
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
 setNewExtraName("");
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
 old?.map((r) => ({ ...r, done: false })) ?? [],
 );
 qc.setQueryData<RoomCount[]>(["room_counts"], () => []);
 const [r1, r2] = await Promise.all([
 supabase.from("rooms").update({ done: false }).neq("room_number", -1),
 supabase.from("room_item_counts").delete().neq("room_number", -1),
 ]);
 if (r1.error) toast.error(r1.error.message);
 if (r2.error) toast.error(r2.error.message);
 qc.invalidateQueries({ queryKey: ["rooms"] });
 qc.invalidateQueries({ queryKey: ["room_counts"] });
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
  const visibleTemplate = template.filter((t) => isAssigned(t.id, n));
  const cat = roomCategory(n);
 return (
 <div className="border rounded-md p-4 space-y-4 bg-muted/30">
  <div className="flex items-center">
    <span className="text-sm font-medium">{categoryLabel(cat)}</span>
  </div>
 {visibleTemplate.length === 0 && roomExtras.length === 0 ? (
 <p className="text-sm text-muted-foreground">
 No items yet. Add linen list items from the menu, or add an extra below.
 </p>
 ) : (
 <ul className="divide-y">
  {visibleTemplate.map((item) => {
  const count = getCount(n, "template", item.id);
  return (
  <li key={`t-${item.id}`} className="flex items-center gap-3 py-2">
  <span className="flex-1 truncate">{item.name}</span>
  <div className="flex items-center gap-1">
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
  <span className="w-8 text-center tabular-nums font-medium">{count}</span>
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
 <li key={`e-${item.id}`} className="flex items-center gap-3 py-2">
 <span className="flex-1 truncate">
 {item.name}
 <span className="ml-2 text-xs text-muted-foreground">
 extra
 </span>
 </span>
 <div className="flex items-center gap-1">
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

 <form
 onSubmit={(e) => {
 e.preventDefault();
 addExtra(n);
 }}
 className="flex gap-2"
 >
 <Input
 placeholder="Add an extra item for this room…"
 value={newExtraName}
 onChange={(e) => setNewExtraName(e.target.value)}
 />
 <Button type="submit" disabled={!newExtraName.trim()}>
 Add
 </Button>
 </form>

 <div className="flex gap-2">
 <Button
 type="button"
 variant="outline"
 className={cn(
 "flex-1 h-10",
 doneSet.has(n) &&
 "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800",
 )}
 onClick={() => toggleRoom(n)}
 >
 {doneSet.has(n) ? "Mark as not done" : "Mark as done"}
 </Button>
 <Button
 type="button"
 variant="ghost"
 className="h-10 text-muted-foreground hover:text-destructive"
 onClick={() => resetRoomCounts(n)}
 >
 Reset counts
 </Button>
 </div>
 </div>
 );
 };

 return (
 <main className="min-h-screen bg-background">
 <div className="max-w-2xl mx-auto px-4 py-10 space-y-10">
 <header className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-semibold tracking-tight">Three Ways House Hotel Linen Counter</h1>
 <p className="text-xs text-muted-foreground mt-1">
 Shared workspace
 </p>
 </div>
 <div className="flex items-center gap-2">
 <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
 Export
 </Button>
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="ghost" size="sm" className="" aria-label="Menu">
 <Menu className="h-4 w-4" />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end">
 <DropdownMenuItem onSelect={() => setTemplateOpen(true)}>
              Linen List
 </DropdownMenuItem>
 <DropdownMenuItem onSelect={() => setCategoriesOpen(true)}>
              Room Type
 </DropdownMenuItem>
 <DropdownMenuSeparator />
 <DropdownMenuItem
 onSelect={() => resetAll()}
 className="text-destructive focus:text-destructive"
 >
 Reset all
 </DropdownMenuItem>
 </DropdownMenuContent>
 </DropdownMenu>
 </div>
 </header>

 {/* Linen list dialog */}
 <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
<DialogContent className="max-w-2xl">
 <DialogHeader>
 <DialogTitle>Linen List</DialogTitle>
 <DialogDescription>
  Pick which rooms each item should show up in.
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
      <ul className="divide-y border-t max-h-[60vh] overflow-y-auto -mx-6 px-6">
        {template.map((item, idx) => {
          const assignedCount = assignments.filter(
            (a) => a.template_item_id === item.id,
          ).length;
          return (
            <li key={item.id} className="flex items-center gap-2 py-2">
              <span className="flex-1 truncate">{item.name}</span>
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                Default
                <Input
                  type="number"
                  min={0}
                  value={item.default_count}
                  onChange={(e) =>
                    setTemplateDefault(item.id, Number(e.target.value))
                  }
                  className="h-8 w-14 text-center"
                />
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs">
                    Rooms ({assignedCount})
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-56 p-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full h-8 mb-2"
                    onClick={() => assignAllRooms(item.id)}
                  >
                    All Rooms
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
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={() => moveTemplateItem(item.id, -1)}
                disabled={idx === 0}
                aria-label={`Move ${item.name} up`}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={() => moveTemplateItem(item.id, 1)}
                disabled={idx === template.length - 1}
                aria-label={`Move ${item.name} down`}
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => deleteTemplateItem(item.id)}
                aria-label={`Delete ${item.name}`}
              >
                <X className="h-4 w-4" />
              </Button>
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
 <DialogContent className="max-w-lg">
 <DialogHeader>
              <DialogTitle>Room Type</DialogTitle>
              <DialogDescription>
                Assign a type to each room. Linen list items for that type will appear in the room.
 </DialogDescription>
 </DialogHeader>
 <div className="max-h-[60vh] overflow-y-auto -mx-6 px-6">
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

 {/* Rooms */}
 <section className="space-y-4">
 <div className="flex items-baseline justify-between">
 <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
 Rooms
 </h2>
 <button
 type="button"
 onClick={resetAll}
 className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
 >
 Reset all
 </button>
 </div>

 {/* On-screen interactive accordion */}
 <div className=" grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
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


 <p className="text-xs text-muted-foreground">
 {doneSet.size} of {rooms.length} done
 </p>
 </section>
 </div>

 <Dialog open={exportOpen} onOpenChange={setExportOpen}>
 <DialogContent className="max-w-md">
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
                          onClick={() => {
                            const dateStr = new Date().toLocaleDateString(
                              undefined,
                              { year: "numeric", month: "long", day: "numeric" }
                            );
                            const win = window.open("", "_blank");
                            if (!win) {
                              toast.error("Pop-up blocked");
                              return;
                            }
                            const tableRows = rows
                              .map(
                                ([n, c]) =>
                                  `<tr><td>${n.replace(/[<>&]/g, (s) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[s]!))}</td><td class="num">${c}</td></tr>`
                              )
                              .join("");
                            win.document.write(`<!doctype html><html><head><title>Three Ways House Hotel Linen - ${dateStr}</title><style>
                              body{font-family:system-ui,-apple-system,sans-serif;color:#000;background:#fff;padding:2rem;max-width:640px;margin:0 auto;}
                              h1{font-size:1.5rem;margin:0 0 .25rem;}
                              .date{color:#444;margin:0 0 1.5rem;font-size:.95rem;}
                              table{width:100%;border-collapse:collapse;font-size:1rem;}
                              th,td{text-align:left;padding:.5rem .75rem;border-bottom:1px solid #ccc;}
                              th.num,td.num{text-align:right;font-variant-numeric:tabular-nums;}
                              tfoot td{font-weight:600;border-top:2px solid #000;border-bottom:none;padding-top:.75rem;}
                              @media print{body{padding:0;}}
                            </style></head><body>
                              <h1>Three Ways House Hotel Linen</h1>
                              <p class="date">${dateStr}</p>
                              <table>
                                <thead><tr><th>Item</th><th class="num">Count</th></tr></thead>
                                <tbody>${tableRows}</tbody>
                                <tfoot><tr><td>Total</td><td class="num">${grand}</td></tr></tfoot>
                              </table>
                              <script>window.onload=()=>{window.print();}</script>
                            </body></html>`);
                            win.document.close();
                          }}
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
 </main>
 );
}