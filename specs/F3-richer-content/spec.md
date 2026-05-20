# Richer content

**ID:** F3-richer-content
**Status:** Not started

## Intent

Move beyond RSS excerpts. Fetch full article text with Mozilla Readability,
cluster duplicate stories across outlets via embedding similarity, and extract
entities (model names, companies, products) inside the same Claude call that
categorizes articles.

## Open questions

- [ ] Cluster threshold: cosine similarity cutoff, or top-N nearest neighbors?
- [ ] Where to store embeddings? `public/news.json` will get heavy — likely the
      trigger to migrate to SQLite.
- [ ] Respect `robots.txt` / publisher rate limits when fetching full text?

> Full spec drafted when this feature is picked up.
