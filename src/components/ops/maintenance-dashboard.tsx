// Maintenance department dashboard (open requests + messages, completed list).
// Extracted verbatim from src/routes/app.tsx.
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
  return (
   <section className="space-y-4">
     <div className="flex items-baseline justify-between">
       <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
         Maintenance Requests
       </h2>
       <span className="text-xs text-muted-foreground">
         {openMaintenanceCount} open
       </span>
     </div>
     {(() => {
       const openReqs = maintenanceRequests.filter((m) => !m.done);
       const doneReqs = maintenanceRequests.filter((m) => m.done).slice(0, 30);
       const openMsgs = roomMessages
         .filter(
           (m) =>
             (m.thread === "hk_maintenance" || m.thread === "reception_maintenance") &&
             !m.done_at &&
             !m.deleted_at,
         )
         .slice(0, 100);
       type Item = {
         id: string;
         source: "req" | "msg";
         roomNumber: number | null;
         location: string | null;
         message: string;
         sender: string | null;
         createdAt: string;
         origin: "housekeeping" | "reception" | null;
         done: boolean;
       };
       const items: Item[] = [
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
           done: false,
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
           done: false,
         })),
       ].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
       const rawId = (id: string) => id.replace(/^req-|^msg-/, "");
       const markDoneItem = async (it: Item) => {
         if (it.source === "req") {
           await markMaintenanceDone(rawId(it.id));
         } else {
           await supabase
             .from("room_messages" as never)
             .update({ done_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never)
             .eq("id", rawId(it.id));
           qc.invalidateQueries({ queryKey: ["room_messages"] });
         }
       };
       const deleteItem = async (it: Item) => {
         if (it.source === "req") {
           await supabase
             .from("maintenance_requests" as never)
             .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString(), done: true, done_at: new Date().toISOString() } as never)
             .eq("id", rawId(it.id));
           qc.invalidateQueries({ queryKey: ["maintenance_requests"] });
         } else {
           await supabase
             .from("room_messages" as never)
             .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never)
             .eq("id", rawId(it.id));
           qc.invalidateQueries({ queryKey: ["room_messages"] });
         }
       };
       const replyToItem = (it: Item) => {
         const thread: MessagesThread =
           it.origin === "reception" ? "reception_maintenance" : "hk_maintenance";
          setMessagesInitial({
            thread,
            room: it.roomNumber ?? null,
            text: "",
            replyTo: {
              id: rawId(it.id),
              sender: it.sender ?? (it.origin === "reception" ? "Reception" : "Housekeeping"),
              snippet: it.message.slice(0, 280),
            },
          });
         setMessagesSheetOpen(true);
       };
       return (
         <>
           {items.length === 0 ? (
             <p className="text-sm text-muted-foreground py-8 text-center">
               No open maintenance items.
             </p>
           ) : (
             <ul className="space-y-2">
               {items.map((it) => (
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
           {doneReqs.length > 0 && (
             <div className="mt-6 space-y-2">
               <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Completed</p>
               {doneReqs.map((m) => (
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
         </>
       );
     })()}
   </section>
  );
}
