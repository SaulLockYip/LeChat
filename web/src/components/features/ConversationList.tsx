'use client';

import { LEDIndicator } from '@/components/ui/LEDIndicator';

interface Agent {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'busy';
  unread?: number;
}

interface ConversationListProps {
  agents?: Agent[];
  selectedId?: string;
  onSelect?: (agentId: string) => void;
}

export function ConversationList({
  agents = [],
  selectedId,
  onSelect,
}: ConversationListProps) {
  return (
    <div className="space-y-1">
      {agents.map((agent) => (
        <button
          type="button"
          key={agent.id}
          onClick={() => onSelect?.(agent.id)}
          className={`
            w-full flex items-center gap-3 p-2.5 rounded-xl
            transition-all duration-150
            ${
              selectedId === agent.id
                ? 'bg-[#e0e5ec] shadow-[-4px_-4px_8px_rgba(255,255,255,0.8),4px_4px_8px_rgba(0,0,0,0.12)]'
                : 'bg-transparent hover:bg-[#d5dae2]'
            }
          `}
        >
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-[#f0f2f5] shadow-[-2px_-2px_4px_rgba(255,255,255,0.8),2px_2px_4px_rgba(0,0,0,0.1)] flex items-center justify-center">
              <span className="text-sm font-medium text-[#5a6270]">
                {(agent.name || '?').charAt(0).toUpperCase()}
              </span>
            </div>
            <LEDIndicator
              color={agent.status === 'online' ? 'green' : agent.status === 'busy' ? 'yellow' : 'off'}
              size="sm"
              className="absolute -bottom-0.5 -right-0.5"
            />
          </div>
          <div className="flex-1 text-left">
            <span className={`text-sm ${selectedId === agent.id ? 'font-semibold text-[#374151]' : 'text-[#5a6270]'}`}>
              {agent.name}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
