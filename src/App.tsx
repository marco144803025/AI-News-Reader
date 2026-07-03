import { useEffect, useState } from "react";
import type { NewsData } from "./types";
import ClassicApp from "./ClassicApp";
import ExtraApp from "./components/extra/ExtraApp";
import { useTheme } from "./hooks/useTheme";
import { useUrlState } from "./hooks/useUrlState";

// Shell: owns the shared state (data, filters, pagination, theme) and picks a
// lineage. Both lineages are presentation-only over these props.
export default function App() {
  const [data, setData] = useState<NewsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useTheme();
  const [filterState, setFilterState] = useUrlState();
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + "news.json")
      .then((r) => {
        if (!r.ok) throw new Error("news.json not found — run `npm run ingest` first.");
        return r.json();
      })
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    setPage(0);
  }, [filterState]);

  const lineage = {
    data,
    error,
    filterState,
    setFilterState,
    page,
    setPage,
    theme,
    setTheme,
  };

  return theme === "extra" ? <ExtraApp {...lineage} /> : <ClassicApp {...lineage} />;
}
