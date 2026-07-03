export type Theme = "classic" | "extra";

export const THEME_STORAGE_KEY = "ai-briefing-theme";

// URL param wins over the stored preference; unrecognized values fall back to
// the stored preference, then to classic.
export function resolveTheme(
  urlParam: string | null,
  stored: string | null
): Theme {
  if (urlParam === "extra" || urlParam === "classic") return urlParam;
  if (stored === "extra" || stored === "classic") return stored;
  return "classic";
}
