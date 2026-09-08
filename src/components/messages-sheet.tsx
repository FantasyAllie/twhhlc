import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Check, X, RotateCcw, Wrench, PackageSearch } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { notifyDepartmentMessage } from "@/lib/push.functions";

export type MessagesThread =
  | "hk_reception"
  | "hk_fnb"
  | "reception_fnb"
  | "hk_maintenance"
  | "reception_maintenance"
  | "fnb_maintenance";
export type Department = "housekeeping" | "reception" | "fnb" | "maintenance";

const DEPT_LABELS: Record<Department, string> = {
  housekeeping: "Housekeeping",
  reception: "Reception",
  fnb: "F&B",
  maintenance: "Maintenance",
};

type Msg = {
  id: string;
  thread: MessagesThread;
  room_number: number | null;
  message: string;
  created_by_username: string | null;
  done_at: string | null;
  deleted_at: string | null;
  created_at: string;
  reply_to_id: string | null;
  reply_to_sender: string | null;
  reply_to_snippet: string | null;
};

const THREAD_LABELS: Record<MessagesThread, string> = {
  hk_reception: "Housekeeping ↔ Reception",
  hk_fnb: "Housekeeping ↔ F&B",
  reception_fnb: "Reception ↔ F&B",
  hk_maintenance: "Housekeeping ↔ Maintenance",
  reception_maintenance: "Reception ↔ Maintenance",
  fnb_maintenance: "F&B ↔ Maintenance",
};

// Room tags matter for HK↔Reception and any maintenance thread — F&B is not room-scoped.
const supportsRoomTag = (t: MessagesThread) =>
  t === "hk_reception" || t === "hk_maintenance" || t === "reception_maintenance";

// Threads are ordered pairs; sender/target order doesn't matter for the shared feed,
// but we need to derive the thread from (sender, target).
function threadFor(a: Department, b: Department): MessagesThread | null {
  const s = new Set([a, b]);
  if (s.has("housekeeping") && s.has("reception")) return "hk_reception";
  if (s.has("housekeeping") && s.has("fnb")) return "hk_fnb";
  if (s.has("reception") && s.has("fnb")) return "reception_fnb";
  if (s.has("housekeeping") && s.has("maintenance")) return "hk_maintenance";
  if (s.has("reception") && s.has("maintenance")) return "reception_maintenance";
  if (s.has("fnb") && s.has("maintenance")) return "fnb_maintenance";
  return null;
}

export function MessagesSheet({
  open,
  onOpenChange,
  availableThreads,
  initialThread,
  initialRoom,
  initialText,
  initialReplyTo,
  currentUsername,
  roomNumbers,
  myDepartments,
  isAdminOrManager,
  onLogMaintenance,
  onLogLostProperty,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  availableThreads: MessagesThread[];
  initialThread?: MessagesThread;
  initialRoom?: number | null;
  initialText?: string;
  initialReplyTo?: { id: string; sender: string; snippet: string };
  currentUsername: string | null;
  roomNumbers: number[];
  myDepartments: Department[];
  isAdminOrManager: boolean;
  onLogMaintenance?: (roomNumber: number, message: string) => Promise<{ ok: boolean; error?: string }>;
  onLogLostProperty?: (
    roomNumber: number | null,
    message: string,
  ) => Promise<{ ok: boolean; error?: string }>;
}) {
  const qc = useQueryClient();
  const [thread, setThread] = useState<MessagesThread>(
    initialThread && availableThreads.includes(initialThread)
      ? initialThread
      : availableThreads[0] ?? "hk_reception",
  );
  const [text, setText] = useState(initialText ?? "");
  const [room, setRoom] = useState<number | "">(initialRoom ?? "");
  const [replyTo, setReplyTo] = useState<{ id: string; sender: string; snippet: string } | null>(initialReplyTo ?? null);
  const [alsoMaintenance, setAlsoMaintenance] = useState(false);
  const [alsoLostProperty, setAlsoLostProperty] = useState(false);
  const feedRef = useRef<HTMLDivElement | null>(null);

  // "Send to" picker options for non-admin users with a single department.
  // Admin/manager (and mixed-department users) keep the thread-pair pill picker.
  const useSendToPicker = !isAdminOrManager && myDepartments.length >= 1;
  const sendToTargets: Department[] = useMemo(() => {
    if (!useSendToPicker) return [];
    // Union of "other" departments across all of my departments.
    const set = new Set<Department>();
    for (const mine of myDepartments) {
      for (const other of ["housekeeping", "reception", "fnb"] as Department[]) {
        if (other !== mine) set.add(other);
      }
    }
    return ["housekeeping", "reception", "fnb"].filter((d) => set.has(d as Department)) as Department[];
  }, [useSendToPicker, myDepartments]);

  // For a "Send to <dept>" pick, choose the thread using my primary matching
  // department. Prefer HK, then Reception, then F&B, then Maintenance.
  function threadForTarget(target: Department): MessagesThread | null {
    const priority: Department[] = ["housekeeping", "reception", "fnb", "maintenance"];
    for (const mine of priority) {
      if (mine === target) continue;
      if (myDepartments.includes(mine)) {
        const t = threadFor(mine, target);
        if (t && availableThreads.includes(t)) return t;
      }
    }
    return null;
  }

  const activeTarget: Department | null = useMemo(() => {
    if (!useSendToPicker) return null;
    // Derive the "target" from the current thread + my departments.
    const [a, b] =
      thread === "hk_reception"
        ? (["housekeeping", "reception"] as const)
        : thread === "hk_fnb"
        ? (["housekeeping", "fnb"] as const)
        : thread === "reception_fnb"
        ? (["reception", "fnb"] as const)
        : thread === "hk_maintenance"
        ? (["housekeeping", "maintenance"] as const)
        : thread === "reception_maintenance"
        ? (["reception", "maintenance"] as const)
        : (["fnb", "maintenance"] as const);
    return (myDepartments.includes(a) ? b : a) as Department;
  }, [useSendToPicker, thread, myDepartments]);

  // Maintenance toggle only makes sense on the Housekeeping↔Reception thread.
  const canLogMaintenance = thread === "hk_reception" && !!onLogMaintenance;
  // Lost Property mirrors Maintenance — only relevant on HK↔Reception (Reception
  // owns the log; Housekeeping is the usual reporter).
  const canLogLostProperty = thread === "hk_reception" && !!onLogLostProperty;
  useEffect(() => {
    if (!canLogMaintenance) setAlsoMaintenance(false);
  }, [canLogMaintenance]);
  useEffect(() => {
    if (!canLogLostProperty) setAlsoLostProperty(false);
  }, [canLogLostProperty]);

  useEffect(() => {
    if (!open) return;
    if (initialThread && availableThreads.includes(initialThread)) setThread(initialThread);
    if (typeof initialRoom === "number") setRoom(initialRoom);
    if (typeof initialText === "string" && initialText.length > 0) setText(initialText);
    setReplyTo(initialReplyTo ?? null);
  }, [open, initialThread, initialRoom, initialText, initialReplyTo, availableThreads]);

  const q = useQuery({
    queryKey: ["messages_feed", thread],
    enabled: open,
    queryFn: async (): Promise<Msg[]> => {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("room_messages" as never)
          .select("id,thread,room_number,message,created_by_username,done_at,deleted_at,created_at,reply_to_id,reply_to_sender,reply_to_snippet")
        .eq("thread", thread)
        .is("deleted_at", null)
        .or(`done_at.is.null,done_at.gte.${cutoff}`)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Msg[];
    },
  });

  const items = useMemo(() => q.data ?? [], [q.data]);

  const prevLenRef = useRef(0);
  useEffect(() => {
    if (!open) return;
    const el = feedRef.current;
    // Only auto-scroll to bottom on open, or when new messages arrive.
    // Skip when the list shrinks (e.g. after deleting a message) so the
    // user's scroll position isn't yanked to the bottom.
    if (el && items.length > prevLenRef.current) {
      el.scrollTop = el.scrollHeight;
    }
    prevLenRef.current = items.length;
  }, [open, items.length]);
  useEffect(() => {
    if (open) {
      prevLenRef.current = 0;
    }
  }, [open]);

  // Realtime: refetch on any change to this thread.
  useEffect(() => {
    if (!open) return;
    const channel = supabase
      .channel(`messages-sheet-${thread}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_messages" },
        () => {
          qc.invalidateQueries({ queryKey: ["messages_feed", thread] });
          qc.invalidateQueries({ queryKey: ["room_messages"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, thread, qc]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    const roomNumber = supportsRoomTag(thread) && typeof room === "number" ? room : null;
    // If a "log-only" toggle is on, skip the chat insert entirely and route the
    // message to the correct destination (maintenance log or lost property).
    if (alsoMaintenance) {
      if (!canLogMaintenance) {
        toast.error("Maintenance can only be logged from the Housekeeping ↔ Reception thread");
        return;
      }
      if (roomNumber === null) {
        toast.error("Pick a room to log as maintenance");
        return;
      }
      const res = await onLogMaintenance!(roomNumber, body);
      if (!res.ok) {
        toast.error(res.error ?? "Could not log maintenance request");
        return;
      }
      toast.success("Maintenance request has been sent to the Maintenance Log");
      setText("");
      setReplyTo(null);
      setAlsoMaintenance(false);
      return;
    }
    if (alsoLostProperty) {
      if (!canLogLostProperty) {
        toast.error("Lost Property can only be logged from the Housekeeping ↔ Reception thread");
        return;
      }
      const senderIsHkOnly =
        myDepartments.includes("housekeeping") && !myDepartments.includes("reception");
      if (senderIsHkOnly && roomNumber === null) {
        toast.error("Pick a room to log as lost property");
        return;
      }
      const res = await onLogLostProperty!(roomNumber, body);
      if (!res.ok) {
        toast.error(res.error ?? "Could not log lost property");
        return;
      }
      toast.success("Item has been logged to Lost Property");
      setText("");
      setReplyTo(null);
      setAlsoLostProperty(false);
      return;
    }
    // Legacy dead-code check kept as no-op after early returns above.
    if (alsoMaintenance && (!canLogMaintenance || roomNumber === null)) {
      toast.error("Pick a room to also log as maintenance");
      return;
    }
    // Housekeeping must tag a room for lost property. Reception may leave it
    // untagged (they may not know the room yet). We can't distinguish sender
    // exactly here, so require a room tag whenever HK is my department AND I'm
    // not also Reception.
    const senderIsHkOnly =
      myDepartments.includes("housekeeping") && !myDepartments.includes("reception");
    if (alsoLostProperty && senderIsHkOnly && roomNumber === null) {
      toast.error("Pick a room to also log as lost property");
      return;
    }
    // Guard against stale/invalid reply targets that would violate the FK.
    // We only send reply_to_id when it looks like a real UUID; if the insert
    // still fails due to the FK (message deleted or from another hotel), we
    // retry once without the reply metadata so the user's message still lands.
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const safeReplyId = replyTo?.id && uuidRe.test(replyTo.id) ? replyTo.id : null;
    const basePayload = {
      thread,
      room_number: roomNumber,
      message: body,
      created_by_username: currentUsername ?? null,
    };
    let { error } = await supabase.from("room_messages" as never).insert({
      ...basePayload,
      reply_to_id: safeReplyId,
      reply_to_sender: safeReplyId ? replyTo?.sender ?? null : null,
      reply_to_snippet: safeReplyId ? replyTo?.snippet ?? null : null,
    } as never);
    if (
      error &&
      safeReplyId &&
      /reply_to_id|foreign key/i.test(error.message ?? "")
    ) {
      // Retry without the reply reference.
      const retry = await supabase.from("room_messages" as never).insert({
        ...basePayload,
        reply_to_id: null,
        reply_to_sender: null,
        reply_to_snippet: null,
      } as never);
      error = retry.error;
      if (!error) {
        toast.message("Original message is no longer available — reply sent without quote.");
      }
    }
    if (error) {
      toast.error(error.message);
      return;
    }
    // (Toggle-driven maintenance/lost-property logging is handled up-front and
    // returns early — chat inserts are skipped in those cases.)
    // Fire push notifications to the receiving department(s).
    // Sender department: the thread half the user belongs to, when unambiguous.
    const pair: [Department, Department] =
      thread === "hk_reception"
        ? ["housekeeping", "reception"]
        : thread === "hk_fnb"
        ? ["housekeeping", "fnb"]
        : thread === "reception_fnb"
        ? ["reception", "fnb"]
        : thread === "hk_maintenance"
        ? ["housekeeping", "maintenance"]
        : thread === "reception_maintenance"
        ? ["reception", "maintenance"]
        : ["fnb", "maintenance"];
    const mineInThread = pair.filter((d) => myDepartments.includes(d));
    const senderDepartment: Department | null =
      mineInThread.length === 1 ? mineInThread[0] : null;
    void notifyDepartmentMessage({
      data: { thread, senderDepartment, message: body, roomNumber },
    }).catch(() => {});
    setText("");
    setReplyTo(null);
    setAlsoMaintenance(false);
    setAlsoLostProperty(false);
    qc.invalidateQueries({ queryKey: ["messages_feed", thread] });
    qc.invalidateQueries({ queryKey: ["room_messages"] });
  };

  const markDone = async (id: string) => {
    const { error } = await supabase
      .from("room_messages" as never)
      .update({ done_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never)
      .eq("id", id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["messages_feed", thread] });
    qc.invalidateQueries({ queryKey: ["room_messages"] });
  };

  const undoDone = async (id: string) => {
    const { error } = await supabase
      .from("room_messages" as never)
      .update({ done_at: null, dismissed: false, updated_at: new Date().toISOString() } as never)
      .eq("id", id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["messages_feed", thread] });
    qc.invalidateQueries({ queryKey: ["room_messages"] });
  };

  const softDelete = async (id: string) => {
    const { error } = await supabase
      .from("room_messages" as never)
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never)
      .eq("id", id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["messages_feed", thread] });
    qc.invalidateQueries({ queryKey: ["room_messages"] });
  };

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const fmtDay = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

  // Group by day
  const groups: Array<{ day: string; items: Msg[] }> = [];
  for (const m of items) {
    const day = fmtDay(m.created_at);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(m);
    else groups.push({ day, items: [m] });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="overflow-hidden rounded-t-2xl p-4 sm:p-6 flex flex-col">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Messages
          </SheetTitle>
          <SheetDescription>Shared thread — everyone in these roles sees it.</SheetDescription>
        </SheetHeader>

        {useSendToPicker && sendToTargets.length > 1 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Send to</span>
            {sendToTargets.map((target) => {
              const t = threadForTarget(target);
              const active = activeTarget === target;
              return (
                <Button
                  key={target}
                  type="button"
                  size="sm"
                  variant={active ? "default" : "outline"}
                  className="rounded-full"
                  disabled={!t}
                  onClick={() => { if (t) setThread(t); }}
                >
                  {DEPT_LABELS[target]}
                </Button>
              );
            })}
          </div>
        )}
        {!useSendToPicker && availableThreads.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {availableThreads.map((t) => (
              <Button
                key={t}
                type="button"
                size="sm"
                variant={t === thread ? "default" : "outline"}
                className="rounded-full"
                onClick={() => setThread(t)}
              >
                {THREAD_LABELS[t]}
              </Button>
            ))}
          </div>
        )}

        <div ref={feedRef} className="flex-1 min-h-0 overflow-y-auto mt-4 space-y-4 pr-1">
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No messages yet. Say hi.
            </p>
          ) : (
            groups.map((g) => (
              <div key={g.day} className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{g.day}</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <ul className="space-y-2">
                  {g.items.map((m) => {
                    const mine = m.created_by_username && currentUsername && m.created_by_username === currentUsername;
                    const done = !!m.done_at;
                    return (
                      <li
                        key={m.id}
                        className={cn(
                          "rounded-lg border bg-background p-2.5 text-sm",
                          mine && "ml-8 border-primary/40 bg-primary/5",
                          done && "opacity-60",
                        )}
                      >
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-1">
                          <span className="font-medium">{m.created_by_username ?? "Someone"}</span>
                          {typeof m.room_number === "number" && (
                            <span className="inline-flex items-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 font-medium">
                              Room {m.room_number}
                            </span>
                          )}
                          <span className="ml-auto">{fmtTime(m.created_at)}</span>
                          {done && (
                            <span className="rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 font-medium">
                              Done
                            </span>
                          )}
                        </div>
                        {m.reply_to_snippet && (
                          <div className="mb-1.5 rounded-xl border-l-4 border-primary bg-muted/60 px-2 py-1">
                            <div className="text-[10px] font-semibold text-primary">
                              {m.reply_to_sender ?? "Original"}
                            </div>
                            <div className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap break-words">
                              {m.reply_to_snippet}
                            </div>
                          </div>
                        )}
                        <p className="whitespace-pre-wrap break-words">{m.message}</p>
                        <div className="mt-1.5 flex justify-end gap-1">
                          {!done && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[11px]"
                              onClick={() =>
                                setReplyTo({
                                  id: m.id,
                                  sender: m.created_by_username ?? "Someone",
                                  snippet: m.message.slice(0, 280),
                                })
                              }
                            >
                              <MessageSquare className="h-3 w-3 mr-1" /> Reply
                            </Button>
                          )}
                          {done ? (
                            <Button type="button" variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => undoDone(m.id)}>
                              <RotateCcw className="h-3 w-3 mr-1" /> Undo
                            </Button>
                          ) : (
                            <Button type="button" variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => markDone(m.id)}>
                              <Check className="h-3 w-3 mr-1" /> Done
                            </Button>
                          )}
                          <Button type="button" variant="ghost" size="sm" className="h-6 text-[11px] text-destructive hover:text-destructive" onClick={() => softDelete(m.id)}>
                            <X className="h-3 w-3 mr-1" /> Delete
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        <div className="mt-3 border-t pt-3 space-y-2">
          {supportsRoomTag(thread) && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0">Tag room:</span>
              <select
                value={room === "" ? "" : String(room)}
                onChange={(e) => setRoom(e.target.value === "" ? "" : Number(e.target.value))}
                className="h-8 rounded-xl border bg-background px-2 text-sm"
              >
                <option value="">— none —</option>
                {roomNumbers.map((n) => (
                  <option key={n} value={n}>Room {n}</option>
                ))}
              </select>
              {canLogMaintenance && (
                <label className="ml-auto flex items-center gap-2 text-xs font-medium">
                  <Wrench className={cn("h-3.5 w-3.5", alsoMaintenance ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")} />
                  <span>Maintenance</span>
                  <Switch
                    checked={alsoMaintenance}
                    onCheckedChange={(v) => {
                      setAlsoMaintenance(v);
                      if (v) setAlsoLostProperty(false);
                    }}
                    disabled={typeof room !== "number"}
                  />
                </label>
              )}
            </div>
          )}
          {(canLogMaintenance || canLogLostProperty) && supportsRoomTag(thread) && canLogLostProperty && (
            <div className="flex items-center gap-2">
              <label className="ml-auto flex items-center gap-2 text-xs font-medium">
                <PackageSearch className={cn("h-3.5 w-3.5", alsoLostProperty ? "text-sky-600 dark:text-sky-400" : "text-muted-foreground")} />
                <span>Lost Property</span>
                <Switch
                  checked={alsoLostProperty}
                  onCheckedChange={(v) => {
                    setAlsoLostProperty(v);
                    if (v) setAlsoMaintenance(false);
                  }}
                  disabled={
                    myDepartments.includes("housekeeping") && !myDepartments.includes("reception")
                      ? typeof room !== "number"
                      : false
                  }
                />
              </label>
            </div>
          )}
          {replyTo && (
            <div className="flex items-start gap-2 rounded-xl border-l-4 border-primary bg-muted/60 px-2 py-1.5">
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-semibold text-primary">
                  Replying to {replyTo.sender}
                </div>
                <div className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap break-words">
                  {replyTo.snippet}
                </div>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6 shrink-0"
                onClick={() => setReplyTo(null)}
                aria-label="Cancel reply"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                supportsRoomTag(thread) && typeof room === "number"
                  ? `Message about Room ${room}…`
                  : "Type a message…"
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <Button type="button" onClick={() => void send()} disabled={!text.trim()}>
              Send
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}