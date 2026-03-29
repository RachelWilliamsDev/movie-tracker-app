import { expect, test } from "@playwright/test";
import { signInSeedViewer } from "./helpers/e2e-auth";

/**
 * MEM-78: signed-in user (with username) sees a discover search row whose primary
 * profile link is `/user/<handle>` when the hit includes a username.
 *
 * Prerequisites: `npm run prisma:push` (or migrate) + `npx prisma db seed`
 * Env: `.env` with DATABASE_URL, NEXTAUTH_SECRET (and optional overrides below).
 */

test("discover search row profile link uses /user/[username]", async ({
  page
}) => {
  await signInSeedViewer(page);

  await page.getByRole("link", { name: "Discover" }).click();
  await expect(page).toHaveURL(/\/discover$/);

  const search = page.getByPlaceholder("Search by name or username…");
  await search.fill("mem78");
  // Discover debounce (350ms) + network
  const profileLink = page.locator('a[href="/user/mem78_target"]');
  await expect(profileLink.first()).toBeVisible({ timeout: 15_000 });
});
