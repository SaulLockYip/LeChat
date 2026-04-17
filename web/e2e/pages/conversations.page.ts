import { Page, Locator, expect } from '@playwright/test';

export class ConversationsPage {
  readonly page: Page;

  // Sidebar locators
  readonly sidebar: Locator;
  readonly serverName: Locator;
  readonly agentItems: Locator;
  readonly channelItems: Locator;

  // Conversation panel locators
  readonly conversationPanel: Locator;
  readonly conversationList: Locator;
  readonly conversationItems: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sidebar = page.locator('nav[aria-label="Sidebar navigation"]');
    this.serverName = page.getByText('LeChat Server');
    this.agentItems = this.sidebar.getByRole('listitem').filter({ has: page.locator('button') });
    this.channelItems = this.sidebar.getByText('Channels').locator('..').locator('[role="listitem"]');

    this.conversationPanel = page.locator('[aria-label*="conversation" i], [aria-label*="thread" i]').first();
    this.conversationList = page.locator('[role="list"], [aria-label*="conversation" i]');
    this.conversationItems = this.conversationList.locator('[role="listitem"], [data-testid*="conversation"]');
  }

  async goto() {
    await this.page.goto('/');
  }

  async selectAgent(agentName: string) {
    const agentButton = this.agentItems.getByText(agentName);
    await agentButton.click();
  }

  async selectChannel(channelName: string) {
    const channelButton = this.channelItems.getByText(channelName);
    await channelButton.click();
  }

  async selectConversation(conversationTitle: string) {
    const conversation = this.conversationItems.getByText(conversationTitle);
    await conversation.click();
  }

  async expectConversationsLoaded() {
    await expect(this.conversationList).toBeVisible();
  }

  async expectAgentSelected(agentName: string) {
    const agentButton = this.agentItems.getByText(agentName);
    await expect(agentButton).toHaveClass(/shadow-|bg-/);
  }

  async expectUnreadBadge(count: number) {
    const badge = this.page.locator('[class*="Badge"]').filter({ hasText: String(count) });
    await expect(badge).toBeVisible();
  }

  async getConversationCount(): Promise<number> {
    return this.conversationItems.count();
  }
}
