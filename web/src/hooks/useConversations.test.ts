import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useConversations } from './useConversations';
import { setupDefaultMock } from '@/testutils/mock_api';

describe('useConversations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch agents and conversations on mount', async () => {
    const { result } = renderHook(() => useConversations());

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for data to load
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Check agents are loaded (from mock data)
    expect(result.current.agents.length).toBeGreaterThan(0);
  });

  it('should handle agent selection', async () => {
    const { result } = renderHook(() => useConversations());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Select an agent
    const agentId = result.current.agents[0]?.id;
    if (agentId) {
      result.current.selectAgent(agentId);

      await waitFor(() => {
        expect(result.current.selectedAgentId).toBe(agentId);
      });
      expect(result.current.selectedChannelId).toBeNull();
    }
  });

  it('should handle channel selection', async () => {
    const { result } = renderHook(() => useConversations());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Select a channel
    const channelId = result.current.channels[0]?.id;
    if (channelId) {
      result.current.selectChannel(channelId);

      await waitFor(() => {
        expect(result.current.selectedChannelId).toBe(channelId);
      });
      expect(result.current.selectedAgentId).toBeNull();
    }
  });

  it('should mark conversation as read', async () => {
    const { result } = renderHook(() => useConversations());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Find a conversation with unread
    const unreadConv = result.current.conversations.find(c => c.unread);
    if (unreadConv) {
      result.current.markAsRead(unreadConv.id);

      const updatedConv = result.current.conversations.find(c => c.id === unreadConv.id);
      expect(updatedConv?.unread).toBe(false);
    }
  });

  it('should separate agents and channels from conversations', async () => {
    const { result } = renderHook(() => useConversations());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Agents should come from DM conversations
    const dmConversations = result.current.conversations.filter(c => c.type === 'dm');
    expect(dmConversations.length).toBe(result.current.agents.length);

    // Channels should come from channel conversations
    const channelConversations = result.current.conversations.filter(c => c.type === 'channel');
    expect(channelConversations.length).toBe(result.current.channels.length);
  });
});
