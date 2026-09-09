import { useCallback, useEffect, useState } from "react";
import { resolveTheme, THEME_STORAGE_KEY, type Theme } from "../lib/theme";

function readInitialTheme(extraEnabled: boolean): Theme {
  if (typeof window === "undefined") return "classic";
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode) — the URL param still applies.
  }
  const params = new URLSearchParams(window.location.search);
  return resolveTheme(params.get("theme"), stored, extraEnabled);
}

export function useTheme(extraEnabled = false): [Theme, (next: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(() => readInitialTheme(extraEnabled));

  useEffect(() => {
    const sync = () => setThemeState(readInitialTheme(extraEnabled));
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [extraEnabled]);

  const setTheme = useCallback((next: Theme) => {
    if (!extraEnabled && next === "extra") return;
    setThemeState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Best effort — the URL param below still carries the choice.
    }
    const url = new URL(window.location.href);
    url.searchParams.set("theme", next);
    window.history.replaceState({}, "", url);
  }, [extraEnabled]);

  return [extraEnabled ? theme : "classic", setTheme];
}
