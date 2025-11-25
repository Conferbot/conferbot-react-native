import axios, { AxiosInstance } from 'axios';
import type {
  ApiResponse,
  ChatbotConfig,
  ChatSession,
  KnowledgeBaseArticle,
} from '../types';
import {
  DEFAULT_API_BASE_URL,
  API_TIMEOUT,
  HEADER_API_KEY,
  HEADER_BOT_ID,
  HEADER_PLATFORM,
  PLATFORM_IDENTIFIER,
} from '../config/constants';

// Create axios instance with default config
class ConferBotAPI {
  private client: AxiosInstance;
  private apiKey: string;
  private botId: string;

  constructor(apiKey: string, botId: string, baseURL?: string) {
    this.apiKey = apiKey;
    this.botId = botId;

    // Initialize axios client
    this.client = axios.create({
      baseURL: baseURL || DEFAULT_API_BASE_URL,
      timeout: API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        [HEADER_API_KEY]: apiKey,
        [HEADER_BOT_ID]: botId,
        [HEADER_PLATFORM]: PLATFORM_IDENTIFIER,
      },
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        if (__DEV__) {
          console.log('[ConferBot API] Request:', config.method?.toUpperCase(), config.url);
        }
        return config;
      },
      (error) => {
        if (__DEV__) {
          console.error('[ConferBot API] Request Error:', error);
        }
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        if (__DEV__) {
          console.log('[ConferBot API] Response:', response.status, response.config.url);
        }
        return response;
      },
      (error) => {
        if (__DEV__) {
          console.error('[ConferBot API] Response Error:', error.response?.status, error.message);
        }
        return Promise.reject(error);
      }
    );
  }

  // ********** Chatbot Methods ********** //
  // Get chatbot configuration
  async getChatbotConfig(): Promise<ApiResponse<ChatbotConfig>> {
    const response = await this.client.get(`/chatbot/${this.botId}`);
    return response.data;
  }

  // Get chatbot knowledge base
  async getKnowledgeBase(): Promise<ApiResponse<KnowledgeBaseArticle[]>> {
    const response = await this.client.get(`/chatbot/${this.botId}/kb`);
    return response.data;
  }

  // ********** Session Methods ********** //
  // Initialize a new chat session
  async initSession(userId?: string): Promise<ApiResponse<ChatSession>> {
    const response = await this.client.post('/session/init', {
      botId: this.botId,
      userId,
      platform: PLATFORM_IDENTIFIER,
    });
    return response.data;
  }

  // Get session history
  async getSessionHistory(chatSessionId: string): Promise<ApiResponse<{ record: any[] }>> {
    const response = await this.client.get(`/session/${chatSessionId}`);
    return response.data;
  }

  // Send a message
  async sendMessage(
    chatSessionId: string,
    message: string,
    metadata?: Record<string, any>
  ): Promise<ApiResponse<any>> {
    const response = await this.client.post(`/session/${chatSessionId}/message`, {
      message,
      metadata,
      timestamp: Date.now(),
    });
    return response.data;
  }

  // ********** Handover Methods ********** //
  // Request live agent handover
  async requestHandover(
    chatSessionId: string,
    reason?: string
  ): Promise<ApiResponse<{ handoverId: string; status: string }>> {
    const response = await this.client.post('/handover/request', {
      chatSessionId,
      reason,
    });
    return response.data;
  }

  // Get handover status
  async getHandoverStatus(
    chatSessionId: string
  ): Promise<ApiResponse<{ status: string; agent?: any }>> {
    const response = await this.client.get(`/handover/${chatSessionId}/status`);
    return response.data;
  }

  // ********** File Upload Methods ********** //
  // Upload file to chat
  async uploadFile(
    chatSessionId: string,
    file: {
      uri: string;
      type: string;
      name: string;
    }
  ): Promise<ApiResponse<{ fileUrl: string; fileName: string }>> {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      type: file.type,
      name: file.name,
    } as any);

    const response = await this.client.post(`/session/${chatSessionId}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  // ********** Push Notification Methods ********** //
  // Register push notification token
  async registerPushToken(
    token: string,
    platform: 'ios' | 'android'
  ): Promise<ApiResponse<{ success: boolean }>> {
    const response = await this.client.post('/push/register', {
      token,
      platform,
      botId: this.botId,
    });
    return response.data;
  }

  // Unregister push notification token
  async unregisterPushToken(token: string): Promise<ApiResponse<{ success: boolean }>> {
    const response = await this.client.post('/push/unregister', {
      token,
      botId: this.botId,
    });
    return response.data;
  }

  // ********** Analytics Methods ********** //
  // Track chat event
  async trackEvent(
    chatSessionId: string,
    eventName: string,
    eventData?: Record<string, any>
  ): Promise<void> {
    try {
      await this.client.post('/analytics/event', {
        chatSessionId,
        botId: this.botId,
        eventName,
        eventData,
        timestamp: Date.now(),
      });
    } catch (error) {
      // Silent fail for analytics
      if (__DEV__) {
        console.warn('[ConferBot API] Analytics tracking failed:', error);
      }
    }
  }
}

export default ConferBotAPI;
