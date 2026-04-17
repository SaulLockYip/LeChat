'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'agent';
  senderName?: string;
  timestamp: string;
  status?: 'sending' | 'sent' | 'error';
}

export interface Thread {
  id: string;
  title: string;
  topic?: string;
  messages: Message[];
}

// Placeholder data for demonstration
const PLACEHOLDER_THREAD: Thread = {
  id: 'thread-1',
  title: 'Project Discussion',
  topic: ' discussing the new feature implementation',
  messages: [
    {
      id: 'msg-1',
      content: 'Hey team, I wanted to discuss the new feature implementation. What do you think about using a microservices architecture?',
      sender: 'agent',
      senderName: 'Alice',
      timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      status: 'sent',
    },
    {
      id: 'msg-2',
      content: 'I think microservices could work well, especially for the independent scaling of components.',
      sender: 'user',
      timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      status: 'sent',
    },
    {
      id: 'msg-3',
      content: 'Agreed. We should also consider the operational complexity though. Maybe we can start with a modular monolith?',
      sender: 'agent',
      senderName: 'Bob',
      timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      status: 'sent',
    },
    {
      id: 'msg-4',
      content: 'That sounds like a good approach. Let me draft a proposal for the architecture.',
      sender: 'user',
      timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      status: 'sent',
    },
    {
      id: 'msg-5',
      content: 'Perfect! I will review your proposal and provide feedback by end of day.',
      sender: 'agent',
      senderName: 'Alice',
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      status: 'sent',
    },
  ],
};

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
  const [thread, setThread] = useState<Thread | null>(PLACEHOLDER_THREAD);
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

  const messages = thread?.messages ?? [];

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

    // Simulate sending
    const sendTimeoutId = setTimeout(() => {
      setThread(prev => prev ? {
        ...prev,
        messages: prev.messages.map(msg =>
          msg.id === newMessage.id ? { ...msg, status: 'sent' as const } : msg
        ),
      } : null);
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

    // Simulate retry
    const retryTimeoutId = setTimeout(() => {
      setThread(prev => prev ? {
        ...prev,
        messages: prev.messages.map(msg =>
          msg.id === messageId ? { ...msg, status: 'sent' as const } : msg
        ),
      } : null);
    }, 1000);
    timeoutIdsRef.current.push(retryTimeoutId);
  }, []);

  const selectThread = useCallback((threadId: string) => {
    setIsLoading(true);
    // Simulate loading
    const selectTimeoutId = setTimeout(() => {
      setThread(PLACEHOLDER_THREAD);
      setIsLoading(false);
    }, 500);
    timeoutIdsRef.current.push(selectTimeoutId);
  }, []);

  const clearThread = useCallback(() => {
    setThread(null);
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
