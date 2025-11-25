# API Reference

Complete API documentation for the Conferbot React Native SDK.

## Table of Contents

- [ConferBotProvider](#conferbotprovider)
- [useConferBot Hook](#useconferbot-hook)
- [Types](#types)
- [Socket Events](#socket-events)
- [Configuration](#configuration)

---

## ConferBotProvider

The root provider component that wraps your application and provides Conferbot functionality.

### Props

#### `apiKey` (required)
- **Type:** `string`
- **Description:** Your Conferbot API key
- **Example:** `"conf_sk_abc123..."`

#### `botId` (required)
- **Type:** `string`
- **Description:** Your chatbot ID
- **Example:** `"bot_123abc..."`

#### `config` (optional)
- **Type:** `ConferBotConfig`
- **Description:** SDK configuration options
- **Default:** `{ autoConnect: true }`

```typescript
interface ConferBotConfig {
  enableNotifications?: boolean;      // Default: false
  enableOfflineMode?: boolean;        // Default: false
  autoConnect?: boolean;              // Default: true
  reconnectionAttempts?: number;      // Default: 5
  reconnectionDelay?: number;         // Default: 1000 (ms)
}
```

#### `customization` (optional)
- **Type:** `ConferBotCustomization`
- **Description:** UI customization options

```typescript
interface ConferBotCustomization {
  primaryColor?: string;
  fontFamily?: string;
  bubbleRadius?: number;
  headerTitle?: string;
}
```

#### `user` (optional)
- **Type:** `ConferBotUser`
- **Description:** User identification and metadata

```typescript
interface ConferBotUser {
  id: string;                         // Required: unique user ID
  name?: string;
  email?: string;
  phone?: string;
  metadata?: Record<string, any>;
}
```

### Example

```tsx
import { ConferBotProvider } from '@conferbot/react-native';

function App() {
  return (
    <ConferBotProvider
      apiKey="conf_sk_abc123"
      botId="bot_xyz789"
      config={{
        autoConnect: true,
        enableNotifications: true,
      }}
      user={{
        id: 'user_123',
        name: 'John Doe',
        email: 'john@example.com',
      }}
    >
      <YourApp />
    </ConferBotProvider>
  );
}
```

---

## useConferBot Hook

React hook that provides access to Conferbot state and methods.

### Returns

```typescript
interface ConferBotContext {
  // State
  isInitialized: boolean;
  isConnected: boolean;
  isOpen: boolean;
  chatSessionId?: string;
  unreadCount: number;
  currentAgent?: Agent;
  record: RecordItem[];
  chatbotConfig?: ChatbotConfig;

  // Methods
  openChat: () => Promise<void>;
  closeChat: () => void;
  sendMessage: (text: string, attachments?: MessageAttachment[]) => Promise<void>;
  registerPushToken: (token: string) => Promise<void>;
  on: (event: SocketEvents, callback: Function) => () => void;
  off: (event: SocketEvents, callback: Function) => void;
}
```

### State Properties

#### `isInitialized`
- **Type:** `boolean`
- **Description:** Whether the SDK has completed initialization
- **Usage:** Check before calling SDK methods

#### `isConnected`
- **Type:** `boolean`
- **Description:** Socket.IO connection status
- **Usage:** Show connection indicator in UI

#### `isOpen`
- **Type:** `boolean`
- **Description:** Whether chat interface is currently open
- **Usage:** Control chat UI visibility

#### `chatSessionId`
- **Type:** `string | undefined`
- **Description:** Current active chat session ID
- **Usage:** Track active sessions, send with analytics

#### `unreadCount`
- **Type:** `number`
- **Description:** Number of unread messages
- **Usage:** Show badge on chat button

#### `currentAgent`
- **Type:** `Agent | undefined`
- **Description:** Currently connected live agent (if any)
- **Usage:** Display agent information

```typescript
interface Agent {
  id: string;
  name: string;
  avatar?: string;
  email?: string;
}
```

#### `record`
- **Type:** `RecordItem[]`
- **Description:** Array of all chat messages
- **Usage:** Render chat history

```typescript
type RecordItem =
  | BotMessageRecord
  | UserInputRecord
  | AgentMessageRecord
  | SystemMessageRecord;
```

#### `chatbotConfig`
- **Type:** `ChatbotConfig | undefined`
- **Description:** Chatbot configuration from server
- **Usage:** Customize UI based on bot settings

### Methods

#### `openChat()`

Opens the chat interface and initializes a session if needed.

```typescript
openChat(): Promise<void>
```

**Returns:** Promise that resolves when chat is opened

**Example:**
```typescript
const { openChat } = useConferBot();

function ChatButton() {
  return (
    <Button
      title="Open Support"
      onPress={openChat}
    />
  );
}
```

---

#### `closeChat()`

Closes the chat interface (does not end session).

```typescript
closeChat(): void
```

**Example:**
```typescript
const { closeChat, isOpen } = useConferBot();

if (isOpen) {
  closeChat();
}
```

---

#### `sendMessage()`

Sends a message to the chatbot or live agent.

```typescript
sendMessage(
  text: string,
  attachments?: MessageAttachment[]
): Promise<void>
```

**Parameters:**
- `text` - Message text content (required)
- `attachments` - Array of file attachments (optional)

**Returns:** Promise that resolves when message is sent

**Example:**
```typescript
const { sendMessage } = useConferBot();

// Send text message
await sendMessage('Hello!');

// Send with attachment
await sendMessage('Here is the screenshot', [
  {
    type: 'image',
    uri: 'file:///path/to/image.jpg',
    name: 'screenshot.jpg',
  }
]);
```

---

#### `registerPushToken()`

Registers a device token for push notifications.

```typescript
registerPushToken(token: string): Promise<void>
```

**Parameters:**
- `token` - FCM (Android) or APNS (iOS) device token

**Returns:** Promise that resolves when token is registered

**Example:**
```typescript
import messaging from '@react-native-firebase/messaging';
import { useConferBot } from '@conferbot/react-native';

function App() {
  const { registerPushToken } = useConferBot();

  useEffect(() => {
    // Get FCM token
    messaging()
      .getToken()
      .then(token => registerPushToken(token));
  }, []);
}
```

---

#### `on()`

Subscribe to socket events.

```typescript
on(event: SocketEvents, callback: Function): () => void
```

**Parameters:**
- `event` - Socket event name
- `callback` - Function to call when event fires

**Returns:** Unsubscribe function

**Example:**
```typescript
const { on } = useConferBot();

useEffect(() => {
  const unsubscribe = on(SocketEvents.BOT_RESPONSE, (data) => {
    console.log('Bot replied:', data);
  });

  // Cleanup
  return unsubscribe;
}, []);
```

---

#### `off()`

Unsubscribe from socket events.

```typescript
off(event: SocketEvents, callback: Function): void
```

**Parameters:**
- `event` - Socket event name
- `callback` - Previously registered callback function

**Example:**
```typescript
const { on, off } = useConferBot();

const handleBotResponse = (data) => {
  console.log(data);
};

// Subscribe
on(SocketEvents.BOT_RESPONSE, handleBotResponse);

// Later, unsubscribe
off(SocketEvents.BOT_RESPONSE, handleBotResponse);
```

---

## Types

### MessageAttachment

```typescript
interface MessageAttachment {
  type: 'image' | 'file' | 'video';
  uri: string;              // File URI (file://, http://, etc.)
  name: string;             // File name
  size?: number;            // File size in bytes
  mimeType?: string;        // MIME type
}
```

### RecordItem

```typescript
// Bot message
interface BotMessageRecord {
  _id: string;
  type: 'bot-message';
  text?: string;
  time: Date;
  metadata?: any;
}

// User message
interface UserInputRecord {
  _id: string;
  type: 'user-input-response';
  text: string;
  time: Date;
}

// Agent message
interface AgentMessageRecord {
  _id: string;
  type: 'agent-message';
  text: string;
  time: Date;
  agent: Agent;
}

// System message
interface SystemMessageRecord {
  _id: string;
  type: 'system-message';
  text: string;
  time: Date;
}
```

---

## Socket Events

### Client Events (emit to server)

```typescript
enum SocketEvents {
  GET_CHATBOT_DATA = 'get-chatbot-data',
  RESPONSE_RECORD = 'response-record',
  JOIN_CHAT_ROOM_VISITOR = 'join-chat-room-visitor',
  LEAVE_CHAT_ROOM = 'leave-chat-room',
  VISITOR_TYPING = 'visitor-typing',
  INITIATE_HANDOVER = 'initiate-handover',
  TOGGLE_VISITOR_INPUT = 'toggle-visitor-input',
  EMAIL_NODE_TRIGGER = 'email-node-trigger',
  ZAPIER_NODE_TRIGGER = 'zapier-node-trigger',
  CALENDAR_SLOT_SELECTION_RECORD = 'calendar-slot-selection-record',
}
```

### Server Events (listen from server)

```typescript
enum SocketEvents {
  FETCHED_CHATBOT_DATA = 'fetched-chatbot-data',
  BOT_RESPONSE = 'bot-response',
  AGENT_MESSAGE = 'agent-message',
  AGENT_ACCEPTED = 'agent-accepted',
  AGENT_LEFT = 'agent-left',
  AGENT_TYPING_STATUS = 'agent-typing-status',
  VISITOR_TYPING_STATUS = 'visitor-typing-status',
  CHAT_ENDED = 'chat-ended',
  VISITOR_DISCONNECTED = 'visitor-disconnected',
  VISITOR_INPUT_TOGGLED = 'visitor-input-toggled',
  DESTROY_NOTIFICATION = 'destroy-notification',
  CONNECTION_ERROR = 'connection_error',
}
```

### Event Payloads

#### BOT_RESPONSE
```typescript
{
  record: RecordItem[];         // Updated message array
  chatSessionId: string;
}
```

#### AGENT_ACCEPTED
```typescript
{
  agent: Agent;                 // Agent details
  chatSessionId: string;
}
```

#### AGENT_MESSAGE
```typescript
{
  record: RecordItem[];
  message: string;
  agent: Agent;
}
```

---

## Configuration

### Default Configuration

All default values from `/src/config/constants.ts`:

```typescript
// API
DEFAULT_API_BASE_URL = 'https://embed.conferbot.com/api/v1/mobile'
API_TIMEOUT = 30000 // 30 seconds

// Socket
DEFAULT_SOCKET_URL = 'https://embed.conferbot.com'
SOCKET_TIMEOUT = 20000 // 20 seconds
SOCKET_RECONNECTION_ATTEMPTS = 5
SOCKET_RECONNECTION_DELAY = 1000 // 1 second
SOCKET_RECONNECTION_DELAY_MAX = 5000 // 5 seconds

// Platform
PLATFORM_IDENTIFIER = 'react-native'

// Headers
HEADER_API_KEY = 'X-API-Key'
HEADER_BOT_ID = 'X-Bot-ID'
HEADER_PLATFORM = 'X-Platform'
```

### Custom Server URLs

To use a custom embed server:

```tsx
<ConferBotProvider
  apiKey="your-key"
  botId="your-bot-id"
  config={{
    socketUrl: 'https://your-server.com',
    baseURL: 'https://your-server.com/api/v1/mobile',
  }}
>
  {children}
</ConferBotProvider>
```

---

## Error Handling

All methods may throw errors. Wrap in try/catch:

```typescript
const { sendMessage } = useConferBot();

try {
  await sendMessage('Hello');
} catch (error) {
  console.error('Failed to send:', error);
  // Show error to user
}
```

## TypeScript Support

All types are exported:

```typescript
import type {
  ConferBotConfig,
  ConferBotUser,
  ConferBotContext,
  Agent,
  MessageAttachment,
  RecordItem,
  SocketEvents,
} from '@conferbot/react-native';
```
