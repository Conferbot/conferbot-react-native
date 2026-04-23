// @ts-nocheck
/**
 * OpenAIProvider.ts
 *
 * OpenAI GPT provider implementation with streaming support.
 * Supports GPT-3.5-turbo, GPT-4, GPT-4-turbo, GPT-4o models.
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

const DEFAULT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

const SUPPORTED_MODELS = [
  'gpt-3.5-turbo',
  'gpt-3.5-turbo-16k',
  'gpt-4',
  'gpt-4-32k',
  'gpt-4-turbo',
  'gpt-4-turbo-preview',
  'gpt-4o',
  'gpt-4o-mini',
];

// ========================================
// OPENAI PROVIDER CLASS
// ========================================

/**
 * OpenAI GPT provider with streaming support
 */
export class OpenAIProvider extends BaseProvider {
  readonly name = 'openai';
  readonly displayName = 'OpenAI';
  readonly defaultModel = 'gpt-3.5-turbo';
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
        'OpenAI API key is not configured',
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
            'Authorization': `Bearer ${config.apiKey}`,
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
          'OpenAI API key is not configured',
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
          'Authorization': `Bearer ${config.apiKey}`,
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
          const choices = data.choices;

          if (choices && choices.length > 0) {
            const choice = choices[0];
            const delta = choice.delta;
            const content = delta?.content || '';

            if (content) {
              controller.appendContent(content);
              callback.onToken(content);
            }

            if (choice.finish_reason) {
              finishReason = choice.finish_reason;
            }
          }

          // Get usage if available (some models provide at end)
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
   * Builds the request body for OpenAI API
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
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens ?? 1000,
      stream,
    };

    // Add optional parameters
    if (config.topP !== undefined) {
      body.top_p = config.topP;
    }
    if (config.frequencyPenalty !== undefined) {
      body.frequency_penalty = config.frequencyPenalty;
    }
    if (config.presencePenalty !== undefined) {
      body.presence_penalty = config.presencePenalty;
    }

    // Request usage stats in streaming mode (supported on newer models)
    if (stream) {
      body.stream_options = { include_usage: true };
    }

    return body;
  }

  /**
   * Parses non-streaming response
   */
  private parseResponse(data: any, model: string): AIResponse {
    const choices = data.choices;

    if (!choices || choices.length === 0) {
      throw this.createError(
        'OpenAI returned empty response',
        AIErrorCode.SERVER_ERROR
      );
    }

    const choice = choices[0];
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
}

export default OpenAIProvider;
