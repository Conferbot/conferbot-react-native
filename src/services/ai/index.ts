/**
 * AI Service Module
 *
 * Comprehensive AI integration for the Conferbot React Native SDK.
 * Supports multiple AI providers (OpenAI, Anthropic, custom) with streaming responses.
 */

// Main handler
export { AIHandler, getAIHandler, createAIHandler } from './AIHandler';

// Providers
export {
  BaseProvider,
  StreamControllerImpl,
  OpenAIProvider,
  AnthropicProvider,
  CustomProvider,
} from './providers';

// Token counter
export { TokenCounter, createTokenCounter, MODEL_TOKEN_LIMITS } from './TokenCounter';

// Types
export {
  // Configuration types
  type AIConfig,
  type AIProviderType,
  type AIMessageRole,

  // Message types
  type AIMessage,
  type AIResponse,

  // Error types
  type AIProviderError,
  AIErrorCode,

  // Streaming types
  type AIStreamCallback,
  type StreamController,
  StreamingState,

  // Context types
  type ContextEntry,
  type ContextConfig,
  type TokenEstimate,

  // Rate limiting types
  type RateLimitState,
  type RateLimitConfig,

  // Node config types
  type GPTNodeConfig,

  // UI state types
  type AIResponseUIState,

  // Provider interface
  type IAIProvider,
} from './types';
