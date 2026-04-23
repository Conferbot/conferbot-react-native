// @ts-nocheck
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useTheme } from '../../theme';
import type { ConferBotTheme } from '../../theme/types';
import { EmojiSearchBar } from './EmojiSearchBar';
import { EmojiCategory } from './EmojiCategory';
import { EmojiGrid } from './EmojiGrid';
import { SkinToneSelector } from './SkinToneSelector';
import {
  EMOJI_CATEGORIES,
  searchEmojis,
  RECENT_EMOJIS_STORAGE_KEY,
  MAX_RECENT_EMOJIS,
  type EmojiCategory as EmojiCategoryType,
  type SkinToneId,
} from './emojiData';

const DEFAULT_PICKER_HEIGHT = 300;

export interface EmojiPickerProps {
  visible: boolean;
  onEmojiSelect: (emoji: string) => void;
  onClose?: () => void;
  height?: number;
  showSearch?: boolean;
  showCategories?: boolean;
  showRecent?: boolean;
  columns?: number;
  emojiSize?: number;
  asyncStorage?: {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
  };
  testID?: string;
}

/**
 * EmojiPicker Component
 *
 * A full-featured emoji picker panel with categories, search, and recent emojis.
 *
 * Features:
 * - Category tabs (Smileys, People, Animals, Food, Activities, Travel, Objects, Symbols)
 * - Search/filter emojis by name or keyword
 * - Recently used section (persisted to AsyncStorage)
 * - Skin tone selector on long-press
 * - Smooth scrolling grid
 * - Keyboard-height matching panel
 */
export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  visible,
  onEmojiSelect,
  onClose,
  height = DEFAULT_PICKER_HEIGHT,
  showSearch = true,
  showCategories = true,
  showRecent = true,
  columns = 8,
  emojiSize = 44,
  asyncStorage,
  testID,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme, height);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('smileys');
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const [skinToneModal, setSkinToneModal] = useState<{
    visible: boolean;
    emoji: string;
    position: { x: number; y: number };
  }>({ visible: false, emoji: '', position: { x: 0, y: 0 } });

  const scrollViewRef = useRef<ScrollView>(null);
  const categoryRefs = useRef<Record<string, number>>({});
  const slideAnim = useRef(new Animated.Value(height)).current;

  // Load recent emojis from storage
  useEffect(() => {
    if (asyncStorage && showRecent) {
      asyncStorage.getItem(RECENT_EMOJIS_STORAGE_KEY).then((data) => {
        if (data) {
          try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
              setRecentEmojis(parsed);
            }
          } catch (e) {
            console.warn('[EmojiPicker] Failed to parse recent emojis:', e);
          }
        }
      });
    }
  }, [asyncStorage, showRecent]);

  // Animate slide in/out
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 10,
        tension: 80,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: height,
        duration: theme.animations.duration.fast,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim, height, theme.animations.duration.fast]);

  // Add emoji to recent list
  const addToRecent = useCallback(
    async (emoji: string) => {
      const newRecent = [emoji, ...recentEmojis.filter((e) => e !== emoji)].slice(
        0,
        MAX_RECENT_EMOJIS
      );
      setRecentEmojis(newRecent);

      if (asyncStorage) {
        try {
          await asyncStorage.setItem(RECENT_EMOJIS_STORAGE_KEY, JSON.stringify(newRecent));
        } catch (e) {
          console.warn('[EmojiPicker] Failed to save recent emojis:', e);
        }
      }
    },
    [recentEmojis, asyncStorage]
  );

  // Handle emoji selection
  const handleEmojiPress = useCallback(
    (emoji: string) => {
      addToRecent(emoji);
      onEmojiSelect(emoji);
    },
    [addToRecent, onEmojiSelect]
  );

  // Handle long press for skin tone
  const handleEmojiLongPress = useCallback(
    (emoji: string, event: { pageX: number; pageY: number }) => {
      setSkinToneModal({
        visible: true,
        emoji,
        position: { x: event.pageX, y: event.pageY },
      });
    },
    []
  );

  // Handle skin tone selection
  const handleSkinToneSelect = useCallback(
    (emoji: string, _skinTone: SkinToneId) => {
      handleEmojiPress(emoji);
    },
    [handleEmojiPress]
  );

  // Close skin tone selector
  const closeSkinToneSelector = useCallback(() => {
    setSkinToneModal((prev) => ({ ...prev, visible: false }));
  }, []);

  // Handle category tab press
  const handleCategoryPress = useCallback(
    (categoryId: string) => {
      setActiveCategory(categoryId);
      setSearchQuery('');

      // Scroll to category
      const offset = categoryRefs.current[categoryId];
      if (offset !== undefined && scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ y: offset, animated: true });
      }
    },
    []
  );

  // Track category positions on layout
  const handleCategoryLayout = useCallback(
    (categoryId: string, y: number) => {
      categoryRefs.current[categoryId] = y;
    },
    []
  );

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    return searchEmojis(searchQuery);
  }, [searchQuery]);

  // Categories with recent emojis
  const categoriesWithRecent = useMemo(() => {
    if (!showRecent || recentEmojis.length === 0) {
      return EMOJI_CATEGORIES.filter((c) => c.id !== 'recent');
    }
    return EMOJI_CATEGORIES.map((c) =>
      c.id === 'recent' ? { ...c, emojis: recentEmojis } : c
    );
  }, [showRecent, recentEmojis]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
      testID={testID}
    >
      {/* Search Bar */}
      {showSearch && (
        <EmojiSearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          testID={`${testID}-search`}
        />
      )}

      {/* Category Tabs */}
      {showCategories && !searchQuery && (
        <View style={styles.categoryTabs}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryTabsContent}
          >
            {categoriesWithRecent
              .filter((c) => c.emojis.length > 0)
              .map((category) => (
                <TouchableOpacity
                  key={category.id}
                  onPress={() => handleCategoryPress(category.id)}
                  style={[
                    styles.categoryTab,
                    activeCategory === category.id && styles.categoryTabActive,
                  ]}
                  accessible={true}
                  accessibilityLabel={category.name}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeCategory === category.id }}
                  testID={`${testID}-tab-${category.id}`}
                >
                  <Text style={styles.categoryTabIcon}>{category.icon}</Text>
                </TouchableOpacity>
              ))}
          </ScrollView>
        </View>
      )}

      {/* Emoji Grid */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
      >
        {searchQuery ? (
          // Show search results
          <View style={styles.searchResults}>
            <Text style={styles.searchResultsTitle}>
              Search results for "{searchQuery}"
            </Text>
            <EmojiGrid
              emojis={searchResults || []}
              onEmojiPress={handleEmojiPress}
              onEmojiLongPress={handleEmojiLongPress}
              columns={columns}
              emojiSize={emojiSize}
              testID={`${testID}-search-results`}
            />
          </View>
        ) : (
          // Show categories
          categoriesWithRecent
            .filter((c) => c.emojis.length > 0)
            .map((category) => (
              <View
                key={category.id}
                onLayout={(e: any) => handleCategoryLayout(category.id, e.nativeEvent.layout.y)}
              >
                <EmojiCategory
                  category={category}
                  onEmojiPress={handleEmojiPress}
                  onEmojiLongPress={handleEmojiLongPress}
                  columns={columns}
                  emojiSize={emojiSize}
                  testID={`${testID}-category-${category.id}`}
                />
              </View>
            ))
        )}
        {/* Bottom padding */}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Skin Tone Selector Modal */}
      <SkinToneSelector
        visible={skinToneModal.visible}
        emoji={skinToneModal.emoji}
        position={skinToneModal.position}
        onSelectSkinTone={handleSkinToneSelect}
        onClose={closeSkinToneSelector}
        testID={`${testID}-skin-tone`}
      />
    </Animated.View>
  );
};

const createStyles = (theme: ConferBotTheme, height: number) =>
  StyleSheet.create({
    container: {
      height,
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    categoryTabs: {
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderLight,
    },
    categoryTabsContent: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    categoryTab: {
      width: 40,
      height: 36,
      borderRadius: theme.borderRadius.md,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'transparent',
      marginHorizontal: 2,
    },
    categoryTabActive: {
      backgroundColor: theme.colors.primaryLight + '30',
    },
    categoryTabIcon: {
      fontSize: 20,
    },
    scrollView: {
      flex: 1,
    },
    searchResults: {
      paddingTop: theme.spacing.sm,
    },
    searchResultsTitle: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.textSecondary,
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
    },
  });
