import { test, expect, interceptApiCalls } from '../fixtures/setup';

test.beforeEach(async ({ page }) => {
  await interceptApiCalls(page);
});

test.describe('LeChat Application', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/LeChat/i);
  });

  test('should display the main chat interface', async ({ page }) => {
    await page.goto('/');
    // Main chat interface elements should be present
    await expect(page.locator('main')).toBeVisible();
  });
});
