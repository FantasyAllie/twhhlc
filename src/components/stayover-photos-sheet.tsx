import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Camera, Loader2, Trash2 } from "lucide-react";
import {
  deleteStayoverPhoto,
  getStayoverSignedUrls,
  listStayoverPhotos,
  purgeExpiredStayoverPhotos,
  type StayoverPhoto,
} from "@/lib/stayover-photos";

export function StayoverPhotosSheet({
  open,
  onOpenChange,
  roomFilter,
  title,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  roomFilter?: number;
  title?: string;
}) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["stayover_photos", roomFilter ?? "all"],
    enabled: open,
    queryFn: async () => {
      await purgeExpiredStayoverPhotos();
      return listStayoverPhotos(roomFilter);
    },
  });
  const photos = useMemo(() => q.data ?? [], [q.data]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (photos.length === 0) {
      setUrls({});
      return;
    }
    let cancelled = false;
    getStayoverSignedUrls(photos.map((p) => p.path)).then((u) => {
      if (!cancelled) setUrls(u);
    });
    return () => {
      cancelled = true;
    };
  }, [photos]);

  const remove = async (p: StayoverPhoto) => {
    await deleteStayoverPhoto(p.id, p.path);
    qc.invalidateQueries({ queryKey: ["stayover_photos"] });
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="overflow-hidden rounded-t-2xl p-4 sm:p-6 flex flex-col">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            {title ?? "Stayover Photos"}
          </SheetTitle>
          <SheetDescription>
            Photos of DND doors. Automatically deleted after 48 hours.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 min-h-0 overflow-y-auto mt-4">
          {q.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : photos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No stayover photos.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photos.map((p) => {
                const url = urls[p.path];
                return (
                  <div key={p.id} className="rounded-lg border bg-background overflow-hidden">
                    <button
                      type="button"
                      className="block w-full aspect-square bg-muted"
                      onClick={() => url && setLightbox(url)}
                    >
                      {url ? (
                        <img src={url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      )}
                    </button>
                    <div className="p-2 flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold">Room {p.room_number}</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {fmt(p.created_at)}
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => void remove(p)}
                        aria-label="Delete photo"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
          <DialogContent className="max-w-3xl p-0 bg-transparent border-0 shadow-none">
            {lightbox && (
              <img src={lightbox} alt="" className="w-full h-auto max-h-[85dvh] object-contain rounded-md" />
            )}
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}