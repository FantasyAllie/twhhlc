// Touch gestures shared across the app: horizontal swipe navigation between
// filters/pages and pull-to-refresh on scrolling lists. Pointer events only —
// no dependency, and vertical scrolling always wins over a horizontal swipe.
import * as React from "react";

const isCoarsePointer = () =>
  typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

type SwipeNavOptions = {
  onNext?: () => void;
  onPrev?: () => void;
  /** Minimum horizontal travel (px) before the swipe counts. */
  threshold?: number;
  enabled?: boolean;
};

/**
 * Swipe left/right anywhere in a region (a list, a set of pills) to step
 * forward or back. Gestures that begin inside a [data-swipe-row] are ignored so
 * per-row swipe actions keep working.
 */
export function useSwipeNav(options: SwipeNavOptions) {
  const start = React.useRef<SwipeStart>(null);
  return swipeNavProps(start, options);
}

type SwipeStart = { x: number; y: number; id: number } | null;

/** Hold the gesture state yourself when handlers are built conditionally. */
export function useSwipeState() {
  return React.useRef<SwipeStart>(null);
}

/** Handler props for a swipe region, given externally held gesture state. */
export function swipeNavProps(
  start: React.MutableRefObject<SwipeStart>,
  { onNext, onPrev, threshold = 60, enabled = true }: SwipeNavOptions,
) {
  if (!enabled) return {};

  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") return;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.("[data-swipe-row],input,textarea,select,[data-no-swipe]")) return;
      start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    },
    onPointerUp: (e: React.PointerEvent) => {
      const s = start.current;
      start.current = null;
      if (!s || e.pointerId !== s.id) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if (dx < 0) onNext?.();
      else onPrev?.();
    },
    onPointerCancel: () => {
      start.current = null;
    },
  };
}

/**
 * Pull down at the top of a scroll container to refresh. Returns props for the
 * scroll container plus the current pull distance so a spinner can be shown.
 */
export function usePullToRefresh(
  onRefresh: () => void | Promise<unknown>,
  options: { enabled?: boolean; atTop?: () => boolean } = {},
) {
  const { enabled = true, atTop } = options;
  const [pull, setPull] = React.useState(0);
  const [refreshing, setRefreshing] = React.useState(false);
  const drag = React.useRef<{ y: number; id: number; active: boolean } | null>(null);
  const TRIGGER = 70;

  const reset = () => {
    drag.current = null;
    setPull(0);
  };

  if (!enabled) {
    return { pull: 0, refreshing: false, handlers: {} as Record<string, never> };
  }

  const handlers = {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType === "mouse" || refreshing) return;
      const el = e.currentTarget;
      if (el.scrollTop > 0) return;
      drag.current = { y: e.clientY, id: e.pointerId, active: false };
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.id) return;
      const dy = e.clientY - d.y;
      if (dy <= 0) {
        if (!d.active) drag.current = null;
        setPull(0);
        return;
      }
      d.active = true;
      setPull(Math.min(dy * 0.5, TRIGGER + 20));
    },
    onPointerUp: async () => {
      const pulled = pull;
      reset();
      if (pulled < TRIGGER * 0.8) return;
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    },
    onPointerCancel: reset,
    onPointerLeave: reset,
  };

  return { pull, refreshing, handlers };
}

export { isCoarsePointer };
