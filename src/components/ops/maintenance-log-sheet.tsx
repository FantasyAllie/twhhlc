// Maintenance Log sheet (composer + open/completed lists).
// Extracted verbatim from src/routes/app.tsx.
import { Check, ChevronDown, Plus, Settings, Trash2, Wrench, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PhotoAttachments, PhotoComposer } from "@/components/entry-photos";
import type { MaintenanceArea, MaintenanceRequest, Room } from "@/lib/app-types";
import { maintenanceLocation } from "@/lib/app-format";

export function MaintenanceLogSheet({
  open,
  onOpenChange,
  rooms,
  maintenanceRequests,
  maintenanceAreas = [],
  canManageAreas = false,
  onManageAreas,
  hasOpenMaintenance,
  openMaintenanceCount,
  isReception,
  isMaintenance,
  isAdmin,
  authUsername,
  maintenanceComposerOpen,
  setMaintenanceComposerOpen,
  newMaintenanceRoom,
  setNewMaintenanceRoom,
  newMaintenanceText,
  setNewMaintenanceText,
  newMaintenancePhotos,
  setNewMaintenancePhotos,
  submitMaintenanceRequest,
  markMaintenanceDone,
  deleteMaintenanceRequest,
  setMaintenancePhotoPaths,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  rooms: Room[];
  maintenanceRequests: MaintenanceRequest[];
  maintenanceAreas?: MaintenanceArea[];
  canManageAreas?: boolean;
  onManageAreas?: () => void;
  hasOpenMaintenance: boolean;
  openMaintenanceCount: number;
  isReception: boolean;
  isMaintenance: boolean;
  isAdmin: boolean;
  authUsername?: string | null;
  maintenanceComposerOpen: boolean;
  setMaintenanceComposerOpen: (o: boolean) => void;
  newMaintenanceRoom: string;
  setNewMaintenanceRoom: (v: string) => void;
  newMaintenanceText: string;
  setNewMaintenanceText: (v: string) => void;
  newMaintenancePhotos: File[];
  setNewMaintenancePhotos: (f: File[]) => void;
  submitMaintenanceRequest: () => Promise<void> | void;
  markMaintenanceDone: (id: string) => Promise<void> | void;
  deleteMaintenanceRequest: (id: string) => Promise<void> | void;
  setMaintenancePhotoPaths: (id: string, next: string[]) => void;
}) {
  const canEditPhotos = (m: MaintenanceRequest) =>
    isAdmin || (!!authUsername && m.created_by_username === authUsername);
  return (
<Sheet open={open} onOpenChange={onOpenChange}>
  <SheetContent side="bottom" className="max-h-[90dvh] overflow-hidden rounded-t-2xl p-4 sm:p-6 flex flex-col">
    <SheetHeader className="text-left">
      <SheetTitle className="flex items-center gap-2">
        <Wrench className="h-4 w-4" />
        Maintenance Log
        {hasOpenMaintenance && (
          <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-xs font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
            {openMaintenanceCount} open
          </span>
        )}
      </SheetTitle>
      <SheetDescription>
        {isReception || isMaintenance
          ? "Reception and Maintenance can mark requests as complete."
          : "Log a maintenance issue for Reception or Maintenance to action."}
      </SheetDescription>
    </SheetHeader>
    <div className="mt-4 border-b pb-4">
      {maintenanceComposerOpen ? (
        <div className="flex flex-col gap-2 rounded-lg border bg-background p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Log a new issue
            </p>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => {
                setMaintenanceComposerOpen(false);
                setNewMaintenanceRoom("");
                setNewMaintenanceText("");
                setNewMaintenancePhotos([]);
              }}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={newMaintenanceRoom}
              onChange={(e) => setNewMaintenanceRoom(e.target.value)}
              className="h-9 rounded-xl border bg-background px-2 text-sm sm:w-44"
            >
              <option value="">Select a location</option>
              <optgroup label="Rooms">
                {rooms
                  .map((r) => r.room_number)
                  .sort((a, b) => a - b)
                  .map((n) => (
                    <option key={n} value={String(n)}>
                      Room {n}
                    </option>
                  ))}
              </optgroup>
              {maintenanceAreas.length > 0 && (
                <optgroup label="Other areas">
                  {maintenanceAreas.map((a) => (
                    <option key={a.id} value={`area:${a.label}`}>
                      {a.label}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <Input
              placeholder="Describe the issue…"
              value={newMaintenanceText}
              onChange={(e) => setNewMaintenanceText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submitMaintenanceRequest();
                }
              }}
              className="flex-1"
            />
            <Button
              type="button"
              onClick={async () => {
                await submitMaintenanceRequest();
                setMaintenanceComposerOpen(false);
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> Log
            </Button>
          </div>
          <PhotoComposer value={newMaintenancePhotos} onChange={setNewMaintenancePhotos} />
          {canManageAreas && onManageAreas && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start text-xs"
              onClick={onManageAreas}
            >
              <Settings className="h-3.5 w-3.5 mr-1" />
              Manage areas
            </Button>
          )}
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full justify-between"
          onClick={() => setMaintenanceComposerOpen(true)}
        >
          <span className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Log a new issue
          </span>
          <ChevronDown className="h-4 w-4 opacity-60" />
        </Button>
      )}
    </div>
    <div className="flex-1 min-h-0 overflow-y-auto mt-4 space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Open ({openMaintenanceCount})
        </p>
        {openMaintenanceCount === 0 ? (
          <p className="text-sm text-muted-foreground">No open maintenance requests.</p>
        ) : (
          maintenanceRequests
            .filter((m) => !m.done)
            .map((m) => (
              <div key={m.id} className="flex items-start gap-2 rounded-lg border bg-background p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex h-6 items-center rounded-full bg-primary/10 text-primary px-2 text-xs font-semibold">
                      {maintenanceLocation(m)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(m.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      {m.created_by_username ? ` · ${m.created_by_username}` : ""}
                    </span>
                  </div>
                  <p className="mt-1 text-sm whitespace-pre-wrap break-words">{m.message}</p>
                  <PhotoAttachments
                    kind="maintenance"
                    entryId={m.id}
                    paths={m.photo_paths ?? []}
                    canEdit={canEditPhotos(m)}
                    onChange={(next) => setMaintenancePhotoPaths(m.id, next)}
                  />
                </div>
                {isReception || isMaintenance ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void markMaintenanceDone(m.id)}
                    aria-label="Mark as done"
                  >
                    <Check className="h-4 w-4 mr-1" /> Done
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground shrink-0 pt-1">Awaiting action</span>
                )}
                {isAdmin && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => void deleteMaintenanceRequest(m.id)}
                    aria-label="Delete request"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))
        )}
      </div>
      {maintenanceRequests.some((m) => m.done) && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Completed</p>
          {maintenanceRequests
            .filter((m) => m.done)
            .slice(0, 25)
            .map((m) => (
              <div key={m.id} className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex h-6 items-center rounded-full bg-muted text-muted-foreground px-2 text-xs font-semibold">
                      {maintenanceLocation(m)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Done{m.done_by_username ? ` by ${m.done_by_username}` : ""}
                      {m.done_at ? ` · ${new Date(m.done_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}
                    </span>
                  </div>
                  <p className="mt-1 text-sm whitespace-pre-wrap break-words text-muted-foreground line-through">{m.message}</p>
                  <PhotoAttachments
                    kind="maintenance"
                    entryId={m.id}
                    paths={m.photo_paths ?? []}
                    canEdit={canEditPhotos(m)}
                    onChange={(next) => setMaintenancePhotoPaths(m.id, next)}
                  />
                </div>
                {(isReception || isMaintenance || isAdmin) && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => void deleteMaintenanceRequest(m.id)}
                    aria-label="Delete request"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  </SheetContent>
</Sheet>
  );
}
