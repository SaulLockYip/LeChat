'use client';

import { useCallback } from 'react';
import { ThreeColumnLayout } from '@/components/layout/ThreeColumnLayout';
import { useConversations } from '@/hooks/useConversations';
import { useThread } from '@/hooks/useThread';

export default function HomePage() {
  const {
    agents,
    channels,
    conversations,
    selectAgent,
    selectChannel,
    isLoading: isLoadingConversations,
  } = useConversations();

  const {
    thread,
    messages,
    isLoading: isLoadingThread,
    sendMessage,
    retryMessage,
    selectThread,
  } = useThread();

  const handleAgentSelect = useCallback((agentId: string) => {
    selectAgent(agentId);
  }, [selectAgent]);

  const handleChannelSelect = useCallback((channelId: string) => {
    selectChannel(channelId);
  }, [selectChannel]);

  const handleThreadSelect = useCallback((threadId: string) => {
    selectThread(threadId);
  }, [selectThread]);

  const handleSendMessage = useCallback((content: string) => {
    sendMessage(content);
  }, [sendMessage]);

  const handleRetryMessage = useCallback((messageId: string) => {
    retryMessage(messageId);
  }, [retryMessage]);

  return (
    <main className="h-screen w-screen overflow-hidden">
      <ThreeColumnLayout
        serverName="LeChat Server"
        serverStatus="connected"
        agents={agents}
        channels={channels}
        currentUser="You"
        conversationTitle="Direct Messages"
        threads={conversations.map(conv => ({
          id: conv.id,
          title: conv.title,
          lastMessage: conv.lastMessage || '',
          timestamp: conv.timestamp,
          unread: conv.unread,
        }))}
        threadTitle={thread?.title}
        threadTopic={thread?.topic}
        messages={messages}
        isLoadingMessages={isLoadingThread || isLoadingConversations}
        onAgentSelect={handleAgentSelect}
        onChannelSelect={handleChannelSelect}
        onThreadSelect={handleThreadSelect}
        onSendMessage={handleSendMessage}
        onRetryMessage={handleRetryMessage}
      />
    </main>
  );
}
