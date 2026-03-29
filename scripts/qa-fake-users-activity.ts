/**
 * QA: Sign in each fake seed user (default 100), set three watch rows via the real API
 * (WATCHING / COMPLETED / WANT_TO_WATCH on TMDB titles), and make the first 10 users follow
 * a target account by username (default `meelux`).
 *
 * Uses Playwright `APIRequestContext` so cookies/session match NextAuth + app routes (Docker-safe
 * when the app is reachable at QA_BASE_URL).
 *
 * Prerequisites:
 * - App running (e.g. `docker compose up` or `npm run dev`) with DB migrated/pushed
 * - `npm run db:seed:fake` (or equivalent) so `fake.user.*@seed.local` exist
 * - A user with username `meelux` (or `QA_FOLLOW_USERNAME`) must exist
 *
 * Usage:
 *   QA_BASE_URL=http://127.0.0.1:3000 npm run qa:fake-users:activity
 *   QA_FAKE_USER_COUNT=5 npm run qa:fake-users:activity   # smoke
 *
 * Env:
 *   QA_BASE_URL | PLAYWRIGHT_BASE_URL | NEXTAUTH_URL — app origin (default http://127.0.0.1:3000)
 *   SEED_FAKE_USERS_PASSWORD — must match fake users (default SeedFake100!)
 *   QA_FAKE_USER_COUNT — how many fake users 000..N-1 (default 100, max 10000)
 *   QA_FOLLOW_COUNT — how many of the first fake users follow target (default 10)
 *   QA_FOLLOW_USERNAME — target handle (default meelux)
 */

import "dotenv/config";
import { request } from "@playwright/test";

const BASE =
  process.env.QA_BASE_URL?.trim() ||
  process.env.PLAYWRIGHT_BASE_URL?.trim() ||
  process.env.NEXTAUTH_URL?.trim() ||
  "http://127.0.0.1:3000";

const password =
  process.env.SEED_FAKE_USERS_PASSWORD ?? "SeedFake100!";

function parseIntEnv(key: string, defaultVal: number): number {
  const v = process.env[key];
  if (v === undefined || v === "") return defaultVal;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : defaultVal;
}

const count = Math.min(
  10_000,
  Math.max(1, parseIntEnv("QA_FAKE_USER_COUNT", 100))
);

const followCount = Math.min(
  count,
  Math.max(0, parseIntEnv("QA_FOLLOW_COUNT", 10))
);

const followUsername = (
  process.env.QA_FOLLOW_USERNAME ?? "meelux"
).trim();

/** TMDB ids — well-known titles; pairs are unique per user index. */
const MOVIES = [550, 27205, 157336, 597, 680] as const;
const TVS = [1396, 1399, 66732, 60625, 94997] as const;

function padIndex(i: number): string {
  const width = Math.max(3, String(count - 1).length);
  return String(i).padStart(width, "0");
}

function fakeEmail(i: number): string {
  return `fake.user.${padIndex(i)}@seed.local`;
}

async function loginContext(email: string) {
  const ctx = await request.newContext({ baseURL: BASE });
  const csrfRes = await ctx.get("/api/auth/csrf");
  if (!csrfRes.ok()) {
    throw new Error(`CSRF failed ${csrfRes.status()} for ${email}`);
  }
  const csrfJson = (await csrfRes.json()) as { csrfToken?: string };
  const csrfToken = csrfJson.csrfToken;
  if (!csrfToken) {
    throw new Error("No csrfToken from /api/auth/csrf");
  }

  const loginRes = await ctx.post("/api/auth/callback/credentials", {
    form: {
      csrfToken,
      email,
      password,
      callbackUrl: `${BASE.replace(/\/$/, "")}/`,
      json: "true"
    }
  });

  const status = loginRes.status();
  if (status !== 200 && status !== 302) {
    const body = (await loginRes.text()).slice(0, 400);
    throw new Error(`Login HTTP ${status} for ${email}: ${body}`);
  }

  if (status === 200) {
    try {
      const j = (await loginRes.json()) as { error?: string | null; url?: string };
      if (j.error) {
        throw new Error(`Login rejected for ${email}: ${j.error}`);
      }
    } catch (e) {
      if (e instanceof SyntaxError) {
        /* non-JSON 200 — treat as ok if status 200 */
      } else {
        throw e;
      }
    }
  }

  return ctx;
}

async function postWatch(
  ctx: Awaited<ReturnType<typeof loginContext>>,
  body: Record<string, unknown>
) {
  const res = await ctx.post("/api/watch", {
    data: body,
    headers: { "Content-Type": "application/json" }
  });
  if (!res.ok()) {
    const t = (await res.text()).slice(0, 300);
    throw new Error(`POST /api/watch ${res.status()}: ${t}`);
  }
}

async function resolveFollowUserId(
  ctx: Awaited<ReturnType<typeof loginContext>>,
  username: string
): Promise<string> {
  const res = await ctx.get(
    `/api/users/search?q=${encodeURIComponent(username)}&limit=20`
  );
  if (!res.ok()) {
    throw new Error(`Search failed ${res.status()}`);
  }
  const data = (await res.json()) as {
    ok?: boolean;
    users?: { userId: string; username: string }[];
  };
  const hit = data.users?.find(
    (u) => u.username.toLowerCase() === username.toLowerCase()
  );
  if (!hit) {
    throw new Error(
      `No user with username "${username}". Create that account (choose-username) or set QA_FOLLOW_USERNAME.`
    );
  }
  return hit.userId;
}

async function followUser(
  ctx: Awaited<ReturnType<typeof loginContext>>,
  userId: string
) {
  const res = await ctx.post("/api/follow", {
    data: { userId },
    headers: { "Content-Type": "application/json" }
  });
  if (!res.ok()) {
    const t = (await res.text()).slice(0, 300);
    throw new Error(`POST /api/follow ${res.status()}: ${t}`);
  }
}

async function main() {
  if (followCount > 0 && !followUsername) {
    throw new Error("QA_FOLLOW_USERNAME is empty.");
  }

  console.log(
    `qa-fake-users-activity: base=${BASE} users=${count} followFirst=${followCount}` +
      (followCount > 0 ? ` target=@${followUsername}` : "")
  );

  let meeluxId: string | null = null;
  if (followCount > 0) {
    const probe = await loginContext(fakeEmail(0));
    try {
      meeluxId = await resolveFollowUserId(probe, followUsername);
    } finally {
      await probe.dispose();
    }
    console.log(`Resolved @${followUsername} -> userId ${meeluxId}`);
  }

  let ok = 0;
  for (let i = 0; i < count; i++) {
    const email = fakeEmail(i);
    const ctx = await loginContext(email);

    try {
      const mW = MOVIES[i % MOVIES.length];
      const mC = MOVIES[(i + 1) % MOVIES.length];
      const tW = TVS[(i + 2) % TVS.length];

      await postWatch(ctx, {
        contentId: mW,
        mediaType: "movie",
        watchStatus: "WATCHING"
      });
      await postWatch(ctx, {
        contentId: mC,
        mediaType: "movie",
        watchStatus: "COMPLETED",
        watchSource: "OTHER"
      });
      await postWatch(ctx, {
        contentId: tW,
        mediaType: "tv",
        watchStatus: "WANT_TO_WATCH"
      });

      if (i < followCount && meeluxId) {
        await followUser(ctx, meeluxId);
      }

      ok += 1;
      if ((i + 1) % 10 === 0 || i === count - 1) {
        console.log(`  progress ${i + 1}/${count} (${email})`);
      }
    } finally {
      await ctx.dispose();
    }
  }

  console.log(`qa-fake-users-activity: done, processed ${ok} users.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
