import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Check, ClipboardCheck, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useRoomChecklistSettings, useRoomChecklistRecords } from "@/hooks/use-room-checklists";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentHotel } from "@/lib/hotels";
import { selectedChecklistItems, normalizeChecklist } from "@/lib/room-checklist-rules";

type Department = "housekeeping" | "reception";
type Target = { room: number; department: Department; hotelId: string };
export function RoomChecklistProvider({ children, onCompleted, target, onClose }: {
  children: React.ReactNode;
  onCompleted: (room: number, department: Department) => void;
  target: Target | null;
  onClose: () => void;
}) {
  const hotel = useCurrentHotel().data;
  return <>
    {children}
    {target && hotel?.id === target.hotelId && <RoomCompletionDialog key={`${target.hotelId}-${target.department}-${target.room}`} target={target} onClose={onClose} onCompleted={onCompleted} />}
  </>;
}

function RoomCompletionDialog({ target, onClose, onCompleted }: {
  target: Target; onClose: () => void; onCompleted: (room: number, department: Department) => void;
}) {
  const settings = useRoomChecklistSettings();
  const [checked, setChecked] = useState<boolean[]>([]);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const items = settings.data;
  const complete = !!items && !settings.isFetching && !settings.isError;
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <DialogContent className="p-4 sm:p-6">
      <DialogHeader>
        <DialogTitle>Room {target.room} checklist</DialogTitle>
        <DialogDescription>Tick what's in this room. Leave anything the room doesn't need.</DialogDescription>
      </DialogHeader>
      {settings.isPending && <p className="py-4 text-sm text-muted-foreground">Loading checklist…</p>}
      {settings.isError && <Button variant="outline" onClick={() => void settings.refetch()}>Retry loading checklist</Button>}
      <div className="min-h-0 overflow-y-auto space-y-2 py-3">
        {items?.map((item, i) => <label key={item} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border p-3">
          <Checkbox disabled={busy} checked={checked[i] ?? false} onCheckedChange={(value) => setChecked(items.map((_, j) => j === i ? value === true : checked[j] ?? false))} />
          <span className="min-w-0 break-words text-sm">{item}</span>
        </label>)}
      </div>
      <div className="flex gap-2 pt-2">
        <Button variant="outline" disabled={busy} onClick={onClose} className="flex-1">Skip</Button>
        <Button className="flex-1" disabled={!complete || busy} onClick={async () => {
          if (!items || !complete) return;
          setBusy(true);
          try {
            const { error } = await supabase.rpc("complete_room_checklist", { p_room_number: target.room, p_department: target.department, p_items: selectedChecklistItems(items, checked) });
            if (error) throw error;
            onCompleted(target.room, target.department);
            await Promise.all([qc.invalidateQueries({ queryKey: ["rooms"] }), qc.invalidateQueries({ queryKey: ["room-checklist-records"] })]);
            onClose();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : (error as { message?: string }).message ?? "Could not complete the room.");
          } finally { setBusy(false); }
        }}><Check className="mr-1 h-4 w-4" />{busy ? "Saving…" : "Complete"}</Button>
      </div>
    </DialogContent>
  </Dialog>;
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
        {(record.items as string[]).map((item, i) => <div key={i} className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-primary" /><span className="break-words">{item}</span></div>)}
      </li>)}
    </ul>}
  </div>;
}