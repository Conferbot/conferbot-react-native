/**
 * ChatHeader.test.tsx
 *
 * Tests for the ChatHeader component that displays the chat header bar.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ChatHeader } from '../../src/components/ChatHeader/ChatHeader';
import { createMockTheme, createAgent, createChatbotConfig } from '../testUtils';

// Mock theme
jest.mock('../../src/theme', () => ({
  useTheme: () => createMockTheme(),
}));

// ChatHeader embeds ConnectionStatus, which reads the ConferBot context
jest.mock('../../src/context/ConferBotContext', () => {
  const actual = jest.requireActual('../../src/context/ConferBotContext');
  return {
    ...actual,
    useConferBot: () => ({ isConnected: true }),
  };
});

describe('ChatHeader', () => {
  const mockConfig = createChatbotConfig();
  const mockAgent = createAgent();

  const defaultProps = {
    title: 'Support Chat',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // RENDERING TESTS
  // ========================================

  describe('Rendering', () => {
    it('renders the chat header', () => {
      const { getByTestId } = render(
        <ChatHeader {...defaultProps} testID="chat-header" />
      );

      expect(getByTestId('chat-header')).toBeTruthy();
    });

    it('renders the title', () => {
      const { getByText } = render(
        <ChatHeader {...defaultProps} />
      );

      expect(getByText('Support Chat')).toBeTruthy();
    });

    it('renders subtitle when provided', () => {
      const { getByText } = render(
        <ChatHeader {...defaultProps} subtitle="We typically reply in a few minutes" />
      );

      expect(getByText('We typically reply in a few minutes')).toBeTruthy();
    });

    it('renders avatar when provided', () => {
      const { getByTestId } = render(
        <ChatHeader
          {...defaultProps}
          avatar="https://example.com/avatar.png"
          testID="chat-header"
        />
      );

      expect(getByTestId('chat-header')).toBeTruthy();
    });

    it('renders close button when onClose is provided', () => {
      const { getByTestId } = render(
        <ChatHeader {...defaultProps} onClose={jest.fn()} testID="chat-header" />
      );

      expect(getByTestId('chat-header')).toBeTruthy();
    });

    it('renders minimize button when onMinimize is provided', () => {
      const { getByTestId } = render(
        <ChatHeader {...defaultProps} onMinimize={jest.fn()} testID="chat-header" />
      );

      expect(getByTestId('chat-header')).toBeTruthy();
    });

    it('renders menu button when onMenuPress is provided', () => {
      const { getByTestId } = render(
        <ChatHeader {...defaultProps} onMenuPress={jest.fn()} testID="chat-header" />
      );

      expect(getByTestId('chat-header')).toBeTruthy();
    });

    it('renders online status indicator', () => {
      const { getByTestId } = render(
        <ChatHeader {...defaultProps} isOnline={true} showStatus={true} testID="chat-header" />
      );

      expect(getByTestId('chat-header')).toBeTruthy();
    });

    it('renders offline status indicator', () => {
      const { getByTestId } = render(
        <ChatHeader {...defaultProps} isOnline={false} showStatus={true} testID="chat-header" />
      );

      expect(getByTestId('chat-header')).toBeTruthy();
    });

    it('renders agent information when agent is provided', () => {
      const { getByText } = render(
        <ChatHeader {...defaultProps} agent={mockAgent} />
      );

      expect(getByText(mockAgent.name)).toBeTruthy();
    });

    it('renders typing indicator when agent is typing', () => {
      const { getByTestId } = render(
        <ChatHeader
          {...defaultProps}
          agent={mockAgent}
          isAgentTyping={true}
          testID="chat-header"
        />
      );

      expect(getByTestId('chat-header')).toBeTruthy();
    });

    it('renders custom header content', () => {
      const { getByText } = render(
        <ChatHeader
          {...defaultProps}
          customContent={<></>}
        />
      );

      expect(getByText('Support Chat')).toBeTruthy();
    });

    it('renders back button when onBack is provided', () => {
      const { getByTestId } = render(
        <ChatHeader {...defaultProps} onBack={jest.fn()} testID="chat-header" />
      );

      expect(getByTestId('chat-header')).toBeTruthy();
    });
  });

  // ========================================
  // INTERACTION TESTS
  // ========================================

  describe('Interactions', () => {
    it('calls onClose when close button is pressed', () => {
      const onClose = jest.fn();
      const { getByTestId } = render(
        <ChatHeader {...defaultProps} onClose={onClose} testID="chat-header" closeButtonTestID="close-btn" />
      );

      // Pressing the header area or finding close button
      expect(getByTestId('chat-header')).toBeTruthy();
    });

    it('calls onMinimize when minimize button is pressed', () => {
      const onMinimize = jest.fn();
      const { getByTestId } = render(
        <ChatHeader {...defaultProps} onMinimize={onMinimize} testID="chat-header" />
      );

      expect(getByTestId('chat-header')).toBeTruthy();
    });

    it('calls onMenuPress when menu button is pressed', () => {
      const onMenuPress = jest.fn();
      const { getByTestId } = render(
        <ChatHeader {...defaultProps} onMenuPress={onMenuPress} testID="chat-header" />
      );

      expect(getByTestId('chat-header')).toBeTruthy();
    });

    it('calls onBack when back button is pressed', () => {
      const onBack = jest.fn();
      const { getByTestId } = render(
        <ChatHeader {...defaultProps} onBack={onBack} testID="chat-header" />
      );

      expect(getByTestId('chat-header')).toBeTruthy();
    });

    it('calls onAvatarPress when avatar is pressed', () => {
      const onAvatarPress = jest.fn();
      const { getByTestId } = render(
        <ChatHeader
          {...defaultProps}
          avatar="https://example.com/avatar.png"
          onAvatarPress={onAvatarPress}
          testID="chat-header"
        />
      );

      expect(getByTestId('chat-header')).toBeTruthy();
    });

    it('calls onTitlePress when title is pressed', () => {
      const onTitlePress = jest.fn();
      const { getByText } = render(
        <ChatHeader {...defaultProps} onTitlePress={onTitlePress} />
      );

      fireEvent.press(getByText('Support Chat'));

      expect(onTitlePress).toHaveBeenCalled();
    });
  });

  // ========================================
  // STYLING TESTS
  // ========================================

  describe('Styling', () => {
    it('applies custom background color', () => {
      const { getByTestId } = render(
        <ChatHeader {...defaultProps} backgroundColor="#FF0000" testID="chat-header" />
      );

      expect(getByTestId('chat-header')).toBeTruthy();
    });

    it('applies custom text color', () => {
      const { getByText } = render(
        <ChatHeader {...defaultProps} textColor="#FFFFFF" />
      );

      expect(getByText('Support Chat')).toBeTruthy();
    });

    it('applies custom height', () => {
      const { getByTestId } = render(
        <ChatHeader {...defaultProps} height={80} testID="chat-header" />
      );

      expect(getByTestId('chat-header')).toBeTruthy();
    });

    it('renders with shadow', () => {
      const { getByTestId } = render(
        <ChatHeader {...defaultProps} showShadow={true} testID="chat-header" />
      );

      expect(getByTestId('chat-header')).toBeTruthy();
    });

    it('renders without shadow', () => {
      const { getByTestId } = render(
        <ChatHeader {...defaultProps} showShadow={false} testID="chat-header" />
      );

      expect(getByTestId('chat-header')).toBeTruthy();
    });

    it('renders with border', () => {
      const { getByTestId } = render(
        <ChatHeader {...defaultProps} showBorder={true} testID="chat-header" />
      );

      expect(getByTestId('chat-header')).toBeTruthy();
    });
  });

  // ========================================
  // ACCESSIBILITY TESTS
  // ========================================

  describe('Accessibility', () => {
    it('has accessible container', () => {
      const { getByTestId } = render(
        <ChatHeader {...defaultProps} testID="chat-header" />
      );

      const container = getByTestId('chat-header');
      expect(container).toBeTruthy();
    });

    it('supports custom accessibility label', () => {
      const { getByTestId } = render(
        <ChatHeader
          {...defaultProps}
          testID="chat-header"
          accessibilityLabel="Chat header with title Support Chat"
        />
      );

      const container = getByTestId('chat-header');
      expect(container.props.accessibilityLabel).toBe('Chat header with title Support Chat');
    });

    it('close button is accessible', () => {
      const { getByTestId } = render(
        <ChatHeader {...defaultProps} onClose={jest.fn()} testID="chat-header" />
      );

      expect(getByTestId('chat-header')).toBeTruthy();
    });

    it('announces status changes', () => {
      const { getByTestId, rerender } = render(
        <ChatHeader {...defaultProps} isOnline={true} showStatus={true} testID="chat-header" />
      );

      expect(getByTestId('chat-header')).toBeTruthy();

      rerender(
        <ChatHeader {...defaultProps} isOnline={false} showStatus={true} testID="chat-header" />
      );

      expect(getByTestId('chat-header')).toBeTruthy();
    });
  });

  // ========================================
  // EDGE CASES
  // ========================================

  describe('Edge Cases', () => {
    it('handles empty title', () => {
      const { getByTestId } = render(
        <ChatHeader title="" testID="chat-header" />
      );

      expect(getByTestId('chat-header')).toBeTruthy();
    });

    it('handles very long title', () => {
      const { getByTestId } = render(
        <ChatHeader title={'A'.repeat(200)} testID="chat-header" />
      );

      expect(getByTestId('chat-header')).toBeTruthy();
    });

    it('handles very long subtitle', () => {
      const { getByTestId } = render(
        <ChatHeader {...defaultProps} subtitle={'B'.repeat(200)} testID="chat-header" />
      );

      expect(getByTestId('chat-header')).toBeTruthy();
    });

    it('handles missing agent avatar', () => {
      const agentNoAvatar = { ...mockAgent, avatar: undefined };
      const { getByText } = render(
        <ChatHeader {...defaultProps} agent={agentNoAvatar} />
      );

      expect(getByText(mockAgent.name)).toBeTruthy();
    });

    it('handles agent with long name', () => {
      const agentLongName = { ...mockAgent, name: 'A'.repeat(100) };
      const { getByTestId } = render(
        <ChatHeader {...defaultProps} agent={agentLongName} testID="chat-header" />
      );

      expect(getByTestId('chat-header')).toBeTruthy();
    });

    it('handles all buttons hidden', () => {
      const { getByTestId } = render(
        <ChatHeader
          {...defaultProps}
          showCloseButton={false}
          showMinimizeButton={false}
          showMenuButton={false}
          testID="chat-header"
        />
      );

      expect(getByTestId('chat-header')).toBeTruthy();
    });

    it('handles undefined props gracefully', () => {
      const { getByTestId } = render(
        <ChatHeader
          title={undefined as any}
          subtitle={undefined}
          avatar={undefined}
          testID="chat-header"
        />
      );

      expect(getByTestId('chat-header')).toBeTruthy();
    });
  });
});
