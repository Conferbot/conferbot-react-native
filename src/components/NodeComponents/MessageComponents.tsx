// @ts-nocheck
/**
 * MessageComponents.tsx
 *
 * Components for displaying messages and media content.
 * Includes: MessageBubble, ImageDisplay, VideoPlayer, AudioPlayer, FileDownload, HTMLView
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Linking,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';

import { NodeUIState } from '../../core/nodes/NodeHandler';
import { useTheme } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_BUBBLE_WIDTH = SCREEN_WIDTH * 0.75;

// ========================================
// MESSAGE BUBBLE
// ========================================

interface MessageBubbleProps extends NodeUIState.Message {
  isBot?: boolean;
}

/**
 * MessageBubble component
 *
 * Displays a chat message bubble with optional avatar.
 * Supports bot and user styling.
 */
export const MessageBubble: React.FC<MessageBubbleProps> = ({
  nodeId,
  text,
  showAvatar = true,
  typing,
  isBot = true,
}) => {
  const theme = useTheme();

  const bubbleStyle = isBot
    ? {
        backgroundColor: theme.colors.botBubble,
        borderTopLeftRadius: theme.borderRadius.sm,
      }
    : {
        backgroundColor: theme.colors.userBubble,
        borderTopRightRadius: theme.borderRadius.sm,
      };

  const textStyle = isBot
    ? { color: theme.colors.botBubbleText }
    : { color: theme.colors.userBubbleText };

  return (
    <View
      style={[
        styles.messageBubbleContainer,
        isBot ? styles.botMessage : styles.userMessage,
      ]}
      accessibilityRole="text"
      accessibilityLabel={isBot ? `Bot message: ${text}` : `Your message: ${text}`}
    >
      {showAvatar && isBot && (
        <View
          style={[
            styles.avatar,
            { backgroundColor: theme.colors.primary },
          ]}
          accessibilityRole="image"
          accessibilityLabel="Bot avatar"
        >
          <Text style={[styles.avatarText, { color: theme.colors.textInverse }]}>
            B
          </Text>
        </View>
      )}
      <View
        style={[
          styles.messageBubble,
          bubbleStyle,
          {
            borderRadius: theme.borderRadius.lg,
            maxWidth: MAX_BUBBLE_WIDTH,
          },
          theme.shadows.sm,
        ]}
      >
        {typing ? (
          <TypingDots />
        ) : (
          <Text
            style={[
              styles.messageText,
              textStyle,
              {
                fontSize: theme.typography.fontSize.md,
                lineHeight: theme.typography.lineHeight.normal,
              },
            ]}
          >
            {text}
          </Text>
        )}
      </View>
    </View>
  );
};

/**
 * Typing dots animation component
 */
const TypingDots: React.FC = () => {
  const theme = useTheme();
  return (
    <View style={styles.typingContainer}>
      {[0, 1, 2].map((index) => (
        <View
          key={index}
          style={[
            styles.typingDot,
            { backgroundColor: theme.colors.typing },
          ]}
        />
      ))}
    </View>
  );
};

// ========================================
// IMAGE DISPLAY
// ========================================

interface ImageDisplayProps extends NodeUIState.Image {}

/**
 * ImageDisplay component
 *
 * Displays an image with optional caption.
 * Supports loading states and error handling.
 */
export const ImageDisplay: React.FC<ImageDisplayProps> = ({
  nodeId,
  url,
  alt,
  caption,
}) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const handleLoadEnd = useCallback(() => {
    setLoading(false);
  }, []);

  const handleError = useCallback(() => {
    setLoading(false);
    setError(true);
  }, []);

  return (
    <View
      style={[
        styles.imageContainer,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
        },
        theme.shadows.sm,
      ]}
      accessibilityRole="image"
      accessibilityLabel={alt || caption || 'Image'}
    >
      {loading && (
        <View style={styles.imageLoader}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      )}
      {error ? (
        <View style={styles.imageError}>
          <Text style={[styles.imageErrorText, { color: theme.colors.error }]}>
            Failed to load image
          </Text>
        </View>
      ) : (
        <Image
          source={{ uri: url }}
          style={[
            styles.image,
            { borderRadius: theme.borderRadius.lg },
          ]}
          resizeMode="cover"
          onLoadEnd={handleLoadEnd}
          onError={handleError}
          accessibilityIgnoresInvertColors
        />
      )}
      {caption && (
        <Text
          style={[
            styles.caption,
            {
              color: theme.colors.textSecondary,
              fontSize: theme.typography.fontSize.sm,
            },
          ]}
        >
          {caption}
        </Text>
      )}
    </View>
  );
};

// ========================================
// VIDEO PLAYER
// ========================================

interface VideoPlayerProps extends NodeUIState.Video {}

/**
 * VideoPlayer component
 *
 * Displays a video player with play/pause controls.
 * Note: For full video support, integrate with react-native-video
 */
export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  nodeId,
  url,
  poster,
  autoplay = false,
}) => {
  const theme = useTheme();
  const [isPlaying, setIsPlaying] = useState(autoplay);

  const handlePlayPress = useCallback(() => {
    // In a full implementation, this would control the video player
    // For now, we open the video URL
    Linking.openURL(url).catch((err) => {
      console.error('Failed to open video URL:', err);
    });
  }, [url]);

  return (
    <View
      style={[
        styles.videoContainer,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
        },
        theme.shadows.sm,
      ]}
      accessibilityRole="button"
      accessibilityLabel="Video player. Tap to play"
    >
      {poster ? (
        <Image
          source={{ uri: poster }}
          style={[styles.videoPoster, { borderRadius: theme.borderRadius.lg }]}
          resizeMode="cover"
        />
      ) : (
        <View
          style={[
            styles.videoPoster,
            {
              backgroundColor: theme.colors.border,
              borderRadius: theme.borderRadius.lg,
            },
          ]}
        />
      )}
      <TouchableOpacity
        style={[
          styles.playButton,
          { backgroundColor: theme.colors.primary },
        ]}
        onPress={handlePlayPress}
        accessibilityRole="button"
        accessibilityLabel="Play video"
      >
        <Text style={[styles.playIcon, { color: theme.colors.textInverse }]}>
          {'\u25B6'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// ========================================
// AUDIO PLAYER
// ========================================

interface AudioPlayerProps extends NodeUIState.Audio {}

/**
 * AudioPlayer component
 *
 * Displays an audio player with playback controls.
 * Note: For full audio support, integrate with react-native-sound or expo-av
 */
export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  nodeId,
  url,
  autoplay = false,
}) => {
  const theme = useTheme();
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const handlePlayPause = useCallback(() => {
    setIsPlaying((prev) => !prev);
    // In a full implementation, this would control audio playback
  }, []);

  return (
    <View
      style={[
        styles.audioContainer,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
          borderColor: theme.colors.border,
        },
        theme.shadows.sm,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Audio player. ${isPlaying ? 'Playing' : 'Paused'}`}
    >
      <TouchableOpacity
        style={[
          styles.audioPlayButton,
          { backgroundColor: theme.colors.primary },
        ]}
        onPress={handlePlayPause}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause audio' : 'Play audio'}
      >
        <Text style={[styles.audioPlayIcon, { color: theme.colors.textInverse }]}>
          {isPlaying ? '\u275A\u275A' : '\u25B6'}
        </Text>
      </TouchableOpacity>
      <View style={styles.audioProgress}>
        <View
          style={[
            styles.audioProgressTrack,
            { backgroundColor: theme.colors.border },
          ]}
        >
          <View
            style={[
              styles.audioProgressFill,
              {
                backgroundColor: theme.colors.primary,
                width: `${progress * 100}%`,
              },
            ]}
          />
        </View>
        <Text
          style={[
            styles.audioTime,
            {
              color: theme.colors.textSecondary,
              fontSize: theme.typography.fontSize.xs,
            },
          ]}
        >
          0:00 / 0:00
        </Text>
      </View>
    </View>
  );
};

// ========================================
// FILE DOWNLOAD
// ========================================

interface FileDownloadProps extends NodeUIState.File {}

/**
 * FileDownload component
 *
 * Displays a file download button with filename and size.
 */
export const FileDownload: React.FC<FileDownloadProps> = ({
  nodeId,
  url,
  filename,
  size,
  mimeType,
}) => {
  const theme = useTheme();
  const [downloading, setDownloading] = useState(false);

  const formatSize = useCallback((bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }, []);

  const getFileIcon = useCallback((mime?: string): string => {
    if (!mime) return '\uD83D\uDCC4'; // Default document icon
    if (mime.startsWith('image/')) return '\uD83D\uDDBC'; // Image icon
    if (mime.startsWith('video/')) return '\uD83C\uDFAC'; // Video icon
    if (mime.startsWith('audio/')) return '\uD83C\uDFB5'; // Audio icon
    if (mime.includes('pdf')) return '\uD83D\uDCC4'; // PDF icon
    if (mime.includes('zip') || mime.includes('archive')) return '\uD83D\uDDDC'; // Archive icon
    return '\uD83D\uDCC4'; // Default document icon
  }, []);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      await Linking.openURL(url);
    } catch (err) {
      console.error('Failed to download file:', err);
    } finally {
      setDownloading(false);
    }
  }, [url]);

  return (
    <TouchableOpacity
      style={[
        styles.fileContainer,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
          borderColor: theme.colors.border,
        },
        theme.shadows.sm,
      ]}
      onPress={handleDownload}
      disabled={downloading}
      accessibilityRole="button"
      accessibilityLabel={`Download file: ${filename}`}
    >
      <View style={[styles.fileIcon, { backgroundColor: theme.colors.primaryLight }]}>
        <Text style={styles.fileIconText}>{getFileIcon(mimeType)}</Text>
      </View>
      <View style={styles.fileInfo}>
        <Text
          style={[
            styles.fileName,
            {
              color: theme.colors.text,
              fontSize: theme.typography.fontSize.md,
            },
          ]}
          numberOfLines={1}
        >
          {filename}
        </Text>
        {size && (
          <Text
            style={[
              styles.fileSize,
              {
                color: theme.colors.textSecondary,
                fontSize: theme.typography.fontSize.sm,
              },
            ]}
          >
            {formatSize(size)}
          </Text>
        )}
      </View>
      {downloading ? (
        <ActivityIndicator size="small" color={theme.colors.primary} />
      ) : (
        <Text style={[styles.downloadIcon, { color: theme.colors.primary }]}>
          {'\u2B07'}
        </Text>
      )}
    </TouchableOpacity>
  );
};

// ========================================
// HTML VIEW
// ========================================

interface HTMLViewProps extends NodeUIState.HTML {}

/**
 * HTMLView component
 *
 * Renders HTML content. For full HTML support, integrate with
 * react-native-render-html or react-native-webview.
 */
export const HTMLView: React.FC<HTMLViewProps> = ({ nodeId, content }) => {
  const theme = useTheme();

  // Simple HTML stripping for basic display
  // In production, use a proper HTML renderer
  const stripHtml = useCallback((html: string): string => {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }, []);

  return (
    <View
      style={[
        styles.htmlContainer,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
          borderColor: theme.colors.border,
        },
      ]}
      accessibilityRole="text"
      accessibilityLabel="HTML content"
    >
      <ScrollView
        style={styles.htmlScroll}
        contentContainerStyle={styles.htmlContent}
        nestedScrollEnabled
      >
        <Text
          style={[
            styles.htmlText,
            {
              color: theme.colors.text,
              fontSize: theme.typography.fontSize.md,
              lineHeight: theme.typography.lineHeight.normal,
            },
          ]}
        >
          {stripHtml(content)}
        </Text>
      </ScrollView>
    </View>
  );
};

// ========================================
// STYLES
// ========================================

const styles = StyleSheet.create({
  // Message Bubble styles
  messageBubbleContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 4,
    paddingHorizontal: 12,
  },
  botMessage: {
    justifyContent: 'flex-start',
  },
  userMessage: {
    justifyContent: 'flex-end',
    flexDirection: 'row-reverse',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  messageText: {
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
    paddingHorizontal: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 2,
    opacity: 0.6,
  },

  // Image styles
  imageContainer: {
    marginVertical: 4,
    marginHorizontal: 12,
    overflow: 'hidden',
    maxWidth: MAX_BUBBLE_WIDTH,
  },
  image: {
    width: '100%',
    height: 200,
  },
  imageLoader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  imageError: {
    width: '100%',
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageErrorText: {
    fontSize: 14,
  },
  caption: {
    padding: 8,
    textAlign: 'center',
  },

  // Video styles
  videoContainer: {
    marginVertical: 4,
    marginHorizontal: 12,
    overflow: 'hidden',
    maxWidth: MAX_BUBBLE_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPoster: {
    width: '100%',
    height: 180,
  },
  playButton: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.9,
  },
  playIcon: {
    fontSize: 24,
    marginLeft: 4,
  },

  // Audio styles
  audioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    marginHorizontal: 12,
    padding: 12,
    borderWidth: 1,
    maxWidth: MAX_BUBBLE_WIDTH,
  },
  audioPlayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioPlayIcon: {
    fontSize: 16,
  },
  audioProgress: {
    flex: 1,
    marginLeft: 12,
  },
  audioProgressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  audioProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  audioTime: {
    marginTop: 4,
  },

  // File styles
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    marginHorizontal: 12,
    padding: 12,
    borderWidth: 1,
    maxWidth: MAX_BUBBLE_WIDTH,
  },
  fileIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileIconText: {
    fontSize: 20,
  },
  fileInfo: {
    flex: 1,
    marginLeft: 12,
  },
  fileName: {
    fontWeight: '500',
  },
  fileSize: {
    marginTop: 2,
  },
  downloadIcon: {
    fontSize: 20,
    marginLeft: 8,
  },

  // HTML styles
  htmlContainer: {
    marginVertical: 4,
    marginHorizontal: 12,
    borderWidth: 1,
    maxWidth: MAX_BUBBLE_WIDTH,
    maxHeight: 300,
  },
  htmlScroll: {
    flex: 1,
  },
  htmlContent: {
    padding: 12,
  },
  htmlText: {
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
});

export default {
  MessageBubble,
  ImageDisplay,
  VideoPlayer,
  AudioPlayer,
  FileDownload,
  HTMLView,
};
