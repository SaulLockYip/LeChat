'use client';

import { Badge } from '@/components/ui/Badge';
import { LEDIndicator } from '@/components/ui/LEDIndicator';

export interface ThreadPreview {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: string;
  unread?: boolean;
  agentName?: string;
  agentStatus?: 'online' | 'offline' | 'busy';
}

interface ThreadListProps {
  threads?: ThreadPreview[];
  selectedThreadId?: string;
  onSelect?: (threadId: string) => void;
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

export function ThreadList({
  threads = [],
  selectedThreadId,
  onSelect,
}: ThreadListProps) {
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
    <div className="space-y-2">
      {threads.map((thread) => (
        <button
          type="button"
          key={thread.id}
          onClick={() => onSelect?.(thread.id)}
          className={`
            w-full p-3 rounded-xl text-left
            transition-all duration-150
            ${selectedThreadId === thread.id
              ? 'bg-[#e0e5ec] shadow-[-4px_-4px_8px_rgba(255,255,255,0.8),4px_4px_8px_rgba(0,0,0,0.12)]'
              : 'bg-[#e8ebf0] shadow-[-2px_-2px_4px_rgba(255,255,255,0.7),2px_2px_4px_rgba(0,0,0,0.06)] hover:bg-[#e0e5ec]'
            }
          `}
        >
          <div className="flex items-start gap-3">
            {/* Agent Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-[#f0f2f5] shadow-[-2px_-2px_4px_rgba(255,255,255,0.8),2px_2px_4px_rgba(0,0,0,0.1)] flex items-center justify-center">
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
                <h4 className={`text-sm truncate ${selectedThreadId === thread.id ? 'font-semibold text-[#374151]' : 'font-medium text-[#5a6270]'}`}>
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
      ))}
    </div>
  );
}
