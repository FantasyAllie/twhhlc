import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Bed, Check, ConciergeBell, List, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export type ConfigItem = { id: string; label: string };

export function ManageEditableRow({
  label,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onRename,
  onDelete,
}: {
  label: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRename: (v: string) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  useEffect(() => {
    if (!editing) setDraft(label);
  }, [label, editing]);
  const commit = () => {
    const clean = draft.trim();
    if (clean && clean !== label) void onRename(clean);
    setEditing(false);
  };
  return (
    <div className="flex items-center gap-1 rounded-xl border bg-background shadow-sm min-h-12 pl-2 pr-1.5">
      <div className="flex flex-col">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-5 w-7 text-muted-foreground"
          onClick={onMoveUp}
          disabled={!canMoveUp}
          aria-label="Move up"
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-5 w-7 text-muted-foreground"
          onClick={onMoveDown}
          disabled={!canMoveDown}
          aria-label="Move down"
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </Button>
      </div>
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setDraft(label);
              setEditing(false);
            }
          }}
          className="flex-1 min-w-0 bg-transparent text-sm font-medium outline-none px-2 py-1 rounded-xl border border-input focus:ring-1 focus:ring-ring"
        />
      ) : (
        <span className="flex-1 text-sm font-medium pl-2 truncate">{label}</span>
      )}
      {editing ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground"
          onClick={commit}
          aria-label="Save name"
        >
          <Check className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground"
          onClick={() => setEditing(true)}
          aria-label={`Rename ${label}`}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-muted-foreground hover:text-destructive"
        onClick={onDelete}
        aria-label={`Remove ${label}`}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function ManageList({
  items,
  emptyText,
  onMove,
  onRename,
  onDelete,
}: {
  items: ConfigItem[];
  emptyText: string;
  onMove: (id: string, dir: -1 | 1) => void;
  onRename: (id: string, v: string) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }
  return (
    <>
      {items.map((it, idx) => (
        <ManageEditableRow
          key={it.id}
          label={it.label}
          canMoveUp={idx > 0}
          canMoveDown={idx < items.length - 1}
          onMoveUp={() => onMove(it.id, -1)}
          onMoveDown={() => onMove(it.id, 1)}
          onRename={(v: string) => onRename(it.id, v)}
          onDelete={() => onDelete(it.id)}
        />
      ))}
    </>
  );
}

export function RoomTypesSheet({
  open,
  onOpenChange,
  roomTypes,
  onMove,
  onRename,
  onDelete,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  roomTypes: ConfigItem[];
  onMove: (id: string, dir: -1 | 1) => void;
  onRename: (id: string, v: string) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onAdd: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="overflow-y-auto p-4 sm:p-6">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <Bed className="h-4 w-4" />
            Room types
          </SheetTitle>
          <SheetDescription>Manage the list of room types</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-1.5">
          <ManageList
            items={roomTypes}
            emptyText="No room types yet."
            onMove={onMove}
            onRename={onRename}
            onDelete={onDelete}
          />
          <Button type="button" variant="outline" className="w-full mt-2" onClick={onAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add room type
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function RoomFeaturesSheet({
  open,
  onOpenChange,
  roomFeatures,
  onMove,
  onRename,
  onDelete,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  roomFeatures: ConfigItem[];
  onMove: (id: string, dir: -1 | 1) => void;
  onRename: (id: string, v: string) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onAdd: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="overflow-y-auto p-4 sm:p-6">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <List className="h-4 w-4" />
            Features &amp; Amenities
          </SheetTitle>
          <SheetDescription>Manage the list of features and amenities</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-1.5">
          <ManageList
            items={roomFeatures}
            emptyText="No features yet."
            onMove={onMove}
            onRename={onRename}
            onDelete={onDelete}
          />
          <Button type="button" variant="outline" className="w-full mt-2" onClick={onAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add feature
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function ReceptionItemsSheet({
  open,
  onOpenChange,
  statuses,
  beds,
  onMove,
  onRename,
  onDelete,
  onAddStatus,
  onAddBed,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  statuses: ConfigItem[];
  beds: ConfigItem[];
  onMove: (id: string, dir: -1 | 1) => void;
  onRename: (id: string, v: string) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onAddStatus: () => void;
  onAddBed: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="overflow-y-auto p-4 sm:p-6">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <ConciergeBell className="h-4 w-4" />
            Status &amp; bed
          </SheetTitle>
          <SheetDescription>Manage room statuses and bed types</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-5">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Room status</p>
            <div className="space-y-1.5">
              <ManageList
                items={statuses}
                emptyText="No statuses yet."
                onMove={onMove}
                onRename={onRename}
                onDelete={onDelete}
              />
              <Button type="button" variant="outline" className="w-full" onClick={onAddStatus}>
                <Plus className="h-4 w-4 mr-2" />
                Add status
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bed set as</p>
            <div className="space-y-1.5">
              <ManageList
                items={beds}
                emptyText="No bed types yet."
                onMove={onMove}
                onRename={onRename}
                onDelete={onDelete}
              />
              <Button type="button" variant="outline" className="w-full" onClick={onAddBed}>
                <Plus className="h-4 w-4 mr-2" />
                Add bed type
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
