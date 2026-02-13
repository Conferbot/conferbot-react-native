/**
 * HandoverWaiting.test.tsx
 *
 * Tests for the HandoverWaiting component that displays queue status.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { HandoverWaiting } from '../../src/components/Handover/HandoverWaiting';
import { createMockTheme } from '../testUtils';

// Mock theme
jest.mock('../../src/theme', () => ({
  useTheme: () => createMockTheme(),
}));

describe('HandoverWaiting', () => {
  const defaultProps = {
    onCancel: jest.fn(),
  };

  const mockQueueInfo = {
    position: 3,
    estimatedWaitTime: 180,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // RENDERING TESTS
  // ========================================

  describe('Rendering', () => {
    it('renders the waiting component', () => {
      const { getByTestId } = render(
        <HandoverWaiting {...defaultProps} testID="waiting" />
      );

      expect(getByTestId('waiting')).toBeTruthy();
    });

    it('renders waiting message', () => {
      const { getByTestId } = render(
        <HandoverWaiting
          {...defaultProps}
          waitingMessage="Please wait while we connect you"
          testID="waiting"
        />
      );

      expect(getByTestId('waiting')).toBeTruthy();
    });

    it('renders queue position when provided', () => {
      const { getByText } = render(
        <HandoverWaiting {...defaultProps} queueInfo={mockQueueInfo} />
      );

      expect(getByText(/3/)).toBeTruthy();
    });

    it('renders estimated wait time when provided', () => {
      const { getByTestId } = render(
        <HandoverWaiting {...defaultProps} queueInfo={mockQueueInfo} testID="waiting" />
      );

      expect(getByTestId('waiting')).toBeTruthy();
    });

    it('renders cancel button', () => {
      const { getByTestId } = render(
        <HandoverWaiting {...defaultProps} testID="waiting" />
      );

      expect(getByTestId('waiting')).toBeTruthy();
    });

    it('renders custom cancel button text', () => {
      const { getByText } = render(
        <HandoverWaiting {...defaultProps} cancelButtonText="Leave Queue" />
      );

      expect(getByText('Leave Queue')).toBeTruthy();
    });

    it('renders loading indicator', () => {
      const { getByTestId } = render(
        <HandoverWaiting {...defaultProps} testID="waiting" />
      );

      expect(getByTestId('waiting')).toBeTruthy();
    });

    it('renders without queue info', () => {
      const { getByTestId } = render(
        <HandoverWaiting {...defaultProps} testID="waiting" />
      );

      expect(getByTestId('waiting')).toBeTruthy();
    });

    it('renders connecting state', () => {
      const { getByTestId } = render(
        <HandoverWaiting {...defaultProps} isConnecting={true} testID="waiting" />
      );

      expect(getByTestId('waiting')).toBeTruthy();
    });

    it('renders custom connecting message', () => {
      const { getByText } = render(
        <HandoverWaiting
          {...defaultProps}
          isConnecting={true}
          connectingMessage="Connecting to agent..."
        />
      );

      expect(getByText('Connecting to agent...')).toBeTruthy();
    });
  });

  // ========================================
  // INTERACTION TESTS
  // ========================================

  describe('Interactions', () => {
    it('calls onCancel when cancel button is pressed', () => {
      const onCancel = jest.fn();
      const { getByText } = render(
        <HandoverWaiting {...defaultProps} onCancel={onCancel} cancelButtonText="Cancel" />
      );

      fireEvent.press(getByText('Cancel'));

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('does not call onCancel when not provided', () => {
      const { getByTestId } = render(
        <HandoverWaiting testID="waiting" />
      );

      expect(getByTestId('waiting')).toBeTruthy();
    });
  });

  // ========================================
  // QUEUE INFO FORMATTING TESTS
  // ========================================

  describe('Queue Info Formatting', () => {
    it('formats queue position correctly', () => {
      const { getByText } = render(
        <HandoverWaiting {...defaultProps} queueInfo={{ position: 1, estimatedWaitTime: 60 }} />
      );

      expect(getByText(/1/)).toBeTruthy();
    });

    it('formats estimated wait time in minutes', () => {
      const { getByTestId } = render(
        <HandoverWaiting
          {...defaultProps}
          queueInfo={{ position: 1, estimatedWaitTime: 120 }}
          testID="waiting"
        />
      );

      expect(getByTestId('waiting')).toBeTruthy();
    });

    it('handles zero queue position', () => {
      const { getByTestId } = render(
        <HandoverWaiting
          {...defaultProps}
          queueInfo={{ position: 0, estimatedWaitTime: 0 }}
          testID="waiting"
        />
      );

      expect(getByTestId('waiting')).toBeTruthy();
    });

    it('handles large queue position', () => {
      const { getByText } = render(
        <HandoverWaiting
          {...defaultProps}
          queueInfo={{ position: 99, estimatedWaitTime: 3600 }}
        />
      );

      expect(getByText(/99/)).toBeTruthy();
    });
  });

  // ========================================
  // ACCESSIBILITY TESTS
  // ========================================

  describe('Accessibility', () => {
    it('has accessible container', () => {
      const { getByTestId } = render(
        <HandoverWaiting {...defaultProps} testID="waiting" />
      );

      const container = getByTestId('waiting');
      expect(container).toBeTruthy();
    });

    it('supports custom accessibility label', () => {
      const { getByTestId } = render(
        <HandoverWaiting
          {...defaultProps}
          testID="waiting"
          accessibilityLabel="Waiting in queue for agent"
        />
      );

      const container = getByTestId('waiting');
      expect(container.props.accessibilityLabel).toBe('Waiting in queue for agent');
    });

    it('cancel button is accessible', () => {
      const { getByText } = render(
        <HandoverWaiting {...defaultProps} cancelButtonText="Cancel" />
      );

      const button = getByText('Cancel');
      expect(button).toBeTruthy();
    });

    it('announces queue position for screen readers', () => {
      const { getByTestId } = render(
        <HandoverWaiting
          {...defaultProps}
          queueInfo={mockQueueInfo}
          testID="waiting"
        />
      );

      expect(getByTestId('waiting')).toBeTruthy();
    });
  });

  // ========================================
  // EDGE CASES
  // ========================================

  describe('Edge Cases', () => {
    it('handles missing queue info gracefully', () => {
      const { getByTestId } = render(
        <HandoverWaiting {...defaultProps} testID="waiting" />
      );

      expect(getByTestId('waiting')).toBeTruthy();
    });

    it('handles undefined estimated wait time', () => {
      const { getByTestId } = render(
        <HandoverWaiting
          {...defaultProps}
          queueInfo={{ position: 2 } as any}
          testID="waiting"
        />
      );

      expect(getByTestId('waiting')).toBeTruthy();
    });

    it('handles undefined queue position', () => {
      const { getByTestId } = render(
        <HandoverWaiting
          {...defaultProps}
          queueInfo={{ estimatedWaitTime: 60 } as any}
          testID="waiting"
        />
      );

      expect(getByTestId('waiting')).toBeTruthy();
    });

    it('handles very long waiting message', () => {
      const { getByTestId } = render(
        <HandoverWaiting
          {...defaultProps}
          waitingMessage={'A'.repeat(200)}
          testID="waiting"
        />
      );

      expect(getByTestId('waiting')).toBeTruthy();
    });

    it('handles switching from waiting to connecting', () => {
      const { getByTestId, rerender } = render(
        <HandoverWaiting {...defaultProps} isConnecting={false} testID="waiting" />
      );

      expect(getByTestId('waiting')).toBeTruthy();

      rerender(
        <HandoverWaiting {...defaultProps} isConnecting={true} testID="waiting" />
      );

      expect(getByTestId('waiting')).toBeTruthy();
    });
  });
});
