'use client';

import { MessageList } from '@/components/features/MessageList';
import { MessageComposer } from '@/components/features/MessageComposer';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'agent';
  senderName?: string;
  timestamp: string;
  status?: 'sending' | 'sent' | 'error';
}

interface ThreadPanelProps {
  threadTitle?: string;
  threadTopic?: string;
  messages?: Message[];
  isLoading?: boolean;
  onSendMessage?: (content: string) => void;
  onRetryMessage?: (messageId: string) => void;
}

export function ThreadPanel({
  threadTitle = 'Thread',
  threadTopic,
  messages = [],
  isLoading = false,
  onSendMessage,
  onRetryMessage,
}: ThreadPanelProps) {
  return (
    <div className="
      flex-1 h-full
      bg-[#e0e5ec]
      flex flex-col
      overflow-hidden
    ">
      {/* Thread Header */}
      <div className="
        px-6 py-4
        bg-[#d5dae2]
        shadow-[0_4px_8px_rgba(0,0,0,0.05)]
        border-b border-[#c8ccd3]/50
      ">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <h2 className="font-semibold text-[#374151] text-lg">{threadTitle}</h2>
            {threadTopic && (
              <p className="text-sm text-[#8b9298] mt-0.5">{threadTopic}</p>
            )}
          </div>
          <button className="w-9 h-9 rounded-xl bg-[#e0e5ec] shadow-[-4px_-4px_8px_rgba(255,255,255,0.7),4px_4px_8px_rgba(0,0,0,0.1)] flex items-center justify-center hover:shadow-[-2px_-2px_4px_rgba(255,255,255,0.8),2px_2px_4px_rgba(0,0,0,0.08)] active:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1)] transition-all">
            <svg className="w-5 h-5 text-[#5a6270]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button className="w-9 h-9 rounded-xl bg-[#e0e5ec] shadow-[-4px_-4px_8px_rgba(255,255,255,0.7),4px_4px_8px_rgba(0,0,0,0.1)] flex items-center justify-center hover:shadow-[-2px_-2px_4px_rgba(255,255,255,0.8),2px_2px_4px_rgba(0,0,0,0.08)] active:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1)] transition-all">
            <svg className="w-5 h-5 text-[#5a6270]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-hidden">
        <MessageList
          messages={messages}
          isLoading={isLoading}
          onRetry={onRetryMessage}
        />
      </div>

      {/* Message Composer */}
      <div className="p-4 bg-[#d5dae2] shadow-[0_-4px_8px_rgba(0,0,0,0.03)]">
        <MessageComposer
          onSend={onSendMessage}
          disabled={isLoading}
        />
      </div>
    </div>
  );
}
