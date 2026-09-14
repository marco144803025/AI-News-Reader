import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { AdditionalSource, Article, RawArticle } from "../../src/types.ts";
import {
  applyCapacity,
  canonicalUrlKey,
  clusterCandidates,
  isTopicallyRelevant,
  normalizeTitle,
  titleTokens,
  titlesMatch,
  type Cluster,
} from "../source-selection.ts";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DAY = 24 * 60 * 60 * 1000;
const BASE = Date.parse("2026-09-10T09:00:00.000Z");

function at(offsetMs: number): string {
  return new Date(BASE + offsetMs).toISOString();
}

function raw(
  title: string,
  url: string,
  source: string,
  publishedAt: string = at(0),
): RawArticle {
  return { title, url, source, publishedAt, snippet: "" };
}

function stored(
  title: string,
  url: string,
  source: string,
  publishedAt: string = at(0),
  additionalSources?: AdditionalSource[],
): Article {
  const article: Article = {
    title,
    url,
    source,
    publishedAt,
    snippet: "",
    category: "Applications",
    summary: "Summary.",
    summaryZhHK: "摘要。",
  };
  if (additionalSources) article.additionalSources = additionalSources;
  return article;
}

/** Every candidate becomes exactly one of: a new cluster, an archive match, or
 * a duplicate report. Asserting the invariant catches silently lost articles. */
function assertAccountedFor(
  candidates: RawArticle[],
  result: ReturnType<typeof clusterCandidates>,
): void {
  assert.equal(
    result.newClusters.length +
      result.matchedExistingCount +
      result.duplicateReportCount,
    candidates.length,
    "every candidate must be accounted for exactly once",
  );
}

function deepFreezeArchive(articles: Article[]): Article[] {
  for (const article of articles) {
    if (article.additionalSources) {
      for (const source of article.additionalSources) Object.freeze(source);
      Object.freeze(article.additionalSources);
    }
    Object.freeze(article);
  }
  return Object.freeze(articles) as Article[];
}

// ---------------------------------------------------------------------------
// S-1 / S-2 — topical filtering
// ---------------------------------------------------------------------------

describe("S-1 isTopicallyRelevant on general feeds", () => {
  it("admits explicit English AI signals", () => {
    assert.equal(
      isTopicallyRelevant("Hong Kong startups adopt AI tools", ""),
      true,
    );
    assert.equal(
      isTopicallyRelevant("How machine learning changed UK hiring", ""),
      true,
    );
    assert.equal(
      isTopicallyRelevant("OpenAI opens a London office", ""),
      true,
    );
    assert.equal(
      isTopicallyRelevant("Inside the new agentic workflow", ""),
      true,
    );
    assert.equal(
      isTopicallyRelevant("Microsoft ships GitHub Copilot for the enterprise", ""),
      true,
    );
    assert.equal(
      isTopicallyRelevant("Everything about Model Context Protocol servers", ""),
      true,
    );
  });

  it("admits an AI employment story from a labour feed", () => {
    assert.equal(
      isTopicallyRelevant(
        "AI is reshaping graduate hiring, says Indeed",
        "Postings mentioning artificial intelligence grew again last quarter.",
      ),
      true,
    );
  });

  it("admits a signal that only appears in the excerpt", () => {
    assert.equal(
      isTopicallyRelevant(
        "Quarterly labour market update",
        "Employers increasingly use large language models to screen CVs.",
      ),
      true,
    );
  });

  it("admits Chinese signals as substrings", () => {
    assert.equal(isTopicallyRelevant("港府推動人工智能發展", ""), true);
    assert.equal(isTopicallyRelevant("生成式 AI 進入香港課室", ""), true);
    assert.equal(isTopicallyRelevant("內地公布大语言模型新規", ""), true);
    assert.equal(isTopicallyRelevant("智能體開始接管客服工作", ""), true);
  });

  it("normalizes fullwidth Latin before matching", () => {
    assert.equal(isTopicallyRelevant("ＡＩ 條例草案刊憲", ""), true);
  });

  it("excludes sport, weather and generic job posts", () => {
    assert.equal(
      isTopicallyRelevant(
        "Manchester United win the derby",
        "Full match report and reaction from the ground.",
      ),
      false,
    );
    assert.equal(
      isTopicallyRelevant(
        "Storm warning issued for Newcastle",
        "Heavy rain expected across the north east tomorrow.",
      ),
      false,
    );
    assert.equal(
      isTopicallyRelevant(
        "Warehouse jobs available in Leeds",
        "Apply now for night shift roles with full automation of the picking line.",
      ),
      false,
    );
  });

  it("does not match AI inside another word (email, Dubai, said)", () => {
    assert.equal(
      isTopicallyRelevant(
        "New email rules for staff",
        "The IT team will migrate every mailbox in Dubai, a spokesperson said.",
      ),
      false,
    );
  });

  it("treats agent, jobs, automation, MCP, Claude, Gemini and Copilot as insufficient alone", () => {
    assert.equal(
      isTopicallyRelevant(
        "MCP wins the county cup",
        "The agent for the club confirmed the automation of ticket jobs.",
      ),
      false,
    );
    assert.equal(
      isTopicallyRelevant(
        "Claude Monet exhibition opens",
        "The Gemini horoscope column returns next week.",
      ),
      false,
    );
    assert.equal(
      isTopicallyRelevant("Copilot lands the plane safely", ""),
      false,
    );
  });

  it("returns false for empty input rather than admitting everything", () => {
    assert.equal(isTopicallyRelevant("", ""), false);
  });
});

describe("S-2 scope:'ai' feeds must bypass this filter", () => {
  // The bypass itself belongs to feed collection, not to this pure module. What
  // is asserted here is *why* it is needed: a real arXiv headline carries no
  // literal keyword, so applying the filter to an AI-specific feed would throw
  // away its coverage.
  it("rejects an arXiv headline that a scope:'ai' feed would legitimately carry", () => {
    assert.equal(
      isTopicallyRelevant(
        "Scaling laws for sparse mixture-of-experts transformers",
        "We study compute-optimal routing under a fixed token budget.",
      ),
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// S-3 / S-4 — canonical URL keys
// ---------------------------------------------------------------------------

describe("S-3 canonicalUrlKey ignores tracking noise only", () => {
  const bare = canonicalUrlKey("https://example.com/story");

  it("drops the documented tracking allowlist", () => {
    assert.equal(
      canonicalUrlKey(
        "https://example.com/story?utm_source=rss&utm_medium=social&utm_campaign=x",
      ),
      bare,
    );
    assert.equal(canonicalUrlKey("https://example.com/story?fbclid=abc"), bare);
    assert.equal(canonicalUrlKey("https://example.com/story?gclid=abc"), bare);
    assert.equal(
      canonicalUrlKey("https://example.com/story?mc_cid=1&mc_eid=2"),
      bare,
    );
  });

  it("drops the fragment and lowercases the host", () => {
    assert.equal(canonicalUrlKey("https://example.com/story#section-2"), bare);
    assert.equal(canonicalUrlKey("https://EXAMPLE.COM/story"), bare);
  });

  it("sorts remaining query parameters", () => {
    assert.equal(
      canonicalUrlKey("https://example.com/story?b=2&a=1"),
      canonicalUrlKey("https://example.com/story?a=1&b=2"),
    );
  });

  it("keeps meaningful query identifiers distinct", () => {
    assert.notEqual(
      canonicalUrlKey("https://example.com/story?id=42"),
      canonicalUrlKey("https://example.com/story?id=43"),
    );
    assert.notEqual(canonicalUrlKey("https://example.com/story?id=42"), bare);
  });

  it("fails visibly on an unparseable URL", () => {
    assert.throws(() => canonicalUrlKey("not a url"), /cannot parse URL/);
  });
});

describe("S-4 canonicalUrlKey preserves what matters, and never leaks", () => {
  it("preserves path case and the http/https distinction", () => {
    assert.notEqual(
      canonicalUrlKey("https://example.com/Story"),
      canonicalUrlKey("https://example.com/story"),
    );
    assert.equal(canonicalUrlKey("https://example.com/Story").includes("/Story"), true);
    assert.notEqual(
      canonicalUrlKey("http://example.com/story"),
      canonicalUrlKey("https://example.com/story"),
    );
  });

  it("never substitutes a canonical key for a stored link", () => {
    const primaryUrl = "https://verge.example/Story-A?utm_source=rss";
    const extraUrl = "https://decoder.example/Story-B?utm_campaign=newsletter";
    const title = "OpenAI launches a new reasoning model for enterprise";
    const candidates = [
      raw(title, primaryUrl, "The Verge AI", at(0)),
      raw(title, extraUrl, "The Decoder", at(60 * 60 * 1000)),
    ];

    const result = clusterCandidates({ candidates, existing: [] });
    assert.equal(result.newClusters.length, 1);
    assert.equal(result.newClusters[0].representative.url, primaryUrl);
    assert.equal(result.newClusters[0].additional.length, 1);
    assert.equal(result.newClusters[0].additional[0].url, extraUrl);
    assert.equal(result.newClusters[0].additional[0].title, title);
    assert.equal(result.newClusters[0].additional[0].source, "The Decoder");
    assertAccountedFor(candidates, result);
  });
});

// ---------------------------------------------------------------------------
// S-5 — title matching
// ---------------------------------------------------------------------------

describe("normalizeTitle and titleTokens", () => {
  it("NFKC-normalizes, case-folds and collapses whitespace", () => {
    assert.equal(normalizeTitle("  ＧＰＴ   Ships \n Today "), "gpt ships today");
  });

  it("keeps version tokens whole and separates them from words", () => {
    const tokens = titleTokens("GPT-4o and Llama 3.5 v2 reach 70B parameters");
    assert.deepEqual([...tokens.numbers].sort(), ["3.5", "4o", "70b", "v2"]);
    assert.equal(tokens.words.has("gpt"), true);
    assert.equal(tokens.words.has("llama"), true);
  });

  it("retains negations rather than stripping them as stopwords", () => {
    assert.equal(titleTokens("Apple will not ship it").negated, true);
    assert.equal(titleTokens("Apple will never ship it").negated, true);
    assert.equal(titleTokens("Apple ships without a model").negated, true);
    assert.equal(titleTokens("Apple doesn't ship it").negated, true);
    assert.equal(titleTokens("Apple ships it").negated, false);
  });
});

describe("S-5 titlesMatch", () => {
  it("merges near-identical English headlines across sources", () => {
    assert.equal(
      titlesMatch(
        "OpenAI launches a new reasoning model for enterprise developers",
        "OpenAI launches a new reasoning model for enterprise developers today",
      ),
      true,
    );
  });

  it("merges a one-word substitution at the selected 0.8 threshold", () => {
    assert.equal(
      titlesMatch(
        "OpenAI launches new reasoning model for enterprise developers today",
        "OpenAI unveils new reasoning model for enterprise developers today",
      ),
      true,
    );
  });

  it("merges identical normalized titles of at least 20 characters", () => {
    assert.equal(
      titlesMatch(
        "Nvidia reports record quarterly revenue",
        "  nvidia   REPORTS record quarterly revenue  ",
      ),
      true,
    );
  });

  it("refuses identical titles shorter than 20 characters", () => {
    assert.equal(titlesMatch("AI chip demand", "AI chip demand"), false);
  });

  it("keeps different model versions apart (4o vs 4.1)", () => {
    assert.equal(
      titlesMatch(
        "OpenAI launches GPT-4o for enterprise developers across Europe",
        "OpenAI launches GPT-4.1 for enterprise developers across Europe",
      ),
      false,
    );
  });

  it("applies the numeric-set gate even when similarity alone would pass", () => {
    // 20 distinct tokens each; a single substitution scores 19/21 = 0.905, so
    // Jaccard alone would merge these. The numeric-set rule is what stops it.
    const base =
      "Meta publishes updated weights for its flagship 70b assistant model across every European research partner and enterprise customer programme today";
    const differentVersion = base.replace("70b", "405b");
    const differentWord = base.replace("assistant", "helper");
    assert.equal(titlesMatch(base, differentVersion), false);
    assert.equal(titlesMatch(base, differentWord), true);
  });

  it("never merges a negated claim with a non-negated one", () => {
    const base =
      "The commission will require every general purpose AI model provider to publish a training data summary";
    const negated = base.replace("will require", "will not require");
    const neutral = base.replace("will require", "will soon require");
    assert.equal(titlesMatch(base, negated), false);
    assert.equal(titlesMatch(base, neutral), true);
    assert.equal(
      titlesMatch(
        "Apple does not ship its new assistant this year",
        "Apple ships its new assistant this year",
      ),
      false,
    );
  });

  it("merges identical Chinese titles and never fuzzily", () => {
    const chinese = "OpenAI 發布全新人工智能模型 香港開發者可以即時試用";
    assert.equal(titlesMatch(chinese, chinese), true);
    assert.equal(
      titlesMatch(chinese, "OpenAI 發布全新人工智能模型 香港開發者可即時試用"),
      false,
    );
  });

  it("never compares across languages", () => {
    assert.equal(
      titlesMatch(
        "OpenAI 發布全新人工智能模型 香港開發者可以即時試用",
        "OpenAI launches a brand new artificial intelligence model that Hong Kong developers can try immediately",
      ),
      false,
    );
  });

  it("refuses empty titles", () => {
    assert.equal(titlesMatch("", ""), false);
    assert.equal(titlesMatch("   ", "Nvidia reports record quarterly revenue"), false);
  });
});

// ---------------------------------------------------------------------------
// S-6 / S-7 / S-8 — clustering against the archive
// ---------------------------------------------------------------------------

describe("S-6 an incoming URL already stored as attribution", () => {
  it("does not become a new article even when its headline changed", () => {
    const existing = [
      stored(
        "OpenAI launches a new reasoning model for enterprise developers",
        "https://verge.example/story-a",
        "The Verge AI",
        at(0),
        [
          {
            title: "OpenAI debuts enterprise reasoning model",
            url: "https://decoder.example/story-b",
            source: "The Decoder",
          },
        ],
      ),
    ];
    const candidates = [
      raw(
        "A completely different headline about the very same launch",
        "https://decoder.example/story-b?utm_source=rss",
        "The Decoder",
        at(2 * 60 * 60 * 1000),
      ),
    ];

    const result = clusterCandidates({ candidates, existing });
    assert.equal(result.newClusters.length, 0);
    assert.equal(result.matchedExistingCount, 1);
    assert.equal(result.existingUpdates.length, 0, "nothing new to credit");
    assertAccountedFor(candidates, result);
  });

  it("matches an archived primary URL through tracking parameters", () => {
    const existing = [
      stored(
        "Nvidia reports record quarterly revenue",
        "https://arstechnica.example/nvidia",
        "Ars Technica AI",
      ),
    ];
    const candidates = [
      raw(
        "Nvidia reports record quarterly revenue",
        "https://arstechnica.example/nvidia?utm_source=feed#top",
        "Ars Technica AI",
      ),
    ];
    const result = clusterCandidates({ candidates, existing });
    assert.equal(result.newClusters.length, 0);
    assert.equal(result.matchedExistingCount, 1);
    assert.equal(result.existingUpdates.length, 0);
  });

  it("credits a genuinely new link for an archived story", () => {
    const existing = [
      stored(
        "OpenAI launches a new reasoning model for enterprise developers",
        "https://verge.example/story-a",
        "The Verge AI",
        at(0),
      ),
    ];
    const candidates = [
      raw(
        "OpenAI launches a new reasoning model for enterprise developers today",
        "https://decoder.example/story-b",
        "The Decoder",
        at(3 * 60 * 60 * 1000),
      ),
    ];

    const result = clusterCandidates({ candidates, existing });
    assert.equal(result.newClusters.length, 0);
    assert.equal(result.matchedExistingCount, 1);
    assert.equal(result.existingUpdates.length, 1);
    const update = result.existingUpdates[0];
    assert.equal(update.url, "https://verge.example/story-a", "primary URL untouched");
    assert.equal(update.title, existing[0].title, "primary title untouched");
    assert.equal(update.summaryZhHK, "摘要。");
    assert.deepEqual(update.additionalSources, [
      {
        title: "OpenAI launches a new reasoning model for enterprise developers today",
        url: "https://decoder.example/story-b",
        source: "The Decoder",
      },
    ]);
  });

  it("respects the 72 hour comparison window", () => {
    const existing = [
      stored(
        "OpenAI launches a new reasoning model for enterprise developers",
        "https://verge.example/story-a",
        "The Verge AI",
        at(0),
      ),
    ];
    const candidates = [
      raw(
        "OpenAI launches a new reasoning model for enterprise developers today",
        "https://decoder.example/story-b",
        "The Decoder",
        at(4 * DAY),
      ),
    ];
    const result = clusterCandidates({ candidates, existing });
    assert.equal(result.newClusters.length, 1, "outside the window it stays separate");
    assert.equal(result.matchedExistingCount, 0);
  });
});

describe("S-7 the caller's archive is never mutated", () => {
  it("returns clones and leaves the input deep-equal to its snapshot", () => {
    const existing = deepFreezeArchive([
      stored(
        "OpenAI launches a new reasoning model for enterprise developers",
        "https://verge.example/story-a",
        "The Verge AI",
        at(0),
        [
          {
            title: "Earlier credited coverage",
            url: "https://register.example/story-c",
            source: "The Register AI/ML",
          },
        ],
      ),
    ]);
    const snapshot = structuredClone(existing) as Article[];

    const candidates = [
      raw(
        "OpenAI launches a new reasoning model for enterprise developers today",
        "https://decoder.example/story-b",
        "The Decoder",
        at(60 * 60 * 1000),
      ),
    ];
    const result = clusterCandidates({ candidates, existing });

    assert.deepEqual(existing, snapshot, "archive unchanged");
    assert.equal(result.existingUpdates.length, 1);
    assert.notEqual(result.existingUpdates[0], existing[0]);
    assert.notEqual(
      result.existingUpdates[0].additionalSources,
      existing[0].additionalSources,
    );
    assert.equal(result.existingUpdates[0].additionalSources?.length, 2);
    assert.equal(existing[0].additionalSources?.length, 1);
  });
});

describe("S-8 already-stored records are never consolidated", () => {
  const duplicateTitle = "Nvidia reports record quarterly revenue";

  it("leaves two archived records with the same title alone", () => {
    const existing = [
      stored(duplicateTitle, "https://arstechnica.example/nvidia", "Ars Technica AI"),
      stored(duplicateTitle, "https://verge.example/nvidia", "The Verge AI"),
    ];
    const candidates = [
      raw(
        "A totally unrelated story about warehouse robots in Rotterdam",
        "https://register.example/robots",
        "The Register AI/ML",
      ),
    ];

    const result = clusterCandidates({ candidates, existing });
    assert.equal(result.existingUpdates.length, 0);
    assert.equal(result.newClusters.length, 1);
    assert.equal(result.matchedExistingCount, 0);
  });

  it("credits an incoming duplicate to exactly one archived record", () => {
    const existing = [
      stored(duplicateTitle, "https://verge.example/nvidia", "The Verge AI"),
      stored(duplicateTitle, "https://arstechnica.example/nvidia", "Ars Technica AI"),
    ];
    const candidates = [
      raw(duplicateTitle, "https://decoder.example/nvidia", "The Decoder"),
    ];

    const result = clusterCandidates({ candidates, existing });
    assert.equal(result.existingUpdates.length, 1, "exactly one record updated");
    // Stable primary-URL tie-break, not archive order: arstechnica < verge.
    assert.equal(result.existingUpdates[0].url, "https://arstechnica.example/nvidia");
    assert.equal(result.matchedExistingCount, 1);
  });
});

describe("clusterCandidates within a single run", () => {
  it("picks the earliest published member as representative", () => {
    const title = "OpenAI launches a new reasoning model for enterprise";
    const candidates = [
      raw(title, "https://verge.example/late", "The Verge AI", at(5 * 60 * 60 * 1000)),
      raw(title, "https://decoder.example/early", "The Decoder", at(0)),
      raw(title, "https://register.example/mid", "The Register AI/ML", at(60 * 60 * 1000)),
    ];

    const result = clusterCandidates({ candidates, existing: [] });
    assert.equal(result.newClusters.length, 1);
    assert.equal(
      result.newClusters[0].representative.url,
      "https://decoder.example/early",
    );
    assert.deepEqual(
      result.newClusters[0].additional.map((entry) => entry.url),
      ["https://register.example/mid", "https://verge.example/late"],
    );
    assert.equal(result.duplicateReportCount, 2);
    assertAccountedFor(candidates, result);
  });

  it("deduplicates attribution by canonical key, keeping the first entry verbatim", () => {
    const title = "OpenAI launches a new reasoning model for enterprise";
    const candidates = [
      raw(title, "https://verge.example/story", "The Verge AI", at(0)),
      raw(title, "https://decoder.example/story", "The Decoder", at(60 * 1000)),
      raw(
        "A later rewrite of the very same decoder story headline",
        "https://decoder.example/story?utm_source=twitter",
        "The Decoder",
        at(2 * 60 * 1000),
      ),
    ];

    const result = clusterCandidates({ candidates, existing: [] });
    assert.equal(result.newClusters.length, 1);
    assert.equal(result.newClusters[0].additional.length, 1);
    assert.equal(result.newClusters[0].additional[0].title, title);
    assert.equal(
      result.newClusters[0].additional[0].url,
      "https://decoder.example/story",
    );
    assertAccountedFor(candidates, result);
  });

  it("compares candidates to the representative, so weak matches cannot chain", () => {
    // B matches A, and C matches B, but C does not match A. C must stay separate.
    const a = "OpenAI launches a new reasoning model for enterprise developers";
    const b = "OpenAI launches a new reasoning model for enterprise developers today";
    const c =
      "OpenAI launches a new reasoning model for enterprise developers today worldwide across";
    assert.equal(titlesMatch(a, b), true);
    assert.equal(titlesMatch(b, c), true);
    assert.equal(titlesMatch(a, c), false, "precondition for the chaining test");

    const candidates = [
      raw(a, "https://verge.example/a", "The Verge AI", at(0)),
      raw(b, "https://decoder.example/b", "The Decoder", at(60 * 1000)),
      raw(c, "https://register.example/c", "The Register AI/ML", at(2 * 60 * 1000)),
    ];
    const result = clusterCandidates({ candidates, existing: [] });
    assert.equal(result.newClusters.length, 2);
    assert.equal(result.newClusters[0].additional.length, 1);
    assert.equal(result.newClusters[1].representative.url, "https://register.example/c");
  });
});

// ---------------------------------------------------------------------------
// Idempotence — Constitution rule 2
// ---------------------------------------------------------------------------

describe("idempotence (Constitution rule 2)", () => {
  /** What the orchestrator persists: representative plus its attribution. */
  function materialize(clusters: Cluster[]): Article[] {
    return clusters.map((cluster) => {
      const article = stored(
        cluster.representative.title,
        cluster.representative.url,
        cluster.representative.source,
        cluster.representative.publishedAt,
      );
      if (cluster.additional.length > 0) {
        article.additionalSources = cluster.additional.map((entry) => ({ ...entry }));
      }
      return article;
    });
  }

  it("adds nothing on a second run over the same input", () => {
    const title = "OpenAI launches a new reasoning model for enterprise developers";
    const candidates = [
      raw(title, "https://verge.example/story-a", "The Verge AI", at(0)),
      raw(title, "https://decoder.example/story-b", "The Decoder", at(60 * 60 * 1000)),
      raw(
        "OpenAI launches a new reasoning model for enterprise developers today",
        "https://register.example/story-c",
        "The Register AI/ML",
        at(2 * 60 * 60 * 1000),
      ),
      raw(
        "Nvidia reports record quarterly revenue",
        "https://arstechnica.example/nvidia",
        "Ars Technica AI",
        at(3 * 60 * 60 * 1000),
      ),
    ];

    const first = clusterCandidates({ candidates, existing: [] });
    assertAccountedFor(candidates, first);
    assert.equal(first.newClusters.length, 2);
    const archive = materialize(first.newClusters);

    const second = clusterCandidates({ candidates, existing: archive });
    assert.equal(second.newClusters.length, 0, "no second copy of any article");
    assert.equal(
      second.existingUpdates.length,
      0,
      "no second copy of any attribution entry",
    );
    assert.equal(second.matchedExistingCount, candidates.length);

    // A third run over the merged archive is likewise inert.
    const third = clusterCandidates({ candidates, existing: archive });
    assert.deepEqual(third, second);
  });

  it("is idempotent when attribution is added to an archived article", () => {
    const existing = [
      stored(
        "OpenAI launches a new reasoning model for enterprise developers",
        "https://verge.example/story-a",
        "The Verge AI",
        at(0),
      ),
    ];
    const candidates = [
      raw(
        "OpenAI launches a new reasoning model for enterprise developers today",
        "https://decoder.example/story-b",
        "The Decoder",
        at(60 * 60 * 1000),
      ),
    ];

    const first = clusterCandidates({ candidates, existing });
    assert.equal(first.existingUpdates.length, 1);

    const merged = first.existingUpdates;
    const second = clusterCandidates({ candidates, existing: merged });
    assert.equal(second.existingUpdates.length, 0);
    assert.equal(second.newClusters.length, 0);
    assert.equal(second.matchedExistingCount, 1);
  });
});

// ---------------------------------------------------------------------------
// S-9 — capacity
// ---------------------------------------------------------------------------

const FEED_ORDER = [
  "The Verge AI",
  "TechCrunch AI",
  "Ars Technica AI",
  "OpenAI Blog",
  "Google DeepMind",
  "MIT Tech Review AI",
  "arXiv cs.AI",
  "Hacker News (AI)",
  "AI Business",
  "The Decoder",
  "The Register AI/ML",
  "Hugging Face blog",
  "Guardian AI",
  "Simon Willison",
  "GitHub blog",
  "Computer Weekly",
  "Indeed Hiring Lab",
  "Personnel Today",
  "SCMP Tech",
  "Unwire.hk",
];

function cluster(
  source: string,
  index: number,
  publishedAt: string = at(index * 60 * 1000),
): Cluster {
  const slug = `${source.replace(/\W+/g, "-").toLowerCase()}-${index}`;
  return {
    representative: raw(`Story ${slug}`, `https://example.com/${slug}`, source, publishedAt),
    additional: [],
  };
}

describe("S-9 applyCapacity", () => {
  it("admits 100 of 140 candidates and reports 40 skips", () => {
    const sources = FEED_ORDER.slice(0, 7);
    const clusters: Cluster[] = [];
    for (const source of sources) {
      for (let index = 0; index < 20; index += 1) clusters.push(cluster(source, index));
    }
    assert.equal(clusters.length, 140);

    const { admitted, skipped } = applyCapacity({
      clusters,
      feedOrder: FEED_ORDER,
      limit: 100,
    });
    assert.equal(admitted.length, 100);
    assert.equal(skipped, 40);

    const represented = new Set(admitted.map((item) => item.representative.source));
    assert.equal(represented.size, sources.length, "every non-empty bucket represented");
  });

  it("round-robins uneven buckets without stalling", () => {
    const clusters = [
      cluster("The Verge AI", 0),
      cluster("The Verge AI", 1),
      cluster("The Verge AI", 2),
      cluster("TechCrunch AI", 0),
    ];
    const { admitted, skipped } = applyCapacity({
      clusters,
      feedOrder: FEED_ORDER,
      limit: 10,
    });
    assert.equal(skipped, 0);
    assert.deepEqual(
      admitted.map((item) => item.representative.source),
      ["The Verge AI", "TechCrunch AI", "The Verge AI", "The Verge AI"],
    );
    // Newest first inside each bucket.
    assert.deepEqual(
      admitted.map((item) => item.representative.url),
      [
        "https://example.com/the-verge-ai-2",
        "https://example.com/techcrunch-ai-0",
        "https://example.com/the-verge-ai-1",
        "https://example.com/the-verge-ai-0",
      ],
    );
  });

  it("favours configuration order when the limit is small", () => {
    const clusters = FEED_ORDER.map((source, index) => cluster(source, index));
    const { admitted, skipped } = applyCapacity({
      clusters,
      feedOrder: FEED_ORDER,
      limit: 3,
    });
    assert.equal(skipped, 17);
    assert.deepEqual(
      admitted.map((item) => item.representative.source),
      FEED_ORDER.slice(0, 3),
    );
  });

  it("is identical across input permutations of equal-date items", () => {
    const sameDate = at(0);
    const clusters: Cluster[] = [];
    for (const source of FEED_ORDER.slice(0, 5)) {
      for (let index = 0; index < 6; index += 1) {
        clusters.push(cluster(source, index, sameDate));
      }
    }

    const forward = applyCapacity({ clusters, feedOrder: FEED_ORDER, limit: 17 });
    const reversed = applyCapacity({
      clusters: [...clusters].reverse(),
      feedOrder: FEED_ORDER,
      limit: 17,
    });
    const rotated = applyCapacity({
      clusters: [...clusters.slice(13), ...clusters.slice(0, 13)],
      feedOrder: FEED_ORDER,
      limit: 17,
    });

    const urls = (result: { admitted: Cluster[] }) =>
      result.admitted.map((item) => item.representative.url);
    assert.deepEqual(urls(reversed), urls(forward));
    assert.deepEqual(urls(rotated), urls(forward));
    assert.equal(forward.admitted.length, 17);
    assert.equal(forward.skipped, 13);
  });

  it("admits nothing at limit 0 and reports every cluster as skipped", () => {
    const clusters = [cluster("The Verge AI", 0), cluster("TechCrunch AI", 0)];
    const result = applyCapacity({ clusters, feedOrder: FEED_ORDER, limit: 0 });
    assert.equal(result.admitted.length, 0);
    assert.equal(result.skipped, 2);
  });

  it("fails visibly on an invalid limit", () => {
    assert.throws(
      () => applyCapacity({ clusters: [], feedOrder: FEED_ORDER, limit: -1 }),
      /non-negative safe integer/,
    );
    assert.throws(
      () => applyCapacity({ clusters: [], feedOrder: FEED_ORDER, limit: 1.5 }),
      /non-negative safe integer/,
    );
  });

  it("places an unconfigured source last, deterministically", () => {
    const clusters = [
      cluster("Mystery Feed", 0),
      cluster("The Verge AI", 0),
      cluster("Another Mystery", 0),
    ];
    const { admitted } = applyCapacity({
      clusters,
      feedOrder: FEED_ORDER,
      limit: 3,
    });
    assert.deepEqual(
      admitted.map((item) => item.representative.source),
      ["The Verge AI", "Another Mystery", "Mystery Feed"],
    );
  });
});

// ---------------------------------------------------------------------------
// Integration corrections applied by the main agent after the delegated work.
// Both were reported by the selection agent as real-world gaps, and accepted.
// ---------------------------------------------------------------------------

describe("integration corrections", () => {
  it("treats A.I. written with periods as an AI signal", () => {
    assert.equal(isTopicallyRelevant("The A.I. boom reaches Whitehall", ""), true);
    assert.equal(isTopicallyRelevant("A.I. is reshaping hiring", ""), true);
    // Still not a substring match inside an unrelated word.
    assert.equal(isTopicallyRelevant("Mumbai. India expands its rail network", ""), false);
  });

  it("does not treat a trailing slash as a different article", () => {
    assert.equal(
      canonicalUrlKey("https://example.com/story"),
      canonicalUrlKey("https://example.com/story/"),
    );
    // A real path difference still differs, and the site root keeps its slash.
    assert.notEqual(
      canonicalUrlKey("https://example.com/story"),
      canonicalUrlKey("https://example.com/story/part-2"),
    );
    assert.equal(canonicalUrlKey("https://example.com/"), "https://example.com/");
  });
});

// ---------------------------------------------------------------------------
// Integration-review fixes (D2): attribution must not grow on a re-run when a
// publisher varies its own query parameters.
// ---------------------------------------------------------------------------

describe("attribution is stable across runs", () => {
  const archived = (over: Partial<Article> = {}): Article => ({
    title: "Hong Kong expands its artificial intelligence funding programme",
    url: "https://www.scmp.com/tech/a/3325",
    source: "SCMP Tech",
    publishedAt: "2026-09-10T06:00:00.000Z",
    snippet: "",
    category: "Applications",
    summary: "Summary.",
    ...over,
  });

  it("never credits a source for its own story", () => {
    const existing = [archived()];
    const candidate: RawArticle = {
      title: archived().title,
      url: "https://www.scmp.com/tech/a/3325?module=perpetual_scroll&pgtype=article",
      source: "SCMP Tech",
      publishedAt: "2026-09-10T06:00:00.000Z",
      snippet: "",
    };
    const first = clusterCandidates({ candidates: [candidate], existing });
    assert.equal(first.newClusters.length, 0, "not a new article");
    assert.equal(first.existingUpdates.length, 0, "and not credited to itself");
  });

  it("does not credit the same outlet twice for one headline under a changed link", () => {
    let existing = [archived()];
    const other = (param: string): RawArticle => ({
      title: archived().title,
      url: `https://example.org/story/3325?${param}`,
      source: "The Register AI/ML",
      publishedAt: "2026-09-10T07:00:00.000Z",
      snippet: "",
    });

    const day1 = clusterCandidates({ candidates: [other("ref=home")], existing });
    assert.equal(day1.existingUpdates.length, 1);
    existing = [day1.existingUpdates[0]];
    assert.equal(existing[0].additionalSources?.length, 1);

    // Same story, same outlet, a link that differs only by a session parameter.
    const day2 = clusterCandidates({ candidates: [other("ref=newsletter")], existing });
    const after = day2.existingUpdates[0] ?? existing[0];
    assert.equal(
      after.additionalSources?.length,
      1,
      "a re-run must not multiply attribution (Constitution rule 2)",
    );
  });

  it("matches a short Chinese headline exactly, so it does not become a second article", () => {
    const zh = "蘋果推出全新 AI 功能";
    assert.equal(zh.length >= 8 && zh.length < 20, true, "a realistic short CJK headline");
    const existing = [archived({ title: zh, url: "https://unwire.hk/2026/09/apple-ai/", source: "Unwire.hk" })];
    const candidate: RawArticle = {
      title: zh,
      url: "https://unwire.hk/2026/09/apple-ai/?ref=homepage",
      source: "Unwire.hk",
      publishedAt: "2026-09-10T06:30:00.000Z",
      snippet: "",
    };
    const result = clusterCandidates({ candidates: [candidate], existing });
    assert.equal(result.newClusters.length, 0, "no duplicate card, no second paid classification");
  });

  it("still refuses a CJK title too short to identify a story", () => {
    assert.equal(titlesMatch("AI 新聞", "AI 新聞"), false);
  });
});
