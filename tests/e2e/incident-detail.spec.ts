import { test, expect } from "@playwright/test";

const incidentId = process.env.E2E_INCIDENT_ID || "inc_20260408_42";

test("incident details page renders timeline, assessment, and decision gate for pending incident", async ({ page }) => {
  await page.goto(`/incidents/${incidentId}`);

  await expect(page.getByTestId("incident-detail-page")).toBeVisible();
  await expect(page.getByTestId("story-card")).toBeVisible();
  await expect(page.getByTestId("run-metadata")).toBeVisible();
  await expect(page.getByText("Reasoning Timeline")).toBeVisible();
  await expect(page.getByTestId("confidence-panel")).toBeVisible();
  await expect(page.getByText("Final Assessment")).toBeVisible();
  await expect(page.getByTestId("decision-gate")).toBeVisible();
});

test("incident details page hides decision gate for completed incident", async ({ page }) => {
  if (process.env.E2E_BASE_URL) {
    test.skip(true, "Skipping completed incident test on live server as ID inc_20260408_43 may not exist.");
  }
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

test("non-llm tool shows inline tool details without token cards", async ({ page }) => {
  await page.goto(`/incidents/${incidentId}`);
  await page.getByTestId("tool-chip-run_search").first().click();
  await expect(page.getByTestId("tool-explainability-inline").first()).toBeVisible();
  const runSearchPanel = page.getByTestId("tool-details-run-search").first();
  await expect(runSearchPanel.getByText("Tool Details")).toBeVisible();
  await expect(runSearchPanel.getByText("What This Tool Is Responsible For")).toBeVisible();
  await expect(runSearchPanel.getByText("Why no tokens/cost")).toBeVisible();
  await expect(runSearchPanel.getByText("Prompt Tokens")).toHaveCount(0);
  await expect(runSearchPanel.getByText("Completion Tokens")).toHaveCount(0);
  await expect(runSearchPanel.getByText("Total Tokens")).toHaveCount(0);
});
