import { expect, test } from "@playwright/test";

test("loads incident context panel on incident detail page", async ({ page }) => {
  await page.goto("/incidents/inc_20260408_42");
  await expect(page.getByTestId("context-panel")).toBeVisible();
  await expect(page.getByTestId("anomaly-badge")).toBeVisible();
  await expect(page.getByTestId("similar-incidents-list")).toBeVisible();
});

test("anomaly badge renders and similar incident navigation works", async ({ page }) => {
  await page.goto("/incidents/inc_20260408_42");
  await expect(page.getByTestId("anomaly-badge")).toBeVisible();

  const firstSimilar = page.locator("[data-testid^='similar-incident-']").first();
  await firstSimilar.click();
  await expect(page).toHaveURL(/\/incidents\//);
});
