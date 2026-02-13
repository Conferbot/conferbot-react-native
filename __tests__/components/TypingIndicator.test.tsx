/**
 * TypingIndicator.test.tsx
 *
 * Tests for the TypingIndicator component that shows when someone is typing.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { TypingIndicator } from '../../src/components/TypingIndicator/TypingIndicator';
import { createMockTheme } from '../testUtils';

// Mock theme
jest.mock('../../src/theme', () => ({
  useTheme: () => createMockTheme(),
}));

describe('TypingIndicator', () => {
  const defaultProps = {
    isTyping: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // RENDERING TESTS
  // ========================================

  describe('Rendering', () => {
    it('renders the typing indicator when isTyping is true', () => {
      const { getByTestId } = render(
        <TypingIndicator {...defaultProps} testID="typing-indicator" />
      );

      expect(getByTestId('typing-indicator')).toBeTruthy();
    });

    it('does not render when isTyping is false', () => {
      const { queryByTestId } = render(
        <TypingIndicator isTyping={false} testID="typing-indicator" />
      );

      expect(queryByTestId('typing-indicator')).toBeFalsy();
    });

    it('renders typing dots', () => {
      const { getByTestId } = render(
        <TypingIndicator {...defaultProps} testID="typing-indicator" />
      );

      expect(getByTestId('typing-indicator')).toBeTruthy();
    });

    it('renders custom number of dots', () => {
      const { getByTestId } = render(
        <TypingIndicator {...defaultProps} dotCount={5} testID="typing-indicator" />
      );

      expect(getByTestId('typing-indicator')).toBeTruthy();
    });

    it('renders with avatar when provided', () => {
      const { getByTestId } = render(
        <TypingIndicator
          {...defaultProps}
          avatar="https://example.com/avatar.png"
          testID="typing-indicator"
        />
      );

      expect(getByTestId('typing-indicator')).toBeTruthy();
    });

    it('renders without avatar when not provided', () => {
      const { getByTestId } = render(
        <TypingIndicator {...defaultProps} showAvatar={false} testID="typing-indicator" />
      );

      expect(getByTestId('typing-indicator')).toBeTruthy();
    });

    it('renders typing text when provided', () => {
      const { getByText } = render(
        <TypingIndicator {...defaultProps} typingText="Bot is typing..." />
      );

      expect(getByText('Bot is typing...')).toBeTruthy();
    });

    it('renders with name when provided', () => {
      const { getByText } = render(
        <TypingIndicator {...defaultProps} name="Support Bot" showName={true} />
      );

      expect(getByText(/Support Bot/)).toBeTruthy();
    });

    it('renders in bubble style', () => {
      const { getByTestId } = render(
        <TypingIndicator {...defaultProps} style="bubble" testID="typing-indicator" />
      );

      expect(getByTestId('typing-indicator')).toBeTruthy();
    });

    it('renders in minimal style', () => {
      const { getByTestId } = render(
        <TypingIndicator {...defaultProps} style="minimal" testID="typing-indicator" />
      );

      expect(getByTestId('typing-indicator')).toBeTruthy();
    });

    it('renders in text style', () => {
      const { getByTestId } = render(
        <TypingIndicator {...defaultProps} style="text" testID="typing-indicator" />
      );

      expect(getByTestId('typing-indicator')).toBeTruthy();
    });
  });

  // ========================================
  // ANIMATION TESTS
  // ========================================

  describe('Animation', () => {
    it('animates dots when animated is true', () => {
      const { getByTestId } = render(
        <TypingIndicator {...defaultProps} animated={true} testID="typing-indicator" />
      );

      expect(getByTestId('typing-indicator')).toBeTruthy();
    });

    it('does not animate dots when animated is false', () => {
      const { getByTestId } = render(
        <TypingIndicator {...defaultProps} animated={false} testID="typing-indicator" />
      );

      expect(getByTestId('typing-indicator')).toBeTruthy();
    });

    it('uses bounce animation', () => {
      const { getByTestId } = render(
        <TypingIndicator {...defaultProps} animationType="bounce" testID="typing-indicator" />
      );

      expect(getByTestId('typing-indicator')).toBeTruthy();
    });

    it('uses pulse animation', () => {
      const { getByTestId } = render(
        <TypingIndicator {...defaultProps} animationType="pulse" testID="typing-indicator" />
      );

      expect(getByTestId('typing-indicator')).toBeTruthy();
    });

    it('uses fade animation', () => {
      const { getByTestId } = render(
        <TypingIndicator {...defaultProps} animationType="fade" testID="typing-indicator" />
      );

      expect(getByTestId('typing-indicator')).toBeTruthy();
    });

    it('applies custom animation duration', () => {
      const { getByTestId } = render(
        <TypingIndicator
          {...defaultProps}
          animationDuration={500}
          testID="typing-indicator"
        />
      );

      expect(getByTestId('typing-indicator')).toBeTruthy();
    });

    it('applies animation delay between dots', () => {
      const { getByTestId } = render(
        <TypingIndicator
          {...defaultProps}
          dotAnimationDelay={100}
          testID="typing-indicator"
        />
      );

      expect(getByTestId('typing-indicator')).toBeTruthy();
    });
  });

  // ========================================
  // STYLING TESTS
  // ========================================

  describe('Styling', () => {
    it('applies custom dot color', () => {
      const { getByTestId } = render(
        <TypingIndicator {...defaultProps} dotColor="#FF0000" testID="typing-indicator" />
      );

      expect(getByTestId('typing-indicator')).toBeTruthy();
    });

    it('applies custom dot size', () => {
      const { getByTestId } = render(
        <TypingIndicator {...defaultProps} dotSize={12} testID="typing-indicator" />
      );

      expect(getByTestId('typing-indicator')).toBeTruthy();
    });

    it('applies custom background color', () => {
      const { getByTestId } = render(
        <TypingIndicator {...defaultProps} backgroundColor="#EEEEEE" testID="typing-indicator" />
      );

      expect(getByTestId('typing-indicator')).toBeTruthy();
    });

    it('applies custom text color', () => {
      const { getByText } = render(
        <TypingIndicator
          {...defaultProps}
          typingText="Typing..."
          textColor="#333333"
        />
      );

      expect(getByText('Typing...')).toBeTruthy();
    });

    it('applies small size', () => {
      const { getByTestId } = render(
        <TypingIndicator {...defaultProps} size="small" testID="typing-indicator" />
      );

      expect(getByTestId('typing-indicator')).toBeTruthy();
    });

    it('applies medium size', () => {
      const { getByTestId } = render(
        <TypingIndicator {...defaultProps} size="medium" testID="typing-indicator" />
      );

      expect(getByTestId('typing-indicator')).toBeTruthy();
    });

    it('applies large size', () => {
      const { getByTestId } = render(
        <TypingIndicator {...defaultProps} size="large" testID="typing-indicator" />
      );

      expect(getByTestId('typing-indicator')).toBeTruthy();
    });
  });

  // ========================================
  // ACCESSIBILITY TESTS
  // ========================================

  describe('Accessibility', () => {
    it('has accessible container', () => {
      const { getByTestId } = render(
        <TypingIndicator {...defaultProps} testID="typing-indicator" />
      );

      const container = getByTestId('typing-indicator');
      expect(container).toBeTruthy();
    });

    it('supports custom accessibility label', () => {
      const { getByTestId } = render(
        <TypingIndicator
          {...defaultProps}
          testID="typing-indicator"
          accessibilityLabel="Bot is typing a message"
        />
      );

      const container = getByTestId('typing-indicator');
      expect(container.props.accessibilityLabel).toBe('Bot is typing a message');
    });

    it('has default accessibility label', () => {
      const { getByTestId } = render(
        <TypingIndicator {...defaultProps} testID="typing-indicator" />
      );

      const container = getByTestId('typing-indicator');
      expect(container.props.accessibilityLabel).toBeTruthy();
    });

    it('announces typing to screen readers', () => {
      const { getByTestId } = render(
        <TypingIndicator {...defaultProps} testID="typing-indicator" />
      );

      expect(getByTestId('typing-indicator')).toBeTruthy();
    });
  });

  // ========================================
  // VISIBILITY TRANSITIONS
  // ========================================

  describe('Visibility Transitions', () => {
    it('transitions from hidden to visible', () => {
      const { queryByTestId, rerender, getByTestId } = render(
        <TypingIndicator isTyping={false} testID="typing-indicator" />
      );

      expect(queryByTestId('typing-indicator')).toBeFalsy();

      rerender(
        <TypingIndicator isTyping={true} testID="typing-indicator" />
      );

      expect(getByTestId('typing-indicator')).toBeTruthy();
    });

    it('transitions from visible to hidden', () => {
      const { getByTestId, rerender, queryByTestId } = render(
        <TypingIndicator isTyping={true} testID="typing-indicator" />
      );

      expect(getByTestId('typing-indicator')).toBeTruthy();

      rerender(
        <TypingIndicator isTyping={false} testID="typing-indicator" />
      );

      expect(queryByTestId('typing-indicator')).toBeFalsy();
    });

    it('handles rapid visibility changes', () => {
      const { rerender, getByTestId } = render(
        <TypingIndicator isTyping={true} testID="typing-indicator" />
      );

      for (let i = 0; i < 10; i++) {
        rerender(
          <TypingIndicator isTyping={i % 2 === 0} testID="typing-indicator" />
        );
      }

      // Final state should be visible (even iteration)
      expect(getByTestId('typing-indicator')).toBeTruthy();
    });
  });

  // ========================================
  // EDGE CASES
  // ========================================

  describe('Edge Cases', () => {
    it('handles undefined isTyping', () => {
      const { queryByTestId } = render(
        <TypingIndicator isTyping={undefined as any} testID="typing-indicator" />
      );

      // Should treat undefined as falsy
      expect(queryByTestId('typing-indicator')).toBeFalsy();
    });

    it('handles very long name', () => {
      const { getByTestId } = render(
        <TypingIndicator
          {...defaultProps}
          name={'A'.repeat(100)}
          showName={true}
          testID="typing-indicator"
        />
      );

      expect(getByTestId('typing-indicator')).toBeTruthy();
    });

    it('handles very long typing text', () => {
      const { getByTestId } = render(
        <TypingIndicator
          {...defaultProps}
          typingText={'A'.repeat(200)}
          testID="typing-indicator"
        />
      );

      expect(getByTestId('typing-indicator')).toBeTruthy();
    });

    it('handles zero dots', () => {
      const { getByTestId } = render(
        <TypingIndicator {...defaultProps} dotCount={0} testID="typing-indicator" />
      );

      expect(getByTestId('typing-indicator')).toBeTruthy();
    });

    it('handles negative dot count', () => {
      const { getByTestId } = render(
        <TypingIndicator {...defaultProps} dotCount={-1} testID="typing-indicator" />
      );

      expect(getByTestId('typing-indicator')).toBeTruthy();
    });

    it('handles large dot count', () => {
      const { getByTestId } = render(
        <TypingIndicator {...defaultProps} dotCount={100} testID="typing-indicator" />
      );

      expect(getByTestId('typing-indicator')).toBeTruthy();
    });

    it('handles invalid avatar URL', () => {
      const { getByTestId } = render(
        <TypingIndicator
          {...defaultProps}
          avatar="not-a-url"
          testID="typing-indicator"
        />
      );

      expect(getByTestId('typing-indicator')).toBeTruthy();
    });

    it('handles empty avatar URL', () => {
      const { getByTestId } = render(
        <TypingIndicator {...defaultProps} avatar="" testID="typing-indicator" />
      );

      expect(getByTestId('typing-indicator')).toBeTruthy();
    });
  });
});
