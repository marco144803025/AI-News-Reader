// Every diegetic label of the Stop the Presses lineage lives here — swapping
// to plain labels is a one-file change.
export const LABELS = {
  masthead: "AI BRIEFING",
  extraStrip: "EXTRA · EXTRA",
  bulletinKicker: "TODAY'S BULLETIN",
  clippings: "THE CLIPPINGS",
  fresh: "FRESH",
  notable: "NOTABLE",
  nothing: "NOTHING ON THE WIRE",
  clearFilters: "CLEAR FILTERS",
  toClassic: "classic edition ↩",
  searchPlaceholder: "dig the archive...",
  filed: "FILED",
  loading: "INKING THE PRESSES...",
  prev: "← PREV",
  next: "NEXT →",
  curatedBy: "CURATED BY CLAUDE",
  wiresRunning: (ok: number, total: number) => `${ok}/${total} WIRES RUNNING`,
  clippingsFiled: (n: number) => `${n} CLIPPINGS FILED`,
  archive: (days: number) => `ARCHIVE ${days}D`,
  pageOf: (page: number, total: number) =>
    `PAGE ${String(page).padStart(2, "0")}/${String(total).padStart(2, "0")}`,
} as const;

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

export function formatDateline(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  return `${WEEKDAYS[d.getDay()]} ${day} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatAge(iso: string, now: number): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "";
  const hours = Math.floor(Math.max(0, now - ts) / 3_600_000);
  if (hours < 1) return "NOW";
  if (hours < 24) return `${hours}H`;
  return `${Math.floor(hours / 24)}D`;
}
