// Inventory: Delivery, Bedrooms (per room) and Cupboards (per floor) linen
// counts. Every row has -/+ for single steps, an editable total, and an
// "add amount" box that adds a typed number onto the total.
import React from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COLOR_SWATCHES } from "@/lib/app-format";
import type { TemplateItem } from "@/lib/app-types";

export type InventorySection = "delivery" | "room" | "cupboard";

export const CUPBOARDS: { key: string; label: string }[] = [
  { key: "ground", label: "Ground Floor" },
  { key: "20s", label: "20's" },
  { key: "30s", label: "30's" },
  { key: "40s", label: "40's" },
  { key: "laundry", label: "Laundry" },
];

const rowStyle = (item: TemplateItem, theme: string | undefined): React.CSSProperties | undefined => {
  const c = item.color ? COLOR_SWATCHES[item.color] : null;
  return c ? { backgroundColor: theme === "dark" ? c.darkBg : c.bg } : undefined;
};
const textStyle = (item: TemplateItem, theme: string | undefined) =>
  item.color ? { color: theme === "dark" ? "#f8fafc" : "#0f172a" } : undefined;

function CountRow({
  item,
  theme,
  count,
  setCount,
}: {
  item: TemplateItem;
  theme: string | undefined;
  count: number;
  setCount: (value: number) => void;
}) {
  const [add, setAdd] = React.useState("");
  const [total, setTotal] = React.useState(String(count));
  const [editing, setEditing] = React.useState(false);
  React.useEffect(() => {
    if (!editing) setTotal(String(count));
  }, [count, editing]);
  const addN = Number(add);
  const canAdd = add.trim() !== "" && Number.isFinite(addN) && addN !== 0;
  const applyAdd = () => {
    if (!canAdd) return;
    setCount(Math.max(0, count + Math.trunc(addN)));
    setAdd("");
  };
  const commitTotal = () => {
    setEditing(false);
    const n = Number(total);
    if (total.trim() === "" || !Number.isFinite(n)) {
      setTotal(String(count));
      return;
    }
    const next = Math.max(0, Math.floor(n));
    if (next !== count) setCount(next);
  };
  return (
    <li className="rounded-xl border p-2 space-y-2" style={rowStyle(item, theme)}>
      <div className="flex items-center gap-2">
        <span className="flex-1 min-w-0 break-words font-medium" style={textStyle(item, theme)}>
          {item.name}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 sm:h-9 sm:w-9 shrink-0"
          onClick={() => setCount(Math.max(0, count - 1))}
          disabled={count === 0}
          aria-label={`Remove one ${item.name}`}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          value={total}
          onFocus={(e) => {
            setEditing(true);
            e.currentTarget.select();
          }}
          onChange={(e) => setTotal(e.target.value)}
          onBlur={commitTotal}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
          }}
          className="h-10 sm:h-9 w-16 shrink-0 text-center tabular-nums font-semibold bg-background"
          aria-label={`Total ${item.name}`}
        />
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 sm:h-9 sm:w-9 shrink-0"
          onClick={() => setCount(count + 1)}
          aria-label={`Add one ${item.name}`}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center gap-2 justify-end">
        <Input
          type="number"
          inputMode="numeric"
          value={add}
          placeholder="Amount"
          onChange={(e) => setAdd(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              applyAdd();
            }
          }}
          className="h-10 sm:h-9 w-24 text-center tabular-nums bg-background"
          aria-label={`Amount to add to ${item.name}`}
        />
        <Button
          variant="secondary"
          className="h-10 sm:h-9 shrink-0"
          onClick={applyAdd}
          disabled={!canAdd}
        >
          Add to total
        </Button>
      </div>
    </li>
  );
}

export function InventoryDialog({
  open,
  onOpenChange,
  template,
  theme,
  roomNumbers,
  getCount,
  setCount,
  onResetSection,
  onExportDelivery,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  template: TemplateItem[];
  theme: string | undefined;
  roomNumbers: number[];
  getCount: (section: InventorySection, location: string, itemId: string) => number;
  setCount: (section: InventorySection, location: string, itemId: string, value: number) => void;
  onResetSection: (section: InventorySection, location: string) => void;
  onExportDelivery: () => void;
}) {
  const [section, setSection] = React.useState<InventorySection>("delivery");
  const [room, setRoom] = React.useState<string>("");
  const [cupboard, setCupboard] = React.useState<string>(CUPBOARDS[0].key);
  React.useEffect(() => {
    if (!room && roomNumbers.length) setRoom(String(roomNumbers[0]));
  }, [room, roomNumbers]);

  const location = section === "delivery" ? "" : section === "room" ? room : cupboard;
  const total = template.reduce((s, t) => s + getCount(section, location, t.id), 0);
  const locationLabel =
    section === "delivery"
      ? "delivery"
      : section === "room"
        ? `Room ${room}`
        : (CUPBOARDS.find((c) => c.key === cupboard)?.label ?? "");

  const tabs: { key: InventorySection; label: string }[] = [
    { key: "delivery", label: "Delivery" },
    { key: "room", label: "Bedrooms" },
    { key: "cupboard", label: "Cupboards" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100vw-1.5rem)] sm:w-full p-4 sm:p-6 h-[90dvh] sm:h-auto sm:max-h-[85dvh] flex flex-col gap-3">
        <DialogHeader className="shrink-0">
          <DialogTitle>Inventory</DialogTitle>
          <DialogDescription>
            Count linen delivered, in each bedroom, and in each floor's cupboard
          </DialogDescription>
        </DialogHeader>

        <div className="inline-flex w-full justify-center rounded-full border p-1 bg-background items-center shrink-0">
          {tabs.map((tab) => {
            const active = section === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSection(tab.key)}
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

        {section === "room" && (
          <Select value={room} onValueChange={setRoom}>
            <SelectTrigger className="shrink-0" aria-label="Room">
              <SelectValue placeholder="Choose a room" />
            </SelectTrigger>
            <SelectContent>
              {roomNumbers.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  Room {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {section === "cupboard" && (
          <div className="flex flex-wrap gap-1.5 shrink-0">
            {CUPBOARDS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCupboard(c.key)}
                className={
                  "px-3 h-8 text-xs sm:text-sm rounded-full border transition-colors " +
                  (cupboard === c.key
                    ? "bg-primary text-primary-foreground border-primary font-medium"
                    : "bg-background text-muted-foreground hover:text-foreground")
                }
              >
                {c.label}
              </button>
            ))}
          </div>
        )}

        {template.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No linen items yet. Add some from the Linen List.
          </p>
        ) : section === "room" && !room ? (
          <p className="text-sm text-muted-foreground py-4">No rooms set up yet.</p>
        ) : (
          <div className="border rounded-xl bg-muted/30 flex flex-col min-h-0 flex-1 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto p-3">
              <ul className="space-y-2">
                {template.map((item) => (
                  <CountRow
                    key={`${section}|${location}|${item.id}`}
                    item={item}
                    theme={theme}
                    count={getCount(section, location, item.id)}
                    setCount={(v) => setCount(section, location, item.id, v)}
                  />
                ))}
              </ul>
            </div>
            <div className="flex items-center justify-between gap-2 border-t bg-background/60 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Total: {total}</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm(`Reset all counts for ${locationLabel}?`)) onResetSection(section, location);
                  }}
                >
                  Reset
                </Button>
                {section === "delivery" && (
                  <Button variant="outline" size="sm" onClick={onExportDelivery}>
                    Export
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
