// Admin per-room configuration sheets: linen defaults and room settings.
// Extracted verbatim from src/routes/app.tsx.
import { Check, Pencil, Star } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type {
  ReceptionItem,
  Room,
  RoomFeature,
  RoomFeatureAssignment,
  RoomType,
  TemplateItem,
} from "@/lib/app-types";

export function EditRoomDefaultsSheet({
  navigation,
  inlineView,
  editDefaultsSheetRoom,
  setEditDefaultsSheetRoom,
  template,
  isAssigned,
  toggleAssignment,
  isPreferred,
  togglePreferred,
}: {
  navigation?: ReactNode;
  inlineView?: boolean;
  editDefaultsSheetRoom: number | null;
  setEditDefaultsSheetRoom: (n: number | null) => void;
  template: TemplateItem[];
  isAssigned: (itemId: string, room: number) => boolean;
  toggleAssignment: (itemId: string, room: number) => void;
  isPreferred: (itemId: string, room: number) => boolean;
  togglePreferred: (itemId: string, room: number) => void;
}) {
  return (
 <Sheet open={editDefaultsSheetRoom !== null} onOpenChange={(o) => { if (!o) setEditDefaultsSheetRoom(null); }}>
   <SheetContent embedded={inlineView} side="bottom" className="overflow-y-auto rounded-t-2xl p-4 sm:p-6">
     {navigation}
     {editDefaultsSheetRoom !== null && (() => {
       const n = editDefaultsSheetRoom;
       return (
         <>
           <SheetHeader className={inlineView ? "sr-only" : "text-left"}>
             <SheetTitle className="flex items-center gap-2">
               <Pencil className="h-4 w-4" />
               Edit defaults — Room {n}
             </SheetTitle>
             <SheetDescription>
               Choose which linen items appear by default, and star the room's preferred items
             </SheetDescription>
           </SheetHeader>
           <div className={cn("space-y-1.5", !inlineView && "mt-4")}>
             {template.length === 0 ? (
               <p className="text-sm text-muted-foreground">No items yet.</p>
             ) : (
               template.map((t) => {
                 const checked = isAssigned(t.id, n);
                 const preferred = isPreferred(t.id, n);
                 return (
                   <div key={t.id} className="flex items-stretch gap-2">
                     <button
                       type="button"
                       onClick={() => toggleAssignment(t.id, n)}
                       className={cn(
                         "flex-1 min-w-0 flex items-center justify-between gap-3 rounded-xl border bg-background shadow-sm px-4 min-h-12 text-sm font-medium transition-colors hover:bg-accent",
                         checked && "border-primary bg-primary/10 text-primary",
                       )}
                     >
                       <span className="text-left break-words">
                         {t.name}
                         {preferred && (
                           <span className="ml-2 text-xs font-semibold opacity-70">(Preferred)</span>
                         )}
                       </span>
                       {checked ? <Check className="h-5 w-5 shrink-0" /> : <span className="h-5 w-5 shrink-0" />}
                     </button>
                     <button
                       type="button"
                       onClick={() => togglePreferred(t.id, n)}
                       aria-pressed={preferred}
                       aria-label={preferred ? `Unmark ${t.name} as preferred` : `Mark ${t.name} as preferred`}
                       title="Preferred for this room"
                       className={cn(
                         "inline-flex w-12 shrink-0 items-center justify-center rounded-xl border bg-background shadow-sm transition-colors hover:bg-accent",
                         preferred && "border-amber-400/70 bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300",
                       )}
                     >
                       <Star className={cn("h-5 w-5", preferred && "fill-current")} />
                     </button>
                   </div>
                 );
               })
             )}
           </div>
         </>
       );
     })()}
   </SheetContent>
 </Sheet>
  );
}

export function EditRoomSheet({
  editRoomSheetNumber,
  setEditRoomSheetNumber,
  rooms,
  roomTypes,
  receptionStatuses,
  roomFeatures,
  roomFeatureAssignments,
  parseCats,
  toggleRoomCategory,
  setRoomDefaultStatus,
  toggleRoomFeature,
}: {
  editRoomSheetNumber: number | null;
  setEditRoomSheetNumber: (n: number | null) => void;
  rooms: Room[];
  roomTypes: RoomType[];
  receptionStatuses: ReceptionItem[];
  roomFeatures: RoomFeature[];
  roomFeatureAssignments: RoomFeatureAssignment[];
  parseCats: (category: string | null | undefined) => string[];
  toggleRoomCategory: (room: number, value: string) => void;
  setRoomDefaultStatus: (room: number, statusId: string | null) => void;
  toggleRoomFeature: (room: number, featureId: string) => void;
}) {
  return (
  <Sheet open={editRoomSheetNumber !== null} onOpenChange={(o) => { if (!o) setEditRoomSheetNumber(null); }}>
    <SheetContent side="bottom" className="overflow-y-auto p-4 sm:p-6">
      {editRoomSheetNumber !== null && (() => {
        const n = editRoomSheetNumber;
        const r = rooms.find((x) => x.room_number === n);
        if (!r) return null;
        const cats = parseCats(r.category);
        return (
          <>
            <SheetHeader className="text-left">
              <SheetTitle className="flex items-center gap-2">
                <Pencil className="h-4 w-4" />
                Edit Room {n}
              </SheetTitle>
              <SheetDescription>Set room type, default status and features</SheetDescription>
            </SheetHeader>
            <div className="mt-4 space-y-5">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Room type</p>
                <div className="space-y-1.5">
                  {roomTypes.length === 0 && (
                    <p className="text-sm text-muted-foreground">No room types yet.</p>
                  )}
                  {roomTypes.map((c) => {
                    const selected = cats.includes(c.value);
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => toggleRoomCategory(n, c.value)}
                        className={cn(
                          "w-full flex items-center justify-between gap-3 rounded-xl border bg-background shadow-sm px-4 min-h-12 text-sm font-medium transition-colors hover:bg-accent",
                          selected && "border-primary bg-primary/10 text-primary",
                        )}
                      >
                        <span className="text-left">{c.label}</span>
                        {selected ? <Check className="h-5 w-5" /> : <span className="h-5 w-5" />}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Default status</p>
                <div className="space-y-1.5">
                  {receptionStatuses.length === 0 && (
                    <p className="text-sm text-muted-foreground">No statuses yet.</p>
                  )}
                  {receptionStatuses.map((s) => {
                    const selected = r.default_status === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setRoomDefaultStatus(n, selected ? null : s.id)}
                        className={cn(
                          "w-full flex items-center justify-between gap-3 rounded-xl border bg-background shadow-sm px-4 min-h-12 text-sm font-medium transition-colors hover:bg-accent",
                          selected && "border-primary bg-primary/10 text-primary",
                        )}
                      >
                        <span className="text-left">{s.label}</span>
                        {selected ? <Check className="h-5 w-5" /> : <span className="h-5 w-5" />}
                      </button>
                    );
                  })}
                </div>
              </div>
              {roomFeatures.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Room features</p>
                  <div className="space-y-1.5">
                    {roomFeatures.map((f) => {
                      const selected = roomFeatureAssignments.some(
                        (a) => a.feature_id === f.id && a.room_number === n,
                      );
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => toggleRoomFeature(n, f.id)}
                          className={cn(
                            "w-full flex items-center justify-between gap-3 rounded-xl border bg-background shadow-sm px-4 min-h-12 text-sm font-medium transition-colors hover:bg-accent",
                            selected && "border-primary bg-primary/10 text-primary",
                          )}
                        >
                          <span className="text-left">{f.label}</span>
                          {selected ? <Check className="h-5 w-5" /> : <span className="h-5 w-5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        );
      })()}
    </SheetContent>
  </Sheet>
  );
}
