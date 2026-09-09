import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import type { NewsData } from "./types";
import ClassicApp from "./ClassicApp";
import { isExtraEnabled } from "./lib/theme";
import { parseNewsData } from "./lib/news";
import { useTheme } from "./hooks/useTheme";
import { useUrlState } from "./hooks/useUrlState";
import { uiCopy } from "./lib/ui";
import { LanguageProvider, useLanguage } from "./hooks/useLanguage";

const extraEnabled = isExtraEnabled(import.meta.env.VITE_ENABLE_EXTRA);
const ExtraApp = lazy(() => import("./components/extra/ExtraApp"));

function EditionLoading() {
  const { language } = useLanguage();
  return <div className="edition-loading" role="status" lang={language}>{uiCopy(language).openingEdition}</div>;
}

// Shell: owns the shared state (data, filters, pagination, theme) and picks a
// lineage. Both lineages are presentation-only over these props.
export default function App() {
  const [data, setData] = useState<NewsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useTheme(extraEnabled);
  const [filterState, setFilterState] = useUrlState();
  const [page, setPage] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const onRetry = useCallback(() => setAttempt(value => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    fetch(import.meta.env.BASE_URL + "news.json", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("The news archive is unavailable. Please try again.");
        return r.json();
      })
      .then(value => { if (!controller.signal.aborted) setData(parseNewsData(value)); })
      .catch(() => { if (!controller.signal.aborted) setError("We couldn’t load the news. Check your connection and try again."); });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    setPage(0);
  }, [filterState]);

  const lineage = {
    data,
    error,
    onRetry,
    extraEnabled,
    filterState,
    setFilterState,
    page,
    setPage,
    theme,
    setTheme,
  };

  return (
    <LanguageProvider>
      <Suspense fallback={<EditionLoading />}>
        {extraEnabled && theme === "extra" ? <ExtraApp {...lineage} /> : <ClassicApp {...lineage} />}
      </Suspense>
    </LanguageProvider>
  );
}
