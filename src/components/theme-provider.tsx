import { createContext, useContext, useEffect, useState } from "react";

/**
 * Four theme levels, cycled in order:
 * 1 white  — crisp neutral light
 * 2 cream  — the Ink & Brass warm canvas (default)
 * 3 navy   — deep ink dark mode
 * 4 oled   — true-black dark mode for OLED panels
 */
export type ThemeLevel = "white" | "cream" | "navy" | "oled" | "auto";
type Theme = "light" | "dark";

/** The theme button cycles Light → Dark → Auto, like the iPhone app. */
export const THEME_LEVELS: ThemeLevel[] = ["cream", "navy", "auto"];

export const THEME_LEVEL_LABELS: Record<ThemeLevel, string> = {
  white: "White",
  cream: "Light",
  navy: "Dark",
  oled: "OLED black",
  auto: "Auto",
};

const prefersDark = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-color-scheme: dark)").matches;

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
  const [level, setLevelState] = useState<ThemeLevel>("auto");
  // Auto follows the device's light or dark setting, and changes with it.
  const [systemDark, setSystemDark] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia?.("(prefers-color-scheme: dark)");
    setSystemDark(prefersDark());
    if (!mql) return;
    const update = () => setSystemDark(mql.matches);
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  const isDarkLevel = (l: ThemeLevel) => l === "navy" || l === "oled" || (l === "auto" && systemDark);

  useEffect(() => {
    let stored: ThemeLevel | null = null;
    try {
      // Light (cream), Dark (navy) and Auto; older choices map onto them.
      const raw = localStorage.getItem("theme");
      if (raw === "light" || raw === "white" || raw === "cream") stored = "cream";
      else if (raw === "dark" || raw === "oled" || raw === "navy") stored = "navy";
      else if (raw === "auto") stored = "auto";
    } catch {
      /* ignore */
    }
    // With nothing saved, follow the device.
    setLevelState(stored ?? "auto");
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
  }, [level, systemDark]);

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
