// Three side-by-side room info tiles (DND photos / lost property / maintenance)
// with the expandable detail for the active tile underneath.
// Shared by the reception room view and the room hub sheet.
import type { RefObject } from "react";
import { Camera, PackageSearch, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { PhotoAttachments } from "@/components/entry-photos";
import { DndDoorPhoto } from "@/components/dnd-door-photo";
import type { LostPropertyLite, MaintenanceRequest } from "@/lib/app-types";

export type RoomInfoTab = "dnd" | "lp" | "maint";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export function RoomInfoTiles({
  roomNumber,
  hasDnd,
  openMaint,
  openLp,
  active,
  onToggle,
  expandedRef,
}: {
  roomNumber: number;
  hasDnd: boolean;
  openMaint: MaintenanceRequest[];
  openLp: LostPropertyLite[];
  active: RoomInfoTab | null;
  onToggle: (tab: RoomInfoTab) => void;
  expandedRef?: RefObject<HTMLDivElement | null>;
}) {
  if (!hasDnd && openMaint.length === 0 && openLp.length === 0) return null;

  const tile = (
    tab: RoomInfoTab,
    label: string,
    count: number | null,
    Icon: typeof Wrench,
    base: string,
    on: string,
  ) => (
    <button
      type="button"
      onClick={() => onToggle(tab)}
      aria-pressed={active === tab}
      className={cn(
        "flex flex-1 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border p-2 text-center text-[11px] font-semibold uppercase tracking-wide shadow-sm transition-colors active:scale-[0.97]",
        base,
        active === tab ? on : "",
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="leading-tight break-words">{label}</span>
      {count !== null && <span className="text-sm tabular-nums">{count}</span>}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-row gap-2">
        {hasDnd &&
          tile(
            "dnd",
            "DND photos",
            null,
            Camera,
            "border-sky-400/60 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
            "ring-2 ring-sky-500/60",
          )}
        {openLp.length > 0 &&
          tile(
            "lp",
            "Lost property",
            openLp.length,
            PackageSearch,
            "border-rose-400/60 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
            "ring-2 ring-rose-500/60",
          )}
        {openMaint.length > 0 &&
          tile(
            "maint",
            "Maintenance",
            openMaint.length,
            Wrench,
            "border-orange-400/60 bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
            "ring-2 ring-orange-500/60",
          )}
      </div>
      <div ref={expandedRef}>
        {active === "dnd" && hasDnd && <DndDoorPhoto roomNumber={roomNumber} />}
        {active === "maint" && openMaint.length > 0 && (
          <div className="space-y-2 rounded-xl border border-orange-400/60 bg-orange-50 dark:bg-orange-950/40 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-300">
              <Wrench className="h-3.5 w-3.5" />
              Open maintenance ({openMaint.length})
            </p>
            <ul className="space-y-1.5">
              {openMaint.map((m) => (
                <li key={m.id} className="rounded bg-background/70 p-2 text-sm">
                  <div className="whitespace-pre-wrap break-words">{m.message}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {m.created_by_username ?? "Unknown"} · {fmt(m.created_at)}
                  </div>
                  {Array.isArray(m.photo_paths) && m.photo_paths.length > 0 && (
                    <div className="mt-2">
                      <PhotoAttachments
                        kind="maintenance"
                        entryId={m.id}
                        paths={m.photo_paths}
                        canEdit={false}
                        onChange={() => {}}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {active === "lp" && openLp.length > 0 && (
          <div className="space-y-2 rounded-xl border border-rose-400/60 bg-rose-50 dark:bg-rose-950/40 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
              <PackageSearch className="h-3.5 w-3.5" />
              Lost property ({openLp.length})
            </p>
            <ul className="space-y-1.5">
              {openLp.map((lp) => (
                <li key={lp.id} className="rounded bg-background/70 p-2 text-sm">
                  <div className="whitespace-pre-wrap break-words">{lp.message}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Logged {fmt(lp.created_at)}
                  </div>
                  {Array.isArray(lp.photo_paths) && lp.photo_paths.length > 0 && (
                    <div className="mt-2">
                      <PhotoAttachments
                        kind="lost_property"
                        entryId={lp.id}
                        paths={lp.photo_paths}
                        canEdit={false}
                        onChange={() => {}}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
