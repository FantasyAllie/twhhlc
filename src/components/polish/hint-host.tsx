import { useEffect, useState } from "react";
import { usePolishPref } from "@/lib/polish";

type Hint = { text: string; x: number; y: number; above: boolean };

const DELAY = 450;

/** The button's own name, when it shows no words of its own (an icon button). */
function hintFor(el: HTMLElement): string | null {
  const label = el.getAttribute("aria-label") ?? el.dataset.polishTitle ?? el.getAttribute("title");
  if (!label?.trim()) return null;
  if (el.innerText.trim() !== "") return null;
  return label.trim();
}

/**
 * Polish preview: a small label under every icon-only button on hover or keyboard
 * focus, using the name the button already has (aria-label or title). Computers only.
 */
export function HintHost() {
  const [on] = usePolishPref();
  const [hint, setHint] = useState<Hint | null>(null);

  useEffect(() => {
    if (!on) return;
    let timer: number | undefined;
    let current: HTMLElement | null = null;

    const place = (el: HTMLElement, text: string) => {
      const r = el.getBoundingClientRect();
      const above = r.bottom + 36 > window.innerHeight;
      setHint({ text, x: r.left + r.width / 2, y: above ? r.top - 6 : r.bottom + 6, above });
    };
    const hide = () => {
      window.clearTimeout(timer);
      current = null;
      setHint(null);
    };
    const target = (e: Event) =>
      (e.target as HTMLElement | null)?.closest?.<HTMLElement>("button, a, [role='button']") ?? null;

    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || window.innerWidth < 1024) return;
      const el = target(e);
      if (el === current) return;
      hide();
      if (!el) return;
      // Our label replaces the browser's slower one.
      const title = el.getAttribute("title");
      if (title) { el.dataset.polishTitle = title; el.removeAttribute("title"); }
      const text = hintFor(el);
      if (!text) return;
      current = el;
      timer = window.setTimeout(() => current === el && place(el, text), DELAY);
    };
    const onOut = (e: PointerEvent) => {
      if (current && !current.contains(e.relatedTarget as Node | null)) hide();
    };
    const onFocus = (e: FocusEvent) => {
      const el = target(e);
      if (!el || !el.matches(":focus-visible") || window.innerWidth < 1024) return;
      const text = hintFor(el);
      if (!text) return;
      current = el;
      place(el, text);
    };

    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);
    document.addEventListener("pointerdown", hide, true);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", hide);
    window.addEventListener("scroll", hide, true);
    return () => {
      hide();
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("pointerdown", hide, true);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", hide);
      window.removeEventListener("scroll", hide, true);
      // Switched off: give buttons their own labels back.
      document.querySelectorAll<HTMLElement>("[data-polish-title]").forEach((el) => {
        el.setAttribute("title", el.dataset.polishTitle ?? "");
        delete el.dataset.polishTitle;
      });
    };
  }, [on]);

  if (!on || !hint) return null;
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[100] max-w-[16rem] rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background shadow-md animate-in fade-in-0 zoom-in-95 duration-100"
      style={{ left: hint.x, top: hint.y, transform: `translate(-50%, ${hint.above ? "-100%" : "0"})` }}
    >
      {hint.text}
    </div>
  );
}
