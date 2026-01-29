/**
 * TokenCounter.ts
 *
 * Token estimation and counting utilities for AI context management.
 * Provides approximate token counts for context budget management.
 */

import type { AIMessage, TokenEstimate, ContextConfig } from './types';

// ========================================
// TOKEN ESTIMATION CONSTANTS
// ========================================

/**
 * Average characters per token by model family
 * These are approximate values for estimation
 */
const CHARS_PER_TOKEN: Record<string, number> = {
  // OpenAI models (GPT-3.5, GPT-4)
  'gpt-3.5': 4,
  'gpt-4': 4,
  'gpt-4o': 4,
  // Anthropic models (Claude)
  'claude': 3.5,
  // DeepSeek
  'deepseek': 4,
  // Default for unknown models
  'default': 4,
};

/**
 * Token limits by model
 */
export const MODEL_TOKEN_LIMITS: Record<string, number> = {
  // OpenAI models
  'gpt-3.5-turbo': 4096,
  'gpt-3.5-turbo-16k': 16384,
  'gpt-4': 8192,
  'gpt-4-32k': 32768,
  'gpt-4-turbo': 128000,
  'gpt-4-turbo-preview': 128000,
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  // Anthropic models
  'claude-3-opus-20240229': 200000,
  'claude-3-sonnet-20240229': 200000,
  'claude-3-haiku-20240307': 200000,
  'claude-3-5-sonnet-20240620': 200000,
  'claude-3-5-sonnet-20241022': 200000,
  'claude-3-5-haiku-20241022': 200000,
  'claude-2.1': 200000,
  'claude-2.0': 100000,
  'claude-instant-1.2': 100000,
  // DeepSeek
  'deepseek-chat': 32768,
  'deepseek-coder': 32768,
  // Default
  'default': 4096,
};

/**
 * Reserved tokens for response (output)
 * Ensures enough room for AI to generate response
 */
const RESPONSE_RESERVE_TOKENS = 1000;

// ========================================
// TOKEN COUNTER CLASS
// ========================================

/**
 * TokenCounter provides token estimation and context budget management
 */
export class TokenCounter {
  private charsPerToken: number;
  private modelLimit: number;

  constructor(model: string = 'default') {
    this.charsPerToken = this.getCharsPerToken(model);
    this.modelLimit = this.getModelLimit(model);
  }

  /**
   * Gets approximate characters per token for a model
   */
  private getCharsPerToken(model: string): number {
    const modelLower = model.toLowerCase();

    for (const [prefix, chars] of Object.entries(CHARS_PER_TOKEN)) {
      if (modelLower.includes(prefix)) {
        return chars;
      }
    }

    return CHARS_PER_TOKEN['default'];
  }

  /**
   * Gets token limit for a model
   */
  private getModelLimit(model: string): number {
    const modelLower = model.toLowerCase();

    // Check exact match first
    if (MODEL_TOKEN_LIMITS[modelLower]) {
      return MODEL_TOKEN_LIMITS[modelLower];
    }

    // Check prefix matches
    for (const [modelName, limit] of Object.entries(MODEL_TOKEN_LIMITS)) {
      if (modelLower.startsWith(modelName) || modelLower.includes(modelName)) {
        return limit;
      }
    }

    return MODEL_TOKEN_LIMITS['default'];
  }

  /**
   * Estimates token count for a string
   */
  estimateTokens(text: string): number {
    if (!text) return 0;
    // Approximate: split by whitespace and punctuation
    // Each word is roughly 1-2 tokens, plus some for special tokens
    const words = text.split(/\s+/).filter((w) => w.length > 0);
    const charEstimate = Math.ceil(text.length / this.charsPerToken);
    const wordEstimate = Math.ceil(words.length * 1.3);
    // Take average of both methods
    return Math.ceil((charEstimate + wordEstimate) / 2);
  }

  /**
   * Estimates tokens for a message (includes role overhead)
   */
  estimateMessageTokens(message: AIMessage): number {
    const contentTokens = this.estimateTokens(message.content);
    // Add overhead for message structure (role, etc.)
    const overhead = 4; // Approximate overhead per message
    return contentTokens + overhead;
  }

  /**
   * Estimates tokens for an array of messages
   */
  estimateMessagesTokens(messages: AIMessage[]): number {
    let total = 0;
    for (const message of messages) {
      total += this.estimateMessageTokens(message);
    }
    // Add overhead for conversation structure
    total += 3; // Typical overhead for conversation
    return total;
  }

  /**
   * Calculates token estimate for full context
   */
  calculateEstimate(
    messages: AIMessage[],
    systemPrompt?: string,
    variables?: Record<string, any>,
    maxTokens?: number
  ): TokenEstimate {
    const limit = maxTokens || this.modelLimit - RESPONSE_RESERVE_TOKENS;

    const messageTokens = this.estimateMessagesTokens(messages);
    const systemPromptTokens = systemPrompt
      ? this.estimateTokens(systemPrompt) + 4
      : 0;

    let variableTokens = 0;
    if (variables) {
      const variableText = JSON.stringify(variables);
      variableTokens = this.estimateTokens(variableText);
    }

    const totalTokens = messageTokens + systemPromptTokens + variableTokens;
    const availableTokens = Math.max(0, limit - totalTokens);
    const needsTruncation = totalTokens > limit;

    return {
      messageTokens,
      systemPromptTokens,
      variableTokens,
      totalTokens,
      availableTokens,
      needsTruncation,
    };
  }

  /**
   * Truncates messages to fit within token budget
   * Preserves most recent messages
   */
  truncateMessages(
    messages: AIMessage[],
    maxTokens: number,
    strategy: 'oldest' | 'summarize' | 'smart' = 'oldest'
  ): AIMessage[] {
    if (messages.length === 0) return [];

    const estimate = this.estimateMessagesTokens(messages);
    if (estimate <= maxTokens) {
      return messages;
    }

    switch (strategy) {
      case 'oldest':
        return this.truncateOldest(messages, maxTokens);
      case 'summarize':
        return this.truncateWithSummary(messages, maxTokens);
      case 'smart':
        return this.truncateSmart(messages, maxTokens);
      default:
        return this.truncateOldest(messages, maxTokens);
    }
  }

  /**
   * Truncates by removing oldest messages first
   */
  private truncateOldest(messages: AIMessage[], maxTokens: number): AIMessage[] {
    const result: AIMessage[] = [];
    let tokenCount = 3; // Base overhead

    // Start from newest (end) and work backwards
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      const messageTokens = this.estimateMessageTokens(message);

      if (tokenCount + messageTokens <= maxTokens) {
        result.unshift(message);
        tokenCount += messageTokens;
      } else {
        break;
      }
    }

    return result;
  }

  /**
   * Truncates by summarizing older messages
   * Note: This creates a simple summary, for better results use AI summarization
   */
  private truncateWithSummary(
    messages: AIMessage[],
    maxTokens: number
  ): AIMessage[] {
    // Reserve tokens for summary
    const summaryBudget = Math.min(200, maxTokens * 0.2);
    const messageBudget = maxTokens - summaryBudget;

    // Get recent messages that fit
    const recentMessages = this.truncateOldest(messages, messageBudget);

    // Create simple summary of older messages
    const olderCount = messages.length - recentMessages.length;
    if (olderCount > 0) {
      const oldMessages = messages.slice(0, olderCount);
      const summary = this.createSimpleSummary(oldMessages);

      // Add summary as system context
      const summaryMessage: AIMessage = {
        role: 'system',
        content: `[Previous conversation summary: ${summary}]`,
      };

      return [summaryMessage, ...recentMessages];
    }

    return recentMessages;
  }

  /**
   * Smart truncation that preserves important context
   */
  private truncateSmart(messages: AIMessage[], maxTokens: number): AIMessage[] {
    if (messages.length <= 2) {
      return this.truncateOldest(messages, maxTokens);
    }

    // Always keep first system message if present
    const firstSystem =
      messages[0].role === 'system' ? messages.slice(0, 1) : [];
    const nonSystemMessages =
      messages[0].role === 'system' ? messages.slice(1) : messages;

    // Reserve tokens for first message
    const firstTokens =
      firstSystem.length > 0
        ? this.estimateMessageTokens(firstSystem[0])
        : 0;
    const remainingBudget = maxTokens - firstTokens - 3;

    // Get recent messages
    const recentMessages = this.truncateOldest(nonSystemMessages, remainingBudget);

    return [...firstSystem, ...recentMessages];
  }

  /**
   * Creates a simple summary of messages (for truncation)
   */
  private createSimpleSummary(messages: AIMessage[]): string {
    const userMessages = messages.filter((m) => m.role === 'user');
    const assistantMessages = messages.filter((m) => m.role === 'assistant');

    const topics: string[] = [];

    // Extract key topics from user messages (simple approach)
    for (const msg of userMessages.slice(0, 3)) {
      const words = msg.content.split(/\s+/).slice(0, 10);
      if (words.length > 0) {
        topics.push(words.join(' '));
      }
    }

    return `User discussed: ${topics.join('; ')}. ${userMessages.length} user messages and ${assistantMessages.length} assistant responses.`;
  }

  /**
   * Gets the model token limit
   */
  getModelLimit(): number {
    return this.modelLimit;
  }

  /**
   * Gets available tokens for response
   */
  getAvailableForResponse(contextTokens: number): number {
    return Math.max(0, this.modelLimit - contextTokens - RESPONSE_RESERVE_TOKENS);
  }

  /**
   * Validates that max_tokens setting is valid
   */
  validateMaxTokens(maxTokens: number, contextTokens: number): number {
    const available = this.getAvailableForResponse(contextTokens);
    return Math.min(maxTokens, available);
  }
}

/**
 * Creates a token counter for a specific model
 */
export function createTokenCounter(model: string): TokenCounter {
  return new TokenCounter(model);
}

export default TokenCounter;
