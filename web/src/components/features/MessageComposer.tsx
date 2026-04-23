'use client';

import { useState, useRef, KeyboardEvent, useEffect } from 'react';

interface Agent {
  id: string;
  name: string;
}

interface MessageComposerProps {
  onSend?: (content: string, mentions?: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  agents?: Agent[];
  isGroup?: boolean;
}

export function MessageComposer({
  onSend,
  placeholder = 'Type a message...',
  disabled = false,
  agents = [],
  isGroup = false,
}: MessageComposerProps) {
  const [message, setMessage] = useState('');
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [selectedAgentIndex, setSelectedAgentIndex] = useState(0);
  const [selectedMentions, setSelectedMentions] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isComposingRef = useRef(false);
  const mentionListRef = useRef<HTMLDivElement>(null);

  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(mentionFilter.toLowerCase())
  );

  const handleSend = () => {
    const trimmed = message.trim();
    if (trimmed && !disabled) {
      onSend?.(trimmed, selectedMentions);
      setMessage('');
      setShowMentionList(false);
      setSelectedMentions([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (isComposingRef.current) {
      return;
    }

    if (showMentionList && filteredAgents.length > 0) {
      if (e.key === 'Escape') {
        setShowMentionList(false);
        e.preventDefault();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedAgentIndex(prev => (prev + 1) % filteredAgents.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedAgentIndex(prev => (prev - 1 + filteredAgents.length) % filteredAgents.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        insertMention(filteredAgents[selectedAgentIndex]);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);
    setSelectedAgentIndex(0);

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }

    // Check for @mention trigger
    if (isGroup) {
      const cursorPos = e.target.selectionStart;
      const textBeforeCursor = value.substring(0, cursorPos);

      // Find the last @ before cursor
      const lastAtIndex = textBeforeCursor.lastIndexOf('@');

      if (lastAtIndex !== -1) {
        const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);

        // Check for @all or @everyone
        const lowerTextAfterAt = textAfterAt.toLowerCase();
        if (lowerTextAfterAt.startsWith('all') || lowerTextAfterAt.startsWith('everyone')) {
          // Expand @all/@everyone to mention all agents
          const allMention = agents.map(a => `@${a.name}`).join(' ');
          const newMessage = value.substring(0, lastAtIndex) + allMention + ' ' + value.substring(cursorPos);
          setMessage(newMessage);
          setShowMentionList(false);
          setMentionStartIndex(-1);
          setMentionFilter('');
          // Add all agent names to selected mentions
          setSelectedMentions(agents.map(a => a.name));

          // Set cursor after the expanded mentions
          setTimeout(() => {
            if (textareaRef.current) {
              const newPos = lastAtIndex + allMention.length + 1;
              textareaRef.current.selectionStart = newPos;
              textareaRef.current.selectionEnd = newPos;
              textareaRef.current.focus();
            }
          }, 0);
          return;
        }

        // Normal @mention filtering
        if (!textAfterAt.includes(' ') && lastAtIndex === cursorPos - textAfterAt.length - 1) {
          setMentionFilter(textAfterAt);
          setMentionStartIndex(lastAtIndex);
          setShowMentionList(true);
        } else if (textAfterAt.includes(' ')) {
          setShowMentionList(false);
        }
      } else {
        setShowMentionList(false);
      }
    }
  };

  const insertMention = (agent: Agent) => {
    if (mentionStartIndex === -1) return;

    const beforeMention = message.substring(0, mentionStartIndex);
    const afterCursor = message.substring(textareaRef.current?.selectionStart || mentionStartIndex);
    const newMessage = `${beforeMention}@${agent.name} ${afterCursor}`;

    setMessage(newMessage);
    setShowMentionList(false);
    setMentionStartIndex(-1);
    setMentionFilter('');
    setSelectedMentions(prev => [...prev, agent.name]);

    // Set cursor position after the inserted mention
    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = mentionStartIndex + agent.name.length + 2;
        textareaRef.current.selectionStart = newPos;
        textareaRef.current.selectionEnd = newPos;
        textareaRef.current.focus();
      }
    }, 0);
  };

  // Close mention list when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (mentionListRef.current && !mentionListRef.current.contains(e.target as Node)) {
        setShowMentionList(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative">
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
            onCompositionStart={() => { isComposingRef.current = true; }}
            onCompositionEnd={() => {
              isComposingRef.current = false;
              // Close mention list when IME composition ends
              setShowMentionList(false);
            }}
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
              : 'bg-[#e0e5ec] text-[#9ca3af] shadow-[-4px_-4px_8px_rgba(255,255,255,0.7),4px_4px 8px_rgba(0,0,0,0.08)] cursor-not-allowed'
            }
          `}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>

      {/* Mention dropdown */}
      {showMentionList && filteredAgents.length > 0 && (
        <div
          ref={mentionListRef}
          className="
            absolute left-4 right-4 bottom-full mb-2
            bg-[#e8ebf0]
            shadow-[-4px_-4px_12px_rgba(0,0,0,0.15),4px_4px_12px_rgba(0,0,0,0.1)]
            rounded-xl border border-[#d5dae2]
            overflow-hidden z-50
          "
        >
          {filteredAgents.map((agent, index) => (
            <button
              key={agent.id}
              onClick={() => insertMention(agent)}
              className={`
                w-full px-4 py-2.5 text-left
                flex items-center gap-3
                transition-colors
                ${index === selectedAgentIndex ? 'bg-[#d5dae2]' : 'hover:bg-[#d5dae2]'}
              `}
            >
              <div className="w-8 h-8 rounded-full bg-[#ff4757]/10 flex items-center justify-center">
                <span className="text-sm font-medium text-[#ff4757]">
                  {agent.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-sm text-[#374151]">{agent.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}