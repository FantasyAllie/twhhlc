// Maintenance department dashboard (open requests + messages, completed list).
// Extracted verbatim from src/routes/app.tsx.
import { useMemo, useState } from "react";
import { Check, MessageSquare, RotateCcw, Trash2 } from "lucide-react";
import type { QueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { PhotoAttachments } from "@/components/entry-photos";
import { supabase } from "@/integrations/supabase/client";
import type { MaintenanceRequest, RoomMessage } from "@/lib/app-types";
import { maintenanceLocation } from "@/lib/app-format";
import type { MessagesThread } from "@/components/messages-sheet";

type MessagesInitial = {
  thread?: MessagesThread;
  room?: number | null;
  text?: string;
  replyTo?: { id: string; sender: string; snippet: string };
};

export function MaintenanceDashboard({
  maintenanceRequests,
  roomMessages,
  openMaintenanceCount,
  markMaintenanceDone,
  qc,
  setMessagesInitial,
  setMessagesSheetOpen,
}: {
  maintenanceRequests: MaintenanceRequest[];
  roomMessages: RoomMessage[];
  openMaintenanceCount: number;
  markMaintenanceDone: (id: string) => Promise<void> | void;
  qc: QueryClient;
  setMessagesInitial: (v: MessagesInitial) => void;
  setMessagesSheetOpen: (o: boolean) => void;
}) {
  const [activeTab, setActiveTab] = useState<"open" | "completed">("open");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;

  const openReqs = maintenanceRequests.filter((m) => !m.done);
  const doneReqs = maintenanceRequests.filter((m) => m.done);
  const openMsgs = roomMessages.filter(
    (m) =>
      (m.thread === "hk_maintenance" || m.thread === "reception_maintenance") &&
      !m.done_at &&
      !m.deleted_at,
  );

  type Item = {
    id: string;
    source: "req" | "msg";
    roomNumber: number | null;
    location: string | null;
    message: string;
    sender: string | null;
    createdAt: string;
    origin: "housekeeping" | "reception" | null;
  };

  const openItems = useMemo<Item[]>(
    () =>
      [
        ...openReqs.map<Item>((m) => ({
          id: `req-${m.id}`,
          source: "req",
          roomNumber: m.room_number,
          location: maintenanceLocation(m),
          message: m.message,
          sender: m.created_by_username,
          createdAt: m.created_at,
          origin:
            ((m as unknown as { origin_department?: string | null }).origin_department as
              | "housekeeping"
              | "reception"
              | null) ?? null,
        })),
        ...openMsgs.map<Item>((m) => ({
          id: `msg-${m.id}`,
          source: "msg",
          roomNumber: m.room_number,
          location: m.room_number != null ? `Room ${m.room_number}` : null,
          message: m.message,
          sender: m.created_by_username,
          createdAt: m.created_at,
          origin: m.thread === "reception_maintenance" ? "reception" : "housekeeping",
        })),
      ].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [openReqs, openMsgs],
  );

  const activeItems = activeTab === "open" ? openItems : doneReqs;
  const pageCount = Math.max(1, Math.ceil(activeItems.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pagedItems = activeItems.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );
  const pageItems = useMemo<(number | "ellipsis")[]>(() => {
    if (pageCount <= 5) return Array.from({ length: pageCount }, (_, index) => index + 1);
    const current = safePage + 1;
    const items: (number | "ellipsis")[] = [1];
    const start = Math.max(2, current - 2);
    const end = Math.min(pageCount - 1, current + 2);
    if (start > 2) items.push("ellipsis");
    for (let index = start; index <= end; index += 1) items.push(index);
    if (end < pageCount - 1) items.push("ellipsis");
    items.push(pageCount);
    return items;
  }, [pageCount, safePage]);

  const rawId = (id: string) => id.replace(/^req-|^msg-/, "");
  const markDoneItem = async (item: Item) => {
    if (item.source === "req") {
      await markMaintenanceDone(rawId(item.id));
      return;
    }
    await supabase
      .from("room_messages" as never)
      .update({ done_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never)
      .eq("id", rawId(item.id));
    qc.invalidateQueries({ queryKey: ["room_messages"] });
  };
  const deleteItem = async (item: Item) => {
    if (item.source === "req") {
      await supabase
        .from("maintenance_requests" as never)
        .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString(), done: true, done_at: new Date().toISOString() } as never)
        .eq("id", rawId(item.id));
      qc.invalidateQueries({ queryKey: ["maintenance_requests"] });
      return;
    }
    await supabase
      .from("room_messages" as never)
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never)
      .eq("id", rawId(item.id));
    qc.invalidateQueries({ queryKey: ["room_messages"] });
  };
  const replyToItem = (item: Item) => {
    const thread: MessagesThread =
      item.origin === "reception" ? "reception_maintenance" : "hk_maintenance";
    setMessagesInitial({
      thread,
      room: item.roomNumber,
      text: "",
      replyTo: {
        id: rawId(item.id),
        sender: item.sender ?? (item.origin === "reception" ? "Reception" : "Housekeeping"),
        snippet: item.message.slice(0, 280),
      },
    });
    setMessagesSheetOpen(true);
  };

  return (
   <section className="space-y-3">
     <div className="flex items-baseline justify-between">
       <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
         Maintenance Requests
       </h2>
       <span className="text-xs text-muted-foreground">
         {openMaintenanceCount} open
       </span>
     </div>
      <div className="inline-flex w-full items-center justify-center rounded-full border bg-background p-1">
        {([
          { key: "open", label: `Open (${openItems.length})` },
          { key: "completed", label: `Completed (${doneReqs.length})` },
        ] as const).map((tab) => (
          <Button
            key={tab.key}
            type="button"
            variant={activeTab === tab.key ? "default" : "ghost"}
            size="sm"
            className="h-8 flex-1 rounded-full px-2 text-xs sm:px-4 sm:text-sm"
            onClick={() => {
              setActiveTab(tab.key);
              setPage(0);
            }}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {pageCount > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2">
          <Button type="button" size="sm" variant="outline" className="h-8 text-xs" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
            Previous
          </Button>
          {pageItems.map((item, index) =>
            item === "ellipsis" ? (
              <span key={`ellipsis-${index}`} className="px-1 text-xs text-muted-foreground">…</span>
            ) : (
              <Button
                key={item}
                type="button"
                size="sm"
                variant={safePage + 1 === item ? "default" : "outline"}
                className="h-8 w-8 p-0 text-xs"
                onClick={() => setPage(item - 1)}
              >
                {item}
              </Button>
            ),
          )}
          <Button type="button" size="sm" variant="outline" className="h-8 text-xs" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>
            Next
          </Button>
        </div>
      )}

      {activeTab === "open" ? (
            {openItems.length === 0 ? (
             <p className="text-sm text-muted-foreground py-8 text-center">
               No open maintenance items.
             </p>
           ) : (
             <ul className="space-y-2">
                {(pagedItems as Item[]).map((it) => (
                 <li key={it.id} className="rounded-lg border bg-background p-3">
                   <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                     {it.location && (
                       <span className="inline-flex h-6 items-center rounded-full bg-primary/10 text-primary px-2 font-semibold">
                         {it.location}
                       </span>
                     )}
                     {it.origin && (
                       <span className="inline-flex h-5 items-center rounded-full bg-muted px-2 text-[10px] font-semibold uppercase">
                         {it.origin === "reception" ? "Reception" : "Housekeeping"}
                       </span>
                     )}
                     <span>
                       {new Date(it.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                       {it.sender ? ` · ${it.sender}` : ""}
                     </span>
                   </div>
                   <p className="mt-2 text-sm whitespace-pre-wrap break-words">{it.message}</p>
                    {it.source === "req" && (() => {
                      const req = openReqs.find((r) => r.id === rawId(it.id));
                      const paths = req && Array.isArray(req.photo_paths) ? req.photo_paths : [];
                      if (paths.length === 0) return null;
                      return (
                        <div className="mt-2">
                          <PhotoAttachments
                            kind="maintenance"
                            entryId={rawId(it.id)}
                            paths={paths}
                            canEdit={false}
                            onChange={() => {}}
                          />
                        </div>
                      );
                    })()}
                   <div className="mt-3 flex flex-wrap justify-end gap-2">
                     <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => void replyToItem(it)}>
                       <MessageSquare className="h-3.5 w-3.5 mr-1" /> Reply
                     </Button>
                     <Button type="button" size="sm" variant="default" className="h-8 text-xs" onClick={() => void markDoneItem(it)}>
                       <Check className="h-3.5 w-3.5 mr-1" /> Done
                     </Button>
                     <Button type="button" size="sm" variant="ghost" className="h-8 text-xs text-destructive hover:text-destructive" onClick={() => void deleteItem(it)}>
                       <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                     </Button>
                   </div>
                 </li>
               ))}
             </ul>
           )}
      ) : doneReqs.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No completed maintenance requests.</p>
      ) : (
              <div className="space-y-2">
                {(pagedItems as MaintenanceRequest[]).map((m) => (
                 <div key={m.id} className="rounded-lg border bg-muted/40 p-3">
                   <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                    <span className="inline-flex h-6 items-center rounded-full bg-muted px-2 font-semibold">{maintenanceLocation(m)}</span>
                     <span>
                       Done{m.done_by_username ? ` by ${m.done_by_username}` : ""}
                       {m.done_at ? ` · ${new Date(m.done_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}
                     </span>
                   </div>
                   <p className="mt-1 text-sm whitespace-pre-wrap break-words text-muted-foreground line-through">{m.message}</p>
                   <div className="mt-2 flex justify-end">
                     <Button
                       type="button"
                       size="sm"
                       variant="ghost"
                       className="h-7 text-xs"
                       onClick={async () => {
                         await supabase
                           .from("maintenance_requests" as never)
                           .update({ done: false, done_at: null, done_by_username: null, updated_at: new Date().toISOString() } as never)
                           .eq("id", m.id);
                         qc.invalidateQueries({ queryKey: ["maintenance_requests"] });
                       }}
                     >
                       <RotateCcw className="h-3 w-3 mr-1" /> Reopen
                     </Button>
                   </div>
                 </div>
               ))}
             </div>
      )}
   </section>
  );
}
