// @ts-nocheck
import type {
  ConferBotConfig,
  ConferBotUser,
  ConferBotCustomization,
  ConferBotContext as ConferBotContextType,
  Agent,
  MessageAttachment,
  ChatbotConfig,
  RecordItem,
  Reaction,
  ReactionEmoji,
  ReadReceiptConfig,
  MessageStatusEntry,
} from '../types';
import { MessageStatus } from '../types';
import type { NodeUIState } from '../core';
import type { NodeFlowEngine, ChatState } from '../core';
import type {
  AsyncStorageInterface,
  StorageConfig,
} from '../services/StorageService';

// ********** Message Size Limit ********** //
export const MAX_MESSAGES = 500;

/** Strip HTML tags from text (agent messages come wrapped in <p> tags from the rich editor) */
export function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

// ********** Helper: Trim messages to limit ********** //
export const trimMessages = (messages: RecordItem[]): RecordItem[] => {
  if (messages.length > MAX_MESSAGES) {
    return messages.slice(-MAX_MESSAGES);
  }
  return messages;
};

// ********** Helper: Deduplicate messages ********** //
export const deduplicateMessages = (messages: RecordItem[]): RecordItem[] => {
  const seen = new Set<string | number>();
  return messages.filter(msg => {
    if (!msg._id) return true;
    if (seen.has(msg._id)) return false;
    seen.add(msg._id);
    return true;
  });
};

// ********** Extended Context Types ********** //
export interface ExtendedConferBotContext extends ConferBotContextType {
  currentUIState: NodeUIState | null;
  isNodeProcessing: boolean;
  flowEngine: NodeFlowEngine | null;
  chatState: ChatState | null;
  submitNodeResponse: (response: any, portName?: string) => void;
  // Server customizations
  serverCustomizations: Record<string, any> | null;
  serverThemeOverride: Record<string, any> | null;
  botName: string | null;
  botAvatarUrl: string | null;
  // Persistence methods
  isRestoring: boolean;
  hasPersistedSession: boolean;
  clearPersistedData: () => Promise<void>;
  resetConversation: () => Promise<void>;
  // Read receipt methods
  messageStatuses: Map<string | number, MessageStatusEntry>;
  readReceiptsEnabled: boolean;
  getMessageStatus: (messageId: string | number) => MessageStatus | undefined;
  markMessageAsRead: (messageId: string | number) => void;
  markVisibleMessagesAsRead: (messageIds: (string | number)[]) => void;
  // Knowledge Base methods
  rateKBArticle: (articleId: string, helpful: boolean, rating: number, feedback?: string) => void;
  // Live chat state
  isLiveChatMode: boolean;
  agentTyping: boolean;
  sendVisitorTyping: (isTyping: boolean) => void;
}

// ********** Extended Config Types ********** //
export interface ExtendedConferBotConfig extends ConferBotConfig {
  /** Enable session persistence (default: true) */
  enablePersistence?: boolean;
  /** Persistence configuration */
  persistenceConfig?: StorageConfig;
  /** AsyncStorage instance for persistence */
  asyncStorage?: AsyncStorageInterface;
  /** Enable read receipts (default: true) */
  enableReadReceipts?: boolean;
  /** Read receipts configuration */
  readReceiptConfig?: ReadReceiptConfig;
}

// ********** Provider Props ********** //
export interface ConferBotProviderProps {
  apiKey: string;
  botId: string;
  config?: ExtendedConferBotConfig;
  customization?: ConferBotCustomization;
  user?: ConferBotUser;
  children: React.ReactNode;
}
