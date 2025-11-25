// ********** Main Export File ********** //
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
} from './types';

// Default export
export { ConferBotProvider as default } from './context/ConferBotContext';
