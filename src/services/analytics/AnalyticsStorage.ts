// @ts-nocheck
/**
 * AnalyticsStorage.ts
 *
 * Persistence layer for analytics events.
 * Stores unsent events in AsyncStorage for retry on failure.
 */

// @ts-ignore - resolved at runtime via peer dependency
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AnalyticsEvent, AnalyticsConfig } from './types';

// ========================================
// STORAGE KEYS
// ========================================

const STORAGE_KEYS = {
  PENDING_EVENTS: 'pending_events',
  SESSION_DATA: 'session_data',
  LAST_SYNC: 'last_sync',
};

// ========================================
// SESSION DATA TYPE
// ========================================

export interface PersistedSessionData {
  chatSessionId: string;
  botId: string;
  visitorId?: string;
  startedAt: number;
  lastActivityAt: number;
  totalIdleTime: number;
  messageCount: number;
  totalMessageLength: number;
  totalTypingTime: number;
  deletionCount: number;
}

// ========================================
// ANALYTICS STORAGE CLASS
// ========================================

export class AnalyticsStorage {
  private keyPrefix: string;
  private debug: boolean;

  constructor(config: Pick<AnalyticsConfig, 'storageKeyPrefix' | 'debug'>) {
    this.keyPrefix = config.storageKeyPrefix;
    this.debug = config.debug;
  }

  // ========================================
  // KEY HELPERS
  // ========================================

  private getKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  // ========================================
  // PENDING EVENTS
  // ========================================

  /**
   * Gets all pending (unsent) events
   */
  async getPendingEvents(): Promise<AnalyticsEvent[]> {
    try {
      const key = this.getKey(STORAGE_KEYS.PENDING_EVENTS);
      const data = await AsyncStorage.getItem(key);

      if (!data) {
        return [];
      }

      const events = JSON.parse(data) as AnalyticsEvent[];
      this.log('Retrieved pending events', { count: events.length });
      return events;
    } catch (error) {
      this.log('Error retrieving pending events', { error });
      return [];
    }
  }

  /**
   * Saves pending events to storage
   */
  async savePendingEvents(events: AnalyticsEvent[]): Promise<void> {
    try {
      const key = this.getKey(STORAGE_KEYS.PENDING_EVENTS);
      await AsyncStorage.setItem(key, JSON.stringify(events));
      this.log('Saved pending events', { count: events.length });
    } catch (error) {
      this.log('Error saving pending events', { error });
    }
  }

  /**
   * Adds events to pending queue
   */
  async addPendingEvents(newEvents: AnalyticsEvent[]): Promise<void> {
    const existingEvents = await this.getPendingEvents();
    const allEvents = [...existingEvents, ...newEvents];

    // Limit stored events to prevent storage overflow (max 500 events)
    const limitedEvents = allEvents.slice(-500);
    await this.savePendingEvents(limitedEvents);
  }

  /**
   * Removes events from pending queue (after successful send)
   */
  async removePendingEvents(eventIds: string[]): Promise<void> {
    const events = await this.getPendingEvents();
    const remaining = events.filter((e) => !eventIds.includes(e.eventId));
    await this.savePendingEvents(remaining);
    this.log('Removed sent events', { removed: eventIds.length, remaining: remaining.length });
  }

  /**
   * Clears all pending events
   */
  async clearPendingEvents(): Promise<void> {
    try {
      const key = this.getKey(STORAGE_KEYS.PENDING_EVENTS);
      await AsyncStorage.removeItem(key);
      this.log('Cleared all pending events');
    } catch (error) {
      this.log('Error clearing pending events', { error });
    }
  }

  // ========================================
  // SESSION DATA
  // ========================================

  /**
   * Saves session data for persistence across app restarts
   */
  async saveSessionData(data: PersistedSessionData): Promise<void> {
    try {
      const key = this.getKey(STORAGE_KEYS.SESSION_DATA);
      await AsyncStorage.setItem(key, JSON.stringify(data));
      this.log('Saved session data', { chatSessionId: data.chatSessionId });
    } catch (error) {
      this.log('Error saving session data', { error });
    }
  }

  /**
   * Gets persisted session data
   */
  async getSessionData(): Promise<PersistedSessionData | null> {
    try {
      const key = this.getKey(STORAGE_KEYS.SESSION_DATA);
      const data = await AsyncStorage.getItem(key);

      if (!data) {
        return null;
      }

      return JSON.parse(data) as PersistedSessionData;
    } catch (error) {
      this.log('Error retrieving session data', { error });
      return null;
    }
  }

  /**
   * Clears session data
   */
  async clearSessionData(): Promise<void> {
    try {
      const key = this.getKey(STORAGE_KEYS.SESSION_DATA);
      await AsyncStorage.removeItem(key);
      this.log('Cleared session data');
    } catch (error) {
      this.log('Error clearing session data', { error });
    }
  }

  // ========================================
  // SYNC STATUS
  // ========================================

  /**
   * Saves last sync timestamp
   */
  async saveLastSync(timestamp: number): Promise<void> {
    try {
      const key = this.getKey(STORAGE_KEYS.LAST_SYNC);
      await AsyncStorage.setItem(key, timestamp.toString());
    } catch (error) {
      this.log('Error saving last sync', { error });
    }
  }

  /**
   * Gets last sync timestamp
   */
  async getLastSync(): Promise<number | null> {
    try {
      const key = this.getKey(STORAGE_KEYS.LAST_SYNC);
      const data = await AsyncStorage.getItem(key);

      if (!data) {
        return null;
      }

      return parseInt(data, 10);
    } catch (error) {
      this.log('Error retrieving last sync', { error });
      return null;
    }
  }

  // ========================================
  // CLEANUP
  // ========================================

  /**
   * Clears all analytics data from storage
   */
  async clearAll(): Promise<void> {
    try {
      const keys = Object.values(STORAGE_KEYS).map((k) => this.getKey(k));
      await AsyncStorage.multiRemove(keys);
      this.log('Cleared all analytics storage');
    } catch (error) {
      this.log('Error clearing all storage', { error });
    }
  }

  // ========================================
  // LOGGING
  // ========================================

  private log(message: string, data?: Record<string, any>): void {
    if (this.debug) {
      console.log(`[AnalyticsStorage] ${message}`, data || '');
    }
  }
}

export default AnalyticsStorage;
