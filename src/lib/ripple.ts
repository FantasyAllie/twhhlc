// Material "ripple on tap": a splash layer appended inside the pressed
// element. The host element must be position:relative + overflow-hidden, so
// the ink is clipped to that element and never touches its neighbours.
import * as React from "react";

export function useRipple<T extends HTMLElement>(
  onPointerDown?: React.PointerEventHandler<T>,
) {
  return React.useCallback(
    (event: React.PointerEvent<T>) => {
      onPointerDown?.(event);
      const host = event.currentTarget;
      if (!host || host.hasAttribute("disabled")) return;
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

      const rect = host.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2;
      const ink = document.createElement("span");
      ink.className = "ripple-ink";
      ink.style.width = `${size}px`;
      ink.style.height = `${size}px`;
      ink.style.left = `${event.clientX - rect.left - size / 2}px`;
      ink.style.top = `${event.clientY - rect.top - size / 2}px`;
      ink.addEventListener("animationend", () => ink.remove());
      host.appendChild(ink);
      window.setTimeout(() => ink.remove(), 900);
    },
    [onPointerDown],
  );
}
