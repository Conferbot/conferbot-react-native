// @ts-nocheck
/**
 * CategoryFilter Component
 *
 * Horizontal scrollable category filter/selection component
 */
import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { useTheme } from '../../theme';
import type { ConferBotTheme } from '../../theme/types';
import type { KBCategoryWithArticles } from './types';

export interface CategoryFilterProps {
  categories?: KBCategoryWithArticles[] | KBCategory[];
  /** Selected category object (legacy API) */
  selectedCategory?: KBCategoryWithArticles | null;
  /** Selected category id (preferred API) */
  selectedCategoryId?: string | null;
  /** Called with the full category object, or null for "All" (legacy API) */
  onSelectCategory?: (category: KBCategoryWithArticles | null) => void;
  /** Called with the category id, or null for "All" (preferred API) */
  onCategorySelect?: (categoryId: string | null) => void;
  showAllOption?: boolean;
  /** Label for the "All" chip (legacy alias of allOptionText) */
  allLabel?: string;
  /** Label for the "All" chip */
  allOptionText?: string;
  showIcons?: boolean;
  showDescriptions?: boolean;
  showCount?: boolean;
  layout?: 'horizontal' | 'vertical' | 'grid';
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * Scrollable category filter with "All" option
 */
export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  categories = [],
  selectedCategory = null,
  selectedCategoryId,
  onSelectCategory,
  onCategorySelect,
  showAllOption = true,
  allLabel = 'All',
  allOptionText,
  showIcons = true,
  showDescriptions = false,
  showCount = true,
  layout = 'horizontal',
  accessibilityLabel,
  testID,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const scrollViewRef = useRef<ScrollView>(null);

  const categoryId = (category: any): string => category?._id ?? category?.id;
  const effectiveSelectedId =
    selectedCategoryId !== undefined ? selectedCategoryId : selectedCategory ? categoryId(selectedCategory) : null;
  const allChipLabel = allOptionText ?? allLabel;

  const handleSelect = (category: any | null) => {
    onSelectCategory?.(category);
    onCategorySelect?.(category ? categoryId(category) : null);
  };

  // Scroll to selected category (horizontal layout only)
  useEffect(() => {
    if (layout === 'horizontal' && effectiveSelectedId && scrollViewRef.current) {
      const index = categories.findIndex((c) => categoryId(c) === effectiveSelectedId);
      if (index !== -1) {
        // Approximate scroll position
        const scrollX = (index + (showAllOption ? 1 : 0)) * 100;
        scrollViewRef.current.scrollTo({ x: scrollX - 50, animated: true });
      }
    }
  }, [effectiveSelectedId, categories, showAllOption, layout]);

  const horizontal = layout === 'horizontal';

  return (
    <View
      style={styles.container}
      accessible={accessibilityLabel !== undefined}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <ScrollView
        ref={scrollViewRef}
        horizontal={horizontal}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, layout === 'grid' && styles.gridContent]}
      >
        {/* All option */}
        {showAllOption && (
          <CategoryChip
            label={allChipLabel}
            isSelected={effectiveSelectedId === null || effectiveSelectedId === undefined}
            onPress={() => handleSelect(null)}
            theme={theme}
            testID={`${testID}-all`}
          />
        )}

        {/* Category chips */}
        {categories.map((category: any, index) => (
          <CategoryChip
            key={categoryId(category)}
            label={category.name}
            icon={showIcons ? category.icon : undefined}
            description={showDescriptions ? category.description : undefined}
            articleCount={showCount ? category.articles?.length || category.articleCount : undefined}
            isSelected={effectiveSelectedId === categoryId(category)}
            onPress={() => handleSelect(category)}
            theme={theme}
            animationDelay={index * 50}
            testID={`${testID}-${categoryId(category)}`}
          />
        ))}
      </ScrollView>
    </View>
  );
};

// Category Chip Component
interface CategoryChipProps {
  label: string;
  icon?: string;
  description?: string;
  articleCount?: number;
  isSelected: boolean;
  onPress: () => void;
  theme: ConferBotTheme;
  animationDelay?: number;
  testID?: string;
}

const CategoryChip: React.FC<CategoryChipProps> = ({
  label,
  icon,
  description,
  articleCount,
  isSelected,
  onPress,
  theme,
  animationDelay = 0,
  testID,
}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;

  // Entrance animation
  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      delay: animationDelay,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, [animationDelay, scaleAnim]);

  // Press animation
  const handlePressIn = () => {
    Animated.spring(pressAnim, {
      toValue: 0.95,
      tension: 100,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressAnim, {
      toValue: 1,
      tension: 100,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  const chipStyles = StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.full,
      marginRight: theme.spacing.sm,
      backgroundColor: isSelected ? theme.colors.primary : theme.colors.surface,
      borderWidth: 1,
      borderColor: isSelected ? theme.colors.primary : theme.colors.border,
      ...theme.shadows.sm,
    },
    label: {
      fontSize: theme.typography.fontSize.sm,
      fontWeight: isSelected
        ? theme.typography.fontWeight.semibold
        : theme.typography.fontWeight.regular,
      color: isSelected ? theme.colors.textInverse : theme.colors.text,
    },
    icon: {
      fontSize: 14,
      marginRight: theme.spacing.xs,
    },
    count: {
      fontSize: theme.typography.fontSize.xs,
      color: isSelected ? theme.colors.textInverse : theme.colors.textSecondary,
      marginLeft: theme.spacing.xs,
      opacity: 0.8,
    },
  });

  return (
    <Animated.View
      style={{
        transform: [{ scale: Animated.multiply(scaleAnim, pressAnim) }],
        opacity: scaleAnim,
      }}
    >
      <TouchableOpacity
        style={chipStyles.chip}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.8}
        accessible={true}
        accessibilityLabel={`${label} category${articleCount ? `, ${articleCount} articles` : ''}`}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        testID={testID}
      >
        {icon && <Text style={chipStyles.icon}>{icon}</Text>}
        <View>
          <Text style={chipStyles.label}>{label}</Text>
          {description ? <Text style={chipStyles.count}>{description}</Text> : null}
        </View>
        {articleCount !== undefined && articleCount > 0 && (
          <Text style={chipStyles.count}>({articleCount})</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const createStyles = (theme: ConferBotTheme) =>
  StyleSheet.create({
    container: {
      marginVertical: theme.spacing.sm,
    },
    scrollContent: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
    },
    gridContent: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
  });

export default CategoryFilter;
