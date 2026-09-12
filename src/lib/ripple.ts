// Material "ripple on tap": a splash layer appended inside the pressed
// element. The host clips the ink, so it is always contained to that element
// and never bleeds onto neighbouring controls.
import * as React from "react";
import { playClick } from "./click-sound";

const RIPPLE_SELECTOR = [
  "button",
  "a[href]",
  "summary",
  '[role="button"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="option"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="radio"]',
  "[data-ripple]",
].join(",");

const spawnInk = (host: HTMLElement, clientX: number, clientY: number) => {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const rect = host.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const style = window.getComputedStyle(host);
  if (style.position === "static") host.style.position = "relative";
  if (style.overflow === "visible") host.style.overflow = "hidden";

  const size = Math.max(rect.width, rect.height) * 2;
  const ink = document.createElement("span");
  ink.className = "ripple-ink";
  ink.style.width = `${size}px`;
  ink.style.height = `${size}px`;
  ink.style.left = `${clientX - rect.left - size / 2}px`;
  ink.style.top = `${clientY - rect.top - size / 2}px`;
  ink.addEventListener("animationend", () => ink.remove());
  host.appendChild(ink);
  window.setTimeout(() => ink.remove(), 900);
};

// Opt-in hook for custom elements that are not caught by the global listener.
export function useRipple<T extends HTMLElement>(
  onPointerDown?: React.PointerEventHandler<T>,
) {
  return React.useCallback(
    (event: React.PointerEvent<T>) => {
      onPointerDown?.(event);
      const host = event.currentTarget as unknown as HTMLElement;
      if (!host || host.hasAttribute("disabled")) return;
      playClick();
      spawnInk(host, event.clientX, event.clientY);
    },
    [onPointerDown],
  );
}

// One delegated listener covers every tappable control in the app, including
// shadcn primitives and one-off custom buttons.
export function installGlobalRipple() {
  if (typeof document === "undefined") return () => {};
  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    const host = target?.closest?.(RIPPLE_SELECTOR) as HTMLElement | null;
    if (!host) return;
    if (host.hasAttribute("disabled") || host.getAttribute("aria-disabled") === "true") return;
    if (host.closest("[data-no-ripple]")) return;
    playClick();
    spawnInk(host, event.clientX, event.clientY);
  };
  document.addEventListener("pointerdown", onPointerDown, true);
  return () => document.removeEventListener("pointerdown", onPointerDown, true);
}

export function useGlobalRipple() {
  React.useEffect(() => installGlobalRipple(), []);
}
