import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../../hooks/useLanguage";
import { categoryLabel, uiCopy, uiNumber } from "../../lib/ui";
import LanguageSwitch from "../LanguageSwitch";
import { newsDate } from "../../lib/news";

export type StandardSection = "brief" | "news" | "search" | "trends";

type Props = {
  generatedAt?: string;
  categories: string[];
  category: string;
  section: StandardSection;
  counts: Map<string, number>;
  onNavigate: (section: StandardSection) => void;
  onCategory: (category: string) => void;
  extraEnabled: boolean;
  onExtra: () => void;
  motion: { enabled: boolean; reduced: boolean; toggle: () => void };
};

export default function StandardHeader({ generatedAt, categories, category, section, counts, onNavigate, onCategory, extraEnabled, onExtra, motion }: Props) {
  const { language } = useLanguage();
  const t = uiCopy(language);
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  const choose = (action: () => void) => {
    dialog.current?.close();
    setOpen(false);
    action();
  };
  return <>
    <a className="standard-skip" href="#standard-content">{t.skip}</a>
    <header className="standard-header">
      <button className="standard-brand" onClick={() => onNavigate("brief")} aria-label={t.frontPage}>AI Briefing<span aria-hidden="true">●</span></button>
      <span className="standard-header-date">{generatedAt ? newsDate(generatedAt, language) : t.dailyPerspective}</span>
      <nav className="standard-top-links" aria-label={t.primary}>
        <button onClick={() => onNavigate("news")}>{t.theNews}</button>
        <button onClick={() => onNavigate("trends")} aria-current={section === "trends" ? "page" : undefined}>{t.trends}</button>
      </nav>
      <LanguageSwitch compact />
      <button className="standard-menu-button" aria-label={t.openIndex} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <span>{t.index}</span><span className="standard-menu-lines" aria-hidden="true"><i /><i /></span>
      </button>
    </header>
    <aside className="standard-rail" aria-label={t.sections}>
      {(["brief", "news", "trends"] as const).map((item, i) => <button key={item} onClick={() => onNavigate(item)}
        aria-current={section === item ? "location" : undefined}>
        <span className="standard-rail-icon" aria-hidden="true">{["◉", "≡", "↗"][i]}</span>
        {t[item]}
      </button>)}
      <span className="standard-rail-rule" />
      <button onClick={() => setOpen(true)} aria-label={t.browseCategories}><span className="standard-rail-icon" aria-hidden="true">⊞</span>{t.browse}</button>
      <span className="standard-rail-label">{t.wider}</span>
    </aside>
    <dialog ref={dialog} className="standard-index" onClose={() => setOpen(false)} onCancel={() => setOpen(false)}
      onKeyDown={event => {
        if (event.key !== "Tab") return;
        const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}
      aria-labelledby="index-title" onClick={event => { if (event.target === dialog.current) dialog.current.close(); }}>
      <div className="standard-index-inner">
        <div className="standard-index-heading"><div><p className="standard-kicker">{t.exploreEdition}</p><h2 id="index-title">{t.indexTitle}</h2></div>
          <button onClick={() => dialog.current?.close()} aria-label={t.closeIndex} className="standard-close">×</button></div>
        <div className="standard-index-links">
          <button onClick={() => choose(() => onNavigate("brief"))}>{t.dailyBrief} <span>01</span></button>
          <button onClick={() => choose(() => onNavigate("search"))}>{t.searchNews} <span>↗</span></button>
          <button onClick={() => choose(() => onNavigate("trends"))}>{t.trendsHealth} <span>↗</span></button>
        </div>
        <p className="standard-kicker">{t.byCategory}</p>
        <nav className="standard-index-categories" aria-label={t.allCategories}>
          {["All", ...categories].map(item => <button key={item} aria-current={category === item && section !== "trends" ? "page" : undefined}
            onClick={() => choose(() => onCategory(item))}>{categoryLabel(item, language)}<span>{uiNumber(counts.get(item) ?? 0, language)}</span></button>)}
        </nav>
        <div className="standard-index-preferences">
          <button aria-pressed={motion.enabled} disabled={motion.reduced} onClick={motion.toggle}>
            {t.motion} <span>{motion.reduced ? t.reduced : motion.enabled ? t.on : t.off}</span>
          </button>
          {extraEnabled && <button onClick={() => choose(onExtra)}>{t.extra} <span>↗</span></button>}
        </div>
      </div>
    </dialog>
  </>;
}
