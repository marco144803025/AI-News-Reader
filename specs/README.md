# Spec-Driven Development

Every feature in this project ships through two documents written **before** any
code. Implementation is a translation of the spec, not invention.

## Documents per feature

Each feature lives in `specs/<id>-<slug>/` and contains exactly two files:

### `spec.md` — the **what** and **why**

- **Intent** — one paragraph: the problem and the desired outcome.
- **User stories** — `As a <user>, I want <action>, so that <value>`.
- **Acceptance criteria** — bulleted, testable statements. Prefer EARS form:
  `WHEN <trigger> THEN <system> SHALL <observable behavior>`.
- **Non-goals** — what this feature explicitly does *not* do.
- **Open questions** — items needing user input before `plan.md` is written.

### `plan.md` — the **how**

- **Approach** — chosen technical strategy in 1-2 paragraphs.
- **Affected files** — paths to create or modify, with one-line purpose each.
- **Data contracts** — shape of any new JSON/SQLite schema, API request/response,
  or TypeScript type that crosses a module boundary.
- **Tasks** — ordered checklist (`- [ ]`) granular enough that each is one
  reviewable commit.
- **Verification** — explicit commands or steps to confirm acceptance criteria.
- **Risks / tradeoffs** — anything that could regress or surprise.

## Workflow

1. **Draft `spec.md`.** Resolve open questions with the user before writing
   `plan.md`. Spec must be approved before design.
2. **Draft `plan.md`.** Reference the spec's acceptance criteria from the
   verification section so coverage is provable. Plan must be approved before
   code.
3. **Implement.** Check off tasks in `plan.md` as commits land. Do not silently
   diverge from the plan — if reality forces a change, edit `plan.md` first.
4. **Verify.** Run the verification steps. Update the feature's row in
   [ROADMAP.md](./ROADMAP.md) to `Done`.

## Templates

Copy from `specs/_templates/` when starting a new feature.

## Status values used in ROADMAP

| Status        | Meaning                                                        |
| ------------- | -------------------------------------------------------------- |
| `Not started` | Folder exists, spec is a stub.                                 |
| `Spec`        | `spec.md` is being drafted or under review.                    |
| `Plan`        | `spec.md` approved; `plan.md` being drafted or under review.   |
| `Build`       | `plan.md` approved; tasks being implemented.                   |
| `Done`        | Verification passed and merged.                                |
