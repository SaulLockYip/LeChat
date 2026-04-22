'use client';

import { useState, useCallback } from 'react';
import { useToast } from '../components/ui';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

export interface ThreadPreview {
  id: string;
  title: string;
  topic?: string;
  lastMessage?: string;
  timestamp: string;
  unread?: boolean;
  status?: 'active' | 'closed';
}

interface UseThreadsReturn {
  threads: ThreadPreview[];
  selectedThreadId: string | null;
  isLoading: boolean;
  error: string | null;
  selectThread: (threadId: string) => void;
  clearThreads: () => void;
  fetchThreadsForConversation: (conversationId: string, token: string) => Promise<void>;
  updateThreadTimestamp: (threadId: string, timestamp: string) => void;
  updateThread: (threadId: string, data: { topic?: string; status?: 'active' | 'closed' }) => Promise<boolean>;
}

export function useThreads(): UseThreadsReturn {
  const [threads, setThreads] = useState<ThreadPreview[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const selectThread = useCallback((threadId: string) => {
    setSelectedThreadId(threadId);
  }, []);

  const clearThreads = useCallback(() => {
    setThreads([]);
    setSelectedThreadId(null);
  }, []);

  const updateThreadTimestamp = useCallback((threadId: string, timestamp: string) => {
    setThreads(prev => prev.map(thread =>
      thread.id === threadId
        ? { ...thread, timestamp }
        : thread
    ));
  }, []);

  const updateThread = useCallback(async (threadId: string, data: { topic?: string; status?: 'active' | 'closed' }): Promise<boolean> => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('No token available');
      return false;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/threads/${encodeURIComponent(threadId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to update thread: ${response.status}`);
      }

      const json = await response.json();

      // Update local state with the updated thread
      setThreads(prev => prev.map(thread =>
        thread.id === threadId
          ? {
              ...thread,
              title: json.thread?.topic || json.thread?.title || thread.title,
              topic: json.thread?.topic || thread.topic,
              status: json.thread?.status || thread.status,
            }
          : thread
      ));

      addToast({ message: 'Thread updated successfully', type: 'success' });
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update thread';
      setError(errorMessage);
      addToast({ message: errorMessage, type: 'error' });
      return false;
    }
  }, [addToast]);

  const fetchThreadsForConversation = useCallback(async (conversationId: string, token: string) => {
    if (!token) {
      setError('No token available');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch conversation to get thread_ids
      const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch conversation');
      }
      const data = await response.json();

      // Backend returns conversation with thread_ids
      const threadIds: string[] = data.thread_ids || [];

      // Fetch actual thread data to get topic field
      const threadPreviews: ThreadPreview[] = await Promise.all(
        threadIds.map(async (id: string, index: number) => {
          try {
            const threadResponse = await fetch(`${API_BASE_URL}/api/threads/${id}`, {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            });
            if (threadResponse.ok) {
              const threadData = await threadResponse.json();
              const thread = threadData.thread;
              return {
                id,
                title: thread?.topic || thread?.title || `Thread ${index + 1}`,
                topic: thread?.topic,
                lastMessage: undefined,
                timestamp: thread?.updated_at || thread?.created_at || new Date().toISOString(),
                unread: false,
                status: thread?.status || 'active',
              };
            }
          } catch {
            // Fall back to placeholder if fetch fails
          }
          return {
            id,
            title: `Thread ${index + 1}`,
            topic: undefined,
            lastMessage: undefined,
            timestamp: data.updated_at || data.created_at || new Date().toISOString(),
            unread: false,
          };
        })
      );

      setThreads(threadPreviews);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch threads';
      setError(errorMessage);
      addToast({ message: errorMessage, type: 'error' });
      setThreads([]);
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  return {
    threads,
    selectedThreadId,
    isLoading,
    error,
    selectThread,
    clearThreads,
    fetchThreadsForConversation,
    updateThreadTimestamp,
    updateThread,
  };
}
