// Date-driven print pickers for the room status sheet and the linen count.
// Past dates are served from the saved snapshot history (a rolling year);
// today always prints the live figures.
import { useState } from "react";
import { CalendarIcon, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ExportSnapshot, RoomStatusRow, SnapshotRow } from "@/lib/app-types";
import * as Exp from "@/lib/exports";

const label = (d: Date | undefined) => (d ? Exp.formatLongDate(d, true) : "Pick a date");

const DateField = ({
  value,
  onChange,
  disabledAfter,
  availableDays,
  allowToday = true,
}: {
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
  disabledAfter?: Date;
  availableDays?: Set<string>;
  allowToday?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("w-full justify-start text-left font-normal", !value && "text-muted-foreground")}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          <span className="truncate">{label(value)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => {
            onChange(d ?? undefined);
            setOpen(false);
          }}
          disabled={(d) => {
            if (d > (disabledAfter ?? new Date())) return true;
            if (!availableDays) return false;
            if (Exp.isSameDay(d, new Date())) return !allowToday;
            return !availableDays.has(d.toDateString());
          }}
          initialFocus
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
};

// Calendar days that actually have a saved snapshot of a kind, so users can
// only pick dates that will print something.
const savedDays = (snapshots: ExportSnapshot[], kind: Exp.SnapshotKind) =>
  new Set(
    snapshots
      .filter((s) => s.kind === kind)
      .map((s) => new Date(s.created_at).toDateString()),
  );

// Every calendar day in an inclusive range that has no saved snapshot of a
// kind, so users can be warned before printing an incomplete tally.
const missingDaysInRange = (
  snapshots: ExportSnapshot[],
  kind: Exp.SnapshotKind,
  start: Date,
  end: Date,
  countTodayLive: boolean,
) => {
  const saved = savedDays(snapshots, kind);
  const out: Date[] = [];
  const cursor = Exp.startOfDay(start);
  const last = Exp.startOfDay(end);
  const today = new Date();
  while (cursor.getTime() <= last.getTime()) {
    const day = new Date(cursor);
    const isToday = Exp.isSameDay(day, today);
    if (!saved.has(day.toDateString()) && !(isToday && countTodayLive) && day <= today) {
      out.push(day);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
};

// Generic single-date print picker for snapshot kinds that only ever print one
// day at a time (rejects, delivery, F&B linen).
export const SnapshotPrintDialog = ({
  open,
  onOpenChange,
  snapshots,
  kind,
  title,
  description,
  liveRows = [],
  printTotals,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  snapshots: ExportSnapshot[];
  kind: Exp.SnapshotKind;
  title: string;
  description?: string;
  liveRows?: SnapshotRow[];
  printTotals: (rows: SnapshotRow[], grand: number, when: Date, footer?: string) => void;
}) => {
  const [date, setDate] = useState<Date>(new Date());
  const available = savedDays(snapshots, kind);
  const hasLiveToday = liveRows.length > 0;
  const footer = () => `Date Printed: ${Exp.formatLongDate(new Date(), true)}`;

  const doPrint = () => {
    if (Exp.isSameDay(date, new Date()) && !available.has(date.toDateString())) {
      if (!hasLiveToday) {
        toast.error(`Nothing counted today for ${title.toLowerCase()}`);
        return;
      }
      const grand = liveRows.reduce((s, r) => s + r.count, 0);
      printTotals(liveRows, grand, new Date(), footer());
      onOpenChange(false);
      return;
    }
    const snap = Exp.snapshotForDay(snapshots, kind, date);
    const rows = (snap?.totals as SnapshotRow[] | undefined) ?? [];
    if (!snap || rows.length === 0) {
      toast.error(`No ${title.toLowerCase()} export saved for ${Exp.formatLongDate(date, false)}`);
      return;
    }
    printTotals(rows, snap.grand_total, date, footer());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ?? "Pick a date. Only days with a saved export can be selected."}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 grid gap-3">
          <DateField
            value={date}
            onChange={(d) => d && setDate(d)}
            availableDays={available}
            allowToday={hasLiveToday || available.has(new Date().toDateString())}
          />
          <p className="text-xs text-muted-foreground">
            Days without an export are greyed out.
          </p>
          <Button className="h-12" onClick={doPrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const RoomStatusPrintDialog = ({
  open,
  onOpenChange,
  snapshots,
  liveRows,
  printRoomStatus,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  snapshots: ExportSnapshot[];
  liveRows: RoomStatusRow[];
  printRoomStatus: (rows: RoomStatusRow[], when: Date) => void;
}) => {
  const [date, setDate] = useState<Date>(new Date());
  const available = savedDays(snapshots, "room_status");
  const todaySelectable = liveRows.length > 0 || available.has(new Date().toDateString());
  const doPrint = () => {
    if (Exp.isSameDay(date, new Date())) {
      if (liveRows.length === 0) {
        toast.error("No rooms to print");
        return;
      }
      printRoomStatus(liveRows, new Date());
      onOpenChange(false);
      return;
    }
    const snap = Exp.snapshotForDay(snapshots, "room_status", date);
    const rows = (snap?.totals as RoomStatusRow[] | undefined) ?? [];
    if (!snap || rows.length === 0) {
      toast.error(`No room status sheet saved for ${Exp.formatLongDate(date, false)}`);
      return;
    }
    printRoomStatus(rows, date);
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Room Status Sheet</DialogTitle>
          <DialogDescription>
            Choose a date. Today prints live; past dates print what was saved that day.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 grid gap-3">
          <DateField
            value={date}
            onChange={(d) => d && setDate(d)}
            availableDays={available}
            allowToday={todaySelectable}
          />
          <p className="text-xs text-muted-foreground">
            Days without a saved sheet are greyed out.
          </p>
          <Button className="h-12" onClick={doPrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const LinenCountPrintDialog = ({
  open,
  onOpenChange,
  snapshots,
  liveRows,
  printTotals,
  linenDeliveryDays = [],
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  snapshots: ExportSnapshot[];
  liveRows: SnapshotRow[];
  linenDeliveryDays?: number[];
  printTotals: (
    rows: SnapshotRow[],
    grand: number,
    when: Date,
    subheading?: string,
    footer?: string,
  ) => void;
}) => {
  const [mode, setMode] = useState<"single" | "range" | "delivery">("single");
  const [date, setDate] = useState<Date>(new Date());
  const [from, setFrom] = useState<Date | undefined>(undefined);
  const [to, setTo] = useState<Date | undefined>(undefined);
  const available = savedDays(snapshots, "totals");
  const window = Exp.deliveryWindow(new Date(), linenDeliveryDays);

  const footer = () => `Date Printed: ${Exp.formatLongDate(new Date(), true)}`;

  const printSingle = () => {
    if (Exp.isSameDay(date, new Date())) {
      if (liveRows.length === 0) {
        toast.error("No linen counted today");
        return;
      }
      const grand = liveRows.reduce((s, r) => s + r.count, 0);
      printTotals(liveRows, grand, new Date(), undefined, footer());
      onOpenChange(false);
      return;
    }
    const snap = Exp.snapshotForDay(snapshots, "totals", date);
    const rows = (snap?.totals as SnapshotRow[] | undefined) ?? [];
    if (!snap || rows.length === 0) {
      toast.error(`No linen count saved for ${Exp.formatLongDate(date, false)}`);
      return;
    }
    printTotals(rows, snap.grand_total, date, undefined, footer());
    onOpenChange(false);
  };

  const printRange = () => {
    if (!from || !to) {
      toast.error("Pick both dates");
      return;
    }
    const [start, end] = from.getTime() <= to.getTime() ? [from, to] : [to, from];
    const { rows, grand } = Exp.computeRangedLinenTotals(snapshots, start, end, liveRows);
    if (rows.length === 0) {
      toast.error("No linen counts recorded in that range");
      return;
    }
    const sub = `Printed Range: ${Exp.formatLongDate(start, false)} - ${Exp.formatLongDate(end, false)}`;
    printTotals(rows, grand, end, sub, footer());
    onOpenChange(false);
  };

  const printDelivery = () => {
    const { start, end } = window;
    const { rows, grand } = Exp.computeRangedLinenTotals(snapshots, start, end, liveRows);
    if (rows.length === 0) {
      toast.error("No linen counts recorded since the last delivery");
      return;
    }
    const sub = `Printed Range: ${Exp.formatLongDate(start, false)} - ${Exp.formatLongDate(end, false)}`;
    printTotals(rows, grand, end, sub, footer());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Linen Count</DialogTitle>
          <DialogDescription>
            Print a single day, or tally everything between two dates.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={mode === "single" ? "default" : "outline"}
              onClick={() => setMode("single")}
            >
              Single date
            </Button>
            <Button
              variant={mode === "range" ? "default" : "outline"}
              onClick={() => setMode("range")}
            >
              Date range
            </Button>
            <Button
              variant={mode === "delivery" ? "default" : "outline"}
              className="col-span-2"
              onClick={() => setMode("delivery")}
            >
              Last Delivery Dates
            </Button>
          </div>
          {mode === "delivery" ? (
            <>
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Range
                </div>
                <div className="mt-1 font-medium">
                  {Exp.formatLongDate(window.start, false)} - {Exp.formatLongDate(window.end, false)}
                </div>
                {linenDeliveryDays.length === 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    No delivery days set, so the last 7 days are used.
                  </p>
                )}
              </div>
              <Button className="h-12" onClick={printDelivery}>
                <Printer className="h-4 w-4 mr-2" />
                Print tally
              </Button>
            </>
          ) : mode === "single" ? (
            <>
              <DateField value={date} onChange={(d) => d && setDate(d)} availableDays={available} />
              <p className="text-xs text-muted-foreground">
                Only dates with a saved count can be selected.
              </p>
              <Button className="h-12" onClick={printSingle}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
            </>
          ) : (
            <>
              <div className="grid gap-2">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">From</span>
                <DateField value={from} onChange={setFrom} />
                <span className="text-xs uppercase tracking-wide text-muted-foreground">To</span>
                <DateField value={to} onChange={setTo} />
              </div>
              <Button className="h-12" onClick={printRange}>
                <Printer className="h-4 w-4 mr-2" />
                Print tally
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};