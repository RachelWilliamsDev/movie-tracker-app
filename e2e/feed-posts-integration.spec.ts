import { expect, test } from "@playwright/test";
import { signInSeedViewer } from "./helpers/e2e-auth";

/**
 * MEM-94: interactive feed integration smoke — auth’d feed API, no email in JSON, bounded payload.
 *
 * Prerequisites: `npx prisma db seed` (same as discover e2e).
 */

/** Detect JSON object keys named `email` (not comment text containing the word). */
function jsonContainsEmailKey(json: string): boolean {
  return /"email"\s*:/.test(json);
}

test("feed posts API: 200, no email in payload, reasonable size @ limit=10", async ({
  page
}) => {
  await signInSeedViewer(page);

  const res = await page.request.get("/api/feed/posts?limit=10");
  expect(res.status()).toBe(200);

  const text = await res.text();
  expect(jsonContainsEmailKey(text)).toBe(false);

  // Slow 3G-friendly: single response should stay small (empty feed still tiny)
  expect(text.length).toBeLessThan(400_000);

  const body = JSON.parse(text) as {
    ok?: boolean;
    items?: unknown[];
    pagination?: { limit?: number };
  };
  expect(body.ok).toBe(true);
  expect(Array.isArray(body.items)).toBe(true);
  expect(body.pagination?.limit).toBe(10);
});

test("feed page loads when signed in", async ({ page }) => {
  await signInSeedViewer(page);

  await page.goto("/feed");
  await expect(page).toHaveURL(/\/feed$/);
  await expect(page.getByRole("heading", { name: /feed/i })).toBeVisible({
    timeout: 15_000
  });
});
