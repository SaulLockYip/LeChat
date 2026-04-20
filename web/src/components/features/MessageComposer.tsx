'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/Button';

interface MessageComposerProps {
  onSend?: (content: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function MessageComposer({
  onSend,
  placeholder = 'Type a message...',
  disabled = false,
}: MessageComposerProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isComposingRef = useRef(false);

  const handleSend = () => {
    const trimmed = message.trim();
    if (trimmed && !disabled) {
      onSend?.(trimmed);
      setMessage('');
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Ignore Enter if IME composition is in progress
    if (isComposingRef.current) {
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  };

  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
    isComposingRef.current = false;
    // Update message with composed text
    const target = e.target as HTMLTextAreaElement;
    setMessage(target.value);
  };

  return (
    <div className="
      flex items-end gap-3
      p-3 rounded-2xl
      bg-[#e0e5ec]
      shadow-[-6px_-6px_12px_rgba(255,255,255,0.7),6px_6px_12px_rgba(0,0,0,0.08)]
    ">
      {/* Textarea */}
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="
            w-full px-4 py-3 pr-12
            bg-[#e8ebf0]
            shadow-[inset_2px_2px_4px_rgba(0,0,0,0.06),inset_-2px_-2px_4px_rgba(255,255,255,0.7)]
            rounded-xl
            text-[#374151] text-sm
            placeholder-[#9ca3af]
            resize-none
            transition-all duration-150
            focus:outline-none focus:shadow-[inset_3px_3px_6px_rgba(0,0,0,0.07),inset_-2px_-2px_4px_rgba(255,255,255,0.8)]
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          style={{ minHeight: '48px', maxHeight: '150px' }}
        />

        {/* Attachment button */}
        <button
          className="
            absolute right-3 bottom-3
            w-7 h-7 rounded-lg
            bg-[#e0e5ec]
            shadow-[-2px_-2px_4px_rgba(255,255,255,0.8),2px_2px_4px_rgba(0,0,0,0.08)]
            flex items-center justify-center
            hover:shadow-[-1px_-1px_2px_rgba(255,255,255,0.9),1px_1px_2px_rgba(0,0,0,0.06)]
            active:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1)]
            transition-all
          "
          type="button"
        >
          <svg className="w-4 h-4 text-[#5a6270]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>
      </div>

      {/* Send button */}
      <button
        type="button"
        onClick={handleSend}
        disabled={!message.trim() || disabled}
        className={`
          w-12 h-12 rounded-xl
          flex items-center justify-center
          transition-all duration-150
          ${message.trim() && !disabled
            ? 'bg-[#ff4757] text-white shadow-[-4px_-4px_8px_rgba(255,255,255,0.3),4px_4px_8px_rgba(255,71,87,0.4)] hover:shadow-[-2px_-2px_4px_rgba(255,255,255,0.4),2px_2px_4px_rgba(255,71,87,0.5)] active:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2)]'
            : 'bg-[#e0e5ec] text-[#9ca3af] shadow-[-4px_-4px_8px_rgba(255,255,255,0.7),4px_4px_8px_rgba(0,0,0,0.08)] cursor-not-allowed'
          }
        `}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      </button>
    </div>
  );
}
