import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import type { ConferBotTheme } from '../../theme/types';

export interface EmptyStateProps {
  // Content
  title?: string;
  message?: string;
  icon?: React.ReactNode;

  // Action
  action?: React.ReactNode;

  // Accessibility
  accessibilityLabel?: string;
  testID?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No messages yet',
  message = 'Start a conversation by sending a message',
  icon,
  action,
  accessibilityLabel,
  testID,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);

  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityLabel={accessibilityLabel || `${title}. ${message}`}
      accessibilityRole="text"
      testID={testID}
    >
      {icon && <View style={styles.iconContainer}>{icon}</View>}

      {title && <Text style={styles.title}>{title}</Text>}

      {message && <Text style={styles.message}>{message}</Text>}

      {action && <View style={styles.actionContainer}>{action}</View>}
    </View>
  );
};

const createStyles = (theme: ConferBotTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.xxl,
    },
    iconContainer: {
      marginBottom: theme.spacing.lg,
    },
    title: {
      fontSize: theme.typography.fontSize.xl,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: theme.spacing.sm,
    },
    message: {
      fontSize: theme.typography.fontSize.md,
      fontWeight: theme.typography.fontWeight.regular,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: theme.typography.fontSize.md * theme.typography.lineHeight.relaxed,
      marginBottom: theme.spacing.lg,
    },
    actionContainer: {
      marginTop: theme.spacing.md,
    },
  });
