import { ConciergeBell, Check, RotateCcw, LogOut, DoorOpen, Footprints } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

export type QuickReceptionRoom = {
  room_number: number;
  category: string | null;
  reception_status_id: string | null;
  reception_bed_id: string | null;
  default_status: string | null;
  guest_vacated?: boolean;
  early_check_in?: boolean;
  stayover_out?: boolean;
};

export type QuickReceptionItem = { id: string; label: string };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const parseCats = (c: string | null | undefined): string[] =>
  (c ?? "").split(",").map((s) => s.trim()).filter(Boolean);

export function filterBedsForRoom(
  room: Pick<QuickReceptionRoom, "category">,
  beds: QuickReceptionItem[],
) {
  const cats = parseCats(room.category).map(norm);
  const hasSuperKing = cats.includes("superking");
  const hasDouble = cats.includes("double");
  const onlyDouble = hasDouble && !hasSuperKing;
  const filtered = beds.filter((b) => {
    const nb = norm(b.label);
    if (onlyDouble) return nb === "double";
    if (hasSuperKing && nb === "double") return false;
    if (hasDouble && (nb === "king" || nb === "twin")) return false;
    return true;
  });
  return { filtered, onlyDouble };
}

function Chip({
  label,
  selected,
  disabled,
  onClick,
}: {
  label: React.ReactNode;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "w-full inline-flex items-center justify-center gap-1.5 rounded-full border bg-background px-3 min-h-9 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-60 disabled:cursor-not-allowed",
        selected && "border-primary bg-primary/10 text-primary",
      )}
    >
      {selected && <Check className="h-3.5 w-3.5" />}
      <span className="truncate">{label}</span>
    </button>
  );
}

export function QuickReceptionSheet({
  open,
  onOpenChange,
  rooms,
  statuses,
  beds,
  onChangeStatus,
  onChangeBed,
  onResetAll,
  onChangeVacant,
  onChangeEarlyCheckIn,
  onChangeStayoverOut,
  flagsOnly = false,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  rooms: QuickReceptionRoom[];
  statuses: QuickReceptionItem[];
  beds: QuickReceptionItem[];
  onChangeStatus: (roomNumber: number, statusId: string | null) => void;
  onChangeBed: (roomNumber: number, bedId: string | null) => void;
  onResetAll?: () => void | Promise<void>;
  onChangeVacant?: (roomNumber: number, value: boolean) => void;
  onChangeEarlyCheckIn?: (roomNumber: number, value: boolean) => void;
  onChangeStayoverOut?: (roomNumber: number, value: boolean) => void;
  /** Reception accounts: only the room flags are editable, not status or bed. */
  flagsOnly?: boolean;
}) {
  const sorted = [...rooms].sort((a, b) => a.room_number - b.room_number);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[90dvh] overflow-hidden rounded-t-2xl p-4 sm:p-6"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <ConciergeBell className="h-4 w-4" />
            Quick Room Setup
          </SheetTitle>
          <SheetDescription>
            {flagsOnly
              ? "Set Vacant, Early check-in and Stayover out for every room in one place. Tap a chip to toggle it. Changes save instantly."
              : "Set the status, bed and flags for every room in one place. Tap the selected chip to clear it. Changes save instantly."}
          </SheetDescription>
        </SheetHeader>

        {onResetAll && (
          <div className="pb-3">
            <button
              type="button"
              onClick={() => void onResetAll()}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border bg-background px-3 min-h-9 text-xs font-medium transition-colors hover:bg-accent",
              )}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset all</span>
            </button>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto divide-y rounded-lg border bg-card">
          {sorted.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No rooms.</p>
          )}
          {sorted.map((room) => {
            const n = room.room_number;
            const currentStatus =
              room.reception_status_id ?? room.default_status ?? null;
            const currentBed = room.reception_bed_id ?? null;
            const { filtered, onlyDouble } = filterBedsForRoom(room, beds);
            return (
              <div key={n} className="p-3 space-y-2">
                <div className="flex items-baseline gap-2">
                  <div className="text-sm font-semibold">Room {n}</div>
                </div>

                {!flagsOnly && statuses.length > 0 && (
                  <div className="flex items-start gap-2">
                    <div className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground pt-1.5">
                      Status
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 flex-1 min-w-0">
                      {(() => {
                        const dndId = statuses.find((x) => x.label === "DND")?.id ?? null;
                        const stayId = statuses.find((x) => x.label === "Stayover")?.id ?? null;
                        const dndActive = !!dndId && currentStatus === dndId;
                        return statuses.map((s) => {
                        const selected = currentStatus === s.id || (dndActive && s.id === stayId);
                        return (
                          <Chip
                            key={s.id}
                            label={s.label}
                            selected={selected}
                            onClick={() => {
                              if (currentStatus === s.id) {
                                const next = s.id === dndId && stayId ? stayId : null;
                                onChangeStatus(n, next);
                              } else {
                                onChangeStatus(n, s.id);
                              }
                            }}
                          />
                        );
                        });
                      })()}
                    </div>
                  </div>
                )}

                {!flagsOnly && filtered.length > 0 && (
                  <div className="flex items-start gap-2">
                    <div className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground pt-1.5">
                      Bed
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 flex-1 min-w-0">
                      {filtered.map((b) => {
                        const lockedDouble =
                          onlyDouble && norm(b.label) === "double";
                        const selected = currentBed === b.id || lockedDouble;
                        return (
                          <Chip
                            key={b.id}
                            label={
                              <>
                                {b.label}
                                {lockedDouble ? " (default)" : ""}
                              </>
                            }
                            selected={selected}
                            disabled={lockedDouble && selected}
                            onClick={() => {
                              if (lockedDouble) return;
                              onChangeBed(n, currentBed === b.id ? null : b.id);
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {(onChangeVacant || onChangeEarlyCheckIn || onChangeStayoverOut) && (
                  <div className="flex items-start gap-2">
                    <div className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground pt-1.5">
                      Flags
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 flex-1 min-w-0">
                      {onChangeVacant && (
                        <Chip
                          label={
                            <span className="inline-flex items-center gap-1">
                              <DoorOpen className="h-3.5 w-3.5" />
                              Vacant
                            </span>
                          }
                          selected={!!room.guest_vacated}
                          onClick={() => onChangeVacant(n, !room.guest_vacated)}
                        />
                      )}
                      {onChangeEarlyCheckIn && (
                        <Chip
                          label={
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              Early
                            </span>
                          }
                          selected={!!room.early_check_in}
                          onClick={() =>
                            onChangeEarlyCheckIn(n, !room.early_check_in)
                          }
                        />
                      )}
                      {onChangeStayoverOut && (
                        <Chip
                          label={
                            <span className="inline-flex items-center gap-1">
                              <Footprints className="h-3.5 w-3.5" />
                              Out
                            </span>
                          }
                          selected={!!room.stayover_out}
                          onClick={() =>
                            onChangeStayoverOut(n, !room.stayover_out)
                          }
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}