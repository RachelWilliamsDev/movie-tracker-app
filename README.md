# MovieApp

A small **Next.js** app for searching TMDB titles, tracking what you watch, per-season TV progress, personal ratings, and where you watched (Netflix, Disney+, Prime Video, or other). Built as an MVP with **TypeScript**, **Tailwind CSS**, **PostgreSQL**, and **NextAuth** (credentials).

## Features

- **Auth** — Sign up and sign in with email/password (sessions via NextAuth).
- **Search** — Find movies and TV shows via The Movie Database (TMDB) API.
- **Detail pages** — Movie and TV show views with overview, genres, and poster.
- **Watch list** — Mark titles as watched and tag **where** you watched them.
- **Ratings** — Save a **1–5** score per title (per user).
- **TV progress** — Track current episode **per season** (does not overwrite other seasons).

## Tech stack

| Layer | Choice |
|--------|--------|
| Framework | Next.js (App Router), React 19 |
| Styling | Tailwind CSS 4 |
| Database | PostgreSQL + Prisma 7 (`@prisma/adapter-pg`) |
| Auth | NextAuth.js (credentials provider) |
| External API | TMDB v3 |

## Prerequisites

- **Node.js** (LTS recommended)
- **PostgreSQL** reachable via a connection string

## Setup

1. **Clone and install**

   ```bash
   git clone <repository-url>
   cd MovieApp
   npm install
   ```

2. **Environment variables**

   Create a `.env` file in the project root (see [Environment variables](#environment-variables)). At minimum you need `DATABASE_URL` and `TMDB_API_KEY`; for auth in production, set `NEXTAUTH_SECRET` and `NEXTAUTH_URL`.

3. **Database schema**

   Apply the Prisma schema to your database (development often uses `db push`; production may use migrations):

   ```bash
   npm run prisma:push
   ```

4. **Run locally**

   ```bash
   npm run dev
   ```

   Open [http://127.0.0.1:3000](http://127.0.0.1:3000) (the dev script binds to `127.0.0.1`).

5. **Verify DB connectivity (optional)**

   ```bash
   npm run db:test
   ```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server (`127.0.0.1`, default port 3000) |
| `npm run build` | `prisma generate` + production Next.js build |
| `npm run start` | Run production server (after `build`) |
| `npm run lint` | Run ESLint |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:push` | Push schema to the database (`prisma db push`) |
| `npm run db:test` | Quick DB connectivity check |

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string for Prisma |
| `TMDB_API_KEY` | Yes (for search/detail) | TMDB API key ([themoviedb.org](https://www.themoviedb.org/settings/api)) |
| `NEXTAUTH_SECRET` | Yes in production | Secret for signing session tokens |
| `NEXTAUTH_URL` | Production / OAuth callbacks | Canonical app URL (e.g. `http://127.0.0.1:3000` locally) |

If `NEXTAUTH_URL` is missing locally, NextAuth may log a warning; set it to match how you open the app.

## Project layout (high level)

```
src/
  app/           # App Router: pages and API routes
  components/    # React UI (search, auth, ratings, watch source, episode progress, etc.)
  lib/           # Prisma client, auth, TMDB helpers, shared constants
prisma/
  schema.prisma
scripts/
  test-db.mjs    # DB smoke test
```

## Production build

```bash
npm run prisma:push   # or migrate deploy, depending on your workflow
npm run build
npm run start
```

Ensure the database schema matches `prisma/schema.prisma` before deploying.

## License

ISC (see `package.json`).
