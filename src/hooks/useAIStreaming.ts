// @ts-nocheck
/**
 * useAIStreaming.ts
 *
 * React hook for managing AI streaming responses in the chat interface.
 * Provides state management, callbacks, and controls for streaming AI responses.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  getAIHandler,
  type AIConfig,
  type AIStreamCallback,
  type AIResponse,
  type AIProviderError,
  type StreamController,
  type AIResponseUIState,
  StreamingState,
} from '../services/ai';
import type { ChatState } from '../core/state/ChatState';

// ========================================
// TYPES
// ========================================

export interface UseAIStreamingOptions {
  /** ChatState instance for context */
  chatState: ChatState;
  /** Node ID for tracking */
  nodeId: string;
  /** Variable name to store response */
  variableName?: string;
  /** Called when token is received */
  onToken?: (token: string, accumulated: string) => void;
  /** Called when streaming completes */
  onComplete?: (response: AIResponse) => void;
  /** Called when error occurs */
  onError?: (error: AIProviderError) => void;
  /** Called when stopped by user */
  onStop?: (partialContent: string) => void;
}

export interface UseAIStreamingResult {
  /** Current content */
  content: string;
  /** Current streaming state */
  state: StreamingState;
  /** Whether streaming is active */
  isStreaming: boolean;
  /** Whether streaming is complete */
  isComplete: boolean;
  /** Error if any */
  error: AIProviderError | null;
  /** Start streaming */
  startStreaming: (prompt: string, config?: Partial<AIConfig>) => void;
  /** Stop streaming */
  stopStreaming: () => void;
  /** Reset state */
  reset: () => void;
  /** Regenerate with same prompt */
  regenerate: () => void;
  /** Full UI state for rendering */
  uiState: AIResponseUIState;
}

// ========================================
// HOOK IMPLEMENTATION
// ========================================

/**
 * Hook for managing AI streaming responses
 */
export function useAIStreaming(options: UseAIStreamingOptions): UseAIStreamingResult {
  const {
    chatState,
    nodeId,
    variableName = 'aiResponse',
    onToken,
    onComplete,
    onError,
    onStop,
  } = options;

  // State
  const [content, setContent] = useState('');
  const [state, setState] = useState<StreamingState>('IDLE');
  const [error, setError] = useState<AIProviderError | null>(null);
  const [tokensUsed, setTokensUsed] = useState<number | undefined>();
  const [model, setModel] = useState<string | undefined>();
  const [provider, setProvider] = useState<string | undefined>();
  const [startedAt, setStartedAt] = useState<string | undefined>();
  const [completedAt, setCompletedAt] = useState<string | undefined>();

  // Refs
  const streamControllerRef = useRef<StreamController | null>(null);
  const lastPromptRef = useRef<string>('');
  const lastConfigRef = useRef<Partial<AIConfig> | undefined>();

  // Derived state
  const isStreaming = state === 'CONNECTING' || state === 'STREAMING';
  const isComplete = state === 'COMPLETED' || state === 'STOPPED' || state === 'ERROR';

  /**
   * Starts streaming
   */
  const startStreaming = useCallback(
    (prompt: string, config?: Partial<AIConfig>) => {
      // Store for regeneration
      lastPromptRef.current = prompt;
      lastConfigRef.current = config;

      // Reset state
      setContent('');
      setError(null);
      setState('CONNECTING');
      setTokensUsed(undefined);
      setCompletedAt(undefined);
      setStartedAt(new Date().toISOString());

      const aiHandler = getAIHandler();

      const fullConfig: AIConfig = {
        model: config?.model || 'gpt-3.5-turbo',
        temperature: config?.temperature ?? 0.7,
        maxTokens: config?.maxTokens ?? 1000,
        apiKey: config?.apiKey,
        customEndpoint: config?.customEndpoint,
        systemPrompt: config?.systemPrompt,
        streaming: true,
        ...config,
      };

      const callback: AIStreamCallback = {
        onStart: () => {
          setState('STREAMING');
        },
        onToken: (token: string) => {
          setContent((prev) => {
            const newContent = prev + token;
            onToken?.(token, newContent);
            return newContent;
          });
        },
        onComplete: (response: AIResponse) => {
          setState('COMPLETED');
          setTokensUsed(response.tokensUsed);
          setModel(response.model);
          setProvider(response.provider);
          setCompletedAt(new Date().toISOString());
          streamControllerRef.current = null;

          // Store in chat state
          if (variableName) {
            chatState.setVariable(variableName, response.content);
          }

          onComplete?.(response);
        },
        onError: (err: AIProviderError) => {
          setState('ERROR');
          setError(err);
          setCompletedAt(new Date().toISOString());
          streamControllerRef.current = null;

          // Store error in chat state
          chatState.setVariable('_aiError', err.message);

          onError?.(err);
        },
        onStop: () => {
          setState('STOPPED');
          setCompletedAt(new Date().toISOString());

          // Get current content
          const currentContent = streamControllerRef.current?.getContent() || '';
          streamControllerRef.current = null;

          // Store partial content
          if (variableName && currentContent) {
            chatState.setVariable(variableName, currentContent);
          }

          onStop?.(currentContent);
        },
      };

      // Start streaming
      streamControllerRef.current = aiHandler.generateResponseStreaming(
        prompt,
        chatState,
        fullConfig,
        callback
      );
    },
    [chatState, variableName, onToken, onComplete, onError, onStop]
  );

  /**
   * Stops streaming
   */
  const stopStreaming = useCallback(() => {
    if (streamControllerRef.current?.isActive()) {
      streamControllerRef.current.abort();
    }
  }, []);

  /**
   * Resets state
   */
  const reset = useCallback(() => {
    stopStreaming();
    setContent('');
    setState('IDLE');
    setError(null);
    setTokensUsed(undefined);
    setModel(undefined);
    setProvider(undefined);
    setStartedAt(undefined);
    setCompletedAt(undefined);
    lastPromptRef.current = '';
    lastConfigRef.current = undefined;
  }, [stopStreaming]);

  /**
   * Regenerates with same prompt
   */
  const regenerate = useCallback(() => {
    if (lastPromptRef.current) {
      startStreaming(lastPromptRef.current, lastConfigRef.current);
    }
  }, [startStreaming]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamControllerRef.current?.isActive()) {
        streamControllerRef.current.abort();
      }
    };
  }, []);

  // Build UI state
  const uiState: AIResponseUIState = {
    id: `stream_${nodeId}`,
    nodeId,
    state,
    content,
    isComplete,
    error: error || undefined,
    provider,
    model,
    tokensUsed,
    startedAt: startedAt || new Date().toISOString(),
    completedAt,
  };

  return {
    content,
    state,
    isStreaming,
    isComplete,
    error,
    startStreaming,
    stopStreaming,
    reset,
    regenerate,
    uiState,
  };
}

// ========================================
// SIMPLE HOOK FOR NON-STREAMING
// ========================================

export interface UseAIGenerationOptions {
  chatState: ChatState;
  variableName?: string;
  onComplete?: (response: AIResponse) => void;
  onError?: (error: AIProviderError) => void;
}

export interface UseAIGenerationResult {
  content: string;
  isLoading: boolean;
  error: AIProviderError | null;
  generate: (prompt: string, config?: Partial<AIConfig>) => Promise<AIResponse | null>;
  reset: () => void;
}

/**
 * Simple hook for non-streaming AI generation
 */
export function useAIGeneration(options: UseAIGenerationOptions): UseAIGenerationResult {
  const { chatState, variableName = 'aiResponse', onComplete, onError } = options;

  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AIProviderError | null>(null);

  const generate = useCallback(
    async (prompt: string, config?: Partial<AIConfig>): Promise<AIResponse | null> => {
      setIsLoading(true);
      setError(null);

      const aiHandler = getAIHandler();

      const fullConfig: AIConfig = {
        model: config?.model || 'gpt-3.5-turbo',
        temperature: config?.temperature ?? 0.7,
        maxTokens: config?.maxTokens ?? 1000,
        streaming: false,
        ...config,
      };

      try {
        const response = await aiHandler.generateResponse(
          prompt,
          chatState,
          fullConfig
        );

        setContent(response.content);

        if (variableName) {
          chatState.setVariable(variableName, response.content);
        }

        onComplete?.(response);
        return response;
      } catch (err) {
        const aiError = err as AIProviderError;
        setError(aiError);
        onError?.(aiError);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [chatState, variableName, onComplete, onError]
  );

  const reset = useCallback(() => {
    setContent('');
    setIsLoading(false);
    setError(null);
  }, []);

  return {
    content,
    isLoading,
    error,
    generate,
    reset,
  };
}

export default useAIStreaming;
