// Export/snapshot computation, retention and print-sheet builders.
// Extracted verbatim from src/routes/app.tsx (stage 2 of the staged refactor).
import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type {
  ExportSnapshot,
  ExportSnapshotKind,
  MaintenanceRow,
  ReceptionItem,
  RejectCount,
  Room,
  RoomCount,
  RoomExtra,
  RoomStatusRow,
  SnapshotRow,
  TemplateItem,
} from "./app-types";

export type SnapshotKind = ExportSnapshotKind;

const byName = (a: [string, number], b: [string, number]) =>
  a[0].localeCompare(b[0], undefined, { sensitivity: "base" });

const rowsFromMap = (map: Map<string, number>): { rows: SnapshotRow[]; grand: number } => {
  const rows = Array.from(map.entries())
    .sort(byName)
    .map(([name, count]) => ({ name, count }));
  return { rows, grand: rows.reduce((s, r) => s + r.count, 0) };
};

// --- Computations -----------------------------------------------------------

export const computeTotals = (
  counts: RoomCount[],
  template: TemplateItem[],
  extras: RoomExtra[],
): { rows: SnapshotRow[]; grand: number } => {
  const totals = new Map<string, number>();
  const nameFor = (c: RoomCount) => {
    if (c.item_kind === "template") return template.find((t) => t.id === c.item_id)?.name;
    return extras.find((e) => e.id === c.item_id)?.name;
  };
  for (const c of counts) {
    if (c.count <= 0) continue;
    const raw = nameFor(c);
    if (!raw) continue;
    const key = raw.trim();
    if (!key) continue;
    totals.set(key, (totals.get(key) ?? 0) + c.count);
  }
  return rowsFromMap(totals);
};

export const computeRejectTotals = (
  rejects: RejectCount[],
  template: TemplateItem[],
): { rows: SnapshotRow[]; grand: number } => {
  const totals = new Map<string, number>();
  for (const r of rejects) {
    if (r.count <= 0) continue;
    const name = template.find((t) => t.id === r.template_item_id)?.name?.trim();
    if (!name) continue;
    totals.set(name, (totals.get(name) ?? 0) + r.count);
  }
  return rowsFromMap(totals);
};

export const computeRoomStatus = (
  rooms: Room[],
  receptionStatuses: ReceptionItem[],
  receptionBeds: ReceptionItem[],
): { rows: RoomStatusRow[]; grand: number } => {
  const statusLabel = (id: string | null | undefined) => {
    if (!id) return "";
    const lbl = receptionStatuses.find((s) => s.id === id)?.label ?? "";
    if (lbl === "DND") return "Stayover";
    if (lbl.toLowerCase() === "staff") return "ROS - Staff";
    if (lbl.toLowerCase() === "dirty") return "ROS - Dirty";
    return lbl;
  };
  const bedLabel = (id: string | null | undefined) =>
    id ? receptionBeds.find((b) => b.id === id)?.label ?? "" : "";
  const rows: RoomStatusRow[] = [...rooms]
    .sort((a, b) => a.room_number - b.room_number)
    .map((r) => ({
      room: r.room_number,
      status: statusLabel(r.reception_status_id ?? r.default_status),
      bed: bedLabel(r.reception_bed_id),
      maintenance: !!r.needs_maintenance,
    }));
  return { rows, grand: rows.length };
};

export const computeMaintenance = (rooms: Room[]): { rows: MaintenanceRow[]; grand: number } => {
  const rows: MaintenanceRow[] = [...rooms]
    .filter((r) => r.needs_maintenance)
    .sort((a, b) => a.room_number - b.room_number)
    .map((r) => ({ room: r.room_number, note: (r.housekeeping_note ?? "").trim() }));
  return { rows, grand: rows.length };
};

export const computeFnbTotals = (
  templateFnbList: TemplateItem[],
  fnbCountByItem: Map<string, number>,
): { rows: SnapshotRow[]; grand: number } => {
  const rows: SnapshotRow[] = [];
  for (const item of templateFnbList) {
    const count = fnbCountByItem.get(item.id) ?? 0;
    if (count <= 0) continue;
    rows.push({ name: item.name.trim(), count });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  return { rows, grand: rows.reduce((s, r) => s + r.count, 0) };
};

// Compute the completed delivery window: the period between the two most
// recent delivery days. e.g. delivery days Mon + Fri, today Tuesday →
// Friday (inclusive) to Sunday (inclusive), and the same result on Wed/Thu.
export const deliveryWindow = (
  today: Date,
  linenDeliveryDays: number[],
): { start: Date; end: Date } => {
  const midnight = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const fallback = () => {
    const end = midnight(today);
    end.setDate(end.getDate() - 1);
    end.setHours(23, 59, 59, 999);
    const start = midnight(today);
    start.setDate(start.getDate() - 7);
    return { start, end };
  };
  if (linenDeliveryDays.length === 0) return fallback();
  const todayDow = today.getDay();
  // Most recent delivery day at or before today.
  let anchorOffset: number | null = null;
  for (let offset = 0; offset <= 13; offset++) {
    if (linenDeliveryDays.includes((todayDow - offset + 7) % 7)) {
      anchorOffset = offset;
      break;
    }
  }
  // Delivery day before that anchor.
  let prevOffset: number | null = null;
  if (anchorOffset !== null) {
    for (let offset = anchorOffset + 1; offset <= anchorOffset + 14; offset++) {
      if (linenDeliveryDays.includes((todayDow - offset + 7) % 7)) {
        prevOffset = offset;
        break;
      }
    }
  }
  if (anchorOffset === null || prevOffset === null) return fallback();
  const start = midnight(today);
  start.setDate(start.getDate() - prevOffset);
  const end = midnight(today);
  end.setDate(end.getDate() - anchorOffset - 1);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const sumSnapshotsInRange = (
  snapshots: ExportSnapshot[],
  kind: SnapshotKind,
  start: Date,
  end: Date,
) => {
  const map = new Map<string, number>();
  for (const s of snapshots) {
    if (s.kind !== kind) continue;
    const ts = new Date(s.created_at).getTime();
    if (ts < start.getTime() || ts > end.getTime()) continue;
    const list = (s.totals as SnapshotRow[] | null) ?? [];
    for (const r of list) {
      const key = (r.name ?? "").trim();
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + (r.count ?? 0));
    }
  }
  return rowsFromMap(map);
};

export const computeDeliveryLinenTotals = (
  snapshots: ExportSnapshot[],
  linenDeliveryDays: number[],
): { rows: SnapshotRow[]; grand: number; start: Date; end: Date } => {
  const { start, end } = deliveryWindow(new Date(), linenDeliveryDays);
  const { rows, grand } = sumSnapshotsInRange(snapshots, "totals", start, end);
  return { rows, grand, start, end };
};

// Roll up daily F&B linen snapshots for the previous ISO week (last Mon 00:00
// through last Sun 23:59). Only meaningful on Mondays; the button is gated
// to Monday elsewhere.
export const computeWeeklyFnbTotals = (
  snapshots: ExportSnapshot[],
): { rows: SnapshotRow[]; grand: number; start: Date; end: Date } => {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const dow = start.getDay(); // 0 = Sun, 1 = Mon
  const daysSinceMonday = dow === 0 ? 6 : dow - 1;
  // Start of THIS week's Monday, then step back 7 days = last Monday.
  start.setDate(start.getDate() - daysSinceMonday - 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  const { rows, grand } = sumSnapshotsInRange(snapshots, "fnb_totals", start, end);
  return { rows, grand, start, end };
};

// --- Date formatting -------------------------------------------------------

export const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

export const formatLongDate = (d: Date, withYear: boolean) => {
  const weekday = d.toLocaleDateString(undefined, { weekday: "long" });
  const month = d.toLocaleDateString(undefined, { month: "long" });
  return withYear
    ? `${weekday} ${ordinal(d.getDate())} ${month}, ${d.getFullYear()}`
    : `${weekday} ${ordinal(d.getDate())} ${month}`;
};

export const formatShortDate = (d: Date) =>
  d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

// --- Snapshot persistence --------------------------------------------------

// Retention: one snapshot per day, per kind. History keeps 7 days; F&B linen
// keeps longer because the Monday roll-up sums the whole previous week.
export const retentionDaysFor = (kind: SnapshotKind) => (kind === "fnb_totals" ? 16 : 7);

export const pruneSnapshots = async (kind: SnapshotKind) => {
  const { data } = await supabase
    .from("export_snapshots")
    .select("id,created_at")
    .eq("kind", kind)
    .order("created_at", { ascending: false })
    .limit(500);
  if (!data) return;
  const maxDays = retentionDaysFor(kind);
  const days = new Set<string>();
  const keep = new Set<string>();
  for (const r of data) {
    const day = new Date(r.created_at).toDateString();
    // Only the most recent snapshot of each day survives.
    if (days.has(day)) continue;
    if (days.size >= maxDays) continue;
    days.add(day);
    keep.add(r.id);
  }
  const remove = data.filter((r) => !keep.has(r.id)).map((r) => r.id);
  if (remove.length > 0) {
    await supabase.from("export_snapshots").delete().in("id", remove);
  }
};

// Writes today's snapshot for a kind, replacing any snapshot of that kind
// already stored today (queried straight from the database so a stale cache
// can never leave duplicates behind), then prunes old days.
export const saveSnapshot = async (
  qc: QueryClient,
  kind: SnapshotKind,
  rows: unknown[],
  grand: number,
): Promise<boolean> => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const { data: existing } = await supabase
    .from("export_snapshots")
    .select("id")
    .eq("kind", kind)
    .gte("created_at", startOfToday.toISOString());
  if (existing && existing.length > 0) {
    const ids = existing.map((r) => r.id);
    qc.setQueryData<ExportSnapshot[]>(["export_snapshots"], (old) =>
      old?.filter((s) => !ids.includes(s.id)) ?? [],
    );
    const { error: delErr } = await supabase.from("export_snapshots").delete().in("id", ids);
    if (delErr) {
      toast.error(delErr.message);
      return false;
    }
  }
  const { error } = await supabase
    .from("export_snapshots")
    .insert({ totals: rows, grand_total: grand, kind } as never);
  if (error) {
    toast.error(error.message);
    return false;
  }
  await pruneSnapshots(kind);
  return true;
};

// --- Print sheets ----------------------------------------------------------

const esc = (s: string) =>
  s.replace(/[<>&]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[ch]!);

const longDate = (when: Date) =>
  when.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

export const printTotals = (
  hotelName: string,
  rows: SnapshotRow[],
  grand: number,
  when: Date,
  kind: "totals" | "rejects" | "fnb_totals" = "totals",
  subheading?: string,
  footer?: string,
) => {
  const dateStr = longDate(when);
  const heading =
    kind === "rejects"
      ? `${hotelName} Linen Rejects`
      : kind === "fnb_totals"
        ? `${hotelName} F&B Linen`
        : `${hotelName} Linen`;
  const win = window.open("", "_blank");
  if (!win) {
    toast.error("Pop-up blocked");
    return;
  }
  const tableRows = rows
    .map((r) => `<tr><td>${esc(r.name)}</td><td class="num">${r.count}</td></tr>`)
    .join("");
  win.document.write(`<!doctype html><html><head><title>${esc(heading)} - ${dateStr}</title><style>
      body{font-family:system-ui,-apple-system,sans-serif;color:#000;background:#fff;padding:2rem;max-width:640px;margin:0 auto;}
      h1{font-size:1.5rem;margin:0 0 .25rem;}
      .date{color:#444;margin:0 0 1.5rem;font-size:.95rem;}
      table{width:100%;border-collapse:collapse;font-size:1rem;}
      th,td{text-align:left;padding:.5rem .75rem;border-bottom:1px solid #ccc;}
      th.num,td.num{text-align:right;font-variant-numeric:tabular-nums;}
      tfoot td{font-weight:600;border-top:2px solid #000;border-bottom:none;padding-top:.75rem;}
      @media print{body{padding:0;}}
    </style></head><body>
      <h1>${esc(heading)}</h1>
      <p class="date">${subheading ? esc(subheading) : dateStr}</p>
      <table>
        <thead><tr><th>Item</th><th class="num">Count</th></tr></thead>
        <tbody>${tableRows}</tbody>
        <tfoot><tr><td>Total</td><td class="num">${grand}</td></tr></tfoot>
      </table>
      ${footer ? `<p class="date" style="margin-top:1.5rem;">${esc(footer)}</p>` : ""}
      <script>window.onload=()=>{window.print();}</script>
    </body></html>`);
  win.document.close();
};

export const printRoomStatus = (rows: RoomStatusRow[], when: Date) => {
  const dateStr = longDate(when);
  const win = window.open("", "_blank");
  if (!win) {
    toast.error("Pop-up blocked");
    return;
  }
  const half = Math.ceil(rows.length / 2);
  const left = rows.slice(0, half);
  const right = rows.slice(half);
  const trs = (list: RoomStatusRow[]) =>
    list
      .map(
        (r) =>
          `<tr><td class="num">${r.room}</td><td>${esc(r.status)}</td><td>${esc(r.bed)}</td></tr>`,
      )
      .join("");
  const tableHead = `<thead><tr><th>Room</th><th>Status</th><th>Set As</th></tr></thead>`;
  win.document.write(`<!doctype html><html><head><title>Room Status Sheet - ${dateStr}</title><style>
      body{font-family:system-ui,-apple-system,sans-serif;color:#000;background:#fff;padding:1.5rem;max-width:900px;margin:0 auto;}
      h1{font-size:1.5rem;margin:0 0 .25rem;text-align:center;text-decoration:underline;}
      .date{margin:0 0 1.25rem;font-size:.95rem;text-align:center;}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem;}
      table{width:100%;border-collapse:collapse;font-size:.95rem;}
      th,td{text-align:center;padding:.35rem .5rem;border:1px solid #444;}
      th.num,td.num{text-align:center;font-variant-numeric:tabular-nums;width:3rem;}
      th{background:#eee;}
      @media print{body{padding:0;}}
    </style></head><body>
      <h1>Room Status Sheet</h1>
      <p class="date">${dateStr}</p>
      <div class="grid">
        <table>${tableHead}<tbody>${trs(left)}</tbody></table>
        <table>${tableHead}<tbody>${trs(right)}</tbody></table>
      </div>
      <script>window.onload=()=>{window.print();}</script>
    </body></html>`);
  win.document.close();
};

export const printMaintenance = (when: Date, list: MaintenanceRow[]) => {
  if (list.length === 0) {
    toast.error("No rooms marked for maintenance");
    return;
  }
  const dateStr = longDate(when);
  const win = window.open("", "_blank");
  if (!win) {
    toast.error("Pop-up blocked");
    return;
  }
  const trs = list
    .map(
      (r) =>
        `<tr><td class="num">${r.room}</td><td>${r.note ? esc(r.note) : '<span class="muted">—</span>'}</td></tr>`,
    )
    .join("");
  win.document.write(`<!doctype html><html><head><title>Maintenance List - ${dateStr}</title><style>
      body{font-family:system-ui,-apple-system,sans-serif;color:#000;background:#fff;padding:1.5rem;max-width:900px;margin:0 auto;}
      h1{font-size:1.5rem;margin:0 0 .25rem;text-align:center;text-decoration:underline;}
      .date{margin:0 0 1.25rem;font-size:.95rem;text-align:center;}
      table{width:100%;border-collapse:collapse;font-size:.95rem;}
      th,td{text-align:left;padding:.45rem .6rem;border:1px solid #444;vertical-align:top;}
      th.num,td.num{text-align:center;font-variant-numeric:tabular-nums;width:4rem;}
      th{background:#eee;}
      .muted{color:#666;}
      @media print{body{padding:0;}}
    </style></head><body>
      <h1>Maintenance List</h1>
      <p class="date">${dateStr}</p>
      <table><thead><tr><th class="num">Room</th><th>Maintenance note</th></tr></thead><tbody>${trs}</tbody></table>
      <script>window.onload=()=>{window.print();}</script>
    </body></html>`);
  win.document.close();
};
