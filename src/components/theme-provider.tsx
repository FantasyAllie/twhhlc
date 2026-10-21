import { createContext, useContext, useEffect, useState } from "react";

/**
 * Four theme levels, cycled in order:
 * 1 white  — crisp neutral light
 * 2 cream  — the Ink & Brass warm canvas (default)
 * 3 navy   — deep ink dark mode
 * 4 oled   — true-black dark mode for OLED panels
 */
export type ThemeLevel = "white" | "cream" | "navy" | "oled";
type Theme = "light" | "dark";

export const THEME_LEVELS: ThemeLevel[] = ["cream", "navy"];

export const THEME_LEVEL_LABELS: Record<ThemeLevel, string> = {
  white: "White",
  cream: "Cream",
  navy: "Navy",
  oled: "OLED black",
};

const isDarkLevel = (l: ThemeLevel) => l === "navy" || l === "oled";

const ThemeContext = createContext<{
  /** Coarse light/dark, kept for colour-swatch logic. */
  theme: Theme;
  level: ThemeLevel;
  levelLabel: string;
  setLevel: (l: ThemeLevel) => void;
  cycleTheme: () => void;
  /** Legacy alias for cycleTheme. */
  toggleTheme: () => void;
}>({
  theme: "light",
  level: "cream",
  levelLabel: "Cream",
  setLevel: () => {},
  cycleTheme: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [level, setLevelState] = useState<ThemeLevel>("cream");

  useEffect(() => {
    let stored: ThemeLevel | null = null;
    try {
      // Only Cream (light) and Navy (dark) remain; older choices map onto them.
      const raw = localStorage.getItem("theme");
      if (raw === "light" || raw === "white" || raw === "cream") stored = "cream";
      else if (raw === "dark" || raw === "oled" || raw === "navy") stored = "navy";
    } catch {
      /* ignore */
    }
    if (stored) {
      setLevelState(stored);
      return;
    }
    const prefersDark =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    setLevelState(prefersDark ? "navy" : "cream");
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", isDarkLevel(level));
    root.classList.toggle("theme-white", level === "white");
    root.classList.toggle("theme-oled", level === "oled");
    try {
      localStorage.setItem("theme", level);
    } catch {
      /* ignore */
    }
  }, [level]);

  const cycleTheme = () =>
    setLevelState((p) => THEME_LEVELS[(THEME_LEVELS.indexOf(p) + 1) % THEME_LEVELS.length]);

  return (
    <ThemeContext.Provider
      value={{
        theme: isDarkLevel(level) ? "dark" : "light",
        level,
        levelLabel: THEME_LEVEL_LABELS[level],
        setLevel: setLevelState,
        cycleTheme,
        toggleTheme: cycleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
