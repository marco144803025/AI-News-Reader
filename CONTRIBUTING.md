# Contributing

This project uses **Spec-Driven Development**. Every feature is specified in
`specs/` before code is written.

Workflow, templates, and feature ordering live in [`specs/README.md`](./specs/README.md)
and [`specs/ROADMAP.md`](./specs/ROADMAP.md).

## TL;DR for any change

1. Find the feature in `specs/ROADMAP.md` (or add a new row).
2. Draft `specs/<id>-<slug>/spec.md` — get it reviewed.
3. Draft `specs/<id>-<slug>/plan.md` — get it reviewed.
4. Implement against the plan; update the plan if reality diverges.
5. Run the verification steps in the plan; flip the roadmap status to `Done`.

No code lands without an approved `plan.md`.
