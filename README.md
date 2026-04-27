# Conferbot React Native SDK

[![npm version](https://img.shields.io/npm/v/@conferbot/react-native.svg)](https://www.npmjs.com/package/@conferbot/react-native)
[![React Native](https://img.shields.io/badge/React%20Native-%3E%3D%200.70-blue.svg)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://github.com/conferbot/react-native-sdk/blob/main/LICENSE)

Native React Native SDK for embedding Conferbot chatbots into iOS and Android applications -- no WebView required.

<p align="center">
  <img src="docs/screenshots/chat-widget.png" width="280" alt="Chat Widget" />
  <img src="docs/screenshots/choice-node.png" width="280" alt="Choice Node" />
  <img src="docs/screenshots/themed-chat.png" width="280" alt="Themed Chat" />
</p>

## Features

- **Native Components** -- Built entirely with React Native views, not a WebView wrapper
- **Real-time Messaging** -- Socket.IO-based communication with automatic reconnection
- **Offline Support** -- Messages are queued locally and sent when connectivity returns
- **Push Notifications** -- Register device tokens for background message delivery
- **Live Agent Handover** -- Seamless transition between bot and human agents
- **Message Reactions** -- Users can react to messages with emoji
- **Read Receipts** -- Delivery and read status indicators on messages
- **Knowledge Base** -- Surface help articles directly in the chat interface
- **Analytics** -- Built-in event tracking for sessions, messages, and user behavior
- **Theming** -- Light and dark themes out of the box, fully customizable
- **Session Persistence** -- Conversations survive app restarts via AsyncStorage
- **File Uploads** -- Attach images and documents from the device
- **TypeScript** -- Complete type definitions for every export

## Requirements

| Dependency     | Minimum Version |
|----------------|-----------------|
| React          | 17.0.0          |
| React Native   | 0.70.0          |
| iOS            | 12.0+           |
| Android        | API 21+         |

## Installation

```bash
npm install @conferbot/react-native
# or
yarn add @conferbot/react-native
```

### Peer Dependencies

```bash
npm install react react-native @react-native-async-storage/async-storage
```

`@react-native-async-storage/async-storage` is optional but required for session persistence and offline queue features.

## Getting Your API Key and Bot ID

You need two credentials to use the SDK:

1. **Log in** to [Conferbot Dashboard](https://app.conferbot.com)
2. **Create or select a bot** from the dashboard
3. **Find your Bot ID**: Go to **Bot Settings** > **General** -- the Bot ID is displayed at the top
4. **Find your API Key**: Go to **Workspace Settings** > **API Keys** -- copy the key starting with `conf_`

> **Note:** For development and testing, you can use the example app's built-in test credentials. For production, always use your own API key and bot ID.

## Quick Start

### 1. Drop-in ChatWidget

The fastest path -- renders a complete chat UI with a single component.

```tsx
import React from 'react';
import { ConferBotProvider, ChatWidget } from '@conferbot/react-native';

export default function App() {
  return (
    <ConferBotProvider apiKey="YOUR_API_KEY" botId="YOUR_BOT_ID">
      <ChatWidget />
    </ConferBotProvider>
  );
}
```

### 2. Floating Widget (FAB)

A floating action button that overlays on top of your app. Tapping it opens the chat in a bottom sheet. Supports server-driven customization (colors, icon, CTA tooltip, position).

```tsx
import React from 'react';
import { View, Text } from 'react-native';
import { ConferBotProvider, ConferBotWidget } from '@conferbot/react-native';

export default function App() {
  return (
    <ConferBotProvider apiKey="YOUR_API_KEY" botId="YOUR_BOT_ID">
      <View style={{ flex: 1 }}>
        <Text>Your App Content</Text>
        <ConferBotWidget />
      </View>
    </ConferBotProvider>
  );
}
```

The widget reads server customizations automatically -- FAB color, icon, size, position, CTA text, and border radius are all configurable from the Conferbot dashboard.

### 3. Headless (useConferBot Hook)

Full control over the UI -- the hook manages connection state, messages, and actions.

```tsx
import React from 'react';
import { View, Text, Button, FlatList } from 'react-native';
import { ConferBotProvider, useConferBot } from '@conferbot/react-native';

function ChatScreen() {
  const { openChat, sendMessage, record, isConnected } = useConferBot();

  return (
    <View style={{ flex: 1 }}>
      <Text>{isConnected ? 'Connected' : 'Connecting...'}</Text>
      <FlatList
        data={record}
        keyExtractor={(item, i) => String(i)}
        renderItem={({ item }) => <Text>{item.text}</Text>}
      />
      <Button title="Send Hello" onPress={() => sendMessage('Hello!')} />
    </View>
  );
}

export default function App() {
  return (
    <ConferBotProvider apiKey="YOUR_API_KEY" botId="YOUR_BOT_ID">
      <ChatScreen />
    </ConferBotProvider>
  );
}
```

### 3. Mix and Match (Individual Components)

Use pre-built components alongside your own custom UI.

```tsx
import React from 'react';
import { View } from 'react-native';
import {
  ConferBotProvider,
  useConferBot,
  MessageList,
  ChatInput,
  ChatHeader,
  ConnectionStatus,
} from '@conferbot/react-native';

function CustomChat() {
  const { record, sendMessage, currentAgent } = useConferBot();

  return (
    <View style={{ flex: 1 }}>
      <ChatHeader />
      <ConnectionStatus />
      <MessageList messages={record} />
      <ChatInput onSend={sendMessage} />
    </View>
  );
}

export default function App() {
  return (
    <ConferBotProvider apiKey="YOUR_API_KEY" botId="YOUR_BOT_ID">
      <CustomChat />
    </ConferBotProvider>
  );
}
```

## Configuration

### ConferBotConfig

Pass a `config` prop to `ConferBotProvider` to control SDK behavior.

```tsx
<ConferBotProvider
  apiKey="YOUR_API_KEY"
  botId="YOUR_BOT_ID"
  config={{
    enableNotifications: true,
    enableOfflineMode: true,
    enablePersistence: true,
    enableReadReceipts: true,
    autoConnect: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 3000,
  }}
>
  {children}
</ConferBotProvider>
```

| Option                  | Type    | Default | Description                              |
|-------------------------|---------|---------|------------------------------------------|
| `enableNotifications`   | boolean | false   | Enable push notification support         |
| `enableOfflineMode`     | boolean | false   | Queue messages when offline              |
| `enablePersistence`     | boolean | false   | Persist sessions across app restarts     |
| `enableReadReceipts`    | boolean | true    | Show message delivery/read indicators    |
| `autoConnect`           | boolean | true    | Connect to socket on mount               |
| `reconnectionAttempts`  | number  | 5       | Max reconnection attempts                |
| `reconnectionDelay`     | number  | 3000    | Delay between reconnection attempts (ms) |

### ConferBotCustomization

Pass a `customization` prop to style the built-in UI components.

```tsx
<ConferBotProvider
  apiKey="YOUR_API_KEY"
  botId="YOUR_BOT_ID"
  customization={{
    primaryColor: '#4F46E5',
    fontFamily: 'Inter',
    headerTitle: 'Support',
    bubbleRadius: 12,
    enableAvatar: true,
    avatarUrl: 'https://example.com/avatar.png',
    botBubbleColor: '#F3F4F6',
    userBubbleColor: '#4F46E5',
  }}
>
  {children}
</ConferBotProvider>
```

### User Identification

Identify users so conversations persist across sessions and devices.

```tsx
<ConferBotProvider
  apiKey="YOUR_API_KEY"
  botId="YOUR_BOT_ID"
  user={{
    id: 'user_123',
    name: 'Jane Doe',
    email: 'jane@example.com',
  }}
>
  {children}
</ConferBotProvider>
```

## Theming

The SDK ships with light and dark themes. Wrap your app in `ThemeProvider` to apply one globally or provide a custom theme.

```tsx
import { ThemeProvider, darkTheme } from '@conferbot/react-native';

export default function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <ConferBotProvider apiKey="YOUR_API_KEY" botId="YOUR_BOT_ID">
        <ChatWidget />
      </ConferBotProvider>
    </ThemeProvider>
  );
}
```

To customize further, spread a base theme and override specific tokens:

```tsx
import { defaultTheme } from '@conferbot/react-native';

const customTheme = {
  ...defaultTheme,
  colors: {
    ...defaultTheme.colors,
    primary: '#4F46E5',
  },
};
```

## Push Notifications

Register a device push token (from Firebase, APNs, or Expo) to receive messages when the app is backgrounded.

```tsx
const { registerPushToken } = useConferBot();

// After obtaining a token from your push notification provider:
await registerPushToken(deviceToken);
```

## Offline Support

When `enableOfflineMode` is set, outbound messages are queued locally and flushed automatically once connectivity is restored. Use the `useOfflineQueue` and `useNetworkStatus` hooks for fine-grained control.

```tsx
import { useOfflineQueue, useNetworkStatus } from '@conferbot/react-native';

const { isOnline } = useNetworkStatus();
const { pendingCount, flush } = useOfflineQueue();
```

## Message Reactions

Users can react to any message with emoji. The `useReactions` hook and the `ReactionPicker` / `MessageReactions` components handle state and rendering.

```tsx
import { useReactions, ReactionPicker } from '@conferbot/react-native';

const { addReaction, removeReaction } = useReactions();
```

## Read Receipts

Message status indicators (sent, delivered, read) update in real time. Enable via `config.enableReadReceipts` and use the `useReadReceipts` hook or `MessageStatusIndicator` component.

## Knowledge Base

Surface help articles inside the chat interface. The `KnowledgeBase` component connects to your Conferbot knowledge base and lets users search and browse articles without leaving the conversation.

## Analytics

Track session metrics, message counts, drop-off points, and custom events. Wrap your provider with `ConferBotWithAnalyticsProvider` or use the `useAnalytics` hook directly.

```tsx
import { ConferBotWithAnalyticsProvider } from '@conferbot/react-native';

<ConferBotWithAnalyticsProvider apiKey="YOUR_API_KEY" botId="YOUR_BOT_ID">
  <ChatWidget />
</ConferBotWithAnalyticsProvider>
```

```tsx
const { trackEvent } = useAnalytics();
trackEvent('custom_action', { screen: 'checkout' });
```

## Socket Events

Subscribe to real-time events for advanced use cases.

```tsx
import { useConferBot } from '@conferbot/react-native';

const { on } = useConferBot();

useEffect(() => {
  const unsubscribe = on('bot_response', (data) => {
    console.log('Bot responded:', data);
  });
  return unsubscribe;
}, []);
```

Key events: `bot_response`, `agent_message`, `agent_accepted`, `agent_left`, `agent_typing_status`, `chat_ended`, `connection_error`.

## API Reference

For the complete API surface -- every component prop, hook return value, and type definition -- see the [docs/](docs/) directory:

- [API.md](docs/API.md) -- Full API reference
- [COMPONENTS.md](docs/COMPONENTS.md) -- Component catalog
- [COMPONENT_ARCHITECTURE.md](docs/COMPONENT_ARCHITECTURE.md) -- Component design patterns
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) -- SDK architecture overview
- [EXAMPLES.md](docs/EXAMPLES.md) -- Additional code examples

## Example App

A fully working example app is included in the [`example/`](example/) directory. It demonstrates all three integration patterns with a tab-based UI.

### Running the Example

```bash
# 1. Clone the repo
git clone https://github.com/conferbot/react-native-sdk.git
cd react-native-sdk

# 2. Install SDK dependencies
npm install

# 3. Set up the example app
cd example
npm install

# 4. Configure your bot credentials
#    Open example/App.tsx and replace:
#      const API_KEY = 'test_key';
#      const BOT_ID = '69e8503cf33718a92ea792fe';
#    with your own API key and Bot ID from the Conferbot dashboard.

# 5. (Optional) Point to production server
#    Remove or update the ConferBotEndpoints.configure() block in App.tsx.
#    By default, the SDK connects to https://embed.conferbot.com

# 6. Run on Android
npx react-native run-android

# 7. Or run on iOS
cd ios && pod install && cd ..
npx react-native run-ios
```

### What the Example Shows

| Tab | Pattern | Description |
|-----|---------|-------------|
| **Widget** | Drop-in | Full chat UI opens in a modal -- one component, zero config |
| **Headless** | Hook-based | Custom UI with `useConferBot()` hook for full control |
| **Custom** | Mix & match | Pre-built components (`MessageList`, `ChatInput`) in a custom layout |

## Development

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript
npm run watch        # Watch mode
npm run lint         # Run ESLint
npm run type-check   # Type check without emitting
npm test             # Run tests
npm run test:coverage # Tests with coverage report
```

## Contributing

Contributions are welcome. Please open an issue first to discuss what you would like to change, then submit a pull request.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-change`)
3. Commit your changes
4. Push to your fork and open a pull request

## License

Apache 2.0 -- see [LICENSE](LICENSE) for details.

## Links

- [Full Documentation](https://docs.conferbot.com/mobile/react-native)
- [GitHub Issues](https://github.com/conferbot/react-native-sdk/issues)
- [Conferbot Website](https://www.conferbot.com)
- [Support](mailto:support@conferbot.com)
