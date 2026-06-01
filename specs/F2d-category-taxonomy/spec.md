# Category taxonomy expansion

**ID:** F2d-category-taxonomy
**Status:** Done

## Intent

The original 6 seed categories ("AI Models", "Industry / Business", etc.) were too
broad — multiple distinct topics collapsed into one tab, making the reader feel
undifferentiated. Expand to 12 specific categories and rewrite the classifier
prompt so Claude Haiku assigns correctly rather than defaulting to catch-alls.

## Acceptance criteria

- WHEN the ingest runs THEN articles SHALL be classified into one of 12 named categories, not the original 6.
- WHEN the classifier is given an arXiv safety paper THEN it SHALL assign `AI Safety & Alignment`, not `Research` or `Other`.
- WHEN the classifier is given a funding announcement THEN it SHALL assign `Business & Funding`, not `Industry / Business`.
- WHEN existing articles from the old taxonomy are still within the 7-day retention window THEN they SHALL continue to appear under their old category names until they expire.

## Non-goals

- Retroactively reclassifying existing articles in `news.json`.
- User-defined custom categories.
- Hierarchical / nested categories.

## Category list (as shipped)

| Category | Scope |
|---|---|
| MCP | Model Context Protocol specs, integrations, implementations |
| Model Releases | New model launches, capability announcements, benchmarks |
| Research | arXiv papers, academic findings not tied to a product launch |
| AI Safety & Alignment | Safety research, RLHF, red-teaming, interpretability |
| Developer Tools | APIs, SDKs, IDE plugins, coding assistants |
| Agent Frameworks | Orchestration, multi-agent systems, planning (LangChain, etc.) |
| Business & Funding | Investment rounds, acquisitions, company launches |
| Applications | Consumer/enterprise products built on AI, deployments |
| Regulation & Policy | Government policy, legislation, EU AI Act |
| Open Source | Open-weight model releases, community tooling |
| Hardware & Compute | Chips, GPUs, data centers, inference infrastructure |
| Other | Fallback only |
