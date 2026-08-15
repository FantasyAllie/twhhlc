// Room tiles for the home grid. JSX moved verbatim from src/routes/app.tsx
// (stage 5 of the staged refactor); colour/label rules live in @/lib/rooms.
import { memo } from "react";
import { AlertCircle, Check, DoorOpen, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Room } from "@/lib/app-types";
import {
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
};

const TILE_CLASS =
  "relative overflow-hidden rounded-lg border text-xs sm:text-sm md:text-base font-medium transition-colors tabular-nums flex flex-col justify-between aspect-[5/4] p-1.5 md:p-2.5 pt-2 md:pt-3 text-left";

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
}: BaseProps) {
  const flags = resolveRoomStatusFlags(room, statusIds);
  const isStaffRoom = flags.isStaff;
  // Done marker reflects housekeeping completion. Hide it only for rooms
  // that were never entered: DND, Service Declined (NR), ROS, or Staff.
  // Regular stayovers are still serviced, so they keep the marker.
  const isDoneState = state === "done" || state === "complete";
  const showDoneMark =
    (isDoneState || !!room?.done) &&
    !isNR && !flags.isDnd && !flags.isRos && !isStaffRoom;
  const meta = computeTileMeta({
    flags,
    state,
    isNR,
    hasLinenCount,
    earlyCheckIn: !!room?.early_check_in,
    role: "reception",
  });

  return (
    <button
      type="button"
      disabled={isStaffRoom}
      onClick={onClick}
      className={cn(
        TILE_CLASS,
        isOpen && !isStaffRoom && "ring-2 ring-ring border-transparent bg-accent",
        isStaffRoom && "opacity-90",
      )}
      style={
        isOpen
          ? undefined
          : { backgroundColor: meta.bg, color: meta.fg, borderColor: meta.accent, borderTopWidth: 3 }
      }
      aria-label={`Room ${n} ${meta.label}${isStaffRoom ? " staff" : ""}`}
    >
      {!isStaffRoom && (
        <>
          {showDoneMark && (
            <Check
              aria-hidden="true"
              strokeWidth={3}
              className="pointer-events-none absolute inset-0 m-auto h-[80%] w-[80%] opacity-40"
              style={{ color: meta.accent }}
            />
          )}
          <span className="text-sm sm:text-base font-bold leading-none inline-flex items-center gap-1">
            {n}
            {flags.isDnd && (
              <>
                <span aria-hidden className="text-sm sm:text-base font-bold leading-none opacity-70">-</span>
                <span aria-label="DND" className="text-sm sm:text-base font-bold leading-none">DND</span>
              </>
            )}
            {isNR && (
              <>
                <span aria-hidden className="text-sm sm:text-base font-bold leading-none opacity-70">-</span>
                <span aria-label="Not Required" className="text-sm sm:text-base font-bold leading-none">NR</span>
              </>
            )}
          </span>
          <span className="text-[9px] sm:text-[10px] md:text-xs font-medium leading-none opacity-90 whitespace-pre-line pr-4">
            {meta.label}
          </span>
        </>
      )}
      {isStaffRoom && (
        <>
          <span className="text-sm sm:text-base font-bold leading-none">{n}</span>
          <span className="text-[9px] sm:text-[10px] md:text-xs font-medium leading-none opacity-90">Staff</span>
        </>
      )}
      {(hasMessage || !!room?.housekeeping_note) && !isStaffRoom && (
        <span
          aria-label="Housekeeping note"
          className={cn(
            "absolute right-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-background",
            room?.guest_vacated ? "top-5" : "top-1",
          )}
        />
      )}
      {room?.needs_maintenance && !isStaffRoom && (
        <Wrench
          aria-label="Maintenance"
          className="absolute bottom-0.5 right-0.5 h-3 w-3 text-amber-600 dark:text-amber-400"
        />
      )}
      {room?.guest_vacated && !isStaffRoom && (
        <DoorOpen
          aria-label="Guest vacated"
          className="absolute top-0.5 right-0.5 h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
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
  done,
}: BaseProps & { done: boolean }) {
  const flags = resolveRoomStatusFlags(room, statusIds);
  const isStaff = flags.isStaff;
  const meta = computeTileMeta({
    flags,
    state,
    isNR,
    hasLinenCount,
    earlyCheckIn: !!room?.early_check_in,
    role: "housekeeping",
  });
  const isDone = state === "done" || state === "complete";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(TILE_CLASS, isOpen && "ring-2 ring-ring border-transparent bg-accent")}
      style={
        isOpen
          ? undefined
          : isStaff
            ? { backgroundColor: "var(--room-staff)", color: "var(--room-staff-fg)", borderColor: "var(--room-staff-accent)", borderTopWidth: 3 }
            : { backgroundColor: meta.bg, color: meta.fg, borderColor: meta.accent, borderTopWidth: 3 }
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
      <span className="text-sm sm:text-base font-bold leading-none inline-flex items-center gap-1">
        {n}
        {!isStaff && isDone && <Check aria-label="Done" className="h-3.5 w-3.5 opacity-80" />}
        {flags.isDnd && !isStaff && (
          <span aria-label="DND" className="text-sm sm:text-base font-bold leading-none">DND</span>
        )}
        {isNR && !isStaff && (
          <span aria-label="Not Required" className="text-sm sm:text-base font-bold leading-none">NR</span>
        )}
      </span>
      <span className="text-[9px] sm:text-[10px] md:text-xs font-medium leading-none opacity-90 whitespace-pre-line pr-4">
        {isStaff ? "Staff" : meta.label}
      </span>
      {hasMessage && (
        <span
          aria-label="Message"
          className={cn(
            "absolute right-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-background",
            room?.guest_vacated ? "top-5" : "top-1",
          )}
        />
      )}
      {room?.needs_maintenance && (
        <Wrench
          aria-label="Maintenance"
          className="absolute bottom-0.5 right-0.5 h-3 w-3 text-amber-600 dark:text-amber-400"
        />
      )}
      {room?.guest_vacated && (
        <span
          aria-label="Guest vacated"
          className="absolute top-0.5 right-0.5 rounded-sm bg-emerald-600 px-1 py-px text-[8px] font-bold leading-none tracking-wide text-white shadow-sm dark:bg-emerald-500 dark:text-emerald-950"
        >
          Vacant
        </span>
      )}
    </button>
  );
}
