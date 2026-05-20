# Desktop notifications

**ID:** F2b-desktop-notifications
**Status:** Not started

## Intent

When an ingest run produces a freshly classified article matching a user-defined
topic of interest, fire a desktop notification via the Web Notifications API
(requires PWA install or browser permission).

## Open questions

- [ ] Where do users define their topics of interest? Settings page, or just a
      `topics.json` config file initially?
- [ ] Fall back to in-app toast when notifications are denied?

> Full spec drafted when this feature is picked up.
