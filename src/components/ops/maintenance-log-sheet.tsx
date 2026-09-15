// Maintenance Log sheet (composer + open/completed lists).
// Extracted verbatim from src/routes/app.tsx.
import { useEffect, useMemo, useState } from "react";
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

  const RETENTION_KEY = "maintenance_retention_months";
  const [retentionMonths, setRetentionMonths] = useState<number>(() => {
    if (typeof window === "undefined") return 3;
    const raw = window.localStorage.getItem(RETENTION_KEY);
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : 3;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(RETENTION_KEY, String(retentionMonths));
  }, [retentionMonths]);
  const isWithinRetention = (iso: string | null) => {
    if (retentionMonths <= 0) return false;
    if (!iso) return true;
    const done = new Date(iso).getTime();
    const monthsElapsed = (Date.now() - done) / (1000 * 60 * 60 * 24 * 30.44);
    return monthsElapsed < retentionMonths;
  };
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<"open" | "completed">("open");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;

  const openItems = useMemo(
    () => maintenanceRequests.filter((m) => !m.done),
    [maintenanceRequests],
  );
  const completedItems = useMemo(
    () => maintenanceRequests.filter((m) => m.done && isWithinRetention(m.done_at)),
    [maintenanceRequests, retentionMonths],
  );

  const activeItems = activeTab === "open" ? openItems : completedItems;
  const pageCount = Math.max(1, Math.ceil(activeItems.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pagedItems = activeItems.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );

  const pageItems: (number | "ellipsis")[] = useMemo(() => {
    if (pageCount <= 5) {
      return Array.from({ length: pageCount }, (_, i) => i + 1);
    }
    const current = safePage + 1;
    const items: (number | "ellipsis")[] = [1];
    const start = Math.max(2, current - 2);
    const end = Math.min(pageCount - 1, current + 2);
    if (start > 2) items.push("ellipsis");
    for (let i = start; i <= end; i++) items.push(i);
    if (end < pageCount - 1) items.push("ellipsis");
    items.push(pageCount);
    return items;
  }, [pageCount, safePage]);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  const renderItem = (m: MaintenanceRequest) => {
    const isCompleted = m.done;
    return (
      <div
        key={m.id}
        className={
          "flex items-start gap-2 rounded-lg border p-3 " +
          (isCompleted ? "bg-muted/40" : "bg-background")
        }
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={
                "inline-flex h-6 items-center rounded-full px-2 text-xs font-semibold " +
                (isCompleted
                  ? "bg-muted text-muted-foreground"
                  : "bg-primary/10 text-primary")
              }
            >
              {maintenanceLocation(m)}
            </span>
            <span className="text-xs text-muted-foreground">
              {isCompleted ? (
                <>
                  Done{m.done_by_username ? ` by ${m.done_by_username}` : ""}
                  {m.done_at ? ` · ${fmt(m.done_at)}` : ""}
                </>
              ) : (
                <>
                  {fmt(m.created_at)}
                  {m.created_by_username ? ` · ${m.created_by_username}` : ""}
                </>
              )}
            </span>
          </div>
          <p
            className={
              "mt-1 text-sm whitespace-pre-wrap break-words " +
              (isCompleted ? "text-muted-foreground line-through" : "")
            }
          >
            {m.message}
          </p>
          <PhotoAttachments
            kind="maintenance"
            entryId={m.id}
            paths={m.photo_paths ?? []}
            canEdit={canEditPhotos(m)}
            onChange={(next) => setMaintenancePhotoPaths(m.id, next)}
          />
          <MaintenanceNotes requestId={m.id} notes={m.notes} />
        </div>
        {!isCompleted && (isReception || isMaintenance) ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void markMaintenanceDone(m.id)}
            aria-label="Mark as done"
          >
            <Check className="h-4 w-4 mr-1" /> Done
          </Button>
        ) : !isCompleted ? (
          <span className="text-xs text-muted-foreground shrink-0 pt-1">Awaiting action</span>
        ) : null}
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
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="overflow-hidden rounded-t-2xl p-4 sm:p-6 flex flex-col">
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
        <div className="mt-4 border-b pb-4 space-y-2">
          <div className={isAdmin ? "grid grid-cols-2 gap-2" : undefined}>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-between"
              onClick={() => {
                setMaintenanceComposerOpen(!maintenanceComposerOpen);
                if (maintenanceComposerOpen) {
                  setNewMaintenanceRoom("");
                  setNewMaintenanceText("");
                  setNewMaintenancePhotos([]);
                }
              }}
              aria-expanded={maintenanceComposerOpen}
            >
              <span className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Log a new issue
              </span>
              <ChevronDown
                className={
                  "h-4 w-4 opacity-60 transition-transform " +
                  (maintenanceComposerOpen ? "rotate-180" : "")
                }
              />
            </Button>
            {isAdmin && (
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between"
                onClick={() => setSettingsOpen((open) => !open)}
                aria-expanded={settingsOpen}
              >
                <span className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </span>
                <ChevronDown
                  className={
                    "h-4 w-4 opacity-60 transition-transform " +
                    (settingsOpen ? "rotate-180" : "")
                  }
                />
              </Button>
            )}
          </div>

          {maintenanceComposerOpen && (
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
          )}

          {settingsOpen && (
            <div className="flex flex-col gap-2 rounded-lg border bg-background p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Settings
                </p>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => setSettingsOpen(false)}
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
                <label htmlFor="maint-retention" className="text-sm">
                  Keep completed tasks for
                </label>
                <Input
                  id="maint-retention"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={120}
                  value={retentionMonths}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n) && n >= 0) setRetentionMonths(Math.floor(n));
                  }}
                  className="h-8 w-16 text-center"
                />
                <span className="text-sm">months</span>
              </div>
            </div>
          )}
        </div>

        {/* Section pills */}
        <div className="mt-4 inline-flex w-full justify-center rounded-full border p-1 bg-background items-center">
          {([
            { key: "open", label: `Open (${openItems.length})` },
            { key: "completed", label: `Completed (${completedItems.length})` },
          ] as { key: "open" | "completed"; label: string }[]).map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key);
                  setPage(0);
                }}
                className={
                  "flex-1 px-2 sm:px-4 h-8 text-xs sm:text-sm rounded-full transition-colors whitespace-nowrap " +
                  (active
                    ? "bg-primary text-primary-foreground shadow-sm font-medium"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Pagination */}
        {pageCount > 1 && (
          <div className="mt-3 flex items-center justify-center gap-1 sm:gap-2 flex-wrap">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={safePage === 0}
              onClick={() => setPage(safePage - 1)}
            >
              Previous
            </Button>
            {pageItems.map((item, idx) =>
              item === "ellipsis" ? (
                <span key={`ellipsis-${idx}`} className="text-xs text-muted-foreground px-1">
                  …
                </span>
              ) : (
                <Button
                  key={item}
                  type="button"
                  size="sm"
                  variant={safePage + 1 === item ? "default" : "outline"}
                  className="h-8 w-8 p-0 text-xs"
                  onClick={() => setPage(item - 1)}
                >
                  {item}
                </Button>
              )
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage(safePage + 1)}
            >
              Next
            </Button>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto mt-4 space-y-4">
          {activeItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {activeTab === "open" ? "No open maintenance requests." : "No completed maintenance requests."}
            </p>
          ) : (
            <div className="space-y-2">{pagedItems.map((m) => renderItem(m))}</div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
