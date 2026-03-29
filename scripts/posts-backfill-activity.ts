/**
 * MEM-85: Idempotent backfill — one `Post` per eligible `UserActivityEvent`.
 *
 * Safe to re-run: unique `sourceActivityEventId` + `createMany` skipDuplicates.
 *
 * Usage:
 *   npm run posts:backfill-activity
 */

import "dotenv/config";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { mapUserActivityEventToPost } from "../src/lib/activity-to-post";

const BATCH = 250;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  let cursor: { id: string } | undefined;
  let scanned = 0;
  let mapped = 0;
  let skippedMap = 0;
  let inserted = 0;

  for (;;) {
    const page = await prisma.userActivityEvent.findMany({
      take: BATCH,
      orderBy: { id: "asc" },
      ...(cursor ? { skip: 1, cursor } : {})
    });

    if (page.length === 0) break;

    const rows: Prisma.PostCreateManyInput[] = [];

    for (const ev of page) {
      scanned += 1;
      const out = mapUserActivityEventToPost(ev);
      if (!out.ok) {
        skippedMap += 1;
        continue;
      }
      mapped += 1;
      rows.push({
        id: randomUUID(),
        ...out.data
      });
    }

    if (rows.length > 0) {
      const res = await prisma.post.createMany({
        data: rows,
        skipDuplicates: true
      });
      inserted += res.count;
    }

    cursor = { id: page[page.length - 1]!.id };
  }

  console.log(
    `posts:backfill-activity done — scanned=${scanned} mappable=${mapped} skippedByMapper=${skippedMap} insertedThisRun=${inserted}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
