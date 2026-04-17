import { test as base, Page, BrowserContext } from '@playwright/test';
import { handlers, mockAgents, mockChannels, mockConversations } from './mock_server';

export interface Fixtures {
  mockApi: {
    agents: typeof mockAgents;
    channels: typeof mockChannels;
    conversations: typeof mockConversations;
  };
}

export const test = base.extend<Fixtures>({
  mockApi: ({}, use) => {
    use({ agents: mockAgents, channels: mockChannels, conversations: mockConversations });
  },
});

export { expect } from '@playwright/test';

export async function setupMockServer(context: BrowserContext) {
  await context.addInitScript(() => {
    (globalThis as any).MSW_REGISTRATION_MOCKS = true;
  });
}

export async function interceptApiCalls(page: Page) {
  await page.route('**/api/conversations', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        agents: mockAgents,
        channels: mockChannels,
        conversations: mockConversations,
      }),
    });
  });

  await page.route('**/api/threads/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'conv-1',
        title: 'Project Discussion',
        topic: 'Discussing new features',
        messages: [
          { id: 'msg-1', content: 'Hello! How can I help you today?', sender: 'agent', timestamp: new Date().toISOString() },
        ],
      }),
    });
  });
}
