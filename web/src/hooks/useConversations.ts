'use client';

import { useState, useCallback, useEffect } from 'react';
import { api } from '../lib/api';
import { useToast } from '../components/ui';

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
  otherAgentId?: string; // For DMs, the second participant (for filtering)
  channelId?: string;
  title: string;
  lastMessage?: string;
  timestamp: string;
  unread?: boolean;
  threadIds: string[]; // Thread IDs belonging to this conversation
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
function transformConversation(conv: BackendConversation, agentIdToName: Map<string, string>): Conversation {
  const type: 'dm' | 'channel' = conv.type === 'group' ? 'channel' : 'dm';

  let title: string;
  if (conv.group_name) {
    title = conv.group_name;
  } else if (type === 'dm' && conv.lechat_agent_ids && conv.lechat_agent_ids.length >= 2) {
    // For DM, show "agent1 <=> agent2"
    const agent1Name = agentIdToName.get(conv.lechat_agent_ids[0]) || conv.lechat_agent_ids[0].slice(0, 8);
    const agent2Name = agentIdToName.get(conv.lechat_agent_ids[1]) || conv.lechat_agent_ids[1].slice(0, 8);
    title = `${agent1Name} <=> ${agent2Name}`;
  } else if (type === 'dm' && conv.lechat_agent_ids && conv.lechat_agent_ids.length === 1) {
    const agent1Name = agentIdToName.get(conv.lechat_agent_ids[0]) || conv.lechat_agent_ids[0].slice(0, 8);
    title = `${agent1Name} <=> ?`;
  } else {
    title = 'Unknown Channel';
  }

  return {
    id: conv.id,
    type,
    agentId: type === 'dm' ? conv.lechat_agent_ids?.[0] : undefined,
    otherAgentId: type === 'dm' ? conv.lechat_agent_ids?.[1] : undefined,
    channelId: type === 'channel' ? conv.id : undefined,
    title,
    timestamp: conv.created_at,
    lastMessage: undefined,
    unread: false,
    threadIds: conv.thread_ids || [], // Preserve thread_ids from backend
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
  currentUser: { id: string; name: string; title: string } | null;
}

export function useConversations(): UseConversationsReturn {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; title: string } | null>(null);
  const { addToast } = useToast();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [userResponse, agentsResponse, conversationsResponse] = await Promise.all([
        api.getUserInfo(),
        api.getAgents(),
        api.getConversations(),
      ]);

      // Store current user info
      if (userResponse.success && userResponse.data) {
        setCurrentUser({
          id: userResponse.data.id,
          name: userResponse.data.name,
          title: userResponse.data.title,
        });
      }

      // Create map of lechat_agent_id -> openclaw_agent_id (name)
      const agentIdToName = new Map<string, string>();
      if (agentsResponse.success && agentsResponse.data) {
        setAgents(agentsResponse.data);
        (agentsResponse.data as Agent[]).forEach(agent => {
          agentIdToName.set(agent.id, agent.name);
        });
      }

      if (conversationsResponse.success && conversationsResponse.data) {
        // Transform backend conversations to frontend format
        const backendConvs = conversationsResponse.data as unknown as BackendConversation[];
        const convs = backendConvs.map(conv => transformConversation(conv, agentIdToName));

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
        const errorMsg = agentsResponse.error || 'Failed to fetch agents';
        setError(prev => prev ? `${prev}; ${errorMsg}` : errorMsg);
        addToast({ message: errorMsg, type: 'error' });
      }
      if (!conversationsResponse.success) {
        const errorMsg = conversationsResponse.error || 'Failed to fetch conversations';
        setError(prev => prev ? `${prev}; ${errorMsg}` : errorMsg);
        addToast({ message: errorMsg, type: 'error' });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch data';
      setError(errorMsg);
      addToast({ message: errorMsg, type: 'error' });
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
    currentUser,
  };
}
