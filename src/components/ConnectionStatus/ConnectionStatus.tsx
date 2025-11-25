import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import { useConferBot } from '../../context/ConferBotContext';
import type { ConferBotTheme } from '../../theme/types';

export interface ConnectionStatusProps {
  // Display mode
  variant?: 'dot' | 'badge' | 'text';

  // Position (for dot variant)
  position?: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left';

  // Custom labels
  onlineLabel?: string;
  offlineLabel?: string;

  // Visibility
  showWhenOnline?: boolean;

  // Accessibility
  accessibilityLabel?: string;
  testID?: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  variant = 'badge',
  position = 'bottom-right',
  onlineLabel = 'Online',
  offlineLabel = 'Offline',
  showWhenOnline = false,
  accessibilityLabel,
  testID,
}) => {
  const theme = useTheme();
  const { isConnected } = useConferBot();
  const styles = createStyles(theme);

  // Don't show if online and showWhenOnline is false
  if (isConnected && !showWhenOnline) {
    return null;
  }

  // Dot variant
  if (variant === 'dot') {
    return (
      <View
        style={[
          styles.dot,
          isConnected ? styles.dotOnline : styles.dotOffline,
          position === 'top-right' && styles.dotTopRight,
          position === 'bottom-right' && styles.dotBottomRight,
          position === 'top-left' && styles.dotTopLeft,
          position === 'bottom-left' && styles.dotBottomLeft,
        ]}
        accessible={true}
        accessibilityLabel={accessibilityLabel || `Connection status: ${isConnected ? onlineLabel : offlineLabel}`}
        accessibilityRole="text"
        testID={testID}
      />
    );
  }

  // Badge variant
  if (variant === 'badge') {
    return (
      <View
        style={[styles.badge, isConnected ? styles.badgeOnline : styles.badgeOffline]}
        accessible={true}
        accessibilityLabel={accessibilityLabel || `Connection status: ${isConnected ? onlineLabel : offlineLabel}`}
        accessibilityRole="text"
        testID={testID}
      >
        <View style={[styles.badgeDot, isConnected ? styles.dotOnline : styles.dotOffline]} />
        <Text style={[styles.badgeText, isConnected ? styles.textOnline : styles.textOffline]}>
          {isConnected ? onlineLabel : offlineLabel}
        </Text>
      </View>
    );
  }

  // Text variant
  return (
    <Text
      style={[styles.text, isConnected ? styles.textOnline : styles.textOffline]}
      accessible={true}
      accessibilityLabel={accessibilityLabel || `Connection status: ${isConnected ? onlineLabel : offlineLabel}`}
      accessibilityRole="text"
      testID={testID}
    >
      {isConnected ? onlineLabel : offlineLabel}
    </Text>
  );
};

const createStyles = (theme: ConferBotTheme) =>
  StyleSheet.create({
    // Dot styles
    dot: {
      width: 10,
      height: 10,
      borderRadius: theme.borderRadius.full,
      borderWidth: 2,
      borderColor: theme.colors.surface,
    },
    dotOnline: {
      backgroundColor: theme.colors.online,
    },
    dotOffline: {
      backgroundColor: theme.colors.offline,
    },
    dotTopRight: {
      position: 'absolute',
      top: 0,
      right: 0,
    },
    dotBottomRight: {
      position: 'absolute',
      bottom: 0,
      right: 0,
    },
    dotTopLeft: {
      position: 'absolute',
      top: 0,
      left: 0,
    },
    dotBottomLeft: {
      position: 'absolute',
      bottom: 0,
      left: 0,
    },

    // Badge styles
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.borderRadius.full,
      gap: theme.spacing.xs,
    },
    badgeOnline: {
      backgroundColor: `${theme.colors.online}15`,
    },
    badgeOffline: {
      backgroundColor: `${theme.colors.offline}15`,
    },
    badgeDot: {
      width: 6,
      height: 6,
      borderRadius: theme.borderRadius.full,
    },
    badgeText: {
      fontSize: theme.typography.fontSize.xs,
      fontWeight: theme.typography.fontWeight.medium,
    },

    // Text styles
    text: {
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.medium,
    },
    textOnline: {
      color: theme.colors.online,
    },
    textOffline: {
      color: theme.colors.offline,
    },
  });
