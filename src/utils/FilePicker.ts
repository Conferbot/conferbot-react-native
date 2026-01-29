/**
 * FilePicker.ts
 *
 * File picker utility for React Native that provides a unified interface
 * for selecting documents, images, and videos across platforms.
 *
 * Supports both react-native-document-picker and expo-document-picker,
 * as well as react-native-image-picker and expo-image-picker for media.
 *
 * Usage:
 * ```tsx
 * import { FilePicker, FilePickerResult } from '../utils/FilePicker';
 *
 * // Pick documents
 * const files = await FilePicker.pickDocuments({ multiple: true });
 *
 * // Pick images
 * const images = await FilePicker.pickImages({ multiple: false });
 *
 * // Pick from camera
 * const photo = await FilePicker.takePhoto();
 *
 * // Pick any file
 * const file = await FilePicker.pick({ types: ['image', 'document'] });
 * ```
 */

import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';

// ========================================
// TYPES
// ========================================

/**
 * Supported file types for picking
 */
export type FileType = 'image' | 'video' | 'audio' | 'document' | 'all';

/**
 * Result from file picker
 */
export interface FilePickerResult {
  /** Unique identifier for this file */
  id: string;
  /** File name */
  name: string;
  /** File URI (local path) */
  uri: string;
  /** File size in bytes */
  size: number;
  /** MIME type */
  type: string;
  /** File extension */
  extension: string;
  /** Base64 encoded content (optional, for small files) */
  base64?: string;
  /** Width for images/videos */
  width?: number;
  /** Height for images/videos */
  height?: number;
  /** Duration for videos/audio in seconds */
  duration?: number;
}

/**
 * Options for picking files
 */
export interface FilePickerOptions {
  /** Allow multiple file selection */
  multiple?: boolean;
  /** File types to allow */
  types?: FileType[];
  /** Maximum file size in bytes */
  maxSize?: number;
  /** Maximum number of files (for multiple selection) */
  maxFiles?: number;
  /** Custom MIME types to allow */
  mimeTypes?: string[];
  /** Whether to copy file to app's cache (recommended) */
  copyToCacheDirectory?: boolean;
}

/**
 * Options for image picker
 */
export interface ImagePickerOptions extends FilePickerOptions {
  /** Allow editing/cropping */
  allowsEditing?: boolean;
  /** Aspect ratio for cropping [x, y] */
  aspect?: [number, number];
  /** Quality for compression (0-1) */
  quality?: number;
  /** Include base64 in result */
  includeBase64?: boolean;
  /** Maximum width to resize to */
  maxWidth?: number;
  /** Maximum height to resize to */
  maxHeight?: number;
}

/**
 * Options for camera
 */
export interface CameraOptions extends ImagePickerOptions {
  /** Use front or back camera */
  cameraType?: 'front' | 'back';
  /** Media type to capture */
  mediaType?: 'photo' | 'video' | 'mixed';
  /** Maximum video duration in seconds */
  videoMaxDuration?: number;
  /** Video quality */
  videoQuality?: 'high' | 'medium' | 'low';
}

/**
 * Error from file picker
 */
export class FilePickerError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'FilePickerError';
  }
}

// ========================================
// MIME TYPE MAPPINGS
// ========================================

const MIME_TYPE_MAPPINGS: Record<FileType, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'],
  video: ['video/mp4', 'video/quicktime', 'video/x-m4v', 'video/webm', 'video/3gpp'],
  audio: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/aac', 'audio/ogg', 'audio/m4a'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'application/json',
    'application/xml',
  ],
  all: ['*/*'],
};

// ========================================
// LIBRARY DETECTION
// ========================================

interface DocumentPickerModule {
  pick: (options: any) => Promise<any>;
  pickMultiple: (options: any) => Promise<any[]>;
  pickDirectory?: () => Promise<any>;
  types: Record<string, string>;
  isCancel: (error: any) => boolean;
}

interface ImagePickerModule {
  launchImageLibrary: (options: any) => Promise<any>;
  launchCamera: (options: any) => Promise<any>;
}

interface ExpoDocumentPickerModule {
  getDocumentAsync: (options: any) => Promise<any>;
}

interface ExpoImagePickerModule {
  launchImageLibraryAsync: (options: any) => Promise<any>;
  launchCameraAsync: (options: any) => Promise<any>;
  requestCameraPermissionsAsync: () => Promise<{ status: string }>;
  requestMediaLibraryPermissionsAsync: () => Promise<{ status: string }>;
  MediaTypeOptions: { Images: string; Videos: string; All: string };
}

// Try to import libraries dynamically
let documentPicker: DocumentPickerModule | null = null;
let imagePicker: ImagePickerModule | null = null;
let expoDocumentPicker: ExpoDocumentPickerModule | null = null;
let expoImagePicker: ExpoImagePickerModule | null = null;

// Attempt to load react-native-document-picker
try {
  documentPicker = require('react-native-document-picker');
} catch {
  // Not installed
}

// Attempt to load react-native-image-picker
try {
  imagePicker = require('react-native-image-picker');
} catch {
  // Not installed
}

// Attempt to load expo-document-picker
try {
  expoDocumentPicker = require('expo-document-picker');
} catch {
  // Not installed
}

// Attempt to load expo-image-picker
try {
  expoImagePicker = require('expo-image-picker');
} catch {
  // Not installed
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Generate a unique ID for files
 */
const generateFileId = (): string => {
  return `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Get file extension from URI or name
 */
const getFileExtension = (uri: string, mimeType?: string): string => {
  // Try to get from URI
  const uriMatch = uri.match(/\.([a-zA-Z0-9]+)(?:\?.*)?$/);
  if (uriMatch) {
    return uriMatch[1].toLowerCase();
  }

  // Try to get from MIME type
  if (mimeType) {
    const extensionMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/heic': 'heic',
      'video/mp4': 'mp4',
      'video/quicktime': 'mov',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'text/plain': 'txt',
    };
    return extensionMap[mimeType] || '';
  }

  return '';
};

/**
 * Get file name from URI
 */
const getFileName = (uri: string): string => {
  const decodedUri = decodeURIComponent(uri);
  const match = decodedUri.match(/([^/]+)(?:\?.*)?$/);
  return match ? match[1] : `file_${Date.now()}`;
};

/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

/**
 * Validate file size
 */
const validateFileSize = (size: number, maxSize?: number): void => {
  if (maxSize && size > maxSize) {
    throw new FilePickerError(
      'FILE_TOO_LARGE',
      `File size (${formatFileSize(size)}) exceeds maximum allowed size (${formatFileSize(maxSize)})`
    );
  }
};

/**
 * Get MIME types from file types
 */
const getMimeTypes = (types: FileType[]): string[] => {
  const mimeTypes: string[] = [];
  for (const type of types) {
    mimeTypes.push(...(MIME_TYPE_MAPPINGS[type] || []));
  }
  return mimeTypes;
};

/**
 * Check if a library is available for file picking
 */
export const isFilePickerAvailable = (): boolean => {
  return !!(documentPicker || expoDocumentPicker);
};

/**
 * Check if a library is available for image picking
 */
export const isImagePickerAvailable = (): boolean => {
  return !!(imagePicker || expoImagePicker);
};

/**
 * Get the name of the available picker library
 */
export const getAvailablePickerLibrary = (): string | null => {
  if (documentPicker) return 'react-native-document-picker';
  if (expoDocumentPicker) return 'expo-document-picker';
  if (imagePicker) return 'react-native-image-picker';
  if (expoImagePicker) return 'expo-image-picker';
  return null;
};

// ========================================
// PERMISSION HANDLING
// ========================================

/**
 * Request camera permission
 */
const requestCameraPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission',
          message: 'This app needs access to your camera to take photos.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn('[FilePicker] Camera permission error:', err);
      return false;
    }
  }

  // For Expo
  if (expoImagePicker) {
    const { status } = await expoImagePicker.requestCameraPermissionsAsync();
    return status === 'granted';
  }

  return true; // iOS handles permission in info.plist
};

/**
 * Request media library permission
 */
const requestMediaLibraryPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    try {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
      ]);
      return (
        granted[PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES] === PermissionsAndroid.RESULTS.GRANTED ||
        granted[PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO] === PermissionsAndroid.RESULTS.GRANTED
      );
    } catch (err) {
      console.warn('[FilePicker] Media library permission error:', err);
      return false;
    }
  } else if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        {
          title: 'Storage Permission',
          message: 'This app needs access to your files to select documents.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn('[FilePicker] Storage permission error:', err);
      return false;
    }
  }

  // For Expo
  if (expoImagePicker) {
    const { status } = await expoImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
  }

  return true; // iOS handles permission in info.plist
};

/**
 * Show permission denied alert
 */
const showPermissionDeniedAlert = (type: 'camera' | 'storage'): void => {
  const message =
    type === 'camera'
      ? 'Camera permission is required to take photos. Please enable it in Settings.'
      : 'Storage permission is required to select files. Please enable it in Settings.';

  Alert.alert('Permission Required', message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Open Settings', onPress: () => Linking.openSettings() },
  ]);
};

// ========================================
// DOCUMENT PICKER IMPLEMENTATIONS
// ========================================

/**
 * Pick documents using react-native-document-picker
 */
const pickWithDocumentPicker = async (options: FilePickerOptions): Promise<FilePickerResult[]> => {
  if (!documentPicker) {
    throw new FilePickerError('NOT_AVAILABLE', 'react-native-document-picker is not installed');
  }

  const types = options.types || ['all'];
  const mimeTypes = options.mimeTypes || getMimeTypes(types);

  try {
    const pickerOptions: any = {
      type: mimeTypes,
      copyTo: options.copyToCacheDirectory !== false ? 'cachesDirectory' : undefined,
      allowMultiSelection: options.multiple,
    };

    const results = options.multiple
      ? await documentPicker.pickMultiple(pickerOptions)
      : [await documentPicker.pick(pickerOptions)];

    const files: FilePickerResult[] = [];

    for (const result of results) {
      if (options.maxFiles && files.length >= options.maxFiles) break;

      const size = result.size || 0;
      validateFileSize(size, options.maxSize);

      files.push({
        id: generateFileId(),
        name: result.name || getFileName(result.uri),
        uri: result.fileCopyUri || result.uri,
        size,
        type: result.type || 'application/octet-stream',
        extension: getFileExtension(result.uri, result.type),
      });
    }

    return files;
  } catch (error: any) {
    if (documentPicker.isCancel(error)) {
      return []; // User cancelled
    }
    throw new FilePickerError('PICKER_ERROR', error.message || 'Failed to pick document');
  }
};

/**
 * Pick documents using expo-document-picker
 */
const pickWithExpoDocumentPicker = async (options: FilePickerOptions): Promise<FilePickerResult[]> => {
  if (!expoDocumentPicker) {
    throw new FilePickerError('NOT_AVAILABLE', 'expo-document-picker is not installed');
  }

  const types = options.types || ['all'];
  const mimeTypes = options.mimeTypes || getMimeTypes(types);

  try {
    const result = await expoDocumentPicker.getDocumentAsync({
      type: mimeTypes.length === 1 && mimeTypes[0] === '*/*' ? '*/*' : mimeTypes,
      copyToCacheDirectory: options.copyToCacheDirectory !== false,
      multiple: options.multiple,
    });

    if (result.canceled || result.type === 'cancel') {
      return []; // User cancelled
    }

    const assets = result.assets || [result];
    const files: FilePickerResult[] = [];

    for (const asset of assets) {
      if (options.maxFiles && files.length >= options.maxFiles) break;

      const size = asset.size || 0;
      validateFileSize(size, options.maxSize);

      files.push({
        id: generateFileId(),
        name: asset.name || getFileName(asset.uri),
        uri: asset.uri,
        size,
        type: asset.mimeType || 'application/octet-stream',
        extension: getFileExtension(asset.uri, asset.mimeType),
      });
    }

    return files;
  } catch (error: any) {
    throw new FilePickerError('PICKER_ERROR', error.message || 'Failed to pick document');
  }
};

// ========================================
// IMAGE PICKER IMPLEMENTATIONS
// ========================================

/**
 * Pick images using react-native-image-picker
 */
const pickImagesWithImagePicker = async (options: ImagePickerOptions): Promise<FilePickerResult[]> => {
  if (!imagePicker) {
    throw new FilePickerError('NOT_AVAILABLE', 'react-native-image-picker is not installed');
  }

  const hasPermission = await requestMediaLibraryPermission();
  if (!hasPermission) {
    showPermissionDeniedAlert('storage');
    return [];
  }

  try {
    const pickerOptions: any = {
      mediaType: 'photo',
      selectionLimit: options.multiple ? (options.maxFiles || 0) : 1,
      quality: options.quality ?? 0.8,
      maxWidth: options.maxWidth || 1920,
      maxHeight: options.maxHeight || 1920,
      includeBase64: options.includeBase64 || false,
    };

    const result = await imagePicker.launchImageLibrary(pickerOptions);

    if (result.didCancel || !result.assets) {
      return []; // User cancelled
    }

    if (result.errorCode) {
      throw new FilePickerError(result.errorCode, result.errorMessage || 'Failed to pick image');
    }

    const files: FilePickerResult[] = [];

    for (const asset of result.assets) {
      const size = asset.fileSize || 0;
      validateFileSize(size, options.maxSize);

      files.push({
        id: generateFileId(),
        name: asset.fileName || getFileName(asset.uri || ''),
        uri: asset.uri || '',
        size,
        type: asset.type || 'image/jpeg',
        extension: getFileExtension(asset.uri || '', asset.type),
        width: asset.width,
        height: asset.height,
        base64: asset.base64,
      });
    }

    return files;
  } catch (error: any) {
    throw new FilePickerError('PICKER_ERROR', error.message || 'Failed to pick image');
  }
};

/**
 * Pick images using expo-image-picker
 */
const pickImagesWithExpoImagePicker = async (options: ImagePickerOptions): Promise<FilePickerResult[]> => {
  if (!expoImagePicker) {
    throw new FilePickerError('NOT_AVAILABLE', 'expo-image-picker is not installed');
  }

  const hasPermission = await requestMediaLibraryPermission();
  if (!hasPermission) {
    showPermissionDeniedAlert('storage');
    return [];
  }

  try {
    const pickerOptions: any = {
      mediaTypes: expoImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: options.multiple || false,
      allowsEditing: options.allowsEditing || false,
      aspect: options.aspect,
      quality: options.quality ?? 0.8,
      base64: options.includeBase64 || false,
      selectionLimit: options.maxFiles || 0,
    };

    const result = await expoImagePicker.launchImageLibraryAsync(pickerOptions);

    if (result.canceled) {
      return []; // User cancelled
    }

    const files: FilePickerResult[] = [];

    for (const asset of result.assets) {
      const size = asset.fileSize || 0;
      validateFileSize(size, options.maxSize);

      files.push({
        id: generateFileId(),
        name: getFileName(asset.uri),
        uri: asset.uri,
        size,
        type: asset.mimeType || asset.type || 'image/jpeg',
        extension: getFileExtension(asset.uri, asset.mimeType),
        width: asset.width,
        height: asset.height,
        base64: asset.base64,
        duration: asset.duration,
      });
    }

    return files;
  } catch (error: any) {
    throw new FilePickerError('PICKER_ERROR', error.message || 'Failed to pick image');
  }
};

// ========================================
// CAMERA IMPLEMENTATIONS
// ========================================

/**
 * Take photo using react-native-image-picker
 */
const takePhotoWithImagePicker = async (options: CameraOptions): Promise<FilePickerResult | null> => {
  if (!imagePicker) {
    throw new FilePickerError('NOT_AVAILABLE', 'react-native-image-picker is not installed');
  }

  const hasPermission = await requestCameraPermission();
  if (!hasPermission) {
    showPermissionDeniedAlert('camera');
    return null;
  }

  try {
    const pickerOptions: any = {
      mediaType: options.mediaType || 'photo',
      cameraType: options.cameraType || 'back',
      quality: options.quality ?? 0.8,
      maxWidth: options.maxWidth || 1920,
      maxHeight: options.maxHeight || 1920,
      includeBase64: options.includeBase64 || false,
      videoQuality: options.videoQuality || 'high',
      durationLimit: options.videoMaxDuration,
    };

    const result = await imagePicker.launchCamera(pickerOptions);

    if (result.didCancel || !result.assets || result.assets.length === 0) {
      return null; // User cancelled
    }

    if (result.errorCode) {
      throw new FilePickerError(result.errorCode, result.errorMessage || 'Failed to take photo');
    }

    const asset = result.assets[0];
    const size = asset.fileSize || 0;
    validateFileSize(size, options.maxSize);

    return {
      id: generateFileId(),
      name: asset.fileName || getFileName(asset.uri || ''),
      uri: asset.uri || '',
      size,
      type: asset.type || 'image/jpeg',
      extension: getFileExtension(asset.uri || '', asset.type),
      width: asset.width,
      height: asset.height,
      base64: asset.base64,
      duration: asset.duration,
    };
  } catch (error: any) {
    throw new FilePickerError('CAMERA_ERROR', error.message || 'Failed to take photo');
  }
};

/**
 * Take photo using expo-image-picker
 */
const takePhotoWithExpoImagePicker = async (options: CameraOptions): Promise<FilePickerResult | null> => {
  if (!expoImagePicker) {
    throw new FilePickerError('NOT_AVAILABLE', 'expo-image-picker is not installed');
  }

  const hasPermission = await requestCameraPermission();
  if (!hasPermission) {
    showPermissionDeniedAlert('camera');
    return null;
  }

  try {
    const pickerOptions: any = {
      mediaTypes:
        options.mediaType === 'video'
          ? expoImagePicker.MediaTypeOptions.Videos
          : options.mediaType === 'mixed'
          ? expoImagePicker.MediaTypeOptions.All
          : expoImagePicker.MediaTypeOptions.Images,
      allowsEditing: options.allowsEditing || false,
      aspect: options.aspect,
      quality: options.quality ?? 0.8,
      base64: options.includeBase64 || false,
      cameraType: options.cameraType || 'back',
      videoMaxDuration: options.videoMaxDuration,
      videoQuality: options.videoQuality,
    };

    const result = await expoImagePicker.launchCameraAsync(pickerOptions);

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null; // User cancelled
    }

    const asset = result.assets[0];
    const size = asset.fileSize || 0;
    validateFileSize(size, options.maxSize);

    return {
      id: generateFileId(),
      name: getFileName(asset.uri),
      uri: asset.uri,
      size,
      type: asset.mimeType || asset.type || 'image/jpeg',
      extension: getFileExtension(asset.uri, asset.mimeType),
      width: asset.width,
      height: asset.height,
      base64: asset.base64,
      duration: asset.duration,
    };
  } catch (error: any) {
    throw new FilePickerError('CAMERA_ERROR', error.message || 'Failed to take photo');
  }
};

// ========================================
// MAIN FILE PICKER CLASS
// ========================================

/**
 * FilePicker utility class
 *
 * Provides a unified interface for picking files, images, and taking photos.
 * Automatically uses the available library (react-native or expo).
 */
export const FilePicker = {
  /**
   * Check if file picker is available
   */
  isAvailable: isFilePickerAvailable,

  /**
   * Check if image picker is available
   */
  isImagePickerAvailable: isImagePickerAvailable,

  /**
   * Get the name of the available library
   */
  getLibraryName: getAvailablePickerLibrary,

  /**
   * Format file size for display
   */
  formatSize: formatFileSize,

  /**
   * Pick documents
   *
   * @param options Picker options
   * @returns Array of selected files
   */
  pickDocuments: async (options: FilePickerOptions = {}): Promise<FilePickerResult[]> => {
    const docOptions = { ...options, types: options.types || ['document'] };

    if (documentPicker) {
      return pickWithDocumentPicker(docOptions);
    }

    if (expoDocumentPicker) {
      return pickWithExpoDocumentPicker(docOptions);
    }

    throw new FilePickerError(
      'NOT_AVAILABLE',
      'No document picker library found. Install react-native-document-picker or expo-document-picker.'
    );
  },

  /**
   * Pick any file type
   *
   * @param options Picker options
   * @returns Array of selected files
   */
  pick: async (options: FilePickerOptions = {}): Promise<FilePickerResult[]> => {
    if (documentPicker) {
      return pickWithDocumentPicker(options);
    }

    if (expoDocumentPicker) {
      return pickWithExpoDocumentPicker(options);
    }

    throw new FilePickerError(
      'NOT_AVAILABLE',
      'No file picker library found. Install react-native-document-picker or expo-document-picker.'
    );
  },

  /**
   * Pick images from gallery
   *
   * @param options Image picker options
   * @returns Array of selected images
   */
  pickImages: async (options: ImagePickerOptions = {}): Promise<FilePickerResult[]> => {
    if (imagePicker) {
      return pickImagesWithImagePicker(options);
    }

    if (expoImagePicker) {
      return pickImagesWithExpoImagePicker(options);
    }

    // Fall back to document picker for images
    if (documentPicker || expoDocumentPicker) {
      return FilePicker.pick({ ...options, types: ['image'] });
    }

    throw new FilePickerError(
      'NOT_AVAILABLE',
      'No image picker library found. Install react-native-image-picker or expo-image-picker.'
    );
  },

  /**
   * Pick videos from gallery
   *
   * @param options Picker options
   * @returns Array of selected videos
   */
  pickVideos: async (options: FilePickerOptions = {}): Promise<FilePickerResult[]> => {
    if (expoImagePicker) {
      const hasPermission = await requestMediaLibraryPermission();
      if (!hasPermission) {
        showPermissionDeniedAlert('storage');
        return [];
      }

      try {
        const result = await expoImagePicker.launchImageLibraryAsync({
          mediaTypes: expoImagePicker.MediaTypeOptions.Videos,
          allowsMultipleSelection: options.multiple || false,
          quality: 1,
          selectionLimit: options.maxFiles || 0,
        });

        if (result.canceled) {
          return [];
        }

        const files: FilePickerResult[] = [];

        for (const asset of result.assets) {
          const size = asset.fileSize || 0;
          validateFileSize(size, options.maxSize);

          files.push({
            id: generateFileId(),
            name: getFileName(asset.uri),
            uri: asset.uri,
            size,
            type: asset.mimeType || 'video/mp4',
            extension: getFileExtension(asset.uri, asset.mimeType),
            width: asset.width,
            height: asset.height,
            duration: asset.duration,
          });
        }

        return files;
      } catch (error: any) {
        throw new FilePickerError('PICKER_ERROR', error.message || 'Failed to pick video');
      }
    }

    // Fall back to document picker
    return FilePicker.pick({ ...options, types: ['video'] });
  },

  /**
   * Take a photo with the camera
   *
   * @param options Camera options
   * @returns The captured photo or null if cancelled
   */
  takePhoto: async (options: CameraOptions = {}): Promise<FilePickerResult | null> => {
    if (imagePicker) {
      return takePhotoWithImagePicker({ ...options, mediaType: 'photo' });
    }

    if (expoImagePicker) {
      return takePhotoWithExpoImagePicker({ ...options, mediaType: 'photo' });
    }

    throw new FilePickerError(
      'NOT_AVAILABLE',
      'No camera library found. Install react-native-image-picker or expo-image-picker.'
    );
  },

  /**
   * Record a video with the camera
   *
   * @param options Camera options
   * @returns The recorded video or null if cancelled
   */
  recordVideo: async (options: CameraOptions = {}): Promise<FilePickerResult | null> => {
    if (imagePicker) {
      return takePhotoWithImagePicker({ ...options, mediaType: 'video' });
    }

    if (expoImagePicker) {
      return takePhotoWithExpoImagePicker({ ...options, mediaType: 'video' });
    }

    throw new FilePickerError(
      'NOT_AVAILABLE',
      'No camera library found. Install react-native-image-picker or expo-image-picker.'
    );
  },

  /**
   * Show an action sheet to pick files with multiple options
   *
   * @param options Picker options with custom action sheet
   * @returns Selected files
   */
  showPicker: async (options: FilePickerOptions & {
    title?: string;
    showCamera?: boolean;
    showGallery?: boolean;
    showDocuments?: boolean;
  } = {}): Promise<FilePickerResult[]> => {
    return new Promise((resolve) => {
      const buttons: Array<{ text: string; onPress: () => void; style?: 'cancel' | 'destructive' }> = [];

      if (options.showCamera !== false && (imagePicker || expoImagePicker)) {
        buttons.push({
          text: 'Take Photo',
          onPress: async () => {
            const result = await FilePicker.takePhoto(options);
            resolve(result ? [result] : []);
          },
        });
      }

      if (options.showGallery !== false && (imagePicker || expoImagePicker)) {
        buttons.push({
          text: 'Choose from Gallery',
          onPress: async () => {
            const results = await FilePicker.pickImages(options);
            resolve(results);
          },
        });
      }

      if (options.showDocuments !== false && (documentPicker || expoDocumentPicker)) {
        buttons.push({
          text: 'Choose Document',
          onPress: async () => {
            const results = await FilePicker.pickDocuments(options);
            resolve(results);
          },
        });
      }

      buttons.push({
        text: 'Cancel',
        style: 'cancel',
        onPress: () => resolve([]),
      });

      Alert.alert(options.title || 'Select File', '', buttons);
    });
  },
};

export default FilePicker;
