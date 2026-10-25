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
import { COLOR_SWATCHES } from "@/lib/app-format";
import type { TemplateItem } from "@/lib/app-types";

export type InventorySection = "delivery" | "rejects" | "room" | "cupboard";

const rowStyle = (item: TemplateItem, theme: string | undefined): React.CSSProperties | undefined => {
  const c = item.color ? COLOR_SWATCHES[item.color] : null;
  return c ? { backgroundColor: theme === "dark" ? c.darkBg : c.bg } : undefined;
};
const textStyle = (item: TemplateItem, theme: string | undefined) =>
  item.color ? { color: theme === "dark" ? "#f8fafc" : "#0f172a" } : undefined;

export function CountRow({
  item,
  theme,
  count,
  setCount,
  preferred,
}: {
  item: TemplateItem;
  theme: string | undefined;
  count: number;
  setCount: (value: number) => void;
  preferred?: boolean;
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
    <li className="@container rounded-xl border p-2" style={rowStyle(item, theme)}>
      {/* Phones keep the name centred above the controls; wider rows put the
          name on the left and the counting controls on the right. */}
      <div className="flex flex-col items-center gap-2 @lg:grid @lg:grid-cols-[minmax(0,1fr)_auto] @lg:items-center @lg:gap-4">
        <span className="w-full text-center break-words font-medium @lg:text-left" style={textStyle(item, theme)}>
          {item.name}
          {preferred && <span className="ml-2 text-xs font-semibold opacity-70">(Preferred)</span>}
        </span>
        <div className="flex w-full flex-wrap items-center justify-center gap-1.5 @lg:w-auto @lg:flex-nowrap @lg:justify-end">

        <Input
          type="number"
          inputMode="numeric"
          value={add}
          placeholder="0"
          onChange={(e) => setAdd(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              applyAdd();
            }
          }}
          className="h-10 sm:h-9 w-14 shrink-0 px-1 text-center tabular-nums bg-background"
          aria-label={`Amount to add to ${item.name}`}
        />
        <Button
          variant="secondary"
          className="h-10 sm:h-9 shrink-0 px-2"
          onClick={applyAdd}
          disabled={!canAdd}
        >
          Add
        </Button>
        <div className="flex items-center gap-1.5">
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
        </div>
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
  onExport,
  isRoomDefault,
  isPreferred,
  cupboards,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  template: TemplateItem[];
  theme: string | undefined;
  roomNumbers: number[];
  cupboards: { key: string; label: string }[];
  getCount: (section: InventorySection, location: string, itemId: string) => number;
  setCount: (section: InventorySection, location: string, itemId: string, value: number) => void;
  onResetSection: (section: InventorySection, location: string) => void;
  onExport: () => void;
  isRoomDefault: (itemId: string, room: number) => boolean;
  isPreferred: (itemId: string, room: number) => boolean;
}) {
  const [section, setSection] = React.useState<InventorySection>("delivery");
  const [room, setRoom] = React.useState<string>("");
  const [showAllLinen, setShowAllLinen] = React.useState(false);
  const [selectedCupboard, setCupboard] = React.useState<string>("");
  const cupboard = cupboards.some((c) => c.key === selectedCupboard) ? selectedCupboard : (cupboards[0]?.key ?? "");

  const location = section === "delivery" || section === "rejects" ? "" : section === "room" ? room : cupboard;
  const locationLabel =
    section === "delivery"
      ? "delivery"
      : section === "rejects"
        ? "rejects"
        : section === "room"
        ? `Room ${room}`
        : (cupboards.find((c) => c.key === cupboard)?.label ?? "");

  const sumAt = (sec: InventorySection, loc: string) =>
    template.reduce((acc, t) => acc + getCount(sec, loc, t.id), 0);
  const sectionTotal =
    section === "delivery" || section === "rejects"
      ? sumAt(section, "")
      : section === "room"
        ? roomNumbers.reduce((acc, n) => acc + sumAt("room", String(n)), 0)
        : cupboards.reduce((acc, c) => acc + sumAt("cupboard", c.key), 0);
  const resetLocation = section === "room" && !room ? "*" : location;
  const resetLabel = resetLocation === "*" ? "every bedroom" : locationLabel;

  const tabs: { key: InventorySection; label: string }[] = [
    { key: "delivery", label: "Delivery" },
    { key: "rejects", label: "Rejects" },
    { key: "room", label: "Bedrooms" },
    { key: "cupboard", label: "Cupboards" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100vw-1.5rem)] sm:w-full lg:max-w-2xl p-4 sm:p-6 h-[90dvh] sm:h-auto sm:max-h-[85dvh] flex flex-col gap-4">
        <DialogHeader className="shrink-0">
          <DialogTitle>Inventory</DialogTitle>
          <DialogDescription>
            Count linen delivered, rejected, in each bedroom, and in each floor's cupboard
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

        {section === "cupboard" && (
          <div className="inline-flex w-full rounded-full border p-1 bg-background items-center shrink-0 overflow-x-auto mt-1">
            {cupboards.map((c) => (
              <Button
                variant="ghost"
                key={c.key}
                type="button"
                onClick={() => setCupboard(c.key)}
                aria-pressed={cupboard === c.key}
                className={
                  "flex-1 px-2 sm:px-3 h-8 text-xs sm:text-sm rounded-full transition-colors whitespace-nowrap " +
                  (cupboard === c.key
                    ? "bg-primary text-primary-foreground shadow-sm font-medium"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {c.label}
              </Button>
            ))}
          </div>
        )}

        {section === "cupboard" && !cupboard ? <p className="py-4 text-sm text-muted-foreground">No cupboards yet.</p> : template.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No linen items yet. Add some from the Linen List.
          </p>
        ) : section === "room" ? (
          roomNumbers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No rooms set up yet.</p>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto mt-1">
              <div className="grid grid-cols-3 gap-2">
                {roomNumbers.flatMap((n, i) => {
                  const key = String(n);
                  const active = room === key;
                  const roomTotal = template.reduce((s, t) => s + getCount("room", key, t.id), 0);
                  const out: React.ReactNode[] = [
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        setRoom(active ? "" : key);
                        setShowAllLinen(false);
                      }}
                      aria-expanded={active}
                      className={
                        "h-14 rounded-xl border flex flex-col items-center justify-center transition-colors " +
                        (active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-muted")
                      }
                    >
                      <span className="font-semibold">Room {n}</span>
                      <span className="text-xs opacity-70 tabular-nums">{roomTotal} items</span>
                    </button>,
                  ];
                  const rowEnd = i % 3 === 2 || i === roomNumbers.length - 1;
                  const rowStart = i - (i % 3);
                  const selectedInRow = roomNumbers
                    .slice(rowStart, rowStart + 3)
                    .some((x) => String(x) === room);
                  if (rowEnd && selectedInRow) {
                    out.push(
                      <div key={`list-${room}`} className="col-span-3 border rounded-xl bg-muted/30 p-2 space-y-2">
                        {(() => {
                          const rn = Number(room);
                          const list = template.filter(
                            (t) => showAllLinen || isRoomDefault(t.id, rn) || getCount("room", room, t.id) > 0,
                          );
                          return (
                            <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => setShowAllLinen((v) => !v)}
                        >
                          {showAllLinen ? "Show room's default linen" : "Show all linen"}
                        </Button>
                        {list.length === 0 && (
                          <p className="text-sm text-muted-foreground px-1 py-2">
                            No default linen set for this room.
                          </p>
                        )}
                        <ul className="space-y-2">
                          {list.map((item) => (
                            <CountRow
                              key={`room|${room}|${item.id}`}
                              item={item}
                              theme={theme}
                              count={getCount("room", room, item.id)}
                              setCount={(v) => setCount("room", room, item.id, v)}
                              preferred={isPreferred(item.id, Number(room))}
                            />
                          ))}
                        </ul>
                            </>
                          );
                        })()}
                      </div>,
                    );
                  }
                  return out;
                })}
              </div>
            </div>
          )
        ) : (
          <div className="border rounded-xl bg-muted/30 flex flex-col min-h-0 flex-1 overflow-hidden mt-1">
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
          </div>
        )}
        <div className="shrink-0 mt-[5px] flex items-center justify-between gap-2 border rounded-xl bg-background/60 px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            {section === "delivery" ? "Delivery" : section === "rejects" ? "Rejects" : section === "room" ? "Bedrooms" : "Cupboards"} total:{" "}
            <span className="font-semibold text-foreground tabular-nums">{sectionTotal}</span>
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={section === "cupboard" && !cupboard}
              onClick={() => {
                if (confirm(`Reset all counts for ${resetLabel}?`)) onResetSection(section, resetLocation);
              }}
            >
              Reset
            </Button>
            <Button variant="outline" size="sm" onClick={onExport}>
              Export
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
