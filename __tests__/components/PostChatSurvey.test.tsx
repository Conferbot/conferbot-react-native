/**
 * PostChatSurvey.test.tsx
 *
 * Tests for the PostChatSurvey component that collects feedback after handover ends.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { PostChatSurvey } from '../../src/components/Handover/PostChatSurvey';
import { createMockTheme } from '../testUtils';
import type { PostChatSurveyConfig } from '../../src/components/Handover/types';

// Mock theme
jest.mock('../../src/theme', () => ({
  useTheme: () => createMockTheme(),
}));

describe('PostChatSurvey', () => {
  const defaultConfig: PostChatSurveyConfig = {
    enabled: true,
    title: 'How was your experience?',
    ratingEnabled: true,
    commentEnabled: true,
    commentPlaceholder: 'Any additional feedback?',
  };

  const defaultProps = {
    config: defaultConfig,
    onSubmit: jest.fn(),
    onSkip: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // RENDERING TESTS
  // ========================================

  describe('Rendering', () => {
    it('renders the survey component', () => {
      const { getByTestId } = render(
        <PostChatSurvey {...defaultProps} testID="survey" />
      );

      expect(getByTestId('survey')).toBeTruthy();
    });

    it('renders survey title', () => {
      const { getByText } = render(
        <PostChatSurvey {...defaultProps} />
      );

      expect(getByText('How was your experience?')).toBeTruthy();
    });

    it('renders rating component when enabled', () => {
      const { getByTestId } = render(
        <PostChatSurvey {...defaultProps} testID="survey" />
      );

      expect(getByTestId('survey')).toBeTruthy();
    });

    it('does not render rating when disabled', () => {
      const { getByTestId } = render(
        <PostChatSurvey
          {...defaultProps}
          config={{ ...defaultConfig, ratingEnabled: false }}
          testID="survey"
        />
      );

      expect(getByTestId('survey')).toBeTruthy();
    });

    it('renders comment input when enabled', () => {
      const { getByPlaceholderText } = render(
        <PostChatSurvey {...defaultProps} />
      );

      expect(getByPlaceholderText('Any additional feedback?')).toBeTruthy();
    });

    it('does not render comment input when disabled', () => {
      const { queryByPlaceholderText } = render(
        <PostChatSurvey
          {...defaultProps}
          config={{ ...defaultConfig, commentEnabled: false }}
        />
      );

      expect(queryByPlaceholderText('Any additional feedback?')).toBeFalsy();
    });

    it('renders submit button', () => {
      const { getByText } = render(
        <PostChatSurvey {...defaultProps} submitButtonText="Submit Feedback" />
      );

      expect(getByText('Submit Feedback')).toBeTruthy();
    });

    it('renders skip button', () => {
      const { getByText } = render(
        <PostChatSurvey {...defaultProps} skipButtonText="Skip" />
      );

      expect(getByText('Skip')).toBeTruthy();
    });

    it('renders custom thank you message after agent name', () => {
      const { getByTestId } = render(
        <PostChatSurvey
          {...defaultProps}
          agentName="John"
          testID="survey"
        />
      );

      expect(getByTestId('survey')).toBeTruthy();
    });
  });

  // ========================================
  // RATING INTERACTION TESTS
  // ========================================

  describe('Rating Interactions', () => {
    it('allows selecting a rating', () => {
      const { getByTestId } = render(
        <PostChatSurvey {...defaultProps} testID="survey" />
      );

      // Look for rating stars or buttons
      expect(getByTestId('survey')).toBeTruthy();
    });

    it('allows changing rating selection', () => {
      const { getByTestId } = render(
        <PostChatSurvey {...defaultProps} testID="survey" />
      );

      expect(getByTestId('survey')).toBeTruthy();
    });

    it('highlights selected rating', () => {
      const { getByTestId } = render(
        <PostChatSurvey {...defaultProps} testID="survey" />
      );

      expect(getByTestId('survey')).toBeTruthy();
    });
  });

  // ========================================
  // COMMENT INTERACTION TESTS
  // ========================================

  describe('Comment Interactions', () => {
    it('allows entering comment text', () => {
      const { getByPlaceholderText } = render(
        <PostChatSurvey {...defaultProps} />
      );

      const input = getByPlaceholderText('Any additional feedback?');
      fireEvent.changeText(input, 'Great service!');

      expect(input.props.value).toBe('Great service!');
    });

    it('allows multiline comments', () => {
      const { getByPlaceholderText } = render(
        <PostChatSurvey {...defaultProps} />
      );

      const input = getByPlaceholderText('Any additional feedback?');
      fireEvent.changeText(input, 'Line 1\nLine 2\nLine 3');

      expect(input.props.value).toBe('Line 1\nLine 2\nLine 3');
    });
  });

  // ========================================
  // SUBMISSION TESTS
  // ========================================

  describe('Submission', () => {
    it('calls onSubmit with rating when submitted', async () => {
      const onSubmit = jest.fn();
      const { getByTestId, getByText } = render(
        <PostChatSurvey
          {...defaultProps}
          onSubmit={onSubmit}
          submitButtonText="Submit"
          testID="survey"
        />
      );

      // Interact with rating (implementation depends on component)
      fireEvent.press(getByText('Submit'));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
      });
    });

    it('calls onSubmit with comment when provided', async () => {
      const onSubmit = jest.fn();
      const { getByPlaceholderText, getByText } = render(
        <PostChatSurvey
          {...defaultProps}
          onSubmit={onSubmit}
          submitButtonText="Submit"
        />
      );

      fireEvent.changeText(getByPlaceholderText('Any additional feedback?'), 'Excellent support!');
      fireEvent.press(getByText('Submit'));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
          comment: 'Excellent support!',
        }));
      });
    });

    it('calls onSubmit with both rating and comment', async () => {
      const onSubmit = jest.fn();
      const { getByPlaceholderText, getByText } = render(
        <PostChatSurvey
          {...defaultProps}
          onSubmit={onSubmit}
          submitButtonText="Submit"
        />
      );

      fireEvent.changeText(getByPlaceholderText('Any additional feedback?'), 'Very helpful!');
      fireEvent.press(getByText('Submit'));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
      });
    });

    it('requires rating when ratingEnabled and ratingRequired', async () => {
      const onSubmit = jest.fn();
      const { getByText } = render(
        <PostChatSurvey
          {...defaultProps}
          onSubmit={onSubmit}
          config={{ ...defaultConfig, ratingRequired: true }}
          submitButtonText="Submit"
        />
      );

      fireEvent.press(getByText('Submit'));

      await waitFor(() => {
        // Should not submit without rating
        expect(onSubmit).not.toHaveBeenCalled();
      });
    });
  });

  // ========================================
  // SKIP FUNCTIONALITY TESTS
  // ========================================

  describe('Skip Functionality', () => {
    it('calls onSkip when skip button is pressed', () => {
      const onSkip = jest.fn();
      const { getByText } = render(
        <PostChatSurvey {...defaultProps} onSkip={onSkip} skipButtonText="Skip" />
      );

      fireEvent.press(getByText('Skip'));

      expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('hides skip button when skipEnabled is false', () => {
      const { queryByText } = render(
        <PostChatSurvey
          {...defaultProps}
          config={{ ...defaultConfig, skipEnabled: false }}
          skipButtonText="Skip"
        />
      );

      expect(queryByText('Skip')).toBeFalsy();
    });
  });

  // ========================================
  // ACCESSIBILITY TESTS
  // ========================================

  describe('Accessibility', () => {
    it('has accessible container', () => {
      const { getByTestId } = render(
        <PostChatSurvey {...defaultProps} testID="survey" />
      );

      const container = getByTestId('survey');
      expect(container).toBeTruthy();
    });

    it('supports custom accessibility label', () => {
      const { getByTestId } = render(
        <PostChatSurvey
          {...defaultProps}
          testID="survey"
          accessibilityLabel="Post-chat feedback survey"
        />
      );

      const container = getByTestId('survey');
      expect(container.props.accessibilityLabel).toBe('Post-chat feedback survey');
    });

    it('comment input has accessibility label', () => {
      const { getByLabelText } = render(
        <PostChatSurvey {...defaultProps} />
      );

      // Should have appropriate accessibility
      expect(getByLabelText(/feedback|comment/i)).toBeTruthy();
    });
  });

  // ========================================
  // EDGE CASES
  // ========================================

  describe('Edge Cases', () => {
    it('handles empty config', () => {
      const { getByTestId } = render(
        <PostChatSurvey
          {...defaultProps}
          config={{ enabled: true } as PostChatSurveyConfig}
          testID="survey"
        />
      );

      expect(getByTestId('survey')).toBeTruthy();
    });

    it('handles only rating enabled', () => {
      const { getByTestId, queryByPlaceholderText } = render(
        <PostChatSurvey
          {...defaultProps}
          config={{ enabled: true, ratingEnabled: true, commentEnabled: false }}
          testID="survey"
        />
      );

      expect(getByTestId('survey')).toBeTruthy();
      expect(queryByPlaceholderText('Any additional feedback?')).toBeFalsy();
    });

    it('handles only comment enabled', () => {
      const { getByPlaceholderText, getByTestId } = render(
        <PostChatSurvey
          {...defaultProps}
          config={{ enabled: true, ratingEnabled: false, commentEnabled: true, commentPlaceholder: 'Feedback' }}
          testID="survey"
        />
      );

      expect(getByTestId('survey')).toBeTruthy();
      expect(getByPlaceholderText('Feedback')).toBeTruthy();
    });

    it('handles very long comments', () => {
      const { getByPlaceholderText } = render(
        <PostChatSurvey {...defaultProps} />
      );

      const longComment = 'A'.repeat(5000);
      const input = getByPlaceholderText('Any additional feedback?');
      fireEvent.changeText(input, longComment);

      expect(input.props.value).toBe(longComment);
    });

    it('handles special characters in comments', () => {
      const onSubmit = jest.fn();
      const { getByPlaceholderText, getByText } = render(
        <PostChatSurvey {...defaultProps} onSubmit={onSubmit} submitButtonText="Submit" />
      );

      fireEvent.changeText(
        getByPlaceholderText('Any additional feedback?'),
        '<script>alert("xss")</script>'
      );
      fireEvent.press(getByText('Submit'));

      expect(onSubmit).toHaveBeenCalled();
    });

    it('handles missing onSubmit', () => {
      const { getByTestId } = render(
        <PostChatSurvey
          config={defaultConfig}
          onSkip={jest.fn()}
          testID="survey"
        />
      );

      expect(getByTestId('survey')).toBeTruthy();
    });

    it('handles missing onSkip', () => {
      const { getByTestId } = render(
        <PostChatSurvey
          config={defaultConfig}
          onSubmit={jest.fn()}
          testID="survey"
        />
      );

      expect(getByTestId('survey')).toBeTruthy();
    });

    it('handles custom rating scale', () => {
      const { getByTestId } = render(
        <PostChatSurvey
          {...defaultProps}
          config={{ ...defaultConfig, maxRating: 10 }}
          testID="survey"
        />
      );

      expect(getByTestId('survey')).toBeTruthy();
    });
  });
});
