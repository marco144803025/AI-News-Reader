import type { NewsData } from "../../types";
import { useLanguage } from "../../hooks/useLanguage";
import { CHINESE_FALLBACK, selectBrief, selectBriefHeadline, selectSummary } from "../../lib/language";
import { briefNotice, newsDate, selectNotableStories } from "../../lib/news";
import { categoryLabel, uiCopy } from "../../lib/ui";
import ParticleSphere from "./ParticleSphere";

export default function DailyCover({ data, motion, onNews }: { data: NewsData; motion: boolean; onNews: () => void }) {
  const { language } = useLanguage();
  const t = uiCopy(language);
  const selected = data.brief ? selectBrief(data.brief, language) : undefined;
  const headline = data.brief && selected ? selectBriefHeadline(data.brief, selected.language) : t.noBriefHeadline;
  const lastSpace = headline.lastIndexOf(" ");
  const stories = selectNotableStories(data.articles, data.generatedAt);
  const notice = briefNotice(data, language);
  return <section className="standard-cover" aria-labelledby="brief-heading" id="daily-brief">
    <ParticleSphere enabled={motion} />
    <div className="standard-cover-top"><p className="standard-kicker"><span className="standard-live-dot" />{t.theDailyBrief}</p>
      <span className="standard-edition">{data.brief ? <><span>{t.edition} / </span><time dateTime={data.brief.generatedAt}>{newsDate(data.brief.generatedAt, language)}</time></> : t.latestEdition}</span></div>
    <div className={`standard-cover-grid ${stories.length === 0 ? "standard-cover-solo" : ""}`}>
      <div className="standard-brief-main">
        <h1 id="brief-heading" tabIndex={-1} className="standard-cover-title" lang={selected?.language ?? language}>
          {lastSpace > 0 ? <>{headline.slice(0, lastSpace)} <em>{headline.slice(lastSpace + 1)}</em></> : <em>{headline}</em>}
        </h1>
        {notice && <p className="standard-notice" role="status">{notice}</p>}
        {selected?.fallback && <p className="standard-fallback" lang="zh-HK">{CHINESE_FALLBACK}</p>}
        {selected ? <ol className="standard-brief-list">
          {selected.bullets.map((bullet, i) => <li key={i}>
            <span className="standard-bullet-number" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
            <p lang={selected.language}>{bullet.text}<span className="standard-citations">{bullet.refs.map((url, j) => <a key={`${url}-${j}`} href={url}
              target="_blank" rel="noreferrer" lang={language} aria-label={t.citation(j + 1, i + 1)}>[{j + 1}]</a>)}</span></p>
          </li>)}
        </ol> : <div className="standard-no-brief"><p>{t.noBriefTitle}</p><p>{t.noBrief}</p></div>}
      </div>
      {stories.length > 0 && <aside className="standard-spotlights" aria-label={t.notableStories}>
        {stories.map((article, i) => {
          const summary = selectSummary(article, language);
          return <article key={article.url} className={`standard-spotlight ${i > 0 ? "standard-spotlight-secondary" : ""}`}>
            <div className="standard-spot-meta"><span>{i === 0 ? t.inFocus : t.alsoNotable}</span><span>{categoryLabel(article.category, language)}</span></div>
            <h2><a href={article.url} target="_blank" rel="noreferrer">{article.title}</a></h2>
            {i === 0 && <><p lang={summary.language} className="standard-spot-summary">{summary.text}</p>
              {summary.fallback && <p className="standard-fallback" lang="zh-HK">{CHINESE_FALLBACK}</p>}</>}
            <div className="standard-source"><span>{article.source}</span><time dateTime={article.publishedAt}>{newsDate(article.publishedAt, language)}</time></div>
            {i === 0 && <a className="standard-read-link" href={article.url} target="_blank" rel="noreferrer">{t.readStory} <span aria-hidden="true">↗</span></a>}
          </article>;
        })}
      </aside>}
    </div>
    <div className="standard-cover-bottom"><button onClick={onNews}><span className="standard-scroll-icon" aria-hidden="true">↓</span><span>{t.moreStory}<small>{t.scrollNews}</small></span></button>
      <span>{t.stories(data.articles.length)} <span aria-hidden="true">/</span> {t.oneView}</span></div>
  </section>;
}
