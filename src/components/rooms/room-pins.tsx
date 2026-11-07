// Room pins: a message pinned to a room for one department, like the iPhone app.
// A request needs Done, a note needs Seen, and either can be dismissed. Replies
// stay on the pin, so the sender and the department see one thread. The pin's
// department, managers and admins can close it; the sender can dismiss their own.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronLeft, MessageSquareReply, Pencil, Pin, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentHotel } from "@/lib/hotels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { notifyRoomPin } from "@/lib/push.functions";

export type PinDepartment = "housekeeping" | "reception" | "fnb" | "maintenance";
export type RoomPin = {
  id: string; room_number: number; to_department: PinDepartment; kind: "request" | "note"; message: string;
  status: "open" | "done" | "seen" | "dismissed"; created_by: string; created_by_name: string;
  created_by_departments: string[]; resolved_by_name: string | null; resolved_at: string | null;
  last_reply_at: string | null; sender_seen_at: string; created_at: string;
};
type PinReply = { id: string; pin_id: string; message: string; created_by: string; created_by_name: string; created_by_departments: string[]; created_at: string };
export type QuickReply = { id: string; label: string; applies_to: "request" | "note" | "both"; resolves: boolean; sort_order: number };

export const PIN_DEPARTMENTS: PinDepartment[] = ["housekeeping", "reception", "fnb", "maintenance"];
/** Used until a hotel chooses its own. F&B isn't room-based. */
const DEFAULT_PIN_DEPARTMENTS: PinDepartment[] = ["housekeeping", "reception", "maintenance"];
export const PIN_DEPARTMENT_LABELS: Record<string, string> = { housekeeping: "Housekeeping", reception: "Reception", fnb: "F&B", maintenance: "Maintenance" };
const deptLabel = (d: string) => PIN_DEPARTMENT_LABELS[d] ?? d;
const errMsg = (e: unknown, f: string) => (e as { message?: string })?.message ?? f;

/** "Sarah · Reception", "Amy · Housekeeping, Reception". Developers show by name only. */
export const pinByline = (name: string, depts: string[]) => (depts.length ? `${name} · ${depts.map(deptLabel).join(", ")}` : name);
/** Someone else has replied (or closed it) since the sender last looked. */
export const hasNewReply = (p: RoomPin) => !!p.last_reply_at && new Date(p.last_reply_at) > new Date(p.sender_seen_at);
const resolvedLine = (p: RoomPin) => p.status === "open" ? null
  : `${{ done: "Done", seen: "Seen", dismissed: "Dismissed" }[p.status]}${p.resolved_by_name ? ` by ${p.resolved_by_name}` : ""}`;

/** Who's looking: their id, the department view they're in, their departments, and manager/admin. */
export type PinViewer = { id: string | null; department: PinDepartment; departments: string[]; elevated: boolean };
export const canResolvePin = (p: RoomPin, v: PinViewer) => v.elevated || v.departments.includes(p.to_department);
const isMine = (p: RoomPin, v: PinViewer) => !!v.id && p.created_by === v.id;

/** Open pins, plus the viewer's own pins closed in the last week (so they see the reply). */
export function useRoomPins(viewerId: string | null) {
  const hotel = useCurrentHotel().data;
  return useQuery({
    queryKey: ["room_pins", hotel?.id, viewerId],
    enabled: !!hotel && !!viewerId,
    queryFn: async () => {
      const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const { data, error } = await supabase.from("room_pins" as never).select("*")
        .or(`status.eq.open,and(created_by.eq.${viewerId},resolved_at.gte.${weekAgo})`)
        .order("created_at");
      if (error) throw error;
      return data as unknown as RoomPin[];
    },
  });
}

/** Which departments this hotel's pins can be for. */
export function usePinDepartments() {
  const hotel = useCurrentHotel().data;
  const q = useQuery({
    queryKey: ["room_pin_settings", hotel?.id],
    enabled: !!hotel,
    queryFn: async () => {
      const { data, error } = await supabase.from("room_pin_settings" as never).select("departments").maybeSingle();
      if (error) throw error;
      return ((data as unknown as { departments: PinDepartment[] } | null)?.departments ?? DEFAULT_PIN_DEPARTMENTS);
    },
  });
  return q.data ?? DEFAULT_PIN_DEPARTMENTS;
}

/** Pins on the room that want you: open ones for your department, or replies to yours. */
export const pinsNeedingYou = (pins: RoomPin[], room: number, v: PinViewer) =>
  pins.filter((p) => p.room_number === room && ((p.status === "open" && p.to_department === v.department) || (isMine(p, v) && hasNewReply(p))));

export function useQuickReplies() {
  const hotel = useCurrentHotel().data;
  return useQuery({
    queryKey: ["quick_replies", hotel?.id],
    enabled: !!hotel,
    queryFn: async () => {
      const { data, error } = await supabase.from("quick_replies" as never).select("id,label,applies_to,resolves,sort_order").order("sort_order");
      if (error) throw error;
      return data as unknown as QuickReply[];
    },
  });
}

/** What shows on a room: open pins, and the viewer's own closed ones until they've seen the reply. */
export const pinsForRoom = (pins: RoomPin[], room: number, v: PinViewer) =>
  pins.filter((p) => p.room_number === room && (p.status === "open" || (isMine(p, v) && hasNewReply(p))));

/** The tile dot: a reply to your pin, or an open request for your department. */
export function pinDotFor(pins: RoomPin[], room: number, v: PinViewer): "reply" | "request" | null {
  const here = pins.filter((p) => p.room_number === room);
  if (here.some((p) => isMine(p, v) && hasNewReply(p))) return "reply";
  if (here.some((p) => p.status === "open" && p.kind === "request" && p.to_department === v.department)) return "request";
  return null;
}

/** A new pin alerts its department; a reply alerts the other side. Never blocks the action. */
async function notifyPin(pinId: string, text?: string) {
  try { await notifyRoomPin({ data: { pinId, text } }); } catch { /* Alerts are best effort. */ }
}

function usePinActions() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["room_pins"] });
  const resolve = async (pin: RoomPin, status: "done" | "seen" | "dismissed") => {
    const { error } = await supabase.rpc("resolve_room_pin" as never, { p_pin: pin.id, p_status: status } as never);
    if (error) throw error;
  };
  return {
    refresh,
    add: async (room: number, to: PinDepartment, kind: "request" | "note", text: string) => {
      const { data, error } = await supabase.from("room_pins" as never)
        .insert({ room_number: room, to_department: to, kind, message: text } as never).select("id").single();
      if (error) throw error;
      await refresh();
      void notifyPin((data as unknown as { id: string }).id);
    },
    reply: async (pin: RoomPin, text: string, close = false) => {
      const { error } = await supabase.from("room_pin_replies" as never).insert({ pin_id: pin.id, message: text } as never);
      if (error) throw error;
      if (close && pin.status === "open") await resolve(pin, pin.kind === "request" ? "done" : "seen");
      await refresh();
      void notifyPin(pin.id, text);
    },
    resolve: async (pin: RoomPin, status: "done" | "seen" | "dismissed", mine: boolean) => {
      await resolve(pin, status);
      await refresh();
      if (!mine) void notifyPin(pin.id, { done: "Done", seen: "Seen", dismissed: "Dismissed" }[status]);
    },
    markSeen: async (pin: RoomPin) => {
      await supabase.rpc("mark_room_pin_seen" as never, { p_pin: pin.id } as never);
      await refresh();
    },
  };
}

const when = (iso: string) => {
  const d = new Date(iso);
  const today = d.toDateString() === new Date().toDateString();
  return d.toLocaleString(undefined, today ? { hour: "2-digit", minute: "2-digit" } : { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};
/** "Yesterday", "3 days ago" for pins left open since before today. */
const age = (p: RoomPin) => {
  if (p.status !== "open") return null;
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((start(new Date()) - start(new Date(p.created_at))) / 86_400_000);
  return days <= 0 ? null : days === 1 ? "Yesterday" : `${days} days ago`;
};

/** One pin: what was asked, its replies, and the buttons to answer or close it. */
export function PinThread({ pin, viewer }: { pin: RoomPin; viewer: PinViewer }) {
  const actions = usePinActions();
  const quick = useQuickReplies().data ?? [];
  const mine = isMine(pin, viewer);
  const canClose = canResolvePin(pin, viewer);
  const [draft, setDraft] = useState("");
  const [replying, setReplying] = useState(false);
  const [busy, setBusy] = useState(false);
  const replies = useQuery({
    queryKey: ["room_pin_replies", pin.id, pin.last_reply_at, pin.sender_seen_at],
    queryFn: async () => {
      const { data, error } = await supabase.from("room_pin_replies" as never)
        .select("id,pin_id,message,created_by,created_by_name,created_by_departments,created_at").eq("pin_id", pin.id).order("created_at");
      if (error) throw error;
      if (mine && hasNewReply(pin)) void actions.markSeen(pin);
      return data as unknown as PinReply[];
    },
  });
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e) { toast.error(errMsg(e, "Couldn't update the pin.")); } finally { setBusy(false); }
  };
  const status = { open: pin.kind === "request" ? ["To do", "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200"] : ["New", "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200"],
    done: ["Done", "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"],
    seen: ["Seen", "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200"],
    dismissed: ["Dismissed", "bg-muted text-muted-foreground"] }[pin.status];
  const line = (text: string, by: string, at: string, me: boolean) => <div>
    <p className="break-words whitespace-pre-wrap text-sm">{text}</p>
    <p className="mt-0.5 text-[10px] text-muted-foreground">{me ? "You" : by} · {when(at)}</p>
  </div>;
  return <div className="space-y-2 rounded-lg bg-background/70 p-2.5">
    <div className="flex items-center gap-2">
      <p className="flex-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{pin.kind === "request" ? "Request" : "Note"} for {deptLabel(pin.to_department)}</p>
      {age(pin) && <span className="text-[10px] text-muted-foreground">{age(pin)}</span>}
      <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold", status[1])}>{status[0]}</span>
    </div>
    {line(pin.message, pinByline(pin.created_by_name, pin.created_by_departments), pin.created_at, mine)}
    {(replies.data ?? []).map((r) => <div key={r.id}>{line(r.message, pinByline(r.created_by_name, r.created_by_departments), r.created_at, r.created_by === viewer.id)}</div>)}
    {resolvedLine(pin) && <p className="flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300"><Check className="h-3 w-3" />{resolvedLine(pin)}</p>}
    {pin.status === "open" && <>
      {canClose && quick.some((q) => q.applies_to === "both" || q.applies_to === pin.kind) && <div className="flex flex-wrap gap-1">
        {quick.filter((q) => q.applies_to === "both" || q.applies_to === pin.kind).map((q) => <Button key={q.id} type="button" size="sm" variant="outline" className="h-7 rounded-full text-xs" disabled={busy}
          onClick={() => run(() => actions.reply(pin, q.label, q.resolves))}>{q.label}</Button>)}
      </div>}
      {replying && <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const t = draft.trim(); if (t) void run(async () => { await actions.reply(pin, t); setDraft(""); setReplying(false); }); }}>
        <Input aria-label="Reply" autoFocus placeholder="Reply…" value={draft} maxLength={1000} onChange={(e) => setDraft(e.target.value)} />
        <Button type="submit" disabled={busy || !draft.trim()}>Send</Button>
      </form>}
      <div className="flex items-center gap-2">
        {canClose && <Button type="button" size="sm" className="h-7 text-xs" disabled={busy}
          onClick={() => run(() => actions.resolve(pin, pin.kind === "request" ? "done" : "seen", mine))}><Check className="mr-1 h-3 w-3" />{pin.kind === "request" ? "Done" : "Seen"}</Button>}
        {!replying && <Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => setReplying(true)}><MessageSquareReply className="mr-1 h-3 w-3" />Reply</Button>}
        <span className="flex-1" />
        {(canClose || mine) && <Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={busy}
          onClick={() => run(() => actions.resolve(pin, "dismissed", mine))}>Dismiss</Button>}
      </div>
    </>}
  </div>;
}

/** Pin a request or note to the room for a department. */
function PinComposer({ room, viewer }: { room: number; viewer: PinViewer }) {
  const actions = usePinActions();
  const departments = usePinDepartments();
  const wanted: PinDepartment = viewer.department === "reception" ? "housekeeping" : "reception";
  const fallback: PinDepartment = departments.includes(wanted) ? wanted : departments[0] ?? wanted;
  const [to, setTo] = useState<PinDepartment | null>(null);
  const [kind, setKind] = useState<"request" | "note">("request");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const target = to && departments.includes(to) ? to : fallback;
  return <form className="space-y-2" onSubmit={(e) => {
    e.preventDefault();
    const t = draft.trim();
    if (!t) return;
    setBusy(true);
    actions.add(room, target, kind, t).then(() => setDraft(""), (err) => toast.error(errMsg(err, "Couldn't pin that."))).finally(() => setBusy(false));
  }}>
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative flex items-center gap-1 text-sm font-medium">
        <span className="sr-only">Pin for</span>
        <select value={target} onChange={(e) => setTo(e.target.value as PinDepartment)} className="appearance-none rounded-md border bg-background py-1 pl-2 pr-7 text-sm">
          {departments.map((d) => <option key={d} value={d}>For {deptLabel(d)}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 opacity-60" />
      </label>
      <span className="flex-1" />
      <div className="grid grid-cols-2 gap-1">
        {(["request", "note"] as const).map((k) => <Button key={k} type="button" size="sm" variant="outline" aria-pressed={kind === k}
          className={cn("h-7 text-xs", kind === k && "border-primary bg-primary/10 text-primary hover:bg-primary/15")} onClick={() => setKind(k)}>{k === "request" ? "Request" : "Note"}</Button>)}
      </div>
    </div>
    <div className="flex gap-2">
      <Input aria-label="Pin message" placeholder={kind === "request" ? "e.g. Extra pillows please" : "e.g. Guest is a regular"} value={draft} maxLength={1000} onChange={(e) => setDraft(e.target.value)} />
      <Button type="submit" disabled={busy || !draft.trim()}><Pin className="mr-1 h-4 w-4" />Pin</Button>
    </div>
    <p className="text-[11px] text-muted-foreground">{kind === "request" ? "A request stays on the room until it's done or dismissed." : "A note stays on the room until it's seen or dismissed."}</p>
  </form>;
}

/** The room's pins and a box to pin a new one. Used in the room hub. */
export function RoomPins({ room, viewer }: { room: number; viewer: PinViewer }) {
  const pins = useRoomPins(viewer.id).data ?? [];
  const departments = usePinDepartments();
  const here = pinsForRoom(pins, room, viewer).sort((a, b) =>
    Number(b.to_department === viewer.department) - Number(a.to_department === viewer.department) || a.created_at.localeCompare(b.created_at));
  // Pins are shown to departments the hotel uses, and to managers and admins.
  if (!viewer.elevated && !departments.includes(viewer.department)) return null;
  return <div className="space-y-2 rounded-xl border border-orange-400/60 bg-orange-50 p-3 dark:bg-orange-950/30">
    <p className="text-xs font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-300">Pins{here.length ? ` · ${here.length}` : ""}</p>
    {here.map((p) => <PinThread key={p.id} pin={p} viewer={viewer} />)}
    <PinComposer room={room} viewer={viewer} />
  </div>;
}

/** Home: the viewer's pins with a reply they haven't seen. */
export function PinRepliesStrip({ viewer }: { viewer: PinViewer }) {
  const pins = (useRoomPins(viewer.id).data ?? []).filter((p) => isMine(p, viewer) && hasNewReply(p))
    .sort((a, b) => (b.last_reply_at ?? "").localeCompare(a.last_reply_at ?? ""));
  const [openId, setOpenId] = useState<string | null>(null);
  const opened = pins.find((p) => p.id === openId);
  if (!pins.length && !opened) return null;
  return <section aria-label="Replies to your pins" className="w-full space-y-1.5 rounded-2xl border border-sidebar-border bg-sidebar p-3 text-sidebar-foreground shadow-elevation-2 sm:px-4">
    <p className="text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/65">Replies to your pins</p>
    {pins.map((p) => <button key={p.id} type="button" onClick={() => setOpenId(p.id)} className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-sidebar-accent">
      <span className="h-2 w-2 shrink-0 rounded-full bg-sidebar-primary" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">Room {p.room_number} · {resolvedLine(p) ?? "New reply"}</span>
        <span className="block truncate text-xs text-sidebar-foreground/65">{p.message}</span>
      </span>
    </button>)}
    <Sheet open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl p-4 sm:p-6">
        <SheetHeader className="text-left"><SheetTitle>Room {opened?.room_number}</SheetTitle><SheetDescription>Your pin and its replies</SheetDescription></SheetHeader>
        {opened && <div className="mt-4"><PinThread pin={opened} viewer={viewer} /></div>}
      </SheetContent>
    </Sheet>
  </section>;
}

/** Messages → Pins: every pin that concerns the viewer, across the hotel. Managers and
 *  admins also see other departments' open pins. */
export function PinsList({ viewer }: { viewer: PinViewer }) {
  const pins = useRoomPins(viewer.id).data ?? [];
  const [openId, setOpenId] = useState<string | null>(null);
  const opened = pins.find((p) => p.id === openId);
  const newest = (a: RoomPin, b: RoomPin) => (b.last_reply_at ?? b.created_at).localeCompare(a.last_reply_at ?? a.created_at);
  const sent = pins.filter((p) => isMine(p, viewer) && (p.status === "open" || hasNewReply(p))).sort(newest);
  const forYou = pins.filter((p) => p.status === "open" && !isMine(p, viewer) && viewer.departments.includes(p.to_department)).sort(newest);
  const others = viewer.elevated
    ? pins.filter((p) => p.status === "open" && !isMine(p, viewer) && !viewer.departments.includes(p.to_department)).sort(newest) : [];
  const section = (title: string, list: RoomPin[]) => list.length > 0 && <div className="space-y-1.5">
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
    <div className="divide-y divide-border rounded-xl border">
      {list.map((p) => <button key={p.id} type="button" onClick={() => setOpenId(p.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-accent">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-orange-100 font-bold tabular-nums text-orange-800 dark:bg-orange-950 dark:text-orange-200">{p.room_number}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-muted-foreground">{p.kind === "request" ? "Request" : "Note"} for {deptLabel(p.to_department)}</span>
          <span className="block line-clamp-2 text-sm">{p.message}</span>
          <span className="block text-[11px] text-muted-foreground">{resolvedLine(p) ?? (isMine(p, viewer) ? "You" : pinByline(p.created_by_name, p.created_by_departments))}</span>
        </span>
        {isMine(p, viewer) && hasNewReply(p) && <span aria-label="New reply" className="h-2.5 w-2.5 shrink-0 rounded-full bg-yellow-400" />}
      </button>)}
    </div>
  </div>;
  // The thread opens in place (a pop-up inside the Messages panel would close it).
  if (opened) return <div className="space-y-3">
    <Button type="button" variant="ghost" size="sm" className="gap-1 px-2" onClick={() => setOpenId(null)}><ChevronLeft className="h-4 w-4" />All pins</Button>
    <p className="text-sm font-semibold">Room {opened.room_number}</p>
    <PinThread pin={opened} viewer={viewer} />
  </div>;
  return <div className="space-y-4">
    {!sent.length && !forYou.length && !others.length && <p className="py-8 text-center text-sm text-muted-foreground">No open pins. Pin a request or note from a room's hub.</p>}
    {section("For your department", forYou)}
    {section("Sent by you", sent)}
    {section("Other departments", others)}
  </div>;
}

/** Property Setup → Room Pins: which departments use pins, and the hotel's one-tap answers. */
export function RoomPinSettingsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const list = useQuickReplies().data ?? [];
  const departments = usePinDepartments();
  const setDepartment = (d: PinDepartment, on: boolean) => run(() => supabase.from("room_pin_settings" as never)
    .upsert({ departments: PIN_DEPARTMENTS.filter((x) => (x === d ? on : departments.includes(x))) } as never, { onConflict: "hotel_id" }))
    .then(() => qc.invalidateQueries({ queryKey: ["room_pin_settings"] }));
  const [editing, setEditing] = useState<QuickReply | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => PromiseLike<{ error: unknown }>) => {
    setBusy(true);
    try { const { error } = await fn(); if (error) throw error; await qc.invalidateQueries({ queryKey: ["quick_replies"] }); }
    catch (e) { toast.error(errMsg(e, "Couldn't save quick replies.")); }
    finally { setBusy(false); }
  };
  const move = (i: number, dir: number) => {
    const next = [...list];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    return run(async () => {
      for (const [j, q] of next.entries()) {
        const res = await supabase.from("quick_replies" as never).update({ sort_order: j } as never).eq("id", q.id);
        if (res.error) return res;
      }
      return { error: null };
    });
  };
  const save = (q: QuickReply) => run(() => {
    const row = { label: q.label.trim(), applies_to: q.applies_to, resolves: q.resolves, sort_order: q.sort_order };
    return q.id ? supabase.from("quick_replies" as never).update(row as never).eq("id", q.id) : supabase.from("quick_replies" as never).insert(row as never);
  }).then(() => setEditing(null));
  const summary = (q: QuickReply) => `${{ request: "Requests", note: "Notes", both: "Requests and notes" }[q.applies_to]}${q.resolves ? " · closes the pin" : ""}`;
  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
      <SheetHeader><SheetTitle>Pins & Chat</SheetTitle><SheetDescription>Which departments use room pins, and the one-tap answers staff can give.</SheetDescription></SheetHeader>
      {editing ? <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); if (editing.label.trim()) void save(editing); }}>
        <label className="block space-y-1"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reply</span>
          <Input autoFocus placeholder="e.g. On it" maxLength={60} value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} /></label>
        <div className="space-y-1"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Shows on</p>
          <div className="grid grid-cols-3 gap-1">{(["request", "note", "both"] as const).map((a) => <Button key={a} type="button" size="sm" variant="outline" aria-pressed={editing.applies_to === a}
            className={cn(editing.applies_to === a && "border-primary bg-primary/10 text-primary hover:bg-primary/15")} onClick={() => setEditing({ ...editing, applies_to: a })}>{{ request: "Requests", note: "Notes", both: "Both" }[a]}</Button>)}</div></div>
        <label className="flex items-center justify-between gap-2 text-sm">Closes the pin<Switch checked={editing.resolves} onCheckedChange={(v) => setEditing({ ...editing, resolves: v })} /></label>
        <div className="flex gap-2">
          <Button type="submit" disabled={busy || !editing.label.trim()}>Save</Button>
          <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
          <span className="flex-1" />
          {editing.id && <Button type="button" variant="ghost" className="text-destructive" disabled={busy}
            onClick={() => void run(() => supabase.from("quick_replies" as never).delete().eq("id", editing.id)).then(() => setEditing(null))}><Trash2 className="mr-1 h-4 w-4" />Remove</Button>}
        </div>
      </form> : <div className="mt-4 space-y-5">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Departments</p>
          <div className="divide-y divide-border rounded-xl border">
            {PIN_DEPARTMENTS.map((d) => <label key={d} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium">
              {deptLabel(d)}<Switch checked={departments.includes(d)} disabled={busy} onCheckedChange={(v) => void setDepartment(d, v)} />
            </label>)}
          </div>
          <p className="text-xs text-muted-foreground">Pins can be left for these departments, and only they see pins and their notifications. Managers and admins always see them.</p>
        </div>
        <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick replies</p>
        <div className="divide-y divide-border rounded-xl border">
          {list.map((q, i) => <div key={q.id} className="flex items-center gap-1 pr-1">
            <Button variant="ghost" className="h-auto min-w-0 flex-1 justify-start rounded-none px-3 py-2.5 text-left" onClick={() => setEditing(q)}>
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">{q.label}</span><span className="block text-xs font-normal text-muted-foreground">{summary(q)}</span></span>
              <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </Button>
            <Button size="icon" variant="ghost" className="h-9 w-9" aria-label={`Move ${q.label} up`} disabled={busy || i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" className="h-9 w-9" aria-label={`Move ${q.label} down`} disabled={busy || i === list.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
          </div>)}
          {!list.length && <p className="px-3 py-2.5 text-sm text-muted-foreground">No quick replies yet.</p>}
        </div>
        <Button variant="outline" onClick={() => setEditing({ id: "", label: "", applies_to: "request", resolves: false, sort_order: list.length })}><Plus className="mr-1 h-4 w-4" />Add a quick reply</Button>
        <p className="text-xs text-muted-foreground">A reply that closes the pin also marks a request Done or a note Seen.</p>
        </div>
      </div>}
    </SheetContent>
  </Sheet>;
}
