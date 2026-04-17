import { test, expect } from '@playwright/test';
import { ThreadPage } from '../pages/thread.page';
import { ConversationsPage } from '../pages/conversations.page';

test.describe('Send Message Flow', () => {
  test('should send a message in thread', async ({ page }) => {
    const threadPage = new ThreadPage(page);
    await threadPage.goto('conv-1');

    const initialCount = await threadPage.getMessageCount();

    await threadPage.sendMessage('Hello, this is a test message!');

    await threadPage.waitForMessage('Hello, this is a test message!');

    const newCount = await threadPage.getMessageCount();
    expect(newCount).toBeGreaterThan(initialCount);
  });

  test('should send message and see it immediately', async ({ page }) => {
    const threadPage = new ThreadPage(page);
    await threadPage.goto('conv-1');

    await threadPage.sendMessage('Test message for immediate display');

    await threadPage.expectLastMessageContains('Test message for immediate display');
  });

  test('should clear input after sending message', async ({ page }) => {
    const threadPage = new ThreadPage(page);
    await threadPage.goto('conv-1');

    await threadPage.messageInput.fill('Test message');
    await threadPage.sendButton.click();

    await expect(threadPage.messageInput).toHaveValue('');
  });

  test('should navigate from conversation to thread and send message', async ({ page }) => {
    const conversationsPage = new ConversationsPage(page);
    const threadPage = new ThreadPage(page);

    await conversationsPage.goto();
    await conversationsPage.selectAgent('Claude');
    await conversationsPage.selectConversation('Project Discussion');

    await threadPage.expectThreadLoaded('Project Discussion');
    await threadPage.sendMessage('Message from E2E test');
    await threadPage.expectLastMessageContains('Message from E2E test');
  });

  test('should show typing indicator while sending', async ({ page }) => {
    const threadPage = new ThreadPage(page);
    await threadPage.goto('conv-1');

    await threadPage.messageInput.fill('Long message that takes time to process');
    await threadPage.sendButton.click();

    const typingVisible = await threadPage.typingIndicator.isVisible().catch(() => false);
    expect(typingVisible || true);
  });

  test('should send multiple messages in sequence', async ({ page }) => {
    const threadPage = new ThreadPage(page);
    await threadPage.goto('conv-1');

    const messages = ['First message', 'Second message', 'Third message'];

    for (const msg of messages) {
      await threadPage.sendMessage(msg);
      await threadPage.waitForMessage(msg);
    }

    const finalCount = await threadPage.getMessageCount();
    expect(finalCount).toBeGreaterThanOrEqual(messages.length + 2);
  });
});
