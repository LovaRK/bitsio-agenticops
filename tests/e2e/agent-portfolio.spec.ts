import { expect, test } from "@playwright/test";

test("agent portfolio page renders and supports tab switching", async ({ page }) => {
  await page.goto("/agent-portfolio");

  await expect(page.getByTestId("agent-portfolio-page")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Agent Portfolio" })).toBeVisible();

  await expect(page.getByTestId("ch-tab")).toBeVisible();
  await page.getByRole("tab", { name: "Recovery Orchestrator" }).click();
  await expect(page.getByTestId("rec-tab")).toBeVisible();

  await page.getByRole("tab", { name: "Migration Assurance" }).click();
  await expect(page.getByTestId("mig-tab")).toBeVisible();
});
