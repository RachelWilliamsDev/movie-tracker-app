# MVP first

Deliver the smallest change that satisfies the ticket’s **must-have** criteria. Defer everything else.

## Definitions

- **MVP** — The minimal implementation that meets every acceptance criterion labeled **must** (or equivalent) in the ticket or plan.
- **Enhancement** — Anything that improves polish, performance, or UX but is not required to meet **must** criteria.
- **Follow-up** — A separate ticket or sub-issue created before or instead of bundling extra work.

## Decision order

1. List acceptance criteria; mark each **must** vs **should** vs **could**.
2. Implement **must** only unless the ticket explicitly orders otherwise.
3. If a **must** depends on a **should**, implement the dependency at the lowest viable level — document the shortcut in code review notes.

## Allowed without a new ticket

- Bug fixes that prevent **must** criteria from being met.
- Security or data-integrity fixes directly on the touched code path.
- Tests required to prove **must** behavior.

## Requires a new ticket or plan amendment

- New user-facing behavior not in acceptance criteria.
- Refactors not required to implement the MVP.
- Broad dependency upgrades unrelated to the MVP.
- “While we’re here” changes in files outside the agreed file list.

## Documentation

- In PR or handoff comment, include a **Non-goals (this PR)** bullet list for anything deferred.
- If stakeholders expand scope mid-flight, update the ticket **before** writing additional code.

## Anti-patterns (reject)

- Gold-plating APIs or abstractions “for future use.”
- Implementing configuration UI when a constant or env var satisfies the ticket.
- Adding features because they are “easy” in the same file.
