import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowLeft, ArrowUp, Check, ChevronRight, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useFloors } from "@/hooks/use-floors";
import { useCurrentHotel } from "@/lib/hotels";
import { supabase } from "@/integrations/supabase/client";
import { roomsForFloor, type FloorLocation } from "@/lib/floor-rules";
import type { Room } from "@/lib/app-types";

export function FloorsCupboards({ rooms }: { rooms: Room[] }) {
  const floorsQ = useFloors();
  const floors = floorsQ.data ?? [];
  const hotel = useCurrentHotel().data;
  const qc = useQueryClient();
  const [selected, setSelected] = useState<FloorLocation | null>(null);
  const [name, setName] = useState("");
  const [newName, setNewName] = useState("");
  const [assigned, setAssigned] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    await Promise.all([qc.invalidateQueries({ queryKey: ["hotel-floors"] }), qc.invalidateQueries({ queryKey: ["rooms"] })]);
  };
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try { await action(); await refresh(); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save floor"); }
    finally { setBusy(false); }
  };
  const open = (floor: FloorLocation) => {
    setSelected(floor); setName(floor.name); setAssigned(roomsForFloor(rooms, floor.name));
  };
  const moveFloor = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= floors.length) return;
    const next = [...floors];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    void run(async () => {
      const results = await Promise.all(next.map((floor, i) =>
        supabase.from("hotel_floors").update({ sort_order: i }).eq("id", floor.id)));
      const failure = results.find((result) => result.error)?.error;
      if (failure) throw failure;
    });
  };
  return <div className="flex min-h-0 flex-col gap-4">
    <DialogHeader><DialogTitle>{selected ? selected.name : "Floors & Cupboards"}</DialogTitle></DialogHeader>
    {floorsQ.isError && <p className="text-sm text-destructive">Could not load floors.</p>}
    {selected ? <>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Back to floors" onClick={() => setSelected(null)} disabled={busy}><ArrowLeft className="h-4 w-4" /></Button>
        <Input aria-label="Floor name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        <Button size="icon" variant="outline" aria-label="Save floor name" disabled={busy || !name.trim() || name.trim() === selected.name} onClick={() => void run(async () => {
          const { error } = await supabase.from("hotel_floors").update({ name: name.trim() }).eq("id", selected.id);
          if (error) throw error;
          setSelected({ ...selected, name: name.trim() }); toast.success("Floor renamed");
        })}><Save className="h-4 w-4" /></Button>
      </div>
      <div className="flex items-center justify-between gap-2"><span className="text-sm text-muted-foreground">Rooms · {assigned.length}</span>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => setAssigned(assigned.length === rooms.length ? [] : rooms.map((room) => room.room_number))}>{assigned.length === rooms.length ? "Clear all" : "Select all"}</Button>
      </div>
      <div className="grid min-h-0 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
        {rooms.slice().sort((a, b) => a.room_number - b.room_number).map((room) => {
          const checked = assigned.includes(room.room_number);
          return <Button key={room.id} variant={checked ? "default" : "outline"} aria-pressed={checked} aria-label={`Room ${room.room_number}`} disabled={busy} className="h-auto min-h-16 flex-col gap-1 rounded-lg px-2 py-2" onClick={() => setAssigned((previous) => checked ? previous.filter((n) => n !== room.room_number) : [...previous, room.room_number])}>
            <span className="flex items-center gap-1">{checked && <Check className="h-3 w-3" />}Room {room.room_number}</span>
            <span className="w-full truncate text-[10px] opacity-70">{room.floor || "Unassigned"}</span>
          </Button>;
        })}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button className="flex-1 gap-2" disabled={busy} onClick={() => void run(async () => {
          const { error } = await supabase.rpc("assign_floor_rooms", { p_floor: selected.id, p_rooms: assigned });
          if (error) throw error;
          toast.success("Room assignments saved");
        })}><Save className="h-4 w-4" />Save rooms</Button>
        <Button variant="ghost" size="icon" className="text-destructive" aria-label="Remove floor" disabled={busy} onClick={() => {
          if (!confirm(`Remove ${selected.name}? Its rooms will become unassigned. Cupboards with linen counts cannot be removed.`)) return;
          void run(async () => { const { error } = await supabase.from("hotel_floors").delete().eq("id", selected.id); if (error) throw error; setSelected(null); toast.success("Floor removed"); });
        }}><Trash2 className="h-4 w-4" /></Button>
      </div>
    </> : <>
      <form className="flex shrink-0 gap-2" onSubmit={(event) => {
        event.preventDefault(); if (!hotel || !newName.trim()) return;
        void run(async () => {
          const { data, error } = await supabase.from("hotel_floors").insert({ hotel_id: hotel.id, name: newName.trim(), sort_order: floors.length }).select("id,name,cupboard_key,sort_order").single();
          if (error) throw error;
          setNewName(""); open(data); toast.success("Floor added");
        });
      }}><Input aria-label="New floor name" placeholder="Floor name" value={newName} maxLength={80} onChange={(event) => setNewName(event.target.value)} /><Button type="submit" disabled={busy || !newName.trim() || !hotel} className="gap-1.5"><Plus className="h-4 w-4" />Add floor</Button></form>
      <div className="min-h-0 overflow-y-auto divide-y divide-border">
        {floors.map((floor, index) => <div key={floor.id} className="flex items-center gap-1">
          <Button variant="ghost" className="h-auto min-w-0 flex-1 justify-between rounded-none px-1 py-3 text-left" onClick={() => open(floor)}>
            <span className="min-w-0"><span className="block truncate font-medium">{floor.name}</span><span className="text-xs text-muted-foreground">{roomsForFloor(rooms, floor.name).length} rooms · Cupboard</span></span><ChevronRight className="h-4 w-4 shrink-0" />
          </Button>
          <div className="flex shrink-0 gap-0.5">
            <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`Move ${floor.name} up`} disabled={busy || index === 0} onClick={() => moveFloor(index, -1)}><ArrowUp className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`Move ${floor.name} down`} disabled={busy || index === floors.length - 1} onClick={() => moveFloor(index, 1)}><ArrowDown className="h-4 w-4" /></Button>
          </div>
        </div>)}
        {!floors.length && !floorsQ.isPending && <p className="py-4 text-sm text-muted-foreground">No floors yet.</p>}
      </div>
    </>}
  </div>;
}