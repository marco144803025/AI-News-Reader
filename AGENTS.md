# Agent instructions

These instructions apply to **every** AI agent working in this repository —
Claude Code, ChatGPT/Codex, Cursor, or anything else. `CLAUDE.md` points here;
this file is the authority.

## Repository files are the only source of truth

Assume every session starts cold, with no memory of any previous conversation.
Nothing agreed in an earlier chat is available to the next agent, or to the next
session of the same agent. Therefore:

- **Read before acting.** `specs/CONSTITUTION.md` in full, at the start of
  every task — its rules bind every change, including the small fixes and
  chores that are exempt from the SDD gates. Then `specs/ROADMAP.md` for the
  queue and current status, and the relevant `specs/<feature>/spec.md` and
  `plan.md` before touching code in that area.
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

## Sub-agent delegation

Use sub-agents to split substantial work into small, bounded tasks that can run
independently. The main agent is the orchestrator and remains accountable for
scope, difficult decisions, conflict resolution and the final answer. Marco
selects the main agent, normally Sol or Astra.

Route delegated work using this hierarchy:

- **Luna with `max` effort — normal implementation.** Delegate focused coding,
  tests and other well-specified implementation tasks. Give it the relevant
  repository context, exact scope, allowed files and verification criteria.
- **Luna with `xhigh` effort — searches and small work.** Delegate repository
  searches, status checks, small edits, repetitive work and evidence gathering.
- **Sol with `high` effort or Astra with `high` effort — integration and final
  verification.** The main agent chooses between them based on project
  complexity. Use Sol for ordinary integration and Astra when the change has
  higher architectural complexity, ambiguity or risk.

The main agent must:

1. Read the source-of-truth repository files and make planning or architectural
   decisions before delegating.
2. Give each sub-agent a concrete, non-overlapping task with expected outputs
   and verification requirements. Avoid concurrent edits to the same files.
   State in every brief that `specs/CONSTITUTION.md` applies in full — a
   sub-agent knows only what its brief carries.
3. Keep difficult or cross-cutting decisions with the main agent. Sub-agents may
   investigate and recommend, but must not silently expand scope.
4. Review every sub-agent result and inspect the actual shared working-tree
   changes; never treat a sub-agent's success claim as sufficient evidence.
5. Send the combined result to the integration/verification agent when the work
   is substantial, then resolve its findings before reporting completion.
6. Preserve unrelated working-tree changes and record decisions, progress,
   verification results and status in the repository files required above.

If a requested model or effort level is unavailable, use the closest available
equivalent and state the substitution. For a trivial task where delegation would
add no value, the main agent may complete it directly.

## Explanation artifacts

When explaining a concept, architecture, workflow, comparison, or result to
Marco, create and present a small HTML artifact whenever it would make the
explanation clearer or easier to explore. Prefer an HTML artifact for interactive
diagrams, timelines, state flows, and multi-option comparisons. Use concise prose
instead when the explanation is already clear without a visual. Keep artifacts
self-contained, readable, and focused on the question being explained.
