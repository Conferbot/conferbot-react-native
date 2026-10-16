// @ts-nocheck
import type { ResolvedCustomizations } from '../core/customizations';
import type { ResolvedWidgetTheme } from '../core/widgetTheme';
import type { WidgetLanguage } from '../core/i18n';
import type { RedirectLine } from '../core/postChatRedirect';
import type { WidgetSignalDetail, WidgetSignalName } from '../core/handoverWaiting';
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
  /** The bot's settings as the web widget applies them (core/customizations). */
  customizations: ResolvedCustomizations;
  /** The widget theme in force: tokens, shape, scheme (core/widgetTheme). */
  widgetTheme: ResolvedWidgetTheme;
  /** The language the SDK's own words are drawn in (core/i18n): the owner's `widgetLanguage`, or the phone's. */
  widgetLanguage: WidgetLanguage;
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
  // ---- AI agent bots (Agent Studio) ----
  /** The bot's AI agent when it is a no-flow agent bot, else null. */
  agentBot: import('../core/agentBot').AgentBot | null;
  /** The AI reply as it is being written (one live bubble), or null. */
  agentStream: { id: string; text: string; agentDetails: any } | null;
  /** One-tap questions: the greeting's starters, then each answer's follow-ups. */
  suggestions: string[];
  /** Waiting for the AI's reply (the typing dots). */
  awaitingReply: boolean;
  /** The visitor is engaging (typing): starts the agent conversation. */
  engageAgent: () => void;
  /** "Helpful?" on an AI answer. */
  sendAnswerFeedback: (agentMessageId: string, feedback: { helpful: boolean; reason?: string; comment?: string }) => void;
  /** Confirm / Not now on an action the AI is about to take. */
  decideAction: (token: string, accept: boolean) => Promise<{ ok: boolean; code?: string }>;
  /** A tapped answer button or quick action, as a goal. */
  trackGoal: (goalId: string, conversionEvent: string) => void;
  // Live chat extras (core/liveChat.ts)
  botId: string;
  queue: import('../core/liveChat').QueueStatus | null;
  /** When the waiting handover's max wait runs out (ms since the epoch), for the wait card's countdown; null when no flow handover waits. */
  waitEndsAt?: number | null;
  handoverWaiting: import('../core/liveChat').HandoverWaiting | null;
  noAgentsAvailable: boolean;
  lockedBy: string | null;
  visitorInputEnabled: boolean;
  agentConnectionLost: string | null;
  fileRequestedBy: string | null;
  receiptMarks: import('../core/liveChat').ReceiptMarks;
  leadCardOpen: boolean;
  csatConfig: import('../core/liveChat').CsatConfig | null;
  csatOpen: boolean;
  /** Sent from the cards: the leave a message email, the lead email, a rating. */
  leftMessageTo: string | null;
  leadEmail: string | null;
  csatSent: boolean;
  leaveMessage: (email: string, message: string) => Promise<boolean>;
  shareEmailForReply: (email: string) => Promise<boolean>;
  captureLeadEmail: (email: string) => void;
  submitRating: (value: number | boolean, feedback?: string) => void;
  sendLiveFile: (url: string, file?: { name?: string; type?: string; size?: number }) => void;
  /** "Not now" on leave a message: the flow carries on. */
  skipLeaveMessage: () => void;
  dismissCsat: () => void;
  dismissFileRequest: () => void;
  /** The workspace blocked this visitor: the closed line's words (core/liveEvents.ts), else null. */
  visitorBlocked: string | null;
  /** "Email me this chat" (core/emailTranscript.ts): the card is up. */
  emailTranscriptOpen: boolean;
  /** Where the transcript went, once sent. */
  emailTranscriptSentTo: string | null;
  openEmailTranscript: () => void;
  closeEmailTranscript: () => void;
  /** Send the transcript to this address; `{ ok, message }` as the server answered. */
  emailTranscript: (email: string) => Promise<{ ok: boolean; message?: string }>;
  /**
   * Leave the queue (the wait card's Cancel): queue-self-resolve, then the
   * flow carries on. False when a person already picked the chat up.
   */
  leaveQueue: () => Promise<boolean>;
  /**
   * Listen to the web widget's waiting signals: 'cb:waiting-for-human'
   * (also 20s into a wait with nobody yet), 'cb:human-joined',
   * 'cb:wait-over'. Returns the unsubscribe.
   */
  onWidgetSignal: (name: WidgetSignalName, fn: (detail: WidgetSignalDetail) => void) => () => void;
  // ---- While you wait (core/waitArticles.ts, core/waitingGames.ts, core/gamesCard.ts) ----
  /** The help card: the articles for their question, or the server's queue-help pick. */
  waitHelp: import('../core/waitArticles').HelpCardState | null;
  /** A help card row: an article opens in the app (a page in the browser, from the view). */
  openHelpItem: (item: import('../core/waitArticles').HelpItem) => void;
  /** "That solved it": queue-self-resolve; true when the visitor left the queue. */
  solveWait: () => Promise<boolean>;
  /** The waiting games card on screen, or null. Its own state: `subscribe` / `getState`. */
  gamesCard: import('../core/gamesCard').GamesCard | null;
  /** A help article open in the app, or null. */
  openedArticle: any | null;
  /** Open a help article by id in the app. */
  openArticle: (articleId: string) => void;
  closeArticle: () => void;
  /** The visitor's words while waiting: true when "play" opened the games instead (do not send). */
  interceptPlay: (text: string) => boolean;
  // ---- Your requests (core/requests.ts, core/requestsPortal.ts) ----
  /** The portal's screens: `getState` / `subscribe` and the actions (null until the socket is made). */
  requestsPortal: import('../core/requestsPortal').RequestsPortal | null;
  /** The portal is up. */
  requestsOpen: boolean;
  /** The visitor's requests, newest replies first; null until read (nothing is asked for a first-time visitor). */
  requests: import('../core/requests').RequestSummary[] | null;
  /** Requests with a team reply not read on this device: for a badge. */
  requestsUnread: number;
  /** Open the portal on the list, or on one request. */
  openRequests: (requestId?: string) => void;
  closeRequests: () => void;
  /** Read the list again (at most every 15s unless forced). */
  refreshRequests: (force?: boolean) => Promise<void>;
  /** When each request was last read on this device. */
  requestsSeen: Record<string, number>;
  // ---- Home screen (core/home.ts, context/hooks/useHomeScreen.ts) ----
  /** The view the open chat shows: the home screen (only while the owner has it on), the conversation, the help centre. */
  homeView: import('../core/home').HomeView;
  /** Back to the home screen (nothing when the owner has none). */
  showHome: () => void;
  /** To the conversation; with `text`, it is asked there as the visitor. */
  showChat: (text?: string) => void;
  /** The help centre, on one topic or on its list. */
  showHelp: (categoryId?: string) => void;
  helpCategoryId: string | null;
  /** What the device remembers for "Welcome back" (on the device only). */
  homeMemory: import('../core/home').VisitorMemory | null;
  /** The bot's help centre (fetched-chatbot-data's knowledgeBaseData). */
  knowledgeBase: { categories: any[]; recentArticles: any[] };
  /** Matches inside article text from the server (the ask box). */
  searchArticleText: (query: string) => Promise<Array<{ _id: string; snippet: string }>>;
  // ---- The chat's font (core/ownerFont.ts, hooks/useChatFont.ts) ----
  /** `chatFont.body(weight)` / `chatFont.display(weight)`: a { fontFamily } style, or null for the platform font. */
  chatFont: import('../hooks/useChatFont').ChatFont;
  // ---- Sounds (core/messageSound.ts, context/hooks/useChatSounds.ts) ----
  /** The visitor's Sound on / off (kept on the device). */
  soundOn: boolean;
  /** The bot has a sound (message sound, sound pack or launcher sound): the menu offers the switch. */
  hasSounds: boolean;
  toggleSound: () => void;
  /** The visitor sent from the composer (a sound pack's send sound). */
  playSendSound: () => boolean;
  // ---- Human touches (core/delight.ts, context/hooks/useDelight.ts) ----
  /** The bot's tapback and the celebration, per answer row id. */
  answerTouches: Record<string, import('./hooks/useDelight').AnswerTouch>;
  /** The answer row that shows "Edit", if any. */
  changeAnswerRowId: string | null;
  /** "Edit": back to that question. */
  changeAnswer: () => void;
  /** "No rush - ..." under a question that has waited, or null. */
  stallHint: string | null;
  /** The visitor touched, scrolled or typed in the chat (the nudge waits). */
  noteChatActivity: () => void;
  /** The burst on an answer finished. */
  clearAnswerTouch: (rowId: string) => void;
  // ---- Typing preview (core/typingPreview.ts) ----
  /** The composer's text changed: the agent's preview while a person is in the chat. */
  updateVisitorDraft: (text: string, field?: { secureTextEntry?: boolean; textContentType?: string; autoComplete?: string }) => void;
  /** Sent, or emptied: the agent's preview goes. */
  clearVisitorDraft: () => void;
  // ---- Post-chat redirect (core/postChatRedirect.ts) ----
  /** "Taking you to example.com in 10s" under the ended conversation (null: none). */
  postChatRedirect?: RedirectLine | null;
  /** Cancel: the countdown stops and the line goes. */
  cancelPostChatRedirect?: () => void;
  /** "Continue to example.com" (the system could not open it on its own). */
  continuePostChatRedirect?: () => Promise<boolean> | void;
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
