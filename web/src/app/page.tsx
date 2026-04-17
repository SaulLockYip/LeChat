'use client';

import { ThreeColumnLayout } from '@/components/layout/ThreeColumnLayout';

// Placeholder data for demonstration
const PLACEHOLDER_AGENTS = [
  { id: 'agent-1', name: 'Alice', status: 'online' as const, unread: 2 },
  { id: 'agent-2', name: 'Bob', status: 'busy' as const },
  { id: 'agent-3', name: 'Charlie', status: 'offline' as const },
  { id: 'agent-4', name: 'Diana', status: 'online' as const },
];

const PLACEHOLDER_CHANNELS = [
  { id: 'channel-1', name: 'general', unread: 5 },
  { id: 'channel-2', name: 'random' },
  { id: 'channel-3', name: 'engineering' },
  { id: 'channel-4', name: 'design' },
];

const PLACEHOLDER_THREADS = [
  {
    id: 'thread-1',
    title: 'Project Discussion',
    lastMessage: 'The system is now running smoothly after the update.',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    unread: true,
    agentName: 'Alice',
    agentStatus: 'online' as const,
  },
  {
    id: 'thread-2',
    title: 'Code Review',
    lastMessage: 'Can you review the latest pull request?',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    agentName: 'Bob',
    agentStatus: 'busy' as const,
  },
  {
    id: 'thread-3',
    title: 'Deployment Plan',
    lastMessage: 'Deployment scheduled for 3pm today',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    agentName: 'Charlie',
    agentStatus: 'offline' as const,
  },
];

const PLACEHOLDER_MESSAGES = [
  {
    id: 'msg-1',
    content: 'Hey team, I wanted to discuss the new feature implementation. What do you think about using a microservices architecture?',
    sender: 'agent' as const,
    senderName: 'Alice',
    timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    status: 'sent' as const,
  },
  {
    id: 'msg-2',
    content: 'I think microservices could work well, especially for the independent scaling of components.',
    sender: 'user' as const,
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    status: 'sent' as const,
  },
  {
    id: 'msg-3',
    content: 'Agreed. We should also consider the operational complexity though. Maybe we can start with a modular monolith?',
    sender: 'agent' as const,
    senderName: 'Bob',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    status: 'sent' as const,
  },
  {
    id: 'msg-4',
    content: 'That sounds like a good approach. Let me draft a proposal for the architecture.',
    sender: 'user' as const,
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    status: 'sent' as const,
  },
  {
    id: 'msg-5',
    content: 'Perfect! I will review your proposal and provide feedback by end of day.',
    sender: 'agent' as const,
    senderName: 'Alice',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    status: 'sent' as const,
  },
];

export default function HomePage() {
  const handleSendMessage = (content: string) => {
    console.log('Message sent:', content);
  };

  const handleRetryMessage = (messageId: string) => {
    console.log('Retry message:', messageId);
  };

  return (
    <main className="h-screen w-screen overflow-hidden">
      <ThreeColumnLayout
        serverName="LeChat Server"
        serverStatus="connected"
        agents={PLACEHOLDER_AGENTS}
        channels={PLACEHOLDER_CHANNELS}
        currentUser="You"
        conversationTitle="Direct Messages"
        threads={PLACEHOLDER_THREADS}
        threadTitle="Project Discussion"
        threadTopic="Discussing the new feature implementation"
        messages={PLACEHOLDER_MESSAGES}
        onSendMessage={handleSendMessage}
        onRetryMessage={handleRetryMessage}
      />
    </main>
  );
}
