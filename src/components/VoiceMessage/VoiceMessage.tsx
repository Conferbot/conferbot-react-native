// @ts-nocheck
/**
 * VoiceMessage.tsx
 *
 * Display component for sent/received voice messages with playback controls.
 *
 * Features:
 * - Play/pause button
 * - Progress bar with waveform visualization
 * - Duration display
 * - Download option
 * - Loading state
 * - Error handling
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Linking,
  PanResponder,
  Dimensions,
  Alert,
} from 'react-native';

import { useTheme } from '../../theme';
import {
  AudioRecorder,
  AudioRecorderError,
  PlaybackStatus,
  formatDuration,
  isAudioRecorderAvailable,
} from '../../utils/AudioRecorder';
import type { ConferBotTheme } from '../../theme/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_MESSAGE_WIDTH = SCREEN_WIDTH * 0.75;

// ========================================
// TYPES
// ========================================

export interface VoiceMessageProps {
  /** Audio file URL */
  url: string;
  /** Duration in milliseconds */
  duration: number;
  /** Whether this is a user message (sent) or bot/agent message (received) */
  isUser?: boolean;
  /** Waveform data for visualization (array of 0-1 values) */
  waveform?: number[];
  /** Callback when download is pressed */
  onDownload?: (url: string) => void;
  /** Whether to show download button */
  showDownload?: boolean;
  /** File name for download */
  fileName?: string;
  /** Whether the message is being loaded */
  isLoading?: boolean;
  /** Error message if playback failed */
  error?: string;
  /** Timestamp of the message */
  timestamp?: Date | string;
  /** Test ID for testing */
  testID?: string;
}

type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

// ========================================
// WAVEFORM PROGRESS COMPONENT
// ========================================

interface WaveformProgressProps {
  waveform: number[];
  progress: number;
  isPlaying: boolean;
  isUser: boolean;
  theme: ConferBotTheme;
  onSeek?: (progress: number) => void;
}

const WaveformProgress: React.FC<WaveformProgressProps> = ({
  waveform,
  progress,
  isPlaying,
  isUser,
  theme,
  onSeek,
}) => {
  const containerRef = useRef<View>(null);
  const containerWidth = useRef(0);

  const barWidth = 2;
  const barGap = 1;
  const maxBars = Math.floor((MAX_MESSAGE_WIDTH - 100) / (barWidth + barGap));

  // Generate default waveform if not provided
  const displayWaveform = waveform.length > 0
    ? waveform
    : Array(maxBars).fill(0).map(() => 0.3 + Math.random() * 0.5);

  // Sample waveform to fit available space
  const sampledWaveform = displayWaveform.length > maxBars
    ? displayWaveform.filter((_, i) => i % Math.ceil(displayWaveform.length / maxBars) === 0).slice(0, maxBars)
    : displayWaveform;

  // Fill with bars if not enough
  const paddedWaveform = [...sampledWaveform];
  while (paddedWaveform.length < maxBars) {
    paddedWaveform.push(0.2);
  }

  const playedBars = Math.floor(paddedWaveform.length * progress);

  // Colors based on sender
  const activeColor = isUser ? theme.colors.textInverse : theme.colors.primary;
  const inactiveColor = isUser
    ? `${theme.colors.textInverse}80`
    : theme.colors.border;

  // Pan responder for seeking
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        if (onSeek && containerWidth.current > 0) {
          const locationX = evt.nativeEvent.locationX;
          const newProgress = Math.max(0, Math.min(1, locationX / containerWidth.current));
          onSeek(newProgress);
        }
      },
      onPanResponderMove: (evt) => {
        if (onSeek && containerWidth.current > 0) {
          const locationX = evt.nativeEvent.locationX;
          const newProgress = Math.max(0, Math.min(1, locationX / containerWidth.current));
          onSeek(newProgress);
        }
      },
    })
  ).current;

  const handleLayout = useCallback((event: any) => {
    containerWidth.current = event.nativeEvent.layout.width;
  }, []);

  return (
    <View
      ref={containerRef}
      style={styles.waveformProgressContainer}
      onLayout={handleLayout}
      {...panResponder.panHandlers}
    >
      {paddedWaveform.map((level, index) => {
        const height = Math.max(4, level * 24);
        const isPlayed = index < playedBars;

        return (
          <View
            key={index}
            style={[
              styles.waveformBar,
              {
                width: barWidth,
                height,
                backgroundColor: isPlayed ? activeColor : inactiveColor,
                marginHorizontal: barGap / 2,
              },
            ]}
          />
        );
      })}
    </View>
  );
};

// ========================================
// PLAY BUTTON COMPONENT
// ========================================

interface PlayButtonProps {
  state: PlaybackState;
  onPress: () => void;
  isUser: boolean;
  theme: ConferBotTheme;
}

const PlayButton: React.FC<PlayButtonProps> = ({
  state,
  onPress,
  isUser,
  theme,
}) => {
  const backgroundColor = isUser
    ? `${theme.colors.textInverse}20`
    : theme.colors.primaryLight;

  const iconColor = isUser
    ? theme.colors.textInverse
    : theme.colors.primary;

  return (
    <TouchableOpacity
      style={[styles.playButton, { backgroundColor }]}
      onPress={onPress}
      disabled={state === 'loading'}
      accessibilityRole="button"
      accessibilityLabel={state === 'playing' ? 'Pause' : 'Play'}
    >
      {state === 'loading' ? (
        <ActivityIndicator size="small" color={iconColor} />
      ) : state === 'playing' ? (
        // Pause icon
        <View style={styles.pauseIconContainer}>
          <View style={[styles.pauseBar, { backgroundColor: iconColor }]} />
          <View style={[styles.pauseBar, { backgroundColor: iconColor }]} />
        </View>
      ) : (
        // Play icon
        <View
          style={[
            styles.playIcon,
            {
              borderLeftColor: iconColor,
            },
          ]}
        />
      )}
    </TouchableOpacity>
  );
};

// ========================================
// MAIN VOICE MESSAGE COMPONENT
// ========================================

export const VoiceMessage: React.FC<VoiceMessageProps> = ({
  url,
  duration,
  isUser = false,
  waveform = [],
  onDownload,
  showDownload = true,
  fileName,
  isLoading: externalLoading = false,
  error: externalError,
  timestamp,
  testID,
}) => {
  const theme = useTheme();
  const stylesWithTheme = createStyles(theme, isUser);

  // State
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration);
  const [error, setError] = useState<string | null>(externalError || null);

  // Track if this message is currently playing
  const isThisPlaying = useRef(false);

  // Update error from props
  useEffect(() => {
    if (externalError) {
      setError(externalError);
      setPlaybackState('error');
    }
  }, [externalError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isThisPlaying.current) {
        AudioRecorder.stopPlayback().catch(() => {});
      }
    };
  }, []);

  // Handle playback status updates
  const handlePlaybackStatus = useCallback((status: PlaybackStatus) => {
    if (!isThisPlaying.current) return;

    if (status.durationMs > 0) {
      setProgress(status.positionMs / status.durationMs);
      setCurrentTime(status.positionMs);
      setTotalDuration(status.durationMs);
    }

    if (status.didFinish) {
      setPlaybackState('idle');
      setProgress(0);
      setCurrentTime(0);
      isThisPlaying.current = false;
    } else if (status.isPlaying) {
      setPlaybackState('playing');
    }
  }, []);

  // Play audio
  const play = useCallback(async () => {
    if (!isAudioRecorderAvailable()) {
      Alert.alert(
        'Playback Unavailable',
        'Please install expo-av or react-native-audio-recorder-player to play voice messages.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setError(null);
      setPlaybackState('loading');

      await AudioRecorder.play(url, {
        onStatusUpdate: handlePlaybackStatus,
        onFinish: () => {
          setPlaybackState('idle');
          setProgress(0);
          setCurrentTime(0);
          isThisPlaying.current = false;
        },
      });

      isThisPlaying.current = true;
      setPlaybackState('playing');
    } catch (err) {
      isThisPlaying.current = false;
      const errorMessage = err instanceof AudioRecorderError
        ? err.message
        : 'Failed to play audio';
      setError(errorMessage);
      setPlaybackState('error');
    }
  }, [url, handlePlaybackStatus]);

  // Pause audio
  const pause = useCallback(async () => {
    try {
      await AudioRecorder.pausePlayback();
      setPlaybackState('paused');
    } catch (err) {
      // Ignore pause errors
    }
  }, []);

  // Resume audio
  const resume = useCallback(async () => {
    try {
      await AudioRecorder.resumePlayback();
      setPlaybackState('playing');
    } catch (err) {
      // Ignore resume errors
    }
  }, []);

  // Handle play button press
  const handlePlayPress = useCallback(() => {
    switch (playbackState) {
      case 'idle':
      case 'error':
        play();
        break;
      case 'playing':
        pause();
        break;
      case 'paused':
        resume();
        break;
    }
  }, [playbackState, play, pause, resume]);

  // Handle seek
  const handleSeek = useCallback(async (newProgress: number) => {
    const seekPosition = newProgress * totalDuration;
    setProgress(newProgress);
    setCurrentTime(seekPosition);

    if (isThisPlaying.current) {
      await AudioRecorder.seekTo(seekPosition);
    }
  }, [totalDuration]);

  // Handle download
  const handleDownload = useCallback(() => {
    if (onDownload) {
      onDownload(url);
    } else {
      // Default behavior: open URL
      Linking.openURL(url).catch(() => {
        Alert.alert('Error', 'Failed to download audio file.');
      });
    }
  }, [url, onDownload]);

  // Format timestamp
  const formatTimestamp = useCallback((time: Date | string): string => {
    const date = typeof time === 'string' ? new Date(time) : time;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  // Loading state
  if (externalLoading) {
    return (
      <View style={[stylesWithTheme.container, stylesWithTheme.loadingContainer]}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
        <Text style={stylesWithTheme.loadingText}>Loading voice message...</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        stylesWithTheme.container,
        error && stylesWithTheme.errorContainer,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Voice message, ${formatDuration(totalDuration)}`}
      testID={testID}
    >
      {/* Play/Pause Button */}
      <PlayButton
        state={playbackState}
        onPress={handlePlayPress}
        isUser={isUser}
        theme={theme}
      />

      {/* Content */}
      <View style={stylesWithTheme.content}>
        {/* Waveform / Progress */}
        <WaveformProgress
          waveform={waveform}
          progress={progress}
          isPlaying={playbackState === 'playing'}
          isUser={isUser}
          theme={theme}
          onSeek={handleSeek}
        />

        {/* Duration / Time */}
        <View style={stylesWithTheme.timeContainer}>
          <Text style={stylesWithTheme.timeText}>
            {playbackState === 'playing' || playbackState === 'paused'
              ? formatDuration(currentTime)
              : formatDuration(totalDuration)
            }
          </Text>
          {timestamp && (
            <Text style={stylesWithTheme.timestampText}>
              {formatTimestamp(timestamp)}
            </Text>
          )}
        </View>
      </View>

      {/* Download Button */}
      {showDownload && (
        <TouchableOpacity
          style={stylesWithTheme.downloadButton}
          onPress={handleDownload}
          accessibilityRole="button"
          accessibilityLabel="Download voice message"
        >
          <Text style={stylesWithTheme.downloadIcon}>{'\u2B07'}</Text>
        </TouchableOpacity>
      )}

      {/* Error overlay */}
      {error && (
        <View style={stylesWithTheme.errorOverlay}>
          <Text style={stylesWithTheme.errorText} numberOfLines={1}>
            {error}
          </Text>
          <TouchableOpacity onPress={() => { setError(null); play(); }}>
            <Text style={stylesWithTheme.retryText}>Tap to retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// ========================================
// STYLES
// ========================================

const styles = StyleSheet.create({
  waveformProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    height: 32,
    flex: 1,
  },
  waveformBar: {
    borderRadius: 1,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 14,
    borderRightWidth: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: 'transparent',
    marginLeft: 4,
  },
  pauseIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 16,
    height: 16,
  },
  pauseBar: {
    width: 4,
    height: 14,
    borderRadius: 2,
    marginHorizontal: 2,
  },
});

const createStyles = (theme: ConferBotTheme, isUser: boolean) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isUser ? theme.colors.userBubble : theme.colors.botBubble,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.sm,
      maxWidth: MAX_MESSAGE_WIDTH,
      marginVertical: theme.spacing.xs,
      marginHorizontal: theme.spacing.md,
      alignSelf: isUser ? 'flex-end' : 'flex-start',
      ...theme.shadows.sm,
    },
    loadingContainer: {
      minWidth: 200,
      justifyContent: 'center',
    },
    errorContainer: {
      position: 'relative',
    },
    content: {
      flex: 1,
      marginLeft: theme.spacing.sm,
    },
    timeContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: theme.spacing.xs,
    },
    timeText: {
      fontSize: theme.typography.fontSize.sm,
      color: isUser ? theme.colors.userBubbleText : theme.colors.textSecondary,
      fontWeight: theme.typography.fontWeight.medium,
    },
    timestampText: {
      fontSize: theme.typography.fontSize.xs,
      color: isUser
        ? `${theme.colors.userBubbleText}80`
        : theme.colors.textSecondary,
    },
    downloadButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: theme.spacing.xs,
    },
    downloadIcon: {
      fontSize: 18,
      color: isUser ? theme.colors.userBubbleText : theme.colors.primary,
    },
    loadingText: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.textSecondary,
      marginLeft: theme.spacing.sm,
    },
    errorOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: `${theme.colors.error}E6`,
      borderRadius: theme.borderRadius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing.sm,
    },
    errorText: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.textInverse,
      textAlign: 'center',
    },
    retryText: {
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.textInverse,
      textDecorationLine: 'underline',
      marginTop: theme.spacing.xs,
    },
  });

export default VoiceMessage;
