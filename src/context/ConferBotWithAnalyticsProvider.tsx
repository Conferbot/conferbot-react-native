/**
 * ConferBotWithAnalyticsProvider.tsx
 *
 * Combined provider that wraps ConferBotProvider with analytics integration.
 * Automatically tracks session events, node visits, and user interactions.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { ConferBotProvider, useConferBot } from './ConferBotContext';
import { AnalyticsProvider, useAnalyticsContext } from './AnalyticsContext';
import { getAnalyticsService } from '../services/analytics';
import type { AnalyticsConfig } from '../services/analytics';
import type {
  ConferBotConfig,
  ConferBotUser,
  ConferBotCustomization,
} from '../types';

// ========================================
// PROVIDER PROPS
// ========================================

export interface ConferBotWithAnalyticsProviderProps {
  /** API key for authentication */
  apiKey: string;
  /** Bot ID */
  botId: string;
  /** SDK configuration */
  config?: ConferBotConfig & {
    /** Enable analytics (default: true) */
    enableAnalytics?: boolean;
    /** Analytics configuration */
    analyticsConfig?: Partial<AnalyticsConfig>;
  };
  /** UI customization */
  customization?: ConferBotCustomization;
  /** User identification */
  user?: ConferBotUser;
  /** App version for analytics attribution */
  appVersion?: string;
  /** Build number for analytics attribution */
  buildNumber?: string;
  /** Entry point for analytics attribution */
  entryPoint?: string;
  children: React.ReactNode;
}

// ========================================
// ANALYTICS INTEGRATION COMPONENT
// ========================================

interface AnalyticsIntegrationProps {
  botId: string;
  appVersion?: string;
  buildNumber?: string;
  entryPoint?: string;
  user?: ConferBotUser;
  children: React.ReactNode;
}

/**
 * Internal component that connects ConferBot context with Analytics context
 */
const AnalyticsIntegration: React.FC<AnalyticsIntegrationProps> = ({
  botId,
  appVersion,
  buildNumber,
  entryPoint,
  user,
  children,
}) => {
  const {
    chatSessionId,
    isInitialized,
    isOpen,
    currentUIState,
    record,
    flowEngine,
  } = useConferBot();

  const analytics = useAnalyticsContext();
  const lastNodeIdRef = useRef<string | null>(null);
  const lastRecordLengthRef = useRef<number>(0);
  const isAnalyticsInitializedRef = useRef(false);
  const socketClientRef = useRef<any>(null);

  // Initialize analytics when session starts
  useEffect(() => {
    const initAnalytics = async () => {
      if (!isInitialized || !chatSessionId || isAnalyticsInitializedRef.current) {
        return;
      }

      // Get socket client reference (hacky but necessary)
      // In a production implementation, socket should be exposed via context
      try {
        // Access internal socket client
        const analyticsService = getAnalyticsService();

        // We need to find a way to get the socket client
        // For now, we'll use the flow engine's socket client reference
        if (flowEngine?.getChatState) {
          // The socket client is passed to the flow engine
          // We'll emit via the analytics service which has its own socket handling
        }

        await analytics.initialize(
          chatSessionId,
          botId,
          socketClientRef.current as any,
          {
            visitorId: user?.id,
            appVersion,
            buildNumber,
            entryPoint,
          }
        );

        isAnalyticsInitializedRef.current = true;
      } catch (error) {
        if (__DEV__) {
          console.error('[Analytics Integration] Init error:', error);
        }
      }
    };

    initAnalytics();
  }, [chatSessionId, isInitialized, botId, appVersion, buildNumber, entryPoint, user?.id, analytics, flowEngine]);

  // Finalize analytics when session ends or component unmounts
  useEffect(() => {
    return () => {
      if (isAnalyticsInitializedRef.current) {
        analytics.finalize();
        isAnalyticsInitializedRef.current = false;
      }
    };
  }, [analytics]);

  // Track node visits based on currentUIState changes
  useEffect(() => {
    if (!analytics.isInitialized || !currentUIState) return;

    const nodeId = currentUIState.nodeId;
    const nodeType = currentUIState.nodeType;

    // Only track if it's a new node
    if (nodeId && nodeId !== lastNodeIdRef.current) {
      // Exit previous node if any
      if (lastNodeIdRef.current) {
        analytics.trackNodeExit('proceeded');
      }

      // Enter new node
      analytics.trackNodeVisit(nodeId, nodeType || 'unknown', nodeId);
      lastNodeIdRef.current = nodeId;
    }
  }, [currentUIState, analytics]);

  // Track messages based on record changes
  useEffect(() => {
    if (!analytics.isInitialized) return;

    const currentLength = record.length;

    // Check if new messages were added
    if (currentLength > lastRecordLengthRef.current) {
      // Get new messages
      const newMessages = record.slice(lastRecordLengthRef.current);

      for (const message of newMessages) {
        if (message.type === 'user-message') {
          // Track user message
          const text = (message as any).text || '';
          analytics.trackUserMessage(text, currentLength);
        } else if (message.type === 'bot-message') {
          // Track bot message
          analytics.trackBotMessage();
        } else if (message.type === 'agent-message') {
          // Track agent message
          analytics.trackAgentMessage();
        }
      }
    }

    lastRecordLengthRef.current = currentLength;
  }, [record, analytics]);

  // Track chat open/close
  useEffect(() => {
    if (!analytics.isInitialized) return;

    if (isOpen) {
      analytics.trackEvent('chat_opened');
    } else {
      analytics.trackEvent('chat_closed');
    }
  }, [isOpen, analytics]);

  return <>{children}</>;
};

// ========================================
// MAIN PROVIDER
// ========================================

/**
 * Combined provider that includes both ConferBot and Analytics functionality.
 * Use this provider for automatic analytics tracking.
 */
export const ConferBotWithAnalyticsProvider: React.FC<ConferBotWithAnalyticsProviderProps> = ({
  apiKey,
  botId,
  config,
  customization,
  user,
  appVersion,
  buildNumber,
  entryPoint,
  children,
}) => {
  const enableAnalytics = config?.enableAnalytics !== false;
  const analyticsConfig = config?.analyticsConfig;

  // Extract analytics-specific config
  const conferBotConfig = config
    ? {
        ...config,
        enableAnalytics: undefined,
        analyticsConfig: undefined,
      }
    : undefined;

  return (
    <ConferBotProvider
      apiKey={apiKey}
      botId={botId}
      config={conferBotConfig}
      customization={customization}
      user={user}
    >
      {enableAnalytics ? (
        <AnalyticsProvider
          config={analyticsConfig}
          enabled={enableAnalytics}
          debug={analyticsConfig?.debug}
        >
          <AnalyticsIntegration
            botId={botId}
            appVersion={appVersion}
            buildNumber={buildNumber}
            entryPoint={entryPoint}
            user={user}
          >
            {children}
          </AnalyticsIntegration>
        </AnalyticsProvider>
      ) : (
        children
      )}
    </ConferBotProvider>
  );
};

export default ConferBotWithAnalyticsProvider;
