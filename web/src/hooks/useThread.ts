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
      const response = await fetch(`/api/threads/${threadId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch thread');
      }
      const data: Thread = await response.json();
      setThread(data);
      setMessages(data.messages);
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
