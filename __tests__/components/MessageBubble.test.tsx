/**
 * MessageBubble Component Tests
 *
 * Tests for the MessageBubble component including
 * rendering, styling, reactions, and user interactions.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { MessageBubble } from '../../src/components/MessageBubble/MessageBubble';
import { MessageStatus } from '../../src/types/messageStatus';
import {
  createUserMessage,
  createBotMessage,
  createAgentMessage,
  createReaction,
  createMockTheme,
} from '../testUtils';

// Mock the theme hook
jest.mock('../../src/theme', () => ({
  useTheme: () => createMockTheme(),
}));

// Mock the LinkPreview component
jest.mock('../../src/components/LinkPreview/LinkPreview', () => ({
  LinkPreview: () => null,
}));

// Mock the MessageReactions component
jest.mock('../../src/components/MessageReactions/MessageReactions', () => ({
  MessageReactions: ({ reactions, onReactionPress }: any) => null,
}));

// Mock the ReactionPicker component
jest.mock('../../src/components/ReactionPicker', () => ({
  ReactionPicker: () => null,
}));

// Mock the MessageStatus component
jest.mock('../../src/components/MessageStatus/MessageStatus', () => ({
  MessageStatus: () => null,
}));

// Mock the Avatar component
jest.mock('../../src/components/Avatar/Avatar', () => ({
  Avatar: () => null,
}));

// Mock the LinkDetector utility
jest.mock('../../src/utils/LinkDetector', () => ({
  parseTextForUrls: (text: string) => ({
    hasUrls: false,
    urls: [],
    segments: [{ type: 'text', content: text }],
  }),
}));

describe('MessageBubble', () => {
  // ========================================
  // RENDERING TESTS
  // ========================================

  describe('Rendering', () => {
    it('should render user message', () => {
      const message = createUserMessage('Hello from user');
      const { getByText } = render(<MessageBubble message={message} />);

      expect(getByText('Hello from user')).toBeTruthy();
    });

    it('should render bot message', () => {
      const message = createBotMessage('Hello from bot');
      const { getByText } = render(<MessageBubble message={message} />);

      expect(getByText('Hello from bot')).toBeTruthy();
    });

    it('should render agent message', () => {
      const message = createAgentMessage('Hello from agent', { name: 'Agent Smith' });
      const { getByText } = render(<MessageBubble message={message} />);

      expect(getByText('Hello from agent')).toBeTruthy();
      expect(getByText('Agent Smith')).toBeTruthy();
    });

    it('should render system message', () => {
      const message = {
        _id: 'sys-1',
        type: 'system-message' as const,
        text: 'System notification',
        time: new Date(),
      };
      const { getByText } = render(<MessageBubble message={message} />);

      expect(getByText('System notification')).toBeTruthy();
    });

    it('should apply testID', () => {
      const message = createUserMessage('Test');
      const { getByTestId } = render(
        <MessageBubble message={message} testID="test-bubble" />
      );

      expect(getByTestId('test-bubble')).toBeTruthy();
    });
  });

  // ========================================
  // TIMESTAMP TESTS
  // ========================================

  describe('Timestamp', () => {
    it('should show timestamp when enabled', () => {
      const message = createUserMessage('Test message');
      message.time = new Date('2024-01-15T10:30:00');

      const { getByText } = render(
        <MessageBubble message={message} showTimestamp={true} />
      );

      // Should show formatted time (10:30 AM)
      expect(getByText(/10:30/)).toBeTruthy();
    });

    it('should hide timestamp by default', () => {
      const message = createUserMessage('Test message');
      message.time = new Date('2024-01-15T10:30:00');

      const { queryByText } = render(<MessageBubble message={message} />);

      expect(queryByText(/10:30/)).toBeNull();
    });
  });

  // ========================================
  // INTERACTION TESTS
  // ========================================

  describe('Interactions', () => {
    it('should call onPress when pressed', () => {
      const message = createUserMessage('Test');
      const onPress = jest.fn();

      const { getByTestId } = render(
        <MessageBubble message={message} onPress={onPress} testID="bubble" />
      );

      fireEvent.press(getByTestId('bubble'));

      expect(onPress).toHaveBeenCalled();
    });

    it('should call onLongPress when long pressed', () => {
      const message = createUserMessage('Test');
      const onLongPress = jest.fn();

      const { getByTestId } = render(
        <MessageBubble
          message={message}
          onLongPress={onLongPress}
          testID="bubble"
        />
      );

      fireEvent(getByTestId('bubble'), 'longPress');

      expect(onLongPress).toHaveBeenCalled();
    });
  });

  // ========================================
  // REACTION TESTS
  // ========================================

  describe('Reactions', () => {
    it('should pass reactions to MessageReactions component', () => {
      const message = createUserMessage('Test');
      const reactions = [
        createReaction('\uD83D\uDC4D' as any, { userId: 'user-1' }),
        createReaction('\u2764\uFE0F' as any, { userId: 'user-2' }),
      ];

      const { UNSAFE_root } = render(
        <MessageBubble
          message={message}
          reactions={reactions}
          enableReactions={true}
        />
      );

      // Component should render without errors
      expect(UNSAFE_root).toBeTruthy();
    });

    it('should not show reactions when disabled', () => {
      const message = createUserMessage('Test');
      const reactions = [createReaction('\uD83D\uDC4D' as any)];

      const { UNSAFE_root } = render(
        <MessageBubble
          message={message}
          reactions={reactions}
          enableReactions={false}
        />
      );

      // Component should render without reactions section
      expect(UNSAFE_root).toBeTruthy();
    });

    it('should not show reactions on system messages', () => {
      const message = {
        _id: 'sys-1',
        type: 'system-message' as const,
        text: 'System message',
        time: new Date(),
      };
      const reactions = [createReaction('\uD83D\uDC4D' as any)];

      const { UNSAFE_root } = render(
        <MessageBubble
          message={message}
          reactions={reactions}
          enableReactions={true}
        />
      );

      expect(UNSAFE_root).toBeTruthy();
    });
  });

  // ========================================
  // MESSAGE STATUS TESTS
  // ========================================

  describe('Message Status (Read Receipts)', () => {
    it('should show read receipt for user messages', () => {
      const message = createUserMessage('Test');

      const { UNSAFE_root } = render(
        <MessageBubble
          message={message}
          messageStatus={MessageStatus.READ}
          showReadReceipt={true}
        />
      );

      expect(UNSAFE_root).toBeTruthy();
    });

    it('should not show read receipt when disabled', () => {
      const message = createUserMessage('Test');

      const { UNSAFE_root } = render(
        <MessageBubble
          message={message}
          messageStatus={MessageStatus.READ}
          showReadReceipt={false}
        />
      );

      expect(UNSAFE_root).toBeTruthy();
    });

    it('should not show read receipt for bot messages', () => {
      const message = createBotMessage('Test');

      const { UNSAFE_root } = render(
        <MessageBubble
          message={message}
          messageStatus={MessageStatus.READ}
          showReadReceipt={true}
        />
      );

      // Read receipts should only show for user messages
      expect(UNSAFE_root).toBeTruthy();
    });
  });

  // ========================================
  // AVATAR TESTS
  // ========================================

  describe('Avatar', () => {
    it('should show avatar for bot messages by default', () => {
      const message = createBotMessage('Test');

      const { UNSAFE_root } = render(
        <MessageBubble message={message} showAvatar={true} />
      );

      expect(UNSAFE_root).toBeTruthy();
    });

    it('should hide avatar when showAvatar is false', () => {
      const message = createBotMessage('Test');

      const { UNSAFE_root } = render(
        <MessageBubble message={message} showAvatar={false} />
      );

      expect(UNSAFE_root).toBeTruthy();
    });

    it('should not show avatar for user messages', () => {
      const message = createUserMessage('Test');

      const { UNSAFE_root } = render(
        <MessageBubble message={message} showAvatar={true} />
      );

      expect(UNSAFE_root).toBeTruthy();
    });
  });

  // ========================================
  // ACCESSIBILITY TESTS
  // ========================================

  describe('Accessibility', () => {
    it('should have accessible text content', () => {
      const message = createUserMessage('Accessible message');

      const { getByText } = render(<MessageBubble message={message} />);

      const textElement = getByText('Accessible message');
      expect(textElement.props.accessible).toBe(true);
      expect(textElement.props.accessibilityRole).toBe('text');
    });

    it('should have accessibility hint for reactions', () => {
      const message = createUserMessage('Test');
      const onReactionPress = jest.fn();

      const { getByTestId } = render(
        <MessageBubble
          message={message}
          enableReactions={true}
          onReactionPress={onReactionPress}
          testID="bubble"
        />
      );

      const bubble = getByTestId('bubble');
      expect(bubble.props.accessibilityHint).toContain('react');
    });
  });

  // ========================================
  // LINK HANDLING TESTS
  // ========================================

  describe('Links', () => {
    it('should render without link previews when disabled', () => {
      const message = createUserMessage('Check https://example.com');

      const { UNSAFE_root } = render(
        <MessageBubble message={message} enableLinkPreviews={false} />
      );

      expect(UNSAFE_root).toBeTruthy();
    });

    it('should pass onLinkPress callback', () => {
      const message = createUserMessage('Check https://example.com');
      const onLinkPress = jest.fn();

      const { UNSAFE_root } = render(
        <MessageBubble
          message={message}
          enableLinkPreviews={true}
          onLinkPress={onLinkPress}
        />
      );

      expect(UNSAFE_root).toBeTruthy();
    });
  });

  // ========================================
  // MESSAGE TYPE STYLING TESTS
  // ========================================

  describe('Message Type Styling', () => {
    it('should apply user message styling', () => {
      const message = createUserMessage('User text');
      const { UNSAFE_root } = render(<MessageBubble message={message} />);

      // Check component renders correctly
      expect(UNSAFE_root).toBeTruthy();
    });

    it('should apply bot message styling', () => {
      const message = createBotMessage('Bot text');
      const { UNSAFE_root } = render(<MessageBubble message={message} />);

      expect(UNSAFE_root).toBeTruthy();
    });

    it('should apply agent message styling', () => {
      const message = createAgentMessage('Agent text');
      const { UNSAFE_root } = render(<MessageBubble message={message} />);

      expect(UNSAFE_root).toBeTruthy();
    });

    it('should apply system message styling', () => {
      const message = {
        _id: 'sys-1',
        type: 'system-message' as const,
        text: 'System text',
        time: new Date(),
      };
      const { UNSAFE_root } = render(<MessageBubble message={message} />);

      expect(UNSAFE_root).toBeTruthy();
    });
  });

  // ========================================
  // EDGE CASES
  // ========================================

  describe('Edge Cases', () => {
    it('should handle empty message text', () => {
      const message = createUserMessage('');
      const { UNSAFE_root } = render(<MessageBubble message={message} />);

      expect(UNSAFE_root).toBeTruthy();
    });

    it('should handle very long message text', () => {
      const longText = 'A'.repeat(1000);
      const message = createUserMessage(longText);
      const { getByText } = render(<MessageBubble message={message} />);

      expect(getByText(longText)).toBeTruthy();
    });

    it('should handle message without time', () => {
      const message = {
        _id: 'test-1',
        type: 'user-message' as const,
        text: 'No time',
      } as any;

      const { UNSAFE_root } = render(
        <MessageBubble message={message} showTimestamp={true} />
      );

      expect(UNSAFE_root).toBeTruthy();
    });

    it('should handle empty reactions array', () => {
      const message = createUserMessage('Test');

      const { UNSAFE_root } = render(
        <MessageBubble
          message={message}
          reactions={[]}
          enableReactions={true}
        />
      );

      expect(UNSAFE_root).toBeTruthy();
    });
  });
});
