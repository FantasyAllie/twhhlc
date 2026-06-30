"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;

const SheetTrigger = SheetPrimitive.Trigger;

const SheetClose = SheetPrimitive.Close;

const SheetPortal = SheetPrimitive.Portal;

type SheetDragCtx = {
  enabled: boolean;
  contentRef: React.MutableRefObject<HTMLDivElement | null>;
  closeRef: React.MutableRefObject<HTMLButtonElement | null>;
};
const SheetDragContext = React.createContext<SheetDragCtx | null>(null);

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
  "fixed z-50 flex flex-col gap-0 bg-background p-6 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500 max-lg:data-[state=open]:animate-in max-lg:data-[state=closed]:animate-out lg:data-[state=open]:animate-[sheet-pop-in_350ms_cubic-bezier(0.34,1.56,0.64,1)] lg:data-[state=closed]:animate-[sheet-pop-out_180ms_ease-in]",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b rounded-b-2xl max-lg:data-[state=closed]:slide-out-to-top max-lg:data-[state=open]:slide-in-from-top lg:inset-x-auto lg:top-1/2 lg:left-1/2 lg:w-[calc(100vw-2rem)] lg:max-w-2xl lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-2xl lg:border lg:border-b lg:max-h-[85vh]",
        bottom:
          "inset-x-0 left-0 right-0 bottom-0 w-full max-w-none border-t rounded-t-2xl max-lg:data-[state=closed]:slide-out-to-bottom max-lg:data-[state=open]:slide-in-from-bottom lg:inset-x-auto lg:bottom-auto lg:top-1/2 lg:left-1/2 lg:w-[calc(100vw-2rem)] lg:max-w-2xl lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-2xl lg:border lg:max-h-[85vh]",
        left: "inset-y-0 left-0 h-full w-3/4 border-r rounded-r-2xl data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm lg:inset-auto lg:top-1/2 lg:left-1/2 lg:h-auto lg:max-h-[85vh] lg:w-[calc(100vw-2rem)] lg:max-w-2xl lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-2xl lg:border",
        right:
          "inset-y-0 right-0 h-full w-3/4 border-l rounded-l-2xl max-lg:data-[state=closed]:slide-out-to-right max-lg:data-[state=open]:slide-in-from-right sm:max-w-sm lg:inset-auto lg:top-1/2 lg:left-1/2 lg:h-auto lg:max-h-[85vh] lg:w-[calc(100vw-2rem)] lg:max-w-2xl lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-2xl lg:border",
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
    VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, ...props }, ref) => {
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
  const isDraggable = side !== "left";
  const ctxValue = React.useMemo<SheetDragCtx>(
    () => ({ enabled: isDraggable, contentRef: innerRef, closeRef }),
    [isDraggable],
  );

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
        {...props}
      >
        <SheetPrimitive.Close
          ref={closeRef}
          className={cn(
            "absolute right-4 top-4 z-30 inline-flex items-center justify-center gap-1 rounded-md border bg-background px-2.5 h-7 text-xs font-medium text-muted-foreground cursor-pointer transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ring-offset-background disabled:pointer-events-none data-[state=open]:bg-secondary",
            // Drag-to-dismiss handles closing on touch; show close only on desktop.
            isDraggable && "max-lg:hidden lg:inline-flex",
          )}
        >
          <X className="h-3.5 w-3.5" />
          <span>Close</span>
        </SheetPrimitive.Close>
        {children}
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
      {ctx?.enabled && (
        <div
          aria-hidden
          className="mx-auto -mt-2 mb-1 h-1.5 w-10 rounded-full bg-muted-foreground/30 lg:hidden"
        />
      )}
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
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("pr-16 text-lg font-semibold text-foreground", className)}
    {...props}
  />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm leading-relaxed text-muted-foreground", className)}
    {...props}
  />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
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
