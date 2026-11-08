import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  ArrowDown, ArrowUp, ArrowLeftRight, Bath, Bed, BedDouble, Cake, Check, CheckSquare, ChevronDown, ChevronLeft, ChevronRight, Coffee, Cookie, CupSoda, DoorOpen, Fan, Gift, GlassWater, Heart,
  Leaf, Luggage, Minus, Newspaper, Plus, Sparkles, Star, Sunrise, Trash2, Tv, Users, Utensils, Wind, Wine, type LucideIcon,
  MoonStar,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentHotel } from "@/lib/hotels";
import { useReceptionItemsQuery, useRoomFeaturesQuery, useRoomTypesQuery } from "@/hooks/use-rooms";
import { FLAG_COLORS, FlagIcon, mergeFlagDefs, useCustomFlagsQuery, useFlagSettingsQuery, type CustomFlagRow, type FlagDef } from "@/lib/room-flags";
import { parseCats } from "@/lib/app-format";
import { extrasForRoom, roomJob, type GuestExtra, type GuestExtraRule, type RoomNeed } from "@/lib/guest-extras-rules";
import type { ReceptionItem, Room } from "@/lib/app-types";
import { carriedDirtyCount } from "@/lib/left-dirty";

const errMsg = (e: unknown, f: string) => (e as { message?: string })?.message ?? f;
const chip = (on: boolean) => (on ? "border-primary bg-primary/10 text-primary hover:bg-primary/15" : "");

export const EXTRA_ICONS: Record<string, LucideIcon> = {
  "check-square": CheckSquare, tv: Tv, fan: Fan, wind: Wind, gift: Gift, "glass-water": GlassWater, coffee: Coffee,
  "cup-soda": CupSoda, wine: Wine, cookie: Cookie, cake: Cake, leaf: Leaf, newspaper: Newspaper, bath: Bath, bed: Bed,
  utensils: Utensils, heart: Heart, star: Star, sparkles: Sparkles,
};
const ExtraIcon = ({ name, className }: { name: string | null; className?: string }) => {
  const I = (name && EXTRA_ICONS[name]) || null;
  return I ? <I aria-hidden className={className} /> : null;
};

// One live-update channel however many screens use the list.
let liveUsers = 0;
let liveChannel: ReturnType<typeof supabase.channel> | null = null;
function useLiveExtras(qc: QueryClient) {
  useEffect(() => {
    liveUsers += 1;
    if (!liveChannel) {
      const refresh = () => void qc.invalidateQueries({ queryKey: ["guest-extras"] });
      liveChannel = supabase.channel("guest-extras-live")
        .on("postgres_changes", { event: "*", schema: "public", table: "guest_extras" }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "guest_extra_rules" }, refresh)
        .subscribe();
    }
    return () => {
      liveUsers -= 1;
      if (liveUsers === 0 && liveChannel) { void supabase.removeChannel(liveChannel); liveChannel = null; }
    };
  }, [qc]);
}

export function useGuestExtras() {
  const hotel = useCurrentHotel().data;
  const qc = useQueryClient();
  useLiveExtras(qc);
  return useQuery({
    queryKey: ["guest-extras", hotel?.id],
    enabled: !!hotel?.id,
    queryFn: async () => {
      if (!hotel) throw new Error("Select a hotel first.");
      const [e, r, f] = await Promise.all([
        supabase.from("guest_extras").select("*").eq("hotel_id", hotel.id).order("sort_order").order("created_at"),
        supabase.from("guest_extra_rules").select("*").eq("hotel_id", hotel.id).order("sort_order").order("created_at"),
        supabase.from("room_feature_rooms").select("feature_id,room_number").eq("hotel_id", hotel.id),
      ]);
      if (e.error) throw e.error;
      if (r.error) throw r.error;
      if (f.error) throw f.error;
      return { extras: e.data as GuestExtra[], rules: r.data as GuestExtraRule[], featureRooms: f.data };
    },
  });
}

const sheetGuestsFor = (room: Room) =>
  ["arrival", "turnover", "stayover"].includes(room.sheet_kind ?? "") ? room.sheet_guests ?? null : null;
const guestsFor = (room: Room) => room.guest_extras_guests ?? sheetGuestsFor(room);

const statusLabelOf = (room: Room, statuses: ReceptionItem[] | undefined) => {
  const sid = room.reception_status_id ?? room.default_status;
  return (sid && statuses?.find((s) => s.id === sid)?.label) || "";
};

/** Works out each room's checks and extras for today. Returns null while loading.
 *  fromPaperwork: the morning paperwork's job and guests only (Today's brief), ignoring status changes. */
export function useRoomNeeds(fromPaperwork = false) {
  const data = useGuestExtras().data;
  const statuses = useReceptionItemsQuery().data;
  const flagSettings = useFlagSettingsQuery().data;
  const customFlags = useCustomFlagsQuery().data;
  return useCallback((room: Room): RoomNeed[] | null => {
    if (!data) return null;
    const job = roomJob(room.sheet_kind, fromPaperwork ? "" : statusLabelOf(room, statuses));
    if (fromPaperwork && !job) return [];
    const flagKeysOn = mergeFlagDefs(flagSettings ?? []).filter((d) => d.custom
      ? (customFlags ?? []).some((c) => c.room_number === room.room_number && c.flag_key === d.key)
      : !!(room as unknown as Record<string, unknown>)[d.key]).map((d) => d.key);
    return extrasForRoom(data.extras, data.rules, {
      job,
      roomTypes: parseCats(room.category),
      featureIds: data.featureRooms.filter((f) => f.room_number === room.room_number).map((f) => f.feature_id),
      flagKeysOn,
      note: room.housekeeping_note,
      guests: fromPaperwork ? sheetGuestsFor(room) : guestsFor(room),
      done: room.guest_extras_done ?? [],
    });
  }, [data, statuses, flagSettings, customFlags, fromPaperwork]);
}

/** Room tile: a pink gift while extras still need leaving. */
export function GuestExtrasBadge({ room, className }: { room: Room | undefined; className: string }) {
  const needsFor = useRoomNeeds();
  if (!room || room.done) return null;
  if (!needsFor(room)?.some((n) => n.extra.kind === "leave" && !n.done)) return null;
  return <span aria-label="Extras to leave" title="Extras to leave" className={className + " bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-200"}>
    <Gift aria-hidden className="h-2.5 w-2.5 shrink-0" />
  </span>;
}

export function extrasTotals(rooms: Room[], needsFor: (room: Room) => RoomNeed[] | null) {
  const totals = new Map<string, { extra: GuestExtra; left: number; total: number }>();
  for (const room of rooms) for (const n of needsFor(room) ?? []) {
    if (n.extra.kind !== "leave") continue;
    const t = totals.get(n.extra.id) ?? { extra: n.extra, left: 0, total: 0 };
    t.total += n.quantity;
    if (!n.done) t.left += n.quantity;
    totals.set(n.extra.id, t);
  }
  return [...totals.values()].sort((a, b) => a.extra.sort_order - b.extra.sort_order);
}

/** Today's brief tiles this hotel has turned off. Keys: job:departure|turnover|arrival|stayover|guests, flag:<key>, extra:<id>. */
export function useBriefHidden() {
  const hotel = useCurrentHotel().data;
  return useQuery({
    queryKey: ["shift_brief_settings", hotel?.id],
    enabled: !!hotel?.id,
    queryFn: async () => {
      // Before the table exists (or offline) everything shows.
      const { data, error } = await supabase.from("shift_brief_settings" as never).select("hidden").eq("hotel_id", hotel!.id).maybeSingle();
      if (error) return [] as string[];
      return ((data as { hidden?: string[] } | null)?.hidden ?? []) as string[];
    },
  }).data ?? [];
}

const BRIEF_JOBS = [
  { key: "left_dirty", label: "Left dirty", icon: MoonStar },
  { key: "departure", label: "Departures", icon: DoorOpen },
  { key: "turnover", label: "Depart / Arrivals", icon: ArrowLeftRight },
  { key: "arrival", label: "Arrivals", icon: Luggage },
  { key: "stayover", label: "Stayovers", icon: BedDouble },
  { key: "guests", label: "Guests", icon: Users },
] as const;

/** Hotel settings → Today's brief: a switch for each tile the brief can show, the same for everyone. */
export function ShiftBriefSettingsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const hotel = useCurrentHotel().data;
  const hidden = useBriefHidden();
  const flagDefs = mergeFlagDefs(useFlagSettingsQuery().data ?? []).filter((d) => !d.hidden && d.key !== "guest_vacated" && d.key !== "stayover_out");
  const extras = (useGuestExtras().data?.extras ?? []).filter((e) => e.kind === "leave");
  const [busy, setBusy] = useState(false);
  const set = async (key: string, shown: boolean) => {
    if (!hotel) return;
    const next = shown ? hidden.filter((k) => k !== key) : [...new Set([...hidden, key])].sort();
    setBusy(true);
    const { error } = await supabase.from("shift_brief_settings" as never)
      .upsert({ hotel_id: hotel.id, hidden: next, updated_at: new Date().toISOString() } as never, { onConflict: "hotel_id" });
    setBusy(false);
    if (error) toast.error(errMsg(error, "Couldn't save Today's brief settings."));
    await qc.invalidateQueries({ queryKey: ["shift_brief_settings"] });
  };
  const row = (key: string, label: string, icon: React.ReactNode) => (
    <label key={key} className="flex items-center justify-between gap-3 rounded-lg px-1 py-2 text-sm">
      <span className="flex items-center gap-2.5">{icon}{label}</span>
      <Switch checked={!hidden.includes(key)} disabled={busy} onCheckedChange={(on) => void set(key, on)} />
    </label>
  );
  const heading = (t: string) => <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t}</p>;
  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
      <SheetHeader><SheetTitle>Today's brief</SheetTitle>
        <SheetDescription>What the morning brief on housekeeping's Home shows. It's the same for everyone at this hotel.</SheetDescription></SheetHeader>
      {heading("Rooms & guests")}
      <div className="divide-y">{BRIEF_JOBS.map((j) => row(`job:${j.key}`, j.label, <j.icon className="h-4 w-4 text-muted-foreground" />))}</div>
      {flagDefs.length > 0 && <>{heading("Guest & room info")}
        <div className="divide-y">{flagDefs.map((d) => row(`flag:${d.key}`, d.label, <FlagIcon def={d} className="h-4 w-4 text-muted-foreground" />))}</div></>}
      {extras.length > 0 && <>{heading("Extras needed")}
        <div className="divide-y">{extras.map((e) => row(`extra:${e.id}`, e.name, <ExtraIcon name={e.icon} className="h-4 w-4 text-muted-foreground" />))}</div></>}
    </SheetContent>
  </Sheet>;
}

/** Today's brief is the day's plan: the morning paperwork only, so it doesn't change as rooms are done. */
export function shiftBriefCounts(rooms: Room[], flagDefs: FlagDef[], customFlags: CustomFlagRow[]) {
  const jobs = { departure: 0, turnover: 0, arrival: 0, stayover: 0 };
  let guests = 0;
  const hasPaperwork = rooms.some((room) => !!room.sheet_kind);
  for (const room of rooms) {
    const kind = room.sheet_kind;
    if (kind === "departure" || kind === "turnover" || kind === "arrival" || kind === "stayover") jobs[kind]++;
    guests += sheetGuestsFor(room) ?? 0;
  }
  const flags = flagDefs.filter((d) => !d.hidden && d.key !== "guest_vacated" && d.key !== "stayover_out").map((def) => ({
    def,
    count: rooms.filter((room) => def.custom
      ? customFlags.some((c) => c.room_number === room.room_number && c.flag_key === def.key)
      : (room as unknown as Record<string, unknown>)[def.key] === true).length,
  })).filter((f) => f.count > 0);
  return { hasPaperwork, jobs, guests, flags };
}

/** Housekeeping Home: the paperwork's scheduled work, visible room flags and guest extras. Hidden without paperwork. */
export function ShiftBrief({ rooms }: { rooms: Room[] }) {
  const needsFor = useRoomNeeds(true);
  const flagSettings = useFlagSettingsQuery().data;
  const customFlags = useCustomFlagsQuery().data;
  const [open, setOpen] = useState(false);
  const hidden = new Set(useBriefHidden());
  const counts = shiftBriefCounts(rooms, mergeFlagDefs(flagSettings ?? []), customFlags ?? []);
  const { hasPaperwork, jobs } = counts;
  const guests = hidden.has("job:guests") ? 0 : counts.guests;
  const flags = counts.flags.filter((f) => !hidden.has(`flag:${f.def.key}`));
  const extras = extrasTotals(rooms, needsFor).filter((e) => !hidden.has(`extra:${e.extra.id}`));
  const jobTiles = [
    { key: "left_dirty", count: carriedDirtyCount(rooms), singular: "Left dirty", plural: "Left dirty", icon: MoonStar, color: "bg-room-dirty text-room-dirty-fg" },
    { key: "departure", count: jobs.departure, singular: "Departure", plural: "Departures", icon: DoorOpen, color: "bg-room-dirty text-room-dirty-fg" },
    { key: "turnover", count: jobs.turnover, singular: "Depart / Arrival", plural: "Depart / Arrivals", icon: ArrowLeftRight, color: "bg-room-progress text-room-progress-fg" },
    { key: "arrival", count: jobs.arrival, singular: "Arrival", plural: "Arrivals", icon: Luggage, color: "bg-room-early text-room-early-fg" },
    { key: "stayover", count: jobs.stayover, singular: "Stayover", plural: "Stayovers", icon: BedDouble, color: "bg-room-stayover text-room-stayover-fg" },
  ].filter((j) => j.count > 0 && !hidden.has(`job:${j.key}`));
  if (!hasPaperwork || (!jobTiles.length && !guests && !flags.length && !extras.length)) return null;
  const summary = jobTiles.length
    ? jobTiles.map((j) => `${j.count} ${(j.count === 1 ? j.singular : j.plural).toLowerCase()}`).join(" · ")
    : [...flags.map((f) => `${f.count} ${f.def.label}`), ...extras.map((e) => `${e.total} ${e.extra.name}`)].join(" · ");
  const tile = (key: string, icon: React.ReactNode, count: number, label: string, color: string) => (
    <div key={key} className="flex min-w-0 items-start gap-2.5 rounded-lg bg-sidebar-accent/40 p-3">
      <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${color}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-lg font-bold leading-tight tabular-nums">{count}</p>
        <p className="break-words text-xs text-sidebar-foreground/65">{label}</p>
      </div>
    </div>
  );
  // Like the app: a one-line card that opens the details in a pop-up sheet.
  return <section aria-label="Today's brief" className="w-full rounded-2xl border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-elevation-2">
    <Button type="button" variant="ghost" aria-haspopup="dialog"
      className="h-auto w-full justify-start gap-3 whitespace-normal rounded-2xl px-3 py-2.5 text-left text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground sm:px-4"
      onClick={() => setOpen(true)}>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sidebar-primary/15 text-sidebar-primary"><Sunrise className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-sm font-semibold leading-tight">Today's brief</span>
        <span className="mt-0.5 block break-words text-xs text-sidebar-foreground/65">{summary}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0" />
    </Button>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="bottom" className="max-lg:h-auto max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-sidebar p-4 text-sidebar-foreground sm:mx-auto sm:max-w-2xl sm:p-6">
        <SheetHeader className="mb-3 text-left">
          <SheetTitle className="font-display">Today's brief</SheetTitle>
          <SheetDescription className="text-sidebar-foreground/65">{summary}</SheetDescription>
        </SheetHeader>
        <div className="space-y-3">
      {(jobTiles.length > 0 || guests > 0) && <div className="grid grid-cols-2 gap-2">
        {jobTiles.map((j) => tile(j.singular, <j.icon className="h-4 w-4" />, j.count, j.count === 1 ? j.singular : j.plural, j.color))}
        {guests > 0 && tile("guests", <Users className="h-4 w-4" />, guests, guests === 1 ? "Guest" : "Guests", "bg-muted text-muted-foreground")}
      </div>}
      {flags.length === 1 && extras.length === 1 ? (
        // One of each fits side by side, each under its own heading.
        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-semibold uppercase text-sidebar-foreground/65">Guest &amp; Room Info</p>
            {tile(flags[0].def.key, <FlagIcon def={flags[0].def} className="h-4 w-4" />, flags[0].count, flags[0].def.label, (FLAG_COLORS[flags[0].def.color] ?? FLAG_COLORS.slate).badge)}
          </div>
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-semibold uppercase text-sidebar-foreground/65">Extras needed</p>
            {tile(extras[0].extra.id, <ExtraIcon name={extras[0].extra.icon} className="h-4 w-4" />, extras[0].total, extras[0].extra.name, FLAG_COLORS.pink.badge)}
          </div>
        </div>
      ) : <>
        {flags.length > 0 && <div className="space-y-2">
          <p className="text-xs font-semibold uppercase text-sidebar-foreground/65">Guest &amp; Room Info</p>
          <div className="grid grid-cols-2 gap-2">{flags.map(({ def, count }) => tile(def.key, <FlagIcon def={def} className="h-4 w-4" />, count, def.label, (FLAG_COLORS[def.color] ?? FLAG_COLORS.slate).badge))}</div>
        </div>}
        {extras.length > 0 && <div className="space-y-2">
          <p className="text-xs font-semibold uppercase text-sidebar-foreground/65">Extras needed</p>
          <div className="grid grid-cols-2 gap-2">{extras.map((e) => tile(e.extra.id, <ExtraIcon name={e.extra.icon} className="h-4 w-4" />, e.total, e.extra.name, FLAG_COLORS.pink.badge))}</div>
        </div>}
      </>}
        </div>
      </SheetContent>
    </Sheet>
  </section>;
}

/** Room view: checks to tick as present, then extras to leave for the guest. */
export function RoomGuestExtras({ room }: { room: Room }) {
  const needsFor = useRoomNeeds();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const needs = needsFor(room);
  if (!needs?.length) return null;
  const checks = needs.filter((n) => n.extra.kind === "check");
  const leaves = needs.filter((n) => n.extra.kind === "leave");
  const setGuests = guestsFor(room);
  const guests = setGuests ?? 1;
  const run = async (fn: () => PromiseLike<{ error: unknown }>) => {
    setBusy(true);
    try { const { error } = await fn(); if (error) throw error; await qc.invalidateQueries({ queryKey: ["rooms"] }); }
    catch (e) { toast.error(errMsg(e, "Could not save the room checklist.")); }
    finally { setBusy(false); }
  };
  const grid = (items: RoomNeed[]) => <div className="grid grid-cols-2 gap-1.5">
    {items.map(({ extra, quantity, done }) => <Button key={extra.id} type="button" variant="outline" aria-pressed={done} disabled={busy}
      className={`h-auto min-h-12 w-full min-w-0 justify-center gap-2 whitespace-normal rounded-xl px-3 py-3 text-sm font-medium ${chip(done)}`}
      onClick={() => run(() => supabase.rpc("set_guest_extra_done", { p_room_number: room.room_number, p_extra: extra.id, p_done: !done }))}>
      {/* The plain tick icon looked like a checkbox, so items without their own icon get a bullet. */}
      {done ? <Check className="h-4 w-4 shrink-0" />
        : !extra.icon || extra.icon === "check-square" ? <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
        : <ExtraIcon name={extra.icon} className="h-4 w-4 shrink-0" />}
      <span className="min-w-0 break-words">{extra.kind === "leave" ? `${quantity} × ${extra.name}` : extra.name}</span>
    </Button>)}
  </div>;
  return <div className="space-y-4 border-t border-border/60 pt-4">
    {checks.length > 0 && <div className="space-y-2">
      <p className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Check</p>
      {grid(checks)}
    </div>}
    {leaves.length > 0 && <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Leave in room</p>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Fewer guests" disabled={busy || guests <= 1}
            onClick={() => run(() => supabase.rpc("set_guest_extras_guests", { p_room_number: room.room_number, p_guests: guests - 1 }))}><Minus className="h-4 w-4" /></Button>
          <span className={`min-w-16 text-center text-sm ${setGuests === null ? "font-semibold text-orange-600 dark:text-orange-400" : ""}`}>
            {setGuests === null ? "Guests?" : `${guests} guest${guests === 1 ? "" : "s"}`}
          </span>
          <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="More guests" disabled={busy || guests >= 20}
            onClick={() => run(() => supabase.rpc("set_guest_extras_guests", { p_room_number: room.room_number, p_guests: setGuests === null ? 1 : guests + 1 }))}><Plus className="h-4 w-4" /></Button>
        </div>
      </div>
      {grid(leaves)}
    </div>}
  </div>;
}

type Run = (fn: () => PromiseLike<{ error: unknown }>, ok?: string) => Promise<void>;
type Opt = { value: string; label: string };

/** Settings: the hotel's Room Checklist. A short list of checks and extras, like the app;
 *  opening one shows its name, icon and rules, saved together. */
export function GuestExtrasEditor() {
  const data = useGuestExtras();
  const hotel = useCurrentHotel().data;
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"check" | "leave">("check");
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const run: Run = async (fn, ok) => {
    setBusy(true);
    try { const { error } = await fn(); if (error) throw error; await qc.invalidateQueries({ queryKey: ["guest-extras"] }); if (ok) toast.success(ok); }
    catch (e) { toast.error(errMsg(e, "Could not save the room checklist.")); }
    finally { setBusy(false); }
  };
  if (data.isPending) return <p className="py-3 text-sm text-muted-foreground">Loading checklist…</p>;
  if (data.isError) return <Button className="my-3" onClick={() => void data.refetch()}>Retry</Button>;
  const { extras, rules } = data.data;
  const opened = extras.find((e) => e.id === openId);
  if (opened) return <ExtraDetail key={opened.id} extra={opened} rules={rules.filter((r) => r.extra_id === opened.id)} onBack={() => setOpenId(null)} />;

  const byOrder = (a: GuestExtra, b: GuestExtra) => a.sort_order - b.sort_order;
  const checks = extras.filter((e) => e.kind === "check").sort(byOrder);
  const leaves = extras.filter((e) => e.kind === "leave").sort(byOrder);
  const move = (list: GuestExtra[], i: number, dir: number) => {
    const next = [...list];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    return run(async () => {
      for (const [j, e] of next.entries()) {
        const res = await supabase.from("guest_extras").update({ sort_order: j }).eq("id", e.id);
        if (res.error) return res;
      }
      return { error: null };
    });
  };
  const section = (title: string, list: GuestExtra[], footer: string) => <div className="space-y-1">
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
    <div className="divide-y divide-border rounded-xl border">
      {list.map((extra, i) => {
        const count = rules.filter((r) => r.extra_id === extra.id).length;
        return <div key={extra.id} className="flex items-center gap-1 pr-1">
          <Button variant="ghost" className="h-auto min-w-0 flex-1 justify-start gap-3 rounded-none px-3 py-2.5 text-left" onClick={() => setOpenId(extra.id)}>
            <ExtraIcon name={extra.icon} className="h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{extra.name}</span>
              <span className="block text-xs font-normal text-muted-foreground">{count ? `${count} rule${count === 1 ? "" : "s"}` : "Not in any rooms yet"}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Button>
          <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" aria-label={`Move ${extra.name} up`} disabled={busy || i === 0} onClick={() => move(list, i, -1)}><ArrowUp className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" aria-label={`Move ${extra.name} down`} disabled={busy || i === list.length - 1} onClick={() => move(list, i, 1)}><ArrowDown className="h-4 w-4" /></Button>
        </div>;
      })}
      {!list.length && <p className="px-3 py-2.5 text-sm text-muted-foreground">None yet.</p>}
    </div>
    <p className="text-xs text-muted-foreground">{footer}</p>
  </div>;

  return <div className="space-y-5 py-3">
    <form className="space-y-2" onSubmit={(e) => {
      e.preventDefault();
      const v = name.trim();
      if (!v || !hotel) return;
      const list = kind === "check" ? checks : leaves;
      void run(async () => {
        const res = await supabase.from("guest_extras").insert({ hotel_id: hotel.id, name: v, kind, sort_order: list.length, icon: kind === "check" ? "check-square" : "gift" }).select("id").single();
        if (res.error) return res;
        setName("");
        const rule = await supabase.from("guest_extra_rules").insert({ hotel_id: hotel.id, extra_id: res.data.id, ...newRule(kind) });
        if (!rule.error) setOpenId(res.data.id);
        return rule;
      }, "Item added");
    }}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">New item</p>
      <div className="grid grid-cols-2 gap-1">
        {(["check", "leave"] as const).map((k) => <Button key={k} type="button" size="sm" variant="outline" aria-pressed={kind === k} className={chip(kind === k)} onClick={() => setKind(k)}>
          {k === "check" ? "Check" : "Extra"}
        </Button>)}
      </div>
      <div className="flex gap-2">
        <Input aria-label="New item name" placeholder={kind === "check" ? "e.g. TV remote" : "e.g. Water bottle"} value={name} onChange={(e) => setName(e.target.value)} disabled={busy} maxLength={80} />
        <Button type="submit" disabled={busy || !name.trim() || !hotel}><Plus className="mr-1 h-4 w-4" />Add</Button>
      </div>
      <p className="text-xs text-muted-foreground">Checks are ticked as present, like a TV remote or fan. Extras are left for the guest, so many for each number of guests, like water or coffee pods.</p>
    </form>
    {section("Checks", checks, "Ticked as present when the room is serviced. Open one to choose which rooms have it.")}
    {section("Extras", leaves, "Left for the guest. Open one to choose which rooms get it, when, and how many for each number of guests.")}
  </div>;
}

const newRule = (kind: "check" | "leave") => kind === "check"
  ? { applies_to: "any" as const, quantities: [1], extra_per_guest: 0 }
  : { applies_to: "arrival" as const, quantities: [1, 2], extra_per_guest: 1 };

type DraftRule = Omit<GuestExtraRule, "id" | "extra_id" | "sort_order"> & { key: string };
const toDraft = (r: GuestExtraRule): DraftRule => ({
  key: r.id, applies_to: r.applies_to, room_types: r.room_types, room_features: r.room_features, except_features: r.except_features,
  flags: r.flags, note_words: r.note_words, quantities: r.quantities, extra_per_guest: r.extra_per_guest,
});
const cleanWords = (words: string[]) => words.map((w) => w.trim()).filter(Boolean);
const snapshot = (name: string, icon: string, rules: DraftRule[]) =>
  JSON.stringify([name.trim(), icon, rules.map(({ key: _key, ...r }) => ({ ...r, note_words: cleanWords(r.note_words) }))]);

/** One checklist item: name, icon and its rules, edited together and saved with Save. */
function ExtraDetail({ extra, rules: savedRules, onBack }: { extra: GuestExtra; rules: GuestExtraRule[]; onBack: () => void }) {
  const types = useRoomTypesQuery();
  const features = useRoomFeaturesQuery();
  const flagDefs = mergeFlagDefs(useFlagSettingsQuery().data ?? []);
  const hotel = useCurrentHotel().data;
  const qc = useQueryClient();
  const initial = () => savedRules.slice().sort((a, b) => a.sort_order - b.sort_order).map(toDraft);
  const [name, setName] = useState(extra.name);
  const [icon, setIcon] = useState(extra.icon ?? "gift");
  const [rules, setRules] = useState<DraftRule[]>(initial);
  const [savedState, setSavedState] = useState(() => snapshot(extra.name, extra.icon ?? "gift", initial()));
  const [busy, setBusy] = useState(false);
  const isCheck = extra.kind === "check";
  const saved = snapshot(name, icon, rules) === savedState;
  const opts = {
    types: (types.data ?? []).map((t) => ({ value: t.value as string, label: t.label })),
    features: (features.data ?? []).map((f) => ({ value: f.id, label: f.label })),
    flags: flagDefs.map((d) => ({ value: d.key, label: d.label })),
  };
  const update = (key: string, patch: Partial<DraftRule>) => setRules((rs) => rs.map((r) => r.key === key ? { ...r, ...patch } : r));

  const save = async () => {
    const v = name.trim();
    if (!v || !hotel) return;
    setBusy(true);
    try {
      const e = await supabase.from("guest_extras").update({ name: v, icon }).eq("id", extra.id);
      if (e.error) throw e.error;
      const d = await supabase.from("guest_extra_rules").delete().eq("extra_id", extra.id);
      if (d.error) throw d.error;
      if (rules.length) {
        const i = await supabase.from("guest_extra_rules").insert(rules.map(({ key: _key, ...r }, j) => ({
          ...r, note_words: cleanWords(r.note_words), hotel_id: hotel.id, extra_id: extra.id, sort_order: j,
        })));
        if (i.error) throw i.error;
      }
      setSavedState(snapshot(v, icon, rules));
      await qc.invalidateQueries({ queryKey: ["guest-extras"] });
      toast.success("Saved");
    } catch (e) { toast.error(errMsg(e, "Could not save the room checklist.")); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!confirm(`Remove ${extra.name}? Rooms will stop showing it. This can't be undone.`)) return;
    setBusy(true);
    const { error } = await supabase.from("guest_extras").delete().eq("id", extra.id);
    setBusy(false);
    if (error) return void toast.error(errMsg(error, "Could not remove it."));
    await qc.invalidateQueries({ queryKey: ["guest-extras"] });
    toast.success("Item removed");
    onBack();
  };

  return <div className="space-y-4 py-3">
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" className="gap-1 px-2" onClick={() => {
        if (saved || confirm("Leave without saving your changes?")) onBack();
      }}><ChevronLeft className="h-4 w-4" />Room Checklist</Button>
      <span className="flex-1" />
      <Button size="sm" disabled={busy || saved || !name.trim()} onClick={() => void save()}>{busy ? "Saving…" : saved ? "Saved" : "Save"}</Button>
    </div>
    <label className="block space-y-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name</span>
      <Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
    </label>
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Icon</p>
      <div className="flex flex-wrap gap-1">
        {Object.entries(EXTRA_ICONS).map(([k, I]) => <Button key={k} size="icon" variant="outline" aria-label={k} aria-pressed={icon === k}
          className={chip(icon === k)} onClick={() => setIcon(k)}><I className="h-4 w-4" /></Button>)}
      </div>
    </div>
    {rules.map((rule) => <RuleCard key={rule.key} rule={rule} isCheck={isCheck} opts={opts}
      onChange={(patch) => update(rule.key, patch)} onRemove={() => setRules((rs) => rs.filter((r) => r.key !== rule.key))} />)}
    <div className="space-y-1">
      <Button size="sm" variant="outline" onClick={() => setRules((rs) => [...rs, {
        key: crypto.randomUUID(), room_types: [], room_features: [], except_features: [], flags: [], note_words: [], ...newRule(extra.kind),
      }])}><Plus className="mr-1 h-4 w-4" />Add rule</Button>
      <p className="text-xs text-muted-foreground">{isCheck
        ? "A room needs this when one of the rules fits it. With no rules, no room needs it."
        : "When more than one rule fits a room, the one with the most conditions is used, so \"Superior + Birthday\" comes before \"Birthday\". Rooms without a guest count from the paperwork use the 1 guest amount until it's set on the room."}</p>
    </div>
    <Button variant="ghost" size="sm" className="text-destructive" disabled={busy} onClick={() => void remove()}>
      <Trash2 className="mr-1 h-4 w-4" />Remove {isCheck ? "check" : "extra"}
    </Button>
  </div>;
}

function ruleSummary(rule: Omit<GuestExtraRule, "id" | "extra_id" | "sort_order">, opts: { types: Opt[]; features: Opt[]; flags: Opt[] }) {
  const label = (list: Opt[], v: string) => list.find((o) => o.value === v)?.label ?? v;
  const parts = [
    rule.room_types.map((v) => label(opts.types, v)).join(" or "),
    rule.room_features.map((v) => label(opts.features, v)).join(" or "),
    rule.flags.map((v) => label(opts.flags, v)).join(" or "),
    rule.note_words.length ? `note says ${rule.note_words.join(" or ")}` : "",
  ].filter(Boolean);
  const not = rule.except_features.map((v) => label(opts.features, v)).join(" or ");
  const job = { arrival: "arrivals", stayover: "stayovers", both: "arrivals and stayovers", any: "every day" }[rule.applies_to];
  return `${parts.join(" + ") || "All rooms"}${not ? `, not ${not}` : ""}, ${job}`;
}

function Chips({ title, anyLabel, options, value, busy, onChange }: {
  title: string; anyLabel: string; options: Opt[]; value: string[]; busy: boolean; onChange: (v: string[]) => void;
}) {
  if (!options.length) return null;
  return <div className="space-y-1">
    <p className="text-xs text-muted-foreground">{title}</p>
    <div className="flex flex-wrap gap-1">
      <Button size="sm" variant="outline" aria-pressed={!value.length} disabled={busy} className={chip(!value.length)} onClick={() => onChange([])}>{anyLabel}</Button>
      {options.map((o) => {
        const on = value.includes(o.value);
        return <Button key={o.value} size="sm" variant="outline" aria-pressed={on} disabled={busy} className={chip(on)}
          onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}>{o.label}</Button>;
      })}
    </div>
  </div>;
}

function RuleCard({ rule, isCheck, opts, onChange, onRemove }: {
  rule: DraftRule; isCheck: boolean; opts: { types: Opt[]; features: Opt[]; flags: Opt[] };
  onChange: (patch: Partial<DraftRule>) => void; onRemove: () => void;
}) {
  const clamp = (n: number) => Math.max(0, Math.min(99, n));
  const stepper = (label: string, value: number, set: (n: number) => void) => <div className="flex items-center justify-between gap-2">
    <span className="text-sm">{label}</span>
    <span className="flex items-center gap-1">
      <Button size="icon" variant="outline" className="h-8 w-8" aria-label={`Fewer: ${label}`} disabled={value <= 0} onClick={() => set(clamp(value - 1))}><Minus className="h-3.5 w-3.5" /></Button>
      <span className="w-8 text-center font-semibold tabular-nums">{value}</span>
      <Button size="icon" variant="outline" className="h-8 w-8" aria-label={`More: ${label}`} disabled={value >= 99} onClick={() => set(clamp(value + 1))}><Plus className="h-3.5 w-3.5" /></Button>
    </span>
  </div>;
  return <div className="space-y-3 rounded-xl border p-3">
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{ruleSummary({ ...rule, note_words: cleanWords(rule.note_words) }, opts)}</p>
    <div className="grid grid-cols-4 gap-1">
      {(["arrival", "stayover", "both", "any"] as const).map((a) => <Button key={a} size="sm" variant="outline" aria-pressed={rule.applies_to === a}
        className={chip(rule.applies_to === a) + " px-1"} onClick={() => onChange({ applies_to: a })}>
        {{ arrival: "Arrival", stayover: "Stayover", both: "Both", any: "Every day" }[a]}
      </Button>)}
    </div>
    <Chips title="Room types" anyLabel="Any type" options={opts.types} value={rule.room_types} busy={false} onChange={(v) => onChange({ room_types: v })} />
    <Chips title="Has a feature" anyLabel="Any" options={opts.features} value={rule.room_features} busy={false} onChange={(v) => onChange({ room_features: v })} />
    <Chips title="Not in rooms with" anyLabel="No exceptions" options={opts.features} value={rule.except_features} busy={false} onChange={(v) => onChange({ except_features: v })} />
    <Chips title="Guest & Room Info" anyLabel="Any" options={opts.flags} value={rule.flags} busy={false} onChange={(v) => onChange({ flags: v })} />
    <label className="block space-y-1">
      <span className="text-xs text-muted-foreground">Housekeeping note mentions</span>
      <Input placeholder="e.g. tour, honeymoon" value={rule.note_words.join(",")}
        onChange={(e) => onChange({ note_words: e.target.value.split(",") })} />
      <span className="block text-xs text-muted-foreground">Separate words with commas. The paperwork's notes are saved here too.</span>
    </label>
    {!isCheck && <div className="space-y-2">
      {rule.quantities.map((q, i) => <div key={i}>{stepper(`${i + 1} guest${i ? "s" : ""}`, q, (n) => onChange({ quantities: rule.quantities.map((x, j) => j === i ? n : x) }))}</div>)}
      <div className="flex items-center justify-between">
        <Button size="sm" variant="ghost" className="px-2" disabled={rule.quantities.length >= 6}
          onClick={() => onChange({ quantities: [...rule.quantities, (rule.quantities[rule.quantities.length - 1] ?? 0) + rule.extra_per_guest] })}>
          <Plus className="mr-1 h-4 w-4" />Add a guest count</Button>
        {rule.quantities.length > 1 && <Button size="sm" variant="ghost" className="px-2 text-destructive" onClick={() => onChange({ quantities: rule.quantities.slice(0, -1) })}>Remove last</Button>}
      </div>
      {stepper("Each extra guest adds", rule.extra_per_guest, (n) => onChange({ extra_per_guest: n }))}
    </div>}
    <Button size="sm" variant="ghost" className="px-2 text-destructive" onClick={onRemove}><Trash2 className="mr-1 h-4 w-4" />Remove rule</Button>
  </div>;
}
