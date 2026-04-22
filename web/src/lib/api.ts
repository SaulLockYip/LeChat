/**
 * LeChat API Client
 *
 * This is a placeholder API module. API calls will be implemented in future phases.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

export interface ApiError extends Error {
  status?: number;
  isNetworkError?: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Error message mappings for HTTP status codes
const ERROR_MESSAGES: Record<number, string> = {
  401: 'Session expired. Please refresh the page.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource was not found.',
  500: 'Server error. Please try again later.',
  502: 'Service temporarily unavailable.',
  503: 'Service temporarily unavailable. Please try again later.',
};

// Default messages for network errors
const NETWORK_ERROR_MESSAGE = 'Unable to connect. Please check your connection.';
const GENERIC_ERROR_MESSAGE = 'An unexpected error occurred. Please try again.';

/**
 * Creates an ApiError with appropriate message based on HTTP status or error type
 */
function createApiError(error: unknown, response?: Response): ApiError {
  if (!response) {
    // Network error (no response)
    return {
      name: 'NetworkError',
      message: NETWORK_ERROR_MESSAGE,
      isNetworkError: true,
    };
  }

  const status = response.status;

  if (status === 401) {
    return {
      name: 'UnauthorizedError',
      message: ERROR_MESSAGES[401],
      status,
    };
  }

  if (status === 403) {
    return {
      name: 'ForbiddenError',
      message: ERROR_MESSAGES[403],
      status,
    };
  }

  if (status === 404) {
    return {
      name: 'NotFoundError',
      message: ERROR_MESSAGES[404],
      status,
    };
  }

  if (status >= 500) {
    return {
      name: 'ServerError',
      message: ERROR_MESSAGES[status] || GENERIC_ERROR_MESSAGE,
      status,
    };
  }

  // For other HTTP errors, use the status text or a generic message
  return {
    name: 'ApiError',
    message: `Request failed with status ${status}`,
    status,
  };
}

/**
 * Checks if an error is an ApiError (has status or isNetworkError properties)
 */
function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    (('status' in error && typeof (error as ApiError).status === 'number') ||
      ('isNetworkError' in error && (error as ApiError).isNetworkError === true))
  );
}

/**
 * Extracts error message from response body or returns a fallback
 */
async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.json();
    return data.error || data.message || ERROR_MESSAGES[response.status] || `Request failed with status ${response.status}`;
  } catch {
    return ERROR_MESSAGES[response.status] || `Request failed with status ${response.status}`;
  }
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
  status?: 'active' | 'closed';
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

// Backend message format (different from frontend Message)
export interface BackendMessage {
  id: number;
  from: string;
  content: string;
  timestamp: string;
  file_path?: string;
}

// API functions - Placeholder implementations
// These will be implemented in future phases when backend is ready

export const api = {
  /**
   * Get all available agents
   */
  async getAgents(): Promise<ApiResponse<Agent[]>> {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE_URL}/api/agents`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const error = createApiError(null, response);
        error.message = await extractErrorMessage(response);
        throw error;
      }
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('API: getAgents failed', error);
      const apiError = isApiError(error) ? error : createApiError(error);
      return { success: false, error: apiError.message };
    }
  },

  /**
   * Get conversations for current user
   * Note: Backend returns {conversations: [...]} format
   */
  async getConversations(): Promise<ApiResponse<Conversation[]>> {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE_URL}/api/conversations`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const error = createApiError(null, response);
        error.message = await extractErrorMessage(response);
        throw error;
      }
      const json = await response.json();
      // Backend returns {conversations: [...]} - extract the array
      const conversations = json.conversations || [];
      return { success: true, data: conversations };
    } catch (error) {
      console.error('API: getConversations failed', error);
      const apiError = isApiError(error) ? error : createApiError(error);
      return { success: false, error: apiError.message };
    }
  },

  /**
   * Get threads for a conversation
   */
  async getThreads(conversationId: string): Promise<ApiResponse<Thread[]>> {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE_URL}/api/threads?conversation_id=${encodeURIComponent(conversationId)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const error = createApiError(null, response);
        error.message = await extractErrorMessage(response);
        throw error;
      }
      const json = await response.json();
      return { success: true, data: json.threads || [] };
    } catch (error) {
      console.error('API: getThreads failed', error);
      const apiError = isApiError(error) ? error : createApiError(error);
      return { success: false, error: apiError.message };
    }
  },

  /**
   * Get messages for a thread
   */
  async getMessages(threadId: string): Promise<ApiResponse<Message[]>> {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE_URL}/api/threads/${encodeURIComponent(threadId)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const error = createApiError(null, response);
        error.message = await extractErrorMessage(response);
        throw error;
      }
      const json = await response.json();
      return { success: true, data: json.messages || [] };
    } catch (error) {
      console.error('API: getMessages failed', error);
      const apiError = isApiError(error) ? error : createApiError(error);
      return { success: false, error: apiError.message };
    }
  },

  /**
   * Get thread with messages
   * Backend returns { thread: {...}, messages: [...] }
   */
  async getThread(threadId: string): Promise<ApiResponse<{ thread: { id: string; title?: string; topic?: string }; messages: BackendMessage[] }>> {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE_URL}/api/threads/${encodeURIComponent(threadId)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const error = createApiError(null, response);
        error.message = await extractErrorMessage(response);
        throw error;
      }
      const json = await response.json();
      return { success: true, data: json };
    } catch (error) {
      console.error('API: getThread failed', error);
      const apiError = isApiError(error) ? error : createApiError(error);
      return { success: false, error: apiError.message };
    }
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
        const error = createApiError(null, response);
        error.message = await extractErrorMessage(response);
        throw error;
      }
      const json = await response.json();
      return { success: true, data: json.message };
    } catch (error) {
      console.error('API: sendMessage failed', error);
      const apiError = isApiError(error) ? error : createApiError(error);
      return { success: false, error: apiError.message };
    }
  },

  /**
   * Mark a conversation as read
   */
  async markAsRead(conversationId: string): Promise<ApiResponse<void>> {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE_URL}/api/conversations/${encodeURIComponent(conversationId)}/read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const error = createApiError(null, response);
        error.message = await extractErrorMessage(response);
        throw error;
      }
      return { success: true };
    } catch (error) {
      console.error('API: markAsRead failed', error);
      const apiError = isApiError(error) ? error : createApiError(error);
      return { success: false, error: apiError.message };
    }
  },

  /**
   * Create a new thread
   */
  async createThread(conversationId: string, title: string, topic?: string): Promise<ApiResponse<Thread>> {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE_URL}/api/threads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ conversation_id: conversationId, title, topic }),
      });
      if (!response.ok) {
        const error = createApiError(null, response);
        error.message = await extractErrorMessage(response);
        throw error;
      }
      const json = await response.json();
      return { success: true, data: json.thread };
    } catch (error) {
      console.error('API: createThread failed', error);
      const apiError = isApiError(error) ? error : createApiError(error);
      return { success: false, error: apiError.message };
    }
  },

  /**
   * Update a thread's topic or status
   */
  async updateThread(id: string, data: { topic?: string; status?: 'active' | 'closed' }): Promise<ApiResponse<Thread>> {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE_URL}/api/threads/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = createApiError(null, response);
        error.message = await extractErrorMessage(response);
        throw error;
      }
      const json = await response.json();
      return { success: true, data: json.thread };
    } catch (error) {
      console.error('API: updateThread failed', error);
      const apiError = isApiError(error) ? error : createApiError(error);
      return { success: false, error: apiError.message };
    }
  },

  /**
   * Get current user info
   */
  async getUserInfo(): Promise<ApiResponse<{ id: string; name: string; title: string; created_at: string; updated_at: string }>> {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE_URL}/api/user/info`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch user info' };
    }
  },

  /**
   * Update current user profile
   */
  async updateUser(data: { name?: string; title?: string }): Promise<ApiResponse<{ id: string; name: string; title: string; created_at: string; updated_at: string }>> {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE_URL}/api/user`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = createApiError(null, response);
        error.message = await extractErrorMessage(response);
        throw error;
      }
      const result = await response.json();
      return { success: true, data: result };
    } catch (error) {
      console.error('API: updateUser failed', error);
      const apiError = isApiError(error) ? error : createApiError(error);
      return { success: false, error: apiError.message };
    }
  },

  /**
   * Delete a group conversation
   * Note: Only group conversations (type 'channel') can be deleted. DM returns error.
   */
  async deleteConversation(id: string): Promise<ApiResponse<void>> {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE_URL}/api/conversations/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const error = createApiError(null, response);
        error.message = await extractErrorMessage(response);
        throw error;
      }
      return { success: true };
    } catch (error) {
      console.error('API: deleteConversation failed', error);
      const apiError = isApiError(error) ? error : createApiError(error);
      return { success: false, error: apiError.message };
    }
  },

  /**
   * Update a conversation (group name, add/remove agents)
   * PUT /api/conversations/:id
   */
  async updateConversation(
    conversationId: string,
    data: {
      group_name?: string;
      add_agent_ids?: string[];
      remove_agent_ids?: string[];
    }
  ): Promise<ApiResponse<{ id: string; type: string; group_name?: string; lechat_agent_ids?: string[] }>> {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE_URL}/api/conversations/${encodeURIComponent(conversationId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = createApiError(null, response);
        error.message = await extractErrorMessage(response);
        throw error;
      }
      const json = await response.json();
      return { success: true, data: json };
    } catch (error) {
      console.error('API: updateConversation failed', error);
      const apiError = isApiError(error) ? error : createApiError(error);
      return { success: false, error: apiError.message };
    }
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
