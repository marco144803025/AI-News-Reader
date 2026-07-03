import type { Article } from "../../types";
import { ransomWordIndex } from "../../lib/rank";
import { decodeEntities } from "../../lib/text";
import OffsetPanel from "./OffsetPanel";
import Stamp from "./Stamp";
import { formatAge, LABELS } from "./copy";

// One key word of the lead headline gets the reversed red block — Anton at
// display size, so white-on-bright-red clears the AA large-text threshold.
function RansomTitle({ title }: { title: string }) {
  const words = title.split(/\s+/).filter(Boolean);
  const idx = ransomWordIndex(title);
  return (
    <>
      {words.map((word, i) => (
        <span key={i}>
          {i > 0 && " "}
          {i === idx ? (
            <span
              className="inline-block bg-press-red px-1.5 text-paper-bright"
              style={{ rotate: "calc(var(--tilt-unit) * -1.2)" }}
            >
              {word}
            </span>
          ) : (
            word
          )}
        </span>
      ))}
    </>
  );
}

export default function LeadClipping({
  article,
  now,
}: {
  article: Article;
  now: number;
}) {
  const tags = article.tags
    ? [...article.tags.topics, ...article.tags.traits, ...article.tags.entities]
    : [];

  return (
    <div className="mt-6">
      <OffsetPanel className="relative p-5 sm:p-6">
        <div
          className="pointer-events-none absolute right-4 top-3 font-poster text-6xl leading-none"
          style={{
            WebkitTextStroke: "1.5px rgba(19,18,16,0.2)",
            color: "transparent",
            rotate: "calc(var(--tilt-unit) * 2)",
          }}
          aria-hidden="true"
        >
          001
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {article.important && <Stamp label={LABELS.notable} />}
          <span className="font-wire text-[11px] tracking-[0.08em] text-ink-dim">
            {article.category.toUpperCase()} · {article.source.toUpperCase()} ·{" "}
            {formatAge(article.publishedAt, now)}
          </span>
        </div>
        <a
          href={article.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 block max-w-[560px] font-poster text-2xl uppercase leading-tight text-ink-press transition-colors hover:text-press-red-deep focus-visible:outline-2 focus-visible:outline-press-red-deep sm:text-3xl"
        >
          <RansomTitle title={decodeEntities(article.title)} />
        </a>
        {article.summary && (
          <p className="mt-3 max-w-[540px] font-press text-[13px] leading-relaxed text-ink-dim">
            {decodeEntities(article.summary)}
          </p>
        )}
        {tags.length > 0 && (
          <div className="mt-3 font-wire text-[11px] tracking-wide text-ink-dim">
            TAGS — {tags.join(" / ")}
          </div>
        )}
      </OffsetPanel>
    </div>
  );
}
