import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * Local / CI E2E users (MEM-78). Idempotent upserts by email.
 * Run after `npm run prisma:push` or migrate: `npx prisma db seed`
 */
const prisma = new PrismaClient();

const E2E_DISCOVER_PASSWORD = "E2eDiscover_Smoke1!";

async function main() {
  const hash = await bcrypt.hash(E2E_DISCOVER_PASSWORD, 10);

  await prisma.user.upsert({
    where: { email: "e2e.discover.viewer@example.test" },
    create: {
      email: "e2e.discover.viewer@example.test",
      password: hash,
      name: "E2E Discover Viewer",
      username: "e2e_viewer",
      profileVisibility: "PUBLIC"
    },
    update: {
      password: hash,
      name: "E2E Discover Viewer",
      username: "e2e_viewer",
      profileVisibility: "PUBLIC"
    }
  });

  await prisma.user.upsert({
    where: { email: "e2e.discover.target@example.test" },
    create: {
      email: "e2e.discover.target@example.test",
      password: hash,
      name: "Mem78 Target",
      username: "mem78_target",
      profileVisibility: "PUBLIC"
    },
    update: {
      password: hash,
      name: "Mem78 Target",
      username: "mem78_target",
      profileVisibility: "PUBLIC"
    }
  });
}

main()
  .then(() => {
    console.log("Seed: E2E discover users upserted.");
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
