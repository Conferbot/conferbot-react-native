/**
 * useAnalytics.ts
 *
 * React hook for analytics tracking in the Conferbot React Native SDK.
 * Provides easy-to-use methods for tracking events, nodes, and user behavior.
 */

import { useCallback, useEffect, useRef, useMemo } from 'react';
import { useConferBot } from '../context/ConferBotContext';
import {
  AnalyticsService,
  getAnalyticsService,
  type AnalyticsConfig,
  type NodeExitType,
  type DropOffReason,
} from '../services/analytics';

// ========================================
// TYPES
// ========================================

export interface UseAnalyticsOptions {
  /** App version for attribution */
  appVersion?: string;
  /** Build number for attribution */
  buildNumber?: string;
  /** Entry point (e.g., 'home_screen', 'support_button') */
  entryPoint?: string;
  /** Deep link that opened the chat */
  deepLink?: string;
  /** Push notification ID if opened from notification */
  pushNotificationId?: string;
  /** Custom analytics configuration */
  config?: Partial<AnalyticsConfig>;
  /** Enable debug logging */
  debug?: boolean;
}

export interface UseAnalyticsReturn {
  /** Whether analytics is initialized */
  isInitialized: boolean;

  // Event tracking
  /** Track a custom event */
  trackEvent: (name: string, properties?: Record<string, any>) => void;

  // Node tracking
  /** Track node visit (entry) */
  trackNodeVisit: (nodeId: string, nodeType: string, nodeName?: string) => void;
  /** Track node exit */
  trackNodeExit: (exitType: NodeExitType, userInput?: string, selectedOption?: string) => void;

  // User action tracking
  /** Track a user action */
  trackUserAction: (action: UserAction, metadata?: Record<string, any>) => void;

  // Message tracking
  /** Track user message sent */
  trackUserMessage: (text: string, messageIndex?: number) => void;
  /** Track bot message received */
  trackBotMessage: () => void;
  /** Track agent message received */
  trackAgentMessage: () => void;

  // Typing tracking
  /** Track typing started */
  trackTypingStart: () => void;
  /** Track typing ended */
  trackTypingEnd: (wasSent?: boolean) => void;
  /** Track character deletion */
  trackDeletion: () => void;

  // Interaction tracking
  /** Track button click */
  trackButtonClick: (buttonId: string, buttonLabel?: string) => void;
  /** Track choice selection */
  trackChoiceSelect: (choiceId: string, choiceLabel?: string) => void;
  /** Track link click */
  trackLinkClick: (url: string) => void;
  /** Track file upload */
  trackFileUpload: (fileName: string, fileType: string, fileSize?: number) => void;
  /** Track image view */
  trackImageView: (imageUrl: string) => void;
  /** Track video watch */
  trackVideoWatch: (videoUrl: string, watchDuration?: number) => void;
  /** Track carousel interaction */
  trackCarouselInteraction: (action: 'swipe' | 'click', itemIndex: number) => void;

  // Goal tracking
  /** Track goal completion */
  trackGoalCompletion: (goalId: string, conversionEvent?: string, conversionValue?: number) => void;

  // Rating
  /** Submit chat rating */
  submitRating: (options: RatingOptions) => void;

  // Drop-off
  /** Track drop-off event */
  trackDropOff: (reason: DropOffReason, lastUserAction?: string) => void;

  // Session control
  /** Manually flush events */
  flushEvents: () => Promise<void>;
  /** Finalize analytics session */
  finalize: () => Promise<void>;
}

export type UserAction =
  | 'typing_start'
  | 'typing_end'
  | 'message_sent'
  | 'button_click'
  | 'choice_select'
  | 'link_click'
  | 'file_upload'
  | 'image_view'
  | 'video_watch'
  | 'carousel_swipe'
  | 'carousel_click'
  | 'scroll'
  | 'back_press'
  | 'minimize'
  | 'maximize'
  | 'share'
  | 'copy';

export interface RatingOptions {
  csatScore?: number;
  feedback?: string;
  thumbsUp?: boolean;
  npsScore?: number;
  source?: string;
}

// ========================================
// HOOK IMPLEMENTATION
// ========================================

export function useAnalytics(options?: UseAnalyticsOptions): UseAnalyticsReturn {
  const { chatSessionId, isInitialized: isSdkInitialized } = useConferBot();

  // Get analytics service instance
  const analyticsService = useMemo(() => {
    return getAnalyticsService({
      debug: options?.debug ?? __DEV__,
      ...options?.config,
    });
  }, [options?.debug, options?.config]);

  // Track if we've initialized analytics for this session
  const isAnalyticsInitialized = useRef(false);
  const lastSessionId = useRef<string | null>(null);

  // Initialize analytics when chat session starts
  useEffect(() => {
    const initializeAnalytics = async () => {
      if (!isSdkInitialized || !chatSessionId) {
        return;
      }

      // Only initialize if session changed
      if (lastSessionId.current === chatSessionId && isAnalyticsInitialized.current) {
        return;
      }

      // Get socket client from context - this is a workaround
      // In real implementation, socket should be passed properly
      try {
        const { socketClient } = (window as any).__conferbot_internal || {};

        if (!socketClient) {
          console.warn('[useAnalytics] Socket client not available');
          return;
        }

        // Need botId - extract from socket client if available
        const botId = socketClient.botId;
        if (!botId) {
          console.warn('[useAnalytics] Bot ID not available');
          return;
        }

        await analyticsService.initialize(chatSessionId, botId, socketClient, {
          visitorId: socketClient.userId,
          appVersion: options?.appVersion,
          buildNumber: options?.buildNumber,
          entryPoint: options?.entryPoint,
          deepLink: options?.deepLink,
          pushNotificationId: options?.pushNotificationId,
        });

        isAnalyticsInitialized.current = true;
        lastSessionId.current = chatSessionId;
      } catch (error) {
        if (__DEV__) {
          console.error('[useAnalytics] Initialization error:', error);
        }
      }
    };

    initializeAnalytics();
  }, [
    isSdkInitialized,
    chatSessionId,
    analyticsService,
    options?.appVersion,
    options?.buildNumber,
    options?.entryPoint,
    options?.deepLink,
    options?.pushNotificationId,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isAnalyticsInitialized.current) {
        analyticsService.finalize();
        isAnalyticsInitialized.current = false;
      }
    };
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

  const trackUserAction = useCallback(
    (action: UserAction, metadata?: Record<string, any>) => {
      switch (action) {
        case 'typing_start':
          analyticsService.trackTypingStart();
          break;
        case 'typing_end':
          analyticsService.trackTypingEnd(true);
          break;
        case 'message_sent':
          if (metadata?.text) {
            analyticsService.trackUserMessage(metadata.text, metadata?.messageIndex);
          }
          break;
        case 'button_click':
          analyticsService.trackButtonClick(metadata?.buttonId || 'unknown', metadata?.buttonLabel);
          break;
        case 'choice_select':
          analyticsService.trackChoiceSelect(
            metadata?.choiceId || 'unknown',
            metadata?.choiceLabel
          );
          break;
        case 'link_click':
          analyticsService.trackLinkClick(metadata?.url || 'unknown');
          break;
        case 'file_upload':
          analyticsService.trackFileUpload(
            metadata?.fileName || 'unknown',
            metadata?.fileType || 'unknown',
            metadata?.fileSize
          );
          break;
        case 'image_view':
          analyticsService.trackImageView(metadata?.imageUrl || 'unknown');
          break;
        case 'video_watch':
          analyticsService.trackVideoWatch(metadata?.videoUrl || 'unknown', metadata?.watchDuration);
          break;
        case 'carousel_swipe':
          analyticsService.trackCarouselInteraction('swipe', metadata?.itemIndex || 0);
          break;
        case 'carousel_click':
          analyticsService.trackCarouselInteraction('click', metadata?.itemIndex || 0);
          break;
        default:
          analyticsService.trackEvent(action, metadata);
      }
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
    (ratingOptions: RatingOptions) => {
      analyticsService.submitRating(ratingOptions);
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

  const finalize = useCallback(async () => {
    await analyticsService.finalize();
    isAnalyticsInitialized.current = false;
  }, [analyticsService]);

  return {
    isInitialized: analyticsService.initialized,
    trackEvent,
    trackNodeVisit,
    trackNodeExit,
    trackUserAction,
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
    finalize,
  };
}

export default useAnalytics;
