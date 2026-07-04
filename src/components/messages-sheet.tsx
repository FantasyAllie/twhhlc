import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Check, X, RotateCcw, Wrench } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { notifyDepartmentMessage } from "@/lib/push.functions";

export type MessagesThread = "hk_reception" | "hk_fnb" | "reception_fnb";
export type Department = "housekeeping" | "reception" | "fnb";

const DEPT_LABELS: Record<Department, string> = {
  housekeeping: "Housekeeping",
  reception: "Reception",
  fnb: "F&B",
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
};

const THREAD_LABELS: Record<MessagesThread, string> = {
  hk_reception: "Housekeeping ↔ Reception",
  hk_fnb: "Housekeeping ↔ F&B",
  reception_fnb: "Reception ↔ F&B",
};

// Rooms don't route to F&B — only HK↔Reception carries per-room messages.
const supportsRoomTag = (t: MessagesThread) => t === "hk_reception";

// Threads are ordered pairs; sender/target order doesn't matter for the shared feed,
// but we need to derive the thread from (sender, target).
function threadFor(a: Department, b: Department): MessagesThread | null {
  const s = new Set([a, b]);
  if (s.has("housekeeping") && s.has("reception")) return "hk_reception";
  if (s.has("housekeeping") && s.has("fnb")) return "hk_fnb";
  if (s.has("reception") && s.has("fnb")) return "reception_fnb";
  return null;
}

export function MessagesSheet({
  open,
  onOpenChange,
  availableThreads,
  initialThread,
  initialRoom,
  currentUsername,
  roomNumbers,
  myDepartments,
  isAdminOrManager,
  onLogMaintenance,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  availableThreads: MessagesThread[];
  initialThread?: MessagesThread;
  initialRoom?: number | null;
  currentUsername: string | null;
  roomNumbers: number[];
  myDepartments: Department[];
  isAdminOrManager: boolean;
  onLogMaintenance?: (roomNumber: number, message: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const qc = useQueryClient();
  const [thread, setThread] = useState<MessagesThread>(
    initialThread && availableThreads.includes(initialThread)
      ? initialThread
      : availableThreads[0] ?? "hk_reception",
  );
  const [text, setText] = useState("");
  const [room, setRoom] = useState<number | "">(initialRoom ?? "");
  const [alsoMaintenance, setAlsoMaintenance] = useState(false);
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
  // department. Prefer HK, then Reception, then F&B.
  function threadForTarget(target: Department): MessagesThread | null {
    const priority: Department[] = ["housekeeping", "reception", "fnb"];
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
    const [a, b] = thread === "hk_reception"
      ? (["housekeeping", "reception"] as const)
      : thread === "hk_fnb"
      ? (["housekeeping", "fnb"] as const)
      : (["reception", "fnb"] as const);
    return (myDepartments.includes(a) ? b : a) as Department;
  }, [useSendToPicker, thread, myDepartments]);

  // Maintenance toggle only makes sense on the Housekeeping↔Reception thread.
  const canLogMaintenance = thread === "hk_reception" && !!onLogMaintenance;
  useEffect(() => {
    if (!canLogMaintenance) setAlsoMaintenance(false);
  }, [canLogMaintenance]);

  useEffect(() => {
    if (!open) return;
    if (initialThread && availableThreads.includes(initialThread)) setThread(initialThread);
    if (typeof initialRoom === "number") setRoom(initialRoom);
  }, [open, initialThread, initialRoom, availableThreads]);

  const q = useQuery({
    queryKey: ["messages_feed", thread],
    enabled: open,
    queryFn: async (): Promise<Msg[]> => {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("room_messages" as never)
        .select("id,thread,room_number,message,created_by_username,done_at,deleted_at,created_at")
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

  useEffect(() => {
    if (!open) return;
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, items.length]);

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
    if (alsoMaintenance && (!canLogMaintenance || roomNumber === null)) {
      toast.error("Pick a room to also log as maintenance");
      return;
    }
    const { error } = await supabase.from("room_messages" as never).insert({
      thread,
      room_number: roomNumber,
      message: body,
      created_by_username: currentUsername ?? null,
    } as never);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (alsoMaintenance && canLogMaintenance && roomNumber !== null && onLogMaintenance) {
      const res = await onLogMaintenance(roomNumber, body);
      if (!res.ok) {
        toast.error(res.error ?? "Message sent but maintenance log failed");
      } else {
        toast.success("Message sent and logged for maintenance");
      }
    }
    // Fire push notifications to the receiving department(s).
    // Sender department: the thread half the user belongs to, when unambiguous.
    const pair: [Department, Department] =
      thread === "hk_reception"
        ? ["housekeeping", "reception"]
        : thread === "hk_fnb"
        ? ["housekeeping", "fnb"]
        : ["reception", "fnb"];
    const mineInThread = pair.filter((d) => myDepartments.includes(d));
    const senderDepartment: Department | null =
      mineInThread.length === 1 ? mineInThread[0] : null;
    void notifyDepartmentMessage({
      data: { thread, senderDepartment, message: body, roomNumber },
    }).catch(() => {});
    setText("");
    setAlsoMaintenance(false);
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
      <SheetContent side="bottom" className="max-h-[90vh] overflow-hidden rounded-t-2xl p-4 sm:p-6 flex flex-col">
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
                        <p className="whitespace-pre-wrap break-words">{m.message}</p>
                        <div className="mt-1.5 flex justify-end gap-1">
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
                className="h-8 rounded-md border bg-background px-2 text-sm"
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
                  <Switch checked={alsoMaintenance} onCheckedChange={setAlsoMaintenance} disabled={typeof room !== "number"} />
                </label>
              )}
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