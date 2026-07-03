# Portfolio Presentation & Shareability

**ID:** F7-portfolio-presentation
**Status:** Build (spec & plan approved 2026-07-02)
**Owner:** Marco

## Intent

This repo doubles as a portfolio piece, but its first impression undersells the
work. The README still describes a "local web app" run via Windows Task
Scheduler — it never mentions the live GitHub Pages site, the CI pipelines, the
test suite, the search/tag system, or the dark-academic design system. There is
no LICENSE file, no screenshot, no architecture overview, and the deployed page
has no favicon, meta description, or Open Graph tags, so a shared link renders
as a bare URL. A recruiter or engineer skimming the repo should understand what
this is, see it running, and grasp the architecture within 30 seconds — without
cloning anything.

## User stories

- As a recruiter or hiring manager skimming the repo, I want a one-line pitch,
  a screenshot, and a live demo link at the top of the README, so that I can
  judge the project without reading code.
- As an engineer evaluating the codebase, I want an architecture overview
  (ingest → Claude classification → static JSON → React UI) and an accurate
  setup guide, so that I understand the design decisions quickly.
- As anyone sharing the site link in chat or social media, I want a rich link
  preview with title, description, and image, so that the link looks credible
  rather than anonymous.

## Acceptance criteria

- WHEN the repo README is viewed on GitHub THEN it SHALL show, in order: a
  one-line pitch, a live demo link, a screenshot of the current UI, CI status
  badges (test + ingest workflows), a feature list, an architecture
  diagram/section, the tech stack, and local setup instructions.
- WHEN the README setup instructions are followed on a clean machine THEN they
  SHALL match current behavior (`npm run ingest`, `npm run dev`, `npm test`,
  GitHub Actions automation) with no references to retired workflows
  (e.g. Windows Task Scheduler).
- WHEN the deployed site is shared in a chat or social app THEN the page SHALL
  provide Open Graph and Twitter Card meta tags with a title, description, and
  preview image that renders in the unfurl.
- WHEN the site loads in a browser THEN the tab SHALL show a favicon and a
  descriptive `<title>`, and the document SHALL include a meta description.
- WHEN the repo file list is viewed THEN a LICENSE file SHALL be present.
- WHEN specs/ documentation is read against the codebase THEN CONSTITUTION.md
  SHALL NOT contradict the shipped stack (rule #4 currently forbids client-side
  JS frameworks while the app is React 19 + Vite).

## Non-goals

- No visual redesign of the app itself (that is F6).
- No custom domain, analytics, or SEO campaign work beyond basic meta tags.
- No blog post / case study write-up (could be a later addition).

## Open questions

Resolved at Gate 1 (2026-07-02) with recommended defaults — override any of
these at Gate 2 (plan review) if you disagree.

- [x] License choice — **MIT**.
- [x] Social preview image — **UI screenshot** cropped to 1200×630; a branded
      card can replace it later without spec changes.
- [x] Constitution rule #4 — **amend the rule.** Amendment text is proposed in
      [plan.md](./plan.md); approving that plan constitutes the discussion the
      constitution requires for amendments.
- [x] README demo — **static screenshot for v1**; an animated GIF of
      search/filtering is an optional stretch task in the plan.
