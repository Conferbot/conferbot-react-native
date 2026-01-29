/**
 * ArticleCard Component
 *
 * Individual article preview card for Knowledge Base
 */
import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { useTheme } from '../../theme';
import type { ConferBotTheme } from '../../theme/types';
import type { KBArticle } from './types';

export interface ArticleCardProps {
  article: KBArticle;
  onPress: (article: KBArticle) => void;
  variant?: 'default' | 'compact' | 'horizontal';
  animationDelay?: number;
  testID?: string;
}

/**
 * Article preview card with cover image, title, description, and metadata
 */
export const ArticleCard: React.FC<ArticleCardProps> = ({
  article,
  onPress,
  variant = 'default',
  animationDelay = 0,
  testID,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme, variant);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;

  // Entrance animation
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

  // Press animations
  const handlePressIn = () => {
    Animated.spring(pressAnim, {
      toValue: 0.98,
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

  // Calculate reading time
  const readingTime = calculateReadingTime(article.content || '');

  // Format date
  const formattedDate = formatDate(article.publishedDate || article.createdAt);

  // Get author initial for avatar placeholder
  const authorInitial = article.author?.name?.[0]?.toUpperCase() || 'A';

  return (
    <Animated.View
      style={[
        styles.animatedContainer,
        {
          opacity: fadeAnim,
          transform: [
            { translateY: slideAnim },
            { scale: pressAnim },
          ],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.container}
        onPress={() => onPress(article)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
        accessible={true}
        accessibilityLabel={`Article: ${article.title}`}
        accessibilityHint="Double tap to read article"
        accessibilityRole="button"
        testID={testID}
      >
        {/* Cover Image */}
        {variant !== 'compact' && (
          <View style={styles.imageContainer}>
            {article.coverImage ? (
              <Image
                source={{ uri: article.coverImage }}
                style={styles.coverImage}
                resizeMode="cover"
                accessible={true}
                accessibilityLabel={`Cover image for ${article.title}`}
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <ArticleIcon color={theme.colors.textSecondary} size={variant === 'horizontal' ? 24 : 32} />
              </View>
            )}
          </View>
        )}

        {/* Content */}
        <View style={styles.content}>
          {/* Title */}
          <Text
            style={styles.title}
            numberOfLines={variant === 'compact' ? 1 : 2}
          >
            {article.title}
          </Text>

          {/* Description */}
          {variant !== 'compact' && article.description && (
            <Text style={styles.description} numberOfLines={2}>
              {article.description}
            </Text>
          )}

          {/* Metadata */}
          <View style={styles.metadata}>
            {/* Author Avatar */}
            {variant !== 'compact' && (
              <View style={styles.avatarContainer}>
                {article.author?.avatar ? (
                  <Image
                    source={{ uri: article.author.avatar }}
                    style={styles.avatar}
                    accessible={true}
                    accessibilityLabel={`Author: ${article.author.name}`}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarInitial}>{authorInitial}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Meta Text */}
            <View style={styles.metaText}>
              {variant !== 'compact' && article.author?.name && (
                <Text style={styles.authorName} numberOfLines={1}>
                  {article.author.name}
                </Text>
              )}
              <View style={styles.metaDetails}>
                {formattedDate && (
                  <Text style={styles.metaItem}>{formattedDate}</Text>
                )}
                {formattedDate && readingTime && (
                  <Text style={styles.metaDot}>.</Text>
                )}
                <Text style={styles.metaItem}>{readingTime}</Text>
              </View>
            </View>
          </View>

          {/* Category Badge (for compact variant) */}
          {variant === 'compact' && article.categoryName && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{article.categoryName}</Text>
            </View>
          )}
        </View>

        {/* Arrow indicator for horizontal variant */}
        {variant === 'horizontal' && (
          <View style={styles.arrowContainer}>
            <ChevronRightIcon color={theme.colors.textSecondary} />
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

// Article Icon Component
const ArticleIcon: React.FC<{ color: string; size?: number }> = ({ color, size = 32 }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <View
      style={{
        width: size * 0.7,
        height: size * 0.85,
        borderRadius: 2,
        borderWidth: 1.5,
        borderColor: color,
        backgroundColor: 'transparent',
      }}
    />
    <View
      style={{
        position: 'absolute',
        top: size * 0.3,
        width: size * 0.4,
        height: 1.5,
        backgroundColor: color,
      }}
    />
    <View
      style={{
        position: 'absolute',
        top: size * 0.45,
        width: size * 0.4,
        height: 1.5,
        backgroundColor: color,
      }}
    />
    <View
      style={{
        position: 'absolute',
        top: size * 0.6,
        width: size * 0.25,
        height: 1.5,
        backgroundColor: color,
      }}
    />
  </View>
);

// Chevron Right Icon
const ChevronRightIcon: React.FC<{ color: string }> = ({ color }) => (
  <View style={{ width: 16, height: 16, justifyContent: 'center', alignItems: 'center' }}>
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

// Helper functions
function calculateReadingTime(content: string): string {
  if (!content) return '1 min read';
  const text = content.replace(/<[^>]*>/g, '');
  const wordCount = text.split(/\s+/).filter((word) => word.length > 0).length;
  const minutes = Math.ceil(wordCount / 200);
  return minutes <= 1 ? '1 min read' : `${minutes} min read`;
}

function formatDate(date?: string | Date): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}

const createStyles = (theme: ConferBotTheme, variant: 'default' | 'compact' | 'horizontal') => {
  const isHorizontal = variant === 'horizontal';
  const isCompact = variant === 'compact';

  return StyleSheet.create({
    animatedContainer: {
      marginBottom: theme.spacing.md,
    },
    container: {
      flexDirection: isHorizontal ? 'row' : 'column',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      overflow: 'hidden',
      ...theme.shadows.md,
    },
    imageContainer: {
      width: isHorizontal ? 80 : '100%',
      height: isHorizontal ? 80 : 140,
    },
    coverImage: {
      width: '100%',
      height: '100%',
    },
    imagePlaceholder: {
      width: '100%',
      height: '100%',
      backgroundColor: theme.colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    content: {
      flex: 1,
      padding: theme.spacing.md,
    },
    title: {
      fontSize: isCompact ? theme.typography.fontSize.md : theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.text,
      marginBottom: isCompact ? theme.spacing.xs : theme.spacing.sm,
      lineHeight: isCompact ? 20 : 24,
    },
    description: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.md,
      lineHeight: 20,
    },
    metadata: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    avatarContainer: {
      marginRight: theme.spacing.sm,
    },
    avatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
    },
    avatarPlaceholder: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.colors.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarInitial: {
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.primary,
    },
    metaText: {
      flex: 1,
    },
    authorName: {
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text,
      marginBottom: 2,
    },
    metaDetails: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    metaItem: {
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.textSecondary,
    },
    metaDot: {
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.textSecondary,
      marginHorizontal: theme.spacing.xs,
    },
    categoryBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs / 2,
      backgroundColor: theme.colors.primary + '15',
      borderRadius: theme.borderRadius.sm,
      marginTop: theme.spacing.sm,
    },
    categoryText: {
      fontSize: theme.typography.fontSize.xs,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.primary,
    },
    arrowContainer: {
      justifyContent: 'center',
      paddingRight: theme.spacing.md,
    },
  });
};

export default ArticleCard;
