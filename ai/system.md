# AI development system

This repository uses a structured multi-agent workflow inside Cursor. Agents read this file first, then apply rules under `ai/rules/`.

## Purpose

- Ship small, verifiable changes tied to tickets and plans.
- Keep scope explicit; avoid speculative work.
- Update Linear (or the configured tracker) when ticket state changes.

## Directory map

| Path | Use |
|------|-----|
| `.ai/agents/` | Agent briefs, personas, handoff notes (optional per task). |
| `.ai/rules/` | Project-local rule snippets or overrides (optional). |
| `.ai/plans/` | Active implementation plans; one file per initiative. |
| `.ai/tickets/` | Cached ticket context, acceptance criteria exports, scratch notes. |
| `ai/rules/` | Canonical rules all agents must follow. |

## Agent roles (conceptual)

Assign one primary role per session. Do not merge incompatible goals in one run.

1. **Planner** — Break work into steps, define acceptance criteria, identify risks. Writes or updates `.ai/plans/`.
2. **Implementer** — Edits code and config only within agreed scope. Runs tests and linters relevant to the change.
3. **Reviewer** — Reads diffs and plans; lists concrete issues (severity, file, line or symbol). Does not expand scope.
4. **Integrator** — Resolves conflicts, updates tickets, merges when criteria are met.

## Operating rules

1. **Single source of truth** — If a plan and a ticket disagree, stop and reconcile in writing (update plan or ticket) before coding.
2. **Traceability** — Every code change references a ticket ID (or plan slug) in commit message or PR description.
3. **No silent scope creep** — Features not in the ticket/plan require an explicit amendment before implementation.
4. **Done means verified** — “Done” requires: tests or manual check steps recorded, and tracker state updated per `ai/rules/linear-ticket-updates.md`.
5. **Rules precedence** — `ai/rules/*.md` overrides informal chat instructions when they conflict.

## Session checklist (agents)

- [ ] Read `ai/system.md` and applicable `ai/rules/*.md`.
- [ ] Load active plan from `.ai/plans/` if this work is plan-driven.
- [ ] Confirm acceptance criteria before editing.
- [ ] After work: run project test/lint commands; update Linear per rules.

## Escalation

If blocked (missing credentials, ambiguous requirements, failing tests unrelated to change), document: **blocker**, **what was tried**, **exact error or question** — then stop or hand off. Do not guess on security, billing, or production data.
