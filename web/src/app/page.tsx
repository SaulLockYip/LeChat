'use client';

import { useCallback, useState, useEffect } from 'react';
import { ThreeColumnLayout } from '@/components/layout/ThreeColumnLayout';
import { TokenInputModal, UserProfileModal, GroupSettingsModal, DeleteConversationModal } from '@/components/ui';
import { useConversations } from '@/hooks/useConversations';
import { useThread } from '@/hooks/useThread';
import { useThreads } from '@/hooks/useThreads';
import { useSSE } from '@/hooks/useSSE';
import { api } from '@/lib/api';

function AppContent() {
  const {
    conversations,
    agents,
  } = useConversations();

  const {
    threads,
    selectedThreadId,
    isLoading: isLoadingThreads,
    selectThread: selectThreadInThreads,
    fetchThreadsForConversation,
    updateThreadTimestamp,
    updateThread,
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
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showGroupSettingsModal, setShowGroupSettingsModal] = useState(false);
  const [deleteModalState, setDeleteModalState] = useState<{ isOpen: boolean; conversationId: string; conversationTitle: string; conversationType: 'dm' | 'channel' }>({
    isOpen: false,
    conversationId: '',
    conversationTitle: '',
    conversationType: 'channel',
  });
  const [currentUserName, setCurrentUserName] = useState<string>('User');
  const [currentUserTitle, setCurrentUserTitle] = useState<string>('');

  // Fetch user profile on mount
  useEffect(() => {
    const fetchUserProfile = async () => {
      const result = await api.getUserInfo();
      if (result.success && result.data) {
        setCurrentUserName(result.data.name);
        setCurrentUserTitle(result.data.title);
      }
    };
    fetchUserProfile();
  }, []);

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
        // Only refresh if the message's thread_id matches the currently selected thread
        if (selectedThreadId && eventData.thread_id === selectedThreadId) {
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

  // Get selected conversation info for group settings
  const selectedConversation = conversations.find(c => c.id === selectedConversationId);
  const selectedConversationType = selectedConversation?.type;
  const selectedConversationAgentIds = selectedConversation?.agentId ? [selectedConversation.agentId] : [];

  // Handle group settings update
  const handleGroupUpdate = useCallback(async (data: { group_name?: string; add_agent_ids?: string[]; remove_agent_ids?: string[] }) => {
    if (!selectedConversationId) return;
    await api.updateConversation(selectedConversationId, data);
  }, [selectedConversationId]);

  // Handle delete conversation request from conversation list
  const handleDeleteConversation = useCallback((conversationId: string, conversationTitle: string) => {
    const conversation = conversations.find(c => c.id === conversationId);
    setDeleteModalState({
      isOpen: true,
      conversationId,
      conversationTitle,
      conversationType: conversation?.type || 'channel',
    });
  }, [conversations]);

  // Handle confirm delete from modal
  const handleConfirmDelete = useCallback(async () => {
    if (!deleteModalState.conversationId) return;
    await api.deleteConversation(deleteModalState.conversationId);
    // Close modal and refresh
    setDeleteModalState(prev => ({ ...prev, isOpen: false }));
    window.location.reload();
  }, [deleteModalState.conversationId]);

  // Handle cancel delete from modal
  const handleCancelDelete = useCallback(() => {
    setDeleteModalState(prev => ({ ...prev, isOpen: false }));
  }, []);

  // Format conversations for ThreeColumnLayout
  const formattedConversations = conversations.map(conv => ({
    id: conv.id,
    title: conv.title,
    type: conv.type,
    lastMessage: conv.lastMessage,
    timestamp: conv.timestamp,
    unread: conv.unread,
    agentId: conv.otherAgentId || conv.agentId,
    otherAgentId: conv.agentId,
  }));

  return (
    <main className="h-screen w-screen overflow-hidden">
      <ThreeColumnLayout
        conversations={formattedConversations}
        selectedConversationId={selectedConversationId}
        selectedConversationType={selectedConversationType}
        onConversationSelect={handleConversationSelect}
        onDeleteConversation={handleDeleteConversation}
        conversationTitle="Conversations"
        agents={agents}
        threads={threads}
        selectedThreadId={selectedThreadId || undefined}
        onThreadSelect={handleThreadSelect}
        onUpdateThread={updateThread}
        isLoadingThreads={isLoadingThreads}
        threadTitle={thread?.title}
        threadTopic={thread?.topic}
        messages={messages}
        isLoadingMessages={isLoadingMessages}
        onSendMessage={handleSendMessage}
        onRetryMessage={handleRetryMessage}
        currentUserName={currentUserName}
        currentUserTitle={currentUserTitle}
        onOpenProfile={() => setShowProfileModal(true)}
        onOpenGroupSettings={() => setShowGroupSettingsModal(true)}
      />
      <UserProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onProfileUpdate={(profile) => {
          setCurrentUserName(profile.name);
          setCurrentUserTitle(profile.title);
        }}
      />
      <GroupSettingsModal
        isOpen={showGroupSettingsModal}
        onClose={() => setShowGroupSettingsModal(false)}
        conversationId={selectedConversationId || ''}
        groupName={selectedConversation?.title || ''}
        currentAgentIds={selectedConversationAgentIds}
        availableAgents={agents}
        onUpdate={handleGroupUpdate}
        onDeleteConversation={handleDeleteConversation}
      />
      <DeleteConversationModal
        isOpen={deleteModalState.isOpen}
        conversationTitle={deleteModalState.conversationTitle}
        conversationType={deleteModalState.conversationType}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
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
