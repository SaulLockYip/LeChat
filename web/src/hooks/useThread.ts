'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { api, BackendMessage } from '../lib/api';
import { useToast } from '../components/ui';

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
  sendMessage: (content: string) => Promise<void>;
  retryMessage: (messageId: string) => void;
  selectThread: (threadId: string) => void;
  clearThread: () => void;
}

/**
 * Determines if a message is from the current user based on the 'from' field.
 * User messages have 'from' starting with "HUMAN USER:" followed by name and optionally title.
 * Agent messages have 'from' as the agent ID string.
 */
function isUserMessage(from: string): boolean {
  return from.startsWith('HUMAN USER:');
}

/**
 * Extracts sender name from the 'from' field.
 * For user messages: "HUMAN USER: Name:Title" or "HUMAN USER: Name"
 * For agent messages: just the agent ID
 */
function extractSenderName(from: string, agentIdToName: Map<string, string>): string {
  if (isUserMessage(from)) {
    // Format: "HUMAN USER: Name:Title" or "HUMAN USER: Name"
    const withoutPrefix = from.slice('HUMAN USER:'.length);
    const parts = withoutPrefix.split(':');
    return parts[0] || 'User';
  }
  // Agent message - look up name by ID
  return agentIdToName.get(from) || from.slice(0, 8);
}

export function useThread(): UseThreadReturn {
  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { addToast } = useToast();

  const selectThread = useCallback(async (threadId: string) => {
    setIsLoading(true);
    try {
      // Fetch thread and agents in parallel using api methods with auth
      const [threadResponse, agentsResponse] = await Promise.all([
        api.getThread(threadId),
        api.getAgents(),
      ]);

      if (!threadResponse.success || !threadResponse.data) {
        throw new Error('Failed to fetch thread');
      }

      // Build agent ID to name mapping
      const agentIdToName = new Map<string, string>();
      if (agentsResponse.success && agentsResponse.data) {
        agentsResponse.data.forEach((agent: { id: string; name: string }) => {
          agentIdToName.set(agent.id, agent.name);
        });
      }

      const threadData = threadResponse.data.thread;
      const backendMessages = threadResponse.data.messages || [];

      // Transform backend messages to frontend format
      // Backend Message type: { id: number; from: string; content: string; timestamp: string; file_path?: string }
      const transformedMessages: Message[] = (backendMessages as BackendMessage[]).map((msg) => ({
        id: String(msg.id),
        content: msg.content,
        sender: isUserMessage(msg.from) ? 'user' as const : 'agent' as const,
        senderName: extractSenderName(msg.from, agentIdToName),
        timestamp: msg.timestamp,
        status: 'sent' as const,
        filePath: msg.file_path,
      }));

      setThread({
        id: threadData.id,
        title: threadData.topic || threadData.title || 'Thread',
        topic: threadData.topic,
        messages: transformedMessages,
      });
      setMessages(transformedMessages);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load thread';
      addToast({ message: errorMessage, type: 'error' });
      setThread(null);
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  const sendMessage = useCallback(async (content: string) => {
    if (!thread) return;
    if (!content.trim()) return;

    const tempId = `temp-${Date.now()}`;
    const newMessage: Message = {
      id: tempId,
      content,
      sender: 'user',
      timestamp: new Date().toISOString(),
      status: 'sending',
    };

    // Optimistically add message
    setThread(prev => prev ? { ...prev, messages: [...prev.messages, newMessage] } : null);
    setMessages(prev => [...prev, newMessage]);

    const result = await api.sendMessage({
      thread_id: thread.id,
      content,
    });

    if (!result.success) {
      // Mark message as error
      setThread(prev => prev ? {
        ...prev,
        messages: prev.messages.map(msg =>
          msg.id === tempId ? { ...msg, status: 'error' as const } : msg
        ),
      } : null);
      addToast({ message: result.error || 'Failed to send message', type: 'error' });
      return;
    }

    // Update message status to sent - use tempId to find the message
    setThread(prev => prev ? {
      ...prev,
      messages: prev.messages.map(msg =>
        msg.id === tempId ? { ...msg, status: 'sent' as const, id: String(result.data?.id || msg.id) } : msg
      ),
    } : null);
    setMessages(prev => prev.map(msg =>
      msg.id === tempId ? { ...msg, status: 'sent' as const, id: String(result.data?.id || msg.id) } : msg
    ));
  }, [thread, addToast]);

  const retryMessage = useCallback((messageId: string) => {
    const messageToRetry = messages.find(msg => msg.id === messageId);
    if (!messageToRetry) return;

    // Remove the failed message and resend
    setThread(prev => prev ? {
      ...prev,
      messages: prev.messages.filter(msg => msg.id !== messageId),
    } : null);
    setMessages(prev => prev.filter(msg => msg.id !== messageId));

    // Resend the message content
    sendMessage(messageToRetry.content);
  }, [messages, sendMessage]);

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
