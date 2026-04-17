import { Page, Locator, expect } from '@playwright/test';

export class ThreadPage {
  readonly page: Page;

  // Thread panel locators
  readonly threadHeader: Locator;
  readonly threadTitle: Locator;
  readonly threadTopic: Locator;
  readonly messageList: Locator;
  readonly messageComposer: Locator;
  readonly messageInput: Locator;
  readonly sendButton: Locator;
  readonly typingIndicator: Locator;

  // Message bubble locators
  readonly messageBubbles: Locator;
  readonly userMessageBubbles: Locator;
  readonly agentMessageBubbles: Locator;

  constructor(page: Page) {
    this.page = page;
    this.threadHeader = page.locator('header, [class*="thread"]').first();
    this.threadTitle = page.getByRole('heading', { level: 2 }).or(page.locator('[class*="title"]'));
    this.threadTopic = page.locator('[class*="topic"], [class*="subtitle"]').first();

    this.messageList = page.locator('[role="log"], [aria-label*="message" i], [class*="message-list"]');
    this.messageComposer = page.locator('[class*="composer"], [class*="input"], form');
    this.messageInput = page.getByPlaceholder(/message|input/i).or(page.locator('textarea, [contenteditable]'));
    this.sendButton = page.getByRole('button', { name: /send|submit/i });

    this.typingIndicator = page.locator('[class*="typing"], [class*="thinking"]');

    this.messageBubbles = page.locator('[class*="bubble"], [class*="message"]').filter({ hasText: /.+/ });
    this.userMessageBubbles = page.locator('[class*="bubble"][class*="user"], [data-sender="user"]');
    this.agentMessageBubbles = page.locator('[class*="bubble"][class*="agent"], [data-sender="agent"]');
  }

  async goto(threadId: string) {
    await this.page.goto(`/thread/${threadId}`);
  }

  async expectThreadLoaded(title?: string) {
    await expect(this.messageList).toBeVisible();
    if (title) {
      await expect(this.threadTitle).toContainText(title);
    }
  }

  async sendMessage(content: string) {
    await this.messageInput.fill(content);
    await this.sendButton.click();
  }

  async expectLastMessageContains(text: string) {
    const lastMessage = this.messageBubbles.last();
    await expect(lastMessage).toContainText(text);
  }

  async expectMessageCount(count: number) {
    await expect(this.messageBubbles).toHaveCount(count);
  }

  async expectTypingIndicator() {
    await expect(this.typingIndicator).toBeVisible();
  }

  async waitForMessage(text: string, timeout = 5000) {
    const message = this.messageBubbles.filter({ hasText: text });
    await expect(message).toBeVisible({ timeout });
  }

  async getMessageCount(): Promise<number> {
    return this.messageBubbles.count();
  }

  async retryMessage(messageIndex: number) {
    const retryButton = this.messageBubbles.nth(messageIndex).getByRole('button', { name: /retry|resend/i });
    await retryButton.click();
  }
}
