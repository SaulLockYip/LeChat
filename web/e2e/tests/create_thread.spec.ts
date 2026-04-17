import { test, expect } from '@playwright/test';
import { ThreadPage } from '../pages/thread.page';

test.describe('Create Thread Flow', () => {
  test('should display thread page', async ({ page }) => {
    const threadPage = new ThreadPage(page);
    await threadPage.goto('conv-1');

    await expect(threadPage.messageList).toBeVisible();
  });

  test('should show thread title and topic', async ({ page }) => {
    const threadPage = new ThreadPage(page);
    await threadPage.goto('conv-1');

    await threadPage.expectThreadLoaded('Project Discussion');
  });

  test('should display message composer', async ({ page }) => {
    const threadPage = new ThreadPage(page);
    await threadPage.goto('conv-1');

    await expect(threadPage.messageComposer).toBeVisible();
    await expect(threadPage.messageInput).toBeVisible();
    await expect(threadPage.sendButton).toBeVisible();
  });

  test('should show existing messages', async ({ page }) => {
    const threadPage = new ThreadPage(page);
    await threadPage.goto('conv-1');

    const count = await threadPage.getMessageCount();
    expect(count).toBeGreaterThan(0);
  });

  test('should have accessible message input', async ({ page }) => {
    const threadPage = new ThreadPage(page);
    await threadPage.goto('conv-1');

    await expect(threadPage.messageInput).toHaveAttribute('placeholder', /message|input/i);
  });
});
