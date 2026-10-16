// @ts-nocheck
import React, { useCallback, useRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Text,
} from 'react-native';
import { useTheme } from '../../theme';
import { t } from '../../core/i18n';
import type { ConferBotTheme } from '../../theme/types';

export interface EmojiSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  testID?: string;
}

export const EmojiSearchBar: React.FC<EmojiSearchBarProps> = ({
  value,
  onChangeText,
  placeholder: placeholderProp,
  testID,
}) => {
  const placeholder = placeholderProp ?? t('sdk.emoji.placeholder');
  const theme = useTheme();
  const styles = createStyles(theme);
  const inputRef = useRef<TextInput>(null);

  const handleClear = useCallback(() => {
    onChangeText('');
    inputRef.current?.focus();
  }, [onChangeText]);

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.searchIcon}>
        <Text style={styles.searchIconText}>🔍</Text>
      </View>
      <TextInput
        ref={inputRef}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessible={true}
        accessibilityLabel={t('sdk.emoji.search')}
        accessibilityHint={t('sdk.emoji.searchHint')}
        testID={`${testID}-input`}
      />
      {value.length > 0 && (
        <TouchableOpacity
          style={styles.clearButton}
          onPress={handleClear}
          accessible={true}
          accessibilityLabel={t('kb.clearSearch')}
          accessibilityRole="button"
          testID={`${testID}-clear`}
        >
          <Text style={styles.clearButtonText}>X</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const createStyles = (theme: ConferBotTheme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
      borderRadius: theme.borderRadius.lg,
      paddingHorizontal: theme.spacing.sm,
      marginHorizontal: theme.spacing.md,
      marginVertical: theme.spacing.sm,
      height: 40,
      borderWidth: 1,
      borderColor: theme.colors.borderLight,
    },
    searchIcon: {
      marginRight: theme.spacing.xs,
    },
    searchIconText: {
      fontSize: 16,
    },
    input: {
      flex: 1,
      fontSize: theme.typography.fontSize.md,
      color: theme.colors.text,
      paddingVertical: 0,
    },
    clearButton: {
      padding: theme.spacing.xs,
      marginLeft: theme.spacing.xs,
    },
    clearButtonText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      fontWeight: theme.typography.fontWeight.bold,
    },
  });
