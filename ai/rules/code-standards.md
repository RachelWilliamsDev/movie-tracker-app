# Code standards

Binding rules for all code changes in this repo. Vague suggestions are out of scope; follow these or propose an amendment in a plan/ticket.

## Scope and edits

- Touch only files and modules required by the ticket or linked plan. List every path you intend to change before editing; if the list grows, stop and amend scope.
- Preserve existing patterns: naming, imports, error handling, and test style must match surrounding code unless the ticket mandates a migration.
- Do not delete unrelated comments, tests, or dead code cleanup unless the ticket requires it.

## Quality bar

- **Correctness** — Behavior matches acceptance criteria; edge cases named in the ticket are handled or explicitly documented as out of scope.
- **Tests** — Add or update automated tests when behavior changes; if the repo lacks tests for an area, add the smallest test that proves the change or record manual verification steps in the ticket comment.
- **Lint/format** — Run project-standard formatters and linters on changed files; fix new violations you introduce.
- **Types** — No new `any` (or language equivalent) without a ticket-approved justification in a comment at the usage site.

## Structure

- Prefer small, composable functions over large procedures.
- Avoid duplicate logic: extract shared helpers only when the second use is in scope.
- Public APIs (exports, routes, events) need stable names; internal-only code may stay package-private per language conventions.

## Errors and UX

- User-visible errors must be actionable or clearly state “try again / contact support” per product norms.
- Do not log secrets, tokens, or full PII; follow existing logging redaction patterns.

## Dependencies

- Add third-party dependencies only when the ticket allows it; prefer stdlib and existing stack.
- Pin versions per project convention (`package.json`, lockfiles, `go.mod`, etc.).

## Security

- Validate untrusted input at boundaries (HTTP, CLI, queues).
- No `eval`, dynamic SQL string concatenation with user input, or shell injection patterns.
- Use parameterized queries and vetted encoding for outputs.

## Git hygiene

- Commits are logically scoped; messages state **what** and **why** in the imperative mood.
- Reference the ticket ID in the commit subject or body.

## Review readiness

Before requesting review, confirm:

- [ ] Diff matches ticket scope.
- [ ] Tests / checks run; failures explained if pre-existing.
- [ ] No stray debug prints, TODOs without ticket IDs, or commented-out blocks left behind.
