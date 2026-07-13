import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  deleteEntryPhoto,
  getSignedUrls,
  MAX_PHOTOS_PER_ENTRY,
  uploadEntryPhotos,
  type EntryKind,
} from "@/lib/entry-photos";
import { cn } from "@/lib/utils";

type Pending = { id: string; file: File; previewUrl: string };

export function PhotoComposer({
  value,
  onChange,
  max = MAX_PHOTOS_PER_ENTRY,
}: {
  value: File[];
  onChange: (files: File[]) => void;
  max?: number;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);

  useEffect(() => {
    // Sync pending previews with `value`. If parent cleared value, drop previews.
    if (value.length === 0 && pending.length > 0) {
      pending.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      setPending([]);
    }
  }, [value, pending]);

  useEffect(() => {
    return () => {
      pending.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    const room = max - value.length;
    if (room <= 0) {
      toast.error(`Max ${max} photos`);
      return;
    }
    const accepted = files.slice(0, room);
    const newPending = accepted.map((f) => ({
      id: Math.random().toString(36).slice(2),
      file: f,
      previewUrl: URL.createObjectURL(f),
    }));
    setPending((p) => [...p, ...newPending]);
    onChange([...value, ...accepted]);
  };

  const removeAt = (idx: number) => {
    const p = pending[idx];
    if (p) URL.revokeObjectURL(p.previewUrl);
    setPending((prev) => prev.filter((_, i) => i !== idx));
    onChange(value.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onPick}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onPick}
      />
      <div className="flex flex-wrap gap-2">
        {pending.map((p, idx) => (
          <div key={p.id} className="relative h-16 w-16 overflow-hidden rounded-md border bg-muted">
            <img src={p.previewUrl} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              className="absolute -right-1 -top-1 rounded-full bg-background/90 shadow border p-0.5 text-muted-foreground hover:text-destructive"
              onClick={() => removeAt(idx)}
              aria-label="Remove photo"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {value.length < max && (
          <>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-md border border-dashed text-muted-foreground hover:bg-muted"
            >
              <Camera className="h-4 w-4" />
              <span className="text-[10px]">Camera</span>
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-md border border-dashed text-muted-foreground hover:bg-muted"
            >
              <ImagePlus className="h-4 w-4" />
              <span className="text-[10px]">Library</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function PhotoAttachments({
  kind,
  entryId,
  paths,
  canEdit,
  onChange,
  max = MAX_PHOTOS_PER_ENTRY,
}: {
  kind: EntryKind;
  entryId: string;
  paths: string[];
  canEdit: boolean;
  onChange: (nextPaths: string[]) => Promise<void> | void;
  max?: number;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    if (paths.length === 0) {
      setUrls({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    getSignedUrls(paths)
      .then((u) => {
        if (!cancelled) setUrls(u);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [paths]);

  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    const room = max - paths.length;
    if (room <= 0) {
      toast.error(`Max ${max} photos`);
      return;
    }
    setUploading(true);
    const { paths: newPaths, errors } = await uploadEntryPhotos(kind, entryId, files.slice(0, room));
    setUploading(false);
    if (errors.length > 0) toast.error(errors[0]);
    if (newPaths.length > 0) {
      await onChange([...paths, ...newPaths]);
    }
  };

  const removePath = async (path: string) => {
    const res = await deleteEntryPhoto(path);
    if (!res.ok) {
      toast.error(res.error ?? "Delete failed");
      return;
    }
    await onChange(paths.filter((p) => p !== path));
  };

  if (paths.length === 0 && !canEdit) return null;

  return (
    <div className="mt-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void handlePick(e)}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void handlePick(e)}
      />
      <div className="flex flex-wrap gap-1.5">
        {paths.map((p) => {
          const url = urls[p];
          return (
            <div key={p} className="relative h-14 w-14 overflow-hidden rounded-md border bg-muted">
              {url ? (
                <button
                  type="button"
                  className="block h-full w-full"
                  onClick={() => setLightboxUrl(url)}
                >
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  {loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  ) : null}
                </div>
              )}
              {canEdit && (
                <button
                  type="button"
                  className="absolute -right-1 -top-1 rounded-full bg-background/90 shadow border p-0.5 text-muted-foreground hover:text-destructive"
                  onClick={() => void removePath(p)}
                  aria-label="Delete photo"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
        {canEdit && paths.length < max && (
          <>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={uploading}
              className={cn(
                "flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-md border border-dashed text-muted-foreground hover:bg-muted",
                uploading && "opacity-60",
              )}
              aria-label="Take photo"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Camera className="h-4 w-4" />
                  <span className="text-[10px]">Camera</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className={cn(
                "flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-md border border-dashed text-muted-foreground hover:bg-muted",
                uploading && "opacity-60",
              )}
              aria-label="Add from library"
            >
              <ImagePlus className="h-4 w-4" />
              <span className="text-[10px]">Library</span>
            </button>
          </>
        )}
      </div>
      <Dialog open={!!lightboxUrl} onOpenChange={(o) => !o && setLightboxUrl(null)}>
        <DialogContent className="max-w-3xl p-0 bg-transparent border-0 shadow-none">
          {lightboxUrl && (
            <img src={lightboxUrl} alt="" className="w-full h-auto max-h-[85vh] object-contain rounded-md" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function useUploadAfterInsert() {
  // Helper: given a freshly-inserted entry id and pending File[], upload and
  // return the resulting paths. Errors surface via toast; caller stores paths.
  return async (kind: EntryKind, entryId: string, files: File[]): Promise<string[]> => {
    if (files.length === 0) return [];
    const { paths, errors } = await uploadEntryPhotos(kind, entryId, files);
    if (errors.length > 0) toast.error(`Photo upload: ${errors[0]}`);
    return paths;
  };
}
