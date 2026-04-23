// @ts-nocheck
/**
 * EnhancedGPTHandler.ts
 *
 * Enhanced GPT/AI node handler with multi-provider support, streaming responses,
 * context management, token counting, and error recovery.
 */

import { BaseNodeHandler, NodeResult, NodeUIState } from '../NodeHandler';
import { ChatState } from '../../state/ChatState';
import {
  AIHandler,
  getAIHandler,
  type AIConfig,
  type AIStreamCallback,
  type AIResponse,
  type AIProviderError,
  type GPTNodeConfig,
  type AIProviderType,
  type StreamController,
  StreamingState,
  AIErrorCode,
} from '../../../services/ai';

// ========================================
// TYPES
// ========================================

/** Extended GPT configuration from nodeData */
interface ExtendedGPTConfig extends GPTNodeConfig {
  /** API configuration from global settings */
  globalApiKey?: string;
  /** API endpoint override */
  apiEndpoint?: string;
}

/** Enhanced GPT UI state */
export interface EnhancedGPTUIState extends NodeUIState.GPTResponse {
  /** Streaming state */
  streamingState: StreamingState;
  /** Provider name */
  provider?: string;
  /** Model name */
  model?: string;
  /** Tokens used */
  tokensUsed?: number;
  /** Error details */
  error?: AIProviderError;
  /** Whether stop is allowed */
  allowStop: boolean;
  /** Whether regenerate is allowed */
  allowRegenerate: boolean;
  /** Stream controller ID for stop action */
  streamId?: string;
}

/** Socket client interface */
interface SocketClient {
  emit(event: string, payload: any): void;
  on?(event: string, callback: (data: any) => void): void;
  off?(event: string, callback?: (data: any) => void): void;
}

// ========================================
// ENHANCED GPT HANDLER
// ========================================

/**
 * Enhanced GPT handler with multi-provider support and streaming
 */
export class EnhancedGPTHandler extends BaseNodeHandler {
  readonly nodeType = 'gpt-node';

  private aiHandler: AIHandler;
  private socketClient: SocketClient | null = null;
  private apiBaseUrl: string = '';
  private globalApiKey: string = '';
  private activeStreamController: StreamController | null = null;

  constructor(aiHandler?: AIHandler) {
    super();
    this.aiHandler = aiHandler || getAIHandler();
  }

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
   * Sets the global API key for AI providers
   */
  setGlobalApiKey(apiKey: string): void {
    this.globalApiKey = apiKey;
  }

  /**
   * Main handler for GPT node
   */
  async handle(node: Record<string, any>, state: ChatState): Promise<NodeResult> {
    const data = this.getNodeData(node);
    if (!data) {
      return this.createError('GPT node missing data');
    }

    const nodeId = this.getNodeId(node);
    const config = this.parseNodeConfig(data);

    // Validate prompt
    if (!config.prompt) {
      return this.createError('GPT prompt is required');
    }

    // Determine if streaming is enabled
    const useStreaming = config.streaming ?? true;

    if (useStreaming) {
      return this.handleStreaming(node, state, config, nodeId);
    } else {
      return this.handleNonStreaming(node, state, config, nodeId);
    }
  }

  /**
   * Handles non-streaming GPT request
   */
  private async handleNonStreaming(
    node: Record<string, any>,
    state: ChatState,
    config: ExtendedGPTConfig,
    nodeId: string
  ): Promise<NodeResult> {
    // Show loading state
    const loadingState: EnhancedGPTUIState = {
      type: 'gptResponse',
      nodeId,
      text: '',
      isStreaming: false,
      isComplete: false,
      streamingState: 'CONNECTING',
      allowStop: false,
      allowRegenerate: false,
    };

    // We can't show loading and then proceed, so we process synchronously
    try {
      const aiConfig = this.buildAIConfig(config);
      const response = await this.aiHandler.processGPTNode(config, state, aiConfig.apiKey);

      // Store response in variable
      if (config.variableName) {
        state.setVariable(config.variableName, response.content);
      }

      // Emit socket event for tracking
      this.emitSocketEvent('gpt:complete', {
        sessionId: state.sessionId,
        nodeId,
        provider: response.provider,
        model: response.model,
        tokensUsed: response.tokensUsed,
        success: true,
      });

      // Return complete UI state
      const uiState: EnhancedGPTUIState = {
        type: 'gptResponse',
        nodeId,
        text: response.content,
        isStreaming: false,
        isComplete: true,
        streamingState: 'COMPLETED',
        provider: response.provider,
        model: response.model,
        tokensUsed: response.tokensUsed,
        allowStop: false,
        allowRegenerate: config.allowRegeneration ?? true,
      };

      return NodeResult.displayUI(uiState);
    } catch (error) {
      const providerError = this.normalizeError(error);

      // Store error in variable
      state.setVariable('_gptError', providerError.message);

      // Check if should proceed on error
      const proceedOnError = (node.data?.proceedOnError ?? true);
      if (proceedOnError) {
        // Return error UI state but allow proceeding
        const uiState: EnhancedGPTUIState = {
          type: 'gptResponse',
          nodeId,
          text: '',
          isStreaming: false,
          isComplete: true,
          streamingState: 'ERROR',
          error: providerError,
          allowStop: false,
          allowRegenerate: config.allowRegeneration ?? true,
        };

        return NodeResult.displayUI(uiState);
      }

      return this.createError(`GPT request failed: ${providerError.message}`, providerError.isRetryable);
    }
  }

  /**
   * Handles streaming GPT request
   */
  private async handleStreaming(
    node: Record<string, any>,
    state: ChatState,
    config: ExtendedGPTConfig,
    nodeId: string
  ): Promise<NodeResult> {
    const aiConfig = this.buildAIConfig(config);
    const streamId = `gpt_${nodeId}_${Date.now()}`;

    // Create streaming callback
    const callback: AIStreamCallback = {
      onStart: () => {
        this.emitSocketEvent('gpt:streaming:start', {
          sessionId: state.sessionId,
          nodeId,
          streamId,
        });
      },
      onToken: (token: string) => {
        this.emitSocketEvent('gpt:streaming:token', {
          sessionId: state.sessionId,
          nodeId,
          streamId,
          token,
        });
      },
      onComplete: (response: AIResponse) => {
        // Store response in variable
        if (config.variableName) {
          state.setVariable(config.variableName, response.content);
        }

        this.emitSocketEvent('gpt:streaming:complete', {
          sessionId: state.sessionId,
          nodeId,
          streamId,
          content: response.content,
          provider: response.provider,
          model: response.model,
          tokensUsed: response.tokensUsed,
        });
      },
      onError: (error: AIProviderError) => {
        state.setVariable('_gptError', error.message);

        this.emitSocketEvent('gpt:streaming:error', {
          sessionId: state.sessionId,
          nodeId,
          streamId,
          error: error.message,
          code: error.code,
        });
      },
      onStop: () => {
        this.emitSocketEvent('gpt:streaming:stopped', {
          sessionId: state.sessionId,
          nodeId,
          streamId,
        });
      },
    };

    // Start streaming
    this.activeStreamController = this.aiHandler.processGPTNodeStreaming(
      config,
      state,
      callback,
      aiConfig.apiKey
    );

    // Return streaming UI state
    const uiState: EnhancedGPTUIState = {
      type: 'gptResponse',
      nodeId,
      text: '',
      isStreaming: true,
      isComplete: false,
      streamingState: 'CONNECTING',
      allowStop: config.allowStopGeneration ?? true,
      allowRegenerate: false,
      streamId,
    };

    return NodeResult.displayUI(uiState);
  }

  /**
   * Handles user response (stop, regenerate)
   */
  async handleResponse(
    response: any,
    node: Record<string, any>,
    state: ChatState
  ): Promise<NodeResult> {
    const data = this.getNodeData(node);
    const nodeId = this.getNodeId(node);
    const variableName = this.getString(data || {}, 'variableName', 'gptResponse');

    // Handle stop action
    if (response.action === 'stop') {
      if (this.activeStreamController?.isActive()) {
        this.activeStreamController.abort();
        this.activeStreamController = null;
      }

      // Return stopped state but allow regeneration
      const uiState: EnhancedGPTUIState = {
        type: 'gptResponse',
        nodeId,
        text: response.currentContent || '',
        isStreaming: false,
        isComplete: true,
        streamingState: 'STOPPED',
        allowStop: false,
        allowRegenerate: true,
      };

      // Store partial response
      if (response.currentContent) {
        state.setVariable(variableName, response.currentContent);
      }

      return NodeResult.displayUI(uiState);
    }

    // Handle regenerate action
    if (response.action === 'regenerate') {
      // Re-run the handler
      return this.handle(node, state);
    }

    // Handle streaming completion
    if (response.type === 'streamComplete') {
      const responseText = response.content || '';
      state.setVariable(variableName, responseText);

      // Proceed to next node
      return this.proceed(node, { gptResponse: responseText });
    }

    // Handle error response
    if (response.error) {
      const error = typeof response.error === 'string'
        ? response.error
        : response.error.message;

      return this.createError(`GPT error: ${error}`, true);
    }

    // Handle direct response (from socket)
    const responseText = response.text || response.response || response.content || '';
    if (responseText) {
      state.setVariable(variableName, responseText);
      return this.proceed(node, { gptResponse: responseText });
    }

    // Default: proceed
    return this.proceed(node);
  }

  /**
   * Parses node configuration
   */
  private parseNodeConfig(data: Record<string, any>): ExtendedGPTConfig {
    return {
      prompt: this.getString(data, 'prompt') || this.getString(data, 'message'),
      systemPrompt: this.getString(data, 'systemPrompt'),
      model: this.getString(data, 'model', 'gpt-3.5-turbo'),
      temperature: this.getNumber(data, 'temperature', 0.7),
      maxTokens: this.getNumber(data, 'maxTokens', 1000),
      variableName: this.getString(data, 'variableName', 'gptResponse'),
      streaming: this.getBoolean(data, 'streaming', true),
      provider: this.parseProvider(data.provider),
      contextWindowSize: this.getNumber(data, 'contextWindowSize', 20),
      includeAnswerVariables: this.getBoolean(data, 'includeAnswerVariables', true),
      apiKey: this.getString(data, 'apiKey'),
      customEndpoint: this.getString(data, 'customEndpoint') || this.getString(data, 'apiEndpoint'),
      fallbackProviders: this.parseFallbackProviders(data.fallbackProviders),
      showTypingIndicator: this.getBoolean(data, 'showTypingIndicator', true),
      allowStopGeneration: this.getBoolean(data, 'allowStopGeneration', true),
      allowRegeneration: this.getBoolean(data, 'allowRegeneration', true),
      globalApiKey: this.globalApiKey,
    };
  }

  /**
   * Parses provider type from data
   */
  private parseProvider(provider: any): AIProviderType | undefined {
    if (!provider) return undefined;

    const providerStr = String(provider).toLowerCase();
    if (['openai', 'anthropic', 'deepseek', 'custom'].includes(providerStr)) {
      return providerStr as AIProviderType;
    }

    return undefined;
  }

  /**
   * Parses fallback providers array
   */
  private parseFallbackProviders(providers: any): AIProviderType[] | undefined {
    if (!Array.isArray(providers)) return undefined;

    return providers
      .map((p) => String(p).toLowerCase())
      .filter((p): p is AIProviderType =>
        ['openai', 'anthropic', 'deepseek', 'custom'].includes(p)
      );
  }

  /**
   * Builds AI config from node config
   */
  private buildAIConfig(config: ExtendedGPTConfig): AIConfig {
    return {
      model: config.model || 'gpt-3.5-turbo',
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      apiKey: config.apiKey || config.globalApiKey || this.globalApiKey,
      customEndpoint: config.customEndpoint || this.apiBaseUrl,
      systemPrompt: config.systemPrompt,
      streaming: config.streaming,
      contextWindowSize: config.contextWindowSize,
    };
  }

  /**
   * Emits a socket event
   */
  private emitSocketEvent(event: string, payload: any): void {
    if (this.socketClient) {
      try {
        this.socketClient.emit(event, payload);
      } catch (error) {
        console.error(`[EnhancedGPTHandler] Socket emit error:`, error);
      }
    }
  }

  /**
   * Normalizes any error to AIProviderError
   */
  private normalizeError(error: unknown): AIProviderError {
    if (this.isAIProviderError(error)) {
      return error;
    }

    if (error instanceof Error) {
      return {
        message: error.message,
        code: AIErrorCode.UNKNOWN,
        provider: 'gpt-handler',
        isRateLimited: false,
        isRetryable: true,
        cause: error,
      };
    }

    return {
      message: String(error),
      code: AIErrorCode.UNKNOWN,
      provider: 'gpt-handler',
      isRateLimited: false,
      isRetryable: true,
    };
  }

  /**
   * Type guard for AIProviderError
   */
  private isAIProviderError(error: unknown): error is AIProviderError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'provider' in error
    );
  }

  /**
   * Stops the current stream if active
   */
  stopCurrentStream(): void {
    if (this.activeStreamController?.isActive()) {
      this.activeStreamController.abort();
      this.activeStreamController = null;
    }
  }
}

// ========================================
// FACTORY FUNCTION
// ========================================

/**
 * Creates an enhanced GPT handler instance
 */
export function createEnhancedGPTHandler(
  aiHandler?: AIHandler,
  socketClient?: SocketClient,
  apiBaseUrl?: string,
  globalApiKey?: string
): EnhancedGPTHandler {
  const handler = new EnhancedGPTHandler(aiHandler);

  if (socketClient) {
    handler.setSocketClient(socketClient);
  }
  if (apiBaseUrl) {
    handler.setApiBaseUrl(apiBaseUrl);
  }
  if (globalApiKey) {
    handler.setGlobalApiKey(globalApiKey);
  }

  return handler;
}

export default EnhancedGPTHandler;
