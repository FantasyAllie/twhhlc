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
import { PackageSearch, Check, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

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
};

export function LostPropertySheet({
  open,
  onOpenChange,
  canResolve,
  isAdmin,
  currentUsername,
  roomNumbers,
  canAddEntry,
  senderRole,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  canResolve: boolean;
  isAdmin?: boolean;
  currentUsername: string | null;
  roomNumbers: number[];
  canAddEntry: boolean;
  senderRole: string | null;
}) {
  const qc = useQueryClient();

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
        .select("id,room_number,message,created_by_username,created_by_role,status,resolved_by_username,resolved_at,deleted_at,created_at")
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

  const [newRoom, setNewRoom] = useState<number | "">("");
  const [newText, setNewText] = useState("");
  const senderIsHkOnly = senderRole === "housekeeping";
  const addEntry = async () => {
    const body = newText.trim();
    if (!body) return;
    if (senderIsHkOnly && typeof newRoom !== "number") {
      toast.error("Pick a room for the lost item");
      return;
    }
    const { error } = await supabase.from("lost_property" as never).insert({
      room_number: typeof newRoom === "number" ? newRoom : null,
      message: body,
      created_by_username: currentUsername ?? null,
      created_by_role: senderRole,
    } as never);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewText("");
    setNewRoom("");
    qc.invalidateQueries({ queryKey: ["lost_property"] });
    toast.success("Lost property entry added");
  };

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-hidden rounded-t-2xl p-4 sm:p-6 flex flex-col">
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

        {canAddEntry && (
          <div className="mt-3 space-y-2 rounded-lg border bg-background p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Add entry
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0">Room:</span>
              <select
                value={newRoom === "" ? "" : String(newRoom)}
                onChange={(e) => setNewRoom(e.target.value === "" ? "" : Number(e.target.value))}
                className="h-8 rounded-md border bg-background px-2 text-sm"
              >
                <option value="">— none —</option>
                {roomNumbers.map((n) => (
                  <option key={n} value={n}>Room {n}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Input
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="Describe the item…"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void addEntry();
                  }
                }}
              />
              <Button type="button" onClick={() => void addEntry()} disabled={!newText.trim()}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto mt-4 space-y-4">
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