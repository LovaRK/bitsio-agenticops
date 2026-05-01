import { test, expect } from '@playwright/test';
import { telemetryMock, agentStateMock } from './_fixtures';

test.describe('Agent Control Plane', () => {
  test('telemetry-value redirects and key interactions work', async ({ page }) => {
  
  await page.route('**/api/v1/waste/telemetry/metrics', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(telemetryMock) });
  });
  await page.route('**/api/v1/agent/state', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(agentStateMock) });
  });

  await page.goto('/telemetry-value');
    await expect(page).toHaveURL(/\/agent-control-plane$/);

    await expect(page.getByText('Telemetry Optimization Agent v1.3')).toBeVisible();

    await page.getByRole('button', { name: 'Explain' }).first().click();
    await expect(page.getByRole('heading', { name: 'Decision Explainability' })).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();

    await page.getByRole('button', { name: 'Approve' }).first().click();
    await expect(page.getByText('Human Approval Queue')).toBeVisible();

    await page.getByRole('button', { name: 'Reject' }).first().click();
    await expect(page.getByRole('heading', { name: 'Reject Reason Required' })).toBeVisible();

    const submit = page.getByRole('button', { name: 'Submit' });
    await expect(submit).toBeDisabled();
    await page.locator('textarea[placeholder="Enter reason..."]').fill('Risk too high for this sprint window.');
    await expect(submit).toBeEnabled();
    await submit.click();

    await page.getByRole('button', { name: 'Override' }).first().click();
    await expect(page.getByRole('heading', { name: 'Override Reason Required' })).toBeVisible();
    await page.locator('textarea[placeholder="Enter reason..."]').fill('Temporary policy exception approved by ops lead.');
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page.getByRole('heading', { name: 'Override Recorded' })).toBeVisible();
  });
});
