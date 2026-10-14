/**
 * The app's AsyncStorage, when it has @react-native-async-storage/async-storage
 * installed: the conversation is kept across app restarts by default, as the
 * web widget keeps it across page loads. An `asyncStorage` passed in config
 * wins; none installed and none passed means nothing is kept.
 */
import type { AsyncStorageInterface } from '../services/StorageService';

let detected: AsyncStorageInterface | null | undefined;

export const installedAsyncStorage = (): AsyncStorageInterface | null => {
  if (detected !== undefined) return detected;
  try {
    // Optional peer dependency: Metro allows a require in try/catch to be missing.
    const mod = require('@react-native-async-storage/async-storage');
    const storage = mod?.default || mod;
    detected = storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function' ? storage : null;
  } catch {
    detected = null;
  }
  return detected ?? null;
};

export const asyncStorageFor = (config?: { asyncStorage?: AsyncStorageInterface | null }): AsyncStorageInterface | null =>
  config?.asyncStorage || installedAsyncStorage();
