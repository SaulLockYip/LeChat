'use client';

import { LEDIndicator } from '@/components/ui/LEDIndicator';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

interface Agent {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'busy';
  unread?: number;
}

interface Channel {
  id: string;
  name: string;
  unread?: number;
}

interface SidebarProps {
  serverName?: string;
  serverStatus?: 'connected' | 'connecting' | 'disconnected';
  agents?: Agent[];
  channels?: Channel[];
  currentUser?: string;
  onAgentSelect?: (agentId: string) => void;
  onChannelSelect?: (channelId: string) => void;
  selectedId?: string;
}

export function Sidebar({
  serverName = 'LeChat Server',
  serverStatus = 'connected',
  agents = [],
  channels = [],
  currentUser = 'User',
  onAgentSelect,
  onChannelSelect,
  selectedId,
}: SidebarProps) {
  const statusColor = {
    connected: 'green' as const,
    connecting: 'yellow' as const,
    disconnected: 'red' as const,
  };

  return (
    <div className="
      w-[240px] h-full
      bg-[#e0e5ec]
      shadow-[-8px_0_16px_rgba(0,0,0,0.1)]
      flex flex-col
      overflow-hidden
    ">
      {/* Server Header */}
      <div className="
        p-4
        bg-[#d5dae2]
        shadow-[-4px_-4px_8px_rgba(255,255,255,0.5),4px_4px_8px_rgba(0,0,0,0.1)]
      ">
        <div className="flex items-center gap-3">
          <LEDIndicator
            color={statusColor[serverStatus]}
            pulse={serverStatus === 'connecting'}
            size="lg"
          />
          <div className="flex flex-col">
            <span className="font-semibold text-[#374151] text-sm">
              {serverName}
            </span>
            <span className="text-xs text-[#8b9298] capitalize">
              {serverStatus}
            </span>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-4" aria-label="Sidebar navigation">
        {/* DM Section */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-[#8b9298] uppercase tracking-wider pl-2">
            Direct Messages
          </h3>
          <div className="space-y-1" role="list">
            {agents.map((agent) => (
              <button
                key={agent.id}
                role="listitem"
                onClick={() => onAgentSelect?.(agent.id)}
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
                {agent.unread && agent.unread > 0 && (
                  <Badge variant="accent" size="sm">
                    {agent.unread}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Channels Section */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-[#8b9298] uppercase tracking-wider pl-2">
            Channels
          </h3>
          <div className="space-y-1" role="list">
            {channels.map((channel) => (
              <button
                key={channel.id}
                role="listitem"
                onClick={() => onChannelSelect?.(channel.id)}
                className={`
                  w-full flex items-center gap-3 p-2.5 rounded-xl
                  transition-all duration-150
                  ${
                    selectedId === channel.id
                      ? 'bg-[#e0e5ec] shadow-[-4px_-4px_8px_rgba(255,255,255,0.8),4px_4px_8px_rgba(0,0,0,0.12)]'
                      : 'bg-transparent hover:bg-[#d5dae2]'
                  }
                `}
              >
                <div className="w-9 h-9 rounded-full bg-[#f0f2f5] shadow-[-2px_-2px_4px_rgba(255,255,255,0.8),2px_2px_4px_rgba(0,0,0,0.1)] flex items-center justify-center">
                  <span className="text-sm font-medium text-[#5a6270]">#</span>
                </div>
                <div className="flex-1 text-left">
                  <span className={`text-sm ${selectedId === channel.id ? 'font-semibold text-[#374151]' : 'text-[#5a6270]'}`}>
                    {channel.name}
                  </span>
                </div>
                {channel.unread && channel.unread > 0 && (
                  <Badge variant="accent" size="sm">
                    {channel.unread}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* User Panel */}
      <div className="
        p-3
        bg-[#d5dae2]
        shadow-[4px_0_8px_rgba(0,0,0,0.05)]
      ">
        <div className="flex items-center gap-3 p-2 rounded-xl bg-[#e0e5ec] shadow-[-4px_-4px_8px_rgba(255,255,255,0.5),4px_4px_8px_rgba(0,0,0,0.08)]">
          <div className="w-9 h-9 rounded-full bg-[#ff4757] shadow-[-2px_-2px_4px_rgba(255,255,255,0.3),2px_2px_4px_rgba(0,0,0,0.15)] flex items-center justify-center">
            <span className="text-sm font-semibold text-white">
              {currentUser.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1">
            <span className="text-sm font-medium text-[#374151]">{currentUser}</span>
          </div>
          <button className="w-8 h-8 rounded-lg bg-[#e0e5ec] shadow-[-2px_-2px_4px_rgba(255,255,255,0.8),2px_2px_4px_rgba(0,0,0,0.1)] flex items-center justify-center hover:shadow-[-1px_-1px_2px_rgba(255,255,255,0.9),1px_1px_2px_rgba(0,0,0,0.08)] active:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1)] transition-all">
            <svg className="w-4 h-4 text-[#5a6270]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
