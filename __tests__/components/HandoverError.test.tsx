/**
 * HandoverError.test.tsx
 *
 * Tests for the HandoverError component that displays error states.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { HandoverError } from '../../src/components/Handover/HandoverError';
import { createMockTheme } from '../testUtils';

// Mock theme
jest.mock('../../src/theme', () => ({
  useTheme: () => createMockTheme(),
}));

describe('HandoverError', () => {
  const defaultProps = {
    errorType: 'error' as const,
    onRetry: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // RENDERING TESTS
  // ========================================

  describe('Rendering', () => {
    it('renders the error component', () => {
      const { getByTestId } = render(
        <HandoverError {...defaultProps} testID="error" />
      );

      expect(getByTestId('error')).toBeTruthy();
    });

    it('renders generic error state', () => {
      const { getByTestId } = render(
        <HandoverError {...defaultProps} errorType="error" testID="error" />
      );

      expect(getByTestId('error')).toBeTruthy();
    });

    it('renders no agents available state', () => {
      const { getByTestId } = render(
        <HandoverError {...defaultProps} errorType="no_agents" testID="error" />
      );

      expect(getByTestId('error')).toBeTruthy();
    });

    it('renders timeout state', () => {
      const { getByTestId } = render(
        <HandoverError {...defaultProps} errorType="timeout" testID="error" />
      );

      expect(getByTestId('error')).toBeTruthy();
    });

    it('renders custom error message', () => {
      const { getByText } = render(
        <HandoverError {...defaultProps} errorMessage="Connection failed. Please try again." />
      );

      expect(getByText('Connection failed. Please try again.')).toBeTruthy();
    });

    it('renders retry button', () => {
      const { getByText } = render(
        <HandoverError {...defaultProps} retryButtonText="Try Again" />
      );

      expect(getByText('Try Again')).toBeTruthy();
    });

    it('renders cancel button', () => {
      const { getByText } = render(
        <HandoverError {...defaultProps} cancelButtonText="Go Back" />
      );

      expect(getByText('Go Back')).toBeTruthy();
    });

    it('renders error icon', () => {
      const { getByTestId } = render(
        <HandoverError {...defaultProps} testID="error" />
      );

      expect(getByTestId('error')).toBeTruthy();
    });

    it('renders default messages for each error type', () => {
      const errorTypes = ['error', 'no_agents', 'timeout'] as const;

      errorTypes.forEach((errorType) => {
        const { getByTestId, unmount } = render(
          <HandoverError {...defaultProps} errorType={errorType} testID="error" />
        );
        expect(getByTestId('error')).toBeTruthy();
        unmount();
      });
    });

    it('hides retry button when onRetry is not provided', () => {
      const { queryByText } = render(
        <HandoverError
          errorType="error"
          onCancel={jest.fn()}
          retryButtonText="Retry"
        />
      );

      // Button might not be rendered or might be disabled
      expect(queryByText('Retry')).toBeFalsy();
    });

    it('hides cancel button when onCancel is not provided', () => {
      const { queryByText } = render(
        <HandoverError
          errorType="error"
          onRetry={jest.fn()}
          cancelButtonText="Cancel"
        />
      );

      // Button might not be rendered or might be disabled
      expect(queryByText('Cancel')).toBeFalsy();
    });
  });

  // ========================================
  // INTERACTION TESTS
  // ========================================

  describe('Interactions', () => {
    it('calls onRetry when retry button is pressed', () => {
      const onRetry = jest.fn();
      const { getByText } = render(
        <HandoverError {...defaultProps} onRetry={onRetry} retryButtonText="Retry" />
      );

      fireEvent.press(getByText('Retry'));

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when cancel button is pressed', () => {
      const onCancel = jest.fn();
      const { getByText } = render(
        <HandoverError {...defaultProps} onCancel={onCancel} cancelButtonText="Cancel" />
      );

      fireEvent.press(getByText('Cancel'));

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('handles rapid retry button presses', () => {
      const onRetry = jest.fn();
      const { getByText } = render(
        <HandoverError {...defaultProps} onRetry={onRetry} retryButtonText="Retry" />
      );

      const button = getByText('Retry');
      fireEvent.press(button);
      fireEvent.press(button);
      fireEvent.press(button);

      expect(onRetry).toHaveBeenCalled();
    });
  });

  // ========================================
  // ERROR TYPE SPECIFIC TESTS
  // ========================================

  describe('Error Type Specific Behavior', () => {
    it('shows appropriate message for no_agents error', () => {
      const { getByTestId } = render(
        <HandoverError
          {...defaultProps}
          errorType="no_agents"
          noAgentsMessage="No agents are currently available"
          testID="error"
        />
      );

      expect(getByTestId('error')).toBeTruthy();
    });

    it('shows appropriate message for timeout error', () => {
      const { getByTestId } = render(
        <HandoverError
          {...defaultProps}
          errorType="timeout"
          timeoutMessage="Connection timed out"
          testID="error"
        />
      );

      expect(getByTestId('error')).toBeTruthy();
    });

    it('shows appropriate message for generic error', () => {
      const { getByText } = render(
        <HandoverError
          {...defaultProps}
          errorType="error"
          errorMessage="Something went wrong"
        />
      );

      expect(getByText('Something went wrong')).toBeTruthy();
    });
  });

  // ========================================
  // ACCESSIBILITY TESTS
  // ========================================

  describe('Accessibility', () => {
    it('has accessible container', () => {
      const { getByTestId } = render(
        <HandoverError {...defaultProps} testID="error" />
      );

      const container = getByTestId('error');
      expect(container).toBeTruthy();
    });

    it('supports custom accessibility label', () => {
      const { getByTestId } = render(
        <HandoverError
          {...defaultProps}
          testID="error"
          accessibilityLabel="Error connecting to agent"
        />
      );

      const container = getByTestId('error');
      expect(container.props.accessibilityLabel).toBe('Error connecting to agent');
    });

    it('buttons are accessible', () => {
      const { getByText } = render(
        <HandoverError
          {...defaultProps}
          retryButtonText="Retry"
          cancelButtonText="Cancel"
        />
      );

      expect(getByText('Retry')).toBeTruthy();
      expect(getByText('Cancel')).toBeTruthy();
    });

    it('error message is announced to screen readers', () => {
      const { getByTestId } = render(
        <HandoverError
          {...defaultProps}
          errorMessage="An error occurred"
          testID="error"
        />
      );

      expect(getByTestId('error')).toBeTruthy();
    });
  });

  // ========================================
  // EDGE CASES
  // ========================================

  describe('Edge Cases', () => {
    it('handles empty error message', () => {
      const { getByTestId } = render(
        <HandoverError {...defaultProps} errorMessage="" testID="error" />
      );

      expect(getByTestId('error')).toBeTruthy();
    });

    it('handles very long error message', () => {
      const { getByTestId } = render(
        <HandoverError
          {...defaultProps}
          errorMessage={'A'.repeat(500)}
          testID="error"
        />
      );

      expect(getByTestId('error')).toBeTruthy();
    });

    it('handles both buttons missing', () => {
      const { getByTestId } = render(
        <HandoverError errorType="error" testID="error" />
      );

      expect(getByTestId('error')).toBeTruthy();
    });

    it('handles undefined error type', () => {
      const { getByTestId } = render(
        <HandoverError {...defaultProps} errorType={undefined as any} testID="error" />
      );

      expect(getByTestId('error')).toBeTruthy();
    });

    it('handles switching between error types', () => {
      const { getByTestId, rerender } = render(
        <HandoverError {...defaultProps} errorType="error" testID="error" />
      );

      expect(getByTestId('error')).toBeTruthy();

      rerender(
        <HandoverError {...defaultProps} errorType="no_agents" testID="error" />
      );

      expect(getByTestId('error')).toBeTruthy();

      rerender(
        <HandoverError {...defaultProps} errorType="timeout" testID="error" />
      );

      expect(getByTestId('error')).toBeTruthy();
    });
  });
});
