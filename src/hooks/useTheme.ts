import { useCallback, useState } from "react";
import { resolveTheme, THEME_STORAGE_KEY, type Theme } from "../lib/theme";

function readInitialTheme(): Theme {
  if (typeof window === "undefined") return "classic";
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode) — the URL param still applies.
  }
  const params = new URLSearchParams(window.location.search);
  return resolveTheme(params.get("theme"), stored);
}

export function useTheme(): [Theme, (next: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(readInitialTheme);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Best effort — the URL param below still carries the choice.
    }
    const url = new URL(window.location.href);
    url.searchParams.set("theme", next);
    window.history.replaceState({}, "", url);
  }, []);

  return [theme, setTheme];
}
