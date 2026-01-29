/**
 * AnalyticsContext.tsx
 *
 * React Context for analytics integration in the Conferbot React Native SDK.
 * Provides analytics tracking throughout the component tree.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
  useState,
  useMemo,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import type ConferBotSocket from '../services/socket';
import {
  AnalyticsService,
  getAnalyticsService,
  type AnalyticsConfig,
  type NodeExitType,
  type DropOffReason,
} from '../services/analytics';

// ========================================
// CONTEXT TYPES
// ========================================

export interface AnalyticsContextValue {
  /** Whether analytics is enabled and initialized */
  isInitialized: boolean;

  /** Initialize analytics with session data */
  initialize: (
    chatSessionId: string,
    botId: string,
    socketClient: ConferBotSocket,
    options?: AnalyticsInitOptions
  ) => Promise<void>;

  /** Finalize analytics session */
  finalize: () => Promise<void>;

  // Event tracking
  trackEvent: (name: string, properties?: Record<string, any>) => void;

  // Node tracking
  trackNodeVisit: (nodeId: string, nodeType: string, nodeName?: string) => void;
  trackNodeExit: (exitType: NodeExitType, userInput?: string, selectedOption?: string) => void;

  // Message tracking
  trackUserMessage: (text: string, messageIndex?: number) => void;
  trackBotMessage: () => void;
  trackAgentMessage: () => void;

  // Typing tracking
  trackTypingStart: () => void;
  trackTypingEnd: (wasSent?: boolean) => void;
  trackDeletion: () => void;

  // Interaction tracking
  trackButtonClick: (buttonId: string, buttonLabel?: string) => void;
  trackChoiceSelect: (choiceId: string, choiceLabel?: string) => void;
  trackLinkClick: (url: string) => void;
  trackFileUpload: (fileName: string, fileType: string, fileSize?: number) => void;
  trackImageView: (imageUrl: string) => void;
  trackVideoWatch: (videoUrl: string, watchDuration?: number) => void;
  trackCarouselInteraction: (action: 'swipe' | 'click', itemIndex: number) => void;

  // Goal tracking
  trackGoalCompletion: (goalId: string, conversionEvent?: string, conversionValue?: number) => void;

  // Rating
  submitRating: (options: RatingSubmitOptions) => void;

  // Drop-off
  trackDropOff: (reason: DropOffReason, lastUserAction?: string) => void;

  // Flush events
  flushEvents: () => Promise<void>;
}

export interface AnalyticsInitOptions {
  visitorId?: string;
  appVersion?: string;
  buildNumber?: string;
  entryPoint?: string;
  deepLink?: string;
  pushNotificationId?: string;
}

export interface RatingSubmitOptions {
  csatScore?: number;
  feedback?: string;
  thumbsUp?: boolean;
  npsScore?: number;
  source?: string;
}

// ========================================
// PROVIDER PROPS
// ========================================

export interface AnalyticsProviderProps {
  children: React.ReactNode;
  /** Custom analytics configuration */
  config?: Partial<AnalyticsConfig>;
  /** Enable/disable analytics */
  enabled?: boolean;
  /** Debug mode */
  debug?: boolean;
}

// ========================================
// CONTEXT CREATION
// ========================================

const AnalyticsContext = createContext<AnalyticsContextValue | null>(null);

// ========================================
// PROVIDER COMPONENT
// ========================================

export const AnalyticsProvider: React.FC<AnalyticsProviderProps> = ({
  children,
  config,
  enabled = true,
  debug = false,
}) => {
  const [isInitialized, setIsInitialized] = useState(false);

  // Get analytics service with config
  const analyticsService = useMemo(() => {
    return getAnalyticsService({
      enabled,
      debug: debug || __DEV__,
      ...config,
    });
  }, [enabled, debug, config]);

  // Track current session
  const currentSessionRef = useRef<string | null>(null);

  // Initialize analytics
  const initialize = useCallback(
    async (
      chatSessionId: string,
      botId: string,
      socketClient: ConferBotSocket,
      options?: AnalyticsInitOptions
    ): Promise<void> => {
      if (!enabled) return;

      // Avoid re-initialization for same session
      if (currentSessionRef.current === chatSessionId && isInitialized) {
        return;
      }

      await analyticsService.initialize(chatSessionId, botId, socketClient, options);
      currentSessionRef.current = chatSessionId;
      setIsInitialized(true);
    },
    [analyticsService, enabled, isInitialized]
  );

  // Finalize analytics
  const finalize = useCallback(async (): Promise<void> => {
    await analyticsService.finalize();
    currentSessionRef.current = null;
    setIsInitialized(false);
  }, [analyticsService]);

  // ========================================
  // TRACKING METHODS
  // ========================================

  const trackEvent = useCallback(
    (name: string, properties?: Record<string, any>) => {
      analyticsService.trackEvent(name, properties);
    },
    [analyticsService]
  );

  const trackNodeVisit = useCallback(
    (nodeId: string, nodeType: string, nodeName?: string) => {
      analyticsService.trackNodeEntry(nodeId, nodeType, nodeName || nodeId);
    },
    [analyticsService]
  );

  const trackNodeExit = useCallback(
    (exitType: NodeExitType, userInput?: string, selectedOption?: string) => {
      analyticsService.trackNodeExit(exitType, userInput, selectedOption);
    },
    [analyticsService]
  );

  const trackUserMessage = useCallback(
    (text: string, messageIndex?: number) => {
      analyticsService.trackUserMessage(text, messageIndex);
    },
    [analyticsService]
  );

  const trackBotMessage = useCallback(() => {
    analyticsService.trackBotMessage();
  }, [analyticsService]);

  const trackAgentMessage = useCallback(() => {
    analyticsService.trackAgentMessage();
  }, [analyticsService]);

  const trackTypingStart = useCallback(() => {
    analyticsService.trackTypingStart();
  }, [analyticsService]);

  const trackTypingEnd = useCallback(
    (wasSent: boolean = true) => {
      analyticsService.trackTypingEnd(wasSent);
    },
    [analyticsService]
  );

  const trackDeletion = useCallback(() => {
    analyticsService.trackDeletion();
  }, [analyticsService]);

  const trackButtonClick = useCallback(
    (buttonId: string, buttonLabel?: string) => {
      analyticsService.trackButtonClick(buttonId, buttonLabel);
    },
    [analyticsService]
  );

  const trackChoiceSelect = useCallback(
    (choiceId: string, choiceLabel?: string) => {
      analyticsService.trackChoiceSelect(choiceId, choiceLabel);
    },
    [analyticsService]
  );

  const trackLinkClick = useCallback(
    (url: string) => {
      analyticsService.trackLinkClick(url);
    },
    [analyticsService]
  );

  const trackFileUpload = useCallback(
    (fileName: string, fileType: string, fileSize?: number) => {
      analyticsService.trackFileUpload(fileName, fileType, fileSize);
    },
    [analyticsService]
  );

  const trackImageView = useCallback(
    (imageUrl: string) => {
      analyticsService.trackImageView(imageUrl);
    },
    [analyticsService]
  );

  const trackVideoWatch = useCallback(
    (videoUrl: string, watchDuration?: number) => {
      analyticsService.trackVideoWatch(videoUrl, watchDuration);
    },
    [analyticsService]
  );

  const trackCarouselInteraction = useCallback(
    (action: 'swipe' | 'click', itemIndex: number) => {
      analyticsService.trackCarouselInteraction(action, itemIndex);
    },
    [analyticsService]
  );

  const trackGoalCompletion = useCallback(
    (goalId: string, conversionEvent?: string, conversionValue?: number) => {
      analyticsService.trackGoalCompletion(goalId, conversionEvent, conversionValue);
    },
    [analyticsService]
  );

  const submitRating = useCallback(
    (options: RatingSubmitOptions) => {
      analyticsService.submitRating(options);
    },
    [analyticsService]
  );

  const trackDropOff = useCallback(
    (reason: DropOffReason, lastUserAction?: string) => {
      analyticsService.trackDropOff(reason, lastUserAction);
    },
    [analyticsService]
  );

  const flushEvents = useCallback(async () => {
    await analyticsService.flushEvents();
  }, [analyticsService]);

  // ========================================
  // CONTEXT VALUE
  // ========================================

  const contextValue: AnalyticsContextValue = useMemo(
    () => ({
      isInitialized,
      initialize,
      finalize,
      trackEvent,
      trackNodeVisit,
      trackNodeExit,
      trackUserMessage,
      trackBotMessage,
      trackAgentMessage,
      trackTypingStart,
      trackTypingEnd,
      trackDeletion,
      trackButtonClick,
      trackChoiceSelect,
      trackLinkClick,
      trackFileUpload,
      trackImageView,
      trackVideoWatch,
      trackCarouselInteraction,
      trackGoalCompletion,
      submitRating,
      trackDropOff,
      flushEvents,
    }),
    [
      isInitialized,
      initialize,
      finalize,
      trackEvent,
      trackNodeVisit,
      trackNodeExit,
      trackUserMessage,
      trackBotMessage,
      trackAgentMessage,
      trackTypingStart,
      trackTypingEnd,
      trackDeletion,
      trackButtonClick,
      trackChoiceSelect,
      trackLinkClick,
      trackFileUpload,
      trackImageView,
      trackVideoWatch,
      trackCarouselInteraction,
      trackGoalCompletion,
      submitRating,
      trackDropOff,
      flushEvents,
    ]
  );

  return <AnalyticsContext.Provider value={contextValue}>{children}</AnalyticsContext.Provider>;
};

// ========================================
// HOOK
// ========================================

/**
 * Hook to access analytics context
 */
export const useAnalyticsContext = (): AnalyticsContextValue => {
  const context = useContext(AnalyticsContext);

  if (!context) {
    throw new Error('useAnalyticsContext must be used within an AnalyticsProvider');
  }

  return context;
};

export default AnalyticsContext;
