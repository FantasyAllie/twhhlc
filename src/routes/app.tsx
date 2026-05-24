import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus, X, LogOut, Printer } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Counter" },
      { name: "description", content: "Track item counts and mark off rooms 1-50." },
    ],
  }),
  component: AppPage,
});

type Item = { id: string; name: string; count: number; created_at: string };
type Room = { id: string; room_number: number; done: boolean };

function AppPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s && authChecked) navigate({ to: "/login" });
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthChecked(true);
      if (!data.session) navigate({ to: "/login" });
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const userId = session?.user.id;

  const itemsQ = useQuery({
    queryKey: ["items", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Item[]> => {
      const { data, error } = await supabase
        .from("items")
        .select("id,name,count,created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const roomsQ = useQuery({
    queryKey: ["rooms", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Room[]> => {
      const { data, error } = await supabase
        .from("rooms")
        .select("id,room_number,done")
        .order("room_number", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [newName, setNewName] = useState("");

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name || !userId) return;
    setNewName("");
    const { error } = await supabase.from("items").insert({ name, user_id: userId, count: 0 });
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["items", userId] });
  };

  const updateCount = async (item: Item, delta: number) => {
    const next = Math.max(0, item.count + delta);
    if (next === item.count) return;
    qc.setQueryData<Item[]>(["items", userId], (old) =>
      old?.map((i) => (i.id === item.id ? { ...i, count: next } : i)) ?? [],
    );
    const { error } = await supabase.from("items").update({ count: next }).eq("id", item.id);
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["items", userId] });
    }
  };

  const deleteItem = async (id: string) => {
    qc.setQueryData<Item[]>(["items", userId], (old) => old?.filter((i) => i.id !== id) ?? []);
    const { error } = await supabase.from("items").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["items", userId] });
    }
  };

  const toggleRoom = async (roomNumber: number) => {
    if (!userId) return;
    const existing = roomsQ.data?.find((r) => r.room_number === roomNumber);
    const nextDone = !existing?.done;

    // optimistic
    qc.setQueryData<Room[]>(["rooms", userId], (old) => {
      const list = old ? [...old] : [];
      const idx = list.findIndex((r) => r.room_number === roomNumber);
      if (idx >= 0) list[idx] = { ...list[idx], done: nextDone };
      else list.push({ id: `temp-${roomNumber}`, room_number: roomNumber, done: nextDone });
      return list;
    });

    const { error } = await supabase
      .from("rooms")
      .upsert(
        { user_id: userId, room_number: roomNumber, done: nextDone, updated_at: new Date().toISOString() },
        { onConflict: "user_id,room_number" },
      );
    if (error) {
      toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["rooms", userId] });
  };

  const resetRooms = async () => {
    if (!userId) return;
    qc.setQueryData<Room[]>(["rooms", userId], (old) => old?.map((r) => ({ ...r, done: false })) ?? []);
    const { error } = await supabase.from("rooms").update({ done: false }).eq("user_id", userId);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["rooms", userId] });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  const handlePrint = () => {
    window.print();
  };

  if (!authChecked || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  const items = itemsQ.data ?? [];
  const rooms = roomsQ.data ?? [];
  const doneSet = new Set(rooms.filter((r) => r.done).map((r) => r.room_number));

  return (
    <main className="min-h-screen bg-background">
      <style>{`
        @media print {
          @page { margin: 1.5cm; }
          body { background: white !important; color: black !important; }
          .print\:hidden { display: none !important; }
        }
      `}</style>
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-12 print:py-4">
        <header className="flex items-center justify-between print:mb-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Counter</h1>
            <p className="text-xs text-muted-foreground mt-1 print:text-black/60">{session.user.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handlePrint} className="print:hidden">
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} className="print:hidden">
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </Button>
          </div>
        </header>

        <section className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide print:text-black/70">
            Items
          </h2>

          <form onSubmit={addItem} className="flex gap-2 print:hidden">
            <Input
              placeholder="Add an item…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Button type="submit" disabled={!newName.trim()}>
              Add
            </Button>
          </form>

          {itemsQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-md">
              No items yet. Add one above.
            </p>
          ) : (
            <ul className="divide-y border rounded-md print:border-black/20 print:divide-black/10">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex-1 truncate">{item.name}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 print:hidden"
                      onClick={() => updateCount(item, -1)}
                      disabled={item.count === 0}
                      aria-label={`Decrease ${item.name}`}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center tabular-nums font-medium print:w-auto print:px-2">
                      {item.count}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 print:hidden"
                      onClick={() => updateCount(item, 1)}
                      aria-label={`Increase ${item.name}`}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive print:hidden"
                    onClick={() => deleteItem(item.id)}
                    aria-label={`Delete ${item.name}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Rooms
            </h2>
            <button
              type="button"
              onClick={resetRooms}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 print:hidden"
            >
              Reset all
            </button>
          </div>

          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
            {Array.from({ length: 50 }, (_, i) => i + 1).map((n) => {
              const done = doneSet.has(n);
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => toggleRoom(n)}
                  className={cn(
                    "aspect-square rounded-md border text-sm font-medium transition-colors",
                    "tabular-nums",
                    done
                      ? "bg-muted text-muted-foreground line-through border-transparent print:bg-black/10 print:text-black/40 print:border-black/20 print:line-through"
                      : "bg-background hover:bg-accent print:bg-white print:text-black print:border-black/40",
                  )}
                  aria-pressed={done}
                  aria-label={`Room ${n}${done ? " done" : ""}`}
                >
                  {n}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {doneSet.size} of 50 done
          </p>
        </section>
      </div>
    </main>
  );
}