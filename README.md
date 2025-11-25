# Conferbot React Native SDK

Official React Native SDK for integrating Conferbot chatbot into your iOS and Android mobile applications.

## Features

- 🚀 **Easy Integration** - Drop-in React Context provider for seamless integration
- 💬 **Real-time Messaging** - Socket.IO based real-time communication
- 📱 **Cross-Platform** - Works on both iOS and Android
- 🎨 **Customizable** - Fully customizable UI components and styling
- 🔔 **Push Notifications** - Built-in push notification support
- 🤖 **AI-Powered** - Connect to Conferbot's AI chatbot engine
- 👤 **Live Agent Handover** - Seamless handover to human agents
- 📊 **Analytics** - Built-in event tracking and analytics
- 💾 **Offline Support** - Queue messages when offline
- 📎 **File Uploads** - Support for image and file attachments
- ⌨️ **TypeScript** - Full TypeScript support with type definitions

## Installation

```bash
npm install @conferbot/react-native
# or
yarn add @conferbot/react-native
```

### Peer Dependencies

This SDK requires React Native and React:

```bash
npm install react@>=17.0.0 react-native@>=0.70.0
# or
yarn add react@>=17.0.0 react-native@>=0.70.0
```

## Quick Start

### 1. Wrap your app with ConferBotProvider

```typescript
import React from 'react';
import { ConferBotProvider } from '@conferbot/react-native';

export default function App() {
  return (
    <ConferBotProvider
      apiKey="conf_sk_your_api_key_here"
      botId="your_bot_id_here"
      config={{
        enableNotifications: true,
        enableOfflineMode: true,
      }}
    >
      {/* Your app components */}
    </ConferBotProvider>
  );
}
```

### 2. Use the useConferBot hook

```typescript
import React from 'react';
import { View, Button } from 'react-native';
import { useConferBot } from '@conferbot/react-native';

export default function HomeScreen() {
  const { openChat, isOpen } = useConferBot();

  return (
    <View>
      <Button
        title={isOpen ? 'Close Chat' : 'Open Support Chat'}
        onPress={() => openChat()}
      />
    </View>
  );
}
```

## Features

- ✅ Native React Native components (no WebView)
- ✅ Real-time chat with Socket.IO
- ✅ Offline message queueing
- ✅ Live agent handover
- ✅ File uploads
- ✅ Push notifications support
- ✅ TypeScript support
- ✅ iOS and Android compatible

## Documentation

For complete documentation, visit: [https://docs.conferbot.com/mobile/react-native](https://docs.conferbot.com/mobile/react-native)

## API Reference

### ConferBotProvider Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `apiKey` | string | Yes | Your Conferbot API key |
| `botId` | string | Yes | Your chatbot ID |
| `config` | ConferBotConfig | No | Configuration options |
| `customization` | ConferBotCustomization | No | UI customization |
| `user` | ConferBotUser | No | User identification |

### useConferBot Hook

#### State Properties

- `isInitialized: boolean` - SDK initialization status
- `isConnected: boolean` - Socket connection status
- `isOpen: boolean` - Chat widget open/closed state
- `chatSessionId?: string` - Current chat session ID
- `unreadCount: number` - Number of unread messages
- `currentAgent?: Agent` - Current live agent (if in handover)
- `record: RecordItem[]` - Array of chat messages (matches embed-server format)
- `chatbotConfig?: ChatbotConfig` - Chatbot configuration

#### Methods

##### `openChat(): Promise<void>`
Opens the chat and initializes a new session if needed.

##### `closeChat(): void`
Closes the chat interface.

##### `sendMessage(text: string, attachments?: MessageAttachment[]): Promise<void>`
Sends a message to the chatbot or live agent.

##### `registerPushToken(token: string): Promise<void>`
Registers a push notification token for the current device.

##### `on(event: SocketEvents, callback: Function): () => void`
Subscribe to socket events. Returns an unsubscribe function.

##### `off(event: SocketEvents, callback: Function): void`
Unsubscribe from socket events.

## Socket Events

Listen to real-time events from the server:

```typescript
import { SocketEvents } from '@conferbot/react-native';

const { on } = useConferBot();

useEffect(() => {
  // Listen for bot responses
  const unsubscribe = on(SocketEvents.BOT_RESPONSE, (data) => {
    console.log('Bot response:', data);
  });

  return () => unsubscribe();
}, []);
```

### Available Events

- `BOT_RESPONSE` - Bot sent a message
- `AGENT_MESSAGE` - Live agent sent a message
- `AGENT_ACCEPTED` - Live agent accepted handover
- `AGENT_LEFT` - Live agent left the chat
- `AGENT_TYPING_STATUS` - Agent typing status changed
- `CHAT_ENDED` - Chat session ended
- `CONNECTION_ERROR` - Socket connection error

## Advanced Usage

### Handling Live Agent Handover

```tsx
function ChatScreen() {
  const { currentAgent, on } = useConferBot();

  useEffect(() => {
    const unsubscribe = on(SocketEvents.AGENT_ACCEPTED, (data) => {
      Alert.alert('Agent Joined', `${data.agent.name} has joined the chat`);
    });

    return unsubscribe;
  }, []);

  return (
    <View>
      {currentAgent ? (
        <Text>Chatting with {currentAgent.name}</Text>
      ) : (
        <Text>Chatting with bot</Text>
      )}
    </View>
  );
}
```

## Development

```bash
# Install dependencies
npm install

# Build the SDK
npm run build

# Watch mode for development
npm run watch

# Run linter
npm run lint

# Fix linting issues
npm run lint:fix

# Type check
npm run type-check
```

## Project Structure

```
conferbot-react-native/
├── src/
│   ├── config/
│   │   └── constants.ts          # Centralized configuration
│   ├── context/
│   │   └── ConferBotContext.tsx  # React Context provider
│   ├── services/
│   │   ├── api.ts                # REST API client
│   │   └── socket.ts             # Socket.IO client
│   ├── types/
│   │   ├── index.ts              # Type definitions
│   │   └── react.d.ts            # React type declarations
│   └── index.ts                  # Main exports
├── lib/                          # Build output (gitignored)
├── docs/                         # Documentation
├── package.json
├── tsconfig.json
├── .eslintrc.js
└── README.md
```

## Architecture

The SDK follows a modular architecture:

1. **Context Layer** - React Context for state management
2. **Service Layer** - API and Socket.IO clients
3. **Type Layer** - TypeScript definitions matching embed-server schema
4. **Configuration** - Centralized constants in `/src/config/constants.ts`

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed architecture documentation.

## Requirements

- React Native >= 0.70.0
- React >= 17.0.0
- iOS >= 12.0
- Android API Level >= 21

## Troubleshooting

### Socket Connection Issues

If experiencing connection issues:

1. Verify embed server is running (default: port 8001)
2. Check API key and bot ID are correct
3. Check network connectivity
4. Review socket connection logs in `__DEV__` mode

### Build Errors

If you encounter peer dependency warnings:

```bash
npm install --legacy-peer-deps
```

### Type Errors

Ensure type definitions are installed:

```bash
npm install --save-dev @types/react @types/react-native
```

## License

MIT

## Support

- **Documentation:** https://docs.conferbot.com
- **GitHub Issues:** https://github.com/conferbot/react-native-sdk/issues
- **Email:** support@conferbot.com
