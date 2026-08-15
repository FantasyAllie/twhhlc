import { Pencil, Check, ArrowUp, ArrowDown, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { COLOR_SWATCHES } from "@/lib/app-format";
import type { ItemColor, TemplateItem } from "@/lib/app-types";

type Props = {
  templateOpen: boolean;
  setTemplateOpen: (v: boolean) => void;
  realIsAdmin: boolean;
  realIsManager: boolean;
  hasHousekeeperRole: boolean;
  hasFnbRole: boolean;
  isFnb: boolean;
  linenListType: "housekeeping" | "fnb";
  setLinenListType: (v: "housekeeping" | "fnb") => void;
  templateAll: TemplateItem[];
  theme: string | undefined;
  newTemplateName: string;
  setNewTemplateName: (v: string) => void;
  addTemplateItem: (e: React.FormEvent) => void;
  editItemSheetId: string | null;
  setEditItemSheetId: (id: string | null) => void;
  editingItemId: string | null;
  setEditingItemId: (id: string | null) => void;
  editingItemName: string;
  setEditingItemName: (v: string) => void;
  renameTemplateItem: (id: string, name: string) => void;
  setTemplateDefault: (id: string, n: number) => void;
  setTemplateColor: (id: string, color: ItemColor | null) => void;
  moveTemplateItem: (id: string, dir: -1 | 1) => void;
  deleteTemplateItem: (id: string) => void;
};

export function LinenListDialog({
  templateOpen,
  setTemplateOpen,
  realIsAdmin,
  realIsManager,
  hasHousekeeperRole,
  hasFnbRole,
  isFnb,
  linenListType,
  setLinenListType,
  templateAll,
  theme,
  newTemplateName,
  setNewTemplateName,
  addTemplateItem,
  editItemSheetId,
  setEditItemSheetId,
  editingItemId,
  setEditingItemId,
  editingItemName,
  setEditingItemName,
  renameTemplateItem,
  setTemplateDefault,
  setTemplateColor,
  moveTemplateItem,
  deleteTemplateItem,
}: Props) {
  return (
   <Dialog open={templateOpen} onOpenChange={(o) => {
     setTemplateOpen(o);
     if (o) {
       const canHk = realIsAdmin || realIsManager || hasHousekeeperRole;
       const canFn = realIsAdmin || realIsManager || hasFnbRole;
       if (!canHk && canFn) setLinenListType("fnb");
       else if (canHk && !canFn) setLinenListType("housekeeping");
       else setLinenListType(isFnb ? "fnb" : "housekeeping");
     }
   }}>
<DialogContent className="max-w-2xl w-[calc(100vw-1.5rem)] sm:w-full p-4 sm:p-6">
 <DialogHeader>
 <DialogTitle>Linen List</DialogTitle>
   <DialogDescription>
     Manage the shared list of linen items. Pick which items appear in each
     room from that room's <Pencil className="inline h-3.5 w-3.5 align-[-2px]" /> button.
   </DialogDescription>
 </DialogHeader>
   <div className="space-y-3">
      {(realIsAdmin || realIsManager || (hasHousekeeperRole && hasFnbRole)) && (
      <div className="inline-flex rounded-xl border p-0.5 bg-muted/40 self-start">
       <button
         type="button"
         onClick={() => setLinenListType("housekeeping")}
         className={cn(
           "px-3 py-1.5 text-sm rounded-[0.3rem] transition-colors",
           linenListType === "housekeeping" ? "bg-background shadow-sm font-medium" : "text-muted-foreground",
         )}
       >
         Housekeeping
       </button>
       <button
         type="button"
         onClick={() => setLinenListType("fnb")}
         className={cn(
           "px-3 py-1.5 text-sm rounded-[0.3rem] transition-colors",
           linenListType === "fnb" ? "bg-background shadow-sm font-medium" : "text-muted-foreground",
         )}
       >
         F&amp;B
       </button>
      </div>
      )}
    <form onSubmit={addTemplateItem} className="flex gap-2">
      <Input
         placeholder={`Add an item to ${linenListType === "fnb" ? "F&B" : "Housekeeping"}…`}
        value={newTemplateName}
        onChange={(e) => setNewTemplateName(e.target.value)}
      />
       <Button type="submit" disabled={!newTemplateName.trim()}>
        Add
      </Button>
    </form>
     {(() => {
       const listItems = templateAll.filter((t) => (t.list_type ?? "housekeeping") === linenListType);
       return listItems.length === 0 ? (
         <p className="text-sm text-muted-foreground">No items yet.</p>
       ) : (
        <ul className="divide-y border-t max-h-[60dvh] overflow-y-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
          <li className="flex items-center gap-1.5 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <span className="h-3 w-3 shrink-0" aria-hidden />
            <span className="flex-1 min-w-0">Item</span>
            <span className="shrink-0 w-[88px] text-right">Actions</span>
          </li>
           {listItems.map((item, idx) => {
          return (
            <li key={item.id} className="flex items-center gap-1.5 py-2">
              <span
                className="h-3 w-3 rounded-full shrink-0"
                style={{
                  backgroundColor: item.color
                    ? theme === "dark"
                      ? COLOR_SWATCHES[item.color].darkBg
                      : COLOR_SWATCHES[item.color].bg
                    : "transparent",
                }}
                aria-hidden
              />
              <span className="flex-1 min-w-0 break-words text-sm">{item.name}</span>
              <div className="flex items-center gap-1 shrink-0">
                <Sheet
                  open={editItemSheetId === item.id}
                  onOpenChange={(o) => setEditItemSheetId(o ? item.id : null)}
                >
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground"
                      aria-label={`Edit ${item.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl p-4 sm:p-6">
                    <SheetHeader className="text-left">
                      <SheetTitle>Edit item</SheetTitle>
                      <SheetDescription>{item.name}</SheetDescription>
                    </SheetHeader>
                    <div className="mt-4 space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Name</label>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          renameTemplateItem(item.id, editingItemName);
                        }}
                        className="flex items-center gap-2"
                      >
                        <Input
                          autoFocus
                          defaultValue={item.name}
                          onFocus={(e) => {
                            setEditingItemId(item.id);
                            setEditingItemName(e.currentTarget.value);
                          }}
                          onChange={(e) => setEditingItemName(e.target.value)}
                          onBlur={() => {
                            if (editingItemId === item.id) renameTemplateItem(item.id, editingItemName);
                          }}
                          className="h-11 flex-1"
                        />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11 text-muted-foreground"
                          aria-label="Save name"
                        >
                          <Check className="h-5 w-5" />
                        </Button>
                      </form>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Default count</label>
                      <Input
                        type="number"
                        min={0}
                        value={item.default_count}
                        onChange={(e) => setTemplateDefault(item.id, Number(e.target.value))}
                        className="h-11 w-24"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Colour</label>
                      <div className="flex items-center gap-2 flex-wrap">
                        {(Object.keys(COLOR_SWATCHES) as ItemColor[]).map((key) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setTemplateColor(item.id, key)}
                            aria-label={COLOR_SWATCHES[key].label}
                            title={COLOR_SWATCHES[key].label}
                            className={cn(
                              "h-9 w-9 rounded-full transition shadow-elevation-1",
                              item.color === key ? "ring-2 ring-offset-1 ring-foreground" : "",
                            )}
                            style={{
                              backgroundColor: theme === "dark" ? COLOR_SWATCHES[key].darkBg : COLOR_SWATCHES[key].bg,
                            }}
                          />
                        ))}
                        <button
                          type="button"
                          onClick={() => setTemplateColor(item.id, null)}
                          aria-label="No colour"
                          title="No colour"
                          className={cn(
                            "h-9 w-9 rounded-full border-2 flex items-center justify-center bg-background",
                            item.color === null ? "ring-2 ring-offset-1 ring-foreground" : "",
                          )}
                        >
                          <X className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t">
                      <span className="text-sm text-muted-foreground">Reorder</span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-11 w-11"
                          onClick={() => moveTemplateItem(item.id, -1)}
                          disabled={idx === 0}
                          aria-label="Move up"
                        >
                          <ArrowUp className="h-5 w-5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-11 w-11"
                          onClick={() => moveTemplateItem(item.id, 1)}
                          disabled={idx === listItems.length - 1}
                          aria-label="Move down"
                        >
                          <ArrowDown className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                    </div>
                  </SheetContent>
                </Sheet>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteTemplateItem(item.id)}
                  aria-label={`Delete ${item.name}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
       );
     })()}
  </div>
 </DialogContent>
 </Dialog>
  );
}
