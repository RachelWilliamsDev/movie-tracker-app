/**
 * Creates 100 synthetic users for local load / discovery testing.
 *
 * - Emails: `fake.user.000` … `fake.user.099` @ `seed.local` (non-routable; dev only)
 * - Usernames: `fu_000` … `fu_099` (valid charset + length)
 * - Shared password (override with SEED_FAKE_USERS_PASSWORD): default `SeedFake100!`
 *
 * Idempotent: upserts by email. Safe to re-run.
 *
 * Usage:
 *   npm run db:seed:fake
 *   SEED_FAKE_USERS_COUNT=50 npm run db:seed:fake
 */

import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const DEFAULT_COUNT = 100;
const countRaw = process.env.SEED_FAKE_USERS_COUNT;
const count = Math.min(
  10_000,
  Math.max(1, countRaw ? Number.parseInt(countRaw, 10) || DEFAULT_COUNT : DEFAULT_COUNT)
);

const passwordPlain =
  process.env.SEED_FAKE_USERS_PASSWORD ?? "SeedFake100!";

if (passwordPlain.length < 8) {
  console.error("SEED_FAKE_USERS_PASSWORD must be at least 8 characters.");
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const hash = await bcrypt.hash(passwordPlain, 10);
  const width = Math.max(3, String(count - 1).length);

  for (let i = 0; i < count; i++) {
    const n = String(i).padStart(width, "0");
    const email = `fake.user.${n}@seed.local`;
    const username = `fu_${n}`;
    const name = `Fake User ${i}`;

    await prisma.user.upsert({
      where: { email },
      create: {
        email,
        username,
        name,
        password: hash,
        profileVisibility: "PUBLIC"
      },
      update: {
        username,
        name,
        password: hash,
        profileVisibility: "PUBLIC"
      }
    });
  }

  console.log(
    `seed-fake-users: upserted ${count} users (@seed.local / fu_*). Password: env SEED_FAKE_USERS_PASSWORD or default.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
