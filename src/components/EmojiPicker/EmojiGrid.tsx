import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../../theme';
import type { ConferBotTheme } from '../../theme/types';
import { SKIN_TONE_SUPPORTED_EMOJIS } from './emojiData';

export interface EmojiGridProps {
  emojis: string[];
  onEmojiPress: (emoji: string) => void;
  onEmojiLongPress?: (emoji: string, event: { pageX: number; pageY: number }) => void;
  columns?: number;
  emojiSize?: number;
  testID?: string;
}

interface EmojiItemProps {
  emoji: string;
  onPress: (emoji: string) => void;
  onLongPress?: (emoji: string, event: { pageX: number; pageY: number }) => void;
  size: number;
  theme: ConferBotTheme;
  testID?: string;
}

const EmojiItem: React.FC<EmojiItemProps> = ({
  emoji,
  onPress,
  onLongPress,
  size,
  theme,
  testID,
}) => {
  const supportsSkinTone = SKIN_TONE_SUPPORTED_EMOJIS.has(emoji);

  const handlePress = useCallback(() => {
    onPress(emoji);
  }, [emoji, onPress]);

  const handleLongPress = useCallback((event: any) => {
    if (onLongPress && supportsSkinTone) {
      const { pageX, pageY } = event.nativeEvent;
      onLongPress(emoji, { pageX, pageY });
    }
  }, [emoji, onLongPress, supportsSkinTone]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={300}
      activeOpacity={0.7}
      style={{
        width: size,
        height: size,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: theme.borderRadius.md,
      }}
      accessible={true}
      accessibilityLabel={`Emoji ${emoji}`}
      accessibilityRole="button"
      accessibilityHint={supportsSkinTone ? 'Long press for skin tone options' : undefined}
      testID={testID}
    >
      <Text style={{ fontSize: size * 0.65 }}>{emoji}</Text>
    </TouchableOpacity>
  );
};

export const EmojiGrid: React.FC<EmojiGridProps> = ({
  emojis,
  onEmojiPress,
  onEmojiLongPress,
  columns = 8,
  emojiSize = 44,
  testID,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);

  if (emojis.length === 0) {
    return (
      <View style={styles.emptyContainer} testID={`${testID}-empty`}>
        <Text style={styles.emptyText}>No emojis found</Text>
      </View>
    );
  }

  // Create rows for grid layout
  const rows: string[][] = [];
  for (let i = 0; i < emojis.length; i += columns) {
    rows.push(emojis.slice(i, i + columns));
  }

  return (
    <View style={styles.container} testID={testID}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((emoji, colIndex) => (
            <EmojiItem
              key={`${rowIndex}-${colIndex}-${emoji}`}
              emoji={emoji}
              onPress={onEmojiPress}
              onLongPress={onEmojiLongPress}
              size={emojiSize}
              theme={theme}
              testID={`${testID}-emoji-${rowIndex}-${colIndex}`}
            />
          ))}
          {/* Fill empty spaces in last row */}
          {row.length < columns &&
            Array(columns - row.length)
              .fill(null)
              .map((_, i) => (
                <View key={`empty-${i}`} style={{ width: emojiSize, height: emojiSize }} />
              ))}
        </View>
      ))}
    </View>
  );
};

const createStyles = (theme: ConferBotTheme) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: theme.spacing.sm,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
    },
    emptyContainer: {
      padding: theme.spacing.xl,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      fontSize: theme.typography.fontSize.md,
      color: theme.colors.textSecondary,
    },
  });
