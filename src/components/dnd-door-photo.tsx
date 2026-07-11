import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Camera, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { getStayoverSignedUrls, listStayoverPhotos } from "@/lib/stayover-photos";

export function DndDoorPhoto({ roomNumber }: { roomNumber: number }) {
  const q = useQuery({
    queryKey: ["stayover_photos", "room", roomNumber],
    queryFn: () => listStayoverPhotos(roomNumber),
  });
  const latest = (q.data ?? [])[0] ?? null;
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!latest) {
      setUrl(null);
      return;
    }
    getStayoverSignedUrls([latest.path]).then((u) => {
      if (!cancelled) setUrl(u[latest.path] ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [latest]);

  return (
    <div className="space-y-2 rounded-md border bg-background p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
        <Camera className="h-3.5 w-3.5" />
        DND door photo
      </p>
      {q.isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : !latest ? (
        <p className="text-xs text-muted-foreground">No photo captured.</p>
      ) : (
        <button
          type="button"
          className="block w-full max-w-xs aspect-video bg-muted rounded overflow-hidden"
          onClick={() => url && setOpen(true)}
        >
          {url ? (
            <img src={url} alt="DND door" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl p-0 bg-transparent border-0 shadow-none">
          {url && (
            <img src={url} alt="DND door" className="w-full h-auto max-h-[85vh] object-contain rounded-md" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}