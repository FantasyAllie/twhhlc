import { useState } from "react";
import type { ReactNode } from "react";
import { Clock, MessageSquare, DoorOpen, Footprints, Wrench, X, Dog, Inbox, Plus, PackageSearch, ChevronDown } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { FlagIcon, FLAG_COLORS, useRoomFlags } from "@/lib/room-flags";
import { RoomInfoTiles, type RoomInfoTab } from "@/components/rooms/room-info-tiles";
import { RoomChecklistRecords } from "@/components/rooms/room-checklists";
import { RoomPins, type PinViewer } from "@/components/rooms/room-pins";
import type { LostPropertyLite, MaintenanceRequest, Room, RoomMessage } from "@/lib/app-types";
import type { MessagesThread } from "@/components/messages-sheet";

type MessagesInitial = {
  thread?: MessagesThread;
  room?: number | null;
  text?: string;
  replyTo?: { id: string; sender: string; snippet: string };
};

type Props = {
  navigation?: ReactNode;
  inlineView?: boolean;
  notesSheetRoom: number | null;
  setNotesSheetRoom: (n: number | null) => void;
  rooms: Room[];
  /** Who's looking, for the room's pins. */
  pinViewer: PinViewer;
  canUseMessages: boolean;
  canOpenHousekeepingChat?: boolean;
  isReception: boolean;
  setMessagesInitial: (v: MessagesInitial) => void;
  setMessagesSheetOpen: (v: boolean) => void;
  setRoomEarlyCheckIn: (n: number, v: boolean) => void;
  setRoomLateCheckout: (n: number, v: boolean) => void;
  setRoomGuestVacated: (n: number, v: boolean) => void;
  setRoomStayoverOut: (n: number, v: boolean) => void;
  setRoomDogBox: (n: number, v: boolean) => void;
  confirmHousekeepingNote: (n: number, note: string) => void;
  setRoomHousekeepingNote: (n: number, note: string) => void;
  deleteRoomMessage: (id: string) => void;
  newMessageText: string;
  setNewMessageText: (v: string) => void;
  submitRoomMessage: (n: number) => void;
  confirmRoomMessage: (m: RoomMessage) => void;
  dismissRoomMessage: (id: string) => void;
  // Room hub extras: quick logging shortcuts and the info tiles.
  onLogMaintenance?: (n: number) => void;
  onLogLostProperty?: (n: number) => void;
  onMessageReception?: (n: number) => void;
  hasDnd?: boolean;
  openMaintenance?: MaintenanceRequest[];
  openLostProperty?: LostPropertyLite[];
};

export function RoomNotesSheet({
  navigation,
  inlineView,
  notesSheetRoom,
  setNotesSheetRoom,
  rooms,
  pinViewer,
  canUseMessages,
  canOpenHousekeepingChat = false,
  isReception,
  setMessagesInitial,
  setMessagesSheetOpen,
  setRoomEarlyCheckIn,
  setRoomLateCheckout,
  setRoomGuestVacated,
  setRoomStayoverOut,
  setRoomDogBox,
  confirmHousekeepingNote,
  setRoomHousekeepingNote,
  deleteRoomMessage,
  newMessageText,
  setNewMessageText,
  submitRoomMessage,
  confirmRoomMessage,
  dismissRoomMessage,
  onLogMaintenance,
  onLogLostProperty,
  onMessageReception,
  hasDnd = false,
  openMaintenance = [],
  openLostProperty = [],
}: Props) {
  const roomFlags = useRoomFlags();
  const [newLogOpen, setNewLogOpen] = useState(false);
  const [infoTab, setInfoTab] = useState<RoomInfoTab | null>(null);
  return (
 <Sheet
   open={notesSheetRoom !== null}
   onOpenChange={(o) => {
     if (!o) {
       setNotesSheetRoom(null);
       setNewLogOpen(false);
       setInfoTab(null);
     }
   }}
 >
   <SheetContent embedded={inlineView} side="bottom" className="overflow-y-auto rounded-t-2xl p-4 sm:p-6">
     {navigation}
     {notesSheetRoom !== null && (() => {
       const n = notesSheetRoom;
       const room = rooms.find((r) => r.room_number === n);
       const note = room?.housekeeping_note ?? null;
       const maintenance = !!room?.needs_maintenance;
       const vacated = !!room?.guest_vacated;
       const closeHub = () => {
         setNewLogOpen(false);
         setInfoTab(null);
         setNotesSheetRoom(null);
       };
       return (
         <>
           <SheetHeader className={inlineView ? "sr-only" : "text-left"}>
              <SheetTitle className="flex items-center gap-2">
                <Inbox className="h-4 w-4" />
                 Room hub — Room {n}
             </SheetTitle>
             <SheetDescription>Messages, logs and room info</SheetDescription>
           </SheetHeader>
            <div className={cn("space-y-3", !inlineView && "mt-4")}>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-center gap-2 rounded-full"
                  disabled={!canUseMessages}
                  onClick={() => {
                    closeHub();
                    setMessagesInitial({});
                    setMessagesSheetOpen(true);
                  }}
                >
                  <MessageSquare className="h-4 w-4" />
                  All Messages
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-center gap-2 rounded-full"
                  aria-expanded={newLogOpen}
                  onClick={() => setNewLogOpen((v) => !v)}
                >
                  <Plus className="h-4 w-4" />
                  New Log
                  <ChevronDown className={cn("h-4 w-4 opacity-60 transition-transform", newLogOpen && "rotate-180")} />
                </Button>
              </div>
              {newLogOpen && (
                <div className="grid gap-2 rounded-xl border bg-background p-3 sm:grid-cols-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-center gap-2"
                    onClick={() => {
                      closeHub();
                      onLogMaintenance?.(n);
                    }}
                    disabled={!onLogMaintenance}
                  >
                    <Wrench className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    Maintenance issue
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-center gap-2"
                    onClick={() => {
                      closeHub();
                      onLogLostProperty?.(n);
                    }}
                    disabled={!onLogLostProperty}
                  >
                    <PackageSearch className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                    Lost property
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-center gap-2"
                    onClick={() => {
                      closeHub();
                      onMessageReception?.(n);
                    }}
                    disabled={!onMessageReception || !canUseMessages}
                  >
                    <MessageSquare className="h-4 w-4" />
                    Message reception
                  </Button>
                </div>
              )}
             {isReception ? (
               <>
                 {roomFlags.flags.map((d) => {
                   const on = roomFlags.isOn(room, n, d);
                   return (
                     <div key={d.key} className="flex items-center justify-between gap-2 rounded-xl border bg-background p-3">
                       <span className="flex items-center gap-2 text-sm font-medium">
                         <FlagIcon def={d} className={cn("h-4 w-4", on ? (FLAG_COLORS[d.color] ?? FLAG_COLORS.slate).text : "text-muted-foreground")} />
                         {d.label}
                       </span>
                       <Switch checked={on} onCheckedChange={(v) => roomFlags.toggle(n, d, v)} />
                     </div>
                   );
                 })}
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
                 <RoomPins room={n} viewer={pinViewer} />
               </>
             ) : (
               <>
                 {roomFlags.flags.filter((d) => d.custom && roomFlags.isOn(room, n, d)).map((d) => (
                   <div key={d.key} className="flex items-center gap-2 rounded-xl border bg-background p-3 text-sm">
                     <FlagIcon def={d} className={cn("h-4 w-4 shrink-0", (FLAG_COLORS[d.color] ?? FLAG_COLORS.slate).text)} />
                     <span className="flex-1 font-medium">{d.label}</span>
                     <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => roomFlags.toggle(n, d, false)} aria-label={`Clear ${d.label}`}>
                       <X className="h-3 w-3" />
                     </Button>
                   </div>
                 ))}
                 {vacated && (
                   <div className="flex items-center gap-2 rounded-xl border border-emerald-500/60 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-sm">
                     <DoorOpen className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                     <span className="font-medium text-emerald-800 dark:text-emerald-200">
                       Guest has vacated — marked by Reception
                     </span>
                   </div>
                 )}
                 <RoomPins room={n} viewer={pinViewer} />
               </>
             )}
             {!isReception && (
               <details className="group rounded-xl border bg-background p-3">
                 <summary className="flex cursor-pointer list-none items-center justify-between gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground [&::-webkit-details-marker]:hidden">
                   Guest &amp; room info
                   <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                 </summary>
                 <div className="mt-3 grid grid-cols-2 gap-1.5">
                   {roomFlags.flags.map((d) => {
                     const on = roomFlags.isOn(room, n, d);
                     return (
                       <Button
                         key={d.key}
                         type="button"
                         variant={on ? "default" : "outline"}
                         aria-pressed={on}
                         className="h-auto min-h-10 justify-start gap-2 whitespace-normal text-left"
                         onClick={() => roomFlags.toggle(n, d, !on)}
                       >
                         <FlagIcon def={d} className="h-4 w-4 shrink-0" />
                         {d.label}
                       </Button>
                     );
                   })}
                 </div>
               </details>
             )}
             <details className="group rounded-xl border bg-background p-3">
               <summary className="flex cursor-pointer list-none items-center justify-between gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground [&::-webkit-details-marker]:hidden">
                 Completed checklists
                 <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
               </summary>
               <div className="mt-3">
                 <RoomChecklistRecords roomNumber={n} />
               </div>
             </details>
             <RoomInfoTiles
               roomNumber={n}
               hasDnd={hasDnd}
               openMaint={openMaintenance}
               openLp={openLostProperty}
               active={infoTab}
               onToggle={(tab) => setInfoTab((cur) => (cur === tab ? null : tab))}
             />
           </div>
         </>
       );
     })()}
   </SheetContent>
 </Sheet>
  );
}
