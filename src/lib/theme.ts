export type Theme = "classic" | "extra";

export const THEME_STORAGE_KEY = "ai-briefing-theme";

export function isExtraEnabled(value: unknown): boolean {
  return value === "true";
}

// URL param wins over the stored preference; unrecognized values fall back to
// the stored preference, then to classic.
export function resolveTheme(
  urlParam: string | null,
  stored: string | null,
  extraEnabled = false
): Theme {
  if (!extraEnabled) return "classic";
  if (urlParam === "extra" || urlParam === "classic") return urlParam;
  if (stored === "extra" || stored === "classic") return stored;
  return "classic";
}
