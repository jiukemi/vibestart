import { useCallback, useEffect, useState } from "react";

const THEME_KEY = "vibestart-theme";

type ThemePreference = "system" | "light" | "dark";

function getSystemDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveDark(preference: ThemePreference): boolean {
  if (preference === "system") return getSystemDark();
  return preference === "dark";
}

function readPreference(): ThemePreference {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "system";
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(readPreference);
  const isDark = resolveDark(preference);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => {
    if (preference !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      document.documentElement.classList.toggle("dark", media.matches);
    };
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [preference]);

  const toggle = useCallback(() => {
    const next: ThemePreference = isDark ? "light" : "dark";
    localStorage.setItem(THEME_KEY, next);
    setPreference(next);
  }, [isDark]);

  return { isDark, toggle };
}
