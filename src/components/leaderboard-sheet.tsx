import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, Trophy } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { UserAvatar, useAvatarUrls } from "@/components/user-avatar";

type Category = { key: string; title: string; badge: string; emoji: string; unit: string };

const CATEGORIES: Category[] = [
  { key: "linen_counted", title: "Most linen counted", badge: "Linen Legend", emoji: "🧺", unit: "items" },
  { key: "room_clean", title: "Most rooms marked clean", badge: "Sparkle Champion", emoji: "✨", unit: "rooms" },
  { key: "room_dirty", title: "Most rooms marked dirty", badge: "Turnover Titan", emoji: "🛏️", unit: "rooms" },
  { key: "stayover_photo", title: "Most DND photos", badge: "Door Detective", emoji: "📸", unit: "photos" },
  { key: "maintenance_logged", title: "Most maintenance logged", badge: "Eagle Eye", emoji: "🔧", unit: "reports" },
  { key: "maintenance_fixed", title: "Most maintenance fixed", badge: "Fix-it Hero", emoji: "🛠️", unit: "fixes" },
  { key: "lost_logged", title: "Most lost property logged", badge: "Treasure Hunter", emoji: "🔎", unit: "items" },
  { key: "messages_sent", title: "Most messages sent", badge: "Chatterbox", emoji: "💬", unit: "messages" },
];

type Tally = Record<string, Map<string, number>>;

function monthRange(offset: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
  return { start, end };
}

async function fetchAll<T>(
  table: string,
  cols: string,
  hotelId: string,
  start: string,
  end: string,
  timeCol = "created_at",
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from(table as never)
      .select(cols)
      .eq("hotel_id", hotelId)
      .gte(timeCol, start)
      .lt(timeCol, end)
      .range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export function LeaderboardSheet({
  open,
  onOpenChange,
  hotelId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  hotelId: string | undefined;
}) {
  const [offset, setOffset] = useState(-1);
  const { start, end } = monthRange(offset);
  const s = start.toISOString();
  const e = end.toISOString();

  const q = useQuery({
    queryKey: ["leaderboard", hotelId, s],
    enabled: open && !!hotelId,
    queryFn: async (): Promise<Tally> => {
      const t: Tally = {};
      const add = (k: string, who: string | null | undefined, n = 1) => {
        const name = (who ?? "").trim();
        if (!name || n <= 0) return;
        (t[k] ??= new Map()).set(name, (t[k].get(name) ?? 0) + n);
      };
      const [acts, maint, fixed, lost, msgs] = await Promise.all([
        fetchAll<{ kind: string; username: string | null; amount: number }>("activity_events", "kind,username,amount", hotelId!, s, e),
        fetchAll<{ created_by_username: string | null }>("maintenance_requests", "created_by_username", hotelId!, s, e),
        fetchAll<{ done_by_username: string | null }>("maintenance_requests", "done_by_username", hotelId!, s, e, "done_at"),
        fetchAll<{ created_by_username: string | null }>("lost_property", "created_by_username", hotelId!, s, e),
        fetchAll<{ created_by_username: string | null }>("room_messages", "created_by_username", hotelId!, s, e),
      ]);
      for (const a of acts) add(a.kind, a.username, a.amount);
      for (const m of maint) add("maintenance_logged", m.created_by_username);
      for (const m of fixed) add("maintenance_fixed", m.done_by_username);
      for (const l of lost) add("lost_logged", l.created_by_username);
      for (const m of msgs) add("messages_sent", m.created_by_username);
      return t;
    },
  });

  const monthLabel = start.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const mvp = useMemo(() => {
    const wins = new Map<string, number>();
    for (const c of CATEGORIES) {
      const top = [...(q.data?.[c.key] ?? new Map()).entries()].sort((a, b) => b[1] - a[1])[0];
      if (top) wins.set(top[0], (wins.get(top[0]) ?? 0) + 1);
    }
    return [...wins.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
  }, [q.data]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex max-h-[92vh] flex-col overflow-hidden rounded-t-2xl p-4 sm:p-6">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" /> Leaderboard
          </SheetTitle>
          <SheetDescription>Who went above and beyond this month.</SheetDescription>
        </SheetHeader>

        <div className="mt-3 flex items-center justify-between rounded-xl border bg-muted/40 px-2 py-1.5">
          <Button variant="ghost" size="icon" onClick={() => setOffset((o) => o - 1)} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold">{monthLabel}</span>
          <Button variant="ghost" size="icon" disabled={offset >= 0} onClick={() => setOffset((o) => o + 1)} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto pb-6">
          {q.isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : q.error ? (
            <p className="py-6 text-center text-sm text-destructive">Couldn't load the leaderboard.</p>
          ) : (
            <>
              {mvp && (
                <div className="mb-4 rounded-2xl border border-primary/40 bg-primary/10 p-4 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Star of the month</p>
                  <p className="mt-1 font-display text-2xl font-bold">🏆 {mvp[0]}</p>
                  <p className="text-sm text-muted-foreground">Top in {mvp[1]} {mvp[1] === 1 ? "category" : "categories"}</p>
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                {CATEGORIES.map((c) => (
                  <CategoryCard key={c.key} cat={c} rows={[...(q.data?.[c.key] ?? new Map()).entries()].sort((a, b) => b[1] - a[1])} />
                ))}
              </div>
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Room and linen stats are counted from 1 October 2026 onwards.
              </p>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

const MEDALS = ["🥇", "🥈", "🥉"];

function CategoryCard({ cat, rows }: { cat: Category; rows: [string, number][] }) {
  const top = rows.slice(0, 3);
  const rest = rows.slice(3, 8);
  // Podium order: 2nd, 1st, 3rd
  const podium = [top[1], top[0], top[2]];
  const heights = ["h-12", "h-16", "h-9"];
  const { data: avatars } = useAvatarUrls(rows.slice(0, 8).map((r) => r[0]));
  const av = (n: string) => avatars?.[n.trim().toLowerCase()];
  return (
    <div className="rounded-2xl border bg-card p-3 shadow-elevation-1">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">{cat.emoji} {cat.title}</p>
      </div>
      {top.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No activity yet</p>
      ) : (
        <>
          <p className="mt-0.5 text-xs text-muted-foreground">
            <span className="font-semibold text-primary">{cat.badge}:</span> {top[0][0]}
          </p>
          <div className="mt-3 grid grid-cols-3 items-end gap-2">
            {podium.map((p, i) => (
              <div key={i} className="flex min-w-0 flex-col items-center">
                {p ? (
                  <>
                    <span className="relative">
                      <UserAvatar key={av(p[0]) ?? "none"} name={p[0]} url={av(p[0])} className={i === 1 ? "h-12 w-12 text-lg" : "h-10 w-10 text-base"} />
                      <span className="absolute -bottom-1 -right-2 text-base">{MEDALS[i === 1 ? 0 : i === 0 ? 1 : 2]}</span>
                    </span>
                    <span className="w-full truncate text-center text-xs font-medium">{p[0]}</span>
                    <span className="text-[11px] tabular-nums text-muted-foreground">{p[1]} {cat.unit}</span>
                  </>
                ) : <span className="text-xl opacity-0">-</span>}
                <div className={cn("mt-1 w-full rounded-t-lg", heights[i], p ? (i === 1 ? "bg-primary/70" : "bg-primary/30") : "bg-muted/40")} />
              </div>
            ))}
          </div>
          {rest.length > 0 && (
            <ol className="mt-2 space-y-0.5 text-sm" start={4}>
              {rest.map(([name, n], i) => (
                <li key={name} className="flex justify-between text-muted-foreground">
                  <span className="flex min-w-0 items-center gap-2"><span className="tabular-nums">{i + 4}.</span><UserAvatar key={av(name) ?? "none"} name={name} url={av(name)} className="h-6 w-6 text-xs" /><span className="truncate">{name}</span></span>
                  <span className="tabular-nums">{n}</span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
