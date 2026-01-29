import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
} from 'react-native';
import { useTheme } from '../../theme';
import type { ConferBotTheme } from '../../theme/types';

export interface EmojiButtonProps {
  onPress: () => void;
  isActive?: boolean;
  disabled?: boolean;
  size?: number;
  testID?: string;
}

/**
 * EmojiButton Component
 *
 * A toggle button for opening/closing the emoji picker.
 * Shows an emoji icon and highlights when the picker is open.
 */
export const EmojiButton: React.FC<EmojiButtonProps> = ({
  onPress,
  isActive = false,
  disabled = false,
  size = 36,
  testID,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme, size);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.container,
        isActive && styles.containerActive,
        disabled && styles.containerDisabled,
      ]}
      activeOpacity={0.7}
      accessible={true}
      accessibilityLabel={isActive ? 'Close emoji picker' : 'Open emoji picker'}
      accessibilityRole="button"
      accessibilityState={{ expanded: isActive, disabled }}
      testID={testID}
    >
      <Text style={[styles.icon, disabled && styles.iconDisabled]}>
        {isActive ? '⌨️' : '😊'}
      </Text>
      {isActive && <View style={styles.activeIndicator} />}
    </TouchableOpacity>
  );
};

const createStyles = (theme: ConferBotTheme, size: number) =>
  StyleSheet.create({
    container: {
      width: size,
      height: size,
      borderRadius: theme.borderRadius.full,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'transparent',
    },
    containerActive: {
      backgroundColor: theme.colors.primaryLight + '30',
    },
    containerDisabled: {
      opacity: 0.5,
    },
    icon: {
      fontSize: size * 0.55,
    },
    iconDisabled: {
      opacity: 0.5,
    },
    activeIndicator: {
      position: 'absolute',
      bottom: 2,
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.primary,
    },
  });
