# MovieApp

A small **Next.js** app for searching TMDB titles, tracking what you watch, per-season TV progress, personal ratings, and where you watched (Netflix, Disney+, Prime Video, or other). Built as an MVP with **TypeScript**, **Tailwind CSS**, **PostgreSQL**, and **NextAuth** (credentials).

## Features

- **Auth** — Sign up and sign in with email/password (sessions via NextAuth).
- **Search** — Find movies and TV shows via The Movie Database (TMDB) API.
- **Detail pages** — Movie and TV show views with overview, genres, and poster.
- **Watch list** — Set title status to **Watching**, **Completed**, or **Want to Watch**; for completed titles, tag **where** you watched.
- **Ratings** — Save a **1–5** score per title (per user).
- **TV progress** — Track current episode **per season** (does not overwrite other seasons).

## Tech stack

| Layer | Choice |
|--------|--------|
| Framework | Next.js (App Router), React 19 |
| Styling | Tailwind CSS 4 |
| UI | [shadcn/ui](https://ui.shadcn.com/) — components in `src/components/ui/` (add more with `npx shadcn@latest add <name>`) |
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

   Copy the template and fill in values:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` (see [Environment variables](#environment-variables)). You need `DATABASE_URL` and `TMDB_API_KEY`; set `NEXTAUTH_SECRET` for auth. **`NEXTAUTH_URL`** is included in `.env.example` as `http://127.0.0.1:3000` so local `npm run dev` matches NextAuth and avoids `NEXTAUTH_URL` console warnings. In production, set `NEXTAUTH_URL` to your deployed origin (no code changes required).

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

## Docker (local dev)

This repo includes an MVP Docker setup for local development (`app` + `postgres`).

1. Copy env file (if you do not already have one):

   ```bash
   cp .env.example .env
   ```

2. Start containers (build + run):

   ```bash
   docker compose up --build
   ```

   App: [http://127.0.0.1:3000](http://127.0.0.1:3000)

3. Stop containers:

   ```bash
   docker compose down
   ```

4. Rebuild/reset database data (destructive to local DB volume):

   ```bash
   docker compose down -v
   docker compose up --build
   ```

Notes:
- `docker-compose.yml` sets `DATABASE_URL` to the Postgres container host (`db`) automatically.
- Keep `TMDB_API_KEY` and `NEXTAUTH_SECRET` set in `.env` for app features/auth.

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string for Prisma |
| `TMDB_API_KEY` | Yes (for search/detail) | TMDB API key ([themoviedb.org](https://www.themoviedb.org/settings/api)) |
| `NEXTAUTH_SECRET` | Yes in production | Secret for signing session tokens |
| `NEXTAUTH_URL` | Yes (local + production) | Canonical site URL for NextAuth. Use `http://127.0.0.1:3000` for local dev (same host/port as `npm run dev`). Set to your production URL in hosted environments. |

Use `.env.example` as the starting point; omitting `NEXTAUTH_URL` locally causes NextAuth to log a warning.

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
