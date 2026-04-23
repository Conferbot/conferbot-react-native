// @ts-nocheck
/**
 * Node Handlers Index
 *
 * Central export point for all node handlers in the Conferbot React Native SDK.
 * Provides unified registration and access to all node type handlers.
 */

import { NodeHandlerRegistry } from '../NodeHandlerRegistry';

// Import registration functions for internal use
import { registerDisplayHandlers } from './DisplayNodeHandlers';
import { registerAskHandlers } from './AskNodeHandlers';
import { registerChoiceHandlers } from './ChoiceNodeHandlers';
import { registerAdvancedInputHandlers } from './AdvancedInputHandlers';
import { registerLegacyHandlers } from './LegacyNodeHandlers';
import { registerLogicHandlers } from './LogicNodeHandlers';
import { registerIntegrationHandlers } from './IntegrationNodeHandlers';
import { registerSpecialFlowHandlers } from './SpecialNodeHandlers';

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
  NavigateHandler,
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
  AskCustomQuestionHandler,
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
  YesOrNoChoiceHandler,
  NCheckOptionsHandler,
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
  TwoChoicesNodeHandler,
  ThreeChoicesNodeHandler,
  SelectOptionNodeHandler,
  UserRatingNodeHandler,
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
  GmailHandler,
  SlackHandler,
  DiscordHandler,
  WhatsAppHandler,
  TelegramHandler,
  GoogleSheetsHandler,
  GoogleCalendarHandler,
  GoogleAnalyticsHandler,
  GoogleMeetHandler,
  GoogleDocsHandler,
  GoogleDriveHandler,
  HubSpotHandler,
  SalesforceHandler,
  ZohoCRMHandler,
  MailchimpHandler,
  ZapierHandler,
  AirtableHandler,
  NotionHandler,
  StripeHandler,
  registerIntegrationHandlers,
} from './IntegrationNodeHandlers';

// ========================================
// ENHANCED GPT HANDLER (Multi-provider, Streaming)
// ========================================

export {
  EnhancedGPTHandler,
  createEnhancedGPTHandler,
  type EnhancedGPTUIState,
} from './EnhancedGPTHandler';

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
  socketClient?: unknown;
  /** Base URL for API calls and integrations */
  apiBaseUrl?: string;
  /** Global API key for AI providers (OpenAI, Anthropic, etc.) */
  aiApiKey?: string;
  /** Use enhanced GPT handler with streaming support */
  useEnhancedGPT?: boolean;
}

/**
 * Registers ALL node handlers with the provided registry.
 * This is the primary entry point for initializing the complete handler system.
 *
 * @param registry - The NodeHandlerRegistry instance to register handlers with
 * @param config - Optional configuration for handlers that require external dependencies
 */
export function registerAllHandlers(
  registry: NodeHandlerRegistry,
  config?: HandlerRegistrationConfig
): void {
  // Display handlers (8 handlers including navigate)
  registerDisplayHandlers(registry);

  // Ask/Input handlers (10 handlers including ask-custom-question)
  registerAskHandlers(registry);

  // Choice handlers (9 handlers including yes-or-no-choice, n-check-options)
  registerChoiceHandlers(registry);

  // Advanced input handlers (2 handlers)
  registerAdvancedInputHandlers(registry);

  // Legacy compatibility handlers (7 handlers including two-choices, three-choices, select-option, user-rating)
  registerLegacyHandlers(registry);

  // Logic/Flow control handlers (7 handlers)
  registerLogicHandlers(registry);

  // Integration handlers (24 handlers including google-meet, google-docs, google-drive)
  if (config?.useEnhancedGPT) {
    registerIntegrationHandlersWithEnhancedGPT(
      registry,
      config.socketClient,
      config.apiBaseUrl,
      config.aiApiKey
    );
  } else {
    registerIntegrationHandlers(registry, config?.socketClient, config?.apiBaseUrl);
  }

  // Special flow handlers (2 handlers)
  registerSpecialFlowHandlers(registry);
}

/**
 * Registers integration handlers with enhanced GPT handler
 */
function registerIntegrationHandlersWithEnhancedGPT(
  registry: NodeHandlerRegistry,
  socketClient?: unknown,
  apiBaseUrl?: string,
  aiApiKey?: string
): void {
  // Register standard integration handlers first
  registerIntegrationHandlers(registry, socketClient, apiBaseUrl);

  // Override GPT handler with enhanced version
  const enhancedGPT = createEnhancedGPTHandler(
    undefined, // use default AIHandler
    socketClient as any,
    apiBaseUrl,
    aiApiKey
  );

  // Register (will override the basic GPT handler)
  registry.register(enhancedGPT);
}

/**
 * Total number of registered handlers across all categories.
 */
const TOTAL_HANDLER_COUNT = 69;

/**
 * Returns the total number of handlers registered by registerAllHandlers.
 * Useful for verification and debugging purposes.
 *
 * @returns The total count of registered handlers
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
  [HandlerCategories.DISPLAY]: 8,
  [HandlerCategories.ASK]: 10,
  [HandlerCategories.CHOICE]: 9,
  [HandlerCategories.ADVANCED_INPUT]: 2,
  [HandlerCategories.LEGACY]: 7,
  [HandlerCategories.LOGIC]: 7,
  [HandlerCategories.INTEGRATION]: 24,
  [HandlerCategories.SPECIAL]: 2,
};

export default registerAllHandlers;
