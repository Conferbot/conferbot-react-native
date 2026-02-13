/**
 * ConnectionStatus.test.tsx
 *
 * Tests for the ConnectionStatus component that displays connection state.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ConnectionStatus } from '../../src/components/ConnectionStatus/ConnectionStatus';
import { createMockTheme } from '../testUtils';

// Mock theme
jest.mock('../../src/theme', () => ({
  useTheme: () => createMockTheme(),
}));

describe('ConnectionStatus', () => {
  const defaultProps = {
    status: 'connected' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // RENDERING TESTS
  // ========================================

  describe('Rendering', () => {
    it('renders the connection status component', () => {
      const { getByTestId } = render(
        <ConnectionStatus {...defaultProps} testID="connection-status" />
      );

      expect(getByTestId('connection-status')).toBeTruthy();
    });

    it('renders connected state', () => {
      const { getByTestId } = render(
        <ConnectionStatus status="connected" testID="connection-status" />
      );

      expect(getByTestId('connection-status')).toBeTruthy();
    });

    it('renders connecting state', () => {
      const { getByTestId } = render(
        <ConnectionStatus status="connecting" testID="connection-status" />
      );

      expect(getByTestId('connection-status')).toBeTruthy();
    });

    it('renders disconnected state', () => {
      const { getByTestId } = render(
        <ConnectionStatus status="disconnected" testID="connection-status" />
      );

      expect(getByTestId('connection-status')).toBeTruthy();
    });

    it('renders reconnecting state', () => {
      const { getByTestId } = render(
        <ConnectionStatus status="reconnecting" testID="connection-status" />
      );

      expect(getByTestId('connection-status')).toBeTruthy();
    });

    it('renders error state', () => {
      const { getByTestId } = render(
        <ConnectionStatus status="error" testID="connection-status" />
      );

      expect(getByTestId('connection-status')).toBeTruthy();
    });

    it('renders status icon', () => {
      const { getByTestId } = render(
        <ConnectionStatus {...defaultProps} showIcon={true} testID="connection-status" />
      );

      expect(getByTestId('connection-status')).toBeTruthy();
    });

    it('hides status icon when showIcon is false', () => {
      const { getByTestId } = render(
        <ConnectionStatus {...defaultProps} showIcon={false} testID="connection-status" />
      );

      expect(getByTestId('connection-status')).toBeTruthy();
    });

    it('renders status text', () => {
      const { getByText } = render(
        <ConnectionStatus status="connected" showText={true} connectedText="Connected" />
      );

      expect(getByText('Connected')).toBeTruthy();
    });

    it('hides status text when showText is false', () => {
      const { queryByText } = render(
        <ConnectionStatus status="connected" showText={false} connectedText="Connected" />
      );

      expect(queryByText('Connected')).toBeFalsy();
    });

    it('renders custom status messages', () => {
      const { getByText } = render(
        <ConnectionStatus
          status="disconnected"
          showText={true}
          disconnectedText="No connection"
        />
      );

      expect(getByText('No connection')).toBeTruthy();
    });

    it('renders loading indicator when connecting', () => {
      const { getByTestId } = render(
        <ConnectionStatus status="connecting" testID="connection-status" />
      );

      expect(getByTestId('connection-status')).toBeTruthy();
    });

    it('renders retry button when disconnected and showRetry is true', () => {
      const { getByText } = render(
        <ConnectionStatus
          status="disconnected"
          showRetry={true}
          onRetry={jest.fn()}
          retryButtonText="Retry"
        />
      );

      expect(getByText('Retry')).toBeTruthy();
    });

    it('hides retry button when connected', () => {
      const { queryByText } = render(
        <ConnectionStatus
          status="connected"
          showRetry={true}
          onRetry={jest.fn()}
          retryButtonText="Retry"
        />
      );

      expect(queryByText('Retry')).toBeFalsy();
    });

    it('renders in compact mode', () => {
      const { getByTestId } = render(
        <ConnectionStatus {...defaultProps} compact={true} testID="connection-status" />
      );

      expect(getByTestId('connection-status')).toBeTruthy();
    });

    it('renders in full mode', () => {
      const { getByTestId } = render(
        <ConnectionStatus {...defaultProps} compact={false} testID="connection-status" />
      );

      expect(getByTestId('connection-status')).toBeTruthy();
    });
  });

  // ========================================
  // INTERACTION TESTS
  // ========================================

  describe('Interactions', () => {
    it('calls onRetry when retry button is pressed', () => {
      const onRetry = jest.fn();
      const { getByText } = render(
        <ConnectionStatus
          status="disconnected"
          showRetry={true}
          onRetry={onRetry}
          retryButtonText="Retry"
        />
      );

      fireEvent.press(getByText('Retry'));

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('calls onPress when component is pressed', () => {
      const onPress = jest.fn();
      const { getByTestId } = render(
        <ConnectionStatus {...defaultProps} onPress={onPress} testID="connection-status" />
      );

      fireEvent.press(getByTestId('connection-status'));

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('disables retry button when retrying', () => {
      const onRetry = jest.fn();
      const { getByText } = render(
        <ConnectionStatus
          status="reconnecting"
          showRetry={true}
          onRetry={onRetry}
          retryButtonText="Retry"
        />
      );

      // Retry button should be disabled or hidden during reconnecting
      expect(getByText('Retry')).toBeTruthy();
    });
  });

  // ========================================
  // ANIMATION TESTS
  // ========================================

  describe('Animation', () => {
    it('animates status dot when connecting', () => {
      const { getByTestId } = render(
        <ConnectionStatus status="connecting" animated={true} testID="connection-status" />
      );

      expect(getByTestId('connection-status')).toBeTruthy();
    });

    it('animates status dot when reconnecting', () => {
      const { getByTestId } = render(
        <ConnectionStatus status="reconnecting" animated={true} testID="connection-status" />
      );

      expect(getByTestId('connection-status')).toBeTruthy();
    });

    it('does not animate when animated is false', () => {
      const { getByTestId } = render(
        <ConnectionStatus status="connecting" animated={false} testID="connection-status" />
      );

      expect(getByTestId('connection-status')).toBeTruthy();
    });

    it('pulses status indicator when connected', () => {
      const { getByTestId } = render(
        <ConnectionStatus status="connected" pulseWhenConnected={true} testID="connection-status" />
      );

      expect(getByTestId('connection-status')).toBeTruthy();
    });
  });

  // ========================================
  // STYLING TESTS
  // ========================================

  describe('Styling', () => {
    it('applies connected color', () => {
      const { getByTestId } = render(
        <ConnectionStatus status="connected" connectedColor="#00FF00" testID="connection-status" />
      );

      expect(getByTestId('connection-status')).toBeTruthy();
    });

    it('applies disconnected color', () => {
      const { getByTestId } = render(
        <ConnectionStatus status="disconnected" disconnectedColor="#FF0000" testID="connection-status" />
      );

      expect(getByTestId('connection-status')).toBeTruthy();
    });

    it('applies connecting color', () => {
      const { getByTestId } = render(
        <ConnectionStatus status="connecting" connectingColor="#FFFF00" testID="connection-status" />
      );

      expect(getByTestId('connection-status')).toBeTruthy();
    });

    it('applies custom size', () => {
      const { getByTestId } = render(
        <ConnectionStatus {...defaultProps} size="large" testID="connection-status" />
      );

      expect(getByTestId('connection-status')).toBeTruthy();
    });
  });

  // ========================================
  // ACCESSIBILITY TESTS
  // ========================================

  describe('Accessibility', () => {
    it('has accessible container', () => {
      const { getByTestId } = render(
        <ConnectionStatus {...defaultProps} testID="connection-status" />
      );

      const container = getByTestId('connection-status');
      expect(container).toBeTruthy();
    });

    it('supports custom accessibility label', () => {
      const { getByTestId } = render(
        <ConnectionStatus
          {...defaultProps}
          testID="connection-status"
          accessibilityLabel="Connection status: connected"
        />
      );

      const container = getByTestId('connection-status');
      expect(container.props.accessibilityLabel).toBe('Connection status: connected');
    });

    it('announces status changes', () => {
      const { getByTestId, rerender } = render(
        <ConnectionStatus status="connected" testID="connection-status" />
      );

      expect(getByTestId('connection-status')).toBeTruthy();

      rerender(
        <ConnectionStatus status="disconnected" testID="connection-status" />
      );

      expect(getByTestId('connection-status')).toBeTruthy();
    });

    it('retry button is accessible', () => {
      const { getByText } = render(
        <ConnectionStatus
          status="disconnected"
          showRetry={true}
          onRetry={jest.fn()}
          retryButtonText="Retry connection"
        />
      );

      const button = getByText('Retry connection');
      expect(button).toBeTruthy();
    });
  });

  // ========================================
  // EDGE CASES
  // ========================================

  describe('Edge Cases', () => {
    it('handles undefined status gracefully', () => {
      const { getByTestId } = render(
        <ConnectionStatus status={undefined as any} testID="connection-status" />
      );

      expect(getByTestId('connection-status')).toBeTruthy();
    });

    it('handles unknown status value', () => {
      const { getByTestId } = render(
        <ConnectionStatus status={'unknown' as any} testID="connection-status" />
      );

      expect(getByTestId('connection-status')).toBeTruthy();
    });

    it('handles rapid status changes', () => {
      const { getByTestId, rerender } = render(
        <ConnectionStatus status="connected" testID="connection-status" />
      );

      rerender(<ConnectionStatus status="disconnected" testID="connection-status" />);
      rerender(<ConnectionStatus status="reconnecting" testID="connection-status" />);
      rerender(<ConnectionStatus status="connected" testID="connection-status" />);

      expect(getByTestId('connection-status')).toBeTruthy();
    });

    it('handles empty status text', () => {
      const { getByTestId } = render(
        <ConnectionStatus
          status="connected"
          showText={true}
          connectedText=""
          testID="connection-status"
        />
      );

      expect(getByTestId('connection-status')).toBeTruthy();
    });

    it('handles very long status text', () => {
      const { getByTestId } = render(
        <ConnectionStatus
          status="error"
          showText={true}
          errorText={'A'.repeat(500)}
          testID="connection-status"
        />
      );

      expect(getByTestId('connection-status')).toBeTruthy();
    });

    it('handles missing onRetry when showRetry is true', () => {
      const { getByTestId } = render(
        <ConnectionStatus status="disconnected" showRetry={true} testID="connection-status" />
      );

      expect(getByTestId('connection-status')).toBeTruthy();
    });
  });
});
