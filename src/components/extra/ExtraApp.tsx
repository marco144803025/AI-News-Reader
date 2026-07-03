import { useMemo } from "react";
import type { NewsData } from "../../types";
import type { LineageProps } from "../../lib/lineage";
import {
  categoryCounts,
  EMPTY_FILTER,
  filterArticles,
  hasActiveFilters,
} from "../../lib/filter";
import { paginate } from "../../lib/paginate";
import { rankFrontPage } from "../../lib/rank";
import BulletinPanel, { type BriefLike } from "./BulletinPanel";
import ClippingsList from "./ClippingsList";
import ExtraFilterBar from "./ExtraFilterBar";
import LeadClipping from "./LeadClipping";
import Masthead from "./Masthead";
import PressFooter from "./PressFooter";
import TapeChip from "./TapeChip";
import TapeNav from "./TapeNav";
import { LABELS } from "./copy";

const PAGE_SIZE = 10;

export default function ExtraApp({
  data,
  error,
  filterState,
  setFilterState,
  page,
  setPage,
  setTheme,
}: LineageProps) {
  const now = Date.now();

  const activeCategory = filterState.category;

  const categoryScoped = useMemo(() => {
    if (!data) return [];
    if (activeCategory === "All") return data.articles;
    return data.articles.filter((a) => a.category === activeCategory);
  }, [data, activeCategory]);

  const filtered = useMemo(
    () => (data ? filterArticles(data.articles, filterState) : []),
    [data, filterState]
  );

  const counts = useMemo(
    () => categoryCounts(data?.articles ?? [], filterState),
    [data, filterState]
  );

  const { lead, rest } = useMemo(() => rankFrontPage(filtered), [filtered]);
  const { pageItems, totalPages } = useMemo(
    () => paginate(rest, page, PAGE_SIZE),
    [rest, page]
  );

  if (error) {
    return (
      <div className="theme-extra min-h-screen bg-paper p-8 font-press text-ink-press">
        <span className="font-poster text-2xl uppercase tracking-[0.06em]">
          {LABELS.masthead}
        </span>
        <p className="mt-6 max-w-xl border-2 border-press-red-deep bg-paper-bright p-4 font-wire text-xs text-press-red-deep">
          {error}
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="theme-extra flex min-h-screen items-center justify-center bg-paper">
        <span className="font-wire text-xs tracking-[0.14em] text-ink-dim">
          {LABELS.loading}
        </span>
      </div>
    );
  }

  const tabs = ["All", ...data.categories];
  const brief = (data as NewsData & { brief?: BriefLike }).brief;

  return (
    <div className="theme-extra min-h-screen overflow-x-clip bg-paper font-press text-ink-press">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <Masthead data={data} onClassic={() => setTheme("classic")} />
        <TapeNav
          tabs={tabs}
          counts={counts}
          state={filterState}
          onChange={setFilterState}
        />
        <ExtraFilterBar
          scopedArticles={categoryScoped}
          state={filterState}
          onChange={setFilterState}
        />

        {brief && page === 0 && <BulletinPanel brief={brief} />}

        {filtered.length === 0 ? (
          <div className="mt-10 flex flex-col items-start gap-4">
            <span className="font-poster text-xl tracking-[0.1em] text-ink-dim">
              {LABELS.nothing}
            </span>
            {hasActiveFilters(filterState) && (
              <TapeChip
                tilt={-1}
                onClick={() =>
                  setFilterState({ ...EMPTY_FILTER, category: filterState.category })
                }
              >
                {LABELS.clearFilters}
              </TapeChip>
            )}
          </div>
        ) : (
          <>
            {lead && page === 0 && <LeadClipping article={lead} now={now} />}
            {pageItems.length > 0 && (
              <ClippingsList
                articles={pageItems}
                totalCount={rest.length}
                now={now}
              />
            )}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-5">
                {page > 0 ? (
                  <TapeChip tilt={-1} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                    {LABELS.prev}
                  </TapeChip>
                ) : (
                  <span className="w-16" aria-hidden="true" />
                )}
                <span className="font-wire text-[11px] tabular-nums text-ink-dim">
                  {LABELS.pageOf(page + 1, totalPages)}
                </span>
                {page < totalPages - 1 ? (
                  <TapeChip tilt={1} onClick={() => setPage((p) => p + 1)}>
                    {LABELS.next}
                  </TapeChip>
                ) : (
                  <span className="w-16" aria-hidden="true" />
                )}
              </div>
            )}
          </>
        )}

        <PressFooter data={data} page={page} totalPages={totalPages} now={now} />
      </div>
    </div>
  );
}
