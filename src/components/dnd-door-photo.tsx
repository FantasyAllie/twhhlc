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
    <div className="space-y-2 rounded-xl border border-sky-400/60 bg-sky-50 dark:bg-sky-950/40 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
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
        <div className="flex items-start gap-3">
          <button
            type="button"
            className="block h-20 w-20 shrink-0 bg-muted rounded overflow-hidden"
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
          <div className="text-xs text-muted-foreground leading-tight">
            <div className="font-medium text-foreground">Taken</div>
            <div>
              {new Date(latest.created_at).toLocaleString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </div>
          </div>
        </div>
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