// @ts-nocheck
/**
 * AudioRecorder.ts
 *
 * Audio recording utility for React Native that provides a unified interface
 * for recording voice messages across platforms.
 *
 * Supports both expo-av and react-native-audio-recorder-player.
 *
 * Usage:
 * ```tsx
 * import { AudioRecorder, AudioRecorderResult } from '../utils/AudioRecorder';
 *
 * // Check if recording is available
 * if (AudioRecorder.isAvailable()) {
 *   // Start recording
 *   await AudioRecorder.startRecording();
 *
 *   // Stop and get result
 *   const result = await AudioRecorder.stopRecording();
 *   console.log(result.uri, result.duration);
 *
 *   // Play preview
 *   await AudioRecorder.playPreview(result.uri);
 * }
 * ```
 */

// @ts-ignore
import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';

// ========================================
// TYPES
// ========================================

/**
 * Recording state
 */
export type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';

/**
 * Result from audio recording
 */
export interface AudioRecorderResult {
  /** Unique identifier for this recording */
  id: string;
  /** File URI (local path) */
  uri: string;
  /** Duration in milliseconds */
  duration: number;
  /** File size in bytes */
  size: number;
  /** MIME type */
  mimeType: string;
  /** File extension */
  extension: string;
  /** Metering levels during recording (for waveform) */
  meteringLevels?: number[];
}

/**
 * Recording options
 */
export interface AudioRecorderOptions {
  /** Maximum recording duration in milliseconds */
  maxDuration?: number;
  /** Minimum recording duration in milliseconds */
  minDuration?: number;
  /** Audio quality (0-1, default 0.8) */
  quality?: number;
  /** Sample rate in Hz (default 44100) */
  sampleRate?: number;
  /** Number of channels (1 = mono, 2 = stereo, default 1) */
  channels?: number;
  /** Bit rate in bits per second */
  bitRate?: number;
  /** Audio format (m4a, mp3, wav) */
  format?: 'aac' | 'mp3' | 'wav' | 'm4a';
  /** Enable metering for waveform visualization */
  enableMetering?: boolean;
  /** Metering update interval in ms (default 100) */
  meteringInterval?: number;
  /** Callback for recording status updates */
  onStatusUpdate?: (status: RecordingStatus) => void;
  /** Callback for metering updates */
  onMeteringUpdate?: (level: number) => void;
}

/**
 * Playback options
 */
export interface AudioPlaybackOptions {
  /** Playback rate (0.5 - 2.0, default 1.0) */
  rate?: number;
  /** Volume (0-1, default 1.0) */
  volume?: number;
  /** Callback for playback status updates */
  onStatusUpdate?: (status: PlaybackStatus) => void;
  /** Callback when playback finishes */
  onFinish?: () => void;
}

/**
 * Recording status
 */
export interface RecordingStatus {
  /** Current state */
  state: RecordingState;
  /** Duration recorded so far in ms */
  durationMs: number;
  /** Current metering level (-160 to 0 dB) */
  metering?: number;
  /** Whether recording is allowed to continue */
  canRecord: boolean;
}

/**
 * Playback status
 */
export interface PlaybackStatus {
  /** Whether audio is playing */
  isPlaying: boolean;
  /** Whether audio is loaded */
  isLoaded: boolean;
  /** Current position in ms */
  positionMs: number;
  /** Total duration in ms */
  durationMs: number;
  /** Whether playback finished */
  didFinish: boolean;
}

/**
 * Error from audio recorder
 */
export class AudioRecorderError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'AudioRecorderError';
  }
}

// ========================================
// LIBRARY DETECTION
// ========================================

interface ExpoAVModule {
  Audio: {
    requestPermissionsAsync: () => Promise<{ status: string; granted: boolean }>;
    setAudioModeAsync: (options: any) => Promise<void>;
    Recording: new () => any;
    Sound: {
      createAsync: (source: any, initialStatus?: any) => Promise<{ sound: any; status: any }>;
    };
    RecordingOptionsPresets: {
      HIGH_QUALITY: any;
      LOW_QUALITY: any;
    };
    InterruptionModeIOS: {
      DoNotMix: number;
      DuckOthers: number;
      MixWithOthers: number;
    };
    InterruptionModeAndroid: {
      DoNotMix: number;
      DuckOthers: number;
    };
  };
}

interface AudioRecorderPlayerModule {
  default: new () => {
    startRecorder: (path?: string, options?: any) => Promise<string>;
    stopRecorder: () => Promise<string>;
    pauseRecorder: () => Promise<string>;
    resumeRecorder: () => Promise<string>;
    startPlayer: (path: string) => Promise<string>;
    stopPlayer: () => Promise<string>;
    pausePlayer: () => Promise<string>;
    resumePlayer: () => Promise<string>;
    seekToPlayer: (ms: number) => Promise<string>;
    setVolume: (volume: number) => Promise<string>;
    addRecordBackListener: (callback: (e: any) => void) => void;
    removeRecordBackListener: () => void;
    addPlayBackListener: (callback: (e: any) => void) => void;
    removePlayBackListener: () => void;
  };
  AudioSet: {
    AudioEncoderAndroid: any;
    AudioSourceAndroid: any;
    AVEncoderAudioQualityIOSType: any;
    AVEncodingOption: any;
  };
}

// Try to import libraries dynamically
let expoAV: ExpoAVModule | null = null;
let audioRecorderPlayer: AudioRecorderPlayerModule | null = null;

// Attempt to load expo-av
try {
  expoAV = require('expo-av');
} catch {
  // Not installed
}

// Attempt to load react-native-audio-recorder-player
try {
  audioRecorderPlayer = require('react-native-audio-recorder-player');
} catch {
  // Not installed
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Generate a unique ID for recordings
 */
const generateRecordingId = (): string => {
  return `recording_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Format duration for display (mm:ss)
 */
export const formatDuration = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Format duration with milliseconds (mm:ss.ms)
 */
export const formatDurationDetailed = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = Math.floor((ms % 1000) / 10);
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
};

/**
 * Convert metering level to normalized value (0-1)
 */
export const normalizeMeteringLevel = (level: number): number => {
  // Level is typically in dB, ranging from -160 to 0
  // Normalize to 0-1 range
  const minDb = -60;
  const maxDb = 0;
  const clampedLevel = Math.max(minDb, Math.min(maxDb, level));
  return (clampedLevel - minDb) / (maxDb - minDb);
};

/**
 * Check if audio recorder is available
 */
export const isAudioRecorderAvailable = (): boolean => {
  return !!(expoAV || audioRecorderPlayer);
};

/**
 * Get the name of the available audio library
 */
export const getAvailableAudioLibrary = (): string | null => {
  if (expoAV) return 'expo-av';
  if (audioRecorderPlayer) return 'react-native-audio-recorder-player';
  return null;
};

// ========================================
// PERMISSION HANDLING
// ========================================

/**
 * Request microphone permission
 */
const requestMicrophonePermission = async (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission',
          message: 'This app needs access to your microphone to record voice messages.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn('[AudioRecorder] Microphone permission error:', err);
      return false;
    }
  }

  // For Expo
  if (expoAV) {
    const { status } = await expoAV.Audio.requestPermissionsAsync();
    return status === 'granted';
  }

  return true; // iOS handles permission in info.plist
};

/**
 * Show permission denied alert
 */
const showPermissionDeniedAlert = (): void => {
  Alert.alert(
    'Microphone Permission Required',
    'Microphone permission is required to record voice messages. Please enable it in Settings.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings() },
    ]
  );
};

// ========================================
// EXPO-AV IMPLEMENTATION
// ========================================

let expoRecording: any = null;
let expoSound: any = null;
let expoMeteringInterval: ReturnType<typeof setInterval> | null = null;
let expoMeteringLevels: number[] = [];
let expoRecordingStartTime: number = 0;

const setupExpoAudioMode = async (): Promise<void> => {
  if (!expoAV) return;

  await expoAV.Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    interruptionModeIOS: expoAV.Audio.InterruptionModeIOS.DoNotMix,
    interruptionModeAndroid: expoAV.Audio.InterruptionModeAndroid.DoNotMix,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
};

const startExpoRecording = async (options: AudioRecorderOptions): Promise<void> => {
  if (!expoAV) {
    throw new AudioRecorderError('NOT_AVAILABLE', 'expo-av is not installed');
  }

  const hasPermission = await requestMicrophonePermission();
  if (!hasPermission) {
    showPermissionDeniedAlert();
    throw new AudioRecorderError('PERMISSION_DENIED', 'Microphone permission denied');
  }

  await setupExpoAudioMode();

  // Create and prepare recording
  expoRecording = new expoAV.Audio.Recording();

  const recordingOptions = {
    ...expoAV.Audio.RecordingOptionsPresets.HIGH_QUALITY,
    android: {
      extension: '.m4a',
      outputFormat: 2, // MPEG_4
      audioEncoder: 3, // AAC
      sampleRate: options.sampleRate || 44100,
      numberOfChannels: options.channels || 1,
      bitRate: options.bitRate || 128000,
    },
    ios: {
      extension: '.m4a',
      outputFormat: 'aac',
      audioQuality: 127, // MAX
      sampleRate: options.sampleRate || 44100,
      numberOfChannels: options.channels || 1,
      bitRate: options.bitRate || 128000,
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
    },
    web: {
      mimeType: 'audio/webm',
      bitsPerSecond: options.bitRate || 128000,
    },
  };

  await expoRecording.prepareToRecordAsync(recordingOptions);

  // Set up metering callback
  if (options.enableMetering) {
    expoRecording.setOnRecordingStatusUpdate((status: any) => {
      if (status.isRecording && status.metering !== undefined) {
        const normalizedLevel = normalizeMeteringLevel(status.metering);
        expoMeteringLevels.push(normalizedLevel);
        options.onMeteringUpdate?.(normalizedLevel);
      }

      if (options.onStatusUpdate) {
        options.onStatusUpdate({
          state: status.isRecording ? 'recording' : 'idle',
          durationMs: status.durationMillis || 0,
          metering: status.metering,
          canRecord: status.canRecord ?? true,
        });
      }

      // Check max duration
      if (options.maxDuration && status.durationMillis >= options.maxDuration) {
        stopExpoRecording();
      }
    });

    // Enable metering
    await expoRecording.setProgressUpdateInterval(options.meteringInterval || 100);
  }

  expoMeteringLevels = [];
  expoRecordingStartTime = Date.now();

  await expoRecording.startAsync();
};

const stopExpoRecording = async (): Promise<AudioRecorderResult> => {
  if (!expoRecording) {
    throw new AudioRecorderError('NO_RECORDING', 'No recording in progress');
  }

  await expoRecording.stopAndUnloadAsync();

  const uri = expoRecording.getURI();
  const status = await expoRecording.getStatusAsync();

  // Clean up metering interval
  if (expoMeteringInterval) {
    clearInterval(expoMeteringInterval);
    expoMeteringInterval = null;
  }

  const result: AudioRecorderResult = {
    id: generateRecordingId(),
    uri: uri || '',
    duration: status.durationMillis || 0,
    size: 0, // Not available from expo-av
    mimeType: 'audio/m4a',
    extension: 'm4a',
    meteringLevels: expoMeteringLevels,
  };

  expoRecording = null;
  expoMeteringLevels = [];

  return result;
};

const pauseExpoRecording = async (): Promise<void> => {
  if (!expoRecording) {
    throw new AudioRecorderError('NO_RECORDING', 'No recording in progress');
  }
  await expoRecording.pauseAsync();
};

const resumeExpoRecording = async (): Promise<void> => {
  if (!expoRecording) {
    throw new AudioRecorderError('NO_RECORDING', 'No recording in progress');
  }
  await expoRecording.startAsync();
};

const cancelExpoRecording = async (): Promise<void> => {
  if (expoRecording) {
    try {
      await expoRecording.stopAndUnloadAsync();
    } catch {
      // Ignore errors during cancel
    }
    expoRecording = null;
  }
  if (expoMeteringInterval) {
    clearInterval(expoMeteringInterval);
    expoMeteringInterval = null;
  }
  expoMeteringLevels = [];
};

const playExpoSound = async (uri: string, options: AudioPlaybackOptions = {}): Promise<void> => {
  if (!expoAV) {
    throw new AudioRecorderError('NOT_AVAILABLE', 'expo-av is not installed');
  }

  // Stop any existing playback
  await stopExpoSound();

  // Configure audio mode for playback
  await expoAV.Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    interruptionModeIOS: expoAV.Audio.InterruptionModeIOS.DoNotMix,
    interruptionModeAndroid: expoAV.Audio.InterruptionModeAndroid.DoNotMix,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });

  const { sound, status } = await expoAV.Audio.Sound.createAsync(
    { uri },
    {
      shouldPlay: true,
      rate: options.rate || 1.0,
      volume: options.volume || 1.0,
      progressUpdateIntervalMillis: 100,
    }
  );

  expoSound = sound;

  // Set up status callback
  sound.setOnPlaybackStatusUpdate((playbackStatus: any) => {
    if (options.onStatusUpdate) {
      options.onStatusUpdate({
        isPlaying: playbackStatus.isPlaying || false,
        isLoaded: playbackStatus.isLoaded || false,
        positionMs: playbackStatus.positionMillis || 0,
        durationMs: playbackStatus.durationMillis || 0,
        didFinish: playbackStatus.didJustFinish || false,
      });
    }

    if (playbackStatus.didJustFinish) {
      options.onFinish?.();
    }
  });
};

const stopExpoSound = async (): Promise<void> => {
  if (expoSound) {
    await expoSound.stopAsync();
    await expoSound.unloadAsync();
    expoSound = null;
  }
};

const pauseExpoSound = async (): Promise<void> => {
  if (expoSound) {
    await expoSound.pauseAsync();
  }
};

const resumeExpoSound = async (): Promise<void> => {
  if (expoSound) {
    await expoSound.playAsync();
  }
};

const seekExpoSound = async (positionMs: number): Promise<void> => {
  if (expoSound) {
    await expoSound.setPositionAsync(positionMs);
  }
};

// ========================================
// REACT-NATIVE-AUDIO-RECORDER-PLAYER IMPLEMENTATION
// ========================================

let rnAudioRecorderPlayer: any = null;
let rnMeteringLevels: number[] = [];
let rnRecordingOptions: AudioRecorderOptions = {};

const startRNRecording = async (options: AudioRecorderOptions): Promise<void> => {
  if (!audioRecorderPlayer) {
    throw new AudioRecorderError('NOT_AVAILABLE', 'react-native-audio-recorder-player is not installed');
  }

  const hasPermission = await requestMicrophonePermission();
  if (!hasPermission) {
    showPermissionDeniedAlert();
    throw new AudioRecorderError('PERMISSION_DENIED', 'Microphone permission denied');
  }

  if (!rnAudioRecorderPlayer) {
    rnAudioRecorderPlayer = new audioRecorderPlayer.default();
  }

  rnRecordingOptions = options;
  rnMeteringLevels = [];

  // Set up recording listener
  rnAudioRecorderPlayer.addRecordBackListener((e: any) => {
    const normalizedLevel = normalizeMeteringLevel(e.currentMetering || -160);
    rnMeteringLevels.push(normalizedLevel);

    if (options.enableMetering) {
      options.onMeteringUpdate?.(normalizedLevel);
    }

    if (options.onStatusUpdate) {
      options.onStatusUpdate({
        state: 'recording',
        durationMs: e.currentPosition || 0,
        metering: e.currentMetering,
        canRecord: true,
      });
    }

    // Check max duration
    if (options.maxDuration && e.currentPosition >= options.maxDuration) {
      stopRNRecording();
    }
  });

  const audioSet = audioRecorderPlayer.AudioSet;
  const path = Platform.select({
    ios: `voice_${Date.now()}.m4a`,
    android: `${require('react-native').Dirs?.CacheDir || '/data/data/com.conferbot/cache'}/voice_${Date.now()}.mp4`,
  });

  await rnAudioRecorderPlayer.startRecorder(path, {
    AudioEncoderAndroid: audioSet?.AudioEncoderAndroid?.AAC,
    AudioSourceAndroid: audioSet?.AudioSourceAndroid?.MIC,
    AVEncoderAudioQualityIOSType: audioSet?.AVEncoderAudioQualityIOSType?.high,
    AVNumberOfChannelsKeyIOS: options.channels || 1,
    AVSampleRateKeyIOS: options.sampleRate || 44100,
    OutputFormatAndroid: 2, // MPEG_4
  });
};

const stopRNRecording = async (): Promise<AudioRecorderResult> => {
  if (!rnAudioRecorderPlayer) {
    throw new AudioRecorderError('NO_RECORDING', 'No recording in progress');
  }

  const result = await rnAudioRecorderPlayer.stopRecorder();
  rnAudioRecorderPlayer.removeRecordBackListener();

  // Get duration from result or estimate
  const durationMs = rnMeteringLevels.length * (rnRecordingOptions.meteringInterval || 100);

  return {
    id: generateRecordingId(),
    uri: result,
    duration: durationMs,
    size: 0,
    mimeType: 'audio/m4a',
    extension: 'm4a',
    meteringLevels: rnMeteringLevels,
  };
};

const pauseRNRecording = async (): Promise<void> => {
  if (!rnAudioRecorderPlayer) {
    throw new AudioRecorderError('NO_RECORDING', 'No recording in progress');
  }
  await rnAudioRecorderPlayer.pauseRecorder();
};

const resumeRNRecording = async (): Promise<void> => {
  if (!rnAudioRecorderPlayer) {
    throw new AudioRecorderError('NO_RECORDING', 'No recording in progress');
  }
  await rnAudioRecorderPlayer.resumeRecorder();
};

const cancelRNRecording = async (): Promise<void> => {
  if (rnAudioRecorderPlayer) {
    try {
      await rnAudioRecorderPlayer.stopRecorder();
      rnAudioRecorderPlayer.removeRecordBackListener();
    } catch {
      // Ignore errors during cancel
    }
  }
  rnMeteringLevels = [];
};

const playRNSound = async (uri: string, options: AudioPlaybackOptions = {}): Promise<void> => {
  if (!audioRecorderPlayer) {
    throw new AudioRecorderError('NOT_AVAILABLE', 'react-native-audio-recorder-player is not installed');
  }

  if (!rnAudioRecorderPlayer) {
    rnAudioRecorderPlayer = new audioRecorderPlayer.default();
  }

  // Set up playback listener
  rnAudioRecorderPlayer.addPlayBackListener((e: any) => {
    if (options.onStatusUpdate) {
      options.onStatusUpdate({
        isPlaying: e.currentPosition < e.duration,
        isLoaded: true,
        positionMs: e.currentPosition || 0,
        durationMs: e.duration || 0,
        didFinish: e.currentPosition >= e.duration,
      });
    }

    if (e.currentPosition >= e.duration) {
      options.onFinish?.();
    }
  });

  if (options.volume !== undefined) {
    await rnAudioRecorderPlayer.setVolume(options.volume);
  }

  await rnAudioRecorderPlayer.startPlayer(uri);
};

const stopRNSound = async (): Promise<void> => {
  if (rnAudioRecorderPlayer) {
    await rnAudioRecorderPlayer.stopPlayer();
    rnAudioRecorderPlayer.removePlayBackListener();
  }
};

const pauseRNSound = async (): Promise<void> => {
  if (rnAudioRecorderPlayer) {
    await rnAudioRecorderPlayer.pausePlayer();
  }
};

const resumeRNSound = async (): Promise<void> => {
  if (rnAudioRecorderPlayer) {
    await rnAudioRecorderPlayer.resumePlayer();
  }
};

const seekRNSound = async (positionMs: number): Promise<void> => {
  if (rnAudioRecorderPlayer) {
    await rnAudioRecorderPlayer.seekToPlayer(positionMs);
  }
};

// ========================================
// MAIN AUDIO RECORDER CLASS
// ========================================

/**
 * AudioRecorder utility class
 *
 * Provides a unified interface for recording and playing audio.
 * Automatically uses the available library (expo-av or react-native-audio-recorder-player).
 */
export const AudioRecorder = {
  /**
   * Check if audio recording is available
   */
  isAvailable: isAudioRecorderAvailable,

  /**
   * Get the name of the available library
   */
  getLibraryName: getAvailableAudioLibrary,

  /**
   * Format duration for display
   */
  formatDuration,

  /**
   * Format duration with milliseconds
   */
  formatDurationDetailed,

  /**
   * Normalize metering level to 0-1 range
   */
  normalizeMeteringLevel,

  /**
   * Request microphone permission
   */
  requestPermission: requestMicrophonePermission,

  /**
   * Start recording
   *
   * @param options Recording options
   */
  startRecording: async (options: AudioRecorderOptions = {}): Promise<void> => {
    if (expoAV) {
      return startExpoRecording(options);
    }

    if (audioRecorderPlayer) {
      return startRNRecording(options);
    }

    throw new AudioRecorderError(
      'NOT_AVAILABLE',
      'No audio recording library found. Install expo-av or react-native-audio-recorder-player.'
    );
  },

  /**
   * Stop recording and get result
   *
   * @returns The recorded audio
   */
  stopRecording: async (): Promise<AudioRecorderResult> => {
    if (expoAV && expoRecording) {
      return stopExpoRecording();
    }

    if (audioRecorderPlayer && rnAudioRecorderPlayer) {
      return stopRNRecording();
    }

    throw new AudioRecorderError('NO_RECORDING', 'No recording in progress');
  },

  /**
   * Pause recording
   */
  pauseRecording: async (): Promise<void> => {
    if (expoAV && expoRecording) {
      return pauseExpoRecording();
    }

    if (audioRecorderPlayer && rnAudioRecorderPlayer) {
      return pauseRNRecording();
    }

    throw new AudioRecorderError('NO_RECORDING', 'No recording in progress');
  },

  /**
   * Resume recording
   */
  resumeRecording: async (): Promise<void> => {
    if (expoAV && expoRecording) {
      return resumeExpoRecording();
    }

    if (audioRecorderPlayer && rnAudioRecorderPlayer) {
      return resumeRNRecording();
    }

    throw new AudioRecorderError('NO_RECORDING', 'No recording in progress');
  },

  /**
   * Cancel recording without saving
   */
  cancelRecording: async (): Promise<void> => {
    if (expoAV) {
      return cancelExpoRecording();
    }

    if (audioRecorderPlayer) {
      return cancelRNRecording();
    }
  },

  /**
   * Check if currently recording
   */
  isRecording: (): boolean => {
    return !!(expoRecording || (rnAudioRecorderPlayer && rnMeteringLevels.length > 0));
  },

  /**
   * Play audio
   *
   * @param uri Audio file URI
   * @param options Playback options
   */
  play: async (uri: string, options: AudioPlaybackOptions = {}): Promise<void> => {
    if (expoAV) {
      return playExpoSound(uri, options);
    }

    if (audioRecorderPlayer) {
      return playRNSound(uri, options);
    }

    throw new AudioRecorderError(
      'NOT_AVAILABLE',
      'No audio playback library found. Install expo-av or react-native-audio-recorder-player.'
    );
  },

  /**
   * Stop playback
   */
  stopPlayback: async (): Promise<void> => {
    if (expoAV) {
      return stopExpoSound();
    }

    if (audioRecorderPlayer) {
      return stopRNSound();
    }
  },

  /**
   * Pause playback
   */
  pausePlayback: async (): Promise<void> => {
    if (expoAV) {
      return pauseExpoSound();
    }

    if (audioRecorderPlayer) {
      return pauseRNSound();
    }
  },

  /**
   * Resume playback
   */
  resumePlayback: async (): Promise<void> => {
    if (expoAV) {
      return resumeExpoSound();
    }

    if (audioRecorderPlayer) {
      return resumeRNSound();
    }
  },

  /**
   * Seek to position
   *
   * @param positionMs Position in milliseconds
   */
  seekTo: async (positionMs: number): Promise<void> => {
    if (expoAV) {
      return seekExpoSound(positionMs);
    }

    if (audioRecorderPlayer) {
      return seekRNSound(positionMs);
    }
  },

  /**
   * Check if currently playing
   */
  isPlaying: (): boolean => {
    return !!expoSound;
  },
};

export default AudioRecorder;
