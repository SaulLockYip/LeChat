'use client';

import { useState, useMemo } from 'react';
import { LEDIndicator } from '@/components/ui/LEDIndicator';

export interface ThreadPreview {
  id: string;
  title: string;
  type?: 'dm' | 'channel';
  lastMessage: string;
  timestamp: string;
  unread?: boolean;
  agentName?: string;
  agentStatus?: 'online' | 'offline' | 'busy';
  agentId?: string;
}

export interface Agent {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'busy';
}

interface ConversationPanelProps {
  title?: string;
  subtitle?: string;
  threads?: ThreadPreview[];
  agents?: Agent[];
  selectedThreadId?: string;
  onThreadSelect?: (threadId: string) => void;
  dmExpanded?: boolean;
  groupExpanded?: boolean;
  onDmExpandToggle?: () => void;
  onGroupExpandToggle?: () => void;
}

// Separate conversations into DM and Group
function separateConversations(threads: ThreadPreview[]) {
  const dmThreads = threads.filter(t => t.type === 'dm');
  const groupThreads = threads.filter(t => t.type === 'channel');
  return { dmThreads, groupThreads };
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

// Chevron icon for expand/collapse
function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-[#8b9298] transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function ConversationPanel({
  title = 'Conversation',
  subtitle,
  threads = [],
  agents = [],
  selectedThreadId,
  onThreadSelect,
  dmExpanded: dmExpandedProp = true,
  groupExpanded: groupExpandedProp = true,
  onDmExpandToggle,
  onGroupExpandToggle,
}: ConversationPanelProps) {
  const [dmExpanded, setDmExpanded] = useState(dmExpandedProp);
  const [groupExpanded, setGroupExpanded] = useState(groupExpandedProp);
  const [dmAgentFilter, setDmAgentFilter] = useState<string | null>(null);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');

  // Handle prop-driven expand state changes
  const handleDmExpandToggle = () => {
    if (onDmExpandToggle) {
      onDmExpandToggle();
    } else {
      setDmExpanded(!dmExpanded);
    }
  };

  const handleGroupExpandToggle = () => {
    if (onGroupExpandToggle) {
      onGroupExpandToggle();
    } else {
      setGroupExpanded(!groupExpanded);
    }
  };

  const { dmThreads, groupThreads } = useMemo(() => separateConversations(threads), [threads]);

  // Filter DM threads by selected agent
  const filteredDmThreads = useMemo(() => {
    if (!dmAgentFilter) return dmThreads;
    return dmThreads.filter(t => t.agentId === dmAgentFilter);
  }, [dmThreads, dmAgentFilter]);

  // Filter group threads by search query
  const filteredGroupThreads = useMemo(() => {
    if (!groupSearchQuery.trim()) return groupThreads;
    const query = groupSearchQuery.toLowerCase();
    return groupThreads.filter(t => t.title.toLowerCase().includes(query));
  }, [groupThreads, groupSearchQuery]);

  const hasThreads = dmThreads.length > 0 || groupThreads.length > 0;

  return (
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
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <h2 className="font-semibold text-[#374151] text-base">{title}</h2>
            {subtitle && (
              <p className="text-xs text-[#8b9298] mt-0.5">{subtitle}</p>
            )}
          </div>
          <button className="w-8 h-8 rounded-lg bg-[#e0e5ec] shadow-[-2px_-2px_4px_rgba(255,255,255,0.8),2px_2px 4px rgba(0,0,0,0.1)] flex items-center justify-center hover:shadow-[-1px_-1px 2px rgba(255,255,255,0.9),1px_1px 2px rgba(0,0,0,0.08)] active:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1)] transition-all">
            <svg className="w-4 h-4 text-[#5a6270]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Thread List with Sections */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {!hasThreads ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <div className="w-16 h-16 rounded-full bg-[#e0e5ec] shadow-[-4px_-4px_8px_rgba(255,255,255,0.8),4px_4px_8px_rgba(0,0,0,0.1)] flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-[#8b9298]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-sm text-[#8b9298]">No threads yet</p>
            <p className="text-xs text-[#a0a8b2] mt-1">Start a conversation to see threads here</p>
          </div>
        ) : (
          <>
            {/* Direct Messages Section */}
            {dmThreads.length > 0 && (
              <div className="space-y-2">
                {/* Section Header with expand toggle and filter */}
                <div className="px-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDmExpandToggle}
                      className="flex items-center gap-2 flex-1 hover:text-[#374151] transition-colors"
                    >
                      <ChevronIcon expanded={dmExpanded} />
                      <svg className="w-4 h-4 text-[#8b9298]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <h3 className="text-xs font-semibold text-[#8b9298] uppercase tracking-wider">Direct Messages</h3>
                    </button>
                    {/* Agent Filter Dropdown */}
                    {agents.length > 0 && (
                      <select
                        value={dmAgentFilter || ''}
                        onChange={(e) => setDmAgentFilter(e.target.value || null)}
                        className="
                          text-xs px-2 py-1 rounded-lg
                          bg-[#e0e5ec]
                          shadow-[-2px_-2px_4px_rgba(255,255,255,0.8),2px_2px_4px_rgba(0,0,0,0.1)]
                          text-[#5a6270]
                          border-none
                          focus:outline-none focus:ring-1 focus:ring-[#ff4757]/30
                          cursor-pointer
                        "
                      >
                        <option value="">All Agents</option>
                        {agents.map(agent => (
                          <option key={agent.id} value={agent.id}>{agent.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* DM Thread List */}
                {dmExpanded && filteredDmThreads.length > 0 && (
                  <div className="space-y-1">
                    {filteredDmThreads.map((thread) => (
                      <ConversationItem
                        key={thread.id}
                        thread={thread}
                        isSelected={selectedThreadId === thread.id}
                        onSelect={() => onThreadSelect?.(thread.id)}
                      />
                    ))}
                  </div>
                )}
                {dmExpanded && filteredDmThreads.length === 0 && (
                  <p className="text-xs text-[#a0a8b2] px-2 py-1">No conversations with this agent</p>
                )}
              </div>
            )}

            {/* Groups Section */}
            {groupThreads.length > 0 && (
              <div className="space-y-2">
                {/* Section Header with expand toggle and search */}
                <div className="px-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleGroupExpandToggle}
                      className="flex items-center gap-2 flex-1 hover:text-[#374151] transition-colors"
                    >
                      <ChevronIcon expanded={groupExpanded} />
                      <svg className="w-4 h-4 text-[#8b9298]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <h3 className="text-xs font-semibold text-[#8b9298] uppercase tracking-wider">Groups</h3>
                    </button>
                  </div>
                  {/* Group Search Input */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search groups..."
                      value={groupSearchQuery}
                      onChange={(e) => setGroupSearchQuery(e.target.value)}
                      className="
                        w-full px-3 py-1.5 pr-8 rounded-lg text-xs
                        bg-[#e0e5ec]
                        shadow-[-2px_-2px_4px_rgba(255,255,255,0.8),2px_2px_4px_rgba(0,0,0,0.1)_inset]
                        text-[#374151] placeholder-[#9ca3af]
                        border-none
                        focus:outline-none focus:ring-1 focus:ring-[#ff4757]/30
                        transition-all duration-150
                      "
                    />
                    {groupSearchQuery && (
                      <button
                        onClick={() => setGroupSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-[#8b9298] hover:text-[#5a6270]"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Group Thread List */}
                {groupExpanded && filteredGroupThreads.length > 0 && (
                  <div className="space-y-1">
                    {filteredGroupThreads.map((thread) => (
                      <ConversationItem
                        key={thread.id}
                        thread={thread}
                        isSelected={selectedThreadId === thread.id}
                        onSelect={() => onThreadSelect?.(thread.id)}
                      />
                    ))}
                  </div>
                )}
                {groupExpanded && filteredGroupThreads.length === 0 && (
                  <p className="text-xs text-[#a0a8b2] px-2 py-1">No groups found</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Separate component for conversation item to keep code clean
function ConversationItem({
  thread,
  isSelected,
  onSelect,
}: {
  thread: ThreadPreview;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`
        w-full p-3 rounded-xl text-left
        transition-all duration-150
        ${isSelected
          ? 'bg-[#e0e5ec] shadow-[-4px_-4px_8px_rgba(255,255,255,0.8),4px 4px 8px_rgba(0,0,0,0.12)]'
          : 'bg-[#e8ebf0] shadow-[-2px_-2px_4px_rgba(255,255,255,0.7),2px_2px_4px_rgba(0,0,0,0.06)] hover:bg-[#e0e5ec]'
        }
      `}
    >
      <div className="flex items-start gap-3">
        {/* Agent Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-[#f0f2f5] shadow-[-2px_-2px_4px_rgba(255,255,255,0.8),2px_2px 4px rgba(0,0,0,0.1)] flex items-center justify-center">
            <span className="text-sm font-medium text-[#5a6270]">
              {thread.agentName?.charAt(0).toUpperCase() || '?'}
            </span>
          </div>
          {thread.agentStatus && (
            <LEDIndicator
              color={thread.agentStatus === 'online' ? 'green' : thread.agentStatus === 'busy' ? 'yellow' : 'off'}
              size="sm"
              className="absolute -bottom-0.5 -right-0.5"
            />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className={`text-sm truncate ${isSelected ? 'font-semibold text-[#374151]' : 'font-medium text-[#5a6270]'}`}>
              {thread.title}
            </h4>
            <span className="text-xs text-[#8b9298] flex-shrink-0">
              {formatTimestamp(thread.timestamp)}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {thread.unread && (
              <span className="w-2 h-2 rounded-full bg-[#ff4757] flex-shrink-0" />
            )}
            <p className="text-xs text-[#8b9298] truncate">
              {thread.lastMessage}
            </p>
          </div>
        </div>
      </div>
    </button>
  );
}
