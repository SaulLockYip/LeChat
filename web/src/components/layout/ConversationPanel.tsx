'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
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
  otherAgentId?: string;
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
  selectedThreadType?: 'dm' | 'channel';
  onThreadSelect?: (threadId: string) => void;
  onDeleteConversation?: (conversationId: string, conversationTitle: string) => void;
  onOpenGroupSettings?: () => void;
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
  selectedThreadType,
  onThreadSelect,
  onDeleteConversation,
  onOpenGroupSettings,
  dmExpanded: dmExpandedProp = true,
  groupExpanded: groupExpandedProp = true,
  onDmExpandToggle,
  onGroupExpandToggle,
}: ConversationPanelProps) {
  const [dmExpanded, setDmExpanded] = useState(dmExpandedProp);
  const [groupExpanded, setGroupExpanded] = useState(groupExpandedProp);
  const [dmAgentFilter, setDmAgentFilter] = useState<string | null>(null);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
    return dmThreads.filter(t => t.agentId === dmAgentFilter || t.otherAgentId === dmAgentFilter);
  }, [dmThreads, dmAgentFilter]);

  // Filter group threads by search query
  const filteredGroupThreads = useMemo(() => {
    if (!groupSearchQuery.trim()) return groupThreads;
    const query = groupSearchQuery.toLowerCase();
    return groupThreads.filter(t => t.title.toLowerCase().includes(query));
  }, [groupThreads, groupSearchQuery]);

  const hasThreads = dmThreads.length > 0 || groupThreads.length > 0;

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMenuClick = useCallback((e: React.MouseEvent, threadId: string) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === threadId ? null : threadId);
  }, [openMenuId]);

  const handleDeleteClick = useCallback((thread: ThreadPreview) => {
    setOpenMenuId(null);
    onDeleteConversation?.(thread.id, thread.title);
  }, [onDeleteConversation]);

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
          <button
            onClick={onOpenGroupSettings}
            disabled={selectedThreadType !== 'channel'}
            className={`
              w-8 h-8 rounded-lg
              flex items-center justify-center
              transition-all
              ${selectedThreadType === 'channel'
                ? 'bg-[#e0e5ec] shadow-[-2px_-2px_4px_rgba(255,255,255,0.8),2px_2px 4px rgba(0,0,0,0.1)] hover:shadow-[-1px_-1px 2px rgba(255,255,255,0.9),1px_1px 2px rgba(0,0,0,0.08)] active:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1)]'
                : 'bg-[#e0e5ec]/50 cursor-not-allowed'
              }
            `}
            title={selectedThreadType === 'channel' ? 'Group Settings' : 'Select a group to access settings'}
            aria-label={selectedThreadType === 'channel' ? 'Open group settings' : 'Select a group conversation to access settings'}
          >
            <svg className={`w-4 h-4 ${selectedThreadType === 'channel' ? 'text-[#5a6270]' : 'text-[#9ca3af]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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
                        onDelete={() => handleDeleteClick(thread)}
                        isMenuOpen={openMenuId === thread.id}
                        onMenuClick={(e) => handleMenuClick(e, thread.id)}
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
  onDelete,
  isMenuOpen,
  onMenuClick,
}: {
  thread: ThreadPreview;
  isSelected: boolean;
  onSelect: () => void;
  onDelete?: () => void;
  isMenuOpen?: boolean;
  onMenuClick?: (e: React.MouseEvent) => void;
}) {
  const isGroup = thread.type === 'channel';

  // For DM: title is "Agent A <=> Agent B", split to get both names
  const dmAgents = !isGroup ? thread.title.split(' <=> ') : [];

  return (
    <button
      onClick={onSelect}
      className={`
        w-full px-4 py-3 rounded-2xl text-left
        transition-all duration-200
        ${isSelected
          ? 'bg-gradient-to-br from-[#e0e5ec] to-[#d5dae2] shadow-[inset_2px_2px_6px_rgba(0,0,0,0.06),inset_-2px_-2px_6px_rgba(255,255,255,0.8)] border-l-2 border-[#ff4757]'
          : 'bg-[#e8ebf0] hover:from-[#e4e9f0] hover:to-[#e0e5ec] shadow-[-3px_-3px_6px_rgba(255,255,255,0.7),3px_3px 6px_rgba(0,0,0,0.05)] hover:shadow-[-4px_-4px_8px_rgba(255,255,255,0.8),4px_4px 8px_rgba(0,0,0,0.06)]'
        }
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {thread.unread && (
            <span className="w-2 h-2 rounded-full bg-[#ff4757] flex-shrink-0" />
          )}

          {isGroup ? (
            // Group layout: single line with group icon
            <div className="flex items-center gap-2">
              <span className="text-sm">👥</span>
              <h4 className={`text-sm font-medium break-words ${isSelected ? 'text-[#374151]' : 'text-[#5a6270]'}`}>
                {thread.title}
              </h4>
            </div>
          ) : (
            // DM layout: two agent names stacked with arrow
            <div className="flex flex-col gap-0.5">
              <span className={`text-sm font-medium ${isSelected ? 'text-[#374151]' : 'text-[#5a6270]'}`}>
                {dmAgents[0] || thread.title}
              </span>
              <div className="flex items-center gap-1.5">
                <svg className="w-3 h-3 text-[#8b9298]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                <span className={`text-sm ${isSelected ? 'text-[#5a6270]' : 'text-[#8b9298]'}`}>
                  {dmAgents[1] || ''}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-[#8b9298]">
            {formatTimestamp(thread.timestamp)}
          </span>
          {/* Settings button for groups */}
          {isGroup && onDelete && (
            <div className="relative">
              <button
                onClick={onMenuClick}
                className="
                  w-6 h-6 rounded-lg
                  flex items-center justify-center
                  hover:bg-[#d5dae2]
                  transition-colors
                "
                aria-label="Group settings"
              >
                <svg className="w-4 h-4 text-[#8b9298]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
              {/* Dropdown menu */}
              {isMenuOpen && (
                <div
                  className="
                    absolute right-0 top-full mt-1
                    w-48 rounded-xl
                    bg-[#e8ebf0]
                    shadow-[-4px_-4px_8px_rgba(255,255,255,0.8),4px_4px 8px_rgba(0,0,0,0.15)]
                    border border-[#d5dae2]
                    overflow-hidden
                    z-50
                  "
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                    className="
                      w-full px-4 py-3
                      flex items-center gap-3
                      text-left text-sm text-[#ff4757]
                      hover:bg-red-50
                      transition-colors
                    "
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete group
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
