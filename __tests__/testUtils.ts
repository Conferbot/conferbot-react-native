/**
 * Test Utilities and Mock Data Generators
 * Provides reusable test fixtures and helper functions
 */

import type {
  RecordItem,
  UserMessageRecord,
  BotMessageRecord,
  AgentMessageRecord,
  Agent,
  Reaction,
  ReactionEmoji,
  ChatbotConfig,
  ChatSession,
} from '../src/types';
import { MessageStatus, MessageStatusEntry } from '../src/types/messageStatus';

// ========================================
// MOCK DATA GENERATORS
// ========================================

let idCounter = 0;

/**
 * Generate a unique ID for test items
 */
export function generateId(prefix = 'test'): string {
  return `${prefix}_${Date.now()}_${++idCounter}`;
}

/**
 * Create a mock user message
 */
export function createUserMessage(
  text: string,
  overrides: Partial<UserMessageRecord> = {}
): UserMessageRecord {
  return {
    _id: generateId('user_msg'),
    type: 'user-message',
    text,
    time: new Date(),
    ...overrides,
  };
}

/**
 * Create a mock bot message
 */
export function createBotMessage(
  text: string,
  overrides: Partial<BotMessageRecord> = {}
): BotMessageRecord {
  return {
    _id: generateId('bot_msg'),
    type: 'bot-message',
    text,
    time: new Date(),
    ...overrides,
  };
}

/**
 * Create a mock agent message
 */
export function createAgentMessage(
  text: string,
  agent: Partial<{ _id: string; name: string; email: string }> = {},
  overrides: Partial<AgentMessageRecord> = {}
): AgentMessageRecord {
  return {
    _id: generateId('agent_msg'),
    type: 'agent-message',
    text,
    agentDetails: {
      _id: agent._id || generateId('agent'),
      name: agent.name || 'Test Agent',
      email: agent.email || 'agent@test.com',
    },
    time: new Date(),
    ...overrides,
  };
}

/**
 * Create a mock agent
 */
export function createAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: generateId('agent'),
    name: 'Test Agent',
    email: 'agent@test.com',
    status: 'online',
    ...overrides,
  };
}

/**
 * Create a mock reaction
 */
export function createReaction(
  emoji: ReactionEmoji = '\uD83D\uDC4D' as ReactionEmoji,
  overrides: Partial<Reaction> = {}
): Reaction {
  return {
    emoji,
    userId: generateId('user'),
    userName: 'Test User',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a mock chatbot config
 */
export function createChatbotConfig(
  overrides: Partial<ChatbotConfig> = {}
): ChatbotConfig {
  return {
    id: generateId('bot'),
    name: 'Test Bot',
    description: 'A test chatbot',
    welcomeMessage: 'Hello! How can I help you?',
    features: {
      fileUpload: true,
      voiceMessage: false,
      typing: true,
      readReceipts: true,
      reactions: true,
    },
    ...overrides,
  };
}

/**
 * Create a mock chat session
 */
export function createChatSession(
  overrides: Partial<ChatSession> = {}
): ChatSession {
  const sessionId = generateId('session');
  return {
    id: sessionId,
    _id: sessionId,
    botId: generateId('bot'),
    chatSessionId: sessionId,
    isActive: true,
    record: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create a mock message status entry
 */
export function createMessageStatusEntry(
  status: MessageStatus = MessageStatus.SENT,
  overrides: Partial<MessageStatusEntry> = {}
): MessageStatusEntry {
  const now = new Date().toISOString();
  return {
    status,
    updatedAt: now,
    sentAt: now,
    deliveredAt: status === MessageStatus.DELIVERED || status === MessageStatus.READ ? now : undefined,
    readAt: status === MessageStatus.READ ? now : undefined,
    ...overrides,
  };
}

// ========================================
// NODE MOCK GENERATORS
// ========================================

/**
 * Create a mock node for testing handlers
 */
export function createNode(
  type: string,
  data: Record<string, any> = {},
  overrides: Record<string, any> = {}
): Record<string, any> {
  return {
    id: generateId('node'),
    type,
    data,
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

/**
 * Create a mock message node
 */
export function createMessageNode(
  text: string,
  overrides: Record<string, any> = {}
): Record<string, any> {
  return createNode('message-node', { text }, overrides);
}

/**
 * Create a mock image node
 */
export function createImageNode(
  url: string,
  caption?: string,
  overrides: Record<string, any> = {}
): Record<string, any> {
  return createNode('image-node', { url, caption }, overrides);
}

/**
 * Create a mock buttons node
 */
export function createButtonsNode(
  question: string,
  buttons: Array<{ label: string; value: string }>,
  overrides: Record<string, any> = {}
): Record<string, any> {
  return createNode('n-choices-node', { question, buttons }, overrides);
}

/**
 * Create a mock ask email node
 */
export function createAskEmailNode(
  question: string,
  variableName: string,
  overrides: Record<string, any> = {}
): Record<string, any> {
  return createNode('ask-email-node', { question, variableName }, overrides);
}

// ========================================
// SOCKET MOCK HELPERS
// ========================================

/**
 * Create a mock socket for testing
 */
export function createMockSocket() {
  const listeners = new Map<string, Set<(...args: any[]) => void>>();

  return {
    connected: false,
    id: 'mock-socket-id',

    on: jest.fn((event: string, callback: (...args: any[]) => void) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(callback);
    }),

    off: jest.fn((event: string, callback?: (...args: any[]) => void) => {
      if (callback) {
        listeners.get(event)?.delete(callback);
      } else {
        listeners.delete(event);
      }
    }),

    emit: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),

    // Matches SocketClient.emitToServer (used by node handlers).
    // Delegates to emit so tests can assert on either spy.
    emitToServer: jest.fn(function (this: any, event: string, payload: any) {
      this.emit(event, payload);
    }),

    // Helper to simulate receiving an event
    simulateEvent: (event: string, ...args: any[]) => {
      listeners.get(event)?.forEach((callback) => callback(...args));
    },

    // Helper to simulate connection
    simulateConnect: function() {
      this.connected = true;
      this.simulateEvent('connect');
    },

    // Helper to simulate disconnection
    simulateDisconnect: function(reason = 'io client disconnect') {
      this.connected = false;
      this.simulateEvent('disconnect', reason);
    },

    // Get all registered listeners
    getListeners: () => listeners,

    // Clear all mocks
    clearMocks: function() {
      this.on.mockClear();
      this.off.mockClear();
      this.emit.mockClear();
      listeners.clear();
    },
  };
}

// ========================================
// ASYNC TEST HELPERS
// ========================================

/**
 * Wait for all promises to resolve
 */
export async function flushPromises(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * Wait for a specific amount of time
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Advance timers and flush promises
 */
export async function advanceTimersAndFlush(ms: number): Promise<void> {
  jest.advanceTimersByTime(ms);
  await flushPromises();
}

// ========================================
// ASSERTION HELPERS
// ========================================

/**
 * Assert that a function throws an error with a specific message
 */
export async function expectToThrow(
  fn: () => Promise<any> | any,
  errorMessage?: string | RegExp
): Promise<void> {
  let error: Error | null = null;
  try {
    await fn();
  } catch (e) {
    error = e as Error;
  }
  expect(error).not.toBeNull();
  if (errorMessage) {
    if (typeof errorMessage === 'string') {
      expect(error?.message).toContain(errorMessage);
    } else {
      expect(error?.message).toMatch(errorMessage);
    }
  }
}

/**
 * Assert that a callback is called with specific arguments
 */
export function expectCalledWith(
  mockFn: jest.Mock,
  ...args: any[]
): void {
  expect(mockFn).toHaveBeenCalled();
  const lastCall = mockFn.mock.calls[mockFn.mock.calls.length - 1];
  args.forEach((arg, index) => {
    if (arg !== undefined) {
      expect(lastCall[index]).toEqual(arg);
    }
  });
}

// ========================================
// VALIDATION TEST DATA
// ========================================

export const validEmails = [
  'test@example.com',
  'user.name@domain.org',
  'user+tag@example.co.uk',
  'user@subdomain.example.com',
];

export const invalidEmails = [
  '',
  'notanemail',
  '@nodomain.com',
  'no@domain',
  'spaces in@email.com',
  'missing@.com',
];

export const validPhones = [
  '+1234567890',
  '123-456-7890',
  '(123) 456-7890',
  '+1 (555) 123-4567',
];

export const invalidPhones = [
  '',
  '123',
  '123456',
  'not-a-phone',
  '12345678901234567890', // too long
];

export const validUrls = [
  'https://example.com',
  'http://www.example.org',
  'https://subdomain.example.com/path',
  'example.com',
  'www.example.com/path?query=value',
];

export const invalidUrls = [
  '',
  'not a url',
  'http://',
  '://example.com',
];

// ========================================
// COMPONENT TEST HELPERS
// ========================================

/**
 * Create a wrapper for testing React components with providers
 */
export function createTestWrapper(options: {
  theme?: any;
  conferBot?: any;
}) {
  // This would be used with @testing-library/react-native
  // to wrap components with necessary providers
  return ({ children }: { children: React.ReactNode }) => children;
}

/**
 * Create mock theme for testing.
 * Uses the real default theme so every theme key components read
 * (colors, typography, spacing, shadows, animations, layout) is present.
 */
export function createMockTheme() {
  // Lazy require to avoid circular imports in some test setups
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { defaultTheme } = require('../src/theme/defaultTheme');
  return JSON.parse(JSON.stringify(defaultTheme));
}
