import { useEffect, useRef, useState } from "react";
import { canStartHomeRefresh, isRefreshPull, shouldRefreshHome } from "@/lib/home-refresh";

/** Native non-passive touch events keep Safari/Chrome from cancelling a pull
 * when they claim normal scrolling. Only a downward Home-at-top pull is owned. */
export function useHomeRefresh(onRefresh: () => Promise<unknown>, enabled: boolean) {
  const ref = useRef<HTMLElement | null>(null);
  const latest = useRef({ onRefresh, enabled });
  latest.current = { onRefresh, enabled };
  const busy = useRef(false);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let drag: { x: number; y: number; distance: number; active: boolean; id: number } | null = null;
    let suppressClickUntil = 0;
    const reset = () => { drag = null; setPull(0); };
    const start = (event: TouchEvent) => {
      reset();
      if (!canStartHomeRefresh(window.innerWidth < 1024, latest.current.enabled, window.scrollY, busy.current) || event.touches.length !== 1) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("input, textarea, select, [role='dialog'], [data-mobile-tabbar], [data-mobile-topbar], [data-no-swipe]")) return;
      // Never steal a nested list's own scroll gesture.
      let ancestor = target;
      while (ancestor && ancestor !== node) {
        const style = getComputedStyle(ancestor);
        if (/(auto|scroll)/.test(style.overflowY) && ancestor.scrollHeight > ancestor.clientHeight) return;
        ancestor = ancestor.parentElement;
      }
      const touch = event.touches[0];
      if (touch) drag = { x: touch.clientX, y: touch.clientY, id: touch.identifier, distance: 0, active: false };
    };
    const move = (event: TouchEvent) => {
      if (!drag || !latest.current.enabled || event.touches.length !== 1) { reset(); return; }
      const touch = Array.from(event.touches).find((t) => t.identifier === drag?.id);
      if (!touch) return;
      const dx = touch.clientX - drag.x;
      const dy = touch.clientY - drag.y;
      if (!drag.active) {
        if (dy < -8 || Math.abs(dx) > 12 && !isRefreshPull(dx, dy)) { reset(); return; }
        if (!isRefreshPull(dx, dy)) return;
        drag.active = true;
      }
      if (event.cancelable) event.preventDefault();
      drag.distance = Math.min(96, Math.max(0, dy * 0.5));
      setPull(drag.distance);
      suppressClickUntil = Date.now() + 700;
    };
    const end = () => {
      const distance = drag?.distance ?? 0;
      reset();
      if (!latest.current.enabled || busy.current || !shouldRefreshHome(distance)) return;
      busy.current = true;
      setRefreshing(true);
      void latest.current.onRefresh().catch(() => {}).finally(() => {
        busy.current = false;
        setRefreshing(false);
      });
    };
    const click = (event: MouseEvent) => {
      if (Date.now() < suppressClickUntil) { event.preventDefault(); event.stopPropagation(); }
    };
    node.addEventListener("touchstart", start, { passive: true });
    node.addEventListener("touchmove", move, { passive: false });
    node.addEventListener("touchend", end);
    node.addEventListener("touchcancel", reset);
    node.addEventListener("click", click, true);
    return () => {
      node.removeEventListener("touchstart", start);
      node.removeEventListener("touchmove", move);
      node.removeEventListener("touchend", end);
      node.removeEventListener("touchcancel", reset);
      node.removeEventListener("click", click, true);
    };
  }, []);

  return { ref, pull: enabled ? pull : 0, refreshing };
}