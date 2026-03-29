import { expect, test } from "@playwright/test";

/**
 * MEM-78: signed-in user (with username) sees a discover search row whose primary
 * profile link is `/user/<handle>` when the hit includes a username.
 *
 * Prerequisites: `npm run prisma:push` (or migrate) + `npx prisma db seed`
 * Env: `.env` with DATABASE_URL, NEXTAUTH_SECRET (and optional overrides below).
 */
const viewerEmail =
  process.env.E2E_DISCOVER_VIEWER_EMAIL ?? "e2e.discover.viewer@example.test";
const viewerPassword =
  process.env.E2E_DISCOVER_VIEWER_PASSWORD ?? "E2eDiscover_Smoke1!";

test("discover search row profile link uses /user/[username]", async ({
  page
}) => {
  await page.goto("/");

  await page.getByPlaceholder("Email").fill(viewerEmail);
  await page.getByPlaceholder("Password (min 8)").fill(viewerPassword);
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page.getByText("Logged in successfully.")).toBeVisible({
    timeout: 15_000
  });

  await page.getByRole("link", { name: "Discover" }).click();
  await expect(page).toHaveURL(/\/discover$/);

  const search = page.getByPlaceholder("Search by name or username…");
  await search.fill("mem78");
  // Discover debounce (350ms) + network
  const profileLink = page.locator('a[href="/user/mem78_target"]');
  await expect(profileLink.first()).toBeVisible({ timeout: 15_000 });
});
