/**
 * ArticleList Component
 *
 * Scrollable list of KB articles with category filtering
 */
import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Animated,
  RefreshControl,
  ListRenderItemInfo,
} from 'react-native';
import { useTheme } from '../../theme';
import type { ConferBotTheme } from '../../theme/types';
import type { KBArticle, KBCategoryWithArticles } from './types';
import { ArticleCard } from './ArticleCard';

export interface ArticleListProps {
  articles: KBArticle[];
  category?: KBCategoryWithArticles | null;
  onArticlePress: (article: KBArticle) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  showCategoryHeader?: boolean;
  ListHeaderComponent?: React.ReactElement;
  testID?: string;
}

/**
 * Virtualized article list with pull-to-refresh and empty state
 */
export const ArticleList: React.FC<ArticleListProps> = ({
  articles,
  category,
  onArticlePress,
  onRefresh,
  refreshing = false,
  emptyTitle = 'No articles found',
  emptyMessage = 'There are no articles in this category yet.',
  showCategoryHeader = true,
  ListHeaderComponent,
  testID,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);

  // Animation for scroll fade
  const scrollY = useRef(new Animated.Value(0)).current;

  // Render individual article
  const renderArticle = useCallback(
    ({ item, index }: ListRenderItemInfo<KBArticle>) => (
      <ArticleCard
        article={item}
        onPress={onArticlePress}
        animationDelay={index * 50}
        testID={`${testID}-article-${item._id}`}
      />
    ),
    [onArticlePress, testID]
  );

  // Key extractor
  const keyExtractor = useCallback((item: KBArticle) => item._id, []);

  // Header component
  const renderHeader = () => (
    <View>
      {ListHeaderComponent}

      {/* Category Info Header */}
      {showCategoryHeader && category && (
        <View style={styles.categoryHeader}>
          {category.icon && (
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
    </View>
  );

  // Empty state component
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <EmptyIcon color={theme.colors.textSecondary} />
      <Text style={styles.emptyTitle}>{emptyTitle}</Text>
      <Text style={styles.emptyMessage}>{emptyMessage}</Text>
    </View>
  );

  // Item separator
  const ItemSeparator = () => <View style={styles.separator} />;

  return (
    <Animated.FlatList
      data={articles}
      renderItem={renderArticle}
      keyExtractor={keyExtractor}
      contentContainerStyle={[
        styles.listContent,
        articles.length === 0 && styles.emptyListContent,
      ]}
      ListHeaderComponent={renderHeader}
      ListEmptyComponent={renderEmpty}
      ItemSeparatorComponent={ItemSeparator}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        ) : undefined
      }
      onScroll={Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        { useNativeDriver: true }
      )}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      accessible={true}
      accessibilityLabel={
        category
          ? `Articles in ${category.name} category`
          : 'Article list'
      }
      testID={testID}
    />
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
      height: 0,
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
  });

export default ArticleList;
