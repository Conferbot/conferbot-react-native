# Architecture Documentation

## Overview

The Conferbot React Native SDK is built with a modular, layered architecture designed for scalability, maintainability, and ease of integration. The SDK provides a complete chatbot solution for mobile applications with real-time messaging, live agent handover, and offline support.

## Architecture Layers

```
┌─────────────────────────────────────────────────────┐
│             Application Layer (User App)             │
│  ┌─────────────────────────────────────────────┐   │
│  │          useConferBot() Hook                 │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│              Context Layer                           │
│  ┌─────────────────────────────────────────────┐   │
│  │      ConferBotProvider (React Context)       │   │
│  │  • State management                          │   │
│  │  • Event coordination                        │   │
│  │  • Session management                        │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│              Service Layer                           │
│  ┌──────────────────┐  ┌──────────────────┐        │
│  │  SocketService   │  │   APIService     │        │
│  │  • Real-time     │  │   • REST calls   │        │
│  │  • Events        │  │   • HTTP client  │        │
│  └──────────────────┘  └──────────────────┘        │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│             Configuration Layer                      │
│  ┌─────────────────────────────────────────────┐   │
│  │         Constants & Configuration            │   │
│  │  • API endpoints                             │   │
│  │  • Socket settings                           │   │
│  │  • Timeouts & retry logic                    │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Core Components

### 1. Context Layer (`/src/context/`)

**ConferBotContext.tsx**

The Context layer provides centralized state management and exposes the SDK API to consuming applications.

**Responsibilities:**
- Maintain global SDK state (connection status, messages, session)
- Initialize and manage service layer (API + Socket clients)
- Provide React hooks for easy consumption
- Handle event coordination between services

**State Management:**
```typescript
{
  isInitialized: boolean;      // SDK setup complete
  isConnected: boolean;        // Socket connection status
  isOpen: boolean;             // Chat UI open/closed
  chatSessionId?: string;      // Active session ID
  unreadCount: number;         // Unread message count
  currentAgent?: Agent;        // Active live agent
  record: RecordItem[];        // Message history
  chatbotConfig?: ChatbotConfig; // Bot configuration
}
```

**Key Methods:**
- `openChat()` - Initialize session and open chat
- `closeChat()` - Close chat interface
- `sendMessage()` - Send user messages
- `registerPushToken()` - Register for push notifications
- `on()` / `off()` - Event listeners

### 2. Service Layer (`/src/services/`)

#### **Socket Service (`socket.ts`)**

Manages real-time bidirectional communication with the embed server using Socket.IO.

**Responsibilities:**
- Establish and maintain WebSocket connection
- Handle reconnection logic with exponential backoff
- Emit events to server (messages, typing status, etc.)
- Listen for server events (bot responses, agent messages)
- Manage socket event listeners

**Configuration:**
```typescript
{
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,      // 1 second
  reconnectionDelayMax: 5000,   // 5 seconds
  timeout: 20000,               // 20 seconds
  transports: ['websocket', 'polling']
}
```

**Socket Events (Client → Server):**
- `GET_CHATBOT_DATA` - Fetch bot configuration
- `RESPONSE_RECORD` - Send user message
- `JOIN_CHAT_ROOM_VISITOR` - Join chat session
- `VISITOR_TYPING` - Typing indicator
- `INITIATE_HANDOVER` - Request live agent

**Socket Events (Server → Client):**
- `FETCHED_CHATBOT_DATA` - Bot config response
- `BOT_RESPONSE` - Bot message
- `AGENT_MESSAGE` - Agent message
- `AGENT_ACCEPTED` - Agent joined
- `AGENT_LEFT` - Agent left
- `AGENT_TYPING_STATUS` - Agent typing
- `CHAT_ENDED` - Session ended

#### **API Service (`api.ts`)**

Handles HTTP REST API communication for non-real-time operations.

**Responsibilities:**
- Initialize chat sessions
- Fetch session history
- Upload files/attachments
- Register push notification tokens
- Track analytics events

**HTTP Endpoints:**
```
GET  /chatbot/:botId              - Get bot config
GET  /chatbot/:botId/kb           - Get knowledge base
POST /session/init                - Initialize session
GET  /session/:sessionId          - Get session history
POST /session/:sessionId/message  - Send message (REST)
POST /session/:sessionId/upload   - Upload file
POST /handover/request            - Request handover
GET  /handover/:sessionId/status  - Get handover status
POST /push/register               - Register push token
POST /analytics/event             - Track event
```

**Features:**
- Automatic request/response logging in `__DEV__` mode
- 30-second timeout for all requests
- Axios interceptors for error handling
- Proper headers (API key, bot ID, platform)

### 3. Type Layer (`/src/types/`)

**index.ts** - Complete TypeScript type definitions matching embed-server schema

**Key Types:**

```typescript
// Chat session matching embed-server Response model
interface ChatSession {
  chatSessionId: string;
  botId: string;
  record: RecordItem[];          // Message array
  answerVariables?: any[];
  createdAt: Date;
  updatedAt: Date;
}

// Message types in record array
type RecordItem =
  | BotMessageRecord
  | UserInputRecord
  | AgentMessageRecord
  | SystemMessageRecord;

// Socket events enum
enum SocketEvents {
  GET_CHATBOT_DATA = 'get-chatbot-data',
  BOT_RESPONSE = 'bot-response',
  // ... all server events
}
```

**react.d.ts** - React type declarations for peer dependency support

### 4. Configuration Layer (`/src/config/`)

**constants.ts** - Centralized configuration constants

```typescript
// API Configuration
export const DEFAULT_API_BASE_URL = 'https://embed.conferbot.com/api/v1/mobile';
export const API_TIMEOUT = 30000;

// Socket Configuration
export const DEFAULT_SOCKET_URL = 'https://embed.conferbot.com';
export const SOCKET_TIMEOUT = 20000;
export const SOCKET_RECONNECTION_ATTEMPTS = 5;
export const SOCKET_RECONNECTION_DELAY = 1000;
export const SOCKET_RECONNECTION_DELAY_MAX = 5000;

// Platform
export const PLATFORM_IDENTIFIER = 'react-native';

// Headers
export const HEADER_API_KEY = 'X-API-Key';
export const HEADER_BOT_ID = 'X-Bot-ID';
export const HEADER_PLATFORM = 'X-Platform';
```

## Data Flow

### Message Sending Flow

```
User Types Message
       ↓
sendMessage() called
       ↓
Add to local record (optimistic update)
       ↓
Socket.emit(RESPONSE_RECORD)
       ↓
Embed Server processes message
       ↓
Server emits BOT_RESPONSE
       ↓
Socket receives event
       ↓
Update record with server response
       ↓
UI re-renders with new message
```

### Session Initialization Flow

```
openChat() called
       ↓
Check if session exists
       ↓
   No ↓         Yes → Join existing session
       ↓
API.initSession()
       ↓
Receive chatSessionId
       ↓
API.getSessionHistory()
       ↓
Load previous messages
       ↓
Socket.joinChatRoomVisitor()
       ↓
Ready to send/receive messages
```

### Live Agent Handover Flow

```
User requests agent
       ↓
Socket.emit(INITIATE_HANDOVER)
       ↓
Server finds available agent
       ↓
Server emits AGENT_ACCEPTED
       ↓
Update currentAgent state
       ↓
UI shows agent info
       ↓
Messages now go to agent
       ↓
Agent sends messages
       ↓
Socket receives AGENT_MESSAGE
       ↓
Display in chat
```

## State Synchronization

The SDK maintains state across multiple sources:

1. **Local React State** - UI state (isOpen, unreadCount)
2. **Socket State** - Connection status (isConnected)
3. **Server State** - Messages, session data (record, chatSessionId)

**Sync Strategy:**
- Optimistic updates for user messages
- Server as source of truth for bot/agent messages
- Local state for UI interactions
- Event-driven updates via Socket.IO

## Error Handling

### Socket Connection Errors

```typescript
socket.on('connect_error', (error) => {
  // Automatic reconnection with exponential backoff
  // Max 5 attempts
  // Emit CONNECTION_ERROR event to app
});
```

### API Request Errors

```typescript
try {
  const response = await api.sendMessage(sessionId, text);
} catch (error) {
  // Log error in __DEV__ mode
  // Throw error to caller for handling
}
```

### Graceful Degradation

- If socket disconnects, user can still type (messages queued)
- If API fails, clear error message to user
- Automatic reconnection on network restore

## Performance Considerations

### Optimizations

1. **Lazy Initialization** - Services created only when needed
2. **Event Debouncing** - Typing indicators debounced
3. **Message Batching** - Multiple messages sent in one update
4. **Memoization** - React hooks use proper dependency arrays
5. **Efficient Re-renders** - Context split into logical sections

### Memory Management

- Event listeners cleaned up on unmount
- Socket disconnected when provider unmounts
- No memory leaks from closures
- Proper cleanup in useEffect hooks

## Security

### Authentication

- API Key passed in headers (`X-API-Key`)
- Bot ID validated server-side (`X-Bot-ID`)
- Platform identifier for request tracking (`X-Platform`)

### Data Privacy

- No sensitive data stored locally
- All communication over HTTPS/WSS
- Session IDs generated server-side
- User data encrypted in transit

## Testing Strategy

### Unit Tests
- Service layer methods
- Type validation
- Utility functions

### Integration Tests
- Context + Services interaction
- Socket event flow
- API request/response handling

### E2E Tests
- Complete user flows
- Session management
- Agent handover

## Build & Distribution

### Build Process

```bash
TypeScript Compilation
       ↓
Generate .js files in lib/
       ↓
Generate .d.ts type definitions
       ↓
Create source maps
       ↓
Package ready for npm publish
```

### Output Structure

```
lib/
├── config/
│   ├── constants.js
│   └── constants.d.ts
├── context/
│   ├── ConferBotContext.js
│   └── ConferBotContext.d.ts
├── services/
│   ├── api.js
│   ├── api.d.ts
│   ├── socket.js
│   └── socket.d.ts
├── types/
│   ├── index.js
│   └── index.d.ts
├── index.js
└── index.d.ts
```

## Extending the SDK

### Adding New Features

1. **Add Types** - Define in `/src/types/index.ts`
2. **Add Service Method** - Implement in service layer
3. **Expose via Context** - Add to ConferBotContext
4. **Update Docs** - Document in README and here

### Custom Event Listeners

Users can subscribe to any socket event:

```typescript
const { on } = useConferBot();

useEffect(() => {
  const unsubscribe = on('custom-event', (data) => {
    // Handle custom event
  });

  return unsubscribe;
}, []);
```

## Future Enhancements

- **Offline Queue** - Queue messages when offline, send when reconnected
- **File Preview** - Show image/file previews in chat
- **Rich Media** - Support for cards, buttons, carousels
- **Voice Messages** - Record and send voice messages
- **Video Calls** - WebRTC integration for video calls
- **Encryption** - End-to-end encryption for messages

## Related Documentation

- [README.md](../README.md) - Getting started guide
- [API.md](./API.md) - Complete API reference
- [EXAMPLES.md](./EXAMPLES.md) - Usage examples
- [Embed Server Docs](../../embed-server/README.md) - Server documentation
