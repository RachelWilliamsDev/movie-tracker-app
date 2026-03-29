/**
 * FEAT-136 (MEM-74): Username backfill + monitoring.
 *
 * **Ops order (document for migration deadline):**
 * 1. Deploy app changes that filter discovery on non-null username.
 * 2. Run `npm run fe136:backfill` once against production to assign `u{id}` handles to legacy rows
 *    (FEAT-128-safe, unique per user id).
 * 3. Add CI/cron: `npm run fe136:check` — fails if accounts older than 24h still lack a username
 *    (expect 0 after rollout; brief nulls only for brand-new signups before choose-username).
 *
 * **Future NOT NULL:** After backfill and stable signup→username flow, add a Prisma migration
 * `ALTER COLUMN username SET NOT NULL` (coordinate with product if signup must assign a provisional handle).
 *
 * Usage:
 *   node scripts/fe136-usernames.mjs check
 *   node scripts/fe136-usernames.mjs backfill
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const STALE_MS = 24 * 60 * 60 * 1000;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function provisionalUsername(userId) {
  const base = `u${userId}`.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 30);
  return base.length >= 3 ? base : `u_${userId.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 28)}`;
}

async function cmdCheck() {
  const cutoff = new Date(Date.now() - STALE_MS);
  const stale = await prisma.user.count({
    where: { username: null, createdAt: { lt: cutoff } }
  });
  const anyNull = await prisma.user.count({ where: { username: null } });

  console.log(
    `FEAT-136 check: users without username (any)=${anyNull}; older than 24h without username=${stale}`
  );

  if (stale > 0) {
    console.error(
      "fe136:check FAILED — run fe136:backfill or investigate stuck accounts."
    );
    process.exitCode = 1;
  }
}

async function cmdBackfill() {
  const missing = await prisma.user.findMany({
    where: { username: null },
    select: { id: true }
  });

  let updated = 0;
  for (const u of missing) {
    let candidate = provisionalUsername(u.id);
    let suffix = 0;
    for (;;) {
      try {
        await prisma.user.update({
          where: { id: u.id },
          data: { username: candidate }
        });
        updated += 1;
        break;
      } catch (e) {
        const code = e?.code;
        if (code === "P2002") {
          suffix += 1;
          candidate = `${provisionalUsername(u.id)}_${suffix}`.slice(0, 30);
          continue;
        }
        throw e;
      }
    }
  }

  console.log(`FEAT-136 backfill: assigned username to ${updated} user(s).`);
}

const cmd = process.argv[2];
try {
  if (cmd === "check") {
    await cmdCheck();
  } else if (cmd === "backfill") {
    await cmdBackfill();
  } else {
    console.error("Usage: node scripts/fe136-usernames.mjs <check|backfill>");
    process.exitCode = 1;
  }
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
  await pool.end();
}
