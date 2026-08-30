import { MessageSquare, DoorOpen, Footprints, Wrench, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { Room, RoomMessage } from "@/lib/app-types";
import type { MessagesThread } from "@/components/messages-sheet";

type MessagesInitial = {
  thread?: MessagesThread;
  room?: number | null;
  text?: string;
  replyTo?: { id: string; sender: string; snippet: string };
};

type Props = {
  notesSheetRoom: number | null;
  setNotesSheetRoom: (n: number | null) => void;
  rooms: Room[];
  activeMessagesByRoom: (n: number) => RoomMessage[];
  canUseMessages: boolean;
  isReception: boolean;
  setMessagesInitial: (v: MessagesInitial) => void;
  setMessagesSheetOpen: (v: boolean) => void;
  setRoomEarlyCheckIn: (n: number, v: boolean) => void;
  setRoomGuestVacated: (n: number, v: boolean) => void;
  setRoomStayoverOut: (n: number, v: boolean) => void;
  confirmHousekeepingNote: (n: number, note: string) => void;
  setRoomHousekeepingNote: (n: number, note: string) => void;
  deleteRoomMessage: (id: string) => void;
  newMessageText: string;
  setNewMessageText: (v: string) => void;
  submitRoomMessage: (n: number) => void;
  confirmRoomMessage: (m: RoomMessage) => void;
  dismissRoomMessage: (id: string) => void;
};

export function RoomNotesSheet({
  notesSheetRoom,
  setNotesSheetRoom,
  rooms,
  activeMessagesByRoom,
  canUseMessages,
  isReception,
  setMessagesInitial,
  setMessagesSheetOpen,
  setRoomEarlyCheckIn,
  setRoomGuestVacated,
  setRoomStayoverOut,
  confirmHousekeepingNote,
  setRoomHousekeepingNote,
  deleteRoomMessage,
  newMessageText,
  setNewMessageText,
  submitRoomMessage,
  confirmRoomMessage,
  dismissRoomMessage,
}: Props) {
  return (
 <Sheet open={notesSheetRoom !== null} onOpenChange={(o) => { if (!o) setNotesSheetRoom(null); }}>
   <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl p-4 sm:p-6">
     {notesSheetRoom !== null && (() => {
       const n = notesSheetRoom;
       const room = rooms.find((r) => r.room_number === n);
       const note = room?.housekeeping_note ?? null;
       const maintenance = !!room?.needs_maintenance;
       const vacated = !!room?.guest_vacated;
       const msgs = activeMessagesByRoom(n);
       return (
         <>
           <SheetHeader className="text-left">
              <SheetTitle className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                 Notifications — Room {n}
             </SheetTitle>
             <SheetDescription>Shared between Housekeeping and Reception</SheetDescription>
           </SheetHeader>
            <div className="mt-4 space-y-3">
              {canUseMessages && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-center gap-2 rounded-full"
                  onClick={() => {
                    setNotesSheetRoom(null);
                    setMessagesInitial({ thread: "hk_reception", room: n });
                    setMessagesSheetOpen(true);
                  }}
                >
                  <MessageSquare className="h-4 w-4" />
                  Open Messages
                </Button>
              )}
             {isReception ? (
               <>
                  <div className="flex items-center justify-between gap-2 rounded-xl border bg-background p-3">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <DoorOpen className={cn("h-4 w-4", room?.early_check_in ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")} />
                      Early check-in
                    </span>
                    <Switch checked={!!room?.early_check_in} onCheckedChange={(v) => setRoomEarlyCheckIn(n, v)} />
                  </div>
                 <div className="flex items-center justify-between gap-2 rounded-xl border bg-background p-3">
                   <span className="flex items-center gap-2 text-sm font-medium">
                     <DoorOpen className={cn("h-4 w-4", vacated ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")} />
                     Guest has checked out
                   </span>
                   <Switch checked={vacated} onCheckedChange={(v) => setRoomGuestVacated(n, v)} />
                 </div>
                 <div className="flex items-center justify-between gap-2 rounded-xl border bg-background p-3">
                   <span className="flex items-center gap-2 text-sm font-medium">
                     <Footprints className={cn("h-4 w-4", room?.stayover_out ? "text-sky-600 dark:text-sky-400" : "text-muted-foreground")} />
                     Stayover — guest out for the day
                   </span>
                   <Switch checked={!!room?.stayover_out} onCheckedChange={(v) => setRoomStayoverOut(n, v)} />
                 </div>
                 {maintenance && (
                   <div className="flex items-center gap-2 rounded-xl border border-amber-500/60 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm">
                     <Wrench className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                     <span className="font-medium text-amber-800 dark:text-amber-200">
                       Maintenance requested by Housekeeping
                     </span>
                   </div>
                 )}
                 <div className="rounded-xl border bg-background p-3">
                   <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                     From Housekeeping
                   </p>
                   {note ? (
                      <>
                        <p className="text-sm whitespace-pre-wrap break-words">{note}</p>
                        <div className="mt-2 flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => confirmHousekeepingNote(n, note)}
                          >
                            Confirm
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setRoomHousekeepingNote(n, "")}
                          >
                            Dismiss
                          </Button>
                        </div>
                      </>
                   ) : (
                     <p className="text-sm text-muted-foreground">No notes from Housekeeping.</p>
                   )}
                 </div>
                   <div className="space-y-2 rounded-xl border border-emerald-400/60 bg-emerald-50 dark:bg-emerald-950/40 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                      Leave a message for housekeeping
                    </p>
                   {msgs.length > 0 && (
                     <ul className="space-y-1">
                       {msgs.map((m) => (
                         <li key={m.id} className="flex items-start gap-2 text-sm bg-background/70 rounded p-2">
                           <span className="flex-1 break-words whitespace-pre-wrap">{m.message}</span>
                           <Button
                             type="button"
                             variant="ghost"
                             size="sm"
                             className="h-7 px-2 text-xs"
                             onClick={() => deleteRoomMessage(m.id)}
                             aria-label="Delete message"
                           >
                             <X className="h-3 w-3" />
                           </Button>
                         </li>
                       ))}
                     </ul>
                   )}
                    {canUseMessages && (
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            setNotesSheetRoom(null);
                            setMessagesInitial({ thread: "hk_reception", room: n });
                            setMessagesSheetOpen(true);
                          }}
                        >
                          <MessageSquare className="h-3 w-3 mr-1" /> Open in Messages
                        </Button>
                      </div>
                    )}
                   <div className="flex gap-2">
                     <Input
                       value={newMessageText}
                       onChange={(e) => setNewMessageText(e.target.value)}
                       placeholder="Type a message…"
                       onKeyDown={(e) => {
                         if (e.key === "Enter" && !e.shiftKey) {
                           e.preventDefault();
                           submitRoomMessage(n);
                         }
                       }}
                     />
                     <Button type="button" onClick={() => submitRoomMessage(n)} disabled={!newMessageText.trim()}>
                       Send
                     </Button>
                   </div>
                 </div>
               </>
             ) : (
               <>
                 {vacated && (
                   <div className="flex items-center gap-2 rounded-xl border border-emerald-500/60 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-sm">
                     <DoorOpen className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                     <span className="font-medium text-emerald-800 dark:text-emerald-200">
                       Guest has vacated — marked by Reception
                     </span>
                   </div>
                 )}
                 {msgs.length > 0 && (
                   <div className="space-y-2 rounded-xl border border-amber-400/60 bg-amber-50 dark:bg-amber-950/40 p-3">
                     <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                       Reception message{msgs.length > 1 ? "s" : ""}
                     </p>
                     <ul className="space-y-1">
                       {msgs.map((m) => (
                         <li key={m.id} className="flex items-start gap-2 text-sm bg-background/70 rounded p-2">
                           <div className="flex-1 min-w-0">
                             <p className="break-words whitespace-pre-wrap">{m.message}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {m.created_by_username ? <>from {m.created_by_username} · </> : null}
                                {new Date(m.created_at).toLocaleString(undefined, {
                                  weekday: "short",
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                           </div>
                           <div className="flex flex-col gap-1 shrink-0">
                             <Button
                               type="button"
                               variant="default"
                               size="sm"
                               className="h-7 text-xs"
                               onClick={() => confirmRoomMessage(m)}
                             >
                               Confirm
                             </Button>
                             <Button
                               type="button"
                               variant="outline"
                               size="sm"
                               className="h-7 text-xs"
                               onClick={() => dismissRoomMessage(m.id)}
                             >
                               Dismiss
                             </Button>
                           </div>
                         </li>
                       ))}
                     </ul>
                      {canUseMessages && (
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              const first = msgs[0];
                              setNotesSheetRoom(null);
                              setMessagesInitial({
                                thread: "hk_reception",
                                room: n,
                                replyTo: first
                                  ? {
                                      id: first.id,
                                      sender: first.created_by_username ?? "Reception",
                                      snippet: first.message.slice(0, 280),
                                    }
                                  : undefined,
                              });
                              setMessagesSheetOpen(true);
                            }}
                          >
                            <MessageSquare className="h-3 w-3 mr-1" /> Reply in Messages
                          </Button>
                        </div>
                      )}
                   </div>
                 )}
               </>
             )}
           </div>
         </>
       );
     })()}
   </SheetContent>
 </Sheet>
  );
}
