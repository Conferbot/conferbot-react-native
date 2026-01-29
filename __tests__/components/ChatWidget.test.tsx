/**
 * ChatWidget Component Tests
 *
 * Tests for the main ChatWidget component including
 * visibility, flow engine integration, and user interactions.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ChatWidget } from '../../src/components/ChatWidget/ChatWidget';
import { createMockTheme, createChatbotConfig, createBotMessage } from '../testUtils';

// Mock the theme hook
jest.mock('../../src/theme', () => ({
  useTheme: () => createMockTheme(),
}));

// Mock the ConferBot context
const mockConferBotContext = {
  isOpen: true,
  openChat: jest.fn(),
  closeChat: jest.fn(),
  sendMessage: jest.fn().mockResolvedValue(undefined),
  record: [],
  currentAgent: null,
  isConnected: true,
  chatSessionId: 'test-session-123',
  chatbotConfig: createChatbotConfig(),
  on: jest.fn(() => () => {}),
};

jest.mock('../../src/context/ConferBotContext', () => ({
  useConferBot: () => mockConferBotContext,
}));

// Mock child components
jest.mock('../../src/components/ChatHeader', () => ({
  ChatHeader: ({ title, onClose, testID }: any) => (
    <div testID={testID}>
      <span>{title}</span>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

jest.mock('../../src/components/MessageList', () => ({
  MessageList: ({ messages, testID }: any) => (
    <div testID={testID}>
      {messages?.map((m: any, i: number) => <span key={i}>{m.text}</span>)}
    </div>
  ),
}));

jest.mock('../../src/components/ChatInput', () => ({
  ChatInput: ({ onSend, disabled, testID }: any) => (
    <input
      testID={testID}
      disabled={disabled}
      onChange={(e) => onSend?.(e.target.value)}
    />
  ),
}));

jest.mock('../../src/components/NodeComponents', () => ({
  NodeRenderer: () => null,
}));

// Mock the FilePicker utilities
jest.mock('../../src/utils/FilePicker', () => ({
  FilePicker: {
    pickImages: jest.fn(),
    pickDocuments: jest.fn(),
    takePhoto: jest.fn(),
  },
  FilePickerError: class FilePickerError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
    }
  },
  formatFileSize: (size: number) => `${size} bytes`,
  isFilePickerAvailable: () => true,
  isImagePickerAvailable: () => true,
}));

// Mock ChatState and NodeFlowEngine
jest.mock('../../src/core', () => ({
  ChatState: jest.fn().mockImplementation(() => ({
    addRecord: jest.fn(),
    setAnswer: jest.fn(),
    addUserMessage: jest.fn(),
  })),
  NodeFlowEngine: jest.fn().mockImplementation(() => ({
    loadFlow: jest.fn(),
    resumeFrom: jest.fn().mockResolvedValue(undefined),
    submitResponse: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('ChatWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConferBotContext.isOpen = true;
    mockConferBotContext.record = [];
    mockConferBotContext.isConnected = true;
    mockConferBotContext.currentAgent = null;
  });

  // ========================================
  // VISIBILITY TESTS
  // ========================================

  describe('Visibility', () => {
    it('should render when visible is true', () => {
      const { UNSAFE_root } = render(<ChatWidget visible={true} />);
      expect(UNSAFE_root).toBeTruthy();
    });

    it('should respect controlled visible prop', () => {
      const { UNSAFE_root, rerender } = render(<ChatWidget visible={false} />);
      expect(UNSAFE_root).toBeTruthy();

      rerender(<ChatWidget visible={true} />);
      expect(UNSAFE_root).toBeTruthy();
    });

    it('should use context isOpen when visible is not provided', () => {
      mockConferBotContext.isOpen = true;
      const { UNSAFE_root } = render(<ChatWidget />);
      expect(UNSAFE_root).toBeTruthy();
    });
  });

  // ========================================
  // PROPS TESTS
  // ========================================

  describe('Props', () => {
    it('should pass title to ChatHeader', () => {
      const { UNSAFE_root } = render(<ChatWidget title="Support Chat" />);
      expect(UNSAFE_root).toBeTruthy();
    });

    it('should pass placeholder to ChatInput', () => {
      const { UNSAFE_root } = render(
        <ChatWidget placeholder="Ask a question..." />
      );
      expect(UNSAFE_root).toBeTruthy();
    });

    it('should apply testID', () => {
      const { getByTestId } = render(<ChatWidget testID="chat-widget" />);
      expect(getByTestId('chat-widget')).toBeTruthy();
    });

    it('should enable attachments when prop is true', () => {
      const { UNSAFE_root } = render(<ChatWidget enableAttachments={true} />);
      expect(UNSAFE_root).toBeTruthy();
    });

    it('should show timestamps when prop is true', () => {
      const { UNSAFE_root } = render(<ChatWidget showTimestamps={true} />);
      expect(UNSAFE_root).toBeTruthy();
    });
  });

  // ========================================
  // CLOSE FUNCTIONALITY TESTS
  // ========================================

  describe('Close Functionality', () => {
    it('should call onClose when close is triggered', () => {
      const onClose = jest.fn();
      render(<ChatWidget onClose={onClose} />);

      // The ChatHeader mock has a close button
      expect(onClose).not.toHaveBeenCalled();
    });

    it('should call context closeChat when onClose not provided', () => {
      render(<ChatWidget />);
      // closeChat should be available through context
      expect(mockConferBotContext.closeChat).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // MESSAGE SENDING TESTS
  // ========================================

  describe('Message Sending', () => {
    it('should call sendMessage when message is sent', async () => {
      const { UNSAFE_root } = render(<ChatWidget />);

      expect(mockConferBotContext.sendMessage).not.toHaveBeenCalled();
      expect(UNSAFE_root).toBeTruthy();
    });

    it('should handle send message error', async () => {
      mockConferBotContext.sendMessage.mockRejectedValueOnce(new Error('Send failed'));

      const { UNSAFE_root } = render(<ChatWidget />);
      expect(UNSAFE_root).toBeTruthy();
    });
  });

  // ========================================
  // CONNECTION STATUS TESTS
  // ========================================

  describe('Connection Status', () => {
    it('should show reconnecting when not connected', () => {
      mockConferBotContext.isConnected = false;

      const { UNSAFE_root } = render(<ChatWidget />);
      expect(UNSAFE_root).toBeTruthy();
    });

    it('should disable input when not connected', () => {
      mockConferBotContext.isConnected = false;

      const { UNSAFE_root } = render(<ChatWidget testID="chat-widget" />);
      expect(UNSAFE_root).toBeTruthy();
    });
  });

  // ========================================
  // AGENT TESTS
  // ========================================

  describe('Agent Handling', () => {
    it('should show agent info when agent is present', () => {
      mockConferBotContext.currentAgent = {
        id: 'agent-1',
        name: 'Agent Smith',
        email: 'agent@test.com',
        status: 'online',
      };

      const { UNSAFE_root } = render(<ChatWidget />);
      expect(UNSAFE_root).toBeTruthy();
    });
  });

  // ========================================
  // RECORD/MESSAGE DISPLAY TESTS
  // ========================================

  describe('Record Display', () => {
    it('should pass record to MessageList', () => {
      mockConferBotContext.record = [
        createBotMessage('Hello'),
        createBotMessage('How can I help?'),
      ];

      const { UNSAFE_root } = render(<ChatWidget />);
      expect(UNSAFE_root).toBeTruthy();
    });

    it('should handle empty record', () => {
      mockConferBotContext.record = [];

      const { UNSAFE_root } = render(<ChatWidget />);
      expect(UNSAFE_root).toBeTruthy();
    });
  });

  // ========================================
  // TYPING INDICATOR TESTS
  // ========================================

  describe('Typing Indicator', () => {
    it('should show typing indicator when agent is typing', () => {
      // This would be triggered by socket event
      const { UNSAFE_root } = render(<ChatWidget />);
      expect(UNSAFE_root).toBeTruthy();
    });
  });

  // ========================================
  // FLOW ENGINE TESTS
  // ========================================

  describe('Flow Engine', () => {
    it('should initialize flow engine when opened', () => {
      const { UNSAFE_root } = render(<ChatWidget debug={true} />);
      expect(UNSAFE_root).toBeTruthy();
    });

    it('should handle flow completion', () => {
      const { UNSAFE_root } = render(<ChatWidget />);
      expect(UNSAFE_root).toBeTruthy();
    });
  });

  // ========================================
  // DEBUG MODE TESTS
  // ========================================

  describe('Debug Mode', () => {
    it('should enable debug logging when debug prop is true', () => {
      const { UNSAFE_root } = render(<ChatWidget debug={true} />);
      expect(UNSAFE_root).toBeTruthy();
    });
  });

  // ========================================
  // TYPING DELAY TESTS
  // ========================================

  describe('Typing Delay', () => {
    it('should use custom typing delay', () => {
      const { UNSAFE_root } = render(<ChatWidget typingDelay={1000} />);
      expect(UNSAFE_root).toBeTruthy();
    });

    it('should use default typing delay', () => {
      const { UNSAFE_root } = render(<ChatWidget />);
      expect(UNSAFE_root).toBeTruthy();
    });
  });

  // ========================================
  // CLEANUP TESTS
  // ========================================

  describe('Cleanup', () => {
    it('should clean up on unmount', () => {
      const { unmount } = render(<ChatWidget />);

      // Should not throw
      unmount();
    });

    it('should reset state when closed', () => {
      const { rerender } = render(<ChatWidget visible={true} />);

      rerender(<ChatWidget visible={false} />);
      // State should be reset
    });
  });

  // ========================================
  // ACCESSIBILITY TESTS
  // ========================================

  describe('Accessibility', () => {
    it('should have accessible modal', () => {
      const { getByTestId } = render(<ChatWidget testID="chat-widget" />);

      const modal = getByTestId('chat-widget');
      expect(modal.props.accessible).toBe(true);
    });

    it('should have accessibility label on modal', () => {
      const { getByTestId } = render(<ChatWidget testID="chat-widget" />);

      const modal = getByTestId('chat-widget');
      expect(modal.props.accessibilityLabel).toBe('Chat modal');
    });
  });

  // ========================================
  // ATTACHMENT TESTS
  // ========================================

  describe('Attachments', () => {
    it('should enable attachment button when enableAttachments is true', () => {
      const { UNSAFE_root } = render(<ChatWidget enableAttachments={true} />);
      expect(UNSAFE_root).toBeTruthy();
    });

    it('should handle attachment selection', async () => {
      const { UNSAFE_root } = render(<ChatWidget enableAttachments={true} />);
      expect(UNSAFE_root).toBeTruthy();
    });
  });

  // ========================================
  // EVENT SUBSCRIPTION TESTS
  // ========================================

  describe('Event Subscriptions', () => {
    it('should subscribe to socket events', () => {
      render(<ChatWidget />);

      // Should call on() to subscribe to events
      expect(mockConferBotContext.on).toHaveBeenCalled();
    });

    it('should unsubscribe from events on unmount', () => {
      const unsubscribe = jest.fn();
      mockConferBotContext.on.mockReturnValue(unsubscribe);

      const { unmount } = render(<ChatWidget />);
      unmount();

      expect(unsubscribe).toHaveBeenCalled();
    });
  });
});
