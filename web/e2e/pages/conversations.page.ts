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
    // Sidebar renders buttons with role="listitem" for agents and channels
    this.agentItems = this.sidebar.locator('button[role="listitem"]');
    // Channels section - both use same button structure, differentiate by content
    this.channelItems = this.sidebar.locator('button[role="listitem"]');

    // Conversation panel has w-[320px] and contains thread buttons
    this.conversationPanel = page.locator('div.w-\\[320px\\]').first();
    // Thread list in conversation panel - look for the scrollable div with space-y-2
    this.conversationList = this.conversationPanel.locator('div.space-y-2');
    this.conversationItems = this.conversationList.locator('button');
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
    // Badge with accent variant has bg-[#ff4757] class
    const badge = this.sidebar.locator('span.bg-\\[\\#ff4757\\]').filter({ hasText: String(count) });
    await expect(badge).toBeVisible();
  }

  async getConversationCount(): Promise<number> {
    return this.conversationItems.count();
  }
}
