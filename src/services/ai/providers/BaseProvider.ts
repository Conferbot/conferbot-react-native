// @ts-nocheck
/**
 * BaseProvider.ts
 *
 * Base class for AI providers with common utilities and error handling.
 */

import type {
  AIConfig,
  AIMessage,
  AIResponse,
  AIStreamCallback,
  StreamController,
  AIProviderError,
  IAIProvider,
  StreamingState,
} from '../types';
import { AIErrorCode } from '../types';

// ========================================
// STREAM CONTROLLER IMPLEMENTATION
// ========================================

/**
 * Implementation of StreamController for managing streaming responses
 */
export class StreamControllerImpl implements StreamController {
  private abortController: AbortController;
  private _state: StreamingState = 'IDLE';
  private _content: string = '';

  constructor() {
    this.abortController = new AbortController();
  }

  abort(): void {
    this._state = 'STOPPED';
    this.abortController.abort();
  }

  isActive(): boolean {
    return this._state === 'CONNECTING' || this._state === 'STREAMING';
  }

  getState(): StreamingState {
    return this._state;
  }

  getContent(): string {
    return this._content;
  }

  setState(state: StreamingState): void {
    this._state = state;
  }

  appendContent(content: string): void {
    this._content += content;
  }

  getSignal(): AbortSignal {
    return this.abortController.signal;
  }
}

// ========================================
// BASE PROVIDER CLASS
// ========================================

/**
 * Abstract base class for AI providers
 * Provides common utilities and error handling
 */
export abstract class BaseProvider implements IAIProvider {
  abstract readonly name: string;
  abstract readonly displayName: string;
  abstract readonly defaultModel: string;
  abstract readonly supportedModels: string[];
  abstract readonly supportsStreaming: boolean;

  protected defaultTimeout: number = 60000;

  /**
   * Check if provider is configured
   */
  abstract isConfigured(config: AIConfig): boolean;

  /**
   * Generate non-streaming response
   */
  abstract generateResponse(
    prompt: string,
    context: AIMessage[],
    config: AIConfig
  ): Promise<AIResponse>;

  /**
   * Generate streaming response
   * Default implementation falls back to non-streaming
   */
  generateResponseStreaming(
    prompt: string,
    context: AIMessage[],
    config: AIConfig,
    callback: AIStreamCallback
  ): StreamController {
    const controller = new StreamControllerImpl();

    // Default: fall back to non-streaming
    controller.setState('CONNECTING');

    this.generateResponse(prompt, context, config)
      .then((response) => {
        if (controller.getState() === 'STOPPED') {
          callback.onStop?.();
          return;
        }

        controller.setState('STREAMING');
        controller.appendContent(response.content);
        callback.onToken(response.content);
        controller.setState('COMPLETED');
        callback.onComplete(response);
      })
      .catch((error) => {
        controller.setState('ERROR');
        callback.onError(this.normalizeError(error));
      });

    return controller;
  }

  // ========================================
  // ERROR HANDLING
  // ========================================

  /**
   * Creates a normalized AI provider error
   */
  protected createError(
    message: string,
    code: AIErrorCode,
    options?: {
      statusCode?: number;
      isRetryable?: boolean;
      retryAfterMs?: number;
      cause?: Error;
    }
  ): AIProviderError {
    return {
      message,
      code,
      provider: this.name,
      statusCode: options?.statusCode,
      isRateLimited: code === AIErrorCode.RATE_LIMITED,
      isRetryable: options?.isRetryable ?? this.isRetryableCode(code),
      retryAfterMs: options?.retryAfterMs,
      cause: options?.cause,
    };
  }

  /**
   * Normalizes any error to AIProviderError
   */
  protected normalizeError(error: unknown): AIProviderError {
    if (this.isAIProviderError(error)) {
      return error;
    }

    if (error instanceof Error) {
      // Check for abort error
      if (error.name === 'AbortError') {
        return this.createError('Request aborted', AIErrorCode.STREAM_INTERRUPTED, {
          isRetryable: false,
          cause: error,
        });
      }

      // Check for network error
      if (error.message.includes('network') || error.message.includes('fetch')) {
        return this.createError(
          `Network error: ${error.message}`,
          AIErrorCode.NETWORK_ERROR,
          { isRetryable: true, cause: error }
        );
      }

      // Check for timeout
      if (error.message.includes('timeout')) {
        return this.createError(
          `Request timeout: ${error.message}`,
          AIErrorCode.TIMEOUT,
          { isRetryable: true, cause: error }
        );
      }

      return this.createError(error.message, AIErrorCode.UNKNOWN, {
        isRetryable: true,
        cause: error,
      });
    }

    return this.createError(
      String(error),
      AIErrorCode.UNKNOWN,
      { isRetryable: true }
    );
  }

  /**
   * Type guard for AIProviderError
   */
  protected isAIProviderError(error: unknown): error is AIProviderError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'provider' in error &&
      'isRateLimited' in error
    );
  }

  /**
   * Determines if an error code is retryable
   */
  protected isRetryableCode(code: AIErrorCode): boolean {
    return [
      AIErrorCode.RATE_LIMITED,
      AIErrorCode.TIMEOUT,
      AIErrorCode.NETWORK_ERROR,
      AIErrorCode.SERVER_ERROR,
    ].includes(code);
  }

  /**
   * Maps HTTP status code to error code
   */
  protected statusCodeToErrorCode(statusCode: number): AIErrorCode {
    if (statusCode === 401 || statusCode === 403) {
      return AIErrorCode.INVALID_API_KEY;
    }
    if (statusCode === 429) {
      return AIErrorCode.RATE_LIMITED;
    }
    if (statusCode === 400) {
      return AIErrorCode.INVALID_REQUEST;
    }
    if (statusCode >= 500) {
      return AIErrorCode.SERVER_ERROR;
    }
    return AIErrorCode.UNKNOWN;
  }

  // ========================================
  // REQUEST UTILITIES
  // ========================================

  /**
   * Makes a fetch request with timeout and error handling
   */
  protected async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number = this.defaultTimeout
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parses error response from API
   */
  protected async parseErrorResponse(response: Response): Promise<AIProviderError> {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    let errorData: any = null;

    try {
      errorData = await response.json();
      if (errorData.error?.message) {
        errorMessage = errorData.error.message;
      } else if (errorData.message) {
        errorMessage = errorData.message;
      }
    } catch {
      // Keep default error message
    }

    const code = this.statusCodeToErrorCode(response.status);
    const retryAfterMs = this.parseRetryAfter(response.headers.get('retry-after'));

    return this.createError(errorMessage, code, {
      statusCode: response.status,
      isRetryable: this.isRetryableCode(code),
      retryAfterMs,
    });
  }

  /**
   * Parses Retry-After header
   */
  protected parseRetryAfter(header: string | null): number | undefined {
    if (!header) return undefined;

    // Check if it's a number (seconds)
    const seconds = parseInt(header, 10);
    if (!isNaN(seconds)) {
      return seconds * 1000;
    }

    // Check if it's a date
    const date = Date.parse(header);
    if (!isNaN(date)) {
      return Math.max(0, date - Date.now());
    }

    return undefined;
  }

  // ========================================
  // SSE PARSING
  // ========================================

  /**
   * Parses Server-Sent Events from a ReadableStream
   */
  protected async *parseSSEStream(
    reader: ReadableStreamDefaultReader<Uint8Array>
  ): AsyncGenerator<string> {
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // Process any remaining buffer
        if (buffer.trim()) {
          const lines = buffer.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              yield line.substring(6);
            }
          }
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');

      // Keep the last potentially incomplete line
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          yield line.substring(6);
        }
      }
    }
  }

  /**
   * Validates model is supported
   */
  protected validateModel(model: string): string {
    if (!model) {
      return this.defaultModel;
    }

    // Check if model is in supported list
    const modelLower = model.toLowerCase();
    const isSupported = this.supportedModels.some(
      (m) => m.toLowerCase() === modelLower
    );

    if (!isSupported) {
      console.warn(
        `[${this.name}] Model "${model}" not in supported list, proceeding anyway`
      );
    }

    return model;
  }
}

export default BaseProvider;
