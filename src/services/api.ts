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
  ConferBotEndpoints,
  ConferBotNetworkConfig,
} from '../config/constants';
import {
  TRANSCRIPT_EMAIL_PATH,
  transcriptEmailBody,
  transcriptEmailResult,
  type TranscriptEmailResult,
} from '../core/emailTranscript';
import {
  PUSH_REGISTER_PATH,
  PUSH_UNREGISTER_PATH,
  pushRegisterResult,
  pushUnregisterBody,
  type pushRegisterBody,
  type PushRegisterResult,
} from '../core/push';

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
      baseURL: baseURL || ConferBotEndpoints.apiBaseUrl,
      timeout: ConferBotNetworkConfig.apiTimeout,
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

  /**
   * One published help article of this bot, by id (embed-server
   * GET /mobile/knowledge-base/article/:id), for one the help centre data
   * on hand does not hold (a queue-help pick). Null when it is not there.
   */
  async getKBArticle(articleId: string): Promise<any | null> {
    try {
      const response = await this.client.get(`/knowledge-base/article/${encodeURIComponent(articleId)}`);
      return response.data?.success ? response.data.data || null : null;
    } catch {
      return null;
    }
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

  // ********** Transcript Email ********** //
  // "Email me this chat": the server sends the conversation to this address
  // only (embed-server POST /api/v1/mobile/chat/transcript-email; the bot is
  // the X-Bot-ID header's). Never throws: a failure reads as not sent.
  async sendTranscriptEmail(chatSessionId: string, email: string): Promise<TranscriptEmailResult> {
    try {
      const response = await this.client.post(TRANSCRIPT_EMAIL_PATH, transcriptEmailBody(chatSessionId, email), {
        validateStatus: () => true,
      });
      return transcriptEmailResult(response.status, response.data);
    } catch {
      return { ok: false };
    }
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
  // Register the device's push token with a conversation (embed-server
  // POST /api/v1/mobile/push/register, docs/mobile-push.md): chatSessionId
  // is required, tokenType says FCM or APNs. Never throws: a failure reads
  // as the server's error code.
  async registerPushToken(body: ReturnType<typeof pushRegisterBody>): Promise<PushRegisterResult> {
    try {
      const response = await this.client.post(PUSH_REGISTER_PATH, body, { validateStatus: () => true });
      return pushRegisterResult(response.status, response.data);
    } catch {
      return { ok: false, error: 'NETWORK' };
    }
  }

  // Unregister the token (logout, the visitor cleared). Never throws.
  async unregisterPushToken(token: string): Promise<boolean> {
    try {
      const response = await this.client.post(PUSH_UNREGISTER_PATH, pushUnregisterBody(token), { validateStatus: () => true });
      return response.status >= 200 && response.status < 300 && response.data?.success === true;
    } catch {
      return false;
    }
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
