'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'agent';
  senderName?: string;
  timestamp: string;
  status?: 'sending' | 'sent' | 'error';
  filePath?: string;
}

export interface Thread {
  id: string;
  title: string;
  topic?: string;
  messages: Message[];
}

interface UseThreadReturn {
  thread: Thread | null;
  messages: Message[];
  isLoading: boolean;
  sendMessage: (content: string) => void;
  retryMessage: (messageId: string) => void;
  selectThread: (threadId: string) => void;
  clearThread: () => void;
}

export function useThread(): UseThreadReturn {
  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Store timeout IDs for cleanup
  const timeoutIdsRef = useRef<NodeJS.Timeout[]>([]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutIdsRef.current.forEach(id => clearTimeout(id));
      timeoutIdsRef.current = [];
    };
  }, []);

  const sendMessage = useCallback((content: string) => {
    if (!thread) return;
    if (!content.trim()) return;

    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      content,
      sender: 'user',
      timestamp: new Date().toISOString(),
      status: 'sending',
    };

    // Optimistically add message
    setThread(prev => prev ? {
      ...prev,
      messages: [...prev.messages, newMessage],
    } : null);
    setMessages(prev => [...prev, newMessage]);

    // Simulate sending
    const sendTimeoutId = setTimeout(() => {
      setThread(prev => prev ? {
        ...prev,
        messages: prev.messages.map(msg =>
          msg.id === newMessage.id ? { ...msg, status: 'sent' as const } : msg
        ),
      } : null);
      setMessages(prev => prev.map(msg =>
        msg.id === newMessage.id ? { ...msg, status: 'sent' as const } : msg
      ));
    }, 1000);
    timeoutIdsRef.current.push(sendTimeoutId);

    // Simulate agent response
    const responseTimeoutId = setTimeout(() => {
      const responses = [
        'Thanks for the update! I will look into this.',
        'Got it, let me check and get back to you.',
        'Interesting point. What about considering the alternative approach?',
        'I see. That makes sense given our constraints.',
        'Great thinking! This approach has merit.',
      ];
      const agentResponse: Message = {
        id: `msg-${Date.now()}-response`,
        content: responses[Math.floor(Math.random() * responses.length)],
        sender: 'agent',
        senderName: 'Alice',
        timestamp: new Date().toISOString(),
        status: 'sent',
      };

      setThread(prev => prev ? {
        ...prev,
        messages: [...prev.messages, agentResponse],
      } : null);
      setMessages(prev => [...prev, agentResponse]);
    }, 2500);
    timeoutIdsRef.current.push(responseTimeoutId);
  }, [thread]);

  const retryMessage = useCallback((messageId: string) => {
    setThread(prev => prev ? {
      ...prev,
      messages: prev.messages.map(msg =>
        msg.id === messageId ? { ...msg, status: 'sending' as const } : msg
      ),
    } : null);
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, status: 'sending' as const } : msg
    ));

    // Simulate retry
    const retryTimeoutId = setTimeout(() => {
      setThread(prev => prev ? {
        ...prev,
        messages: prev.messages.map(msg =>
          msg.id === messageId ? { ...msg, status: 'sent' as const } : msg
        ),
      } : null);
      setMessages(prev => prev.map(msg =>
        msg.id === messageId ? { ...msg, status: 'sent' as const } : msg
      ));
    }, 1000);
    timeoutIdsRef.current.push(retryTimeoutId);
  }, []);

  const selectThread = useCallback(async (threadId: string) => {
    setIsLoading(true);
    try {
      // Fetch thread and agents in parallel
      const [threadResponse, agentsResponse] = await Promise.all([
        fetch(`/api/threads/${threadId}`),
        fetch('/api/agents'),
      ]);

      if (!threadResponse.ok) {
        throw new Error('Failed to fetch thread');
      }

      // Build agent ID to name mapping
      const agentIdToName = new Map<string, string>();
      if (agentsResponse.ok) {
        const agents = await agentsResponse.json();
        agents.forEach((agent: { id: string; name: string }) => {
          agentIdToName.set(agent.id, agent.name);
        });
      }

      const data = await threadResponse.json();
      const threadData = data.thread;
      const backendMessages = data.messages || [];

      // Transform backend messages to frontend format
      const transformedMessages: Message[] = backendMessages.map((msg: { id: number; from: string; content: string; timestamp: string; file_path?: string }) => ({
        id: String(msg.id),
        content: msg.content,
        sender: 'agent' as const,
        senderName: agentIdToName.get(msg.from) || msg.from.slice(0, 8),
        timestamp: msg.timestamp,
        status: 'sent' as const,
        filePath: msg.file_path,
      }));

      setThread({
        id: threadData.id,
        title: threadData.topic || threadData.title,
        topic: threadData.topic,
        messages: transformedMessages,
      });
      setMessages(transformedMessages);
    } catch (error) {
      console.error('Error fetching thread:', error);
      setThread(null);
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearThread = useCallback(() => {
    setThread(null);
    setMessages([]);
  }, []);

  return {
    thread,
    messages,
    isLoading,
    sendMessage,
    retryMessage,
    selectThread,
    clearThread,
  };
}
