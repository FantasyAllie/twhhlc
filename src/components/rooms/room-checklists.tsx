import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Check, ClipboardCheck, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRoomChecklistSettings, useRoomChecklistRecords } from "@/hooks/use-room-checklists";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentHotel } from "@/lib/hotels";
import { normalizeChecklist } from "@/lib/room-checklist-rules";

export function RoomCheckedItemSelectors({ roomNumber, selectedItems }: { roomNumber: number; selectedItems: string[] | null }) {
  const settings = useRoomChecklistSettings();
  const hotel = useCurrentHotel().data;
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  return <div className="space-y-2 border-t border-border/60 pt-4">
    <p className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Checked Items</p>
    {settings.isPending ? <p className="text-center text-sm text-muted-foreground">Loading items…</p> : settings.isError ?
      <Button variant="outline" onClick={() => void settings.refetch()}>Retry</Button> :
      <div className="grid grid-cols-2 gap-1.5">
        {settings.data?.map((item) => {
          const selected = selectedItems?.includes(item) ?? false;
          return <Button key={item} variant="outline" type="button" aria-pressed={selected} disabled={busy || !hotel}
            className={`h-auto min-h-12 w-full min-w-0 justify-center gap-2 whitespace-normal rounded-xl px-3 py-3 text-center text-sm font-medium ${selected ? "border-primary bg-primary/10 text-primary hover:bg-primary/15" : ""}`}
            onClick={async () => {
              if (!hotel) return;
              setBusy(true);
              try {
                const { error } = await supabase.rpc("set_room_checked_item", { p_room_number: roomNumber, p_item: item, p_selected: !selected });
                if (error) throw error;
                await qc.invalidateQueries({ queryKey: ["rooms"] });
              } catch (error) { toast.error((error as { message?: string }).message ?? "Could not save room items."); }
              finally { setBusy(false); }
            }}>
            {selected && <Check className="h-4 w-4 shrink-0" />}<span className="min-w-0 break-words">{item}</span>
          </Button>;
        })}
      </div>}
  </div>;
}

export function RoomChecklistEditor() {
  const settings = useRoomChecklistSettings();
  const hotel = useCurrentHotel().data;
  const qc = useQueryClient();
  const [draft, setDraft] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const items = draft ?? settings.data ?? [];
  const move = (index: number, direction: number) => {
    const next = [...items];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    setDraft(next);
  };
  return <div className="space-y-3 py-3">
    {settings.isPending ? <p className="text-sm text-muted-foreground">Loading checklist…</p> : settings.isError ? <Button onClick={() => void settings.refetch()}>Retry</Button> : <>
      {items.map((item, i) => <div key={i} className="flex items-center gap-1">
        <Input aria-label={`Checklist item ${i + 1}`} className="min-w-0 flex-1" disabled={busy} value={item} onChange={(e) => setDraft(items.map((s, j) => j === i ? e.target.value : s))} />
        <Button size="icon" variant="ghost" title="Move up" aria-label={`Move item ${i + 1} up`} disabled={busy || i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" title="Move down" aria-label={`Move item ${i + 1} down`} disabled={busy || i === items.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" title="Remove item" aria-label={`Remove item ${i + 1}`} className="text-destructive" disabled={busy} onClick={() => setDraft(items.filter((_, j) => i !== j))}><Trash2 className="h-4 w-4" /></Button>
      </div>)}
      <Button variant="outline" disabled={busy} onClick={() => setDraft([...items, ""])}><Plus className="mr-1 h-4 w-4" />Add item</Button>
      <div className="flex gap-2">
        <Button variant="outline" disabled={busy || draft === null} onClick={() => setDraft(null)}>Discard changes</Button>
        <Button disabled={busy || draft === null || !hotel} onClick={async () => {
          if (!hotel) return;
          try {
            const clean = normalizeChecklist(items);
            setBusy(true);
            const { error } = await supabase.from("room_checklist_settings").upsert({ hotel_id: hotel.id, items: clean });
            if (error) throw error;
            await qc.invalidateQueries({ queryKey: ["room-checklist-settings"] });
            setDraft(null);
            toast.success("Checklist saved");
          } catch (error) { toast.error((error as { message?: string }).message ?? "Could not save checklist."); }
          finally { setBusy(false); }
        }}>{busy ? "Saving…" : "Save checklist"}</Button>
      </div>
    </>}
  </div>;
}

export function RoomChecklistRecords({ roomNumber }: { roomNumber: number }) {
  const records = useRoomChecklistRecords(roomNumber);
  const [open, setOpen] = useState(false);
  if (!records.data?.length) return null;
  return <div className="mt-3">
    <Button variant="outline" className="w-full gap-2" aria-expanded={open} onClick={() => setOpen(!open)}><ClipboardCheck className="h-4 w-4" />Completed checklists ({records.data.length})</Button>
    {open && <ul className="mt-2 divide-y">
      {records.data.map((record) => <li key={record.id} className="space-y-2 py-3 text-sm">
        <div className="text-xs text-muted-foreground">{new Date(record.completed_at).toLocaleString()} · {record.completed_by_name ?? "Team member"} · {record.department === "reception" ? "Reception" : "Housekeeping"}</div>
        {(record.items as string[]).length === 0 && <div className="text-muted-foreground">No items ticked</div>}
        {(record.items as string[]).map((item, i) => <div key={i} className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-primary" /><span className="break-words">{item}</span></div>)}
      </li>)}
    </ul>}
  </div>;
}