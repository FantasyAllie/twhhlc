// Admin/manager configuration of non-room maintenance locations.
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { MaintenanceArea } from "@/lib/app-types";

export function MaintenanceAreasSheet({
  open,
  onOpenChange,
  areas,
  addArea,
  deleteArea,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  areas: MaintenanceArea[];
  addArea: (label: string) => Promise<void> | void;
  deleteArea: (id: string) => Promise<void> | void;
}) {
  const [label, setLabel] = useState("");
  const submit = async () => {
    const v = label.trim();
    if (!v) return;
    await addArea(v);
    setLabel("");
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="overflow-y-auto rounded-t-2xl p-4 sm:p-6">
        <SheetHeader className="text-left">
          <SheetTitle>Maintenance areas</SheetTitle>
          <SheetDescription>
            Add other parts of the hotel — lobby, kitchen, car park — so anyone can log an issue
            that isn't tied to a guest room.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 flex gap-2">
          <Input
            placeholder="e.g. Reception lobby"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void submit();
              }
            }}
          />
          <Button type="button" onClick={() => void submit()}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
        <div className="mt-4 space-y-2">
          {areas.length === 0 ? (
            <p className="text-sm text-muted-foreground">No areas added yet.</p>
          ) : (
            areas.map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-lg border bg-background p-3">
                <span className="flex-1 text-sm">{a.label}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => void deleteArea(a.id)}
                  aria-label={`Remove ${a.label}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
