// @ts-nocheck
/**
 * One-tap questions under the agent's greeting (starters) or its latest
 * answer (follow-ups). A tap asks it, as the visitor; the row goes once
 * they have said anything (the context clears `suggestions`).
 */
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../../theme';

export const SuggestionChips: React.FC<{ items: string[]; onPick: (q: string) => void; testID?: string }> = ({ items, onPick, testID }) => {
  const theme = useTheme();
  if (!items?.length) return null;
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        gap: 6,
        marginHorizontal: theme.spacing.chatContentPadding,
        marginVertical: theme.spacing.sm,
      }}
      testID={testID}
      accessibilityLabel="Suggested questions"
    >
      {items.map((q) => (
        <TouchableOpacity
          key={q}
          onPress={() => onPick(q)}
          accessibilityRole="button"
          style={{
            paddingVertical: 8,
            paddingHorizontal: 14,
            borderRadius: theme.borderRadius.full,
            borderWidth: 1,
            borderColor: theme.colors.primary,
            backgroundColor: theme.colors.surface,
            maxWidth: '100%',
          }}
        >
          <Text style={{ color: theme.colors.primary, fontSize: theme.typography.fontSize.sm, fontWeight: '500' }}>{q}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};
