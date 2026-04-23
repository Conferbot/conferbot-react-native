// @ts-nocheck
/**
 * ArticleDetail Component
 *
 * Full article view with rich content, rating, and related articles
 */
import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { useTheme } from '../../theme';
import type { ConferBotTheme } from '../../theme/types';
import type { KBArticle } from './types';
import { ArticleRating } from './ArticleRating';
import { ArticleCard } from './ArticleCard';

export interface ArticleDetailProps {
  article: KBArticle;
  relatedArticles?: KBArticle[];
  onBack: () => void;
  onArticlePress?: (article: KBArticle) => void;
  onRate: (articleId: string, helpful: boolean) => Promise<boolean>;
  onTrackView?: (article: KBArticle) => void;
  onTrackEngagement?: (articleId: string, timeSpent: number, scrollDepth: number) => void;
  hasRated?: boolean;
  testID?: string;
}

/**
 * Full article detail view with content rendering and analytics
 */
export const ArticleDetail: React.FC<ArticleDetailProps> = ({
  article,
  relatedArticles = [],
  onBack,
  onArticlePress,
  onRate,
  onTrackView,
  onTrackEngagement,
  hasRated = false,
  testID,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { width: screenWidth } = useWindowDimensions();

  // Animation values
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  // Tracking state
  const startTimeRef = useRef(Date.now());
  const maxScrollDepthRef = useRef(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const contentHeightRef = useRef(0);
  const viewportHeightRef = useRef(0);

  // Track article view on mount
  useEffect(() => {
    onTrackView?.(article);
    startTimeRef.current = Date.now();

    // Entrance animations
    Animated.sequence([
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    return () => {
      // Send engagement on unmount
      const timeSpent = Math.round((Date.now() - startTimeRef.current) / 1000);
      if (timeSpent >= 2) {
        onTrackEngagement?.(article._id, timeSpent, maxScrollDepthRef.current);
      }
    };
  }, [article, onTrackView, onTrackEngagement, headerOpacity, contentOpacity]);

  // Handle scroll for engagement tracking
  const handleScroll = useCallback(
    (event: any) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const scrollableHeight = contentSize.height - layoutMeasurement.height;

      if (scrollableHeight > 0) {
        const scrollPercent = (contentOffset.y / scrollableHeight) * 100;
        maxScrollDepthRef.current = Math.max(maxScrollDepthRef.current, Math.min(100, scrollPercent));
      }
    },
    []
  );

  // Calculate reading time
  const readingTime = calculateReadingTime(article.content || '');

  // Format date
  const formattedDate = formatDate(article.publishedDate || article.createdAt);
  const lastUpdated = formatDate(article.updatedAt);

  // Parse and render HTML content
  const renderedContent = renderContent(article.content || '', theme, screenWidth);

  // Header background opacity based on scroll
  const headerBgOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container} testID={testID}>
      {/* Fixed Header */}
      <Animated.View
        style={[
          styles.header,
          {
            opacity: headerOpacity,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.headerBackground,
            { opacity: headerBgOpacity },
          ]}
        />

        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessible={true}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          testID={`${testID}-back`}
        >
          <ChevronLeftIcon color={theme.colors.text} />
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {article.title}
        </Text>

        <View style={styles.headerSpacer} />
      </Animated.View>

      {/* Content */}
      <Animated.ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          {
            useNativeDriver: true,
            listener: handleScroll,
          }
        )}
        scrollEventThrottle={16}
      >
        <Animated.View style={{ opacity: contentOpacity }}>
          {/* Breadcrumb */}
          <View style={styles.breadcrumb}>
            <TouchableOpacity onPress={onBack}>
              <Text style={styles.breadcrumbLink}>Help</Text>
            </TouchableOpacity>
            {article.categoryName && (
              <>
                <Text style={styles.breadcrumbSeparator}>/</Text>
                <Text style={styles.breadcrumbCurrent}>{article.categoryName}</Text>
              </>
            )}
          </View>

          {/* Title */}
          <Text style={styles.title}>{article.title}</Text>

          {/* Meta Row */}
          <View style={styles.metaRow}>
            <ClockIcon color={theme.colors.textSecondary} />
            <Text style={styles.metaText}>{readingTime}</Text>
            <Text style={styles.metaDot}>.</Text>
            <Text style={styles.metaText}>Updated {lastUpdated}</Text>
          </View>

          {/* Cover Image */}
          {article.coverImage && (
            <Image
              source={{ uri: article.coverImage }}
              style={styles.coverImage}
              resizeMode="cover"
              accessible={true}
              accessibilityLabel={`Cover image for ${article.title}`}
            />
          )}

          {/* Author Info */}
          <View style={styles.authorRow}>
            {article.author?.avatar ? (
              <Image
                source={{ uri: article.author.avatar }}
                style={styles.authorAvatar}
              />
            ) : (
              <View style={styles.authorAvatarPlaceholder}>
                <Text style={styles.authorInitial}>
                  {article.author?.name?.[0]?.toUpperCase() || 'A'}
                </Text>
              </View>
            )}
            <View style={styles.authorInfo}>
              <Text style={styles.authorName}>
                {article.author?.name || 'Unknown Author'}
              </Text>
              <Text style={styles.publishedDate}>Published on {formattedDate}</Text>
            </View>
          </View>

          {/* Article Content */}
          <View style={styles.contentContainer}>{renderedContent}</View>

          {/* Rating Section */}
          <ArticleRating
            articleId={article._id}
            onRate={onRate}
            hasRated={hasRated}
            testID={`${testID}-rating`}
          />

          {/* Related Articles */}
          {relatedArticles.length > 0 && (
            <View style={styles.relatedSection}>
              <Text style={styles.relatedTitle}>Related Articles</Text>
              {relatedArticles.map((relatedArticle, index) => (
                <ArticleCard
                  key={relatedArticle._id}
                  article={relatedArticle}
                  onPress={onArticlePress || (() => {})}
                  variant="horizontal"
                  animationDelay={index * 100}
                  testID={`${testID}-related-${relatedArticle._id}`}
                />
              ))}
            </View>
          )}
        </Animated.View>
      </Animated.ScrollView>
    </View>
  );
};

// Helper: Render HTML content as React Native components
function renderContent(
  html: string,
  theme: ConferBotTheme,
  screenWidth: number
): React.ReactNode {
  if (!html) return null;

  // Simple HTML to React Native rendering
  // For production, consider using a library like react-native-render-html
  const contentStyles = createContentStyles(theme, screenWidth);

  // Split content by tags (basic parsing)
  const elements: React.ReactNode[] = [];
  let keyIndex = 0;

  // Remove scripts and styles
  html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Process common HTML elements
  const processedHtml = html
    // Headers
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n##H1##$1##/H1##\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n##H2##$1##/H2##\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n##H3##$1##/H3##\n')
    // Paragraphs
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '\n##P##$1##/P##\n')
    // Bold
    .replace(/<(strong|b)[^>]*>(.*?)<\/(strong|b)>/gi, '##B##$2##/B##')
    // Italic
    .replace(/<(em|i)[^>]*>(.*?)<\/(em|i)>/gi, '##I##$2##/I##')
    // Links
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '##A##$2##HREF##$1##/A##')
    // Lists
    .replace(/<ul[^>]*>/gi, '\n##UL##')
    .replace(/<\/ul>/gi, '##/UL##\n')
    .replace(/<ol[^>]*>/gi, '\n##OL##')
    .replace(/<\/ol>/gi, '##/OL##\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '##LI##$1##/LI##')
    // Code
    .replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gis, '\n##CODE##$1##/CODE##\n')
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '##INLINE_CODE##$1##/INLINE_CODE##')
    // Blockquote
    .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, '\n##QUOTE##$1##/QUOTE##\n')
    // Line breaks
    .replace(/<br\s*\/?>/gi, '\n')
    // Remove remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Parse markers and create elements
  const lines = processedHtml.split('\n');
  let inList = false;
  let listType: 'ul' | 'ol' = 'ul';
  let listItems: string[] = [];

  lines.forEach((line) => {
    const trimmedLine = line.trim();
    if (!trimmedLine) return;

    // Check for list markers
    if (trimmedLine.includes('##UL##')) {
      inList = true;
      listType = 'ul';
      listItems = [];
      return;
    }
    if (trimmedLine.includes('##OL##')) {
      inList = true;
      listType = 'ol';
      listItems = [];
      return;
    }
    if (trimmedLine.includes('##/UL##') || trimmedLine.includes('##/OL##')) {
      if (listItems.length > 0) {
        elements.push(
          <View key={keyIndex++} style={contentStyles.list}>
            {listItems.map((item, i) => (
              <View key={i} style={contentStyles.listItem}>
                <Text style={contentStyles.listBullet}>
                  {listType === 'ul' ? '.' : `${i + 1}.`}
                </Text>
                <Text style={contentStyles.listText}>{cleanText(item)}</Text>
              </View>
            ))}
          </View>
        );
      }
      inList = false;
      return;
    }

    if (inList && trimmedLine.includes('##LI##')) {
      const itemText = trimmedLine.replace(/##\/?LI##/g, '');
      listItems.push(itemText);
      return;
    }

    // Headers
    if (trimmedLine.includes('##H1##')) {
      const text = trimmedLine.replace(/##\/?H1##/g, '');
      elements.push(
        <Text key={keyIndex++} style={contentStyles.h1}>
          {cleanText(text)}
        </Text>
      );
      return;
    }
    if (trimmedLine.includes('##H2##')) {
      const text = trimmedLine.replace(/##\/?H2##/g, '');
      elements.push(
        <Text key={keyIndex++} style={contentStyles.h2}>
          {cleanText(text)}
        </Text>
      );
      return;
    }
    if (trimmedLine.includes('##H3##')) {
      const text = trimmedLine.replace(/##\/?H3##/g, '');
      elements.push(
        <Text key={keyIndex++} style={contentStyles.h3}>
          {cleanText(text)}
        </Text>
      );
      return;
    }

    // Code block
    if (trimmedLine.includes('##CODE##')) {
      const code = trimmedLine.replace(/##\/?CODE##/g, '');
      elements.push(
        <View key={keyIndex++} style={contentStyles.codeBlock}>
          <Text style={contentStyles.codeText}>{code.trim()}</Text>
        </View>
      );
      return;
    }

    // Blockquote
    if (trimmedLine.includes('##QUOTE##')) {
      const quote = trimmedLine.replace(/##\/?QUOTE##/g, '');
      elements.push(
        <View key={keyIndex++} style={contentStyles.blockquote}>
          <Text style={contentStyles.blockquoteText}>{cleanText(quote)}</Text>
        </View>
      );
      return;
    }

    // Paragraph with inline formatting
    if (trimmedLine.includes('##P##') || !trimmedLine.startsWith('##')) {
      const text = trimmedLine.replace(/##\/?P##/g, '');
      if (text.trim()) {
        elements.push(
          <Text key={keyIndex++} style={contentStyles.paragraph}>
            {renderInlineContent(text, contentStyles, theme)}
          </Text>
        );
      }
    }
  });

  return <View style={contentStyles.container}>{elements}</View>;
}

// Render inline formatting (bold, italic, links, inline code)
function renderInlineContent(
  text: string,
  styles: any,
  theme: ConferBotTheme
): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIndex = 0;

  while (remaining.length > 0) {
    // Bold
    const boldMatch = remaining.match(/##B##(.*?)##\/B##/);
    if (boldMatch && boldMatch.index === 0) {
      parts.push(
        <Text key={keyIndex++} style={styles.bold}>
          {boldMatch[1]}
        </Text>
      );
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Italic
    const italicMatch = remaining.match(/##I##(.*?)##\/I##/);
    if (italicMatch && italicMatch.index === 0) {
      parts.push(
        <Text key={keyIndex++} style={styles.italic}>
          {italicMatch[1]}
        </Text>
      );
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Link
    const linkMatch = remaining.match(/##A##(.*?)##HREF##(.*?)##\/A##/);
    if (linkMatch && linkMatch.index === 0) {
      const href = linkMatch[2];
      parts.push(
        <Text
          key={keyIndex++}
          style={styles.link}
          onPress={() => Linking.openURL(href)}
        >
          {linkMatch[1]}
        </Text>
      );
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // Inline code
    const codeMatch = remaining.match(/##INLINE_CODE##(.*?)##\/INLINE_CODE##/);
    if (codeMatch && codeMatch.index === 0) {
      parts.push(
        <Text key={keyIndex++} style={styles.inlineCode}>
          {codeMatch[1]}
        </Text>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Find next special marker
    const nextMarker = remaining.search(/##[A-Z]/);
    if (nextMarker > 0) {
      parts.push(remaining.slice(0, nextMarker));
      remaining = remaining.slice(nextMarker);
    } else {
      parts.push(remaining);
      break;
    }
  }

  return parts;
}

// Clean text of remaining markers
function cleanText(text: string): string {
  return text
    .replace(/##[A-Z_]+##/g, '')
    .replace(/##\/[A-Z_]+##/g, '')
    .trim();
}

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
    year: 'numeric',
  });
}

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

const ClockIcon: React.FC<{ color: string }> = ({ color }) => (
  <View
    style={{
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 1.5,
      borderColor: color,
      justifyContent: 'center',
      alignItems: 'center',
    }}
  >
    <View
      style={{
        width: 4,
        height: 4,
        borderRightWidth: 1.5,
        borderTopWidth: 1.5,
        borderColor: color,
        transform: [{ rotate: '45deg' }],
        marginTop: -1,
      }}
    />
  </View>
);

// Styles
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
      height: 56,
      zIndex: 10,
    },
    headerBackground: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
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
      fontSize: theme.typography.fontSize.md,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.text,
      marginHorizontal: theme.spacing.sm,
    },
    headerSpacer: {
      width: 40,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.xxl,
    },
    breadcrumb: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.lg,
    },
    breadcrumbLink: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.primary,
    },
    breadcrumbSeparator: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.textSecondary,
      marginHorizontal: theme.spacing.xs,
    },
    breadcrumbCurrent: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.textSecondary,
    },
    title: {
      fontSize: theme.typography.fontSize.xxl,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text,
      lineHeight: 32,
      marginBottom: theme.spacing.md,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.spacing.lg,
    },
    metaText: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.textSecondary,
      marginLeft: theme.spacing.xs,
    },
    metaDot: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.textSecondary,
      marginHorizontal: theme.spacing.xs,
    },
    coverImage: {
      width: '100%',
      height: 200,
      borderRadius: theme.borderRadius.lg,
      marginBottom: theme.spacing.lg,
    },
    authorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.spacing.xl,
    },
    authorAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    authorAvatarPlaceholder: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
    },
    authorInitial: {
      fontSize: theme.typography.fontSize.md,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.primary,
    },
    authorInfo: {
      marginLeft: theme.spacing.md,
    },
    authorName: {
      fontSize: theme.typography.fontSize.md,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text,
    },
    publishedDate: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.textSecondary,
    },
    contentContainer: {
      marginBottom: theme.spacing.lg,
    },
    relatedSection: {
      marginTop: theme.spacing.lg,
    },
    relatedTitle: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text,
      marginBottom: theme.spacing.md,
    },
  });

const createContentStyles = (theme: ConferBotTheme, screenWidth: number) =>
  StyleSheet.create({
    container: {},
    paragraph: {
      fontSize: theme.typography.fontSize.md,
      color: theme.colors.text,
      lineHeight: 26,
      marginBottom: theme.spacing.md,
    },
    h1: {
      fontSize: theme.typography.fontSize.xl + 4,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text,
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.md,
    },
    h2: {
      fontSize: theme.typography.fontSize.xl,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text,
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.sm,
    },
    h3: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.text,
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
    bold: {
      fontWeight: theme.typography.fontWeight.bold,
    },
    italic: {
      fontStyle: 'italic',
    },
    link: {
      color: theme.colors.primary,
      textDecorationLine: 'underline',
    },
    inlineCode: {
      fontFamily: 'monospace',
      fontSize: theme.typography.fontSize.sm,
      backgroundColor: theme.colors.background,
      paddingHorizontal: 4,
      borderRadius: 3,
    },
    codeBlock: {
      backgroundColor: theme.colors.text,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      marginVertical: theme.spacing.md,
    },
    codeText: {
      fontFamily: 'monospace',
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.background,
    },
    blockquote: {
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.primary,
      paddingLeft: theme.spacing.md,
      marginVertical: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.sm,
    },
    blockquoteText: {
      fontSize: theme.typography.fontSize.md,
      color: theme.colors.textSecondary,
      fontStyle: 'italic',
    },
    list: {
      marginVertical: theme.spacing.sm,
    },
    listItem: {
      flexDirection: 'row',
      marginBottom: theme.spacing.xs,
    },
    listBullet: {
      width: 20,
      fontSize: theme.typography.fontSize.md,
      color: theme.colors.primary,
      fontWeight: theme.typography.fontWeight.bold,
    },
    listText: {
      flex: 1,
      fontSize: theme.typography.fontSize.md,
      color: theme.colors.text,
      lineHeight: 24,
    },
  });

export default ArticleDetail;
