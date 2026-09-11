import type { AdditionalSource } from "../types";
import type { SummaryLanguage } from "../lib/language";
import { sourceUrl } from "../lib/news";
import { uiCopy } from "../lib/ui";

type Props = {
  sources: AdditionalSource[] | undefined;
  /** Passed explicitly: this renders inside two editions with different providers. */
  language: SummaryLanguage;
  edition: "standard" | "extra";
};

// Class names are written out per edition rather than composed, so Tailwind's
// scanner and a reader searching the CSS both find them literally.
const SKIN = {
  standard: {
    root: "standard-attribution",
    label: "standard-attribution-label",
    link: "standard-attribution-link",
    outlet: "standard-attribution-outlet",
  },
  extra: {
    root: "extra-attribution",
    label: "extra-attribution-label",
    link: "extra-attribution-link",
    outlet: "extra-attribution-outlet",
  },
} as const;

/**
 * The other outlets that reported the same story, shown beneath an article.
 *
 * NOTE: every caller mounts this OUTSIDE its article's own link. Nested anchors
 * are invalid HTML and leave the click target ambiguous, so in Extra's
 * ClippingRow — where the whole row is one link — these links are siblings of
 * that link, never children of it.
 *
 * Titles and source names are the other publisher's own words and are rendered
 * unmodified; only the lead-in label is localized. React escapes both as text.
 */
export default function AdditionalSources({ sources, language, edition }: Props) {
  // parseNewsData already dropped unsafe entries. Re-checking with the same
  // shared guard means no path can reach an href the boundary would reject.
  const entries = (sources ?? []).filter(source => sourceUrl(source.url) !== undefined);
  if (entries.length === 0) return null;

  const skin = SKIN[edition];
  const t = uiCopy(language);
  return (
    <div className={skin.root}>
      <span className={skin.label} lang={language}>{t.alsoReported}</span>
      {entries.map((source, i) => (
        <a
          key={`${source.url}-${i}`}
          className={skin.link}
          href={source.url}
          target="_blank"
          rel="noreferrer"
        >
          {source.title}
          <span className={skin.outlet}>{source.source}</span>
        </a>
      ))}
    </div>
  );
}
