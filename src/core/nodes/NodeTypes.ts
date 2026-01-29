/**
 * NodeTypes.ts
 *
 * Comprehensive node type definitions for the Conferbot React Native SDK.
 * Includes all 51 node types organized by category matching the web widget.
 */

// ========================================
// DISPLAY NODES (28 TYPES)
// ========================================

export const DisplayNodes = {
  // Basic Display
  MESSAGE: 'message',
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
  FILE: 'file',
  HTML: 'html',
  REDIRECT: 'redirect',

  // Ask Question Nodes
  ASK_NAME: 'ask-name',
  ASK_EMAIL: 'ask-email',
  ASK_PHONE: 'ask-phone',
  ASK_NUMBER: 'ask-number',
  ASK_URL: 'ask-url',
  ASK_DATE: 'ask-date',
  ASK_ADDRESS: 'ask-address',
  ASK_FILE: 'ask-file',
  ASK_LOCATION: 'ask-location',

  // Choice/Selection Nodes
  BUTTONS: 'buttons',
  CARDS: 'cards',
  CAROUSEL: 'carousel',
  PICTURE_CHOICE: 'picturechoice',
  DROPDOWN: 'dropdown',
  RATING: 'rating',
  OPINON_SCALE: 'opinionscale',

  // Advanced Input Nodes
  CALENDAR: 'calendar',
  MULTIPLE_QUESTIONS: 'multiplequestions',

  // Legacy Nodes
  USER_INPUT_NODE: 'user-input-node',
  USER_RANGE_NODE: 'user-range-node',
  QUIZ_NODE: 'quiz-node',
} as const;

// ========================================
// LOGIC NODES (7 TYPES)
// ========================================

export const LogicNodes = {
  CONDITION: 'condition',
  BOOLEAN_CONDITION: 'boolean-condition',
  MATH_OPERATION: 'math-operation',
  RANDOM_PATH: 'random-path',
  SET_VARIABLE: 'set-variable',
  JUMP: 'jump',
  BUSINESS_HOURS: 'business-hours',
} as const;

// ========================================
// INTEGRATION NODES (17 TYPES)
// ========================================

export const IntegrationNodes = {
  // Core Integrations
  WEBHOOK: 'webhook',
  GPT: 'gpt',
  HUMAN_HANDOVER: 'human-handover',
  DELAY: 'delay',

  // Email & Communication
  EMAIL: 'email',
  SLACK: 'slack-node',
  DISCORD: 'discord-node',
  WHATSAPP: 'whatsapp-node',
  TELEGRAM: 'telegram-node',

  // Google Integrations
  GOOGLE_SHEETS: 'google-sheets',
  GOOGLE_CALENDAR: 'google-calendar',
  GOOGLE_ANALYTICS: 'google-analytics',

  // CRM & Marketing
  HUBSPOT: 'hubspot',
  SALESFORCE: 'salesforce',
  MAILCHIMP: 'mailchimp',

  // Automation
  ZAPIER: 'zapier',
  AIRTABLE: 'airtable',
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
  DisplayNodes.ASK_DATE,
  DisplayNodes.ASK_ADDRESS,
  DisplayNodes.ASK_FILE,
  DisplayNodes.ASK_LOCATION,

  // Choice nodes
  DisplayNodes.BUTTONS,
  DisplayNodes.CARDS,
  DisplayNodes.CAROUSEL,
  DisplayNodes.PICTURE_CHOICE,
  DisplayNodes.DROPDOWN,
  DisplayNodes.RATING,
  DisplayNodes.OPINON_SCALE,

  // Advanced input
  DisplayNodes.CALENDAR,
  DisplayNodes.MULTIPLE_QUESTIONS,

  // Legacy
  DisplayNodes.USER_INPUT_NODE,
  DisplayNodes.USER_RANGE_NODE,
  DisplayNodes.QUIZ_NODE,
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
  IntegrationNodes.SLACK,
  IntegrationNodes.DISCORD,
  IntegrationNodes.WHATSAPP,
  IntegrationNodes.TELEGRAM,
  IntegrationNodes.GOOGLE_SHEETS,
  IntegrationNodes.GOOGLE_CALENDAR,
  IntegrationNodes.GOOGLE_ANALYTICS,
  IntegrationNodes.HUBSPOT,
  IntegrationNodes.SALESFORCE,
  IntegrationNodes.MAILCHIMP,
  IntegrationNodes.ZAPIER,
  IntegrationNodes.AIRTABLE,

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
  [DisplayNodes.ASK_DATE]: 'date',
  [DisplayNodes.ASK_ADDRESS]: 'address',
  [DisplayNodes.ASK_FILE]: 'file',
  [DisplayNodes.ASK_LOCATION]: 'location',
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
