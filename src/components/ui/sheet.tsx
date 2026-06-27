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
  "fixed z-50 flex flex-col gap-0 bg-background p-6 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500 data-[state=open]:animate-in data-[state=closed]:animate-out",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b rounded-b-2xl data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 left-0 right-0 bottom-0 w-full max-w-none border-t rounded-t-2xl data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom lg:inset-x-auto lg:bottom-auto lg:top-1/2 lg:left-1/2 lg:w-[calc(100vw-2rem)] lg:max-w-2xl lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-2xl lg:border lg:max-h-[85vh]",
        left: "inset-y-0 left-0 h-full w-3/4 border-r rounded-r-2xl data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm lg:inset-auto lg:top-1/2 lg:left-1/2 lg:h-auto lg:max-h-[85vh] lg:w-[calc(100vw-2rem)] lg:max-w-2xl lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-2xl lg:border",
        right:
          "inset-y-0 right-0 h-full w-3/4 border-l rounded-l-2xl data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm lg:inset-auto lg:top-1/2 lg:left-1/2 lg:h-auto lg:max-h-[85vh] lg:w-[calc(100vw-2rem)] lg:max-w-2xl lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-2xl lg:border",
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

  const drag = React.useRef<{
    startY: number;
    pointerId: number;
    axisLocked: boolean;
  } | null>(null);

  const isMobileBottom = side === "bottom";

  const ancestorScrolledDown = (
    target: EventTarget | null,
    container: HTMLElement,
  ) => {
    let el = target as HTMLElement | null;
    while (el && el !== container) {
      const style = window.getComputedStyle(el);
      const oy = style.overflowY;
      if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight) {
        if (el.scrollTop > 0) return true;
      }
      el = el.parentElement;
    }
    return false;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isMobileBottom) return;
    if (e.pointerType !== "touch") return;
    const node = innerRef.current;
    if (!node) return;
    if (ancestorScrolledDown(e.target, node)) return;
    drag.current = { startY: e.clientY, pointerId: e.pointerId, axisLocked: false };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const node = innerRef.current;
    if (!node) return;
    const dy = e.clientY - d.startY;
    if (!d.axisLocked) {
      if (Math.abs(dy) < 6) return;
      if (dy <= 0) {
        drag.current = null;
        return;
      }
      d.axisLocked = true;
      try {
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
      } catch {}
    }
    const offset = Math.max(0, dy);
    node.style.transition = "none";
    node.style.transform = `translateY(${offset}px)`;
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    const node = innerRef.current;
    if (!node) return;
    const dy = Math.max(0, e.clientY - d.startY);
    const threshold = Math.min(160, node.getBoundingClientRect().height * 0.25);
    node.style.transition = "";
    node.style.transform = "";
    if (dy > threshold) closeRef.current?.click();
  };

  return (
    <SheetPortal>
      <SheetOverlay />
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
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        {...props}
      >
        {isMobileBottom && (
          <div
            aria-hidden
            className="lg:hidden absolute left-1/2 top-2 -translate-x-1/2 h-1.5 w-10 rounded-full bg-muted-foreground/30"
          />
        )}
        <SheetPrimitive.Close
          ref={closeRef}
          className="absolute right-4 top-4 z-30 inline-flex items-center justify-center gap-1 rounded-md border bg-background px-2.5 h-7 text-xs font-medium text-muted-foreground cursor-pointer transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ring-offset-background disabled:pointer-events-none data-[state=open]:bg-secondary"
        >
          <X className="h-3.5 w-3.5" />
          <span>Close</span>
        </SheetPrimitive.Close>
        {children}
      </SheetPrimitive.Content>
    </SheetPortal>
  );
});
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      // Pin the title / description / close button to the top of the sheet
      // so they stay visible while the body content scrolls underneath.
      // bg-background keeps scrolled content from showing through.
      "sticky top-0 z-20 bg-background pb-3",
      "flex flex-col space-y-3 text-center sm:text-left",
      className,
    )}
    {...props}
  />
);
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
