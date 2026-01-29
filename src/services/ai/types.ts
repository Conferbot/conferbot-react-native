/**
 * AI Service Types
 *
 * Type definitions for AI provider integration in the Conferbot React Native SDK.
 * Supports multiple AI providers (OpenAI, Anthropic, custom) with streaming responses.
 */

// ========================================
// CONFIGURATION TYPES
// ========================================

/**
 * Configuration for AI provider requests
 */
export interface AIConfig {
  /** Model identifier (e.g., 'gpt-4', 'claude-3-sonnet') */
  model: string;
  /** Sampling temperature (0.0 - 2.0, default: 0.7) */
  temperature?: number;
  /** Maximum tokens to generate (default: 1000) */
  maxTokens?: number;
  /** API key for authentication */
  apiKey?: string;
  /** Custom API endpoint URL */
  customEndpoint?: string;
  /** System prompt for context */
  systemPrompt?: string;
  /** Top-p sampling parameter */
  topP?: number;
  /** Frequency penalty (-2.0 to 2.0) */
  frequencyPenalty?: number;
  /** Presence penalty (-2.0 to 2.0) */
  presencePenalty?: number;
  /** Enable streaming responses */
  streaming?: boolean;
  /** Timeout in milliseconds (default: 60000) */
  timeout?: number;
  /** Maximum retries on failure (default: 2) */
  maxRetries?: number;
  /** Context window size (max messages for context) */
  contextWindowSize?: number;
  /** Token budget for context (max tokens before truncation) */
  contextTokenBudget?: number;
}

/**
 * AI provider types
 */
export type AIProviderType = 'openai' | 'anthropic' | 'deepseek' | 'custom';

/**
 * Message role types for conversation context
 */
export type AIMessageRole = 'system' | 'user' | 'assistant';

// ========================================
// MESSAGE TYPES
// ========================================

/**
 * Message format for AI conversation context
 */
export interface AIMessage {
  /** Message role (system, user, or assistant) */
  role: AIMessageRole;
  /** Message content */
  content: string;
  /** Optional message name (for multi-participant) */
  name?: string;
  /** Approximate token count (for budget management) */
  tokenCount?: number;
}

/**
 * Response from AI provider
 */
export interface AIResponse {
  /** Generated content */
  content: string;
  /** Total tokens used (input + output) */
  tokensUsed: number;
  /** Model used for generation */
  model: string;
  /** Provider name */
  provider: string;
  /** Reason generation stopped */
  finishReason?: string;
  /** Input tokens used */
  inputTokens?: number;
  /** Output tokens generated */
  outputTokens?: number;
  /** Response ID (if provided by API) */
  responseId?: string;
}

// ========================================
// ERROR TYPES
// ========================================

/**
 * AI provider error codes
 */
export enum AIErrorCode {
  /** API key not configured */
  NOT_CONFIGURED = 'NOT_CONFIGURED',
  /** Invalid API key */
  INVALID_API_KEY = 'INVALID_API_KEY',
  /** Rate limited by provider */
  RATE_LIMITED = 'RATE_LIMITED',
  /** Request timeout */
  TIMEOUT = 'TIMEOUT',
  /** Network error */
  NETWORK_ERROR = 'NETWORK_ERROR',
  /** Invalid request (bad parameters) */
  INVALID_REQUEST = 'INVALID_REQUEST',
  /** Server error from provider */
  SERVER_ERROR = 'SERVER_ERROR',
  /** Content filtered by provider */
  CONTENT_FILTERED = 'CONTENT_FILTERED',
  /** Token limit exceeded */
  TOKEN_LIMIT_EXCEEDED = 'TOKEN_LIMIT_EXCEEDED',
  /** Stream interrupted */
  STREAM_INTERRUPTED = 'STREAM_INTERRUPTED',
  /** Unknown error */
  UNKNOWN = 'UNKNOWN',
}

/**
 * AI provider exception with detailed error information
 */
export interface AIProviderError {
  /** Error message */
  message: string;
  /** Error code */
  code: AIErrorCode;
  /** Provider that generated the error */
  provider: string;
  /** HTTP status code (if applicable) */
  statusCode?: number;
  /** Whether the request was rate limited */
  isRateLimited: boolean;
  /** Whether the request can be retried */
  isRetryable: boolean;
  /** Retry delay suggestion in ms (for rate limiting) */
  retryAfterMs?: number;
  /** Original error (if wrapped) */
  cause?: Error;
}

// ========================================
// STREAMING TYPES
// ========================================

/**
 * Streaming response state
 */
export enum StreamingState {
  /** Not started */
  IDLE = 'IDLE',
  /** Connecting to API */
  CONNECTING = 'CONNECTING',
  /** Receiving tokens */
  STREAMING = 'STREAMING',
  /** Stream completed successfully */
  COMPLETED = 'COMPLETED',
  /** Stream was stopped by user */
  STOPPED = 'STOPPED',
  /** Stream encountered an error */
  ERROR = 'ERROR',
}

/**
 * Streaming response callback interface
 */
export interface AIStreamCallback {
  /** Called when a new token is received */
  onToken: (token: string) => void;
  /** Called when streaming completes successfully */
  onComplete: (response: AIResponse) => void;
  /** Called when an error occurs */
  onError: (error: AIProviderError) => void;
  /** Called when connection is established */
  onStart?: () => void;
  /** Called when stream is stopped by user */
  onStop?: () => void;
}

/**
 * Controller for managing streaming responses
 */
export interface StreamController {
  /** Abort the stream */
  abort: () => void;
  /** Check if stream is active */
  isActive: () => boolean;
  /** Get current streaming state */
  getState: () => StreamingState;
  /** Get accumulated content so far */
  getContent: () => string;
}

// ========================================
// CONTEXT MANAGEMENT TYPES
// ========================================

/**
 * Context entry for conversation history
 */
export interface ContextEntry {
  /** Message content */
  message: AIMessage;
  /** Timestamp when added */
  timestamp: string;
  /** Associated node ID (if from bot flow) */
  nodeId?: string;
  /** Whether this was from the bot */
  isBot: boolean;
}

/**
 * Context management configuration
 */
export interface ContextConfig {
  /** Maximum messages to include in context */
  maxMessages: number;
  /** Maximum tokens for context (before truncation) */
  maxTokens: number;
  /** Whether to include system prompt */
  includeSystemPrompt: boolean;
  /** Whether to include answer variables */
  includeAnswerVariables: boolean;
  /** Custom variable names to include */
  customVariables?: string[];
  /** Strategy for truncation when over budget */
  truncationStrategy: 'oldest' | 'summarize' | 'smart';
}

/**
 * Token estimation for context management
 */
export interface TokenEstimate {
  /** Estimated tokens for messages */
  messageTokens: number;
  /** Estimated tokens for system prompt */
  systemPromptTokens: number;
  /** Estimated tokens for variables */
  variableTokens: number;
  /** Total estimated tokens */
  totalTokens: number;
  /** Available tokens remaining */
  availableTokens: number;
  /** Whether truncation is needed */
  needsTruncation: boolean;
}

// ========================================
// UI STATE TYPES
// ========================================

/**
 * AI response UI state for rendering
 */
export interface AIResponseUIState {
  /** Unique identifier */
  id: string;
  /** Node ID this response is from */
  nodeId: string;
  /** Current streaming state */
  state: StreamingState;
  /** Accumulated content */
  content: string;
  /** Whether response is complete */
  isComplete: boolean;
  /** Error if any */
  error?: AIProviderError;
  /** Provider used */
  provider?: string;
  /** Model used */
  model?: string;
  /** Tokens used */
  tokensUsed?: number;
  /** Timestamp when started */
  startedAt: string;
  /** Timestamp when completed */
  completedAt?: string;
}

// ========================================
// PROVIDER INTERFACE
// ========================================

/**
 * Base interface for AI providers
 */
export interface IAIProvider {
  /** Provider name identifier */
  readonly name: string;
  /** Display name for UI */
  readonly displayName: string;
  /** Default model for this provider */
  readonly defaultModel: string;
  /** List of supported models */
  readonly supportedModels: string[];
  /** Whether streaming is supported */
  readonly supportsStreaming: boolean;

  /** Check if provider is properly configured */
  isConfigured(config: AIConfig): boolean;

  /** Generate a response (non-streaming) */
  generateResponse(
    prompt: string,
    context: AIMessage[],
    config: AIConfig
  ): Promise<AIResponse>;

  /** Generate a response with streaming */
  generateResponseStreaming(
    prompt: string,
    context: AIMessage[],
    config: AIConfig,
    callback: AIStreamCallback
  ): StreamController;
}

// ========================================
// RATE LIMITING TYPES
// ========================================

/**
 * Rate limit tracking
 */
export interface RateLimitState {
  /** Provider being tracked */
  provider: string;
  /** Number of requests in current window */
  requestCount: number;
  /** Window start time */
  windowStart: number;
  /** Window duration in ms */
  windowDuration: number;
  /** Maximum requests per window */
  maxRequests: number;
  /** Whether currently rate limited */
  isLimited: boolean;
  /** When rate limit resets */
  resetAt?: number;
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Requests per minute */
  requestsPerMinute: number;
  /** Tokens per minute (if applicable) */
  tokensPerMinute?: number;
  /** Enable automatic backoff */
  enableBackoff: boolean;
  /** Base backoff delay in ms */
  backoffBaseMs: number;
  /** Maximum backoff delay in ms */
  backoffMaxMs: number;
}

// ========================================
// NODE DATA TYPES
// ========================================

/**
 * GPT node configuration from nodeData
 */
export interface GPTNodeConfig {
  /** Prompt template */
  prompt: string;
  /** System prompt */
  systemPrompt?: string;
  /** Model to use */
  model?: string;
  /** Temperature setting */
  temperature?: number;
  /** Maximum tokens */
  maxTokens?: number;
  /** Variable name to store response */
  variableName?: string;
  /** Enable streaming */
  streaming?: boolean;
  /** Provider to use (openai, anthropic, etc.) */
  provider?: AIProviderType;
  /** Context window size (messages) */
  contextWindowSize?: number;
  /** Include answer variables in context */
  includeAnswerVariables?: boolean;
  /** Custom API key (if not using default) */
  apiKey?: string;
  /** Custom endpoint (for self-hosted) */
  customEndpoint?: string;
  /** Fallback providers if primary fails */
  fallbackProviders?: AIProviderType[];
  /** Show typing indicator */
  showTypingIndicator?: boolean;
  /** Allow user to stop generation */
  allowStopGeneration?: boolean;
  /** Allow regeneration */
  allowRegeneration?: boolean;
}

export default {
  AIErrorCode,
  StreamingState,
};
