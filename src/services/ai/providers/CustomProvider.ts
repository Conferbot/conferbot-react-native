// @ts-nocheck
/**
 * CustomProvider.ts
 *
 * Custom AI provider for self-hosted or alternative AI services.
 * Supports OpenAI-compatible API format with streaming.
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
// CUSTOM PROVIDER CLASS
// ========================================

/**
 * Custom AI provider for OpenAI-compatible APIs
 * Can be used with self-hosted models, LM Studio, Ollama, etc.
 */
export class CustomProvider extends BaseProvider {
  readonly name = 'custom';
  readonly displayName = 'Custom Provider';
  readonly defaultModel = 'gpt-3.5-turbo';
  readonly supportedModels: string[] = [];
  readonly supportsStreaming = true;

  /**
   * Check if provider is configured
   */
  isConfigured(config: AIConfig): boolean {
    // Custom provider requires endpoint, API key is optional
    return !!config.customEndpoint && config.customEndpoint.length > 0;
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
        'Custom endpoint is not configured',
        AIErrorCode.NOT_CONFIGURED,
        { isRetryable: false }
      );
    }

    const endpoint = config.customEndpoint!;
    const model = config.model || this.defaultModel;

    const requestBody = this.buildRequestBody(prompt, context, config, model, false);
    const headers = this.buildHeaders(config);

    try {
      const response = await this.fetchWithTimeout(
        endpoint,
        {
          method: 'POST',
          headers,
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
          'Custom endpoint is not configured',
          AIErrorCode.NOT_CONFIGURED,
          { isRetryable: false }
        )
      );
      return controller;
    }

    const endpoint = config.customEndpoint!;
    const model = config.model || this.defaultModel;

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
    const headers = this.buildHeaders(config);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
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
      let tokensUsed = 0;
      let finishReason: string | undefined;

      for await (const chunk of this.parseSSEStream(reader)) {
        if (controller.getState() === 'STOPPED') {
          reader.cancel();
          callback.onStop?.();
          return;
        }

        if (chunk === '[DONE]') {
          break;
        }

        try {
          const data = JSON.parse(chunk);

          // Handle OpenAI format
          if (data.choices) {
            const choice = data.choices[0];
            const delta = choice?.delta;
            const content = delta?.content || '';

            if (content) {
              controller.appendContent(content);
              callback.onToken(content);
            }

            if (choice?.finish_reason) {
              finishReason = choice.finish_reason;
            }
          }

          // Handle Anthropic format
          if (data.type === 'content_block_delta') {
            const text = data.delta?.text || '';
            if (text) {
              controller.appendContent(text);
              callback.onToken(text);
            }
          }

          // Handle usage if provided
          if (data.usage) {
            tokensUsed = data.usage.total_tokens || 0;
          }
        } catch {
          // Skip malformed chunks
        }
      }

      controller.setState('COMPLETED');

      const aiResponse: AIResponse = {
        content: controller.getContent(),
        tokensUsed,
        model,
        provider: this.name,
        finishReason,
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
   * Builds request headers
   */
  private buildHeaders(config: AIConfig): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add API key if provided
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    return headers;
  }

  /**
   * Builds the request body (OpenAI-compatible format)
   */
  private buildRequestBody(
    prompt: string,
    context: AIMessage[],
    config: AIConfig,
    model: string,
    stream: boolean
  ): Record<string, any> {
    const messages: Array<{ role: string; content: string }> = [];

    // Add system prompt if provided
    if (config.systemPrompt) {
      messages.push({
        role: 'system',
        content: config.systemPrompt,
      });
    }

    // Add context messages
    for (const msg of context) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    // Add current prompt as user message
    messages.push({
      role: 'user',
      content: prompt,
    });

    const body: Record<string, any> = {
      model,
      messages,
      stream,
    };

    // Add optional parameters
    if (config.temperature !== undefined) {
      body.temperature = config.temperature;
    }
    if (config.maxTokens !== undefined) {
      body.max_tokens = config.maxTokens;
    }
    if (config.topP !== undefined) {
      body.top_p = config.topP;
    }
    if (config.frequencyPenalty !== undefined) {
      body.frequency_penalty = config.frequencyPenalty;
    }
    if (config.presencePenalty !== undefined) {
      body.presence_penalty = config.presencePenalty;
    }

    return body;
  }

  /**
   * Parses non-streaming response
   * Supports both OpenAI and Anthropic formats
   */
  private parseResponse(data: any, model: string): AIResponse {
    // Try OpenAI format first
    if (data.choices && data.choices.length > 0) {
      const choice = data.choices[0];
      const message = choice.message;
      const content = message?.content || '';

      const usage = data.usage;
      const tokensUsed = usage?.total_tokens || 0;

      return {
        content,
        tokensUsed,
        model,
        provider: this.name,
        finishReason: choice.finish_reason,
        inputTokens: usage?.prompt_tokens,
        outputTokens: usage?.completion_tokens,
        responseId: data.id,
      };
    }

    // Try Anthropic format
    if (data.content && Array.isArray(data.content)) {
      let content = '';
      for (const block of data.content) {
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

    // Fallback: try to extract content directly
    if (data.content && typeof data.content === 'string') {
      return {
        content: data.content,
        tokensUsed: 0,
        model,
        provider: this.name,
      };
    }

    if (data.response || data.text || data.output) {
      return {
        content: data.response || data.text || data.output,
        tokensUsed: 0,
        model,
        provider: this.name,
      };
    }

    throw this.createError(
      'Unable to parse response from custom provider',
      AIErrorCode.SERVER_ERROR
    );
  }
}

export default CustomProvider;
