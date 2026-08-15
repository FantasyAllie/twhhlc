import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReceptionIconGuide } from "@/components/reception-icon-guide";

type Props = {
  addRoomTypeOpen: boolean;
  setAddRoomTypeOpen: (v: boolean) => void;
  newRoomTypeLabel: string;
  setNewRoomTypeLabel: (v: string) => void;
  addRoomType: (label: string) => void;

  addRoomFeatureOpen: boolean;
  setAddRoomFeatureOpen: (v: boolean) => void;
  newRoomFeatureLabel: string;
  setNewRoomFeatureLabel: (v: string) => void;
  addRoomFeature: (label: string) => void;

  addReceptionItemKind: "status" | "bed" | null;
  setAddReceptionItemKind: (v: "status" | "bed" | null) => void;
  newReceptionItemLabel: string;
  setNewReceptionItemLabel: (v: string) => void;
  addReceptionItem: (kind: "status" | "bed", label: string) => void;

  receptionHelpOpen: boolean;
  setReceptionHelpOpen: (v: boolean) => void;
};

export function AddConfigDialogs({
  addRoomTypeOpen,
  setAddRoomTypeOpen,
  newRoomTypeLabel,
  setNewRoomTypeLabel,
  addRoomType,
  addRoomFeatureOpen,
  setAddRoomFeatureOpen,
  newRoomFeatureLabel,
  setNewRoomFeatureLabel,
  addRoomFeature,
  addReceptionItemKind,
  setAddReceptionItemKind,
  newReceptionItemLabel,
  setNewReceptionItemLabel,
  addReceptionItem,
  receptionHelpOpen,
  setReceptionHelpOpen,
}: Props) {
  return (
    <>
      {/* Add room type dialog */}
      <Dialog open={addRoomTypeOpen} onOpenChange={setAddRoomTypeOpen}>
        <DialogContent className="max-w-sm w-[calc(100vw-1.5rem)] sm:w-full p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Add Room Type</DialogTitle>
            <DialogDescription>Enter a name for the new room type.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addRoomType(newRoomTypeLabel);
            }}
            className="space-y-3"
          >
            <Input
              placeholder="e.g. Twin"
              value={newRoomTypeLabel}
              onChange={(e) => setNewRoomTypeLabel(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setAddRoomTypeOpen(false);
                  setNewRoomTypeLabel("");
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!newRoomTypeLabel.trim()}>
                Add
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add reception item dialog */}
      <Dialog
        open={addReceptionItemKind !== null}
        onOpenChange={(o) => {
          if (!o) {
            setAddReceptionItemKind(null);
            setNewReceptionItemLabel("");
          }
        }}
      >
        <DialogContent className="max-w-sm w-[calc(100vw-1.5rem)] sm:w-full p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>
              {addReceptionItemKind === "bed" ? "Add Bed Type" : "Add Room Status"}
            </DialogTitle>
            <DialogDescription>
              {addReceptionItemKind === "bed"
                ? "Enter a name for the new bed type."
                : "Enter a name for the new room status."}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (addReceptionItemKind) {
                addReceptionItem(addReceptionItemKind, newReceptionItemLabel);
              }
            }}
            className="space-y-3"
          >
            <Input
              placeholder={addReceptionItemKind === "bed" ? "e.g. King" : "e.g. Arrival"}
              value={newReceptionItemLabel}
              onChange={(e) => setNewReceptionItemLabel(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setAddReceptionItemKind(null);
                  setNewReceptionItemLabel("");
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!newReceptionItemLabel.trim()}>
                Add
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add room feature dialog */}
      <Dialog open={addRoomFeatureOpen} onOpenChange={setAddRoomFeatureOpen}>
        <DialogContent className="max-w-sm w-[calc(100vw-1.5rem)] sm:w-full p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Add Room Feature</DialogTitle>
            <DialogDescription>Enter a name for the new room feature.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addRoomFeature(newRoomFeatureLabel);
            }}
            className="space-y-3"
          >
            <Input
              placeholder="e.g. Balcony"
              value={newRoomFeatureLabel}
              onChange={(e) => setNewRoomFeatureLabel(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setAddRoomFeatureOpen(false);
                  setNewRoomFeatureLabel("");
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!newRoomFeatureLabel.trim()}>
                Add
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reception color legend help dialog */}
      <Dialog open={receptionHelpOpen} onOpenChange={setReceptionHelpOpen}>
        <DialogContent className="max-w-md w-[calc(100vw-1.5rem)] sm:w-full p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Icon &amp; symbol guide</DialogTitle>
            <DialogDescription>Tap any icon or symbol to see what it means.</DialogDescription>
          </DialogHeader>
          <ReceptionIconGuide />
        </DialogContent>
      </Dialog>
    </>
  );
}
