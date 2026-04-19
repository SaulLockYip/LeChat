'use client';

import { useState, useCallback } from 'react';

export interface ThreadPreview {
  id: string;
  title: string;
  topic?: string;
  lastMessage?: string;
  timestamp: string;
  unread?: boolean;
}

interface UseThreadsReturn {
  threads: ThreadPreview[];
  selectedThreadId: string | null;
  isLoading: boolean;
  error: string | null;
  selectThread: (threadId: string) => void;
  clearThreads: () => void;
  fetchThreadsForConversation: (conversationId: string) => Promise<void>;
}

export function useThreads(): UseThreadsReturn {
  const [threads, setThreads] = useState<ThreadPreview[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectThread = useCallback((threadId: string) => {
    setSelectedThreadId(threadId);
  }, []);

  const clearThreads = useCallback(() => {
    setThreads([]);
    setSelectedThreadId(null);
  }, []);

  const fetchThreadsForConversation = useCallback(async (conversationId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/conversations/${conversationId}`);
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
            const threadResponse = await fetch(`/api/threads/${id}`);
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
      setError(err instanceof Error ? err.message : 'Failed to fetch threads');
      setThreads([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    threads,
    selectedThreadId,
    isLoading,
    error,
    selectThread,
    clearThreads,
    fetchThreadsForConversation,
  };
}
