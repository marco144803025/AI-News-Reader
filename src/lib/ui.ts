import type { SummaryLanguage } from "./language.ts";
import type { Tags } from "../types.ts";

export function uiNumber(value: number, language: SummaryLanguage): string {
  return new Intl.NumberFormat(language === "en" ? "en-GB" : "zh-HK").format(value);
}

const en = {
  pageTitle: "AI Briefing — a daily perspective on AI", language: "Website language", summaryLanguage: "Summary language",
  skip: "Skip to content", frontPage: "AI Briefing — front page", dailyPerspective: "Your daily perspective",
  primary: "Primary", theNews: "The news", trends: "Trends", index: "Index", openIndex: "Open index",
  sections: "Edition sections", brief: "Brief", news: "News", browse: "Browse", browseCategories: "Browse all categories",
  wider: "A wider perspective", exploreEdition: "Explore the edition", indexTitle: "The index.", closeIndex: "Close index",
  dailyBrief: "Daily Brief", theDailyBrief: "The Daily Brief", searchNews: "Search the news",
  trendsHealth: "Trends & source health", byCategory: "By category", allCategories: "All categories",
  motion: "Motion", reduced: "Reduced by your device", on: "On", off: "Off", extra: "Extra edition",
  interruption: "A brief interruption", backSoon: "We’ll be right back.", retry: "Try again",
  loadError: "We couldn’t load the news. Check your connection and try again.",
  opening: "Opening your perspective", gathering: "Gathering the latest edition.", openingEdition: "Opening the edition…",
  biggerPicture: "The bigger picture", signals: "Following the signals", footer: "A daily perspective on a changing world.",
  archiveUpdated: "Archive updated", exploreHealth: "Explore trends & source health",
  sourcesAttention: (n: number) => `${uiNumber(n, "en")} source${n === 1 ? "" : "s"} need${n === 1 ? "s" : ""} attention`,
  noBriefHeadline: "A wider perspective on AI.", edition: "Edition", latestEdition: "The latest edition",
  noBriefTitle: "Your next perspective is taking shape.",
  noBrief: "A Daily Brief isn’t available for this edition. Explore the latest stories below.",
  notableStories: "Notable stories", inFocus: "In focus", alsoNotable: "Also notable", readStory: "Read the story",
  moreStory: "There’s more to the story.", scrollNews: "Scroll into the news", oneView: "One wider view",
  stories: (n: number) => `${uiNumber(n, "en")} ${n === 1 ? "story" : "stories"}`,
  citation: (source: number, item: number) => `Source ${source} for brief item ${item}`,
  beyondBrief: "Beyond the brief", fullPicture: "The full picture", matching: "matching your filters", toExplore: "to explore",
  category: "Category", searchArticles: "Search articles", searchPlaceholder: "Find a story, idea, or company…",
  notableOnly: "Notable only", exploreTopic: "Explore by topic", topicHint: "Topics, traits & companies",
  selected: (n: number) => `${uiNumber(n, "en")} selected`, activeFilters: "Active filters", clearAll: "Clear all filters",
  clearFilters: "Clear filters", removeFilter: (group: string, value: string) => `Remove ${group} filter ${value}`,
  notable: "Notable", noSummary: "A summary is unavailable. Read the original story for details.", storyTopics: "Story topics",
  readOriginal: "Read original", originalLabel: (title: string) => `Read original: ${title}`,
  noStories: "No stories here just yet.", tryFilters: "Try another category or clear your filters to see more.",
  nextUpdate: "The next update will bring a fresh perspective. Check back soon.", pages: "News pages",
  previous: "Previous", next: "Next", page: (page: number, total: number) => `Page ${uiNumber(page, "en")} of ${uiNumber(total, "en")}`,
  topics: "Topics", traits: "Traits", entities: "Entities", comparison: "The last seven days, compared with the week before.",
  rising: "Rising", falling: "Falling", noRising: "Nothing gaining momentum", noFalling: "Nothing cooling off",
  shortHistory: "Not enough history for momentum yet — the archive spans under two weeks, so week-over-week comparisons would mislead. Volume and category share below still reflect what's here.",
  volume: "Volume", perDay: "Articles per day", categoryShare: "Category share", inNews: "In the news — 7 days", wireHealth: "Source health",
  volumeCount: (articles: number, days: number) => `${uiNumber(articles, "en")} article${articles === 1 ? "" : "s"} · ${uiNumber(days, "en")} day${days === 1 ? "" : "s"}`,
  allHealthy: (n: number) => `All ${uiNumber(n, "en")} feeds healthy`, healthy: (ok: number, total: number) => `${uiNumber(ok, "en")}/${uiNumber(total, "en")} feeds healthy`,
  noHealth: "Source health data is not available yet.", noEntities: "No entities in this period.", noCategories: "No categories in this period.",
  failures: (n: number) => `${uiNumber(n, "en")} consecutive failure${n === 1 ? "" : "s"}`,
  lastSuccess: "Last success", neverSucceeded: "Never succeeded", unknownError: "Unknown error", technicalDetails: "Technical details",
  trendLabel: (tag: string, previous: number, current: number) => `${tag}: ${previous} last week, ${current} this week`,
  dateUnavailable: "Date unavailable", failedBrief: "The latest brief couldn’t be generated.",
  previousEdition: "The previous edition is shown below.", stillNews: "You can still explore the news below.",
  quietBrief: "A quieter update. There isn’t enough new material for a fresh brief.",
};

const zh: typeof en = {
  pageTitle: "AI Briefing — 每日 AI 新聞視野", language: "網站語言", summaryLanguage: "摘要語言",
  skip: "跳至主要內容", frontPage: "AI Briefing — 首頁", dailyPerspective: "每日新視野",
  primary: "主要導覽", theNews: "新聞", trends: "趨勢", index: "目錄", openIndex: "開啟目錄",
  sections: "內容導覽", brief: "摘要", news: "新聞", browse: "分類", browseCategories: "瀏覽所有分類",
  wider: "放眼更廣闊的世界", exploreEdition: "探索本期內容", indexTitle: "內容目錄", closeIndex: "關閉目錄",
  dailyBrief: "每日摘要", theDailyBrief: "每日摘要", searchNews: "搜尋新聞",
  trendsHealth: "趨勢與來源狀態", byCategory: "按分類瀏覽", allCategories: "所有分類",
  motion: "動畫效果", reduced: "已按裝置設定減少動態效果", on: "開啟", off: "關閉", extra: "Extra 版本",
  interruption: "載入暫時中斷", backSoon: "暫時未能載入新聞", retry: "再試一次",
  loadError: "未能載入新聞，請檢查網絡連線後再試。",
  opening: "正在開啟今日視野", gathering: "正在載入最新一期內容。", openingEdition: "正在載入此版本…",
  biggerPicture: "放眼全局", signals: "掌握最新動向", footer: "每日新視野，看清世界的變化。",
  archiveUpdated: "新聞庫更新於", exploreHealth: "查看趨勢與來源狀態",
  sourcesAttention: (n: number) => `${uiNumber(n, "zh-HK")} 個來源需要留意`,
  noBriefHeadline: "放眼 AI 新動向", edition: "本期日期", latestEdition: "最新一期",
  noBriefTitle: "新一期摘要尚未準備好。", noBrief: "本期暫未有每日摘要，你可以先瀏覽下方的最新新聞。",
  notableStories: "焦點新聞", inFocus: "焦點", alsoNotable: "同樣值得留意", readStory: "閱讀報道",
  moreStory: "繼續了解更多。", scrollNews: "向下瀏覽新聞", oneView: "放眼全局",
  stories: (n: number) => `${uiNumber(n, "zh-HK")} 則新聞`,
  citation: (source: number, item: number) => `摘要第 ${item} 項的來源 ${source}`,
  beyondBrief: "摘要以外", fullPicture: "新聞全覽", matching: "符合篩選條件", toExplore: "供你瀏覽",
  category: "分類", searchArticles: "搜尋新聞", searchPlaceholder: "搜尋新聞、概念或公司…",
  notableOnly: "只看焦點新聞", exploreTopic: "按主題探索", topicHint: "主題、性質及公司",
  selected: (n: number) => `已選 ${uiNumber(n, "zh-HK")} 項`, activeFilters: "已套用的篩選條件", clearAll: "清除所有篩選條件",
  clearFilters: "清除篩選條件", removeFilter: (group: string, value: string) => `移除${group}篩選：${value}`,
  notable: "焦點", noSummary: "暫未有摘要，請閱讀原文了解詳情。", storyTopics: "新聞主題",
  readOriginal: "閱讀原文", originalLabel: (title: string) => `閱讀原文：${title}`,
  noStories: "暫時未有新聞。", tryFilters: "試試其他分類，或清除篩選條件以查看更多新聞。",
  nextUpdate: "下一次更新將帶來更多新聞，請稍後再來看看。", pages: "新聞分頁",
  previous: "上一頁", next: "下一頁", page: (page: number, total: number) => `第 ${uiNumber(page, "zh-HK")} 頁，共 ${uiNumber(total, "zh-HK")} 頁`,
  topics: "主題", traits: "性質", entities: "機構與產品", comparison: "最近七日與之前一星期的比較。",
  rising: "熱度上升", falling: "熱度下降", noRising: "暫未有熱度上升的主題", noFalling: "暫未有熱度下降的主題",
  shortHistory: "現有新聞紀錄不足兩星期，暫時未能可靠地比較每週熱度變化。下方的新聞數量及分類佔比仍反映現有紀錄。",
  volume: "新聞數量", perDay: "每日新聞數量", categoryShare: "分類佔比", inNews: "最近七日的新聞焦點", wireHealth: "來源狀態",
  volumeCount: (articles: number, days: number) => `${uiNumber(articles, "zh-HK")} 則新聞 · ${uiNumber(days, "zh-HK")} 日`,
  allHealthy: (n: number) => `全部 ${uiNumber(n, "zh-HK")} 個來源運作正常`, healthy: (ok: number, total: number) => `${uiNumber(ok, "zh-HK")}/${uiNumber(total, "zh-HK")} 個來源運作正常`,
  noHealth: "暫未有來源狀態資料。", noEntities: "這段期間暫未有機構或產品紀錄。", noCategories: "這段期間暫未有分類紀錄。",
  failures: (n: number) => `連續 ${uiNumber(n, "zh-HK")} 次失敗`,
  lastSuccess: "上次成功更新", neverSucceeded: "尚未成功更新", unknownError: "不明錯誤", technicalDetails: "技術詳情",
  trendLabel: (tag: string, previous: number, current: number) => `${tag}：上星期 ${previous} 則，今星期 ${current} 則`,
  dateUnavailable: "日期不詳", failedBrief: "最新一期摘要未能生成。",
  previousEdition: "以下顯示上一期摘要。", stillNews: "你仍可瀏覽下方的新聞。",
  quietBrief: "今次更新較平靜，暫未有足夠新內容製作新一期摘要。",
};

export function uiCopy(language: SummaryLanguage): typeof en {
  return language === "zh-HK" ? zh : en;
}

export const CATEGORY_LABELS: Readonly<Record<string, string>> = {
  All: "全部新聞", MCP: "MCP", "Model Releases": "模型發佈", Research: "研究",
  "AI Safety & Alignment": "AI 安全與對齊", "Developer Tools": "開發工具", "Agent Frameworks": "智能代理框架",
  "Business & Funding": "商業與融資", Applications: "應用", "Regulation & Policy": "監管與政策",
  "Open Source": "開源", "Hardware & Compute": "硬件與算力", Other: "其他",
};

const TAG_LABELS: Readonly<Record<string, string>> = {
  llm: "llm", rag: "rag", agentic: "智能代理", multimodal: "多模態", reasoning: "推理能力",
  inference: "推論", training: "訓練", safety: "安全", alignment: "對齊", interpretability: "可解釋性",
  "fine-tuning": "微調", evaluation: "評估", robotics: "機械人", vision: "視覺", audio: "音訊",
  commercial: "商業", "open-source": "開源", research: "研究", policy: "政策", funding: "融資",
  benchmark: "基準測試", tutorial: "教學", release: "發佈", incident: "事故",
  "agent-design": "代理設計", "ai-application": "AI 應用", "ai-culture": "AI 文化",
  "ai-detection": "AI 內容辨識", "ai-detectors": "AI 偵測工具", "ai-generated-content": "AI 生成內容",
  applications: "應用", architecture: "架構", atoms: "原子", automation: "自動化", autonomous: "自主運作",
  business: "商業", coding: "編程", cognition: "認知", commentary: "評論", compute: "算力",
  copyright: "版權", cost: "成本", data: "數據", "deepfake-detection": "深偽辨識", design: "設計",
  developer: "開發者", "developer-tools": "開發工具", development: "開發", dispute: "爭議",
  education: "教育", energy: "能源", enterprise: "企業", "environmental-impact": "環境影響",
  event: "活動", executive: "管理層", "executive-departure": "管理層離任", faithfulness: "忠實度",
  finance: "金融", financial: "金融", "foundation-model": "基礎模型", geolocation: "地理定位",
  governance: "管治", hardware: "硬件", health: "健康", healthcare: "醫療", impact: "影響",
  infrastructure: "基礎設施", integration: "整合", investment: "投資", kernel: "核心", legal: "法律",
  local: "本機運行", "local-inference": "本機推論", marketplace: "市集", materials: "材料",
  memory: "記憶", model: "模型", "multi-agent": "多代理", multimodel: "多模型", news: "新聞",
  opinion: "觀點", other: "其他", partnership: "合作", personnel: "人事", privacy: "私隱",
  "prompt-injection": "提示注入", recruitment: "招聘", "reinforcement-learning": "強化學習",
  review: "回顧", risk: "風險", search: "搜尋", security: "資訊安全", startup: "初創企業",
  surveillance: "監控", survey: "調查", trust: "信任", uncertainty: "不確定性", vc: "創投",
  video: "影片", watermarking: "浮水印",
};

function mappedLabel(labels: Readonly<Record<string, string>>, value: string): string {
  return Object.hasOwn(labels, value) ? labels[value] : value;
}

export function categoryLabel(value: string, language: SummaryLanguage): string {
  return language === "zh-HK" ? mappedLabel(CATEGORY_LABELS, value) : value === "All" ? "All news" : value;
}

export function tagLabel(group: keyof Tags, value: string, language: SummaryLanguage): string {
  return language === "zh-HK" && group !== "entities" ? mappedLabel(TAG_LABELS, value) : value;
}

/** Trends buckets are UTC calendar dates, not instants in the reader's time zone. */
export function uiDay(iso: string | undefined, language: SummaryLanguage): string {
  if (!iso) return uiCopy(language).dateUnavailable;
  const day = iso.slice(0, 10);
  const time = Date.parse(`${day}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== day) {
    return uiCopy(language).dateUnavailable;
  }
  return new Intl.DateTimeFormat(language === "en" ? "en-GB" : "zh-HK", {
    day: "numeric", month: language === "en" ? "short" : "long", year: "numeric", timeZone: "UTC",
  }).format(time);
}

/** Translate known symptoms conservatively; keep unfamiliar diagnostics verbatim. */
export function sourceError(error: string | null, language: SummaryLanguage): string {
  const copy = uiCopy(language);
  if (!error?.trim()) return copy.unknownError;
  if (language === "en") return error;
  const status = error.match(/\b(?:HTTP(?: error)?|status(?: code)?)\s*[:=]?\s*(\d{3})\b/i)?.[1];
  if (status) return `來源回應錯誤（HTTP ${status}）`;
  if (/timed?\s*out|timeout|ETIMEDOUT/i.test(error)) return `連線逾時 · ${copy.technicalDetails}：${error}`;
  if (/fetch failed|ENOTFOUND|ECONN|socket hang up/i.test(error)) return `未能連接來源 · ${copy.technicalDetails}：${error}`;
  return `來源更新失敗 · ${copy.technicalDetails}：${error}`;
}
