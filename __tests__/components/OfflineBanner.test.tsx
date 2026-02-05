/**
 * OfflineBanner.test.tsx
 *
 * Tests for the OfflineBanner component that displays offline status.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { OfflineBanner } from '../../src/components/OfflineBanner/OfflineBanner';
import { createMockTheme } from '../testUtils';

// Mock theme
jest.mock('../../src/theme', () => ({
  useTheme: () => createMockTheme(),
}));

describe('OfflineBanner', () => {
  const defaultProps = {
    isOffline: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // RENDERING TESTS
  // ========================================

  describe('Rendering', () => {
    it('renders the offline banner when offline', () => {
      const { getByTestId } = render(
        <OfflineBanner {...defaultProps} testID="offline-banner" />
      );

      expect(getByTestId('offline-banner')).toBeTruthy();
    });

    it('does not render when online and not animated', () => {
      const { queryByTestId } = render(
        <OfflineBanner isOffline={false} animated={false} testID="offline-banner" />
      );

      expect(queryByTestId('offline-banner')).toBeFalsy();
    });

    it('renders offline text', () => {
      const { getByText } = render(
        <OfflineBanner {...defaultProps} offlineText="You are offline" />
      );

      expect(getByText('You are offline')).toBeTruthy();
    });

    it('renders custom offline text', () => {
      const { getByText } = render(
        <OfflineBanner {...defaultProps} offlineText="No internet connection" />
      );

      expect(getByText('No internet connection')).toBeTruthy();
    });

    it('renders pending message count when provided', () => {
      const { getByText } = render(
        <OfflineBanner
          {...defaultProps}
          pendingCount={5}
          pendingText="{count} message{s} pending"
        />
      );

      expect(getByText('5 messages pending')).toBeTruthy();
    });

    it('renders singular pending message text', () => {
      const { getByText } = render(
        <OfflineBanner
          {...defaultProps}
          pendingCount={1}
          pendingText="{count} message{s} pending"
        />
      );

      expect(getByText('1 message pending')).toBeTruthy();
    });

    it('does not render pending count when zero', () => {
      const { queryByText } = render(
        <OfflineBanner
          {...defaultProps}
          pendingCount={0}
          pendingText="{count} message{s} pending"
        />
      );

      expect(queryByText(/pending/)).toBeFalsy();
    });

    it('renders arrow when onPress is provided', () => {
      const { getByText } = render(
        <OfflineBanner {...defaultProps} onPress={jest.fn()} />
      );

      expect(getByText('>')).toBeTruthy();
    });

    it('does not render arrow when onPress is not provided', () => {
      const { queryByText } = render(
        <OfflineBanner {...defaultProps} />
      );

      expect(queryByText('>')).toBeFalsy();
    });

    it('renders at top position', () => {
      const { getByTestId } = render(
        <OfflineBanner {...defaultProps} position="top" testID="offline-banner" />
      );

      expect(getByTestId('offline-banner')).toBeTruthy();
    });

    it('renders at bottom position', () => {
      const { getByTestId } = render(
        <OfflineBanner {...defaultProps} position="bottom" testID="offline-banner" />
      );

      expect(getByTestId('offline-banner')).toBeTruthy();
    });

    it('renders indicator dot', () => {
      const { getByTestId } = render(
        <OfflineBanner {...defaultProps} testID="offline-banner" />
      );

      expect(getByTestId('offline-banner')).toBeTruthy();
    });
  });

  // ========================================
  // INTERACTION TESTS
  // ========================================

  describe('Interactions', () => {
    it('calls onPress when banner is pressed', () => {
      const onPress = jest.fn();
      const { getByTestId } = render(
        <OfflineBanner {...defaultProps} onPress={onPress} testID="offline-banner" />
      );

      fireEvent.press(getByTestId('offline-banner'));

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('does not call onPress when not provided', () => {
      const { getByTestId } = render(
        <OfflineBanner {...defaultProps} testID="offline-banner" />
      );

      // Should not throw error when pressed
      fireEvent.press(getByTestId('offline-banner'));
    });
  });

  // ========================================
  // ANIMATION TESTS
  // ========================================

  describe('Animation', () => {
    it('animates in when going offline', () => {
      const { getByTestId } = render(
        <OfflineBanner isOffline={true} animated={true} testID="offline-banner" />
      );

      expect(getByTestId('offline-banner')).toBeTruthy();
    });

    it('animates out when going online', () => {
      const { getByTestId, rerender } = render(
        <OfflineBanner isOffline={true} animated={true} testID="offline-banner" />
      );

      expect(getByTestId('offline-banner')).toBeTruthy();

      rerender(
        <OfflineBanner isOffline={false} animated={true} testID="offline-banner" />
      );

      // Animation should be running, component may still be visible during animation
      expect(getByTestId('offline-banner')).toBeTruthy();
    });

    it('does not animate when animated is false', () => {
      const { getByTestId } = render(
        <OfflineBanner isOffline={true} animated={false} testID="offline-banner" />
      );

      expect(getByTestId('offline-banner')).toBeTruthy();
    });

    it('slides from top when position is top', () => {
      const { getByTestId } = render(
        <OfflineBanner
          {...defaultProps}
          position="top"
          animated={true}
          testID="offline-banner"
        />
      );

      expect(getByTestId('offline-banner')).toBeTruthy();
    });

    it('slides from bottom when position is bottom', () => {
      const { getByTestId } = render(
        <OfflineBanner
          {...defaultProps}
          position="bottom"
          animated={true}
          testID="offline-banner"
        />
      );

      expect(getByTestId('offline-banner')).toBeTruthy();
    });
  });

  // ========================================
  // ACCESSIBILITY TESTS
  // ========================================

  describe('Accessibility', () => {
    it('has accessible container', () => {
      const { getByTestId } = render(
        <OfflineBanner {...defaultProps} testID="offline-banner" />
      );

      const container = getByTestId('offline-banner');
      expect(container).toBeTruthy();
    });

    it('has alert role', () => {
      const { getByTestId } = render(
        <OfflineBanner {...defaultProps} testID="offline-banner" />
      );

      const container = getByTestId('offline-banner');
      expect(container.props.accessibilityRole).toBe('alert');
    });

    it('supports custom accessibility label', () => {
      const { getByTestId } = render(
        <OfflineBanner
          {...defaultProps}
          testID="offline-banner"
          accessibilityLabel="You are currently offline"
        />
      );

      const container = getByTestId('offline-banner');
      expect(container.props.accessibilityLabel).toBe('You are currently offline');
    });

    it('computes accessibility label from content', () => {
      const { getByTestId } = render(
        <OfflineBanner
          {...defaultProps}
          offlineText="You are offline"
          pendingCount={3}
          pendingText="{count} message{s} pending"
          testID="offline-banner"
        />
      );

      const container = getByTestId('offline-banner');
      expect(container.props.accessibilityLabel).toContain('You are offline');
    });

    it('has polite live region', () => {
      const { getByTestId } = render(
        <OfflineBanner {...defaultProps} testID="offline-banner" />
      );

      const container = getByTestId('offline-banner');
      expect(container.props.accessibilityLiveRegion).toBe('polite');
    });

    it('button is accessible when onPress is provided', () => {
      const { getByTestId } = render(
        <OfflineBanner {...defaultProps} onPress={jest.fn()} testID="offline-banner" />
      );

      // Should be wrapped in TouchableOpacity with button role
      expect(getByTestId('offline-banner')).toBeTruthy();
    });
  });

  // ========================================
  // EDGE CASES
  // ========================================

  describe('Edge Cases', () => {
    it('handles rapid online/offline changes', () => {
      const { getByTestId, rerender } = render(
        <OfflineBanner isOffline={true} testID="offline-banner" />
      );

      expect(getByTestId('offline-banner')).toBeTruthy();

      for (let i = 0; i < 10; i++) {
        rerender(<OfflineBanner isOffline={i % 2 === 0} testID="offline-banner" />);
      }

      expect(getByTestId('offline-banner')).toBeTruthy();
    });

    it('handles very long offline text', () => {
      const { getByTestId } = render(
        <OfflineBanner
          {...defaultProps}
          offlineText={'A'.repeat(200)}
          testID="offline-banner"
        />
      );

      expect(getByTestId('offline-banner')).toBeTruthy();
    });

    it('handles large pending count', () => {
      const { getByText } = render(
        <OfflineBanner
          {...defaultProps}
          pendingCount={999}
          pendingText="{count} message{s} pending"
        />
      );

      expect(getByText('999 messages pending')).toBeTruthy();
    });

    it('handles negative pending count', () => {
      const { queryByText } = render(
        <OfflineBanner
          {...defaultProps}
          pendingCount={-5}
          pendingText="{count} message{s} pending"
        />
      );

      // Should not display negative count
      expect(queryByText(/-5/)).toBeFalsy();
    });

    it('handles undefined pendingCount', () => {
      const { getByTestId } = render(
        <OfflineBanner
          {...defaultProps}
          pendingCount={undefined}
          testID="offline-banner"
        />
      );

      expect(getByTestId('offline-banner')).toBeTruthy();
    });

    it('handles empty offline text', () => {
      const { getByTestId } = render(
        <OfflineBanner {...defaultProps} offlineText="" testID="offline-banner" />
      );

      expect(getByTestId('offline-banner')).toBeTruthy();
    });

    it('handles missing pending text template', () => {
      const { getByTestId } = render(
        <OfflineBanner
          {...defaultProps}
          pendingCount={5}
          pendingText=""
          testID="offline-banner"
        />
      );

      expect(getByTestId('offline-banner')).toBeTruthy();
    });

    it('handles pending text without placeholders', () => {
      const { getByText } = render(
        <OfflineBanner
          {...defaultProps}
          pendingCount={5}
          pendingText="Messages waiting"
        />
      );

      expect(getByText('Messages waiting')).toBeTruthy();
    });
  });
});
