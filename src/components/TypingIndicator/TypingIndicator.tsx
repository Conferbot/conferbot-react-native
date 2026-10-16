import React, { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import type { ConferBotTheme } from '../../theme/types';
import type { MascotLook } from '../../core/mascotArt';
import { typingLabel } from '../../core/mascotMoods';
import { useReducedMotion } from '../FloatingWidget/fxAnimated';
import { MascotSvg } from '../Mascot/MascotFigure';
import { TypingMascot, TypingPencil, canDrawPencil } from '../Mascot/TypingMascot';

export interface TypingIndicatorProps {
  // Visibility. isTyping takes precedence when provided; `visible` is the
  // legacy prop used by MessageList. When neither is provided the indicator
  // is hidden.
  isTyping?: boolean;
  visible?: boolean;

  // Content
  typingText?: string;
  name?: string;
  showName?: boolean;
  avatar?: string;
  showAvatar?: boolean;

  // Dots
  dotColor?: string;
  dotSize?: number;
  dotCount?: number;

  // Animation
  animated?: boolean;
  animationType?: 'bounce' | 'pulse' | 'fade';
  animationSpeed?: number;
  animationDuration?: number;
  dotAnimationDelay?: number;

  // Styling
  backgroundColor?: string;
  /**
   * The owner's typing style (typingStyle, web chatChrome.ts): dots, an
   * equaliser wave, a shimmering "Typing...", a pencil writing a line, or
   * the bot's mascot swaying beside three thought dots. Pencil and mascot
   * need react-native-svg (else dots).
   */
  variant?: 'dots' | 'wave' | 'shimmer' | 'pencil' | 'mascot';
  /** The owner's mascot and its colour (the launcher's), for the mascot style; "Pip is typing" when named. */
  mascot?: { look: Partial<MascotLook>; accent: string } | null;
  /** The pencil's colour (the launcher's); defaults to the mascot's accent. */
  accent?: string;
  textColor?: string;
  size?: 'small' | 'medium' | 'large';
  style?: 'bubble' | 'minimal' | 'text';

  // Accessibility
  accessibilityLabel?: string;
  testID?: string;
}

const SIZE_SCALE: Record<'small' | 'medium' | 'large', number> = {
  small: 0.75,
  medium: 1,
  large: 1.5,
};

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  isTyping,
  visible,
  typingText,
  name,
  showName = false,
  avatar,
  showAvatar = true,
  dotColor,
  dotSize = 6,
  dotCount = 3,
  animated = true,
  animationSpeed = 600,
  animationDuration,
  dotAnimationDelay,
  backgroundColor,
  textColor,
  size = 'medium',
  style = 'bubble',
  variant = 'dots',
  mascot,
  accent,
  accessibilityLabel,
  testID,
}) => {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const drawMascot = variant === 'mascot' && !!MascotSvg;
  const drawPencil = variant === 'pencil' && !!MascotSvg && canDrawPencil();
  const shown = isTyping !== undefined ? isTyping : visible === true;
  const effectiveDotCount = Math.max(0, Math.min(dotCount, 10));
  const effectiveDotSize = dotSize * SIZE_SCALE[size];
  const duration = animationDuration ?? animationSpeed;
  const styles = createStyles(theme, effectiveDotSize);

  // Animation values, one per dot (max 10)
  const dotOpacities = useRef(
    Array.from({ length: 10 }, () => new Animated.Value(0.3))
  ).current;

  useEffect(() => {
    if (!shown || !animated || effectiveDotCount === 0 || drawMascot || drawPencil) {
      // Reset to initial state
      dotOpacities.forEach((v) => v.setValue(0.3));
      return undefined;
    }

    // Create pulsing animation for each dot with delay
    const animateDot = (animatedValue: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(animatedValue, {
            toValue: 1,
            duration: duration / 3,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue, {
            toValue: 0.3,
            duration: duration / 3,
            useNativeDriver: true,
          }),
        ])
      );
    };

    // Start animations with staggered delays
    const perDotDelay = dotAnimationDelay ?? duration / 3;
    const animations = dotOpacities
      .slice(0, effectiveDotCount)
      .map((value, index) => animateDot(value, index * perDotDelay));

    animations.forEach((animation) => animation.start());

    return () => {
      animations.forEach((animation) => animation.stop());
    };
  }, [shown, animated, duration, dotAnimationDelay, effectiveDotCount, dotOpacities, drawMascot, drawPencil]);

  if (!shown) {
    return null;
  }

  // In the bot's text colour on the bot's bubble, as on the web.
  const color = dotColor || theme.colors.botBubbleText;
  const wave = variant === 'wave';
  const shimmer = variant === 'shimmer';
  const resolvedTextColor = textColor || theme.colors.textSecondary;

  // "Pip is typing" when the owner named their mascot (chatChrome.ts typingBubbleHtml).
  const label = accessibilityLabel ?? (variant === 'mascot' && mascot?.look?.name ? typingLabel('mascot', mascot.look.name) : 'Agent is typing');
  const penAccent = accent || mascot?.accent || theme.colors.primary;

  const containerStyle = [
    styles.container,
    drawMascot && styles.containerMascot,
    drawPencil && styles.containerPencil,
    style === 'minimal' && styles.containerMinimal,
    style === 'text' && styles.containerMinimal,
    backgroundColor !== undefined && { backgroundColor },
  ];

  return (
    <View
      style={containerStyle}
      accessible={true}
      accessibilityLabel={label}
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      testID={testID}
    >
      {showAvatar && avatar ? (
        <Image source={{ uri: avatar }} style={styles.avatar} />
      ) : null}

      {showName && name ? (
        <Text style={[styles.text, { color: resolvedTextColor }]} numberOfLines={1}>
          {name}
        </Text>
      ) : null}

      {drawMascot && mascot ? (
        <TypingMascot look={mascot.look} accent={mascot.accent} ink={color} reduced={reduced || !animated} Svg={MascotSvg!} />
      ) : null}
      {drawMascot && !mascot ? <TypingMascot look={{}} accent={penAccent} ink={color} reduced={reduced || !animated} Svg={MascotSvg!} /> : null}

      {drawPencil ? <TypingPencil accent={penAccent} ink={color} reduced={reduced || !animated} Svg={MascotSvg!} /> : null}

      {shimmer && (
        <Animated.Text style={[styles.shimmer, { color, opacity: animated ? dotOpacities[0] : 0.8 }]}>Typing...</Animated.Text>
      )}

      {style !== 'text' && !shimmer && !drawMascot && !drawPencil &&
        Array.from({ length: wave ? 5 : effectiveDotCount }, (_, index) => (
          <Animated.View
            key={index}
            style={[
              wave ? styles.bar : styles.dot,
              { backgroundColor: color, opacity: animated ? dotOpacities[index] : 0.6 },
              wave && animated && { transform: [{ scaleY: dotOpacities[index] }] },
            ]}
          />
        ))}

      {typingText ? (
        <Text style={[styles.text, { color: resolvedTextColor }]} numberOfLines={1}>
          {typingText}
        </Text>
      ) : null}
    </View>
  );
};

const createStyles = (theme: ConferBotTheme, dotSize: number) =>
  StyleSheet.create({
    // The web's typing bubble: 36 tall, at least 54 wide, 18/18/18/6 corners.
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      height: 36,
      minWidth: 54,
      paddingHorizontal: 12,
      backgroundColor: theme.colors.botBubble,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      borderBottomRightRadius: 18,
      borderBottomLeftRadius: 6,
      alignSelf: 'flex-start',
    },
    // The mascot's bubble: 42 tall, 6 / 12 at the sides; the pencil's at least 70 wide.
    containerMascot: {
      height: 42,
      paddingLeft: 6,
      paddingRight: 12,
    },
    containerPencil: {
      minWidth: 70,
    },
    bar: {
      width: 3,
      height: 16,
      borderRadius: 3,
    },
    shimmer: {
      fontSize: 13,
      fontWeight: '600',
    },
    containerMinimal: {
      backgroundColor: 'transparent',
      paddingHorizontal: 0,
      paddingVertical: 0,
    },
    dot: {
      width: dotSize,
      height: dotSize,
      borderRadius: dotSize / 2,
    },
    avatar: {
      width: 20,
      height: 20,
      borderRadius: 10,
      marginRight: theme.spacing.xs,
    },
    text: {
      fontSize: theme.typography.fontSize.sm,
      maxWidth: 220,
    },
  });
