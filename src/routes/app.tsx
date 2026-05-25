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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/app")({
 head: () => ({
 meta: [
 { title: "Counter" },
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

function AppPage() {
 const qc = useQueryClient();
 const [openRoom, setOpenRoom] = useState<number | null>(null);
 const [templateOpen, setTemplateOpen] = useState(false);
 const [categoriesOpen, setCategoriesOpen] = useState(false);
 const [newTemplateName, setNewTemplateName] = useState("");
 const [newTemplateCategory, setNewTemplateCategory] = useState<Category>("double");
 const [templateTab, setTemplateTab] = useState<Category>("double");
 const [newExtraName, setNewExtraName] = useState("");

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

 const template = templateQ.data ?? [];
 const extras = extrasQ.data ?? [];
 const counts = countsQ.data ?? [];
 const rooms = roomsQ.data ?? [];
 const doneSet = new Set(rooms.filter((r) => r.done).map((r) => r.room_number));

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
 const addExtra = async (roomNumber: number) => {
 const name = newExtraName.trim();
 if (!name) return;
 setNewExtraName("");
 const { error } = await supabase
 .from("room_extra_items")
 .insert({ name, room_number: roomNumber });
 if (error) toast.error(error.message);
 qc.invalidateQueries({ queryKey: ["room_extras"] });
 };

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

  const applyDefaultsToRoom = async (roomNumber: number) => {
    const cat = roomCategory(roomNumber);
    if (!cat) return;
    const items = template.filter((t) => t.category === cat && t.default_count > 0);
    if (items.length === 0) {
      toast.message("No defaults set for this category.");
      return;
    }

    qc.setQueryData<RoomCount[]>(["room_counts"], (old) => {
      const list = old ? [...old] : [];
      for (const item of items) {
        const current = list.find(
          (c) => c.room_number === roomNumber && c.item_kind === "template" && c.item_id === item.id,
        )?.count ?? 0;
        const next = current + item.default_count;
        const idx = list.findIndex(
          (c) => c.room_number === roomNumber && c.item_kind === "template" && c.item_id === item.id,
        );
        if (idx >= 0) list[idx] = { ...list[idx], count: next };
        else
          list.push({
            id: `temp-${roomNumber}-template-${item.id}`,
            room_number: roomNumber,
            item_kind: "template",
            item_id: item.id,
            count: next,
          });
      }
      return list;
    });

    const nowIso = new Date().toISOString();
    const rows = items.map((item) => {
      const current = counts.find(
        (c) => c.room_number === roomNumber && c.item_kind === "template" && c.item_id === item.id,
      )?.count ?? 0;
      return {
        room_number: roomNumber,
        item_kind: "template",
        item_id: item.id,
        count: current + item.default_count,
        updated_at: nowIso,
      };
    });
    const { error } = await supabase
      .from("room_item_counts")
      .upsert(rows, { onConflict: "user_id,room_number,item_kind,item_id" });
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["room_counts"] });
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
 };

 // --- Room toggle ---
 const toggleRoom = async (roomNumber: number) => {
 const existing = rooms.find((r) => r.room_number === roomNumber);
 const nextDone = !existing?.done;

 qc.setQueryData<Room[]>(["rooms"], (old) => {
 const list = old ? [...old] : [];
 const idx = list.findIndex((r) => r.room_number === roomNumber);
 if (idx >= 0) list[idx] = { ...list[idx], done: nextDone };
 else list.push({ id: `temp-${roomNumber}`, room_number: roomNumber, done: nextDone, category: null });
 return list;
 });

 const { error } = await supabase.from("rooms").upsert(
 {
 room_number: roomNumber,
 done: nextDone,
 updated_at: new Date().toISOString(),
 },
 { onConflict: "user_id,room_number" },
 );
 if (error) toast.error(error.message);
 qc.invalidateQueries({ queryKey: ["rooms"] });
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
 };

 const resetAll = async () => {
 if (!confirm("Reset done state and counts for all 50 rooms?")) return;
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
 const cat = roomCategory(n);
 const visibleTemplate = cat ? template.filter((t) => t.category === cat) : [];
 return (
 <div className="border rounded-md p-4 space-y-4 bg-muted/30">
 {!cat && (
 <p className="text-sm text-muted-foreground">
 No category set for this room. Open the menu → Room categories to assign one.
 </p>
 )}
 {cat && (
 <p className="text-xs text-muted-foreground">
 Category: <span className="font-medium">{categoryLabel(cat)}</span>
 </p>
 )}
 {visibleTemplate.length === 0 && roomExtras.length === 0 ? (
 <p className="text-sm text-muted-foreground">
 No items yet. Add template items from the menu, or add an extra below.
 </p>
 ) : (
 <ul className="divide-y">
  {visibleTemplate.map((item) => {
  const count = getCount(n, "template", item.id);
  return (
  <li key={`t-${item.id}`} className="flex items-center gap-3 py-2">
  <span className="flex-1 truncate">{item.name}</span>
  <div className="flex items-center gap-1">
  <Button
  variant="outline"
  size="icon"
  className="h-8 w-8"
  onClick={() => updateCount(n, "template", item.id, -1)}
  disabled={count === 1}
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
  {item.default_count > 0 && (
  <Button
  variant="outline"
  size="sm"
  className="h-8 text-xs ml-1"
  onClick={() => updateCount(n, "template", item.id, item.default_count)}
  >
  +All
  </Button>
  )}
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
 <h1 className="text-2xl font-semibold tracking-tight">Counter</h1>
 <p className="text-xs text-muted-foreground mt-1">
 Shared workspace
 </p>
 </div>
 <div className="flex items-center gap-2">
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="ghost" size="sm" className="" aria-label="Menu">
 <Menu className="h-4 w-4" />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end">
 <DropdownMenuItem onSelect={() => setTemplateOpen(true)}>
 Template items
 </DropdownMenuItem>
 <DropdownMenuItem onSelect={() => setCategoriesOpen(true)}>
 Room categories
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

 {/* Template items dialog */}
 <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
 <DialogContent className="max-w-lg">
 <DialogHeader>
 <DialogTitle>Template items</DialogTitle>
 <DialogDescription>
 Items shown in each room based on the room's category.
 </DialogDescription>
 </DialogHeader>
 <Tabs value={templateTab} onValueChange={(v) => { setTemplateTab(v as Category); setNewTemplateCategory(v as Category); }}>
 <TabsList className="grid grid-cols-3 w-full">
 {CATEGORIES.map((c) => (
 <TabsTrigger key={c.value} value={c.value}>{c.label}</TabsTrigger>
 ))}
 </TabsList>
 {CATEGORIES.map((c) => {
 const items = template.filter((t) => t.category === c.value);
 return (
 <TabsContent key={c.value} value={c.value} className="space-y-3">
 <form
 onSubmit={(e) => { setNewTemplateCategory(c.value); addTemplateItem(e); }}
 className="flex gap-2"
 >
 <Input
 placeholder={`Add a ${c.label} item…`}
 value={newTemplateCategory === c.value ? newTemplateName : ""}
 onChange={(e) => { setNewTemplateCategory(c.value); setNewTemplateName(e.target.value); }}
 />
 <Button type="submit" disabled={!(newTemplateCategory === c.value && newTemplateName.trim())}>
 Add
 </Button>
 </form>
 {items.length === 0 ? (
 <p className="text-sm text-muted-foreground">No items yet.</p>
 ) : (
 <ul className="divide-y border-t">
 {items.map((item, idx) => (
 <li key={item.id} className="flex items-center gap-3 py-2">
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
                              className="h-8 w-16 text-center"
                            />
                          </label>
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
 disabled={idx === items.length - 1}
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
 ))}
 </ul>
 )}
 </TabsContent>
 );
 })}
 </Tabs>
 </DialogContent>
 </Dialog>

 {/* Room categories dialog */}
 <Dialog open={categoriesOpen} onOpenChange={setCategoriesOpen}>
 <DialogContent className="max-w-lg">
 <DialogHeader>
 <DialogTitle>Room categories</DialogTitle>
 <DialogDescription>
 Assign a category to each room. Template items for that category will appear in the room.
 </DialogDescription>
 </DialogHeader>
 <div className="max-h-[60vh] overflow-y-auto -mx-6 px-6">
 <ul className="divide-y">
 {Array.from({ length: 50 }, (_, i) => i + 1).map((n) => {
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
 const allRooms = Array.from({ length: 50 }, (_, i) => i + 1);
 const openRowEnd =
 openRoom !== null ? Math.ceil(openRoom / cols) * cols : null;
 const nodes: React.ReactNode[] = [];
 for (const n of allRooms) {
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
 ? "bg-muted text-muted-foreground line-through border-transparent"
 : "bg-background hover:bg-accent",
 )}
 aria-pressed={done}
 aria-expanded={isOpen}
 aria-label={`Room ${n}${done ? " done" : ""}`}
 >
 {n}
 </button>,
 );
 if (n === openRowEnd && openRoom !== null) {
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
 {renderRoomPanel(openRoom)}
 </div>,
 );
 }
 }
 return nodes;
 })()}
 </div>


 <p className="text-xs text-muted-foreground">
 {doneSet.size} of 50 done
 </p>
 </section>
 </div>
 </main>
 );
}