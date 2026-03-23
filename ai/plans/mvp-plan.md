# MVP plan — TV & movie tracking

## Product goal

Ship a **single-user** app where someone can **add titles**, **track progress** (including episodes), **rate** what they’ve seen, and **tag where they watch**—with minimal friction and no dependency on AI or social graphs.

## Principles

- **MVP-first** — Each milestone delivers a thin vertical slice that is usable on its own; defer polish and nice-to-haves to post-MVP tickets.
- **Out of scope for this plan** — Advanced AI (recommendations, natural-language search, auto-tagging), social (friends, feeds, shared lists, comments), and complex discovery beyond basic browse/search if not required to satisfy the core loop below.

## Core features

| Feature | MVP intent |
|--------|------------|
| **Show/movie tracking** | User maintains a personal library: add/remove titles, see status (e.g. watching, completed, dropped, planned). |
| **Episode progress** | For series: mark episodes watched; show season/episode progress at a glance. |
| **Ratings** | User assigns a rating to a title (and optionally per-season or per-episode only if a ticket explicitly requires—default MVP: title-level). |
| **Watch source tagging** | User tags where they watch (e.g. service name or custom label); used for filtering/sorting later only if in scope of the same ticket. |

## Milestones (build order)

### M1 — Foundation & title catalog

- Auth-ready or single-user data model (per product decision); Prisma + PostgreSQL schema for **titles** (movie vs show), metadata fields needed for list UI.
- **Show/movie tracking**: create list, add title (manual or API-backed lookup—pick one path for MVP), remove/archive, basic detail view.
- **Done when** — User can persist a library and reopen it with correct data.

### M2 — Watch state & episode progress

- Status per title (watching / completed / on hold / dropped / planned).
- **Episode progress** for shows: mark episode watched, bulk actions optional only if ticketed.
- **Done when** — Progress survives reload; UI shows clear progress for at least one show with multiple episodes.

### M3 — Ratings

- **Ratings** on titles (scale defined in ticket: e.g. stars 1–5 or 1–10).
- Display rating on list and detail; optional sort by rating if ticketed.
- **Done when** — User can set, change, and clear a rating without breaking M1–M2 data.

### M4 — Watch source tagging

- **Watch source tagging**: attach one or more source tags to a title (or per viewing session—scope in ticket; default MVP: per title).
- Simple filter or badge on list if ticketed; avoid full analytics dashboards in MVP.
- **Done when** — Tags are stable, editable, and visible where the ticket specifies.

### M5 — Hardening & release checklist

- Error states, empty states, and loading states for M1–M4 surfaces.
- Basic performance checks on list/detail queries; indexes as needed (ticket-driven).
- **Done when** — Acceptance criteria for all shipped tickets are met and documented; no AI or social scope creep.

## Post-MVP (not in this plan)

- Recommendations, smart lists, NLP search, auto-metadata repair.
- Friends, activity feeds, shared watchlists, comments, profiles.
