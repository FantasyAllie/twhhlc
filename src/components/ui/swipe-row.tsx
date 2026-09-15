// A list row you can swipe sideways to reveal its actions: swipe right for the
// primary action (e.g. Done), swipe left for Delete (which asks to confirm).
// Every action also stays available as a normal button, so nothing depends on
// knowing the gesture.
import * as React from "react";
import { Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { playClick } from "@/lib/click-sound";

const REVEAL = 88;
const TRIGGER = 64;

export function SwipeRow({
  children,
  onPrimary,
  primaryLabel = "Done",
  onDelete,
  className,
}: {
  children: React.ReactNode;
  onPrimary?: () => void;
  primaryLabel?: string;
  onDelete?: () => void;
  className?: string;
}) {
  const [dx, setDx] = React.useState(0);
  const [confirming, setConfirming] = React.useState(false);
  const drag = React.useRef<{ x: number; y: number; id: number; locked: boolean } | null>(null);

  const settle = () => {
    drag.current = null;
    setDx(0);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return;
    const target = e.target as HTMLElement | null;
    if (target?.closest?.("button,a,input,textarea,select,[role='button']")) return;
    drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, locked: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const mx = e.clientX - d.x;
    const my = e.clientY - d.y;
    if (!d.locked) {
      if (Math.abs(mx) < 10) return;
      // A mostly-vertical gesture is a scroll: give up on the swipe.
      if (Math.abs(mx) < Math.abs(my)) {
        drag.current = null;
        return;
      }
      d.locked = true;
    }
    const allowed = mx > 0 ? !!onPrimary : !!onDelete;
    if (!allowed) return;
    setDx(Math.max(-REVEAL, Math.min(REVEAL, mx)));
  };

  const onPointerUp = () => {
    const moved = dx;
    settle();
    if (moved >= TRIGGER && onPrimary) {
      playClick();
      onPrimary();
    } else if (moved <= -TRIGGER && onDelete) {
      playClick();
      setConfirming(true);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Action hints revealed underneath the row while it is dragged. */}
      {onPrimary && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 flex w-24 items-center justify-start gap-1 bg-primary px-3 text-xs font-semibold text-primary-foreground"
          style={{ opacity: dx > 0 ? Math.min(1, dx / TRIGGER) : 0 }}
        >
          <Check className="h-4 w-4" />
          {primaryLabel}
        </div>
      )}
      {onDelete && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 flex w-24 items-center justify-end gap-1 bg-destructive px-3 text-xs font-semibold text-destructive-foreground"
          style={{ opacity: dx < 0 ? Math.min(1, -dx / TRIGGER) : 0 }}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </div>
      )}
      <div
        data-swipe-row
        className={cn("swipe-row relative", className)}
        style={{ transform: `translateX(${dx}px)`, transition: drag.current ? "none" : "transform 180ms ease-out" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={settle}
      >
        {children}
        {confirming && (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-lg bg-background/95 px-3">
            <span className="text-sm font-medium">Delete this?</span>
            <button
              type="button"
              className="touch-target rounded-lg bg-destructive px-3 text-sm font-semibold text-destructive-foreground"
              onClick={() => {
                setConfirming(false);
                onDelete?.();
              }}
            >
              Delete
            </button>
            <button
              type="button"
              className="touch-target rounded-lg border px-3 text-sm font-medium"
              onClick={() => setConfirming(false)}
            >
              Keep
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
