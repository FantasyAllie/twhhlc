/** The accent colours, matching the iPhone app. `k` scales the colour's strength. */
export const ACCENTS = [
  { id: "brass", label: "Brass", hue: 88, k: 1 },
  { id: "harbour", label: "Harbour", hue: 247, k: 0.75 },
  { id: "sage", label: "Sage", hue: 152, k: 0.6 },
  { id: "heather", label: "Heather", hue: 302, k: 0.72 },
  { id: "coral", label: "Coral", hue: 35, k: 0.85 },
  { id: "silver", label: "Silver", hue: 261, k: 0.15 },
] as const;
export type AccentId = (typeof ACCENTS)[number]["id"];

/** Earlier choices map onto the nearest of today's colours. */
const OLD: Record<string, AccentId> = {
  blue: "harbour", sky: "harbour", indigo: "harbour", teal: "sage", green: "sage", mint: "sage", lime: "sage",
  violet: "heather", purple: "heather", pink: "heather", rose: "coral", red: "coral", orange: "coral",
};

/** Swatch colour for an accent, matching the --brass token's lightness/chroma. */
export const accentSwatch = (hue: number, k = 1) => `oklch(0.719 ${(0.129 * k).toFixed(3)} ${hue})`;

export function readAccent(): AccentId {
  try {
    const v = localStorage.getItem("accent");
    if (v && ACCENTS.some((a) => a.id === v)) return v as AccentId;
    if (v && OLD[v]) return OLD[v];
  } catch { /* ignore */ }
  return "brass";
}
export function applyAccent(id: AccentId) {
  document.documentElement.dataset.accent = id;
  try { localStorage.setItem("accent", id); } catch { /* ignore */ }
}
