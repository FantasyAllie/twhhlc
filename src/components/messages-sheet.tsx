import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Check, X, RotateCcw, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { notifyDepartmentMessage } from "@/lib/push.functions";
import { useServerFn } from "@tanstack/react-start";
import { useIsMobile } from "@/hooks/use-mobile";

import { MESSAGE_GROUP_LABELS, type MessageGroup } from "@/lib/message-groups";
export type MessagesThread = MessageGroup;
export type Department = MessageGroup;
const THREAD_LABELS = MESSAGE_GROUP_LABELS;
const supportsRoomTag = (t: MessagesThread) => t !== "fnb";

type Msg = {
  id: string;
  group_key: MessagesThread;
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
  const notifyMessage = useServerFn(notifyDepartmentMessage);
  const isMobile = useIsMobile();
  const [thread, setThread] = useState<MessagesThread>(
    initialThread && availableThreads.includes(initialThread)
      ? initialThread
      : availableThreads[0] ?? "reception",
  );
  const [text, setText] = useState(initialText ?? "");
  const [room, setRoom] = useState<number | "">(initialRoom ?? "");
  const [replyTo, setReplyTo] = useState<{ id: string; sender: string; snippet: string } | null>(initialReplyTo ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const feedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initialThread && availableThreads.includes(initialThread)) setThread(initialThread);
    else if (!availableThreads.includes(thread)) setThread(availableThreads[0] ?? "reception");
    if (typeof initialRoom === "number") setRoom(initialRoom);
    if (typeof initialText === "string" && initialText.length > 0) setText(initialText);
    setReplyTo(initialReplyTo ?? null);
  }, [open, initialThread, initialRoom, initialText, initialReplyTo, availableThreads, thread]);

  const q = useQuery({
    queryKey: ["messages_feed", thread],
    enabled: open && availableThreads.includes(thread),
    queryFn: async (): Promise<Msg[]> => {
      // Messages stay in the feed for 3 months regardless of being marked done
      // or cleared by a reset; only manual deletion removes them sooner.
      const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("room_messages" as never)
          .select("id,group_key,room_number,message,created_by_username,done_at,deleted_at,created_at,reply_to_id,reply_to_sender,reply_to_snippet")
        .eq("group_key", thread)
        .is("deleted_at", null)
        .gte("created_at", cutoff)
        .order("created_at", { ascending: true })
        .limit(2000);

      if (error) throw error;
      return (data ?? []) as Msg[];
    },
  });

  const allItems = useMemo(() => q.data ?? [], [q.data]);
  const doneCount = useMemo(() => allItems.filter((m) => !!m.done_at).length, [allItems]);
  // Done messages are hidden by default; they stay available behind the toggle.
  const items = useMemo(
    () => (showDone ? allItems : allItems.filter((m) => !m.done_at)),
    [allItems, showDone],
  );

  // Always land on the most recent message: on open, on thread change, and
  // whenever the visible feed changes.
  useEffect(() => {
    if (!open) return;
    const el = feedRef.current;
    if (!el) return;
    const scroll = () => {
      el.scrollTop = el.scrollHeight;
    };
    scroll();
    const raf = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(raf);
  }, [open, thread, showDone, items.length]);

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
    if (!body || !availableThreads.includes(thread)) return;
    const roomNumber = supportsRoomTag(thread) && typeof room === "number" ? room : null;
    // Guard against stale/invalid reply targets that would violate the FK.
    // We only send reply_to_id when it looks like a real UUID; if the insert
    // still fails due to the FK (message deleted or from another hotel), we
    // retry once without the reply metadata so the user's message still lands.
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const safeReplyId = replyTo?.id && uuidRe.test(replyTo.id) ? replyTo.id : null;
    const basePayload = {
      group_key: thread,
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
    const senderDepartment = myDepartments[0] ?? null;
    void notifyMessage({
      data: { thread, senderDepartment, message: body, roomNumber },
    }).catch(() => {});
    setText("");
    setReplyTo(null);
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
      <SheetContent side="bottom" className="ios-fit-above-tabbar overflow-hidden rounded-t-2xl p-4 sm:p-6 flex flex-col">
        <SheetHeader className="text-left">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <SheetTitle className="flex min-w-0 items-center gap-2 max-lg:pr-0">
              <MessageSquare className="h-4 w-4" />
              Messages
            </SheetTitle>
            {isMobile && doneCount > 0 && (
              <Button
                type="button"
                size="sm"
                variant={showDone ? "default" : "outline"}
                className="rounded-full shrink-0"
                onClick={() => setShowDone((v) => !v)}
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                {showDone ? "Hide done" : `Show done (${doneCount})`}
              </Button>
            )}
          </div>
          {!isMobile && (
            <SheetDescription>
              {THREAD_LABELS[thread]} group chat
            </SheetDescription>
          )}
        </SheetHeader>

        <Button
          type="button" variant="outline"
          onClick={() => setPickerOpen(v => !v)} aria-expanded={pickerOpen}
          className="mt-3 min-h-11 w-full justify-between gap-2 rounded-lg"
        >
          <span className="min-w-0 truncate font-medium">{THREAD_LABELS[thread]}</span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", pickerOpen && "rotate-180")} />
        </Button>
        {pickerOpen && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {availableThreads.map(t => (
              <Button key={t} type="button" variant={t === thread ? "default" : "outline"}
                aria-pressed={t === thread} className="min-h-11 rounded-lg"
                onClick={() => { setThread(t); setPickerOpen(false); setReplyTo(null); }}>
                {THREAD_LABELS[t]}
              </Button>
            ))}
          </div>
        )}

        {!isMobile && doneCount > 0 && (
          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              size="sm"
              variant={showDone ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setShowDone((v) => !v)}
            >
              <Check className="h-3.5 w-3.5 mr-1" />
              {showDone ? "Hide done" : `Show done (${doneCount})`}
            </Button>
          </div>
        )}

        <div ref={feedRef} className="flex-1 min-h-0 overflow-y-auto mt-4 space-y-4 pr-1">
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {doneCount > 0 && !showDone
                ? "No open messages — everything here is marked done."
                : "No messages yet. Say hi."}
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
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
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