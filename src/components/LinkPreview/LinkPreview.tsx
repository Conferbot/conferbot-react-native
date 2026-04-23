// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
  Dimensions,
  ViewStyle,
  ImageStyle,
} from 'react-native';
import { useTheme } from '../../theme';
import { linkPreviewService, type LinkPreviewData } from '../../services/LinkPreviewService';
import { extractDomain, truncateUrl } from '../../utils/LinkDetector';
import type { ConferBotTheme } from '../../theme/types';

/**
 * LinkPreview Props
 */
export interface LinkPreviewProps {
  /** URL to generate preview for */
  url: string;
  /** Whether the preview is from a user message */
  isUserMessage?: boolean;
  /** Custom onPress handler (default: opens URL in browser) */
  onPress?: (url: string) => void;
  /** Whether to show compact version */
  compact?: boolean;
  /** Whether to enable preview fetching (default: true) */
  enableFetching?: boolean;
  /** Callback when preview is loaded */
  onLoad?: (data: LinkPreviewData) => void;
  /** Callback when preview fails to load */
  onError?: (error: Error) => void;
  /** Test ID for testing */
  testID?: string;
}

interface FallbackFaviconProps {
  size?: number;
  color?: string;
}

interface FaviconImageProps {
  uri: string | null | undefined;
  style: ImageStyle;
  fallbackColor?: string;
}

interface LinkPreviewSkeletonProps {
  theme: ConferBotTheme;
  compact?: boolean;
}

/**
 * FallbackFavicon - Displays a link icon when favicon fails to load
 */
const FallbackFavicon: React.FC<FallbackFaviconProps> = ({ size = 16, color = '#666666' }) => (
  <View
    style={{
      width: size,
      height: size,
      borderRadius: 2,
      backgroundColor: color,
      opacity: 0.3,
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <Text style={{ fontSize: size * 0.6, color: '#FFFFFF', fontWeight: '600' }}>
      L
    </Text>
  </View>
);

/**
 * FaviconImage - Image component with fallback support
 */
const FaviconImage: React.FC<FaviconImageProps> = ({ uri, style, fallbackColor = '#666666' }) => {
  const [hasError, setHasError] = useState(false);

  if (!uri || hasError) {
    return <FallbackFavicon size={style.width as number || 16} color={fallbackColor} />;
  }

  return (
    <Image
      source={{ uri }}
      style={style}
      onError={() => setHasError(true)}
    />
  );
};

/**
 * LinkPreviewSkeleton - Loading skeleton for link preview
 */
const LinkPreviewSkeleton: React.FC<LinkPreviewSkeletonProps> = ({ theme, compact }) => {
  const styles = createStyles(theme);

  if (compact) {
    return (
      <View style={[styles.container, styles.compactContainer, styles.skeleton]}>
        <View style={[styles.skeletonFavicon, { backgroundColor: theme.colors.borderLight }]} />
        <View style={styles.skeletonTextContainer}>
          <View
            style={[
              styles.skeletonTitle,
              { backgroundColor: theme.colors.borderLight, width: '70%' } as ViewStyle,
            ]}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, styles.skeleton]}>
      <View
        style={[styles.skeletonImage, { backgroundColor: theme.colors.borderLight }]}
      />
      <View style={styles.contentContainer}>
        <View
          style={[
            styles.skeletonTitle,
            { backgroundColor: theme.colors.borderLight, width: '80%' } as ViewStyle,
          ]}
        />
        <View
          style={[
            styles.skeletonDescription,
            { backgroundColor: theme.colors.borderLight, width: '100%' } as ViewStyle,
          ]}
        />
        <View
          style={[
            styles.skeletonDescription,
            { backgroundColor: theme.colors.borderLight, width: '60%' } as ViewStyle,
          ]}
        />
        <View style={styles.siteInfo}>
          <View
            style={[styles.skeletonFavicon, { backgroundColor: theme.colors.borderLight }]}
          />
          <View
            style={[
              styles.skeletonSiteName,
              { backgroundColor: theme.colors.borderLight },
            ]}
          />
        </View>
      </View>
    </View>
  );
};

/**
 * LinkPreview Component
 *
 * Displays a rich link preview card with:
 * - Title from og:title or page title
 * - Description from og:description
 * - Image from og:image
 * - Site name/favicon
 * - Tap to open in browser
 *
 * Features:
 * - Loading skeleton while fetching
 * - Graceful fallback for failed fetches
 * - Cached previews for performance
 * - Accessible design
 */
export const LinkPreview: React.FC<LinkPreviewProps> = ({
  url,
  isUserMessage = false,
  onPress,
  compact = false,
  enableFetching = true,
  onLoad,
  onError,
  testID,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);

  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Fetch preview on mount
  useEffect(() => {
    if (!enableFetching) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const fetchPreviewData = async () => {
      try {
        // Check cache first
        const cached = linkPreviewService.getCachedPreview(url);
        if (cached) {
          if (isMounted) {
            setPreview(cached);
            setIsLoading(false);
            onLoad?.(cached);
          }
          return;
        }

        // Fetch new preview
        const data = await linkPreviewService.fetchPreview(url);
        if (isMounted) {
          setPreview(data);
          setIsLoading(false);
          onLoad?.(data);
        }
      } catch (error) {
        if (isMounted) {
          setHasError(true);
          setIsLoading(false);
          onError?.(error instanceof Error ? error : new Error('Failed to fetch preview'));
        }
      }
    };

    fetchPreviewData();

    return () => {
      isMounted = false;
    };
  }, [url, enableFetching, onLoad, onError]);

  // Handle press
  const handlePress = useCallback(() => {
    if (onPress) {
      onPress(url);
    } else {
      Linking.openURL(url).catch((err: Error) => {
        console.warn('[LinkPreview] Failed to open URL:', err);
      });
    }
  }, [url, onPress]);

  // Handle image load error
  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  // Show skeleton while loading
  if (isLoading) {
    return <LinkPreviewSkeleton theme={theme} compact={compact} />;
  }

  // Show minimal preview on error or if no preview data
  if (hasError || !preview) {
    const domain = extractDomain(url);
    return (
      <TouchableOpacity
        style={[
          styles.container,
          styles.minimalContainer,
          isUserMessage && styles.userContainer,
        ]}
        onPress={handlePress}
        activeOpacity={0.7}
        accessibilityRole="link"
        accessibilityLabel={`Open link: ${domain}`}
        testID={testID}
      >
        <FaviconImage
          uri={domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32` : null}
          style={styles.favicon}
          fallbackColor={theme.colors.textSecondary}
        />
        <Text
          style={[styles.minimalText, isUserMessage && styles.userText]}
          numberOfLines={1}
        >
          {truncateUrl(url, 40)}
        </Text>
      </TouchableOpacity>
    );
  }

  // Render compact version
  if (compact) {
    return (
      <TouchableOpacity
        style={[styles.container, styles.compactContainer, isUserMessage && styles.userContainer]}
        onPress={handlePress}
        activeOpacity={0.7}
        accessibilityRole="link"
        accessibilityLabel={preview.title || extractDomain(url) || url}
        testID={testID}
      >
        <FaviconImage
          uri={preview.favicon}
          style={styles.favicon}
          fallbackColor={theme.colors.textSecondary}
        />
        <View style={styles.compactContent}>
          <Text
            style={[styles.compactTitle, isUserMessage && styles.userText]}
            numberOfLines={1}
          >
            {preview.title || extractDomain(url) || url}
          </Text>
          {preview.siteName && (
            <Text
              style={[styles.compactSiteName, isUserMessage && styles.userTextSecondary]}
              numberOfLines={1}
            >
              {preview.siteName}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  // Render image-only preview
  if (preview.type === 'image' && preview.image && !imageError) {
    return (
      <TouchableOpacity
        style={[styles.container, styles.imageOnlyContainer]}
        onPress={handlePress}
        activeOpacity={0.9}
        accessibilityRole="image"
        accessibilityLabel={`Image from ${extractDomain(url)}`}
        testID={testID}
      >
        <Image
          source={{ uri: preview.image }}
          style={styles.fullImage}
          resizeMode="cover"
          onError={handleImageError}
        />
        <View style={styles.imageOverlay}>
          <FaviconImage
            uri={preview.favicon}
            style={styles.overlayFavicon}
            fallbackColor="#FFFFFF"
          />
          <Text style={styles.overlayText} numberOfLines={1}>
            {preview.siteName || extractDomain(url)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  // Render full preview
  const hasImage = preview.image && !imageError;

  return (
    <TouchableOpacity
      style={[styles.container, isUserMessage && styles.userContainer]}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="link"
      accessibilityLabel={`Link preview: ${preview.title || url}`}
      testID={testID}
    >
      {/* Preview Image */}
      {hasImage && (
        <Image
          source={{ uri: preview.image! }}
          style={styles.previewImage}
          resizeMode="cover"
          onError={handleImageError}
        />
      )}

      {/* Content */}
      <View style={styles.contentContainer}>
        {/* Title */}
        {preview.title && (
          <Text
            style={[styles.title, isUserMessage && styles.userText]}
            numberOfLines={2}
          >
            {preview.title}
          </Text>
        )}

        {/* Description */}
        {preview.description && (
          <Text
            style={[styles.description, isUserMessage && styles.userTextSecondary]}
            numberOfLines={3}
          >
            {preview.description}
          </Text>
        )}

        {/* Site Info */}
        <View style={styles.siteInfo}>
          <FaviconImage
            uri={preview.favicon}
            style={styles.favicon}
            fallbackColor={theme.colors.textSecondary}
          />
          <Text
            style={[styles.siteName, isUserMessage && styles.userTextSecondary]}
            numberOfLines={1}
          >
            {preview.siteName || extractDomain(url)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const { width: screenWidth } = Dimensions.get('window');
const MAX_PREVIEW_WIDTH = Math.min(screenWidth * 0.75, 320);

const createStyles = (theme: ConferBotTheme) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      overflow: 'hidden',
      marginTop: theme.spacing.xs,
      maxWidth: MAX_PREVIEW_WIDTH,
      borderWidth: 1,
      borderColor: theme.colors.borderLight,
      ...theme.shadows.sm,
    },
    userContainer: {
      backgroundColor: theme.colors.primaryLight,
      borderColor: theme.colors.primary,
    },
    minimalContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing.sm,
    },
    compactContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing.sm,
    },
    imageOnlyContainer: {
      maxWidth: MAX_PREVIEW_WIDTH,
    },
    skeleton: {
      opacity: 0.7,
    },
    contentContainer: {
      padding: theme.spacing.sm,
    },
    previewImage: {
      width: '100%',
      height: 150,
      backgroundColor: theme.colors.borderLight,
    },
    fullImage: {
      width: '100%',
      height: 200,
      backgroundColor: theme.colors.borderLight,
    },
    title: {
      fontSize: theme.typography.fontSize.md,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.text,
      marginBottom: theme.spacing.xs,
      lineHeight: theme.typography.fontSize.md * theme.typography.lineHeight.tight,
    },
    description: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.sm,
      lineHeight: theme.typography.fontSize.sm * theme.typography.lineHeight.normal,
    },
    siteInfo: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    favicon: {
      width: 16,
      height: 16,
      borderRadius: 2,
      marginRight: theme.spacing.xs,
    },
    siteName: {
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.textSecondary,
      flex: 1,
    },
    compactContent: {
      flex: 1,
      marginLeft: theme.spacing.xs,
    },
    compactTitle: {
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text,
    },
    compactSiteName: {
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    minimalText: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.link,
      flex: 1,
      textDecorationLine: 'underline',
    },
    userText: {
      color: theme.colors.userBubbleText,
    },
    userTextSecondary: {
      color: theme.colors.userBubbleText,
      opacity: 0.8,
    },
    imageOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing.sm,
    },
    overlayFavicon: {
      width: 14,
      height: 14,
      borderRadius: 2,
      marginRight: theme.spacing.xs,
    },
    overlayText: {
      fontSize: theme.typography.fontSize.xs,
      color: '#FFFFFF',
      flex: 1,
    },
    // Skeleton styles
    skeletonImage: {
      width: '100%',
      height: 120,
    },
    skeletonTitle: {
      height: 16,
      borderRadius: 4,
      marginBottom: theme.spacing.xs,
    },
    skeletonDescription: {
      height: 12,
      borderRadius: 4,
      marginBottom: theme.spacing.xs,
    },
    skeletonFavicon: {
      width: 16,
      height: 16,
      borderRadius: 2,
    },
    skeletonSiteName: {
      height: 12,
      width: 80,
      borderRadius: 4,
      marginLeft: theme.spacing.xs,
    },
    skeletonTextContainer: {
      flex: 1,
      marginLeft: theme.spacing.xs,
    },
  });

export default LinkPreview;
