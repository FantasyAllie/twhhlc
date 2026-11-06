import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  ArrowDown, ArrowUp, ArrowLeftRight, Bath, Bed, BedDouble, Cake, Check, CheckSquare, ChevronDown, Coffee, Cookie, CupSoda, DoorOpen, Fan, Gift, GlassWater, Heart,
  Leaf, Luggage, Minus, Newspaper, Plus, Sparkles, Star, Sunrise, Trash2, Tv, Users, Utensils, Wind, Wine, type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentHotel } from "@/lib/hotels";
import { useReceptionItemsQuery, useRoomFeaturesQuery, useRoomTypesQuery } from "@/hooks/use-rooms";
import { FLAG_COLORS, FlagIcon, mergeFlagDefs, useCustomFlagsQuery, useFlagSettingsQuery, type CustomFlagRow, type FlagDef } from "@/lib/room-flags";
import { parseCats } from "@/lib/app-format";
import { extrasForRoom, roomJob, type GuestExtra, type GuestExtraRule, type RoomNeed } from "@/lib/guest-extras-rules";
import type { ReceptionItem, Room } from "@/lib/app-types";

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

/** Room Completion pop-up: each extra today's rooms need, left of total. */
export function ExtrasStillToLeave({ rooms, className }: { rooms: Room[]; className?: string }) {
  const needsFor = useRoomNeeds();
  const totals = extrasTotals(rooms, needsFor);
  if (!totals.length) return null;
  return <div className={className}>
    <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Extras still to leave</p>
    <ul className="mt-1.5 space-y-1.5 text-sm">
      {totals.map((t) => <li key={t.extra.id} className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2"><ExtraIcon name={t.extra.icon} className="h-3.5 w-3.5" />{t.extra.name}</span>
        <span className="font-semibold tabular-nums">{t.left} of {t.total}</span>
      </li>)}
    </ul>
  </div>;
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
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try { setOpen(localStorage.getItem("shift_brief_open") !== "false"); } catch { /* Storage may be unavailable. */ }
  }, []);
  const { hasPaperwork, jobs, guests, flags } = shiftBriefCounts(rooms, mergeFlagDefs(flagSettings ?? []), customFlags ?? []);
  const extras = extrasTotals(rooms, needsFor);
  const jobTiles = [
    { count: jobs.departure, singular: "Departure", plural: "Departures", icon: DoorOpen, color: "bg-room-dirty text-room-dirty-fg" },
    { count: jobs.turnover, singular: "Depart / Arrival", plural: "Depart / Arrivals", icon: ArrowLeftRight, color: "bg-room-progress text-room-progress-fg" },
    { count: jobs.arrival, singular: "Arrival", plural: "Arrivals", icon: Luggage, color: "bg-room-early text-room-early-fg" },
    { count: jobs.stayover, singular: "Stayover", plural: "Stayovers", icon: BedDouble, color: "bg-room-stayover text-room-stayover-fg" },
  ].filter((j) => j.count > 0);
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
  return <section aria-label="Today's brief" className="w-full rounded-2xl border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-elevation-2">
    <Button type="button" variant="ghost" aria-expanded={open} aria-controls="shift-brief-details"
      className="h-auto w-full justify-start gap-3 whitespace-normal rounded-2xl px-3 py-2.5 text-left text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground sm:px-4"
      onClick={() => {
        const next = !open;
        setOpen(next);
        try { localStorage.setItem("shift_brief_open", String(next)); } catch { /* Keep the toggle working without storage. */ }
      }}>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sidebar-primary/15 text-sidebar-primary"><Sunrise className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-sm font-semibold leading-tight">Today's brief</span>
        <span className="mt-0.5 block break-words text-xs text-sidebar-foreground/65">{summary}</span>
      </span>
      <ChevronDown className={`h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
    </Button>
    {open && <div id="shift-brief-details" className="space-y-3 px-3 pb-3 sm:px-4">
      {(jobTiles.length > 0 || guests > 0) && <div className="grid grid-cols-2 gap-2">
        {jobTiles.map((j) => tile(j.singular, <j.icon className="h-4 w-4" />, j.count, j.count === 1 ? j.singular : j.plural, j.color))}
        {guests > 0 && tile("guests", <Users className="h-4 w-4" />, guests, guests === 1 ? "Guest" : "Guests", "bg-muted text-muted-foreground")}
      </div>}
      {flags.length > 0 && <div className="space-y-2">
        <p className="text-xs font-semibold uppercase text-sidebar-foreground/65">Guest &amp; Room Info</p>
        <div className="grid grid-cols-2 gap-2">{flags.map(({ def, count }) => tile(def.key, <FlagIcon def={def} className="h-4 w-4" />, count, def.label, (FLAG_COLORS[def.color] ?? FLAG_COLORS.slate).badge))}</div>
      </div>}
      {extras.length > 0 && <div className="space-y-2">
        <p className="text-xs font-semibold uppercase text-sidebar-foreground/65">Extras needed</p>
        <div className="grid grid-cols-2 gap-2">{extras.map((e) => tile(e.extra.id, <ExtraIcon name={e.extra.icon} className="h-4 w-4" />, e.total, e.extra.name, FLAG_COLORS.pink.badge))}</div>
      </div>}
    </div>}
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
      {done ? <Check className="h-4 w-4 shrink-0" /> : <ExtraIcon name={extra.icon} className="h-4 w-4 shrink-0" />}
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

/** Settings: the hotel's Room Checklist — checks and extras, each with rules. */
export function GuestExtrasEditor() {
  const data = useGuestExtras();
  const types = useRoomTypesQuery();
  const features = useRoomFeaturesQuery();
  const flagDefs = mergeFlagDefs(useFlagSettingsQuery().data ?? []);
  const hotel = useCurrentHotel().data;
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"check" | "leave">("check");
  const [busy, setBusy] = useState(false);
  const run: Run = async (fn, ok) => {
    setBusy(true);
    try { const { error } = await fn(); if (error) throw error; await qc.invalidateQueries({ queryKey: ["guest-extras"] }); if (ok) toast.success(ok); }
    catch (e) { toast.error(errMsg(e, "Could not save the room checklist.")); }
    finally { setBusy(false); }
  };
  if (data.isPending) return <p className="py-3 text-sm text-muted-foreground">Loading checklist…</p>;
  if (data.isError) return <Button className="my-3" onClick={() => void data.refetch()}>Retry</Button>;
  const { extras, rules } = data.data;
  const opts = {
    types: (types.data ?? []).map((t) => ({ value: t.value as string, label: t.label })),
    features: (features.data ?? []).map((f) => ({ value: f.id, label: f.label })),
    flags: flagDefs.map((d) => ({ value: d.key, label: d.label })),
  };
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
  const section = (title: string, list: GuestExtra[]) => list.length > 0 && <div className="space-y-2">
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
    {list.map((extra, i) => <div key={extra.id} className="space-y-2 rounded-xl border p-3">
      <div className="flex items-center gap-1">
        <IconPicker value={extra.icon} disabled={busy} onPick={(icon) => run(() => supabase.from("guest_extras").update({ icon }).eq("id", extra.id))} />
        <Input aria-label="Item name" defaultValue={extra.name} disabled={busy} className="min-w-0 flex-1"
          onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== extra.name) void run(() => supabase.from("guest_extras").update({ name: v }).eq("id", extra.id)); }} />
        <Button size="icon" variant="ghost" aria-label={`Move ${extra.name} up`} disabled={busy || i === 0} onClick={() => move(list, i, -1)}><ArrowUp className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" aria-label={`Move ${extra.name} down`} disabled={busy || i === list.length - 1} onClick={() => move(list, i, 1)}><ArrowDown className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" className="text-destructive" aria-label={`Remove ${extra.name}`} disabled={busy}
          onClick={() => run(() => supabase.from("guest_extras").delete().eq("id", extra.id), "Item removed")}><Trash2 className="h-4 w-4" /></Button>
      </div>
      {rules.filter((r) => r.extra_id === extra.id).map((rule) => <RuleRow key={rule.id} rule={rule} kind={extra.kind} busy={busy} run={run} opts={opts} />)}
      <Button size="sm" variant="outline" disabled={busy || !hotel} onClick={() => hotel && run(() => supabase.from("guest_extra_rules").insert({
        hotel_id: hotel.id, extra_id: extra.id, sort_order: rules.length,
        ...(extra.kind === "check" ? { applies_to: "any", quantities: [1], extra_per_guest: 0 } : { applies_to: "arrival", quantities: [1, 2], extra_per_guest: 1 }),
      }))}><Plus className="mr-1 h-4 w-4" />Add rule</Button>
    </div>)}
  </div>;
  const byOrder = (a: GuestExtra, b: GuestExtra) => a.sort_order - b.sort_order;
  const checks = extras.filter((e) => e.kind === "check").sort(byOrder);
  const leaves = extras.filter((e) => e.kind === "leave").sort(byOrder);
  return <div className="space-y-4 py-3">
    <p className="text-sm text-muted-foreground">Checks are ticked as present, like a TV remote. Extras are left for the guest, like water, with an amount per guest.</p>
    {section("Checks", checks)}
    {section("Extras", leaves)}
    <form className="space-y-2" onSubmit={(e) => {
      e.preventDefault();
      const v = name.trim();
      if (!v || !hotel) return;
      const list = kind === "check" ? checks : leaves;
      void run(async () => {
        const res = await supabase.from("guest_extras").insert({ hotel_id: hotel.id, name: v, kind, sort_order: list.length, icon: kind === "check" ? "check-square" : "gift" }).select("id").single();
        if (res.error) return res;
        setName("");
        return supabase.from("guest_extra_rules").insert({
          hotel_id: hotel.id, extra_id: res.data.id,
          ...(kind === "check" ? { applies_to: "any", quantities: [1], extra_per_guest: 0 } : { applies_to: "arrival", quantities: [1, 2], extra_per_guest: 1 }),
        });
      }, "Item added");
    }}>
      <div className="grid grid-cols-2 gap-1">
        {(["check", "leave"] as const).map((k) => <Button key={k} type="button" size="sm" variant="outline" aria-pressed={kind === k} className={chip(kind === k)} onClick={() => setKind(k)}>
          {k === "check" ? "Check" : "Extra"}
        </Button>)}
      </div>
      <div className="flex gap-2">
        <Input placeholder={kind === "check" ? "New check, e.g. TV remote" : "New extra, e.g. Bottled water"} value={name} onChange={(e) => setName(e.target.value)} disabled={busy} maxLength={80} />
        <Button type="submit" disabled={busy || !name.trim()}><Plus className="mr-1 h-4 w-4" />Add</Button>
      </div>
    </form>
  </div>;
}

function IconPicker({ value, disabled, onPick }: { value: string | null; disabled: boolean; onPick: (icon: string) => void }) {
  const [open, setOpen] = useState(false);
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <Button size="icon" variant="outline" aria-label="Choose icon" disabled={disabled}>
        {value && EXTRA_ICONS[value] ? <ExtraIcon name={value} className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      </Button>
    </PopoverTrigger>
    <PopoverContent className="grid w-56 grid-cols-5 gap-1 p-2">
      {Object.entries(EXTRA_ICONS).map(([key, I]) => <Button key={key} size="icon" variant="ghost" aria-label={key} aria-pressed={value === key}
        className={chip(value === key)} onClick={() => { setOpen(false); onPick(key); }}><I className="h-4 w-4" /></Button>)}
    </PopoverContent>
  </Popover>;
}

function ruleSummary(rule: GuestExtraRule, opts: { types: Opt[]; features: Opt[]; flags: Opt[] }) {
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

function RuleRow({ rule, kind, busy, run, opts }: {
  rule: GuestExtraRule; kind: "check" | "leave"; busy: boolean; run: Run; opts: { types: Opt[]; features: Opt[]; flags: Opt[] };
}) {
  const save = (patch: Partial<GuestExtraRule>) => run(() => supabase.from("guest_extra_rules").update(patch).eq("id", rule.id));
  const setQty = (i: number, n: number) => save({ quantities: rule.quantities.map((q, j) => j === i ? Math.max(0, Math.min(99, n)) : q) });
  return <div className="space-y-2 rounded-lg bg-muted/40 p-2 text-sm">
    <div className="flex items-start justify-between gap-2">
      <p className="text-sm font-medium">{ruleSummary(rule, opts)}</p>
      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive" aria-label="Remove rule" disabled={busy}
        onClick={() => run(() => supabase.from("guest_extra_rules").delete().eq("id", rule.id))}><Trash2 className="h-4 w-4" /></Button>
    </div>
    <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
      {(["arrival", "stayover", "both", "any"] as const).map((a) => <Button key={a} size="sm" variant="outline" aria-pressed={rule.applies_to === a} disabled={busy}
        className={chip(rule.applies_to === a)} onClick={() => save({ applies_to: a })}>
        {{ arrival: "Arrival", stayover: "Stayover", both: "Both", any: "Every day" }[a]}
      </Button>)}
    </div>
    <Chips title="Room type" anyLabel="Any type" options={opts.types} value={rule.room_types} busy={busy} onChange={(v) => save({ room_types: v })} />
    <Chips title="Has a feature" anyLabel="Any" options={opts.features} value={rule.room_features} busy={busy} onChange={(v) => save({ room_features: v })} />
    <Chips title="Not in rooms with" anyLabel="No exceptions" options={opts.features} value={rule.except_features} busy={busy} onChange={(v) => save({ except_features: v })} />
    <Chips title="Guest & Room Info" anyLabel="Any" options={opts.flags} value={rule.flags} busy={busy} onChange={(v) => save({ flags: v })} />
    <label className="block space-y-1">
      <span className="text-xs text-muted-foreground">Housekeeping note mentions</span>
      <Input placeholder="e.g. anniversary, birthday" defaultValue={rule.note_words.join(", ")} disabled={busy}
        onBlur={(e) => {
          const words = e.target.value.split(",").map((w) => w.trim()).filter(Boolean);
          if (words.join(",") !== rule.note_words.join(",")) void save({ note_words: words });
        }} />
    </label>
    {kind === "leave" && <div className="flex flex-wrap items-end gap-2">
      {rule.quantities.map((q, i) => <label key={i} className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
        {i + 1} guest{i ? "s" : ""}
        <Input type="number" min={0} max={99} defaultValue={q} disabled={busy} className="h-9 w-14 text-center"
          onBlur={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && n !== q) void setQty(i, n); }} />
      </label>)}
      {rule.quantities.length < 6 && <Button size="sm" variant="ghost" disabled={busy} onClick={() => save({ quantities: [...rule.quantities, rule.quantities[rule.quantities.length - 1] ?? 1] })}>+ guest</Button>}
      <label className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
        Each extra guest
        <Input type="number" min={0} max={99} defaultValue={rule.extra_per_guest} disabled={busy} className="h-9 w-14 text-center"
          onBlur={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && n !== rule.extra_per_guest) void save({ extra_per_guest: Math.max(0, Math.min(99, n)) }); }} />
      </label>
    </div>}
  </div>;
}
