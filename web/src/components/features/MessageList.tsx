'use client';

import { useRef, useEffect } from 'react';
import { MessageBubble } from './MessageBubble';

export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'agent';
  senderName?: string;
  timestamp: string;
  status?: 'sending' | 'sent' | 'error';
}

interface MessageListProps {
  messages?: Message[];
  isLoading?: boolean;
  onRetry?: (messageId: string) => void;
}

export function MessageList({
  messages = [],
  isLoading = false,
  onRetry,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6">
        <div className="w-20 h-20 rounded-full bg-[#e0e5ec] shadow-[-6px_-6px_12px_rgba(255,255,255,0.8),6px_6px_12px_rgba(0,0,0,0.1)] flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-[#8b9298]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-[#5a6270] mb-2">No messages yet</h3>
        <p className="text-sm text-[#8b9298] max-w-xs">
          Start the conversation by sending a message below
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto p-4 space-y-4"
    >
      {/* Loading indicator */}
      {isLoading && (
        <div className="flex justify-center py-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#e0e5ec] shadow-[-2px_-2px_4px_rgba(255,255,255,0.8),2px_2px_4px_rgba(0,0,0,0.08)]">
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full bg-[#8b9298] animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-[#8b9298] animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-[#8b9298] animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-xs text-[#8b9298]">Loading...</span>
          </div>
        </div>
      )}

      {/* Messages */}
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          onRetry={message.status === 'error' ? () => onRetry?.(message.id) : undefined}
        />
      ))}
    </div>
  );
}
