import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus, X, Printer, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Counter" },
      { name: "description", content: "Count items per room across 50 rooms." },
    ],
  }),
  component: AppPage,
});

type TemplateItem = { id: string; name: string; created_at: string };
type RoomExtra = { id: string; room_number: number; name: string; created_at: string };
type RoomCount = {
  id: string;
  room_number: number;
  item_kind: "template" | "extra";
  item_id: string;
  count: number;
};
type Room = { id: string; room_number: number; done: boolean };

function AppPage() {
  const qc = useQueryClient();
  const [openRoom, setOpenRoom] = useState<number | null>(null);
  const [showTemplate, setShowTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newExtraName, setNewExtraName] = useState("");

  const templateQ = useQuery({
    queryKey: ["template_items"],
    queryFn: async (): Promise<TemplateItem[]> => {
      const { data, error } = await supabase
        .from("template_items")
        .select("id,name,created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
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
        .select("id,room_number,done")
        .order("room_number", { ascending: true });
      if (error) throw error;
      return data ?? [];
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
    setNewTemplateName("");
    const { error } = await supabase
      .from("template_items")
      .insert({ name });
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
      else list.push({ id: `temp-${roomNumber}`, room_number: roomNumber, done: nextDone });
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

  const roomsForPrint = Array.from({ length: 50 }, (_, i) => i + 1);

  const renderRoomPanel = (n: number) => {
    const roomExtras = extras.filter((e) => e.room_number === n);
    return (
      <div className="border rounded-md p-4 space-y-4 bg-muted/30 print:bg-white print:border-black/20">
        {template.length === 0 && roomExtras.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No items yet. Add a template item above, or an extra below.
          </p>
        ) : (
          <ul className="divide-y print:divide-black/10">
            {template.map((item) => {
              const count = getCount(n, "template", item.id);
              return (
                <li key={`t-${item.id}`} className="flex items-center gap-3 py-2">
                  <span className="flex-1 truncate">{item.name}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 print:hidden"
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
                      className="h-8 w-8 print:hidden"
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
                    <span className="ml-2 text-xs text-muted-foreground print:text-black/60">
                      extra
                    </span>
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 print:hidden"
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
                      className="h-8 w-8 print:hidden"
                      onClick={() => updateCount(n, "extra", item.id, 1)}
                      aria-label={`Increase ${item.name}`}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive print:hidden"
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
          className="flex gap-2 print:hidden"
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

        <div className="flex items-center justify-between text-xs text-muted-foreground print:hidden">
          <button
            type="button"
            onClick={() => toggleRoom(n)}
            className={cn(
              "underline underline-offset-4 hover:text-foreground",
              doneSet.has(n) && "text-emerald-600",
            )}
          >
            {doneSet.has(n) ? "Mark as not done" : "Mark as done"}
          </button>
          <button
            type="button"
            onClick={() => resetRoomCounts(n)}
            className="underline underline-offset-4 hover:text-foreground"
          >
            Reset counts
          </button>
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-background">
      <style>{`
        @media print {
          @page { margin: 1.5cm; }
          body { background: white !important; color: black !important; }
          .print\\:hidden { display: none !important; }
          .print-room { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-10 print:py-4">
        <header className="flex items-center justify-between print:mb-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Counter</h1>
            <p className="text-xs text-muted-foreground mt-1 print:text-black/60">
              Shared workspace
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => window.print()} className="print:hidden">
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </header>

        {/* Manage template */}
        <section className="space-y-3 print:hidden">
          <button
            type="button"
            onClick={() => setShowTemplate((v) => !v)}
            className="flex items-center gap-1 text-sm font-medium text-muted-foreground uppercase tracking-wide hover:text-foreground"
          >
            <ChevronDown
              className={cn("h-4 w-4 transition-transform", showTemplate && "rotate-180")}
            />
            Template items ({template.length})
          </button>
          {showTemplate && (
            <div className="border rounded-md p-4 space-y-3 bg-muted/30">
              <p className="text-xs text-muted-foreground">
                Shared list — appears in every room.
              </p>
              <form onSubmit={addTemplateItem} className="flex gap-2">
                <Input
                  placeholder="Add a template item…"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                />
                <Button type="submit" disabled={!newTemplateName.trim()}>
                  Add
                </Button>
              </form>
              {template.length > 0 && (
                <ul className="divide-y border-t">
                  {template.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 py-2">
                      <span className="flex-1 truncate">{item.name}</span>
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
            </div>
          )}
        </section>

        {/* Rooms */}
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide print:text-black/70">
              Rooms
            </h2>
            <button
              type="button"
              onClick={resetAll}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 print:hidden"
            >
              Reset all
            </button>
          </div>

          {/* On-screen interactive accordion */}
          <div className="space-y-3 print:hidden">
            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
              {Array.from({ length: 50 }, (_, i) => i + 1).map((n) => {
                const done = doneSet.has(n);
                const isOpen = openRoom === n;
                return (
                  <button
                    key={n}
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
                  </button>
                );
              })}
            </div>
            {openRoom !== null && (
              <div className="space-y-2">
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
              </div>
            )}
          </div>

          {/* Print-only: every room expanded */}
          <div className="hidden print:block space-y-4">
            {roomsForPrint.map((n) => (
              <div key={n} className="print-room space-y-2">
                <h3 className="text-sm font-semibold">
                  Room {n}
                  {doneSet.has(n) && (
                    <span className="ml-2 text-xs text-black/60">(done)</span>
                  )}
                </h3>
                {renderRoomPanel(n)}
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground print:hidden">
            {doneSet.size} of 50 done
          </p>
        </section>
      </div>
    </main>
  );
}