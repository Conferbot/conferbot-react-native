/**
 * Core Module Index
 *
 * Main entry point for the Conferbot React Native SDK core functionality.
 */

// State management
export { ChatState } from './state/ChatState';
export type {
  AnswerVariable,
  UserMetadata,
  TranscriptEntry,
  RecordEntry,
} from './state/ChatState';

// Node types and handlers
export * from './nodes';

// Flow engine
export { NodeFlowEngine } from './NodeFlowEngine';
export type { NodeFlowEngineConfig, EngineState, FlowTraceEvent } from './NodeFlowEngine';

// Utilities
export * from './utils/ValidationUtils';

// The SDK's own words in the visitor's language (web ts/i18n.ts)
export {
  t,
  tFor,
  tPlural,
  setWidgetLanguage,
  widgetLanguage,
  widgetLocale,
  resolveLanguage,
  normalizeWidgetLanguage,
  baseLanguageOf,
  deviceLanguages,
  deviceLanguagesOf,
  onWidgetLanguage,
  SUPPORTED_LANGUAGES,
  LANGUAGE_NAMES,
  DICTIONARIES,
} from './i18n';
export type { I18nKey, I18nVars, WidgetLanguage, WidgetLanguageSetting } from './i18n';
