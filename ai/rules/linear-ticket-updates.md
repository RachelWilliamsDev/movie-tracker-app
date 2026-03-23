# Linear ticket updates

Rules for keeping issue state accurate when using Linear (or a Linear-compatible workflow).

## When to update

| Event | Action |
|-------|--------|
| Work started | Move to **In Progress** (or team equivalent). Add a short comment: scope summary + branch name if any. |
| Acceptance criteria unclear | **Do not** start implementation. Comment with numbered questions; leave in **Backlog** or **Triage** until answered. |
| PR / change ready for review | Move to **In Review** (or equivalent). Comment: link to PR or paste summary of files touched + how to verify. |
| Merged / verified in target env | Move to **Done** (or **Completed**). Comment: verification steps performed and result. |
| Blocked | Move to **Blocked** (or flag blocked). Comment: blocker, owner if known, date. |
| Scope reduced to MVP | Edit issue description or add comment listing **in scope** vs **deferred** with links to follow-up issues. |

## Comment format (required structure)

Use this shape so humans and agents parse consistently:

```
## Status
<one line: what changed>

## Verification
<commands run, URLs checked, or "N/A — docs only">

## Links
<PR, branch, doc path — or "none">
```

## Prohibited

- Marking **Done** without stating what was verified.
- Empty or emoji-only status updates.
- Closing an issue when follow-up work remains undocumented — create or link child issues first.

## IDs and references

- Reference issues by **identifier** (e.g. `TEAM-123`) in commits, PR titles, and plan headers.
- If Linear is unavailable, append the same structured update to `.ai/tickets/<id>.md` and sync when access returns.
