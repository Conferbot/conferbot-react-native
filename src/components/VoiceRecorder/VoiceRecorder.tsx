/**
 * VoiceRecorder.tsx
 *
 * Voice message recording component with recording controls,
 * waveform visualization, and playback preview.
 *
 * Features:
 * - Tap to record / tap to stop
 * - Real-time waveform visualization
 * - Recording duration timer
 * - Playback preview before sending
 * - Cancel and send buttons
 * - Permission handling
 * - Max/min duration validation
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';

import { useTheme } from '../../theme';
import {
  AudioRecorder,
  AudioRecorderResult,
  AudioRecorderError,
  RecordingStatus,
  PlaybackStatus,
  formatDuration,
  isAudioRecorderAvailable,
} from '../../utils/AudioRecorder';
import type { ConferBotTheme } from '../../theme/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ========================================
// TYPES
// ========================================

export interface VoiceRecorderProps {
  /** Callback when recording is sent */
  onSend: (recording: VoiceRecordingResult) => void | Promise<void>;
  /** Callback when recording is cancelled */
  onCancel?: () => void;
  /** Maximum recording duration in ms (default: 300000 = 5 minutes) */
  maxDuration?: number;
  /** Minimum recording duration in ms (default: 1000 = 1 second) */
  minDuration?: number;
  /** Whether the recorder is disabled */
  disabled?: boolean;
  /** Whether to show as compact mode (just mic button) */
  compact?: boolean;
  /** Callback when recorder expands from compact mode */
  onExpand?: () => void;
  /** Callback when recorder collapses to compact mode */
  onCollapse?: () => void;
  /** Test ID for testing */
  testID?: string;
}

export interface VoiceRecordingResult {
  /** File URI */
  uri: string;
  /** Duration in milliseconds */
  duration: number;
  /** File size in bytes */
  size: number;
  /** MIME type */
  mimeType: string;
  /** Waveform data for visualization */
  waveform?: number[];
}

type RecorderState = 'idle' | 'recording' | 'paused' | 'preview';

// ========================================
// WAVEFORM COMPONENT
// ========================================

interface WaveformProps {
  levels: number[];
  isRecording: boolean;
  isPlaying: boolean;
  playbackProgress: number;
  theme: ConferBotTheme;
}

const Waveform: React.FC<WaveformProps> = ({
  levels,
  isRecording,
  isPlaying,
  playbackProgress,
  theme,
}) => {
  const barWidth = 3;
  const barGap = 2;
  const maxBars = Math.floor((SCREEN_WIDTH - 140) / (barWidth + barGap));

  // Sample levels to fit available space
  const displayLevels = levels.length > maxBars
    ? levels.filter((_, i) => i % Math.ceil(levels.length / maxBars) === 0).slice(0, maxBars)
    : levels;

  // Fill with empty bars if not enough
  const paddedLevels = [...displayLevels];
  while (paddedLevels.length < maxBars) {
    paddedLevels.push(0);
  }

  const playedBars = Math.floor(paddedLevels.length * playbackProgress);

  return (
    <View style={styles.waveformContainer}>
      {paddedLevels.map((level, index) => {
        const height = Math.max(4, level * 32);
        const isPlayed = isPlaying && index < playedBars;
        const isActive = isRecording || isPlayed;

        return (
          <Animated.View
            key={index}
            style={[
              styles.waveformBar,
              {
                width: barWidth,
                height,
                backgroundColor: isActive
                  ? theme.colors.primary
                  : theme.colors.border,
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
// RECORDING BUTTON COMPONENT
// ========================================

interface RecordButtonProps {
  state: RecorderState;
  onPress: () => void;
  disabled: boolean;
  theme: ConferBotTheme;
}

const RecordButton: React.FC<RecordButtonProps> = ({
  state,
  onPress,
  disabled,
  theme,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (state === 'recording') {
      // Pulse animation while recording
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [state, pulseAnim]);

  const isRecording = state === 'recording';
  const isPreviewing = state === 'preview' || state === 'paused';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={styles.recordButtonWrapper}
      accessibilityRole="button"
      accessibilityLabel={isRecording ? 'Stop recording' : isPreviewing ? 'Play preview' : 'Start recording'}
    >
      <Animated.View
        style={[
          styles.recordButton,
          {
            backgroundColor: disabled
              ? theme.colors.border
              : isRecording
              ? theme.colors.error
              : theme.colors.primary,
            transform: [{ scale: isRecording ? pulseAnim : 1 }],
          },
        ]}
      >
        {isRecording ? (
          // Stop icon (square)
          <View style={[styles.stopIcon, { backgroundColor: theme.colors.textInverse }]} />
        ) : isPreviewing ? (
          // Play icon (triangle)
          <View style={styles.playIconContainer}>
            <View
              style={[
                styles.playIcon,
                {
                  borderLeftColor: theme.colors.textInverse,
                },
              ]}
            />
          </View>
        ) : (
          // Microphone icon
          <View style={styles.micIconContainer}>
            <View style={[styles.micBody, { backgroundColor: theme.colors.textInverse }]} />
            <View style={[styles.micBase, { borderColor: theme.colors.textInverse }]} />
            <View style={[styles.micStand, { backgroundColor: theme.colors.textInverse }]} />
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

// ========================================
// MAIN VOICE RECORDER COMPONENT
// ========================================

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onSend,
  onCancel,
  maxDuration = 300000, // 5 minutes
  minDuration = 1000, // 1 second
  disabled = false,
  compact = false,
  onExpand,
  onCollapse,
  testID,
}) => {
  const theme = useTheme();
  const stylesWithTheme = createStyles(theme);

  // State
  const [state, setState] = useState<RecorderState>('idle');
  const [duration, setDuration] = useState(0);
  const [recording, setRecording] = useState<AudioRecorderResult | null>(null);
  const [meteringLevels, setMeteringLevels] = useState<number[]>([]);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(!compact);

  // Refs
  const durationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartTime = useRef<number>(0);

  // Check availability on mount
  useEffect(() => {
    if (!isAudioRecorderAvailable()) {
      setError('Voice recording is not available. Please install expo-av or react-native-audio-recorder-player.');
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
      AudioRecorder.cancelRecording().catch(() => {});
      AudioRecorder.stopPlayback().catch(() => {});
    };
  }, []);

  // Handle recording status updates
  const handleRecordingStatus = useCallback((status: RecordingStatus) => {
    if (status.metering !== undefined) {
      setMeteringLevels((prev) => [...prev, status.metering!]);
    }
  }, []);

  // Handle metering updates
  const handleMeteringUpdate = useCallback((level: number) => {
    setMeteringLevels((prev) => [...prev, level]);
  }, []);

  // Handle playback status updates
  const handlePlaybackStatus = useCallback((status: PlaybackStatus) => {
    if (status.durationMs > 0) {
      setPlaybackProgress(status.positionMs / status.durationMs);
    }
    setIsPlaying(status.isPlaying);

    if (status.didFinish) {
      setIsPlaying(false);
      setPlaybackProgress(0);
    }
  }, []);

  // Start recording
  const startRecording = useCallback(async () => {
    if (!isAudioRecorderAvailable()) {
      Alert.alert(
        'Voice Recording Unavailable',
        'Please install expo-av or react-native-audio-recorder-player to enable voice messages.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setError(null);
      setMeteringLevels([]);
      setDuration(0);
      recordingStartTime.current = Date.now();

      await AudioRecorder.startRecording({
        maxDuration,
        enableMetering: true,
        meteringInterval: 100,
        onStatusUpdate: handleRecordingStatus,
        onMeteringUpdate: handleMeteringUpdate,
      });

      setState('recording');

      // Start duration timer
      durationInterval.current = setInterval(() => {
        const elapsed = Date.now() - recordingStartTime.current;
        setDuration(elapsed);

        // Auto-stop at max duration
        if (elapsed >= maxDuration) {
          stopRecording();
        }
      }, 100);
    } catch (err) {
      const errorMessage = err instanceof AudioRecorderError
        ? err.message
        : 'Failed to start recording. Please try again.';

      if (err instanceof AudioRecorderError && err.code === 'PERMISSION_DENIED') {
        // Permission alert is already shown by AudioRecorder
        return;
      }

      setError(errorMessage);
      Alert.alert('Recording Error', errorMessage);
    }
  }, [maxDuration, handleRecordingStatus, handleMeteringUpdate]);

  // Stop recording
  const stopRecording = useCallback(async () => {
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
      durationInterval.current = null;
    }

    try {
      const result = await AudioRecorder.stopRecording();

      if (result.duration < minDuration) {
        setError(`Recording too short. Minimum duration is ${formatDuration(minDuration)}.`);
        Alert.alert(
          'Recording Too Short',
          `Please record for at least ${formatDuration(minDuration)}.`,
          [{ text: 'OK' }]
        );
        setState('idle');
        setMeteringLevels([]);
        return;
      }

      setRecording(result);
      setDuration(result.duration);
      setState('preview');
    } catch (err) {
      const errorMessage = err instanceof AudioRecorderError
        ? err.message
        : 'Failed to stop recording. Please try again.';
      setError(errorMessage);
      Alert.alert('Recording Error', errorMessage);
      setState('idle');
    }
  }, [minDuration]);

  // Play preview
  const playPreview = useCallback(async () => {
    if (!recording) return;

    try {
      setIsPlaying(true);
      setPlaybackProgress(0);

      await AudioRecorder.play(recording.uri, {
        onStatusUpdate: handlePlaybackStatus,
        onFinish: () => {
          setIsPlaying(false);
          setPlaybackProgress(0);
        },
      });
    } catch (err) {
      setIsPlaying(false);
      const errorMessage = err instanceof AudioRecorderError
        ? err.message
        : 'Failed to play recording.';
      Alert.alert('Playback Error', errorMessage);
    }
  }, [recording, handlePlaybackStatus]);

  // Stop preview
  const stopPreview = useCallback(async () => {
    await AudioRecorder.stopPlayback();
    setIsPlaying(false);
    setPlaybackProgress(0);
  }, []);

  // Cancel recording
  const handleCancel = useCallback(async () => {
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
      durationInterval.current = null;
    }

    await AudioRecorder.cancelRecording();
    await AudioRecorder.stopPlayback();

    setState('idle');
    setDuration(0);
    setRecording(null);
    setMeteringLevels([]);
    setPlaybackProgress(0);
    setIsPlaying(false);
    setError(null);

    if (compact) {
      setIsExpanded(false);
      onCollapse?.();
    }

    onCancel?.();
  }, [compact, onCancel, onCollapse]);

  // Send recording
  const handleSend = useCallback(async () => {
    if (!recording) return;

    setIsLoading(true);

    try {
      await AudioRecorder.stopPlayback();

      const result: VoiceRecordingResult = {
        uri: recording.uri,
        duration: recording.duration,
        size: recording.size,
        mimeType: recording.mimeType,
        waveform: recording.meteringLevels || meteringLevels,
      };

      await onSend(result);

      // Reset state after successful send
      setState('idle');
      setDuration(0);
      setRecording(null);
      setMeteringLevels([]);
      setPlaybackProgress(0);
      setIsPlaying(false);

      if (compact) {
        setIsExpanded(false);
        onCollapse?.();
      }
    } catch (err) {
      Alert.alert('Send Error', 'Failed to send voice message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [recording, meteringLevels, onSend, compact, onCollapse]);

  // Handle main button press
  const handleMainButtonPress = useCallback(() => {
    switch (state) {
      case 'idle':
        if (compact && !isExpanded) {
          setIsExpanded(true);
          onExpand?.();
        } else {
          startRecording();
        }
        break;
      case 'recording':
        stopRecording();
        break;
      case 'preview':
      case 'paused':
        if (isPlaying) {
          stopPreview();
        } else {
          playPreview();
        }
        break;
    }
  }, [state, compact, isExpanded, isPlaying, onExpand, startRecording, stopRecording, playPreview, stopPreview]);

  // Render compact mode (just mic button)
  if (compact && !isExpanded) {
    return (
      <TouchableOpacity
        style={[
          stylesWithTheme.compactButton,
          disabled && stylesWithTheme.disabledButton,
        ]}
        onPress={handleMainButtonPress}
        disabled={disabled || !!error}
        accessibilityRole="button"
        accessibilityLabel="Record voice message"
        testID={testID}
      >
        <View style={styles.micIconContainer}>
          <View style={[styles.micBody, { backgroundColor: theme.colors.primary }]} />
          <View style={[styles.micBase, { borderColor: theme.colors.primary }]} />
          <View style={[styles.micStand, { backgroundColor: theme.colors.primary }]} />
        </View>
      </TouchableOpacity>
    );
  }

  // Render expanded mode
  return (
    <View
      style={[
        stylesWithTheme.container,
        disabled && stylesWithTheme.disabledContainer,
      ]}
      testID={testID}
    >
      {/* Error message */}
      {error && state === 'idle' && (
        <Text style={stylesWithTheme.errorText}>{error}</Text>
      )}

      {/* Main content */}
      <View style={stylesWithTheme.mainContent}>
        {/* Cancel button */}
        {(state === 'recording' || state === 'preview') && (
          <TouchableOpacity
            style={stylesWithTheme.actionButton}
            onPress={handleCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel recording"
          >
            <Text style={stylesWithTheme.cancelText}>Cancel</Text>
          </TouchableOpacity>
        )}

        {/* Recording info / Waveform */}
        <View style={stylesWithTheme.centerContent}>
          {state === 'idle' ? (
            <Text style={stylesWithTheme.instructionText}>
              Tap microphone to record
            </Text>
          ) : (
            <>
              <Waveform
                levels={meteringLevels}
                isRecording={state === 'recording'}
                isPlaying={isPlaying}
                playbackProgress={playbackProgress}
                theme={theme}
              />
              <Text style={stylesWithTheme.durationText}>
                {formatDuration(duration)}
                {state === 'recording' && (
                  <Text style={stylesWithTheme.maxDurationText}>
                    {' / '}{formatDuration(maxDuration)}
                  </Text>
                )}
              </Text>
            </>
          )}
        </View>

        {/* Record / Play button */}
        <RecordButton
          state={state}
          onPress={handleMainButtonPress}
          disabled={disabled || !!error}
          theme={theme}
        />

        {/* Send button */}
        {state === 'preview' && (
          <TouchableOpacity
            style={[
              stylesWithTheme.actionButton,
              stylesWithTheme.sendButton,
              { backgroundColor: theme.colors.primary },
            ]}
            onPress={handleSend}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel="Send voice message"
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={theme.colors.textInverse} />
            ) : (
              <Text style={[stylesWithTheme.sendText, { color: theme.colors.textInverse }]}>
                Send
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Recording indicator */}
      {state === 'recording' && (
        <View style={stylesWithTheme.recordingIndicator}>
          <View style={[stylesWithTheme.recordingDot, { backgroundColor: theme.colors.error }]} />
          <Text style={stylesWithTheme.recordingText}>Recording...</Text>
        </View>
      )}
    </View>
  );
};

// ========================================
// STYLES
// ========================================

const styles = StyleSheet.create({
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    flex: 1,
    marginHorizontal: 8,
  },
  waveformBar: {
    borderRadius: 2,
  },
  recordButtonWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopIcon: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  playIconContainer: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  playIcon: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 16,
    borderRightWidth: 0,
    borderTopWidth: 10,
    borderBottomWidth: 10,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: 'transparent',
  },
  micIconContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBody: {
    width: 10,
    height: 14,
    borderRadius: 5,
  },
  micBase: {
    width: 16,
    height: 8,
    borderWidth: 2,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: 'transparent',
    marginTop: -2,
  },
  micStand: {
    width: 2,
    height: 6,
    marginTop: 0,
  },
});

const createStyles = (theme: ConferBotTheme) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
    },
    disabledContainer: {
      opacity: 0.5,
    },
    compactButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    disabledButton: {
      opacity: 0.5,
    },
    mainContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 60,
    },
    centerContent: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: theme.spacing.sm,
    },
    instructionText: {
      fontSize: theme.typography.fontSize.md,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    durationText: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.text,
      marginTop: theme.spacing.xs,
    },
    maxDurationText: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.textSecondary,
      fontWeight: theme.typography.fontWeight.regular,
    },
    actionButton: {
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      minWidth: 70,
      alignItems: 'center',
    },
    cancelText: {
      fontSize: theme.typography.fontSize.md,
      color: theme.colors.textSecondary,
      fontWeight: theme.typography.fontWeight.medium,
    },
    sendButton: {
      minWidth: 70,
    },
    sendText: {
      fontSize: theme.typography.fontSize.md,
      fontWeight: theme.typography.fontWeight.semibold,
    },
    recordingIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: theme.spacing.xs,
    },
    recordingDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: theme.spacing.xs,
    },
    recordingText: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.error,
      fontWeight: theme.typography.fontWeight.medium,
    },
    errorText: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.error,
      textAlign: 'center',
      marginBottom: theme.spacing.sm,
    },
  });

export default VoiceRecorder;
