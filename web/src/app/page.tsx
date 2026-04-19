'use client';

import { useCallback, useState, useEffect } from 'react';
import { ThreeColumnLayout } from '@/components/layout/ThreeColumnLayout';
import { TokenInputModal } from '@/components/ui';
import { useConversations } from '@/hooks/useConversations';
import { useThread } from '@/hooks/useThread';
import { useThreads } from '@/hooks/useThreads';
import { useSSE } from '@/hooks/useSSE';

export default function HomePage() {
  const {
    conversations,
  } = useConversations();

  const {
    threads,
    selectedThreadId,
    isLoading: isLoadingThreads,
    selectThread: selectThreadInThreads,
    fetchThreadsForConversation,
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
  const [hasToken, setHasToken] = useState<boolean | null>(null);

  // Extract token from URL hash on mount and store in localStorage
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#token=')) {
      const token = hash.slice(7); // Remove '#token='
      localStorage.setItem('token', token);
      window.location.hash = '';
      setHasToken(true);
      return;
    }

    // Check if token exists in localStorage
    const storedToken = localStorage.getItem('token');
    setHasToken(storedToken !== null && storedToken.length > 0);
  }, []);

  // Get token for SSE connection
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const sseUrl = token ? `/api/events?token=${token}` : undefined;

  // Handle manual token submission
  const handleTokenSubmit = useCallback((newToken: string) => {
    localStorage.setItem('token', newToken);
    setHasToken(true);
  }, []);

  // Show loading state while checking for token
  if (hasToken === null) {
    return (
      <main className="h-screen w-screen overflow-hidden bg-[#e0e5ec] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-[3px] border-[#8b9298] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#8b9298]">Loading...</p>
        </div>
      </main>
    );
  }

  // Show token input modal if no token found
  if (!hasToken) {
    return (
      <main className="h-screen w-screen overflow-hidden bg-[#e0e5ec]">
        <TokenInputModal onTokenSubmit={handleTokenSubmit} />
      </main>
    );
  }

  // Connect to SSE for real-time updates
  const { status: sseStatus } = useSSE({
    url: sseUrl,
    autoConnect: true,
    onMessage: (message) => {
      // The actual event type is in message.data.type since SSE uses default 'message' type
      const eventData = message.data as { type?: string; thread_id?: string; conv_id?: string };
      if (eventData?.type === 'new_message') {
        // Update messages if the message is for the currently selected thread
        if (selectedThreadId && eventData?.thread_id === selectedThreadId) {
          // Thread messages will be refreshed by the useThread hook
          // or we could manually fetch new messages here
        }
      } else if (eventData?.type === 'thread_updated') {
        // Refresh thread list to show latest message info
        if (selectedConversationId) {
          fetchThreadsForConversation(selectedConversationId);
        }
      }
    },
  });

  // When a conversation is selected, fetch its threads
  const handleConversationSelect = useCallback((conversationId: string) => {
    setSelectedConversationId(conversationId);
    fetchThreadsForConversation(conversationId);
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
        // Left column - conversations
        conversations={formattedConversations}
        selectedConversationId={selectedConversationId}
        onConversationSelect={handleConversationSelect}
        conversationTitle="Conversations"
        // Middle column - threads
        threads={threads}
        selectedThreadId={selectedThreadId || undefined}
        onThreadSelect={handleThreadSelect}
        isLoadingThreads={isLoadingThreads}
        // Right column - messages
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
