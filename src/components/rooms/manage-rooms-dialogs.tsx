import { Bed, DoorOpen, List, ConciergeBell, Plus, Pencil, Trash2, ArrowUp, ArrowDown, Check } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Room } from "@/lib/app-types";
import { useEffect, useState } from "react";
import { ClipboardCheck, Shirt } from "lucide-react";
import { RoomChecklistEditor } from "@/components/rooms/room-checklists";

type Props = {
  manageRoomsOpen: boolean;
  setManageRoomsOpen: (v: boolean) => void;
  addRoomConfirmOpen: boolean;
  setAddRoomConfirmOpen: (v: boolean) => void;
  rooms: Room[];
  newRoomNumber: string;
  setNewRoomNumber: (v: string) => void;
  setRoomTypesSheetOpen: (v: boolean) => void;
  setRoomFeaturesSheetOpen: (v: boolean) => void;
  setReceptionItemsSheetOpen: (v: boolean) => void;
  openLinenList: () => void;
  setEditRoomSheetNumber: (n: number) => void;
  addRoom: (n: number) => void;
  removeRoom: (n: number) => void;
  moveRoom: (n: number, dir: -1 | 1) => void;
};

export function ManageRoomsDialogs({
  manageRoomsOpen,
  setManageRoomsOpen,
  addRoomConfirmOpen,
  setAddRoomConfirmOpen,
  rooms,
  newRoomNumber,
  setNewRoomNumber,
  setRoomTypesSheetOpen,
  setRoomFeaturesSheetOpen,
  setReceptionItemsSheetOpen,
  openLinenList,
  setEditRoomSheetNumber,
  addRoom,
  removeRoom,
  moveRoom,
}: Props) {
  const [view, setView] = useState<"home" | "rooms" | "checklist">("home");
  useEffect(() => {
    if (manageRoomsOpen) setView("home");
  }, [manageRoomsOpen]);
  const btn = "min-w-0 justify-center gap-1.5 px-3 rounded-full";
  const openAddRoom = () => {
    const used = new Set(rooms.map((r) => r.room_number));
    let suggested = 1;
    while (used.has(suggested)) suggested++;
    setNewRoomNumber(String(suggested));
    setAddRoomConfirmOpen(true);
  };
  return (
    <>
  <Dialog open={manageRoomsOpen} onOpenChange={setManageRoomsOpen}>
    <DialogContent shrinkToContent onBack={view !== "home" ? () => setView("home") : undefined} className="max-w-md w-[calc(100vw-1.5rem)] sm:w-full p-4 sm:p-6">
      {view === "home" && (
        <DialogHeader>
          <DialogTitle>Room Management</DialogTitle>
          <DialogDescription>
            Choose what to manage: rooms, room types, features and amenities, statuses and beds, the room checklist, or the linen list.
          </DialogDescription>
          <div className="mt-4 grid w-full grid-cols-2 gap-3">
            <Button variant="outline" size="sm" className={btn} onClick={() => setView("rooms")}>
              <DoorOpen className="h-4 w-4 shrink-0" />
              <span className="truncate">Rooms</span>
            </Button>
            <Button variant="outline" size="sm" className={btn} onClick={() => setRoomTypesSheetOpen(true)}>
              <Bed className="h-4 w-4 shrink-0" />
              <span className="truncate">Room Type</span>
            </Button>
            <Button variant="outline" size="sm" className={btn} onClick={() => setRoomFeaturesSheetOpen(true)}>
              <List className="h-4 w-4 shrink-0" />
              <span className="truncate">Features &amp; Amenities</span>
            </Button>
            <Button variant="outline" size="sm" className={btn} onClick={() => setReceptionItemsSheetOpen(true)}>
              <ConciergeBell className="h-4 w-4 shrink-0" />
              <span className="truncate">Status &amp; bed</span>
            </Button>
            <Button variant="outline" size="sm" className={btn} onClick={() => setView("checklist")}>
              <ClipboardCheck className="h-4 w-4 shrink-0" />
              <span className="truncate">Room Checklist</span>
            </Button>
            <Button variant="outline" size="sm" className={btn} onClick={openLinenList}>
              <Shirt className="h-4 w-4 shrink-0" />
              <span className="truncate">Linen List</span>
            </Button>
          </div>
        </DialogHeader>
      )}
      {view === "checklist" && (
        <div className="min-h-0 overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Room Checklist</DialogTitle>
          </DialogHeader>
          <div className="mt-3"><RoomChecklistEditor /></div>
        </div>
      )}
      {view === "rooms" && (
      <div className="flex min-h-0 flex-col space-y-3">
        <DialogHeader>
          <DialogTitle>Rooms</DialogTitle>
          <DialogDescription>
            Add or remove rooms. New rooms work like every other room. Rejects always stays at the end.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {rooms.length} room{rooms.length === 1 ? "" : "s"} total
          </span>
          <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={openAddRoom}>
            <Plus className="h-4 w-4" />Add Room
          </Button>
        </div>
        <ul className="divide-y rounded-xl border min-h-0 overflow-y-auto">
          {rooms
            .slice()
            .sort((a, b) => (a.sort_order ?? a.room_number) - (b.sort_order ?? b.room_number))
            .map((r, idx, arr) => (
              <li key={r.id} className="flex items-center gap-3 px-3 py-2">
                <span className="flex-1 text-sm font-medium tabular-nums">
                  Room {r.room_number}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => setEditRoomSheetNumber(r.room_number)}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => removeRoom(r.room_number)}
                  aria-label={`Remove Room ${r.room_number}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={idx === 0}
                  onClick={() => moveRoom(r.room_number, -1)}
                  aria-label={`Move Room ${r.room_number} up`}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={idx === arr.length - 1}
                  onClick={() => moveRoom(r.room_number, 1)}
                  aria-label={`Move Room ${r.room_number} down`}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </li>
            ))}
        </ul>
      </div>
      )}
    </DialogContent>
  </Dialog>

  <Dialog open={addRoomConfirmOpen} onOpenChange={setAddRoomConfirmOpen}>
    <DialogContent className="max-w-sm w-[calc(100vw-1.5rem)] sm:w-full p-4 sm:p-6">
      <DialogHeader>
        <DialogTitle>Add room</DialogTitle>
        <DialogDescription>
          Enter a room number. The new room is added to the bottom of the list.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground">Room number</label>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={999}
            autoFocus
            value={newRoomNumber}
            onChange={(e) => setNewRoomNumber(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const n = Number(newRoomNumber);
                if (Number.isFinite(n)) {
                  addRoom(n);
                  setNewRoomNumber("");
                  setAddRoomConfirmOpen(false);
                }
              }
            }}
          />
        </div>
        <Button
          className="w-full"
          onClick={() => {
            const n = Number(newRoomNumber);
            if (!Number.isFinite(n)) {
              toast.error("Enter a valid room number.");
              return;
            }
            addRoom(n);
            setNewRoomNumber("");
            setAddRoomConfirmOpen(false);
          }}
        >
          <Check className="h-4 w-4 mr-1" />
          Confirm
        </Button>
      </div>
    </DialogContent>
  </Dialog>
    </>
  );
}
