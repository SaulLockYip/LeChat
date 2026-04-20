'use client';

import { useCallback, useState, useEffect } from 'react';
import { ThreeColumnLayout } from '@/components/layout/ThreeColumnLayout';
import { TokenInputModal } from '@/components/ui';
import { useConversations } from '@/hooks/useConversations';
import { useThread } from '@/hooks/useThread';
import { useThreads } from '@/hooks/useThreads';
import { useSSE } from '@/hooks/useSSE';

function AppContent() {
  const {
    conversations,
  } = useConversations();

  const {
    threads,
    selectedThreadId,
    isLoading: isLoadingThreads,
    selectThread: selectThreadInThreads,
    fetchThreadsForConversation,
    updateThreadTimestamp,
  } = useThreads();

  const {
    thread,
    messages,
    isLoading: isLoadingMessages,
    sendMessage,
    retryMessage,
    selectThread: selectThreadInThread,
  } = useThread();

  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>();

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const sseUrl = token ? `/api/events?token=${token}` : undefined;

  // Connect to SSE for real-time updates
  const { status: sseStatus } = useSSE({
    url: sseUrl,
    autoConnect: true,
    onMessage: (message) => {
      const eventData = message.data as { type?: string; thread_id?: string; conv_id?: string; latest_message_at?: string };
      if (eventData?.type === 'thread_updated') {
        // Update thread timestamp directly from SSE event (avoids re-fetch)
        if (eventData.thread_id && eventData.latest_message_at) {
          updateThreadTimestamp(eventData.thread_id, eventData.latest_message_at);
        }
      } else if (eventData?.type === 'new_message') {
        // Refresh messages for the current thread when a new message arrives
        if (selectedThreadId) {
          selectThreadInThread(selectedThreadId);
        }
      }
    },
  });

  // Fetch threads when a conversation is selected - pass token explicitly
  const handleConversationSelect = useCallback((conversationId: string) => {
    setSelectedConversationId(conversationId);
    const token = localStorage.getItem('token');
    if (token) {
      fetchThreadsForConversation(conversationId, token);
    }
  }, [fetchThreadsForConversation]);

  // When a thread is selected, fetch its messages
  const handleThreadSelect = useCallback((threadId: string) => {
    selectThreadInThreads(threadId);
    selectThreadInThread(threadId);
  }, [selectThreadInThreads, selectThreadInThread]);

  const handleSendMessage = useCallback((content: string) => {
    sendMessage(content);
  }, [sendMessage]);

  const handleRetryMessage = useCallback((messageId: string) => {
    retryMessage(messageId);
  }, [retryMessage]);

  // Format conversations for ThreeColumnLayout
  const formattedConversations = conversations.map(conv => ({
    id: conv.id,
    title: conv.title,
    type: conv.type,
    lastMessage: conv.lastMessage,
    timestamp: conv.timestamp,
    unread: conv.unread,
  }));

  return (
    <main className="h-screen w-screen overflow-hidden">
      <ThreeColumnLayout
        conversations={formattedConversations}
        selectedConversationId={selectedConversationId}
        onConversationSelect={handleConversationSelect}
        conversationTitle="Conversations"
        threads={threads}
        selectedThreadId={selectedThreadId || undefined}
        onThreadSelect={handleThreadSelect}
        isLoadingThreads={isLoadingThreads}
        threadTitle={thread?.title}
        threadTopic={thread?.topic}
        messages={messages}
        isLoadingMessages={isLoadingMessages}
        onSendMessage={handleSendMessage}
        onRetryMessage={handleRetryMessage}
      />
    </main>
  );
}

function LoadingState() {
  return (
    <main className="h-screen w-screen overflow-hidden bg-[#e0e5ec] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-[3px] border-[#8b9298] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[#8b9298]">Loading...</p>
      </div>
    </main>
  );
}

export default function HomePage() {
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [tokenValue, setTokenValue] = useState<string | null>(null);

  // Extract token from URL hash on mount and store in localStorage
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#token=')) {
      const token = hash.slice(7);
      localStorage.setItem('token', token);
      window.location.hash = '';
      setTokenValue(token);
      setHasToken(true);
      return;
    }

    const storedToken = localStorage.getItem('token');
    if (storedToken && storedToken.length > 0) {
      setTokenValue(storedToken);
      setHasToken(true);
    } else {
      setHasToken(false);
    }
  }, []);

  const handleTokenSubmit = useCallback((newToken: string) => {
    localStorage.setItem('token', newToken);
    setTokenValue(newToken);
    setHasToken(true);
  }, []);

  if (hasToken === null) {
    return <LoadingState />;
  }

  if (!hasToken) {
    return (
      <main className="h-screen w-screen overflow-hidden bg-[#e0e5ec]">
        <TokenInputModal onTokenSubmit={handleTokenSubmit} />
      </main>
    );
  }

  return <AppContent />;
}
