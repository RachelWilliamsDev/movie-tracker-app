import { expect, type Page } from "@playwright/test";

const viewerEmail =
  process.env.E2E_DISCOVER_VIEWER_EMAIL ?? "e2e.discover.viewer@example.test";
const viewerPassword =
  process.env.E2E_DISCOVER_VIEWER_PASSWORD ?? "E2eDiscover_Smoke1!";

/** Idempotent: uses session if already signed in as the seed viewer. */
export async function signInSeedViewer(page: Page) {
  await page.goto("/");
  if (await page.getByText("Logged in as").isVisible()) {
    const emailLine = page.getByText(viewerEmail);
    if (await emailLine.isVisible()) {
      return;
    }
  }
  await page.getByPlaceholder("Email").fill(viewerEmail);
  await page.getByPlaceholder("Password (min 8)").fill(viewerPassword);
  await page.getByRole("button", { name: "Log in" }).click();
  const toast = page.getByText("Logged in successfully.");
  const sessionPanel = page.getByText("Logged in as");
  await expect(toast.or(sessionPanel)).toBeVisible({ timeout: 15_000 });
}
