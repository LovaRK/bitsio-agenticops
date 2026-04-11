import { expect, test } from "@playwright/test";

test("main navigation links load without runtime errors", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("dashboard-page")).toBeVisible();
  await expect(page.getByText("Unhandled Runtime Error")).toHaveCount(0);

  await page.getByRole("link", { name: "Incidents" }).click();
  await expect(page.getByTestId("incidents-page")).toBeVisible();
  await expect(page.getByText("Unhandled Runtime Error")).toHaveCount(0);

  await page.getByRole("link", { name: "Approvals" }).click();
  await expect(page.getByRole("heading", { name: "Approval Gate" })).toBeVisible();

  await page.getByRole("link", { name: "Monitoring" }).click();
  await expect(page.getByTestId("monitoring-page")).toBeVisible();

  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByTestId("settings-page")).toBeVisible();

  await page.getByRole("link", { name: "Support" }).click();
  await expect(page.getByTestId("support-page")).toBeVisible();
});

test("incident list link opens detail view", async ({ page }) => {
  await page.goto("/incidents");
  await expect(page.getByTestId("incidents-page")).toBeVisible();

  await page.getByRole("link", { name: "Details" }).first().click();
  await expect(page.getByTestId("incident-detail-page")).toBeVisible();
  await expect(page.getByText("Final Assessment")).toBeVisible();
});

test("approval action buttons are clickable", async ({ page }) => {
  await page.goto("/incidents/inc_20260408_42");
  const decisionGate = page.getByTestId("decision-gate");
  await expect(decisionGate).toBeVisible();

  await page.getByPlaceholder("Add your approval comment and reasoning...").fill("looks good");
  await decisionGate.locator("button").first().click();
  await expect(page.getByText("Approval decision sent.")).toBeVisible();
});

test("rejection action updates decision status", async ({ page }) => {
  await page.goto("/incidents/inc_20260408_42");
  const decisionGate = page.getByTestId("decision-gate");
  await expect(decisionGate).toBeVisible();

  await page.getByPlaceholder("Add your approval comment and reasoning...").fill("needs manual fix");
  await decisionGate.locator("button").nth(1).click();
  await expect(page.getByText("Rejection decision sent.")).toBeVisible();
});

test("floating action dock quick resolve and recent activity are interactive", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Quick Resolve (4)" })).toBeVisible();

  await page.getByRole("button", { name: "Quick Resolve (4)" }).click();
  await expect(page.getByRole("button", { name: "Resolving..." })).toBeVisible();
  await expect(page.getByText("Successfully resolved 4 pending high-priority incidents.")).toBeVisible();

  await page.getByRole("button", { name: "Recent Activity" }).click();
  await expect(page).toHaveURL(/\/incidents$/);
  await expect(page.getByTestId("incidents-page")).toBeVisible();
});
