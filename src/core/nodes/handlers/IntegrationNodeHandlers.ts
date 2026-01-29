/**
 * IntegrationNodeHandlers.ts
 *
 * Integration node handlers for the Conferbot React Native SDK.
 * Implements all 17 integration node types for external service communication.
 */

import { BaseNodeHandler, NodeResult, NodeUIState } from '../NodeHandler';
import { ChatState } from '../../state/ChatState';
import { NodeHandlerRegistry } from '../NodeHandlerRegistry';

// ========================================
// TYPES AND INTERFACES
// ========================================

/** HTTP method types */
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/** Socket client interface for event emission */
interface SocketClient {
  emit(event: string, payload: any): void;
  on?(event: string, callback: (data: any) => void): void;
  off?(event: string, callback?: (data: any) => void): void;
}

/** API call response */
interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
  statusCode?: number;
}

/** Webhook configuration */
interface WebhookConfig {
  url: string;
  method: HttpMethod;
  headers?: Record<string, string>;
  body?: any;
  variableName?: string;
  timeout?: number;
  retryCount?: number;
}

/** GPT configuration */
interface GPTConfig {
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  variableName?: string;
  systemPrompt?: string;
  streaming?: boolean;
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
    options?: Array<{ label: string; value: any }>;
  }>;
  waitMessage?: string;
  connectedMessage?: string;
  noAgentsMessage?: string;
  timeoutMessage?: string;
  timeoutSeconds?: number;
}

/** Email configuration */
interface EmailConfig {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  replyTo?: string;
  attachments?: Array<{ name: string; url: string }>;
}

/** Communication platform message config */
interface CommunicationConfig {
  message: string;
  channel?: string;
  webhookUrl?: string;
  additionalData?: Record<string, any>;
}

/** Google Sheets configuration */
interface GoogleSheetsConfig {
  spreadsheetId: string;
  sheetName?: string;
  action: 'addRow' | 'updateRow' | 'getRow';
  data?: Record<string, any>;
  rowId?: string | number;
  variableName?: string;
}

/** Google Calendar configuration */
interface GoogleCalendarConfig {
  calendarId?: string;
  action: 'createEvent' | 'checkAvailability' | 'getEvents';
  event?: {
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    attendees?: string[];
    location?: string;
  };
  startDate?: string;
  endDate?: string;
  variableName?: string;
}

/** Google Analytics configuration */
interface GoogleAnalyticsConfig {
  trackingId?: string;
  eventCategory: string;
  eventAction: string;
  eventLabel?: string;
  eventValue?: number;
}

/** CRM configuration (HubSpot, Salesforce, Mailchimp) */
interface CRMConfig {
  action: 'createContact' | 'updateContact' | 'createDeal' | 'addToList';
  contactData?: Record<string, any>;
  listId?: string;
  dealData?: Record<string, any>;
  webhookUrl?: string;
  variableName?: string;
}

/** Zapier configuration */
interface ZapierConfig {
  webhookUrl: string;
  data?: Record<string, any>;
  variableName?: string;
}

/** Airtable configuration */
interface AirtableConfig {
  baseId: string;
  tableName: string;
  action: 'createRecord' | 'updateRecord' | 'getRecord';
  recordId?: string;
  fields?: Record<string, any>;
  variableName?: string;
}

// ========================================
// BASE INTEGRATION HANDLER
// ========================================

/**
 * Base class for integration node handlers with shared utilities
 */
abstract class BaseIntegrationHandler extends BaseNodeHandler {
  protected socketClient: SocketClient | null = null;
  protected apiBaseUrl: string = '';
  protected defaultTimeout: number = 30000;

  /**
   * Sets the socket client for real-time communication
   */
  setSocketClient(client: SocketClient): void {
    this.socketClient = client;
  }

  /**
   * Sets the API base URL
   */
  setApiBaseUrl(url: string): void {
    this.apiBaseUrl = url;
  }

  /**
   * Makes an HTTP API call
   */
  protected async makeApiCall(
    url: string,
    method: HttpMethod,
    data?: any,
    headers?: Record<string, string>,
    timeout?: number
  ): Promise<ApiResponse> {
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

      let responseData: any;
      const contentType = response.headers.get('content-type');

      if (contentType?.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
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
   * Emits a socket event
   */
  protected emitSocketEvent(event: string, payload: any): boolean {
    if (!this.socketClient) {
      console.warn(`[${this.nodeType}] Socket client not available`);
      return false;
    }

    try {
      this.socketClient.emit(event, payload);
      return true;
    } catch (error) {
      console.error(`[${this.nodeType}] Socket emit error:`, error);
      return false;
    }
  }

  /**
   * Resolves all variables in an object
   */
  protected resolveObjectVariables(
    obj: Record<string, any>,
    state: ChatState
  ): Record<string, any> {
    const resolved: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        resolved[key] = state.resolveVariables(value);
      } else if (typeof value === 'object' && value !== null) {
        resolved[key] = Array.isArray(value)
          ? value.map((item) =>
              typeof item === 'string'
                ? state.resolveVariables(item)
                : typeof item === 'object'
                ? this.resolveObjectVariables(item, state)
                : item
            )
          : this.resolveObjectVariables(value, state);
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  /**
   * Builds common payload with state data
   */
  protected buildCommonPayload(state: ChatState): Record<string, any> {
    return {
      sessionId: state.sessionId,
      botId: state.botId,
      timestamp: new Date().toISOString(),
      userMetadata: state.getUserMetadata(),
      answers: state.getAllAnswers(),
    };
  }
}

// ========================================
// 1. WEBHOOK HANDLER
// ========================================

/**
 * Handles webhook node - makes HTTP requests to configured URLs
 */
export class WebhookHandler extends BaseIntegrationHandler {
  readonly nodeType = 'webhook';

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Webhook node missing data');
    }

    const config: WebhookConfig = {
      url: this.getString(data, 'url') || this.getString(data, 'webhookUrl'),
      method: (this.getString(data, 'method', 'POST').toUpperCase() as HttpMethod),
      headers: data.headers as Record<string, string>,
      body: data.body || data.payload,
      variableName: this.getString(data, 'variableName'),
      timeout: this.getNumber(data, 'timeout', 30000),
      retryCount: this.getNumber(data, 'retryCount', 0),
    };

    if (!config.url) {
      return this.createError('Webhook URL is required');
    }

    // Resolve variables in URL and body
    const resolvedUrl = state.resolveVariables(config.url);
    let resolvedBody = config.body;

    if (typeof resolvedBody === 'object' && resolvedBody !== null) {
      resolvedBody = this.resolveObjectVariables(resolvedBody, state);
    } else if (typeof resolvedBody === 'string') {
      resolvedBody = state.resolveVariables(resolvedBody);
      // Try to parse as JSON
      try {
        resolvedBody = JSON.parse(resolvedBody);
      } catch {
        // Keep as string if not valid JSON
      }
    }

    // Add common payload data if body is object
    if (typeof resolvedBody === 'object' && resolvedBody !== null) {
      resolvedBody = {
        ...this.buildCommonPayload(state),
        ...resolvedBody,
      };
    }

    // Resolve headers
    const resolvedHeaders = config.headers
      ? this.resolveObjectVariables(config.headers, state) as Record<string, string>
      : undefined;

    // Make the API call with retry support
    let lastError: string = '';
    const maxAttempts = (config.retryCount || 0) + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const response = await this.makeApiCall(
        resolvedUrl,
        config.method,
        resolvedBody,
        resolvedHeaders,
        config.timeout
      );

      if (response.success) {
        // Store response in variable if configured
        if (config.variableName) {
          state.setVariable(config.variableName, response.data);
        }

        // Also store in standard webhook response variable
        state.setVariable('_webhookResponse', response.data);
        state.setVariable('_webhookStatusCode', response.statusCode);

        return this.proceed(node, { webhookResponse: response.data });
      }

      lastError = response.error || 'Unknown error';

      if (attempt < maxAttempts) {
        // Wait before retry with exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        );
      }
    }

    // All attempts failed
    console.error(`[WebhookHandler] Request failed: ${lastError}`);
    state.setVariable('_webhookError', lastError);

    // Check if we should proceed on error
    const proceedOnError = this.getBoolean(data, 'proceedOnError', true);
    if (proceedOnError) {
      return this.proceed(node, { webhookError: lastError });
    }

    return this.createError(`Webhook request failed: ${lastError}`, true);
  }
}

// ========================================
// 2. GPT HANDLER
// ========================================

/**
 * Handles GPT node - sends prompts to GPT via socket/API for AI responses
 */
export class GPTHandler extends BaseIntegrationHandler {
  readonly nodeType = 'gpt';

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('GPT node missing data');
    }

    const nodeId = this.getNodeId(node);

    const config: GPTConfig = {
      prompt: this.getString(data, 'prompt') || this.getString(data, 'message'),
      model: this.getString(data, 'model', 'gpt-4'),
      maxTokens: this.getNumber(data, 'maxTokens', 1000),
      temperature: this.getNumber(data, 'temperature', 0.7),
      variableName: this.getString(data, 'variableName', 'gptResponse'),
      systemPrompt: this.getString(data, 'systemPrompt'),
      streaming: this.getBoolean(data, 'streaming', true),
    };

    if (!config.prompt) {
      return this.createError('GPT prompt is required');
    }

    // Resolve variables in prompts
    const resolvedPrompt = state.resolveVariables(config.prompt);
    const resolvedSystemPrompt = config.systemPrompt
      ? state.resolveVariables(config.systemPrompt)
      : undefined;

    // Build conversation context from transcript
    const transcript = state.getTranscript();
    const conversationHistory = transcript
      .filter((entry) => entry.type === 'bot' || entry.type === 'user')
      .slice(-10) // Last 10 messages for context
      .map((entry) => ({
        role: entry.type === 'user' ? 'user' : 'assistant',
        content: entry.text || '',
      }));

    // Emit GPT request via socket
    const gptPayload = {
      ...this.buildCommonPayload(state),
      nodeId,
      prompt: resolvedPrompt,
      systemPrompt: resolvedSystemPrompt,
      model: config.model,
      maxTokens: config.maxTokens,
      temperature: config.temperature,
      conversationHistory,
      streaming: config.streaming,
    };

    const socketEmitted = this.emitSocketEvent('gpt:request', gptPayload);

    if (!socketEmitted) {
      // Fallback to API call if socket not available
      const apiResponse = await this.makeGPTApiCall(config, resolvedPrompt, resolvedSystemPrompt, state);

      if (apiResponse.success && apiResponse.data) {
        const responseText = apiResponse.data.response || apiResponse.data.text || '';
        state.setVariable(config.variableName || 'gptResponse', responseText);

        // Return complete response UI state
        const uiState: NodeUIState.GPTResponse = {
          type: 'gptResponse',
          nodeId,
          text: responseText,
          isStreaming: false,
          isComplete: true,
        };

        return NodeResult.displayUI(uiState);
      }

      return this.createError(`GPT request failed: ${apiResponse.error}`, true);
    }

    // Return streaming response UI state
    const uiState: NodeUIState.GPTResponse = {
      type: 'gptResponse',
      nodeId,
      text: '',
      isStreaming: config.streaming,
      isComplete: false,
    };

    return NodeResult.displayUI(uiState);
  }

  /**
   * Handles GPT response from socket/callback
   */
  handleResponse(
    response: any,
    node: Record<string, any>,
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

  /**
   * Makes GPT API call as fallback
   */
  private async makeGPTApiCall(
    config: GPTConfig,
    prompt: string,
    systemPrompt: string | undefined,
    state: ChatState
  ): Promise<ApiResponse> {
    const apiUrl = this.apiBaseUrl
      ? `${this.apiBaseUrl}/api/gpt/complete`
      : '/api/gpt/complete';

    const requestBody = {
      ...this.buildCommonPayload(state),
      prompt,
      systemPrompt,
      model: config.model,
      maxTokens: config.maxTokens,
      temperature: config.temperature,
    };

    return this.makeApiCall(apiUrl, 'POST', requestBody);
  }
}

// ========================================
// 3. HUMAN HANDOVER HANDLER
// ========================================

/**
 * Handles human handover node - initiates live agent handover
 */
export class HumanHandoverHandler extends BaseIntegrationHandler {
  readonly nodeType = 'human-handover';

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Human handover node missing data');
    }

    const nodeId = this.getNodeId(node);

    const config: HumanHandoverConfig = {
      department: this.getString(data, 'department'),
      priority: this.getString(data, 'priority', 'normal'),
      showPreChatForm: this.getBoolean(data, 'showPreChatForm', false),
      preChatFields: this.getArray(data, 'preChatFields'),
      waitMessage: this.getString(data, 'waitMessage', 'Please wait while we connect you with an agent...'),
      connectedMessage: this.getString(data, 'connectedMessage', 'You are now connected with an agent.'),
      noAgentsMessage: this.getString(data, 'noAgentsMessage', 'Sorry, no agents are available at the moment.'),
      timeoutMessage: this.getString(data, 'timeoutMessage', 'Connection timed out. Please try again later.'),
      timeoutSeconds: this.getNumber(data, 'timeoutSeconds', 300),
    };

    // Resolve variable strings
    const resolvedWaitMessage = state.resolveVariables(config.waitMessage || '');
    const resolvedConnectedMessage = state.resolveVariables(config.connectedMessage || '');
    const resolvedNoAgentsMessage = state.resolveVariables(config.noAgentsMessage || '');
    const resolvedTimeoutMessage = state.resolveVariables(config.timeoutMessage || '');

    // Check if pre-chat form is needed and not yet filled
    const preChatCompleted = state.getVariable('_preChatFormCompleted');
    if (config.showPreChatForm && !preChatCompleted && config.preChatFields?.length) {
      const uiState: NodeUIState.HumanHandover = {
        type: 'humanHandover',
        nodeId,
        stage: 'waiting',
        showPreChatForm: true,
        preChatFields: config.preChatFields,
        waitMessage: resolvedWaitMessage,
      };

      return NodeResult.displayUI(uiState);
    }

    // Build handover request payload
    const handoverPayload = {
      ...this.buildCommonPayload(state),
      nodeId,
      department: config.department,
      priority: config.priority,
      transcript: state.getTranscript(),
      preChatData: state.getVariable('_preChatFormData'),
    };

    // Emit handover request via socket
    const socketEmitted = this.emitSocketEvent('handover:request', handoverPayload);

    if (!socketEmitted) {
      // No socket - return no agents UI state
      const uiState: NodeUIState.HumanHandover = {
        type: 'humanHandover',
        nodeId,
        stage: 'noAgents',
        noAgentsMessage: resolvedNoAgentsMessage,
      };

      return NodeResult.displayUI(uiState);
    }

    // Mark handover as initiated
    state.setVariable('_handoverInitiated', true);
    state.setVariable('_handoverStartTime', new Date().toISOString());

    // Return waiting UI state
    const uiState: NodeUIState.HumanHandover = {
      type: 'humanHandover',
      nodeId,
      stage: 'waiting',
      waitMessage: resolvedWaitMessage,
      connectedMessage: resolvedConnectedMessage,
      noAgentsMessage: resolvedNoAgentsMessage,
      timeoutMessage: resolvedTimeoutMessage,
    };

    return NodeResult.displayUI(uiState);
  }

  /**
   * Handles handover status updates
   */
  handleResponse(
    response: any,
    node: Record<string, any>,
    state: ChatState
  ): Promise<NodeResult> {
    const data = this.getNodeData(node);
    const nodeId = this.getNodeId(node);

    // Handle pre-chat form submission
    if (response.preChatFormData) {
      state.setVariable('_preChatFormData', response.preChatFormData);
      state.setVariable('_preChatFormCompleted', true);

      // Store individual fields in user metadata
      const metadata: Record<string, any> = {};
      for (const [key, value] of Object.entries(response.preChatFormData)) {
        metadata[key] = value;
      }
      state.setUserMetadata(metadata);

      // Re-handle to initiate actual handover
      return this.handle(node, state);
    }

    // Handle status updates from socket
    if (response.status === 'connected') {
      state.setVariable('_handoverConnected', true);
      state.setVariable('_agentName', response.agentName);

      const uiState: NodeUIState.HumanHandover = {
        type: 'humanHandover',
        nodeId,
        stage: 'connected',
        agentName: response.agentName,
        agentAvatar: response.agentAvatar,
        connectedMessage: state.resolveVariables(
          this.getString(data || {}, 'connectedMessage', 'You are now connected with {{agentName}}.')
        ),
      };

      return Promise.resolve(NodeResult.displayUI(uiState));
    }

    if (response.status === 'ended') {
      state.setVariable('_handoverEnded', true);

      // Proceed to next node when handover ends
      return Promise.resolve(this.proceed(node, { handoverEnded: true }));
    }

    if (response.status === 'noAgents') {
      const uiState: NodeUIState.HumanHandover = {
        type: 'humanHandover',
        nodeId,
        stage: 'noAgents',
        noAgentsMessage: state.resolveVariables(
          this.getString(data || {}, 'noAgentsMessage', 'No agents available.')
        ),
      };

      // Check if should proceed on no agents
      const proceedOnNoAgents = this.getBoolean(data || {}, 'proceedOnNoAgents', false);
      if (proceedOnNoAgents) {
        return Promise.resolve(this.proceed(node, { noAgents: true }));
      }

      return Promise.resolve(NodeResult.displayUI(uiState));
    }

    if (response.status === 'timeout') {
      state.setVariable('_handoverTimeout', true);

      const uiState: NodeUIState.HumanHandover = {
        type: 'humanHandover',
        nodeId,
        stage: 'timeout',
        timeoutMessage: state.resolveVariables(
          this.getString(data || {}, 'timeoutMessage', 'Connection timed out.')
        ),
      };

      const proceedOnTimeout = this.getBoolean(data || {}, 'proceedOnTimeout', false);
      if (proceedOnTimeout) {
        return Promise.resolve(this.proceed(node, { timeout: true }));
      }

      return Promise.resolve(NodeResult.displayUI(uiState));
    }

    // Default: return waiting state
    const uiState: NodeUIState.HumanHandover = {
      type: 'humanHandover',
      nodeId,
      stage: 'waiting',
    };

    return Promise.resolve(NodeResult.displayUI(uiState));
  }
}

// ========================================
// 4. DELAY HANDLER
// ========================================

/**
 * Handles delay node - pauses flow for configured duration
 */
export class DelayHandler extends BaseIntegrationHandler {
  readonly nodeType = 'delay';

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
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

    // Store delay info in state
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
 * Handles email node - triggers email send via socket/API
 */
export class EmailHandler extends BaseIntegrationHandler {
  readonly nodeType = 'email';

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
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
      attachments: this.getArray(data, 'attachments'),
    };

    if (!config.to) {
      return this.createError('Email recipient is required');
    }

    // Resolve variables in all fields
    const resolvedConfig: EmailConfig = {
      to: state.resolveVariables(config.to),
      subject: state.resolveVariables(config.subject),
      body: state.resolveVariables(config.body),
      cc: config.cc ? state.resolveVariables(config.cc) : undefined,
      bcc: config.bcc ? state.resolveVariables(config.bcc) : undefined,
      replyTo: config.replyTo ? state.resolveVariables(config.replyTo) : undefined,
      attachments: config.attachments,
    };

    // Build email payload
    const emailPayload = {
      ...this.buildCommonPayload(state),
      nodeId: this.getNodeId(node),
      ...resolvedConfig,
    };

    // Try socket first
    const socketEmitted = this.emitSocketEvent('email:send', emailPayload);

    if (!socketEmitted) {
      // Fallback to API
      const apiUrl = this.apiBaseUrl
        ? `${this.apiBaseUrl}/api/email/send`
        : '/api/email/send';

      const response = await this.makeApiCall(apiUrl, 'POST', emailPayload);

      if (!response.success) {
        console.error(`[EmailHandler] Send failed: ${response.error}`);
        state.setVariable('_emailError', response.error);

        const proceedOnError = this.getBoolean(data, 'proceedOnError', true);
        if (!proceedOnError) {
          return this.createError(`Email send failed: ${response.error}`, true);
        }
      } else {
        state.setVariable('_emailSent', true);
        state.setVariable('_emailMessageId', response.data?.messageId);
      }
    } else {
      state.setVariable('_emailSent', true);
    }

    return this.proceed(node, { emailSent: true });
  }
}

// ========================================
// 6-9. COMMUNICATION HANDLERS
// ========================================

/**
 * Base handler for communication platforms (Slack, Discord, WhatsApp, Telegram)
 */
abstract class BaseCommunicationHandler extends BaseIntegrationHandler {
  protected abstract readonly platformName: string;
  protected abstract readonly socketEvent: string;
  protected abstract readonly apiEndpoint: string;

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError(`${this.platformName} node missing data`);
    }

    const config: CommunicationConfig = {
      message: this.getString(data, 'message') || this.getString(data, 'text'),
      channel: this.getString(data, 'channel') || this.getString(data, 'channelId'),
      webhookUrl: this.getString(data, 'webhookUrl') || this.getString(data, 'webhook'),
      additionalData: data.additionalData || data.extra,
    };

    if (!config.message) {
      return this.createError(`${this.platformName} message is required`);
    }

    // Resolve variables
    const resolvedMessage = state.resolveVariables(config.message);
    const resolvedChannel = config.channel ? state.resolveVariables(config.channel) : undefined;
    const resolvedWebhook = config.webhookUrl ? state.resolveVariables(config.webhookUrl) : undefined;

    // Build payload
    const payload = {
      ...this.buildCommonPayload(state),
      nodeId: this.getNodeId(node),
      platform: this.platformName.toLowerCase(),
      message: resolvedMessage,
      channel: resolvedChannel,
      webhookUrl: resolvedWebhook,
      additionalData: config.additionalData
        ? this.resolveObjectVariables(config.additionalData, state)
        : undefined,
    };

    // Try socket first
    const socketEmitted = this.emitSocketEvent(this.socketEvent, payload);

    if (!socketEmitted && resolvedWebhook) {
      // Direct webhook call
      const response = await this.makeApiCall(resolvedWebhook, 'POST', {
        text: resolvedMessage,
        channel: resolvedChannel,
        ...payload.additionalData,
      });

      if (!response.success) {
        console.error(`[${this.platformName}Handler] Send failed: ${response.error}`);
        state.setVariable(`_${this.platformName.toLowerCase()}Error`, response.error);

        const proceedOnError = this.getBoolean(data, 'proceedOnError', true);
        if (!proceedOnError) {
          return this.createError(`${this.platformName} send failed: ${response.error}`, true);
        }
      }
    } else if (!socketEmitted) {
      // Try API endpoint
      const apiUrl = this.apiBaseUrl
        ? `${this.apiBaseUrl}${this.apiEndpoint}`
        : this.apiEndpoint;

      const response = await this.makeApiCall(apiUrl, 'POST', payload);

      if (!response.success) {
        console.error(`[${this.platformName}Handler] API call failed: ${response.error}`);
      }
    }

    state.setVariable(`_${this.platformName.toLowerCase()}Sent`, true);
    return this.proceed(node, { [`${this.platformName.toLowerCase()}Sent`]: true });
  }
}

/**
 * Slack node handler
 */
export class SlackHandler extends BaseCommunicationHandler {
  readonly nodeType = 'slack-node';
  protected readonly platformName = 'Slack';
  protected readonly socketEvent = 'slack:send';
  protected readonly apiEndpoint = '/api/integrations/slack/send';
}

/**
 * Discord node handler
 */
export class DiscordHandler extends BaseCommunicationHandler {
  readonly nodeType = 'discord-node';
  protected readonly platformName = 'Discord';
  protected readonly socketEvent = 'discord:send';
  protected readonly apiEndpoint = '/api/integrations/discord/send';
}

/**
 * WhatsApp node handler
 */
export class WhatsAppHandler extends BaseCommunicationHandler {
  readonly nodeType = 'whatsapp-node';
  protected readonly platformName = 'WhatsApp';
  protected readonly socketEvent = 'whatsapp:send';
  protected readonly apiEndpoint = '/api/integrations/whatsapp/send';

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('WhatsApp node missing data');
    }

    // WhatsApp may have phone number instead of channel
    const phoneNumber = this.getString(data, 'phoneNumber') || this.getString(data, 'phone') || this.getString(data, 'to');
    if (phoneNumber) {
      data.channel = phoneNumber;
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

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Telegram node missing data');
    }

    // Telegram uses chatId instead of channel
    const chatId = this.getString(data, 'chatId') || this.getString(data, 'chat_id');
    if (chatId) {
      data.channel = chatId;
    }

    return super.handle(node, state);
  }
}

// ========================================
// 10-12. GOOGLE HANDLERS
// ========================================

/**
 * Google Sheets node handler
 */
export class GoogleSheetsHandler extends BaseIntegrationHandler {
  readonly nodeType = 'google-sheets';

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Google Sheets node missing data');
    }

    const config: GoogleSheetsConfig = {
      spreadsheetId: this.getString(data, 'spreadsheetId') || this.getString(data, 'sheetId'),
      sheetName: this.getString(data, 'sheetName') || this.getString(data, 'sheet'),
      action: (this.getString(data, 'action', 'addRow') as GoogleSheetsConfig['action']),
      data: data.data || data.rowData || data.values,
      rowId: data.rowId,
      variableName: this.getString(data, 'variableName'),
    };

    if (!config.spreadsheetId) {
      return this.createError('Google Sheets spreadsheet ID is required');
    }

    // Build row data from answers if not provided
    let rowData = config.data;
    if (!rowData || Object.keys(rowData).length === 0) {
      rowData = state.getAllAnswers();
    } else if (typeof rowData === 'object') {
      rowData = this.resolveObjectVariables(rowData, state);
    }

    // Add metadata to row
    const enrichedRowData = {
      ...rowData,
      _sessionId: state.sessionId,
      _timestamp: new Date().toISOString(),
      ...state.getUserMetadata(),
    };

    // Build payload
    const payload = {
      ...this.buildCommonPayload(state),
      nodeId: this.getNodeId(node),
      spreadsheetId: config.spreadsheetId,
      sheetName: config.sheetName,
      action: config.action,
      data: enrichedRowData,
      rowId: config.rowId,
    };

    // Try socket first
    const socketEmitted = this.emitSocketEvent('googleSheets:execute', payload);

    if (!socketEmitted) {
      // Fallback to API
      const apiUrl = this.apiBaseUrl
        ? `${this.apiBaseUrl}/api/integrations/google-sheets/${config.action}`
        : `/api/integrations/google-sheets/${config.action}`;

      const response = await this.makeApiCall(apiUrl, 'POST', payload);

      if (!response.success) {
        console.error(`[GoogleSheetsHandler] Operation failed: ${response.error}`);
        state.setVariable('_googleSheetsError', response.error);

        const proceedOnError = this.getBoolean(data, 'proceedOnError', true);
        if (!proceedOnError) {
          return this.createError(`Google Sheets operation failed: ${response.error}`, true);
        }
      } else {
        if (config.variableName && response.data) {
          state.setVariable(config.variableName, response.data);
        }
        state.setVariable('_googleSheetsSuccess', true);
        state.setVariable('_googleSheetsResponse', response.data);
      }
    } else {
      state.setVariable('_googleSheetsSuccess', true);
    }

    return this.proceed(node, { googleSheetsSuccess: true });
  }
}

/**
 * Google Calendar node handler
 */
export class GoogleCalendarHandler extends BaseIntegrationHandler {
  readonly nodeType = 'google-calendar';

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Google Calendar node missing data');
    }

    const config: GoogleCalendarConfig = {
      calendarId: this.getString(data, 'calendarId') || this.getString(data, 'calendar'),
      action: (this.getString(data, 'action', 'createEvent') as GoogleCalendarConfig['action']),
      event: data.event,
      startDate: this.getString(data, 'startDate'),
      endDate: this.getString(data, 'endDate'),
      variableName: this.getString(data, 'variableName'),
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
      };
    }

    // Build payload
    const payload = {
      ...this.buildCommonPayload(state),
      nodeId: this.getNodeId(node),
      calendarId: config.calendarId,
      action: config.action,
      event: resolvedEvent,
      startDate: config.startDate ? state.resolveVariables(config.startDate) : undefined,
      endDate: config.endDate ? state.resolveVariables(config.endDate) : undefined,
    };

    // Try socket first
    const socketEmitted = this.emitSocketEvent('googleCalendar:execute', payload);

    if (!socketEmitted) {
      // Fallback to API
      const apiUrl = this.apiBaseUrl
        ? `${this.apiBaseUrl}/api/integrations/google-calendar/${config.action}`
        : `/api/integrations/google-calendar/${config.action}`;

      const response = await this.makeApiCall(apiUrl, 'POST', payload);

      if (!response.success) {
        console.error(`[GoogleCalendarHandler] Operation failed: ${response.error}`);
        state.setVariable('_googleCalendarError', response.error);

        const proceedOnError = this.getBoolean(data, 'proceedOnError', true);
        if (!proceedOnError) {
          return this.createError(`Google Calendar operation failed: ${response.error}`, true);
        }
      } else {
        if (config.variableName && response.data) {
          state.setVariable(config.variableName, response.data);
        }
        state.setVariable('_googleCalendarSuccess', true);
        state.setVariable('_googleCalendarResponse', response.data);

        // Store event ID for reference
        if (response.data?.eventId) {
          state.setVariable('_calendarEventId', response.data.eventId);
        }
      }
    } else {
      state.setVariable('_googleCalendarSuccess', true);
    }

    return this.proceed(node, { googleCalendarSuccess: true });
  }
}

/**
 * Google Analytics node handler
 */
export class GoogleAnalyticsHandler extends BaseIntegrationHandler {
  readonly nodeType = 'google-analytics';

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
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
    };

    if (!config.eventAction) {
      return this.createError('Google Analytics event action is required');
    }

    // Resolve variables
    const resolvedConfig: GoogleAnalyticsConfig = {
      trackingId: config.trackingId ? state.resolveVariables(config.trackingId) : undefined,
      eventCategory: state.resolveVariables(config.eventCategory),
      eventAction: state.resolveVariables(config.eventAction),
      eventLabel: config.eventLabel ? state.resolveVariables(config.eventLabel) : undefined,
      eventValue: config.eventValue,
    };

    // Build payload
    const payload = {
      ...this.buildCommonPayload(state),
      nodeId: this.getNodeId(node),
      ...resolvedConfig,
      userMetadata: state.getUserMetadata(),
    };

    // Emit socket event for GA tracking (handled client-side or server-side)
    const socketEmitted = this.emitSocketEvent('analytics:track', payload);

    if (!socketEmitted) {
      // Fallback to API
      const apiUrl = this.apiBaseUrl
        ? `${this.apiBaseUrl}/api/integrations/google-analytics/track`
        : '/api/integrations/google-analytics/track';

      const response = await this.makeApiCall(apiUrl, 'POST', payload);

      if (!response.success) {
        console.warn(`[GoogleAnalyticsHandler] Track failed: ${response.error}`);
        // Analytics failures should not block flow
      }
    }

    state.setVariable('_analyticsTracked', true);
    return this.proceed(node, { analyticsTracked: true });
  }
}

// ========================================
// 13-15. CRM HANDLERS
// ========================================

/**
 * Base handler for CRM integrations (HubSpot, Salesforce, Mailchimp)
 */
abstract class BaseCRMHandler extends BaseIntegrationHandler {
  protected abstract readonly crmName: string;
  protected abstract readonly socketEvent: string;
  protected abstract readonly apiEndpoint: string;

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError(`${this.crmName} node missing data`);
    }

    const config: CRMConfig = {
      action: (this.getString(data, 'action', 'createContact') as CRMConfig['action']),
      contactData: data.contactData || data.contact || data.data,
      listId: this.getString(data, 'listId') || this.getString(data, 'list'),
      dealData: data.dealData || data.deal,
      webhookUrl: this.getString(data, 'webhookUrl'),
      variableName: this.getString(data, 'variableName'),
    };

    // Build contact data from answers and metadata if not provided
    let contactData = config.contactData;
    if (!contactData || Object.keys(contactData).length === 0) {
      const userMeta = state.getUserMetadata();
      const answers = state.getAllAnswers();
      contactData = {
        email: userMeta.email || answers.email,
        firstName: userMeta.name?.split(' ')[0] || answers.name?.split(' ')[0],
        lastName: userMeta.name?.split(' ').slice(1).join(' ') || answers.name?.split(' ').slice(1).join(' '),
        phone: userMeta.phone || answers.phone,
        ...answers,
      };
    } else {
      contactData = this.resolveObjectVariables(contactData, state);
    }

    // Remove empty values
    contactData = Object.fromEntries(
      Object.entries(contactData).filter(([_, v]) => v !== undefined && v !== null && v !== '')
    );

    // Build payload
    const payload = {
      ...this.buildCommonPayload(state),
      nodeId: this.getNodeId(node),
      crm: this.crmName.toLowerCase(),
      action: config.action,
      contactData,
      listId: config.listId,
      dealData: config.dealData ? this.resolveObjectVariables(config.dealData, state) : undefined,
    };

    // Try socket first
    const socketEmitted = this.emitSocketEvent(this.socketEvent, payload);

    if (!socketEmitted) {
      // Try webhook if configured
      if (config.webhookUrl) {
        const response = await this.makeApiCall(
          state.resolveVariables(config.webhookUrl),
          'POST',
          payload
        );

        if (!response.success) {
          console.error(`[${this.crmName}Handler] Webhook failed: ${response.error}`);
          state.setVariable(`_${this.crmName.toLowerCase()}Error`, response.error);
        } else {
          this.storeResponse(state, config.variableName, response.data);
        }
      } else {
        // Fallback to API
        const apiUrl = this.apiBaseUrl
          ? `${this.apiBaseUrl}${this.apiEndpoint}/${config.action}`
          : `${this.apiEndpoint}/${config.action}`;

        const response = await this.makeApiCall(apiUrl, 'POST', payload);

        if (!response.success) {
          console.error(`[${this.crmName}Handler] API call failed: ${response.error}`);
          state.setVariable(`_${this.crmName.toLowerCase()}Error`, response.error);

          const proceedOnError = this.getBoolean(data, 'proceedOnError', true);
          if (!proceedOnError) {
            return this.createError(`${this.crmName} operation failed: ${response.error}`, true);
          }
        } else {
          this.storeResponse(state, config.variableName, response.data);
        }
      }
    } else {
      state.setVariable(`_${this.crmName.toLowerCase()}Success`, true);
    }

    return this.proceed(node, { [`${this.crmName.toLowerCase()}Success`]: true });
  }

  protected storeResponse(state: ChatState, variableName: string | undefined, data: any): void {
    state.setVariable(`_${this.crmName.toLowerCase()}Success`, true);
    state.setVariable(`_${this.crmName.toLowerCase()}Response`, data);

    if (data?.id || data?.contactId || data?.recordId) {
      state.setVariable(`_${this.crmName.toLowerCase()}Id`, data.id || data.contactId || data.recordId);
    }

    if (variableName) {
      state.setVariable(variableName, data);
    }
  }
}

/**
 * HubSpot node handler
 */
export class HubSpotHandler extends BaseCRMHandler {
  readonly nodeType = 'hubspot';
  protected readonly crmName = 'HubSpot';
  protected readonly socketEvent = 'hubspot:execute';
  protected readonly apiEndpoint = '/api/integrations/hubspot';
}

/**
 * Salesforce node handler
 */
export class SalesforceHandler extends BaseCRMHandler {
  readonly nodeType = 'salesforce';
  protected readonly crmName = 'Salesforce';
  protected readonly socketEvent = 'salesforce:execute';
  protected readonly apiEndpoint = '/api/integrations/salesforce';
}

/**
 * Mailchimp node handler
 */
export class MailchimpHandler extends BaseCRMHandler {
  readonly nodeType = 'mailchimp';
  protected readonly crmName = 'Mailchimp';
  protected readonly socketEvent = 'mailchimp:execute';
  protected readonly apiEndpoint = '/api/integrations/mailchimp';

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Mailchimp node missing data');
    }

    // Mailchimp-specific: require list ID for subscribe action
    const action = this.getString(data, 'action', 'addToList');
    const listId = this.getString(data, 'listId') || this.getString(data, 'audienceId');

    if ((action === 'addToList' || action === 'subscribe') && !listId) {
      return this.createError('Mailchimp list/audience ID is required for subscription');
    }

    // Ensure listId is in data for parent handler
    if (listId) {
      data.listId = listId;
    }

    return super.handle(node, state);
  }
}

// ========================================
// 16-17. AUTOMATION HANDLERS
// ========================================

/**
 * Zapier node handler
 */
export class ZapierHandler extends BaseIntegrationHandler {
  readonly nodeType = 'zapier';

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Zapier node missing data');
    }

    const config: ZapierConfig = {
      webhookUrl: this.getString(data, 'webhookUrl') || this.getString(data, 'webhook') || this.getString(data, 'zapUrl'),
      data: data.data || data.payload,
      variableName: this.getString(data, 'variableName'),
    };

    if (!config.webhookUrl) {
      return this.createError('Zapier webhook URL is required');
    }

    // Resolve webhook URL
    const resolvedWebhookUrl = state.resolveVariables(config.webhookUrl);

    // Build payload - include all answers and metadata
    let payload: Record<string, any> = {
      ...this.buildCommonPayload(state),
      nodeId: this.getNodeId(node),
    };

    // Add custom data if provided, otherwise use all answers
    if (config.data && Object.keys(config.data).length > 0) {
      payload = {
        ...payload,
        ...this.resolveObjectVariables(config.data, state),
      };
    } else {
      payload = {
        ...payload,
        ...state.getAllAnswers(),
      };
    }

    // Make webhook call
    const response = await this.makeApiCall(resolvedWebhookUrl, 'POST', payload);

    if (!response.success) {
      console.error(`[ZapierHandler] Webhook call failed: ${response.error}`);
      state.setVariable('_zapierError', response.error);

      const proceedOnError = this.getBoolean(data, 'proceedOnError', true);
      if (!proceedOnError) {
        return this.createError(`Zapier webhook failed: ${response.error}`, true);
      }
    } else {
      state.setVariable('_zapierSuccess', true);
      state.setVariable('_zapierResponse', response.data);

      if (config.variableName && response.data) {
        state.setVariable(config.variableName, response.data);
      }
    }

    // Also emit socket event for tracking
    this.emitSocketEvent('zapier:triggered', {
      sessionId: state.sessionId,
      nodeId: this.getNodeId(node),
      success: response.success,
    });

    return this.proceed(node, { zapierTriggered: response.success });
  }
}

/**
 * Airtable node handler
 */
export class AirtableHandler extends BaseIntegrationHandler {
  readonly nodeType = 'airtable';

  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('Airtable node missing data');
    }

    const config: AirtableConfig = {
      baseId: this.getString(data, 'baseId') || this.getString(data, 'base'),
      tableName: this.getString(data, 'tableName') || this.getString(data, 'table'),
      action: (this.getString(data, 'action', 'createRecord') as AirtableConfig['action']),
      recordId: this.getString(data, 'recordId'),
      fields: data.fields || data.data,
      variableName: this.getString(data, 'variableName'),
    };

    if (!config.baseId) {
      return this.createError('Airtable base ID is required');
    }

    if (!config.tableName) {
      return this.createError('Airtable table name is required');
    }

    // Build fields data from answers if not provided
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

    // Remove undefined/null values
    fields = Object.fromEntries(
      Object.entries(fields).filter(([_, v]) => v !== undefined && v !== null)
    );

    // Build payload
    const payload = {
      ...this.buildCommonPayload(state),
      nodeId: this.getNodeId(node),
      baseId: config.baseId,
      tableName: config.tableName,
      action: config.action,
      recordId: config.recordId,
      fields,
    };

    // Try socket first
    const socketEmitted = this.emitSocketEvent('airtable:execute', payload);

    if (!socketEmitted) {
      // Fallback to API
      const apiUrl = this.apiBaseUrl
        ? `${this.apiBaseUrl}/api/integrations/airtable/${config.action}`
        : `/api/integrations/airtable/${config.action}`;

      const response = await this.makeApiCall(apiUrl, 'POST', payload);

      if (!response.success) {
        console.error(`[AirtableHandler] Operation failed: ${response.error}`);
        state.setVariable('_airtableError', response.error);

        const proceedOnError = this.getBoolean(data, 'proceedOnError', true);
        if (!proceedOnError) {
          return this.createError(`Airtable operation failed: ${response.error}`, true);
        }
      } else {
        state.setVariable('_airtableSuccess', true);
        state.setVariable('_airtableResponse', response.data);

        // Store record ID for reference
        if (response.data?.id) {
          state.setVariable('_airtableRecordId', response.data.id);
        }

        if (config.variableName && response.data) {
          state.setVariable(config.variableName, response.data);
        }
      }
    } else {
      state.setVariable('_airtableSuccess', true);
    }

    return this.proceed(node, { airtableSuccess: true });
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
  SlackHandler,
  DiscordHandler,
  WhatsAppHandler,
  TelegramHandler,
  GoogleSheetsHandler,
  GoogleCalendarHandler,
  GoogleAnalyticsHandler,
  HubSpotHandler,
  SalesforceHandler,
  MailchimpHandler,
  ZapierHandler,
  AirtableHandler,
};

/**
 * Creates instances of all integration handlers
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
    new SlackHandler(),
    new DiscordHandler(),
    new WhatsAppHandler(),
    new TelegramHandler(),
    new GoogleSheetsHandler(),
    new GoogleCalendarHandler(),
    new GoogleAnalyticsHandler(),
    new HubSpotHandler(),
    new SalesforceHandler(),
    new MailchimpHandler(),
    new ZapierHandler(),
    new AirtableHandler(),
  ];

  // Configure all handlers with socket client and API base URL
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
 * Registers all integration handlers with the registry
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
