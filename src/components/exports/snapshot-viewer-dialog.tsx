// Saved-snapshot viewer dialog (linen totals, room status, maintenance).
// Extracted verbatim from src/routes/app.tsx (stage 5).
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { printMaintenance, printRoomStatus } from "@/lib/exports";
import type {
  ExportSnapshot,
  MaintenanceRow,
  RoomStatusRow,
  SnapshotRow,
} from "@/lib/app-types";

export function SnapshotViewerDialog({
  viewingSnapshot,
  setViewingSnapshot,
  deleteSnapshot,
  printTotals,
}: {
  viewingSnapshot: ExportSnapshot | null;
  setViewingSnapshot: (s: ExportSnapshot | null) => void;
  deleteSnapshot: (id: string) => Promise<void> | void;
  printTotals: (
    rows: SnapshotRow[],
    grand: number,
    when: Date,
    kind?: "totals" | "rejects" | "fnb_totals" | "delivery",
  ) => void;
}) {
  return (
 <Dialog open={!!viewingSnapshot} onOpenChange={(o) => !o && setViewingSnapshot(null)}>
   <DialogContent className="max-w-md w-[calc(100vw-1.5rem)] sm:w-full p-4 sm:p-6">
     <DialogHeader>
       <DialogTitle>
         {viewingSnapshot
           ? new Date(viewingSnapshot.created_at).toLocaleString(undefined, {
               year: "numeric",
               month: "long",
               day: "numeric",
               hour: "numeric",
               minute: "2-digit",
             })
           : "Snapshot"}
       </DialogTitle>
       <DialogDescription>Saved totals from this export.</DialogDescription>
     </DialogHeader>
     {viewingSnapshot && (
        viewingSnapshot.kind === "maintenance" ? (
        <div className="space-y-4">
          {viewingSnapshot.totals.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No rooms in this snapshot.</p>
          ) : (
            <div className="rounded-xl border max-h-[60dvh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 w-16">Room</th>
                    <th className="text-left px-3 py-2">Maintenance note</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewingSnapshot.totals as MaintenanceRow[]).map((r) => (
                    <tr key={r.room} className="border-t align-top">
                      <td className="px-3 py-1.5 font-mono tabular-nums">{r.room}</td>
                      <td className="px-3 py-1.5 whitespace-pre-wrap">{r.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {viewingSnapshot.totals.length} room
              {viewingSnapshot.totals.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={async () => {
                if (!confirm("Delete this snapshot?")) return;
                const id = viewingSnapshot.id;
                setViewingSnapshot(null);
                await deleteSnapshot(id);
              }}
            >
              Delete
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                printMaintenance(
                  new Date(viewingSnapshot.created_at),
                  viewingSnapshot.totals as MaintenanceRow[],
                )
              }
            >
              Print
            </Button>
          </div>
        </div>
        ) : viewingSnapshot.kind === "room_status" ? (
        <div className="space-y-4">
          {viewingSnapshot.totals.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No rooms in this snapshot.</p>
          ) : (
            <div className="rounded-xl border max-h-[60dvh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2">Room</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-left px-3 py-2">Set As</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewingSnapshot.totals as RoomStatusRow[]).map((r) => (
                    <tr key={r.room} className="border-t">
                      <td className="px-3 py-1.5 font-mono tabular-nums">{r.room}</td>
                      <td className="px-3 py-1.5">{r.status}</td>
                      <td className="px-3 py-1.5">{r.bed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {viewingSnapshot.totals.length} room
              {viewingSnapshot.totals.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={async () => {
                if (!confirm("Delete this snapshot?")) return;
                const id = viewingSnapshot.id;
                setViewingSnapshot(null);
                await deleteSnapshot(id);
              }}
            >
              Delete
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                printRoomStatus(
                  viewingSnapshot.totals as RoomStatusRow[],
                  new Date(viewingSnapshot.created_at),
                )
              }
            >
              Print
            </Button>
          </div>
        </div>
        ) : (
        <div className="space-y-4">
         {viewingSnapshot.totals.length === 0 ? (
           <p className="text-sm text-muted-foreground py-4">No items in this snapshot.</p>
         ) : (
           <ul className="divide-y rounded-xl border max-h-[60dvh] overflow-y-auto">
              {(viewingSnapshot.totals as SnapshotRow[]).map((r) => (
               <li
                 key={r.name}
                 className="flex items-center justify-between px-3 py-2 text-sm"
               >
                 <span className="truncate pr-3">{r.name}</span>
                 <span className="font-mono font-semibold tabular-nums">{r.count}</span>
               </li>
             ))}
           </ul>
         )}
         <div className="flex items-center justify-between text-sm">
           <span className="text-muted-foreground">
             {viewingSnapshot.totals.length} item
             {viewingSnapshot.totals.length === 1 ? "" : "s"}
           </span>
           <span className="font-medium">Total: {viewingSnapshot.grand_total}</span>
         </div>
         <div className="flex justify-between gap-2">
           <Button
             variant="ghost"
             size="sm"
             className="text-destructive hover:text-destructive"
             onClick={async () => {
               if (!confirm("Delete this snapshot?")) return;
               const id = viewingSnapshot.id;
               setViewingSnapshot(null);
               await deleteSnapshot(id);
             }}
           >
             Delete
           </Button>
          <div className="flex gap-2">
          <Button
             variant="outline"
             size="sm"
             onClick={async () => {
               try {
                  const text = (viewingSnapshot.totals as SnapshotRow[])
                   .map((r) => `${r.name}: ${r.count}`)
                   .join("\n");
                 await navigator.clipboard.writeText(text);
                 toast.success("Copied to clipboard");
               } catch {
                 toast.error("Copy failed");
               }
             }}
           >
             Copy
           </Button>
          <Button
            variant="outline"
            size="sm"
             onClick={() =>
               printTotals(
                 viewingSnapshot.totals as SnapshotRow[],
                 viewingSnapshot.grand_total,
                 new Date(viewingSnapshot.created_at),
                 viewingSnapshot.kind === "rejects"
                   ? "rejects"
                   : viewingSnapshot.kind === "fnb_totals"
                   ? "fnb_totals"
                   : "totals",
               )
             }
          >
            Print
          </Button>
          </div>
         </div>
       </div>
        )
     )}
   </DialogContent>
 </Dialog>
  );
}
