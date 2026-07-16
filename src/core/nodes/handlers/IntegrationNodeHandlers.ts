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

  async handle(node: Record<string, unknown>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Webhook node missing data');
    }

    const config = this.parseWebhookConfig(data);

    if (!config.url) {
      return this.createError('Webhook URL is required');
    }

    const urlValidation = validateWebhookUrl(config.url);
    if (!urlValidation.isValid) {
      return this.createError(urlValidation.error || 'Invalid webhook URL');
    }

    const variables = this.buildVariableContext(state);
    const authentication = this.parseAuthentication(data);
    const responseExtract = this.parseResponseExtract(data);

    const request: WebhookRequest = {
      url: urlValidation.sanitizedUrl || config.url,
      method: config.method,
      headers: config.headers,
      body: config.body,
      authentication,
      timeoutMs: config.timeout,
      maxRetries: config.retryCount,
      responseExtract,
      variables,
      includeAnswerVariables: config.includeAnswerVariables,
      answerVariables: state.getAllAnswers(),
      proceedOnError: config.proceedOnError,
      allowLocalhost: __DEV__ ?? false,
    };

    const result = await this.webhookService.execute(request);

    for (const [key, value] of Object.entries(result.extractedVariables)) {
      state.setVariable(key, value);
    }

    if (config.variableName && result.response?.data) {
      state.setVariable(config.variableName, result.response.data);
    }

    this.emitSocketEvent('webhook:executed', {
      sessionId: state.sessionId,
      nodeId: this.getNodeId(node),
      success: result.success,
      statusCode: result.response?.statusCode,
      duration: result.extractedVariables._webhookDuration,
    });

    if (result.success) {
      return this.proceed(node, {
        webhookResponse: result.response?.data,
        webhookSuccess: true,
      });
    } else {
      this.storeIntegrationResult(state, 'webhook', false, undefined, result.error);

      if (result.shouldProceed) {
        return this.proceed(node, {
          webhookError: result.error,
          webhookSuccess: false,
        });
      }

      return this.createError(`Webhook request failed: ${result.error}`, true);
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
 * Handles GPT node - calls OpenAI directly from the client.
 *
 * The embed-server does NOT handle 'gpt-node' via execute-integration, so the
 * web widget calls the OpenAI chat completions API with the key configured on
 * the node (nodeData.apiKey) and displays the completion as a bot message.
 * This handler mirrors that behavior. If no API key is configured, the error
 * is recorded and the flow proceeds silently (web behavior).
 */
export class GPTHandler extends BaseIntegrationHandler {
  readonly nodeType = 'gpt-node';

  async handle(node: Record<string, unknown>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('GPT node missing data');
    }

    const nodeId = this.getNodeId(node);
    const apiKey = this.getString(data, 'apiKey');
    const variableName = this.getString(data, 'variableName', 'gptResponse');

    if (!apiKey) {
      // No key anywhere: record the error and proceed silently
      this.storeIntegrationResult(state, 'gpt', false, undefined, 'GPT node missing API key');
      return this.proceed(node, { gptSuccess: false });
    }

    // Build the message array from the transcript (web widget maps 'bot'
    // entries to 'system' and keeps 'user' as is)
    const messages = state.getTranscript()
      .filter((entry) => (entry.type === 'bot' || entry.type === 'user') && entry.text)
      .map((entry) => ({
        role: entry.type === 'bot' ? 'system' : 'user',
        content: entry.text || '',
      }));

    // Prepend the node's context/prompt as an initial system message
    const context = this.getString(data, 'context') ||
                    this.getString(data, 'systemPrompt') ||
                    this.getString(data, 'prompt') ||
                    this.getString(data, 'message');
    if (context) {
      messages.unshift({ role: 'system', content: state.resolveVariables(context) });
    }

    const requestBody = {
      model: this.getString(data, 'selectedModel') || this.getString(data, 'model') || 'gpt-3.5-turbo',
      messages,
      temperature: 0.7,
    };

    const response = await this.makeApiCall<{
      choices?: Array<{ message?: { content?: string } }>;
    }>(
      'https://api.openai.com/v1/chat/completions',
      'POST',
      requestBody,
      { Authorization: `Bearer ${apiKey}` },
    );

    const responseText = response.success
      ? response.data?.choices?.[0]?.message?.content || ''
      : '';

    if (!responseText) {
      // Record the error and proceed silently (matches web widget behavior)
      this.storeIntegrationResult(
        state, 'gpt', false, undefined, response.error || 'Empty GPT response',
      );
      return this.proceed(node, { gptSuccess: false });
    }

    state.setVariable(variableName, responseText);

    // Display the completion as a bot message
    state.addBotMessage(responseText, nodeId, this.nodeType);

    this.storeIntegrationResult(state, 'gpt', true);
    return this.proceed(node, { gptResponse: responseText });
  }

  /**
   * Handles GPT response from socket/callback
   */
  handleResponse(
    response: { error?: string; text?: string; response?: string },
    node: Record<string, unknown>,
    state: ChatState
  ): Promise<NodeResult> {
    const data = this.getNodeData(node);
    const variableName = this.getString(data || {}, 'variableName', 'gptResponse');

    if (response.error) {
      return Promise.resolve(this.createError(`GPT error: ${response.error}`, true));
    }

    const responseText = response.text || response.response || '';
    state.setVariable(variableName, responseText);

    return Promise.resolve(this.proceed(node, { gptResponse: responseText }));
  }
}

// ========================================
// 3. HUMAN HANDOVER HANDLER
// ========================================

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
    const resolvedMessage = state.resolveVariables(handoverMessage);

    // Show the handover message as a bot message (matches web widget behavior)
    state.addBotMessage(resolvedMessage, nodeId, 'human-handover-node');

    // Build chatMetaData matching the web widget format exactly
    const workspaceId = state.getVariable('_workspaceId') || '';
    const chatMetaData = {
      version: 'v2',
      workspaceId,
      chatSessionId: state.sessionId,
      botId: state.botId,
      botName: state.getVariable('_botName') || '',
      chatDate: new Date().toISOString(),
      deviceInfo: 'ReactNative',
      location: Intl.DateTimeFormat().resolvedOptions().timeZone,
      record: state.getRecord(),
      answerVariables: state.getAnswerVariables(),
      transcript: state.getTranscript(),
    };

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

    // No artificial delay needed: socket.io preserves emit order on a single
    // connection, so response-record is processed before initiate-handover.

    // Emit initiate-handover via socket (matches web widget's socket.emit("initiate-handover", ...))
    const maxWaitTime = this.getNumber(data, 'maxWaitTime', 2);
    this.emitSocketEvent('initiate-handover', {
      workspaceId,
      chatbotId: state.botId,
      chatbotName: chatMetaData.botName,
      chatSessionId: state.sessionId,
      chatMetaData,
      metaData: {
        visitorId: state.sessionId,
        chatDate: chatMetaData.chatDate,
        deviceInfo: chatMetaData.deviceInfo,
        location: chatMetaData.location,
      },
      priority: this.getString(data, 'priority', 'normal'),
      maxWaitTime,
      assignmentType: this.getString(data, 'assignmentType', 'auto'),
      assignmentStrategy: this.getString(data, 'agentAssignmentStrategy'),
      assignedAgents: this.getArray(data, 'assignedAgents'),
      assignedAIAgents: this.getArray(data, 'assignedAIAgents'),
    });

    state.setVariable('_handoverInitiated', true);
    state.setVariable('_handoverStartTime', new Date().toISOString());

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

  /**
   * Handles handover status updates and UI actions
   */
  handleResponse(
    response: Record<string, unknown>,
    node: Record<string, unknown>,
    state: ChatState
  ): Promise<NodeResult> {
    const data = this.getNodeData(node);
    const nodeId = this.getNodeId(node);

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
        return Promise.resolve(this.proceed(node, { handoverCancelled: true }));

      case 'retry':
        state.setVariable('_preChatFormCompleted', false);
        return this.handle(node, state);

      case 'endChat':
        state.setVariable('_handoverEnded', true);
        state.setVariable('_handoverEndTime', new Date().toISOString());
        this.emitSocketEvent('handover:end', {
          sessionId: state.sessionId,
          conversationId: state.getVariable('_handoverConversationId'),
          reason: 'user_ended',
        });

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
          this.emitSocketEvent('handover:survey', {
            sessionId: state.sessionId,
            conversationId: state.getVariable('_handoverConversationId'),
            response: response.surveyResponse,
          });
        }
        return Promise.resolve(this.proceed(node, { handoverEnded: true, surveySubmitted: true }));

      case 'surveySkip':
        state.setVariable('_surveySkipped', true);
        return Promise.resolve(this.proceed(node, { handoverEnded: true, surveySkipped: true }));

      case 'continue':
        return Promise.resolve(this.proceed(node, { handoverEnded: true }));
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
 * Handles delay node - pauses flow for configured duration.
 * Supports milliseconds, seconds, minutes, and hours.
 */
export class DelayHandler extends BaseIntegrationHandler {
  readonly nodeType = 'delay-node';

  async handle(node: Record<string, unknown>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Delay node missing data');
    }

    const delayValue = this.getNumber(data, 'delay') || this.getNumber(data, 'duration') || this.getNumber(data, 'time', 1);
    const unit = this.getString(data, 'unit', 'seconds').toLowerCase();

    let delayMs: number;

    switch (unit) {
      case 'milliseconds':
      case 'ms':
        delayMs = delayValue;
        break;
      case 'minutes':
      case 'min':
        delayMs = delayValue * 60 * 1000;
        break;
      case 'hours':
      case 'hr':
        delayMs = delayValue * 60 * 60 * 1000;
        break;
      case 'seconds':
      case 'sec':
      default:
        delayMs = delayValue * 1000;
        break;
    }

    // Cap maximum delay to 10 minutes for safety
    const maxDelay = 10 * 60 * 1000;
    delayMs = Math.min(delayMs, maxDelay);

    state.setVariable('_lastDelay', delayMs);
    state.setVariable('_delayStartTime', new Date().toISOString());

    return NodeResult.delayedProceed(this.getNextNodeId(node), delayMs, {
      delayMs,
      delayUnit: unit,
    });
  }
}

// ========================================
// 5. EMAIL HANDLER
// ========================================

/**
 * Handles email node - triggers email send via socket/API.
 *
 * Features:
 * - Email validation for recipients
 * - CC/BCC support
 * - HTML and plain text formatting
 * - Attachment support
 * - Variable interpolation in all fields
 */
export class EmailHandler extends BaseIntegrationHandler {
  readonly nodeType = 'email-node';

  async handle(node: Record<string, unknown>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Email node missing data');
    }

    const config: EmailConfig = {
      to: this.getString(data, 'to') || this.getString(data, 'recipient'),
      subject: this.getString(data, 'subject'),
      body: this.getString(data, 'body') || this.getString(data, 'message') || this.getString(data, 'content'),
      cc: this.getString(data, 'cc'),
      bcc: this.getString(data, 'bcc'),
      replyTo: this.getString(data, 'replyTo'),
      attachments: this.getArray(data, 'attachments') as EmailConfig['attachments'],
      format: (this.getString(data, 'format', 'text') as 'text' | 'html'),
      proceedOnError: this.getBoolean(data, 'proceedOnError', true),
    };

    // Resolve variables in all fields
    const resolvedConfig: EmailConfig = {
      to: state.resolveVariables(config.to),
      subject: state.resolveVariables(config.subject),
      body: state.resolveVariables(config.body),
      cc: config.cc ? state.resolveVariables(config.cc) : undefined,
      bcc: config.bcc ? state.resolveVariables(config.bcc) : undefined,
      replyTo: config.replyTo ? state.resolveVariables(config.replyTo) : undefined,
      attachments: config.attachments,
      format: config.format,
    };

    // Validate email configuration
    const validation = validateEmailConfig(resolvedConfig);
    if (!validation.isValid) {
      const errorMsg = validation.errors.join('; ');
      if (!config.proceedOnError) {
        return this.createError(errorMsg);
      }
      this.storeIntegrationResult(state, 'email', false, undefined, errorMsg);
      return this.proceed(node, { emailSent: false, emailError: errorMsg });
    }

    // Format email body based on format type
    resolvedConfig.body = formatEmailBody(resolvedConfig.body, resolvedConfig.format);

    // Validate and format email addresses
    const toResult = validateEmailList(resolvedConfig.to);
    resolvedConfig.to = toResult.formatted;

    if (resolvedConfig.cc) {
      const ccResult = validateEmailList(resolvedConfig.cc);
      resolvedConfig.cc = ccResult.formatted || undefined;
    }

    if (resolvedConfig.bcc) {
      const bccResult = validateEmailList(resolvedConfig.bcc);
      resolvedConfig.bcc = bccResult.formatted || undefined;
    }

    // Build the 'email-node-trigger' payload (web widget contract):
    // nodeData + botName + transcript + visitor info + flattened answers +
    // answerVariables + chatDate + workspaceId. Fire-and-forget.
    const nodeId = this.getNodeId(node);
    const userMetadata = state.getUserMetadata();

    // Strip the engine-injected socketClient before sending node data
    const { socketClient: _socketClient, ...nodeDataClean } =
      data as Record<string, unknown> & { socketClient?: unknown };

    const transcript = state.getTranscript()
      .filter((entry) => (entry.type === 'bot' || entry.type === 'user') && entry.text)
      .map((entry) => ({ by: entry.type, message: entry.text || '' }));

    const emailPayload: Record<string, unknown> = {
      // Flatten each answer variable as key: value (web widget behavior)
      ...state.getAllAnswers(),
      // Raw node data with variable-resolved email fields merged on top
      nodeData: { ...nodeDataClean, ...resolvedConfig, nodeId },
      botName: state.getVariable('_botName') || '',
      transcript,
      visitorName: userMetadata.name || '',
      visitorEmail: userMetadata.email || '',
      answerVariables: state.getAnswerVariables().map((av) => ({
        key: av.variableName,
        value: av.value,
      })),
      chatDate: new Date().toISOString(),
      workspaceId: state.getVariable('_workspaceId') || '',
    };

    // The server handles 'email-node-trigger' (execute-integration rejects
    // 'email-node'). Use the dedicated socket method when available.
    const client = this.socketClient as
      | (SocketClient & { emailNodeTrigger?: (payload: unknown) => void })
      | null;

    let sent = false;
    if (client && typeof client.emailNodeTrigger === 'function') {
      client.emailNodeTrigger(emailPayload);
      sent = this.emitAvailable();
    } else {
      sent = this.emitSocketEvent('email-node-trigger', emailPayload);
    }

    this.storeIntegrationResult(
      state, 'email', sent, undefined, sent ? undefined : 'Socket not connected',
    );
    return this.proceed(node, { emailSent: sent });
  }

  /** Whether the socket client can currently deliver events */
  private emitAvailable(): boolean {
    const client = this.socketClient as
      | (SocketClient & { isConnected?: () => boolean })
      | null;
    if (!client) return false;
    return typeof client.isConnected === 'function'
      ? client.isConnected()
      : client.connected !== false;
  }
}

// ========================================
// 6. GMAIL HANDLER
// ========================================

/**
 * Handles Gmail node - sends emails via Gmail API.
 * Extends EmailHandler with Gmail-specific features.
 */
export class GmailHandler extends BaseIntegrationHandler {
  readonly nodeType = 'gmail-node';

  async handle(node: Record<string, unknown>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Gmail node missing data');
    }

    const config: GmailConfig = {
      to: this.getString(data, 'to') || this.getString(data, 'recipient'),
      subject: this.getString(data, 'subject'),
      body: this.getString(data, 'body') || this.getString(data, 'message') || this.getString(data, 'content'),
      cc: this.getString(data, 'cc'),
      bcc: this.getString(data, 'bcc'),
      replyTo: this.getString(data, 'replyTo'),
      attachments: this.getArray(data, 'attachments') as EmailConfig['attachments'],
      format: (this.getString(data, 'format', 'text') as 'text' | 'html'),
      proceedOnError: this.getBoolean(data, 'proceedOnError', true),
      saveAsDraft: this.getBoolean(data, 'saveAsDraft', false),
      labels: this.getArray(data, 'labels') as string[],
    };

    // Resolve variables
    const resolvedConfig: GmailConfig = {
      ...config,
      to: state.resolveVariables(config.to),
      subject: state.resolveVariables(config.subject),
      body: state.resolveVariables(config.body),
      cc: config.cc ? state.resolveVariables(config.cc) : undefined,
      bcc: config.bcc ? state.resolveVariables(config.bcc) : undefined,
      replyTo: config.replyTo ? state.resolveVariables(config.replyTo) : undefined,
    };

    // Validate
    const validation = validateEmailConfig(resolvedConfig);
    if (!validation.isValid) {
      const errorMsg = validation.errors.join('; ');
      if (!config.proceedOnError) {
        return this.createError(errorMsg);
      }
      this.storeIntegrationResult(state, 'gmail', false, undefined, errorMsg);
      return this.proceed(node, { gmailSent: false, gmailError: errorMsg });
    }

    // Format body
    resolvedConfig.body = formatEmailBody(resolvedConfig.body, resolvedConfig.format);

    // Validate email addresses
    const toResult = validateEmailList(resolvedConfig.to);
    resolvedConfig.to = toResult.formatted;

    const nodeId = this.getNodeId(node);
    const gmailPayload = {
      ...resolvedConfig,
      sessionId: state.sessionId,
      botId: state.botId,
      timestamp: new Date().toISOString(),
      nodeId,
      userMetadata: state.getUserMetadata(),
      answers: state.getAllAnswers(),
    };

    const socketEmitted = this.emitIntegrationEvent(
      'gmail-node', nodeId, gmailPayload as Record<string, unknown>, state,
    );

    // Fire-and-forget, but don't report success when the socket is down
    if (!socketEmitted) {
      this.storeIntegrationResult(state, 'gmail', false, undefined, 'Socket not connected');

      if (!config.proceedOnError) {
        return this.createError('Gmail send failed: socket not connected', true);
      }
      return this.proceed(node, { gmailSent: false, gmailError: 'Socket not connected' });
    }

    this.storeIntegrationResult(state, 'gmail', true);
    return this.proceed(node, { gmailSent: true });
  }
}

// ========================================
// 7-10. COMMUNICATION HANDLERS
// ========================================

/**
 * Base handler for communication platforms (Slack, Discord, WhatsApp, Telegram).
 * Provides common structure with platform-specific message formatting.
 */
abstract class BaseCommunicationHandler extends BaseIntegrationHandler {
  protected abstract readonly platformName: string;
  protected abstract readonly socketEvent: string;
  protected abstract readonly apiEndpoint: string;

  async handle(node: Record<string, unknown>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError(`${this.platformName} node missing data`);
    }

    const config: CommunicationConfig = {
      message: this.getString(data, 'message') || this.getString(data, 'text'),
      channel: this.getString(data, 'channel') || this.getString(data, 'channelId'),
      webhookUrl: this.getString(data, 'webhookUrl') || this.getString(data, 'webhook'),
      additionalData: data.additionalData as Record<string, unknown> || data.extra as Record<string, unknown>,
    };

    if (!config.message) {
      return this.createError(`${this.platformName} message is required`);
    }

    const resolvedMessage = state.resolveVariables(config.message);
    const resolvedChannel = config.channel ? state.resolveVariables(config.channel) : undefined;
    const resolvedWebhook = config.webhookUrl ? state.resolveVariables(config.webhookUrl) : undefined;

    const nodeId = this.getNodeId(node);
    const payload = {
      ...this.buildCommonPayload(state),
      nodeId,
      platform: this.platformName.toLowerCase(),
      message: resolvedMessage,
      channel: resolvedChannel,
      webhookUrl: resolvedWebhook,
      additionalData: config.additionalData
        ? this.resolveObjectVariables(config.additionalData, state)
        : undefined,
    };

    const socketEmitted = this.emitIntegrationEvent(
      this.nodeType, nodeId, payload as Record<string, unknown>, state,
    );

    if (!socketEmitted && resolvedWebhook) {
      const response = await this.makeApiCall(resolvedWebhook, 'POST', {
        text: resolvedMessage,
        channel: resolvedChannel,
        ...payload.additionalData,
      });

      if (!response.success) {
        this.storeIntegrationResult(state, this.platformName.toLowerCase(), false, undefined, response.error);

        const proceedOnError = this.getBoolean(data, 'proceedOnError', true);
        if (!proceedOnError) {
          return this.createError(`${this.platformName} send failed: ${response.error}`, true);
        }
      }
    } else if (!socketEmitted) {
      const apiUrl = this.apiBaseUrl
        ? `${this.apiBaseUrl}${this.apiEndpoint}`
        : this.apiEndpoint;

      await this.makeApiCall(apiUrl, 'POST', payload);
    }

    this.storeIntegrationResult(state, this.platformName.toLowerCase(), true);
    return this.proceed(node, { [`${this.platformName.toLowerCase()}Sent`]: true });
  }
}

/**
 * Slack node handler with rich message formatting support.
 */
export class SlackHandler extends BaseCommunicationHandler {
  readonly nodeType = 'slack-node';
  protected readonly platformName = 'Slack';
  protected readonly socketEvent = IntegrationSocketEvents.SLACK_SEND;
  protected readonly apiEndpoint = '/api/integrations/slack/send';

  async handle(node: Record<string, unknown>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Slack node missing data');
    }

    const config: SlackConfig = {
      message: this.getString(data, 'message') || this.getString(data, 'text'),
      channel: this.getString(data, 'channel') || this.getString(data, 'channelId'),
      webhookUrl: this.getString(data, 'webhookUrl') || this.getString(data, 'webhook'),
      username: this.getString(data, 'username'),
      icon: this.getString(data, 'icon') || this.getString(data, 'iconEmoji'),
      blocks: this.getArray(data, 'blocks') as SlackConfig['blocks'],
      attachments: this.getArray(data, 'attachments') as SlackConfig['attachments'],
      threadTs: this.getString(data, 'threadTs') || this.getString(data, 'thread_ts'),
    };

    if (!config.message && !config.blocks?.length) {
      return this.createError('Slack message or blocks required');
    }

    const resolvedMessage = config.message ? state.resolveVariables(config.message) : '';
    const resolvedChannel = config.channel ? state.resolveVariables(config.channel) : undefined;
    const resolvedWebhook = config.webhookUrl ? state.resolveVariables(config.webhookUrl) : undefined;

    // Format message with Slack markdown
    const formattedMessage = formatSlackMessage(resolvedMessage);

    // Build blocks if not provided
    let blocks = config.blocks;
    if (!blocks && resolvedMessage) {
      blocks = [createSlackBlock(formattedMessage)];
    }

    // Build attachments with collected data
    let attachments = config.attachments;
    if (!attachments && this.getBoolean(data, 'includeAnswers', false)) {
      attachments = [createSlackAttachment(state.getAllAnswers())];
    }

    const nodeId = this.getNodeId(node);
    const payload = {
      ...this.buildCommonPayload(state),
      nodeId,
      platform: 'slack',
      text: formattedMessage,
      channel: resolvedChannel,
      webhookUrl: resolvedWebhook,
      username: config.username,
      icon_emoji: config.icon,
      blocks,
      attachments,
      thread_ts: config.threadTs,
    };

    const socketEmitted = this.emitIntegrationEvent(
      'slack-node', nodeId, payload as Record<string, unknown>, state,
    );

    if (!socketEmitted && resolvedWebhook) {
      const webhookPayload = {
        text: formattedMessage,
        channel: resolvedChannel,
        username: config.username,
        icon_emoji: config.icon,
        blocks,
        attachments,
        thread_ts: config.threadTs,
      };

      const response = await this.makeApiCall(resolvedWebhook, 'POST', webhookPayload);

      if (!response.success) {
        this.storeIntegrationResult(state, 'slack', false, undefined, response.error);

        const proceedOnError = this.getBoolean(data, 'proceedOnError', true);
        if (!proceedOnError) {
          return this.createError(`Slack send failed: ${response.error}`, true);
        }
        return this.proceed(node, { slackSent: false });
      }
    } else if (!socketEmitted) {
      // Socket disconnected and no webhook fallback - don't report success
      this.storeIntegrationResult(state, 'slack', false, undefined, 'Socket not connected');
      return this.proceed(node, { slackSent: false });
    }

    this.storeIntegrationResult(state, 'slack', true);
    return this.proceed(node, { slackSent: true });
  }
}

/**
 * Discord node handler with embed support.
 */
export class DiscordHandler extends BaseCommunicationHandler {
  readonly nodeType = 'discord-node';
  protected readonly platformName = 'Discord';
  protected readonly socketEvent = IntegrationSocketEvents.DISCORD_SEND;
  protected readonly apiEndpoint = '/api/integrations/discord/send';

  async handle(node: Record<string, unknown>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Discord node missing data');
    }

    const config: DiscordConfig = {
      message: this.getString(data, 'message') || this.getString(data, 'content'),
      channel: this.getString(data, 'channel') || this.getString(data, 'channelId'),
      webhookUrl: this.getString(data, 'webhookUrl') || this.getString(data, 'webhook'),
      username: this.getString(data, 'username'),
      avatarUrl: this.getString(data, 'avatarUrl') || this.getString(data, 'avatar_url'),
      embeds: this.getArray(data, 'embeds') as DiscordConfig['embeds'],
      tts: this.getBoolean(data, 'tts', false),
    };

    if (!config.message && !config.embeds?.length) {
      return this.createError('Discord message or embeds required');
    }

    const resolvedMessage = config.message ? state.resolveVariables(config.message) : '';
    const resolvedChannel = config.channel ? state.resolveVariables(config.channel) : undefined;
    const resolvedWebhook = config.webhookUrl ? state.resolveVariables(config.webhookUrl) : undefined;

    // Format message
    const formattedMessage = formatDiscordMessage(resolvedMessage);

    // Build embeds if not provided and includeAnswers is true
    let embeds = config.embeds;
    if (!embeds && this.getBoolean(data, 'includeAnswers', false)) {
      const embedTitle = this.getString(data, 'embedTitle', 'New Submission');
      embeds = [createDiscordEmbed(embedTitle, undefined, state.getAllAnswers())];
    }

    const nodeId = this.getNodeId(node);
    const payload = {
      ...this.buildCommonPayload(state),
      nodeId,
      platform: 'discord',
      content: formattedMessage,
      channel: resolvedChannel,
      webhookUrl: resolvedWebhook,
      username: config.username,
      avatar_url: config.avatarUrl,
      embeds,
      tts: config.tts,
    };

    const socketEmitted = this.emitIntegrationEvent(
      'discord-node', nodeId, payload as Record<string, unknown>, state,
    );

    if (!socketEmitted && resolvedWebhook) {
      const webhookPayload = {
        content: formattedMessage,
        username: config.username,
        avatar_url: config.avatarUrl,
        embeds,
        tts: config.tts,
      };

      const response = await this.makeApiCall(resolvedWebhook, 'POST', webhookPayload);

      if (!response.success) {
        this.storeIntegrationResult(state, 'discord', false, undefined, response.error);

        const proceedOnError = this.getBoolean(data, 'proceedOnError', true);
        if (!proceedOnError) {
          return this.createError(`Discord send failed: ${response.error}`, true);
        }
        return this.proceed(node, { discordSent: false });
      }
    } else if (!socketEmitted) {
      // Socket disconnected and no webhook fallback - don't report success
      this.storeIntegrationResult(state, 'discord', false, undefined, 'Socket not connected');
      return this.proceed(node, { discordSent: false });
    }

    this.storeIntegrationResult(state, 'discord', true);
    return this.proceed(node, { discordSent: true });
  }
}

/**
 * WhatsApp node handler
 */
export class WhatsAppHandler extends BaseCommunicationHandler {
  readonly nodeType = 'whatsapp-node';
  protected readonly platformName = 'WhatsApp';
  protected readonly socketEvent = 'whatsapp:send';
  protected readonly apiEndpoint = '/api/integrations/whatsapp/send';

  async handle(node: Record<string, unknown>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('WhatsApp node missing data');
    }

    const phoneNumber = this.getString(data, 'phoneNumber') || this.getString(data, 'phone') || this.getString(data, 'to');
    if (phoneNumber) {
      (data as Record<string, unknown>).channel = phoneNumber;
    }

    return super.handle(node, state);
  }
}

/**
 * Telegram node handler
 */
export class TelegramHandler extends BaseCommunicationHandler {
  readonly nodeType = 'telegram-node';
  protected readonly platformName = 'Telegram';
  protected readonly socketEvent = 'telegram:send';
  protected readonly apiEndpoint = '/api/integrations/telegram/send';

  async handle(node: Record<string, unknown>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Telegram node missing data');
    }

    const chatId = this.getString(data, 'chatId') || this.getString(data, 'chat_id');
    if (chatId) {
      (data as Record<string, unknown>).channel = chatId;
    }

    return super.handle(node, state);
  }
}

// ========================================
// 11-13. GOOGLE HANDLERS
// ========================================

/**
 * Google Sheets node handler with proper data formatting.
 */
export class GoogleSheetsHandler extends BaseIntegrationHandler {
  readonly nodeType = 'google-sheets-node';

  async handle(node: Record<string, unknown>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Google Sheets node missing data');
    }

    const config: GoogleSheetsConfig = {
      spreadsheetId: this.getString(data, 'spreadsheetId') || this.getString(data, 'sheetId'),
      sheetName: this.getString(data, 'sheetName') || this.getString(data, 'sheet'),
      action: (this.getString(data, 'action', 'addRow') as GoogleSheetsConfig['action']),
      data: data.data as Record<string, unknown> || data.rowData as Record<string, unknown> || data.values as Record<string, unknown>,
      columnMappings: this.getArray(data, 'columnMappings') as GoogleSheetsConfig['columnMappings'],
      rowId: data.rowId as string | number,
      variableName: this.getString(data, 'variableName'),
      proceedOnError: this.getBoolean(data, 'proceedOnError', true),
    };

    if (!config.spreadsheetId) {
      return this.createError('Google Sheets spreadsheet ID is required');
    }

    // Build row data from answers if not provided
    let rowData = config.data;
    if (!rowData || Object.keys(rowData).length === 0) {
      rowData = {
        ...state.getAllAnswers(),
        ...state.getUserMetadata(),
      };
    } else {
      rowData = this.resolveObjectVariables(rowData, state);
    }

    // Add metadata to row
    const enrichedRowData = {
      ...rowData,
      _sessionId: state.sessionId,
      _timestamp: new Date().toISOString(),
    };


    const nodeId = this.getNodeId(node);
    const payload: GoogleSheetsPayload = {
      spreadsheetId: config.spreadsheetId,
      sheetName: config.sheetName,
      action: config.action,
      data: enrichedRowData,
      columnMappings: config.columnMappings,
      rowId: config.rowId,
      sessionId: state.sessionId,
      botId: state.botId,
      timestamp: new Date().toISOString(),
      nodeId,
    };

    // The server only accepts google-sheets-read-node / google-sheets-write-node
    // ('google-sheets-node' is rejected). Pick by the node's operation field,
    // mirroring the web widget's _handleGoogleSheetsNode.
    const inputs = (data.inputs as Record<string, unknown>) || {};
    const operation = this.getString(data, 'operation') ||
                      this.getString(inputs, 'operation') ||
                      'read';
    const sheetsNodeType = operation === 'write'
      ? 'google-sheets-write-node'
      : 'google-sheets-read-node';

    // Strip the engine-injected socketClient from the raw node data
    const { socketClient: _socketClient, ...nodeDataClean } =
      data as Record<string, unknown> & { socketClient?: unknown };

    const socketEmitted = this.emitIntegrationEvent(
      sheetsNodeType,
      nodeId,
      { ...nodeDataClean, ...(payload as unknown as Record<string, unknown>), operation },
      state,
    );

    if (socketEmitted) {
      // Wait for the server's integration-result (applies answerVariable and
      // columnMappedValues into state); proceed anyway after the 30s timeout
      await this.waitForIntegrationResult(nodeId, state);
    }

    if (!socketEmitted) {
      const apiUrl = this.apiBaseUrl
        ? `${this.apiBaseUrl}/api/integrations/google-sheets/${config.action}`
        : `/api/integrations/google-sheets/${config.action}`;

      const response = await this.makeApiCall(apiUrl, 'POST', payload);

      if (!response.success) {
        this.storeIntegrationResult(state, 'googleSheets', false, undefined, response.error);

        if (!config.proceedOnError) {
          return this.createError(`Google Sheets operation failed: ${response.error}`, true);
        }
        return this.proceed(node, { googleSheetsSuccess: false, googleSheetsError: response.error });
      }

      if (config.variableName && response.data) {
        state.setVariable(config.variableName, response.data);
      }
      state.setVariable('_googleSheetsResponse', response.data);
    }

    this.storeIntegrationResult(state, 'googleSheets', true);
    return this.proceed(node, { googleSheetsSuccess: true });
  }
}

/**
 * Google Calendar node handler
 */
export class GoogleCalendarHandler extends BaseIntegrationHandler {
  readonly nodeType = 'google-calendar-node';

  async handle(node: Record<string, unknown>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Google Calendar node missing data');
    }

    const config: GoogleCalendarConfig = {
      calendarId: this.getString(data, 'calendarId') || this.getString(data, 'calendar'),
      action: (this.getString(data, 'action', 'createEvent') as GoogleCalendarConfig['action']),
      event: data.event as GoogleCalendarConfig['event'],
      startDate: this.getString(data, 'startDate'),
      endDate: this.getString(data, 'endDate'),
      timezone: this.getString(data, 'timezone'),
      variableName: this.getString(data, 'variableName'),
      proceedOnError: this.getBoolean(data, 'proceedOnError', true),
    };

    // Resolve event data variables
    let resolvedEvent = config.event;
    if (resolvedEvent) {
      resolvedEvent = {
        title: state.resolveVariables(resolvedEvent.title || ''),
        description: resolvedEvent.description ? state.resolveVariables(resolvedEvent.description) : undefined,
        startTime: state.resolveVariables(resolvedEvent.startTime || ''),
        endTime: state.resolveVariables(resolvedEvent.endTime || ''),
        attendees: resolvedEvent.attendees?.map((a: string) => state.resolveVariables(a)),
        location: resolvedEvent.location ? state.resolveVariables(resolvedEvent.location) : undefined,
        timezone: config.timezone,
      };
    }

    const payload = {
      ...this.buildCommonPayload(state),
      nodeId: this.getNodeId(node),
      calendarId: config.calendarId,
      action: config.action,
      event: resolvedEvent,
      startDate: config.startDate ? state.resolveVariables(config.startDate) : undefined,
      endDate: config.endDate ? state.resolveVariables(config.endDate) : undefined,
      timezone: config.timezone,
    };

    const socketEmitted = this.emitIntegrationEvent(
      'google-calendar-node', this.getNodeId(node), payload as Record<string, unknown>, state,
    );

    if (!socketEmitted) {
      const apiUrl = this.apiBaseUrl
        ? `${this.apiBaseUrl}/api/integrations/google-calendar/${config.action}`
        : `/api/integrations/google-calendar/${config.action}`;

      const response = await this.makeApiCall(apiUrl, 'POST', payload);

      if (!response.success) {
        this.storeIntegrationResult(state, 'googleCalendar', false, undefined, response.error);

        if (!config.proceedOnError) {
          return this.createError(`Google Calendar operation failed: ${response.error}`, true);
        }
        return this.proceed(node, { googleCalendarSuccess: false, googleCalendarError: response.error });
      }

      if (config.variableName && response.data) {
        state.setVariable(config.variableName, response.data);
      }

      const responseData = response.data as { eventId?: string; meetingLink?: string } | undefined;
      if (responseData?.eventId) {
        state.setVariable('_calendarEventId', responseData.eventId);
      }
      if (responseData?.meetingLink) {
        state.setVariable('_calendarMeetingLink', responseData.meetingLink);
      }
    }

    this.storeIntegrationResult(state, 'googleCalendar', true);
    return this.proceed(node, { googleCalendarSuccess: true });
  }
}

/**
 * Google Analytics node handler
 */
export class GoogleAnalyticsHandler extends BaseIntegrationHandler {
  readonly nodeType = 'google-analytics-node';

  async handle(node: Record<string, unknown>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Google Analytics node missing data');
    }

    const config: GoogleAnalyticsConfig = {
      trackingId: this.getString(data, 'trackingId') || this.getString(data, 'measurementId'),
      eventCategory: this.getString(data, 'eventCategory') || this.getString(data, 'category', 'Chatbot'),
      eventAction: this.getString(data, 'eventAction') || this.getString(data, 'action'),
      eventLabel: this.getString(data, 'eventLabel') || this.getString(data, 'label'),
      eventValue: this.getNumber(data, 'eventValue') || this.getNumber(data, 'value'),
      customDimensions: data.customDimensions as Record<string, string>,
      customMetrics: data.customMetrics as Record<string, number>,
    };

    if (!config.eventAction) {
      return this.createError('Google Analytics event action is required');
    }

    const resolvedConfig: GoogleAnalyticsConfig = {
      trackingId: config.trackingId ? state.resolveVariables(config.trackingId) : undefined,
      eventCategory: state.resolveVariables(config.eventCategory),
      eventAction: state.resolveVariables(config.eventAction),
      eventLabel: config.eventLabel ? state.resolveVariables(config.eventLabel) : undefined,
      eventValue: config.eventValue,
      customDimensions: config.customDimensions,
      customMetrics: config.customMetrics,
    };

    const payload = {
      ...this.buildCommonPayload(state),
      nodeId: this.getNodeId(node),
      ...resolvedConfig,
    };

    this.emitIntegrationEvent(
      'google-analytics-node', this.getNodeId(node), payload as Record<string, unknown>, state,
    );

    state.setVariable('_analyticsTracked', true);
    return this.proceed(node, { analyticsTracked: true });
  }
}

// ========================================
// 14-17. CRM HANDLERS
// ========================================

/**
 * Base handler for CRM integrations with proper data formatting.
 */
abstract class BaseCRMHandler extends BaseIntegrationHandler {
  protected abstract readonly crmName: string;
  protected abstract readonly socketEvent: string;
  protected abstract readonly apiEndpoint: string;
  /** Whether to await the server's integration-result after emitting */
  protected readonly awaitIntegrationResult: boolean = false;

  async handle(node: Record<string, unknown>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError(`${this.crmName} node missing data`);
    }

    const config: CRMConfig = {
      action: (this.getString(data, 'action', 'createContact') as CRMConfig['action']),
      contactData: data.contactData as Record<string, unknown> || data.contact as Record<string, unknown> || data.data as Record<string, unknown>,
      listId: this.getString(data, 'listId') || this.getString(data, 'list'),
      dealData: data.dealData as Record<string, unknown> || data.deal as Record<string, unknown>,
      webhookUrl: this.getString(data, 'webhookUrl'),
      variableName: this.getString(data, 'variableName'),
      proceedOnError: this.getBoolean(data, 'proceedOnError', true),
    };

    // Extract contact data from answers and metadata
    let contactData = config.contactData;
    if (!contactData || Object.keys(contactData).length === 0) {
      contactData = extractContactData(state.getAllAnswers(), state.getUserMetadata());
    } else {
      contactData = this.resolveObjectVariables(contactData, state);
    }

    // Format contact data for the specific CRM
    const formattedData = this.formatContactData(contactData as ContactData, config.action);

    const nodeId = this.getNodeId(node);
    const payload = {
      ...this.buildCommonPayload(state),
      nodeId,
      crm: this.crmName.toLowerCase(),
      action: config.action,
      properties: formattedData,
      contactData: formattedData,
      listId: config.listId,
      dealData: config.dealData ? this.resolveObjectVariables(config.dealData, state) : undefined,
    };

    const socketEmitted = this.emitIntegrationEvent(
      this.nodeType, nodeId, payload as Record<string, unknown>, state,
    );

    if (socketEmitted && this.awaitIntegrationResult) {
      // Await the server's integration-result (30s timeout, then proceed)
      await this.waitForIntegrationResult(nodeId, state);
    }

    if (!socketEmitted) {
      if (config.webhookUrl) {
        const response = await this.makeApiCall(
          state.resolveVariables(config.webhookUrl),
          'POST',
          payload
        );

        if (!response.success) {
          this.storeIntegrationResult(state, this.crmName.toLowerCase(), false, undefined, response.error);

          if (!config.proceedOnError) {
            return this.createError(`${this.crmName} operation failed: ${response.error}`, true);
          }
        } else {
          this.storeResponse(state, config.variableName, response.data);
        }
      } else {
        const apiUrl = this.apiBaseUrl
          ? `${this.apiBaseUrl}${this.apiEndpoint}/${config.action}`
          : `${this.apiEndpoint}/${config.action}`;

        const response = await this.makeApiCall(apiUrl, 'POST', payload);

        if (!response.success) {
          this.storeIntegrationResult(state, this.crmName.toLowerCase(), false, undefined, response.error);

          if (!config.proceedOnError) {
            return this.createError(`${this.crmName} operation failed: ${response.error}`, true);
          }
        } else {
          this.storeResponse(state, config.variableName, response.data);
        }
      }
    } else {
      this.storeIntegrationResult(state, this.crmName.toLowerCase(), true);
    }

    return this.proceed(node, { [`${this.crmName.toLowerCase()}Success`]: true });
  }

  protected abstract formatContactData(contact: ContactData, action: string): Record<string, unknown>;

  protected storeResponse(state: ChatState, variableName: string | undefined, data: unknown): void {
    this.storeIntegrationResult(state, this.crmName.toLowerCase(), true, data);

    const responseData = data as { id?: string; contactId?: string; recordId?: string } | undefined;
    if (responseData?.id || responseData?.contactId || responseData?.recordId) {
      state.setVariable(`_${this.crmName.toLowerCase()}Id`, responseData.id || responseData.contactId || responseData.recordId);
    }

    if (variableName) {
      state.setVariable(variableName, data);
    }
  }
}

/**
 * HubSpot node handler with proper contact/deal formatting.
 */
export class HubSpotHandler extends BaseCRMHandler {
  readonly nodeType = 'hubspot-node';
  protected readonly crmName = 'HubSpot';
  protected readonly socketEvent = IntegrationSocketEvents.HUBSPOT_EXECUTE;
  protected readonly apiEndpoint = '/api/integrations/hubspot';
  // hubspot-node is handled by the server's execute-integration dispatcher
  protected readonly awaitIntegrationResult = true;

  protected formatContactData(contact: ContactData, _action: string): Record<string, unknown> {
    return formatHubSpotContact(contact);
  }
}

/**
 * Salesforce node handler
 */
export class SalesforceHandler extends BaseCRMHandler {
  readonly nodeType = 'salesforce-node';
  protected readonly crmName = 'Salesforce';
  protected readonly socketEvent = IntegrationSocketEvents.SALESFORCE_EXECUTE;
  protected readonly apiEndpoint = '/api/integrations/salesforce';

  protected formatContactData(contact: ContactData, action: string): Record<string, unknown> {
    const objectType = action === 'createLead' ? 'Lead' : 'Contact';
    return formatSalesforceRecord(contact, objectType);
  }
}

/**
 * Zoho CRM node handler with proper lead/contact formatting.
 */
export class ZohoCRMHandler extends BaseIntegrationHandler {
  readonly nodeType = 'zohocrm-node';

  async handle(node: Record<string, unknown>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Zoho CRM node missing data');
    }

    const config: ZohoCRMConfig = {
      module: (this.getString(data, 'module', 'Contacts') as ZohoCRMConfig['module']),
      action: (this.getString(data, 'action', 'create') as ZohoCRMConfig['action']),
      data: data.data as Record<string, unknown> || data.recordData as Record<string, unknown>,
      recordId: this.getString(data, 'recordId'),
      searchCriteria: this.getString(data, 'searchCriteria'),
      variableName: this.getString(data, 'variableName'),
      proceedOnError: this.getBoolean(data, 'proceedOnError', true),
    };

    // Extract and format contact data
    let recordData = config.data;
    if (!recordData || Object.keys(recordData).length === 0) {
      const contactData = extractContactData(state.getAllAnswers(), state.getUserMetadata());
      recordData = formatZohoCRMRecord(contactData, config.module);
    } else {
      recordData = this.resolveObjectVariables(recordData, state);
    }

    const payload: ZohoCRMPayload = {
      module: config.module,
      action: config.action,
      data: [recordData],
      recordId: config.recordId,
      sessionId: state.sessionId,
      botId: state.botId,
      timestamp: new Date().toISOString(),
      nodeId: this.getNodeId(node),
    };

    const socketEmitted = this.emitIntegrationEvent(
      'zohocrm-node', this.getNodeId(node), payload as unknown as Record<string, unknown>, state,
    );

    if (socketEmitted) {
      // Await the server's integration-result (30s timeout, then proceed)
      await this.waitForIntegrationResult(this.getNodeId(node), state);
    }

    if (!socketEmitted) {
      const apiUrl = this.apiBaseUrl
        ? `${this.apiBaseUrl}/api/integrations/zoho-crm/${config.action}`
        : `/api/integrations/zoho-crm/${config.action}`;

      const response = await this.makeApiCall(apiUrl, 'POST', payload);

      if (!response.success) {
        this.storeIntegrationResult(state, 'zohoCRM', false, undefined, response.error);

        if (!config.proceedOnError) {
          return this.createError(`Zoho CRM operation failed: ${response.error}`, true);
        }
        return this.proceed(node, { zohoCRMSuccess: false, zohoCRMError: response.error });
      }

      if (config.variableName && response.data) {
        state.setVariable(config.variableName, response.data);
      }

      const responseData = response.data as { data?: Array<{ details?: { id?: string } }> } | undefined;
      if (responseData?.data?.[0]?.details?.id) {
        state.setVariable('_zohoCRMRecordId', responseData.data[0].details.id);
      }
    }

    this.storeIntegrationResult(state, 'zohoCRM', true);
    return this.proceed(node, { zohoCRMSuccess: true });
  }
}

/**
 * Mailchimp node handler
 */
export class MailchimpHandler extends BaseCRMHandler {
  readonly nodeType = 'mailchimp-node';
  protected readonly crmName = 'Mailchimp';
  protected readonly socketEvent = IntegrationSocketEvents.MAILCHIMP_EXECUTE;
  protected readonly apiEndpoint = '/api/integrations/mailchimp';

  protected formatContactData(contact: ContactData, _action: string): Record<string, unknown> {
    return {
      email_address: contact.email,
      status: 'subscribed',
      merge_fields: {
        FNAME: contact.firstName || '',
        LNAME: contact.lastName || '',
        PHONE: contact.phone || '',
      },
    };
  }

  async handle(node: Record<string, unknown>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Mailchimp node missing data');
    }

    const action = this.getString(data, 'action', 'addToList');
    const listId = this.getString(data, 'listId') || this.getString(data, 'audienceId');

    if ((action === 'addToList' || action === 'subscribe') && !listId) {
      return this.createError('Mailchimp list/audience ID is required for subscription');
    }

    if (listId) {
      (data as Record<string, unknown>).listId = listId;
    }

    return super.handle(node, state);
  }
}

// ========================================
// 18-20. AUTOMATION & DATABASE HANDLERS
// ========================================

/** Integration webhook entry from get-chatbot-data (Zapier) */
interface IntegrationWebhookEntry {
  nodeId?: string;
  botId?: string;
  webhookURL?: string;
  active?: boolean;
}

/**
 * Zapier node handler.
 *
 * Matches the web widget contract: the webhook URL is NEVER posted to from
 * the client. Instead, the bot's `integrationWebhooks` array (delivered in
 * the get-chatbot-data response and stored in state) is used to look up the
 * active webhook for this node, and the trigger is relayed through the
 * server via the 'zapier-node-trigger' socket event.
 */
export class ZapierHandler extends BaseIntegrationHandler {
  readonly nodeType = 'zapier-node';

  async handle(node: Record<string, unknown>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Zapier node missing data');
    }

    const nodeId = this.getNodeId(node);

    // Look up the active webhook registered for this node
    const webhooks = (state.getVariable('_integrationWebhooks') as IntegrationWebhookEntry[]) || [];
    const webhookData = Array.isArray(webhooks)
      ? webhooks.find(
          (webhook) =>
            webhook?.nodeId === nodeId &&
            webhook?.botId === state.botId &&
            webhook?.active
        )
      : undefined;

    // No active webhook configured for this node: skip and proceed
    if (!webhookData?.webhookURL) {
      this.storeIntegrationResult(state, 'zapier', false, undefined, 'No active Zapier webhook for node');
      return this.proceed(node, { zapierTriggered: false });
    }

    // Flattened { key: value } map of all answer variables (web contract)
    const payload = state.getAllAnswers();

    // Strip the engine-injected socketClient from the raw node data
    const { socketClient: _socketClient, ...nodeDataClean } =
      data as Record<string, unknown> & { socketClient?: unknown };

    const triggerPayload = {
      nodeData: { ...nodeDataClean, nodeId, webhookURL: webhookData.webhookURL },
      payload,
      chatSessionId: state.sessionId,
      workspaceId: state.getVariable('_workspaceId') || '',
    };

    // Use the dedicated socket method when available
    const client = this.socketClient as
      | (SocketClient & { zapierNodeTrigger?: (payload: unknown) => void })
      | null;

    let sent = false;
    if (client && typeof client.zapierNodeTrigger === 'function') {
      client.zapierNodeTrigger(triggerPayload);
      sent = true;
    } else {
      sent = this.emitSocketEvent('zapier-node-trigger', triggerPayload);
    }

    this.storeIntegrationResult(
      state, 'zapier', sent, undefined, sent ? undefined : 'Socket not connected',
    );
    return this.proceed(node, { zapierTriggered: sent });
  }
}

/**
 * Airtable node handler with proper record structure.
 */
export class AirtableHandler extends BaseIntegrationHandler {
  readonly nodeType = 'airtable-node';

  async handle(node: Record<string, unknown>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Airtable node missing data');
    }

    const config: AirtableConfig = {
      baseId: this.getString(data, 'baseId') || this.getString(data, 'base'),
      tableName: this.getString(data, 'tableName') || this.getString(data, 'table'),
      action: (this.getString(data, 'action', 'createRecord') as AirtableConfig['action']),
      recordId: this.getString(data, 'recordId'),
      fields: data.fields as Record<string, unknown> || data.data as Record<string, unknown>,
      filterFormula: this.getString(data, 'filterFormula'),
      maxRecords: this.getNumber(data, 'maxRecords'),
      sort: this.getArray(data, 'sort') as AirtableConfig['sort'],
      variableName: this.getString(data, 'variableName'),
      proceedOnError: this.getBoolean(data, 'proceedOnError', true),
    };

    if (!config.baseId) {
      return this.createError('Airtable base ID is required');
    }

    if (!config.tableName) {
      return this.createError('Airtable table name is required');
    }

    // Build fields data
    let fields = config.fields;
    if (!fields || Object.keys(fields).length === 0) {
      const answers = state.getAllAnswers();
      const userMeta = state.getUserMetadata();
      fields = {
        ...answers,
        Name: userMeta.name,
        Email: userMeta.email,
        Phone: userMeta.phone,
        SessionId: state.sessionId,
        Timestamp: new Date().toISOString(),
      };
    } else {
      fields = this.resolveObjectVariables(fields, state);
    }

    // Format fields for Airtable
    const formattedFields = formatAirtableFields(removeEmptyValues(fields) as Record<string, unknown>);

    const payload: AirtablePayload = {
      baseId: config.baseId,
      tableName: config.tableName,
      action: config.action,
      recordId: config.recordId,
      fields: formattedFields,
      filterFormula: config.filterFormula,
      maxRecords: config.maxRecords,
      sort: config.sort,
      sessionId: state.sessionId,
      botId: state.botId,
      timestamp: new Date().toISOString(),
      nodeId: this.getNodeId(node),
    };

    const socketEmitted = this.emitIntegrationEvent(
      'airtable-node', this.getNodeId(node), payload as unknown as Record<string, unknown>, state,
    );

    if (socketEmitted) {
      // Await the server's integration-result (30s timeout, then proceed)
      await this.waitForIntegrationResult(this.getNodeId(node), state);
    }

    if (!socketEmitted) {
      const apiUrl = this.apiBaseUrl
        ? `${this.apiBaseUrl}/api/integrations/airtable/${config.action}`
        : `/api/integrations/airtable/${config.action}`;

      const response = await this.makeApiCall(apiUrl, 'POST', payload);

      if (!response.success) {
        this.storeIntegrationResult(state, 'airtable', false, undefined, response.error);

        if (!config.proceedOnError) {
          return this.createError(`Airtable operation failed: ${response.error}`, true);
        }
        return this.proceed(node, { airtableSuccess: false, airtableError: response.error });
      }

      if (config.variableName && response.data) {
        state.setVariable(config.variableName, response.data);
      }

      const responseData = response.data as { id?: string } | undefined;
      if (responseData?.id) {
        state.setVariable('_airtableRecordId', responseData.id);
      }
    }

    this.storeIntegrationResult(state, 'airtable', true);
    return this.proceed(node, { airtableSuccess: true });
  }
}

/**
 * Notion node handler with proper page/database formatting.
 */
export class NotionHandler extends BaseIntegrationHandler {
  readonly nodeType = 'notion-node';

  async handle(node: Record<string, unknown>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Notion node missing data');
    }

    const config: NotionConfig = {
      databaseId: this.getString(data, 'databaseId') || this.getString(data, 'database'),
      parentPageId: this.getString(data, 'parentPageId') || this.getString(data, 'parentPage'),
      action: (this.getString(data, 'action', 'addToDatabase') as NotionConfig['action']),
      properties: data.properties as Record<string, unknown>,
      content: this.getArray(data, 'content') as NotionConfig['content'],
      filter: data.filter as Record<string, unknown>,
      sorts: this.getArray(data, 'sorts') as NotionConfig['sorts'],
      variableName: this.getString(data, 'variableName'),
      proceedOnError: this.getBoolean(data, 'proceedOnError', true),
    };

    // Validate required fields based on action
    if ((config.action === 'addToDatabase' || config.action === 'queryDatabase') && !config.databaseId) {
      return this.createError('Notion database ID is required for database operations');
    }

    if (config.action === 'createPage' && !config.parentPageId && !config.databaseId) {
      return this.createError('Notion parent page ID or database ID is required for page creation');
    }

    // Build properties from answers if not provided
    let properties = config.properties;
    if (!properties || Object.keys(properties).length === 0) {
      const answers = state.getAllAnswers();
      const userMeta = state.getUserMetadata();
      const combined = { ...answers, ...userMeta };
      properties = formatNotionProperties(combined);
    } else {
      properties = this.resolveObjectVariables(properties, state);
    }

    // Build content blocks
    let children: Record<string, unknown>[] | undefined;
    if (config.content && config.content.length > 0) {
      children = config.content.map((block) =>
        createNotionBlock(block.type, block.text, block.checked)
      );
    }

    const payload: NotionPayload = {
      action: config.action,
      databaseId: config.databaseId,
      parentPageId: config.parentPageId,
      properties,
      children: children as unknown as NotionPayload['children'],
      filter: config.filter,
      sorts: config.sorts,
      sessionId: state.sessionId,
      botId: state.botId,
      timestamp: new Date().toISOString(),
      nodeId: this.getNodeId(node),
    };

    const socketEmitted = this.emitIntegrationEvent(
      'notion-node', this.getNodeId(node), payload as unknown as Record<string, unknown>, state,
    );

    if (socketEmitted) {
      // Await the server's integration-result (30s timeout, then proceed)
      await this.waitForIntegrationResult(this.getNodeId(node), state);
    }

    if (!socketEmitted) {
      const apiUrl = this.apiBaseUrl
        ? `${this.apiBaseUrl}/api/integrations/notion/${config.action}`
        : `/api/integrations/notion/${config.action}`;

      const response = await this.makeApiCall(apiUrl, 'POST', payload);

      if (!response.success) {
        this.storeIntegrationResult(state, 'notion', false, undefined, response.error);

        if (!config.proceedOnError) {
          return this.createError(`Notion operation failed: ${response.error}`, true);
        }
        return this.proceed(node, { notionSuccess: false, notionError: response.error });
      }

      if (config.variableName && response.data) {
        state.setVariable(config.variableName, response.data);
      }

      const responseData = response.data as { id?: string; url?: string } | undefined;
      if (responseData?.id) {
        state.setVariable('_notionPageId', responseData.id);
      }
      if (responseData?.url) {
        state.setVariable('_notionPageUrl', responseData.url);
      }
    }

    this.storeIntegrationResult(state, 'notion', true);
    return this.proceed(node, { notionSuccess: true });
  }
}

// ========================================
// 21. STRIPE HANDLER
// ========================================

/**
 * Stripe node handler for payment session handling.
 *
 * Features:
 * - Payment link creation
 * - Checkout session creation
 * - Customer creation
 * - Subscription creation
 * - Proper amount formatting
 * - Metadata handling
 */
export class StripeHandler extends BaseIntegrationHandler {
  readonly nodeType = 'stripe-node';

  async handle(node: Record<string, unknown>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Stripe node missing data');
    }

    const config: StripeConfig = {
      action: (this.getString(data, 'action', 'createCheckoutSession') as StripeConfig['action']),
      amount: this.getNumber(data, 'amount'),
      currency: this.getString(data, 'currency', 'USD').toUpperCase(),
      description: this.getString(data, 'description'),
      productName: this.getString(data, 'productName') || this.getString(data, 'product'),
      customerEmail: this.getString(data, 'customerEmail') || this.getString(data, 'email'),
      successUrl: this.getString(data, 'successUrl'),
      cancelUrl: this.getString(data, 'cancelUrl'),
      priceId: this.getString(data, 'priceId'),
      metadata: data.metadata as Record<string, string>,
      variableName: this.getString(data, 'variableName'),
      proceedOnError: this.getBoolean(data, 'proceedOnError', true),
    };

    // Validate based on action
    if (config.action === 'createCheckoutSession' || config.action === 'createPaymentLink') {
      if (!config.amount && !config.priceId) {
        return this.createError('Stripe amount or price ID is required');
      }
    }

    // Get customer email from user metadata if not provided
    if (!config.customerEmail) {
      const userMeta = state.getUserMetadata();
      config.customerEmail = userMeta.email;
    }

    // Resolve variables
    const resolvedConfig: StripeConfig = {
      ...config,
      description: config.description ? state.resolveVariables(config.description) : undefined,
      productName: config.productName ? state.resolveVariables(config.productName) : undefined,
      customerEmail: config.customerEmail ? state.resolveVariables(config.customerEmail) : undefined,
      successUrl: config.successUrl ? state.resolveVariables(config.successUrl) : undefined,
      cancelUrl: config.cancelUrl ? state.resolveVariables(config.cancelUrl) : undefined,
    };

    // Format amount for Stripe (convert to cents)
    const formattedAmount = config.amount
      ? formatStripeAmount(config.amount, config.currency)
      : undefined;

    // Format metadata
    const formattedMetadata = formatStripeMetadata({
      ...state.getAllAnswers(),
      sessionId: state.sessionId,
      ...(config.metadata || {}),
    });

    const payload: StripePayload = {
      action: config.action,
      amount: formattedAmount,
      currency: config.currency || 'USD',
      description: resolvedConfig.description,
      productName: resolvedConfig.productName,
      customerEmail: resolvedConfig.customerEmail,
      successUrl: resolvedConfig.successUrl,
      cancelUrl: resolvedConfig.cancelUrl,
      priceId: config.priceId,
      metadata: formattedMetadata,
      sessionId: state.sessionId,
      botId: state.botId,
      timestamp: new Date().toISOString(),
      nodeId: this.getNodeId(node),
      answers: state.getAllAnswers(),
    };

    const socketEmitted = this.emitIntegrationEvent(
      'stripe-node', this.getNodeId(node), payload as unknown as Record<string, unknown>, state,
    );

    if (!socketEmitted) {
      const apiUrl = this.apiBaseUrl
        ? `${this.apiBaseUrl}/api/integrations/stripe/${config.action}`
        : `/api/integrations/stripe/${config.action}`;

      const response = await this.makeApiCall(apiUrl, 'POST', payload);

      if (!response.success) {
        this.storeIntegrationResult(state, 'stripe', false, undefined, response.error);

        if (!config.proceedOnError) {
          return this.createError(`Stripe operation failed: ${response.error}`, true);
        }
        return this.proceed(node, { stripeSuccess: false, stripeError: response.error });
      }

      if (config.variableName && response.data) {
        state.setVariable(config.variableName, response.data);
      }

      const responseData = response.data as {
        id?: string;
        url?: string;
        paymentIntentId?: string;
        customerId?: string;
        subscriptionId?: string;
      } | undefined;

      if (responseData?.id) {
        state.setVariable('_stripeSessionId', responseData.id);
      }
      if (responseData?.url) {
        state.setVariable('_stripeCheckoutUrl', responseData.url);
      }
      if (responseData?.paymentIntentId) {
        state.setVariable('_stripePaymentIntentId', responseData.paymentIntentId);
      }
      if (responseData?.customerId) {
        state.setVariable('_stripeCustomerId', responseData.customerId);
      }
      if (responseData?.subscriptionId) {
        state.setVariable('_stripeSubscriptionId', responseData.subscriptionId);
      }
    }

    this.storeIntegrationResult(state, 'stripe', true);
    return this.proceed(node, { stripeSuccess: true });
  }
}

// ========================================
// 22. GOOGLE MEET HANDLER
// ========================================

/**
 * Handles google-meet-node - Google Meet integration.
 * Emits socket event for meeting booking; supports calendar-style booking UI.
 */
export class GoogleMeetHandler extends BaseIntegrationHandler {
  readonly nodeType = 'google-meet-node';

  async handle(node: Record<string, unknown>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Google Meet node missing data');
    }

    const nodeId = this.getNodeId(node);
    const operation = this.getString(data, 'operation', 'book');

    if (operation === 'book') {
      const timezone = this.getString(data, 'timeZone') ||
                       this.getString(data, 'timezone', 'UTC');
      const variableName = this.getString(data, 'answerVariable') ||
                           this.getString(data, 'variableName', 'meet_booking');

      // Display calendar UI for booking
      const uiState: NodeUIState.Calendar = {
        type: 'calendar',
        nodeId,
        question: 'Select a time for your meeting',
        variableName,
        mode: 'datetime',
        showTimeSlots: true,
      };

      return NodeResult.displayUI(uiState);
    }

    // Non-booking operations: emit socket event and proceed
    const payload = {
      ...this.buildCommonPayload(state),
      nodeId,
      operation,
    };

    this.emitIntegrationEvent('google-meet-node', nodeId, payload as Record<string, unknown>, state);
    this.storeIntegrationResult(state, 'googleMeet', true);

    return this.proceed(node, { googleMeetSuccess: true });
  }

  async handleResponse(
    response: any,
    node: Record<string, unknown>,
    state: ChatState
  ): Promise<NodeResult> {
    const data = this.getNodeData(node);
    const nodeId = this.getNodeId(node);

    const variableName = this.getString(data || {}, 'answerVariable') ||
                         this.getString(data || {}, 'variableName', 'meet_booking');

    if (response) {
      state.setVariable(variableName, response);
    }

    const payload = {
      ...this.buildCommonPayload(state),
      nodeId,
      operation: 'book',
      bookingData: response,
    };

    this.emitIntegrationEvent('google-meet-node', nodeId, payload as Record<string, unknown>, state);
    this.storeIntegrationResult(state, 'googleMeet', true);

    return this.proceed(node, { googleMeetSuccess: true });
  }
}

// ========================================
// 23. GOOGLE DOCS HANDLER
// ========================================

/**
 * Handles google-docs-node - Google Docs integration.
 * Creates/updates Google Docs via socket event.
 */
export class GoogleDocsHandler extends BaseIntegrationHandler {
  readonly nodeType = 'google-docs-node';

  async handle(node: Record<string, unknown>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Google Docs node missing data');
    }

    const nodeId = this.getNodeId(node);
    const operation = this.getString(data, 'operation', 'create');
    const title = this.getString(data, 'title', '');

    const payload = {
      ...this.buildCommonPayload(state),
      nodeId,
      operation,
      title: title ? state.resolveVariables(title) : undefined,
    };

    const socketEmitted = this.emitIntegrationEvent(
      'google-docs-node', nodeId, payload as Record<string, unknown>, state,
    );

    if (socketEmitted) {
      // Await the server's integration-result (30s timeout, then proceed)
      await this.waitForIntegrationResult(nodeId, state);
    }

    this.storeIntegrationResult(state, 'googleDocs', socketEmitted);

    return this.proceed(node, { googleDocsSuccess: socketEmitted, operation });
  }
}

// ========================================
// 24. GOOGLE DRIVE HANDLER
// ========================================

/**
 * Handles google-drive-node - Google Drive integration.
 * Uploads/downloads from Google Drive via socket event.
 */
export class GoogleDriveHandler extends BaseIntegrationHandler {
  readonly nodeType = 'google-drive-node';

  async handle(node: Record<string, unknown>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Google Drive node missing data');
    }

    const nodeId = this.getNodeId(node);
    const operation = this.getString(data, 'operation', 'upload');

    const payload = {
      ...this.buildCommonPayload(state),
      nodeId,
      operation,
    };

    const socketEmitted = this.emitIntegrationEvent(
      'google-drive-node', nodeId, payload as Record<string, unknown>, state,
    );

    if (socketEmitted) {
      // Await the server's integration-result (30s timeout, then proceed)
      await this.waitForIntegrationResult(nodeId, state);
    }

    this.storeIntegrationResult(state, 'googleDrive', socketEmitted);

    return this.proceed(node, { googleDriveSuccess: socketEmitted, operation });
  }
}

// ========================================
// HANDLER EXPORTS AND REGISTRATION
// ========================================

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
  WhatsAppHandler,
  TelegramHandler,
  GoogleSheetsHandler,
  GoogleCalendarHandler,
  GoogleAnalyticsHandler,
  GoogleMeetHandler,
  GoogleDocsHandler,
  GoogleDriveHandler,
  HubSpotHandler,
  SalesforceHandler,
  ZohoCRMHandler,
  MailchimpHandler,
  ZapierHandler,
  AirtableHandler,
  NotionHandler,
  StripeHandler,
};

/**
 * Creates instances of all integration handlers with optional socket client and API base URL.
 * @param socketClient - Optional socket client for real-time communication
 * @param apiBaseUrl - Optional base URL for API fallback calls
 * @returns Array of configured integration handlers
 */
export function createIntegrationHandlers(
  socketClient?: SocketClient,
  apiBaseUrl?: string
): BaseIntegrationHandler[] {
  const handlers: BaseIntegrationHandler[] = [
    new WebhookHandler(),
    new GPTHandler(),
    new HumanHandoverHandler(),
    new DelayHandler(),
    new EmailHandler(),
    new GmailHandler(),
    new SlackHandler(),
    new DiscordHandler(),
    new WhatsAppHandler(),
    new TelegramHandler(),
    new GoogleSheetsHandler(),
    new GoogleCalendarHandler(),
    new GoogleAnalyticsHandler(),
    new GoogleMeetHandler(),
    new GoogleDocsHandler(),
    new GoogleDriveHandler(),
    new HubSpotHandler(),
    new SalesforceHandler(),
    new ZohoCRMHandler(),
    new MailchimpHandler(),
    new ZapierHandler(),
    new AirtableHandler(),
    new NotionHandler(),
    new StripeHandler(),
  ];

  for (const handler of handlers) {
    if (socketClient) {
      handler.setSocketClient(socketClient);
    }
    if (apiBaseUrl) {
      handler.setApiBaseUrl(apiBaseUrl);
    }
  }

  return handlers;
}

/**
 * Registers all integration handlers with the provided registry.
 * @param registry - Node handler registry
 * @param socketClient - Optional socket client for real-time communication
 * @param apiBaseUrl - Optional base URL for API fallback calls
 */
export function registerIntegrationHandlers(
  registry: NodeHandlerRegistry,
  socketClient?: SocketClient,
  apiBaseUrl?: string
): void {
  const handlers = createIntegrationHandlers(socketClient, apiBaseUrl);
  registry.registerAll(handlers);
}

export default IntegrationHandlers;
