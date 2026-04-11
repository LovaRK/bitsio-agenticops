import { test, expect } from "@playwright/test";

test("incident details page renders timeline, assessment, and decision gate for pending incident", async ({ page }) => {
  await page.goto("/incidents/inc_20260408_42");

  await expect(page.getByTestId("incident-detail-page")).toBeVisible();
  await expect(page.getByText("Reasoning Timeline")).toBeVisible();
  await expect(page.getByTestId("confidence-panel")).toBeVisible();
  await expect(page.getByText("Final Assessment")).toBeVisible();
  await expect(page.getByTestId("decision-gate")).toBeVisible();
});

test("incident details page hides decision gate for completed incident", async ({ page }) => {
  await page.goto("/incidents/inc_20260408_43");
  await expect(page.getByTestId("incident-detail-page")).toBeVisible();
  await expect(page.getByText("Final Assessment")).toBeVisible();
  await expect(page.getByTestId("decision-gate")).toHaveCount(0);
});

test("home page renders dashboard and incident stream", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("dashboard-page")).toBeVisible();
  await expect(page.getByText("Incident Dashboard")).toBeVisible();
  await expect(page.getByTestId("incident-stream")).toBeVisible();
});
