import { useState } from "react";
import { Check, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRoomChecklistRecords } from "@/hooks/use-room-checklists";

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