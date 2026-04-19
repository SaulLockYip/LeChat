'use client';

import { useState, useEffect } from 'react';
import { ConversationPanel } from './ConversationPanel';
import { ThreadPanel } from './ThreadPanel';
import { ThreadList } from '@/components/features/ThreadList';

type Column = 'conversations' | 'threads' | 'messages';

interface ThreadPreview {
  id: string;
  title: string;
  lastMessage?: string;
  timestamp: string;
  unread?: boolean;
  agentName?: string;
  agentStatus?: 'online' | 'offline' | 'busy';
}

interface ConversationPreview {
  id: string;
  title: string;
  type: 'dm' | 'channel';
  lastMessage?: string;
  timestamp: string;
  unread?: boolean;
}

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'agent';
  senderName?: string;
  timestamp: string;
  status?: 'sending' | 'sent' | 'error';
}

interface Agent {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'busy';
}

interface ThreeColumnLayoutProps {
  // Left column - conversations
  conversations?: ConversationPreview[];
  selectedConversationId?: string;
  onConversationSelect?: (conversationId: string) => void;
  conversationTitle?: string;
  agents?: Agent[];

  // Middle column - threads
  threads?: ThreadPreview[];
  selectedThreadId?: string;
  onThreadSelect?: (threadId: string) => void;
  isLoadingThreads?: boolean;

  // Right column - messages
  threadTitle?: string;
  threadTopic?: string;
  messages?: Message[];
  isLoadingMessages?: boolean;
  onSendMessage?: (content: string) => void;
  onRetryMessage?: (messageId: string) => void;
}

export function ThreeColumnLayout({
  conversations = [],
  selectedConversationId,
  onConversationSelect,
  conversationTitle = 'Conversations',
  agents = [],
  threads = [],
  selectedThreadId,
  onThreadSelect,
  isLoadingThreads = false,
  threadTitle,
  threadTopic,
  messages = [],
  isLoadingMessages = false,
  onSendMessage,
  onRetryMessage,
}: ThreeColumnLayoutProps) {
  const [mobileColumn, setMobileColumn] = useState<Column>('conversations');

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setMobileColumn('conversations');
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleConversationSelect = (conversationId: string) => {
    onConversationSelect?.(conversationId);
  };

  const handleThreadSelect = (threadId: string) => {
    onThreadSelect?.(threadId);
  };

  // Mobile navigation handlers
  const goToConversations = () => setMobileColumn('conversations');
  const goToThreads = () => setMobileColumn('threads');
  const goToMessages = () => setMobileColumn('messages');

  // Convert conversations to the format expected by ConversationPanel (threads prop)
  const conversationThreads = conversations.map(conv => ({
    id: conv.id,
    title: conv.title,
    type: conv.type,
    lastMessage: conv.lastMessage || '',
    timestamp: conv.timestamp,
    unread: conv.unread,
    agentName: conv.type === 'dm' ? conv.title.split(' <=> ')[0] : undefined,
  }));

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#e0e5ec]">
      {/* Mobile Navigation */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-[#d5dae2] shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
        <div className="flex items-center h-12 px-4">
          {mobileColumn === 'threads' && (
            <button
              onClick={goToConversations}
              className="w-8 h-8 rounded-lg bg-[#e0e5ec] shadow-[-2px_-2px_4px_rgba(255,255,255,0.7),2px_2px_4px_rgba(0,0,0,0.1)] flex items-center justify-center"
            >
              <svg className="w-4 h-4 text-[#5a6270]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          {mobileColumn === 'messages' && (
            <button
              onClick={goToThreads}
              className="w-8 h-8 rounded-lg bg-[#e0e5ec] shadow-[-2px_-2px_4px_rgba(255,255,255,0.7),2px_2px 4px rgba(0,0,0,0.1)] flex items-center justify-center"
            >
              <svg className="w-4 h-4 text-[#5a6270]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div className="flex-1 text-center">
            <span className="text-sm font-semibold text-[#374151]">
              {mobileColumn === 'conversations' && conversationTitle}
              {mobileColumn === 'threads' && 'Threads'}
              {mobileColumn === 'messages' && (threadTitle || 'Messages')}
            </span>
          </div>
          <div className="w-8" /> {/* Spacer for centering */}
        </div>
      </div>

      {/* Three Column Layout */}
      <div className="flex h-full pt-12 md:pt-0">
        {/* Left Column - Conversations */}
        <div
          className={`
            ${mobileColumn === 'conversations' ? 'translate-x-0' : '-translate-x-full'}
            md:translate-x-0 md:flex-shrink-0
            transition-transform duration-300 ease-out
            absolute md:relative
            inset-y-0 left-0
            z-40 md:z-auto
          `}
        >
          <ConversationPanel
            title={conversationTitle}
            threads={conversationThreads}
            agents={agents}
            selectedThreadId={selectedConversationId}
            onThreadSelect={handleConversationSelect}
          />
        </div>

        {/* Overlay for mobile */}
        {mobileColumn !== 'conversations' && (
          <div
            className="md:hidden fixed inset-0 bg-black/20 z-30"
            onClick={goToConversations}
            onKeyDown={(e) => {
              if (e.key === 'Escape' || e.key === 'Enter') {
                goToConversations();
              }
            }}
            tabIndex={0}
            role="button"
            aria-label="Close conversations"
          />
        )}

        {/* Middle Column - Threads */}
        <div
          className={`
            ${mobileColumn === 'threads' ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
            md:flex-shrink-0
            transition-transform duration-300 ease-out
            absolute md:relative
            inset-y-0 right-0
            z-30 md:z-auto
          `}
        >
          {/* Thread List Panel */}
          <div className="
            w-[320px] h-full
            bg-[#e8ebf0]
            shadow-[-4px_0_12px_rgba(0,0,0,0.08)]
            flex flex-col
            overflow-hidden
          ">
            {/* Header */}
            <div className="
              p-4
              bg-[#e0e5ec]
              shadow-[-4px_-4px_8px_rgba(255,255,255,0.7),4px_4px_8px_rgba(0,0,0,0.08)]
            ">
              <h2 className="font-semibold text-[#374151] text-base">Threads</h2>
            </div>

            {/* Thread List */}
            <div className="flex-1 overflow-y-auto p-3">
              {isLoadingThreads ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <div className="w-8 h-8 border-2 border-[#8b9298] border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-[#8b9298] mt-2">Loading threads...</p>
                </div>
              ) : (
                <ThreadList
                  threads={threads.map(t => ({ ...t, lastMessage: t.lastMessage || '' }))}
                  selectedThreadId={selectedThreadId}
                  onSelect={handleThreadSelect}
                />
              )}
            </div>
          </div>
        </div>

        {/* Overlay for mobile */}
        {mobileColumn === 'messages' && (
          <div
            className="md:hidden fixed inset-0 bg-black/20 z-20"
            onClick={goToThreads}
            onKeyDown={(e) => {
              if (e.key === 'Escape' || e.key === 'Enter') {
                goToThreads();
              }
            }}
            tabIndex={0}
            role="button"
            aria-label="Close threads"
          />
        )}

        {/* Right Column - Messages */}
        <div
          className={`
            flex-1
            ${mobileColumn === 'messages' ? 'translate-x-0' : 'translate-x-full'}
            md:translate-x-0
            transition-transform duration-300 ease-out
            absolute md:relative
            inset-0 md:inset-auto
            z-20 md:z-auto
          `}
        >
          <ThreadPanel
            threadTitle={threadTitle}
            threadTopic={threadTopic}
            messages={messages}
            isLoading={isLoadingMessages}
            onSendMessage={onSendMessage}
            onRetryMessage={onRetryMessage}
          />
        </div>
      </div>
    </div>
  );
}
