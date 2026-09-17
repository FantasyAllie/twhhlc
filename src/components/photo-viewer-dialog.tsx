import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function PhotoViewerDialog({
  open,
  onOpenChange,
  src,
  alt = "Photo",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string | null;
  alt?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-3 pt-6 lg:p-4">
        <DialogHeader className="h-3 shrink-0 pb-0" aria-label="Drag down to close">
          <DialogTitle className="sr-only">Photo viewer</DialogTitle>
        </DialogHeader>
        {src && (
          <div className="flex min-h-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
            <img src={src} alt={alt} className="max-h-[78dvh] w-full object-contain" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}