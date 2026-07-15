// @ts-nocheck
/**
 * ArticleList Component
 *
 * Scrollable list of KB articles with category filtering.
 * Uses ScrollView + map (KB lists are small and paginated server-side).
 */
import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Animated,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useTheme } from '../../theme';
import type { ConferBotTheme } from '../../theme/types';
import type { KBArticle, KBCategoryWithArticles } from './types';
import { ArticleCard } from './ArticleCard';

export interface ArticleListProps {
  articles?: KBArticle[];
  category?: KBCategoryWithArticles | null;
  onArticlePress: (article: KBArticle) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  refreshable?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  headerText?: string;
  showCategoryHeader?: boolean;
  showExcerpt?: boolean;
  showIcons?: boolean;
  showTimestamp?: boolean;
  showSeparator?: boolean;
  compact?: boolean;
  ListHeaderComponent?: React.ReactElement;
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * Article list with pull-to-refresh, load-more and empty state
 */
export const ArticleList: React.FC<ArticleListProps> = ({
  articles = [],
  category,
  onArticlePress,
  onRefresh,
  refreshing = false,
  refreshable = false,
  onLoadMore,
  hasMore = true,
  loadingMore = false,
  emptyTitle = 'No articles yet',
  emptyMessage = 'There are no articles in this category yet.',
  headerText,
  showCategoryHeader = true,
  showExcerpt = true,
  showIcons = true,
  showTimestamp = false,
  showSeparator = false,
  compact = false,
  ListHeaderComponent,
  accessibilityLabel,
  testID,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);

  // Animation for scroll fade
  const scrollY = useRef(new Animated.Value(0)).current;

  const articleId = (item: any): string => item?._id ?? item?.id;

  // Load-more guard
  const handleEndReached = useCallback(() => {
    if (hasMore && onLoadMore) {
      onLoadMore();
    }
  }, [hasMore, onLoadMore]);

  // Trigger load-more when scrolled near the bottom
  const handleScroll = useCallback(
    (event: any) => {
      scrollY.setValue(event?.nativeEvent?.contentOffset?.y ?? 0);
      const { layoutMeasurement, contentOffset, contentSize } = event?.nativeEvent || {};
      if (
        layoutMeasurement &&
        contentOffset &&
        contentSize &&
        layoutMeasurement.height + contentOffset.y >= contentSize.height - 40
      ) {
        handleEndReached();
      }
    },
    [handleEndReached, scrollY]
  );

  const isEmpty = articles.length === 0;

  return (
    <ScrollView
      contentContainerStyle={[styles.listContent, isEmpty && styles.emptyListContent]}
      refreshControl={
        onRefresh || refreshable ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        ) : undefined
      }
      onScroll={handleScroll}
      // Exposed as direct props so callers (and tests) can trigger them
      onEndReached={handleEndReached}
      onRefresh={onRefresh}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      accessible={true}
      accessibilityLabel={
        accessibilityLabel ||
        (category ? `Articles in ${category.name} category` : 'Article list')
      }
      testID={testID}
    >
      {ListHeaderComponent}

      {/* Simple text header */}
      {headerText ? <Text style={styles.headerText}>{headerText}</Text> : null}

      {/* Category Info Header */}
      {showCategoryHeader && category && (
        <View style={styles.categoryHeader}>
          {showIcons && category.icon && (
            <Text style={styles.categoryIcon}>{category.icon}</Text>
          )}
          <View style={styles.categoryInfo}>
            <Text style={styles.categoryTitle}>{category.name}</Text>
            {category.description && (
              <Text style={styles.categoryDescription} numberOfLines={2}>
                {category.description}
              </Text>
            )}
            <Text style={styles.articleCount}>
              {articles.length} article{articles.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      )}

      {/* Articles */}
      {articles.map((item, index) => (
        <View key={articleId(item) ?? index}>
          <ArticleCard
            article={{
              ...item,
              description: showExcerpt ? item.description ?? item.excerpt : undefined,
              updatedAt: showTimestamp ? item.updatedAt : undefined,
            }}
            variant={compact ? 'compact' : 'default'}
            onPress={() => onArticlePress(item)}
            animationDelay={index * 50}
            testID={`${testID}-article-${articleId(item)}`}
          />
          {showSeparator && index < articles.length - 1 && (
            <View style={styles.separator} />
          )}
        </View>
      ))}

      {/* Empty state */}
      {isEmpty && (
        <View style={styles.emptyContainer}>
          <EmptyIcon color={theme.colors.textSecondary} />
          <Text style={styles.emptyTitle}>{emptyTitle}</Text>
          <Text style={styles.emptyMessage}>{emptyMessage}</Text>
        </View>
      )}

      {/* Load-more indicator */}
      {loadingMore && (
        <View style={styles.loadingMore} testID={testID ? `${testID}-loading-more` : undefined}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      )}
    </ScrollView>
  );
};

// Empty Icon Component
const EmptyIcon: React.FC<{ color: string }> = ({ color }) => (
  <View style={{ width: 64, height: 64, justifyContent: 'center', alignItems: 'center' }}>
    {/* Document with question mark */}
    <View
      style={{
        width: 40,
        height: 50,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: color,
        backgroundColor: 'transparent',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          borderWidth: 2,
          borderColor: color,
          borderBottomWidth: 0,
          borderRightWidth: 0,
          transform: [{ rotate: '-45deg' }],
          marginBottom: -2,
        }}
      />
      <View
        style={{
          width: 3,
          height: 3,
          borderRadius: 1.5,
          backgroundColor: color,
          marginTop: 6,
        }}
      />
    </View>
  </View>
);

const createStyles = (theme: ConferBotTheme) =>
  StyleSheet.create({
    listContent: {
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.xxl,
    },
    emptyListContent: {
      flexGrow: 1,
    },
    headerText: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.text,
      marginBottom: theme.spacing.md,
    },
    categoryHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.lg,
      ...theme.shadows.sm,
    },
    categoryIcon: {
      fontSize: 32,
      marginRight: theme.spacing.md,
    },
    categoryInfo: {
      flex: 1,
    },
    categoryTitle: {
      fontSize: theme.typography.fontSize.xl,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text,
      marginBottom: theme.spacing.xs,
    },
    categoryDescription: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.textSecondary,
      lineHeight: 20,
      marginBottom: theme.spacing.sm,
    },
    articleCount: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.primary,
      fontWeight: theme.typography.fontWeight.medium,
    },
    separator: {
      height: 1,
      backgroundColor: theme.colors.borderLight,
      marginVertical: theme.spacing.xs,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.xxl,
    },
    emptyTitle: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.text,
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.sm,
      textAlign: 'center',
    },
    emptyMessage: {
      fontSize: theme.typography.fontSize.md,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    loadingMore: {
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
    },
  });

export default ArticleList;
