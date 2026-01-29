import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import type { ConferBotTheme } from '../../theme/types';
import { EmojiGrid } from './EmojiGrid';
import type { EmojiCategory as EmojiCategoryType } from './emojiData';

export interface EmojiCategoryProps {
  category: EmojiCategoryType;
  onEmojiPress: (emoji: string) => void;
  onEmojiLongPress?: (emoji: string, event: { pageX: number; pageY: number }) => void;
  columns?: number;
  emojiSize?: number;
  showHeader?: boolean;
  testID?: string;
}

export const EmojiCategory: React.FC<EmojiCategoryProps> = ({
  category,
  onEmojiPress,
  onEmojiLongPress,
  columns = 8,
  emojiSize = 44,
  showHeader = true,
  testID,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);

  // Don't render if category is empty
  if (category.emojis.length === 0) {
    return null;
  }

  return (
    <View style={styles.container} testID={testID}>
      {showHeader && (
        <View style={styles.header}>
          <Text style={styles.headerIcon}>{category.icon}</Text>
          <Text style={styles.headerText}>{category.name}</Text>
        </View>
      )}
      <EmojiGrid
        emojis={category.emojis}
        onEmojiPress={onEmojiPress}
        onEmojiLongPress={onEmojiLongPress}
        columns={columns}
        emojiSize={emojiSize}
        testID={`${testID}-grid`}
      />
    </View>
  );
};

const createStyles = (theme: ConferBotTheme) =>
  StyleSheet.create({
    container: {
      marginBottom: theme.spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
    },
    headerIcon: {
      fontSize: 16,
      marginRight: theme.spacing.sm,
    },
    headerText: {
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
  });
