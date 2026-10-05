"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X, ChevronLeft } from "lucide-react";
import { Slot } from "@radix-ui/react-slot";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

// Inline mode: when a Sheet is rendered inside <SheetInlineProvider inline>,
// it renders in-flow (e.g. replacing the Home screen) instead of as an overlay.
type SheetInlineCtx = { inline: boolean; onClose?: () => void; noFit?: boolean };
const SheetInlineContext = React.createContext<SheetInlineCtx>({ inline: false });
// True for descendants of an inline SheetContent (titles must not use Radix Dialog parts).
const SheetInlineBodyContext = React.createContext(false);
const SheetInlineProvider = ({
  inline,
  noFit,
  children,
}: {
  inline: boolean;
  /** Grow with the content instead of fitting the screen height. */
  noFit?: boolean;
  children: React.ReactNode;
}) => (
  <SheetInlineContext.Provider value={{ inline, noFit }}>{children}</SheetInlineContext.Provider>
);

// Home-screen takeover: a menu tap "arms" the next opening Sheet, which then
// renders in-flow inside the registered slot instead of as an overlay.
type TakeoverOwner = { id: number; close: () => void };
const takeover = {
  armedUntil: 0,
  slot: null as HTMLElement | null,
  owner: null as TakeoverOwner | null,
  listeners: new Set<() => void>(),
};
const emitTakeover = () => takeover.listeners.forEach((l) => l());
let takeoverSeq = 0;
export function armSheetTakeover() {
  takeover.armedUntil = Date.now() + 600;
}
export function setSheetTakeoverSlot(el: HTMLElement | null) {
  takeover.slot = el;
  emitTakeover();
}
/** Close whichever panel currently owns the home takeover. */
export function releaseSheetTakeover() {
  const o = takeover.owner;
  if (o) o.close();
}
export function useSheetTakeoverActive() {
  return React.useSyncExternalStore(
    (l) => {
      takeover.listeners.add(l);
      return () => takeover.listeners.delete(l);
    },
    () => !!takeover.owner,
    () => false,
  );
}

/** Claims the home takeover slot when an armed panel opens; returns the slot or null. */
export function useTakeoverClaim(open: boolean | undefined, onOpenChange?: (o: boolean) => void, skip = false) {
  const idRef = React.useRef(0);
  if (!idRef.current) idRef.current = ++takeoverSeq;
  const wasOpenRef = React.useRef(false);
  const claimRef = React.useRef(false);
  const closeRef = React.useRef(() => onOpenChange?.(false));
  closeRef.current = () => onOpenChange?.(false);
  if (!skip) {
    if (open && !wasOpenRef.current && Date.now() < takeover.armedUntil && takeover.slot) {
      claimRef.current = true;
    }
    if (!open) claimRef.current = false;
    wasOpenRef.current = !!open;
  }
  const claimed = claimRef.current && !!open;
  React.useEffect(() => {
    if (!claimed) return;
    takeover.armedUntil = 0;
    const prev = takeover.owner;
    const me: TakeoverOwner = { id: idRef.current, close: () => closeRef.current() };
    takeover.owner = me;
    emitTakeover();
    if (prev && prev.id !== me.id) prev.close();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return () => {
      if (takeover.owner === me) {
        takeover.owner = null;
        emitTakeover();
      }
    };
  }, [claimed]);
  return claimed ? takeover.slot : null;
}

/** Fits an in-place panel to the screen height left below its top edge. */
export function useFitToScreen(ref: React.MutableRefObject<HTMLElement | null>, active: boolean) {
  React.useLayoutEffect(() => {
    const node = ref.current;
    if (!active || !node) return;
    const isPhone = () => window.innerWidth < 768;
    const fit = () => {
      if (isPhone()) {
        // Phones: panel fills the whole screen; the header scrolls off above it.
        node.style.height = `${window.innerHeight - 16}px`;
        // Pull up the page's trailing space so scrolling can't reveal a gap.
        node.style.marginBottom = "0px";
        const r = node.getBoundingClientRect();
        const below = document.documentElement.scrollHeight - (r.bottom + window.scrollY);
        node.style.marginBottom = `${-Math.max(0, below - 8)}px`;
        return;
      }
      node.style.marginBottom = "";
      const top = node.getBoundingClientRect().top + window.scrollY;
      const h = Math.max(320, window.innerHeight - top - 16);
      node.style.height = `${h}px`;
    };
    fit();
    if (isPhone()) {
      requestAnimationFrame(() => {
        const top = node.getBoundingClientRect().top + window.scrollY - 8;
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      });
    }
    window.addEventListener("resize", fit);
    const ro = new ResizeObserver(fit);
    if (node.parentElement?.parentElement) ro.observe(node.parentElement.parentElement);
    return () => {
      window.removeEventListener("resize", fit);
      ro.disconnect();
    };
  }, [ref, active]);
}

/** Round "<" button that closes an in-place panel. */
export function TakeoverCloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      aria-label="Close"
      data-touch-exempt
      onClick={onClose}
      className="absolute right-4 top-4 z-30 inline-flex h-8 min-h-0 min-w-0 shrink-0 items-center justify-center rounded-full border bg-background px-3 text-xs font-medium leading-none text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      Close
    </button>
  );
}

const Sheet = (props: React.ComponentProps<typeof SheetPrimitive.Root>) => {
  const ctx = React.useContext(SheetInlineContext);
  const slot = useTakeoverClaim(props.open, props.onOpenChange, ctx.inline);
  if (slot) {
    return createPortal(
      <SheetInlineContext.Provider value={{ inline: true, onClose: () => props.onOpenChange?.(false) }}>
        {props.children}
      </SheetInlineContext.Provider>,
      slot,
    );
  }
  if (ctx.inline && !ctx.onClose) {
    if (!props.open) return null;
    return (
      <SheetInlineContext.Provider
        value={{ inline: true, noFit: ctx.noFit, onClose: () => props.onOpenChange?.(false) }}
      >
        {props.children}
      </SheetInlineContext.Provider>
    );
  }
  return <SheetPrimitive.Root {...props} />;
};

const SheetTrigger = SheetPrimitive.Trigger;

const SheetClose = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Close>
>(({ asChild, onClick, ...props }, ref) => {
  const ctx = React.useContext(SheetInlineContext);
  if (ctx.onClose) {
    const Comp: React.ElementType = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        {...props}
        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
          onClick?.(e);
          ctx.onClose?.();
        }}
      />
    );
  }
  return <SheetPrimitive.Close ref={ref} asChild={asChild} onClick={onClick} {...props} />;
});
SheetClose.displayName = "SheetClose";

const SheetPortal = SheetPrimitive.Portal;

type SheetDragCtx = {
  enabled: boolean;
  contentRef: React.MutableRefObject<HTMLDivElement | null>;
  closeRef: React.MutableRefObject<HTMLButtonElement | null>;
};
const SheetDragContext = React.createContext<SheetDragCtx | null>(null);

// Clicks on an in-app toast (e.g. its dismiss button) must not be treated as
// an "outside interaction" that closes the open panel underneath it.
const isToastEventTarget = (target: EventTarget | null) =>
  target instanceof Element && !!target.closest("[data-sonner-toaster],[data-sonner-toast]");

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
    ref={ref}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetVariants = cva(
  "fixed z-50 flex flex-col gap-0 bg-background p-6 shadow-elevation-3 transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500 max-lg:data-[state=open]:animate-in max-lg:data-[state=closed]:animate-out lg:data-[state=open]:animate-[sheet-pop-in_250ms_ease-out] lg:data-[state=closed]:animate-[sheet-pop-out_180ms_ease-in]",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b rounded-b-3xl max-lg:data-[state=closed]:slide-out-to-top max-lg:data-[state=open]:slide-in-from-top lg:inset-x-auto lg:top-1/2 lg:left-1/2 lg:w-[calc(100vw-2rem)] lg:max-w-2xl lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-3xl lg:border lg:border-b lg:max-h-[85vh]",
        bottom:
          "inset-x-0 left-0 right-0 bottom-0 w-full max-w-none border-t rounded-t-3xl max-lg:h-[calc(100dvh-2cm)] max-lg:max-h-[calc(100dvh-2cm)] max-lg:data-[state=closed]:slide-out-to-bottom max-lg:data-[state=open]:slide-in-from-bottom lg:inset-x-auto lg:bottom-auto lg:top-1/2 lg:left-1/2 lg:w-[calc(100vw-2rem)] lg:max-w-2xl lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-3xl lg:border lg:max-h-[85vh]",
        left: "inset-y-0 left-0 h-full w-3/4 border-r rounded-r-3xl data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm lg:inset-auto lg:top-1/2 lg:left-1/2 lg:h-auto lg:max-h-[85vh] lg:w-[calc(100vw-2rem)] lg:max-w-2xl lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-3xl lg:border",
        right:
          "inset-y-0 right-0 h-full w-3/4 border-l rounded-l-3xl max-lg:data-[state=closed]:slide-out-to-right max-lg:data-[state=open]:slide-in-from-right sm:max-w-sm lg:inset-auto lg:top-1/2 lg:left-1/2 lg:h-auto lg:max-h-[85vh] lg:w-[calc(100vw-2rem)] lg:max-w-2xl lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-3xl lg:border",
      },
    },
    defaultVariants: {
      side: "right",
    },
  },
);

interface SheetContentProps
  extends
    React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  disableDragDismiss?: boolean;
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, disableDragDismiss, ...props }, ref) => {
  const inlineCtx = React.useContext(SheetInlineContext);
  const innerRef = React.useRef<HTMLDivElement | null>(null);
  const closeRef = React.useRef<HTMLButtonElement | null>(null);
  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      innerRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
    },
    [ref],
  );

  // Drag-to-dismiss is enabled on mobile for every side except the burger
  // (left) menu. Desktop disables drag entirely via a runtime width check
  // inside the header pointer handlers.
  const isDraggable = side !== "left" && !disableDragDismiss;
  const ctxValue = React.useMemo<SheetDragCtx>(
    () => ({ enabled: isDraggable, contentRef: innerRef, closeRef }),
    [isDraggable],
  );

  const isInline = !!(inlineCtx.inline && inlineCtx.onClose);
  useFitToScreen(innerRef, isInline && !inlineCtx.noFit);
  if (inlineCtx.inline && inlineCtx.onClose) {
    return (
      <div
        ref={setRefs}
        className={cn(
          className,
          "relative flex max-h-none flex-col overflow-hidden rounded-2xl border bg-background p-4 shadow-elevation-1 sm:p-6",
        )}
      >
        {!inlineCtx.noFit && <TakeoverCloseButton onClose={inlineCtx.onClose} />}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:overscroll-contain">
          <SheetInlineContext.Provider value={{ inline: false, onClose: inlineCtx.onClose }}>
            <SheetInlineBodyContext.Provider value={true}>{children}</SheetInlineBodyContext.Provider>
          </SheetInlineContext.Provider>
        </div>
      </div>
    );
  }

  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetDragContext.Provider value={ctxValue}>
      <SheetPrimitive.Content
        ref={setRefs}
        className={cn(
          sheetVariants({ side }),
          className,
          side === "bottom" &&
            "pb-[max(1.25rem,calc(env(safe-area-inset-bottom)+0.75rem))] lg:pb-6",
          side === "top" &&
            "pt-[max(1.25rem,calc(env(safe-area-inset-top)+0.75rem))] lg:pt-6",
          side === "left" && "pl-[max(1rem,env(safe-area-inset-left))]",
          side === "right" && "pr-[max(1rem,env(safe-area-inset-right))]",
        )}
        onOpenAutoFocus={(e) => {
          // Prevent inputs inside the sheet from stealing focus on open,
          // which would pop the mobile keyboard uninvited.
          e.preventDefault();
        }}
        {...props}
        onPointerDownOutside={(e) => {
          if (isToastEventTarget(e.target)) {
            e.preventDefault();
            return;
          }
          props.onPointerDownOutside?.(e);
        }}
        onInteractOutside={(e) => {
          if (isToastEventTarget(e.target)) {
            e.preventDefault();
            return;
          }
          props.onInteractOutside?.(e);
        }}
      >
        {isDraggable && (
          <div
            aria-hidden
            className="absolute top-2 left-1/2 -translate-x-1/2 h-1.5 w-10 rounded-full bg-muted-foreground/40 z-40 lg:hidden"
          />
        )}
        <SheetPrimitive.Close
          ref={closeRef}
          data-sheet-close
          className={cn(
            "absolute right-4 top-4 z-30 inline-flex items-center justify-center gap-1 rounded-md border bg-background px-2.5 h-7 text-xs font-medium text-muted-foreground cursor-pointer transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ring-offset-background disabled:pointer-events-none data-[state=open]:bg-secondary",
            // Drag-to-dismiss handles closing on touch; show close only on desktop.
            isDraggable && "max-lg:hidden lg:inline-flex",
          )}
        >
          <X className="h-3.5 w-3.5" />
          <span>Close</span>
        </SheetPrimitive.Close>
        <SheetInlineContext.Provider value={{ inline: false }}>
          <SheetInlineBodyContext.Provider value={false}>{children}</SheetInlineBodyContext.Provider>
        </SheetInlineContext.Provider>
      </SheetPrimitive.Content>
      </SheetDragContext.Provider>
    </SheetPortal>
  );
});
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  const ctx = React.useContext(SheetDragContext);
  const drag = React.useRef<{ startY: number; pointerId: number; locked: boolean } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!ctx?.enabled) return;
    // Desktop uses the close button; no drag-to-dismiss.
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) return;
    // Ignore drags starting from interactive controls in the header.
    const t = e.target as HTMLElement | null;
    if (t && t.closest("button, a, input, textarea, select, [role='button']")) return;
    drag.current = { startY: e.clientY, pointerId: e.pointerId, locked: false };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const node = ctx?.contentRef.current;
    if (!node) return;
    const dy = e.clientY - d.startY;
    if (!d.locked) {
      if (Math.abs(dy) < 5) return;
      if (dy <= 0) {
        drag.current = null;
        return;
      }
      d.locked = true;
      try {
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
      } catch {}
    }
    e.preventDefault();
    node.style.transition = "none";
    node.style.transform = `translateY(${Math.max(0, dy)}px)`;
  };

  const end = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    const node = ctx?.contentRef.current;
    if (!node) return;
    const dy = Math.max(0, e.clientY - d.startY);
    const threshold = Math.min(140, node.getBoundingClientRect().height * 0.2);
    node.style.transition = "";
    node.style.transform = "";
    if (dy > threshold) ctx?.closeRef.current?.click();
  };

  return (
    <div
      className={cn(
        "sticky top-0 z-20 bg-background pb-3",
        "flex flex-col space-y-3 text-center sm:text-left",
        ctx?.enabled && "max-lg:touch-none max-lg:cursor-grab max-lg:active:cursor-grabbing max-lg:select-none",
        className,
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      {...props}
    >
      {children}
    </div>
  );
};
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, asChild: _a, ...props }, ref) => {
  const inlineBody = React.useContext(SheetInlineBodyContext);
  const cls = cn("text-lg font-semibold text-foreground", !inlineBody && "pr-16", className);
  if (inlineBody) return <h2 ref={ref} className={cls} {...props} />;
  return <SheetPrimitive.Title ref={ref} className={cls} {...props} />;
});
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, asChild: _a, ...props }, ref) => {
  const inlineBody = React.useContext(SheetInlineBodyContext);
  const cls = cn("text-sm leading-relaxed text-muted-foreground", className);
  if (inlineBody) return <p ref={ref} className={cls} {...props} />;
  return <SheetPrimitive.Description ref={ref} className={cls} {...props} />;
});
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetInlineProvider,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
