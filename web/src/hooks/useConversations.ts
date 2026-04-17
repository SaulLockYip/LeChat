'use client';

import { useState, useCallback, useEffect } from 'react';
import { api } from '../lib/api';

export interface Agent {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'busy';
  unread?: number;
}

export interface Channel {
  id: string;
  name: string;
  unread?: number;
}

export interface Conversation {
  id: string;
  type: 'dm' | 'channel';
  agentId?: string;
  channelId?: string;
  title: string;
  lastMessage?: string;
  timestamp: string;
  unread?: boolean;
}

interface UseConversationsReturn {
  agents: Agent[];
  channels: Channel[];
  conversations: Conversation[];
  selectedAgentId: string | null;
  selectedChannelId: string | null;
  selectAgent: (agentId: string) => void;
  selectChannel: (channelId: string) => void;
  markAsRead: (conversationId: string) => void;
  isLoading: boolean;
  error: string | null;
}

export function useConversations(): UseConversationsReturn {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [agentsResponse, conversationsResponse] = await Promise.all([
        api.getAgents(),
        api.getConversations(),
      ]);

      if (agentsResponse.success && agentsResponse.data) {
        setAgents(agentsResponse.data);
      }

      if (conversationsResponse.success && conversationsResponse.data) {
        // Separate conversations into agents (dms) and channels
        const convs = conversationsResponse.data;
        const agentConvs = convs.filter(c => c.type === 'dm' && c.agentId);
        const channelConvs = convs.filter(c => c.type === 'channel' && c.channelId);

        // Extract unique agents from conversations
        const uniqueAgents = new Map<string, Agent>();
        agentConvs.forEach(conv => {
          if (conv.agentId && !uniqueAgents.has(conv.agentId)) {
            uniqueAgents.set(conv.agentId, {
              id: conv.agentId,
              name: conv.title,
              status: 'online',
              unread: conv.unread ? 1 : 0,
            });
          }
        });
        setAgents(prev => [...prev, ...Array.from(uniqueAgents.values())]);

        // Extract unique channels from conversations
        const uniqueChannels = new Map<string, Channel>();
        channelConvs.forEach(conv => {
          if (conv.channelId && !uniqueChannels.has(conv.channelId)) {
            uniqueChannels.set(conv.channelId, {
              id: conv.channelId,
              name: conv.title,
              unread: conv.unread ? 1 : 0,
            });
          }
        });
        setChannels(Array.from(uniqueChannels.values()));

        setConversations(convs);
      }

      if (!agentsResponse.success) {
        setError(prev => prev ? `${prev}; ${agentsResponse.error}` : agentsResponse.error || 'Failed to fetch agents');
      }
      if (!conversationsResponse.success) {
        setError(prev => prev ? `${prev}; ${conversationsResponse.error}` : conversationsResponse.error || 'Failed to fetch conversations');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const selectAgent = useCallback((agentId: string) => {
    setSelectedAgentId(agentId);
    setSelectedChannelId(null);
  }, []);

  const selectChannel = useCallback((channelId: string) => {
    setSelectedChannelId(channelId);
    setSelectedAgentId(null);
  }, []);

  const markAsRead = useCallback((conversationId: string) => {
    setConversations(prev =>
      prev.map(conv =>
        conv.id === conversationId ? { ...conv, unread: false } : conv
      )
    );
  }, []);

  return {
    agents,
    channels,
    conversations,
    selectedAgentId,
    selectedChannelId,
    selectAgent,
    selectChannel,
    markAsRead,
    isLoading,
    error,
  };
}
