/**
 * KnowledgeBaseScreen Component
 *
 * Main container for Knowledge Base with navigation between
 * categories, article list, and article detail views
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import { useTheme } from '../../theme';
import type { ConferBotTheme } from '../../theme/types';
import type { KBArticle, KBCategoryWithArticles, KBScreenType } from './types';
import { KBProvider, useKB } from './KBContext';
import { SearchBar } from './SearchBar';
import { CategoryFilter } from './CategoryFilter';
import { ArticleList } from './ArticleList';
import { ArticleCard } from './ArticleCard';
import { ArticleDetail } from './ArticleDetail';

export interface KnowledgeBaseScreenProps {
  categories: KBCategoryWithArticles[];
  onClose?: () => void;
  onArticleView?: (article: KBArticle) => void;
  initialCategory?: KBCategoryWithArticles | null;
  showHeader?: boolean;
  headerTitle?: string;
  testID?: string;
}

/**
 * Main Knowledge Base screen component
 */
export const KnowledgeBaseScreen: React.FC<KnowledgeBaseScreenProps> = (props) => {
  return (
    <KBProvider>
      <KnowledgeBaseScreenContent {...props} />
    </KBProvider>
  );
};

/**
 * Inner content component that uses KB context
 */
const KnowledgeBaseScreenContent: React.FC<KnowledgeBaseScreenProps> = ({
  categories,
  onClose,
  onArticleView,
  initialCategory = null,
  showHeader = true,
  headerTitle = 'Help Center',
  testID,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);

  // Navigation state
  const [currentScreen, setCurrentScreen] = useState<KBScreenType>('categories');
  const [selectedCategory, setSelectedCategory] = useState<KBCategoryWithArticles | null>(
    initialCategory
  );
  const [selectedArticle, setSelectedArticle] = useState<KBArticle | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KBArticle[]>([]);
  const [isSearchActive, setIsSearchActive] = useState(false);

  // KB context for article rating
  const { rateArticle, hasRatedArticle } = useKB();

  // Animation
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Initialize with categories
  useEffect(() => {
    if (initialCategory) {
      setSelectedCategory(initialCategory);
      setCurrentScreen('articles');
    }
  }, [initialCategory]);

  // Get all articles for search
  const getAllArticles = useCallback((): KBArticle[] => {
    const articles: KBArticle[] = [];
    categories.forEach((category) => {
      category.articles?.forEach((article) => {
        articles.push({
          ...article,
          categoryName: category.name,
          categoryId: category._id,
        });
      });
    });
    return articles;
  }, [categories]);

  // Get related articles
  const getRelatedArticles = useCallback(
    (article: KBArticle, limit: number = 3): KBArticle[] => {
      const allArticles = getAllArticles();
      return allArticles
        .filter((a) => a._id !== article._id)
        .sort((a, b) => {
          const aInCategory = a.categoryId === selectedCategory?._id ? 1 : 0;
          const bInCategory = b.categoryId === selectedCategory?._id ? 1 : 0;
          return bInCategory - aInCategory;
        })
        .slice(0, limit);
    },
    [getAllArticles, selectedCategory]
  );

  // Handle search
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);

      if (!query.trim()) {
        setSearchResults([]);
        setIsSearchActive(false);
        return;
      }

      setIsSearchActive(true);
      const queryLower = query.toLowerCase().trim();
      const allArticles = getAllArticles();

      const results = allArticles.filter(
        (article) =>
          article.title?.toLowerCase().includes(queryLower) ||
          article.description?.toLowerCase().includes(queryLower) ||
          article.content?.toLowerCase().includes(queryLower)
      );

      setSearchResults(results);
    },
    [getAllArticles]
  );

  // Clear search
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setIsSearchActive(false);
  }, []);

  // Navigate to category
  const handleCategoryPress = useCallback((category: KBCategoryWithArticles) => {
    animateTransition(() => {
      setSelectedCategory(category);
      setCurrentScreen('articles');
    });
  }, []);

  // Navigate to article
  const handleArticlePress = useCallback(
    (article: KBArticle) => {
      onArticleView?.(article);
      animateTransition(() => {
        setSelectedArticle(article);
        setCurrentScreen('detail');
      });
    },
    [onArticleView]
  );

  // Navigate back
  const handleBack = useCallback(() => {
    animateTransition(() => {
      if (currentScreen === 'detail') {
        setSelectedArticle(null);
        setCurrentScreen('articles');
      } else if (currentScreen === 'articles') {
        setSelectedCategory(null);
        setCurrentScreen('categories');
      }
    });
  }, [currentScreen]);

  // Handle article rating (delegates to KBContext which emits via socket)
  const handleRateArticle = useCallback(
    async (articleId: string, helpful: boolean): Promise<boolean> => {
      return rateArticle(articleId, helpful);
    },
    [rateArticle]
  );

  // Animation helper
  const animateTransition = (callback: () => void) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 50,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      callback();
      slideAnim.setValue(-50);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  // Render header
  const renderHeader = () => {
    if (!showHeader) return null;

    const showBackButton = currentScreen !== 'categories';
    const title =
      currentScreen === 'detail' && selectedArticle
        ? selectedArticle.title
        : currentScreen === 'articles' && selectedCategory
        ? selectedCategory.name
        : headerTitle;

    return (
      <View style={styles.header}>
        {showBackButton && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessible={true}
            accessibilityLabel="Go back"
            accessibilityRole="button"
            testID={`${testID}-back`}
          >
            <ChevronLeftIcon color={theme.colors.text} />
          </TouchableOpacity>
        )}

        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>

        {onClose && (
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessible={true}
            accessibilityLabel="Close knowledge base"
            accessibilityRole="button"
            testID={`${testID}-close`}
          >
            <CloseIcon color={theme.colors.text} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Render categories view
  const renderCategories = () => (
    <Animated.View
      style={[
        styles.content,
        {
          opacity: fadeAnim,
          transform: [{ translateX: slideAnim }],
        },
      ]}
    >
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onSearch={handleSearch}
          onClear={handleClearSearch}
          placeholder="Search articles..."
          testID={`${testID}-search`}
        />
      </View>

      {/* Search Results */}
      {isSearchActive ? (
        <View style={styles.searchResultsContainer}>
          <Text style={styles.searchResultsTitle}>
            {searchResults.length > 0
              ? `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''} found`
              : 'No results found'}
          </Text>
          <ArticleList
            articles={searchResults}
            onArticlePress={handleArticlePress}
            showCategoryHeader={false}
            emptyTitle="No articles found"
            emptyMessage="Try different keywords or browse categories below."
            testID={`${testID}-search-results`}
          />
        </View>
      ) : (
        // Categories List
        <View style={styles.categoriesContainer}>
          {categories.map((category, index) => (
            <CategoryCard
              key={category._id}
              category={category}
              onPress={() => handleCategoryPress(category)}
              animationDelay={index * 50}
              testID={`${testID}-category-${category._id}`}
            />
          ))}

          {categories.length === 0 && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No categories available</Text>
              <Text style={styles.emptyMessage}>
                Knowledge base articles will appear here.
              </Text>
            </View>
          )}
        </View>
      )}
    </Animated.View>
  );

  // Render articles list view
  const renderArticles = () => {
    if (!selectedCategory) return null;

    return (
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        <ArticleList
          articles={selectedCategory.articles || []}
          category={selectedCategory}
          onArticlePress={handleArticlePress}
          testID={`${testID}-articles`}
        />
      </Animated.View>
    );
  };

  // Render article detail view
  const renderDetail = () => {
    if (!selectedArticle) return null;

    return (
      <Animated.View
        style={[
          styles.fullContent,
          {
            opacity: fadeAnim,
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        <ArticleDetail
          article={selectedArticle}
          relatedArticles={getRelatedArticles(selectedArticle)}
          onBack={handleBack}
          onArticlePress={handleArticlePress}
          onRate={handleRateArticle}
          hasRated={hasRatedArticle(selectedArticle._id)}
          testID={`${testID}-detail`}
        />
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.container} testID={testID}>
      <StatusBar
        barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
      />

      {currentScreen !== 'detail' && renderHeader()}

      {currentScreen === 'categories' && renderCategories()}
      {currentScreen === 'articles' && renderArticles()}
      {currentScreen === 'detail' && renderDetail()}
    </SafeAreaView>
  );
};

// Category Card Component
interface CategoryCardProps {
  category: KBCategoryWithArticles;
  onPress: () => void;
  animationDelay?: number;
  testID?: string;
}

const CategoryCard: React.FC<CategoryCardProps> = ({
  category,
  onPress,
  animationDelay = 0,
  testID,
}) => {
  const theme = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        delay: animationDelay,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        delay: animationDelay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [animationDelay, fadeAnim, slideAnim]);

  const cardStyles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.md,
      marginHorizontal: theme.spacing.md,
      ...theme.shadows.sm,
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: theme.spacing.md,
    },
    icon: {
      fontSize: 24,
    },
    info: {
      flex: 1,
    },
    name: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.text,
      marginBottom: 4,
    },
    description: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.textSecondary,
      marginBottom: 4,
    },
    count: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.primary,
      fontWeight: theme.typography.fontWeight.medium,
    },
    arrow: {
      marginLeft: theme.spacing.sm,
    },
  });

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      <TouchableOpacity
        style={cardStyles.container}
        onPress={onPress}
        activeOpacity={0.7}
        accessible={true}
        accessibilityLabel={`${category.name} category, ${category.articles?.length || 0} articles`}
        accessibilityRole="button"
        testID={testID}
      >
        <View style={cardStyles.iconContainer}>
          {category.icon ? (
            <Text style={cardStyles.icon}>{category.icon}</Text>
          ) : (
            <FolderIcon color={theme.colors.primary} />
          )}
        </View>

        <View style={cardStyles.info}>
          <Text style={cardStyles.name}>{category.name}</Text>
          {category.description && (
            <Text style={cardStyles.description} numberOfLines={1}>
              {category.description}
            </Text>
          )}
          <Text style={cardStyles.count}>
            {category.articles?.length || 0} article
            {(category.articles?.length || 0) !== 1 ? 's' : ''}
          </Text>
        </View>

        <View style={cardStyles.arrow}>
          <ChevronRightIcon color={theme.colors.textSecondary} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// Icons
const ChevronLeftIcon: React.FC<{ color: string }> = ({ color }) => (
  <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
    <View
      style={{
        width: 10,
        height: 10,
        borderLeftWidth: 2,
        borderBottomWidth: 2,
        borderColor: color,
        transform: [{ rotate: '45deg' }],
        marginLeft: 4,
      }}
    />
  </View>
);

const ChevronRightIcon: React.FC<{ color: string }> = ({ color }) => (
  <View style={{ width: 20, height: 20, justifyContent: 'center', alignItems: 'center' }}>
    <View
      style={{
        width: 8,
        height: 8,
        borderRightWidth: 2,
        borderTopWidth: 2,
        borderColor: color,
        transform: [{ rotate: '45deg' }],
      }}
    />
  </View>
);

const CloseIcon: React.FC<{ color: string }> = ({ color }) => (
  <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
    <View
      style={{
        width: 16,
        height: 2,
        backgroundColor: color,
        transform: [{ rotate: '45deg' }],
        position: 'absolute',
      }}
    />
    <View
      style={{
        width: 16,
        height: 2,
        backgroundColor: color,
        transform: [{ rotate: '-45deg' }],
        position: 'absolute',
      }}
    />
  </View>
);

const FolderIcon: React.FC<{ color: string }> = ({ color }) => (
  <View style={{ width: 24, height: 24 }}>
    <View
      style={{
        width: 24,
        height: 18,
        borderRadius: 3,
        borderWidth: 2,
        borderColor: color,
        marginTop: 4,
      }}
    />
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: 10,
        height: 6,
        backgroundColor: color,
        borderTopLeftRadius: 2,
        borderTopRightRadius: 2,
      }}
    />
  </View>
);

const createStyles = (theme: ConferBotTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      height: 56,
      ...theme.shadows.sm,
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: -theme.spacing.sm,
    },
    headerTitle: {
      flex: 1,
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.text,
      textAlign: 'center',
    },
    closeButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: -theme.spacing.sm,
    },
    content: {
      flex: 1,
    },
    fullContent: {
      flex: 1,
    },
    searchContainer: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
    },
    searchResultsContainer: {
      flex: 1,
    },
    searchResultsTitle: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.textSecondary,
      paddingHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
    categoriesContainer: {
      paddingTop: theme.spacing.sm,
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
      marginBottom: theme.spacing.sm,
      textAlign: 'center',
    },
    emptyMessage: {
      fontSize: theme.typography.fontSize.md,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
  });

export default KnowledgeBaseScreen;
