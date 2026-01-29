/**
 * AIHandler.ts
 *
 * Main AI service handler for the Conferbot React Native SDK.
 * Manages AI providers, context building, streaming, rate limiting, and error recovery.
 */

import type {
  AIConfig,
  AIMessage,
  AIResponse,
  AIStreamCallback,
  StreamController,
  AIProviderError,
  IAIProvider,
  AIProviderType,
  ContextEntry,
  ContextConfig,
  TokenEstimate,
  RateLimitState,
  RateLimitConfig,
  GPTNodeConfig,
  AIResponseUIState,
  StreamingState,
} from './types';
import { AIErrorCode } from './types';
import { TokenCounter } from './TokenCounter';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { AnthropicProvider } from './providers/AnthropicProvider';
import { CustomProvider } from './providers/CustomProvider';
import { StreamControllerImpl } from './providers/BaseProvider';
import type { ChatState, TranscriptEntry } from '../../core/state/ChatState';

// ========================================
// CONSTANTS
// ========================================

const DEFAULT_CONTEXT_CONFIG: ContextConfig = {
  maxMessages: 20,
  maxTokens: 4000,
  includeSystemPrompt: true,
  includeAnswerVariables: true,
  truncationStrategy: 'oldest',
};

const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  requestsPerMinute: 60,
  enableBackoff: true,
  backoffBaseMs: 1000,
  backoffMaxMs: 60000,
};

// ========================================
// AI HANDLER CLASS
// ========================================

/**
 * AIHandler manages AI provider interactions, context building, and streaming responses.
 */
export class AIHandler {
  // Provider registry
  private providers: Map<string, IAIProvider> = new Map();

  // Default fallback chain order
  private fallbackOrder: AIProviderType[] = ['openai', 'anthropic', 'custom'];

  // Rate limit tracking per provider
  private rateLimits: Map<string, RateLimitState> = new Map();

  // Configuration
  private rateLimitConfig: RateLimitConfig;
  private contextConfig: ContextConfig;

  // Active stream controllers
  private activeStreams: Map<string, StreamController> = new Map();

  // Token counter
  private tokenCounter: TokenCounter;

  // Listeners
  private responseListeners: Set<(state: AIResponseUIState) => void> = new Set();

  constructor(
    rateLimitConfig?: Partial<RateLimitConfig>,
    contextConfig?: Partial<ContextConfig>
  ) {
    this.rateLimitConfig = { ...DEFAULT_RATE_LIMIT_CONFIG, ...rateLimitConfig };
    this.contextConfig = { ...DEFAULT_CONTEXT_CONFIG, ...contextConfig };
    this.tokenCounter = new TokenCounter();

    // Register built-in providers
    this.registerProvider(new OpenAIProvider());
    this.registerProvider(new AnthropicProvider());
    this.registerProvider(new CustomProvider());
  }

  // ========================================
  // PROVIDER MANAGEMENT
  // ========================================

  /**
   * Registers an AI provider
   */
  registerProvider(provider: IAIProvider): void {
    this.providers.set(provider.name.toLowerCase(), provider);
  }

  /**
   * Gets a provider by name
   */
  getProvider(name: string): IAIProvider | undefined {
    return this.providers.get(name.toLowerCase());
  }

  /**
   * Gets the provider for a model (auto-detect)
   */
  getProviderForModel(model: string): IAIProvider | undefined {
    const modelLower = model.toLowerCase();

    // OpenAI models
    if (modelLower.startsWith('gpt-') || modelLower.includes('gpt')) {
      return this.providers.get('openai');
    }

    // Anthropic models
    if (modelLower.startsWith('claude')) {
      return this.providers.get('anthropic');
    }

    // Check each provider's supported models
    for (const provider of this.providers.values()) {
      if (provider.supportedModels.some((m) => m.toLowerCase() === modelLower)) {
        return provider;
      }
    }

    return undefined;
  }

  /**
   * Gets the fallback chain of providers
   */
  getFallbackChain(preferredOrder?: AIProviderType[]): IAIProvider[] {
    const order = preferredOrder || this.fallbackOrder;
    return order
      .map((name) => this.providers.get(name))
      .filter((p): p is IAIProvider => p !== undefined);
  }

  // ========================================
  // CONTEXT MANAGEMENT
  // ========================================

  /**
   * Builds conversation context from ChatState
   */
  buildContext(
    chatState: ChatState,
    nodeConfig?: GPTNodeConfig
  ): AIMessage[] {
    const messages: AIMessage[] = [];
    const config = { ...this.contextConfig, ...nodeConfig };

    // Get transcript entries
    const transcript = chatState.getTranscript();
    const contextEntries = this.transcriptToContext(transcript, config.maxMessages);

    // Convert to AI messages
    for (const entry of contextEntries) {
      messages.push(entry.message);
    }

    // Add answer variables if enabled
    if (config.includeAnswerVariables) {
      const variables = this.buildVariableContext(chatState, config.customVariables);
      if (variables) {
        // Prepend as system context
        messages.unshift({
          role: 'system',
          content: `Current conversation data:\n${variables}`,
        });
      }
    }

    // Truncate if needed
    const estimate = this.tokenCounter.calculateEstimate(
      messages,
      undefined,
      undefined,
      config.maxTokens
    );

    if (estimate.needsTruncation) {
      return this.tokenCounter.truncateMessages(
        messages,
        config.maxTokens,
        config.truncationStrategy
      );
    }

    return messages;
  }

  /**
   * Converts transcript entries to context entries
   */
  private transcriptToContext(
    transcript: TranscriptEntry[],
    maxMessages: number
  ): ContextEntry[] {
    const entries: ContextEntry[] = [];

    // Filter to bot and user messages only, take most recent
    const relevantEntries = transcript
      .filter((entry) => entry.type === 'bot' || entry.type === 'user')
      .slice(-maxMessages);

    for (const entry of relevantEntries) {
      if (entry.text) {
        entries.push({
          message: {
            role: entry.type === 'user' ? 'user' : 'assistant',
            content: entry.text,
          },
          timestamp: entry.timestamp,
          nodeId: entry.nodeId,
          isBot: entry.type === 'bot',
        });
      }
    }

    return entries;
  }

  /**
   * Builds variable context string from ChatState
   */
  private buildVariableContext(
    chatState: ChatState,
    customVariables?: string[]
  ): string | null {
    const answers = chatState.getAllAnswers();
    const metadata = chatState.getUserMetadata();

    const contextParts: string[] = [];

    // Add user metadata
    if (metadata.name) {
      contextParts.push(`User name: ${metadata.name}`);
    }
    if (metadata.email) {
      contextParts.push(`User email: ${metadata.email}`);
    }

    // Add answer variables
    const answerEntries = Object.entries(answers);
    if (answerEntries.length > 0) {
      const answerLines = answerEntries
        .filter(([key]) => !key.startsWith('_')) // Skip internal variables
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join('\n');

      if (answerLines) {
        contextParts.push(`Collected information:\n${answerLines}`);
      }
    }

    // Add custom variables
    if (customVariables) {
      for (const varName of customVariables) {
        const value = chatState.getVariable(varName);
        if (value !== undefined) {
          contextParts.push(`${varName}: ${JSON.stringify(value)}`);
        }
      }
    }

    return contextParts.length > 0 ? contextParts.join('\n') : null;
  }

  /**
   * Estimates tokens for context
   */
  estimateContextTokens(
    context: AIMessage[],
    systemPrompt?: string,
    variables?: Record<string, any>
  ): TokenEstimate {
    return this.tokenCounter.calculateEstimate(context, systemPrompt, variables);
  }

  // ========================================
  // RESPONSE GENERATION
  // ========================================

  /**
   * Generates AI response (non-streaming)
   */
  async generateResponse(
    prompt: string,
    chatState: ChatState,
    config: AIConfig,
    nodeConfig?: GPTNodeConfig
  ): Promise<AIResponse> {
    // Determine provider
    const providerName = nodeConfig?.provider || this.detectProvider(config.model);
    const provider = this.getProvider(providerName);

    if (!provider) {
      throw this.createError(
        `Provider "${providerName}" not found`,
        AIErrorCode.NOT_CONFIGURED
      );
    }

    // Check rate limit
    await this.checkRateLimit(provider.name);

    // Build context
    const context = this.buildContext(chatState, nodeConfig);

    // Build full config
    const fullConfig: AIConfig = {
      ...config,
      systemPrompt: nodeConfig?.systemPrompt || config.systemPrompt,
    };

    // Resolve prompt variables
    const resolvedPrompt = chatState.resolveVariables(prompt);

    try {
      // Track rate limit
      this.recordRequest(provider.name);

      const response = await provider.generateResponse(
        resolvedPrompt,
        context,
        fullConfig
      );

      return response;
    } catch (error) {
      // Handle with fallback if enabled
      if (nodeConfig?.fallbackProviders && nodeConfig.fallbackProviders.length > 0) {
        return this.executeWithFallback(
          resolvedPrompt,
          context,
          fullConfig,
          nodeConfig.fallbackProviders
        );
      }
      throw error;
    }
  }

  /**
   * Generates AI response with streaming
   */
  generateResponseStreaming(
    prompt: string,
    chatState: ChatState,
    config: AIConfig,
    callback: AIStreamCallback,
    nodeConfig?: GPTNodeConfig
  ): StreamController {
    // Determine provider
    const providerName = nodeConfig?.provider || this.detectProvider(config.model);
    const provider = this.getProvider(providerName);

    if (!provider) {
      const controller = new StreamControllerImpl();
      controller.setState('ERROR');
      callback.onError(
        this.createError(
          `Provider "${providerName}" not found`,
          AIErrorCode.NOT_CONFIGURED
        )
      );
      return controller;
    }

    // Check rate limit (async, but start stream immediately)
    this.checkRateLimit(provider.name).catch((error) => {
      callback.onError(error as AIProviderError);
    });

    // Build context
    const context = this.buildContext(chatState, nodeConfig);

    // Build full config
    const fullConfig: AIConfig = {
      ...config,
      systemPrompt: nodeConfig?.systemPrompt || config.systemPrompt,
      streaming: true,
    };

    // Resolve prompt variables
    const resolvedPrompt = chatState.resolveVariables(prompt);

    // Track rate limit
    this.recordRequest(provider.name);

    // Create wrapper callback with UI state updates
    const streamId = this.generateStreamId();
    const wrappedCallback = this.wrapCallback(
      callback,
      streamId,
      nodeConfig?.variableName
    );

    // Start streaming
    const controller = provider.generateResponseStreaming(
      resolvedPrompt,
      context,
      fullConfig,
      wrappedCallback
    );

    // Track active stream
    this.activeStreams.set(streamId, controller);

    return controller;
  }

  /**
   * Stops an active stream
   */
  stopStream(streamId: string): boolean {
    const controller = this.activeStreams.get(streamId);
    if (controller && controller.isActive()) {
      controller.abort();
      this.activeStreams.delete(streamId);
      return true;
    }
    return false;
  }

  /**
   * Stops all active streams
   */
  stopAllStreams(): void {
    for (const [id, controller] of this.activeStreams) {
      if (controller.isActive()) {
        controller.abort();
      }
    }
    this.activeStreams.clear();
  }

  /**
   * Wraps callback with UI state updates
   */
  private wrapCallback(
    callback: AIStreamCallback,
    streamId: string,
    variableName?: string
  ): AIStreamCallback {
    let uiState: AIResponseUIState = {
      id: streamId,
      nodeId: '',
      state: 'IDLE',
      content: '',
      isComplete: false,
      startedAt: new Date().toISOString(),
    };

    return {
      onStart: () => {
        uiState = { ...uiState, state: 'CONNECTING' };
        this.notifyResponseListeners(uiState);
        callback.onStart?.();
      },
      onToken: (token: string) => {
        uiState = {
          ...uiState,
          state: 'STREAMING',
          content: uiState.content + token,
        };
        this.notifyResponseListeners(uiState);
        callback.onToken(token);
      },
      onComplete: (response: AIResponse) => {
        uiState = {
          ...uiState,
          state: 'COMPLETED',
          content: response.content,
          isComplete: true,
          provider: response.provider,
          model: response.model,
          tokensUsed: response.tokensUsed,
          completedAt: new Date().toISOString(),
        };
        this.notifyResponseListeners(uiState);
        this.activeStreams.delete(streamId);
        callback.onComplete(response);
      },
      onError: (error: AIProviderError) => {
        uiState = {
          ...uiState,
          state: 'ERROR',
          error,
          isComplete: true,
          completedAt: new Date().toISOString(),
        };
        this.notifyResponseListeners(uiState);
        this.activeStreams.delete(streamId);
        callback.onError(error);
      },
      onStop: () => {
        uiState = {
          ...uiState,
          state: 'STOPPED',
          isComplete: true,
          completedAt: new Date().toISOString(),
        };
        this.notifyResponseListeners(uiState);
        this.activeStreams.delete(streamId);
        callback.onStop?.();
      },
    };
  }

  // ========================================
  // FALLBACK EXECUTION
  // ========================================

  /**
   * Executes with fallback chain
   */
  async executeWithFallback(
    prompt: string,
    context: AIMessage[],
    config: AIConfig,
    fallbackProviders: AIProviderType[],
    maxRetries: number = 2
  ): Promise<AIResponse> {
    const errors: AIProviderError[] = [];

    for (const providerName of fallbackProviders) {
      const provider = this.getProvider(providerName);
      if (!provider || !provider.isConfigured(config)) {
        continue;
      }

      // Try with retries
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          await this.checkRateLimit(provider.name);
          this.recordRequest(provider.name);

          return await provider.generateResponse(prompt, context, config);
        } catch (error) {
          const providerError = this.normalizeError(error);
          errors.push(providerError);

          if (!providerError.isRetryable || attempt === maxRetries) {
            break;
          }

          // Exponential backoff
          const delay = this.calculateBackoff(attempt, providerError);
          await this.sleep(delay);
        }
      }
    }

    // All providers failed
    const errorMessages = errors.map((e) => `${e.provider}: ${e.message}`).join('; ');
    throw this.createError(
      `All providers failed: ${errorMessages}`,
      AIErrorCode.SERVER_ERROR,
      false
    );
  }

  // ========================================
  // RATE LIMITING
  // ========================================

  /**
   * Checks if rate limited for provider
   */
  private async checkRateLimit(provider: string): Promise<void> {
    const state = this.rateLimits.get(provider);
    if (!state) return;

    if (state.isLimited && state.resetAt) {
      const waitTime = state.resetAt - Date.now();
      if (waitTime > 0) {
        if (this.rateLimitConfig.enableBackoff) {
          await this.sleep(waitTime);
        } else {
          throw this.createError(
            `Rate limited for ${provider}. Retry after ${Math.ceil(waitTime / 1000)}s`,
            AIErrorCode.RATE_LIMITED,
            true
          );
        }
      }
    }
  }

  /**
   * Records a request for rate limiting
   */
  private recordRequest(provider: string): void {
    const now = Date.now();
    const windowDuration = 60000; // 1 minute

    let state = this.rateLimits.get(provider);

    if (!state || now - state.windowStart > windowDuration) {
      // New window
      state = {
        provider,
        requestCount: 1,
        windowStart: now,
        windowDuration,
        maxRequests: this.rateLimitConfig.requestsPerMinute,
        isLimited: false,
      };
    } else {
      state.requestCount++;

      if (state.requestCount >= state.maxRequests) {
        state.isLimited = true;
        state.resetAt = state.windowStart + windowDuration;
      }
    }

    this.rateLimits.set(provider, state);
  }

  /**
   * Calculates backoff delay
   */
  private calculateBackoff(attempt: number, error: AIProviderError): number {
    // Use retry-after if provided
    if (error.retryAfterMs) {
      return error.retryAfterMs;
    }

    // Exponential backoff
    const delay = Math.min(
      this.rateLimitConfig.backoffBaseMs * Math.pow(2, attempt - 1),
      this.rateLimitConfig.backoffMaxMs
    );

    // Add jitter
    return delay + Math.random() * 1000;
  }

  // ========================================
  // ERROR HANDLING
  // ========================================

  /**
   * Creates an AI provider error
   */
  private createError(
    message: string,
    code: AIErrorCode,
    isRetryable: boolean = false
  ): AIProviderError {
    return {
      message,
      code,
      provider: 'aihandler',
      isRateLimited: code === AIErrorCode.RATE_LIMITED,
      isRetryable,
    };
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
        provider: 'aihandler',
        isRateLimited: false,
        isRetryable: true,
        cause: error,
      };
    }

    return {
      message: String(error),
      code: AIErrorCode.UNKNOWN,
      provider: 'aihandler',
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

  // ========================================
  // UTILITIES
  // ========================================

  /**
   * Detects provider from model name
   */
  private detectProvider(model?: string): string {
    if (!model) return 'openai';

    const provider = this.getProviderForModel(model);
    return provider?.name || 'openai';
  }

  /**
   * Generates a unique stream ID
   */
  private generateStreamId(): string {
    return `stream_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ========================================
  // LISTENERS
  // ========================================

  /**
   * Adds a response state listener
   */
  addResponseListener(listener: (state: AIResponseUIState) => void): () => void {
    this.responseListeners.add(listener);
    return () => this.responseListeners.delete(listener);
  }

  /**
   * Notifies response listeners
   */
  private notifyResponseListeners(state: AIResponseUIState): void {
    this.responseListeners.forEach((listener) => {
      try {
        listener(state);
      } catch (error) {
        console.error('[AIHandler] Response listener error:', error);
      }
    });
  }

  // ========================================
  // NODE HANDLER INTEGRATION
  // ========================================

  /**
   * Processes a GPT node with full configuration
   */
  async processGPTNode(
    nodeConfig: GPTNodeConfig,
    chatState: ChatState,
    apiKey?: string
  ): Promise<AIResponse> {
    const config: AIConfig = {
      model: nodeConfig.model || 'gpt-3.5-turbo',
      temperature: nodeConfig.temperature,
      maxTokens: nodeConfig.maxTokens,
      apiKey: nodeConfig.apiKey || apiKey,
      customEndpoint: nodeConfig.customEndpoint,
      systemPrompt: nodeConfig.systemPrompt,
      streaming: nodeConfig.streaming ?? false,
      contextWindowSize: nodeConfig.contextWindowSize,
    };

    // Resolve prompt variables
    const resolvedPrompt = chatState.resolveVariables(nodeConfig.prompt);

    return this.generateResponse(resolvedPrompt, chatState, config, nodeConfig);
  }

  /**
   * Processes a GPT node with streaming
   */
  processGPTNodeStreaming(
    nodeConfig: GPTNodeConfig,
    chatState: ChatState,
    callback: AIStreamCallback,
    apiKey?: string
  ): StreamController {
    const config: AIConfig = {
      model: nodeConfig.model || 'gpt-3.5-turbo',
      temperature: nodeConfig.temperature,
      maxTokens: nodeConfig.maxTokens,
      apiKey: nodeConfig.apiKey || apiKey,
      customEndpoint: nodeConfig.customEndpoint,
      systemPrompt: nodeConfig.systemPrompt,
      streaming: true,
      contextWindowSize: nodeConfig.contextWindowSize,
    };

    // Resolve prompt variables
    const resolvedPrompt = chatState.resolveVariables(nodeConfig.prompt);

    return this.generateResponseStreaming(
      resolvedPrompt,
      chatState,
      config,
      callback,
      nodeConfig
    );
  }
}

// ========================================
// SINGLETON INSTANCE
// ========================================

let aiHandlerInstance: AIHandler | null = null;

/**
 * Gets the singleton AIHandler instance
 */
export function getAIHandler(): AIHandler {
  if (!aiHandlerInstance) {
    aiHandlerInstance = new AIHandler();
  }
  return aiHandlerInstance;
}

/**
 * Creates a new AIHandler instance (for custom configuration)
 */
export function createAIHandler(
  rateLimitConfig?: Partial<RateLimitConfig>,
  contextConfig?: Partial<ContextConfig>
): AIHandler {
  return new AIHandler(rateLimitConfig, contextConfig);
}

export default AIHandler;
