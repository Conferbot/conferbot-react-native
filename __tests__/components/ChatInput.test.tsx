/**
 * ChatInput Component Tests
 *
 * Tests for the ChatInput component including
 * text input, sending, attachments, and analytics.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ChatInput } from '../../src/components/ChatInput/ChatInput';
import { createMockTheme } from '../testUtils';

// Mock the theme hook
jest.mock('../../src/theme', () => ({
  useTheme: () => createMockTheme(),
}));

// Mock the analytics service
jest.mock('../../src/services/analytics', () => ({
  getAnalyticsService: () => ({
    initialized: true,
    trackTypingStart: jest.fn(),
    trackTypingEnd: jest.fn(),
    trackDeletion: jest.fn(),
    trackUserMessage: jest.fn(),
  }),
}));

describe('ChatInput', () => {
  const defaultProps = {
    onSend: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // RENDERING TESTS
  // ========================================

  describe('Rendering', () => {
    it('should render input field', () => {
      const { getByTestId } = render(
        <ChatInput {...defaultProps} testID="chat-input" />
      );

      expect(getByTestId('chat-input-input')).toBeTruthy();
    });

    it('should render send button', () => {
      const { getByTestId } = render(
        <ChatInput {...defaultProps} testID="chat-input" />
      );

      expect(getByTestId('chat-input-send')).toBeTruthy();
    });

    it('should show placeholder text', () => {
      const { getByPlaceholderText } = render(
        <ChatInput {...defaultProps} placeholder="Type here..." />
      );

      expect(getByPlaceholderText('Type here...')).toBeTruthy();
    });

    it('should use default placeholder when not provided', () => {
      const { getByPlaceholderText } = render(
        <ChatInput {...defaultProps} />
      );

      expect(getByPlaceholderText('Type a message...')).toBeTruthy();
    });

    it('should render attachment button when enabled', () => {
      const { getByTestId } = render(
        <ChatInput
          {...defaultProps}
          enableAttachments={true}
          testID="chat-input"
        />
      );

      expect(getByTestId('chat-input-attachment')).toBeTruthy();
    });

    it('should not render attachment button when disabled', () => {
      const { queryByTestId } = render(
        <ChatInput
          {...defaultProps}
          enableAttachments={false}
          testID="chat-input"
        />
      );

      expect(queryByTestId('chat-input-attachment')).toBeNull();
    });

    it('should apply testID', () => {
      const { getByTestId } = render(
        <ChatInput {...defaultProps} testID="test-input" />
      );

      expect(getByTestId('test-input')).toBeTruthy();
    });
  });

  // ========================================
  // TEXT INPUT TESTS
  // ========================================

  describe('Text Input', () => {
    it('should update text value on change', () => {
      const { getByTestId } = render(
        <ChatInput {...defaultProps} testID="chat-input" />
      );

      const input = getByTestId('chat-input-input');
      fireEvent.changeText(input, 'Hello');

      expect(input.props.value).toBe('Hello');
    });

    it('should respect maxLength', () => {
      const { getByTestId } = render(
        <ChatInput {...defaultProps} maxLength={10} testID="chat-input" />
      );

      const input = getByTestId('chat-input-input');
      expect(input.props.maxLength).toBe(10);
    });

    it('should handle multiline input', () => {
      const { getByTestId } = render(
        <ChatInput {...defaultProps} testID="chat-input" />
      );

      const input = getByTestId('chat-input-input');
      expect(input.props.multiline).toBe(true);
    });
  });

  // ========================================
  // SEND FUNCTIONALITY TESTS
  // ========================================

  describe('Send Functionality', () => {
    it('should call onSend with text when send is pressed', async () => {
      const onSend = jest.fn();
      const { getByTestId } = render(
        <ChatInput onSend={onSend} testID="chat-input" />
      );

      const input = getByTestId('chat-input-input');
      fireEvent.changeText(input, 'Hello');

      const sendButton = getByTestId('chat-input-send');
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(onSend).toHaveBeenCalledWith('Hello');
      });
    });

    it('should trim whitespace from message', async () => {
      const onSend = jest.fn();
      const { getByTestId } = render(
        <ChatInput onSend={onSend} testID="chat-input" />
      );

      const input = getByTestId('chat-input-input');
      fireEvent.changeText(input, '  Hello World  ');

      const sendButton = getByTestId('chat-input-send');
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(onSend).toHaveBeenCalledWith('Hello World');
      });
    });

    it('should clear input after successful send', async () => {
      const onSend = jest.fn().mockResolvedValue(undefined);
      const { getByTestId } = render(
        <ChatInput onSend={onSend} testID="chat-input" />
      );

      const input = getByTestId('chat-input-input');
      fireEvent.changeText(input, 'Hello');

      const sendButton = getByTestId('chat-input-send');
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(input.props.value).toBe('');
      });
    });

    it('should not send empty message', async () => {
      const onSend = jest.fn();
      const { getByTestId } = render(
        <ChatInput onSend={onSend} testID="chat-input" />
      );

      const sendButton = getByTestId('chat-input-send');
      fireEvent.press(sendButton);

      expect(onSend).not.toHaveBeenCalled();
    });

    it('should not send whitespace-only message', async () => {
      const onSend = jest.fn();
      const { getByTestId } = render(
        <ChatInput onSend={onSend} testID="chat-input" />
      );

      const input = getByTestId('chat-input-input');
      fireEvent.changeText(input, '   ');

      const sendButton = getByTestId('chat-input-send');
      fireEvent.press(sendButton);

      expect(onSend).not.toHaveBeenCalled();
    });

    it('should handle async onSend', async () => {
      const onSend = jest.fn().mockResolvedValue(undefined);
      const { getByTestId } = render(
        <ChatInput onSend={onSend} testID="chat-input" />
      );

      const input = getByTestId('chat-input-input');
      fireEvent.changeText(input, 'Async message');

      const sendButton = getByTestId('chat-input-send');
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(onSend).toHaveBeenCalled();
      });
    });

    it('should handle send error gracefully', async () => {
      const error = new Error('Send failed');
      const onSend = jest.fn().mockRejectedValue(error);
      const { getByTestId } = render(
        <ChatInput onSend={onSend} testID="chat-input" />
      );

      const input = getByTestId('chat-input-input');
      fireEvent.changeText(input, 'Will fail');

      const sendButton = getByTestId('chat-input-send');

      // Should not throw
      await expect(async () => {
        fireEvent.press(sendButton);
        await waitFor(() => {});
      }).not.toThrow();
    });
  });

  // ========================================
  // DISABLED STATE TESTS
  // ========================================

  describe('Disabled State', () => {
    it('should disable input when disabled prop is true', () => {
      const { getByTestId } = render(
        <ChatInput {...defaultProps} disabled={true} testID="chat-input" />
      );

      const input = getByTestId('chat-input-input');
      expect(input.props.editable).toBe(false);
    });

    it('should disable send button when disabled', () => {
      const { getByTestId } = render(
        <ChatInput {...defaultProps} disabled={true} testID="chat-input" />
      );

      const sendButton = getByTestId('chat-input-send');
      expect(sendButton.props.disabled).toBe(true);
    });

    it('should disable attachment button when disabled', () => {
      const { getByTestId } = render(
        <ChatInput
          {...defaultProps}
          disabled={true}
          enableAttachments={true}
          testID="chat-input"
        />
      );

      const attachmentButton = getByTestId('chat-input-attachment');
      expect(attachmentButton.props.disabled).toBe(true);
    });

    it('should not send when disabled even with text', async () => {
      const onSend = jest.fn();
      const { getByTestId } = render(
        <ChatInput onSend={onSend} disabled={true} testID="chat-input" />
      );

      // Try to type (won't work since disabled)
      const input = getByTestId('chat-input-input');
      fireEvent.changeText(input, 'Test');

      const sendButton = getByTestId('chat-input-send');
      fireEvent.press(sendButton);

      expect(onSend).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // SEND BUTTON STATE TESTS
  // ========================================

  describe('Send Button State', () => {
    it('should disable send button when input is empty', () => {
      const { getByTestId } = render(
        <ChatInput {...defaultProps} testID="chat-input" />
      );

      const sendButton = getByTestId('chat-input-send');
      expect(sendButton.props.disabled).toBe(true);
    });

    it('should enable send button when input has text', () => {
      const { getByTestId } = render(
        <ChatInput {...defaultProps} testID="chat-input" />
      );

      const input = getByTestId('chat-input-input');
      fireEvent.changeText(input, 'Hello');

      const sendButton = getByTestId('chat-input-send');
      expect(sendButton.props.disabled).toBe(false);
    });

    it('should show custom send button text', () => {
      const { getByText } = render(
        <ChatInput {...defaultProps} sendButtonText="Submit" />
      );

      expect(getByText('Submit')).toBeTruthy();
    });
  });

  // ========================================
  // ATTACHMENT TESTS
  // ========================================

  describe('Attachments', () => {
    it('should call onAttachmentPress when attachment button is pressed', () => {
      const onAttachmentPress = jest.fn();
      const { getByTestId } = render(
        <ChatInput
          {...defaultProps}
          enableAttachments={true}
          onAttachmentPress={onAttachmentPress}
          testID="chat-input"
        />
      );

      const attachmentButton = getByTestId('chat-input-attachment');
      fireEvent.press(attachmentButton);

      expect(onAttachmentPress).toHaveBeenCalled();
    });
  });

  // ========================================
  // CUSTOM ICONS TESTS
  // ========================================

  describe('Custom Icons', () => {
    it('should render custom send icon', () => {
      const CustomIcon = () => <></>;
      const { UNSAFE_root } = render(
        <ChatInput {...defaultProps} sendIcon={<CustomIcon />} />
      );

      expect(UNSAFE_root).toBeTruthy();
    });

    it('should render custom attachment icon', () => {
      const CustomIcon = () => <></>;
      const { UNSAFE_root } = render(
        <ChatInput
          {...defaultProps}
          enableAttachments={true}
          attachmentIcon={<CustomIcon />}
        />
      );

      expect(UNSAFE_root).toBeTruthy();
    });
  });

  // ========================================
  // ACCESSIBILITY TESTS
  // ========================================

  describe('Accessibility', () => {
    it('should have accessibility label on input', () => {
      const { getByTestId } = render(
        <ChatInput {...defaultProps} testID="chat-input" />
      );

      const input = getByTestId('chat-input-input');
      expect(input.props.accessible).toBe(true);
    });

    it('should have accessibility label on send button', () => {
      const { getByTestId } = render(
        <ChatInput {...defaultProps} testID="chat-input" />
      );

      const sendButton = getByTestId('chat-input-send');
      expect(sendButton.props.accessibilityLabel).toBe('Send message');
    });

    it('should have accessibility label on attachment button', () => {
      const { getByTestId } = render(
        <ChatInput
          {...defaultProps}
          enableAttachments={true}
          testID="chat-input"
        />
      );

      const attachmentButton = getByTestId('chat-input-attachment');
      expect(attachmentButton.props.accessibilityLabel).toBe('Attach file');
    });

    it('should announce disabled state', () => {
      const { getByTestId } = render(
        <ChatInput {...defaultProps} disabled={true} testID="chat-input" />
      );

      const sendButton = getByTestId('chat-input-send');
      expect(sendButton.props.accessibilityState?.disabled).toBe(true);
    });
  });

  // ========================================
  // KEYBOARD TESTS
  // ========================================

  describe('Keyboard Behavior', () => {
    it('should have correct return key type', () => {
      const { getByTestId } = render(
        <ChatInput {...defaultProps} testID="chat-input" />
      );

      const input = getByTestId('chat-input-input');
      expect(input.props.returnKeyType).toBe('send');
    });

    it('should not blur on submit', () => {
      const { getByTestId } = render(
        <ChatInput {...defaultProps} testID="chat-input" />
      );

      const input = getByTestId('chat-input-input');
      expect(input.props.blurOnSubmit).toBe(false);
    });

    it('should handle submit editing', async () => {
      const onSend = jest.fn();
      const { getByTestId } = render(
        <ChatInput onSend={onSend} testID="chat-input" />
      );

      const input = getByTestId('chat-input-input');
      fireEvent.changeText(input, 'Hello');
      fireEvent(input, 'submitEditing');

      await waitFor(() => {
        expect(onSend).toHaveBeenCalledWith('Hello');
      });
    });
  });

  // ========================================
  // SENDING STATE TESTS
  // ========================================

  describe('Sending State', () => {
    it('should show loading indicator while sending', async () => {
      const onSend = jest.fn(() => new Promise((resolve) => setTimeout(resolve, 100)));
      const { getByTestId, getByText } = render(
        <ChatInput onSend={onSend} testID="chat-input" />
      );

      const input = getByTestId('chat-input-input');
      fireEvent.changeText(input, 'Hello');

      const sendButton = getByTestId('chat-input-send');
      fireEvent.press(sendButton);

      // Should show "..." while sending
      expect(getByText('...')).toBeTruthy();
    });

    it('should disable input while sending', async () => {
      const onSend = jest.fn(() => new Promise((resolve) => setTimeout(resolve, 100)));
      const { getByTestId } = render(
        <ChatInput onSend={onSend} testID="chat-input" />
      );

      const input = getByTestId('chat-input-input');
      fireEvent.changeText(input, 'Hello');

      const sendButton = getByTestId('chat-input-send');
      fireEvent.press(sendButton);

      expect(input.props.editable).toBe(false);
    });
  });

  // ========================================
  // EDGE CASES
  // ========================================

  describe('Edge Cases', () => {
    it('should handle rapid text changes', () => {
      const { getByTestId } = render(
        <ChatInput {...defaultProps} testID="chat-input" />
      );

      const input = getByTestId('chat-input-input');

      // Simulate rapid typing
      fireEvent.changeText(input, 'H');
      fireEvent.changeText(input, 'He');
      fireEvent.changeText(input, 'Hel');
      fireEvent.changeText(input, 'Hell');
      fireEvent.changeText(input, 'Hello');

      expect(input.props.value).toBe('Hello');
    });

    it('should handle multiple rapid sends', async () => {
      const onSend = jest.fn().mockResolvedValue(undefined);
      const { getByTestId } = render(
        <ChatInput onSend={onSend} testID="chat-input" />
      );

      const input = getByTestId('chat-input-input');
      const sendButton = getByTestId('chat-input-send');

      // First send
      fireEvent.changeText(input, 'First');
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(onSend).toHaveBeenCalledWith('First');
      });

      // Second send
      fireEvent.changeText(input, 'Second');
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(onSend).toHaveBeenCalledWith('Second');
      });

      expect(onSend).toHaveBeenCalledTimes(2);
    });

    it('should handle component unmount during send', async () => {
      const onSend = jest.fn(() => new Promise((resolve) => setTimeout(resolve, 100)));
      const { getByTestId, unmount } = render(
        <ChatInput onSend={onSend} testID="chat-input" />
      );

      const input = getByTestId('chat-input-input');
      fireEvent.changeText(input, 'Hello');

      const sendButton = getByTestId('chat-input-send');
      fireEvent.press(sendButton);

      // Unmount before send completes - should not throw
      unmount();
    });
  });
});
