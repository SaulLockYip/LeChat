import { test, expect } from '@playwright/test';

test.describe('Registration Flow', () => {
  test('should display registration form', async ({ page }) => {
    await page.goto('/register');

    await expect(page.getByRole('heading', { name: /register|sign up/i })).toBeVisible();
    await expect(page.getByPlaceholder(/username|email/i)).toBeVisible();
    await expect(page.getByPlaceholder(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /create|register|sign up/i })).toBeVisible();
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    await page.goto('/register');

    await page.getByRole('button', { name: /create|register/i }).click();

    await expect(page.getByText(/required|empty|missing/i)).toBeVisible();
  });

  test('should register successfully with valid data', async ({ page }) => {
    await page.goto('/register');

    const timestamp = Date.now();
    await page.getByPlaceholder(/username|email/i).fill(`user_${timestamp}`);
    await page.getByPlaceholder(/password/i).fill('SecurePass123!');

    await page.getByRole('button', { name: /create|register/i }).click();

    await expect(page).not.toHaveURL(/register/);
    await expect(page.getByText(/welcome|dashboard|home/i)).toBeVisible({ timeout: 10000 });
  });
});
