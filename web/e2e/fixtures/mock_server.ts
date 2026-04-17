import { http, HttpResponse } from 'msw';

export const mockAgents = [
  { id: 'agent-1', name: 'Claude', status: 'online', unread: 2 },
  { id: 'agent-2', name: 'GPT-4', status: 'busy', unread: 0 },
  { id: 'agent-3', name: 'Gemini', status: 'offline', unread: 0 },
];

export const mockChannels = [
  { id: 'channel-1', name: 'general', unread: 0 },
  { id: 'channel-2', name: 'random', unread: 5 },
];

export const mockConversations = [
  {
    id: 'conv-1',
    title: 'Project Discussion',
    lastMessage: 'Let me check the design specs',
    timestamp: new Date().toISOString(),
    unread: 0,
  },
  {
    id: 'conv-2',
    title: 'Bug Report',
    lastMessage: 'The issue is fixed now',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    unread: 1,
  },
];

export const mockThreads = {
  'conv-1': {
    id: 'conv-1',
    title: 'Project Discussion',
    topic: 'Discussing new features',
    messages: [
      { id: 'msg-1', content: 'Hello! How can I help you today?', sender: 'agent', timestamp: new Date().toISOString() },
      { id: 'msg-2', content: 'I need help with the new feature', sender: 'user', timestamp: new Date().toISOString() },
    ],
  },
  'conv-2': {
    id: 'conv-2',
    title: 'Bug Report',
    topic: 'Critical bug fix',
    messages: [
      { id: 'msg-3', content: 'What bug are you experiencing?', sender: 'agent', timestamp: new Date().toISOString() },
      { id: 'msg-4', content: 'The login button is not working', sender: 'user', timestamp: new Date().toISOString() },
    ],
  },
};

export const handlers = [
  http.get('/api/conversations', () => {
    return HttpResponse.json({
      agents: mockAgents,
      channels: mockChannels,
      conversations: mockConversations,
    });
  }),

  http.get('/api/threads/:id', ({ params }) => {
    const thread = mockThreads[params.id as string];
    if (!thread) {
      return HttpResponse.json({ error: 'Thread not found' }, { status: 404 });
    }
    return HttpResponse.json(thread);
  }),

  http.post('/api/threads/:id/messages', async ({ params, request }) => {
    const body = await request.json() as { content: string };
    const newMessage = {
      id: `msg-${Date.now()}`,
      content: body.content,
      sender: 'user',
      timestamp: new Date().toISOString(),
    };
    return HttpResponse.json({ message: newMessage });
  }),

  http.get('/api/events', () => {
    return new HttpResponse(null, { status: 200 });
  }),
];

export function createMockServer() {
  const { setupServer } = require('msw/node');
  const server = setupServer(...handlers);
  return server;
}
