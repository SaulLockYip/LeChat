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

// Backend conversation response type (different from frontend)
interface BackendConversation {
  id: string;
  type: string; // "dm" or "group"
  lechat_agent_ids?: string[];
  thread_ids?: string[];
  group_name?: string;
  created_at: string;
  updated_at: string;
}

// Transform backend conversation to frontend format
function transformConversation(conv: BackendConversation): Conversation {
  const type: 'dm' | 'channel' = conv.type === 'group' ? 'channel' : 'dm';
  return {
    id: conv.id,
    type,
    agentId: type === 'dm' ? conv.lechat_agent_ids?.[0] : undefined,
    channelId: type === 'channel' ? conv.id : undefined,
    title: conv.group_name || (type === 'dm' ? `DM ${conv.lechat_agent_ids?.[0]?.slice(0, 8) || 'Unknown'}` : 'Unknown Channel'),
    timestamp: conv.created_at,
    lastMessage: undefined,
    unread: false,
  };
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
        // Transform backend conversations to frontend format
        // The API returns raw backend data that differs from frontend types
        const backendConvs = conversationsResponse.data as unknown as BackendConversation[];
        const convs = backendConvs.map(transformConversation);

        // Separate conversations into channels (agents come from /api/agents only)
        const channelConvs = convs.filter(c => c.type === 'channel' && c.channelId);

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
