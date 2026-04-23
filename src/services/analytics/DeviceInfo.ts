// @ts-nocheck
/**
 * DeviceInfo.ts
 *
 * Utilities for gathering device and environment information
 * for analytics attribution.
 */

// @ts-ignore - RN types resolved at runtime
import { Platform, Dimensions, NativeModules } from 'react-native';
import type { MobileAttribution, EnvironmentData } from './types';

// ========================================
// DEVICE INFO HELPERS
// ========================================

/**
 * Gets the device model name
 */
export const getDeviceModel = (): string => {
  if (Platform.OS === 'ios') {
    // Try to get iOS device model
    const { PlatformConstants } = NativeModules;
    return PlatformConstants?.Model || 'iPhone';
  } else {
    // Android
    const { PlatformConstants } = NativeModules;
    return PlatformConstants?.Model || PlatformConstants?.Brand || 'Android Device';
  }
};

/**
 * Gets the OS version
 */
export const getOSVersion = (): string => {
  return Platform.Version?.toString() || 'unknown';
};

/**
 * Gets screen dimensions
 */
export const getScreenDimensions = (): { width: number; height: number } => {
  const { width, height } = Dimensions.get('screen');
  return { width, height };
};

/**
 * Gets window dimensions
 */
export const getWindowDimensions = (): { width: number; height: number } => {
  const { width, height } = Dimensions.get('window');
  return { width, height };
};

/**
 * Gets device locale
 */
export const getLocale = (): string => {
  if (Platform.OS === 'ios') {
    return (
      NativeModules.SettingsManager?.settings?.AppleLocale ||
      NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] ||
      'en'
    );
  } else {
    return NativeModules.I18nManager?.localeIdentifier || 'en';
  }
};

/**
 * Gets timezone
 */
export const getTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
};

/**
 * Determines device type based on screen size
 */
export const getDeviceType = (): 'mobile' | 'tablet' => {
  const { width, height } = getScreenDimensions();
  const screenSize = Math.min(width, height);

  // Consider devices with smallest dimension > 600 as tablets
  return screenSize > 600 ? 'tablet' : 'mobile';
};

/**
 * Checks if running in simulator/emulator
 */
export const isEmulator = (): boolean => {
  if (Platform.OS === 'ios') {
    return !Platform.isPad && !Platform.isTVOS && Platform.constants.uiMode === undefined;
  } else {
    const { PlatformConstants } = NativeModules;
    return PlatformConstants?.Model?.includes('sdk') || false;
  }
};

// ========================================
// ATTRIBUTION DATA
// ========================================

/**
 * Gathers mobile attribution data for analytics
 */
export const getMobileAttribution = (options?: {
  appVersion?: string;
  buildNumber?: string;
  entryPoint?: string;
  deepLink?: string;
  pushNotificationId?: string;
}): MobileAttribution => {
  const { width, height } = getScreenDimensions();

  return {
    appVersion: options?.appVersion,
    buildNumber: options?.buildNumber,
    deviceModel: getDeviceModel(),
    osName: Platform.OS as 'ios' | 'android',
    osVersion: getOSVersion(),
    screenWidth: width,
    screenHeight: height,
    locale: getLocale(),
    timezone: getTimezone(),
    entryPoint: options?.entryPoint,
    deepLink: options?.deepLink,
    pushNotificationId: options?.pushNotificationId,
  };
};

/**
 * Gathers full environment data for final analytics
 */
export const getEnvironmentData = (options?: {
  appVersion?: string;
  buildNumber?: string;
}): EnvironmentData => {
  const { width, height } = getScreenDimensions();

  return {
    deviceType: getDeviceType(),
    platform: Platform.OS as 'ios' | 'android',
    osVersion: getOSVersion(),
    appVersion: options?.appVersion || '1.0.0',
    buildNumber: options?.buildNumber,
    deviceModel: getDeviceModel(),
    screenResolution: `${width}x${height}`,
    language: getLocale(),
    timezone: getTimezone(),
    isEmulator: isEmulator(),
    carrier: undefined, // Would need native module to get carrier info
    networkType: undefined, // Would need NetInfo to get network type
  };
};

export default {
  getDeviceModel,
  getOSVersion,
  getScreenDimensions,
  getWindowDimensions,
  getLocale,
  getTimezone,
  getDeviceType,
  isEmulator,
  getMobileAttribution,
  getEnvironmentData,
};
