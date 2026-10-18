import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PackageSearch, Check, Trash2, Plus, ChevronDown, Loader2, X, MessageSquare, Settings } from "lucide-react";
import { SwipeRow } from "@/components/ui/swipe-row";
import { swipeNavProps, usePullToRefresh, useSwipeNav, useSwipeState } from "@/hooks/use-touch-gestures";
import { toast } from "sonner";
import { PhotoAttachments, PhotoComposer } from "@/components/entry-photos";
import { supabase as sb } from "@/integrations/supabase/client";
import { notifyLostProperty } from "@/lib/push.functions";

type LostPropertyRow = {
  id: string;
  room_number: number | null;
  area_label: string | null;
  message: string;
  created_by_username: string | null;
  created_by_role: string | null;
  status: "open" | "collected" | "discarded";
  resolved_by_username: string | null;
  resolved_at: string | null;
  deleted_at: string | null;
  created_at: string;
  photo_paths: string[];
};

export function LostPropertySheet({
  open,
  onOpenChange,
  canResolve,
  isAdmin,
  currentUsername,
  canAdd,
  requireRoom,
  roomNumbers,
  onAdd,
  onReply,
  initialAddRoom = null,
  openComposerOnOpen = false,
  composeOnly = false,
  contentClassName,
  scope = "rooms",
  areaLabels = [],
  departments = null,
}: {
  // Only entries logged by these departments are shown; null shows everything (Reception/admins).
  departments?: string[] | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  canResolve: boolean;
  isAdmin?: boolean;
  currentUsername: string | null;
  canAdd?: boolean;
  requireRoom?: boolean;
  roomNumbers?: number[];
  onAdd?: (
    roomNumber: number | null,
    message: string,
    photos: File[],
    areaLabel?: string | null,
  ) => Promise<{ ok: boolean; error?: string }>;
  onReply?: (item: {
    id: string;
    roomNumber: number | null;
    message: string;
    sender: string | null;
  }) => void;
  // Pre-select a room and open the composer when the panel is opened from a
  // room hub, so the room doesn't have to be picked again.
  initialAddRoom?: number | null;
  openComposerOnOpen?: boolean;
  // Only the new-item form (the centred iOS room-hub popup).
  composeOnly?: boolean;
  // Extra classes for the panel itself.
  contentClassName?: string;
  // Rooms for Housekeeping/Reception; hotel areas for everyone else.
  scope?: "rooms" | "areas";
  areaLabels?: string[];
}) {
  const qc = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addRoom, setAddRoom] = useState<number | "">("");
  const [addArea, setAddArea] = useState("");
  const [addMessage, setAddMessage] = useState("");
  const [addPhotos, setAddPhotos] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const resetAddForm = () => {
    setAddRoom("");
    setAddArea("");
    setAddMessage("");
    setAddPhotos([]);
  };

  const submitAdd = async () => {
    if (!onAdd) return;
    const body = addMessage.trim();
    if (!body) {
      toast.error("Enter a description");
      return;
    }
    let roomNumber: number | null = null;
    if (scope === "areas") {
      if (!addArea) {
        toast.error("Select an area");
        return;
      }
    } else if (typeof addRoom === "number") {
      roomNumber = addRoom;
    } else if (requireRoom) {
      toast.error("Room number required");
      return;
    }
    setSubmitting(true);
    const res = await onAdd(roomNumber, body, addPhotos, scope === "areas" ? addArea : null);
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error ?? "Could not log item");
      return;
    }
    toast.success("Logged to lost property");
    void notifyLostProperty({
      data: { kind: "logged", roomNumber, description: body },
    }).catch(() => {});
    resetAddForm();
    setAddOpen(false);
    if (composeOnly) onOpenChange(false);
  };

  const RETENTION_KEY = "lost_property_retention_months";
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
  const canDiscard = (iso: string) => {
    if (retentionMonths <= 0) return true;
    const created = new Date(iso).getTime();
    const now = Date.now();
    // Approx month = 30.44 days
    const monthsElapsed = (now - created) / (1000 * 60 * 60 * 24 * 30.44);
    return monthsElapsed >= retentionMonths;
  };
  const monthsRemaining = (iso: string) => {
    if (retentionMonths <= 0) return 0;
    const created = new Date(iso).getTime();
    const monthsElapsed = (Date.now() - created) / (1000 * 60 * 60 * 24 * 30.44);
    return Math.max(0, retentionMonths - monthsElapsed);
  };
  // Milliseconds until an item becomes discardable. Zero when already
  // over the retention window (or when retention is disabled).
  const msUntilDiscardable = (iso: string) => {
    if (retentionMonths <= 0) return 0;
    const created = new Date(iso).getTime();
    const deadline = created + retentionMonths * 30.44 * 24 * 60 * 60 * 1000;
    return Math.max(0, deadline - Date.now());
  };
  const formatCountdown = (ms: number) => {
    const totalMinutes = Math.floor(ms / (60 * 1000));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;
    if (days >= 1) return `${days}d ${hours}h left`;
    if (hours >= 1) return `${hours}h ${minutes}m left`;
    return `${Math.max(1, minutes)}m left`;
  };
  // Re-render every minute so countdowns tick.
  const [, setTick] = useState(0);
  const [activeTab, setActiveTab] = useState<"open" | "expired" | "resolved">("open");
  const [openPage, setOpenPage] = useState(0);
  const PAGE_SIZE = 15;

  // Swipe across the pills to move between sections, swipe the open list to
  // page through it, and pull the panel down to refresh.
  const TABS = ["open", "expired", "resolved"] as const;
  const stepTab = (delta: number) => {
    const i = TABS.indexOf(activeTab);
    const next = TABS[Math.min(TABS.length - 1, Math.max(0, i + delta))];
    if (next && next !== activeTab) {
      setActiveTab(next);
      setOpenPage(0);
    }
  };
  const tabSwipe = useSwipeNav({ onNext: () => stepTab(1), onPrev: () => stepTab(-1) });
  const pageSwipeState = useSwipeState();
  const pageSwipe = (page: number, pageCount: number) =>
    swipeNavProps(pageSwipeState, {
      onNext: () => setOpenPage(Math.min(pageCount - 1, page + 1)),
      onPrev: () => setOpenPage(Math.max(0, page - 1)),
    });
  const refresh = usePullToRefresh(() => qc.invalidateQueries({ queryKey: ["lost_property"] }));

  useEffect(() => {
    if (!open) return;
    if (initialAddRoom !== null) {
      setAddRoom(initialAddRoom);
      setAddOpen(true);
    }
    if (openComposerOnOpen) setAddOpen(true);
  }, [open, initialAddRoom, openComposerOnOpen]);

  useEffect(() => {
    if (!open) return;
    const t = window.setInterval(() => setTick((n) => n + 1), 60_000);
    return () => window.clearInterval(t);
  }, [open]);

  const q = useQuery({
    queryKey: ["lost_property"],
    enabled: open,
    queryFn: async (): Promise<LostPropertyRow[]> => {
      const { data, error } = await supabase
        .from("lost_property" as never)
          .select("id,room_number,area_label,message,created_by_username,created_by_role,status,resolved_by_username,resolved_at,deleted_at,created_at,photo_paths")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as LostPropertyRow[];
    },
  });

  useEffect(() => {
    if (!open) return;
    const channel = supabase
      .channel("lost-property-sheet")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lost_property" },
        () => qc.invalidateQueries({ queryKey: ["lost_property"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, qc]);

  const rows = useMemo(
    () =>
      (q.data ?? []).filter((r) =>
        departments
          ? !!r.created_by_role && departments.includes(r.created_by_role)
          : scope === "areas" ? !!r.area_label : !r.area_label,
      ),
    [q.data, scope, departments],
  );
  const allOpen = rows.filter((r) => r.status === "open");
  const openRows = allOpen.filter((r) => !canDiscard(r.created_at));
  const expiredRows = allOpen.filter((r) => canDiscard(r.created_at));
  const resolvedRows = rows.filter((r) => r.status !== "open").slice(0, 50);

  const setStatus = async (id: string, status: "collected" | "discarded") => {
    const { error } = await supabase
      .from("lost_property" as never)
      .update({
        status,
        resolved_at: new Date().toISOString(),
        resolved_by_username: currentUsername ?? null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["lost_property"] });
    if (status === "collected") {
      const item = rows.find((r) => r.id === id);
      void notifyLostProperty({
        data: {
          kind: "collected",
          roomNumber: item?.room_number ?? null,
          description: item?.message ?? "",
        },
      }).catch(() => {});
    }
  };

  const softDelete = async (id: string) => {
    const { error } = await supabase
      .from("lost_property" as never)
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never)
      .eq("id", id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["lost_property"] });
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  const setRowPhotoPaths = async (id: string, paths: string[]) => {
    qc.setQueryData<LostPropertyRow[]>(["lost_property"], (old) =>
      old?.map((r) => (r.id === id ? { ...r, photo_paths: paths } : r)) ?? [],
    );
    const { error } = await sb
      .from("lost_property" as never)
      .update({ photo_paths: paths, updated_at: new Date().toISOString() } as never)
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["lost_property"] });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className={"overflow-hidden rounded-t-2xl p-4 sm:p-6 flex flex-col" + (contentClassName ? " " + contentClassName : "")}>
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <PackageSearch className="h-4 w-4" />
            {composeOnly ? "Log a new item" : "Lost Property"}
          </SheetTitle>
          <SheetDescription className={composeOnly ? undefined : "max-lg:sr-only"}>
            {composeOnly
              ? "Report a lost item. Open items are in the Lost Property screen."
              : canResolve
              ? "Mark items as collected by the guest, or thrown away when unclaimed."
              : "Items reported to Reception. Reception marks them collected or discarded."}
          </SheetDescription>
        </SheetHeader>

        <div
          className="flex-1 min-h-0 overflow-y-auto mt-4 max-lg:mt-2 space-y-3 overscroll-contain"
          {...refresh.handlers}
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
          {isAdmin && !(canAdd && onAdd) && (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
              <label htmlFor="lp-retention" className="text-sm">
                Keep items for
              </label>
              <Input
                id="lp-retention"
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
          )}

          {canAdd && onAdd && (
            <div className={composeOnly ? "space-y-2" : "border-b pb-4 space-y-2"}>
              {!composeOnly && (<div className={isAdmin ? "grid grid-cols-2 gap-2" : undefined}>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => setAddOpen((open) => !open)}
                  aria-expanded={addOpen}
                >
                  <span className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Log a new item
                  </span>
                  <ChevronDown className={"h-4 w-4 opacity-60 transition-transform " + (addOpen ? "rotate-180" : "")} />
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
                  <ChevronDown className={"h-4 w-4 opacity-60 transition-transform " + (settingsOpen ? "rotate-180" : "")} />
                </Button>
                )}
              </div>)}
              {(composeOnly || addOpen) && (
                <div className="space-y-2 rounded-lg border bg-background p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Log a new item
                    </p>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => {
                        if (composeOnly) {
                          onOpenChange(false);
                          return;
                        }
                        setAddOpen(false);
                        resetAddForm();
                      }}
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <label htmlFor="lp-add-room" className="text-sm shrink-0">
                      {scope === "areas" ? "Area" : "Room"}
                    </label>
                    {scope === "areas" ? (
                      <select
                        id="lp-add-room"
                        value={addArea}
                        onChange={(e) => setAddArea(e.target.value)}
                        className="h-8 rounded-xl border bg-background px-2 text-sm"
                      >
                        <option value="">Select an area</option>
                        {areaLabels.map((a) => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                    ) : (
                    <select
                      id="lp-add-room"
                      value={addRoom === "" ? "" : String(addRoom)}
                      onChange={(e) =>
                        setAddRoom(e.target.value === "" ? "" : Number(e.target.value))
                      }
                      className="h-8 rounded-xl border bg-background px-2 text-sm"
                    >
                      <option value="">{requireRoom ? "Select a room" : "— none —"}</option>
                      {(roomNumbers ?? []).map((n) => (
                        <option key={n} value={n}>
                          Room {n}
                        </option>
                      ))}
                    </select>
                    )}
                  </div>
                  <Textarea
                    placeholder="Describe the item (e.g. black wallet on nightstand)"
                    value={addMessage}
                    onChange={(e) => setAddMessage(e.target.value.slice(0, 500))}
                    rows={2}
                    className="resize-none"
                  />
                  <PhotoComposer value={addPhotos} onChange={setAddPhotos} />
                  {/* Stays in reach at the bottom of the form, above the keyboard. */}
                  <div className="touch-action-bar flex justify-end">
                    <Button
                      type="button"
                      className="w-full sm:w-auto"
                      onClick={() => void submitAdd()}
                      disabled={submitting || !addMessage.trim()}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      {submitting ? "Logging…" : "Log item"}
                    </Button>
                  </div>
                </div>
              )}
              {!composeOnly && settingsOpen && (
                <div className="space-y-2 rounded-lg border bg-background p-3">
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
                    <label htmlFor="lp-retention" className="text-sm">
                      Keep items for
                    </label>
                    <Input
                      id="lp-retention"
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
          )}
          {/* Section pills */}
          {!composeOnly && (
          <div
            className="inline-flex w-full justify-center rounded-full border p-1 bg-background items-center"
            {...tabSwipe}
          >
            {([
              { key: "open", label: `Open (${openRows.length})` },
              { key: "expired", label: `Expired (${expiredRows.length})` },
              { key: "resolved", label: `Resolved (${resolvedRows.length})` },
            ] as { key: "open" | "expired" | "resolved"; label: string }[]).map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
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
          )}

          {!composeOnly && (() => {
            const renderOpenItem = (r: LostPropertyRow) => (
              <SwipeRow
                key={r.id}
                primaryLabel="Collected"
                onPrimary={canResolve ? () => void setStatus(r.id, "collected") : undefined}
                onDelete={isAdmin ? () => void softDelete(r.id) : undefined}
              >
              <div data-touch-row className="flex items-start gap-2.5 rounded-lg border bg-background p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {typeof r.room_number === "number" && (
                      <span className="inline-flex h-6 items-center rounded-full bg-primary/10 text-primary px-2 text-xs font-semibold">
                        Room {r.room_number}
                      </span>
                    )}
                    {r.area_label && (
                      <span className="inline-flex h-6 items-center rounded-full bg-primary/10 text-primary px-2 text-xs font-semibold">
                        {r.area_label}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {fmt(r.created_at)}
                      {r.created_by_username ? ` · ${r.created_by_username}` : ""}
                    </span>
                  </div>
                  <p className="mt-1 text-sm whitespace-pre-wrap break-words">{r.message}</p>
                  <PhotoAttachments
                    kind="lost_property"
                    entryId={r.id}
                    paths={r.photo_paths ?? []}
                    canEdit={
                      !!isAdmin ||
                      (!!currentUsername && r.created_by_username === currentUsername)
                    }
                    onChange={(next) => setRowPhotoPaths(r.id, next)}
                  />
                </div>
                {canResolve ? (
                  <div className="flex flex-col items-center gap-1.5 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="default"
                      className="h-8 text-xs"
                      onClick={() => void setStatus(r.id, "collected")}
                    >
                      <Check className="h-3.5 w-3.5 mr-1" />
                      Collected
                    </Button>
                    {/* Reply and Throw away sit as two round icon buttons side by side. */}
                    <div className="flex items-center justify-center gap-1.5">
                      {onReply && (
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          data-ios-glass
                          className="h-9 w-9 rounded-full"
                          title="Reply"
                          aria-label="Reply"
                          onClick={() =>
                            onReply({
                              id: r.id,
                              roomNumber: r.room_number,
                              message: r.message,
                              sender: r.created_by_username,
                            })
                          }
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        data-ios-glass
                        className="h-9 w-9 rounded-full"
                        title={
                          canDiscard(r.created_at)
                            ? "Throw away"
                            : `Disposable ${new Date(
                                new Date(r.created_at).getTime() +
                                  retentionMonths * 30.44 * 24 * 60 * 60 * 1000,
                              ).toLocaleString()}`
                        }
                        aria-label="Throw away"
                        disabled={!canDiscard(r.created_at)}
                        onClick={() => void setStatus(r.id, "discarded")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {!canDiscard(r.created_at) &&
                      (() => {
                        const ms = msUntilDiscardable(r.created_at);
                        const urgent = ms > 0 && ms <= 24 * 60 * 60 * 1000;
                        return (
                          <span
                            className={
                              "text-[10px] text-center leading-tight " +
                              (urgent
                                ? "text-destructive font-semibold"
                                : "text-muted-foreground")
                            }
                          >
                            {formatCountdown(ms)}
                          </span>
                        );
                      })()}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground shrink-0 pt-1">Awaiting reception</span>
                )}
              </div>
              </SwipeRow>
            );

            if (activeTab === "open") {
              const pageCount = Math.max(1, Math.ceil(openRows.length / PAGE_SIZE));
              const page = Math.min(openPage, pageCount - 1);
              const pagedOpen = openRows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

              const pageItems: (number | "ellipsis")[] = (() => {
                if (pageCount <= 5) {
                  return Array.from({ length: pageCount }, (_, i) => i + 1);
                }
                const current = page + 1;
                const items: (number | "ellipsis")[] = [1];
                const start = Math.max(2, current - 2);
                const end = Math.min(pageCount - 1, current + 2);
                if (start > 2) items.push("ellipsis");
                for (let i = start; i <= end; i++) items.push(i);
                if (end < pageCount - 1) items.push("ellipsis");
                items.push(pageCount);
                return items;
              })();

              return (
                <div className="space-y-3" {...pageSwipe(page, pageCount)}>
                  {openRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No open lost property.</p>
                  ) : (
                    <>
                      {pageCount > 1 && (
                        <div className="flex items-center justify-center gap-1 sm:gap-2 flex-wrap">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            disabled={page === 0}
                            onClick={() => setOpenPage(page - 1)}
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
                                variant={page + 1 === item ? "default" : "outline"}
                                className="h-8 w-8 p-0 text-xs"
                                onClick={() => setOpenPage(item - 1)}
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
                            disabled={page >= pageCount - 1}
                            onClick={() => setOpenPage(page + 1)}
                          >
                            Next
                          </Button>
                        </div>
                      )}
                      {pagedOpen.map((r) => renderOpenItem(r))}
                    </>
                  )}
                </div>
              );
            }

            if (activeTab === "expired") {
              return (
                <div className="space-y-3">
                  {expiredRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nothing has passed the keep-for period yet.</p>
                  ) : (
                    expiredRows.map((r) => renderOpenItem(r))
                  )}
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {resolvedRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No resolved items yet.</p>
                ) : (
                  resolvedRows.map((r) => (
                    <SwipeRow key={r.id} onDelete={canResolve ? () => void softDelete(r.id) : undefined}>
                    <div data-touch-row className="flex items-start gap-2.5 rounded-lg border bg-muted/40 p-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {typeof r.room_number === "number" && (
                            <span className="inline-flex h-6 items-center rounded-full bg-muted text-muted-foreground px-2 text-xs font-semibold">
                              Room {r.room_number}
                            </span>
                          )}
                          {r.area_label && (
                            <span className="inline-flex h-6 items-center rounded-full bg-muted text-muted-foreground px-2 text-xs font-semibold">
                              {r.area_label}
                            </span>
                          )}
                          <span
                            className={
                              r.status === "collected"
                                ? "inline-flex h-5 items-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 text-[10px] font-semibold uppercase"
                                : "inline-flex h-5 items-center rounded-full bg-destructive/15 text-destructive px-2 text-[10px] font-semibold uppercase"
                            }
                          >
                            {r.status === "collected"
                              ? `Collected${r.resolved_by_username ? ` by ${r.resolved_by_username}` : ""}`
                              : `Thrown away${r.resolved_by_username ? ` by ${r.resolved_by_username}` : ""}`}
                          </span>
                          {r.resolved_at && (
                            <span className="text-xs text-muted-foreground">{fmt(r.resolved_at)}</span>
                          )}
                        </div>
                        <p className="mt-1 text-sm whitespace-pre-wrap break-words text-muted-foreground line-through">
                          {r.message}
                        </p>
                        <PhotoAttachments
                          kind="lost_property"
                          entryId={r.id}
                          paths={r.photo_paths ?? []}
                          canEdit={
                            !!isAdmin ||
                            (!!currentUsername && r.created_by_username === currentUsername)
                          }
                          onChange={(next) => setRowPhotoPaths(r.id, next)}
                        />
                      </div>
                    </div>
                    </SwipeRow>
                  ))
                )}
              </div>
            );
          })()}
        </div>
      </SheetContent>
    </Sheet>
  );
}