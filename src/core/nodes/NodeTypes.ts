/**
 * NodeTypes.ts
 *
 * Comprehensive node type definitions for the Conferbot React Native SDK.
 * All type strings match the server's kebab-case-node format exactly.
 */

// ========================================
// DISPLAY NODES
// ========================================

export const DisplayNodes = {
  // Basic Display (7)
  MESSAGE: 'message-node',
  IMAGE: 'image-node',
  VIDEO: 'video-node',
  AUDIO: 'audio-node',
  FILE: 'file-node',
  HTML: 'html-node',
  REDIRECT: 'user-redirect-node',

  // Ask Question Nodes (9)
  ASK_NAME: 'ask-name-node',
  ASK_EMAIL: 'ask-email-node',
  ASK_PHONE: 'ask-phone-number-node',
  ASK_NUMBER: 'ask-number-node',
  ASK_URL: 'ask-url-node',
  ASK_LOCATION: 'ask-location-node',
  ASK_CUSTOM_QUESTION: 'ask-custom-question-node',
  ASK_FILE: 'ask-file-node',
  ASK_MULTIPLE_QUESTIONS: 'ask-multiple-questions-node',

  // Choice/Selection Nodes (7)
  N_CHOICES: 'n-choices-node',
  IMAGE_CHOICE: 'image-choice-node',
  RATING_CHOICE: 'rating-choice-node',
  YES_OR_NO_CHOICE: 'yes-or-no-choice-node',
  OPINION_SCALE_CHOICE: 'opinion-scale-choice-node',
  N_SELECT_OPTION: 'n-select-option-node',
  N_CHECK_OPTIONS: 'n-check-options-node',

  // Calendar
  CALENDAR: 'calendar-node',

  // Legacy Nodes (already correct)
  USER_INPUT_NODE: 'user-input-node',
  USER_RANGE_NODE: 'user-range-node',
  QUIZ_NODE: 'quiz-node',

  // Additional Legacy Nodes
  TWO_CHOICES: 'two-choices-node',
  THREE_CHOICES: 'three-choices-node',
  SELECT_OPTION: 'select-option-node',
  USER_RATING: 'user-rating-node',

  // Special Display
  NAVIGATE: 'navigate-node',
} as const;

// ========================================
// LOGIC NODES (7 TYPES)
// ========================================

export const LogicNodes = {
  CONDITION: 'condition-node',
  BOOLEAN_CONDITION: 'boolean-logic-node',
  MATH_OPERATION: 'math-operation-node',
  RANDOM_PATH: 'random-flow-node',
  SET_VARIABLE: 'variable-node',
  JUMP: 'jump-to-node',
  BUSINESS_HOURS: 'business-hours-node',
} as const;

// ========================================
// INTEGRATION NODES (17 TYPES)
// ========================================

export const IntegrationNodes = {
  // Core Integrations
  WEBHOOK: 'webhook-node',
  GPT: 'gpt-node',
  HUMAN_HANDOVER: 'human-handover-node',
  DELAY: 'delay-node',

  // Email & Communication
  EMAIL: 'email-node',
  GMAIL: 'gmail-node',
  SLACK: 'slack-node',
  DISCORD: 'discord-node',

  // Google Integrations
  GOOGLE_SHEETS: 'google-sheets-node',
  GOOGLE_CALENDAR: 'google-calendar-node',
  GOOGLE_MEET: 'google-meet-node',
  GOOGLE_DOCS: 'google-docs-node',
  GOOGLE_DRIVE: 'google-drive-node',

  // CRM & Marketing
  HUBSPOT: 'hubspot-node',

  // Automation
  ZAPIER: 'zapier-node',
  AIRTABLE: 'airtable-node',
  NOTION: 'notion-node',
  ZOHO_CRM: 'zohocrm-node',
  STRIPE: 'stripe-node',
} as const;

// ========================================
// SPECIAL FLOW NODES (2 TYPES)
// ========================================

export const FlowNodes = {
  GOAL: 'goal',
  END_CONVERSATION: 'end_conversation',
} as const;

// ========================================
// ALL NODE TYPES COMBINED
// ========================================

export const NodeTypes = {
  Display: DisplayNodes,
  Logic: LogicNodes,
  Integration: IntegrationNodes,
  Flow: FlowNodes,
} as const;

// ========================================
// TYPE DEFINITIONS
// ========================================

export type DisplayNodeType = typeof DisplayNodes[keyof typeof DisplayNodes];
export type LogicNodeType = typeof LogicNodes[keyof typeof LogicNodes];
export type IntegrationNodeType = typeof IntegrationNodes[keyof typeof IntegrationNodes];
export type FlowNodeType = typeof FlowNodes[keyof typeof FlowNodes];

export type AllNodeTypes =
  | DisplayNodeType
  | LogicNodeType
  | IntegrationNodeType
  | FlowNodeType;

// ========================================
// NODE CATEGORY HELPERS
// ========================================

const displayNodeSet = new Set(Object.values(DisplayNodes));
const logicNodeSet = new Set(Object.values(LogicNodes));
const integrationNodeSet = new Set(Object.values(IntegrationNodes));
const flowNodeSet = new Set(Object.values(FlowNodes));

/**
 * Checks if a node type is a display node
 */
export function isDisplayNode(nodeType: string): boolean {
  return displayNodeSet.has(nodeType as DisplayNodeType);
}

/**
 * Checks if a node type is a logic node
 */
export function isLogicNode(nodeType: string): boolean {
  return logicNodeSet.has(nodeType as LogicNodeType);
}

/**
 * Checks if a node type is an integration node
 */
export function isIntegrationNode(nodeType: string): boolean {
  return integrationNodeSet.has(nodeType as IntegrationNodeType);
}

/**
 * Checks if a node type is a flow node
 */
export function isFlowNode(nodeType: string): boolean {
  return flowNodeSet.has(nodeType as FlowNodeType);
}

/**
 * Gets the category of a node type
 */
export function getNodeCategory(nodeType: string): 'display' | 'logic' | 'integration' | 'flow' | 'unknown' {
  if (isDisplayNode(nodeType)) return 'display';
  if (isLogicNode(nodeType)) return 'logic';
  if (isIntegrationNode(nodeType)) return 'integration';
  if (isFlowNode(nodeType)) return 'flow';
  return 'unknown';
}

// ========================================
// USER INTERACTION HELPERS
// ========================================

/** Set of nodes that require user interaction */
const userInteractionNodes = new Set<string>([
  // Ask nodes
  DisplayNodes.ASK_NAME,
  DisplayNodes.ASK_EMAIL,
  DisplayNodes.ASK_PHONE,
  DisplayNodes.ASK_NUMBER,
  DisplayNodes.ASK_URL,
  DisplayNodes.ASK_LOCATION,
  DisplayNodes.ASK_CUSTOM_QUESTION,
  DisplayNodes.ASK_FILE,
  DisplayNodes.ASK_MULTIPLE_QUESTIONS,

  // Choice nodes
  DisplayNodes.N_CHOICES,
  DisplayNodes.IMAGE_CHOICE,
  DisplayNodes.RATING_CHOICE,
  DisplayNodes.YES_OR_NO_CHOICE,
  DisplayNodes.OPINION_SCALE_CHOICE,
  DisplayNodes.N_SELECT_OPTION,
  DisplayNodes.N_CHECK_OPTIONS,

  // Calendar
  DisplayNodes.CALENDAR,

  // Legacy
  DisplayNodes.USER_INPUT_NODE,
  DisplayNodes.USER_RANGE_NODE,
  DisplayNodes.QUIZ_NODE,
  DisplayNodes.TWO_CHOICES,
  DisplayNodes.THREE_CHOICES,
  DisplayNodes.SELECT_OPTION,
  DisplayNodes.USER_RATING,
]);

/**
 * Checks if a node type requires user interaction
 */
export function requiresUserInteraction(nodeType: string): boolean {
  return userInteractionNodes.has(nodeType);
}

/** Set of nodes that are auto-continue (no user input needed) */
const autoContinueNodes = new Set<string>([
  DisplayNodes.MESSAGE,
  DisplayNodes.IMAGE,
  DisplayNodes.VIDEO,
  DisplayNodes.AUDIO,
  DisplayNodes.FILE,
  DisplayNodes.HTML,
  DisplayNodes.REDIRECT,
  DisplayNodes.NAVIGATE,

  // All logic nodes
  LogicNodes.CONDITION,
  LogicNodes.BOOLEAN_CONDITION,
  LogicNodes.MATH_OPERATION,
  LogicNodes.RANDOM_PATH,
  LogicNodes.SET_VARIABLE,
  LogicNodes.JUMP,
  LogicNodes.BUSINESS_HOURS,

  // Most integration nodes
  IntegrationNodes.WEBHOOK,
  IntegrationNodes.GPT,
  IntegrationNodes.EMAIL,
  IntegrationNodes.GMAIL,
  IntegrationNodes.SLACK,
  IntegrationNodes.DISCORD,
  IntegrationNodes.GOOGLE_SHEETS,
  IntegrationNodes.GOOGLE_CALENDAR,
  IntegrationNodes.GOOGLE_MEET,
  IntegrationNodes.GOOGLE_DOCS,
  IntegrationNodes.GOOGLE_DRIVE,
  IntegrationNodes.HUBSPOT,
  IntegrationNodes.ZAPIER,
  IntegrationNodes.AIRTABLE,
  IntegrationNodes.NOTION,
  IntegrationNodes.ZOHO_CRM,
  IntegrationNodes.STRIPE,
  IntegrationNodes.DELAY,
  IntegrationNodes.HUMAN_HANDOVER,

  // Flow nodes
  FlowNodes.GOAL,
  FlowNodes.END_CONVERSATION,
]);

/**
 * Checks if a node auto-continues without user input
 */
export function isAutoContinueNode(nodeType: string): boolean {
  return autoContinueNodes.has(nodeType);
}

// ========================================
// VALIDATION TYPE HELPERS
// ========================================

/** Map of node types to their validation type */
export const NodeValidationTypes: Record<string, string> = {
  [DisplayNodes.ASK_NAME]: 'name',
  [DisplayNodes.ASK_EMAIL]: 'email',
  [DisplayNodes.ASK_PHONE]: 'phone',
  [DisplayNodes.ASK_NUMBER]: 'number',
  [DisplayNodes.ASK_URL]: 'url',
  [DisplayNodes.ASK_FILE]: 'file',
  [DisplayNodes.ASK_LOCATION]: 'location',
  [DisplayNodes.ASK_CUSTOM_QUESTION]: 'text',
};

/**
 * Gets the validation type for a node
 */
export function getValidationType(nodeType: string): string | undefined {
  return NodeValidationTypes[nodeType];
}

// ========================================
// NODE DATA STRUCTURE
// ========================================

/** Base node structure */
export interface BaseNode {
  id: string;
  type: AllNodeTypes | string;
  data?: Record<string, any>;
  position?: { x: number; y: number };
}

/** Node with connection ports */
export interface NodeWithPorts extends BaseNode {
  sourceHandle?: string;
  targetHandle?: string;
}

/** Edge connecting nodes */
export interface NodeEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  data?: Record<string, any>;
}

/** Flow definition */
export interface FlowDefinition {
  nodes: BaseNode[];
  edges: NodeEdge[];
  startNodeId?: string;
}

export default NodeTypes;
