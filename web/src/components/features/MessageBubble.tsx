'use client';

import { Badge } from '@/components/ui/Badge';

export interface MessageBubbleProps {
  message: {
    id: string;
    content: string;
    sender: 'user' | 'agent';
    senderName?: string;
    timestamp: string;
    status?: 'sending' | 'sent' | 'error';
  };
  onRetry?: () => void;
}

function formatMessageTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function MessageBubble({ message, onRetry }: MessageBubbleProps) {
  const isUser = message.sender === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[70%] ${isUser ? 'flex-row-reverse' : 'flex-row'} gap-2`}>
        {/* Avatar */}
        <div className={`
          w-9 h-9 rounded-full flex-shrink-0
          flex items-center justify-center
          ${isUser
            ? 'bg-[#ff4757] shadow-[-2px_-2px_4px_rgba(255,255,255,0.2),2px_2px_4px_rgba(0,0,0,0.15)]'
            : 'bg-[#f0f2f5] shadow-[-2px_-2px_4px_rgba(255,255,255,0.8),2px_2px_4px_rgba(0,0,0,0.1)]'
          }
        `}>
          <span className={`text-sm font-semibold ${isUser ? 'text-white' : 'text-[#5a6270]'}`}>
            {(message.senderName || (isUser ? 'Y' : 'A')).charAt(0).toUpperCase()}
          </span>
        </div>

        {/* Bubble */}
        <div className="flex flex-col gap-1">
          {/* Sender name (for agents) */}
          {!isUser && message.senderName && (
            <span className="text-xs text-[#8b9298] pl-1">{message.senderName}</span>
          )}

          {/* Message bubble */}
          <div className={`
            relative px-4 py-2.5 rounded-2xl
            ${isUser
              ? 'bg-[#ff4757] text-white rounded-tr-md'
              : 'bg-[#f0f2f5] text-[#374151] rounded-tl-md shadow-[-4px_-4px_8px_rgba(255,255,255,0.8),4px_4px_8px_rgba(0,0,0,0.08)]'
            }
            ${message.status === 'sending' ? 'opacity-70' : ''}
          `}>
            {/* Error indicator with retry */}
            {message.status === 'error' && (
              <button
                type="button"
                onClick={onRetry}
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#ff4757] text-white flex items-center justify-center shadow-[0_2px_4px_rgba(255,71,87,0.3)] hover:bg-[#ff6b7a] transition-colors"
                title="Retry"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}

            {/* Message content */}
            <p className="text-sm whitespace-pre-wrap break-words">
              {message.content}
            </p>

            {/* Timestamp and status */}
            <div className={`flex items-center justify-end gap-1 mt-1 ${isUser ? 'text-white/70' : 'text-[#8b9298]'}`}>
              {message.status === 'sending' && (
                <span className="text-xs">Sending...</span>
              )}
              {message.status === 'sent' && (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              <span className="text-xs">{formatMessageTime(message.timestamp)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
