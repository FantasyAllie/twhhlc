import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentHotel } from "@/lib/hotels";
import { useRoomTypesQuery } from "@/hooks/use-rooms";
import { extrasForRoom, jobForSheetKind, type GuestExtra, type GuestExtraRule } from "@/lib/guest-extras-rules";
import type { Room } from "@/lib/app-types";

const errMsg = (e: unknown, f: string) => (e as { message?: string })?.message ?? f;

export function useGuestExtras() {
  const hotel = useCurrentHotel().data;
  return useQuery({
    queryKey: ["guest-extras", hotel?.id],
    enabled: !!hotel?.id,
    queryFn: async () => {
      if (!hotel) throw new Error("Select a hotel first.");
      const [e, r] = await Promise.all([
        supabase.from("guest_extras").select("id,name,icon,sort_order").eq("hotel_id", hotel.id).order("sort_order").order("created_at"),
        supabase.from("guest_extra_rules").select("id,extra_id,room_types,applies_to,quantities,extra_per_guest,sort_order").eq("hotel_id", hotel.id).order("sort_order").order("created_at"),
      ]);
      if (e.error) throw e.error;
      if (r.error) throw r.error;
      return { extras: e.data as GuestExtra[], rules: r.data as GuestExtraRule[] };
    },
  });
}

/** Room view: what to leave in this room, ticked off as it goes in. */
export function RoomGuestExtras({ room, roomTypes }: { room: Room; roomTypes: string[] }) {
  const data = useGuestExtras();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const job = jobForSheetKind(room.sheet_kind);
  const guests = room.guest_extras_guests ?? room.sheet_guests ?? 2;
  if (!data.data?.extras.length || !job) return null;
  const items = extrasForRoom(data.data.extras, data.data.rules, { job, roomTypes: [...roomTypes, room.sheet_room_type], guests });
  const done = new Set(room.guest_extras_done ?? []);
  const run = async (fn: () => PromiseLike<{ error: unknown }>) => {
    setBusy(true);
    try { const { error } = await fn(); if (error) throw error; await qc.invalidateQueries({ queryKey: ["rooms"] }); }
    catch (e) { toast.error(errMsg(e, "Could not save guest extras.")); }
    finally { setBusy(false); }
  };
  return <div className="space-y-2 border-t border-border/60 pt-4">
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Guest Extras</p>
      <div className="flex items-center gap-1" aria-label="Guests">
        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Fewer guests" disabled={busy || guests <= 1}
          onClick={() => run(() => supabase.rpc("set_guest_extras_guests", { p_room_number: room.room_number, p_guests: guests - 1 }))}><Minus className="h-4 w-4" /></Button>
        <span className="min-w-16 text-center text-sm">{guests} guest{guests === 1 ? "" : "s"}</span>
        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="More guests" disabled={busy || guests >= 20}
          onClick={() => run(() => supabase.rpc("set_guest_extras_guests", { p_room_number: room.room_number, p_guests: guests + 1 }))}><Plus className="h-4 w-4" /></Button>
      </div>
    </div>
    {items.length === 0 ? <p className="text-center text-sm text-muted-foreground">No extras needed for this room.</p> :
      <div className="grid grid-cols-2 gap-1.5">
        {items.map(({ extra, quantity }) => {
          const selected = done.has(extra.id);
          return <Button key={extra.id} type="button" variant="outline" aria-pressed={selected} disabled={busy}
            className={`h-auto min-h-12 w-full min-w-0 justify-center gap-2 whitespace-normal rounded-xl px-3 py-3 text-sm font-medium ${selected ? "border-primary bg-primary/10 text-primary hover:bg-primary/15" : ""}`}
            onClick={() => run(() => supabase.rpc("set_guest_extra_done", { p_room_number: room.room_number, p_extra: extra.id, p_done: !selected }))}>
            {selected && <Check className="h-4 w-4 shrink-0" />}
            <span className="min-w-0 break-words">{quantity} × {extra.name}</span>
          </Button>;
        })}
      </div>}
  </div>;
}

/** Settings: the hotel's extras and how many go in each room. */
export function GuestExtrasEditor() {
  const data = useGuestExtras();
  const types = useRoomTypesQuery();
  const hotel = useCurrentHotel().data;
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => PromiseLike<{ error: unknown }>, ok?: string) => {
    setBusy(true);
    try { const { error } = await fn(); if (error) throw error; await qc.invalidateQueries({ queryKey: ["guest-extras"] }); if (ok) toast.success(ok); }
    catch (e) { toast.error(errMsg(e, "Could not save guest extras.")); }
    finally { setBusy(false); }
  };
  if (data.isPending) return <p className="py-3 text-sm text-muted-foreground">Loading extras…</p>;
  if (data.isError) return <Button className="my-3" onClick={() => void data.refetch()}>Retry</Button>;
  const { extras, rules } = data.data;
  return <div className="space-y-4 py-3">
    <p className="text-sm text-muted-foreground">Complimentary items left in rooms, such as water or biscuits. Set how many go in for each number of guests.</p>
    {extras.map((extra) => <div key={extra.id} className="space-y-2 rounded-xl border p-3">
      <div className="flex items-center gap-2">
        <Input aria-label="Item name" defaultValue={extra.name} disabled={busy} className="min-w-0 flex-1"
          onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== extra.name) void run(() => supabase.from("guest_extras").update({ name: v }).eq("id", extra.id)); }} />
        <Button size="icon" variant="ghost" className="text-destructive" aria-label={`Remove ${extra.name}`} disabled={busy}
          onClick={() => run(() => supabase.from("guest_extras").delete().eq("id", extra.id), "Item removed")}><Trash2 className="h-4 w-4" /></Button>
      </div>
      {rules.filter((r) => r.extra_id === extra.id).map((rule) => <RuleRow key={rule.id} rule={rule} busy={busy} run={run}
        typeOptions={(types.data ?? []).map((t) => ({ value: t.value as string, label: t.label }))} />)}
      <Button size="sm" variant="outline" disabled={busy || !hotel} onClick={() => hotel && run(() => supabase.from("guest_extra_rules").insert({ hotel_id: hotel.id, extra_id: extra.id, quantities: [1, 2], sort_order: rules.length }))}>
        <Plus className="mr-1 h-4 w-4" />Add rule
      </Button>
    </div>)}
    <form className="flex gap-2" onSubmit={(e) => {
      e.preventDefault();
      const v = name.trim();
      if (!v || !hotel) return;
      void run(async () => {
        const res = await supabase.from("guest_extras").insert({ hotel_id: hotel.id, name: v, sort_order: extras.length }).select("id").single();
        if (res.error) return res;
        setName("");
        return supabase.from("guest_extra_rules").insert({ hotel_id: hotel.id, extra_id: res.data.id, quantities: [1, 2] });
      }, "Item added");
    }}>
      <Input placeholder="New item, e.g. Bottled water" value={name} onChange={(e) => setName(e.target.value)} disabled={busy} maxLength={80} />
      <Button type="submit" disabled={busy || !name.trim()}><Plus className="mr-1 h-4 w-4" />Add</Button>
    </form>
  </div>;
}

function RuleRow({ rule, busy, run, typeOptions }: {
  rule: GuestExtraRule; busy: boolean;
  run: (fn: () => PromiseLike<{ error: unknown }>) => Promise<void>;
  typeOptions: { value: string; label: string }[];
}) {
  const save = (patch: Partial<GuestExtraRule>) => run(() => supabase.from("guest_extra_rules").update(patch).eq("id", rule.id));
  const toggleType = (v: string) => save({ room_types: rule.room_types.includes(v) ? rule.room_types.filter((t) => t !== v) : [...rule.room_types, v] });
  const setQty = (i: number, n: number) => save({ quantities: rule.quantities.map((q, j) => j === i ? Math.max(0, Math.min(99, n)) : q) });
  return <div className="space-y-2 rounded-lg bg-muted/40 p-2 text-sm">
    <div className="grid grid-cols-3 gap-1">
      {(["arrival", "stayover", "both"] as const).map((a) => <Button key={a} size="sm" variant="outline" aria-pressed={rule.applies_to === a} disabled={busy}
        className={rule.applies_to === a ? "border-primary bg-primary/10 text-primary" : ""} onClick={() => save({ applies_to: a })}>
        {a === "arrival" ? "Arrivals" : a === "stayover" ? "Stayovers" : "Both"}
      </Button>)}
    </div>
    <div className="flex flex-wrap gap-1">
      <Button size="sm" variant="outline" aria-pressed={!rule.room_types.length} disabled={busy}
        className={!rule.room_types.length ? "border-primary bg-primary/10 text-primary" : ""} onClick={() => save({ room_types: [] })}>All rooms</Button>
      {typeOptions.map((t) => <Button key={t.value} size="sm" variant="outline" aria-pressed={rule.room_types.includes(t.value)} disabled={busy}
        className={rule.room_types.includes(t.value) ? "border-primary bg-primary/10 text-primary" : ""} onClick={() => toggleType(t.value)}>{t.label}</Button>)}
    </div>
    <div className="flex flex-wrap items-end gap-2">
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
      <Button size="icon" variant="ghost" className="ml-auto text-destructive" aria-label="Remove rule" disabled={busy}
        onClick={() => run(() => supabase.from("guest_extra_rules").delete().eq("id", rule.id))}><Trash2 className="h-4 w-4" /></Button>
    </div>
  </div>;
}
