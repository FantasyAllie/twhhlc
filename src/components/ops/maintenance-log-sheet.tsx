// Maintenance Log sheet (composer + open/completed lists).
// Extracted verbatim from src/routes/app.tsx.
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Loader2, Plus, Settings, Trash2, Wrench, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SwipeRow } from "@/components/ui/swipe-row";
import { usePullToRefresh, useSwipeNav } from "@/hooks/use-touch-gestures";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PhotoAttachments, PhotoComposer } from "@/components/entry-photos";
import { MaintenanceNotes } from "@/components/ops/maintenance-notes";
import type { MaintenanceArea, MaintenanceRequest, Room, RoomMessage } from "@/lib/app-types";
import { maintenanceLocation } from "@/lib/app-format";

// One row in the log: either a maintenance request or a maintenance message.
type Entry = {
  id: string;
  rawId: string;
  source: "req" | "msg";
  location: string;
  message: string;
  createdAt: string;
  createdBy: string | null;
  done: boolean;
  doneAt: string | null;
  doneBy: string | null;
  photoPaths: string[];
  notes: string | null;
  workDone?: string | null;
  canEditPhotos: boolean;
  urgent: boolean;
};


export function MaintenanceLogSheet({
  open,
  onOpenChange,
  rooms,
  maintenanceRequests,
  maintenanceMessages = [],
  markMessageDone,
  deleteMessage,
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
  newMaintenanceUrgent = false,
  setNewMaintenanceUrgent,
  setMaintenanceUrgent,
  newMaintenancePhotos,
  setNewMaintenancePhotos,
  submitMaintenanceRequest,
  markMaintenanceDone,
  deleteMaintenanceRequest,
  setMaintenancePhotoPaths,
  scope,
  composeOnly = false,
  contentClassName,
}: {
  // Only show the new-issue form (Maintenance staff work the list from Home).
  composeOnly?: boolean;
  // Extra classes for the panel itself (e.g. the centred iOS compose popup).
  contentClassName?: string;
  // When set, only room or only hotel-area entries are shown and loggable.
  scope?: "rooms" | "areas";
  open: boolean;
  onOpenChange: (o: boolean) => void;
  rooms: Room[];
  maintenanceRequests: MaintenanceRequest[];
  maintenanceMessages?: RoomMessage[];
  markMessageDone?: (id: string) => Promise<void> | void;
  deleteMessage?: (id: string) => Promise<void> | void;
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
  newMaintenanceUrgent?: boolean;
  setNewMaintenanceUrgent?: (v: boolean) => void;
  setMaintenanceUrgent?: (id: string, urgent: boolean) => Promise<void> | void;
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

  type Tab = "open" | "urgent" | "completed";
  const TAB_ORDER: Tab[] = ["open", "urgent", "completed"];
  const [activeTab, setActiveTab] = useState<Tab>("open");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;
  const qc = useQueryClient();

  // Swipe across the pills to change section.
  const goTab = (delta: number) => {
    const idx = TAB_ORDER.indexOf(activeTab);
    const next = TAB_ORDER[Math.min(TAB_ORDER.length - 1, Math.max(0, idx + delta))];
    setActiveTab(next);
    setPage(0);
  };
  const tabSwipe = useSwipeNav({
    onNext: () => goTab(1),
    onPrev: () => goTab(-1),
  });


  // Maintenance-thread messages are maintenance work too: show them in the
  // same log so Housekeeping and Reception see everything Maintenance sees.
  const msgEntries = useMemo<Entry[]>(
    () =>
      maintenanceMessages
        .filter(
          (m) =>
            (m.thread === "hk_maintenance" || m.thread === "reception_maintenance") &&
            !m.deleted_at,
        )
        .map((m) => ({
          id: `msg-${m.id}`,
          rawId: m.id,
          source: "msg" as const,
          location: m.room_number != null ? `Room ${m.room_number}` : "General",
          message: m.message,
          createdAt: m.created_at,
          createdBy: m.created_by_username,
          done: !!m.done_at,
          doneAt: m.done_at,
          doneBy: null,
          photoPaths: [],
          notes: m.notes ?? null,
          canEditPhotos: false,
          urgent: false,
        })),
    [maintenanceMessages],
  ).filter(() => scope !== "areas");

  const reqEntries = useMemo<Entry[]>(
    () =>
      maintenanceRequests
        .filter((m) => !scope || (scope === "areas" ? !!m.area_label : !m.area_label))
        .map((m) => ({
        id: `req-${m.id}`,
        rawId: m.id,
        source: "req" as const,
        location: maintenanceLocation(m),
        message: m.message,
        createdAt: m.created_at,
        createdBy: m.created_by_username,
        done: m.done,
        doneAt: m.done_at,
        doneBy: m.done_by_username,
        photoPaths: m.photo_paths ?? [],
        notes: m.notes ?? null,
        workDone: m.completion_notes ?? null,
        canEditPhotos: canEditPhotos(m),
        urgent: !!m.urgent,
      })),
    [maintenanceRequests, isAdmin, authUsername, scope],
  );
  const allEntries = useMemo(
    () => [...reqEntries, ...msgEntries].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [reqEntries, msgEntries],
  );
  // Open keeps its plain newest-first order; urgent items get their own pill.
  const openItems = useMemo(() => allEntries.filter((e) => !e.done), [allEntries]);
  const urgentItems = useMemo(() => openItems.filter((e) => e.urgent), [openItems]);
  const completedItems = useMemo(
    () => allEntries.filter((e) => e.done && isWithinRetention(e.doneAt)),
    [allEntries, retentionMonths],
  );

  const activeItems =
    activeTab === "open" ? openItems : activeTab === "urgent" ? urgentItems : completedItems;

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

  // Swipe the list sideways to page through it; pull down to refresh.
  const listSwipe = useSwipeNav({
    onNext: () => setPage(Math.min(pageCount - 1, safePage + 1)),
    onPrev: () => setPage(Math.max(0, safePage - 1)),
  });
  const refresh = usePullToRefresh(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["maintenance_requests"] }),
      qc.invalidateQueries({ queryKey: ["room_messages"] }),
    ]);
  });


  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  const renderItem = (e: Entry) => {
    const isCompleted = e.done;
    const canDone =
      e.source === "req" ? isReception || isMaintenance : !!markMessageDone;
    const canDelete = isReception || isMaintenance || isAdmin;
    const primary =
      !isCompleted && canDone
        ? () =>
            void (e.source === "req"
              ? markMaintenanceDone(e.rawId)
              : markMessageDone?.(e.rawId))
        : undefined;
    const remove = canDelete
      ? () =>
          void (e.source === "req"
            ? deleteMaintenanceRequest(e.rawId)
            : deleteMessage?.(e.rawId))
      : undefined;
    return (
      <SwipeRow key={e.id} onPrimary={primary} onDelete={remove}>
        <div
          data-touch-row
          className={
            "rounded-lg border p-3 " +
            (isCompleted ? "bg-muted/40 " : "bg-background ") +
            (e.urgent && !isCompleted ? "border-destructive/60" : "")
          }
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={
                "inline-flex h-6 items-center rounded-full px-2 text-xs font-semibold " +
                (isCompleted
                  ? "bg-muted text-muted-foreground"
                  : "bg-primary/10 text-primary")
              }
            >
              {e.location}
            </span>
            {e.urgent && !isCompleted && (
              <span className="inline-flex h-6 items-center gap-1 rounded-full bg-destructive/15 px-2 text-[10px] font-bold uppercase tracking-wide text-destructive">
                <AlertTriangle className="h-3 w-3" aria-hidden /> Urgent
              </span>
            )}

            <span className="text-xs text-muted-foreground">
              {isCompleted ? (
                <>
                  Done{e.doneBy ? ` by ${e.doneBy}` : ""}
                  {e.doneAt ? ` · ${fmt(e.doneAt)}` : ""}
                  {e.workDone ? <span className="block whitespace-pre-wrap text-foreground">Work done: {e.workDone}</span> : null}
                </>
              ) : (
                <>
                  {fmt(e.createdAt)}
                  {e.createdBy ? ` · ${e.createdBy}` : ""}
                </>
              )}
            </span>
            {!isCompleted && !canDone && (
              <span className="ml-auto text-xs text-muted-foreground">Awaiting action</span>
            )}
          </div>
          <p
            className={
              "mt-1 text-sm whitespace-pre-wrap break-words " +
              (isCompleted ? "text-muted-foreground line-through" : "")
            }
          >
            {e.message}
          </p>
          <div className="mt-2 flex items-end justify-between gap-2">
            {e.source === "req" ? (
              <PhotoAttachments
                kind="maintenance"
                entryId={e.rawId}
                paths={e.photoPaths}
                canEdit={e.canEditPhotos}
                onChange={(next) => setMaintenancePhotoPaths(e.rawId, next)}
              />
            ) : null}
            <div className="flex items-center gap-1.5 shrink-0">
              <MaintenanceNotes
                requestId={e.rawId}
                source={e.source === "req" ? "request" : "message"}
                notes={e.notes}
                iconOnly
              />
              {e.source === "req" && setMaintenanceUrgent && !isCompleted && (
                <Button
                  type="button"
                  size="icon"
                  variant={e.urgent ? "default" : "outline"}
                  className={
                    "h-9 w-9 " +
                    (e.urgent ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "")
                  }
                  onClick={() => void setMaintenanceUrgent(e.rawId, !e.urgent)}
                  aria-pressed={e.urgent}
                  aria-label={e.urgent ? "Urgent action" : "Mark urgent"}
                  title={e.urgent ? "Urgent action" : "Mark urgent"}
                >
                  <AlertTriangle className="h-4 w-4" />
                </Button>
              )}
              {remove && (
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-9 w-9 hover:text-destructive hover:border-destructive"
                  onClick={remove}
                  aria-label="Delete request"
                  title="Delete request"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          {primary && (
            <div className="mt-2 flex justify-end">
              <Button type="button" size="sm" variant="outline" onClick={primary} aria-label="Mark as done">
                <Check className="h-4 w-4 mr-1" /> Done
              </Button>
            </div>
          )}
        </div>
      </SwipeRow>
    );
  };

  // Shared pagination bar: above the list on desktop, at the end of the list on phones.
  const pageBar = pageCount > 1 ? (
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
  ) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className={"overflow-hidden rounded-t-2xl p-4 sm:p-6 flex flex-col" + (contentClassName ? " " + contentClassName : "")}>
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            {composeOnly ? "Log a new issue" : "Maintenance Log"}
            {!composeOnly && hasOpenMaintenance && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-xs font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
                {openMaintenanceCount} open
              </span>
            )}
          </SheetTitle>
          <SheetDescription className={composeOnly ? undefined : "max-lg:sr-only"}>
            {composeOnly
              ? "Report a new maintenance issue. Open jobs are on your Home screen."
              : isReception || isMaintenance
              ? "Reception and Maintenance can mark requests as complete."
              : "Log a maintenance issue for Reception or Maintenance to action."}
          </SheetDescription>
        </SheetHeader>
        <div className={"mt-4 max-lg:mt-2 space-y-2 " + (composeOnly ? "" : "border-b pb-4")}>
          {!composeOnly && (<div className={isAdmin ? "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2" : undefined}>
            <Button
              type="button"
              variant="outline"
              className="w-full min-w-0 justify-between gap-1 px-3"
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
              <span className="flex min-w-0 items-center gap-2">
                <Plus className="h-4 w-4 shrink-0" />
                <span className="truncate"><span className="sm:hidden">New issue</span><span className="max-sm:hidden">Log a new issue</span></span>
              </span>
              <ChevronDown
                className={
                  "h-4 w-4 shrink-0 opacity-60 transition-transform " +
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
          </div>)}

          {(composeOnly || maintenanceComposerOpen) && (
            <div className="flex flex-col gap-2 rounded-lg border bg-background p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Log a new issue
                </p>
                {!composeOnly && <Button
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
                </Button>}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={newMaintenanceRoom}
                  onChange={(e) => setNewMaintenanceRoom(e.target.value)}
                  className="h-9 rounded-xl border bg-background px-2 text-sm sm:w-44"
                >
                  <option value="">Select a location</option>
                  {scope !== "areas" && (
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
                  )}
                  {scope !== "rooms" && maintenanceAreas.length > 0 && (
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
              {setNewMaintenanceUrgent && (
                <Button
                  type="button"
                  variant={newMaintenanceUrgent ? "default" : "outline"}
                  size="sm"
                  className={
                    "self-start text-xs " +
                    (newMaintenanceUrgent
                      ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      : "")
                  }
                  onClick={() => setNewMaintenanceUrgent(!newMaintenanceUrgent)}
                  aria-pressed={newMaintenanceUrgent}
                >
                  <AlertTriangle className="mr-1 h-4 w-4" />
                  {newMaintenanceUrgent ? "Urgent action" : "Needs urgent action"}
                </Button>
              )}
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

        {!composeOnly && (<>
        {/* Section pills */}
        <div
          className="mt-4 max-lg:mt-2 inline-flex w-full justify-center rounded-full border p-1 bg-background items-center"
          {...tabSwipe}
        >
          {([
            { key: "open", label: `Open (${openItems.length})` },
            { key: "urgent", label: `Urgent (${urgentItems.length})` },
            { key: "completed", label: `Completed (${completedItems.length})` },
          ] as { key: Tab; label: string }[]).map((tab) => {
            const active = activeTab === tab.key;
            const urgentPill = tab.key === "urgent";
            return (
              <Button variant="ghost"
                key={tab.key}
                type="button"
                  aria-pressed={active}
                onClick={() => {
                  setActiveTab(tab.key);
                  setPage(0);
                }}
                className={
                  "flex-1 px-2 sm:px-4 h-8 text-xs sm:text-sm rounded-full transition-colors whitespace-nowrap " +
                  (active
                    ? urgentPill
                      ? "bg-destructive text-destructive-foreground shadow-sm font-medium"
                      : "bg-primary text-primary-foreground shadow-sm font-medium"
                    : urgentPill && urgentItems.length > 0
                      ? "text-destructive font-medium hover:text-destructive"
                      : "text-muted-foreground hover:text-foreground")
                }
              >
                {tab.label}
              </Button>
            );
          })}

        </div>

        {/* Pagination: above the list on desktop; phones get it at the end of the list */}
        <div className="max-lg:hidden">{pageBar}</div>

        <div
          className="flex-1 min-h-0 overflow-y-auto mt-4 max-lg:mt-2 space-y-4 overscroll-contain"
          {...refresh.handlers}
          {...listSwipe}
        >
          {(refresh.pull > 0 || refresh.refreshing) && (
            <div
              className="flex items-center justify-center text-muted-foreground"
              style={{ height: refresh.refreshing ? 28 : refresh.pull }}
            >
              <Loader2
                className={"h-4 w-4 " + (refresh.refreshing ? "animate-spin" : "")}
                aria-hidden
              />
            </div>
          )}
          {activeItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {activeTab === "open"
                ? "No open maintenance requests."
                : activeTab === "urgent"
                  ? "No urgent maintenance requests."
                  : "No completed maintenance requests."}

            </p>
          ) : (
            <div className="space-y-2">{pagedItems.map((m) => renderItem(m))}</div>
          )}
          {pageBar && <div className="lg:hidden pb-2">{pageBar}</div>}
        </div>
        </>)}
      </SheetContent>
    </Sheet>
  );
}
