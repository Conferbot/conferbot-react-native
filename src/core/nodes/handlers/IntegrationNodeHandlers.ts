/**
 * IntegrationNodeHandlers.ts
 *
 * Integration node handlers for the Conferbot React Native SDK.
 * Implements all integration node types for external service communication.
 *
 * Includes handlers for:
 * - Webhook: HTTP requests to external APIs
 * - GPT: AI-powered responses
 * - Human Handover: Live agent handover
 * - Delay: Flow pausing
 * - Email/Gmail: Email sending
 * - Slack/Discord: Messaging platforms
 * - WhatsApp/Telegram: Communication channels
 * - Google Sheets/Calendar/Analytics: Google integrations
 * - HubSpot/Salesforce/Mailchimp/ZohoCRM: CRM integrations
 * - Zapier/Airtable/Notion: Automation and database integrations
 * - Stripe: Payment processing
 */

import { BaseNodeHandler, NodeResult, NodeUIState } from '../NodeHandler';
import { ChatState } from '../../state/ChatState';
import { NodeHandlerRegistry } from '../NodeHandlerRegistry';
import type {
  HandoverStage,
  PreChatFormConfig,
  PostChatSurveyConfig,
  AgentInfo,
  QueueInfo,
} from '../../../components/Handover/types';

import {
  WebhookHandler as WebhookHandlerService,
  WebhookRequest,
  createWebhookHandler,
} from '../../../services/WebhookHandler';

import {
  HttpMethod,
  AuthenticationConfig,
  AuthenticationType,
  ResponseExtractConfig,
} from '../../../utils/WebhookUtils';

import {
  validateEmailList,
  validateEmailConfig,
  formatEmailBody,
  formatSlackMessage,
  createSlackBlock,
  createSlackAttachment,
  formatDiscordMessage,
  createDiscordEmbed,
  formatHubSpotContact,
  formatZohoCRMRecord,
  formatSalesforceRecord,
  formatAirtableFields,
  formatNotionProperties,
  createNotionBlock,
  formatStripeAmount,
  formatStripeMetadata,
  extractContactData,
  removeEmptyValues,
  deepResolveVariables,
  validateWebhookUrl,
} from '../../utils/IntegrationUtils';

import type {
  SocketClient,
  EmailConfig,
  EmailPayload,
  SlackConfig,
  DiscordConfig,
  GoogleSheetsConfig,
  GoogleSheetsPayload,
  GoogleCalendarConfig,
  GmailConfig,
  GoogleAnalyticsConfig,
  ZohoCRMConfig,
  ZohoCRMPayload,
  ZapierConfig,
  AirtableConfig,
  AirtablePayload,
  NotionConfig,
  NotionPayload,
  StripeConfig,
  StripePayload,
  ContactData,
} from '../../utils/IntegrationTypes';

import { IntegrationSocketEvents } from '../../utils/IntegrationTypes';
import { buildHandoverPayload } from '../../handoverPayload';
import { queueSelfResolvePayload } from '../../handoverState';
import { surveyRatingPayload } from '../../liveChat';
import { stripHtml } from './DisplayNodeHandlers';
import { ctxOf, FlowContext } from '../../flow/context';
import { EN, isValidEmail, isValidPhone, normalizePhone, ownerTextOr } from '../../flow/inputs';
import { liveEventId } from '../../liveEvents';

// ========================================
// ADDITIONAL TYPES
// ========================================

/** API call response */
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

/** Extended Webhook configuration with all authentication options */
interface WebhookConfig {
  url: string;
  method: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
  variableName?: string;
  timeout?: number;
  retryCount?: number;
  authentication?: AuthenticationConfig;
  responseExtract?: ResponseExtractConfig;
  includeAnswerVariables?: boolean;
  proceedOnError?: boolean;
}

/** Human handover configuration */
interface HumanHandoverConfig {
  department?: string;
  priority?: string;
  showPreChatForm?: boolean;
  preChatFields?: Array<{
    id: string;
    label: string;
    type: 'text' | 'email' | 'phone' | 'select';
    required?: boolean;
    options?: Array<{ label: string; value: unknown }>;
  }>;
  customQuestions?: Array<{
    id: string;
    question: string;
    type: 'text' | 'email' | 'phone' | 'select';
    required?: boolean;
    options?: Array<{ label: string; value: string }>;
  }>;
  departments?: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
  waitMessage?: string;
  connectedMessage?: string;
  noAgentsMessage?: string;
  timeoutMessage?: string;
  timeoutSeconds?: number;
  showPostChatSurvey?: boolean;
  surveyConfig?: PostChatSurveyConfig;
}

/** Extended HumanHandover UI state with full flow support */
interface ExtendedHumanHandoverUIState extends NodeUIState.HumanHandover {
  extendedStage?: HandoverStage;
  queueInfo?: QueueInfo;
  agent?: AgentInfo;
  isAgentTyping?: boolean;
  preChatConfig?: PreChatFormConfig;
  surveyConfig?: PostChatSurveyConfig;
  customQuestions?: Array<{
    id: string;
    question: string;
    type: 'text' | 'email' | 'phone' | 'select';
    required?: boolean;
    options?: Array<{ label: string; value: string }>;
  }>;
  departments?: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
  errorMessage?: string;
}

/** Communication platform message config */
interface CommunicationConfig {
  message: string;
  channel?: string;
  webhookUrl?: string;
  additionalData?: Record<string, unknown>;
}

/** CRM configuration (HubSpot, Salesforce, Mailchimp) */
interface CRMConfig {
  action: 'createContact' | 'updateContact' | 'createDeal' | 'addToList' | 'createLead' | 'subscribe';
  contactData?: Record<string, unknown>;
  listId?: string;
  dealData?: Record<string, unknown>;
  webhookUrl?: string;
  variableName?: string;
  proceedOnError?: boolean;
}

// ========================================
// BASE INTEGRATION HANDLER
// ========================================

/**
 * Base class for integration node handlers with shared utilities.
 * Provides common functionality for API calls, socket events, and variable resolution.
 */
abstract class BaseIntegrationHandler extends BaseNodeHandler {
  protected socketClient: SocketClient | null = null;
  protected apiBaseUrl: string = '';
  protected defaultTimeout: number = 30000;

  /**
   * Sets the socket client for real-time communication
   * @param client - Socket client instance
   */
  setSocketClient(client: SocketClient): void {
    this.socketClient = client;
  }

  /**
   * Sets the API base URL for fallback HTTP requests
   * @param url - Base URL for API calls
   */
  setApiBaseUrl(url: string): void {
    this.apiBaseUrl = url;
  }

  /**
   * Makes an HTTP API call with timeout and error handling
   * @param url - Request URL
   * @param method - HTTP method
   * @param data - Request body data
   * @param headers - Request headers
   * @param timeout - Request timeout in milliseconds
   * @returns API response object
   */
  protected async makeApiCall<T = unknown>(
    url: string,
    method: HttpMethod,
    data?: unknown,
    headers?: Record<string, string>,
    timeout?: number
  ): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      timeout || this.defaultTimeout
    );

    try {
      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...headers,
      };

      const fetchOptions: RequestInit = {
        method,
        headers: requestHeaders,
        signal: controller.signal,
      };

      if (data && method !== 'GET') {
        fetchOptions.body = JSON.stringify(data);
      }

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      let responseData: T | undefined;
      const contentType = response.headers.get('content-type');

      if (contentType?.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = (await response.text()) as unknown as T;
      }

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          statusCode: response.status,
          data: responseData,
        };
      }

      return {
        success: true,
        data: responseData,
        statusCode: response.status,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            success: false,
            error: 'Request timeout',
          };
        }
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: false,
        error: 'Unknown error occurred',
      };
    }
  }

  /**
   * Emits a socket event to the server
   * @param event - Event name
   * @param payload - Event payload
   * @returns True if event was emitted successfully
   */
  protected emitSocketEvent(event: string, payload: unknown): boolean {
    if (!this.socketClient) {
      return false;
    }

    // Do not report success when the socket is disconnected - emitToServer
    // silently drops events in that case
    const client = this.socketClient as SocketClient & { isConnected?: () => boolean };
    const connected = typeof client.isConnected === 'function'
      ? client.isConnected()
      : client.connected !== false;
    if (!connected) {
      return false;
    }

    try {
      this.socketClient.emitToServer(event, payload);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Waits for the server's 'integration-result' event for a specific node
   * (matches the web widget's _executeNativeIntegration result handling).
   *
   * On success, applies `answerVariable`/`answerValue` and every entry of
   * `columnMappedValues` (Google Sheets reads) into state as answer variables
   * so ${var} resolution works downstream.
   *
   * @param nodeId    - node identifier used to filter results
   * @param state     - current ChatState
   * @param timeoutMs - how long to wait before giving up (default 30s)
   * @returns the result payload, or null on timeout / unsupported client
   */
  protected waitForIntegrationResult(
    nodeId: string,
    state: ChatState,
    timeoutMs: number = 30000,
  ): Promise<Record<string, any> | null> {
    return new Promise((resolve) => {
      const client = this.socketClient;
      if (!client?.on) {
        resolve(null);
        return;
      }

      let timer: ReturnType<typeof setTimeout> | undefined;

      const listener = (result: any) => {
        if (!result || result.nodeId !== nodeId) return;
        if (timer !== undefined) {
          clearTimeout(timer);
        }
        client.off?.('integration-result', listener as (data: unknown) => void);

        if (result.success) {
          if (result.answerVariable && result.answerValue !== undefined) {
            state.setAnswer(nodeId, result.answerVariable, result.answerValue, nodeId);
          }
          if (result.columnMappedValues && typeof result.columnMappedValues === 'object') {
            for (const [variableName, value] of Object.entries(result.columnMappedValues)) {
              if (variableName && value !== undefined) {
                state.setAnswer(nodeId, variableName, value, nodeId);
              }
            }
          }
        }
        resolve(result);
      };

      timer = setTimeout(() => {
        client.off?.('integration-result', listener as (data: unknown) => void);
        resolve(null);
      }, timeoutMs);

      client.on('integration-result', listener as (data: unknown) => void);
    });
  }

  /**
   * Resolves all variables in an object recursively
   * @param obj - Object with variable placeholders
   * @param state - Chat state for variable resolution
   * @returns Object with resolved variables
   */
  protected resolveObjectVariables(
    obj: Record<string, unknown>,
    state: ChatState
  ): Record<string, unknown> {
    return deepResolveVariables(obj, (text) => state.resolveVariables(text));
  }

  /**
   * Builds common payload with session data
   * @param state - Chat state
   * @returns Common payload fields
   */
  protected buildCommonPayload(state: ChatState): Record<string, unknown> {
    return {
      sessionId: state.sessionId,
      botId: state.botId,
      timestamp: new Date().toISOString(),
      userMetadata: state.getUserMetadata(),
      answers: state.getAllAnswers(),
    };
  }

  /**
   * Emits the standardized 'execute-integration' socket event that the
   * embed-server expects.  The server dispatches based on `nodeType`.
   *
   * @param nodeType  - e.g. 'email-node', 'slack-node', 'gmail-node'
   * @param nodeId    - unique node identifier
   * @param nodeData  - the full node data object (inputs / config)
   * @param state     - current ChatState (provides session, bot, workspace, answers)
   * @returns true if the event was emitted
   */
  protected emitIntegrationEvent(
    nodeType: string,
    nodeId: string,
    nodeData: Record<string, unknown>,
    state: ChatState,
  ): boolean {
    const userMetadata = state.getUserMetadata();

    return this.emitSocketEvent('execute-integration', {
      nodeType,
      nodeId,
      nodeData,
      chatSessionId: state.sessionId,
      chatbotId: state.botId,
      workspaceId: state.getVariable('_workspaceId') || '',
      // The server expects an array of { key, value } objects (it reads
      // .key/.value for ${var} resolution) - same mapping as
      // ChatState.buildResponseData
      answerVariables: state.getAnswerVariables().map((av) => ({
        key: av.variableName,
        value: av.value,
      })),
      visitorData: {
        name: userMetadata.name || '',
        email: userMetadata.email || '',
        phone: userMetadata.phone || '',
      },
    });
  }

  /**
   * Stores the integration result in state and emits tracking event
   * @param state - Chat state
   * @param prefix - Variable name prefix
   * @param success - Whether operation succeeded
   * @param data - Response data
   * @param error - Error message if failed
   */
  protected storeIntegrationResult(
    state: ChatState,
    prefix: string,
    success: boolean,
    data?: unknown,
    error?: string
  ): void {
    state.setVariable(`_${prefix}Success`, success);
    if (success && data) {
      state.setVariable(`_${prefix}Response`, data);
    }
    if (!success && error) {
      state.setVariable(`_${prefix}Error`, error);
    }
  }
}

// ========================================
// 1. WEBHOOK HANDLER (Enhanced)
// ========================================

/**
 * Handles webhook node - makes HTTP requests to configured URLs.
 *
 * Features:
 * - Support all HTTP methods (GET, POST, PUT, DELETE, PATCH)
 * - Custom headers support
 * - Request body with variable interpolation
 * - Authentication (Bearer, Basic, API Key, OAuth2, Custom)
 * - Timeout configuration
 * - Retry logic with exponential backoff
 * - Response extraction into variables
 * - URL validation and security checks
 */
export class WebhookHandler extends BaseIntegrationHandler {
  readonly nodeType = 'webhook-node';

  private webhookService: WebhookHandlerService;

  constructor() {
    super();
    this.webhookService = createWebhookHandler({
      defaultTimeoutMs: 30000,
      defaultMaxRetries: 3,
      allowLocalhost: __DEV__ ?? false,
      debug: __DEV__ ?? false,
    });
  }

  /**
   * webhook-node: its answerVariable is registered at once and filled later;
   * the call runs in the background and the flow moves on at once (web
   * integrations.ts _handleWebhookNode).
   */
  async handle(node: Record<string, unknown>, state: ChatState): Promise<NodeResult> {
    const data = (this.getNodeData(node) || {}) as Record<string, unknown>;
    const nodeId = this.getNodeId(node);
    const answerVariable = this.getString(data, 'answerVariable');
    if (answerVariable) state.registerAnswerVariable(nodeId, answerVariable);
    void this.run(node, state).catch(() => undefined);
    return NodeResult.next();
  }

  /** The request, in the background; the reply fills the step's variable. */
  private async run(node: Record<string, unknown>, state: ChatState): Promise<void> {
    const data = this.getNodeData(node);
    if (!data) return;
    const config = this.parseWebhookConfig(data);
    if (!config.url) return;
    const urlValidation = validateWebhookUrl(config.url);
    if (!urlValidation.isValid) return;

    const request: WebhookRequest = {
      url: urlValidation.sanitizedUrl || config.url,
      method: config.method,
      headers: config.headers,
      body: config.body,
      authentication: this.parseAuthentication(data),
      timeoutMs: config.timeout,
      maxRetries: config.retryCount,
      responseExtract: this.parseResponseExtract(data),
      variables: this.buildVariableContext(state),
      includeAnswerVariables: config.includeAnswerVariables,
      answerVariables: state.getAllAnswers(),
      proceedOnError: config.proceedOnError,
      allowLocalhost: __DEV__ ?? false,
    };

    const result = await this.webhookService.execute(request);
    for (const [key, value] of Object.entries(result.extractedVariables)) {
      state.setVariable(key, value);
    }
    if (result.success && result.response?.data !== undefined) {
      state.setAnswerVariable(this.getNodeId(node), result.response.data);
    } else if (!result.success) {
      this.storeIntegrationResult(state, 'webhook', false, undefined, result.error);
    }
  }

  private parseWebhookConfig(data: Record<string, unknown>): WebhookConfig {
    return {
      url: this.getString(data, 'url') || this.getString(data, 'webhookUrl'),
      method: (this.getString(data, 'method', 'POST').toUpperCase() as HttpMethod),
      headers: data.headers as Record<string, string>,
      body: data.body || data.payload,
      variableName: this.getString(data, 'variableName') || this.getString(data, 'answerVariable'),
      timeout: this.getNumber(data, 'timeout', 30000),
      retryCount: this.getNumber(data, 'retryCount') || this.getNumber(data, 'maxRetries', 3),
      includeAnswerVariables: this.getBoolean(data, 'includeAnswerVariables', false),
      proceedOnError: this.getBoolean(data, 'proceedOnError', true),
    };
  }

  private parseAuthentication(data: Record<string, unknown>): AuthenticationConfig | undefined {
    const auth = data.authentication as Record<string, unknown> | undefined;
    if (!auth) return undefined;

    const authType = this.detectAuthType(auth);
    if (authType === 'none') return undefined;

    const config: AuthenticationConfig = { type: authType };

    switch (authType) {
      case 'bearer':
        config.token = auth.token as string || auth.bearerToken as string;
        break;
      case 'basic':
        config.username = auth.username as string;
        config.password = auth.password as string;
        break;
      case 'apiKey':
        config.apiKeyName = auth.key as string || auth.headerName as string || 'X-API-Key';
        config.apiKeyValue = auth.value as string || auth.apiKey as string;
        config.apiKeyLocation = auth.location === 'query' ? 'query' : 'header';
        break;
      case 'oauth2':
        config.tokenUrl = auth.tokenUrl as string;
        config.clientId = auth.clientId as string;
        config.clientSecret = auth.clientSecret as string;
        config.scope = auth.scope as string;
        config.grantType = auth.grantType as string || 'client_credentials';
        break;
      case 'custom':
        config.tokenUrl = auth.tokenUrl as string;
        config.username = auth.username as string;
        config.password = auth.password as string;
        config.tokenPath = auth.tokenPath as string || 'access_token';
        config.expiresInPath = auth.expiresInPath as string || 'expires_in';
        break;
    }

    return config;
  }

  private detectAuthType(auth: Record<string, unknown>): AuthenticationType {
    if (auth.type) {
      const type = (auth.type as string).toLowerCase();
      switch (type) {
        case 'bearer': return 'bearer';
        case 'basic': return 'basic';
        case 'apikey':
        case 'api_key':
        case 'api-key': return 'apiKey';
        case 'oauth2':
        case 'oauth': return 'oauth2';
        case 'custom':
        case 'token': return 'custom';
        case 'none': return 'none';
      }
    }

    if (auth.token && !auth.tokenUrl) return 'bearer';
    if (auth.apiKey || auth.headerName) return 'apiKey';
    if (auth.clientId && auth.clientSecret) return 'oauth2';
    if (auth.tokenUrl && auth.username) return 'custom';
    if (auth.username && auth.password && !auth.tokenUrl) return 'basic';

    return 'none';
  }

  private parseResponseExtract(data: Record<string, unknown>): ResponseExtractConfig | undefined {
    const extract = data.responseExtract as Record<string, unknown> || data.extract as Record<string, unknown>;
    if (!extract) {
      const variableName = this.getString(data, 'variableName') || this.getString(data, 'answerVariable');
      if (variableName) {
        return {
          storeFullResponse: true,
          fullResponseVariableName: variableName,
        };
      }
      return undefined;
    }

    const config: ResponseExtractConfig = {};

    if (extract.path) {
      config.path = extract.path as string;
      config.variableName = extract.variableName as string || this.getString(data, 'variableName');
    }

    if (Array.isArray(extract.extractions)) {
      config.extractions = (extract.extractions as Array<Record<string, unknown>>).map((e) => ({
        path: e.path as string,
        variableName: e.variableName as string,
        defaultValue: e.defaultValue,
      }));
    }

    if (extract.storeFullResponse !== false) {
      config.storeFullResponse = true;
      config.fullResponseVariableName = extract.fullResponseVariableName as string || '_webhookResponse';
    }

    return config;
  }

  private buildVariableContext(state: ChatState): Record<string, unknown> {
    return {
      ...state.getAllVariables(),
      ...state.getAllAnswers(),
      ...state.getUserMetadata(),
      sessionId: state.sessionId,
      botId: state.botId,
      timestamp: new Date().toISOString(),
    };
  }
}

// ========================================
// 2. GPT HANDLER
// ========================================

/**
 * gpt-node: the server makes the AI call with the owner's key (it strips
 * apiKey from every flow it sends): POST {api}/api/v1/bot/:botId/gpt with
 * {nodeId, transcript (last 30 {by, message})} -> {reply}. The reply is
 * shown after 1000 ms of typing; a failed call shows nothing. Either way
 * the flow moves on along the first edge (web gptRequest.ts).
 */
export const GPT_MAX_TURNS = 30;

export class GPTHandler extends BaseIntegrationHandler {
  readonly nodeType = 'gpt-node';

  async handle(node: Record<string, unknown>, state: ChatState): Promise<NodeResult> {
    const nodeId = this.getNodeId(node);
    const ctx = ctxOf(node as Record<string, any>, state);
    const transcript = state
      .getTranscript()
      .filter((e) => (e.type === 'bot' || e.type === 'user') && typeof e.text === 'string' && e.text.trim())
      .slice(-GPT_MAX_TURNS)
      .map((e) => ({ by: e.type, message: e.text as string }));
    const reply = await ctx.api('gpt', { nodeId: String(nodeId), transcript });
    const text = reply.ok && typeof reply.body?.reply === 'string' ? reply.body.reply : '';
    if (!text) {
      this.storeIntegrationResult(state, 'gpt', false, undefined, reply.error || `HTTP ${reply.status}`);
      return NodeResult.next();
    }
    state.addRecord({ _id: nodeId, id: nodeId, shape: 'gpt-node-response', value: text, time: new Date().toISOString() } as any);
    await ctx.typing(1000);
    state.addBotMessage(text, nodeId, this.nodeType);
    this.storeIntegrationResult(state, 'gpt', true);
    return NodeResult.next({ gptResponse: text });
  }
}

// 3. HUMAN HANDOVER HANDLER
// ========================================

/**
 * The handover step's post-chat survey questions, asked when an agent ends
 * the live chat (web core/events/agentListeners.ts onChatEnded, special.ts
 * _handlePostChatSurveyQuestionsLooper). The builder saves the switch as
 * `enablePostChatSurveyQuestions`; the older `enablePostChatSurvey` still
 * counts, as in the Android (#72) and Flutter (#74) SDKs. Off, or no
 * questions: none.
 */
export const postChatSurveyQuestionsOf = (data: Record<string, any> | null | undefined): any[] => {
  if (!data) return [];
  const on = data.enablePostChatSurveyQuestions === true || data.enablePostChatSurvey === true;
  const list = Array.isArray(data.postChatSurveyQuestions) ? data.postChatSurveyQuestions : [];
  return on ? list.filter((q: any) => q && typeof q === 'object') : [];
};

/**
 * Handles human handover node - initiates live agent handover
 * with full pre-chat form, queue management, and post-chat survey support.
 */
export class HumanHandoverHandler extends BaseIntegrationHandler {
  readonly nodeType = 'human-handover-node';

  async handle(node: Record<string, unknown>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Human handover node missing data');
    }

    const nodeId = this.getNodeId(node);

    // The builder's pre-chat questions (enablePreChatQuestions): asked one
    // by one in the composer before the handover (web special.ts).
    const preChat: any[] =
      data.enablePreChatQuestions && Array.isArray(data.preChatQuestions) ? (data.preChatQuestions as any[]) : [];
    const preKey = `_preChat_${nodeId}`;
    if (preChat.length && state.getVariable(preKey) === undefined) {
      preChat.forEach((q) => {
        if (q?.answerVariable) state.registerAnswerVariable(String(q.id), q.answerVariable);
      });
      return this.askPreChat(node, state, 0);
    }

    // The post-chat survey's answer variables, known from the start (web
    // index.ts, the handover step's transcript and answerVariables).
    postChatSurveyQuestionsOf(data as Record<string, any>).forEach((q) => {
      if (q?.answerVariable) state.registerAnswerVariable(String(q.id), q.answerVariable);
    });

    // Pre-chat form gate: when configured, collect visitor details BEFORE
    // initiating the handover. handleResponse({ action: 'preChatSubmit' })
    // re-invokes handle() once the form is completed.
    const showPreChatForm = this.getBoolean(data, 'showPreChatForm', false);
    const preChatCompleted = state.getVariable('_preChatFormCompleted') === true;
    if (showPreChatForm && !preChatCompleted) {
      return NodeResult.displayUI({
        type: 'humanHandover',
        nodeId,
        stage: 'waiting',
        showPreChatForm: true,
        preChatFields: this.getArray(data, 'preChatFields'),
      } as NodeUIState.HumanHandover);
    }

    // Get handover message (matches web widget's nodeData.handoverMessage)
    const handoverMessage = this.getString(
      data,
      'handoverMessage',
      this.getString(data, 'waitMessage', 'Please wait while we connect you with an agent...')
    );
    // The builder writes it as rich text (<p>...</p>).
    const resolvedMessage = stripHtml(state.resolveVariables(handoverMessage, 'html'));

    // Show the handover message as a bot message after a beat of typing
    // (web: 1000 ms); a message cleared in the builder shows nothing.
    const ctx = ctxOf(node as Record<string, any>, state);
    if ((node as any).ctx && resolvedMessage) await ctx.typing(1000);
    if (resolvedMessage) state.addBotMessage(resolvedMessage, nodeId, 'human-handover-node');

    // Ensure visitor socket is in the chat room before handover
    // (covers edge cases: restart, reconnect, or late room join)
    if (this.socketClient) {
      this.emitSocketEvent('join-chat-room-visitor', { chatSessionId: state.sessionId });

      // Send response-record BEFORE initiate-handover so the server
      // has the Response document when creating the ticket/notification
      // (buildResponseData already includes botId/chatSessionId/record)
      const responseData = state.buildResponseData();
      this.emitSocketEvent('response-record', responseData);
    }

    // socket.io preserves emit order on a single connection, so
    // response-record is processed before initiate-handover.
    // Payload matches the web widget's socket.emit("initiate-handover", ...)
    this.emitSocketEvent('initiate-handover', buildHandoverPayload(state, data));

    state.setVariable('_handoverInitiated', true);
    state.setVariable('_handoverStartTime', new Date().toISOString());

    // Nobody free (web special.ts): the owner's fallback as the bot's
    // message after a beat of typing; with "leave a message" off the flow
    // carries on along the first edge (otherwise the leave-a-message form,
    // drawn by the chat UI, carries it on once sent or skipped).
    if ((node as any).ctx) {
      const off = ctx.on('no-agents-available', () => {
        off();
        void (async () => {
          const fallback = stripHtml(state.resolveVariables(String(data.fallbackMessage || ''), 'html'));
          if (fallback) {
            await ctx.typing(1000);
            if (ctx.isStale()) return;
            state.addBotMessage(fallback, nodeId, 'human-handover-node');
            state.addRecord({ _id: String(data.fallbackMessage), id: String(data.fallbackMessage), type: 'agent-declined-message', message: fallback, renderedText: fallback, time: new Date().toISOString() } as any);
          }
          if (ctx.customizations?.chatLeaveMessage === false) ctx.respond({ action: 'continue' });
        })();
      });
    }

    // Flow pauses on this node showing the waiting UI (matches the web
    // widget's waiting/timer view). Agent events (agent-accepted,
    // agent-message, no-agents-available) arrive via socket and are routed to
    // handleResponse/handleStatusUpdate, which advances the stage or proceeds.
    return NodeResult.displayUI({
      type: 'humanHandover',
      nodeId,
      stage: 'waiting',
      waitMessage: resolvedMessage,
    } as NodeUIState.HumanHandover);
  }

  /** Pre-chat question `index`, after 2000 ms of typing. */
  private async askPreChat(node: Record<string, unknown>, state: ChatState, index: number): Promise<NodeResult> {
    const data = (this.getNodeData(node) || {}) as Record<string, any>;
    const nodeId = this.getNodeId(node);
    const q = (data.preChatQuestions || [])[index] || {};
    if ((node as any).ctx) await ctxOf(node as Record<string, any>, state).typing(2000);
    state.setVariable(`_preChat_${nodeId}`, index);
    const question = stripHtml(state.resolveVariables(String(q.questionText || ''), 'html'));
    if (question) state.addBotMessage(question, nodeId, 'human-handover-node');
    const variable = String(q.answerVariable || '').toLowerCase();
    return NodeResult.displayUI({
      ...NodeUIState.textInput(nodeId, question, q.answerVariable || '', variable === 'email' ? 'email' : variable === 'phone' || variable === 'mobile' ? 'phone' : 'text'),
      awaitInput: true,
    });
  }

  /** An answer to a pre-chat question: checked, saved, then the next one or the handover. */
  private async answerPreChat(response: unknown, node: Record<string, unknown>, state: ChatState, index: number): Promise<NodeResult> {
    const data = (this.getNodeData(node) || {}) as Record<string, any>;
    const nodeId = this.getNodeId(node);
    const questions: any[] = data.preChatQuestions || [];
    const q = questions[index] || {};
    let value = typeof response === 'string' ? response.trim() : String((response as any)?.value ?? (response as any)?.text ?? '').trim();
    const ui = { ...NodeUIState.textInput(nodeId, stripHtml(String(q.questionText || '')), q.answerVariable || '', 'text'), awaitInput: true };
    if (!value) return NodeResult.displayUI(ui);
    if (q.answerVariable === 'email' && !isValidEmail(value)) {
      return NodeResult.invalid(ownerTextOr(q.incorrectEmailResponse, EN.emailInvalid, ['Please enter a valid email']), ui);
    }
    if (q.answerVariable === 'mobile' || q.answerVariable === 'phone') {
      if (!isValidPhone(value)) return NodeResult.invalid(ownerTextOr(q.incorrectPhoneNumberResponse, EN.phoneInvalid), ui);
    }
    if (q.answerVariable === 'name') state.setUserName(value);
    if (q.answerVariable === 'email') state.setUserEmail(value);
    if (q.answerVariable === 'mobile' || q.answerVariable === 'phone') state.setUserPhone(normalizePhone(value));
    state.addRecord({
      _id: `pre-chat-answer-${nodeId}-${index}`,
      id: `pre-chat-answer-${nodeId}-${index}`,
      questionId: q.id,
      shape: 'pre-chat-question-response',
      type: 'pre-chat-question-response',
      text: value,
      time: new Date().toISOString(),
    } as any);
    state.addUserMessage(value, nodeId);
    state.setAnswerVariable(String(q.id), value);
    value = '';
    if (index + 1 < questions.length) return this.askPreChat(node, state, index + 1);
    state.setVariable(`_preChat_${nodeId}`, 'done');
    return this.handle(node, state);
  }

  /**
   * Post-chat survey question `index`, after 2000 ms of typing, answered in
   * the composer (web special.ts _handlePostChatSurveyQuestionsLooper): the
   * question goes into the record as post-chat-survey-question.
   */
  private async askPostChat(node: Record<string, unknown>, state: ChatState, index: number): Promise<NodeResult> {
    const data = (this.getNodeData(node) || {}) as Record<string, any>;
    const nodeId = this.getNodeId(node);
    const q = postChatSurveyQuestionsOf(data)[index] || {};
    if ((node as any).ctx) await ctxOf(node as Record<string, any>, state).typing(2000);
    state.setVariable(`_postChat_${nodeId}`, index);
    const question = stripHtml(state.resolveVariables(String(q.questionText || ''), 'html'));
    if (question) state.addBotMessage(question, nodeId, 'human-handover-node');
    state.addRecord({
      id: q.id,
      shape: 'post-chat-survey-question',
      type: 'post-chat-survey-question',
      text: q.questionText,
    } as any);
    const variable = String(q.answerVariable || '').toLowerCase();
    return NodeResult.displayUI({
      ...NodeUIState.textInput(nodeId, question, q.answerVariable || '', variable === 'email' ? 'email' : variable === 'phone' || variable === 'mobile' ? 'phone' : 'text'),
      awaitInput: true,
    });
  }

  /**
   * An answer to a post-chat survey question: checked as the web checks it,
   * recorded as post-chat-survey-question-response (its own id, the
   * question's id as questionId) and as the question's answer variable;
   * then the next question, or the flow carries on along the handover
   * step's next edge (web special.ts _handlePostChatSurveyQuestionsSubmit,
   * _handoverProceedToNextStep).
   */
  private async answerPostChat(response: unknown, node: Record<string, unknown>, state: ChatState, index: number): Promise<NodeResult> {
    const data = (this.getNodeData(node) || {}) as Record<string, any>;
    const nodeId = this.getNodeId(node);
    const questions = postChatSurveyQuestionsOf(data);
    const q = questions[index] || {};
    const value = typeof response === 'string' ? response.trim() : String((response as any)?.value ?? (response as any)?.text ?? '').trim();
    const ui = { ...NodeUIState.textInput(nodeId, stripHtml(String(q.questionText || '')), q.answerVariable || '', 'text'), awaitInput: true };
    if (!value) return NodeResult.displayUI(ui);
    if (q.answerVariable === 'email' && !isValidEmail(value)) {
      return NodeResult.invalid(ownerTextOr(q.incorrectEmailResponse, EN.emailInvalid, ['Please enter a valid email']), ui);
    }
    if (q.answerVariable === 'mobile' || q.answerVariable === 'phone') {
      if (!isValidPhone(value)) return NodeResult.invalid(ownerTextOr(q.incorrectPhoneNumberResponse, EN.phoneInvalid), ui);
    }
    if (q.answerVariable === 'name') state.setUserName(value);
    if (q.answerVariable === 'email') state.setUserEmail(value);
    if (q.answerVariable === 'mobile' || q.answerVariable === 'phone') state.setUserPhone(normalizePhone(value));
    state.addRecord({
      id: liveEventId('post-chat-answer'),
      questionId: q.id,
      shape: 'post-chat-survey-question-response',
      type: 'post-chat-survey-question-response',
      text: value,
    } as any);
    state.addUserMessage(value, nodeId);
    state.setAnswerVariable(String(q.id), value);
    if (index + 1 < questions.length) return this.askPostChat(node, state, index + 1);
    state.setVariable(`_postChat_${nodeId}`, 'done');
    return this.proceed(node, { handoverEnded: true, postChatSurvey: true });
  }

  /**
   * Handles handover status updates and UI actions
   */
  async handleResponse(
    response: Record<string, unknown>,
    node: Record<string, unknown>,
    state: ChatState
  ): Promise<NodeResult> {
    const data = this.getNodeData(node);
    const nodeId = this.getNodeId(node);

    const postIndex = state.getVariable(`_postChat_${nodeId}`);
    if (typeof postIndex === 'number' && (typeof response === 'string' || (response && !(response as any).action && !(response as any).status))) {
      return this.answerPostChat(response, node, state, postIndex);
    }

    const preIndex = state.getVariable(`_preChat_${nodeId}`);
    if (typeof preIndex === 'number' && (typeof response === 'string' || (response && !(response as any).action && !(response as any).status))) {
      return this.answerPreChat(response, node, state, preIndex);
    }

    const surveyConfig: PostChatSurveyConfig = data?.surveyConfig as PostChatSurveyConfig || {
      enabled: this.getBoolean(data || {}, 'showPostChatSurvey', true),
      title: this.getString(data || {}, 'surveyTitle', 'How was your experience?'),
      ratingQuestion: this.getString(data || {}, 'surveyRatingQuestion', 'Please rate your conversation'),
      ratingStyle: 'stars' as const,
      maxRating: 5,
    };

    // Handle pre-chat form submission
    if (response.action === 'preChatSubmit' && response.formData) {
      state.setVariable('_preChatFormData', response.formData);
      state.setVariable('_preChatFormCompleted', true);

      if (response.department) {
        state.setVariable('_selectedDepartment', response.department);
      }

      const metadata: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(response.formData as Record<string, unknown>)) {
        metadata[key] = value;
      }
      state.setUserMetadata(metadata as Record<string, string | undefined>);

      return this.handle(node, state);
    }

    // Handle various actions
    switch (response.action) {
      case 'cancel':
        state.setVariable('_handoverCancelled', true);
        // Out of the queue: the team must stop seeing the visitor waiting
        // (web special.ts, queue-self-resolve). The provider sends it itself
        // and waits for the answer (queueLeft); a headless caller gets it here.
        if (response.queueLeft !== true) this.emitSocketEvent('queue-self-resolve', queueSelfResolvePayload(state.sessionId));
        return Promise.resolve(this.proceed(node, { handoverCancelled: true }));

      case 'retry':
        state.setVariable('_preChatFormCompleted', false);
        return this.handle(node, state);

      case 'endChat':
        state.setVariable('_handoverEnded', true);
        state.setVariable('_handoverEndTime', new Date().toISOString());
        // The server has no visitor end-chat (only an agent ends a live
        // chat, embed-server handoverHandler.js end-chat). Still in the
        // queue: leave it (queue-self-resolve closes only a waiting ticket;
        // with a person on it the server answers agent_joined and keeps it).
        this.emitSocketEvent('queue-self-resolve', queueSelfResolvePayload(state.sessionId));

        if (surveyConfig.enabled) {
          const uiState: ExtendedHumanHandoverUIState = {
            type: 'humanHandover',
            nodeId,
            stage: 'ended',
            extendedStage: 'post_chat',
            surveyConfig,
            agent: state.getVariable('_handoverAgent') as AgentInfo,
          };
          return Promise.resolve(NodeResult.displayUI(uiState as NodeUIState.HumanHandover));
        }
        return Promise.resolve(this.proceed(node, { handoverEnded: true }));

      case 'surveySubmit':
        if (response.surveyResponse) {
          state.setVariable('_surveyResponse', response.surveyResponse);
          state.setVariable('_surveySubmitted', true);
          // The rating as the web widget sends it (submit-chat-rating).
          const rating = surveyRatingPayload(
            state.sessionId,
            surveyConfig.ratingStyle,
            response.surveyResponse as { rating?: number; feedback?: string; comment?: string }
          );
          if (rating) this.emitSocketEvent('submit-chat-rating', rating);
        }
        return Promise.resolve(this.proceed(node, { handoverEnded: true, surveySubmitted: true }));

      case 'surveySkip':
        state.setVariable('_surveySkipped', true);
        return Promise.resolve(this.proceed(node, { handoverEnded: true, surveySkipped: true }));

      case 'continue':
        return Promise.resolve(this.proceed(node, { handoverEnded: true }));

      // An agent ended the live chat (chat-ended): the step's post-chat
      // survey questions when it has them, else the flow carries on along
      // its next edge (web agentListeners.ts onChatEnded).
      case 'chatEnded': {
        state.setVariable('_handoverEnded', true);
        state.setVariable('_handoverEndTime', new Date().toISOString());
        if (postChatSurveyQuestionsOf(data as Record<string, any>).length) return this.askPostChat(node, state, 0);
        return Promise.resolve(this.proceed(node, { handoverEnded: true }));
      }
    }

    // Handle socket status updates
    return this.handleStatusUpdate(response, node, state, nodeId, surveyConfig);
  }

  private handleStatusUpdate(
    response: Record<string, unknown>,
    node: Record<string, unknown>,
    state: ChatState,
    nodeId: string,
    surveyConfig: PostChatSurveyConfig
  ): Promise<NodeResult> {
    const data = this.getNodeData(node);

    switch (response.status) {
      case 'queued':
        state.setVariable('_handoverConversationId', response.conversationId);
        return Promise.resolve(NodeResult.displayUI({
          type: 'humanHandover',
          nodeId,
          stage: 'waiting',
          queueInfo: response.queueInfo,
          waitMessage: state.resolveVariables(this.getString(data || {}, 'waitMessage', 'Please wait...')),
        } as NodeUIState.HumanHandover));

      case 'connected':
        state.setVariable('_handoverConnected', true);
        state.setVariable('_handoverAgent', response.agent);
        state.setVariable('_handoverConnectedTime', new Date().toISOString());
        return Promise.resolve(NodeResult.displayUI({
          type: 'humanHandover',
          nodeId,
          stage: 'connected',
          agent: response.agent as AgentInfo,
          agentName: (response.agent as AgentInfo)?.name || response.agentName as string,
          agentAvatar: (response.agent as AgentInfo)?.avatar || response.agentAvatar as string,
          connectedMessage: state.resolveVariables(this.getString(data || {}, 'connectedMessage', 'You are now connected.')),
        } as NodeUIState.HumanHandover));

      case 'ended':
        state.setVariable('_handoverEnded', true);
        state.setVariable('_handoverEndTime', new Date().toISOString());
        if (surveyConfig.enabled) {
          return Promise.resolve(NodeResult.displayUI({
            type: 'humanHandover',
            nodeId,
            stage: 'ended',
            surveyConfig,
            agent: state.getVariable('_handoverAgent') as AgentInfo,
          } as NodeUIState.HumanHandover));
        }
        return Promise.resolve(this.proceed(node, { handoverEnded: true }));

      // The handover is over (nobody came and the visitor left a message or
      // skipped it): the flow carries on, as the web widget does.
      case 'continue':
        return Promise.resolve(this.proceed(node, { handoverOver: true }));

      case 'noAgents':
      case 'no_agents': {
        const proceedOnNoAgents = this.getBoolean(data || {}, 'proceedOnNoAgents', false);
        if (proceedOnNoAgents) {
          return Promise.resolve(this.proceed(node, { noAgents: true }));
        }
        return Promise.resolve(NodeResult.displayUI({
          type: 'humanHandover',
          nodeId,
          stage: 'noAgents',
          noAgentsMessage: response.message as string || state.resolveVariables(this.getString(data || {}, 'noAgentsMessage', 'No agents available.')),
        } as NodeUIState.HumanHandover));
      }

      case 'timeout': {
        state.setVariable('_handoverTimeout', true);
        const proceedOnTimeout = this.getBoolean(data || {}, 'proceedOnTimeout', false);
        if (proceedOnTimeout) {
          return Promise.resolve(this.proceed(node, { timeout: true }));
        }
        return Promise.resolve(NodeResult.displayUI({
          type: 'humanHandover',
          nodeId,
          stage: 'timeout',
          timeoutMessage: response.message as string || state.resolveVariables(this.getString(data || {}, 'timeoutMessage', 'Connection timed out.')),
        } as NodeUIState.HumanHandover));
      }

      default:
        return Promise.resolve(NodeResult.displayUI({
          type: 'humanHandover',
          nodeId,
          stage: 'waiting',
        } as NodeUIState.HumanHandover));
    }
  }
}

// ========================================
// 4. DELAY HANDLER
// ========================================

/**
 * delay-node: shows nothing, waits data.delay seconds (missing: no wait),
 * then the first edge.
 */
export class DelayHandler extends BaseIntegrationHandler {
  readonly nodeType = 'delay-node';

  async handle(node: Record<string, unknown>, state: ChatState): Promise<NodeResult> {
    const data = (this.getNodeData(node) || {}) as Record<string, any>;
    const seconds = Number(data.delay);
    const delayMs = Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, 10 * 60 * 1000) : 0;
    state.setVariable('_lastDelay', delayMs);
    if (!delayMs) return NodeResult.next();
    return NodeResult.delayedProceed(null, delayMs, { delayMs });
  }
}

// ========================================
// 5. EMAIL HANDLER
// ========================================

/**
 * email-node: emits "email-node-trigger" with the node data, the
 * transcript, the visitor and every answer, and moves on at once. Reached
 * by a jump-to-node it sends nothing and only moves on (web index.ts).
 */
export class EmailHandler extends BaseIntegrationHandler {
  readonly nodeType = 'email-node';

  async handle(node: Record<string, unknown>, state: ChatState): Promise<NodeResult> {
    const ctx = ctxOf(node as Record<string, any>, state);
    if (ctx.via === 'jump') return NodeResult.next();
    const data = (this.getNodeData(node) || {}) as Record<string, any>;
    const { socketClient: _socketClient, ...nodeData } = data;
    const userMetadata = state.getUserMetadata();
    const payload: Record<string, unknown> = {
      nodeData,
      botName: state.getVariable('_botName') || '',
      transcript: transcriptOf(state),
      visitorName: userMetadata.name || '',
      visitorEmail: userMetadata.email || '',
    };
    state.getAnswerVariables().forEach((v) => {
      payload[v.variableName] = v.value;
    });
    payload.answerVariables = answerVariablesOf(state);
    payload.chatDate = new Date().toISOString();
    payload.workspaceId = state.getVariable('_workspaceId') || '';
    const client = (this.socketClient || (data.socketClient as SocketClient)) as SocketClient & {
      emailNodeTrigger?: (p: unknown) => void;
    };
    if (client && typeof client.emailNodeTrigger === 'function') client.emailNodeTrigger(payload);
    else ctx.emit('email-node-trigger', payload);
    return NodeResult.next();
  }
}

/** The transcript as the server reads it: [{by, message}]. */
const transcriptOf = (state: ChatState) =>
  state
    .getTranscript()
    .filter((e) => (e.type === 'bot' || e.type === 'user') && typeof e.text === 'string' && e.text.trim())
    .map((e) => ({ by: e.type, message: e.text as string }));

/** The answer variables as the server reads them: [{nodeId, key, value}]. */
const answerVariablesOf = (state: ChatState) =>
  state.getAnswerVariables().map((v) => ({ nodeId: v.nodeId, key: v.variableName, value: v.value }));

// ========================================
// 6. NATIVE INTEGRATIONS (server-run)
// ========================================

/**
 * Runs a step on the embed server: emits "execute-integration" with the
 * step's own data (credentialId, operation and its fields, as the builder
 * saved them) and resolves with the "integration-result" for this step, or
 * a failure after 30 s. On success, result.answerVariable = answerValue and
 * every columnMappedValues entry are saved by name (web
 * _executeNativeIntegration).
 */
export const executeNativeIntegration = (
  ctx: FlowContext,
  state: ChatState,
  nodeType: string,
  nodeId: string,
  nodeData: Record<string, any>,
  timeoutMs: number = 30000
): Promise<Record<string, any>> =>
  new Promise((resolve) => {
    const { socketClient: _socketClient, ...data } = nodeData || {};
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    let off: () => void = () => {};
    const finish = (result: Record<string, any>) => {
      timers.forEach((t) => clearTimeout(t));
      off();
      resolve(result);
    };
    off = ctx.on('integration-result', (result: any) => {
      if (!result || result.nodeId !== nodeId) return;
      if (result.success) {
        if (result.answerVariable && result.answerValue !== undefined) state.saveVariableByName(result.answerVariable, result.answerValue);
        if (result.columnMappedValues && typeof result.columnMappedValues === 'object') {
          for (const [name, value] of Object.entries(result.columnMappedValues)) {
            if (name && value !== undefined) state.saveVariableByName(name, value);
          }
        }
      }
      finish(result);
    });
    const sent = ctx.emit('execute-integration', {
      nodeType,
      nodeId,
      nodeData: data,
      chatSessionId: state.sessionId,
      chatbotId: state.botId,
      workspaceId: state.getVariable('_workspaceId') || '',
      answerVariables: answerVariablesOf(state),
      visitorData: {},
    });
    if (!sent) {
      finish({ success: false, error: 'Socket not connected' });
      return;
    }
    timers.push(setTimeout(() => finish({ success: false, error: 'Integration execution timed out', continueFlow: true }), timeoutMs));
  });

/**
 * A server-run integration that does not hold the flow (gmail, google
 * sheets / docs / drive, slack, discord, airtable, hubspot, notion,
 * zohocrm): the step data goes to the server and the flow moves on at
 * once; values that come back later fill variables.
 */
export class NativeIntegrationHandler extends BaseIntegrationHandler {
  readonly nodeType: string;

  constructor(nodeType: string) {
    super();
    this.nodeType = nodeType;
  }

  /** The node type the server runs (google-sheets runs as its read / write node). */
  protected serverType(data: Record<string, any>): string {
    void data;
    return this.nodeType;
  }

  async handle(node: Record<string, unknown>, state: ChatState): Promise<NodeResult> {
    const data = (this.getNodeData(node) || {}) as Record<string, any>;
    const nodeId = this.getNodeId(node);
    const ctx = ctxOf(node as Record<string, any>, state);
    void executeNativeIntegration(ctx, state, this.serverType(data), nodeId, data).then((result) => {
      state.addRecord({
        _id: nodeId,
        id: nodeId,
        shape: this.nodeType,
        data: { result: { success: !!result?.success, error: result?.error || null } },
        time: new Date().toISOString(),
      } as any);
    });
    return NodeResult.next();
  }
}

export class GmailHandler extends NativeIntegrationHandler {
  constructor() {
    super('gmail-node');
  }
}
export class SlackHandler extends NativeIntegrationHandler {
  constructor() {
    super('slack-node');
  }
}
export class DiscordHandler extends NativeIntegrationHandler {
  constructor() {
    super('discord-node');
  }
}
export class GoogleDocsHandler extends NativeIntegrationHandler {
  constructor() {
    super('google-docs-node');
  }
}
export class GoogleDriveHandler extends NativeIntegrationHandler {
  constructor() {
    super('google-drive-node');
  }
}
export class AirtableHandler extends NativeIntegrationHandler {
  constructor() {
    super('airtable-node');
  }
}
export class HubSpotHandler extends NativeIntegrationHandler {
  constructor() {
    super('hubspot-node');
  }
}
export class NotionHandler extends NativeIntegrationHandler {
  constructor() {
    super('notion-node');
  }
}
export class ZohoCRMHandler extends NativeIntegrationHandler {
  constructor() {
    super('zohocrm-node');
  }
}

/** google-sheets-node: runs on the server as google-sheets-read-node or -write-node (data.operation). */
export class GoogleSheetsHandler extends NativeIntegrationHandler {
  constructor() {
    super('google-sheets-node');
  }

  protected serverType(data: Record<string, any>): string {
    const operation = data?.operation || data?.inputs?.operation || 'read';
    return operation === 'write' ? 'google-sheets-write-node' : 'google-sheets-read-node';
  }
}

/**
 * google-calendar-node: an operation other than "book" runs in the
 * background and the flow moves on at once; "book" waits for the server
 * (the web's slot picker is web-only) and then moves on.
 */
export class GoogleCalendarHandler extends NativeIntegrationHandler {
  constructor() {
    super('google-calendar-node');
  }

  async handle(node: Record<string, unknown>, state: ChatState): Promise<NodeResult> {
    const data = (this.getNodeData(node) || {}) as Record<string, any>;
    if ((data.operation || 'list') !== 'book') return super.handle(node, state);
    await executeNativeIntegration(ctxOf(node as Record<string, any>, state), state, this.nodeType, this.getNodeId(node), data);
    return NodeResult.next();
  }
}

/** google-meet-node: waits for the server's result (30 s at most), then the first edge. */
export class GoogleMeetHandler extends NativeIntegrationHandler {
  constructor() {
    super('google-meet-node');
  }

  async handle(node: Record<string, unknown>, state: ChatState): Promise<NodeResult> {
    const data = (this.getNodeData(node) || {}) as Record<string, any>;
    const nodeId = this.getNodeId(node);
    const result = await executeNativeIntegration(ctxOf(node as Record<string, any>, state), state, this.nodeType, nodeId, data);
    if (result?.success && !result?.waitForInput) {
      state.addRecord({
        _id: nodeId,
        id: nodeId,
        shape: 'google-meet-node',
        data: {
          summary: data.summary,
          meetingUri: result?.data?.meetingUri || null,
          eventLink: result?.data?.eventLink || null,
          booking: result?.data?.booking || null,
          result: { success: true, error: null },
        },
        time: new Date().toISOString(),
      } as any);
    }
    return NodeResult.next();
  }
}

/**
 * stripe-node: the server makes the payment link; it is shown and the flow
 * moves on 500 ms later. It never waits for the payment (payment-node does).
 */
export class StripeHandler extends NativeIntegrationHandler {
  constructor() {
    super('stripe-node');
  }

  async handle(node: Record<string, unknown>, state: ChatState): Promise<NodeResult> {
    const data = (this.getNodeData(node) || {}) as Record<string, any>;
    const nodeId = this.getNodeId(node);
    const operation = data.operation || 'createPaymentLink';
    const result = await executeNativeIntegration(ctxOf(node as Record<string, any>, state), state, this.nodeType, nodeId, data);
    state.addRecord({
      _id: nodeId,
      id: nodeId,
      shape: 'stripe-node',
      data: {
        operation,
        url: result?.data?.url || null,
        id: result?.data?.id || null,
        customerId: result?.data?.customerId || null,
        message: result?.message || null,
        result: { success: !!result?.success, error: result?.error || null },
      },
      time: new Date().toISOString(),
    } as any);
    const url = result?.data?.url;
    if (result?.success && url) {
      if (operation === 'createPaymentLink' || operation === 'createCheckoutSession') {
        const text = [result?.message, url].filter(Boolean).join('\n');
        state.addToTranscript({ type: 'bot', text, nodeId, nodeType: this.nodeType, timestamp: new Date().toISOString(), data: { linkUrl: url } });
      }
      return NodeResult.delayedProceed(null, 500);
    }
    return NodeResult.next();
  }
}

/**
 * mailchimp / segment / salesforce: the flow waits for the server, then
 * success leaves by "source" (or an edge with no handle), failure by
 * "source-failure" - or the success edge when no failure edge is drawn.
 */
export class ResultIntegrationHandler extends NativeIntegrationHandler {
  async handle(node: Record<string, unknown>, state: ChatState): Promise<NodeResult> {
    const data = (this.getNodeData(node) || {}) as Record<string, any>;
    const nodeId = this.getNodeId(node);
    const ctx = ctxOf(node as Record<string, any>, state);
    const result = await executeNativeIntegration(ctx, state, this.nodeType, nodeId, data);
    const outgoing = ctx.edges();
    const isSuccess = (e: any) => e?.sourceHandle === 'source' || e?.sourceHandle === null || e?.sourceHandle === undefined;
    const successEdge = outgoing.find(isSuccess);
    const edge = result?.success ? successEdge : outgoing.find((e) => e.sourceHandle === 'source-failure') || successEdge;
    if (!edge) return NodeResult.next();
    if (edge.sourceHandle === null || edge.sourceHandle === undefined) return NodeResult.jumpTo(edge.target);
    return NodeResult.port(edge.sourceHandle);
  }
}

export class MailchimpHandler extends ResultIntegrationHandler {
  constructor() {
    super('mailchimp-node');
  }
}
export class SegmentHandler extends ResultIntegrationHandler {
  constructor() {
    super('segment-node');
  }
}
export class SalesforceHandler extends ResultIntegrationHandler {
  constructor() {
    super('salesforce-node');
  }
}

/** One active webhook registered for a zapier-node (bot integrationWebhooks). */
interface IntegrationWebhookEntry {
  nodeId?: string;
  botId?: string;
  webhookURL?: string;
  active?: boolean;
}

/**
 * zapier-node: when the bot has an active webhook for the node, relays the
 * answers through the server ("zapier-node-trigger"); moves on at once.
 */
export class ZapierHandler extends BaseIntegrationHandler {
  readonly nodeType = 'zapier-node';

  async handle(node: Record<string, unknown>, state: ChatState): Promise<NodeResult> {
    const data = (this.getNodeData(node) || {}) as Record<string, any>;
    const nodeId = this.getNodeId(node);
    const webhooks = (state.getVariable('_integrationWebhooks') as IntegrationWebhookEntry[]) || [];
    const hook = Array.isArray(webhooks)
      ? webhooks.find((w) => w?.nodeId === (data.nodeId ?? nodeId) && w?.botId === state.botId && w?.active)
      : undefined;
    if (!hook?.webhookURL) return NodeResult.next();
    const { socketClient: _socketClient, ...nodeData } = data;
    const triggerPayload = {
      nodeData: { ...nodeData, nodeId: data.nodeId ?? nodeId, webhookURL: hook.webhookURL },
      payload: state.getAllAnswers(),
      chatSessionId: state.sessionId,
      workspaceId: state.getVariable('_workspaceId') || '',
    };
    const client = this.socketClient as (SocketClient & { zapierNodeTrigger?: (p: unknown) => void }) | null;
    if (client && typeof client.zapierNodeTrigger === 'function') client.zapierNodeTrigger(triggerPayload);
    else ctxOf(node as Record<string, any>, state).emit('zapier-node-trigger', triggerPayload);
    return NodeResult.next();
  }
}

/**
 * All integration node handlers
 */
export const IntegrationHandlers = {
  WebhookHandler,
  GPTHandler,
  HumanHandoverHandler,
  DelayHandler,
  EmailHandler,
  GmailHandler,
  SlackHandler,
  DiscordHandler,
  GoogleSheetsHandler,
  GoogleCalendarHandler,
  GoogleMeetHandler,
  GoogleDocsHandler,
  GoogleDriveHandler,
  HubSpotHandler,
  SalesforceHandler,
  SegmentHandler,
  ZohoCRMHandler,
  MailchimpHandler,
  ZapierHandler,
  AirtableHandler,
  NotionHandler,
  StripeHandler,
};

/**
 * Creates instances of all integration handlers with optional socket client and API base URL.
 */
export function createIntegrationHandlers(socketClient?: SocketClient, apiBaseUrl?: string): BaseIntegrationHandler[] {
  const handlers: BaseIntegrationHandler[] = [
    new WebhookHandler(),
    new GPTHandler(),
    new HumanHandoverHandler(),
    new DelayHandler(),
    new EmailHandler(),
    new GmailHandler(),
    new SlackHandler(),
    new DiscordHandler(),
    new GoogleSheetsHandler(),
    new GoogleCalendarHandler(),
    new GoogleMeetHandler(),
    new GoogleDocsHandler(),
    new GoogleDriveHandler(),
    new HubSpotHandler(),
    new SalesforceHandler(),
    new SegmentHandler(),
    new ZohoCRMHandler(),
    new MailchimpHandler(),
    new ZapierHandler(),
    new AirtableHandler(),
    new NotionHandler(),
    new StripeHandler(),
  ];
  for (const handler of handlers) {
    if (socketClient) handler.setSocketClient(socketClient);
    if (apiBaseUrl) handler.setApiBaseUrl(apiBaseUrl);
  }
  return handlers;
}

/**
 * Registers all integration handlers with the provided registry.
 */
export function registerIntegrationHandlers(registry: NodeHandlerRegistry, socketClient?: SocketClient, apiBaseUrl?: string): void {
  registry.registerAll(createIntegrationHandlers(socketClient, apiBaseUrl));
}

export default IntegrationHandlers;
