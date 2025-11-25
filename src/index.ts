// ********** Main Export File ********** //

// ========== Core SDK (Headless) ========== //
// Export context and provider
export { ConferBotProvider, useConferBot } from './context/ConferBotContext';

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
} from './types';

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

// Input Components
export { ChatInput } from './components';
export type { ChatInputProps } from './components';

// Container Components
export { ChatHeader, MessageList } from './components';
export type { ChatHeaderProps, MessageListProps } from './components';

// Main Chat Widget
export { ChatWidget } from './components';
export type { ChatWidgetProps } from './components';

// Default export
export { ConferBotProvider as default } from './context/ConferBotContext';
