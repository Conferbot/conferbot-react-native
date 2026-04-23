// @ts-nocheck
/**
 * AnthropicProvider.ts
 *
 * Anthropic Claude provider implementation with streaming support.
 * Supports Claude 3 (Opus, Sonnet, Haiku) and Claude 3.5 models.
 */

import type {
  AIConfig,
  AIMessage,
  AIResponse,
  AIStreamCallback,
  StreamController,
} from '../types';
import { AIErrorCode } from '../types';
import { BaseProvider, StreamControllerImpl } from './BaseProvider';

// ========================================
// CONSTANTS
// ========================================

const DEFAULT_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

const SUPPORTED_MODELS = [
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-3-haiku-20240307',
  'claude-3-5-sonnet-20240620',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'claude-2.1',
  'claude-2.0',
  'claude-instant-1.2',
];

// ========================================
// ANTHROPIC PROVIDER CLASS
// ========================================

/**
 * Anthropic Claude provider with streaming support
 */
export class AnthropicProvider extends BaseProvider {
  readonly name = 'anthropic';
  readonly displayName = 'Anthropic Claude';
  readonly defaultModel = 'claude-3-sonnet-20240229';
  readonly supportedModels = SUPPORTED_MODELS;
  readonly supportsStreaming = true;

  /**
   * Check if provider is configured
   */
  isConfigured(config: AIConfig): boolean {
    return !!config.apiKey && config.apiKey.length > 0;
  }

  /**
   * Generate non-streaming response
   */
  async generateResponse(
    prompt: string,
    context: AIMessage[],
    config: AIConfig
  ): Promise<AIResponse> {
    if (!this.isConfigured(config)) {
      throw this.createError(
        'Anthropic API key is not configured',
        AIErrorCode.NOT_CONFIGURED,
        { isRetryable: false }
      );
    }

    const endpoint = config.customEndpoint || DEFAULT_ENDPOINT;
    const model = this.validateModel(config.model || this.defaultModel);

    const requestBody = this.buildRequestBody(prompt, context, config, model, false);

    try {
      const response = await this.fetchWithTimeout(
        endpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.apiKey!,
            'anthropic-version': API_VERSION,
          },
          body: JSON.stringify(requestBody),
        },
        config.timeout || this.defaultTimeout
      );

      if (!response.ok) {
        throw await this.parseErrorResponse(response);
      }

      const data = await response.json();
      return this.parseResponse(data, model);
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  /**
   * Generate streaming response
   */
  generateResponseStreaming(
    prompt: string,
    context: AIMessage[],
    config: AIConfig,
    callback: AIStreamCallback
  ): StreamController {
    const controller = new StreamControllerImpl();

    if (!this.isConfigured(config)) {
      controller.setState('ERROR');
      callback.onError(
        this.createError(
          'Anthropic API key is not configured',
          AIErrorCode.NOT_CONFIGURED,
          { isRetryable: false }
        )
      );
      return controller;
    }

    const endpoint = config.customEndpoint || DEFAULT_ENDPOINT;
    const model = this.validateModel(config.model || this.defaultModel);

    // Start streaming request
    this.streamRequest(endpoint, prompt, context, config, model, controller, callback);

    return controller;
  }

  /**
   * Performs the streaming request
   */
  private async streamRequest(
    endpoint: string,
    prompt: string,
    context: AIMessage[],
    config: AIConfig,
    model: string,
    controller: StreamControllerImpl,
    callback: AIStreamCallback
  ): Promise<void> {
    controller.setState('CONNECTING');
    callback.onStart?.();

    const requestBody = this.buildRequestBody(prompt, context, config, model, true);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey!,
          'anthropic-version': API_VERSION,
        },
        body: JSON.stringify(requestBody),
        signal: controller.getSignal(),
      });

      if (!response.ok) {
        controller.setState('ERROR');
        callback.onError(await this.parseErrorResponse(response));
        return;
      }

      if (!response.body) {
        controller.setState('ERROR');
        callback.onError(
          this.createError('No response body', AIErrorCode.SERVER_ERROR)
        );
        return;
      }

      controller.setState('STREAMING');

      const reader = response.body.getReader();
      let inputTokens = 0;
      let outputTokens = 0;
      let stopReason: string | undefined;

      for await (const chunk of this.parseSSEStream(reader)) {
        if (controller.getState() === 'STOPPED') {
          reader.cancel();
          callback.onStop?.();
          return;
        }

        try {
          const data = JSON.parse(chunk);
          const eventType = data.type;

          switch (eventType) {
            case 'content_block_delta': {
              const delta = data.delta;
              const text = delta?.text || '';
              if (text) {
                controller.appendContent(text);
                callback.onToken(text);
              }
              break;
            }

            case 'message_start': {
              const message = data.message;
              const usage = message?.usage;
              if (usage) {
                inputTokens = usage.input_tokens || 0;
              }
              break;
            }

            case 'message_delta': {
              const delta = data.delta;
              stopReason = delta?.stop_reason;
              const usage = data.usage;
              if (usage) {
                outputTokens = usage.output_tokens || 0;
              }
              break;
            }

            case 'message_stop':
              // Stream complete
              break;
          }
        } catch {
          // Skip malformed chunks
        }
      }

      controller.setState('COMPLETED');

      const aiResponse: AIResponse = {
        content: controller.getContent(),
        tokensUsed: inputTokens + outputTokens,
        model,
        provider: this.name,
        finishReason: stopReason,
        inputTokens,
        outputTokens,
      };

      callback.onComplete(aiResponse);
    } catch (error) {
      if (controller.getState() === 'STOPPED') {
        callback.onStop?.();
        return;
      }

      controller.setState('ERROR');
      callback.onError(this.normalizeError(error));
    }
  }

  /**
   * Builds the request body for Anthropic API
   */
  private buildRequestBody(
    prompt: string,
    context: AIMessage[],
    config: AIConfig,
    model: string,
    stream: boolean
  ): Record<string, any> {
    const messages: Array<{ role: string; content: string }> = [];

    // Anthropic handles system separately
    // Filter out system messages from context
    const systemPrompt =
      config.systemPrompt ||
      context
        .filter((m) => m.role === 'system')
        .map((m) => m.content)
        .join('\n');

    // Add non-system context messages
    for (const msg of context) {
      if (msg.role !== 'system') {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    // Add current prompt as user message
    messages.push({
      role: 'user',
      content: prompt,
    });

    const body: Record<string, any> = {
      model,
      messages,
      max_tokens: config.maxTokens ?? 1000,
      stream,
    };

    // Add system prompt if present
    if (systemPrompt) {
      body.system = systemPrompt;
    }

    // Add optional parameters
    if (config.temperature !== undefined && config.temperature !== 0.7) {
      body.temperature = config.temperature;
    }
    if (config.topP !== undefined) {
      body.top_p = config.topP;
    }

    return body;
  }

  /**
   * Parses non-streaming response
   */
  private parseResponse(data: any, model: string): AIResponse {
    const contentArray = data.content;

    if (!contentArray || contentArray.length === 0) {
      throw this.createError(
        'Anthropic returned empty response',
        AIErrorCode.SERVER_ERROR
      );
    }

    // Extract text from content blocks
    let content = '';
    for (const block of contentArray) {
      if (block.type === 'text') {
        content += block.text;
      }
    }

    const usage = data.usage;
    const inputTokens = usage?.input_tokens || 0;
    const outputTokens = usage?.output_tokens || 0;

    return {
      content,
      tokensUsed: inputTokens + outputTokens,
      model,
      provider: this.name,
      finishReason: data.stop_reason,
      inputTokens,
      outputTokens,
      responseId: data.id,
    };
  }

  /**
   * Override error handling for Anthropic-specific errors
   */
  protected statusCodeToErrorCode(statusCode: number): AIErrorCode {
    // Anthropic uses 529 for overloaded
    if (statusCode === 529) {
      return AIErrorCode.RATE_LIMITED;
    }
    return super.statusCodeToErrorCode(statusCode);
  }
}

export default AnthropicProvider;
