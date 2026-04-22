'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { LEDIndicator } from '@/components/ui/LEDIndicator';

export interface ThreadPreview {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: string;
  unread?: boolean;
  agentName?: string;
  agentStatus?: 'online' | 'offline' | 'busy';
  status?: 'active' | 'closed';
}

interface ThreadListProps {
  threads?: ThreadPreview[];
  selectedThreadId?: string;
  onSelect?: (threadId: string) => void;
  onUpdateThread?: (threadId: string, data: { topic?: string; status?: 'active' | 'closed' }) => void;
  expanded?: boolean;
  onExpandToggle?: () => void;
  statusFilter?: 'all' | 'active' | 'closed';
  onStatusFilterChange?: (filter: 'all' | 'active' | 'closed') => void;
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

export function ThreadList({
  threads = [],
  selectedThreadId,
  onSelect,
  onUpdateThread,
  expanded: expandedProp = true,
  onExpandToggle,
  statusFilter: statusFilterProp = 'all',
  onStatusFilterChange,
}: ThreadListProps) {
  const [expanded, setExpanded] = useState(expandedProp);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>(statusFilterProp);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editTopicValue, setEditTopicValue] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  const handleExpandToggle = () => {
    if (onExpandToggle) {
      onExpandToggle();
    } else {
      setExpanded(!expanded);
    }
  };

  const handleStatusFilterChange = (filter: 'all' | 'active' | 'closed') => {
    setStatusFilter(filter);
    onStatusFilterChange?.(filter);
  };

  // Filter threads by status and search query
  const filteredThreads = useMemo(() => {
    let result = threads;

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter(t => t.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(query));
    }

    return result;
  }, [threads, statusFilter, searchQuery]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpenId(null);
        setEditingThreadId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMenuToggle = (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpenId(menuOpenId === threadId ? null : threadId);
    setEditingThreadId(null);
  };

  const handleEditTopic = (thread: ThreadPreview, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingThreadId(thread.id);
    setEditTopicValue(thread.title);
    setMenuOpenId(null);
  };

  const handleSaveTopic = (threadId: string, e: React.KeyboardEvent | React.MouseEvent) => {
    e.stopPropagation();
    if (editTopicValue.trim() && onUpdateThread) {
      onUpdateThread(threadId, { topic: editTopicValue.trim() });
    }
    setEditingThreadId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, threadId: string) => {
    if (e.key === 'Enter') {
      handleSaveTopic(threadId, e);
    } else if (e.key === 'Escape') {
      setEditingThreadId(null);
    }
  };

  const handleToggleStatus = (thread: ThreadPreview, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onUpdateThread) {
      onUpdateThread(thread.id, { status: thread.status === 'closed' ? 'active' : 'closed' });
    }
    setMenuOpenId(null);
  };

  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <div className="w-16 h-16 rounded-full bg-[#e0e5ec] shadow-[-4px_-4px_8px_rgba(255,255,255,0.8),4px_4px_8px_rgba(0,0,0,0.1)] flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-[#8b9298]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <p className="text-sm text-[#8b9298]">No threads yet</p>
        <p className="text-xs text-[#a0a8b2] mt-1">Start a conversation to see threads here</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search by topic..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="
            w-full px-3 py-2 pr-8 rounded-lg text-sm
            bg-[#e0e5ec]
            shadow-[-2px_-2px_4px_rgba(255,255,255,0.8),2px_2px_4px_rgba(0,0,0,0.1)_inset]
            text-[#374151] placeholder-[#9ca3af]
            border-none
            focus:outline-none focus:ring-1 focus:ring-[#ff4757]/30
            transition-all duration-150
          "
        />
        {searchQuery ? (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-[#8b9298] hover:text-[#5a6270]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : (
          <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        )}
      </div>

      {/* Status Filter Pills */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-xs text-[#8b9298] uppercase tracking-wider font-semibold mr-1">Status:</span>
        {(['all', 'active', 'closed'] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => handleStatusFilterChange(filter)}
            className={`
              px-3 py-1 rounded-lg text-xs font-medium
              transition-all duration-150
              ${statusFilter === filter
                ? 'bg-[#ff4757] text-white shadow-[2px_2px_4px_rgba(166,50,60,0.3),-1px_-1px_2px_rgba(255,100,110,0.3)]'
                : 'bg-[#e0e5ec] text-[#5a6270] shadow-[-2px_-2px_4px_rgba(255,255,255,0.8),2px_2px_4px_rgba(0,0,0,0.1)] hover:shadow-[-1px_-1px_2px_rgba(255,255,255,0.9),1px_1px_2px_rgba(0,0,0,0.08)]'
              }
            `}
          >
            {filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        ))}
      </div>

      {/* Expand/Collapse Toggle */}
      <button
        onClick={handleExpandToggle}
        className="flex items-center gap-2 w-full px-1 py-1 text-xs text-[#8b9298] hover:text-[#5a6270] transition-colors"
      >
        <ChevronIcon expanded={expanded} />
        <span className="uppercase tracking-wider font-semibold">
          {expanded ? 'Hide' : 'Show'} Threads ({filteredThreads.length})
        </span>
      </button>

      {/* Thread Cards */}
      {expanded && (
        <div className="space-y-2">
          {filteredThreads.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-[#8b9298]">No threads match your filters</p>
            </div>
          ) : (
            filteredThreads.map((thread) => (
              <div
                key={thread.id}
                className={`
                  relative
                  w-full p-3 rounded-xl text-left
                  transition-all duration-150
                  ${selectedThreadId === thread.id
                    ? 'bg-[#e0e5ec] shadow-[-4px_-4px_8px_rgba(255,255,255,0.8),4px_4px 8px_rgba(0,0,0,0.12)]'
                    : 'bg-[#e8ebf0] shadow-[-2px_-2px_4px_rgba(255,255,255,0.7),2px_2px 4px_rgba(0,0,0,0.06)] hover:bg-[#e0e5ec]'
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

                  {/* Content - clickable area */}
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onSelect?.(thread.id)}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h4 className={`text-sm truncate ${selectedThreadId === thread.id ? 'font-semibold text-[#374151]' : 'font-medium text-[#5a6270]'}`}>
                          {thread.title}
                        </h4>
                        {/* Status Badge */}
                        {thread.status && (
                          <span className={`
                            px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider
                            ${thread.status === 'active'
                              ? 'bg-[#2ed573]/20 text-[#2ed573]'
                              : 'bg-[#8b9298]/20 text-[#8b9298]'
                            }
                          `}>
                            {thread.status}
                          </span>
                        )}
                      </div>
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

                  {/* Menu Button */}
                  {onUpdateThread && (
                    <button
                      type="button"
                      onClick={(e) => handleMenuToggle(thread.id, e)}
                      className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#e0e5ec] shadow-[-2px_-2px_4px_rgba(255,255,255,0.8),2px_2px 4px_rgba(0,0,0,0.08)] flex items-center justify-center hover:shadow-[-1px_-1px_2px_rgba(255,255,255,0.9),1px_1px 2px_rgba(0,0,0,0.06)] active:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1)] transition-all"
                    >
                      <svg className="w-4 h-4 text-[#5a6270]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Dropdown Menu */}
                {menuOpenId === thread.id && (
                  <div
                    className="absolute right-3 top-14 z-10 w-48 py-1 rounded-xl bg-[#e0e5ec] shadow-[-4px_-4px_8px_rgba(255,255,255,0.9),4px_4px 8px_rgba(0,0,0,0.15)] border border-[#d5dae2]"
                  >
                    <button
                      type="button"
                      onClick={(e) => handleEditTopic(thread, e)}
                      className="w-full px-3 py-2 text-left text-sm text-[#374151] hover:bg-[#d5dae2] flex items-center gap-2 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit topic
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleToggleStatus(thread, e)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-[#d5dae2] flex items-center gap-2 transition-colors"
                    >
                      {thread.status === 'closed' ? (
                        <>
                          <svg className="w-4 h-4 text-[#2ed573]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-[#374151]">Reopen thread</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 text-[#8b9298]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                          </svg>
                          <span className="text-[#374151]">Close thread</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Edit Topic Modal */}
                {editingThreadId === thread.id && (
                  <div
                    className="absolute inset-0 z-20 flex items-center justify-center bg-[#e0e5ec]/95 rounded-xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="w-full max-w-[200px] p-3 space-y-2">
                      <label className="text-xs font-medium text-[#5a6270] uppercase tracking-wider">
                        Thread Topic
                      </label>
                      <input
                        type="text"
                        value={editTopicValue}
                        onChange={(e) => setEditTopicValue(e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, thread.id)}
                        className="w-full px-3 py-2 rounded-lg text-sm bg-[#e0e5ec] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.08),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] text-[#374151] placeholder-[#9ca3af] border-none focus:outline-none focus:ring-1 focus:ring-[#ff4757]/30"
                        placeholder="Enter thread topic..."
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={(e) => handleSaveTopic(thread.id, e)}
                          className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#ff4757] text-white shadow-[2px_2px_4px_rgba(166,50,60,0.3)] hover:bg-[#ff6b7a] transition-colors"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingThreadId(null)}
                          className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#e0e5ec] text-[#5a6270] shadow-[-2px_-2px_4px_rgba(255,255,255,0.8),2px_2px 4px_rgba(0,0,0,0.08)] hover:bg-[#d5dae2] transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
