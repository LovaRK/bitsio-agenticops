import { test, expect } from '@playwright/test';
import { telemetryMock, agentStateMock } from './_fixtures';

test('keyboard interactions: drawer + reason dialog', async ({ page }) => {

  await page.route('**/api/v1/waste/telemetry/metrics', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(telemetryMock) });
  });
  await page.route('**/api/v1/agent/state', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(agentStateMock) });
  });

  await page.goto('/agent-control-plane');

  await page.getByRole('button', { name: 'Explain' }).first().click();
  await expect(page.getByRole('heading', { name: 'Decision Explainability' })).toBeVisible();

  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Decision Explainability' })).not.toBeVisible();

  await page.getByRole('button', { name: 'Approve' }).first().click();
  const queue = page.locator('section', { hasText: 'Human Approval Queue' });
  await expect(queue).toBeVisible();
  await expect(queue.getByRole('button', { name: 'Reject' }).first()).toBeVisible();
  await queue.getByRole('button', { name: 'Reject' }).first().click();
  await expect(page.getByRole('heading', { name: 'Reject Reason Required' })).toBeVisible();

  await expect(page.getByRole('button', { name: 'Submit' })).toBeDisabled();

  await page.locator('textarea[placeholder="Enter reason..."]').fill('Keyboard test reason.');
  await expect(page.getByRole('button', { name: 'Submit' })).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Reject Reason Required' })).not.toBeVisible();
});
