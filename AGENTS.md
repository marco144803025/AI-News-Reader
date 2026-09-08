# Agent instructions

These instructions apply to **every** AI agent working in this repository —
Claude Code, ChatGPT/Codex, Cursor, or anything else. `CLAUDE.md` points here;
this file is the authority.

## Repository files are the only source of truth

Assume every session starts cold, with no memory of any previous conversation.
Nothing agreed in an earlier chat is available to the next agent, or to the next
session of the same agent. Therefore:

- **Read before acting.** `specs/CONSTITUTION.md` for the immutable rules,
  `specs/ROADMAP.md` for the queue and current status, and the relevant
  `specs/<feature>/spec.md` and `plan.md` before touching code in that area.
- **The files win.** Where a spec, plan or the ROADMAP disagrees with a decision
  someone recalls making, the file is authoritative. If a new decision is made,
  write it into the file in the same session.
- **Write it down or it did not happen.** Every decision, scope change,
  assumption, approval, verification result and status change is recorded before
  a task counts as complete:
  - approvals, scope changes, answers to open questions → the feature's `spec.md`
  - technical decisions, task progress → the feature's `plan.md`
  - feature status, sequencing, cross-feature notes → `specs/ROADMAP.md`
  - rules that outlive one feature → `specs/CONSTITUTION.md` (discuss first)
- **Leave the repo self-explanatory.** An agent reading only the repository must
  be able to tell what is done, what is in progress, what was decided and why,
  and what comes next — with no conversation history.

## Feature work

For any feature work, follow the SDD process documented in [specs/](specs/).
Read [specs/CONSTITUTION.md](specs/CONSTITUTION.md) before changing code, and check
[specs/ROADMAP.md](specs/ROADMAP.md) for the current feature queue.

## Explanation artifacts

When explaining a concept, architecture, workflow, comparison, or result to
Marco, create and present a small HTML artifact whenever it would make the
explanation clearer or easier to explore. Prefer an HTML artifact for interactive
diagrams, timelines, state flows, and multi-option comparisons. Use concise prose
instead when the explanation is already clear without a visual. Keep artifacts
self-contained, readable, and focused on the question being explained.
