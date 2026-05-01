import { test, expect, devices } from '@playwright/test';
import { telemetryMock, agentStateMock } from './_fixtures';

test.use({ ...devices['Pixel 7'], browserName: 'chromium' });

test('mobile layout and key interactions work', async ({ page }) => {
  await page.route('**/api/v1/waste/telemetry/metrics', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(telemetryMock) });
  });
  await page.route('**/api/v1/agent/state', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(agentStateMock) });
  });

  await page.goto('/agent-control-plane');
  await expect(page.getByText('Telemetry Optimization Agent v1.3')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run Analysis' })).toBeVisible();

  await page.getByRole('button', { name: 'Run Analysis' }).click();
  await expect(page.getByRole('heading', { name: 'Run Analysis' })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  const hero = page.locator('section').filter({ hasText: 'Telemetry Optimization Agent v1.3' }).first();
  await expect(hero).toBeVisible();

  await page.getByRole('button', { name: 'Explain' }).first().click();
  await expect(page.getByRole('heading', { name: /Explainability|Decision Explainability/ })).toBeVisible();
});
