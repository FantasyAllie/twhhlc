// Room tiles for the home grid. JSX moved verbatim from src/routes/app.tsx
// (stage 5 of the staged refactor); colour/label rules live in @/lib/rooms.
import { memo, useLayoutEffect, useRef, useState } from "react";
import { usePolishTiles } from "@/lib/polish";
import { leftDirtyState } from "@/lib/left-dirty";
import { AlertCircle, ArrowLeft, BedDouble, Check, Dog, DoorOpen, Flag, Footprints, Gift, User, Users, Wrench, type LucideIcon } from "lucide-react";
import { cardLabel, guestsLabel } from "@/lib/home-list";
import { cn } from "@/lib/utils";
import { playClick } from "@/lib/click-sound";
import type { Room } from "@/lib/app-types";
import { FLAG_COLORS, FLAG_ICONS, useRoomFlags } from "@/lib/room-flags";
import { useTileIconStyle } from "@/lib/tile-icons";
import { isMattressDue, useMattressInterval } from "@/lib/mattress";
import { RotateCw } from "lucide-react";
import { EXTRA_ICONS, useRoomNeeds } from "@/components/rooms/guest-extras";
import {
  computeTileMeta,
  receptionTileLabel,
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
  /** An open request for your department, or a reply to your pin. */
  pinDot: "reply" | "request" | null;
  /** The room has a maintenance job that isn't done yet. */
  hasOpenMaintenance?: boolean;
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


// The tile's three rows (RoomTile in HomeView.swift, RoomTile in HomeScreen.kt): the
// number (with the bed for reception and the done tick) and, on the right, the pin dot,
// the bed reminder and the checked-out door; the status in the middle; then DND / NR,
// as many flag icons as fit with "+n" for the rest, and the spanner on the right.

type Glyph = { key: string; label: string; Icon: LucideIcon; color: string };

/** The flag icons for a tile or card, in the iPhone's order. Checked out has its own door. */
function useTileGlyphs(room: Room | undefined, n: number): Glyph[] {
  const { flags, isOn } = useRoomFlags();
  const interval = useMattressInterval();
  const needsFor = useRoomNeeds();
  const out: Glyph[] = [];
  for (const d of flags) {
    if ((d.key === "early_check_in" || d.key === "late_checkout") && isOn(room, n, d)) {
      out.push({ key: d.key, label: d.label, Icon: FLAG_ICONS[d.icon] ?? Flag, color: d.color });
    }
  }
  if (room?.stayover_out && !room.done) out.push({ key: "stayover_out", label: "Stayover guest out", Icon: Footprints, color: "sky" });
  if (room?.dog_box) out.push({ key: "dog_box", label: "Dog box needed", Icon: Dog, color: "violet" });
  if (room && !room.done && needsFor(room)?.some((x) => x.extra.kind === "leave" && !x.done)) {
    out.push({ key: "guest_extras", label: "Extras to leave", Icon: Gift, color: "pink" });
  }
  if (isMattressDue(room, interval)) out.push({ key: "mattress", label: "Mattress flip due", Icon: RotateCw, color: "amber" });
  for (const d of flags) {
    if (d.custom && isOn(undefined, n, d)) out.push({ key: d.key, label: d.label, Icon: FLAG_ICONS[d.icon] ?? Flag, color: d.color });
  }
  return out;
}

/** Early check-in and late checkout are left out when the status already says so. */
function withoutRepeats(glyphs: Glyph[], label: string) {
  const lower = label.toLowerCase();
  return glyphs.filter((g) => !(g.key === "early_check_in" && lower.includes("early check"))
    && !(g.key === "late_checkout" && lower.includes("late check")));
}

/** How wide an element is, kept up to date as it resizes. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** As many icons as fit, then "+n" for the rest (TileGlyphs). */
function GlyphRow({ glyphs, colourful }: { glyphs: Glyph[]; colourful: boolean }) {
  const [ref, width] = useWidth<HTMLSpanElement>();
  const per = 15;
  const count = width === 0 || glyphs.length * per <= width ? glyphs.length : Math.max(0, Math.floor((width - 20) / per));
  return (
    <span ref={ref} data-tile-extra className="flex min-w-0 flex-1 items-center gap-[3px] overflow-hidden">
      {glyphs.slice(0, count).map((g) => (
        <g.Icon key={g.key} aria-label={g.label} className={cn("h-3 w-3 shrink-0", colourful && (FLAG_COLORS[g.color] ?? FLAG_COLORS.slate).text)} />
      ))}
      {glyphs.length > count && (
        <span aria-label={`${glyphs.length - count} more`} className="text-[10px] font-extrabold leading-none">+{glyphs.length - count}</span>
      )}
    </span>
  );
}

function TileFace({
  n, room, bedLabel, done, dot, bedReminder, label, marker, maintenance, bg, fg, badge = false,
}: {
  n: number; room: Room | undefined; bedLabel?: string | null; done: boolean;
  dot: "reply" | "request" | "note" | null; bedReminder: boolean; label: string; marker: string | null;
  maintenance: boolean; bg: string; fg: string;
  /** Polish preview: done is a filled badge in the corner rather than a small tick. */
  badge?: boolean;
}) {
  const colourful = useTileIconStyle() === "colourful";
  const glyphs = withoutRepeats(useTileGlyphs(room, n), label);
  const checkedOut = !!room?.guest_vacated && !room?.done && !room?.done_reception;
  return (
    <>
      <span className="flex w-full min-w-0 items-center gap-1">
        <span className="font-number text-sm sm:text-base font-bold leading-none">{n}</span>
        {bedLabel && <span className="min-w-0 truncate text-[9px] sm:text-[10px] md:text-xs font-bold uppercase leading-none opacity-80">- {bedLabel}</span>}
        {done && !badge && <Check aria-label="Done" strokeWidth={3} className="h-3 w-3 shrink-0" />}
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {/* Simple tiles: the spanner sits up here, so it can't be clipped at the bottom. */}
          {maintenance && <Wrench data-tile-simple aria-label="Maintenance" className="h-3 w-3 shrink-0 text-orange-500" />}

          {dot && (
            <span
              data-tile-extra
              aria-label={dot === "reply" ? "New reply to your pin" : dot === "request" ? "Open request" : "Housekeeping note"}
              className={"h-2 w-2 rounded-full ring-2 ring-background " + (dot === "reply" ? "bg-yellow-400" : "bg-orange-500")}
            />
          )}
          {bedReminder && <AlertCircle data-tile-extra aria-label="Bed not set" className="h-3 w-3 opacity-45" />}
          {checkedOut && (
            <DoorOpen data-tile-extra aria-label="Checked out" className={cn("h-3.5 w-3.5", colourful && "text-emerald-600 dark:text-emerald-400")} />
          )}
        </span>
      </span>
      <span className="text-[9px] sm:text-[10px] md:text-xs font-bold uppercase tracking-tight leading-tight opacity-85 whitespace-pre-line">
        {label}
      </span>
      {/* Polish preview: done sits in the bottom corner, clear of the number and bed. */}
      {done && badge && (
        <span aria-label="Done" className="absolute bottom-1.5 right-1.5 grid h-[1.125rem] w-[1.125rem] place-items-center rounded-full" style={{ backgroundColor: fg, color: bg }}>
          <Check aria-hidden strokeWidth={3.5} className="h-3 w-3" />
        </span>
      )}
      <span data-tile-row className="flex h-[15px] w-full min-w-0 items-center gap-[3px]">
        {marker && (
          <span data-tile-marker className="shrink-0 rounded px-1 py-px text-[9px] font-extrabold leading-none" style={{ backgroundColor: fg, color: bg }}>
            {marker}
          </span>
        )}
        <GlyphRow glyphs={glyphs} colourful={colourful} />
        {maintenance && <Wrench data-tile-full aria-label="Maintenance" className="h-3 w-3 shrink-0 text-orange-500" />}
      </span>
    </>
  );
}

// Material "Surface Variant" tile: tonal filled container, hairline border,
// soft elevation, and a press state layer instead of a heavy accent border.
const TILE_CLASS =
  "@container relative overflow-hidden rounded-xl border text-xs sm:text-sm md:text-base font-medium shadow-elevation-2 transition-[transform,box-shadow,background-color] duration-150 active:scale-[0.97] active:shadow-none tabular-nums flex flex-col justify-between aspect-[1.12/1] p-2 md:p-2.5 text-left select-none touch-callout-none";

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
  pinDot,
  hasOpenMaintenance = false,
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
  const checkTones = usePolishTiles();
  // A room marked done shows it, DND and NR included (they're marked done when
  // set), so reception can see it was asked about. Never ROS, Staff or Dirty.
  const showDoneMark =
    (!!room?.done || ((isNR || flags.isDnd) && !!room?.done_reception)) && !flags.isRos && !isStaffRoom && !flags.isDirty;
  const meta = computeTileMeta({
    flags,
    state,
    isNR,
    hasLinenCount,
    earlyCheckIn: !!room?.early_check_in,
    lateCheckout: !!room?.late_checkout,
    stayoverOut: !!room?.stayover_out,
    role: "reception",
    sheetKind: room?.sheet_kind,
    leftDirty: leftDirtyState(room),
    checkTones,
  });
  // Polish preview: reception sees the room's status without "Not started" or
  // "Not checked" (the pale dashed tile already says it isn't done).
  const receptionLabel = checkTones ? receptionTileLabel(meta.label, room) : meta.label;

  return (
    <button
      type="button"
      disabled={isStaffRoom}
      {...longPress.handlers}
      onClick={() => {
        if (longPress.consumeClick()) return;
        onClick();
      }}

      data-room-tile={n}
      data-pending={meta.pending && !isOpen ? "" : undefined}
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
        <TileFace
          n={n}
          room={room}
          bedLabel={bedLabel}
          done={showDoneMark}
          dot={pinDot ?? (room?.housekeeping_note ? "note" : null)}
          bedReminder={false}
          label={receptionLabel}
          badge={checkTones}
          marker={[flags.isDnd && "DND", isNR && "NR"].filter(Boolean).join(" ") || null}
          maintenance={!!room?.needs_maintenance || hasOpenMaintenance}
          bg={meta.bg}
          fg={meta.fg}
        />
      )}
      {isStaffRoom && (
        <>
          <span className="font-number text-sm sm:text-base font-bold leading-none">{n}</span>
          <span className="text-[9px] sm:text-[10px] md:text-xs font-medium uppercase leading-none opacity-90">Staff</span>
        </>
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
  pinDot,
  hasOpenMaintenance = false,
  onClick,
  onLongPress,
  done,
  openTypeLabel,
  openBedLabel,
  openBack,
  openGuests,
}: BaseProps & { done: boolean; openTypeLabel?: string | null; openBedLabel?: string | null; openBack?: boolean; openGuests?: number | null }) {
  const longPress = useLongPress(onLongPress);
  const flags = resolveRoomStatusFlags(room, statusIds);
  const isStaff = flags.isStaff;
  const checkTones = usePolishTiles();
  const meta = computeTileMeta({
    flags,
    state,
    isNR,
    hasLinenCount,
    earlyCheckIn: !!room?.early_check_in,
    lateCheckout: !!room?.late_checkout,
    stayoverOut: !!room?.stayover_out,
    role: "housekeeping",
    sheetKind: room?.sheet_kind,
    leftDirty: leftDirtyState(room),
    checkTones,
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
      data-room-tile={n}
      data-pending={meta.pending && !isOpen ? "" : undefined}
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
      {isOpen ? (
        <>
          <span className="flex w-full min-w-0 items-baseline gap-1.5">
            <span className="font-number text-sm sm:text-base font-bold leading-none">{n}</span>
            {!openBack && openTypeLabel && (
              <span className="min-w-0 truncate text-[9px] sm:text-[10px] md:text-xs font-bold uppercase leading-tight tracking-tight animate-in fade-in duration-200">{openTypeLabel}</span>
            )}
          </span>
          {openBack ? (
            <ArrowLeft aria-label="Back to room" className="h-5 w-5 animate-in fade-in duration-200" />
          ) : (
          <span className="flex w-full min-w-0 flex-col items-start gap-0.5 text-left animate-in fade-in duration-200">
            {openGuests != null && (
              <span
                className="inline-flex shrink-0 items-center gap-1 text-[9px] sm:text-[10px] md:text-xs font-medium uppercase leading-tight opacity-80"
                aria-label={`${openGuests} guests`}
              >
                <User aria-hidden className="h-2.5 w-2.5" />
                {openGuests}
              </span>
            )}
            {(openBedLabel || openGuests != null) && (
              <span className="inline-flex w-full min-w-0 items-center gap-1 text-[9px] sm:text-[10px] md:text-xs font-medium uppercase leading-tight opacity-80">
                <span className="truncate">Set as: {openBedLabel ?? "Unknown"}</span>
              </span>
            )}
          </span>
          )}
        </>
      ) : (
        <TileFace
          n={n}
          room={room}
          done={!isStaff && isDone}
          dot={pinDot}
          // A finished room that still has no bed (or no status) set: a faint reminder.
          bedReminder={!isStaff && !flags.isRos && !flags.isStayover && !flags.isDnd && isDone && (!room?.reception_bed_id || !flags.hasStatus)}
          label={isStaff ? "Staff" : meta.label}
          marker={isStaff ? null : [flags.isDnd && "DND", isNR && "NR"].filter(Boolean).join(" ") || null}
          badge={checkTones}
          maintenance={!!room?.needs_maintenance || hasOpenMaintenance}
          bg={isStaff ? "var(--room-staff)" : meta.bg}
          fg={isStaff ? "var(--room-staff-fg)" : meta.fg}
        />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Home's list view: one room as a card (HomeRoomCard in HomeList.swift / .kt).
// Number, status, then the bed and head count for arriving guests and the
// same badges as the tile, with their labels.

type CardProps = Omit<BaseProps, "isOpen" | "onLongPress" | "bedLabel"> & {
  role: "reception" | "housekeeping";
  /** The bed to make up, for an arriving guest. */
  bed?: string | null;
  guests?: number | null;
  disabled?: boolean;
};

type Chip = { key: string; label: string; Icon: LucideIcon; color: string };

/** A chip: an icon in its own colour (or the text colour, for Calm) beside the label. */
function renderChip(chip: Chip, colourful: boolean) {
  return (
    <span key={chip.key} className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-foreground/[0.07] px-2 py-[3px] text-xs font-semibold">
      <chip.Icon aria-hidden className={cn("h-3.5 w-3.5 shrink-0", colourful && (FLAG_COLORS[chip.color] ?? FLAG_COLORS.slate).text)} />
      {chip.label}
    </span>
  );
}

const plusChip = (n: number) => (
  <span key="plus" aria-label={`${n} more`} className="inline-flex shrink-0 items-center rounded-lg bg-foreground/[0.07] px-2 py-[3px] text-xs font-semibold">+{n}</span>
);

/** One line of chips: as many as fit, then "+n" for the rest (ChipLine in HomeList.swift). */
function ChipLine({ chips, colourful, className }: { chips: Chip[]; colourful: boolean; className?: string }) {
  const [ref, width] = useWidth<HTMLSpanElement>();
  const measure = useRef<HTMLSpanElement>(null);
  const [widths, setWidths] = useState<number[]>([]);
  const signature = chips.map((c) => c.key + c.label).join("|");
  useLayoutEffect(() => {
    const el = measure.current;
    if (el) setWidths([...el.children].map((c) => (c as HTMLElement).getBoundingClientRect().width));
  }, [signature, colourful]);
  const gap = 6;
  const used = (k: number) => widths.slice(0, k).reduce((a, b) => a + b, 0) + gap * Math.max(k - 1, 0);
  let count = chips.length;
  if (width > 0 && widths.length > chips.length && used(chips.length) > width) {
    const plusWidth = widths[chips.length];
    while (count > 0 && used(count) + gap + plusWidth > width) count--;
  }
  if (chips.length === 0) return null;
  return (
    <span ref={ref} className={cn("relative flex min-w-0 items-center gap-1.5 overflow-hidden", className)}>
      {chips.slice(0, count).map((c) => renderChip(c, colourful))}
      {chips.length > count && plusChip(chips.length - count)}
      {/* Measured out of sight, to know how many fit. */}
      <span ref={measure} aria-hidden className="pointer-events-none invisible absolute left-0 top-0 flex gap-1.5">
        {chips.map((c) => renderChip(c, colourful))}
        {plusChip(chips.length)}
      </span>
    </span>
  );
}

/**
 * One room in the list (HomeRoomCard in HomeList.swift): the number (with its tick when
 * done), the bed and guests beside it, the pin dot and spanner on the right; then the
 * status and Checked out; then one line of flags and extras to leave, with "+n" for any
 * that don't fit. Wide cards say "Room 12" and put everything after the number on one line.
 */
export function HomeRoomCard({
  n, room, statusIds, state, isNR, hasLinenCount, pinDot, hasOpenMaintenance = false, onClick, role, bed, guests, disabled,
}: CardProps) {
  const flags = resolveRoomStatusFlags(room, statusIds);
  const checkTones = usePolishTiles();
  const meta = computeTileMeta({
    flags,
    state,
    isNR,
    hasLinenCount,
    earlyCheckIn: !!room?.early_check_in,
    lateCheckout: !!room?.late_checkout,
    stayoverOut: !!room?.stayover_out,
    role,
    sheetKind: room?.sheet_kind,
    leftDirty: leftDirtyState(room),
    checkTones,
  });
  const colourful = useTileIconStyle() === "colourful";
  const needsFor = useRoomNeeds();
  const [cardRef, cardWidth] = useWidth<HTMLButtonElement>();
  const wide = cardWidth >= 500;
  const label = cardLabel(flags.isStaff ? "Staff" : meta.label);
  const isDnd = flags.isDnd;
  const done = role === "reception"
    ? !!room?.done && !isNR && !flags.isDnd && !flags.isRos && !flags.isStaff && !flags.isDirty
    : !flags.isStaff && (state === "done" || state === "complete");
  const checkedOut = !!room?.guest_vacated && !room?.done && !room?.done_reception;
  const maintenance = !!room?.needs_maintenance || hasOpenMaintenance;
  const dot = pinDot ?? (role === "reception" && room?.housekeeping_note ? "request" : null);
  // The room's flags (not the gift: each extra still to leave is named instead).
  const flagChips: Chip[] = withoutRepeats(useTileGlyphs(room, n), meta.label)
    .filter((g) => g.key !== "guest_extras").map((g) => ({ ...g }));
  const extraChips: Chip[] = room && !room.done
    ? (needsFor(room) ?? []).filter((x) => x.extra.kind === "leave" && !x.done).map((x) => ({
        key: `extra-${x.extra.id}`, label: `${x.extra.name} ×${x.quantity}`,
        Icon: (x.extra.icon && EXTRA_ICONS[x.extra.icon]) || Gift, color: "pink",
      }))
    : [];
  const chips = [...flagChips, ...extraChips];
  // The status and Checked out pills wrap onto a second line when the card is too
  // narrow for both, instead of spilling into the next card.
  const pills = (
    <span className="flex min-w-0 max-w-full flex-wrap items-center gap-1.5">
      <span className="max-w-full truncate whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold uppercase"
        style={isDnd ? { backgroundColor: meta.fg, color: meta.bg } : { backgroundColor: meta.bg, color: meta.fg }}>{label}</span>
      {checkedOut && (
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[#1F9D55] px-2 py-1 text-xs font-bold text-white">
          <DoorOpen aria-hidden className="h-3.5 w-3.5" />Checked out
        </span>
      )}
    </span>
  );
  return (
    <button
      ref={cardRef}
      type="button"
      disabled={disabled}
      onClick={() => { playClick(); onClick(); }}
      aria-label={[`Room ${n}`, done && "done", label, checkedOut && "checked out", bed && `set as ${bed}`, guests ? guestsLabel(guests) : null,
        maintenance && "maintenance", ...chips.map((c) => c.label)].filter(Boolean).join(", ")}
      className="flex w-full min-w-0 flex-col gap-2 overflow-hidden rounded-[18px] border bg-card px-3.5 py-3 text-left shadow-sm transition-colors hover:brightness-[0.98] disabled:opacity-90"
      style={isDnd ? { backgroundColor: meta.bg, color: meta.fg, borderColor: meta.accent } : undefined}
    >
      <span className={cn("flex w-full min-w-0 items-center gap-3", !isDnd && "text-card-foreground")}>
        <span className="flex min-w-8 items-center gap-[3px]">
          <span className="font-number text-2xl font-bold leading-none tabular-nums">{wide ? `Room ${n}` : n}</span>
          {done && <Check aria-hidden strokeWidth={3} className="h-4 w-4 shrink-0" />}
        </span>
        {(bed || guests) && (
          <span className="flex min-w-0 items-center gap-3 text-sm font-semibold">
            {bed && <span className="flex items-center gap-1.5 whitespace-nowrap"><BedDouble aria-hidden className="h-[18px] w-[18px] text-[#3D3474] dark:text-[#B9AEE6]" />{bed}</span>}
            {guests ? <span className="flex items-center gap-1.5 whitespace-nowrap"><Users aria-hidden className="h-[18px] w-[18px] text-[#3D3474] dark:text-[#B9AEE6]" />{wide ? guestsLabel(guests) : guests}</span> : null}
          </span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {dot && <span aria-hidden className={"h-2.5 w-2.5 rounded-full " + (dot === "reply" ? "bg-yellow-400" : "bg-orange-500")} />}
          {maintenance && <Wrench aria-hidden className="h-[18px] w-[18px] text-orange-500" />}
        </span>
      </span>
      {wide ? (
        <span className="flex w-full min-w-0 items-center gap-1.5">{pills}<ChipLine chips={chips} colourful={colourful} className="flex-1" /></span>
      ) : (
        <>
          {pills}
          <ChipLine chips={chips} colourful={colourful} className="w-full" />
        </>
      )}
    </button>
  );
}
