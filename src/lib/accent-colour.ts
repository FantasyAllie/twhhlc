export const ACCENTS = [
  { id: "brass", label: "Brass", hue: 88 },
  { id: "teal", label: "Teal", hue: 190 },
  { id: "blue", label: "Blue", hue: 250 },
  { id: "violet", label: "Violet", hue: 300 },
  { id: "rose", label: "Rose", hue: 10 },
  { id: "green", label: "Green", hue: 145 },
  { id: "orange", label: "Orange", hue: 55 },
  { id: "red", label: "Red", hue: 27 },
  { id: "pink", label: "Pink", hue: 350 },
  { id: "purple", label: "Purple", hue: 320 },
  { id: "indigo", label: "Indigo", hue: 275 },
  { id: "sky", label: "Sky", hue: 225 },
  { id: "mint", label: "Mint", hue: 170 },
  { id: "lime", label: "Lime", hue: 120 },
] as const;
export type AccentId = (typeof ACCENTS)[number]["id"];

/** Swatch colour for an accent, matching the --brass token's lightness/chroma. */
export const accentSwatch = (hue: number) => `oklch(0.719 0.129 ${hue})`;

export function readAccent(): AccentId {
  try {
    const v = localStorage.getItem("accent");
    if (v && ACCENTS.some((a) => a.id === v)) return v as AccentId;
  } catch { /* ignore */ }
  return "brass";
}
export function applyAccent(id: AccentId) {
  document.documentElement.dataset.accent = id;
  try { localStorage.setItem("accent", id); } catch { /* ignore */ }
}
