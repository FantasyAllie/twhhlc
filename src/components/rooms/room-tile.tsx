// Room tiles for the home grid. JSX moved verbatim from src/routes/app.tsx
// (stage 5 of the staged refactor); colour/label rules live in @/lib/rooms.
import { memo, useRef } from "react";
import { AlertCircle, Check, Dog, DoorOpen, Footprints, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { playClick } from "@/lib/click-sound";
import type { Room } from "@/lib/app-types";
import {
  bedCode,
  computeTileMeta,
  resolveRoomStatusFlags,
  type RoomStatusIds,
  type RoomTileState,
} from "@/lib/rooms";

type BaseProps = {
  n: number;
  room: Room | undefined;
  statusIds: RoomStatusIds;
  state: RoomTileState;
  isNR: boolean;
  hasLinenCount: boolean;
  isOpen: boolean;
  hasMessage: boolean;
  onClick: () => void;
  /** Hold the tile for one second to jump straight to the status panel. */
  onLongPress?: () => void;
  bedLabel?: string | null;
};

const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE = 10;

/** Press-and-hold handlers that suppress the click that would follow. */
function useLongPress(onLongPress?: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const origin = useRef<{ x: number; y: number } | null>(null);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  if (!onLongPress) {
    return { handlers: {}, consumeClick: () => false };
  }

  return {
    handlers: {
      onPointerDown: (e: React.PointerEvent) => {
        fired.current = false;
        origin.current = { x: e.clientX, y: e.clientY };
        clear();
        timer.current = setTimeout(() => {
          fired.current = true;
          playClick();
          onLongPress();
        }, LONG_PRESS_MS);
      },
      // Scrolling or swiping across the grid must not count as a hold.
      onPointerMove: (e: React.PointerEvent) => {
        const from = origin.current;
        if (!from || !timer.current) return;
        if (Math.abs(e.clientX - from.x) > MOVE_TOLERANCE || Math.abs(e.clientY - from.y) > MOVE_TOLERANCE) {
          clear();
        }
      },
      onPointerUp: clear,
      onPointerLeave: clear,
      onPointerCancel: clear,
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    },
    consumeClick: () => {
      if (!fired.current) return false;
      fired.current = false;
      return true;
    },
  };
}


// Material "Surface Variant" tile: tonal filled container, hairline border,
// soft elevation, and a press state layer instead of a heavy accent border.
const TILE_CLASS =
  "@container relative overflow-hidden rounded-xl border text-xs sm:text-sm md:text-base font-medium shadow-elevation-2 transition-[transform,box-shadow,background-color] duration-150 active:scale-[0.97] active:shadow-none tabular-nums flex flex-col justify-between aspect-[5/4] p-2 md:p-2.5 text-left select-none touch-callout-none";

// Corner badges: icon-only on narrow tiles, icon + word once the tile itself is
// wide enough (container query, so it follows tile size rather than screen size).
const BADGE_CLASS =
  "inline-flex max-w-full items-center gap-0.5 rounded-full px-1 @[120px]:px-1.5 py-0.5 text-[8px] font-bold leading-none tracking-wide shadow-sm";

// Tiles re-render only when their own data changes. onClick is an inline
// closure over the room number, so it's excluded from the comparison, and
// statusIds is compared by value rather than identity.
function sameStatusIds(a: RoomStatusIds, b: RoomStatusIds) {
  const ka = Object.keys(a) as (keyof RoomStatusIds)[];
  const kb = Object.keys(b) as (keyof RoomStatusIds)[];
  if (ka.length !== kb.length) return false;
  return ka.every((k) => a[k] === b[k]);
}

function tilePropsEqual<T extends BaseProps>(prev: T, next: T) {
  const keys = Object.keys(next) as (keyof T)[];
  return keys.every((k) => {
    if (k === "onClick" || k === "onLongPress") return true;
    if (k === "statusIds") {
      return sameStatusIds(prev.statusIds, next.statusIds);
    }
    return prev[k] === next[k];
  });
}

export const ReceptionRoomTile = memo(ReceptionRoomTileBase, tilePropsEqual);
export const HousekeepingRoomTile = memo(HousekeepingRoomTileBase, tilePropsEqual);

function ReceptionRoomTileBase({
  n,
  room,
  statusIds,
  state,
  isNR,
  hasLinenCount,
  isOpen,
  hasMessage,
  onClick,
  onLongPress,
  bedLabel,
}: BaseProps) {
  const longPress = useLongPress(onLongPress);
  const flags = resolveRoomStatusFlags(room, statusIds);
  const isStaffRoom = flags.isStaff;
  // Done marker reflects HOUSEKEEPING completion only (room.done) — reception's
  // own done flag must not light it up. Hidden for rooms that are never
  // serviced: DND, Service Declined (NR), ROS, Staff, or Dirty.
  const showDoneMark =
    !!room?.done &&
    !isNR && !flags.isDnd && !flags.isRos && !isStaffRoom && !flags.isDirty;
  const meta = computeTileMeta({
    flags,
    state,
    isNR,
    hasLinenCount,
    earlyCheckIn: !!room?.early_check_in,
    lateCheckout: !!room?.late_checkout,
    stayoverOut: !!room?.stayover_out,
    role: "reception",
  });

  return (
    <button
      type="button"
      disabled={isStaffRoom}
      {...longPress.handlers}
      onClick={() => {
        if (longPress.consumeClick()) return;
        onClick();
      }}

      className={cn(
        TILE_CLASS,
        isOpen && !isStaffRoom && "ring-2 ring-ring border-transparent bg-accent",
        isStaffRoom && "opacity-90",
      )}
      style={
        isOpen
          ? undefined
          : { backgroundColor: meta.bg, color: meta.fg, borderColor: meta.accent }
      }
      aria-label={`Room ${n} ${meta.label}${isStaffRoom ? " staff" : ""}`}
    >
      {!isStaffRoom && (
        <>
          {showDoneMark && (
            <Check
              aria-hidden="true"
              strokeWidth={2}
              className="pointer-events-none absolute inset-0 m-auto h-[80%] w-[80%] opacity-25"
              style={{ color: meta.accent }}
            />
          )}
          <div className="flex flex-col items-start gap-0.5 pr-7 @[120px]:pr-12">
            <span className="text-sm sm:text-base font-bold leading-none inline-flex min-w-0 items-center gap-1">
              {n}
            </span>
            {(flags.isDnd || isNR) && (
              <span className="text-sm sm:text-base font-bold leading-none">
                {flags.isDnd && <span aria-label="DND">DND</span>}
                {isNR && <span aria-label="Not Required">NR</span>}
              </span>
            )}
          </div>
          <span className="text-[9px] sm:text-[10px] md:text-xs font-bold uppercase tracking-tight leading-tight opacity-80 whitespace-pre-line pr-5">
            {bedLabel ? `${meta.label} - ${bedCode(bedLabel)}` : meta.label}
          </span>
        </>
      )}
      {isStaffRoom && (
        <>
          <span className="text-sm sm:text-base font-bold leading-none">{n}</span>
          <span className="text-[9px] sm:text-[10px] md:text-xs font-medium leading-none opacity-90">Staff</span>
        </>
      )}
      {!isStaffRoom && (
        <span className="absolute top-1.5 right-1.5 flex max-w-[42%] flex-col items-end gap-1">
          {(hasMessage || !!room?.housekeeping_note) && (
            <span
              aria-label="Housekeeping note"
              className="h-2 w-2 rounded-full bg-amber-500 ring-2 ring-background"
            />
          )}
          {room?.guest_vacated && (
            <DoorOpen
              aria-label="Guest vacated"
              className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
            />
          )}
          {room?.stayover_out && !room?.done && (
            <Footprints
              aria-label="Stayover guest out - room empty"
              className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400"
            />
          )}
          {room?.dog_box && (
            <span
              aria-label="Dog box needed"
              className={BADGE_CLASS + " bg-violet-600 text-white dark:bg-violet-500 dark:text-violet-950"}
            >
              <Dog aria-hidden className="h-2.5 w-2.5 shrink-0" />
              <span className="hidden @[120px]:inline">Dog</span>
            </span>
          )}
        </span>
      )}
      {room?.needs_maintenance && !isStaffRoom && (
        <Wrench
          aria-label="Maintenance"
          className="absolute bottom-1.5 right-1.5 h-3 w-3 text-amber-600 dark:text-amber-400"
        />
      )}


    </button>
  );
}

function HousekeepingRoomTileBase({
  n,
  room,
  statusIds,
  state,
  isNR,
  hasLinenCount,
  isOpen,
  hasMessage,
  onClick,
  onLongPress,
  done,
}: BaseProps & { done: boolean }) {
  const longPress = useLongPress(onLongPress);
  const flags = resolveRoomStatusFlags(room, statusIds);
  const isStaff = flags.isStaff;
  const meta = computeTileMeta({
    flags,
    state,
    isNR,
    hasLinenCount,
    earlyCheckIn: !!room?.early_check_in,
    lateCheckout: !!room?.late_checkout,
    stayoverOut: !!room?.stayover_out,
    role: "housekeeping",
  });
  const isDone = state === "done" || state === "complete";

  return (
    <button
      type="button"
      {...longPress.handlers}
      onClick={() => {
        if (longPress.consumeClick()) return;
        onClick();
      }}
      className={cn(TILE_CLASS, isOpen && "ring-2 ring-ring border-transparent bg-accent")}
      style={
        isOpen
          ? undefined
          : isStaff
            ? { backgroundColor: "var(--room-staff)", color: "var(--room-staff-fg)", borderColor: "var(--room-staff-accent)" }
            : { backgroundColor: meta.bg, color: meta.fg, borderColor: meta.accent }
      }
      aria-pressed={done}
      aria-expanded={isOpen}
      aria-label={`Room ${n} ${isStaff ? "staff" : meta.label}`}
    >
      {flags.isDirty && !isStaff && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-6xl md:text-7xl opacity-15 leading-none"
        >
          💩
        </span>
      )}
      {!isStaff && !flags.isRos && !flags.isStayover && !flags.isDnd && isDone && (!room?.reception_bed_id || !flags.hasStatus) && (
        <AlertCircle
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 m-auto h-[80%] w-[80%] opacity-30"
          style={{ color: meta.accent }}
        />
      )}
      <span className="text-sm sm:text-base font-bold leading-none inline-flex min-w-0 items-center gap-1 pr-7 @[120px]:pr-12">
        {n}
        {!isStaff && isDone && <Check aria-label="Done" className="h-3.5 w-3.5 shrink-0 opacity-80" />}
        {flags.isDnd && !isStaff && (
          <span aria-label="DND" className="text-sm sm:text-base font-bold leading-none">DND</span>
        )}
        {isNR && !isStaff && (
          <span aria-label="Not Required" className="text-sm sm:text-base font-bold leading-none">NR</span>
        )}
      </span>
      <span className="text-[9px] sm:text-[10px] md:text-xs font-bold uppercase tracking-tight leading-tight opacity-80 whitespace-pre-line pr-5">
        {isStaff ? "Staff" : meta.label}
      </span>
      <span className="absolute top-1.5 right-1.5 flex max-w-[42%] flex-col items-end gap-1">
        {hasMessage && (
          <span aria-label="Message" className="h-2 w-2 rounded-full bg-amber-500 ring-2 ring-background" />
        )}
        {room?.guest_vacated && (
          <span
            aria-label="Guest vacated"
            className={BADGE_CLASS + " bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950"}
          >
            <DoorOpen aria-hidden className="h-2.5 w-2.5 shrink-0" />
            <span className="hidden @[120px]:inline">Vacant</span>
          </span>
        )}
        {room?.stayover_out && !room?.done && !isDone && (
          <span
            aria-label="Stayover guest out - room empty"
            className={BADGE_CLASS + " bg-sky-500 text-white dark:bg-sky-400 dark:text-sky-950"}
          >
            <Footprints aria-hidden className="h-2.5 w-2.5 shrink-0" />
            <span className="hidden @[120px]:inline">Out</span>
          </span>
        )}
        {room?.dog_box && (
          <span
            aria-label="Dog box needed"
            className={BADGE_CLASS + " bg-violet-600 text-white dark:bg-violet-500 dark:text-violet-950"}
          >
            <Dog aria-hidden className="h-2.5 w-2.5 shrink-0" />
            <span className="hidden @[120px]:inline">Dog</span>
          </span>
        )}
      </span>
      {room?.needs_maintenance && (
        <Wrench
          aria-label="Maintenance"
          className="absolute bottom-1.5 right-1.5 h-3 w-3 text-amber-600 dark:text-amber-400"
        />
      )}


    </button>
  );
}
