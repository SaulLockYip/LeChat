/**
 * Mock API utilities for testing
 * Simulates backend responses without network calls
 */

import type { ApiResponse, Agent, Conversation, Thread, Message } from '@/lib/api';

// Mock data
export const mockAgents: Agent[] = [
  { id: 'agent-1', name: 'Alice', status: 'online' },
  { id: 'agent-2', name: 'Bob', status: 'busy' },
  { id: 'agent-3', name: 'Charlie', status: 'offline' },
];

export const mockConversations: Conversation[] = [
  {
    id: 'conv-1',
    type: 'dm',
    agentId: 'agent-1',
    title: 'DM Alice',
    timestamp: '2024-01-15T10:30:00Z',
  },
  {
    id: 'conv-2',
    type: 'channel',
    channelId: 'channel-1',
    title: 'general',
    timestamp: '2024-01-15T09:00:00Z',
    unread: true,
  },
  {
    id: 'conv-3',
    type: 'channel',
    channelId: 'channel-2',
    title: 'random',
    timestamp: '2024-01-14T16:45:00Z',
  },
];

export const mockThreads: Thread[] = [
  {
    id: 'thread-1',
    conversationId: 'conv-1',
    title: 'Project Discussion',
    topic: 'Frontend Architecture',
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-01-15T11:00:00Z',
  },
  {
    id: 'thread-2',
    conversationId: 'conv-1',
    title: 'Bug Report',
    topic: 'Login Issue',
    createdAt: '2024-01-14T14:20:00Z',
    updatedAt: '2024-01-14T15:30:00Z',
  },
];

export const mockMessages: Message[] = [
  {
    id: 'msg-1',
    threadId: 'thread-1',
    content: 'Hello, how are you?',
    sender: 'user',
    senderId: 'user-1',
    senderName: 'User',
    timestamp: '2024-01-15T10:30:00Z',
    status: 'delivered',
  },
  {
    id: 'msg-2',
    threadId: 'thread-1',
    content: 'I am doing great, thanks!',
    sender: 'agent',
    senderId: 'agent-1',
    senderName: 'Alice',
    timestamp: '2024-01-15T10:31:00Z',
    status: 'read',
  },
];

// Mock API responses
export const mockApiResponses = {
  getAgents: { success: true, data: mockAgents },
  getConversations: { success: true, data: mockConversations },
  getThreads: { success: true, data: mockThreads },
  getMessages: { success: true, data: mockMessages },
};

// Create fetch mock
export function createFetchMock(mockData: Record<string, unknown>, ok = true) {
  return vi.fn(() =>
    Promise.resolve({
      ok,
      status: ok ? 200 : 500,
      json: () => Promise.resolve(mockData),
    })
  ) as unknown as typeof fetch;
}

// Mock the global fetch
export function mockFetch(responses: Record<string, { data: unknown; ok?: boolean }>) {
  const fetchMock = vi.fn((url: string) => {
    // Check if the URL matches any of our mock responses
    for (const [pattern, response] of Object.entries(responses)) {
      if (url.includes(pattern)) {
        return Promise.resolve({
          ok: response.ok ?? true,
          status: response.ok ?? true ? 200 : 500,
          json: () => Promise.resolve(response.data),
        });
      }
    }
    return Promise.reject(new Error(`No mock for URL: ${url}`));
  });

  global.fetch = fetchMock;
  return fetchMock;
}

// Reset fetch mock
export function resetFetchMock() {
  global.fetch = vi.fn();
}

// Setup default mock
export function setupDefaultMock() {
  mockFetch({
    '/api/agents': { data: mockAgents },
    '/api/conversations': { data: { conversations: mockConversations } },
    '/api/threads/conv-1': { data: mockThreads },
    '/api/messages/thread-1': { data: mockMessages },
  });
}
