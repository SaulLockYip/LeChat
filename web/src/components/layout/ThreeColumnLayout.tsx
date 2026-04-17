'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { ConversationPanel } from './ConversationPanel';
import { ThreadPanel } from './ThreadPanel';

type Column = 'sidebar' | 'conversations' | 'thread';

interface ThreeColumnLayoutProps {
  serverName?: string;
  serverStatus?: 'connected' | 'connecting' | 'disconnected';
  agents?: Array<{
    id: string;
    name: string;
    status: 'online' | 'offline' | 'busy';
    unread?: number;
  }>;
  channels?: Array<{
    id: string;
    name: string;
    unread?: number;
  }>;
  currentUser?: string;
  conversationTitle?: string;
  conversationSubtitle?: string;
  threads?: Array<{
    id: string;
    title: string;
    lastMessage: string;
    timestamp: string;
    unread?: boolean;
    agentName?: string;
    agentStatus?: 'online' | 'offline' | 'busy';
  }>;
  threadTitle?: string;
  threadTopic?: string;
  messages?: Array<{
    id: string;
    content: string;
    sender: 'user' | 'agent';
    senderName?: string;
    timestamp: string;
    status?: 'sending' | 'sent' | 'error';
  }>;
  isLoadingMessages?: boolean;
  onAgentSelect?: (agentId: string) => void;
  onChannelSelect?: (channelId: string) => void;
  onThreadSelect?: (threadId: string) => void;
  onSendMessage?: (content: string) => void;
  onRetryMessage?: (messageId: string) => void;
}

export function ThreeColumnLayout({
  serverName,
  serverStatus,
  agents = [],
  channels = [],
  currentUser,
  conversationTitle,
  conversationSubtitle,
  threads = [],
  threadTitle,
  threadTopic,
  messages = [],
  isLoadingMessages = false,
  onAgentSelect,
  onChannelSelect,
  onThreadSelect,
  onSendMessage,
  onRetryMessage,
}: ThreeColumnLayoutProps) {
  const [mobileColumn, setMobileColumn] = useState<Column>('sidebar');
  const [selectedAgentId, setSelectedAgentId] = useState<string>();
  const [selectedChannelId, setSelectedChannelId] = useState<string>();
  const [selectedThreadId, setSelectedThreadId] = useState<string>();

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setMobileColumn('sidebar');
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleAgentSelect = (agentId: string) => {
    setSelectedAgentId(agentId);
    setSelectedChannelId(undefined);
    setSelectedThreadId(undefined);
    onAgentSelect?.(agentId);
  };

  const handleChannelSelect = (channelId: string) => {
    setSelectedChannelId(channelId);
    setSelectedAgentId(undefined);
    setSelectedThreadId(undefined);
    onChannelSelect?.(channelId);
  };

  const handleThreadSelect = (threadId: string) => {
    setSelectedThreadId(threadId);
    onThreadSelect?.(threadId);
  };

  const selectedId = selectedAgentId || selectedChannelId;

  // Mobile navigation handlers
  const goToConversations = () => setMobileColumn('conversations');
  const goToSidebar = () => setMobileColumn('sidebar');
  const goToThread = () => setMobileColumn('thread');

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#e0e5ec]">
      {/* Mobile Navigation */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-[#d5dae2] shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
        <div className="flex items-center h-12 px-4">
          {mobileColumn === 'conversations' && (
            <button
              onClick={goToSidebar}
              className="w-8 h-8 rounded-lg bg-[#e0e5ec] shadow-[-2px_-2px_4px_rgba(255,255,255,0.7),2px_2px_4px_rgba(0,0,0,0.1)] flex items-center justify-center"
            >
              <svg className="w-4 h-4 text-[#5a6270]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          {mobileColumn === 'thread' && (
            <button
              onClick={goToConversations}
              className="w-8 h-8 rounded-lg bg-[#e0e5ec] shadow-[-2px_-2px_4px_rgba(255,255,255,0.7),2px_2px_4px_rgba(0,0,0,0.1)] flex items-center justify-center"
            >
              <svg className="w-4 h-4 text-[#5a6270]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div className="flex-1 text-center">
            <span className="text-sm font-semibold text-[#374151]">
              {mobileColumn === 'sidebar' && 'LeChat'}
              {mobileColumn === 'conversations' && (conversationTitle || 'Conversations')}
              {mobileColumn === 'thread' && (threadTitle || 'Thread')}
            </span>
          </div>
          <div className="w-8" /> {/* Spacer for centering */}
        </div>
      </div>

      {/* Three Column Layout */}
      <div className="flex h-full pt-12 md:pt-0">
        {/* Sidebar Column */}
        <div
          className={`
            ${mobileColumn === 'sidebar' ? 'translate-x-0' : '-translate-x-full'}
            md:translate-x-0 md:flex-shrink-0
            transition-transform duration-300 ease-out
            absolute md:relative
            inset-y-0 left-0
            z-40 md:z-auto
          `}
        >
          <Sidebar
            serverName={serverName}
            serverStatus={serverStatus}
            agents={agents}
            channels={channels}
            currentUser={currentUser}
            onAgentSelect={handleAgentSelect}
            onChannelSelect={handleChannelSelect}
            selectedId={selectedId}
          />
        </div>

        {/* Overlay for mobile */}
        {mobileColumn !== 'sidebar' && (
          <div
            className="md:hidden fixed inset-0 bg-black/20 z-30"
            onClick={goToSidebar}
            onKeyDown={(e) => {
              if (e.key === 'Escape' || e.key === 'Enter') {
                goToSidebar();
              }
            }}
            tabIndex={0}
            role="button"
            aria-label="Close sidebar"
          />
        )}

        {/* Conversation Panel Column */}
        <div
          className={`
            ${mobileColumn === 'conversations' ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
            md:flex-shrink-0
            transition-transform duration-300 ease-out
            absolute md:relative
            inset-y-0 right-0
            z-30 md:z-auto
          `}
        >
          <ConversationPanel
            title={conversationTitle}
            subtitle={conversationSubtitle}
            threads={threads}
            selectedThreadId={selectedThreadId}
            onThreadSelect={handleThreadSelect}
          />
        </div>

        {/* Thread Panel Column */}
        <div
          className={`
            flex-1
            ${mobileColumn === 'thread' ? 'translate-x-0' : 'translate-x-full'}
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
