// Emergency snapshots.
//
// Every time a room is marked done we quietly record the shared operational
// state (room flags/status + every linen count) so it can be rolled back with
// the Undo action in Settings.
//
// The first recording of a session stores the whole state ("full"); after that
// only the rows that actually changed are stored ("delta"), which keeps writes
// tiny. Capture is fire-and-forget so it never blocks the UI.
import { supabase } from "@/integrations/supabase/client";
import type {
  DeliveryCount,
  FnbCount,
  RejectCount,
  Room,
  RoomCount,
} from "@/lib/app-types";

type RoomSnap = {
  done: boolean;
  done_reception: boolean;
  category: string | null;
  default_status: string | null;
  reception_status_id: string | null;
  reception_bed_id: string | null;
  housekeeping_note: string | null;
  needs_maintenance: boolean;
  needs_maintenance_at: string | null;
  guest_vacated: boolean;
  guest_vacated_at: string | null;
  early_check_in: boolean;
  early_check_in_at: string | null;
  late_checkout: boolean;
  late_checkout_at: string | null;
  stayover_out: boolean;
  stayover_out_at: string | null;
  dog_box: boolean;
  dog_box_at: string | null;
  not_required: boolean;
  not_required_at: string | null;
};

export type OpsState = {
  rooms: Record<string, RoomSnap>;
  counts: Record<string, number>; // `${room}|${kind}|${itemId}`
  reject: Record<string, number>; // template_item_id
  delivery: Record<string, number>;
  fnb: Record<string, number>;
};

type Change<T> = { before: T | null; after: T | null };

type Delta = {
  rooms: Record<string, Change<RoomSnap>>;
  counts: Record<string, Change<number>>;
  reject: Record<string, Change<number>>;
  delivery: Record<string, Change<number>>;
  fnb: Record<string, Change<number>>;
};

const roomSnap = (r: Room): RoomSnap => ({
  done: !!r.done,
  done_reception: !!r.done_reception,
  category: r.category ?? null,
  default_status: r.default_status ?? null,
  reception_status_id: r.reception_status_id ?? null,
  reception_bed_id: r.reception_bed_id ?? null,
  housekeeping_note: r.housekeeping_note ?? null,
  needs_maintenance: !!r.needs_maintenance,
  needs_maintenance_at: r.needs_maintenance_at ?? null,
  guest_vacated: !!r.guest_vacated,
  guest_vacated_at: r.guest_vacated_at ?? null,
  early_check_in: !!r.early_check_in,
  early_check_in_at: r.early_check_in_at ?? null,
  late_checkout: !!r.late_checkout,
  late_checkout_at: r.late_checkout_at ?? null,
  stayover_out: !!r.stayover_out,
  stayover_out_at: r.stayover_out_at ?? null,
  dog_box: !!r.dog_box,
  dog_box_at: r.dog_box_at ?? null,
  not_required: !!r.not_required,
  not_required_at: r.not_required_at ?? null,
});

export function buildOpsState(input: {
  rooms: Room[];
  counts: RoomCount[];
  reject: RejectCount[];
  delivery: DeliveryCount[];
  fnb: FnbCount[];
}): OpsState {
  const state: OpsState = { rooms: {}, counts: {}, reject: {}, delivery: {}, fnb: {} };
  for (const r of input.rooms) state.rooms[String(r.room_number)] = roomSnap(r);
  for (const c of input.counts) {
    state.counts[`${c.room_number}|${c.item_kind}|${c.item_id}`] = c.count ?? 0;
  }
  for (const c of input.reject) state.reject[c.template_item_id] = c.count ?? 0;
  for (const c of input.delivery) state.delivery[c.template_item_id] = c.count ?? 0;
  for (const c of input.fnb) state.fnb[c.template_item_id] = c.count ?? 0;
  return state;
}

const sameRoom = (a: RoomSnap, b: RoomSnap) =>
  (Object.keys(a) as (keyof RoomSnap)[]).every((k) => a[k] === b[k]);

function diffMap<T>(
  before: Record<string, T>,
  after: Record<string, T>,
  equal: (a: T, b: T) => boolean,
): Record<string, Change<T>> {
  const out: Record<string, Change<T>> = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const b = key in before ? before[key]! : null;
    const a = key in after ? after[key]! : null;
    if (b !== null && a !== null && equal(b, a)) continue;
    if (b === null && a === null) continue;
    out[key] = { before: b, after: a };
  }
  return out;
}

const numEq = (a: number, b: number) => a === b;

function buildDelta(prev: OpsState, next: OpsState): Delta {
  return {
    rooms: diffMap(prev.rooms, next.rooms, sameRoom),
    counts: diffMap(prev.counts, next.counts, numEq),
    reject: diffMap(prev.reject, next.reject, numEq),
    delivery: diffMap(prev.delivery, next.delivery, numEq),
    fnb: diffMap(prev.fnb, next.fnb, numEq),
  };
}

const deltaIsEmpty = (d: Delta) =>
  Object.keys(d.rooms).length === 0 &&
  Object.keys(d.counts).length === 0 &&
  Object.keys(d.reject).length === 0 &&
  Object.keys(d.delivery).length === 0 &&
  Object.keys(d.fnb).length === 0;

// In-memory baseline: the state as of the most recent recording on this device.
let baseline: { hotelId: string; state: OpsState } | null = null;
let capturing = false;

/** Fire-and-forget: records a snapshot without blocking the caller. */
export function captureOpsSnapshot(
  hotelId: string | undefined,
  state: OpsState,
  label: string,
) {
  if (!hotelId || capturing) return;
  capturing = true;
  // Defer so the interaction that triggered it stays snappy.
  setTimeout(() => {
    void (async () => {
      try {
        if (!baseline || baseline.hotelId !== hotelId) {
          const { error } = await supabase
            .from("ops_snapshots" as never)
            .insert({ kind: "full", label, payload: state } as never);
          if (!error) baseline = { hotelId, state };
          return;
        }
        const delta = buildDelta(baseline.state, state);
        if (deltaIsEmpty(delta)) return;
        const { error } = await supabase
          .from("ops_snapshots" as never)
          .insert({ kind: "delta", label, payload: delta } as never);
        if (!error) baseline = { hotelId, state };
      } catch {
        // Snapshots are best-effort; never surface errors to staff.
      } finally {
        capturing = false;
      }
    })();
  }, 0);
  // Guard against the flag sticking if the timeout body never runs.
  setTimeout(() => {
    capturing = false;
  }, 15000);
}

export function resetOpsBaseline() {
  baseline = null;
}

type SnapshotRow = {
  id: string;
  kind: "full" | "delta";
  label: string | null;
  created_at: string;
  payload: Delta | OpsState;
};

async function restoreRooms(rooms: Record<string, RoomSnap | null>) {
  for (const [key, snap] of Object.entries(rooms)) {
    if (!snap) continue; // room did not exist before; leave it alone
    const { error } = await supabase
      .from("rooms")
      .update({ ...snap, updated_at: new Date().toISOString() } as never)
      .eq("room_number", Number(key));
    if (error) throw new Error(error.message);
  }
}

async function restoreRoomCounts(counts: Record<string, number | null>) {
  const keys = Object.keys(counts);
  if (keys.length === 0) return;
  const { data, error } = await supabase
    .from("room_item_counts")
    .select("id,room_number,item_kind,item_id,count");
  if (error) throw new Error(error.message);
  const existing = new Map<string, string>();
  for (const row of (data ?? []) as RoomCount[]) {
    existing.set(`${row.room_number}|${row.item_kind}|${row.item_id}`, row.id);
  }
  const deletes: string[] = [];
  const upserts: Array<Record<string, unknown>> = [];
  for (const key of keys) {
    const target = counts[key] ?? null;
    const [room, kind, itemId] = key.split("|");
    if (target === null) {
      const id = existing.get(key);
      if (id) deletes.push(id);
      continue;
    }
    upserts.push({
      room_number: Number(room),
      item_kind: kind,
      item_id: itemId,
      count: target,
      updated_at: new Date().toISOString(),
    });
  }
  if (upserts.length) {
    const { error: upErr } = await supabase
      .from("room_item_counts")
      .upsert(upserts as never, {
        onConflict: "user_id,hotel_id,room_number,item_kind,item_id",
      });
    if (upErr) throw new Error(upErr.message);
  }
  if (deletes.length) {
    const { error: delErr } = await supabase
      .from("room_item_counts")
      .delete()
      .in("id", deletes);
    if (delErr) throw new Error(delErr.message);
  }
}

async function restoreSimpleCounts(
  table: "reject_counts" | "delivery_counts" | "fnb_linen_counts",
  values: Record<string, number | null>,
) {
  const keys = Object.keys(values);
  if (keys.length === 0) return;
  const onConflict =
    table === "fnb_linen_counts" ? "template_item_id" : "user_id,hotel_id,template_item_id";
  const upserts = keys
    .filter((k) => values[k] !== null && values[k] !== undefined)
    .map((k) => ({
      template_item_id: k,
      count: values[k]!,
      updated_at: new Date().toISOString(),
    }));
  const removals = keys.filter((k) => values[k] === null || values[k] === undefined);
  if (upserts.length) {
    const { error } = await supabase
      .from(table as never)
      .upsert(upserts as never, { onConflict });
    if (error) throw new Error(error.message);
  }
  if (removals.length) {
    const { error } = await supabase
      .from(table as never)
      .delete()
      .in("template_item_id", removals);
    if (error) throw new Error(error.message);
  }
}

function beforeOf<T>(changes: Record<string, Change<T>>): Record<string, T | null> {
  const out: Record<string, T | null> = {};
  for (const [k, v] of Object.entries(changes)) out[k] = v.before;
  return out;
}

/**
 * Rolls the shared state back to the most recent emergency snapshot and
 * removes it, so pressing Undo again steps back a further recording.
 */
export async function undoLastOpsSnapshot(): Promise<{
  ok: boolean;
  message: string;
}> {
  const { data, error } = await supabase
    .from("ops_snapshots" as never)
    .select("id,kind,label,created_at,payload")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) return { ok: false, message: error.message };
  const snap = ((data ?? []) as unknown as SnapshotRow[])[0];
  if (!snap) return { ok: false, message: "No emergency snapshot available yet" };

  try {
    if (snap.kind === "delta") {
      const d = snap.payload as Delta;
      await restoreRooms(beforeOf(d.rooms));
      await restoreRoomCounts(beforeOf(d.counts));
      await restoreSimpleCounts("reject_counts", beforeOf(d.reject));
      await restoreSimpleCounts("delivery_counts", beforeOf(d.delivery));
      await restoreSimpleCounts("fnb_linen_counts", beforeOf(d.fnb));
    } else {
      const s = snap.payload as OpsState;
      await restoreRooms(s.rooms);
      await restoreRoomCounts(s.counts);
      await restoreSimpleCounts("reject_counts", s.reject);
      await restoreSimpleCounts("delivery_counts", s.delivery);
      await restoreSimpleCounts("fnb_linen_counts", s.fnb);
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Undo failed" };
  }

  await supabase.from("ops_snapshots" as never).delete().eq("id", snap.id);
  resetOpsBaseline();
  return {
    ok: true,
    message: snap.label ? `Reverted: ${snap.label}` : "Reverted to last snapshot",
  };
}
