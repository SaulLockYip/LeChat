'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export type SSEStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface SSEMessage<T = unknown> {
  type: string;
  data: T;
  timestamp: string;
}

interface UseSSEOptions {
  url?: string;
  autoConnect?: boolean;
  onMessage?: (message: SSEMessage) => void;
  onError?: (error: Event) => void;
  onStatusChange?: (status: SSEStatus) => void;
}

interface UseSSEReturn {
  status: SSEStatus;
  lastMessage: SSEMessage | null;
  messages: SSEMessage[];
  connect: () => void;
  disconnect: () => void;
  send: (message: object) => void;
  clearMessages: () => void;
}

export function useSSE({
  url,
  autoConnect = false,
  onMessage,
  onError,
  onStatusChange,
}: UseSSEOptions = {}): UseSSEReturn {
  const [status, setStatus] = useState<SSEStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<SSEMessage | null>(null);
  const [messages, setMessages] = useState<SSEMessage[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Use refs to store latest callbacks to avoid dependency issues
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);
  const onStatusChangeRef = useRef(onStatusChange);

  // Keep refs updated
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  const updateStatus = useCallback((newStatus: SSEStatus) => {
    setStatus(newStatus);
    onStatusChangeRef.current?.(newStatus);
  }, []);

  const connect = useCallback(() => {
    if (!url) {
      console.warn('useSSE: No URL provided');
      return;
    }

    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    updateStatus('connecting');

    try {
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        updateStatus('connected');
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const message: SSEMessage = {
            type: event.type || 'message',
            data,
            timestamp: new Date().toISOString(),
          };
          setLastMessage(message);
          setMessages(prev => [...prev, message]);
          onMessageRef.current?.(message);
        } catch (e) {
          console.error('useSSE: Failed to parse message', e);
        }
      };

      eventSource.onerror = (error) => {
        updateStatus('error');
        onErrorRef.current?.(error);

        // Auto-reconnect after 3 seconds
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
            connect();
          }
        }, 3000);
      };

      // Custom event types can be handled via addEventListener
      // eventSource.addEventListener('custom-type', (event) => { ... });
    } catch (error) {
      console.error('useSSE: Failed to connect', error);
      updateStatus('error');
    }
  }, [url, updateStatus]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    updateStatus('disconnected');
  }, [updateStatus]);

  const send = useCallback((message: object) => {
    // SSE is read-only, but this can be used for logging/debugging
    console.log('useSSE: send called (SSE is receive-only)', message);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setLastMessage(null);
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect && url) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, url]);

  return {
    status,
    lastMessage,
    messages,
    connect,
    disconnect,
    send,
    clearMessages,
  };
}
