/**
 * KBButton Component
 *
 * Knowledge Base access button for integration into chat header or toolbar
 */
import React, { useRef, useEffect } from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { useTheme } from '../../theme';
import type { ConferBotTheme } from '../../theme/types';

export interface KBButtonProps {
  onPress: () => void;
  variant?: 'icon' | 'text' | 'pill';
  label?: string;
  showBadge?: boolean;
  badgeCount?: number;
  disabled?: boolean;
  testID?: string;
}

/**
 * Button to access Knowledge Base from chat interface
 */
export const KBButton: React.FC<KBButtonProps> = ({
  onPress,
  variant = 'icon',
  label = 'Help',
  showBadge = false,
  badgeCount = 0,
  disabled = false,
  testID,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme, variant);

  // Animation for press feedback
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.9,
      tension: 100,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 100,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[styles.button, disabled && styles.disabled]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessible={true}
        accessibilityLabel={`Open ${label}`}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        testID={testID}
      >
        {/* Icon */}
        <HelpIcon
          color={variant === 'pill' ? theme.colors.textInverse : theme.colors.primary}
          size={variant === 'text' ? 18 : 20}
        />

        {/* Label (for text and pill variants) */}
        {(variant === 'text' || variant === 'pill') && (
          <Text style={styles.label}>{label}</Text>
        )}

        {/* Badge */}
        {showBadge && badgeCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {badgeCount > 99 ? '99+' : badgeCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

// Help/Question Mark Icon
const HelpIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 20 }) => (
  <View
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: 1.5,
      borderColor: color,
      justifyContent: 'center',
      alignItems: 'center',
    }}
  >
    {/* Question mark hook */}
    <View
      style={{
        width: size * 0.35,
        height: size * 0.35,
        borderTopWidth: 1.5,
        borderRightWidth: 1.5,
        borderTopRightRadius: size * 0.2,
        borderColor: color,
        transform: [{ rotate: '45deg' }],
        marginBottom: -2,
      }}
    />
    {/* Question mark dot */}
    <View
      style={{
        width: 2,
        height: 2,
        borderRadius: 1,
        backgroundColor: color,
        marginTop: 1,
      }}
    />
  </View>
);

// Book/Documentation Icon (alternative)
const BookIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 20 }) => (
  <View style={{ width: size, height: size }}>
    {/* Book cover */}
    <View
      style={{
        width: size * 0.85,
        height: size,
        borderRadius: 2,
        borderWidth: 1.5,
        borderColor: color,
        backgroundColor: 'transparent',
      }}
    />
    {/* Book spine */}
    <View
      style={{
        position: 'absolute',
        left: 0,
        top: size * 0.15,
        width: size * 0.1,
        height: size * 0.7,
        backgroundColor: color,
        borderRadius: 1,
      }}
    />
    {/* Page lines */}
    <View
      style={{
        position: 'absolute',
        left: size * 0.25,
        top: size * 0.25,
        width: size * 0.45,
        height: 1.5,
        backgroundColor: color,
      }}
    />
    <View
      style={{
        position: 'absolute',
        left: size * 0.25,
        top: size * 0.45,
        width: size * 0.45,
        height: 1.5,
        backgroundColor: color,
      }}
    />
    <View
      style={{
        position: 'absolute',
        left: size * 0.25,
        top: size * 0.65,
        width: size * 0.3,
        height: 1.5,
        backgroundColor: color,
      }}
    />
  </View>
);

const createStyles = (theme: ConferBotTheme, variant: 'icon' | 'text' | 'pill') =>
  StyleSheet.create({
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      ...(variant === 'icon' && {
        width: 36,
        height: 36,
        borderRadius: 18,
      }),
      ...(variant === 'text' && {
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.xs,
        gap: theme.spacing.xs,
      }),
      ...(variant === 'pill' && {
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        backgroundColor: theme.colors.primary,
        borderRadius: theme.borderRadius.full,
        gap: theme.spacing.xs,
        ...theme.shadows.sm,
      }),
    },
    disabled: {
      opacity: 0.5,
    },
    label: {
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.medium,
      color: variant === 'pill' ? theme.colors.textInverse : theme.colors.primary,
    },
    badge: {
      position: variant === 'icon' ? 'absolute' : 'relative',
      top: variant === 'icon' ? -2 : 0,
      right: variant === 'icon' ? -2 : 0,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: theme.colors.error,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 4,
      marginLeft: variant !== 'icon' ? theme.spacing.xs : 0,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.textInverse,
    },
  });

export default KBButton;
