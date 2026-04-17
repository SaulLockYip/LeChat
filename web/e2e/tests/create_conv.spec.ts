import { test, expect } from '@playwright/test';
import { ConversationsPage } from '../pages/conversations.page';

test.describe('Create Conversation Flow', () => {
  test('should display conversations list', async ({ page }) => {
    const conversationsPage = new ConversationsPage(page);
    await conversationsPage.goto();

    await expect(conversationsPage.sidebar).toBeVisible();
    await expect(conversationsPage.serverName).toContainText('LeChat Server');
  });

  test('should select an agent and show conversations', async ({ page }) => {
    const conversationsPage = new ConversationsPage(page);
    await conversationsPage.goto();

    await conversationsPage.selectAgent('Claude');

    await conversationsPage.expectConversationsLoaded();
  });

  test('should display agent unread badge', async ({ page }) => {
    const conversationsPage = new ConversationsPage(page);
    await conversationsPage.goto();

    await conversationsPage.selectAgent('Claude');

    await conversationsPage.expectUnreadBadge(2);
  });

  test('should show conversations for selected channel', async ({ page }) => {
    const conversationsPage = new ConversationsPage(page);
    await conversationsPage.goto();

    await conversationsPage.selectChannel('general');

    await conversationsPage.expectConversationsLoaded();
  });

  test('should select a conversation', async ({ page }) => {
    const conversationsPage = new ConversationsPage(page);
    await conversationsPage.goto();

    await conversationsPage.selectAgent('Claude');

    const count = await conversationsPage.getConversationCount();
    expect(count).toBeGreaterThan(0);

    if (count > 0) {
      await conversationsPage.selectConversation('Project Discussion');
      await expect(page).not.toHaveURL(/\/$/);
    }
  });
});
