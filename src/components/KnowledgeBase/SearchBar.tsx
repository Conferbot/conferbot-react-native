// @ts-nocheck
/**
 * SearchBar Component
 *
 * Search input with debounce for Knowledge Base articles
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Keyboard,
} from 'react-native';
import { useTheme } from '../../theme';
import type { ConferBotTheme } from '../../theme/types';

export interface SearchBarProps {
  value?: string;
  onSearch: (query: string) => void;
  onClear?: () => void;
  placeholder?: string;
  debounceMs?: number;
  autoFocus?: boolean;
  testID?: string;
}

/**
 * SearchBar with debounced search and clear functionality
 */
export const SearchBar: React.FC<SearchBarProps> = ({
  value = '',
  onSearch,
  onClear,
  placeholder = 'Search for articles...',
  debounceMs = 300,
  autoFocus = false,
  testID,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);

  const [query, setQuery] = useState(value);
  const [isFocused, setIsFocused] = useState(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const focusAnimation = useRef(new Animated.Value(0)).current;

  // Sync with external value
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Animate focus state
  useEffect(() => {
    Animated.timing(focusAnimation, {
      toValue: isFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused, focusAnimation]);

  // Handle text change with debounce
  const handleTextChange = useCallback(
    (text: string) => {
      setQuery(text);

      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set new debounce timer
      debounceTimerRef.current = setTimeout(() => {
        onSearch(text);
      }, debounceMs);
    },
    [onSearch, debounceMs]
  );

  // Handle clear
  const handleClear = useCallback(() => {
    setQuery('');
    onSearch('');
    onClear?.();
  }, [onSearch, onClear]);

  // Handle submit
  const handleSubmit = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    onSearch(query);
    Keyboard.dismiss();
  }, [onSearch, query]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Border color animation
  const borderColor = focusAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.border, theme.colors.primary],
  });

  return (
    <Animated.View
      style={[styles.container, { borderColor }]}
      testID={testID}
    >
      {/* Search Icon */}
      <View style={styles.iconContainer}>
        <SearchIcon color={isFocused ? theme.colors.primary : theme.colors.textSecondary} />
      </View>

      {/* Input */}
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={handleTextChange}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textSecondary}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onSubmitEditing={handleSubmit}
        returnKeyType="search"
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="never"
        accessible={true}
        accessibilityLabel="Search articles"
        accessibilityHint="Type to search knowledge base articles"
        testID={`${testID}-input`}
      />

      {/* Clear Button */}
      {query.length > 0 && (
        <TouchableOpacity
          style={styles.clearButton}
          onPress={handleClear}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessible={true}
          accessibilityLabel="Clear search"
          accessibilityRole="button"
          testID={`${testID}-clear`}
        >
          <ClearIcon color={theme.colors.textSecondary} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

// Search Icon Component
const SearchIcon: React.FC<{ color: string }> = ({ color }) => (
  <View style={{ width: 20, height: 20 }}>
    {/* SVG-like icon using RN View */}
    <View
      style={{
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: color,
        marginTop: 1,
        marginLeft: 1,
      }}
    />
    <View
      style={{
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 6,
        height: 2,
        backgroundColor: color,
        transform: [{ rotate: '45deg' }],
      }}
    />
  </View>
);

// Clear Icon Component
const ClearIcon: React.FC<{ color: string }> = ({ color }) => (
  <View style={{ width: 18, height: 18, justifyContent: 'center', alignItems: 'center' }}>
    <View
      style={{
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: color,
        opacity: 0.2,
        position: 'absolute',
      }}
    />
    <View
      style={{
        width: 10,
        height: 2,
        backgroundColor: color,
        transform: [{ rotate: '45deg' }],
        position: 'absolute',
      }}
    />
    <View
      style={{
        width: 10,
        height: 2,
        backgroundColor: color,
        transform: [{ rotate: '-45deg' }],
        position: 'absolute',
      }}
    />
  </View>
);

const createStyles = (theme: ConferBotTheme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1.5,
      paddingHorizontal: theme.spacing.md,
      height: 48,
      ...theme.shadows.sm,
    },
    iconContainer: {
      marginRight: theme.spacing.sm,
    },
    input: {
      flex: 1,
      fontSize: theme.typography.fontSize.md,
      color: theme.colors.text,
      fontFamily: theme.typography.fontFamily,
      paddingVertical: theme.spacing.sm,
    },
    clearButton: {
      padding: theme.spacing.xs,
      marginLeft: theme.spacing.sm,
    },
  });

export default SearchBar;
