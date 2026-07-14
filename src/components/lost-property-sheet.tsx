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
import { PackageSearch, Check, Trash2, Plus, ChevronDown, X, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { PhotoAttachments, PhotoComposer } from "@/components/entry-photos";
import { supabase as sb } from "@/integrations/supabase/client";

type LostPropertyRow = {
  id: string;
  room_number: number | null;
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
}: {
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
  ) => Promise<{ ok: boolean; error?: string }>;
  onReply?: (item: {
    id: string;
    roomNumber: number | null;
    message: string;
    sender: string | null;
  }) => void;
}) {
  const qc = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);
  const [addRoom, setAddRoom] = useState<number | "">("");
  const [addMessage, setAddMessage] = useState("");
  const [addPhotos, setAddPhotos] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const resetAddForm = () => {
    setAddRoom("");
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
    if (typeof addRoom === "number") {
      roomNumber = addRoom;
    } else if (requireRoom) {
      toast.error("Room number required");
      return;
    }
    setSubmitting(true);
    const res = await onAdd(roomNumber, body, addPhotos);
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error ?? "Could not log item");
      return;
    }
    toast.success("Logged to lost property");
    resetAddForm();
    setAddOpen(false);
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

  const q = useQuery({
    queryKey: ["lost_property"],
    enabled: open,
    queryFn: async (): Promise<LostPropertyRow[]> => {
      const { data, error } = await supabase
        .from("lost_property" as never)
          .select("id,room_number,message,created_by_username,created_by_role,status,resolved_by_username,resolved_at,deleted_at,created_at,photo_paths")
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

  const rows = useMemo(() => q.data ?? [], [q.data]);
  const openRows = rows.filter((r) => r.status === "open");
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
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-hidden rounded-t-2xl p-4 sm:p-6 flex flex-col">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <PackageSearch className="h-4 w-4" />
            Lost Property
          </SheetTitle>
          <SheetDescription>
            {canResolve
              ? "Mark items as collected by the guest, or thrown away when unclaimed."
              : "Items reported to Reception. Reception marks them collected or discarded."}
          </SheetDescription>
        </SheetHeader>

        {isAdmin && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
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

        <div className="flex-1 min-h-0 overflow-y-auto mt-4 space-y-4">
          {canAdd && onAdd && (
            addOpen ? (
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
                    Room
                  </label>
                  <select
                    id="lp-add-room"
                    value={addRoom === "" ? "" : String(addRoom)}
                    onChange={(e) =>
                      setAddRoom(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    className="h-8 rounded-md border bg-background px-2 text-sm"
                  >
                    <option value="">{requireRoom ? "Select a room" : "— none —"}</option>
                    {(roomNumbers ?? []).map((n) => (
                      <option key={n} value={n}>
                        Room {n}
                      </option>
                    ))}
                  </select>
                </div>
                <Textarea
                  placeholder="Describe the item (e.g. black wallet on nightstand)"
                  value={addMessage}
                  onChange={(e) => setAddMessage(e.target.value.slice(0, 500))}
                  rows={2}
                  className="resize-none"
                />
                <PhotoComposer value={addPhotos} onChange={setAddPhotos} />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void submitAdd()}
                    disabled={submitting || !addMessage.trim()}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    {submitting ? "Logging…" : "Log item"}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between"
                onClick={() => setAddOpen(true)}
              >
                <span className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Log a new item
                </span>
                <ChevronDown className="h-4 w-4 opacity-60" />
              </Button>
            )
          )}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Open ({openRows.length})
            </p>
            {openRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open lost property.</p>
            ) : (
              openRows.map((r) => (
                <div key={r.id} className="flex items-start gap-2 rounded-lg border bg-background p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {typeof r.room_number === "number" && (
                        <span className="inline-flex h-6 items-center rounded-full bg-primary/10 text-primary px-2 text-xs font-semibold">
                          Room {r.room_number}
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
                    <div className="flex flex-col gap-1 shrink-0">
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
                      {canDiscard(r.created_at) ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => void setStatus(r.id, "discarded")}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Throw away
                        </Button>
                      ) : (
                        <span className="text-[10px] text-muted-foreground text-center leading-tight">
                          {(() => {
                            const rem = monthsRemaining(r.created_at);
                            if (rem >= 1) {
                              const m = Math.ceil(rem);
                              return `${m} month${m === 1 ? "" : "s"} left`;
                            }
                            const days = Math.max(1, Math.ceil(rem * 30.44));
                            return `${days} day${days === 1 ? "" : "s"} left`;
                          })()}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground shrink-0 pt-1">Awaiting reception</span>
                  )}
                  {isAdmin && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => void softDelete(r.id)}
                      aria-label="Delete entry"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
          {resolvedRows.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Resolved
              </p>
              {resolvedRows.map((r) => (
                <div key={r.id} className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {typeof r.room_number === "number" && (
                        <span className="inline-flex h-6 items-center rounded-full bg-muted text-muted-foreground px-2 text-xs font-semibold">
                          Room {r.room_number}
                        </span>
                      )}
                      <span
                        className={
                          r.status === "collected"
                            ? "inline-flex h-5 items-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 text-[10px] font-semibold uppercase"
                            : "inline-flex h-5 items-center rounded-full bg-destructive/15 text-destructive px-2 text-[10px] font-semibold uppercase"
                        }
                      >
                        {r.status === "collected" ? "Collected" : "Thrown away"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {r.resolved_at ? fmt(r.resolved_at) : ""}
                        {r.resolved_by_username ? ` · ${r.resolved_by_username}` : ""}
                      </span>
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
                  {canResolve && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => void softDelete(r.id)}
                      aria-label="Delete entry"
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