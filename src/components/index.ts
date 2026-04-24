// ********** Component Exports ********** //
// Pre-built UI components for Conferbot React Native SDK

// Base Components
export { Avatar } from './Avatar';
export type { AvatarProps } from './Avatar';

export { ConnectionStatus } from './ConnectionStatus';
export type { ConnectionStatusProps } from './ConnectionStatus';

export { TypingIndicator } from './TypingIndicator';
export type { TypingIndicatorProps } from './TypingIndicator';

export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

// Message Components
export { MessageBubble } from './MessageBubble';
export type { MessageBubbleProps } from './MessageBubble';

// Message Status Component (Read Receipts & Offline Queue)
export { MessageStatus, useMessageStatusText } from './MessageStatus';
export type { MessageStatusProps } from './MessageStatus';

// Offline Banner Component
export { OfflineBanner } from './OfflineBanner';
export type { OfflineBannerProps } from './OfflineBanner';

// Reaction Components
export { ReactionPicker } from './ReactionPicker';
export type { ReactionPickerProps } from './ReactionPicker';

export { MessageReactions } from './MessageReactions';
export type { MessageReactionsProps } from './MessageReactions';

// Link Preview Components
export { LinkPreview } from './LinkPreview';
export type { LinkPreviewProps } from './LinkPreview';

// Voice Message Components
export { VoiceRecorder } from './VoiceRecorder';
export type { VoiceRecorderProps, VoiceRecordingResult } from './VoiceRecorder';

export { VoiceMessage } from './VoiceMessage';
export type { VoiceMessageProps } from './VoiceMessage';

// Streaming Message Component (AI Responses)
export {
  StreamingMessage,
  useStreamingMessage,
} from './StreamingMessage';
export type {
  StreamingMessageProps,
  StreamingMessageTheme,
  UseStreamingMessageOptions,
  UseStreamingMessageResult,
} from './StreamingMessage';

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
} from './EmojiPicker';

export type {
  EmojiPickerProps,
  EmojiButtonProps,
  EmojiCategoryProps,
  EmojiGridProps,
  EmojiSearchBarProps,
  SkinToneSelectorProps,
  EmojiCategoryData,
  SkinToneId,
} from './EmojiPicker';

// Input Components
export { ChatInput } from './ChatInput';
export type { ChatInputProps } from './ChatInput';

// Container Components
export { ChatHeader } from './ChatHeader';
export type { ChatHeaderProps } from './ChatHeader';

export { MessageList } from './MessageList';
export type { MessageListProps } from './MessageList';

// Main Chat Widget
export { ChatWidget } from './ChatWidget';
export type { ChatWidgetProps } from './ChatWidget';

// Floating Widget (FAB launcher + chat modal)
export { ConferBotWidget } from './FloatingWidget';
export type { ConferBotWidgetProps, WidgetConfig } from './FloatingWidget';

// Node Components - UI components for all node types
export {
  NodeRenderer,
  // Message components
  MessageBubble as NodeMessageBubble,
  ImageDisplay,
  VideoPlayer,
  AudioPlayer,
  FileDownload,
  HTMLView,
  // Input components
  TextInputField,
  TextInputComponent,
  // Selection components
  ButtonGroup,
  CardGrid,
  CarouselView,
  PictureChoiceGrid,
  DropdownPicker,
  // Rating components
  StarRating,
  OpinionScaleSelector,
  SliderInput,
  // Advanced components
  CalendarPicker,
  MultiFieldForm,
  FileUploadButton,
  LocationInput,
  // Special components
  HumanHandoverView,
  GPTResponseView,
  LoadingIndicator,
  QuizQuestion,
} from './NodeComponents';
export type { NodeRendererProps } from './NodeComponents';

// ********** Human Handover Components ********** //
// Complete UI for live agent handover

export {
  // Main view that orchestrates all handover states
  HandoverView,
  // Individual components
  PreChatForm,
  HandoverWaiting,
  HandoverConnected,
  HandoverError,
  PostChatSurvey,
  AgentTyping,
  // Hook for managing handover state
  useHandover,
} from './Handover';

export type {
  // Stage types
  HandoverStage,
  HandoverState,
  HandoverEvent,
  HandoverEventType,
  // Pre-chat types
  PreChatField,
  PreChatFieldOption,
  PreChatFormData,
  PreChatFormConfig,
  // Queue types
  QueueInfo,
  // Agent types
  AgentInfo,
  // Survey types
  SurveyRatingStyle,
  PostChatSurveyConfig,
  SurveyResponse,
  // Component props
  PreChatFormProps,
  HandoverWaitingProps,
  AgentTypingProps,
  PostChatSurveyProps,
  HandoverConnectedProps,
  HandoverEndedProps,
  HandoverErrorProps,
  HandoverViewProps,
  // Socket events
  HandoverSocketEvents,
} from './Handover';

// ********** Knowledge Base Components ********** //
// Complete UI for browsing and viewing help articles

export {
  // Main screen
  KnowledgeBaseScreen,
  // Integrated chat widget with KB
  ChatWidgetWithKB,
  // Context and hooks
  KBProvider,
  useKB,
  // Button for integration
  KBButton,
  // Individual components
  SearchBar,
  CategoryFilter,
  ArticleCard,
  ArticleList,
  ArticleDetail,
  ArticleRating,
} from './KnowledgeBase';

export type {
  // Component props
  KnowledgeBaseScreenProps,
  ChatWidgetWithKBProps,
  KBButtonProps,
  SearchBarProps,
  CategoryFilterProps,
  ArticleCardProps,
  ArticleListProps,
  ArticleDetailProps,
  ArticleRatingProps,
  // Data types
  KBArticle,
  KBCategory,
  KBCategoryWithArticles,
  KBAuthor,
  KBState,
  KBScreenType,
  KBStyleProps,
  ArticleViewPayload,
  ArticleEngagementPayload,
  ArticleRatingPayload,
} from './KnowledgeBase';
