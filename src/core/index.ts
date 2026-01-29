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
export type { NodeFlowEngineConfig, EngineState } from './NodeFlowEngine';

// Utilities
export * from './utils/ValidationUtils';
