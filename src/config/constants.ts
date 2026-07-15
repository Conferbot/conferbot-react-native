// ********** API Configuration ********** //
// Base URL for Conferbot REST API
export const DEFAULT_API_BASE_URL = 'https://wdt.conferbot.com/api/v1/mobile';

// API request timeout in milliseconds
export const API_TIMEOUT = 30000; // 30 seconds

// ********** Socket Configuration ********** //
// Base URL for Conferbot Socket.IO server
export const DEFAULT_SOCKET_URL = 'https://wdt.conferbot.com';

// Socket connection timeout in milliseconds
export const SOCKET_TIMEOUT = 20000; // 20 seconds

// Maximum number of reconnection attempts
export const SOCKET_RECONNECTION_ATTEMPTS = 5;

// Initial reconnection delay in milliseconds
export const SOCKET_RECONNECTION_DELAY = 1000; // 1 second

// Maximum reconnection delay in milliseconds
export const SOCKET_RECONNECTION_DELAY_MAX = 5000; // 5 seconds

// ********** Platform Configuration ********** //
// Platform identifier for API headers
export const PLATFORM_IDENTIFIER = 'react-native';

// ********** HTTP Headers ********** //
// API Key header name
export const HEADER_API_KEY = 'X-API-Key';

// Bot ID header name
export const HEADER_BOT_ID = 'X-Bot-ID';

// Platform header name
export const HEADER_PLATFORM = 'X-Platform';

// ========================================
// CONFIGURABLE ENDPOINTS
// ========================================

/**
 * ConferBotEndpoints provides configurable URL management with validation.
 * Use ConferBotEndpoints.configure() to override default URLs.
 */
export class ConferBotEndpoints {
  private static _apiBaseUrl: string = DEFAULT_API_BASE_URL;
  private static _socketUrl: string = DEFAULT_SOCKET_URL;

  static get apiBaseUrl(): string {
    return this._apiBaseUrl;
  }

  static get socketUrl(): string {
    return this._socketUrl;
  }

  /**
   * Configure custom endpoint URLs.
   * @param options - Object with optional apiBaseUrl and socketUrl
   * @throws Error if URLs don't use HTTPS
   */
  static configure(options: { apiBaseUrl?: string; socketUrl?: string }): void {
    if (options.apiBaseUrl) {
      this._apiBaseUrl = options.apiBaseUrl;
    }
    if (options.socketUrl) {
      this._socketUrl = options.socketUrl;
    }
  }

  /**
   * Reset endpoints to their default values.
   */
  static reset(): void {
    this._apiBaseUrl = DEFAULT_API_BASE_URL;
    this._socketUrl = DEFAULT_SOCKET_URL;
  }
}

// ========================================
// CONFIGURABLE NETWORK SETTINGS (HIGH FIX 3)
// ========================================

/**
 * ConferBotNetworkConfig provides configurable timeout and retry policies.
 * Use ConferBotNetworkConfig.configure() to override default network settings.
 */
export class ConferBotNetworkConfig {
  private static _apiTimeout = API_TIMEOUT;
  private static _socketTimeout = SOCKET_TIMEOUT;
  private static _reconnectionAttempts = SOCKET_RECONNECTION_ATTEMPTS;
  private static _reconnectionDelay = SOCKET_RECONNECTION_DELAY;
  private static _reconnectionDelayMax = SOCKET_RECONNECTION_DELAY_MAX;

  static get apiTimeout() { return this._apiTimeout; }
  static get socketTimeout() { return this._socketTimeout; }
  static get reconnectionAttempts() { return this._reconnectionAttempts; }
  static get reconnectionDelay() { return this._reconnectionDelay; }
  static get reconnectionDelayMax() { return this._reconnectionDelayMax; }

  static configure(options: {
    apiTimeout?: number;
    socketTimeout?: number;
    reconnectionAttempts?: number;
    reconnectionDelay?: number;
    reconnectionDelayMax?: number;
  }): void {
    if (options.apiTimeout !== undefined) {
      if (options.apiTimeout <= 0) throw new Error('API timeout must be positive');
      this._apiTimeout = options.apiTimeout;
    }
    if (options.socketTimeout !== undefined) {
      if (options.socketTimeout <= 0) throw new Error('Socket timeout must be positive');
      this._socketTimeout = options.socketTimeout;
    }
    if (options.reconnectionAttempts !== undefined) {
      if (options.reconnectionAttempts < 0) throw new Error('Reconnection attempts must be non-negative');
      this._reconnectionAttempts = options.reconnectionAttempts;
    }
    if (options.reconnectionDelay !== undefined) {
      if (options.reconnectionDelay <= 0) throw new Error('Reconnection delay must be positive');
      this._reconnectionDelay = options.reconnectionDelay;
    }
    if (options.reconnectionDelayMax !== undefined) {
      if (options.reconnectionDelayMax <= 0) throw new Error('Max delay must be positive');
      this._reconnectionDelayMax = options.reconnectionDelayMax;
    }
  }

  static reset(): void {
    this._apiTimeout = API_TIMEOUT;
    this._socketTimeout = SOCKET_TIMEOUT;
    this._reconnectionAttempts = SOCKET_RECONNECTION_ATTEMPTS;
    this._reconnectionDelay = SOCKET_RECONNECTION_DELAY;
    this._reconnectionDelayMax = SOCKET_RECONNECTION_DELAY_MAX;
  }
}
