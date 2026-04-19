import { test as base, Page, BrowserContext } from '@playwright/test';
import { mockAgents, mockChannels, mockConversations, mockThreads } from './mock_server';

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

export async function interceptApiCalls(page: Page) {
  // Mock /api/agents - returns agents array
  await page.route('**/api/agents', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockAgents),
    });
  });

  // Mock /api/conversations - returns full response with agents, channels, conversations
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

  // Mock /api/conversations/:id - returns conversation with threads
  await page.route('**/api/conversations/*', async (route) => {
    const url = route.request().url();
    if (url.includes('/threads/')) return route.continue();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'conv-1',
        type: 'dm',
        agent_ids: ['agent-1', 'agent-2'],
        thread_ids: ['thread-1'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    });
  });

  // Mock /api/threads/:id - returns thread with messages
  await page.route('**/api/threads/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        thread: {
          id: 'thread-1',
          conv_id: 'conv-1',
          topic: 'Project Discussion',
          status: 'active',
        },
        messages: mockThreads['conv-1']?.messages || [],
      }),
    });
  });

  // Mock /api/events - SSE endpoint
  await page.route('**/api/events', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: 'data: {"type":"connected"}\n\n',
    });
  });
}
