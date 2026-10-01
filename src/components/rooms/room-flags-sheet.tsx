// Admin/manager editor for the "Guest & room info" toggles.
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { FLAG_COLORS, FLAG_ICONS, FlagIcon, useRoomFlags, type FlagDef } from "@/lib/room-flags";

const toRow = (d: FlagDef, sort: number) => ({
  key: d.key, label: d.label, icon: d.icon, color: d.color,
  hidden: d.hidden, is_custom: d.custom, sort_order: sort,
});

export function RoomFlagsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const { all } = useRoomFlags();
  const [editing, setEditing] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");

  const save = async (rows: ReturnType<typeof toRow>[]) => {
    const { error } = await supabase
      .from("room_flag_settings" as never)
      .upsert(rows as never, { onConflict: "hotel_id,key" });
    if (error) toast.error("Couldn't save: " + error.message);
    await qc.invalidateQueries({ queryKey: ["room_flag_settings"] });
  };
  const update = (d: FlagDef, patch: Partial<FlagDef>) => {
    const idx = all.findIndex((x) => x.key === d.key);
    return save([toRow({ ...d, ...patch }, idx)]);
  };
  const move = (idx: number, dir: -1 | 1) => {
    const next = [...all];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    return save(next.map((d, i) => toRow(d, i)));
  };
  const add = async () => {
    const label = newLabel.trim();
    if (!label) return;
    const key = "custom_" + Math.random().toString(36).slice(2, 10);
    await save([toRow({ key, label, icon: "flag", color: "slate", hidden: false, custom: true, sort: all.length }, all.length)]);
    setNewLabel("");
    setEditing(key);
  };
  const remove = async (d: FlagDef) => {
    if (!confirm(`Remove "${d.label}"? It will be cleared from every room.`)) return;
    if (!d.custom) {
      const idx = all.findIndex((x) => x.key === d.key);
      await save([{ ...toRow(d, idx), removed: true } as ReturnType<typeof toRow>]);
      await supabase.from("rooms").update({ [d.key]: false } as never).eq(d.key as never, true as never);
      await qc.invalidateQueries({ queryKey: ["rooms"] });
      return;
    }
    await supabase.from("room_custom_flags" as never).delete().eq("flag_key", d.key);
    await supabase.from("room_flag_settings" as never).delete().eq("key", d.key);
    await qc.invalidateQueries({ queryKey: ["room_flag_settings"] });
    await qc.invalidateQueries({ queryKey: ["room_custom_flags"] });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="overflow-y-auto rounded-t-2xl p-4 sm:p-6">
        <SheetHeader className="text-left">
          <SheetTitle>Guest &amp; room info</SheetTitle>
          <SheetDescription>
            Add, remove, rename, reorder, hide or restyle the toggles reception and housekeeping use.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex gap-2">
          <Input
            placeholder="New toggle, e.g. Baby cot needed"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void add(); } }}
          />
          <Button type="button" onClick={() => void add()}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>

        <ul className="mt-4 space-y-2">
          {all.map((d, idx) => {
            const col = FLAG_COLORS[d.color] ?? FLAG_COLORS.slate;
            const isEditing = editing === d.key;
            return (
              <li key={d.key} className={cn("rounded-xl border bg-background p-3", d.hidden && "opacity-60")}>
                <div className="flex items-center gap-2">
                  <FlagIcon def={d} className={cn("h-5 w-5 shrink-0", col.text)} />
                  <span className="flex-1 min-w-0 text-sm font-medium truncate">
                    {d.label}
                  </span>
                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Edit" onClick={() => setEditing(isEditing ? null : d.key)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={d.hidden ? "Show" : "Hide"} onClick={() => void update(d, { hidden: !d.hidden })}>
                    {d.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Move up" disabled={idx === 0} onClick={() => void move(idx, -1)}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Move down" disabled={idx === all.length - 1} onClick={() => void move(idx, 1)}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  {(
                    <Button size="icon" variant="ghost" className="h-8 w-8 hover:text-destructive" aria-label="Remove" onClick={() => void remove(d)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {isEditing && (
                  <div className="mt-3 space-y-3 border-t pt-3">
                    <Input
                      defaultValue={d.label}
                      maxLength={40}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== d.label) void update(d, { label: v });
                      }}
                    />
                    <div>
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Symbol</p>
                      <div className="grid grid-cols-8 gap-1.5">
                        {Object.entries(FLAG_ICONS).map(([name, Icon]) => (
                          <button
                            key={name}
                            type="button"
                            aria-label={name}
                            onClick={() => void update(d, { icon: name })}
                            className={cn("flex h-9 items-center justify-center rounded-lg border", d.icon === name ? "border-primary bg-primary/10" : "bg-background")}
                          >
                            <Icon className={cn("h-4 w-4", col.text)} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Colour</p>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(FLAG_COLORS).map(([name, c]) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => void update(d, { color: name })}
                            className={cn("rounded-full px-3 py-1 text-xs font-medium border", c.badge, d.color === name ? "border-primary ring-2 ring-primary/40" : "border-transparent")}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
