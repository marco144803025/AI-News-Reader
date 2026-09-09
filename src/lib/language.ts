import type { Article, Brief } from "../types.ts";

export type SummaryLanguage = "en" | "zh-HK";
export const LANGUAGE_STORAGE_KEY = "ai-briefing-language";
export const CHINESE_FALLBACK = "繁體中文摘要暫未提供，以下顯示英文。";

export function isSummaryLanguage(value: unknown): value is SummaryLanguage {
  return value === "en" || value === "zh-HK";
}

/** Optional translations must not make otherwise usable English content fail. */
export function validTranslation(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Headline quality failures must not discard an otherwise usable brief. */
export function validBriefHeadline(value: unknown, language: SummaryLanguage): string | undefined {
  const text = validTranslation(value)?.replace(/\s+/gu, " ");
  if (!text || [...text].length > (language === "en" ? 100 : 50)) return undefined;
  if (language === "en" && text.split(" ").length > 14) return undefined;
  return text;
}

/** Pass the selected bullet language, so a missing heading never changes it. */
export function selectBriefHeadline(brief: Brief, language: SummaryLanguage): string {
  return validBriefHeadline(language === "zh-HK" ? brief.headlineZhHK : brief.headline, language)
    ?? (language === "zh-HK" ? "AI 每日摘要" : "The latest in AI.");
}

export type SelectedText = {
  text: string;
  language: SummaryLanguage;
  fallback: boolean;
};

export function selectSummary(article: Pick<Article, "summary" | "summaryZhHK">, language: SummaryLanguage): SelectedText {
  const chinese = validTranslation(article.summaryZhHK);
  const useChinese = language === "zh-HK" && chinese !== undefined;
  return {
    text: useChinese ? chinese : article.summary,
    language: useChinese ? "zh-HK" : "en",
    fallback: language === "zh-HK" && !useChinese,
  };
}

/** Fall back as a whole so a digest never mixes partially translated bullets. */
export function selectBrief(brief: Brief, language: SummaryLanguage): {
  bullets: Brief["bullets"];
  language: SummaryLanguage;
  fallback: boolean;
} {
  const useChinese = language === "zh-HK" && brief.bullets.length > 0 &&
    brief.bullets.every(bullet => validTranslation(bullet.textZhHK) !== undefined);
  return {
    bullets: brief.bullets.map(bullet => ({
      ...bullet,
      text: useChinese ? validTranslation(bullet.textZhHK)! : bullet.text,
    })),
    language: useChinese ? "zh-HK" : "en",
    fallback: language === "zh-HK" && !useChinese,
  };
}
