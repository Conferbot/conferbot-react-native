/**
 * RatingComponents.test.tsx
 *
 * Tests for rating components (StarRating, OpinionScaleSelector, SliderInput).
 *
 * Rewritten against the real component API: these components take NodeUIState
 * props (nodeId, question, variableName, ...) plus an onSubmit callback, as
 * wired by NodeRenderer. The previous tests targeted a StarRating/OpinionScale/
 * SliderRating API that never existed in this SDK.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import {
  StarRating,
  OpinionScaleSelector,
  SliderInput,
} from '../../src/components/NodeComponents/RatingComponents';
import { createMockTheme } from '../testUtils';

// Mock theme
jest.mock('../../src/theme', () => ({
  useTheme: () => createMockTheme(),
}));

describe('RatingComponents', () => {
  // ========================================
  // STAR RATING TESTS
  // ========================================

  describe('StarRating', () => {
    const defaultProps = {
      type: 'rating' as const,
      nodeId: 'node-1',
      question: 'Rate your experience',
      maxRating: 5,
      variableName: 'rating',
      style: 'stars' as const,
      onSubmit: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('Rendering', () => {
      it('renders the star rating component', () => {
        const { getByTestId } = render(
          <StarRating {...defaultProps} testID="star-rating" />
        );

        expect(getByTestId('star-rating')).toBeTruthy();
      });

      it('renders the question text', () => {
        const { getByText } = render(<StarRating {...defaultProps} />);

        expect(getByText('Rate your experience')).toBeTruthy();
      });

      it('renders one option per rating value', () => {
        const { getByLabelText } = render(
          <StarRating {...defaultProps} maxRating={5} />
        );

        expect(getByLabelText('Rate 1 out of 5')).toBeTruthy();
        expect(getByLabelText('Rate 5 out of 5')).toBeTruthy();
      });

      it('renders custom number of stars', () => {
        const { getByLabelText, queryByLabelText } = render(
          <StarRating {...defaultProps} maxRating={10} />
        );

        expect(getByLabelText('Rate 10 out of 10')).toBeTruthy();
        expect(queryByLabelText('Rate 11 out of 10')).toBeNull();
      });

      it('renders numeric values in numbers style', () => {
        const { getByText } = render(
          <StarRating {...defaultProps} style="numbers" maxRating={3} />
        );

        expect(getByText('1')).toBeTruthy();
        expect(getByText('3')).toBeTruthy();
      });

      it('renders the submit button', () => {
        const { getByText } = render(<StarRating {...defaultProps} />);

        expect(getByText('Submit')).toBeTruthy();
      });

      it('shows the selected rating value after selection', () => {
        const { getByLabelText, getByText } = render(
          <StarRating {...defaultProps} />
        );

        fireEvent.press(getByLabelText('Rate 3 out of 5'));

        expect(getByText('3 / 5')).toBeTruthy();
      });
    });

    describe('Interactions', () => {
      it('calls onSubmit with the selected rating', () => {
        const onSubmit = jest.fn();
        const { getByLabelText, getByText } = render(
          <StarRating {...defaultProps} onSubmit={onSubmit} />
        );

        fireEvent.press(getByLabelText('Rate 4 out of 5'));
        fireEvent.press(getByText('Submit'));

        expect(onSubmit).toHaveBeenCalledWith({
          rating: 4,
          maxRating: 5,
          variableName: 'rating',
        });
      });

      it('allows changing rating before submitting', () => {
        const onSubmit = jest.fn();
        const { getByLabelText, getByText } = render(
          <StarRating {...defaultProps} onSubmit={onSubmit} />
        );

        fireEvent.press(getByLabelText('Rate 2 out of 5'));
        fireEvent.press(getByLabelText('Rate 5 out of 5'));
        fireEvent.press(getByText('Submit'));

        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ rating: 5 })
        );
      });

      it('does not submit when no rating is selected', () => {
        const onSubmit = jest.fn();
        const { getByText } = render(
          <StarRating {...defaultProps} onSubmit={onSubmit} />
        );

        fireEvent.press(getByText('Submit'));

        expect(onSubmit).not.toHaveBeenCalled();
      });

      it('marks the submit button disabled while no rating is selected', () => {
        const { getByLabelText } = render(<StarRating {...defaultProps} />);

        const submit = getByLabelText('Submit rating');
        expect(submit.props.accessibilityState.disabled).toBe(true);
      });
    });

    describe('Accessibility', () => {
      it('exposes the question as the radiogroup label', () => {
        const { getByTestId } = render(
          <StarRating {...defaultProps} testID="star-rating" />
        );

        const container = getByTestId('star-rating');
        expect(container.props.accessibilityRole).toBe('radiogroup');
        expect(container.props.accessibilityLabel).toBe('Rate your experience');
      });

      it('marks the selected star as checked', () => {
        const { getByLabelText } = render(<StarRating {...defaultProps} />);

        fireEvent.press(getByLabelText('Rate 3 out of 5'));

        expect(
          getByLabelText('Rate 3 out of 5').props.accessibilityState.checked
        ).toBe(true);
      });
    });

    describe('Edge Cases', () => {
      it('renders no options when maxRating is 0', () => {
        const { queryByLabelText } = render(
          <StarRating {...defaultProps} maxRating={0} />
        );

        expect(queryByLabelText('Rate 1 out of 0')).toBeNull();
      });

      it('renders hearts style without crashing', () => {
        const { getByTestId } = render(
          <StarRating {...defaultProps} style="hearts" testID="star-rating" />
        );

        expect(getByTestId('star-rating')).toBeTruthy();
      });

      it('renders thumbs style without crashing', () => {
        const { getByTestId } = render(
          <StarRating {...defaultProps} style="thumbs" testID="star-rating" />
        );

        expect(getByTestId('star-rating')).toBeTruthy();
      });
    });
  });

  // ========================================
  // OPINION SCALE TESTS
  // ========================================

  describe('OpinionScaleSelector', () => {
    const defaultProps = {
      type: 'opinionScale' as const,
      nodeId: 'node-2',
      question: 'How likely are you to recommend us?',
      min: 0,
      max: 10,
      variableName: 'nps',
      onSubmit: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('Rendering', () => {
      it('renders the opinion scale', () => {
        const { getByTestId } = render(
          <OpinionScaleSelector {...defaultProps} testID="opinion-scale" />
        );

        expect(getByTestId('opinion-scale')).toBeTruthy();
      });

      it('renders the full 0-10 scale', () => {
        const { getByText } = render(<OpinionScaleSelector {...defaultProps} />);

        expect(getByText('0')).toBeTruthy();
        expect(getByText('10')).toBeTruthy();
      });

      it('renders a custom scale range', () => {
        const { getByText, queryByText } = render(
          <OpinionScaleSelector {...defaultProps} min={1} max={5} />
        );

        expect(getByText('1')).toBeTruthy();
        expect(getByText('5')).toBeTruthy();
        expect(queryByText('6')).toBeNull();
      });

      it('renders min and max labels', () => {
        const { getByText } = render(
          <OpinionScaleSelector
            {...defaultProps}
            minLabel="Not likely"
            maxLabel="Very likely"
          />
        );

        expect(getByText('Not likely')).toBeTruthy();
        expect(getByText('Very likely')).toBeTruthy();
      });

      it('renders the question text', () => {
        const { getByText } = render(<OpinionScaleSelector {...defaultProps} />);

        expect(getByText('How likely are you to recommend us?')).toBeTruthy();
      });

      it('hides numbers when showNumbers is false', () => {
        const { queryByText } = render(
          <OpinionScaleSelector {...defaultProps} showNumbers={false} />
        );

        expect(queryByText('5')).toBeNull();
      });
    });

    describe('Interactions', () => {
      it('calls onSubmit with the selected value', () => {
        const onSubmit = jest.fn();
        const { getByText } = render(
          <OpinionScaleSelector {...defaultProps} onSubmit={onSubmit} />
        );

        fireEvent.press(getByText('7'));
        fireEvent.press(getByText('Submit'));

        expect(onSubmit).toHaveBeenCalledWith({
          value: 7,
          min: 0,
          max: 10,
          variableName: 'nps',
        });
      });

      it('allows changing the selection before submitting', () => {
        const onSubmit = jest.fn();
        const { getByText } = render(
          <OpinionScaleSelector {...defaultProps} onSubmit={onSubmit} />
        );

        fireEvent.press(getByText('3'));
        fireEvent.press(getByText('8'));
        fireEvent.press(getByText('Submit'));

        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ value: 8 })
        );
      });

      it('does not submit when nothing is selected', () => {
        const onSubmit = jest.fn();
        const { getByText } = render(
          <OpinionScaleSelector {...defaultProps} onSubmit={onSubmit} />
        );

        fireEvent.press(getByText('Submit'));

        expect(onSubmit).not.toHaveBeenCalled();
      });
    });

    describe('Accessibility', () => {
      it('exposes the question as the radiogroup label', () => {
        const { getByTestId } = render(
          <OpinionScaleSelector {...defaultProps} testID="opinion-scale" />
        );

        const container = getByTestId('opinion-scale');
        expect(container.props.accessibilityRole).toBe('radiogroup');
      });
    });

    describe('Edge Cases', () => {
      it('handles min equal to max', () => {
        const { getByText } = render(
          <OpinionScaleSelector {...defaultProps} min={5} max={5} />
        );

        expect(getByText('5')).toBeTruthy();
      });

      it('handles negative ranges', () => {
        const { getByText } = render(
          <OpinionScaleSelector {...defaultProps} min={-5} max={5} />
        );

        expect(getByText('-5')).toBeTruthy();
        expect(getByText('5')).toBeTruthy();
      });
    });
  });

  // ========================================
  // SLIDER INPUT TESTS
  // ========================================

  describe('SliderInput', () => {
    const defaultProps = {
      type: 'slider' as const,
      nodeId: 'node-3',
      question: 'Select a value',
      min: 0,
      max: 100,
      variableName: 'amount',
      onSubmit: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('Rendering', () => {
      it('renders the slider', () => {
        const { getByTestId } = render(
          <SliderInput {...defaultProps} testID="slider-input" />
        );

        expect(getByTestId('slider-input')).toBeTruthy();
      });

      it('renders the question text', () => {
        const { getByText } = render(<SliderInput {...defaultProps} />);

        expect(getByText('Select a value')).toBeTruthy();
      });

      it('shows the current value when showValue is true', () => {
        const { getByText } = render(
          <SliderInput {...defaultProps} defaultValue={50} showValue={true} />
        );

        expect(getByText('50')).toBeTruthy();
      });

      it('renders custom min and max labels', () => {
        const { getByText } = render(
          <SliderInput {...defaultProps} minLabel="0%" maxLabel="100%" />
        );

        expect(getByText('0%')).toBeTruthy();
        expect(getByText('100%')).toBeTruthy();
      });

      it('falls back to numeric min/max labels', () => {
        // showValue=false so the value display does not duplicate the '0' label
        const { getByText } = render(
          <SliderInput {...defaultProps} showValue={false} />
        );

        expect(getByText('0')).toBeTruthy();
        expect(getByText('100')).toBeTruthy();
      });
    });

    describe('Interactions', () => {
      it('submits the default value', () => {
        const onSubmit = jest.fn();
        const { getByText } = render(
          <SliderInput {...defaultProps} defaultValue={40} onSubmit={onSubmit} />
        );

        fireEvent.press(getByText('Submit'));

        expect(onSubmit).toHaveBeenCalledWith({
          value: 40,
          min: 0,
          max: 100,
          variableName: 'amount',
        });
      });

      it('submits min when no default value is given', () => {
        const onSubmit = jest.fn();
        const { getByText } = render(
          <SliderInput {...defaultProps} onSubmit={onSubmit} />
        );

        fireEvent.press(getByText('Submit'));

        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ value: 0 })
        );
      });
    });

    describe('Accessibility', () => {
      it('exposes an adjustable role with value info', () => {
        const { getByTestId } = render(
          <SliderInput {...defaultProps} defaultValue={25} testID="slider-input" />
        );

        const container = getByTestId('slider-input');
        expect(container.props.accessibilityRole).toBe('adjustable');
        expect(container.props.accessibilityValue).toEqual({
          min: 0,
          max: 100,
          now: 25,
        });
      });
    });

    describe('Edge Cases', () => {
      it('handles a negative range', () => {
        const { getByText } = render(
          <SliderInput {...defaultProps} min={-50} max={50} defaultValue={0} />
        );

        expect(getByText('-50')).toBeTruthy();
        expect(getByText('50')).toBeTruthy();
      });

      it('hides value display when showValue is false', () => {
        const { queryByText } = render(
          <SliderInput {...defaultProps} defaultValue={42} showValue={false} />
        );

        expect(queryByText('42')).toBeNull();
      });
    });
  });
});
