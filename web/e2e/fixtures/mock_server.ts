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
    type: 'dm',
    lechat_agent_ids: ['agent-1'],
    group_name: 'Project Discussion',
    thread_ids: ['thread-1'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'channel-1',
    type: 'group',
    group_name: 'general',
    thread_ids: ['thread-3'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'channel-2',
    type: 'group',
    group_name: 'random',
    thread_ids: ['thread-4'],
    created_at: new Date(Date.now() - 3600000).toISOString(),
    updated_at: new Date(Date.now() - 3600000).toISOString(),
  },
];

export const mockThreads = {
  'conv-1': {
    id: 'conv-1',
    title: 'Project Discussion',
    topic: 'Discussing new features',
    messages: [
      { id: 'msg-1', threadId: 'conv-1', content: 'Hello! How can I help you today?', sender: 'agent', senderId: 'agent-1', senderName: 'Claude', timestamp: new Date().toISOString(), status: 'delivered' },
      { id: 'msg-2', threadId: 'conv-1', content: 'I need help with the new feature', sender: 'user', senderId: 'user-1', senderName: 'You', timestamp: new Date().toISOString(), status: 'delivered' },
    ],
  },
  'channel-1': {
    id: 'channel-1',
    title: 'general',
    topic: 'General discussions',
    messages: [
      { id: 'msg-5', threadId: 'channel-1', content: 'Welcome to general channel!', sender: 'agent', senderId: 'agent-1', senderName: 'Claude', timestamp: new Date().toISOString(), status: 'delivered' },
    ],
  },
  'channel-2': {
    id: 'channel-2',
    title: 'random',
    topic: 'Random discussions',
    messages: [
      { id: 'msg-6', threadId: 'channel-2', content: 'Welcome to random channel!', sender: 'agent', senderId: 'agent-2', senderName: 'GPT-4', timestamp: new Date().toISOString(), status: 'delivered' },
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
    const thread = mockThreads[params.id as keyof typeof mockThreads];
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
