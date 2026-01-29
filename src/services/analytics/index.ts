/**
 * Analytics Module
 *
 * Exports for the Conferbot React Native SDK analytics system.
 */

// Main service
export {
  AnalyticsService,
  getAnalyticsService,
  resetAnalyticsService,
} from './AnalyticsService';

// Storage
export { AnalyticsStorage, type PersistedSessionData } from './AnalyticsStorage';

// Device info utilities
export {
  getDeviceModel,
  getOSVersion,
  getScreenDimensions,
  getWindowDimensions,
  getLocale,
  getTimezone,
  getDeviceType,
  isEmulator,
  getMobileAttribution,
  getEnvironmentData,
} from './DeviceInfo';

// Node handler wrapper
export {
  withAnalyticsTracking,
  trackNodeButtonClick,
  trackNodeLinkClick,
  trackNodeFileUpload,
  trackNodeCarouselInteraction,
  trackNodeGoalCompletion,
  type AnalyticsTrackingOptions,
} from './withAnalyticsTracking';

// Types
export {
  AnalyticsEventType,
  AnalyticsSocketEvents,
  DEFAULT_ANALYTICS_CONFIG,
  type AnalyticsEvent,
  type AnalyticsConfig,
  type SessionMetrics,
  type MessageCounts,
  type TypingBehavior,
  type NodeVisitData,
  type NodeExitType,
  type MobileAttribution,
  type EnvironmentData,
  type DropOffReason,
  type SessionStartEvent,
  type SessionEndEvent,
  type NodeVisitEvent,
  type NodeExitEvent,
  type MessageSentEvent,
  type InteractionEvent,
  type GoalCompletionEvent,
  type RatingSubmitEvent,
  type DropOffEvent,
  type EngagementUpdateEvent,
} from './types';
