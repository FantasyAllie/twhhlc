"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";
import { Slot } from "@radix-ui/react-slot";
import { useTakeoverClaim, TakeoverCloseButton, useFitToScreen } from "@/components/ui/sheet";

// When a menu tap claims the home takeover, the dialog renders in-flow there.
const DialogInlineContext = React.createContext<null | (() => void)>(null);

const Dialog = (props: React.ComponentProps<typeof DialogPrimitive.Root>) => {
  const slot = useTakeoverClaim(props.open, props.onOpenChange);
  if (slot) {
    if (!props.open) return null;
    return createPortal(
      <DialogInlineContext.Provider value={() => props.onOpenChange?.(false)}>
        {props.children}
      </DialogInlineContext.Provider>,
      slot,
    );
  }
  return (
    <DialogInlineContext.Provider value={null}>
      <DialogPrimitive.Root {...props} />
    </DialogInlineContext.Provider>
  );
};

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Close>
>(({ asChild, onClick, ...props }, ref) => {
  const inlineClose = React.useContext(DialogInlineContext);
  if (inlineClose) {
    const Comp: React.ElementType = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        {...props}
        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
          onClick?.(e);
          inlineClose();
        }}
      />
    );
  }
  return <DialogPrimitive.Close ref={ref} asChild={asChild} onClick={onClick} {...props} />;
});
DialogClose.displayName = "DialogClose";

type DialogDragCtx = {
  contentRef: React.MutableRefObject<HTMLDivElement | null>;
  closeRef: React.MutableRefObject<HTMLButtonElement | null>;
};
const DialogDragContext = React.createContext<DialogDragCtx | null>(null);

// Clicks on an in-app toast (e.g. its dismiss button) must not be treated as
// an "outside interaction" that closes the open panel underneath it.
const isToastEventTarget = (target: EventTarget | null) =>
  target instanceof Element && !!target.closest("[data-sonner-toaster],[data-sonner-toast]");

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
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
  const ctx = React.useMemo<DialogDragCtx>(() => ({ contentRef: innerRef, closeRef }), []);
  const inlineClose = React.useContext(DialogInlineContext);
  useFitToScreen(innerRef, !!inlineClose);
  if (inlineClose) {
    return (
      <div
        ref={setRefs}
        className={cn(
          className,
          "relative flex max-h-none w-full max-w-none flex-col gap-0 overflow-hidden rounded-2xl border bg-background p-4 shadow-elevation-1 sm:p-6",
        )}
      >
        <TakeoverCloseButton onClose={inlineClose} />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">{children}</div>
      </div>
    );
  }
  return (
  <DialogPortal>
    <DialogOverlay />
    <DialogDragContext.Provider value={ctx}>
    <DialogPrimitive.Content
      ref={setRefs}
      className={cn(
        // Slide-up bottom sheet (mobile) / centered modal (desktop), matching
        // the Sheet component so all popups feel consistent.
        "fixed z-50 inset-x-0 bottom-0 left-0 right-0 !w-full !max-w-none flex flex-col gap-0 bg-background p-6 shadow-elevation-3 border-t rounded-t-3xl max-h-[90vh] overflow-hidden",
        "pb-[max(1.25rem,calc(env(safe-area-inset-bottom)+0.75rem))] lg:pb-6",
        "transition ease-in-out max-lg:data-[state=open]:animate-in max-lg:data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500 max-lg:data-[state=closed]:slide-out-to-bottom max-lg:data-[state=open]:slide-in-from-bottom lg:data-[state=open]:animate-[sheet-pop-in_250ms_ease-out] lg:data-[state=closed]:animate-[sheet-pop-out_180ms_ease-in]",
        "lg:inset-x-auto lg:bottom-auto lg:top-1/2 lg:left-1/2 lg:!w-[calc(100vw-2rem)] lg:!max-w-2xl lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-3xl lg:border lg:max-h-[85vh]",
        className,
      )}
      onOpenAutoFocus={(e) => {
        // Prevent inputs inside the dialog from stealing focus on open,
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
      <div
        aria-hidden
        className="absolute top-2 left-1/2 -translate-x-1/2 h-1.5 w-10 rounded-full bg-muted-foreground/40 z-40 lg:hidden"
      />
      <DialogPrimitive.Close
        ref={closeRef}
        data-dialog-close-bar
        className="absolute right-4 top-4 z-30 max-lg:hidden lg:inline-flex items-center justify-center gap-1 rounded-md border bg-background px-2.5 h-7 text-xs font-medium text-muted-foreground cursor-pointer transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <X className="h-3.5 w-3.5" />
        <span>Close</span>
      </DialogPrimitive.Close>
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-0">
        {children}
      </div>
    </DialogPrimitive.Content>
    </DialogDragContext.Provider>
  </DialogPortal>
);
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  const ctx = React.useContext(DialogDragContext);
  const drag = React.useRef<{ startY: number; pointerId: number; locked: boolean } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!ctx) return;
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) return;
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
      if (dy <= 0) { drag.current = null; return; }
      d.locked = true;
      try { (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId); } catch {}
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
        "flex flex-col space-y-3 text-left",
        "max-lg:touch-none max-lg:cursor-grab max-lg:active:cursor-grabbing max-lg:select-none",
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
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, asChild: _a, ...props }, ref) => {
  const inline = React.useContext(DialogInlineContext);
  const cls = cn("pr-16 text-lg font-semibold leading-none tracking-tight", className);
  if (inline) return <h2 ref={ref} className={cls} {...props} />;
  return <DialogPrimitive.Title ref={ref} className={cls} {...props} />;
});
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, asChild: _a, ...props }, ref) => {
  const inline = React.useContext(DialogInlineContext);
  const cls = cn("text-sm leading-relaxed text-muted-foreground", className);
  if (inline) return <p ref={ref} className={cls} {...props} />;
  return <DialogPrimitive.Description ref={ref} className={cls} {...props} />;
});
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
