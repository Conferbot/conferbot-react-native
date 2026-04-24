// ********** Main Export File ********** //

// ========== Configuration ========== //
export { ConferBotEndpoints } from './config/constants';

// ========== Core SDK (Headless) ========== //
// Export context and provider
export { ConferBotProvider, useConferBot } from './context/ConferBotContext';

// Combined provider with analytics
export { ConferBotWithAnalyticsProvider } from './context/ConferBotWithAnalyticsProvider';
export type { ConferBotWithAnalyticsProviderProps } from './context/ConferBotWithAnalyticsProvider';

// Export types
export type {
  ConferBotConfig,
  ConferBotUser,
  ConferBotCustomization,
  ConferBotContext,
  MessageType,
  MessageAttachment,
  Agent,
  ChatSession,
  ChatbotConfig,
  KnowledgeBaseArticle,
  SocketEvents,
  RecordItem,
  // Persistence types
  AsyncStorageInterface,
  PersistenceConfig,
  PersistedSession,
  PersistedUser,
  // Reaction types
  Reaction,
  ReactionEmoji,
  ReactionGroup,
  MessageReactions as MessageReactionsData, // Renamed to avoid conflict with component
  // Read receipt types
  ReadReceiptConfig,
  MessageStatusEntry,
  ReadReceiptData,
  DeliveryReceiptData,
  BatchReadReceiptPayload,
} from './types';

// Export reaction emojis constant
export { REACTION_EMOJIS } from './types';

// Export message status enum and helpers
export {
  MessageStatus,
  ReadReceiptSocketEvents,
  isStatusFinal,
  isStatusSent,
  isStatusPending,
  isStatusMoreAdvanced,
  getNextStatus,
  getStatusText,
  queuedStatusToMessageStatus,
  DEFAULT_READ_RECEIPT_CONFIG,
} from './types';

// ========== Persistence (Storage Service) ========== //
export { StorageService } from './services/StorageService';
export type {
  StorageConfig,
  PersistedSessionData,
  PersistedUserData,
  PersistedAnswerVariables,
  PersistedState,
} from './services/StorageService';

// ========== Offline Queue Service ========== //
export { OfflineQueueService } from './services/OfflineQueueService';
export type {
  QueuedMessage,
  QueuedMessageStatus,
  OfflineQueueConfig,
  OfflineQueueEvent,
  OfflineQueueEventListener,
  SendMessageCallback,
} from './services/OfflineQueueService';

// ========== Link Preview Service ========== //
export { linkPreviewService, LinkPreviewService } from './services/LinkPreviewService';
export type {
  LinkPreviewData,
  LinkPreviewServiceConfig,
} from './services/LinkPreviewService';

// ========== Analytics ========== //
// Analytics service
export {
  AnalyticsService,
  getAnalyticsService,
  resetAnalyticsService,
  AnalyticsStorage,
  AnalyticsEventType,
  AnalyticsSocketEvents,
  DEFAULT_ANALYTICS_CONFIG,
  getMobileAttribution,
  getEnvironmentData,
  getDeviceModel,
  getOSVersion,
  getDeviceType,
  // Node handler wrapper
  withAnalyticsTracking,
  trackNodeButtonClick,
  trackNodeLinkClick,
  trackNodeFileUpload,
  trackNodeCarouselInteraction,
  trackNodeGoalCompletion,
} from './services/analytics';

export type {
  AnalyticsEvent,
  AnalyticsConfig,
  SessionMetrics,
  MessageCounts,
  TypingBehavior,
  NodeVisitData,
  NodeExitType,
  MobileAttribution,
  EnvironmentData,
  DropOffReason,
  AnalyticsTrackingOptions,
  PersistedSessionData as AnalyticsPersistedSessionData,
} from './services/analytics';

// Analytics context and hook
export { AnalyticsProvider, useAnalyticsContext } from './context/AnalyticsContext';
export type {
  AnalyticsContextValue,
  AnalyticsInitOptions,
  RatingSubmitOptions,
  AnalyticsProviderProps,
} from './context/AnalyticsContext';

// ========== Hooks ========== //
export {
  useAnalytics,
  usePersistence,
  useDebouncedPersistence,
  useReactions,
  useReadReceipts,
  useNetworkStatus,
  useOfflineQueue,
} from './hooks';
export type {
  UseAnalyticsOptions,
  UseAnalyticsReturn,
  UserAction,
  RatingOptions,
  UsePersistenceReturn,
  UseReactionsReturn,
  UseReadReceiptsOptions,
  UseReadReceiptsReturn,
  NetworkStatus,
  ConnectionType,
  UseNetworkStatusOptions,
  UseNetworkStatusReturn,
  UseOfflineQueueOptions,
  UseOfflineQueueReturn,
} from './hooks';

// ========== Core (Node Handling) ========== //
export * from './core';
export { ChatState, NodeFlowEngine, NodeHandlerRegistry } from './core';
export type { NodeResult, NodeUIState, NodeHandler, EngineState } from './core';

// Node Types
export { NodeTypes, DisplayNodes, LogicNodes, IntegrationNodes, FlowNodes } from './core/nodes/NodeTypes';

// Handler registration
export { registerAllHandlers } from './core/nodes/handlers';

// ========== Theme System ========== //
export { ThemeProvider, useTheme, defaultTheme, darkTheme } from './theme';
export type { ConferBotTheme, ConferBotThemeOverride } from './theme';

// ========== UI Components ========== //
// Base Components
export {
  Avatar,
  ConnectionStatus,
  TypingIndicator,
  EmptyState,
} from './components';

export type {
  AvatarProps,
  ConnectionStatusProps,
  TypingIndicatorProps,
  EmptyStateProps,
} from './components';

// Message Components
export { MessageBubble } from './components';
export type { MessageBubbleProps } from './components';

// Message Status Component (Read Receipts & Offline Queue)
export { MessageStatus as MessageStatusIndicator, useMessageStatusText } from './components';
export type { MessageStatusProps } from './components';

// Offline Banner Component
export { OfflineBanner } from './components';
export type { OfflineBannerProps } from './components';

// Reaction Components
export { ReactionPicker, MessageReactions } from './components';
export type { ReactionPickerProps, MessageReactionsProps } from './components';

// Link Preview Component
export { LinkPreview } from './components';
export type { LinkPreviewProps } from './components';

// Emoji Picker Components
export {
  EmojiPicker,
  EmojiButton,
  EmojiCategory,
  EmojiGrid,
  EmojiSearchBar,
  SkinToneSelector,
  // Emoji data utilities
  EMOJI_CATEGORIES,
  SKIN_TONES,
  SKIN_TONE_SUPPORTED_EMOJIS,
  EMOJI_KEYWORDS,
  searchEmojis,
  applySkintone,
  RECENT_EMOJIS_STORAGE_KEY,
  MAX_RECENT_EMOJIS,
} from './components';

export type {
  EmojiPickerProps,
  EmojiButtonProps,
  EmojiCategoryProps,
  EmojiGridProps,
  EmojiSearchBarProps,
  SkinToneSelectorProps,
  EmojiCategoryData,
  SkinToneId,
} from './components';

// Input Components
export { ChatInput } from './components';
export type { ChatInputProps } from './components';

// Container Components
export { ChatHeader, MessageList } from './components';
export type { ChatHeaderProps, MessageListProps } from './components';

// Main Chat Widget
export { ChatWidget } from './components';
export type { ChatWidgetProps } from './components';

// Floating Widget (FAB launcher + chat modal)
export { ConferBotWidget } from './components';
export type { ConferBotWidgetProps, WidgetConfig } from './components';

// Node UI Components
export { NodeRenderer } from './components/NodeComponents';

// ========== Utilities ========== //
// File Picker utility for document, image, and camera selection
export {
  FilePicker,
  FilePickerError,
  formatFileSize,
  isFilePickerAvailable,
  isImagePickerAvailable,
  getAvailablePickerLibrary,
} from './utils/FilePicker';

export type {
  FileType,
  FilePickerResult,
  FilePickerOptions,
  ImagePickerOptions,
  CameraOptions,
} from './utils/FilePicker';

// Link Detection Utilities
export {
  detectUrls,
  normalizeUrl,
  isValidUrl,
  isImageUrl,
  parseTextForUrls,
  extractDomain,
  getFaviconUrl,
  truncateUrl,
} from './utils/LinkDetector';

export type {
  DetectedUrl,
  ParsedTextResult,
  TextSegment,
} from './utils/LinkDetector';

// Default export
export { ConferBotProvider as default } from './context/ConferBotContext';
