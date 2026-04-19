/**
 * LeChat API Client
 *
 * This is a placeholder API module. API calls will be implemented in future phases.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Agent types
export interface Agent {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'busy';
  capabilities?: string[];
  metadata?: Record<string, unknown>;
}

// Conversation types
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

// Thread types
export interface Thread {
  id: string;
  conversationId: string;
  title: string;
  topic?: string;
  createdAt: string;
  updatedAt: string;
}

// Message types
export interface Message {
  id: string;
  threadId: string;
  content: string;
  sender: 'user' | 'agent';
  senderId: string;
  senderName?: string;
  timestamp: string;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'error';
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  type: 'image' | 'file' | 'code';
  url: string;
  name: string;
  size?: number;
}

// API functions - Placeholder implementations
// These will be implemented in future phases when backend is ready

export const api = {
  /**
   * Get all available agents
   */
  async getAgents(): Promise<ApiResponse<Agent[]>> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/agents`);
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('API: getAgents failed', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch agents' };
    }
  },

  /**
   * Get conversations for current user
   * Note: Backend returns {conversations: [...]} format
   */
  async getConversations(): Promise<ApiResponse<Conversation[]>> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/conversations`);
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      const json = await response.json();
      // Backend returns {conversations: [...]} - extract the array
      const conversations = json.conversations || [];
      return { success: true, data: conversations };
    } catch (error) {
      console.error('API: getConversations failed', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch conversations' };
    }
  },

  /**
   * Get threads for a conversation
   */
  async getThreads(conversationId: string): Promise<ApiResponse<Thread[]>> {
    // Placeholder - will be implemented
    console.log('API: getThreads called (placeholder)', conversationId);
    return { success: true, data: [] };
  },

  /**
   * Get messages for a thread
   */
  async getMessages(threadId: string): Promise<ApiResponse<Message[]>> {
    // Placeholder - will be implemented
    console.log('API: getMessages called (placeholder)', threadId);
    return { success: true, data: [] };
  },

  /**
   * Send a message to a thread
   */
  async sendMessage(data: {
    thread_id: string;
    content: string;
    file_path?: string;
    quote_message_id?: number;
    mention?: string[];
  }): Promise<ApiResponse<Message>> {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE_URL}/api/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to send message' }));
        return { success: false, error: error.error || 'Failed to send message' };
      }
      const json = await response.json();
      return { success: true, data: json.message };
    } catch (error) {
      console.error('API: sendMessage failed', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to send message' };
    }
  },

  /**
   * Mark a conversation as read
   */
  async markAsRead(conversationId: string): Promise<ApiResponse<void>> {
    // Placeholder - will be implemented
    console.log('API: markAsRead called (placeholder)', conversationId);
    return { success: true };
  },

  /**
   * Create a new thread
   */
  async createThread(conversationId: string, title: string, topic?: string): Promise<ApiResponse<Thread>> {
    // Placeholder - will be implemented
    console.log('API: createThread called (placeholder)', conversationId, title, topic);
    return { success: true, data: undefined };
  },

  /**
   * Get SSE endpoint for real-time updates
   */
  getSSEUrl(): string {
    const token = localStorage.getItem('token');
    if (token) {
      return `${API_BASE_URL}/api/events?token=${encodeURIComponent(token)}`;
    }
    return '';
  },
};

export default api;
