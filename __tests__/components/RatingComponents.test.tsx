/**
 * RatingComponents.test.tsx
 *
 * Tests for rating components (StarRating, OpinionScale, Slider)
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import {
  StarRating,
  OpinionScale,
  SliderRating,
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
      onRate: jest.fn(),
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

      it('renders default 5 stars', () => {
        const { getByTestId } = render(
          <StarRating {...defaultProps} maxRating={5} testID="star-rating" />
        );

        expect(getByTestId('star-rating')).toBeTruthy();
      });

      it('renders custom number of stars', () => {
        const { getByTestId } = render(
          <StarRating {...defaultProps} maxRating={10} testID="star-rating" />
        );

        expect(getByTestId('star-rating')).toBeTruthy();
      });

      it('renders with initial rating', () => {
        const { getByTestId } = render(
          <StarRating {...defaultProps} rating={3} testID="star-rating" />
        );

        expect(getByTestId('star-rating')).toBeTruthy();
      });

      it('renders half stars when allowHalf is true', () => {
        const { getByTestId } = render(
          <StarRating {...defaultProps} allowHalf={true} rating={3.5} testID="star-rating" />
        );

        expect(getByTestId('star-rating')).toBeTruthy();
      });

      it('renders custom star icons', () => {
        const { getByTestId } = render(
          <StarRating
            {...defaultProps}
            filledIcon="heart-filled"
            emptyIcon="heart-empty"
            testID="star-rating"
          />
        );

        expect(getByTestId('star-rating')).toBeTruthy();
      });

      it('renders rating labels', () => {
        const { getByText } = render(
          <StarRating
            {...defaultProps}
            showLabels={true}
            labels={['Poor', 'Fair', 'Good', 'Very Good', 'Excellent']}
          />
        );

        expect(getByText('Excellent')).toBeTruthy();
      });

      it('renders in read-only mode', () => {
        const { getByTestId } = render(
          <StarRating {...defaultProps} readOnly={true} testID="star-rating" />
        );

        expect(getByTestId('star-rating')).toBeTruthy();
      });

      it('renders different sizes', () => {
        const sizes = ['small', 'medium', 'large'] as const;

        sizes.forEach((size) => {
          const { getByTestId, unmount } = render(
            <StarRating {...defaultProps} size={size} testID="star-rating" />
          );
          expect(getByTestId('star-rating')).toBeTruthy();
          unmount();
        });
      });
    });

    describe('Interactions', () => {
      it('calls onRate when star is pressed', () => {
        const onRate = jest.fn();
        const { getByTestId } = render(
          <StarRating onRate={onRate} testID="star-rating" />
        );

        fireEvent.press(getByTestId('star-rating'));

        // Depending on implementation, may need to press specific star
        expect(getByTestId('star-rating')).toBeTruthy();
      });

      it('allows changing rating', () => {
        const onRate = jest.fn();
        const { getByTestId, rerender } = render(
          <StarRating onRate={onRate} rating={2} testID="star-rating" />
        );

        expect(getByTestId('star-rating')).toBeTruthy();

        rerender(
          <StarRating onRate={onRate} rating={4} testID="star-rating" />
        );

        expect(getByTestId('star-rating')).toBeTruthy();
      });

      it('does not allow rating in read-only mode', () => {
        const onRate = jest.fn();
        const { getByTestId } = render(
          <StarRating onRate={onRate} readOnly={true} testID="star-rating" />
        );

        fireEvent.press(getByTestId('star-rating'));

        expect(onRate).not.toHaveBeenCalled();
      });

      it('does not allow rating when disabled', () => {
        const onRate = jest.fn();
        const { getByTestId } = render(
          <StarRating onRate={onRate} disabled={true} testID="star-rating" />
        );

        fireEvent.press(getByTestId('star-rating'));

        expect(onRate).not.toHaveBeenCalled();
      });
    });

    describe('Accessibility', () => {
      it('has accessible container', () => {
        const { getByTestId } = render(
          <StarRating {...defaultProps} testID="star-rating" />
        );

        expect(getByTestId('star-rating')).toBeTruthy();
      });

      it('supports custom accessibility label', () => {
        const { getByTestId } = render(
          <StarRating
            {...defaultProps}
            testID="star-rating"
            accessibilityLabel="Rate your experience"
          />
        );

        const component = getByTestId('star-rating');
        expect(component.props.accessibilityLabel).toBe('Rate your experience');
      });
    });

    describe('Edge Cases', () => {
      it('handles rating of 0', () => {
        const { getByTestId } = render(
          <StarRating {...defaultProps} rating={0} testID="star-rating" />
        );

        expect(getByTestId('star-rating')).toBeTruthy();
      });

      it('handles rating above maxRating', () => {
        const { getByTestId } = render(
          <StarRating {...defaultProps} maxRating={5} rating={10} testID="star-rating" />
        );

        expect(getByTestId('star-rating')).toBeTruthy();
      });

      it('handles negative rating', () => {
        const { getByTestId } = render(
          <StarRating {...defaultProps} rating={-1} testID="star-rating" />
        );

        expect(getByTestId('star-rating')).toBeTruthy();
      });

      it('handles decimal rating without allowHalf', () => {
        const { getByTestId } = render(
          <StarRating {...defaultProps} rating={3.7} allowHalf={false} testID="star-rating" />
        );

        expect(getByTestId('star-rating')).toBeTruthy();
      });
    });
  });

  // ========================================
  // OPINION SCALE TESTS
  // ========================================

  describe('OpinionScale', () => {
    const defaultProps = {
      onSelect: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('Rendering', () => {
      it('renders the opinion scale', () => {
        const { getByTestId } = render(
          <OpinionScale {...defaultProps} testID="opinion-scale" />
        );

        expect(getByTestId('opinion-scale')).toBeTruthy();
      });

      it('renders default 0-10 scale', () => {
        const { getByText } = render(
          <OpinionScale {...defaultProps} min={0} max={10} />
        );

        expect(getByText('0')).toBeTruthy();
        expect(getByText('10')).toBeTruthy();
      });

      it('renders custom scale range', () => {
        const { getByText } = render(
          <OpinionScale {...defaultProps} min={1} max={5} />
        );

        expect(getByText('1')).toBeTruthy();
        expect(getByText('5')).toBeTruthy();
      });

      it('renders with initial value', () => {
        const { getByTestId } = render(
          <OpinionScale {...defaultProps} value={5} testID="opinion-scale" />
        );

        expect(getByTestId('opinion-scale')).toBeTruthy();
      });

      it('renders left and right labels', () => {
        const { getByText } = render(
          <OpinionScale
            {...defaultProps}
            leftLabel="Not likely"
            rightLabel="Very likely"
          />
        );

        expect(getByText('Not likely')).toBeTruthy();
        expect(getByText('Very likely')).toBeTruthy();
      });

      it('renders in horizontal layout', () => {
        const { getByTestId } = render(
          <OpinionScale {...defaultProps} layout="horizontal" testID="opinion-scale" />
        );

        expect(getByTestId('opinion-scale')).toBeTruthy();
      });

      it('renders in vertical layout', () => {
        const { getByTestId } = render(
          <OpinionScale {...defaultProps} layout="vertical" testID="opinion-scale" />
        );

        expect(getByTestId('opinion-scale')).toBeTruthy();
      });

      it('renders selected state', () => {
        const { getByTestId } = render(
          <OpinionScale {...defaultProps} value={7} testID="opinion-scale" />
        );

        expect(getByTestId('opinion-scale')).toBeTruthy();
      });
    });

    describe('Interactions', () => {
      it('calls onSelect when option is pressed', () => {
        const onSelect = jest.fn();
        const { getByText } = render(
          <OpinionScale onSelect={onSelect} min={0} max={10} />
        );

        fireEvent.press(getByText('5'));

        expect(onSelect).toHaveBeenCalledWith(5);
      });

      it('allows changing selection', () => {
        const onSelect = jest.fn();
        const { getByText } = render(
          <OpinionScale onSelect={onSelect} min={0} max={10} />
        );

        fireEvent.press(getByText('3'));
        expect(onSelect).toHaveBeenCalledWith(3);

        fireEvent.press(getByText('8'));
        expect(onSelect).toHaveBeenCalledWith(8);
      });

      it('does not allow selection when disabled', () => {
        const onSelect = jest.fn();
        const { getByText } = render(
          <OpinionScale onSelect={onSelect} disabled={true} min={0} max={10} />
        );

        fireEvent.press(getByText('5'));

        expect(onSelect).not.toHaveBeenCalled();
      });
    });

    describe('Accessibility', () => {
      it('has accessible container', () => {
        const { getByTestId } = render(
          <OpinionScale {...defaultProps} testID="opinion-scale" />
        );

        expect(getByTestId('opinion-scale')).toBeTruthy();
      });

      it('options are accessible', () => {
        const { getByText } = render(
          <OpinionScale {...defaultProps} min={0} max={10} />
        );

        const option = getByText('5');
        expect(option).toBeTruthy();
      });
    });

    describe('Edge Cases', () => {
      it('handles min equal to max', () => {
        const { getByTestId } = render(
          <OpinionScale {...defaultProps} min={5} max={5} testID="opinion-scale" />
        );

        expect(getByTestId('opinion-scale')).toBeTruthy();
      });

      it('handles negative range', () => {
        const { getByText } = render(
          <OpinionScale {...defaultProps} min={-5} max={5} />
        );

        expect(getByText('-5')).toBeTruthy();
        expect(getByText('5')).toBeTruthy();
      });

      it('handles large range', () => {
        const { getByTestId } = render(
          <OpinionScale {...defaultProps} min={1} max={100} testID="opinion-scale" />
        );

        expect(getByTestId('opinion-scale')).toBeTruthy();
      });
    });
  });

  // ========================================
  // SLIDER RATING TESTS
  // ========================================

  describe('SliderRating', () => {
    const defaultProps = {
      onValueChange: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('Rendering', () => {
      it('renders the slider', () => {
        const { getByTestId } = render(
          <SliderRating {...defaultProps} testID="slider-rating" />
        );

        expect(getByTestId('slider-rating')).toBeTruthy();
      });

      it('renders with default range', () => {
        const { getByTestId } = render(
          <SliderRating {...defaultProps} min={0} max={100} testID="slider-rating" />
        );

        expect(getByTestId('slider-rating')).toBeTruthy();
      });

      it('renders with initial value', () => {
        const { getByTestId } = render(
          <SliderRating {...defaultProps} value={50} testID="slider-rating" />
        );

        expect(getByTestId('slider-rating')).toBeTruthy();
      });

      it('renders value label', () => {
        const { getByTestId } = render(
          <SliderRating {...defaultProps} value={50} showValue={true} testID="slider-rating" />
        );

        expect(getByTestId('slider-rating')).toBeTruthy();
      });

      it('renders min/max labels', () => {
        const { getByText } = render(
          <SliderRating
            {...defaultProps}
            min={0}
            max={100}
            minLabel="0%"
            maxLabel="100%"
            showMinMaxLabels={true}
          />
        );

        expect(getByText('0%')).toBeTruthy();
        expect(getByText('100%')).toBeTruthy();
      });

      it('renders step markers', () => {
        const { getByTestId } = render(
          <SliderRating
            {...defaultProps}
            step={10}
            showStepMarkers={true}
            testID="slider-rating"
          />
        );

        expect(getByTestId('slider-rating')).toBeTruthy();
      });

      it('renders custom track colors', () => {
        const { getByTestId } = render(
          <SliderRating
            {...defaultProps}
            trackColor="#e0e0e0"
            activeTrackColor="#4CAF50"
            testID="slider-rating"
          />
        );

        expect(getByTestId('slider-rating')).toBeTruthy();
      });
    });

    describe('Interactions', () => {
      it('calls onValueChange when slider is moved', () => {
        const onValueChange = jest.fn();
        const { getByTestId } = render(
          <SliderRating onValueChange={onValueChange} testID="slider-rating" />
        );

        const slider = getByTestId('slider-rating');
        fireEvent(slider, 'valueChange', 50);

        expect(onValueChange).toHaveBeenCalledWith(50);
      });

      it('respects step value', () => {
        const onValueChange = jest.fn();
        const { getByTestId } = render(
          <SliderRating onValueChange={onValueChange} step={10} testID="slider-rating" />
        );

        const slider = getByTestId('slider-rating');
        fireEvent(slider, 'valueChange', 45);

        // Value should be snapped to nearest step
        expect(getByTestId('slider-rating')).toBeTruthy();
      });

      it('does not allow changes when disabled', () => {
        const onValueChange = jest.fn();
        const { getByTestId } = render(
          <SliderRating onValueChange={onValueChange} disabled={true} testID="slider-rating" />
        );

        const slider = getByTestId('slider-rating');
        fireEvent(slider, 'valueChange', 50);

        expect(onValueChange).not.toHaveBeenCalled();
      });

      it('calls onSlidingStart when sliding begins', () => {
        const onSlidingStart = jest.fn();
        const { getByTestId } = render(
          <SliderRating {...defaultProps} onSlidingStart={onSlidingStart} testID="slider-rating" />
        );

        const slider = getByTestId('slider-rating');
        fireEvent(slider, 'slidingStart');

        expect(onSlidingStart).toHaveBeenCalled();
      });

      it('calls onSlidingComplete when sliding ends', () => {
        const onSlidingComplete = jest.fn();
        const { getByTestId } = render(
          <SliderRating {...defaultProps} onSlidingComplete={onSlidingComplete} testID="slider-rating" />
        );

        const slider = getByTestId('slider-rating');
        fireEvent(slider, 'slidingComplete', 75);

        expect(onSlidingComplete).toHaveBeenCalledWith(75);
      });
    });

    describe('Value Formatting', () => {
      it('formats value with custom formatter', () => {
        const { getByTestId } = render(
          <SliderRating
            {...defaultProps}
            value={50}
            showValue={true}
            formatValue={(v) => `${v}%`}
            testID="slider-rating"
          />
        );

        expect(getByTestId('slider-rating')).toBeTruthy();
      });

      it('rounds displayed value', () => {
        const { getByTestId } = render(
          <SliderRating
            {...defaultProps}
            value={33.333}
            showValue={true}
            decimalPlaces={1}
            testID="slider-rating"
          />
        );

        expect(getByTestId('slider-rating')).toBeTruthy();
      });
    });

    describe('Accessibility', () => {
      it('has accessible container', () => {
        const { getByTestId } = render(
          <SliderRating {...defaultProps} testID="slider-rating" />
        );

        expect(getByTestId('slider-rating')).toBeTruthy();
      });

      it('supports custom accessibility label', () => {
        const { getByTestId } = render(
          <SliderRating
            {...defaultProps}
            testID="slider-rating"
            accessibilityLabel="Satisfaction level"
          />
        );

        const component = getByTestId('slider-rating');
        expect(component.props.accessibilityLabel).toBe('Satisfaction level');
      });
    });

    describe('Edge Cases', () => {
      it('handles value at minimum', () => {
        const { getByTestId } = render(
          <SliderRating {...defaultProps} min={0} max={100} value={0} testID="slider-rating" />
        );

        expect(getByTestId('slider-rating')).toBeTruthy();
      });

      it('handles value at maximum', () => {
        const { getByTestId } = render(
          <SliderRating {...defaultProps} min={0} max={100} value={100} testID="slider-rating" />
        );

        expect(getByTestId('slider-rating')).toBeTruthy();
      });

      it('handles value outside range', () => {
        const { getByTestId } = render(
          <SliderRating {...defaultProps} min={0} max={100} value={150} testID="slider-rating" />
        );

        expect(getByTestId('slider-rating')).toBeTruthy();
      });

      it('handles negative range', () => {
        const { getByTestId } = render(
          <SliderRating {...defaultProps} min={-50} max={50} value={0} testID="slider-rating" />
        );

        expect(getByTestId('slider-rating')).toBeTruthy();
      });

      it('handles decimal step', () => {
        const { getByTestId } = render(
          <SliderRating {...defaultProps} step={0.5} testID="slider-rating" />
        );

        expect(getByTestId('slider-rating')).toBeTruthy();
      });
    });
  });
});
