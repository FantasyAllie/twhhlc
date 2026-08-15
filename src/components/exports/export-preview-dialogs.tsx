import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
export type OverwriteKind = "totals" | "rejects" | "room_status" | "maintenance" | "fnb_totals";

import type {
  RoomCount,
  RoomExtra,
  RoomStatusRow,
  SnapshotRow,
  TemplateItem,
} from "@/lib/app-types";

type Props = {
  // Linen totals export
  exportOpen: boolean;
  setExportOpen: (o: boolean) => void;
  template: TemplateItem[];
  extras: RoomExtra[];
  counts: RoomCount[];

  // Room status sheet export
  roomStatusExportOpen: boolean;
  setRoomStatusExportOpen: (o: boolean) => void;
  computeRoomStatus: () => { rows: RoomStatusRow[] };
  printRoomStatus: (rows: RoomStatusRow[], date: Date) => void;

  // Rejects export
  rejectExportOpen: boolean;
  setRejectExportOpen: (o: boolean) => void;
  computeRejectTotals: () => { rows: SnapshotRow[]; grand: number };

  // Overwrite confirmation
  confirmOverwrite: { kind: OverwriteKind } | null;
  setConfirmOverwrite: (v: { kind: OverwriteKind } | null) => void;
  proceedExport: (kind: OverwriteKind) => Promise<void> | void;

  printTotals: (
    rows: SnapshotRow[],
    grand: number,
    date: Date,
    kind?: "totals" | "rejects" | "fnb_totals" | "delivery",
    subheading?: string,
    footer?: string,
  ) => void;
};

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  } catch {
    toast.error("Copy failed");
  }
}

function overwriteCopy(kind: OverwriteKind | undefined) {
  const label =
    kind === "rejects"
      ? "A rejects export"
      : kind === "room_status"
      ? "A room status export"
      : kind === "maintenance"
      ? "A maintenance list export"
      : kind === "fnb_totals"
      ? "An F&B linen export"
      : "A linen export";
  return `${label} already exists for today. Continuing will overwrite today's last history item. Please use the history feature to print previous exports. Would you like to continue with your export?`;
}

export function ExportPreviewDialogs({
  exportOpen,
  setExportOpen,
  template,
  extras,
  counts,
  roomStatusExportOpen,
  setRoomStatusExportOpen,
  computeRoomStatus,
  printRoomStatus,
  rejectExportOpen,
  setRejectExportOpen,
  computeRejectTotals,
  confirmOverwrite,
  setConfirmOverwrite,
  proceedExport,
  printTotals,
}: Props) {
  return (
    <>
      {/* Linen totals export */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-w-md w-[calc(100vw-1.5rem)] sm:w-full p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Export totals</DialogTitle>
            <DialogDescription>
              Totals across all rooms, grouped by item name. Please only export once. To reprint a
              previous export, use the History feature
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const totals = new Map<string, number>();
            const nameFor = (c: RoomCount) =>
              c.item_kind === "template"
                ? template.find((t) => t.id === c.item_id)?.name
                : extras.find((e) => e.id === c.item_id)?.name;
            for (const c of counts) {
              if (c.count <= 0) continue;
              const raw = nameFor(c);
              if (!raw) continue;
              const key = raw.trim();
              if (!key) continue;
              totals.set(key, (totals.get(key) ?? 0) + c.count);
            }
            const rows = Array.from(totals.entries()).sort((a, b) =>
              a[0].localeCompare(b[0], undefined, { sensitivity: "base" }),
            );
            const grand = rows.reduce((s, [, n]) => s + n, 0);
            const text = rows.map(([n, c]) => `${n}: ${c}`).join("\n");
            if (rows.length === 0) {
              return <p className="text-sm text-muted-foreground py-4">No counted items yet.</p>;
            }
            return (
              <div className="space-y-4">
                <ul className="divide-y rounded-md border">
                  {rows.map(([name, count]) => (
                    <li key={name} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="truncate pr-3">{name}</span>
                      <span className="font-mono font-semibold tabular-nums">{count}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {rows.length} item{rows.length === 1 ? "" : "s"}
                  </span>
                  <span className="font-medium">Total: {grand}</span>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      printTotals(
                        rows.map(([name, count]) => ({ name, count })),
                        grand,
                        new Date(),
                      )
                    }
                  >
                    Print
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void copy(text)}>
                    Copy
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Room status sheet */}
      <Dialog open={roomStatusExportOpen} onOpenChange={setRoomStatusExportOpen}>
        <DialogContent className="max-w-3xl w-[calc(100vw-1.5rem)] sm:w-full p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Room Status Sheet</DialogTitle>
            <DialogDescription>
              Current Room Status and Bed Set As selections across all rooms.
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const { rows } = computeRoomStatus();
            if (rows.length === 0) {
              return <p className="text-sm text-muted-foreground py-4">No rooms configured yet.</p>;
            }
            const half = Math.ceil(rows.length / 2);
            const renderTable = (list: RoomStatusRow[]) => (
              <table className="w-full text-sm border-collapse">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-2 py-1 border">Room</th>
                    <th className="text-left px-2 py-1 border">Status</th>
                    <th className="text-left px-2 py-1 border">Set As</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => (
                    <tr key={r.room}>
                      <td className="px-2 py-1 border font-mono tabular-nums">{r.room}</td>
                      <td className="px-2 py-1 border">{r.status}</td>
                      <td className="px-2 py-1 border">{r.bed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60dvh] overflow-y-auto">
                  {renderTable(rows.slice(0, half))}
                  {renderTable(rows.slice(half))}
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => printRoomStatus(rows, new Date())}
                  >
                    Print
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Rejects export */}
      <Dialog open={rejectExportOpen} onOpenChange={setRejectExportOpen}>
        <DialogContent className="max-w-md w-[calc(100vw-1.5rem)] sm:w-full p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Export rejects</DialogTitle>
            <DialogDescription>Totals of linen rejected as dirty before use.</DialogDescription>
          </DialogHeader>
          {(() => {
            const { rows, grand } = computeRejectTotals();
            const text = rows.map((r) => `${r.name}: ${r.count}`).join("\n");
            if (rows.length === 0) {
              return <p className="text-sm text-muted-foreground py-4">No rejects tallied yet.</p>;
            }
            return (
              <div className="space-y-4">
                <ul className="divide-y rounded-md border">
                  {rows.map((r) => (
                    <li
                      key={r.name}
                      className="flex items-center justify-between px-3 py-2 text-sm"
                    >
                      <span className="truncate pr-3">{r.name}</span>
                      <span className="font-mono font-semibold tabular-nums">{r.count}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {rows.length} item{rows.length === 1 ? "" : "s"}
                  </span>
                  <span className="font-medium">Total: {grand}</span>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => printTotals(rows, grand, new Date(), "rejects")}
                  >
                    Print
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void copy(text)}>
                    Copy
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Overwrite confirmation */}
      <Dialog
        open={confirmOverwrite !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmOverwrite(null);
        }}
      >
        <DialogContent className="max-w-md w-[calc(100vw-1.5rem)] sm:w-full p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Overwrite today's export?</DialogTitle>
            <DialogDescription>{overwriteCopy(confirmOverwrite?.kind)}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setConfirmOverwrite(null)}>
              No
            </Button>
            <Button
              onClick={async () => {
                const kind = confirmOverwrite?.kind;
                setConfirmOverwrite(null);
                if (kind) await proceedExport(kind);
              }}
            >
              Yes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
