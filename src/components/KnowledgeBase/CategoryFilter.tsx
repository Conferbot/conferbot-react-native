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
  categories: KBCategoryWithArticles[];
  selectedCategory: KBCategoryWithArticles | null;
  onSelectCategory: (category: KBCategoryWithArticles | null) => void;
  showAllOption?: boolean;
  allLabel?: string;
  testID?: string;
}

/**
 * Horizontal category filter with "All" option
 */
export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
  showAllOption = true,
  allLabel = 'All',
  testID,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const scrollViewRef = useRef<ScrollView>(null);

  // Scroll to selected category
  useEffect(() => {
    if (selectedCategory && scrollViewRef.current) {
      const index = categories.findIndex((c) => c._id === selectedCategory._id);
      if (index !== -1) {
        // Approximate scroll position
        const scrollX = (index + (showAllOption ? 1 : 0)) * 100;
        scrollViewRef.current.scrollTo({ x: scrollX - 50, animated: true });
      }
    }
  }, [selectedCategory, categories, showAllOption]);

  return (
    <View style={styles.container} testID={testID}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* All option */}
        {showAllOption && (
          <CategoryChip
            label={allLabel}
            isSelected={selectedCategory === null}
            onPress={() => onSelectCategory(null)}
            theme={theme}
            testID={`${testID}-all`}
          />
        )}

        {/* Category chips */}
        {categories.map((category, index) => (
          <CategoryChip
            key={category._id}
            label={category.name}
            icon={category.icon}
            articleCount={category.articles?.length || category.articleCount}
            isSelected={selectedCategory?._id === category._id}
            onPress={() => onSelectCategory(category)}
            theme={theme}
            animationDelay={index * 50}
            testID={`${testID}-${category._id}`}
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
        <Text style={chipStyles.label}>{label}</Text>
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
  });

export default CategoryFilter;
