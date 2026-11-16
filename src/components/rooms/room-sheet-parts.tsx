// The room view's top (RoomSheetParts.swift / .kt): the bed, guests and
// checked-out line that's always in view, then the Linen / Status / Room info
// tabs. Status ends with a summary of the room's flags and open jobs, which
// opens Room info.
import type { ReactNode } from "react";
import { BedDouble, Users, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { playClick } from "@/lib/click-sound";
import { guestsLabel } from "@/lib/home-list";
import { FlagIcon, FLAG_COLORS, useRoomFlags } from "@/lib/room-flags";
import type { Room } from "@/lib/app-types";

/** "Set as: King · 2 guests · Out": always in view, above the tabs. */
export function RoomSummaryStrip({ bed, guests, checkedOut }: { bed: string | null; guests: number | null; checkedOut: boolean }) {
  if (!bed && !guests && !checkedOut) return null;
  return (
    <div className="mb-3 flex items-center gap-4 rounded-2xl bg-[#ECE8F7] px-3.5 py-2.5 text-[15px] font-bold text-foreground dark:bg-[#242040] max-lg:mb-2">
      {(bed || guests) && (
        <span className="flex items-center gap-1.5">
          <BedDouble aria-hidden className="h-5 w-5 text-[#2F2860] dark:text-[#B9AEE6]" />Set as: {bed ?? "Unknown"}
        </span>
      )}
      {guests ? (
        <span className="flex items-center gap-1.5">
          <Users aria-hidden className="h-5 w-5 text-[#2F2860] dark:text-[#B9AEE6]" />{guestsLabel(guests)}
        </span>
      ) : null}
      {checkedOut && (
        <span aria-label="Checked out" className="ml-auto flex items-center gap-1.5 text-[13px] text-emerald-700 dark:text-emerald-400">
          <span aria-hidden className="h-2 w-2 rounded-full bg-emerald-600" />Out
        </span>
      )}
    </div>
  );
}

export type RoomTabKey = "linen" | "status" | "hub";

/** Linen, Status and Room info. `selected` is null while editing the room's defaults. */
export function RoomTabs({
  selected, tabs, onSelect, hubIndicator,
}: {
  selected: RoomTabKey | null;
  tabs: RoomTabKey[];
  onSelect: (tab: RoomTabKey) => void;
  /** Dots on Room info (pins waiting, a note, maintenance). */
  hubIndicator?: ReactNode;
}) {
  const labels: Record<RoomTabKey, string> = { linen: "Linen", status: "Status", hub: "Room info" };
  return (
    <div role="tablist" aria-label="Room views" className="grid min-w-0 flex-1 rounded-xl bg-muted p-1" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={selected === tab}
          onClick={() => { playClick(); onSelect(tab); }}
          className={cn(
            "relative h-9 truncate rounded-lg px-1 text-[13px] transition-colors sm:px-2 sm:text-sm",
            selected === tab ? "bg-card font-semibold text-foreground shadow-sm" : "font-medium text-muted-foreground hover:text-foreground",
          )}
        >
          {labels[tab]}
          {tab === "hub" && hubIndicator}
        </button>
      ))}
    </div>
  );
}

/** At the end of Status: the room's flags and open jobs, tapping through to Room info. */
export function RoomInfoSummary({
  room, n, openJobs, onShowInfo,
}: {
  room: Room | undefined;
  n: number;
  openJobs: string[];
  onShowInfo?: () => void;
}) {
  const { flags, isOn } = useRoomFlags();
  const active = flags.filter((d) => isOn(room, n, d));
  if (active.length === 0 && openJobs.length === 0) return null;
  const body = (
    <>
      <span className="flex items-center justify-between text-xs font-bold tracking-wide text-[#8A4B0C] dark:text-[#F2A246]">
        ROOM INFO{onShowInfo && <span className="font-normal">See all ›</span>}
      </span>
      {active.length > 0 && (
        <span className="flex flex-wrap gap-x-3 gap-y-1">
          {active.map((d) => (
            <span key={d.key} className="flex items-center gap-1.5 text-sm font-semibold">
              <FlagIcon def={d} className={cn("h-4 w-4", (FLAG_COLORS[d.color] ?? FLAG_COLORS.slate).text)} />
              {d.key === "dog_box" ? "Dog Box Required" : d.label}
            </span>
          ))}
        </span>
      )}
      {openJobs.map((job, i) => (
        <span key={i} className="flex items-center gap-2 truncate text-sm">
          <Wrench aria-hidden className="h-4 w-4 shrink-0 text-orange-600 dark:text-orange-400" />{job}
        </span>
      ))}
    </>
  );
  const box = "flex w-full flex-col gap-1.5 rounded-2xl border border-[#EED3AE] bg-[#FBF1E3] px-3.5 py-2.5 text-left text-foreground dark:border-[#5A4426] dark:bg-[#2E2416]";
  return onShowInfo ? (
    <button type="button" onClick={() => { playClick(); onShowInfo(); }} className={box}>{body}</button>
  ) : (
    <div className={box}>{body}</div>
  );
}
