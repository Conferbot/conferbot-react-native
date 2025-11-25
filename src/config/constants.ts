// ********** API Configuration ********** //
// Base URL for Conferbot REST API
export const DEFAULT_API_BASE_URL = 'https://embed.conferbot.com/api/v1/mobile';

// API request timeout in milliseconds
export const API_TIMEOUT = 30000; // 30 seconds

// ********** Socket Configuration ********** //
// Base URL for Conferbot Socket.IO server
export const DEFAULT_SOCKET_URL = 'https://embed.conferbot.com';

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
