// Single home for configuring every location in the hotel:
// guest rooms (housekeeping) and other areas (maintenance).
import { Hash, MapPin, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function LocationsDialog({
  open,
  onOpenChange,
  roomCount,
  areaCount,
  onManageRooms,
  onManageAreas,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  roomCount: number;
  areaCount: number;
  onManageRooms: () => void;
  onManageAreas: () => void;
}) {
  const Item = ({
    icon: Icon,
    title,
    desc,
    onClick,
  }: {
    icon: typeof Hash;
    title: string;
    desc: string;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border bg-background p-4 text-left hover:bg-muted/50"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
        <Icon className="h-5 w-5" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted-foreground">{desc}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100vw-1.5rem)] sm:w-full p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Locations</DialogTitle>
          <DialogDescription>Manage every part of the hotel in one place.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Item
            icon={Hash}
            title="Rooms"
            desc={`${roomCount} room${roomCount === 1 ? "" : "s"} · numbers, types, features, status & bed`}
            onClick={onManageRooms}
          />
          <Item
            icon={MapPin}
            title="Hotel areas"
            desc={`${areaCount} area${areaCount === 1 ? "" : "s"} · lobby, kitchen, car park… for maintenance`}
            onClick={onManageAreas}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
