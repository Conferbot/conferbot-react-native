// @ts-nocheck
/**
 * RatingComponents.tsx
 *
 * Components for rating and scale inputs.
 * Includes: StarRating, OpinionScaleSelector, SliderInput
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  Animated,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
} from 'react-native';

import { NodeUIState } from '../../core/nodes/NodeHandler';
import { useTheme } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_WIDTH = SCREEN_WIDTH - 24;

// ========================================
// STAR RATING
// ========================================

interface StarRatingProps extends NodeUIState.Rating {
  onSubmit: (response: any, portName?: string) => void;
  testID?: string;
}

/**
 * StarRating component
 *
 * Displays a rating input with stars, hearts, thumbs, or numbers.
 * Supports half ratings.
 */
export const StarRating: React.FC<StarRatingProps> = ({
  nodeId,
  question,
  maxRating,
  variableName,
  style = 'stars',
  allowHalf = false,
  onSubmit,
  testID,
}) => {
  const theme = useTheme();
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Animation for selection
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const getIcon = (filled: boolean, half: boolean = false): string => {
    switch (style) {
      case 'hearts':
        return filled ? '\u2764' : '\u2661';
      case 'thumbs':
        return filled ? '\uD83D\uDC4D' : '\uD83D\uDC4E';
      case 'numbers':
        return '';
      case 'stars':
      default:
        if (half) return '\u2BE8'; // Half star
        return filled ? '\u2605' : '\u2606';
    }
  };

  const getFilledColor = (): string => {
    switch (style) {
      case 'hearts':
        return '#FF4757';
      case 'thumbs':
        return theme.colors.success;
      default:
        return '#FFD700';
    }
  };

  const handleRatingPress = useCallback(
    (value: number) => {
      if (isSubmitting) return;

      // Animate the selection
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.2,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();

      setRating(value);
    },
    [isSubmitting, scaleAnim]
  );

  const handleSubmit = useCallback(() => {
    if (rating === 0) return;

    setIsSubmitting(true);
    onSubmit({
      rating,
      maxRating,
      variableName,
    });
  }, [rating, maxRating, variableName, onSubmit]);

  const renderRatingItem = (index: number) => {
    const value = index + 1;
    const displayRating = hoverRating || rating;
    const isFilled = displayRating >= value;
    const isHalf = allowHalf && displayRating >= value - 0.5 && displayRating < value;

    if (style === 'numbers') {
      return (
        <TouchableOpacity
          key={index}
          style={[
            styles.numberRatingItem,
            {
              backgroundColor: isFilled
                ? theme.colors.primary
                : theme.colors.surface,
              borderColor: isFilled
                ? theme.colors.primary
                : theme.colors.border,
              borderRadius: theme.borderRadius.full,
            },
          ]}
          onPress={() => handleRatingPress(value)}
          disabled={isSubmitting}
          accessibilityRole="radio"
          accessibilityState={{ checked: rating === value }}
          accessibilityLabel={`Rate ${value} out of ${maxRating}`}
        >
          <Text
            style={[
              styles.numberRatingText,
              {
                color: isFilled
                  ? theme.colors.textInverse
                  : theme.colors.text,
                fontSize: theme.typography.fontSize.md,
              },
            ]}
          >
            {value}
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        key={index}
        style={styles.ratingItem}
        onPress={() => handleRatingPress(value)}
        onPressIn={() => setHoverRating(value)}
        onPressOut={() => setHoverRating(0)}
        disabled={isSubmitting}
        accessibilityRole="radio"
        accessibilityState={{ checked: rating === value }}
        accessibilityLabel={`Rate ${value} out of ${maxRating}`}
      >
        <Animated.Text
          style={[
            styles.ratingIcon,
            {
              color: isFilled || isHalf ? getFilledColor() : theme.colors.border,
              transform: rating === value ? [{ scale: scaleAnim }] : [],
            },
          ]}
        >
          {getIcon(isFilled, isHalf)}
        </Animated.Text>
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={[
        styles.ratingContainer,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
        },
        theme.shadows.sm,
      ]}
      accessibilityRole="radiogroup"
      accessibilityLabel={question}
      testID={testID}
    >
      <Text
        style={[
          styles.questionText,
          {
            color: theme.colors.text,
            fontSize: theme.typography.fontSize.md,
          },
        ]}
      >
        {question}
      </Text>

      <View style={styles.ratingItemsContainer}>
        {Array.from({ length: maxRating }, (_, index) => renderRatingItem(index))}
      </View>

      {rating > 0 && (
        <Text
          style={[
            styles.ratingValue,
            {
              color: theme.colors.textSecondary,
              fontSize: theme.typography.fontSize.sm,
            },
          ]}
        >
          {rating} / {maxRating}
        </Text>
      )}

      <TouchableOpacity
        style={[
          styles.submitButton,
          {
            backgroundColor:
              rating === 0 ? theme.colors.border : theme.colors.primary,
            borderRadius: theme.borderRadius.md,
          },
        ]}
        onPress={handleSubmit}
        disabled={rating === 0 || isSubmitting}
        accessibilityRole="button"
        accessibilityLabel="Submit rating"
        accessibilityState={{ disabled: rating === 0 || isSubmitting }}
      >
        <Text
          style={[
            styles.submitButtonText,
            {
              color:
                rating === 0 ? theme.colors.textDisabled : theme.colors.textInverse,
              fontSize: theme.typography.fontSize.md,
            },
          ]}
        >
          {isSubmitting ? 'Sending...' : 'Submit'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// ========================================
// OPINION SCALE SELECTOR
// ========================================

interface OpinionScaleSelectorProps extends NodeUIState.OpinionScale {
  onSubmit: (response: any, portName?: string) => void;
  testID?: string;
}

/**
 * OpinionScaleSelector component
 *
 * Displays a numeric scale (e.g., 0-10) with optional labels.
 */
export const OpinionScaleSelector: React.FC<OpinionScaleSelectorProps> = ({
  nodeId,
  question,
  min,
  max,
  minLabel,
  maxLabel,
  variableName,
  showNumbers = true,
  onSubmit,
  testID,
}) => {
  const theme = useTheme();
  const [selectedValue, setSelectedValue] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const scaleValues = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const itemWidth = Math.min(40, (MAX_WIDTH - 32 - (scaleValues.length - 1) * 4) / scaleValues.length);

  const handleValuePress = useCallback(
    (value: number) => {
      if (isSubmitting) return;
      setSelectedValue(value);
    },
    [isSubmitting]
  );

  const handleSubmit = useCallback(() => {
    if (selectedValue === null) return;

    setIsSubmitting(true);
    onSubmit({
      value: selectedValue,
      min,
      max,
      variableName,
    });
  }, [selectedValue, min, max, variableName, onSubmit]);

  return (
    <View
      style={[
        styles.opinionScaleContainer,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
        },
        theme.shadows.sm,
      ]}
      accessibilityRole="radiogroup"
      accessibilityLabel={question}
      testID={testID}
    >
      <Text
        style={[
          styles.questionText,
          {
            color: theme.colors.text,
            fontSize: theme.typography.fontSize.md,
          },
        ]}
      >
        {question}
      </Text>

      {(minLabel || maxLabel) && (
        <View style={styles.scaleLabelsContainer}>
          <Text
            style={[
              styles.scaleLabel,
              {
                color: theme.colors.textSecondary,
                fontSize: theme.typography.fontSize.xs,
              },
            ]}
          >
            {minLabel || ''}
          </Text>
          <Text
            style={[
              styles.scaleLabel,
              {
                color: theme.colors.textSecondary,
                fontSize: theme.typography.fontSize.xs,
              },
            ]}
          >
            {maxLabel || ''}
          </Text>
        </View>
      )}

      <View style={styles.scaleItemsContainer}>
        {scaleValues.map((value) => {
          const isSelected = selectedValue === value;
          return (
            <TouchableOpacity
              key={value}
              style={[
                styles.scaleItem,
                {
                  width: itemWidth,
                  height: itemWidth,
                  backgroundColor: isSelected
                    ? theme.colors.primary
                    : theme.colors.surface,
                  borderColor: isSelected
                    ? theme.colors.primary
                    : theme.colors.border,
                  borderRadius: theme.borderRadius.sm,
                },
              ]}
              onPress={() => handleValuePress(value)}
              disabled={isSubmitting}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={`${value}${minLabel && value === min ? `, ${minLabel}` : ''}${maxLabel && value === max ? `, ${maxLabel}` : ''}`}
            >
              {showNumbers && (
                <Text
                  style={[
                    styles.scaleItemText,
                    {
                      color: isSelected
                        ? theme.colors.textInverse
                        : theme.colors.text,
                      fontSize: theme.typography.fontSize.sm,
                    },
                  ]}
                >
                  {value}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[
          styles.submitButton,
          {
            backgroundColor:
              selectedValue === null
                ? theme.colors.border
                : theme.colors.primary,
            borderRadius: theme.borderRadius.md,
          },
        ]}
        onPress={handleSubmit}
        disabled={selectedValue === null || isSubmitting}
        accessibilityRole="button"
        accessibilityLabel="Submit"
        accessibilityState={{ disabled: selectedValue === null || isSubmitting }}
      >
        <Text
          style={[
            styles.submitButtonText,
            {
              color:
                selectedValue === null
                  ? theme.colors.textDisabled
                  : theme.colors.textInverse,
              fontSize: theme.typography.fontSize.md,
            },
          ]}
        >
          {isSubmitting ? 'Sending...' : 'Submit'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// ========================================
// SLIDER INPUT
// ========================================

interface SliderInputProps extends NodeUIState.Slider {
  onSubmit: (response: any, portName?: string) => void;
  testID?: string;
}

/**
 * SliderInput component
 *
 * Displays a slider for selecting a value within a range.
 */
export const SliderInput: React.FC<SliderInputProps> = ({
  nodeId,
  question,
  min,
  max,
  step = 1,
  defaultValue,
  variableName,
  showValue = true,
  minLabel,
  maxLabel,
  onSubmit,
  testID,
}) => {
  const theme = useTheme();
  const [value, setValue] = useState<number>(defaultValue ?? min);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [trackWidth, setTrackWidth] = useState(0);
  const panX = useRef(new Animated.Value(0)).current;

  // Calculate position from value
  const getPositionFromValue = (val: number): number => {
    if (trackWidth === 0) return 0;
    const percentage = (val - min) / (max - min);
    return percentage * trackWidth;
  };

  // Calculate value from position
  const getValueFromPosition = (position: number): number => {
    if (trackWidth === 0) return min;
    const percentage = Math.max(0, Math.min(1, position / trackWidth));
    const rawValue = min + percentage * (max - min);
    const steppedValue = Math.round(rawValue / step) * step;
    return Math.max(min, Math.min(max, steppedValue));
  };

  // Update animated position when value changes
  useEffect(() => {
    const position = getPositionFromValue(value);
    panX.setValue(position);
  }, [value, trackWidth]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isSubmitting,
      onMoveShouldSetPanResponder: () => !isSubmitting,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        const position = evt.nativeEvent.locationX;
        const newValue = getValueFromPosition(position);
        setValue(newValue);
      },
      onPanResponderMove: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        const currentPosition = getPositionFromValue(value);
        const newPosition = currentPosition + gestureState.dx;
        const newValue = getValueFromPosition(newPosition);
        setValue(newValue);
      },
      onPanResponderRelease: () => {
        // Value is already set, nothing to do
      },
    })
  ).current;

  const handleSubmit = useCallback(() => {
    setIsSubmitting(true);
    onSubmit({
      value,
      min,
      max,
      variableName,
    });
  }, [value, min, max, variableName, onSubmit]);

  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <View
      style={[
        styles.sliderContainer,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
        },
        theme.shadows.sm,
      ]}
      accessibilityRole="adjustable"
      accessibilityLabel={question}
      accessibilityValue={{
        min,
        max,
        now: value,
      }}
      testID={testID}
    >
      <Text
        style={[
          styles.questionText,
          {
            color: theme.colors.text,
            fontSize: theme.typography.fontSize.md,
          },
        ]}
      >
        {question}
      </Text>

      {showValue && (
        <Text
          style={[
            styles.sliderValue,
            {
              color: theme.colors.primary,
              fontSize: theme.typography.fontSize.xxl,
            },
          ]}
        >
          {value}
        </Text>
      )}

      <View
        style={styles.sliderTrackContainer}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        {...panResponder.panHandlers}
      >
        <View
          style={[
            styles.sliderTrack,
            {
              backgroundColor: theme.colors.border,
              borderRadius: theme.borderRadius.full,
            },
          ]}
        >
          <View
            style={[
              styles.sliderFill,
              {
                backgroundColor: theme.colors.primary,
                width: `${percentage}%`,
                borderRadius: theme.borderRadius.full,
              },
            ]}
          />
        </View>
        <Animated.View
          style={[
            styles.sliderThumb,
            {
              backgroundColor: theme.colors.primary,
              left: panX,
            },
            theme.shadows.md,
          ]}
        />
      </View>

      <View style={styles.sliderLabelsContainer}>
        <Text
          style={[
            styles.sliderLabel,
            {
              color: theme.colors.textSecondary,
              fontSize: theme.typography.fontSize.sm,
            },
          ]}
        >
          {minLabel || min}
        </Text>
        <Text
          style={[
            styles.sliderLabel,
            {
              color: theme.colors.textSecondary,
              fontSize: theme.typography.fontSize.sm,
            },
          ]}
        >
          {maxLabel || max}
        </Text>
      </View>

      <TouchableOpacity
        style={[
          styles.submitButton,
          {
            backgroundColor: theme.colors.primary,
            borderRadius: theme.borderRadius.md,
          },
        ]}
        onPress={handleSubmit}
        disabled={isSubmitting}
        accessibilityRole="button"
        accessibilityLabel="Submit"
      >
        <Text
          style={[
            styles.submitButtonText,
            {
              color: theme.colors.textInverse,
              fontSize: theme.typography.fontSize.md,
            },
          ]}
        >
          {isSubmitting ? 'Sending...' : 'Submit'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// ========================================
// STYLES
// ========================================

const styles = StyleSheet.create({
  // Common styles
  questionText: {
    marginBottom: 16,
    fontWeight: '500',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  submitButton: {
    width: '100%',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  submitButtonText: {
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },

  // Star Rating styles
  ratingContainer: {
    marginVertical: 8,
    marginHorizontal: 12,
    padding: 16,
    maxWidth: MAX_WIDTH,
    alignItems: 'center',
  },
  ratingItemsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  ratingItem: {
    padding: 4,
    marginHorizontal: 2,
  },
  ratingIcon: {
    fontSize: 36,
  },
  numberRatingItem: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    marginVertical: 4,
  },
  numberRatingText: {
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  ratingValue: {
    marginTop: 8,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },

  // Opinion Scale styles
  opinionScaleContainer: {
    marginVertical: 8,
    marginHorizontal: 12,
    padding: 16,
    maxWidth: MAX_WIDTH,
  },
  scaleLabelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  scaleLabel: {
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
    maxWidth: '40%',
  },
  scaleItemsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  scaleItem: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
    marginVertical: 4,
  },
  scaleItemText: {
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },

  // Slider styles
  sliderContainer: {
    marginVertical: 8,
    marginHorizontal: 12,
    padding: 16,
    maxWidth: MAX_WIDTH,
  },
  sliderValue: {
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: 16,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  sliderTrackContainer: {
    height: 40,
    justifyContent: 'center',
    position: 'relative',
  },
  sliderTrack: {
    height: 6,
    width: '100%',
    overflow: 'hidden',
  },
  sliderFill: {
    height: '100%',
  },
  sliderThumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    marginLeft: -12,
    top: 8,
  },
  sliderLabelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sliderLabel: {
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
});

export default {
  StarRating,
  OpinionScaleSelector,
  SliderInput,
};
