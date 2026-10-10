import React from "react";
import { ArrowLeft, ChevronDown, ConciergeBell, DoorOpen, Footprints, Camera, Clock, Dog } from "lucide-react";
import type { QueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FlagIcon, useRoomFlags } from "@/lib/room-flags";
import type { ReceptionItem, Room } from "@/lib/app-types";
import { RoomChecklistRecords } from "@/components/rooms/room-checklists";

type Props = {
  receptionSheetRoom: number | null;
  setReceptionSheetRoom: (n: number | null) => void;
  /** When set, the sheet is shown inline in the room view; renders a back button. */
  onBack?: () => void;
  /** Shown inside the room's slot: hide the title/description visually. */
  inlineView?: boolean;
  rooms: Room[];
  receptionStatuses: ReceptionItem[];
  receptionBeds: ReceptionItem[];
  parseCats: (c: string | null | undefined) => string[];
  isReception: boolean;
  isAdmin: boolean;
  housekeepingDoneSet: Set<number>;
  receptionDoneSet: Set<number>;
  nrOnRooms: Set<number>;
  qc: QueryClient;
  dndFileInputRef: React.RefObject<HTMLInputElement | null>;
  setRoomGuestVacated: (n: number, v: boolean) => void;
  setRoomStayoverOut: (n: number, v: boolean) => void;
  setRoomEarlyCheckIn: (n: number, v: boolean) => void | Promise<void>;
  setRoomLateCheckout: (n: number, v: boolean) => void | Promise<void>;
  setRoomDogBox: (n: number, v: boolean) => void | Promise<void>;
  setQuickReceptionOpen: (v: boolean) => void;
  setStayoverPhotosRoomFilter: (n: number | undefined) => void;
  setStayoverPhotosOpen: (v: boolean) => void;
  toggleReceptionDone: (n: number) => void | Promise<void>;
  toggleHousekeepingDone: (n: number) => void | Promise<void>;
  setRoomReceptionStatus: (n: number, id: string | null) => void;
  setRoomReceptionBed: (n: number, id: string | null) => void;
  setRoomNotRequired: (n: number, v: boolean) => void | Promise<void>;
  deleteTodayStayoverPhotosForRoom: (n: number) => Promise<unknown>;
  setPendingDndRoom: (n: number | null) => void;
};

export function ReceptionStatusSheet({
  receptionSheetRoom,
  setReceptionSheetRoom,
  onBack,
  inlineView,
  rooms,
  receptionStatuses,
  receptionBeds,
  parseCats,
  isReception,
  isAdmin,
  housekeepingDoneSet,
  receptionDoneSet,
  nrOnRooms,
  qc,
  dndFileInputRef,
  setRoomGuestVacated,
  setRoomStayoverOut,
  setRoomEarlyCheckIn,
  setRoomLateCheckout,
  setRoomDogBox,
  setQuickReceptionOpen,
  setStayoverPhotosRoomFilter,
  setStayoverPhotosOpen,
  toggleReceptionDone,
  toggleHousekeepingDone,
  setRoomReceptionStatus,
  setRoomReceptionBed,
  setRoomNotRequired,
  deleteTodayStayoverPhotosForRoom,
  setPendingDndRoom,
}: Props) {
  const roomFlags = useRoomFlags();
  return (
 <Sheet open={receptionSheetRoom !== null} onOpenChange={(o) => { if (!o) setReceptionSheetRoom(null); }}>
   <SheetContent side="bottom" className="overflow-y-auto rounded-t-2xl p-4 sm:p-6">
     {receptionSheetRoom !== null && (() => {
       const n = receptionSheetRoom;
       const room = rooms.find((r) => r.room_number === n);
       const occ = room?.reception_status_id ?? room?.default_status ?? null;
        const dndIdCurrent = receptionStatuses.find((x) => x.label === "DND")?.id ?? null;
        const isCurrentDnd = !!dndIdCurrent && occ === dndIdCurrent;
       const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
       const cats = parseCats(room?.category).map(norm);
       const hasSuperKing = cats.includes("superking");
       const hasDouble = cats.includes("double");
       const onlyDouble = hasDouble && !hasSuperKing;
       const filteredBeds = receptionBeds.filter((b) => {
         const nb = norm(b.label);
         if (onlyDouble) return nb === "double";
         if (hasSuperKing && nb === "double") return false;
         if (hasDouble && (nb === "king" || nb === "twin")) return false;
         return true;
       });
       const currentBed = room?.reception_bed_id ?? null;
      const Row = ({
         label,
         selected,
         disabled,
         noClickSound,
         onClick,
       }: { label: React.ReactNode; selected: boolean; disabled?: boolean; noClickSound?: boolean; onClick: () => void }) => (
          <Button
            variant="outline"
           type="button"
           disabled={disabled}
           onClick={onClick}
           data-no-click-sound={noClickSound ? "true" : undefined}
           className={cn(
            "w-full flex items-center justify-center text-center gap-3 rounded-xl border bg-background shadow-sm px-4 min-h-12 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-60 disabled:cursor-not-allowed",
             selected && "border-primary bg-primary/10 text-primary",
           )}
         >
          <span className="text-center">{label}</span>
          </Button>
       );
       return (
         <>
           <SheetHeader className={cn("text-left", onBack && "relative pr-12 min-h-9", inlineView && "hidden")}>
             {onBack && (
               <Button
                 type="button"
                 variant="outline"
                 size="icon"
                 aria-label="Back to room"
                 onClick={onBack}
                 className="absolute right-0 top-0 h-9 w-9 rounded-full"
               >
                 <ArrowLeft className="h-4 w-4" />
               </Button>
             )}
             <SheetTitle className={cn("flex items-center gap-2", inlineView && "sr-only")}>
                <ConciergeBell className="h-4 w-4" />
                Status — Room {n}
             </SheetTitle>
            <SheetDescription className={cn(inlineView && "sr-only")}>
              Mark status and bed configuration
            </SheetDescription>
           </SheetHeader>
              {isCurrentDnd && (
               <div className={cn("flex gap-2", !inlineView && "mt-2")}>
                 {isCurrentDnd && (
                   <Button
                     type="button"
                     size="sm"
                     variant="outline"
                     className="flex-1"
                     onClick={() => {
                       setStayoverPhotosRoomFilter(n);
                       setStayoverPhotosOpen(true);
                     }}
                   >
                     <Camera className="h-4 w-4 mr-1" />
                     Photo
                   </Button>
                 )}
               </div>
             )}
           <div className={cn("space-y-4", (!inlineView || isCurrentDnd) && "mt-4")}>
             <div className="space-y-2">
               <p className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
               {receptionStatuses.length === 0 && (
                 <p className="text-center text-sm text-muted-foreground">No statuses</p>
               )}
                <div className="space-y-1.5">
                   {(() => {
                     const dndId = receptionStatuses.find((x) => x.label === "DND")?.id ?? null;
                     const stayId = receptionStatuses.find((x) => x.label === "Stayover")?.id ?? null;
                      const dirtyId = receptionStatuses.find((x) => x.label === "Dirty")?.id ?? null;
                      const rosId = receptionStatuses.find((x) => x.label === "ROS")?.id ?? null;
                     const dndActive = !!dndId && occ === dndId;
                      const dirtyActive = !!dirtyId && occ === dirtyId;
                      const topLabels = ["Arrival", "Clean"];
                      const tripleLabels = ["Dirty", "Staff", "ROS"];
                     const findStatus = (lbl: string) =>
                       receptionStatuses.find(
                         (x) => x.label.toLowerCase() === lbl.toLowerCase(),
                       ) ?? null;
                      const dndStayIds = new Set<string>();
                      [findStatus("DND"), findStatus("Stayover")].forEach((s) => {
                        if (s) dndStayIds.add(s.id);
                      });
                      const tripleIds = new Set<string>();
                      tripleLabels.forEach((lbl) => {
                        const s = findStatus(lbl);
                        if (s) tripleIds.add(s.id);
                      });
                     const topIds = new Set<string>();
                     topLabels.forEach((lbl) => {
                       const s = findStatus(lbl);
                       if (s) topIds.add(s.id);
                     });
                     const handleClick = (s: { id: string }) => {
                       if (occ === s.id) {
                          const next =
                            s.id === dndId && stayId
                              ? stayId
                              : s.id === dirtyId && rosId
                                ? rosId
                                : null;
                          setRoomReceptionStatus(n, next);
                          if (s.id === dndId) {
                            void deleteTodayStayoverPhotosForRoom(n).then(() => {
                              qc.invalidateQueries({ queryKey: ["stayover_photos"] });
                            });
                          }
                        } else {
                           if (s.id === dndId) {
                             // Require a photo of the DND door before applying.
                             void setRoomStayoverOut(n, false);
                             setPendingDndRoom(n);
                             dndFileInputRef.current?.click();
                           } else {
                            setRoomReceptionStatus(n, s.id);
                            // Housekeeping marking a room as Stayover also marks
                            // it as done — there's nothing further to service.
                            if (!isReception && stayId && s.id === stayId && !housekeepingDoneSet.has(n)) {
                              void toggleHousekeepingDone(n);
                            }
                            if (occ === dndId) {
                              void deleteTodayStayoverPhotosForRoom(n).then(() => {
                                qc.invalidateQueries({ queryKey: ["stayover_photos"] });
                              });
                            }
                          }
                       }

                     };
                      const renderRow = (s: { id: string; label: string }) => {
                         const selected =
                           occ === s.id ||
                           (dndActive && s.id === stayId) ||
                           (dirtyActive && s.id === rosId);
                        const willSelect = occ !== s.id;
                        const specialSoundLabel = ["dirty", "clean", "arrival"].includes(s.label.toLowerCase());
                        return (
                          <Row
                            key={s.id}
                            label={s.label}
                            selected={selected}
                            noClickSound={specialSoundLabel && willSelect}
                            onClick={() => handleClick(s)}
                          />
                        );
                      };
                     const nodes: React.ReactNode[] = [];
                     topLabels.forEach((lbl) => {
                       const s = findStatus(lbl);
                       if (s) nodes.push(renderRow(s));
                     });
                      {
                        const sDnd = findStatus("DND");
                        const sStay = findStatus("Stayover");
                        const stayIdLocal = sStay?.id ?? null;
                        const isDoneLocal = receptionDoneSet.has(n);
                        const isStayoverLocal = !!stayIdLocal && occ === stayIdLocal;
                        const isNR = nrOnRooms.has(n);
                        const onNrClick = () => {
                          if (isNR) {
                            // Uncheck NR indicator only — keep Mark as Done and
                            // Stayover flags in place.
                             void setRoomNotRequired(n, false);
                            return;
                          }
                          // Turn NR on and enable Stayover + Mark as Done.
                           void setRoomNotRequired(n, true);
                          if (stayIdLocal && !isStayoverLocal) {
                            setRoomReceptionStatus(n, stayIdLocal);
                          }
                          if (!isDoneLocal) void toggleReceptionDone(n);
                        };
                        if (sDnd || sStay) {
                          nodes.push(
                            <div key="triple-dnd-nr-stay" className="grid grid-cols-3 gap-1.5">
                              {sDnd ? renderRow(sDnd) : <div />}
                              <Row
                                label="Not Required"
                                selected={isNR}
                                onClick={onNrClick}
                              />
                              {sStay ? renderRow(sStay) : <div />}
                            </div>,
                          );
                        }
                      }
                      {
                        const tripleNodes = tripleLabels.map((lbl) => findStatus(lbl));
                        if (tripleNodes.some((s) => s)) {
                          nodes.push(
                            <div key="triple-dirty-staff-ros" className="grid grid-cols-3 gap-1.5">
                              {tripleNodes.map((s, i) =>
                                s ? renderRow(s) : <div key={`triple-empty-${i}`} />,
                              )}
                            </div>,
                          );
                        }
                      }
                     receptionStatuses.forEach((s) => {
                         if (dndStayIds.has(s.id) || topIds.has(s.id) || tripleIds.has(s.id)) return;
                       nodes.push(renderRow(s));
                     });
                     return nodes;
                   })()}
                </div>
             </div>
             <div className="space-y-2">
               <p className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bed</p>
               {filteredBeds.length === 0 && (
                 <p className="text-center text-sm text-muted-foreground">No bed types</p>
               )}
                <div className="grid grid-cols-2 gap-1.5">
                  {filteredBeds.map((b) => {
                   const lockedDouble = onlyDouble && norm(b.label) === "double";
                   const selected = currentBed === b.id || lockedDouble;
                   return (
                     <Row
                       key={b.id}
                       label={<>{b.label}{lockedDouble ? " (default)" : ""}</>}
                       selected={selected}
                       disabled={lockedDouble && selected}
                       onClick={() => {
                         if (lockedDouble) return;
                         setRoomReceptionBed(n, currentBed === b.id ? null : b.id);
                       }}
                     />
                   );
                 })}
               </div>
              </div>
               <div className="border-y py-4">
                 <Row
                   label="Mark as Done"
                   selected={isReception ? receptionDoneSet.has(n) : housekeepingDoneSet.has(n)}
                   onClick={() => {
                     void (isReception ? toggleReceptionDone(n) : toggleHousekeepingDone(n));
                   }}
                 />
               </div>
                <details className="group space-y-2">
                  <summary className="flex cursor-pointer list-none items-center justify-center gap-1.5 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground [&::-webkit-details-marker]:hidden">
                    Guest &amp; room info
                    <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {roomFlags.flags.map((d) => {
                      const on = roomFlags.isOn(room, n, d);
                      return (
                        <Row
                          key={d.key}
                          label={
                            <span className="inline-flex items-center gap-2">
                              <FlagIcon def={d} className="h-4 w-4 shrink-0" />
                              {d.label}
                            </span>
                          }
                          selected={on}
                          onClick={() => roomFlags.toggle(n, d, !on)}
                        />
                      );
                    })}
                  </div>
                   <RoomChecklistRecords roomNumber={n} />
                </details>
            </div>
         </>
       );
     })()}
   </SheetContent>
 </Sheet>
  );
}
