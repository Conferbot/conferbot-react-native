// @ts-nocheck
import { useCallback, useState, useRef } from 'react';
import { StorageService } from '../../services/StorageService';
import type {
  AsyncStorageInterface,
  StorageConfig,
  PersistedSessionData,
  PersistedState,
} from '../../services/StorageService';
import type { ConferBotUser, RecordItem } from '../../types';
import type { ChatState } from '../../core';
import type { ExtendedConferBotConfig } from '../types';
import { deduplicateMessages, trimMessages } from '../types';

interface UsePersistenceParams {
  botId: string;
  config?: ExtendedConferBotConfig;
  user?: ConferBotUser;
  chatStateRef: React.MutableRefObject<ChatState | null>;
}

export function usePersistence({ botId, config, user, chatStateRef }: UsePersistenceParams) {
  const [isRestoring, setIsRestoring] = useState(true);
  const [hasPersistedSession, setHasPersistedSession] = useState(false);

  const storageService = useRef<StorageService | null>(null);

  const persistenceEnabled = config?.enablePersistence !== false && !!config?.asyncStorage;

  // ********** Storage Service Initialization ********** //
  const initializeStorage = useCallback(async (): Promise<PersistedState | null> => {
    if (!persistenceEnabled || !config?.asyncStorage) {
      setIsRestoring(false);
      return null;
    }

    try {
      storageService.current = new StorageService(botId, config.persistenceConfig);
      await storageService.current.initialize(config.asyncStorage);

      const persistedState = await storageService.current.loadAll();

      if (persistedState.session) {
        setHasPersistedSession(true);
        if (__DEV__) {
          console.log('[ConferBot] Found persisted session:', persistedState.session.chatSessionId);
        }
      }

      return persistedState;
    } catch (error) {
      console.error('[ConferBot] Failed to initialize storage:', error);
      return null;
    }
  }, [botId, config?.asyncStorage, config?.persistenceConfig, persistenceEnabled]);

  // ********** Persistence Helpers ********** //
  const persistSession = useCallback(async (sessionData: Partial<PersistedSessionData>) => {
    if (storageService.current?.isReady()) {
      await storageService.current.saveSession(sessionData);
    }
  }, []);

  const persistMessages = useCallback(async (messages: RecordItem[]) => {
    if (storageService.current?.isReady()) {
      await storageService.current.saveMessages(messages);
    }
  }, []);

  const persistUserData = useCallback(async (userData: ConferBotUser) => {
    if (storageService.current?.isReady()) {
      await storageService.current.saveUser({
        userId: userData.id,
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        metadata: userData.metadata,
      });
    }
  }, []);

  const persistAnswerVariables = useCallback(async () => {
    if (storageService.current?.isReady() && chatStateRef.current) {
      const variables = chatStateRef.current.getAnswerVariables();
      await storageService.current.saveAnswerVariables(variables);
    }
  }, [chatStateRef]);

  const persistFlowState = useCallback(async () => {
    if (storageService.current?.isReady() && chatStateRef.current) {
      await storageService.current.saveSession({
        currentNodeId: chatStateRef.current.currentNodeId || undefined,
        visitedNodes: chatStateRef.current.getVisitedNodes(),
        isFlowComplete: chatStateRef.current.isFlowComplete,
        flowCompletionReason: chatStateRef.current.flowCompletionReason,
      });
    }
  }, [chatStateRef]);

  // ********** Clear Persistence ********** //
  const clearPersistedData = useCallback(async () => {
    if (storageService.current?.isReady()) {
      await storageService.current.clearAll();
      setHasPersistedSession(false);
      if (__DEV__) {
        console.log('[ConferBot] Persisted data cleared');
      }
    }
  }, []);

  return {
    // State
    isRestoring,
    setIsRestoring,
    hasPersistedSession,
    setHasPersistedSession,
    // Refs
    storageService,
    // Flags
    persistenceEnabled,
    // Actions
    initializeStorage,
    persistSession,
    persistMessages,
    persistUserData,
    persistAnswerVariables,
    persistFlowState,
    clearPersistedData,
  };
}
