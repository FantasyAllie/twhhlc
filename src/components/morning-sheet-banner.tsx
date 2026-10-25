import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Loader2, Dog, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { parseMorningSheet } from "@/lib/morning-sheet.functions";
import { buildSheet, KIND_LABEL, type SheetKind, type SheetRoom, type SheetSummary } from "@/lib/morning-sheet";

export const MORNING_SHEET_INPUT_ID = "morning-sheet-input";

type PendingSheet = {
  id: string;
  file_name: string;
  uploaded_by_name: string | null;
  sheet_date: string | null;
  room_count: number;
  summary: SheetSummary;
  payload: SheetRoom[];
  created_at: string;
};

// Pastel room-status tokens already used by the tiles.
const KIND_CHIP: Record<SheetKind, string> = {
  turnover: "bg-room-dirty text-room-dirty-fg",
  departure: "bg-room-dirty text-room-dirty-fg",
  stayover: "bg-room-stayover text-room-stayover-fg",
  arrival: "bg-room-early text-room-early-fg",
  ros: "bg-muted text-muted-foreground",
  vacant: "bg-room-done text-room-done-fg",
};

const db = supabase as unknown as { from: (t: string) => any; rpc: (f: string, a: Record<string, unknown>) => any };

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export function MorningSheetBanner({ hotelId, userName, canConfirm, hideBanner = false }: { hotelId: string | undefined; userName: string; canConfirm: boolean; hideBanner?: boolean }) {
  const qc = useQueryClient();
  const parse = useServerFn(parseMorningSheet);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState<"apply" | "discard" | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const key = ["morning_sheet_pending", hotelId];

  const pendingQ = useQuery({
    queryKey: key,
    enabled: !!hotelId,
    queryFn: async (): Promise<PendingSheet | null> => {
      const { data, error } = await db.from("morning_sheet_imports")
        .select("id,file_name,uploaded_by_name,sheet_date,room_count,summary,payload,created_at")
        .eq("hotel_id", hotelId).eq("status", "pending").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data as PendingSheet | null;
    },
  });

  useEffect(() => {
    if (!hotelId) return;
    const ch = supabase.channel(`morning-sheet-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "morning_sheet_imports", filter: `hotel_id=eq.${hotelId}` },
        () => qc.invalidateQueries({ queryKey: ["morning_sheet_pending", hotelId] }))
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [hotelId, qc]);

  async function onFile(file: File | undefined) {
    if (!file || !hotelId) return;
    if (file.type && file.type !== "application/pdf") { toast.error("Please choose the PDF room status report."); return; }
    setUploading(true);
    const t = toast.loading("Reading morning sheet…");
    try {
      const parsed = await parse({ data: { fileBase64: await toBase64(file) } });
      const { rooms, summary } = buildSheet(parsed.rooms);
      const { error } = await db.from("morning_sheet_imports").insert({
        hotel_id: hotelId, uploaded_by_name: userName, file_name: file.name,
        sheet_date: parsed.sheet_date, room_count: rooms.length, summary, payload: rooms,
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: key });
      toast.success(`Morning sheet ready · ${rooms.length} rooms`, { id: t, description: "Housekeeping can now preview and apply it." });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't read that PDF", { id: t });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function resolve(apply: boolean) {
    const sheet = pendingQ.data;
    if (!sheet) return;
    setBusy(apply ? "apply" : "discard");
    try {
      const { data, error } = await db.rpc("resolve_morning_sheet", { p_import: sheet.id, p_apply: apply, p_name: userName });
      if (error) throw error;
      setPreviewOpen(false);
      await Promise.all([qc.invalidateQueries({ queryKey: key }), qc.invalidateQueries({ queryKey: ["rooms"] })]);
      toast.success(apply ? `Applied to ${data ?? 0} rooms` : "Morning sheet discarded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  const sheet = hideBanner ? null : pendingQ.data;
  return (
    <>
      <input ref={inputRef} id={MORNING_SHEET_INPUT_ID} type="file" accept="application/pdf" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
      {uploading && !sheet && (
        <div data-morning-banner className="flex items-center gap-3 rounded-2xl border border-sidebar-border bg-sidebar px-4 py-3 text-sidebar-foreground shadow-elevation-2">
          <Loader2 className="h-4 w-4 animate-spin text-sidebar-primary" />
          <span className="text-sm">Reading morning sheet…</span>
        </div>
      )}
      {sheet && (
        <div
          data-morning-banner
          role="status"
          className="flex items-center gap-3 rounded-2xl border border-sidebar-border bg-sidebar px-3 py-2.5 sm:px-4 text-sidebar-foreground shadow-elevation-2 animate-in fade-in slide-in-from-top-2"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sidebar-primary/15 text-sidebar-primary">
            <FileText className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-semibold leading-tight">
              Morning sheet ready <span className="text-sidebar-primary">· {sheet.room_count} rooms</span>
            </p>
            <p className="truncate text-xs text-sidebar-foreground/65">
              {sheet.uploaded_by_name ?? "Someone"} · {timeOf(sheet.created_at)}
            </p>
          </div>
          <Button
            size="sm" variant="ghost" data-ios-glass
            className="shrink-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
            onClick={() => setPreviewOpen(true)}
          >
            Preview
          </Button>
          {canConfirm && (
            <Button
              size="sm"
              className="shrink-0 bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 active:scale-95"
              disabled={busy !== null}
              onClick={() => void resolve(true)}
            >
              {busy === "apply" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
            </Button>
          )}
        </div>
      )}
      {sheet && (
        <MorningSheetPreview
          open={previewOpen} onOpenChange={setPreviewOpen} sheet={sheet}
          canConfirm={canConfirm} busy={busy} onApply={() => void resolve(true)} onDiscard={() => void resolve(false)}
        />
      )}
    </>
  );
}

function MorningSheetPreview({ open, onOpenChange, sheet, canConfirm, busy, onApply, onDiscard }: {
  open: boolean; onOpenChange: (o: boolean) => void; sheet: PendingSheet; canConfirm: boolean;
  busy: "apply" | "discard" | null; onApply: () => void; onDiscard: () => void;
}) {
  const [filter, setFilter] = useState<"changes" | "all">("changes");
  const rooms = useMemo(
    () => sheet.payload.filter((r) => filter === "all" || r.kind !== "vacant" || r.dog || r.bed || r.notes),
    [sheet.payload, filter],
  );
  const s = sheet.summary;
  const chips: [string, number][] = [
    ["Turnovers", s.turnover], ["Departures", s.departure], ["Arrivals", s.arrival],
    ["Stayovers", s.stayover], ["Out of service", s.ros], ["Dogs", s.dogs], ["Guests", s.guests],
  ];
  const dateLabel = sheet.sheet_date
    ? new Date(`${sheet.sheet_date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
    : "Today";
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex max-h-[92dvh] flex-col gap-0 p-0 sm:mx-auto sm:max-w-2xl sm:rounded-t-2xl">
        <SheetHeader className="border-b px-4 pb-3 pt-4 text-left">
          <SheetTitle className="font-display">Morning sheet · {dateLabel}</SheetTitle>
          <SheetDescription className="truncate">{sheet.room_count} rooms from {sheet.file_name}</SheetDescription>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pt-2 [scrollbar-width:none]">
            {chips.filter(([, n]) => n > 0).map(([label, n]) => (
              <span key={label} className="shrink-0 rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium">
                <span className="font-semibold">{n}</span> {label}
              </span>
            ))}
          </div>
          <div className="mt-2 inline-flex self-start rounded-full border p-0.5 text-xs">
            {(["changes", "all"] as const).map((f) => (
              <button
                key={f} type="button" aria-pressed={filter === f}
                className={cn("rounded-full px-3 py-1 font-medium", filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
                onClick={() => setFilter(f)}
              >
                {f === "changes" ? "Rooms in use" : "All rooms"}
              </button>
            ))}
          </div>
        </SheetHeader>
        <ul className="flex-1 divide-y overflow-y-auto px-4">
          {rooms.map((r) => (
            <li key={r.room_number} className="flex items-start gap-3 py-2.5">
              <span className="w-8 shrink-0 pt-0.5 text-right font-display text-base font-semibold tabular-nums">{r.room_number}</span>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", KIND_CHIP[r.kind])}>{KIND_LABEL[r.kind]}</span>
                  {r.kind === "turnover" && <span className="text-xs text-muted-foreground">Dirty → Arrival once clean</span>}
                  {r.bed && <span className="rounded-full border px-2 py-0.5 text-xs capitalize">{r.bed}</span>}
                  {r.dog && <span className="inline-flex items-center gap-1 rounded-full border border-accent px-2 py-0.5 text-xs"><Dog className="h-3 w-3" />Dog</span>}
                </div>
                {(r.lead_name || r.adults + r.children + r.infants > 0) && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {[r.adults && `${r.adults} ad`, r.children && `${r.children} ch`, r.infants && `${r.infants} inf`].filter(Boolean).join(" · ")}
                    {r.lead_name && <span className="truncate">· {r.lead_name}</span>}
                    {r.night && <span>· night {r.night}</span>}
                  </p>
                )}
                {r.notes && <p className="text-xs italic">{r.notes}</p>}
              </div>
            </li>
          ))}
        </ul>
        <div className="flex gap-2 border-t px-4 pt-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          {canConfirm ? (
            <>
              <Button variant="ghost" className="flex-1" disabled={busy !== null} onClick={onDiscard}>
                {busy === "discard" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Discard"}
              </Button>
              <Button className="flex-[2]" disabled={busy !== null} onClick={onApply}>
                {busy === "apply" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply to all rooms"}
              </Button>
            </>
          ) : (
            <p className="py-2 text-sm text-muted-foreground">Housekeeping will apply this sheet.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
