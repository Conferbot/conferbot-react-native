/**
 * Utils index
 *
 * Exports all utility functions and classes from the utils module.
 */

export {
  FilePicker,
  FilePickerError,
  formatFileSize,
  isFilePickerAvailable,
  isImagePickerAvailable,
  getAvailablePickerLibrary,
} from './FilePicker';

export type {
  FileType,
  FilePickerResult,
  FilePickerOptions,
  ImagePickerOptions,
  CameraOptions,
} from './FilePicker';

// Link Detection Utilities
export {
  detectUrls,
  normalizeUrl,
  isValidUrl,
  isImageUrl,
  parseTextForUrls,
  extractDomain,
  getFaviconUrl,
  truncateUrl,
} from './LinkDetector';

export type {
  DetectedUrl,
  ParsedTextResult,
  TextSegment,
} from './LinkDetector';

// Audio Recording Utilities
export {
  AudioRecorder,
  AudioRecorderError,
  formatDuration,
  formatDurationDetailed,
  normalizeMeteringLevel,
  isAudioRecorderAvailable,
  getAvailableAudioLibrary,
} from './AudioRecorder';

export type {
  RecordingState,
  AudioRecorderResult,
  AudioRecorderOptions,
  AudioPlaybackOptions,
  RecordingStatus,
  PlaybackStatus,
} from './AudioRecorder';
