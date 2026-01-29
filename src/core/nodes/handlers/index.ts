/**
 * Node Handlers Index
 *
 * Central export point for all node handlers in the Conferbot React Native SDK.
 * Provides unified registration and access to all 54 node type handlers.
 */

import { NodeHandlerRegistry } from '../NodeHandlerRegistry';

// ========================================
// DISPLAY NODE HANDLERS
// ========================================

export {
  MessageHandler,
  ImageHandler,
  VideoHandler,
  AudioHandler,
  FileHandler,
  HTMLHandler,
  RedirectHandler,
  displayHandlers,
  registerDisplayHandlers,
} from './DisplayNodeHandlers';

// ========================================
// ASK NODE HANDLERS
// ========================================

export {
  AskNameHandler,
  AskEmailHandler,
  AskPhoneHandler,
  AskNumberHandler,
  AskUrlHandler,
  AskDateHandler,
  AskAddressHandler,
  AskFileHandler,
  AskLocationHandler,
  askHandlers,
  registerAskHandlers,
} from './AskNodeHandlers';

// ========================================
// CHOICE NODE HANDLERS
// ========================================

export {
  ButtonsHandler,
  CardsHandler,
  CarouselHandler,
  PictureChoiceHandler,
  DropdownHandler,
  RatingHandler,
  OpinionScaleHandler,
  choiceHandlers,
  registerChoiceHandlers,
} from './ChoiceNodeHandlers';

// ========================================
// ADVANCED INPUT HANDLERS
// ========================================

export {
  CalendarHandler,
  MultipleQuestionsHandler,
  advancedInputHandlers,
  registerAdvancedInputHandlers,
} from './AdvancedInputHandlers';

// ========================================
// LEGACY NODE HANDLERS
// ========================================

export {
  UserInputNodeHandler,
  UserRangeNodeHandler,
  QuizNodeHandler,
  legacyHandlers,
  registerLegacyHandlers,
} from './LegacyNodeHandlers';

// ========================================
// LOGIC NODE HANDLERS
// ========================================

export {
  ConditionEvaluator,
  ConditionHandler,
  BooleanConditionHandler,
  MathOperationHandler,
  RandomPathHandler,
  SetVariableHandler,
  JumpHandler,
  BusinessHoursHandler,
  registerLogicHandlers,
} from './LogicNodeHandlers';

export type {
  ComparisonOperator,
  Condition,
  BooleanExpression,
} from './LogicNodeHandlers';

// ========================================
// INTEGRATION NODE HANDLERS
// ========================================

export {
  WebhookHandler,
  GPTHandler,
  HumanHandoverHandler,
  DelayHandler,
  EmailHandler,
  SlackHandler,
  DiscordHandler,
  WhatsAppHandler,
  TelegramHandler,
  GoogleSheetsHandler,
  GoogleCalendarHandler,
  GoogleAnalyticsHandler,
  HubSpotHandler,
  SalesforceHandler,
  MailchimpHandler,
  ZapierHandler,
  AirtableHandler,
  registerIntegrationHandlers,
} from './IntegrationNodeHandlers';

// ========================================
// SPECIAL FLOW NODE HANDLERS
// ========================================

export {
  FlowCompletionState,
  SpecialNodeSocketEvents,
  GoalHandler,
  EndConversationHandler,
  registerSpecialFlowHandlers,
} from './SpecialNodeHandlers';

export type {
  FlowCompletionDelegate,
  SpecialNodeSocketEvent,
  ConversionData,
  GoalReachedPayload,
} from './SpecialNodeHandlers';

// ========================================
// UNIFIED REGISTRATION
// ========================================

/**
 * Configuration options for handler registration
 */
export interface HandlerRegistrationConfig {
  /** Socket client instance for real-time features like live chat and human handover */
  socketClient?: any;
  /** Base URL for API calls and integrations */
  apiBaseUrl?: string;
}

/**
 * Registers ALL node handlers with the provided registry.
 * This is the primary entry point for initializing the complete handler system.
 *
 * Handler Categories (54 total):
 * - Display: 7 handlers (message, image, video, audio, file, html, redirect)
 * - Ask: 9 handlers (name, email, phone, number, url, date, address, file, location)
 * - Choice: 7 handlers (buttons, cards, carousel, picturechoice, dropdown, rating, opinionscale)
 * - Advanced Input: 2 handlers (calendar, multiplequestions)
 * - Legacy: 3 handlers (user-input-node, user-range-node, quiz-node)
 * - Logic: 8 handlers (condition, boolean-condition, math, random-path, set-variable, jump, business-hours)
 * - Integration: 17 handlers (webhook, gpt, human-handover, delay, email, slack, discord, whatsapp, telegram, google-sheets, google-calendar, google-analytics, hubspot, salesforce, mailchimp, zapier, airtable)
 * - Special: 2 handlers (goal, end-conversation)
 *
 * @param registry - The NodeHandlerRegistry instance to register handlers with
 * @param config - Optional configuration for handlers that require external dependencies
 *
 * @example
 * ```typescript
 * const registry = new NodeHandlerRegistry();
 * registerAllHandlers(registry, {
 *   socketClient: mySocketInstance,
 *   apiBaseUrl: 'https://api.conferbot.com'
 * });
 * ```
 */
export function registerAllHandlers(
  registry: NodeHandlerRegistry,
  config?: HandlerRegistrationConfig
): void {
  // Display handlers (7 handlers)
  registerDisplayHandlers(registry);

  // Ask/Input handlers (9 handlers)
  registerAskHandlers(registry);

  // Choice handlers (7 handlers)
  registerChoiceHandlers(registry);

  // Advanced input handlers (2 handlers)
  registerAdvancedInputHandlers(registry);

  // Legacy compatibility handlers (3 handlers)
  registerLegacyHandlers(registry);

  // Logic/Flow control handlers (8 handlers)
  registerLogicHandlers(registry);

  // Integration handlers (17 handlers)
  registerIntegrationHandlers(registry, config?.socketClient, config?.apiBaseUrl);

  // Special flow handlers (2 handlers)
  registerSpecialFlowHandlers(registry);
}

/**
 * Total number of registered handlers across all categories.
 *
 * Breakdown:
 * - Display: 7 (message, image, video, audio, file, html, redirect)
 * - Ask: 9 (name, email, phone, number, url, date, address, file, location)
 * - Choice: 7 (buttons, cards, carousel, picturechoice, dropdown, rating, opinionscale)
 * - Advanced Input: 2 (calendar, multiplequestions)
 * - Legacy: 3 (user-input-node, user-range-node, quiz-node)
 * - Logic: 8 (condition, boolean-condition, math, random-path, set-variable, jump, business-hours + subtype)
 * - Integration: 17 (webhook, gpt, human-handover, delay, email, slack, discord, whatsapp,
 *                    telegram, google-sheets, google-calendar, google-analytics, hubspot,
 *                    salesforce, mailchimp, zapier, airtable)
 * - Special: 2 (goal, end-conversation)
 *
 * Total: 54 handlers (with subtype variations counted)
 */
const TOTAL_HANDLER_COUNT = 54;

/**
 * Returns the total number of handlers registered by registerAllHandlers.
 * Useful for verification and debugging purposes.
 *
 * @returns The total count of registered handlers (54)
 */
export function getHandlerCount(): number {
  return TOTAL_HANDLER_COUNT;
}

// ========================================
// HANDLER CATEGORIES
// ========================================

/**
 * Handler categories for organizational purposes
 */
export const HandlerCategories = {
  DISPLAY: 'display',
  ASK: 'ask',
  CHOICE: 'choice',
  ADVANCED_INPUT: 'advanced_input',
  LEGACY: 'legacy',
  LOGIC: 'logic',
  INTEGRATION: 'integration',
  SPECIAL: 'special',
} as const;

export type HandlerCategory = typeof HandlerCategories[keyof typeof HandlerCategories];

/**
 * Handler count breakdown by category
 */
export const HandlerCountByCategory: Record<HandlerCategory, number> = {
  [HandlerCategories.DISPLAY]: 7,
  [HandlerCategories.ASK]: 9,
  [HandlerCategories.CHOICE]: 7,
  [HandlerCategories.ADVANCED_INPUT]: 2,
  [HandlerCategories.LEGACY]: 3,
  [HandlerCategories.LOGIC]: 8,
  [HandlerCategories.INTEGRATION]: 17,
  [HandlerCategories.SPECIAL]: 2,
};

// ========================================
// LEGACY EXPORTS (for backwards compatibility)
// ========================================

/**
 * @deprecated Use registerAllHandlers instead
 */
export function registerAllDisplayHandlers(registry: NodeHandlerRegistry): void {
  registerDisplayHandlers(registry);
  registerAskHandlers(registry);
  registerChoiceHandlers(registry);
  registerAdvancedInputHandlers(registry);
  registerLegacyHandlers(registry);
}

export default registerAllHandlers;
