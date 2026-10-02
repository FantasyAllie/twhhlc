// Export history sheet (recent snapshots grouped by day).
// Extracted verbatim from src/routes/app.tsx.
import { History, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { ExportSnapshot, ExportSnapshotKind } from "@/lib/app-types";

export function HistorySheet({
  open,
  onOpenChange,
  snapshots,
  isFnb,
  setViewingSnapshot,
  removeSnapshot,
  clearAllSnapshots,
  showAll,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  snapshots: ExportSnapshot[];
  isFnb: boolean;
  setViewingSnapshot: (s: ExportSnapshot | null) => void;
  removeSnapshot: (id: string) => void;
  clearAllSnapshots: (kind?: ExportSnapshotKind) => void;
  /** Admins and developers see every department's reports. */
  showAll?: boolean;
}) {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = snapshots.filter((s) => new Date(s.created_at).getTime() >= cutoff);
  const visible = showAll
    ? recent
    : isFnb
    ? recent.filter((s) => s.kind === "fnb_totals")
    : recent.filter((s) => s.kind !== "fnb_totals");
  return (
<Sheet open={open} onOpenChange={onOpenChange}>
   <SheetContent side="bottom" className="overflow-hidden rounded-t-2xl p-4 sm:p-6">
    <SheetHeader className="text-left">
      <SheetTitle className="flex items-center gap-2">
        <History className="h-4 w-4" />
        History
      </SheetTitle>
      <SheetDescription>Recent exports</SheetDescription>
    </SheetHeader>
    <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No exports yet.</p>
      ) : (
        (() => {
          const groups = new Map<string, ExportSnapshot[]>();
          for (const s of visible) {
            const key = new Date(s.created_at).toDateString();
            const list = groups.get(key) ?? [];
            list.push(s);
            groups.set(key, list);
          }
          const days = Array.from(groups.entries());
          return days.map(([day, items]) => (
            <div key={day} className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {new Date(items[0].created_at).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </p>
              {items.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 rounded-xl border bg-background shadow-sm min-h-12 pl-4 pr-1.5"
                >
                  <button
                    type="button"
                    className="flex-1 flex items-center gap-2 text-left text-sm py-2"
                    onClick={() => { onOpenChange(false); setViewingSnapshot(s); }}
                  >
                    <span>
                      {new Date(s.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                    </span>
                    {s.kind === "rejects" && (
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">Rejects</span>
                    )}
                    {(s.kind === "totals" || !s.kind) && (
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">Daily linen</span>
                    )}
                    {s.kind === "totals_range" && (
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">Linen — ranged</span>
                    )}
                    {s.kind === "room_status" && (
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">Room status</span>
                    )}
                    {s.kind === "maintenance" && (
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">Maintenance</span>
                    )}
                    {s.kind === "fnb_totals" && (
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">F&amp;B Linen</span>
                    )}
                    {s.kind === "inventory_rooms" && (
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">Room inventory</span>
                    )}
                    {s.kind === "inventory_cupboards" && (
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">Floor inventory</span>
                    )}
                    {s.kind === "delivery" && (
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">Delivery</span>
                    )}
                    <span className="text-xs text-muted-foreground">({s.grand_total})</span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-destructive"
                    onClick={() => removeSnapshot(s.id)}
                    aria-label="Delete history item"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ));
        })()
      )}
      {visible.length > 0 && (
        <Button
          type="button"
          variant="outline"
          className="w-full text-destructive hover:text-destructive"
          onClick={() => clearAllSnapshots(isFnb ? "fnb_totals" : undefined)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Clear history
        </Button>
      )}
    </div>
  </SheetContent>
</Sheet>
  );
}
