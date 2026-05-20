# AI News Reader

A local web app that fetches recent AI news from RSS feeds, uses Claude to
categorize and summarize articles, and displays them grouped by topic.

## Setup

1. Install dependencies:
   ```
   npm install
   ```
2. Add your Anthropic API key:
   - Copy `.env.example` to `.env`
   - Set `ANTHROPIC_API_KEY` to your key

## Weekly refresh

Run the ingestion script to fetch news and regenerate the data file:

```
npm run ingest
```

This pulls every feed in `feeds.json`, categorizes/summarizes via Claude
Haiku, and writes `public/news.json`. Cost is a few cents per run.

To automate it weekly on Windows, register a Task Scheduler job:

```
schtasks /create /tn "AI News Refresh" /tr "cmd /c cd /d F:\project\AI-news && npm run ingest" /sc weekly /d MON /st 08:00
```

## View the app

```
npm run dev
```

Open the printed local URL (usually http://localhost:5173).

## Customizing feeds

Edit `feeds.json` — each entry is `{ "name": "...", "url": "..." }`.
Feeds that error are skipped automatically.
