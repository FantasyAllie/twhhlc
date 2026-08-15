// Rejects (+/- stepper) and Delivery (number entry) linen counter dialogs.
// Extracted verbatim from src/routes/app.tsx (stage 5).
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

const rowStyle = (
  item: TemplateItem,
  theme: string | undefined,
): React.CSSProperties | undefined => {
  const c = item.color ? COLOR_SWATCHES[item.color] : null;
  return c ? { backgroundColor: theme === "dark" ? c.darkBg : c.bg } : undefined;
};

const textStyle = (item: TemplateItem, theme: string | undefined) =>
  item.color ? { color: theme === "dark" ? "#f8fafc" : "#0f172a" } : undefined;

const shellClass =
  "max-w-md w-[calc(100vw-1.5rem)] sm:w-full p-4 sm:p-6 h-[90dvh] sm:h-auto sm:max-h-[85dvh] flex flex-col gap-3";

export function RejectsDialog({
  open,
  onOpenChange,
  template,
  theme,
  total,
  getRejectCount,
  updateRejectCount,
  onResetAll,
  onExport,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  template: TemplateItem[];
  theme: string | undefined;
  total: number;
  getRejectCount: (itemId: string) => number;
  updateRejectCount: (itemId: string, delta: number) => void;
  onResetAll: () => void;
  onExport: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={shellClass}>
        <DialogHeader className="shrink-0">
          <DialogTitle>Rejects</DialogTitle>
          <DialogDescription>
            Tally all linen rejects before sending back to be cleaned
          </DialogDescription>
        </DialogHeader>
        {template.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No linen items yet. Add some from the Linen List.
          </p>
        ) : (
          <div className="border rounded-xl bg-muted/30 flex flex-col min-h-0 flex-1 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              <ul className="space-y-1">
                {template.map((item) => {
                  const count = getRejectCount(item.id);
                  return (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 py-2 px-2 rounded-xl border"
                      style={rowStyle(item, theme)}
                    >
                      <span className="flex-1 min-w-0 break-words" style={textStyle(item, theme)}>
                        {item.name}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-10 w-10 sm:h-8 sm:w-8"
                          onClick={() => updateRejectCount(item.id, -1)}
                          disabled={count === 0}
                          aria-label={`Decrease ${item.name}`}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span
                          className="w-10 sm:w-8 text-center tabular-nums font-medium"
                          style={textStyle(item, theme)}
                        >
                          {count}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-10 w-10 sm:h-8 sm:w-8"
                          onClick={() => updateRejectCount(item.id, 1)}
                          aria-label={`Increase ${item.name}`}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="flex items-center justify-between gap-2 border-t bg-background/60 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Total: {total}</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={onResetAll}
                >
                  Reset all
                </Button>
                <Button variant="outline" size="sm" onClick={onExport}>
                  Export
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function DeliveryDialog({
  open,
  onOpenChange,
  template,
  theme,
  total,
  getDeliveryCount,
  setDeliveryCount,
  onResetAll,
  onExport,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  template: TemplateItem[];
  theme: string | undefined;
  total: number;
  getDeliveryCount: (itemId: string) => number;
  setDeliveryCount: (itemId: string, value: number) => void | Promise<void>;
  onResetAll: () => void;
  onExport: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={shellClass}>
        <DialogHeader className="shrink-0">
          <DialogTitle>Delivery</DialogTitle>
          <DialogDescription>
            Enter the quantity delivered for each linen item
          </DialogDescription>
        </DialogHeader>
        {template.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No linen items yet. Add some from the Linen List.
          </p>
        ) : (
          <div className="border rounded-xl bg-muted/30 flex flex-col min-h-0 flex-1 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              <ul className="space-y-1">
                {template.map((item) => {
                  const count = getDeliveryCount(item.id);
                  return (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 py-2 px-2 rounded-xl border"
                      style={rowStyle(item, theme)}
                    >
                      <span className="flex-1 min-w-0 break-words" style={textStyle(item, theme)}>
                        {item.name}
                      </span>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={count === 0 ? "" : String(count)}
                        placeholder="0"
                        onChange={(e) => void setDeliveryCount(item.id, Number(e.target.value))}
                        onFocus={(e) => e.currentTarget.select()}
                        className="h-10 sm:h-9 w-20 shrink-0 text-center tabular-nums bg-background"
                        aria-label={`Delivered ${item.name}`}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="flex items-center justify-between gap-2 border-t bg-background/60 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Total: {total}</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={onResetAll}
                >
                  Reset all
                </Button>
                <Button variant="outline" size="sm" onClick={onExport}>
                  Export
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
