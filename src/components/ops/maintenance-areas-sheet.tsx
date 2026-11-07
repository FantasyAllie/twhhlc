// Admin/manager configuration of non-room maintenance locations.
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
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
  setAreaDepartments,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  areas: MaintenanceArea[];
  addArea: (label: string) => Promise<void> | void;
  deleteArea: (id: string) => Promise<void> | void;
  setAreaDepartments?: (id: string, departments: string[]) => Promise<void> | void;
}) {
  const departments = [["housekeeping", "Housekeeping"], ["reception", "Reception"], ["fnb", "F&B"], ["maintenance", "Maintenance"]] as const;
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
          <SheetTitle>Hotel Areas</SheetTitle>
          <SheetDescription>
            Other parts of the hotel, like the bar, laundry or a wing, for logging maintenance and
            lost property that isn't in a guest room. Choose which departments can pick each one;
            with none chosen, every department can. Managers and admins always see them all.
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
              <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg border bg-background p-3">
                <span className="min-w-0 flex-1 text-sm font-medium">{a.label}</span>
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
                {setAreaDepartments && (
                  <div className="flex w-full flex-wrap gap-1" role="group" aria-label={`Departments for ${a.label}`}>
                    <Button type="button" size="sm" variant="outline" aria-pressed={!a.departments?.length}
                      className={cn("h-7 text-xs", !a.departments?.length && "border-primary bg-primary/10 text-primary hover:bg-primary/15")}
                      onClick={() => void setAreaDepartments(a.id, [])}>All departments</Button>
                    {departments.map(([key, name]) => {
                      const on = !!a.departments?.includes(key);
                      return (
                        <Button key={key} type="button" size="sm" variant="outline" aria-pressed={on}
                          className={cn("h-7 text-xs", on && "border-primary bg-primary/10 text-primary hover:bg-primary/15")}
                          onClick={() => void setAreaDepartments(a.id, departments.map(([k]) => k as string)
                            .filter((k) => (k === key ? !on : !!a.departments?.includes(k))))}>
                          {name}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
