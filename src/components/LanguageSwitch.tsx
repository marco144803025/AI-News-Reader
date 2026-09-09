import { uiCopy } from "../lib/ui";
import { useLanguage } from "../hooks/useLanguage";

export default function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useLanguage();
  return (
    <div role="group" aria-label={compact ? uiCopy(language).language : uiCopy(language).summaryLanguage} className={compact ? "standard-language" : "flex shrink-0 flex-wrap items-center gap-2 text-xs"}>
      {!compact && <span className="text-[10px]">{uiCopy(language).summaryLanguage}</span>}
      <div className="flex rounded border border-current p-0.5">
        {(["en", "zh-HK"] as const).map(locale => (
          <button
            key={locale}
            type="button"
            lang={locale}
            aria-pressed={language === locale}
            onClick={() => setLanguage(locale)}
            className={`rounded px-2 py-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 ${
              language === locale ? "bg-neutral-200 font-semibold text-neutral-950" : "hover:underline"
            }`}
          >
            {locale === "en" ? compact ? "EN" : "English" : "繁體中文"}
          </button>
        ))}
      </div>
    </div>
  );
}
