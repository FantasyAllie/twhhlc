export const ACCENTS = [
  { id: "brass", label: "Brass" },
  { id: "teal", label: "Teal" },
  { id: "blue", label: "Blue" },
  { id: "violet", label: "Violet" },
  { id: "rose", label: "Rose" },
  { id: "green", label: "Green" },
] as const;
export type AccentId = (typeof ACCENTS)[number]["id"];

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
